// icon.svg と og-image.html から、favicon（SVG・PNG）と OGP 画像を public/ に書き出す（npm run brand:build）。
// アイコンや文言を変えたときだけ流し、書き出したファイルはコミットする。PNG は手元の Chrome のヘッドレスモードで
// 描画する（ビルドのたびに作らないので、Playwright などのブラウザ本体を含む依存は入れない）
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BRAND_NAME } from '../src/lib/brand.ts'

const CHROME_PATH =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const BRAND_DIR = import.meta.dirname
const PUBLIC_DIR = join(BRAND_DIR, '..', 'public')

// 画面の文字色（src/styles/global.css の --fg）。ダークモードのタブでは背景に沈まないよう白にする
const FG = '#17191c'

const icon = readFileSync(join(BRAND_DIR, 'icon.svg'), 'utf8').trim()

function writeFaviconSvg() {
  const style = `<style>svg { color: ${FG} } @media (prefers-color-scheme: dark) { svg { color: #ffffff } }</style>`
  const svg = icon.replace(/<svg[^>]*>/, (open) => `${open}\n  ${style}`)
  writeFileSync(join(PUBLIC_DIR, 'favicon.svg'), `${svg}\n`)
}

// アイコンだけを置いたページ。background を透明にすると、PNG の地も透明になる
function iconPage(size: number, iconSize: number, background: string) {
  return `<!doctype html>
<style>
  html, body { width: ${size}px; height: ${size}px; margin: 0; overflow: hidden; }
  body { display: grid; place-items: center; background: ${background}; color: ${FG}; }
  svg { width: ${iconSize}px; height: ${iconSize}px; }
</style>
${icon}`
}

function ogPage() {
  return readFileSync(join(BRAND_DIR, 'og-image.html'), 'utf8')
    .replace('{{ICON}}', icon)
    .replace('{{BRAND_NAME}}', BRAND_NAME)
}

function screenshot(html: string, width: number, height: number, out: string, workDir: string) {
  const page = join(workDir, `${out}.html`)
  writeFileSync(page, html)
  execFileSync(
    CHROME_PATH,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      `--window-size=${width},${height}`,
      // OGP 画像の Web フォントを読み込み終えてから撮る
      '--virtual-time-budget=10000',
      `--screenshot=${join(PUBLIC_DIR, out)}`,
      `file://${page}`,
    ],
    { stdio: 'ignore' },
  )
  console.log(`public/${out}`)
}

const workDir = mkdtempSync(join(tmpdir(), 'brand-'))
try {
  writeFaviconSvg()
  console.log('public/favicon.svg')
  screenshot(iconPage(32, 32, 'transparent'), 32, 32, 'favicon-32.png', workDir)
  // iPhone のホーム画面では角が丸く切られるので、白い地に余白をとって置く
  screenshot(iconPage(180, 128, '#ffffff'), 180, 180, 'apple-touch-icon.png', workDir)
  screenshot(ogPage(), 1200, 630, 'og-image.png', workDir)
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
