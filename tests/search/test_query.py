import json
import os
import sys

import pytest
from elasticsearch import Elasticsearch

from book_search.ingest import load
from book_search.search import query

TEST_INDEX = "test-books"


def test_build_query_searches_all_fields():
    assert query.build_query("歴史") == {"multi_match": {"query": "歴史", "fields": query.SEARCH_FIELDS}}


def record(isbn: str, title: str, text: str) -> dict:
    # load が読む openBD のレコードのうち、投入に使う部分だけを持つ
    return {
        "summary": {
            "isbn": isbn,
            "title": title,
            "author": "著者",
            "publisher": "出版社",
            "pubdate": "2020",
            "cover": "",
        },
        "onix": {"CollateralDetail": {"TextContent": [{"TextType": "03", "Text": text}]}},
    }


RECORDS = [
    record("9780000000001", "日本の歴史", "古代から近代までの日本の歴史を、史料に基づいてたどる。" * 3),
    record("9780000000002", "機械学習入門", "初学者向けに、機械学習の基礎となる考え方と手法を解説する。" * 3),
    record("9780000000003", "料理の基本", "家庭で作れる料理の基本を、写真つきで一つずつ説明する。" * 3),
]


@pytest.fixture
def es(tmp_path, monkeypatch):
    # load は index を削除して作り直すので、開発用の books ではなく専用の index に投入する
    path = tmp_path / "books.jsonl"
    path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in RECORDS), encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["load", "--input", str(path), "--index", TEST_INDEX])
    client = Elasticsearch(os.environ.get("ES_URL", "http://localhost:9200"))
    try:
        load.main()
        yield client
    finally:
        client.indices.delete(index=TEST_INDEX, ignore_unavailable=True)


@pytest.mark.es
def test_search_returns_matching_books(es):
    res = query.search(es, "機械学習", size=10, from_=0, index=TEST_INDEX)

    assert res["total"] == 1
    assert [hit["isbn"] for hit in res["hits"]] == ["9780000000002"]
    assert set(res["hits"][0]) == {*query.SOURCE_FIELDS, "score"}
