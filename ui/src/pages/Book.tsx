import { type MouseEvent, useEffect, useLayoutEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import { Cover } from '../components/Cover'
import { Header } from '../components/Header'
import { LoadingIcon } from '../components/LoadingIcon'
import { type Book as BookData, getBook, ApiError } from '../lib/api'
import { BRAND_NAME } from '../lib/brand'
import { LOADING_DELAY_MS } from '../lib/config'
import { formatPubdate, toMetaDescription } from '../lib/format'
import styles from './Book.module.css'

// どの ISBN に対する結果かを持ち、表示中の URL と比べて読み込み中かを判定する
type Result = { isbn: string } & ({ book: BookData } | { notFound: true } | { failed: true })

export function Book() {
  const isbn = useParams().isbn ?? ''
  const from = fromSearch(useLocation().state)
  const q = from ? (new URLSearchParams(from.split('?')[1]).get('q')?.trim() ?? '') : ''

  const [result, setResult] = useState<Result | null>(null)
  const [delayedIsbn, setDelayedIsbn] = useState<string | null>(null)

  // 一覧の下の方で行を押しても、詳細は先頭から読ませる（BrowserRouter はスクロール位置を引き継ぐ）
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [isbn])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => setDelayedIsbn(isbn), LOADING_DELAY_MS)
    getBook(isbn, controller.signal)
      .then((book) => {
        clearTimeout(timer)
        setDelayedIsbn(null)
        setResult({ isbn, book })
      })
      .catch((e) => {
        if (controller.signal.aborted) return
        clearTimeout(timer)
        setDelayedIsbn(null)
        // ISBN の形式の誤り（422）も、利用者にとっては「その本はない」なので 404 と同じ表示にする
        const notFound = e instanceof ApiError && (e.status === 404 || e.status === 422)
        setResult(notFound ? { isbn, notFound: true } : { isbn, failed: true })
      })
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [isbn])

  const current = result?.isbn === isbn ? result : null
  const book = current && 'book' in current ? current.book : null

  return (
    <div className={styles.page}>
      <title>{book ? `${book.title} - ${BRAND_NAME}` : BRAND_NAME}</title>
      {/* 内容紹介が空の書誌では、空の description を出さない */}
      {book?.description && (
        <meta name="description" content={toMetaDescription(book.description)} />
      )}
      <Header q={q} />
      <main className={styles.main}>
        {!current && delayedIsbn === isbn && <LoadingIcon />}
        {from && q ? <BackToSearch from={from} q={q} /> : <BackToHome />}
        {current && <Body result={current} />}
      </main>
    </div>
  )
}

// 一覧から来たときだけ、遷移の state に一覧の URL が入っている。直接開いたときや、想定外の値は無視する
function fromSearch(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('from' in state)) return null
  const { from } = state
  return typeof from === 'string' && from.startsWith('/search?') ? from : null
}

// ブラウザの「戻る」と同じにし、一覧の履歴を積まずに見ていた位置へ戻す。
// 新しいタブで開く操作（⌘クリック・中クリックなど）は、リンクとしての既定の動きに任せる
function BackToSearch({ from, q }: { from: string; q: string }) {
  const navigate = useNavigate()

  function back(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    navigate(-1)
  }

  return (
    <Link to={from} className={styles.back} onClick={back}>
      ← 「{q}」の検索結果に戻る
    </Link>
  )
}

// どの検索から来たかが分からないので、トップへ戻す
function BackToHome() {
  return (
    <Link to="/" className={styles.back}>
      ← トップに戻る
    </Link>
  )
}

function Body({ result }: { result: Result }) {
  if ('notFound' in result) return <p className={styles.message}>この本は見つかりませんでした。</p>
  // 503・API に繋がらない・その他のエラーは、利用者にとってはどれも「いまは使えない」なので文言を1つにまとめる
  if ('failed' in result) {
    return (
      <p className={styles.error}>いま書誌を表示できません。しばらくしてから試してください。</p>
    )
  }

  const { book } = result
  // 値のない項目は行ごと出さない。出版年月は年が取れなければ空文字になる
  const rows = [
    ['著者', book.author],
    ['出版社', book.publisher],
    ['出版年月', formatPubdate(book.pubdate)],
    ['ISBN', book.isbn],
  ].filter(([, value]) => value)

  return (
    <article className={styles.book}>
      <div className={styles.head}>
        <Cover url={book.cover} className={styles.cover} />
        <div>
          <h1 className={styles.title}>{book.title}</h1>
          <dl className={styles.meta}>
            {rows.map(([label, value]) => (
              <div key={label} className={styles.row}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {book.description && (
        <section>
          <h2 className={styles.heading}>内容紹介</h2>
          <p className={styles.description}>{book.description}</p>
        </section>
      )}
    </article>
  )
}
