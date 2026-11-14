import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    // API の CORS の既定（http://localhost:3000）に合わせる。埋まっていたら別のポートに逃げずに止める
    port: 3000,
    strictPort: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
