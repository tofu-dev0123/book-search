import { useState } from 'react'

import { BrandIcon } from '../components/BrandIcon'
import { QueryForm } from '../components/QueryForm'
import { BRAND_NAME, OPENBD_URL, pickPlaceholder, REPOSITORY_URL } from '../lib/brand'
import styles from './Home.module.css'

export function Home() {
  // 開いたときに1つ選び、表示している間は変えない
  const [placeholder] = useState(() => pickPlaceholder())

  return (
    <div className={styles.home}>
      <header className={styles.bar}>
        {/* 名前はサービスを紹介するホームでだけ見せる（検索結果のヘッダーはアイコンだけ） */}
        <span className={styles.brand}>
          <BrandIcon size={22} />
          {BRAND_NAME}
        </span>
      </header>
      <main className={styles.center}>
        <QueryForm id="q-home" size="large" placeholder={placeholder} />
      </main>
      <footer className={styles.bar}>
        <span>
          書誌データ: <a href={OPENBD_URL}>openBD</a>
        </span>
        <a href={REPOSITORY_URL}>GitHub</a>
      </footer>
    </div>
  )
}
