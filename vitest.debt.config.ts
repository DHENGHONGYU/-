import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// 临时配置：用于单独跑 vite.config.ts 中 PREEXISTING_TEST_FAILURES 排除的"已知失败"文件，
// 以便判断哪些已修复（可从排除列表移除）、哪些仍需修复。用后删除，不入库。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './tests/contracts/setup.ts', './vitest.setup.ts'],
    exclude: ['e2e/**', '**/node_modules/**', 'dist/**', 'temp/**', 'outputs/**', 'cache/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    retry: 2,
    pool: 'forks',
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 4,
      },
    },
    fileParallelism: false,
  },
})
