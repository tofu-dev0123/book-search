"""fetch が保存した JSONL を、index を作り直したうえで Elasticsearch に投入する。

ES は既存フィールドの analyzer を変えられないので、毎回 index を削除して作り直す。
作り直しを付け忘れて古い設定のまま投入する、ということを起こさないため。
"""

import argparse
import json
import os
import sys
from collections.abc import Iterator
from importlib import resources
from pathlib import Path

from elasticsearch import Elasticsearch, helpers

from book_search.ingest import openbd


def to_document(record: dict) -> dict:
    summary = record["summary"]
    return {
        "isbn": summary["isbn"],
        "title": summary["title"],
        "author": summary["author"],
        "publisher": summary["publisher"],
        "description": openbd.description(record),
        "pubdate": summary["pubdate"],
        "cover": summary["cover"],
    }


def read_documents(path: Path) -> Iterator[dict]:
    with path.open(encoding="utf-8") as f:
        for line in f:
            record = json.loads(line)
            if not openbd.has_description(record):
                raise ValueError(f"内容紹介のない書誌が含まれている: {record['summary']['isbn']}")
            yield to_document(record)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--input", type=Path, default=Path("data/books.jsonl"), help="入力（既定: data/books.jsonl）")
    parser.add_argument("--index", default="books", help="index 名（既定: books）")
    args = parser.parse_args()

    es = Elasticsearch(os.environ.get("ES_URL", "http://localhost:9200"))
    definition = json.loads(resources.files("book_search.ingest").joinpath("books_index.json").read_text())

    # 入力の不備で既存の index を空にしないよう、削除の前に全件を読み切る
    documents = list(read_documents(args.input))

    es.indices.delete(index=args.index, ignore_unavailable=True)
    es.indices.create(index=args.index, settings=definition["settings"], mappings=definition["mappings"])

    # _id に ISBN を使い、同じ書誌を重複させない
    actions = ({"_index": args.index, "_id": doc["isbn"], "_source": doc} for doc in documents)
    helpers.bulk(es, actions)
    es.indices.refresh(index=args.index)

    count = es.count(index=args.index)["count"]
    print(f"{args.index} に {count} 件を投入した", file=sys.stderr)
