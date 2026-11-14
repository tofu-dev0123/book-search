import { hasNextPage, toFrom } from '../lib/paging'
import styles from './Pager.module.css'

type Props = {
  page: number
  total: number
  shown: number
  onMove: (page: number) => void
}

export function Pager({ page, total, shown, onMove }: Props) {
  const from = toFrom(page)
  return (
    <nav className={styles.pager} aria-label="ページ">
      <button type="button" disabled={page === 1} onClick={() => onMove(page - 1)}>
        前へ
      </button>
      <span>
        {from + 1}–{from + shown} / {total} 件
      </span>
      <button type="button" disabled={!hasNextPage(page, total)} onClick={() => onMove(page + 1)}>
        次へ
      </button>
    </nav>
  )
}
