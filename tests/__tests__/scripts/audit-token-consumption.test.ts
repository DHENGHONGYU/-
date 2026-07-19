import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs'

/**
 * audit-token-consumption.ts 单元测试（v3.0 白盒模式）
 *
 * 改造后的脚本采用"白盒/透明管道"模式：
 * - export scan() / formatReport() / main() 三个函数
 * - scan() 返回 Report 对象（纯数据，无副作用）
 * - 测试直接调用 scan() 验证返回值，无需解析 console.log 字符串
 *
 * 测试覆盖：
 * 1. scan() 各检查项检测能力（知识图谱增量更新 / 快速查询模板 / Token 预算文档 / Token 优化文档）
 * 2. scan() 报告结构（violations / warnings / summary / estimatedTokenSavings）
 * 3. scan() 边界条件处理（文件缺失 / 读取失败 / 内容部分缺失）
 * 4. formatReport() 人类可读报告格式化
 * 5. 边界条件（所有文件都不存在 / 部分文件缺失）
 */

vi.mock('node:fs', () => ({
  default: {},
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  statSync: vi.fn(),
}))

const mockReadFileSync = vi.mocked(fs.readFileSync)
const mockExistsSync = vi.mocked(fs.existsSync)

describe('audit-token-consumption.ts v3.0（白盒测试）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * 设置文件系统状态
   * @param files 文件相对路径（基于 ROOT）→ 内容（null 表示文件不存在）
   */
  function setupFS(files: Record<string, string | null>): void {
    const rootDir = path.resolve(__dirname, '../../..').replace(/\\/g, '/')

    const fileContents = new Map<string, string>()
    for (const [relPath, content] of Object.entries(files)) {
      const fullPath = (rootDir + '/' + relPath).replace(/\\/g, '/')
      if (content !== null) {
        fileContents.set(fullPath, content)
      }
    }

    mockExistsSync.mockImplementation(((p: string) => {
      const key = String(p).replace(/\\/g, '/')
      return fileContents.has(key)
    }) as unknown as typeof fs.existsSync)

    mockReadFileSync.mockImplementation(((filePath: string) => {
      const key = String(filePath).replace(/\\/g, '/')
      if (fileContents.has(key)) {
        return fileContents.get(key)!
      }
      const err = new Error(`ENOENT: ${filePath}`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }) as unknown as typeof fs.readFileSync)
  }

  /** 动态导入 scan 函数 */
  async function importScan(): Promise<typeof import('../../../scripts/audit-token-consumption')> {
    return await import('../../../scripts/audit-token-consumption')
  }

  // ============================================================
  // scan() 检查项检测能力
  // ============================================================

  describe('scan() 检查项检测', () => {
    it('检测知识图谱脚本缺少增量更新（基于文件修改时间）', async () => {
      // 注意：脚本通过 content.includes('mtime') 检测，注释中不能出现该关键字
      setupFS({
        'scripts/extract-code-graph.ts': `
// 知识图谱脚本（全量解析，无增量机制）
export function extract() {
  return parseAllFiles()
}
`,
        'scripts/quick-query.sh': `
query-store-deps
query-cross-layer-violations
query-largest-files
query-top-imported
`,
        'AGENTS.md': `
## Token 预算
单次会话 Token 消耗不得超过 50,000 tokens
## 知识图谱优先
理解代码关系时，必须先查询 docs/reports/code-graph.json
`,
        'docs/reports/lessons-learned/token-optimization-best-practices.md': `
# Token 优化最佳实践
## 代码关系理解优化
## 重复搜索消除
## 架构合规性检查优化
## 硬编码元素管理
## 事件监听清理
`,
      })

      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: '缺少增量更新',
          message: expect.stringContaining('增量更新'),
        }),
      )
    })

    it('检测知识图谱脚本缺少缓存机制', async () => {
      // 注意：脚本通过 content.includes('cache') 检测，注释中不能出现该关键字
      setupFS({
        'scripts/extract-code-graph.ts': `
// 有文件修改时间检查但无结果暂存机制
export function extract() {
  const fileModifiedTime = getFileMtime()
  return parseAllFiles(fileModifiedTime)
}
`,
        'scripts/quick-query.sh': `query-store-deps\nquery-cross-layer-violations\nquery-largest-files\nquery-top-imported`,
        'AGENTS.md': `Token 预算\n知识图谱优先`,
        'docs/reports/lessons-learned/token-optimization-best-practices.md': `代码关系理解优化\n重复搜索消除\n架构合规性检查优化\n硬编码元素管理\n事件监听清理`,
      })

      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: '缺少缓存机制',
        }),
      )
    })

    it('检测知识图谱脚本缺失', async () => {
      setupFS({
        'scripts/quick-query.sh': `query-store-deps\nquery-cross-layer-violations\nquery-largest-files\nquery-top-imported`,
        'AGENTS.md': `Token 预算\n知识图谱优先`,
        'docs/reports/lessons-learned/token-optimization-best-practices.md': `代码关系理解优化\n重复搜索消除\n架构合规性检查优化\n硬编码元素管理\n事件监听清理`,
      })

      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: '缺失文件',
          file: 'scripts/extract-code-graph.ts',
        }),
      )
    })

    it('检测快速查询模板缺失', async () => {
      setupFS({
        'scripts/extract-code-graph.ts': `mtime\ncache`,
        'AGENTS.md': `Token 预算\n知识图谱优先`,
        'docs/reports/lessons-learned/token-optimization-best-practices.md': `代码关系理解优化\n重复搜索消除\n架构合规性检查优化\n硬编码元素管理\n事件监听清理`,
      })

      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: '缺失快速查询模板',
        }),
      )
    })

    it('检测快速查询模板缺少必要查询', async () => {
      setupFS({
        'scripts/extract-code-graph.ts': `mtime\ncache`,
        'scripts/quick-query.sh': `
query-store-deps
query-cross-layer-violations
# 缺少后两项查询模板
`,
        'AGENTS.md': `Token 预算\n知识图谱优先`,
        'docs/reports/lessons-learned/token-optimization-best-practices.md': `代码关系理解优化\n重复搜索消除\n架构合规性检查优化\n硬编码元素管理\n事件监听清理`,
      })

      const { scan } = await importScan()
      const report = scan()

      const missingQueries = report.violations.filter(v => v.type === '缺少查询模板')
      expect(missingQueries.length).toBeGreaterThan(0)
      expect(missingQueries.some(v => v.message.includes('query-largest-files'))).toBe(true)
      expect(missingQueries.some(v => v.message.includes('query-top-imported'))).toBe(true)
    })

    it('检测 AGENTS.md 缺少 Token 预算规则', async () => {
      setupFS({
        'scripts/extract-code-graph.ts': `mtime\ncache`,
        'scripts/quick-query.sh': `query-store-deps\nquery-cross-layer-violations\nquery-largest-files\nquery-top-imported`,
        'AGENTS.md': `知识图谱优先`,  // 缺少 Token 预算
        'docs/reports/lessons-learned/token-optimization-best-practices.md': `代码关系理解优化\n重复搜索消除\n架构合规性检查优化\n硬编码元素管理\n事件监听清理`,
      })

      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: '缺少 Token 预算规则',
        }),
      )
    })

    it('检测 AGENTS.md 缺少知识图谱优先规则', async () => {
      setupFS({
        'scripts/extract-code-graph.ts': `mtime\ncache`,
        'scripts/quick-query.sh': `query-store-deps\nquery-cross-layer-violations\nquery-largest-files\nquery-top-imported`,
        'AGENTS.md': `Token 预算`,  // 缺少知识图谱优先
        'docs/reports/lessons-learned/token-optimization-best-practices.md': `代码关系理解优化\n重复搜索消除\n架构合规性检查优化\n硬编码元素管理\n事件监听清理`,
      })

      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: '缺少知识图谱优先规则',
        }),
      )
    })

    it('检测 Token 优化文档缺少章节', async () => {
      setupFS({
        'scripts/extract-code-graph.ts': `mtime\ncache`,
        'scripts/quick-query.sh': `query-store-deps\nquery-cross-layer-violations\nquery-largest-files\nquery-top-imported`,
        'AGENTS.md': `Token 预算\n知识图谱优先`,
        'docs/reports/lessons-learned/token-optimization-best-practices.md': `
# 缺少多个必要章节
## 代码关系理解优化
## 重复搜索消除
`,  // 缺少 "架构合规性检查优化"、"硬编码元素管理"、"事件监听清理"
      })

      const { scan } = await importScan()
      const report = scan()

      const missingSections = report.violations.filter(v => v.type === '缺少章节')
      expect(missingSections.length).toBeGreaterThanOrEqual(3)
      expect(missingSections.some(v => v.message.includes('架构合规性检查优化'))).toBe(true)
      expect(missingSections.some(v => v.message.includes('硬编码元素管理'))).toBe(true)
      expect(missingSections.some(v => v.message.includes('事件监听清理'))).toBe(true)
    })
  })

  // ============================================================
  // scan() 完整合规场景
  // ============================================================

  describe('scan() 完整合规场景', () => {
    it('所有文件合规时无违规', async () => {
      setupFS({
        'scripts/extract-code-graph.ts': `
// 完整合规：包含 mtime 检查和 cache 机制
export function extract() {
  const mtime = getMtime(file)
  const cache = new Map()
  return { mtime, cache }
}
`,
        'scripts/quick-query.sh': `
query-store-deps
query-cross-layer-violations
query-largest-files
query-top-imported
`,
        'AGENTS.md': `
## Token 预算
单次会话 Token 消耗不得超过 50,000 tokens
## 知识图谱优先
理解代码关系时，必须先查询 docs/reports/code-graph.json
`,
        'docs/reports/lessons-learned/token-optimization-best-practices.md': `
# Token 优化最佳实践
## 代码关系理解优化
## 重复搜索消除
## 架构合规性检查优化
## 硬编码元素管理
## 事件监听清理
`,
      })

      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toHaveLength(0)
      expect(report.summary.totalViolations).toBe(0)
    })
  })

  // ============================================================
  // scan() 报告结构
  // ============================================================

  describe('scan() 报告结构', () => {
    it('返回完整 Report 对象，包含 violations/warnings/summary', async () => {
      setupFS({
        'scripts/extract-code-graph.ts': `mtime\ncache`,
        'scripts/quick-query.sh': `query-store-deps\nquery-cross-layer-violations\nquery-largest-files\nquery-top-imported`,
        'AGENTS.md': `Token 预算\n知识图谱优先`,
        'docs/reports/lessons-learned/token-optimization-best-practices.md': `代码关系理解优化\n重复搜索消除\n架构合规性检查优化\n硬编码元素管理\n事件监听清理`,
      })

      const { scan } = await importScan()
      const report = scan()

      expect(report).toHaveProperty('violations')
      expect(report).toHaveProperty('warnings')
      expect(report).toHaveProperty('summary')
      expect(Array.isArray(report.violations)).toBe(true)
      expect(Array.isArray(report.warnings)).toBe(true)
      expect(report.summary).toHaveProperty('totalFiles')
      expect(report.summary).toHaveProperty('totalChecks')
      expect(report.summary).toHaveProperty('totalViolations')
      expect(report.summary).toHaveProperty('totalWarnings')
      expect(report.summary).toHaveProperty('estimatedTokenSavings')
      expect(typeof report.summary.estimatedTokenSavings).toBe('number')
    })

    it('summary.totalChecks === 4（4 个检查项）', async () => {
      setupFS({
        'scripts/extract-code-graph.ts': `mtime\ncache`,
        'scripts/quick-query.sh': `query-store-deps\nquery-cross-layer-violations\nquery-largest-files\nquery-top-imported`,
        'AGENTS.md': `Token 预算\n知识图谱优先`,
        'docs/reports/lessons-learned/token-optimization-best-practices.md': `代码关系理解优化\n重复搜索消除\n架构合规性检查优化\n硬编码元素管理\n事件监听清理`,
      })

      const { scan } = await importScan()
      const report = scan()

      expect(report.summary.totalChecks).toBe(4)
      expect(report.summary.totalFiles).toBe(4)
    })
  })

  // ============================================================
  // scan() 边界条件
  // ============================================================

  describe('scan() 边界条件', () => {
    it('文件存在但读取失败时返回"读取失败"违规', async () => {
      // existsSync 返回 true，但 readFileSync 抛错

      mockExistsSync.mockImplementation((() => true) as unknown as typeof fs.existsSync)
      mockReadFileSync.mockImplementation(((_filePath: string) => {
        const err = new Error(`EACCES: permission denied`) as NodeJS.ErrnoException
        err.code = 'EACCES'
        throw err
      }) as unknown as typeof fs.readFileSync)

      const { scan } = await importScan()
      const report = scan()

      // 至少有一个"读取失败"违规
      expect(report.violations).toContainEqual(
        expect.objectContaining({
          type: '读取失败',
        }),
      )
    })

    it('所有文件都不存在时返回多个"缺失"违规', async () => {
      setupFS({})

      const { scan } = await importScan()
      const report = scan()

      // 应该有多个缺失类违规
      const missingViolations = report.violations.filter(v => v.type === '缺失文件' || v.type === '缺失快速查询模板' || v.type === '缺失文档' || v.type === '缺失优化指南')
      expect(missingViolations.length).toBeGreaterThan(0)
    })
  })

  // ============================================================
  // formatReport() 人类可读报告
  // ============================================================

  describe('formatReport() 格式化', () => {
    it('无违规时显示绿色"未发现 Token 浪费问题"', async () => {
      const { formatReport } = await importScan()
      const emptyReport = {
        violations: [],
        warnings: [],
        summary: {
          totalFiles: 4,
          totalChecks: 4,
          totalViolations: 0,
          totalWarnings: 0,
          estimatedTokenSavings: 0,
        },
      }
      const output = formatReport(emptyReport as never)

      expect(output).toContain('未发现 Token 浪费问题')
      expect(output).toContain('检查项数: 4')
      expect(output).toContain('违规数: 0')
    })

    it('有违规时显示违规列表和建议', async () => {
      const { formatReport } = await importScan()
      const report = {
        violations: [
          {
            file: 'scripts/extract-code-graph.ts',
            line: 1,
            type: '缺少增量更新',
            message: '知识图谱生成脚本未支持增量更新（基于文件 mtime）',
            suggestion: '添加文件 mtime 检查逻辑，仅重新解析变更文件',
          },
        ],
        warnings: [],
        summary: {
          totalFiles: 4,
          totalChecks: 4,
          totalViolations: 1,
          totalWarnings: 0,
          estimatedTokenSavings: 7500000,
        },
      }
      const output = formatReport(report as never)

      expect(output).toContain('发现 1 处 Token 浪费问题')
      expect(output).toContain('scripts/extract-code-graph.ts:1')
      expect(output).toContain('[缺少增量更新]')
      expect(output).toContain('添加文件 mtime 检查逻辑')
      expect(output).toContain('预计月度 Token 节省: 7.50M tokens')
    })

    it('有警告时显示警告列表', async () => {
      const { formatReport } = await importScan()
      const report = {
        violations: [],
        warnings: [
          {
            file: 'some/file.ts',
            line: 10,
            type: '测试警告',
            message: '测试警告消息',
            suggestion: '测试建议',
          },
        ],
        summary: {
          totalFiles: 4,
          totalChecks: 4,
          totalViolations: 0,
          totalWarnings: 1,
          estimatedTokenSavings: 0,
        },
      }
      const output = formatReport(report as never)

      expect(output).toContain('发现 1 处警告')
      expect(output).toContain('[测试警告]')
      expect(output).toContain('警告数: 1')
    })
  })
})
