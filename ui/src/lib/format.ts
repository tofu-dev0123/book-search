// pubdate の形式は揃っていない（20110228・2010-07・2003・"2001, c2000-01" など）。
// 先頭の西暦4桁を年とし、続く1〜2桁が 1〜12 なら月とする。日は本を選ぶ手がかりにならないので落とす
export function formatPubdate(pubdate: string): string {
  const match = /^(\d{4})(?:-?(\d{1,2}))?/.exec(pubdate)
  if (!match) return ''
  const [, year, month] = match
  const m = Number(month)
  return m >= 1 && m <= 12 ? `${year}年${m}月` : `${year}年`
}
