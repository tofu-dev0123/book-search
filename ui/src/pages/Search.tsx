import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'

import { BookList } from '../components/BookList'
import { LoadingBar } from '../components/LoadingBar'
import { Pager } from '../components/Pager'
import { QueryForm } from '../components/QueryForm'
import { search, type SearchResponse } from '../lib/api'
import { BRAND_NAME } from '../lib/brand'
import { PAGE_SIZE, parsePage, toFrom } from '../lib/paging'
import styles from './Search.module.css'

// ローカルの API は数十 ms で返るので、この時間内に返れば読み込み中の表示を出さない（ちらつきを防ぐ）
const LOADING_DELAY_MS = 200

// どの検索語とページに対する結果かを key で持ち、表示中の URL と比べて読み込み中かを判定する
type Result = { key: string; response: SearchResponse } | { key: string; failed: true }

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
        // 総件数を超えるページは 1 ページ目に置き換える
        if (response.hits.length === 0 && response.total > 0 && page > 1) {
          setParams({ q }, { replace: true })
          return
        }
        setResult({ key, response })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setResult({ key, failed: true })
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
    setParams({ q, page: String(next) })
    window.scrollTo(0, 0)
  }

  return (
    <div className={styles.page}>
      <title>{`「${q}」の検索結果 - ${BRAND_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link to="/" className={styles.brand}>
            {BRAND_NAME}
          </Link>
          <QueryForm key={q} id="q-search" size="small" defaultValue={q} />
        </div>
        {showLoading && <LoadingBar />}
      </header>
      <main className={styles.main}>
        <Body
          q={q}
          page={page}
          result={result}
          loading={loading}
          showLoading={showLoading}
          onMove={move}
        />
      </main>
    </div>
  )
}

type BodyProps = {
  q: string
  page: number
  result: Result | null
  loading: boolean
  showLoading: boolean
  onMove: (page: number) => void
}

function Body({ q, page, result, loading, showLoading, onMove }: BodyProps) {
  // 読み込み中は、前の結果があれば薄くして残す。初回は何も出さない
  if (loading) {
    if (!showLoading || !result || 'failed' in result) return null
    return <BookList hits={result.response.hits} dimmed />
  }
  if (!result) return null
  // 503・API に繋がらない・その他のエラーは、利用者にとってはどれも「いまは使えない」なので文言を1つにまとめる
  if ('failed' in result) {
    return (
      <p className={styles.error}>いま検索を利用できません。しばらくしてから試してください。</p>
    )
  }

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
