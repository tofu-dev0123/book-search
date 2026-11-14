// 1ページの件数。API の size の既定と同じ
export const PAGE_SIZE = 20

// ES の index.max_result_window の既定値。from + size がこれを超えると API が 422 を返す
export const MAX_RESULT_WINDOW = 10000

export const MAX_PAGE = MAX_RESULT_WINDOW / PAGE_SIZE

// URL の page（1始まり）を解釈する。数字でない・1 未満・上限を超えるものは 1 ページ目として扱う
export function parsePage(value: string | null): number {
  if (value === null || !/^\d+$/.test(value)) return 1
  const page = Number(value)
  return page >= 1 && page <= MAX_PAGE ? page : 1
}

export function toFrom(page: number): number {
  return (page - 1) * PAGE_SIZE
}

// 最後のページと、API の上限（MAX_PAGE）では次へ進めない
export function hasNextPage(page: number, total: number): boolean {
  return page * PAGE_SIZE < total && page < MAX_PAGE
}
