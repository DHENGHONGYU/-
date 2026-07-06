// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'

/**
 * audit-doc-sync.ts 单元测试（v3.0 白盒模式）
 *
 * 改造后的脚本采用"白盒/透明管道"模式：
 * - export scan() / formatReport() / main() 三个函数
 * - scan() 返回 Report 对象（纯数据，无副作用）
 * - 测试直接调用 scan() 验证返回值，无需解析 console.log 字符串
 *
 * 测试覆盖：
 * 1. scan() 文档同步检测能力（未文档化文件识别）
 * 2. scan() 排除规则（测试文件 / .d.ts / index.ts / .types.ts / 噪音词）
 * 3. scan() 报告结构（violations / summary / scanMode / docFilesCount）
 * 4. scan() git diff 模式 vs 全量扫描模式
 * 5. formatReport() 人类可读报告格式化
 * 6. 边界条件（空目录 / 文档缺失 / git diff 失败）
 *
 * 使用 node 环境运行（避免 jsdom 对 node:fs 命名导入的 mock 限制）。
 */

// 模块级闭包变量 - 虚拟文件系统状态（避免 vi.resetModules 导致 mock 实例不同步）
let vfsDirMap = new Map<string, Set<string>>()
let vfsFileContents = new Map<string, string>()
let vfsGitDiffOutput = ''

vi.mock('node:fs', () => ({
  default: {},
  readFileSync: (filePath: string) => {
    const key = String(filePath).replace(/\\/g, '/')
    if (vfsFileContents.has(key)) {
      return vfsFileContents.get(key)
    }
    const err = new Error(`ENOENT: ${filePath}`) as NodeJS.ErrnoException
    err.code = 'ENOENT'
    throw err
  },
  readdirSync: (dirPath: string) => {
    const key = String(dirPath).replace(/\\/g, '/')
    const entries = vfsDirMap.get(key)
    if (!entries) {
      const err = new Error(`ENOENT: ${dirPath}`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }
    return Array.from(entries)
  },
  existsSync: (filePath: string) => {
    const key = String(filePath).replace(/\\/g, '/')
    return vfsFileContents.has(key) || vfsDirMap.has(key)
  },
  writeFileSync: vi.fn(),
  statSync: (filePath: string) => {
    const key = String(filePath).replace(/\\/g, '/')
    const isFile = vfsFileContents.has(key)
    const isDir = vfsDirMap.has(key)
    if (!isFile && !isDir) {
      const err = new Error(`ENOENT: ${filePath}`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }
    return {
      isFile: () => isFile,
      isDirectory: () => isDir,
    }
  },
}))

vi.mock('node:child_process', () => ({
  default: {},
  execSync: () => vfsGitDiffOutput,
}))

type TestFiles = {
  src?: Record<string, string>
  docs?: Record<string, string>
  rootDocs?: Record<string, string>
}

describe('audit-doc-sync.ts v3.0（白盒测试）', () => {
  beforeEach(() => {
    vfsGitDiffOutput = ''
    vfsDirMap = new Map()
    vfsFileContents = new Map()
    vi.resetModules()

    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    vi.spyOn(process, 'cwd').mockReturnValue(
      path.resolve(__dirname, '../../..').replace(/\\/g, '/'),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function setupVirtualFS(testFiles: TestFiles): void {
    const rootDir = path.resolve(__dirname, '../../..').replace(/\\/g, '/')
    const srcDir = rootDir + '/src'
    const docsDir = rootDir + '/docs'

    function addFile(relPath: string, content: string, baseDir: string): void {
      const fullPath = (baseDir + '/' + relPath).replace(/\\/g, '/')
      vfsFileContents.set(fullPath, content)

      const parts = fullPath.split('/')
      for (let i = 1; i < parts.length; i++) {
        const dirPath = parts.slice(0, i).join('/')
        const entry = parts[i]!
        if (!vfsDirMap.has(dirPath)) {
          vfsDirMap.set(dirPath, new Set())
        }
        vfsDirMap.get(dirPath)!.add(entry)
      }
    }

    for (const [relPath, content] of Object.entries(testFiles.src ?? {})) {
      addFile(relPath, content, srcDir)
    }
    for (const [relPath, content] of Object.entries(testFiles.docs ?? {})) {
      addFile(relPath, content, docsDir)
    }
    for (const [name, content] of Object.entries(testFiles.rootDocs ?? {})) {
      addFile(name, content, rootDir)
    }
  }

  /** 动态导入 scan 函数（确保 vi.resetModules 后获取新实例） */
  async function importScan(): Promise<typeof import('../../../scripts/audit-doc-sync')> {
    return await import('../../../scripts/audit-doc-sync')
  }

  // ============================================================
  // scan() 文档同步检测
  // ============================================================

  describe('scan() 文档同步检测', () => {
    it('检测未文档化的新模块', async () => {
      setupVirtualFS({
        src: { 'services/xyzUniqueModule.ts': 'export function xyzUniqueModule() {}' },
        docs: { 'overview.md': '# 项目概述\n这是一个测试项目。' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).toContainEqual(
        expect.objectContaining({
          file: expect.stringContaining('xyzUniqueModule'),
          type: '未文档化文件',
        }),
      )
    })

    it('识别已文档化的模块（文件名多次出现在文档中）', async () => {
      const moduleName = 'wellDocumentedService'
      setupVirtualFS({
        src: { [`services/${moduleName}.ts`]: 'export function wellDocumented() {}' },
        docs: {
          'services.md': `
# 服务列表

${moduleName} 是核心服务。
使用 ${moduleName} 进行分析。
${moduleName} 提供多种方法。
`,
        },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': `# Changelog\n- 添加 ${moduleName}`,
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      const report = scan()

      // 文件名在文档中出现 >= 2 次，应判定为已文档化
      const undoc = report.violations.filter(v => v.file.includes(moduleName))
      expect(undoc).toHaveLength(0)
    })
  })

  // ============================================================
  // scan() 排除规则
  // ============================================================

  describe('scan() 排除规则', () => {
    it('排除测试文件和 spec 文件', async () => {
      setupVirtualFS({
        src: {
          'services/foo.test.ts': 'describe("test", () => { it("works", () => {}) })',
          'services/bar.spec.ts': 'describe("spec", () => { it("works", () => {}) })',
        },
        docs: { 'overview.md': '# 概述' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).not.toContainEqual(
        expect.objectContaining({ file: expect.stringContaining('foo.test.ts') }),
      )
      expect(report.violations).not.toContainEqual(
        expect.objectContaining({ file: expect.stringContaining('bar.spec.ts') }),
      )
    })

    it('排除 .d.ts 类型声明文件', async () => {
      setupVirtualFS({
        src: { 'types/global.d.ts': 'declare global {}' },
        docs: { 'overview.md': '# 概述' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).not.toContainEqual(
        expect.objectContaining({ file: expect.stringContaining('global.d.ts') }),
      )
    })

    it('排除 index.ts barrel 文件', async () => {
      setupVirtualFS({
        src: { 'services/index.ts': "export * from './foo'" },
        docs: { 'overview.md': '# 概述' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      const report = scan()

      const indexTsViolations = report.violations.filter(v => v.file.includes('index.ts'))
      expect(indexTsViolations).toHaveLength(0)
    })

    it('排除 .types.ts 纯类型文件', async () => {
      setupVirtualFS({
        src: { 'services/foo.types.ts': 'export interface Foo { bar: string }' },
        docs: { 'overview.md': '# 概述' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      const report = scan()

      expect(report.violations).not.toContainEqual(
        expect.objectContaining({ file: expect.stringContaining('foo.types.ts') }),
      )
    })

    it('排除常见噪音词（utils、helpers、types 等）', async () => {
      setupVirtualFS({
        src: {
          'lib/utils.ts': 'export function util() {}',
          'lib/types.ts': 'export type Foo = string',
        },
        docs: { 'overview.md': '# 概述' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      const report = scan()

      const noiseViolations = report.violations.filter(
        v => v.file.includes('lib/utils') || v.file.includes('lib/types'),
      )
      expect(noiseViolations).toHaveLength(0)
    })
  })

  // ============================================================
  // scan() 扫描模式
  // ============================================================

  describe('scan() 扫描模式', () => {
    it('git diff 模式下 scanMode === "changed"', async () => {
      setupVirtualFS({
        src: {
          'services/changedService.ts': 'export function changed() {}',
          'services/unchangedService.ts': 'export function unchanged() {}',
        },
        docs: { 'overview.md': '# 概述' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = 'src/services/changedService.ts\n'

      const { scan } = await importScan()
      const report = scan()

      expect(report.summary.scanMode).toBe('changed')
    })

    it('无 git diff 时降级为全量扫描（scanMode === "all"）', async () => {
      setupVirtualFS({
        src: { 'services/testService.ts': 'export function test() {}' },
        docs: { 'overview.md': '# 概述' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      const report = scan()

      expect(report.summary.scanMode).toBe('all')
    })
  })

  // ============================================================
  // scan() 报告结构
  // ============================================================

  describe('scan() 报告结构', () => {
    it('返回完整 Report 对象，包含 violations/summary', async () => {
      setupVirtualFS({
        src: { 'services/testService.ts': 'export function test() {}' },
        docs: { 'test.md': '# Test' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      const report = scan()

      expect(report).toHaveProperty('violations')
      expect(report).toHaveProperty('summary')
      expect(Array.isArray(report.violations)).toBe(true)
      expect(report.summary).toHaveProperty('totalFiles')
      expect(report.summary).toHaveProperty('totalViolations')
      expect(report.summary).toHaveProperty('scanMode')
      expect(report.summary).toHaveProperty('docFilesCount')
      expect(typeof report.summary.totalFiles).toBe('number')
      expect(typeof report.summary.totalViolations).toBe('number')
    })

    it('未文档化文件 > 0 时 totalViolations > 0', async () => {
      setupVirtualFS({
        src: { 'services/undocUniqueService.ts': 'export function undoc() {}' },
        docs: { 'overview.md': '# 概述' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      const report = scan()

      expect(report.summary.totalViolations).toBeGreaterThan(0)
    })
  })

  // ============================================================
  // formatReport() 人类可读报告
  // ============================================================

  describe('formatReport() 格式化', () => {
    it('无违规时显示绿色"所有扫描文件均已在文档中找到引用"', async () => {
      const { formatReport } = await importScan()
      const emptyReport = {
        violations: [],
        summary: {
          totalFiles: 10,
          totalViolations: 0,
          scanMode: 'all' as const,
          docFilesCount: 5,
        },
      }
      const output = formatReport(emptyReport as never)

      expect(output).toContain('所有扫描文件均已在文档中找到引用')
      expect(output).toContain('扫描文件数: 10')
      expect(output).toContain('文档文件数: 5')
    })

    it('有违规时显示未文档化文件列表', async () => {
      const { formatReport } = await importScan()
      const report = {
        violations: [
          {
            file: 'src/services/undoc.ts',
            type: '未文档化文件',
            message: '文件可能尚未在文档中体现',
          },
        ],
        summary: {
          totalFiles: 100,
          totalViolations: 1,
          scanMode: 'all' as const,
          docFilesCount: 5,
        },
      }
      const output = formatReport(report as never)

      expect(output).toContain('扫描模式: 全量 src 扫描')
      expect(output).toContain('疑似未文档化文件: 1')
      expect(output).toContain('src/services/undoc.ts')
      expect(output).toContain('建议')
    })

    it('git diff 模式下显示扫描模式为 git diff', async () => {
      const { formatReport } = await importScan()
      const report = {
        violations: [],
        summary: {
          totalFiles: 5,
          totalViolations: 0,
          scanMode: 'changed' as const,
          docFilesCount: 3,
        },
      }
      const output = formatReport(report as never)

      expect(output).toContain('扫描模式: git diff (HEAD~1..HEAD)')
    })
  })

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('src 目录不存在时 scan 不崩溃', async () => {
      // 不设置任何 src 文件
      setupVirtualFS({
        docs: { 'overview.md': '# 概述' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      expect(() => scan()).not.toThrow()
      const report = scan()
      expect(report.summary.totalFiles).toBe(0)
    })

    it('docs 目录不存在时 scan 不崩溃', async () => {
      setupVirtualFS({
        src: { 'services/test.ts': 'export function test() {}' },
        rootDocs: {
          'ARCHITECTURE.md': '# Architecture',
          'CHANGELOG.md': '# Changelog',
          'AGENTS.md': '# Agents',
          'DATA_DEFINITION.md': '# Data Definition',
        },
      })
      vfsGitDiffOutput = ''

      const { scan } = await importScan()
      expect(() => scan()).not.toThrow()
    })
  })
})
