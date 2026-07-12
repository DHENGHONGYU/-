// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { ScannedFile } from '../../../src/types/modules/doc-validation.types'
import {
  classifyLinkTarget,
  findBrokenCrossReferences,
  extractRelativeLinks,
  syncCrossReferences,
} from '../../../scripts/doc-cross-ref-sync'

/**
 * doc-cross-ref-sync.ts filePath 级归因测试（A8 增强项）
 *
 * 覆盖范围：
 * 1. classifyLinkTarget — 链接目标解析与可修复性分类
 * 2. findBrokenCrossReferences — 只读扫描断裂交叉引用（filePath 级归因）
 * 3. extractRelativeLinks — 链接提取（带行/列号）
 * 4. syncCrossReferences — brokenLinks 字段包含全部断链（含不可修复）
 */

// ─── 共用 fixture 工具 ──────────────────────────────────────────────────────────

function makeFixtureDir(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crossref-test-'))
  // 创建 3 个真实文件
  fs.writeFileSync(path.join(tmp, 'existing.md'), '# Existing\n\nRefer to [missing](./absent.md).\n')
  fs.writeFileSync(path.join(tmp, 'target.md'), '# Target\n')
  // 创建同名歧义场景：两个同名文件在不同子目录
  const subA = path.join(tmp, 'subA')
  const subB = path.join(tmp, 'subB')
  fs.mkdirSync(subA)
  fs.mkdirSync(subB)
  fs.writeFileSync(path.join(subA, 'dup.md'), '# Dup A\n')
  fs.writeFileSync(path.join(subB, 'dup.md'), '# Dup B\n')
  return tmp
}

function cleanupFixtureDir(tmp: string): void {
  fs.rmSync(tmp, { recursive: true, force: true })
}

function scannedFilesForDir(tmp: string): ScannedFile[] {
  const files: ScannedFile[] = []
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (fs.statSync(full).isDirectory()) { walk(full); continue }
      files.push({
        absolutePath: full.replace(/\\/g, '/'),
        relativePath: path.relative(tmp, full).replace(/\\/g, '/'),
        category: 'doc',
        hash: 'deadbeef',
        size: fs.statSync(full).size,
        lastModified: new Date().toISOString(),
      })
    }
  }
  walk(tmp)
  return files
}

// ─── classifyLinkTarget ──────────────────────────────────────────────────────────

describe('classifyLinkTarget — filePath 级归因分类', () => {
  it('无候选：目标不存在且未找到同名文件 → fixable=false, diagnostic 含"无候选"', () => {
    const result = classifyLinkTarget('/some/dir', './absent.md', ['/some/dir/existing.md'])
    // Windows 下 resolve 会加盘符，所以只断言尾部而非全路径
    expect(result.resolvedTargetPath.replace(/^[A-Z]:/, '').replace(/\\/g, '/')).toBe('/some/dir/absent.md')
    expect(result.fixable).toBe(false)
    expect(result.candidates).toHaveLength(0)
    expect(result.diagnostic).toContain('无候选')
  })

  it('唯一候选：存在唯一同名文件 → fixable=true', () => {
    const result = classifyLinkTarget('/some/dir', './target.md', ['/some/dir/target.md'])
    expect(result.resolvedTargetPath.replace(/^[A-Z]:/, '').replace(/\\/g, '/')).toBe('/some/dir/target.md')
    expect(result.fixable).toBe(true)
    expect(result.candidates).toHaveLength(1)
  })

  it('歧义多候选：同名文件超过 1 个 → fixable=false, diagnostic 含"歧义"', () => {
    const result = classifyLinkTarget(
      '/some/dir',
      './dup.md',
      ['/some/dir/subA/dup.md', '/some/dir/subB/dup.md'],
    )
    expect(result.fixable).toBe(false)
    expect(result.candidates.length).toBeGreaterThanOrEqual(2)
    expect(result.diagnostic).toContain('歧义')
  })

  it('带锚点链接：剥离锚点后解析 → resolvedTargetPath 不含 #', () => {
    const result = classifyLinkTarget('/some/dir', './target.md#section', ['/some/dir/target.md'])
    expect(result.resolvedTargetPath).not.toContain('#')
    expect(result.fixable).toBe(true)
  })
})

// ─── extractRelativeLinks ────────────────────────────────────────────────────────

describe('extractRelativeLinks — 带行/列号的链接提取', () => {
  it('提取相对链接并附带行/列号', () => {
    const content = '# Title\n\nSome [link](./ref.md) here.\nAnother [absent](./gone.md).\n'
    const links = extractRelativeLinks(content)
    expect(links.length).toBe(2)
    expect(links[0].target).toBe('./ref.md')
    expect(links[0].line).toBe(3)  // 行 3（1-based）
    expect(links[0].column).toBeGreaterThanOrEqual(0)
    expect(links[1].target).toBe('./gone.md')
    expect(links[1].line).toBe(4)
  })

  it('跳过外部链接和锚点', () => {
    const content = '# Title\n\n[web](https://example.com) [local](./ref.md) [anchor](#top)\n'
    const links = extractRelativeLinks(content)
    expect(links).toHaveLength(1)
    expect(links[0].target).toBe('./ref.md')
  })
})

// ─── findBrokenCrossReferences ────────────────────────────────────────────────────

describe('findBrokenCrossReferences — 只读 filePath 级归因扫描', () => {
  let tmp: string
  let files: ScannedFile[]

  beforeEach(() => {
    tmp = makeFixtureDir()
    files = scannedFilesForDir(tmp)
  })

  afterEach(() => {
    cleanupFixtureDir(tmp)
  })

  it('缺失链接 → 0 候选，filePath 级归因含 resolvedTargetPath + 行号', () => {
    const report = findBrokenCrossReferences(tmp, files)
    // existing.md 引用了 ./absent.md（不存在）
    const broken = report.brokenLinks.find(
      (b) => b.sourceRelativePath.includes('existing.md') && b.originalTarget === './absent.md',
    )
    expect(broken).toBeDefined()
    expect(broken!.fixable).toBe(false)
    expect(broken!.resolvedTargetPath).toContain('absent.md')
    expect(broken!.line).toBeGreaterThan(0)
    expect(broken!.diagnostic).toContain('无候选')
  })

  it('有效链接不报为断链', () => {
    const report = findBrokenCrossReferences(tmp, files)
    const validBroken = report.brokenLinks.find(
      (b) => b.originalTarget === './target.md',
    )
    expect(validBroken).toBeUndefined()
  })

  it('歧义链接 → 多候选，fixable=false，diagnostic 含"歧义"', () => {
    // 创建一个引用 ./dup.md 的文件（歧义：subA/dup.md vs subB/dup.md）
    const ambiguousFile = path.join(tmp, 'ambiguous.md')
    fs.writeFileSync(ambiguousFile, '# Ambiguous\n\nSee [dup](./dup.md).\n')
    files.push({
      absolutePath: ambiguousFile.replace(/\\/g, '/'),
      relativePath: 'ambiguous.md',
      category: 'doc',
      hash: 'cafebabe',
      size: fs.statSync(ambiguousFile).size,
      lastModified: new Date().toISOString(),
    })

    const report = findBrokenCrossReferences(tmp, files)
    const broken = report.brokenLinks.find(
      (b) => b.sourceRelativePath === 'ambiguous.md',
    )
    expect(broken).toBeDefined()
    expect(broken!.fixable).toBe(false)
    expect(broken!.candidates.length).toBeGreaterThanOrEqual(2)
    expect(broken!.diagnostic).toContain('歧义')
  })

  it('返回 filesScanned 和 totalLinksChecked', () => {
    const report = findBrokenCrossReferences(tmp, files)
    expect(report.filesScanned).toBeGreaterThan(0)
    expect(report.totalLinksChecked).toBeGreaterThan(0)
  })
})

// ─── syncCrossReferences brokenLinks 字段 ────────────────────────────────────────

describe('syncCrossReferences — brokenLinks 字段包含全部断链', () => {
  let tmp: string
  let files: ScannedFile[]

  beforeEach(() => {
    tmp = makeFixtureDir()
    files = scannedFilesForDir(tmp)
  })

  afterEach(() => {
    cleanupFixtureDir(tmp)
  })

  it('结果含 brokenLinks 字段，不可修复断链不再静默丢弃', () => {
    const result = syncCrossReferences(tmp, files)
    expect(result.brokenLinks).toBeDefined()
    // 即使不可修复（0 候选），也应出现在 brokenLinks 中
    const unfixable = result.brokenLinks.filter((b) => !b.fixable)
    // existing.md 引了 ./absent.md（不存在，0 候选）→ 应被报告
    expect(unfixable.length).toBeGreaterThan(0)
    expect(unfixable.some((b) => b.originalTarget === './absent.md')).toBe(true)
  })

  it('每条 brokenLink 含 filePath 级归因字段（resolvedTargetPath/line/column/diagnostic）', () => {
    const result = syncCrossReferences(tmp, files)
    for (const b of result.brokenLinks) {
      expect(b.resolvedTargetPath).toBeTruthy()
      expect(b.line).toBeGreaterThan(0)
      expect(typeof b.column).toBe('number')
      expect(b.diagnostic).toBeTruthy()
    }
  })
})
