// 検索 API の接続先。既定はローカルの開発用（uvicorn の既定のポート）
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
