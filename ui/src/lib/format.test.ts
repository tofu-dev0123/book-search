import { describe, expect, test } from 'vitest'

import { formatPubdate } from './format'

describe('formatPubdate', () => {
  test.each([
    ['20110228', '2011年2月'],
    ['2010-07', '2010年7月'],
    ['2007-01-10', '2007年1月'],
    ['2010-4-28', '2010年4月'],
    ['2003', '2003年'],
    ['2001, c2000-01', '2001年'],
  ])('%s は %s と表示する', (pubdate, expected) => {
    expect(formatPubdate(pubdate)).toBe(expected)
  })

  test('月が 1〜12 でなければ年だけにする', () => {
    expect(formatPubdate('20111301')).toBe('2011年')
    expect(formatPubdate('20110001')).toBe('2011年')
  })

  test.each(['c2001-', ''])('年が取れない %j は空文字にする', (pubdate) => {
    expect(formatPubdate(pubdate)).toBe('')
  })
})
