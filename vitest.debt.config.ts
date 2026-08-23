import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// vitest.debt.config.ts — 测试债务测量专用配置（有意入库，非临时产物）
//
// 用途（两项，均见 deliverables/tech-debt-task-plan.md）：
//   1. TD-010 Worker 崩溃绕过：pool:'forks' + fileParallelism:false 已验证可跑完全量，
//      覆盖率测量命令：NODE_OPTIONS=--max-old-space-size=8192 npx vitest run --config vitest.debt.config.ts --coverage
//   2. 单独跑 vite.config.ts PREEXISTING_TEST_FAILURES 豁免清单，判定哪些已修复可恢复。
//
// 历史标注修正（2026-08-23，better-harness F-003）：原注释“用后删除，不入库”与上述长期用途矛盾，
// 已纠正为真实用途；待 TD-010 根因修复（threads 池稳定跑完全量）后方可删除本文件。
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
    // 覆盖率测量口径与 vite.config.ts 主配置对齐（F-002）；此处不设 thresholds，
    // 仅作全量实测工具，地板阈值统一由主配置持有。
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // 全量实测存在少量失败用例（历史存量），仍需产出覆盖率报告用于地板阈值标定（F-002）
      reportOnFailure: true,
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', 'src/types/**'],
    },
  },
})
