import { BrandIcon } from './BrandIcon'
import styles from './LoadingIcon.module.css'

// アイコンの瞳を動かし、待ち時間にもキャラクターが「探している」ことを伝える。置いた要素の上部中央に重なる
export function LoadingIcon() {
  return (
    <div className={styles.status} role="status">
      <BrandIcon size={56} />
      探しています
    </div>
  )
}
