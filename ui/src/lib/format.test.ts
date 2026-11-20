import { describe, expect, test } from 'vitest'

import { formatPubdate, META_DESCRIPTION_LENGTH, toMetaDescription } from './format'

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

describe('toMetaDescription', () => {
  test('改行と連続する空白を1つの空白にまとめる', () => {
    expect(toMetaDescription('  一行目。\n\n二行目。\t 三行目。 ')).toBe(
      '一行目。 二行目。 三行目。',
    )
  })

  test('先頭から META_DESCRIPTION_LENGTH 字までにする', () => {
    const text = 'あ'.repeat(META_DESCRIPTION_LENGTH + 10)
    expect(toMetaDescription(text)).toBe('あ'.repeat(META_DESCRIPTION_LENGTH))
  })

  test('サロゲートペアの文字も1字として数え、途中で切らない', () => {
    const text = '𠮷'.repeat(META_DESCRIPTION_LENGTH + 1)
    expect(toMetaDescription(text)).toBe('𠮷'.repeat(META_DESCRIPTION_LENGTH))
  })
})
