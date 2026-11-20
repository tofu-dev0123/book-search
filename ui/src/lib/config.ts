// 検索 API の接続先。既定はローカルの開発用（uvicorn の既定のポート）
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// ローカルの API は数十 ms で返るので、この時間内に返れば読み込み中の表示を出さない（ちらつきを防ぐ）
export const LOADING_DELAY_MS = 200
