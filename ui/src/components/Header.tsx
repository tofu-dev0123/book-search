import { Link } from 'react-router'

import { BRAND_NAME } from '../lib/brand'
import { BrandIcon } from './BrandIcon'
import { QueryForm } from './QueryForm'
import styles from './Header.module.css'

// 検索結果と詳細画面のヘッダー。どちらの画面からも、そのまま検索し直せるようにする
export function Header({ q }: { q: string }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* 名前は14文字と長く、並べると検索欄が縮むのでアイコンだけにする。名前は読み上げとツールチップで伝える */}
        <Link to="/" className={styles.brand} aria-label={BRAND_NAME} title={BRAND_NAME}>
          <BrandIcon size={26} />
        </Link>
        <QueryForm key={q} id="q-search" size="small" defaultValue={q} />
      </div>
    </header>
  )
}
