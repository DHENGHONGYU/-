// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import type { SemanticFinding } from '../../../scripts/semantic-validation'

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
  writeFileSync: vi.fn(),
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

describe('语义级校验脚本', () => {
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

  async function importScan(): Promise<typeof import('../../../scripts/semantic-validation')> {
    return await import('../../../scripts/semantic-validation')
  }

  it('应正确格式化报告', async () => {
    const { formatReport } = await importScan()
    
    const mockReport = {
      timestamp: '2026-07-12T00:00:00.000Z',
      totalFiles: 2,
      totalViolations: 1,
      scanMode: 'all' as const,
      findings: [{
        file: 'src/test.ts',
        symbolName: 'TestInterface',
        symbolType: 'interface' as const,
        missingSemantics: ['missingField'],
        matchedSemantics: ['id', 'name'],
      }],
      summary: {
        totalSymbols: 10,
        matchedSymbols: 8,
        missingSymbols: 2,
        coverageRate: 80.0,
      },
    }

    const formatted = formatReport(mockReport)
    expect(formatted).toContain('语义级校验报告')
    expect(formatted).toContain('TestInterface')
    expect(formatted).toContain('missingField')
    expect(formatted).toContain('80%')
  })

  it('应检测到接口字段不匹配', async () => {
    setupVirtualFS({
      src: {
        'types/user.types.ts': `
          export interface UserProfile {
            id: string
            name: string
            email: string
            role: string
          }
        `,
      },
      docs: {
        'data-models.md': `
          ## UserProfile
          - id: 用户ID
          - name: 用户名
        `,
      },
      rootDocs: {
        'ARCHITECTURE.md': '# Architecture',
        'CHANGELOG.md': '# Changelog',
        'AGENTS.md': '# Agents',
        'DATA_DEFINITION.md': '# Data Definition',
      },
    })

    const { scan } = await importScan()
    const report = scan('all')

    expect(report.summary.totalSymbols).toBeGreaterThan(0)
    const userProfileFinding = report.findings.find((f: SemanticFinding) => f.symbolName === 'UserProfile')
    expect(userProfileFinding?.missingSemantics).toContain('email')
    expect(userProfileFinding?.missingSemantics).toContain('role')
    expect(userProfileFinding?.matchedSemantics).toContain('id')
    expect(userProfileFinding?.matchedSemantics).toContain('name')
  })

  it('应排除测试文件', async () => {
    setupVirtualFS({
      src: {
        'utils/helper.test.ts': `
          export function testHelper(): void {}
        `,
      },
      docs: {
        'utils.md': '',
      },
      rootDocs: {
        'ARCHITECTURE.md': '# Architecture',
        'CHANGELOG.md': '# Changelog',
        'AGENTS.md': '# Agents',
        'DATA_DEFINITION.md': '# Data Definition',
      },
    })

    const { scan } = await importScan()
    const report = scan('all')

    expect(report.findings.find((f: SemanticFinding) => f.symbolName === 'testHelper')).toBeUndefined()
  })
})