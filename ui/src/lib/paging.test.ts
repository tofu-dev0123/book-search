import { describe, expect, test } from 'vitest'

import { hasNextPage, MAX_PAGE, parsePage, toFrom } from './paging'

describe('parsePage', () => {
  test.each([
    ['1', 1],
    ['2', 2],
    ['500', 500],
  ])('%s は %i ページ目', (value, expected) => {
    expect(parsePage(value)).toBe(expected)
  })

  test.each([null, '', 'abc', '0', '-1', '1.5', '501', '9999'])(
    '不正な値 %j は 1 ページ目',
    (value) => {
      expect(parsePage(value)).toBe(1)
    },
  )
})

describe('toFrom', () => {
  test('page から API の from を計算する', () => {
    expect(toFrom(1)).toBe(0)
    expect(toFrom(2)).toBe(20)
    expect(toFrom(MAX_PAGE)).toBe(9980)
  })
})

describe('hasNextPage', () => {
  test('総件数の途中なら次へ進める', () => {
    expect(hasNextPage(1, 98)).toBe(true)
    expect(hasNextPage(4, 98)).toBe(true)
  })

  test('最後のページでは次へ進めない', () => {
    expect(hasNextPage(5, 98)).toBe(false)
    expect(hasNextPage(1, 20)).toBe(false)
    expect(hasNextPage(1, 0)).toBe(false)
  })

  test('API の上限のページでは次へ進めない', () => {
    expect(hasNextPage(MAX_PAGE - 1, 10000)).toBe(true)
    expect(hasNextPage(MAX_PAGE, 10000)).toBe(false)
  })
})
