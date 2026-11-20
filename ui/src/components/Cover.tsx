import { useState } from 'react'

import styles from './Cover.module.css'

// 書影がない書誌と、画像の読み込みに失敗した書誌は、同じ大きさの無地の枠にする。
// 幅は置く側が className で決める（一覧は 56px、詳細は 140px）
export function Cover({ url, className }: { url: string; className: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed)
    return <div className={`${styles.cover} ${styles.blank} ${className}`} aria-hidden="true" />
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className={`${styles.cover} ${className}`}
      onError={() => setFailed(true)}
    />
  )
}
