// ブランド名が決まるまでの仮の表記。決まったらここだけを差し替える
export const BRAND_NAME = 'book-search'

export const REPOSITORY_URL = 'https://github.com/tofu-dev0123/book-search'

export const OPENBD_URL = 'https://openbd.jp/'

// 「探しているのは、」に続けて読める、ラフな答えの例。ジャンルが重ならないようにしている
export const PLACEHOLDERS = [
  '数式の少ない統計の入門書',
  '京都が舞台のミステリー',
  '平日でも作れる作り置きのレシピ',
  '戦国時代を武将以外の目線で書いた本',
  'はじめて部下を持つ人向けの本',
  '子どもと一緒に読める宇宙の本',
  'プログラミング未経験から読める本',
  'ひとり旅で行きたい国内の町の本',
  'よく眠れるようになる習慣の本',
  '写真の構図を基礎から学べる本',
]

export function pickPlaceholder(random: () => number = Math.random): string {
  return PLACEHOLDERS[Math.floor(random() * PLACEHOLDERS.length)]
}
