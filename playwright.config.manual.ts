/**
 * playwright.config.manual.ts
 *
 * 用于 T2 "手动执行 + 可视化观察"场景的专用 Playwright 配置：
 *   1. video: 'on'       → 每条 case 录 .webm 视频（沙箱无显示设备的"观察"替代）
 *   2. trace: 'on'       → 每条 case 生成 .zip trace（playwright show-trace 回放交互时间轴）
 *   3. 保持 chromium 的 "headless=false 标志位 + --headless=new args"策略
 *      —— 避免查找 chromium_headless_shell-1228（本机没装）
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/use-mediaquery-zindex-e2e.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 4 * 60 * 1000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on',
    video: 'on',
    screenshot: 'on', // 每条 case（无论成功/失败）都截一张图
    // 让 Playwright 全局认为 headless=false → 查找普通 chromium.exe
    // （实际通过 launchOptions.args 注入 --headless=new 进入无界面模式）
    headless: false,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args:
            process.env.PLAYWRIGHT_HEAD === '1'
              ? []
              : ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-software-rasterizer'],
        },
      },
    },
  ],
})
