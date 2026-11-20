"""検索クエリの組み立てと実行。

API に依存しない関数として持ち、評価スクリプトからも直接呼べるようにする。
"""

from elasticsearch import Elasticsearch, NotFoundError

INDEX = "books"

# 検索対象のフィールド。重み付けは評価セットで測ってから入れる（#12）
SEARCH_FIELDS = ["title", "author", "publisher", "description"]

# レスポンスに含める _source のフィールド
SOURCE_FIELDS = ["isbn", "title", "author", "publisher", "pubdate", "cover", "description"]


def build_query(q: str) -> dict:
    # multi_match の既定（best_fields）を使う。type と重みは並び順だけを変えるので、測ってから変える
    return {"multi_match": {"query": q, "fields": SEARCH_FIELDS}}


def search(client: Elasticsearch, q: str, size: int, from_: int, index: str = INDEX) -> dict:
    res = client.search(index=index, query=build_query(q), size=size, from_=from_, source=SOURCE_FIELDS)
    return {
        "total": res["hits"]["total"]["value"],
        "took_ms": res["took"],
        "hits": [{**hit["_source"], "score": hit["_score"]} for hit in res["hits"]["hits"]],
    }


def get_book(client: Elasticsearch, isbn: str, index: str = INDEX) -> dict | None:
    # _id には ISBN を入れている（ingest/load.py）ので、検索せずに1件を直接取る
    try:
        res = client.get(index=index, id=isbn, source=SOURCE_FIELDS)
    except NotFoundError as e:
        # 書誌がないときも index がないときも 404 になる。書誌がないときだけ本文に found: false が入る
        if isinstance(e.body, dict) and e.body.get("found") is False:
            return None
        raise
    return res["_source"]
