import { useState } from 'react'

import type { Hit } from '../lib/api'
import { formatPubdate } from '../lib/format'
import styles from './BookList.module.css'

export function BookList({ hits }: { hits: Hit[] }) {
  return (
    <ol className={styles.list}>
      {hits.map((hit) => (
        // 行の選択はキーボードでもできるようにする。押したときの動きは詳細画面の Issue で足す
        <li key={hit.isbn} tabIndex={0} className={styles.item}>
          <Cover url={hit.cover} />
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

// 書影がない書誌と、画像の読み込みに失敗した書誌は、同じ大きさの無地の枠にする
function Cover({ url }: { url: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed)
    return <div className={`${styles.cover} ${styles.blank}`} aria-hidden="true" />
  return (
    <img src={url} alt="" loading="lazy" className={styles.cover} onError={() => setFailed(true)} />
  )
}
