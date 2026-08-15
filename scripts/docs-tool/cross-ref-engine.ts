#!/usr/bin/env node
/**
 * @module scripts/docs-tool/cross-ref-engine
 * @description 文档-代码-资源三类交叉引用检查引擎（共享内核）
 *
 * 本模块是从 scripts/audit/audit-doc-code-references.ts 抽离的单一事实源，
 * 同时被以下消费方复用，避免扫描逻辑多份副本漂移：
 *  - audit-doc-code-references.ts  （独立全仓库审计，产出三类型统计）
 *  - daily-doc-validation.ts        （自动校对系统 crossref 维度，按 tier 过滤）
 *  - doc:gate / doc-sync-scheduler   （门禁聚合）
 *
 * 三类检查：
 *  - doc-to-code ：文档引用代码/资源路径（src/ scripts/ *.ts *.json ...）
 *  - code-to-doc ：代码引用文档路径（docs/**\/*.md）
 *  - doc-to-doc  ：文档引用其它文档的相对链接
 *
 * 本模块只负责"扫描 + 校验存在性"，不引入任何 tier / 策略判定；
 * tier 过滤与 severity 映射由消费方（daily-doc-validation / 策略）决定。
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'

// ─── 类型 ───────────────────────────────────────────────────────────────────

export type ReferenceType = 'doc-to-code' | 'code-to-doc' | 'doc-to-doc'

export interface Reference {
  /** 源文件相对仓库根目录的路径（正斜杠） */
  source: string
  /** 引用的原始目标（文档中的字面量，可为相对路径/带锚点） */
  target: string
  /** 在源文件中的行号（1-based） */
  line: number
  /** 引用类型 */
  type: ReferenceType
}

export interface AuditResult {
  totalReferences: number
  brokenReferences: Reference[]
  validReferences: Reference[]
  brokenRate: number
  summary: {
    docToCode: { total: number; broken: number }
    codeToDoc: { total: number; broken: number }
    docToDoc: { total: number; broken: number }
  }
  bySource: Record<string, Reference[]>
  registryIntegrity?: {
    indexedFiles: number
    missingFromIndex: string[]
    orphanedIndexEntries: string[]
  }
}

// ─── 扫描工具 ───────────────────────────────────────────────────────────────

/**
 * 剥离引用尾部的中文注解（如"已废弃""已重构""占位示例""原名 xxx"等）。
 * 这类注解可能是 Phase 2 修复时有意添加的归档说明，不应被引擎误判为文件路径的一部分。
 */
function stripChineseAnnotation(target: string): string {
  // 剥离尾部的中文全角括号注解：`（已废弃，不再使用）`、`（已重构，不再存在）`、`（占位示例，非实际文件）`、`（原名 xxx）` 等
  return target.replace(/[（(][^）)]*[）)]\s*$/g, '').trim()
}

/**
 * 判定目标引用所在行是否包含"废弃/重构/占位"等归档说明。
 * 用于处理注解在 backtick 外但文件确已不再存在的情况（如 `src/router/routes.ts`（已重构，不再存在））。
 */
function hasDeprecationContext(line: string, target: string): boolean {
  const deprecationPatterns = [
    /已废弃/,
    /已重构/,
    /不再存在/,
    /不再使用/,
    /不再维护/,
    /占位示例/,
    /非实际文件/,
    /原名\s/,
  ]
  // 在 target 在行中的位置之后查找注解
  const idx = line.indexOf(target)
  if (idx === -1) return false
  const afterTarget = line.substring(idx + target.length)
  return deprecationPatterns.some((p) => p.test(afterTarget))
}

function extractReferences(
  content: string,
  regex: RegExp,
  sourceLine?: string,
): string[] {
  const refs: string[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    let cleaned = match[0].replace(/`/g, '')
    // 剥离尾部中文注解（处理注解在 backtick 内的情况）
    cleaned = stripChineseAnnotation(cleaned)
    // 模板字符串插值 / glob 通配属于"伪引用"，不应判为断链
    if (isPseudoReference(cleaned)) continue
    // 检查原始行是否包含废弃/重构/占位注解（处理注解在 backtick 外的情况）
    if (sourceLine !== undefined && hasDeprecationContext(sourceLine, cleaned)) continue
    refs.push(cleaned)
  }
  return refs
}

/**
 * 判定提取出的引用目标是否为"伪引用"（不应判为断链）。
 * 用于消除引擎历史误报——以下形态均为"示例性写法/占位符"，真实文件路径不可能出现：
 *  - 模板字符串插值：含 `${...}`（如 `src/${oldPath}.md`）
 *  - glob 通配符：含星号通配（如 docs 递归匹配写法）
 *  - 占位符花括号：含 `{` 或 `}`（如 `lessons-learned-{YYYY-MM-DD}.md`）
 *  - 尖括号占位：含 `<` 或 `>`（如 `<file>` / `<module>`）
 *  - 日期/序号占位符：含 `YYYY` / `MM` / `DD` / `NNN` / `XXX`
 *  - 多段大写蛇形占位变量：如 `MODULE_NAME` / `RISK_DERIVED`
 *  - 行号后缀：以 `:数字` 结尾（如 `path/to/file.ts:58`）
 *  - 命令行 flag：含 `--`（如 `scripts/fix.ts --apply`）
 *  - 纯目录引用：以 `/` 结尾（如 `src/components/ui/`）
 *  - 省略号占位：含 `...`（如 `src/components/.../V6ScoreCard.tsx` 表示中间目录省略）
 */
function isPseudoReference(target: string): boolean {
  if (/[${}<>]/.test(target)) return true // 模板插值 / 占位花括号 / 尖括号占位
  if (target.includes('*')) return true // glob 通配（* / **）
  if (target.includes('...')) return true // 省略号占位（中间目录省略）
  if (/\b(?:YYYY|MM|DD|NNN|XXX)\b/.test(target)) return true // 日期/序号占位符
  if (/[A-Z]+(?:_[A-Z]+)+/.test(target)) return true // 多段大写蛇形占位变量
  if (/:\d+$/.test(target)) return true // 行号后缀
  if (target.includes('--')) return true // 命令行 flag
  if (target.endsWith('/')) return true // 纯目录引用（尾斜杠）
  // 占位符文件名：Xxx/xxx 前缀表示模板示例（如 XxxWidget.tsx、xxx.types.ts、useXxxStore.ts）
  if (/\b[Xx]xx\w*\.(?:ts|tsx|js|jsx)\b/.test(target)) return true
  return false
}

/** 扫描单个文档文件，提取 doc-to-code 与 doc-to-doc 引用 */
export function scanDocReferences(filePath: string): Reference[] {
  const references: Reference[] = []
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    let lineWithoutMdLinks = line

    // 1. 提取 Markdown 链接 [text](url) 中的真实 URL，避免将链接文本误报为引用
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let match

    while ((match = mdLinkRegex.exec(line)) !== null) {
      const url = match[2]
      lineWithoutMdLinks = lineWithoutMdLinks.replace(match[0], '')

      // 模板字符串 / glob 伪引用直接跳过
      if (isPseudoReference(url)) continue

      if (url.startsWith('src/') || url.startsWith('scripts/')) {
        references.push({
          source: relative(process.cwd(), filePath),
          target: url,
          line: lineNum,
          type: 'doc-to-code',
        })
      } else if (url.endsWith('.md') || url.startsWith('docs/')) {
        references.push({
          source: relative(process.cwd(), filePath),
          target: url,
          line: lineNum,
          type: 'doc-to-doc',
        })
      }
    }

    // 2. 扫描剩余的反引号路径（非 Markdown 链接文本）
    // 传入原始行 line 用于检测废弃/重构/占位注解
    const codeTargets = extractReferences(lineWithoutMdLinks, /(?:`)(?:src|scripts)\/[^`]+(?:`)/g, line)
    for (const target of codeTargets) {
      references.push({
        source: relative(process.cwd(), filePath),
        target,
        line: lineNum,
        type: 'doc-to-code',
      })
    }

    const docTargets = extractReferences(lineWithoutMdLinks, /(?:`)(?:docs\/)?[^`]+\.md(?:`)/g, line)
    for (const target of docTargets) {
      if (isPseudoReference(target)) continue
      if (target.includes('+')) {
        const parts = target.split('+').map((s) => s.trim())
        for (const part of parts) {
          if (part.endsWith('.md')) {
            references.push({
              source: relative(process.cwd(), filePath),
              target: part,
              line: lineNum,
              type: 'doc-to-doc',
            })
          }
        }
      } else {
        references.push({
          source: relative(process.cwd(), filePath),
          target,
          line: lineNum,
          type: 'doc-to-doc',
        })
      }
    }
  }

  return references
}

/** 扫描单个代码文件，提取 code-to-doc 引用 */
export function scanCodeReferences(filePath: string): Reference[] {
  const references: Reference[] = []
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    let lineWithoutMdLinks = line

    // 1. 提取 Markdown 链接 [text](url) 中的真实 URL
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let match

    while ((match = mdLinkRegex.exec(line)) !== null) {
      const url = match[2]
      lineWithoutMdLinks = lineWithoutMdLinks.replace(match[0], '')

      // 模板字符串 / glob 伪引用直接跳过
      if (isPseudoReference(url)) continue

      if (url.startsWith('docs/') && url.endsWith('.md') && !url.includes('+') && !url.includes('//')) {
        references.push({
          source: relative(process.cwd(), filePath),
          target: url,
          line: lineNum,
          type: 'code-to-doc',
        })
      }
    }

    // 2. 扫描剩余的反引号文档路径
    const docTargets = extractReferences(lineWithoutMdLinks, /(?:`)(?:docs\/)?[^`]+\.md(?:`)/g, line)
    for (const target of docTargets) {
      references.push({
        source: relative(process.cwd(), filePath),
        target,
        line: lineNum,
        type: 'code-to-doc',
      })
    }

    // 3. 扫描裸 docs/ 路径（避免与 Markdown 链接 URL 重复）
    const docLinkRegex = /docs\/[^\s'")]+/g
    while ((match = docLinkRegex.exec(lineWithoutMdLinks)) !== null) {
      const target = match[0]
      if (!target.includes('//') && target.endsWith('.md') && !target.includes('+') && !isPseudoReference(target)) {
        references.push({
          source: relative(process.cwd(), filePath),
          target,
          line: lineNum,
          type: 'code-to-doc',
        })
      }
    }
  }

  return references
}

/**
 * 校验单条引用目标在磁盘上是否存在（含常见扩展名补全）。
 *
 * 解析语义（含两道兜底，均用实际存在性校验，绝不掩盖真实断链）：
 *  1. 主解析：
 *     - `src/` / `scripts/` / `docs/` 前缀 → 相对仓库根解析
 *     - 其它（相对引用 / 裸名）→ 相对源文件目录解析
 *  2. 兜底 A（根级裸名）：目标为裸文件名（不含斜杠），且仓库根存在同名文件
 *     （如 `AGENTS.md` / `README.md` 被子目录文档裸名引用）→ 回退仓库根判 valid
 *  3. 兜底 B（.. 越界）：主解析结果逃逸仓库根（爬出 rootDir，如 `docs/../../README.md`、
 *     `../../../CHANGELOG.md`）→ 回退 `rootDir/basename` 判 valid。
 *     仅当确实逃逸时才触发，站内相对断链（解析结果仍在 rootDir 内）不被误判为 valid。
 */
export function validateReference(ref: Reference, rootDir: string): boolean {
  const rootPrefix = rootDir.replace(/[\\/]$/, '') + (process.platform === 'win32' ? '\\' : '/')

  // 代码位置后缀（行号/行列/行范围，支持 : 或 / 分隔，以及逗号分隔的多位置如 :52,134）和 Markdown 锚点不应影响文件存在性判断
  const locationSuffix = /(\.\w+)?(?::\d+(?:[-/]\d+)?(?:,\d+)*(?::\d+)?)$/
  let baseTarget = ref.target
  if (ref.type === 'doc-to-code' && locationSuffix.test(baseTarget)) {
    baseTarget = baseTarget.replace(locationSuffix, '$1')
  }
  if (baseTarget.includes('#')) {
    baseTarget = baseTarget.split('#')[0]
  }

  let fullPath: string
  if (baseTarget.startsWith('src/') || baseTarget.startsWith('scripts/')) {
    fullPath = resolve(rootDir, baseTarget)
  } else if (baseTarget.startsWith('docs/')) {
    fullPath = resolve(rootDir, baseTarget)
  } else {
    const sourceDir = resolve(rootDir, dirname(ref.source))
    fullPath = resolve(sourceDir, baseTarget)
  }

  const exists = (p: string): boolean =>
    existsSync(p) || existsSync(p + '.ts') || existsSync(p + '.tsx') || existsSync(p + '.md')

  if (exists(fullPath)) return true

  // 兜底 A：根级裸名引用（无斜杠）
  if (!baseTarget.includes('/') && !baseTarget.includes('\\')) {
    if (exists(resolve(rootDir, baseTarget))) return true
  }

  // 兜底 B：.. 越界路径（主解析爬出仓库根）
  if (!fullPath.startsWith(rootPrefix)) {
    if (exists(resolve(rootDir, basename(fullPath)))) return true
  }

  return false
}

/** 递归遍历目录，对每个 .md/.ts/.tsx 文件调用回调（跳过隐藏/下划线前缀目录、archive 归档目录） */
export function scanDirectory(dir: string, callback: (filePath: string) => void): void {
  if (!existsSync(dir)) return

  const items = readdirSync(dir, { withFileTypes: true })

  for (const item of items) {
    const fullPath = join(dir, item.name)

    if (item.isDirectory()) {
      // 跳过隐藏目录、下划线前缀目录、archive 归档目录（归档文档不参与交叉引用审计）
      if (!item.name.startsWith('.') && !item.name.startsWith('_') && item.name !== 'archive') {
        scanDirectory(fullPath, callback)
      }
    } else {
      if (item.name.endsWith('.md') || item.name.endsWith('.ts') || item.name.endsWith('.tsx')) {
        callback(fullPath)
      }
    }
  }
}

/** 校验 registry-index.md 索引完整性 */
export function checkRegistryIntegrity(rootDir: string): AuditResult['registryIntegrity'] {
  const REGISTRY_INDEX = join(rootDir, 'docs', 'meta', 'registry-index.md')
  if (!existsSync(REGISTRY_INDEX)) return undefined

  const indexContent = readFileSync(REGISTRY_INDEX, 'utf-8')
  const indexEntries: string[] = []
  const linkRegex = /\]\(([^)]+)\)/g
  let match

  while ((match = linkRegex.exec(indexContent)) !== null) {
    const linkPath = match[1]
    if (linkPath.endsWith('.md')) {
      const resolvedPath = resolve(dirname(REGISTRY_INDEX), linkPath)
      indexEntries.push(relative(rootDir, resolvedPath).replace(/\\/g, '/'))
    }
  }

  const actualDocs: string[] = []
  scanDirectory(join(rootDir, 'docs'), (filePath) => {
    if (filePath.endsWith('.md')) {
      actualDocs.push(relative(rootDir, filePath).replace(/\\/g, '/'))
    }
  })

  const missingFromIndex = actualDocs.filter((doc) => !indexEntries.includes(doc))
  const orphanedIndexEntries = indexEntries.filter((entry) => !actualDocs.includes(entry))

  return {
    indexedFiles: indexEntries.length,
    missingFromIndex,
    orphanedIndexEntries,
  }
}

// ─── 全仓库审计（供独立审计脚本 / 门禁复用） ─────────────────────────────────

/**
 * 全仓库三类交叉引用审计。
 * @param rootDir 仓库根目录绝对路径
 */
export function runFullAudit(rootDir: string): AuditResult {
  const DOCS_DIR = join(rootDir, 'docs')
  const SRC_DIR = join(rootDir, 'src')
  const SCRIPTS_DIR = join(rootDir, 'scripts')

  const allReferences: Reference[] = []

  scanDirectory(DOCS_DIR, (filePath) => {
    if (filePath.endsWith('.md')) {
      allReferences.push(...scanDocReferences(filePath))
    }
  })

  scanDirectory(SRC_DIR, (filePath) => {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      allReferences.push(...scanCodeReferences(filePath))
    }
  })

  scanDirectory(SCRIPTS_DIR, (filePath) => {
    if (filePath.endsWith('.ts')) {
      allReferences.push(...scanCodeReferences(filePath))
    }
  })

  const brokenReferences: Reference[] = []
  const validReferences: Reference[] = []

  for (const ref of allReferences) {
    if (validateReference(ref, rootDir)) {
      validReferences.push(ref)
    } else {
      brokenReferences.push(ref)
    }
  }

  const bySource: Record<string, Reference[]> = {}
  for (const ref of brokenReferences) {
    if (!bySource[ref.source]) {
      bySource[ref.source] = []
    }
    bySource[ref.source].push(ref)
  }

  const totalReferences = allReferences.length
  const brokenCount = brokenReferences.length
  const brokenRate = totalReferences > 0 ? brokenCount / totalReferences : 0

  return {
    totalReferences,
    brokenReferences,
    validReferences,
    brokenRate,
    summary: {
      docToCode: {
        total: allReferences.filter((r) => r.type === 'doc-to-code').length,
        broken: brokenReferences.filter((r) => r.type === 'doc-to-code').length,
      },
      codeToDoc: {
        total: allReferences.filter((r) => r.type === 'code-to-doc').length,
        broken: brokenReferences.filter((r) => r.type === 'code-to-doc').length,
      },
      docToDoc: {
        total: allReferences.filter((r) => r.type === 'doc-to-doc').length,
        broken: brokenReferences.filter((r) => r.type === 'doc-to-doc').length,
      },
    },
    bySource,
    registryIntegrity: checkRegistryIntegrity(rootDir),
  }
}
