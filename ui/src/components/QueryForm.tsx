import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'

import styles from './QueryForm.module.css'

type Props = {
  id: string
  // ホームの中央に置く大きい形か、検索結果のヘッダーに置く小さい形か
  size: 'large' | 'small'
  defaultValue?: string
  placeholder?: string
}

// 「探しているのは、」に続けて、下線だけの空欄に書き込んでもらう検索欄
export function QueryForm({ id, size, defaultValue = '', placeholder }: Props) {
  const [q, setQ] = useState(defaultValue)
  const navigate = useNavigate()

  function submit(event: FormEvent) {
    event.preventDefault()
    // 空や空白だけでは送信しない
    const query = q.trim()
    if (!query) return
    navigate(`/search?${new URLSearchParams({ q: query })}`)
  }

  return (
    <form role="search" className={`${styles.form} ${styles[size]}`} onSubmit={submit}>
      <label htmlFor={id} className={styles.label}>
        探しているのは、
      </label>
      <span className={styles.blank}>
        <input
          id={id}
          type="search"
          value={q}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(event) => setQ(event.target.value)}
          className={styles.input}
        />
        <button type="submit" className={styles.button}>
          探す
        </button>
      </span>
    </form>
  )
}
