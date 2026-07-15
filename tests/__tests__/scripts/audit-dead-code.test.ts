import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

/**
 * audit-dead-code.ts 单元测试（v3.0 白盒模式）
 *
 * 改造后的脚本采用"白盒/透明管道"模式：
 * - export scan() / formatReport() / main() 三个函数
 * - scan() 返回 Report 对象（纯数据，无副作用）
 * - 测试直接调用 scan() 验证返回值，无需解析 console.log 字符串
 *
 * 测试覆盖：
 * 1. scan() 死代码检测能力（空箭头函数 / 空函数声明 / 条件返回 null）
 * 2. scan() 路由一致性检测（路由文件缺失 / 未注册页面 / App 分发器 / Portal lazy 导入）
 * 3. scan() 排除规则（pages 子目录 components / hooks / types / .test 文件）
 * 4. scan() 报告结构（violations / warnings / issues / summary）
 * 5. formatReport() 人类可读报告格式化
 * 6. 边界条件（空 src 目录 / 不存在目录）
 */

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  statSync: vi.fn(),
}))

const mockReadFileSync = vi.mocked(readFileSync)
const mockReaddirSync = vi.mocked(readdirSync)
const mockExistsSync = vi.mocked(existsSync)

type TestFiles = Record<string, string>

describe('audit-dead-code.ts v3.0（白盒测试）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * 构造虚拟文件系统
   * @param testFiles 相对 src 的文件路径 → 文件内容
   */
  function setupVirtualFS(testFiles: TestFiles): void {
    const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')

    const dirMap = new Map<string, Set<string>>()
    const fileContents = new Map<string, string>()

    for (const [relPath, content] of Object.entries(testFiles)) {
      const fullPath = path.join(srcDir, relPath).replace(/\\/g, '/')
      fileContents.set(fullPath, content)

      const parts = fullPath.split('/')
      for (let i = 1; i < parts.length; i++) {
        const dirPath = parts.slice(0, i).join('/')
        const entry = parts[i]!
        if (!dirMap.has(dirPath)) {
          dirMap.set(dirPath, new Set())
        }
        dirMap.get(dirPath)!.add(entry)
      }
    }

    mockReadFileSync.mockImplementation(((filePath: string) => {
      const key = String(filePath).replace(/\\/g, '/')
      if (fileContents.has(key)) {
        return fileContents.get(key)!
      }
      const err = new Error(`ENOENT: ${filePath}`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }) as unknown as typeof readFileSync)

    mockReaddirSync.mockImplementation(((dirPath: string, options?: { withFileTypes?: boolean }) => {
      const key = String(dirPath).replace(/\\/g, '/')
      const entries = dirMap.get(key)
      if (!entries) {
        const err = new Error(`ENOENT: ${dirPath}`) as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      }

      if (options?.withFileTypes) {
        return Array.from(entries).map(name => {
          const entryPath = key + '/' + name
          const isFile = fileContents.has(entryPath)
          return {
            name,
            isFile: () => isFile,
            isDirectory: () => !isFile,
          }
        })
      }
      return Array.from(entries)
    }) as unknown as typeof readdirSync)

    mockExistsSync.mockImplementation(((p: string) => {
      const key = String(p).replace(/\\/g, '/')
      return fileContents.has(key) || dirMap.has(key)
    }) as unknown as typeof existsSync)
  }

  /** 动态导入 scan 函数（确保 vi.resetModules 后获取新实例） */
  async function importScan(): Promise<typeof import('../../../scripts/audit-dead-code')> {
    return await import('../../../scripts/audit-dead-code')
  }

  // ============================================================
  // scan() 死代码检测
  // ============================================================

  describe('scan() 死代码检测', () => {
    it('检测空箭头函数', async () => {
      setupVirtualFS({
        'services/empty-service.ts': `
const emptyFn = () => {}
export default emptyFn
`,
        'config/routes.ts': 'export const ROUTES = []',
      })
      const { scan } = await importScan()
      const report = scan()

      const emptyViolations = report.warnings.filter(w => w.type === '空函数')
      expect(emptyViolations.length).toBeGreaterThan(0)
      expect(emptyViolations.some(w => w.message.includes('emptyFn'))).toBe(true)
    })

    it('检测空函数声明', async () => {
      setupVirtualFS({
        'services/empty-service.ts': `
function emptyFunc() {}
export { emptyFunc }
`,
        'config/routes.ts': 'export const ROUTES = []',
      })
      const { scan } = await importScan()
      const report = scan()

      const emptyViolations = report.warnings.filter(w => w.type === '空函数')
      expect(emptyViolations.length).toBeGreaterThan(0)
      expect(emptyViolations.some(w => w.message.includes('emptyFunc'))).toBe(true)
    })

    it('检测无条件返回 null 的组件', async () => {
      setupVirtualFS({
        'components/NullComponent.tsx': `
export function NullComponent() {
  return null
}
`,
        'config/routes.ts': 'export const ROUTES = []',
      })
      const { scan } = await importScan()
      const report = scan()

      const nullReturns = report.warnings.filter(w => w.type === '无条件返回 null')
      expect(nullReturns.length).toBeGreaterThan(0)
      expect(nullReturns.some(w => w.file.includes('NullComponent'))).toBe(true)
    })

    it('忽略 if 守卫中的 return null', async () => {
      setupVirtualFS({
        'components/GuardedNullComponent.tsx': `
export function GuardedNullComponent({ show }: { show: boolean }) {
  if (!show) return null
  return <div>content</div>
}
`,
        'config/routes.ts': 'export const ROUTES = []',
      })
      const { scan } = await importScan()
      const report = scan()

      const nullReturns = report.warnings.filter(w => w.type === '无条件返回 null')
      expect(nullReturns.some(w => w.file.includes('GuardedNullComponent'))).toBe(false)
    })
  })

  // ============================================================
  // scan() 路由一致性检测
  // ============================================================

  describe('scan() 路由一致性检测', () => {
    it('检测路由文件缺失（硬违规，导致 exit 1）', async () => {
      setupVirtualFS({
        'config/routes.ts': `
import { lazy } from 'react'
const MissingPage = lazy(() => import('@/pages/missing/MissingPage'))
export const ROUTES = [{ path: '/missing', component: MissingPage }]
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: '路由文件缺失',
          message: expect.stringContaining('@/pages/missing/MissingPage'),
        }),
      )
      // 路由文件缺失属于硬违规，会导致 exit 1
      expect(report.summary.totalViolations).toBeGreaterThan(0)
    })

    it('检测未注册的页面文件', async () => {
      setupVirtualFS({
        'pages/analysis/UnregisteredPage.tsx': `
export default function UnregisteredPage() {
  return <div>unregistered</div>
}
`,
        'config/routes.ts': `
import { lazy } from 'react'
const AnalysisPage = lazy(() => import('@/pages/analysis/AnalysisPage'))
export const ROUTES = [{ path: '/analysis', component: AnalysisPage }]
`,
        'pages/analysis/AnalysisPage.tsx': `export default function AnalysisPage() { return null }`,
      })
      const { scan } = await importScan()
      const report = scan()

      const unregistered = report.warnings.filter(w => w.type === '未注册页面')
      expect(unregistered.some(w => w.file.includes('UnregisteredPage'))).toBe(true)
    })

    it('识别 App 分发器中的 React.lazy 导入（v2.0 三级加载链）', async () => {
      setupVirtualFS({
        'pages/analysis/StockAnalysisPage.tsx': `
export default function StockAnalysisPage() {
  return <div>analysis</div>
}
`,
        'apps/analysis/AnalysisApp.tsx': `
import { lazy } from 'react'
const StockAnalysisPage = lazy(() => import('@/pages/analysis/StockAnalysisPage'))
export function AnalysisApp() {
  return <StockAnalysisPage />
}
`,
        'config/routes.ts': 'export const ROUTES = []',
      })
      const { scan } = await importScan()
      const report = scan()

      // 通过 App 分发器注册的页面不应被标记为未注册
      const unregistered = report.warnings.filter(
        w => w.type === '未注册页面' && w.file.includes('StockAnalysisPage'),
      )
      expect(unregistered).toHaveLength(0)
      expect(report.summary.appImports).toBeGreaterThan(0)
    })

    it('识别 PortalShell 中的 lazy 导入', async () => {
      setupVirtualFS({
        'pages/trading/TradingPage.tsx': `
export default function TradingPage() {
  return <div>trading</div>
}
`,
        'portal/PortalShell.tsx': `
import { lazy } from 'react'
const TradingPage = lazy(() => import('@/pages/trading/TradingPage'))
export function PortalShell() {
  return <TradingPage />
}
`,
        'config/routes.ts': 'export const ROUTES = []',
      })
      const { scan } = await importScan()
      const report = scan()

      // 通过 Portal 注册的页面不应被标记为未注册
      const unregistered = report.warnings.filter(
        w => w.type === '未注册页面' && w.file.includes('TradingPage'),
      )
      expect(unregistered).toHaveLength(0)
      expect(report.summary.portalImports).toBeGreaterThan(0)
    })

    it('routes.ts 中的 lazy 导入路径被识别为已注册', async () => {
      setupVirtualFS({
        'pages/analysis/AnalysisPage.tsx': `
export default function AnalysisPage() { return null }
`,
        'config/routes.ts': `
import { lazy } from 'react'
const AnalysisPage = lazy(() => import('@/pages/analysis/AnalysisPage'))
export const ROUTES = [{ path: '/analysis', component: AnalysisPage }]
`,
      })
      const { scan } = await importScan()
      const report = scan()

      const unregistered = report.warnings.filter(
        w => w.type === '未注册页面' && w.file.includes('AnalysisPage'),
      )
      expect(unregistered).toHaveLength(0)
      expect(report.summary.routeImports).toBeGreaterThan(0)
    })
  })

  // ============================================================
  // scan() 排除规则
  // ============================================================

  describe('scan() 排除规则', () => {
    it('排除 pages/*/components/ 子目录下的文件（非独立页面）', async () => {
      setupVirtualFS({
        'pages/analysis/components/SubComponent.tsx': `
export function SubComponent() {
  return <div>sub</div>
}
`,
        'config/routes.ts': 'export const ROUTES = []',
      })
      const { scan } = await importScan()
      const report = scan()

      const unregistered = report.warnings.filter(
        w => w.type === '未注册页面' && w.file.includes('SubComponent'),
      )
      expect(unregistered).toHaveLength(0)
    })

    it('排除以 use 开头的 React hooks 文件', async () => {
      setupVirtualFS({
        'pages/analysis/hooks/useCustomHook.ts': `
export function useCustomHook() {
  return { data: null }
}
`,
        'config/routes.ts': 'export const ROUTES = []',
      })
      const { scan } = await importScan()
      const report = scan()

      const unregistered = report.warnings.filter(
        w => w.type === '未注册页面' && w.file.includes('useCustomHook'),
      )
      expect(unregistered).toHaveLength(0)
    })

    it('排除 pages/*/types/ 目录下的文件（纯类型定义）', async () => {
      setupVirtualFS({
        'pages/analysis/types/index.ts': `
export interface AnalysisResult {
  score: number
}
`,
        'config/routes.ts': 'export const ROUTES = []',
      })
      const { scan } = await importScan()
      const report = scan()

      const unregistered = report.warnings.filter(
        w => w.type === '未注册页面' && w.file.includes('types'),
      )
      expect(unregistered).toHaveLength(0)
    })
  })

  // ============================================================
  // scan() 报告结构
  // ============================================================

  describe('scan() 报告结构', () => {
    it('返回完整 Report 对象，包含 issues/violations/warnings/summary', async () => {
      setupVirtualFS({
        'components/Test.tsx': 'export default function Test() { return null }',
        'config/routes.ts': 'export const ROUTES = []',
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report).toHaveProperty('issues')
      expect(report).toHaveProperty('violations')
      expect(report).toHaveProperty('warnings')
      expect(report).toHaveProperty('summary')
      expect(Array.isArray(report.issues)).toBe(true)
      expect(Array.isArray(report.violations)).toBe(true)
      expect(Array.isArray(report.warnings)).toBe(true)
      expect(report.summary).toHaveProperty('totalFiles')
      expect(report.summary).toHaveProperty('totalViolations')
      expect(report.summary).toHaveProperty('totalWarnings')
      expect(report.summary).toHaveProperty('emptyFunctions')
      expect(report.summary).toHaveProperty('missingRouteFiles')
      expect(report.summary).toHaveProperty('unregisteredPages')
      expect(report.summary).toHaveProperty('routeImports')
      expect(report.summary).toHaveProperty('appImports')
      expect(report.summary).toHaveProperty('portalImports')
    })

    it('violations 仅包含路由文件缺失（其他为 warnings）', async () => {
      setupVirtualFS({
        'services/empty.ts': `const emptyFn = () => {}`,
        'config/routes.ts': `
const Missing = lazy(() => import('@/pages/missing/MissingPage'))
export const ROUTES = [{ path: '/missing', component: Missing }]
`,
        'pages/orphan/OrphanPage.tsx': `export default function OrphanPage() { return null }`,
      })
      const { scan } = await importScan()
      const report = scan()

      // violations 只应包含路由文件缺失
      const nonRouteViolations = report.violations.filter(v => v.type !== '路由文件缺失')
      expect(nonRouteViolations).toHaveLength(0)
      // 空函数和未注册页面应在 warnings 中
      expect(report.warnings.some(w => w.type === '空函数')).toBe(true)
      expect(report.warnings.some(w => w.type === '未注册页面')).toBe(true)
    })

    it('无问题时 summary.totalViolations === 0', async () => {
      setupVirtualFS({
        'components/Good.tsx': 'export function Good() { return <div>good</div> }',
        'config/routes.ts': 'export const ROUTES = []',
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.summary.totalViolations).toBe(0)
      expect(report.violations).toHaveLength(0)
    })
  })

  // ============================================================
  // formatReport() 人类可读报告
  // ============================================================

  describe('formatReport() 格式化', () => {
    it('无问题时显示绿色"未发现"提示', async () => {
      const { formatReport } = await importScan()
      const emptyReport = {
        issues: [],
        violations: [],
        warnings: [],
        summary: {
          totalFiles: 10,
          totalViolations: 0,
          totalWarnings: 0,
          emptyFunctions: 0,
          missingRouteFiles: 0,
          unregisteredPages: 0,
          routeImports: 0,
          appImports: 0,
          portalImports: 0,
        },
      }
      const output = formatReport(emptyReport as never)

      expect(output).toContain('未发现空壳函数/组件或路由不一致')
      expect(output).toContain('扫描文件数: 10')
    })

    it('有问题时显示问题列表和汇总', async () => {
      const { formatReport } = await importScan()
      const report = {
        issues: [
          {
            file: 'src/services/empty.ts',
            line: 1,
            type: '空函数',
            message: '空箭头函数 emptyFn',
            context: 'const emptyFn = () => {}',
          },
        ],
        violations: [],
        warnings: [
          {
            file: 'src/services/empty.ts',
            line: 1,
            type: '空函数',
            message: '空箭头函数 emptyFn',
            context: 'const emptyFn = () => {}',
          },
        ],
        summary: {
          totalFiles: 100,
          totalViolations: 0,
          totalWarnings: 1,
          emptyFunctions: 1,
          missingRouteFiles: 0,
          unregisteredPages: 0,
          routeImports: 0,
          appImports: 0,
          portalImports: 0,
        },
      }
      const output = formatReport(report as never)

      expect(output).toContain('发现 1 处问题')
      expect(output).toContain('src/services/empty.ts:1')
      expect(output).toContain('[空函数]')
      expect(output).toContain('空函数/组件: 1')
    })

    it('有路由文件缺失时显示红色错误提示', async () => {
      const { formatReport } = await importScan()
      const report = {
        issues: [
          {
            file: 'src/config/routes.ts',
            line: 0,
            type: '路由文件缺失',
            message: '路由导入的文件不存在: @/pages/missing/MissingPage',
            context: '@/pages/missing/MissingPage',
          },
        ],
        violations: [
          {
            file: 'src/config/routes.ts',
            line: 0,
            type: '路由文件缺失',
            message: '路由导入的文件不存在: @/pages/missing/MissingPage',
            context: '@/pages/missing/MissingPage',
          },
        ],
        warnings: [],
        summary: {
          totalFiles: 50,
          totalViolations: 1,
          totalWarnings: 0,
          emptyFunctions: 0,
          missingRouteFiles: 1,
          unregisteredPages: 0,
          routeImports: 1,
          appImports: 0,
          portalImports: 0,
        },
      }
      const output = formatReport(report as never)

      expect(output).toContain('路由文件缺失: 1')
      expect(output).toContain('存在路由文件缺失')
    })
  })

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('空 src 目录时 scan 不崩溃', async () => {
      mockReaddirSync.mockImplementation(() => {
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      })
      mockReadFileSync.mockImplementation(() => {
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      })
      mockExistsSync.mockImplementation(() => false)

      const { scan } = await importScan()
      expect(() => scan()).not.toThrow()
      const report = scan()
      expect(report.summary.totalFiles).toBe(0)
      expect(report.summary.totalViolations).toBe(0)
    })

    it('routes.ts 不存在时 scan 不崩溃', async () => {
      // src 存在但 routes.ts 不存在
      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const dirMap = new Map<string, Set<string>>([
        [srcDir, new Set(['components'])],
        [srcDir + '/components', new Set(['Test.tsx'])],
      ])
      const fileContents = new Map<string, string>([
        [srcDir + '/components/Test.tsx', 'export default function Test() { return null }'],
      ])
      mockReaddirSync.mockImplementation(((dirPath: string, options?: { withFileTypes?: boolean }) => {
        const key = String(dirPath).replace(/\\/g, '/')
        const entries = dirMap.get(key)
        if (!entries) {
          const err = new Error('ENOENT') as NodeJS.ErrnoException
          err.code = 'ENOENT'
          throw err
        }
        if (options?.withFileTypes) {
          return Array.from(entries).map(name => {
            const entryPath = key + '/' + name
            const isFile = fileContents.has(entryPath)
            return {
              name,
              isFile: () => isFile,
              isDirectory: () => !isFile,
            }
          })
        }
        return Array.from(entries)
      }) as unknown as typeof readdirSync)
      mockReadFileSync.mockImplementation(((filePath: string) => {
        const key = String(filePath).replace(/\\/g, '/')
        if (fileContents.has(key)) {
          return fileContents.get(key)!
        }
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      }) as unknown as typeof readFileSync)
      mockExistsSync.mockImplementation(((p: string) => {
        const key = String(p).replace(/\\/g, '/')
        return fileContents.has(key) || dirMap.has(key)
      }) as unknown as typeof existsSync)

      const { scan } = await importScan()
      expect(() => scan()).not.toThrow()
    })
  })
})
