import icon from '../../brand/icon.svg?raw'
import styles from './BrandIcon.module.css'

// <img> では currentColor が文字の色を引き継がず、ダークモードで線が白にならないので、インラインの SVG として描く。
// 形は brand/icon.svg の1か所で持つ（favicon・OGP 画像も同じファイルから作る）。中身はリポジトリ内の固定のファイル
export function BrandIcon({ size }: { size: number }) {
  return (
    <span
      className={styles.icon}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon }}
    />
  )
}
