import pytest
from elastic_transport import ApiResponseMeta, HttpHeaders, NodeConfig
from elasticsearch import ConnectionError, NotFoundError
from fastapi.testclient import TestClient

from book_search.api import app as api
from book_search.search import query

client = TestClient(api.app)


def not_found(error: str) -> NotFoundError:
    meta = ApiResponseMeta(404, "1.1", HttpHeaders(), 0.0, NodeConfig("http", "localhost", 9200))
    return NotFoundError(error, meta, {"error": {"type": error}, "status": 404})


@pytest.fixture
def search_raises(monkeypatch):
    # ES のクライアントではなく search の関数を差し替え、API が受け取る例外だけを作る
    def patch(e: Exception):
        def raise_(*args, **kwargs):
            raise e

        monkeypatch.setattr(query, "search", raise_)

    return patch


@pytest.mark.parametrize("q", [" ", "　\t"])
def test_blank_query_is_422(q):
    res = client.get("/search", params={"q": q})

    assert res.status_code == 422
    assert res.json()["detail"][0]["loc"] == ["query", "q"]


def test_result_window_over_10000_is_422():
    res = client.get("/search", params={"q": "歴史", "from": 9901, "size": 100})

    assert res.status_code == 422
    assert res.json()["detail"][0]["loc"] == ["query", "from"]


def test_unreachable_es_is_503(search_raises):
    search_raises(ConnectionError("接続できない"))

    res = client.get("/search", params={"q": "歴史"})

    assert res.status_code == 503


def test_missing_index_is_503(search_raises):
    search_raises(not_found("index_not_found_exception"))

    res = client.get("/search", params={"q": "歴史"})

    assert res.status_code == 503
