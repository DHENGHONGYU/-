/**
 * @test_id V9-TEST-UT-105
 * @covers_docs []
 */
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { ScannedFile, ValidationFinding } from '../../../src/types/modules/doc-validation.types'
import {
  classifyFile,
  determineOverallStatus,
  buildDimensionSummary,
  formatTimestampSeconds,
  sha256,
} from '../../../scripts/daily-doc-validation'
import { syncCrossReferences } from '../../../scripts/doc-cross-ref-sync'
import { recordVersionHistory } from '../../../scripts/doc-version-history'

/**
 * daily-doc-validation 流程单元测试
 *
 * 覆盖范围：
 * 1. 文件分类（classifyFile）
 * 2. 状态判定（determineOverallStatus）
 * 3. 维度汇总（buildDimensionSummary）
 * 4. 时间戳格式化（formatTimestampSeconds）
 * 5. 哈希计算（sha256）
 * 6. 交叉引用同步（syncCrossReferences）
 * 7. 版本历史记录（recordVersionHistory）
 */

describe('daily-doc-validation.ts 工具函数', () => {
  describe('classifyFile()', () => {
    it('将 docs/ 下的文件分类为 doc', () => {
      expect(classifyFile('docs/README.md')).toBe('doc')
      expect(classifyFile('docs/guides/testing-guide.md')).toBe('doc')
    })

    it('将 .test./.spec. 文件分类为 test', () => {
      expect(classifyFile('src/services/foo.test.ts')).toBe('test')
      expect(classifyFile('src/services/bar.spec.tsx')).toBe('test')
    })

    it('将脚本和工作流文件分类为 script', () => {
      expect(classifyFile('scripts/build.sh')).toBe('script')
      expect(classifyFile('.github/workflows/ci.yml')).toBe('script')
      expect(classifyFile('tools/deploy.py')).toBe('script')
    })

    it('将源码文件分类为 code', () => {
      expect(classifyFile('src/components/Button.tsx')).toBe('code')
      expect(classifyFile('src/services/scoring/engine.ts')).toBe('code')
    })

    it('将配置文件分类为 config', () => {
      expect(classifyFile('vite.config.ts')).toBe('config')
      expect(classifyFile('tsconfig.json')).toBe('config')
    })

    it('将未知扩展名文件分类为 other', () => {
      expect(classifyFile('assets/logo.svg')).toBe('other')
    })
  })

  describe('determineOverallStatus()', () => {
    it('无发现时返回 pass', () => {
      expect(determineOverallStatus([])).toBe('pass')
    })

    it('仅有 warning 时返回 warning', () => {
      const findings: ValidationFinding[] = [
        {
          id: '1',
          dimension: 'integrity',
          severity: 'medium',
          status: 'warning',
          filePath: 'docs/a.md',
          message: '警告',
        },
      ]
      expect(determineOverallStatus(findings)).toBe('warning')
    })

    it('存在 failure 时返回 failure（优先级最高）', () => {
      const findings: ValidationFinding[] = [
        {
          id: '1',
          dimension: 'integrity',
          severity: 'medium',
          status: 'warning',
          filePath: 'docs/a.md',
          message: '警告',
        },
        {
          id: '2',
          dimension: 'correctness',
          severity: 'high',
          status: 'failure',
          filePath: 'src/b.ts',
          message: '失败',
        },
      ]
      expect(determineOverallStatus(findings)).toBe('failure')
    })
  })

  describe('buildDimensionSummary()', () => {
    it('按维度正确汇总通过/警告/失败数量', () => {
      const findings: ValidationFinding[] = [
        {
          id: '1',
          dimension: 'integrity',
          severity: 'medium',
          status: 'warning',
          filePath: 'docs/a.md',
          message: '警告',
        },
        {
          id: '2',
          dimension: 'integrity',
          severity: 'critical',
          status: 'failure',
          filePath: 'src/b.ts',
          message: '失败',
        },
      ]
      const summary = buildDimensionSummary('integrity', findings, 10)
      expect(summary.dimension).toBe('integrity')
      expect(summary.scannedCount).toBe(10)
      expect(summary.warningCount).toBe(1)
      expect(summary.failureCount).toBe(1)
      expect(summary.passCount).toBe(8)
    })
  })

  describe('formatTimestampSeconds()', () => {
    it('返回秒级 ISO 8601 格式（无毫秒）', () => {
      const date = new Date('2026-07-07T12:34:56.789Z')
      expect(formatTimestampSeconds(date)).toBe('2026-07-07T12:34:56Z')
    })
  })

  describe('sha256()', () => {
    it('计算给定内容的 SHA-256 哈希', () => {
      const hash = sha256(Buffer.from('hello'))
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })
  })
})

describe('doc-cross-ref-sync.ts', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-cross-ref-sync-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  function createDoc(relPath: string, content: string): void {
    const fullPath = path.join(tempDir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf-8')
  }

  it('修复断裂的相对链接并同步索引', () => {
    createDoc('README.md', '# 根文档\n\n参见 [指南](./guides/tutorial.md)')
    createDoc('guides/tutorial.md', '# 教程\n\n返回 [首页](../README.md)')
    createDoc('guides/advanced.md', '# 高级\n\n参见 [不存在的文件](./missing.md)')

    const scannedFiles: ScannedFile[] = [
      {
        absolutePath: path.join(tempDir, 'README.md'),
        relativePath: 'README.md',
        category: 'doc',
        updateType: 'modified',
        sizeBytes: 100,
        lastModifiedAt: new Date().toISOString(),
        hash: 'a',
      },
      {
        absolutePath: path.join(tempDir, 'guides/tutorial.md'),
        relativePath: 'guides/tutorial.md',
        category: 'doc',
        updateType: 'modified',
        sizeBytes: 100,
        lastModifiedAt: new Date().toISOString(),
        hash: 'b',
      },
      {
        absolutePath: path.join(tempDir, 'guides/advanced.md'),
        relativePath: 'guides/advanced.md',
        category: 'doc',
        updateType: 'modified',
        sizeBytes: 100,
        lastModifiedAt: new Date().toISOString(),
        hash: 'c',
      },
    ]

    const result = syncCrossReferences(tempDir, scannedFiles)

    // 索引文件被创建，且断裂链接未产生误修复
    expect(result.fixedLinkCount).toBe(0)
    expect(result.updates.length).toBeGreaterThanOrEqual(1)

    const indexPath = path.join(tempDir, '00-meta', 'REGISTRY_INDEX.md')
    expect(fs.existsSync(indexPath)).toBe(true)

    const indexContent = fs.readFileSync(indexPath, 'utf-8')
    expect(indexContent).toContain('# 文档索引')
    expect(indexContent).toContain('README.md')
    expect(indexContent).toContain('guides/tutorial.md')
  })
})

describe('doc-version-history.ts', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-version-history-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('为新增和修改的文件生成每日变更历史', () => {
    const now = new Date()
    const scannedFiles: ScannedFile[] = [
      {
        absolutePath: path.join(tempDir, 'docs/README.md'),
        relativePath: 'docs/README.md',
        category: 'doc',
        updateType: 'modified',
        sizeBytes: 200,
        lastModifiedAt: now.toISOString(),
        hash: 'a',
      },
      {
        absolutePath: path.join(tempDir, 'src/services/newService.ts'),
        relativePath: 'src/services/newService.ts',
        category: 'code',
        updateType: 'added',
        sizeBytes: 150,
        lastModifiedAt: now.toISOString(),
        hash: 'b',
      },
    ]

    const result = recordVersionHistory(tempDir, scannedFiles)

    expect(fs.existsSync(result.historyFilePath)).toBe(true)
    const content = fs.readFileSync(result.historyFilePath, 'utf-8')
    expect(content).toContain('docs/README.md')
    expect(content).toContain('src/services/newService.ts')
    expect(content).toContain('新增')
    expect(content).toContain('修改')
    expect(result.updates).toHaveLength(1)
    expect(result.updates[0]).toMatchObject({
      filePath: result.historyFilePath,
      updateType: 'added',
    })
  })

  it('合并同一天同一文件的多次变更', () => {
    const now = new Date()
    const fileA: ScannedFile = {
      absolutePath: path.join(tempDir, 'docs/A.md'),
      relativePath: 'docs/A.md',
      category: 'doc',
      updateType: 'modified',
      sizeBytes: 100,
      lastModifiedAt: now.toISOString(),
      hash: 'a',
    }

    // 第一次记录
    recordVersionHistory(tempDir, [fileA])

    // 第二次记录同一文件（状态变为 added）
    const fileAAdded: ScannedFile = { ...fileA, updateType: 'added', sizeBytes: 120 }
    const result = recordVersionHistory(tempDir, [fileAAdded])

    const content = fs.readFileSync(result.historyFilePath, 'utf-8')
    const matches = content.match(/docs\/A\.md/g)
    expect(matches?.length).toBe(1)
  })
})
