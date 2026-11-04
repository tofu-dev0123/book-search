"""openBD から内容紹介つきの書誌を取得し、JSONL に保存する。

書誌は ISBN ごとの sha256(シード + ISBN) の小さい順に取る。coverage に ISBN が増減しても、
既存の ISBN の順位は変わらないので、同じシードならほぼ同じ集合を再現できる。
"""

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

from book_search import openbd

# openBD への負荷を抑えるため、/v1/get のリクエストの間に空ける秒数
REQUEST_INTERVAL_SECONDS = 1.0


def order_key(seed: int, isbn: str) -> str:
    return hashlib.sha256(f"{seed}{isbn}".encode()).hexdigest()


def positive_int(value: str) -> int:
    n = int(value)
    if n < 1:
        raise argparse.ArgumentTypeError("1 以上を指定する")
    return n


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--seed", type=int, default=0, help="並び順を決めるシード（既定: 0）")
    parser.add_argument("--limit", type=positive_int, default=1000, help="保存する書誌の件数（既定: 1000）")
    parser.add_argument("--out", type=Path, default=Path("data/books.jsonl"), help="出力先（既定: data/books.jsonl）")
    args = parser.parse_args()

    coverage = openbd.fetch_coverage()
    isbns = sorted(coverage, key=lambda isbn: order_key(args.seed, isbn))
    print(f"coverage: {len(coverage)} 件", file=sys.stderr)

    # 途中で失敗したときに既存の JSONL を壊さないよう、一時ファイルに書いてから置き換える
    args.out.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.out.with_suffix(args.out.suffix + ".tmp")
    saved = 0
    requested = 0
    try:
        with tmp.open("w", encoding="utf-8") as f:
            for start in range(0, len(isbns), openbd.GET_BATCH_SIZE):
                if start > 0:
                    time.sleep(REQUEST_INTERVAL_SECONDS)
                batch = isbns[start : start + openbd.GET_BATCH_SIZE]
                requested += len(batch)
                for record in openbd.fetch_records(batch):
                    if record is None or not openbd.has_description(record):
                        continue
                    # 加工せずに保存する。index 用のフィールドへの変換は load で行う
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")
                    saved += 1
                    if saved == args.limit:
                        break
                print(f"取得 {requested} 件 / 保存 {saved} 件", file=sys.stderr)
                if saved == args.limit:
                    break
        if saved < args.limit:
            sys.exit(f"内容紹介つきの書誌が {args.limit} 件に届かなかった（{saved} 件）")
        tmp.replace(args.out)
    finally:
        tmp.unlink(missing_ok=True)
    print(f"{args.out} に {saved} 件を保存した", file=sys.stderr)
