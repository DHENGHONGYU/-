#!/usr/bin/env node
/**
 * @module scripts/daily-doc-validation
 * @description 每日自动化文档验证与更新流程
 *
 * 触发条件：
 * - GitHub Actions 定时任务：每天 00:00 UTC（cron: "0 0 * * *"）
 * - 手动触发：npx tsx scripts/daily-doc-validation.ts [--auto-update] [--since <iso>] [--until <iso>]
 *
 * 职责：
 * 1. 扫描仓库内所有材料（文档、代码、测试、脚本、配置、可执行文件）
 * 2. 执行完整性 / 一致性 / 正确性三维验证
 * 3. 对检测到的可修复问题执行自动更新（交叉引用同步、版本历史归档）
 * 4. 生成结构化执行日志并持久化到 docs/reports/daily-doc-validation/
 *
 * 输出契约：
 * - stdout：JSON 数据流（DailyDocValidationReport）
 * - stderr：带秒级时间戳的诊断日志
 * - 文件：docs/reports/daily-doc-validation/daily-doc-validation-{YYYY-MM-DDTHH-mm-ss}.json
 */

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  DailyDocValidationReport,
  DailyValidationConfig,
  DimensionSummary,
  DocUpdateEntry,
  MaterialCategory,
  ScannedFile,
  SeverityLevel,
  SubValidatorResult,
  UpdateType,
  ValidationDimension,
  ValidationFinding,
  ValidationStatus,
} from '../src/types/modules/doc-validation.types'
import { syncCrossReferences, extractRelativeLinks, classifyLinkTarget } from './doc-cross-ref-sync'
import { recordVersionHistory } from './doc-version-history'

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const ROOT = resolve(__dirname, '..')

/** 报告输出目录 */
const REPORT_DIR = join(ROOT, 'docs', 'reports', 'daily-doc-validation')

/** 扫描根目录白名单 */
const SCAN_ROOTS = [
  'docs',
  'src',
  'tests',
  'e2e',
  'scripts',
  'packages',
  '.github/workflows',
] as const

/** 根级文档文件 glob（扩展名匹配） */
const ROOT_DOC_EXTENSIONS = new Set(['.md'])

/** 文档扩展名 */
const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt'])

/** 代码扩展名 */
const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.vue',
  '.py',
  '.cjs',
  '.mjs',
])

/** 测试文件模式 */
const TEST_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\/__tests__\//,
  /\/__mocks__\//,
]

/** 脚本扩展名 */
const SCRIPT_EXTENSIONS = new Set(['.sh', '.ps1', '.py', '.cjs', '.mjs'])

/** 配置文件扩展名/文件名 */
const CONFIG_PATTERNS = [
  /\.config\.(js|ts|cjs|mjs|json)$/,
  /\.rc\.json$/,
  /^\.env/,
  /^tsconfig/,
  /^eslint/,
  /^vite\.config/,
  /^playwright\.config/,
  /^postcss\.config/,
  /^cspell\.json$/,
]

/** 可执行扩展名（Windows / Unix） */
const EXECUTABLE_EXTENSIONS = new Set(['.exe', '.bin', '.cmd', '.bat'])

/** 默认并发限制 */
const DEFAULT_CONCURRENCY = 8

/** 默认最大重试次数 */
const DEFAULT_MAX_RETRIES = 3

/** 重试基础延迟（毫秒） */
const RETRY_BASE_DELAY_MS = 500

/** 忽略目录 */
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'dist-test',
  'coverage',
  '.git',
  '.husky',
  'coverage_cmd',
  'e2e-test-report',
])

/** 忽略文件模式 */
const IGNORED_FILE_PATTERNS = [
  /\.lock$/,
  /package-lock\.json$/,
  /\.log$/,
  /\.tmp$/,
  /\.cache$/,
]

// ─── 轻量日志器 ───────────────────────────────────────────────────────────────

interface Logger {
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
  debug(message: string, context?: Record<string, unknown>): void
}

const logger: Logger = {
  info(message, context) {
    const timestamp = formatTimestampSeconds(new Date())
    console.error(`[INFO] [${timestamp}] [DailyDocValidation] ${message}`, context ?? '')
  },
  warn(message, context) {
    const timestamp = formatTimestampSeconds(new Date())
    console.error(`[WARN] [${timestamp}] [DailyDocValidation] ${message}`, context ?? '')
  },
  error(message, context) {
    const timestamp = formatTimestampSeconds(new Date())
    console.error(`[ERROR] [${timestamp}] [DailyDocValidation] ${message}`, context ?? '')
  },
  debug(message, context) {
    if (process.env.DEBUG_DOC_VALIDATION === 'true') {
      const timestamp = formatTimestampSeconds(new Date())
      console.error(`[DEBUG] [${timestamp}] [DailyDocValidation] ${message}`, context ?? '')
    }
  },
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

export function formatTimestampSeconds(date: Date): string {
  return date.toISOString().replace(/\..+/, 'Z')
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function retryWithBackoff<T>(
  fn: () => T | Promise<T>,
  maxRetries: number,
  operationName: string,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn()
      if (attempt > 0) {
        logger.info(`[DailyDocValidation] 重试成功`, { operationName, attempt })
      }
      return result
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`[DailyDocValidation] 操作失败，准备重试`, {
        operationName,
        attempt,
        maxRetries,
        error: message,
      })
      if (attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * 2 ** attempt
        await sleep(delay)
      }
    }
  }
  throw lastError
}

// ─── 分类与扫描 ───────────────────────────────────────────────────────────────

export function classifyFile(relativePath: string): MaterialCategory {
  const lowerPath = relativePath.toLowerCase()
  const ext = extname(relativePath).toLowerCase()

  if (TEST_PATTERNS.some((pattern) => pattern.test(relativePath))) {
    return 'test'
  }

  if (lowerPath.startsWith('docs/') || DOC_EXTENSIONS.has(ext)) {
    return 'doc'
  }

  if (
    lowerPath.startsWith('scripts/') ||
    lowerPath.startsWith('.github/workflows/') ||
    SCRIPT_EXTENSIONS.has(ext)
  ) {
    return 'script'
  }

  if (CONFIG_PATTERNS.some((pattern) => pattern.test(relativePath))) {
    return 'config'
  }

  if (EXECUTABLE_EXTENSIONS.has(ext)) {
    return 'executable'
  }

  if (CODE_EXTENSIONS.has(ext)) {
    return 'code'
  }

  return 'other'
}

function shouldIgnorePath(fullPath: string): boolean {
  const parts = fullPath.split(/[\\/]/)
  if (parts.some((part) => IGNORED_DIRS.has(part))) {
    return true
  }
  if (IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(fullPath))) {
    return true
  }
  return false
}

function collectFiles(dir: string, files: string[]): void {
  if (!existsSync(dir)) return
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    if (shouldIgnorePath(fullPath)) continue

    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      collectFiles(fullPath, files)
    } else if (stat.isFile()) {
      files.push(fullPath)
    }
  }
}

function detectUpdateType(
  relativePath: string,
  sinceMs: number,
  untilMs: number,
): UpdateType {
  const fullPath = join(ROOT, relativePath)
  if (!existsSync(fullPath)) {
    return 'deleted'
  }

  let stat
  try {
    stat = statSync(fullPath)
  } catch {
    return 'deleted'
  }

  const mtime = stat.mtimeMs
  if (mtime >= sinceMs && mtime <= untilMs) {
    return 'modified'
  }

  // 通过 git 判断新增文件（最近 24 小时内加入版本控制）
  try {
    const addedAt = execSync(`git log --follow --diff-filter=A --format=%aI -- "${relativePath}" | tail -1`, {
      encoding: 'utf-8',
      cwd: ROOT,
    }).trim()
    if (addedAt) {
      const addedMs = new Date(addedAt).getTime()
      if (addedMs >= sinceMs && addedMs <= untilMs) {
        return 'added'
      }
    }
  } catch {
    // git 不可用或非仓库，忽略
  }

  return 'unchanged'
}

function scanMaterials(config: DailyValidationConfig): ScannedFile[] {
  const files: string[] = []

  for (const root of SCAN_ROOTS) {
    const fullPath = join(config.rootDir, root)
    collectFiles(fullPath, files)
  }

  // 扫描根级文档
  try {
    const rootEntries = readdirSync(config.rootDir)
    for (const entry of rootEntries) {
      const fullPath = join(config.rootDir, entry)
      if (shouldIgnorePath(fullPath)) continue
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }
      if (stat.isFile() && ROOT_DOC_EXTENSIONS.has(extname(entry).toLowerCase())) {
        files.push(fullPath)
      }
    }
  } catch {
    // 根目录读取失败时忽略
  }

  const scanned: ScannedFile[] = []
  for (const fullPath of files) {
    const relativePath = relative(config.rootDir, fullPath).replace(/\\/g, '/')
    try {
      const stat = statSync(fullPath)
      const content = readFileSync(fullPath)
      scanned.push({
        absolutePath: fullPath,
        relativePath,
        category: classifyFile(relativePath),
        updateType: detectUpdateType(relativePath, config.scanSince, config.scanUntil),
        sizeBytes: stat.size,
        lastModifiedAt: stat.mtime.toISOString(),
        hash: sha256(content),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[DailyDocValidation] 扫描文件失败`, { file: relativePath, error: message })
    }
  }

  return scanned
}

// ─── 验证器 ───────────────────────────────────────────────────────────────────

function createFinding(
  dimension: ValidationDimension,
  severity: SeverityLevel,
  status: ValidationStatus,
  filePath: string,
  message: string,
  suggestion?: string,
  relatedFiles?: string[],
): ValidationFinding {
  return {
    id: generateId(),
    dimension,
    severity,
    status,
    filePath,
    message,
    suggestion,
    relatedFiles,
  }
}

function validateIntegrity(files: readonly ScannedFile[]): SubValidatorResult {
  logger.info(`[DailyDocValidation] 开始完整性验证`, { totalFiles: files.length })
  const findings: ValidationFinding[] = []

  for (const file of files) {
    if (file.updateType === 'deleted') continue

    // 空文件检查
    if (file.sizeBytes === 0) {
      findings.push(
        createFinding(
          'integrity',
          'medium',
          'warning',
          file.relativePath,
          '文件内容为空，可能导致引用缺失或构建失败',
          '请补充内容或删除无效文件',
        ),
      )
      continue
    }

    // 哈希校验：重新计算对比
    try {
      const content = readFileSync(file.absolutePath)
      const currentHash = sha256(content)
      if (currentHash !== file.hash) {
        findings.push(
          createFinding(
            'integrity',
            'critical',
            'failure',
            file.relativePath,
            '文件哈希校验失败，扫描期间内容发生变化',
            '请排查并发写入或文件系统异常',
          ),
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      findings.push(
        createFinding(
          'integrity',
          'critical',
          'failure',
          file.relativePath,
          `无法读取文件进行完整性校验: ${message}`,
          '请检查文件权限或磁盘状态',
        ),
      )
    }
  }

  logger.info(`[DailyDocValidation] 完整性验证完成`, {
    scannedCount: files.length,
    findingCount: findings.length,
  })

  return { name: 'integrity', findings, scannedCount: files.length }
}



export function validateConsistency(files: readonly ScannedFile[]): SubValidatorResult {
  logger.info(`[DailyDocValidation] 开始一致性验证`, { totalFiles: files.length })
  const findings: ValidationFinding[] = []

  const docFiles = files.filter((f) => f.category === 'doc')
  const allPaths = new Set(files.map((f) => f.absolutePath.replace(/\\/g, '/')))

  logger.info(`[DailyDocValidation] 一致性验证文件范围`, {
    docFileCount: docFiles.length,
    knownPathCount: allPaths.size,
  })

  let totalLinksChecked = 0
  let totalBrokenLinks = 0
  let filesWithBrokenLinks = 0

  for (const file of docFiles) {
    if (file.updateType === 'deleted') continue

    let content: string
    try {
      content = readFileSync(file.absolutePath, 'utf-8')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.info(`[DailyDocValidation] 一致性验证读文档失败`, {
        file: file.relativePath,
        error: message,
      })
      findings.push(
        createFinding(
          'consistency',
          'high',
          'failure',
          file.relativePath,
          `无法读取文档进行一致性检查: ${message}`,
        ),
      )
      continue
    }

    const links = extractRelativeLinks(content)
    const sourceDir = file.absolutePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
    /** 断链的 filePath 级归因（resolved target + line:column） */
    const brokenFilePaths: string[] = []
    /** 断链原始文本（保留用于日志） */
    const brokenRawTargets: string[] = []

    totalLinksChecked += links.length

    for (const link of links) {
      const cls = classifyLinkTarget(sourceDir, link.target, Array.from(allPaths))
      const existsInScan = allPaths.has(cls.resolvedTargetPath)
      const existsOnDisk = existsSync(cls.resolvedTargetPath)
      logger.info(`[DailyDocValidation] 检查交叉引用`, {
        source: file.relativePath,
        target: link.target,
        resolved: cls.resolvedTargetPath,
        fixable: cls.fixable,
        existsInScan,
        existsOnDisk,
      })
      if (!existsInScan && !existsOnDisk) {
        brokenFilePaths.push(`${cls.resolvedTargetPath}:${link.line}:${link.column}`)
        brokenRawTargets.push(link.target)
      }
    }

    if (brokenFilePaths.length > 0) {
      totalBrokenLinks += brokenFilePaths.length
      filesWithBrokenLinks++
      logger.info(`[DailyDocValidation] 发现断裂交叉引用（filePath 级归因）`, {
        file: file.relativePath,
        brokenCount: brokenFilePaths.length,
        brokenFilePaths,
      })
      findings.push(
        createFinding(
          'consistency',
          'high',
          'warning',
          file.relativePath,
          `发现 ${brokenFilePaths.length} 个断裂的交叉引用（filePath 级归因：${brokenFilePaths.join(', ')})`,
          '运行 npx tsx scripts/doc-cross-ref-sync.ts 自动修复',
          brokenFilePaths,
        ),
      )
    }
  }

  // 术语一致性：检查常见术语混用
  const termInconsistencies: Array<{ term: string; variants: string[] }> = [
    { term: 'DataBridge', variants: ['data bridge', 'Data Bridge', 'databridge'] },
    { term: 'Zustand', variants: ['zustand', 'Zustland'] },
  ]

  logger.info(`[DailyDocValidation] 开始术语一致性检查`, {
    termCount: termInconsistencies.length,
    terms: termInconsistencies.map((t) => t.term),
  })

  for (const file of docFiles) {
    if (file.updateType === 'deleted') continue
    const content = readFileSync(file.absolutePath, 'utf-8')
    for (const { term, variants } of termInconsistencies) {
      const foundVariants = variants.filter((variant) =>
        new RegExp(`\\b${variant}\\b`, 'i').test(content),
      )
      if (foundVariants.length > 0) {
        logger.info(`[DailyDocValidation] 发现术语不一致`, {
          file: file.relativePath,
          term,
          foundVariants,
          expectedTerm: term,
        })
        findings.push(
          createFinding(
            'consistency',
            'low',
            'warning',
            file.relativePath,
            `术语 "${term}" 存在不一致写法: ${foundVariants.join(', ')}`,
            `统一使用 "${term}"`,
          ),
        )
      }
    }
  }

  logger.info(`[DailyDocValidation] 一致性验证完成`, {
    scannedCount: docFiles.length,
    totalLinksChecked,
    totalBrokenLinks,
    filesWithBrokenLinks,
    findingCount: findings.length,
  })

  return { name: 'consistency', findings, scannedCount: docFiles.length }
}

export function validateCorrectness(files: readonly ScannedFile[]): SubValidatorResult {
  logger.info(`[DailyDocValidation] 开始正确性验证`, { totalFiles: files.length })
  const findings: ValidationFinding[] = []

  const docFiles = files.filter((f) => f.category === 'doc')
  logger.info(`[DailyDocValidation] 正确性验证文档范围`, {
    docFileCount: docFiles.length,
  })

  for (const file of docFiles) {
    if (file.updateType === 'deleted') continue

    const content = readFileSync(file.absolutePath, 'utf-8')
    logger.info(`[DailyDocValidation] 正确性验证检查文档`, {
      file: file.relativePath,
      sizeBytes: file.sizeBytes,
      startsWithFrontmatter: content.startsWith('---'),
    })

    // Markdown  frontmatter 格式检查
    if (content.startsWith('---')) {
      const end = content.indexOf('---', 3)
      if (end === -1) {
        logger.info(`[DailyDocValidation] 发现 frontmatter 未正确关闭`, {
          file: file.relativePath,
        })
        findings.push(
          createFinding(
            'correctness',
            'medium',
            'warning',
            file.relativePath,
            'YAML frontmatter 未正确关闭',
            '请补充结束标记 ---',
          ),
        )
      } else {
        logger.info(`[DailyDocValidation] frontmatter 格式正常`, {
          file: file.relativePath,
          frontmatterEndIndex: end,
        })
      }
    }

    // 代码块语言标记检查（仅处理开启围栏，避免将闭合围栏误判为未命名代码块）
    const codeBlockRegex = /^```(\s*\w*)?\s*$/gm
    let match
    let codeBlockCount = 0
    let unnamedCodeBlockCount = 0
    let insideCodeBlock = false
    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (insideCodeBlock) {
        // 当前为闭合围栏，跳过不统计
        insideCodeBlock = false
        continue
      }
      insideCodeBlock = true
      codeBlockCount++
      const lang = match[1]?.trim() ?? ''
      if (!lang) {
        unnamedCodeBlockCount++
        logger.info(`[DailyDocValidation] 发现未指定语言的代码块`, {
          file: file.relativePath,
          matchIndex: match.index,
        })
        findings.push(
          createFinding(
            'correctness',
            'low',
            'warning',
            file.relativePath,
            '发现未指定语言的代码块',
            '为代码块添加语言标记以提升可读性',
          ),
        )
      }
    }

    if (codeBlockCount > 0) {
      logger.info(`[DailyDocValidation] 文档代码块检查汇总`, {
        file: file.relativePath,
        codeBlockCount,
        unnamedCodeBlockCount,
      })
    }
  }

  // TypeScript 代码语法校验（抽样，避免过长时间）
  const tsFiles = files.filter(
    (f) =>
      (f.category === 'code' || f.category === 'test' || f.category === 'script') &&
      (f.relativePath.endsWith('.ts') || f.relativePath.endsWith('.tsx')),
  )
  const sampleTsFiles = tsFiles.slice(0, 50)
  logger.info(`[DailyDocValidation] 正确性验证 TypeScript 抽样`, {
    tsFileTotal: tsFiles.length,
    sampleSize: sampleTsFiles.length,
  })

  for (const file of sampleTsFiles) {
    if (file.updateType === 'deleted') continue
    try {
      const content = readFileSync(file.absolutePath, 'utf-8')
      // 基本语法探测：括号平衡
      const openBraces = (content.match(/\{/g) ?? []).length
      const closeBraces = (content.match(/\}/g) ?? []).length
      const openParens = (content.match(/\(/g) ?? []).length
      const closeParens = (content.match(/\)/g) ?? []).length
      logger.info(`[DailyDocValidation] TypeScript 括号平衡检查`, {
        file: file.relativePath,
        openBraces,
        closeBraces,
        openParens,
        closeParens,
      })
      if (openBraces !== closeBraces || openParens !== closeParens) {
        logger.info(`[DailyDocValidation] 发现括号/花括号不匹配`, {
          file: file.relativePath,
          openBraces,
          closeBraces,
          openParens,
          closeParens,
        })
        findings.push(
          createFinding(
            'correctness',
            'high',
            'failure',
            file.relativePath,
            '括号/花括号不匹配，可能存在语法错误',
            '请运行 npx tsc --noEmit 进行完整类型检查',
          ),
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.info(`[DailyDocValidation] TypeScript 正确性校验读文件失败`, {
        file: file.relativePath,
        error: message,
      })
      findings.push(
        createFinding(
          'correctness',
          'medium',
          'warning',
          file.relativePath,
          `读取文件进行正确性校验失败: ${message}`,
        ),
      )
    }
  }

  logger.info(`[DailyDocValidation] 正确性验证完成`, {
    scannedCount: docFiles.length + sampleTsFiles.length,
    docFileCount: docFiles.length,
    sampleTsFileCount: sampleTsFiles.length,
    findingCount: findings.length,
  })

  return { name: 'correctness', findings, scannedCount: docFiles.length + sampleTsFiles.length }
}

// ─── 自动更新 ─────────────────────────────────────────────────────────────────

async function runAutoUpdates(
  files: readonly ScannedFile[],
  config: DailyValidationConfig,
): Promise<DocUpdateEntry[]> {
  if (!config.autoUpdate) {
    logger.info(`[DailyDocValidation] 自动更新已禁用，跳过`)
    return []
  }

  logger.info(`[DailyDocValidation] 开始自动更新阶段`)
  const updates: DocUpdateEntry[] = []

  // 1. 同步文档交叉引用
  try {
    const syncResult = await retryWithBackoff(
      () => syncCrossReferences(join(config.rootDir, 'docs'), files),
      config.maxRetries,
      'syncCrossReferences',
    )
    updates.push(...syncResult.updates)
    logger.info(`[DailyDocValidation] 交叉引用同步完成`, {
      updatedCount: syncResult.updates.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[DailyDocValidation] 交叉引用同步失败`, { error: message })
  }

  // 2. 记录版本历史
  try {
    const historyResult = await retryWithBackoff(
      () => recordVersionHistory(config.rootDir, files),
      config.maxRetries,
      'recordVersionHistory',
    )
    updates.push(...historyResult.updates)
    logger.info(`[DailyDocValidation] 版本历史记录完成`, {
      updatedCount: historyResult.updates.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[DailyDocValidation] 版本历史记录失败`, { error: message })
  }

  return updates
}

// ─── 报告生成与持久化 ─────────────────────────────────────────────────────────

export function buildDimensionSummary(
  dimension: ValidationDimension,
  findings: readonly ValidationFinding[],
  scannedCount: number,
): DimensionSummary {
  const dimensionFindings = findings.filter((f) => f.dimension === dimension)
  return {
    dimension,
    scannedCount,
    passCount: Math.max(0, scannedCount - dimensionFindings.length),
    warningCount: dimensionFindings.filter((f) => f.status === 'warning').length,
    failureCount: dimensionFindings.filter((f) => f.status === 'failure').length,
  }
}

export function determineOverallStatus(findings: readonly ValidationFinding[]): ValidationStatus {
  if (findings.some((f) => f.status === 'failure')) return 'failure'
  if (findings.some((f) => f.status === 'warning')) return 'warning'
  return 'pass'
}

function persistReport(report: DailyDocValidationReport): string | null {
  try {
    if (!existsSync(REPORT_DIR)) {
      mkdirSync(REPORT_DIR, { recursive: true })
    }
    const timestamp = report.meta.startedAt.replace(/[:.]/g, '-')
    const filePath = join(REPORT_DIR, `daily-doc-validation-${timestamp}.json`)
    writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8')
    return filePath
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[DailyDocValidation] 持久化报告失败`, { error: message })
    return null
  }
}

// ─── 配置解析 ─────────────────────────────────────────────────────────────────

/** 将 readonly 属性转为可变的可选属性，用于 CLI 参数解析阶段 */
type MutablePartial<T> = {
  -readonly [K in keyof T]?: T[K]
}

function parseCliArgs(): Partial<DailyValidationConfig> & { dryRun: boolean } {
  const args = process.argv.slice(2)
  const result: MutablePartial<DailyValidationConfig> & { dryRun: boolean } = {
    dryRun: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--auto-update') {
      result.autoUpdate = true
    } else if (arg === '--since' && i + 1 < args.length) {
      result.scanSince = new Date(args[i + 1]!).getTime()
      i++
    } else if (arg === '--until' && i + 1 < args.length) {
      result.scanUntil = new Date(args[i + 1]!).getTime()
      i++
    } else if (arg === '--concurrency' && i + 1 < args.length) {
      result.concurrency = Number(args[i + 1])
      i++
    } else if (arg === '--max-retries' && i + 1 < args.length) {
      result.maxRetries = Number(args[i + 1])
      i++
    } else if (arg === '--dry-run') {
      result.dryRun = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return result as Partial<DailyValidationConfig> & { dryRun: boolean }
}

function printHelp(): void {
  console.error(`
Daily Document Validation — 每日文档验证与更新流程

用法:
  npx tsx scripts/daily-doc-validation.ts [选项]

选项:
  --auto-update          启用自动更新（交叉引用同步、版本历史记录）
  --since <ISO-8601>     自定义扫描起始时间
  --until <ISO-8601>     自定义扫描结束时间
  --concurrency <number> 并发限制（默认 ${DEFAULT_CONCURRENCY}）
  --max-retries <number> 最大重试次数（默认 ${DEFAULT_MAX_RETRIES}）
  --dry-run              只生成报告，不写入文件
  --help, -h             显示帮助信息
`)
}

function buildConfig(
  overrides: Partial<DailyValidationConfig> & { dryRun: boolean },
): DailyValidationConfig {
  const now = Date.now()
  const defaultSince = now - 24 * 60 * 60 * 1000
  return {
    rootDir: ROOT,
    scanSince: overrides.scanSince ?? defaultSince,
    scanUntil: overrides.scanUntil ?? now,
    autoUpdate: overrides.autoUpdate ?? false,
    maxRetries: overrides.maxRetries ?? DEFAULT_MAX_RETRIES,
    concurrency: overrides.concurrency ?? DEFAULT_CONCURRENCY,
    outputDir: REPORT_DIR,
  }
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function runDailyValidation(
  config: DailyValidationConfig,
): Promise<DailyDocValidationReport> {
  const startedAt = new Date()
  const runId = generateId()

  logger.info(`[DailyDocValidation] 流程启动`, {
    runId,
    startedAt: formatTimestampSeconds(startedAt),
    scanSince: formatTimestampSeconds(new Date(config.scanSince)),
    scanUntil: formatTimestampSeconds(new Date(config.scanUntil)),
    autoUpdate: config.autoUpdate,
  })

  // 1. 扫描材料（100% 覆盖）
  const scannedFiles = scanMaterials(config)
  logger.info(`[DailyDocValidation] 材料扫描完成`, {
    totalFiles: scannedFiles.length,
    addedCount: scannedFiles.filter((f) => f.updateType === 'added').length,
    modifiedCount: scannedFiles.filter((f) => f.updateType === 'modified').length,
    deletedCount: scannedFiles.filter((f) => f.updateType === 'deleted').length,
  })

  // 2. 三维验证
  const integrityResult = validateIntegrity(scannedFiles)
  const consistencyResult = validateConsistency(scannedFiles)
  const correctnessResult = validateCorrectness(scannedFiles)

  const allFindings: ValidationFinding[] = [
    ...integrityResult.findings,
    ...consistencyResult.findings,
    ...correctnessResult.findings,
  ]

  logger.info(`[DailyDocValidation] 验证阶段汇总`, {
    integrityFindings: integrityResult.findings.length,
    consistencyFindings: consistencyResult.findings.length,
    correctnessFindings: correctnessResult.findings.length,
    totalFindings: allFindings.length,
  })

  // 3. 自动更新
  const updates = await runAutoUpdates(scannedFiles, config)

  // 4. 生成报告
  const finishedAt = new Date()
  const dimensionSummaries: DimensionSummary[] = [
    buildDimensionSummary('integrity', allFindings, integrityResult.scannedCount),
    buildDimensionSummary('consistency', allFindings, consistencyResult.scannedCount),
    buildDimensionSummary('correctness', allFindings, correctnessResult.scannedCount),
  ]

  const report: DailyDocValidationReport = {
    meta: {
      runId,
      startedAt: formatTimestampSeconds(startedAt),
      finishedAt: formatTimestampSeconds(finishedAt),
      rootDir: config.rootDir,
      scanSince: formatTimestampSeconds(new Date(config.scanSince)),
      scanUntil: formatTimestampSeconds(new Date(config.scanUntil)),
    },
    scannedFiles,
    findings: allFindings,
    updates,
    dimensionSummaries,
    summary: {
      totalFiles: scannedFiles.length,
      addedCount: scannedFiles.filter((f) => f.updateType === 'added').length,
      modifiedCount: scannedFiles.filter((f) => f.updateType === 'modified').length,
      deletedCount: scannedFiles.filter((f) => f.updateType === 'deleted').length,
      totalFindings: allFindings.length,
      totalUpdates: updates.length,
      overallStatus: determineOverallStatus(allFindings),
    },
  }

  logger.info(`[DailyDocValidation] 流程完成`, {
    runId,
    finishedAt: formatTimestampSeconds(finishedAt),
    overallStatus: report.summary.overallStatus,
    totalFiles: report.summary.totalFiles,
    totalFindings: report.summary.totalFindings,
    totalUpdates: report.summary.totalUpdates,
  })

  return report
}

export async function main(): Promise<void> {
  const cliArgs = parseCliArgs()
  const config = buildConfig(cliArgs)

  try {
    const report = await retryWithBackoff(
      () => runDailyValidation(config),
      config.maxRetries,
      'runDailyValidation',
    )

    // 输出 JSON 到 stdout
    console.log(JSON.stringify(report, null, 2))

    // 持久化报告
    if (!cliArgs.dryRun) {
      const persistedPath = persistReport(report)
      if (persistedPath) {
        logger.info(`[DailyDocValidation] 报告已持久化`, { path: persistedPath })
      }
    } else {
      logger.info(`[DailyDocValidation] 干运行模式，跳过报告持久化`)
    }

    // 退出码
    const exitCode = report.summary.overallStatus === 'failure' ? 1 : 0
    process.exit(exitCode)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[DailyDocValidation] 流程执行失败`, { error: message })
    console.log(
      JSON.stringify(
        {
          meta: {
            runId: generateId(),
            startedAt: formatTimestampSeconds(new Date()),
            finishedAt: formatTimestampSeconds(new Date()),
            rootDir: config.rootDir,
            scanSince: formatTimestampSeconds(new Date(config.scanSince)),
            scanUntil: formatTimestampSeconds(new Date(config.scanUntil)),
          },
          scannedFiles: [],
          findings: [
            {
              id: generateId(),
              dimension: 'integrity',
              severity: 'critical',
              status: 'failure',
              filePath: 'N/A',
              message: `流程执行失败: ${message}`,
            },
          ],
          updates: [],
          dimensionSummaries: [],
          summary: {
            totalFiles: 0,
            addedCount: 0,
            modifiedCount: 0,
            deletedCount: 0,
            totalFindings: 1,
            totalUpdates: 0,
            overallStatus: 'failure',
          },
        },
        null,
        2,
      ),
    )
    process.exit(2)
  }
}

// 仅在直接运行时执行（避免被 import 时自动运行）
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainModule) {
  void main()
}
