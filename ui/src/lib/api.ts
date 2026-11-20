// 検索 API（GET /search・GET /books/{isbn}）の呼び出し。応答の形は API と揃える
import { API_URL } from './config'

export type Book = {
  isbn: string
  title: string
  author: string
  publisher: string
  pubdate: string
  cover: string
  description: string
}

export type Hit = Book & { score: number }

export type SearchResponse = {
  total: number
  took_ms: number
  hits: Hit[]
}

// API が 200 以外を返したとき。検索では 503・422 などを区別せず「使えない」として扱う
export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`API が ${status} を返した`)
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
  if (!res.ok) throw new ApiError(res.status)
  return res.json()
}

// 書誌がないとき（404）と ISBN の形式の誤り（422）は、status で見分ける
export async function getBook(isbn: string, signal?: AbortSignal): Promise<Book> {
  const res = await fetch(`${API_URL}/books/${encodeURIComponent(isbn)}`, { signal })
  if (!res.ok) throw new ApiError(res.status)
  return res.json()
}
