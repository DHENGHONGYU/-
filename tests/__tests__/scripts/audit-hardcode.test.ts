import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs'

/**
 * audit-hardcode.ts 单元测试（v3.0 白盒模式）
 *
 * 改造后的脚本采用"白盒/透明管道"模式：
 * - export scan() / formatReport() / main() / exportInventory() 四个函数
 * - scan() 返回 Report 对象（纯数据，无副作用）
 * - 测试直接调用 scan() 验证返回值，无需解析 console.log 字符串
 *
 * 测试覆盖：
 * 1. scan() 各类硬编码检测能力（HEX 颜色 / Tailwind 类 / 股票代码 / 魔法数字 / URL / 超时 / 静默回退）
 * 2. scan() 报告结构完整性（violations / summary / bySeverity / byCategory）
 * 3. scan() 排除规则（命名常量 / 测试文件 / mock 数据 / 颜色豁免清单）
 * 4. formatReport() 人类可读报告格式化
 * 5. 边界条件（空 src 目录 / 不存在目录）
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
const mockWriteFileSync = vi.mocked(writeFileSync)

type TestFiles = Record<string, string>

describe('audit-hardcode.ts v3.0（白盒测试）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    mockWriteFileSync.mockImplementation(() => undefined)
    mockExistsSync.mockImplementation((() => true) as unknown as typeof existsSync)
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
  }

  /** 动态导入 scan 函数（确保 vi.resetModules 后获取新实例） */
  async function importScan(): Promise<typeof import('../../../scripts/audit-hardcode')> {
    return await import('../../../scripts/audit-hardcode')
  }

  // ============================================================
  // scan() 硬编码检测能力
  // ============================================================

  describe('scan() 硬编码检测', () => {
    it('检测 UI 层 HEX 颜色硬编码', async () => {
      setupVirtualFS({
        'components/BadComponent.tsx': `
export function BadComponent() {
  return <div style={{ color: '#ef4444' }}>错误</div>
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          category: '硬编码 HEX 颜色',
          message: expect.stringContaining('#ef4444'),
        }),
      )
    })

    it('检测 UI 层 Tailwind 颜色类硬编码', async () => {
      setupVirtualFS({
        'pages/analysis/BadPage.tsx': `
export default function BadPage() {
  return <div className="text-red-500 bg-blue-100">状态</div>
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      const twViolations = report.violations.filter(v => v.category === '硬编码 Tailwind 颜色类')
      expect(twViolations.length).toBeGreaterThan(0)
      expect(twViolations.some(v => v.message.includes('text-red-500'))).toBe(true)
    })

    it('检测 config 层硬编码股票代码（Fatal 级）', async () => {
      setupVirtualFS({
        'config/bad-config.ts': `
export const BAD_LIST = ['600519.SH', '000001.SZ']
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          severity: 'Fatal',
          category: '硬编码股票代码',
          message: expect.stringContaining('600519.SH'),
        }),
      )
    })

    it('检测 services/core 层魔法数字', async () => {
      setupVirtualFS({
        'services/bad-service.ts': `
export function calculate(value: number) {
  const threshold = value + 9999 + 1
  return threshold
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          severity: 'Major',
          category: '魔法数字',
          message: expect.stringContaining('9999'),
        }),
      )
    })

    it('检测硬编码 URL（非 config 层）', async () => {
      setupVirtualFS({
        'services/api-service.ts': `
export function fetchData() {
  return fetch('https://api.example.com/data')
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          severity: 'Critical',
          category: '硬编码 URL',
        }),
      )
    })

    it('检测硬编码超时时间', async () => {
      setupVirtualFS({
        'services/timeout-service.ts': `
export const config = {
  timeout: 25000,
  interval: 45000,
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      const timeoutViolations = report.violations.filter(v => v.category === '硬编码超时')
      expect(timeoutViolations.length).toBeGreaterThan(0)
    })

    it('检测静默回退模式（?? [] / ?? 0）', async () => {
      // 注意：脚本内置 17 条排除规则，需构造不会触发任何排除的静默回退
      // 必须避免：函数调用() ??、.属性 ??、[key] ??、?.属性 ??、as Type ??、
      //           .data ??、logger.warn/error、throw new Error、set({error:、
      //           .find()/.get() ??、safeNumber() ??、?.length ?? 等
      // 使用裸变量 + ?? 兜底是唯一能触发检测的场景
      setupVirtualFS({
        'pages/fallback-page.tsx': `
export function Page(value) {
  const items = value ?? []
  const count = value ?? 0
  return <div>{count}</div>
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      const fallbackViolations = report.violations.filter(v => v.category === '静默回退')
      expect(fallbackViolations.length).toBeGreaterThan(0)
    })
  })

  // ============================================================
  // scan() 排除规则
  // ============================================================

  describe('scan() 排除规则', () => {
    it('排除已命名常量声明行的魔法数字（const FOO = 123）', async () => {
      setupVirtualFS({
        'services/good-service.ts': `
const MAX_RETRIES = 9999
export function calculate(value: number) {
  return value * MAX_RETRIES
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      const magicViolations = report.violations.filter(v => v.category === '魔法数字')
      expect(magicViolations).toHaveLength(0)
    })

    it('排除 mock 数据文件中的魔法数字', async () => {
      setupVirtualFS({
        'services/mockData.ts': `
export const mockStocks = [
  { code: '600519', price: 9999.99 }
]
`,
      })
      const { scan } = await importScan()
      const report = scan()

      const magicViolations = report.violations.filter(v => v.category === '魔法数字')
      expect(magicViolations).toHaveLength(0)
    })

    it('排除测试文件（*.test.ts / __tests__/）', async () => {
      setupVirtualFS({
        'services/__tests__/some.test.ts': `
import { describe, it, expect } from 'vitest'
describe('test', () => {
  it('works', () => {
    const value = 9999
    expect(value).toBe(9999)
  })
})
`,
      })
      const { scan } = await importScan()
      const report = scan()

      const magicViolations = report.violations.filter(v => v.category === '魔法数字')
      expect(magicViolations).toHaveLength(0)
    })

    it('排除颜色硬编码豁免清单文件（theme.tokens.ts 等）', async () => {
      setupVirtualFS({
        'constants/theme.tokens.ts': `
export const COLOR_RED = '#ef4444'
export const COLOR_BLUE = '#3b82f6'
`,
      })
      const { scan } = await importScan()
      const report = scan()

      const hexViolations = report.violations.filter(v => v.category === '硬编码 HEX 颜色')
      expect(hexViolations).toHaveLength(0)
    })

    it('排除 ring-offset-* 等非颜色 Tailwind 类的误报', async () => {
      setupVirtualFS({
        'components/GoodComponent.tsx': `
export function GoodComponent() {
  return <div className="ring-offset-2 border-b-2">test</div>
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      const falsePositives = report.violations.filter(
        v => v.category === '硬编码 Tailwind 颜色类' &&
             (v.message.includes('ring-offset') || v.message.includes('border-b-2')),
      )
      expect(falsePositives).toHaveLength(0)
    })

    it('排除字符串字面量内的数字（不作为魔法数字）', async () => {
      setupVirtualFS({
        'services/string-service.ts': `
export function getMessage() {
  return '订单号 9999 已创建'
}
`,
      })
      const { scan } = await importScan()
      const report = scan()

      const magicInString = report.violations.filter(
        v => v.category === '魔法数字' && v.message.includes('9999'),
      )
      expect(magicInString).toHaveLength(0)
    })
  })

  // ============================================================
  // scan() 报告结构
  // ============================================================

  describe('scan() 报告结构', () => {
    it('返回完整 Report 对象，包含 violations/summary/bySeverity/byCategory', async () => {
      setupVirtualFS({
        'components/Test.tsx': 'export default function Test() { return null }',
      })
      const { scan } = await importScan()
      const report = scan()

      expect(report).toHaveProperty('violations')
      expect(report).toHaveProperty('summary')
      expect(Array.isArray(report.violations)).toBe(true)
      expect(report.summary).toHaveProperty('totalFiles')
      expect(report.summary).toHaveProperty('totalViolations')
      expect(report.summary).toHaveProperty('bySeverity')
      expect(report.summary).toHaveProperty('byCategory')
      expect(typeof report.summary.totalFiles).toBe('number')
      expect(typeof report.summary.totalViolations).toBe('number')
    })

    it('summary.bySeverity 按严重度分组统计', async () => {
      setupVirtualFS({
        'components/Bad1.tsx': `import { db } from '@/data/db'\nexport function Bad1() { return <div style={{ color: '#ef4444' }}>x</div> }`,
        'config/bad-stock.ts': `export const STOCK = '600519.SH'`,
      })
      const { scan } = await importScan()
      const report = scan()

      // 至少存在 Major（颜色）和 Fatal（股票代码）
      const totalBySeverity = Object.values(report.summary.bySeverity).reduce((a, b) => a + b, 0)
      expect(totalBySeverity).toBe(report.violations.length)
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
        summary: {
          totalFiles: 10,
          totalViolations: 0,
          bySeverity: {},
          byCategory: {},
        },
      }
      const output = formatReport(emptyReport as never)

      expect(output).toContain('未发现硬编码或静默回退')
      expect(output).toContain('扫描文件数: 10')
      expect(output).toContain('问题总数: 0')
    })

    it('有违规时显示违规列表和汇总', async () => {
      const { formatReport } = await importScan()
      const report = {
        violations: [
          {
            file: 'src/components/Bad.tsx',
            line: 5,
            severity: 'Major',
            category: '硬编码 HEX 颜色',
            message: 'UI 层出现硬编码颜色 #ef4444',
            context: '<div style={{ color: \'#ef4444\' }}>',
          },
        ],
        summary: {
          totalFiles: 100,
          totalViolations: 1,
          bySeverity: { Major: 1 },
          byCategory: { '硬编码 HEX 颜色': 1 },
        },
      }
      const output = formatReport(report as never)

      expect(output).toContain('发现 1 处问题')
      expect(output).toContain('src/components/Bad.tsx:5')
      expect(output).toContain('[Major] 硬编码 HEX 颜色')
      expect(output).toContain('按严重度汇总')
      expect(output).toContain('Major: 1')
      expect(output).toContain('按类别汇总')
      expect(output).toContain('硬编码 HEX 颜色: 1')
    })
  })

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('空 src 目录时 scan 不崩溃，返回 totalFiles=0', async () => {
      // readdirSync 抛 ENOENT，collectFiles 内部 try-catch 应返回空列表
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
      expect(() => scan()).not.toThrow()
      const report = scan()
      expect(report.summary.totalFiles).toBe(0)
      expect(report.summary.totalViolations).toBe(0)
    })
  })
})
