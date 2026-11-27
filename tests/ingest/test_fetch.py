import io
import json
import sys
import urllib.error
from pathlib import Path

import pytest

from book_search.ingest import fetch, openbd

DESCRIPTION = "合成した内容紹介。" * 10  # MIN_DESCRIPTION_LENGTH を超える長さ


def record(isbn: str, text: str = DESCRIPTION) -> dict:
    # fetch が読む openBD のレコードのうち、内容紹介の判定に使う部分だけを持つ
    return {
        "summary": {"isbn": isbn},
        "onix": {"CollateralDetail": {"TextContent": [{"TextType": "03", "Text": text}]}},
    }


def stub_openbd(monkeypatch, records: dict[str, dict | None]) -> None:
    """coverage を records の ISBN にし、/v1/get が records を返すよう差し替える。"""
    monkeypatch.setattr(openbd, "fetch_coverage", lambda: list(records))
    monkeypatch.setattr(openbd, "fetch_records", lambda isbns: [records[isbn] for isbn in isbns])
    monkeypatch.setattr(fetch.time, "sleep", lambda _: None)


def run_fetch(monkeypatch, out: Path, *options: str) -> None:
    monkeypatch.setattr(sys, "argv", ["fetch", "--out", str(out), *options])
    fetch.main()


def write_lines(path: Path, n: int) -> None:
    path.write_text("".join(json.dumps(record(f"prev{i}")) + "\n" for i in range(n)), encoding="utf-8")


def isbns_in(path: Path) -> set[str]:
    with path.open(encoding="utf-8") as f:
        return {json.loads(line)["summary"]["isbn"] for line in f}


def books(n: int) -> dict[str, dict | None]:
    return {f"978400000{i:04d}": record(f"978400000{i:04d}") for i in range(n)}


def test_fetch_saves_all_records_with_description_by_default(monkeypatch, tmp_path):
    records = books(3) | {"9784999999991": None, "9784999999992": record("9784999999992", "短い")}
    stub_openbd(monkeypatch, records)
    out = tmp_path / "books.jsonl"

    run_fetch(monkeypatch, out)

    assert isbns_in(out) == set(books(3))


def test_fetch_stops_at_limit(monkeypatch, tmp_path):
    stub_openbd(monkeypatch, books(5))
    out = tmp_path / "books.jsonl"

    run_fetch(monkeypatch, out, "--limit", "2")

    assert fetch.count_lines(out) == 2


def test_fetch_with_limit_does_not_compare_with_previous(monkeypatch, tmp_path):
    stub_openbd(monkeypatch, books(5))
    out = tmp_path / "books.jsonl"
    write_lines(out, 100)

    run_fetch(monkeypatch, out, "--limit", "2")

    assert fetch.count_lines(out) == 2


def test_fetch_without_previous_does_not_compare(monkeypatch, tmp_path):
    stub_openbd(monkeypatch, books(1))
    out = tmp_path / "books.jsonl"

    run_fetch(monkeypatch, out)

    assert fetch.count_lines(out) == 1


def test_fetch_keeps_previous_when_shrunk_below_ratio(monkeypatch, tmp_path):
    stub_openbd(monkeypatch, books(8))
    out = tmp_path / "books.jsonl"
    write_lines(out, 10)
    before = out.read_text(encoding="utf-8")

    with pytest.raises(SystemExit) as exc:
        run_fetch(monkeypatch, out)

    # sys.exit に文字列を渡すと、終了コードは 1 になる
    assert isinstance(exc.value.code, str)
    assert "置き換えない" in exc.value.code
    assert out.read_text(encoding="utf-8") == before
    assert not out.with_suffix(".jsonl.tmp").exists()


def test_fetch_keeps_previous_when_request_fails(monkeypatch, tmp_path):
    stub_openbd(monkeypatch, books(3))

    def fail(isbns):
        raise urllib.error.HTTPError(openbd.GET_URL, 503, "error", {}, io.BytesIO())  # type: ignore[arg-type]

    monkeypatch.setattr(openbd, "fetch_records", fail)
    out = tmp_path / "books.jsonl"
    write_lines(out, 10)
    before = out.read_text(encoding="utf-8")

    with pytest.raises(urllib.error.HTTPError):
        run_fetch(monkeypatch, out)

    assert out.read_text(encoding="utf-8") == before
    assert not out.with_suffix(".jsonl.tmp").exists()


def test_fetch_replaces_previous_at_ratio(monkeypatch, tmp_path):
    stub_openbd(monkeypatch, books(9))
    out = tmp_path / "books.jsonl"
    write_lines(out, 10)

    run_fetch(monkeypatch, out)

    assert isbns_in(out) == set(books(9))
