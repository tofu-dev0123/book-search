import styles from './LoadingBar.module.css'

// ヘッダーの下の区切り線の上を、短い線が流れる。置いた要素の下端に重なる
export function LoadingBar() {
  return <span className={styles.bar} role="status" aria-label="検索しています" />
}
