"""検索 API。HTTP の入出力だけを担い、検索は search モジュールに任せる。"""

import logging
import os
from typing import Annotated

from elasticsearch import ConnectionError, ConnectionTimeout, Elasticsearch, NotFoundError
from fastapi import FastAPI, HTTPException, Query
from fastapi.exceptions import RequestValidationError

from book_search import search as book_search

# ES の index.max_result_window の既定値。from + size がこれを超えると ES がエラーを返す
MAX_RESULT_WINDOW = 10000

logger = logging.getLogger(__name__)
client = Elasticsearch(os.environ.get("ES_URL", "http://localhost:9200"))
app = FastAPI()


def unavailable(e: Exception) -> HTTPException:
    # 例外には ES のホストやポートが含まれるので、応答には出さずにログに残す
    logger.warning("検索を利用できない", exc_info=e)
    return HTTPException(status_code=503, detail="検索を一時的に利用できない")


@app.get("/search")
def search(
    q: Annotated[str, Query(min_length=1)],
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    from_: Annotated[int, Query(alias="from", ge=0)] = 0,
) -> dict:
    # 空白だけのクエリは、ES では検索語のないクエリになり 0 件が返る。入力がないものとして弾く
    if not q.strip():
        raise RequestValidationError(
            [{"type": "value_error", "loc": ("query", "q"), "msg": "空白以外の文字を含める", "input": q}]
        )
    if from_ + size > MAX_RESULT_WINDOW:
        raise RequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("query", "from"),
                    "msg": f"from + size は {MAX_RESULT_WINDOW} 以下にする",
                    "input": from_,
                }
            ]
        )

    # ES に繋がらない、または index がない（未投入・load で作り直し中）ときは、一時的に使えないものとして 503
    try:
        return book_search.search(client, q, size, from_)
    except (ConnectionError, ConnectionTimeout) as e:
        raise unavailable(e) from e
    except NotFoundError as e:
        if e.error == "index_not_found_exception":
            raise unavailable(e) from e
        raise


@app.get("/healthz")
def healthz() -> dict:
    # ES が応答するだけでなく、index がなければ /search が 503 になるので異常として扱う
    try:
        exists = client.indices.exists(index=book_search.INDEX)
    except (ConnectionError, ConnectionTimeout) as e:
        raise unavailable(e) from e
    if not exists:
        raise HTTPException(status_code=503, detail=f"index {book_search.INDEX} がない")
    return {"status": "ok"}
