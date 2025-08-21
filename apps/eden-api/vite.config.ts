import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: [
      './tests/setup/mongo-memory-server.ts',
      './tests/setup/server-setup.ts',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
