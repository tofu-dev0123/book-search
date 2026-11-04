"""検索クエリの組み立てと実行。

API に依存しない関数として持ち、評価スクリプトからも直接呼べるようにする。
"""

from elasticsearch import Elasticsearch

INDEX = "books"

# 検索対象のフィールド。重み付けは評価セットで測ってから入れる（#12）
SEARCH_FIELDS = ["title", "author", "publisher", "description"]

# レスポンスに含める _source のフィールド
SOURCE_FIELDS = ["isbn", "title", "author", "publisher", "pubdate", "cover", "description"]


def build_query(q: str) -> dict:
    # multi_match の既定（best_fields）を使う。type と重みは並び順だけを変えるので、測ってから変える
    return {"multi_match": {"query": q, "fields": SEARCH_FIELDS}}


def search(client: Elasticsearch, q: str, size: int, from_: int) -> dict:
    res = client.search(index=INDEX, query=build_query(q), size=size, from_=from_, source=SOURCE_FIELDS)
    return {
        "total": res["hits"]["total"]["value"],
        "took_ms": res["took"],
        "hits": [{**hit["_source"], "score": hit["_score"]} for hit in res["hits"]["hits"]],
    }
