import { Link, useLocation } from 'react-router'

import type { Hit } from '../lib/api'
import { formatPubdate } from '../lib/format'
import { Cover } from './Cover'
import styles from './BookList.module.css'

export function BookList({ hits }: { hits: Hit[] }) {
  // 詳細画面の戻るリンクで「どの検索から来たか」を出すため、いまの一覧の URL を遷移の state に持たせる
  const { pathname, search } = useLocation()
  const from = `${pathname}${search}`

  return (
    <ol className={styles.list}>
      {hits.map((hit) => (
        <li key={hit.isbn}>
          {/* 行全体をリンクにし、Enter・新しいタブで開く・URL のコピーなど、リンクとしての操作をそのまま使えるようにする */}
          <Link to={`/books/${hit.isbn}`} state={{ from }} className={styles.item}>
            <Cover url={hit.cover} className={styles.cover} />
            <div className={styles.body}>
              <div className={styles.title}>{hit.title}</div>
              <div className={styles.meta}>
                {[hit.author, hit.publisher, formatPubdate(hit.pubdate)].filter(Boolean).join('　')}
              </div>
              <p className={styles.description}>{hit.description}</p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  )
}
