"""openBD の API と、書誌レコードの読み方。"""

import json
import urllib.parse
import urllib.request

COVERAGE_URL = "https://api.openbd.jp/v1/coverage"
GET_URL = "https://api.openbd.jp/v1/get"

# /v1/get に1リクエストで渡す ISBN の数
GET_BATCH_SIZE = 1000

# これより短い内容紹介の書誌は投入対象にしない
MIN_DESCRIPTION_LENGTH = 50

# 内容紹介として使う TextType。先頭を優先する（03: 長い内容紹介、02: 短い紹介）
DESCRIPTION_TEXT_TYPES = ("03", "02")


def fetch_coverage() -> list[str]:
    """openBD が収録している ISBN の一覧を返す。"""
    with urllib.request.urlopen(COVERAGE_URL) as res:
        return json.load(res)


def fetch_records(isbns: list[str]) -> list[dict | None]:
    """ISBN ごとの書誌レコードを返す。収録されていない ISBN は None になる。"""
    data = urllib.parse.urlencode({"isbn": ",".join(isbns)}).encode()
    with urllib.request.urlopen(GET_URL, data=data) as res:
        return json.load(res)


def description(record: dict) -> str | None:
    """内容紹介を原文のまま返す。TextType 03 を優先し、なければ 02。どちらもなければ None。"""
    contents = record["onix"].get("CollateralDetail", {}).get("TextContent", [])
    texts = {c["TextType"]: c["Text"] for c in contents}
    for text_type in DESCRIPTION_TEXT_TYPES:
        if text_type in texts:
            return texts[text_type]
    return None


def has_description(record: dict) -> bool:
    text = description(record)
    return text is not None and len(text) >= MIN_DESCRIPTION_LENGTH
