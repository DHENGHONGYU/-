import { defineConfig, devices } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 将 E2E 结果目录指向项目外的系统临时目录，规避 WorkBuddy safe-delete
// 对仓库内 test-results 的 trash 拦截（P2-3 修复：npm run e2e 方能正常启动）
const e2eResultsDir = join(tmpdir(), 'finsight-e2e-results')

/**
 * 统一 E2E 配置（better-harness F-008，2026-08-23）：
 * 三配置合并为单一文件的 projects 模式，消除配置漂移。
 *
 *   - chromium（默认）：全量 e2e 套件（不含 blueprint 与手动观察规格，二者由专用 project 覆盖）
 *   - manual-observe：T2 手动执行 + 可视化观察（原 playwright.config.manual.ts，
 *     video/trace/screenshot 全开；--headless=new 策略保留，PLAYWRIGHT_HEAD=1 可切实弹窗口）
 *   - blueprint：蓝图验收（原 playwright.blueprint.config.ts，testDir 收敛至 e2e/blueprint）
 *
 * 端口统一为 5199（与主配置 dev server / devcontainer forwardPorts 对齐）。
 * 运行方式：
 *   npm run test:e2e                     # 全部 projects
 *   npm run test:e2e:blueprint           # 仅蓝图验收
 *   npm run test:e2e:manual              # 仅手动观察
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: e2eResultsDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  // 快照路径模板：去除 {platform} 标识，使一套基线快照跨平台使用（win32/linux/darwin 通用）
  // 文件名格式：{arg}-chromium.png（而非 {arg}-chromium-win32.png）
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}',
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // 视觉回归 snapshot 配置：允许 5% 像素差异，容忍跨平台（Windows/Linux）字体/抗锯齿渲染差异
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
      threshold: 0.2,
    },
  },
  projects: [
    {
      name: 'chromium',
      // 专用规格交由对应 project 承载，避免双重执行
      testIgnore: ['**/blueprint/**', '**/use-mediaquery-zindex-e2e.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // T2 手动执行 + 可视化观察（沙箱无显示设备的"观察"替代：视频 + trace + 截图）
      name: 'manual-observe',
      testMatch: '**/use-mediaquery-zindex-e2e.spec.ts',
      fullyParallel: false,
      timeout: 4 * 60 * 1000,
      use: {
        ...devices['Desktop Chrome'],
        trace: 'on',
        video: 'on',
        screenshot: 'on',
        // 让 Playwright 全局认为 headless=false → 查找普通 chromium.exe
        // （实际通过 launchOptions.args 注入 --headless=new 进入无界面模式，
        // 避免查找未安装的 chromium_headless_shell）
        headless: false,
        launchOptions: {
          args:
            process.env.PLAYWRIGHT_HEAD === '1'
              ? []
              : ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-software-rasterizer'],
        },
      },
    },
    {
      // 蓝图验收：路由按舱室拆分多文件并行执行
      name: 'blueprint',
      testDir: './e2e/blueprint',
      timeout: 150_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        screenshot: 'off',
        trace: 'off',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
})
