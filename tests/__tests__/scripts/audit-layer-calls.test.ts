/**
 * @test_id V9-TEST-UT-100
 * @covers_docs []
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import { readFileSync, readdirSync } from 'node:fs'
import { createTestLogger } from './_helpers/test-logger'

/**
 * audit-layer-calls.ts 单元测试（v3.0 白盒模式）
 *
 * 改造后的脚本采用"白盒/透明管道"模式：
 * - export scan() / formatReport() / main() 三个函数
 * - scan() 返回 Report 对象（纯数据，无副作用）
 * - 测试直接调用 scan() 验证返回值，无需解析 console.log 字符串
 *
 * 测试覆盖：
 * 1. scan() 各分层规则检测能力（L5/L4 写数据层、services→store、lib→上层、constants→业务层）
 * 2. scan() 豁免规则（import type、lib 基础设施白名单）
 * 3. scan() 报告结构完整性（violations/warnings/summary 字段）
 * 4. formatReport() 人类可读报告格式化
 * 5. 边界条件（空 src 目录、scan 异常处理）
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

type TestFiles = Record<string, string>

describe('audit-layer-calls.ts v3.0（白盒测试）', () => {
  const logger = createTestLogger('audit-layer-calls')

  beforeEach(() => {
    logger.info('===== beforeEach 清理开始 =====')
    logger.step('vi.clearAllMocks()')
    vi.clearAllMocks()
    logger.step('vi.resetModules()')
    vi.resetModules()
    logger.info('===== beforeEach 清理结束 =====')
  })

  afterEach(() => {
    logger.info('===== afterEach 清理开始 =====')
    logger.step('vi.restoreAllMocks()')
    vi.restoreAllMocks()
    logger.info('===== afterEach 清理结束 =====')
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
          const isDir = !isFile
          return {
            name,
            isFile: () => isFile,
            isDirectory: () => isDir,
          }
        })
      }
      return Array.from(entries)
    }) as unknown as typeof readdirSync)
  }

  /** 动态导入 scan 函数（确保 vi.resetModules 后获取新实例） */
  async function importScan(): Promise<typeof import('../../../scripts/audit/audit-layer-calls')> {
    return await import('../../../scripts/audit/audit-layer-calls')
  }

  // ============================================================
  // scan() 分层规则检测能力
  // ============================================================

  describe('scan() 分层规则检测', () => {
    it('检测 L5/L4 层直接写 dataLayer 的违规', async () => {
      setupVirtualFS({
        'components/BadComponent.tsx': `
import { dataLayer } from '@/data/dataLayer'
export function BadComponent() {
  const handleClick = () => {
    dataLayer.stocks.add({ code: '000001' })
  }
  return null
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: 'L5/L4 直接写数据层',
          context: expect.stringContaining('dataLayer.stocks.add'),
        }),
      )
    })

    it('检测 L5/L4 层直接写 db 的违规', async () => {
      setupVirtualFS({
        'pages/analysis/BadPage.tsx': `
import { db } from '@/data/db'
export default function BadPage() {
  const save = () => { db.put('stocks', { code: '000001' }) }
  return null
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: 'L5/L4 直接写 DB',
          context: expect.stringContaining('db.put'),
        }),
      )
    })

    it('检测 services 层直接依赖 store 的违规', async () => {
      setupVirtualFS({
        'services/bad-service.ts': `
import { useAnalysisStore } from '@/store/analysisStore'
export function badService() {
  return useAnalysisStore.getState().data
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: 'services 直接依赖 store',
        }),
      )
    })

    it('检测 services 层依赖 lib 业务模块的违规（规则 5c）', async () => {
      setupVirtualFS({
        'services/bad-service.ts': `
import { someBusinessUtil } from '@/lib/someBusinessModule'
export function badService() { return someBusinessUtil() }
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: 'services 依赖 lib 业务模块',
        }),
      )
    })

    it('允许 services 层依赖 lib 中的基础设施白名单模块', async () => {
      setupVirtualFS({
        'services/good-service.ts': `
import { getLogger } from '@/lib/logger'
import { formatNumber } from '@/lib/format'
import { safeCoerce } from '@/lib/safeCoerce'
const logger = getLogger('good-service')
export function goodService() {
  logger.info('running')
  return formatNumber(100)
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).not.toContainEqual(
        expect.objectContaining({
          type: 'services 依赖 lib 业务模块',
        }),
      )
    })

    it('检测 lib 层依赖上层（services/store）的违规', async () => {
      setupVirtualFS({
        'lib/bad-util.ts': `
import { useStore } from '@/store/someStore'
export function badUtil() { return useStore.getState() }
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: 'lib 层依赖上层',
        }),
      )
    })

    it('检测 constants 层依赖业务层的违规', async () => {
      setupVirtualFS({
        'constants/bad-config.ts': `
import { someService } from '@/services/someService'
export const BAD_CONSTANT = someService()
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: 'constants 层依赖业务层',
        }),
      )
    })

    it('跳过 import type 语句（类型导入豁免跨层检查）', async () => {
      setupVirtualFS({
        'services/good-service.ts': `
import type { AnalysisState } from '@/store/analysisStore'
export function goodService(): AnalysisState | null { return null }
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).not.toContainEqual(
        expect.objectContaining({
          type: 'services 直接依赖 store',
        }),
      )
    })

    it('正确识别 L5/L4 层目录（pages/components/portal/apps/cockpit）', async () => {
      setupVirtualFS({
        'apps/test/TestApp.tsx': `import { db } from '@/data/db'\nexport default function TestApp() { db.put('x', {}) }`,
        'portal/TestPortal.tsx': `import { db } from '@/data/db'\nexport function TestPortal() { db.put('x', {}) }`,
        'cockpit/TestCockpit.tsx': `import { db } from '@/data/db'\nexport function TestCockpit() { db.put('x', {}) }`,
      })
      const { scan } = await importScan()
      const report = scan()

      const violationFiles = report.violations.map(v => (v as { file: string }).file)
      expect(violationFiles.some(f => f.includes('src/apps/test/TestApp.tsx'))).toBe(true)
      expect(violationFiles.some(f => f.includes('src/portal/TestPortal.tsx'))).toBe(true)
      expect(violationFiles.some(f => f.includes('src/cockpit/TestCockpit.tsx'))).toBe(true)
    })
  })

  // ============================================================
  // scan() 报告结构完整性
  // ============================================================

  describe('scan() 报告结构', () => {
    it('返回完整 Report 对象，包含 violations/warnings/summary', async () => {
      setupVirtualFS({
        'components/Test.tsx': 'export default function Test() { return null }',
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report).toHaveProperty('violations')
      expect(report).toHaveProperty('warnings')
      expect(report).toHaveProperty('summary')
      expect(Array.isArray(report.violations)).toBe(true)
      expect(Array.isArray(report.warnings)).toBe(true)
      expect(report.summary).toHaveProperty('totalFiles')
      expect(report.summary).toHaveProperty('totalViolations')
      expect(report.summary).toHaveProperty('totalWarnings')
      expect(report.summary).toHaveProperty('byViolationType')
      expect(report.summary).toHaveProperty('byWarningType')
      expect(typeof report.summary.totalFiles).toBe('number')
      expect(typeof report.summary.totalViolations).toBe('number')
    })

    it('summary.byViolationType 按类型分组统计违规数', async () => {
      setupVirtualFS({
        'components/Bad1.tsx': `import { db } from '@/data/db'\nexport function Bad1() { db.put('x', {}) }`,
        'components/Bad2.tsx': `import { db } from '@/data/db'\nexport function Bad2() { db.put('x', {}) }`,
      })
      const { scan } = await importScan()
      const report = scan()

      const dbViolations = report.violations.filter(
        v => (v as { type: string }).type === 'L5/L4 直接写 DB',
      )
      expect(report.summary.byViolationType['L5/L4 直接写 DB']).toBe(dbViolations.length)
    })

    it('无违规时 summary.totalViolations === 0', async () => {
      setupVirtualFS({
        'components/Good.tsx': 'export default function Good() { return null }',
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
    it('无违规时显示绿色"未发现"提示', async () => {
      const { formatReport } = await importScan()
      const emptyReport = {
        violations: [],
        warnings: [],
        summary: {
          totalFiles: 10,
          totalViolations: 0,
          totalWarnings: 0,
          byViolationType: {},
          byWarningType: {},
        },
      }
      const output = formatReport(emptyReport as never)

      expect(output).toContain('未发现跨层调用违规或警告')
      expect(output).toContain('扫描文件数: 10')
      expect(output).toContain('违规数: 0')
    })

    it('有违规时显示违规列表和汇总', async () => {
      const { formatReport } = await importScan()
      const report = {
        violations: [
          {
            file: 'src/components/Bad.tsx',
            line: 5,
            column: 10,
            type: 'L5/L4 直接写 DB',
            message: '禁止直接调用 db.put',
            context: 'db.put("stocks", {})',
          },
        ],
        warnings: [],
        summary: {
          totalFiles: 100,
          totalViolations: 1,
          totalWarnings: 0,
          byViolationType: { 'L5/L4 直接写 DB': 1 },
          byWarningType: {},
        },
      }
      const output = formatReport(report as never)

      expect(output).toContain('发现 1 处跨层调用违规')
      expect(output).toContain('src/components/Bad.tsx:5:10')
      expect(output).toContain('[L5/L4 直接写 DB]')
      expect(output).toContain('禁止直接调用 db.put')
      expect(output).toContain('L5/L4 直接写 DB: 1')
      expect(output).toContain('扫描文件数: 100')
      expect(output).toContain('违规数: 1')
    })
  })

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('空 src 目录时 scan 不崩溃，返回 totalFiles=0', async () => {
      // 不设置任何文件，readdirSync 会抛 ENOENT
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

      const { scan } = await importScan()
      // 即使 src 目录不存在，scan 也应该优雅处理（collectFiles 内部可能 try-catch）
      // 这里主要验证不抛出未捕获异常
      expect(() => scan()).not.toThrow()
    })
  })
})
