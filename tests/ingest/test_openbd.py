import io
import json
import urllib.error

import pytest

from book_search.ingest import openbd


def http_error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(openbd.GET_URL, code, "error", {}, io.BytesIO())  # type: ignore[arg-type]


def response(body: str) -> io.BytesIO:
    # urlopen の戻り値のうち、fetch_json が使う部分（with と read）だけを持つ
    return io.BytesIO(body.encode())


@pytest.fixture
def sleeps(monkeypatch) -> list[float]:
    waited: list[float] = []
    monkeypatch.setattr(openbd.time, "sleep", waited.append)
    return waited


def stub_urlopen(monkeypatch, outcomes: list) -> list[dict]:
    """outcomes を順に返す（例外なら上げる）urlopen に差し替え、呼ばれたときの引数を記録する。"""
    calls: list[dict] = []

    def urlopen(url, data=None, timeout=None):
        calls.append({"url": url, "data": data, "timeout": timeout})
        outcome = outcomes[len(calls) - 1]
        if isinstance(outcome, Exception):
            raise outcome
        return response(outcome)

    monkeypatch.setattr(openbd.urllib.request, "urlopen", urlopen)
    return calls


@pytest.mark.parametrize(
    "error",
    [http_error(500), http_error(503), http_error(429), urllib.error.URLError("refused"), TimeoutError()],
)
def test_fetch_json_retries_temporary_failure(monkeypatch, sleeps, error):
    calls = stub_urlopen(monkeypatch, [error, json.dumps(["9784000000001"])])

    assert openbd.fetch_json(openbd.COVERAGE_URL) == ["9784000000001"]
    assert len(calls) == 2
    assert sleeps == [2]


def test_fetch_json_does_not_retry_client_error(monkeypatch, sleeps):
    calls = stub_urlopen(monkeypatch, [http_error(404)])

    with pytest.raises(urllib.error.HTTPError):
        openbd.fetch_json(openbd.COVERAGE_URL)
    assert len(calls) == 1
    assert sleeps == []


def test_fetch_json_does_not_retry_invalid_json(monkeypatch, sleeps):
    calls = stub_urlopen(monkeypatch, ["<html>"])

    with pytest.raises(json.JSONDecodeError):
        openbd.fetch_json(openbd.COVERAGE_URL)
    assert len(calls) == 1


def test_fetch_json_raises_after_max_attempts(monkeypatch, sleeps):
    calls = stub_urlopen(monkeypatch, [http_error(502)] * openbd.MAX_ATTEMPTS)

    with pytest.raises(urllib.error.HTTPError):
        openbd.fetch_json(openbd.COVERAGE_URL)
    assert len(calls) == openbd.MAX_ATTEMPTS
    assert sleeps == [2, 4, 8, 16]


def test_fetch_records_posts_isbns_with_timeout(monkeypatch, sleeps):
    calls = stub_urlopen(monkeypatch, [json.dumps([None, None])])

    assert openbd.fetch_records(["9784000000001", "9784000000002"]) == [None, None]
    assert calls[0]["url"] == openbd.GET_URL
    assert calls[0]["data"] == b"isbn=9784000000001%2C9784000000002"
    assert calls[0]["timeout"] == openbd.REQUEST_TIMEOUT_SECONDS
