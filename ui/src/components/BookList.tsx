import type { Hit } from '../lib/api'
import { formatPubdate } from '../lib/format'
import { Cover } from './Cover'
import styles from './BookList.module.css'

export function BookList({ hits }: { hits: Hit[] }) {
  return (
    <ol className={styles.list}>
      {hits.map((hit) => (
        // 行の選択はキーボードでもできるようにする。押したときの動きは詳細画面の Issue で足す
        <li key={hit.isbn} tabIndex={0} className={styles.item}>
          <Cover url={hit.cover} className={styles.cover} />
          <div className={styles.body}>
            <div className={styles.title}>{hit.title}</div>
            <div className={styles.meta}>
              {[hit.author, hit.publisher, formatPubdate(hit.pubdate)].filter(Boolean).join('　')}
            </div>
            <p className={styles.description}>{hit.description}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
