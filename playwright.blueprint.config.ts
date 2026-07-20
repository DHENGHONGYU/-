import { defineConfig, devices } from '@playwright/test'

/**
 * 蓝图验收专用 Playwright 配置（独立于项目 e2e 配置）
 * - testDir 仅指向 e2e/blueprint，不影响既有 e2e 套件
 * - webServer 直接起 vite（绕过 npm run dev 的 predev tsc 前置），端口 3199
 * - 路由按舱室拆分多文件并行执行
 */
export default defineConfig({
  testDir: './e2e/blueprint',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 6,
  reporter: 'list',
  timeout: 150_000,
  use: {
    baseURL: 'http://localhost:3199',
    viewport: { width: 1440, height: 900 },
    screenshot: 'off',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --port 3199 --strictPort',
    url: 'http://localhost:3199',
    reuseExistingServer: true,
    timeout: 300_000,
  },
})
