import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../../')
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
const MANIFEST_PATH = path.join(ROOT, 'public/manifest.json')
const VITE_CONFIG_PATH = path.join(ROOT, 'vite.config.ts')
const MAIN_TSX_PATH = path.join(ROOT, 'src/main.tsx')

// ======================================================================
// P3-2 PWA Service Worker 预缓存 · TDD RED-GREEN 测试
// 验收标准（IMPROVEMENT-TRACKER.md L98）：
//   Lighthouse PWA 5 项 ≥ 4；首屏 P50 offline ≤ 300ms
// ======================================================================
describe('P3-2 PWA · 1 依赖安装验证', () => {
  it('(1/4) DEP: vite-plugin-pwa 应在 devDependencies（workbox 模式）', () => {
    expect(PKG.devDependencies).toHaveProperty('vite-plugin-pwa')
  })
})

describe('P3-2 PWA · 2 manifest.json 关键字段完整', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))

  it('(2/4) MANIFEST: 存在 icons 192x192 + 512x512（PWA 可安装基础）', () => {
    const sizes = manifest.icons?.map((i: any) => i.sizes) ?? []
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('(2/4) MANIFEST: 必需 7 字段齐全（Lighthouse PWA 5 项基准）', () => {
    expect(manifest).toHaveProperty('name')
    expect(manifest).toHaveProperty('short_name')
    expect(manifest).toHaveProperty('start_url')
    expect(manifest).toHaveProperty('display')
    expect(manifest).toHaveProperty('background_color')
    expect(manifest).toHaveProperty('theme_color')
    // Lighthouse PWA 还要求 icons 至少 1 个 maskable 或 192+512 同时存在
    expect(manifest.icons?.length).toBeGreaterThanOrEqual(2)
  })
})

describe('P3-2 PWA · 3 vite.config 含 VitePWA 预缓存配置', () => {
  const viteCfg = fs.readFileSync(VITE_CONFIG_PATH, 'utf-8')

  it('(3/4) VITE-CONFIG: 导入了 vite-plugin-pwa 的 VitePWA', () => {
    expect(/import\s+\{[^}]*VitePWA[^}]*\}\s+from\s+['"]vite-plugin-pwa['"]/.test(viteCfg)).toBe(true)
  })

  it('(3/4) VITE-CONFIG: plugins[] 数组内调用了 VitePWA(...) 并配置 workbox + globPatterns', () => {
    // VitePWA({ ... workbox: { globPatterns: [...] } }) 表示预缓存策略
    expect(/VitePWA\s*\(/.test(viteCfg)).toBe(true)
    expect(/workbox\s*:/.test(viteCfg)).toBe(true)
    expect(/globPatterns\s*:/.test(viteCfg)).toBe(true)
    // 首屏核心静态资源（html / 入口 chunk / css / 字体 / manifest / icons）应在 globPatterns 中
    expect(/\.html/.test(viteCfg)).toBe(true)
    expect(/manifest\.json|\.webmanifest/.test(viteCfg)).toBe(true)
  })
})

describe('P3-2 PWA · 4 应用入口注册 Service Worker', () => {
  const mainTsxExists = fs.existsSync(MAIN_TSX_PATH)
  const mainContent = mainTsxExists ? fs.readFileSync(MAIN_TSX_PATH, 'utf-8') : ''
  // SW 注册脚本可能在 src/pwa/registerSW.ts，也可能直接 inline 在 main.tsx
  const registerSwTsPath = path.join(ROOT, 'src/pwa/registerSW.ts')
  const registerSwTsExists = fs.existsSync(registerSwTsPath)
  const registerSwContent = registerSwTsExists ? fs.readFileSync(registerSwTsPath, 'utf-8') : ''

  it('(4/4) SW-REGISTER: main.tsx 或 src/pwa/registerSW.ts 内调用了 registerSW(...) / virtual:pwa-register', () => {
    const hasRegisterCall = /registerSW\s*\(|virtual:pwa-register/.test(mainContent + registerSwContent)
    expect(hasRegisterCall).toBe(true)
  })
})
