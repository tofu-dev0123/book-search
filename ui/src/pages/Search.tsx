import { useEffect, useLayoutEffect, useState } from 'react'
import { Navigate, useNavigationType, useSearchParams } from 'react-router'

import { BookList } from '../components/BookList'
import { Header } from '../components/Header'
import { LoadingIcon } from '../components/LoadingIcon'
import { Pager } from '../components/Pager'
import { search, type SearchResponse } from '../lib/api'
import { BRAND_NAME } from '../lib/brand'
import { LOADING_DELAY_MS } from '../lib/config'
import { PAGE_SIZE, parsePage, toFrom } from '../lib/paging'
import styles from './Search.module.css'

// どの検索語とページに対する結果かを持ち、表示中の URL と比べて読み込み中かを判定する。
// 読み込み中は前の結果を描き続けるので、件数やページ送りも前の結果の q・page で描く
type Result = { key: string; q: string; page: number } & (
  { response: SearchResponse } | { failed: true }
)

// 詳細画面から一覧へ戻ったときに、取り直しを待たずに描き、見ていた位置へ戻すため、
// 一覧を離れる直前に表示していた結果とスクロール位置を1件分だけ持つ
let saved: { result: Result; scrollY: number } | null = null

export function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q')?.trim() ?? ''
  const page = parsePage(params.get('page'))
  const key = `${q}\n${page}`

  // 保持した結果を使うのは、履歴を戻る遷移（POP）で検索語とページが同じときだけ。
  // ヘッダーから検索し直したとき（PUSH）は、利用者が探し直しているので取り直す
  const navigationType = useNavigationType()
  const [restored] = useState(() =>
    navigationType === 'POP' && saved?.result.key === key ? saved : null,
  )
  const [result, setResult] = useState<Result | null>(restored?.result ?? null)
  const [delayedKey, setDelayedKey] = useState<string | null>(null)
  const shownKey = result?.key

  // 描いた直後、ブラウザに表示される前に位置を戻し、先頭から飛ぶ動きを見せない
  useLayoutEffect(() => {
    if (restored) window.scrollTo(0, restored.scrollY)
  }, [restored])

  // 一覧を離れるとき（詳細画面へ移るときなど）の結果と位置を残す。
  // 片付けは次の画面の描画より前に走るので、scrollY はまだ一覧での位置になっている。
  // 取得に失敗した結果は残さない（戻ったときに取り直せるようにする）
  useLayoutEffect(() => {
    return () => {
      saved = result && 'response' in result ? { result, scrollY: window.scrollY } : null
    }
  }, [result])

  useEffect(() => {
    if (!q) return
    // 表示中の結果がいまの検索語とページのもの（保持した結果を描いたとき・取得し終えたとき）なら、取り直さない
    if (shownKey === key) return
    // 新しい検索やページ送りを始めたら前のリクエストを中断し、遅れて返った古い結果で上書きしない
    const controller = new AbortController()
    const timer = setTimeout(() => setDelayedKey(key), LOADING_DELAY_MS)
    search(q, toFrom(page), PAGE_SIZE, controller.signal)
      .then((response) => {
        // 応答が来たら遅延表示を止め、前の検索で残った key も消す（戻るで同じ検索に戻ったとき、すぐに出さない）
        clearTimeout(timer)
        setDelayedKey(null)
        // 総件数を超えるページは 1 ページ目に置き換える
        if (response.hits.length === 0 && response.total > 0 && page > 1) {
          setParams({ q }, { replace: true })
          return
        }
        setResult({ key, q, page, response })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        clearTimeout(timer)
        setDelayedKey(null)
        setResult({ key, q, page, failed: true })
      })
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [q, page, key, shownKey, setParams])

  if (!q) return <Navigate to="/" replace />

  const loading = result?.key !== key
  const showLoading = loading && delayedKey === key

  function move(next: number) {
    // 読み込み中のページ送りは前の結果の page で描いているので、いまの URL と同じページなら積まない
    if (next === page) return
    setParams({ q, page: String(next) })
    window.scrollTo(0, 0)
  }

  return (
    <div className={styles.page}>
      <title>{`「${q}」の検索結果 - ${BRAND_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <Header q={q} />
      <main className={styles.main}>
        {showLoading && <LoadingIcon />}
        {/* 読み込み中は前の結果を残し、200ms を過ぎたら薄くする。初回は何も出さない */}
        {result && (
          <div className={`${styles.results} ${showLoading ? styles.dimmed : ''}`}>
            <Body result={result} onMove={move} />
          </div>
        )}
      </main>
    </div>
  )
}

function Body({ result, onMove }: { result: Result; onMove: (page: number) => void }) {
  // 503・API に繋がらない・その他のエラーは、利用者にとってはどれも「いまは使えない」なので文言を1つにまとめる
  if ('failed' in result) {
    return (
      <p className={styles.error}>いま検索を利用できません。しばらくしてから試してください。</p>
    )
  }

  const { q, page } = result
  const { total, hits } = result.response
  if (total === 0) {
    return (
      <>
        <p className={styles.summary}>「{q}」の検索結果 0 件</p>
        <p className={styles.message}>
          「{q}」に一致する本は見つかりませんでした。ことばを減らすか、別の言い方で試してください。
        </p>
      </>
    )
  }
  return (
    <>
      <p className={styles.summary}>
        「{q}」の検索結果 {total} 件
      </p>
      <BookList hits={hits} />
      <Pager page={page} total={total} shown={hits.length} onMove={onMove} />
    </>
  )
}
