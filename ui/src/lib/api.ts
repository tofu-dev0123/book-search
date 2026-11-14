// 検索 API（GET /search）の呼び出し。応答の形は API と揃える
import { API_URL } from './config'

export type Hit = {
  isbn: string
  title: string
  author: string
  publisher: string
  pubdate: string
  cover: string
  description: string
  score: number
}

export type SearchResponse = {
  total: number
  took_ms: number
  hits: Hit[]
}

// API が 200 以外を返したとき。UI は 503・422 などを区別せず「使えない」として扱う
export class SearchError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`検索 API が ${status} を返した`)
    this.status = status
  }
}

// signal で中断できる。新しい検索を始めたら前のリクエストを中断し、古い結果で上書きしないようにする
export async function search(
  q: string,
  from: number,
  size: number,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q, from: String(from), size: String(size) })
  const res = await fetch(`${API_URL}/search?${params}`, { signal })
  if (!res.ok) throw new SearchError(res.status)
  return res.json()
}
