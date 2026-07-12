/**
 * PWA 离线验证测试
 * 质量门禁 #11
 *
 * 测试内容：
 * 1. manifest.json 存在且包含必要字段
 * 2. SW 注册函数可被调用
 * 3. 不实际注册 SW（使用 vi.mock）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------- Mock Service Worker API ----------
const mockAddEventListener = vi.fn()

const mockRegistration = {
  scope: '/sw.js',
  active: true,
  waiting: null,
  installing: null,
  addEventListener: mockAddEventListener,
}

const mockNavigator = {
  serviceWorker: {
    register: vi.fn().mockResolvedValue(mockRegistration),
    controller: null,
  },
}

beforeEach(() => {
  vi.clearAllMocks()

  // 默认 mock：浏览器支持 SW
  // @ts-expect-error -- replacing global navigator for test
  global.navigator = mockNavigator

  // 清除 import.meta.env mock
  vi.stubEnv('PROD', false)
})

// ---------- 1. manifest.json 存在性及字段测试 ----------
describe('PWA manifest.json', () => {
  it('manifest.json 文件存在于 public/ 目录', () => {
    const manifestPath = resolve(__dirname, '../public/manifest.json')
    // 使用 require/import 会缓存；这里用 fs 同步读取确保文件存在
    let content: string
    try {
      content = readFileSync(manifestPath, 'utf-8')
    } catch {
      throw new Error('manifest.json 文件不存在于 public/ 目录')
    }
    expect(content).toBeDefined()
  })

  it('manifest.json 包含必要字段 (name, short_name, start_url, display, icons)', () => {
    const manifestPath = resolve(__dirname, '../public/manifest.json')
    const content = readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(content)

    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBeDefined()
    expect(manifest.display).toBeTruthy()
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  it('manifest.json 的 start_url 和 display 字段值合法', () => {
    const manifestPath = resolve(__dirname, '../public/manifest.json')
    const content = readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(content)

    // start_url 应以 / 开头
    expect(manifest.start_url).toMatch(/^\//)
    // display 应为合法值之一
    expect(['fullscreen', 'standalone', 'minimal-ui', 'browser']).toContain(
      manifest.display,
    )
  })

  it('manifest.json 的 icons 条目包含 src, sizes, type 字段', () => {
    const manifestPath = resolve(__dirname, '../public/manifest.json')
    const content = readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(content)

    for (const icon of manifest.icons) {
      expect(icon.src).toBeTruthy()
      expect(icon.sizes).toBeTruthy()
      expect(icon.type).toMatch(/^image\//)
    }
  })
})

// ---------- 2. Service Worker 注册函数测试 ----------
describe('registerServiceWorker 模块', () => {
  it('模块导出 initPWA 函数', async () => {
    // 动态导入，确保 vi.mock 在 import 之前
    const { initPWA } = await import(
      '@/services/pwa/registerServiceWorker'
    )
    expect(typeof initPWA).toBe('function')
  })

  it('模块导出 getSWStatus 函数', async () => {
    const { getSWStatus } = await import(
      '@/services/pwa/registerServiceWorker'
    )
    expect(typeof getSWStatus).toBe('function')
  })

  it('模块导出 registerServiceWorker 函数', async () => {
    const { registerServiceWorker } = await import(
      '@/services/pwa/registerServiceWorker'
    )
    expect(typeof registerServiceWorker).toBe('function')
  })

  it('开发环境 initPWA 不调用 navigator.serviceWorker.register', async () => {
    vi.stubEnv('PROD', false)

    // 重新加载模块（需要重置模块缓存）
    vi.resetModules()
    // @ts-expect-error -- replacing global navigator for test
    global.navigator = mockNavigator

    const { initPWA } = await import(
      '@/services/pwa/registerServiceWorker'
    )
    initPWA()

    // 开发环境不应调用 register
    expect(mockNavigator.serviceWorker.register).not.toHaveBeenCalled()
  })

  it('生产环境 initPWA 调用 navigator.serviceWorker.register', async () => {
    vi.stubEnv('PROD', true)

    // 重置模块缓存以重新触发模块顶层代码
    vi.resetModules()
    // @ts-expect-error -- replacing global navigator for test
    global.navigator = mockNavigator

    const { initPWA } = await import(
      '@/services/pwa/registerServiceWorker'
    )
    initPWA()

    // 给微任务队列时间处理 registerServiceWorker().catch()
    await new Promise((r) => setTimeout(r, 10))

    expect(mockNavigator.serviceWorker.register).toHaveBeenCalledWith(
      '/sw.js',
    )
  })

  it('浏览器不支持 SW 时 registerServiceWorker 返回 null', async () => {
    // @ts-expect-error -- removing serviceWorker to simulate unsupported browser
    global.navigator = {}

    vi.resetModules()

    const { registerServiceWorker, getSWStatus } = await import(
      '@/services/pwa/registerServiceWorker'
    )
    const result = await registerServiceWorker()

    expect(result).toBeNull()
    expect(getSWStatus()).toBe('unsupported')
  })

  it('SW 注册成功后状态变为 registered', async () => {
    mockNavigator.serviceWorker.register.mockResolvedValue({
      ...mockRegistration,
      active: true,
      waiting: null,
    })

    const { registerServiceWorker, getSWStatus } = await import(
      '@/services/pwa/registerServiceWorker'
    )
    const result = await registerServiceWorker('/sw.js')

    expect(result).toBeTruthy()
    expect(getSWStatus()).toBe('registered')
  })

  it('SW 注册失败后状态变为 error', async () => {
    mockNavigator.serviceWorker.register.mockRejectedValue(
      new Error('Network error'),
    )

    const { registerServiceWorker, getSWStatus } = await import(
      '@/services/pwa/registerServiceWorker'
    )
    const result = await registerServiceWorker('/sw.js')

    expect(result).toBeNull()
    expect(getSWStatus()).toBe('error')
  })
})

// ---------- 3. 集成验证：bootstrapService 中引用了 PWA 模块 ----------
describe('bootstrapService PWA 集成', () => {
  it('bootstrapService.ts 中导入了 initPWA 并在 initializeApp 中调用', () => {
    const bootstrapPath = resolve(__dirname, '../src/services/system/bootstrapService.ts')
    const content = readFileSync(bootstrapPath, 'utf-8')
    expect(content).toContain("from '@/services/pwa/registerServiceWorker'")
    expect(content).toContain('initPWA()')
  })
})
