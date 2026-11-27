"""openBD の API と、書誌レコードの読み方。

全件の取得は数時間かかり、無人で定期実行する前提なので、リクエストにはタイムアウトと再試行を付ける。
"""

import http.client
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

COVERAGE_URL = "https://api.openbd.jp/v1/coverage"
GET_URL = "https://api.openbd.jp/v1/get"

# /v1/get に1リクエストで渡す ISBN の数
GET_BATCH_SIZE = 1000

# 1,000件の応答は数MBで通常は数秒で返る。応答が無いまま待ち続けないための上限
REQUEST_TIMEOUT_SECONDS = 60

# 一時的な失敗を再試行する回数（最初の1回を含む）と、最初の待ち時間。待ち時間は 2・4・8・16秒と倍にする
MAX_ATTEMPTS = 5
RETRY_BASE_SECONDS = 2

# これより短い内容紹介の書誌は投入対象にしない
MIN_DESCRIPTION_LENGTH = 50

# 内容紹介として使う TextType。先頭を優先する（03: 長い内容紹介、02: 短い紹介）
DESCRIPTION_TEXT_TYPES = ("03", "02")


def is_retryable(error: Exception) -> bool:
    """時間をおけば直る可能性がある失敗か。"""
    if isinstance(error, urllib.error.HTTPError):
        return error.code == 429 or error.code >= 500
    # OSError は通信エラー・タイムアウト・URLError を含む。HTTPException は読み込み途中の切断など
    return isinstance(error, (OSError, http.client.HTTPException))


def request_json(url: str, data: bytes | None) -> Any:
    with urllib.request.urlopen(url, data=data, timeout=REQUEST_TIMEOUT_SECONDS) as res:
        return json.load(res)


def fetch_json(url: str, data: bytes | None = None) -> Any:
    """url の JSON を返す。一時的な失敗は MAX_ATTEMPTS 回まで試し、最後の回の例外はそのまま上げる。"""
    for attempt in range(1, MAX_ATTEMPTS):
        try:
            return request_json(url, data)
        except Exception as e:
            if not is_retryable(e):
                raise
            wait = RETRY_BASE_SECONDS * 2 ** (attempt - 1)
            print(f"{url} への要求に失敗した（{attempt} 回目）: {e!r}。{wait} 秒後に再試行する", file=sys.stderr)
            time.sleep(wait)
    return request_json(url, data)


def fetch_coverage() -> list[str]:
    """openBD が収録している ISBN の一覧を返す。"""
    return fetch_json(COVERAGE_URL)


def fetch_records(isbns: list[str]) -> list[dict | None]:
    """ISBN ごとの書誌レコードを返す。収録されていない ISBN は None になる。"""
    data = urllib.parse.urlencode({"isbn": ",".join(isbns)}).encode()
    return fetch_json(GET_URL, data=data)


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
