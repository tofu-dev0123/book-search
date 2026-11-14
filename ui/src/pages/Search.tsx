import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'

import { BookList } from '../components/BookList'
import { BrandIcon } from '../components/BrandIcon'
import { LoadingIcon } from '../components/LoadingIcon'
import { Pager } from '../components/Pager'
import { QueryForm } from '../components/QueryForm'
import { search, type SearchResponse } from '../lib/api'
import { BRAND_NAME } from '../lib/brand'
import { PAGE_SIZE, parsePage, toFrom } from '../lib/paging'
import styles from './Search.module.css'

// ローカルの API は数十 ms で返るので、この時間内に返れば読み込み中の表示を出さない（ちらつきを防ぐ）
const LOADING_DELAY_MS = 200

// どの検索語とページに対する結果かを持ち、表示中の URL と比べて読み込み中かを判定する。
// 読み込み中は前の結果を描き続けるので、件数やページ送りも前の結果の q・page で描く
type Result = { key: string; q: string; page: number } & (
  { response: SearchResponse } | { failed: true }
)

export function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q')?.trim() ?? ''
  const page = parsePage(params.get('page'))
  const key = `${q}\n${page}`

  const [result, setResult] = useState<Result | null>(null)
  const [delayedKey, setDelayedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!q) return
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
  }, [q, page, key, setParams])

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
      <header className={styles.header}>
        <div className={styles.inner}>
          {/* 名前は14文字と長く、並べると検索欄が縮むのでアイコンだけにする。名前は読み上げとツールチップで伝える */}
          <Link to="/" className={styles.brand} aria-label={BRAND_NAME} title={BRAND_NAME}>
            <BrandIcon size={26} />
          </Link>
          <QueryForm key={q} id="q-search" size="small" defaultValue={q} />
        </div>
      </header>
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
