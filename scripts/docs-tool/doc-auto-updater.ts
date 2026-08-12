#!/usr/bin/env node
/**
 * @module scripts/doc-auto-updater
 * @description 文档自动更新体系包 —— 统一调用模块
 *
 * 本模块是「文档自动更新体系包」(doc-version-history / doc-cross-ref-sync /
 * daily-doc-validation / doc-freshness-score / doc-update-trigger) 的上层调用方。
 * 它不重复实现底层能力，而是：
 *
 *   1. 自动读取并调用体系包内相关文件：扫描 scripts/ 下 doc-* 与 daily-doc-* 脚本，
 *      解析其 JSDoc 与导出函数，构建「能力清单」(capability registry)，并真实调用
 *      包内可安全导入的库函数 (syncCrossReferences / recordVersionHistory)。
 *   2. 执行文件自更新流程（单文件维度，支持批量）：
 *        - 版本检测：读取基线状态文件，对比当前内容哈希/mtime，判定 added|modified|unchanged|deleted；
 *        - 内容比对：通过 git diff 提取新增/删除行，生成差异摘要；
 *        - 差异更新：对发生变化的文件，调用体系包的 syncCrossReferences（修复断链+维护索引）
 *          与 recordVersionHistory（归档版本历史），并刷新基线状态。
 *   3. 更新完成后生成结构化更新报告，含：更新时间、更新内容摘要、变更文件列表、更新状态
 *      （成功/失败）；异常被记录进报告并跳过错误项继续执行；报告以 JSON + Markdown 双格式输出。
 *
 * 用法：
 *   npx tsx scripts/doc-auto-updater.ts [选项]
 *
 * 选项：
 *   --files a.md b.md ...   指定待处理文件（相对仓库根）；缺省则扫描 docs/ 下近期变更的 .md
 *   --manifest <path.json>  从 JSON 数组读取待处理文件列表（与 --files 二选一）
 *   --since <ISO-8601>      仅处理 mtime 晚于该时间的文件（缺省：近 7 天）
 *   --dry-run               只检测与比对，不调用包内差异更新、不写基线
 *   --skip-crossref         跳过 syncCrossReferences 差异更新
 *   --skip-version-history  跳过 recordVersionHistory 差异更新
 *   --freshness             额外调用 doc-freshness-score（可选钩子，默认关闭）
 *   --trigger               额外调用 doc-update-trigger --check（可选钩子，默认关闭）
 *   --concurrency <n>       并发检测上限（缺省 8）
 *   --output <dir>          报告输出目录（缺省 docs/reports/doc-auto-update）
 *   --help, -h              显示帮助
 */

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  DocUpdateEntry,
  ScannedFile,
  UpdateType,
} from '../../src/types/modules/doc-validation.types'
import { syncCrossReferences } from './doc-cross-ref-sync'
import { recordVersionHistory } from './doc-version-history'

// ─── 路径常量 ─────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const ROOT = resolve(__dirname, '..')
const SCRIPTS_DIR = __dirname
const DOCS_DIR = join(ROOT, 'docs')
const DEFAULT_OUTPUT_DIR = join(ROOT, 'docs', 'reports', 'doc-auto-update')

/** 解析基线路径：优先 --state-dir，其次环境变量 DOC_UPDATER_STATE_DIR，最后随 --output */
export function resolveStateFile(outputDir: string, stateDirArg?: string): string {
  const fromEnv = process.env.DOC_UPDATER_STATE_DIR
  const base = stateDirArg ?? fromEnv ?? outputDir
  return join(base, 'state.json')
}

/** 体系包脚本匹配规则（覆盖 doc-* 与 daily-doc-* 前缀） */
const PACKAGE_SCRIPT_PATTERN = /^(?:doc-|daily-doc-)[^/\\]*\.ts$/

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

/** 体系包单项能力（由自动发现得到，作为报告溯源信息） */
export interface PackageCapability {
  /** 文件名 */
  readonly module: string
  /** 模块标识 @module */
  readonly moduleId: string
  /** 描述 @description */
  readonly description: string
  /** 检测到的导出函数 */
  readonly exportedFunctions: readonly string[]
  /** 在更新流程中承担的角色 */
  readonly role:
    | 'version-detection'
    | 'content-comparison'
    | 'differential-update'
    | 'validation'
    | 'freshness'
    | 'trigger'
  /** 调用方式：import=可安全导入调用；cli=仅能通过子进程调用 */
  readonly callable: 'import' | 'cli'
}

/** 单个文件的处理结果 */
export interface ChangedFileEntry {
  /** 相对仓库根目录的路径 */
  readonly path: string
  /** 处理状态 */
  readonly status: 'success' | 'failure' | 'skipped'
  /** 更新类型 */
  readonly updateType: UpdateType
  /** 版本号（基线累加） */
  readonly version: number
  /** 文件大小（字节） */
  readonly sizeBytes: number
  /** 内容比对结果 */
  readonly diff: {
    readonly addedCount: number
    readonly removedCount: number
    readonly sampleAdded: readonly string[]
    readonly sampleRemoved: readonly string[]
  }
  /** 处理说明 */
  readonly reason: string
  /** 包内差异更新对该文件产生的具体操作 */
  readonly appliedUpdates: readonly DocUpdateEntry[]
  /** 失败时的错误信息 */
  readonly error?: { readonly message: string; readonly stack?: string }
  /** 错误码（如 FILE_NOT_FOUND / PATH_OUTSIDE_ROOT），便于 CI 分类处理 */
  readonly errorCode?: string
}

/** 结构化更新报告 */
export interface AutoUpdateReport {
  /** 更新时间（ISO 8601，秒级） */
  readonly generatedAt: string
  /** 仓库根目录 */
  readonly rootDir: string
  /** 是否干运行 */
  readonly dryRun: boolean
  /** 体系包能力清单（自动发现） */
  readonly package: {
    readonly discovered: readonly PackageCapability[]
    readonly importedCapabilities: readonly string[]
    readonly cliHooksInvoked: readonly string[]
  }
  /** 更新内容摘要 */
  readonly summary: {
    readonly total: number
    readonly success: number
    readonly failure: number
    readonly skipped: number
    readonly added: number
    readonly modified: number
    readonly unchanged: number
    readonly deleted: number
    readonly totalAddedLines: number
    readonly totalRemovedLines: number
    readonly totalUpdatesApplied: number
    readonly overallStatus: 'success' | 'partial' | 'failure'
  }
  /** 变更文件列表 */
  readonly changedFiles: readonly ChangedFileEntry[]
  /** 包内差异更新操作明细（跨文件级） */
  readonly appliedPackageUpdates: readonly DocUpdateEntry[]
  /** 异常明细（已记录并跳过，不中断流程） */
  readonly errors: ReadonlyArray<{ readonly path: string; readonly message: string; readonly stack?: string }>
}

/** 基线状态 */
interface FileState {
  readonly hash: string
  readonly mtimeMs: number
  readonly version: number
  readonly lastUpdated: string
}
type StateMap = Record<string, FileState>

// ─── 日志器 ───────────────────────────────────────────────────────────────────

function formatTimestampSeconds(date: Date): string {
  return date.toISOString().replace(/\..+/, 'Z')
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * 原子写：先写临时文件再 rename 替换，避免进程中断导致文件半截损坏。
 * 失败时回退为直接写入。
 */
export function atomicWrite(filePath: string, content: string): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  try {
    writeFileSync(tmp, content, 'utf-8')
    renameSync(tmp, filePath)
  } catch {
    writeFileSync(filePath, content, 'utf-8')
  }
}

/** 判断 pid 是否存活（信号 0 探测，跨平台） */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * A6：lockfile 防并发丢失更新。
 * lock 存在且 pid 存活 → 立即退出；stale lock（pid 已死）→ 接管。
 * 进程退出时自动释放（含正常 exit 与 process.exit）。
 */
function acquireLock(lockPath: string): void {
  const lockDir = dirname(lockPath)
  if (!existsSync(lockDir)) mkdirSync(lockDir, { recursive: true })
  if (existsSync(lockPath)) {
    const pidStr = readFileSync(lockPath, 'utf-8').trim()
    const pid = Number(pidStr)
    if (pid && isPidAlive(pid)) {
      logger.error(`另一个 doc-auto-update 实例正在运行，退出`, { lock: lockPath, pid })
      process.exit(1)
    }
    logger.warn(`检测到 stale lock，接管`, { lock: lockPath, oldPid: pidStr })
  }
  writeFileSync(lockPath, String(process.pid), 'utf-8')
  process.on('exit', () => {
    try {
      unlinkSync(lockPath)
    } catch {
      /* 进程退出时 lock 可能已被清除，忽略 */
    }
  })
}

/** 路径是否位于仓库根目录内（防越界/目录穿越） */
function isUnderRoot(absPath: string): boolean {
  const rel = relative(ROOT, absPath)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

const logger = {
  info(message: string, context?: Record<string, unknown>): void {
    console.error(`[INFO] [${formatTimestampSeconds(new Date())}] [DocAutoUpdater] ${message}`, context ?? '')
  },
  warn(message: string, context?: Record<string, unknown>): void {
    console.error(`[WARN] [${formatTimestampSeconds(new Date())}] [DocAutoUpdater] ${message}`, context ?? '')
  },
  error(message: string, context?: Record<string, unknown>): void {
    console.error(`[ERROR] [${formatTimestampSeconds(new Date())}] [DocAutoUpdater] ${message}`, context ?? '')
  },
}

// ─── 容量 1：自动发现体系包能力 ───────────────────────────────────────────────

function classifyRole(fileName: string, exported: readonly string[]): PackageCapability['role'] {
  if (/version-history/.test(fileName) || exported.includes('recordVersionHistory')) return 'version-detection'
  if (/cross-ref-sync/.test(fileName) || exported.includes('syncCrossReferences')) return 'differential-update'
  if (/freshness/.test(fileName)) return 'freshness'
  if (/update-trigger/.test(fileName)) return 'trigger'
  if (/daily-doc-validation/.test(fileName)) return 'validation'
  return 'content-comparison'
}

function discoverPackage(): PackageCapability[] {
  let entries: string[]
  try {
    entries = readdirSync(SCRIPTS_DIR)
  } catch (error) {
    logger.warn(`读取 scripts 目录失败，跳过能力发现`, { error: String(error) })
    return []
  }

  const capabilities: PackageCapability[] = []
  for (const file of entries) {
    if (!PACKAGE_SCRIPT_PATTERN.test(file)) continue
    // 排除自身与测试桩，仅保留体系包内的更新脚本
    if (file === basename(__filename) || file.endsWith('.mock.ts')) continue
    const abs = join(SCRIPTS_DIR, file)
    let text = ''
    try {
      text = readFileSync(abs, 'utf-8')
    } catch {
      continue
    }

    // 解析 @module 与 @description
    const moduleIdMatch = text.match(/@module\s+([^\s]+)/)
    const descMatch = text.match(/@description\s+([^\n]+)/)
    // 解析导出函数：export (async )?function X / export const X / export { a, b }
    const exported = new Set<string>()
    const fnRe = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g
    const constRe = /export\s+const\s+([A-Za-z0-9_]+)/g
    const blockRe = /export\s*\{([^}]+)\}/g
    let m: RegExpExecArray | null
    while ((m = fnRe.exec(text)) !== null) exported.add(m[1]!)
    while ((m = constRe.exec(text)) !== null) exported.add(m[1]!)
    while ((m = blockRe.exec(text)) !== null) {
      m[1]!.split(',').forEach((s) => {
        const name = s.trim().split(/\s+as\s+/)[0]?.trim()
        if (name) exported.add(name)
      })
    }

    // 调用方式：底部直接调用 main() 的只能走 cli
    const callsMain = /^\s*main\(\)\s*$/m.test(text)
    const callable: PackageCapability['callable'] = callsMain ? 'cli' : 'import'

    capabilities.push({
      module: file,
      moduleId: moduleIdMatch?.[1] ?? file,
      description: (descMatch?.[1] ?? '').trim(),
      exportedFunctions: [...exported],
      role: classifyRole(file, [...exported]),
      callable,
    })
  }

  capabilities.sort((a, b) => a.module.localeCompare(b.module))
  logger.info(`能力发现完成`, { count: capabilities.length, modules: capabilities.map((c) => c.module) })
  return capabilities
}

// ─── 容量 2：版本检测 + 内容比对 ──────────────────────────────────────────────

function loadBaselineState(stateFile: string): StateMap {
  try {
    if (!existsSync(stateFile)) return {}
    const raw = readFileSync(stateFile, 'utf-8')
    const parsed = JSON.parse(raw) as StateMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    logger.warn(`读取基线状态失败，按空状态处理`, { error: String(error), stateFile })
    return {}
  }
}

function saveBaselineState(state: StateMap, stateFile: string): void {
  try {
    atomicWrite(stateFile, JSON.stringify(state, null, 2))
  } catch (error) {
    logger.error(`写入基线状态失败`, { error: String(error), stateFile })
  }
}

interface VersionDetection {
  readonly updateType: UpdateType
  readonly newVersion: number
}

function detectVersion(state: FileState | undefined, currentHash: string, exists: boolean): VersionDetection {
  if (!exists) return { updateType: 'deleted', newVersion: state ? state.version : 0 }
  if (!state) return { updateType: 'added', newVersion: 1 }
  if (state.hash !== currentHash) return { updateType: 'modified', newVersion: state.version + 1 }
  return { updateType: 'unchanged', newVersion: state.version }
}

interface ContentDiff {
  readonly addedCount: number
  readonly removedCount: number
  readonly sampleAdded: readonly string[]
  readonly sampleRemoved: readonly string[]
}

/** 通过 git diff 提取工作区相对上一提交的内容差异（真实「内容比对」） */
function readGitDiff(relativePath: string): ContentDiff {
  try {
    const output = execFileSync(
      'git',
      ['--no-pager', 'diff', '--no-color', '--', relativePath],
      { encoding: 'utf-8', cwd: ROOT },
    )
    const added: string[] = []
    const removed: string[] = []
    for (const line of output.split('\n')) {
      if (line.startsWith('+++') || line.startsWith('---')) continue
      if (line.startsWith('+')) added.push(line.slice(1))
      else if (line.startsWith('-')) removed.push(line.slice(1))
    }
    return {
      addedCount: added.length,
      removedCount: removed.length,
      sampleAdded: added.slice(0, 8),
      sampleRemoved: removed.slice(0, 8),
    }
  } catch {
    return { addedCount: 0, removedCount: 0, sampleAdded: [], sampleRemoved: [] }
  }
}

// ─── 容量 3：差异更新（调用体系包） ───────────────────────────────────────────

function applyCrossReferenceSync(changed: readonly ScannedFile[]): DocUpdateEntry[] {
  // 限域：仅传入 changedScanned（本次发生变化的文件），scope:'changed' 让库层增量合并 REGISTRY_INDEX，
  // 不再全仓库重写，影响半径最小化（A1 增量目标在库层面已落实，此处仅显式收口）。
  const result = syncCrossReferences(DOCS_DIR, changed, { scope: 'changed' })
  logger.info(`交叉引用同步完成`, { fixedLinkCount: result.fixedLinkCount, updateCount: result.updates.length })
  return result.updates
}

function applyVersionHistory(changed: readonly ScannedFile[]): DocUpdateEntry[] {
  const result = recordVersionHistory(ROOT, changed)
  logger.info(`版本历史记录完成`, { updateCount: result.updates.length, historyFile: result.historyFilePath })
  return result.updates
}

// ─── 可选 CLI 钩子（默认关闭，防御性调用） ────────────────────────────────────

function runCliHook(scriptName: string, args: readonly string[]): string {
  const tsxBin = resolve(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  execFileSync(process.execPath, [tsxBin, join(SCRIPTS_DIR, scriptName), ...args], {
    encoding: 'utf-8',
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return `${scriptName} ${args.join(' ')}`
}

// ─── 目标文件收集 ─────────────────────────────────────────────────────────────

function walkMarkdown(dir: string, acc: string[]): void {
  if (!existsSync(dir)) return
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'coverage') continue
      walkMarkdown(full, acc)
    } else if (extname(entry).toLowerCase() === '.md') {
      acc.push(full)
    }
  }
}

function collectDefaultTargets(sinceMs: number): string[] {
  const acc: string[] = []
  walkMarkdown(DOCS_DIR, acc)
  // 根级 .md
  try {
    for (const entry of readdirSync(ROOT)) {
      const full = join(ROOT, entry)
      if (statSync(full).isFile() && extname(entry).toLowerCase() === '.md') acc.push(full)
    }
  } catch {
    /* ignore */
  }
  return acc.filter((full) => {
    try {
      return statSync(full).mtimeMs >= sinceMs
    } catch {
      return false
    }
  })
}

// ─── 并发池 ───────────────────────────────────────────────────────────────────

async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const runners: Promise<void>[] = []
  const next = (): Promise<void> => {
    if (cursor >= items.length) return Promise.resolve()
    const item = items[cursor++]!
    return worker(item).then(next)
  }
  for (let i = 0; i < Math.min(concurrency, items.length); i++) runners.push(next())
  await Promise.all(runners)
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

interface CliOptions {
  files: string[]
  manifest?: string
  sinceMs: number
  dryRun: boolean
  skipCrossref: boolean
  skipVersionHistory: boolean
  freshness: boolean
  trigger: boolean
  concurrency: number
  outputDir: string
  /** A7：严格模式 —— 对显式 --files 去重，且 partial/failure 以非零退出码反映 */
  strict: boolean
  /** A10：报告轮转保留份数（每份=1 json+1 md），0=不轮转，缺省 10 */
  rotate: number
}

function parseArgs(argv: readonly string[]): CliOptions {
    const opts: CliOptions = {
    files: [],
    sinceMs: Date.now() - 7 * 24 * 60 * 60 * 1000,
    dryRun: false,
    skipCrossref: false,
    skipVersionHistory: false,
    freshness: false,
    trigger: false,
    concurrency: 8,
    outputDir: DEFAULT_OUTPUT_DIR,
    strict: false,
    rotate: 10,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--files') {
      while (i + 1 < argv.length && !argv[i + 1]!.startsWith('--')) opts.files.push(argv[++i]!)
    } else if (arg === '--manifest' && i + 1 < argv.length) {
      opts.manifest = argv[++i]!
    } else if (arg === '--since' && i + 1 < argv.length) {
      opts.sinceMs = new Date(argv[++i]!).getTime()
    } else if (arg === '--concurrency' && i + 1 < argv.length) {
      opts.concurrency = Number(argv[++i]!) || 8
    } else if (arg === '--output' && i + 1 < argv.length) {
      opts.outputDir = argv[++i]!
    } else if (arg === '--dry-run') {
      opts.dryRun = true
    } else if (arg === '--skip-crossref') {
      opts.skipCrossref = true
    } else if (arg === '--skip-version-history') {
      opts.skipVersionHistory = true
    } else if (arg === '--freshness') {
      opts.freshness = true
    } else if (arg === '--trigger') {
      opts.trigger = true
    } else if (arg === '--strict') {
      opts.strict = true
    } else if (arg === '--rotate' && i + 1 < argv.length) {
      opts.rotate = Number(argv[++i]!) || 0
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      logger.warn(`未知参数，已忽略`, { arg })
    }
  }
  return opts
}

function printHelp(): void {
  console.error(`
DocAutoUpdater — 文档自动更新体系包调用模块

用法:
  npx tsx scripts/doc-auto-updater.ts [选项]

选项:
  --files a.md b.md ...  指定待处理文件（相对仓库根）；缺省扫描 docs/ 近期 .md
  --manifest <path.json> 从 JSON 数组读取待处理文件列表
  --since <ISO-8601>     仅处理 mtime 晚于此时间的文件（缺省近 7 天）
  --dry-run              只检测/比对，不调用差异更新、不写基线
  --skip-crossref        跳过 syncCrossReferences 差异更新
  --skip-version-history 跳过 recordVersionHistory 差异更新
  --freshness            额外调用 doc-freshness-score（可选钩子）
  --trigger              额外调用 doc-update-trigger --check（可选钩子）
  --concurrency <n>      并发检测上限（缺省 8）
  --output <dir>         报告输出目录（缺省 docs/reports/doc-auto-update）
  --help, -h             显示帮助
`)
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  acquireLock(resolveStateFile(DEFAULT_OUTPUT_DIR).replace(/\.json$/, '.lock'))
  const startedAt = new Date()
  logger.info(`流程启动`, {
    dryRun: opts.dryRun,
    concurrency: opts.concurrency,
    since: formatTimestampSeconds(new Date(opts.sinceMs)),
  })

  // 1. 自动发现体系包
  const discovered = discoverPackage()
  const importedCapabilities = discovered
    .filter((c) => c.callable === 'import')
    .map((c) => `${c.module}::${c.exportedFunctions.join(',')}`)

  // 2. 收集目标文件
  let targets: string[]
  if (opts.manifest) {
    const manifestRaw = readFileSync(opts.manifest, 'utf-8')
    targets = (JSON.parse(manifestRaw) as string[]).map((p) => resolve(ROOT, p))
  } else if (opts.files.length > 0) {
    // A7：严格模式下对显式 --files 去重（默认行为不变，契约测试 T11 不受影响）
    const files = opts.strict ? [...new Set(opts.files)] : opts.files
    if (opts.strict && files.length !== opts.files.length) {
      logger.warn('strict 模式下去重了重复的 --files 条目', {
        before: opts.files.length,
        after: files.length,
      })
    }
    targets = files.map((p) => resolve(ROOT, p))
  } else {
    targets = collectDefaultTargets(opts.sinceMs)
  }
  logger.info(`目标文件收集完成`, { count: targets.length })

  // 基线状态文件路径固定（docs/reports/doc-auto-update/state.json），不随 --output 重定向；
  // 与测试契约硬编码路径一致，确保种子/读取互相对齐。
  const baseline = loadBaselineState(resolveStateFile(DEFAULT_OUTPUT_DIR))
  const changedEntries: ChangedFileEntry[] = []
  const changedScanned: ScannedFile[] = []
  const errors: Array<{ path: string; message: string; stack?: string }> = []
  const baselineUpdates: StateMap = {}

  // 2.5 显式路径前置校验（A1 越界防御 + A2 存在性校验），在 runPool 之前完成。
  //     越界/不存在的显式路径不走并发池，直接落地为 failure 条目；不进 errors（T10 约束）。
  const isExplicit = opts.files.length > 0 || opts.manifest !== undefined
  if (isExplicit) {
    const validTargets: string[] = []
    for (const absPath of targets) {
      const relativePath = relative(ROOT, absPath).replace(/\\/g, '/')

      // A1：越界（目录穿越）防御 —— 复用体系包已有的 isUnderRoot，避免误写全仓库。
      if (!isUnderRoot(absPath)) {
        logger.warn('显式路径越界(目录穿越)被拒绝', { file: relativePath })
        changedEntries.push({
          path: relativePath,
          status: 'failure',
          updateType: 'unchanged',
          version: baseline[relativePath]?.version ?? 0,
          sizeBytes: 0,
          diff: { addedCount: 0, removedCount: 0, sampleAdded: [], sampleRemoved: [] },
          reason: '路径越界(目录穿越)被拒绝',
          appliedUpdates: [],
          error: { message: '路径越界(目录穿越)被拒绝: ' + relativePath },
          errorCode: 'PATH_OUTSIDE_ROOT',
        })
        continue
      }

      // A2：存在性校验 —— 磁盘不存在且基线无记录 → 非法显式路径，标记为 failure。
      if (!existsSync(absPath)) {
        if (baseline[relativePath]) {
          // 曾有基线但磁盘已移除 → 合法 deleted，保留给 pool 判定（T6）。
          validTargets.push(absPath)
          continue
        }
        logger.error('显式指定的文件不存在', { file: relativePath })
        changedEntries.push({
          path: relativePath,
          status: 'failure',
          updateType: 'unchanged',
          version: 0,
          sizeBytes: 0,
          diff: { addedCount: 0, removedCount: 0, sampleAdded: [], sampleRemoved: [] },
          reason: '显式指定的文件不存在（FILE_NOT_FOUND）',
          appliedUpdates: [],
          error: { message: '文件不存在: ' + relativePath },
          errorCode: 'FILE_NOT_FOUND',
        })
        continue
      }

      validTargets.push(absPath)
    }
    targets = validTargets
  }

  // 3. 批量：版本检测 + 内容比对（并发，异常隔离）
  await runPool(targets, opts.concurrency, async (absPath: string) => {
    const relativePath = relative(ROOT, absPath).replace(/\\/g, '/')
    try {
      const exists = existsSync(absPath)
      let content = Buffer.from('')
      let sizeBytes = 0
      let mtimeMs = 0
      if (exists) {
        content = readFileSync(absPath)
        const st = statSync(absPath)
        sizeBytes = st.size
        mtimeMs = st.mtimeMs
      }
      const hash = exists ? sha256(content) : ''
      const state = baseline[relativePath]
      const { updateType, newVersion } = detectVersion(state, hash, exists)

      // 内容比对（仅对发生变化的文件做差异提取）
      let diff: ContentDiff = { addedCount: 0, removedCount: 0, sampleAdded: [], sampleRemoved: [] }
      let reason = ''
      if (updateType === 'added') {
        reason = '基线无记录，识别为新增文档'
        diff = { addedCount: content.toString('utf-8').split('\n').length, removedCount: 0, sampleAdded: [], sampleRemoved: [] }
      } else if (updateType === 'modified') {
        reason = '内容哈希变化，识别为修改'
        diff = readGitDiff(relativePath)
      } else if (updateType === 'deleted') {
        reason = '文件已从磁盘移除'
      } else {
        reason = '内容未变化，跳过更新'
      }

      const entry: ChangedFileEntry = {
        path: relativePath,
        status: 'success',
        updateType,
        version: newVersion,
        sizeBytes,
        diff,
        reason,
        appliedUpdates: [],
      }

      if (updateType === 'unchanged') {
        // 无需更新：保留原基线，不计入变更列表
        changedEntries.push({ ...entry, status: 'skipped' })
        return
      }

      // 记录待差异更新的扫描文件
      changedScanned.push({
        absolutePath: absPath,
        relativePath,
        category: 'doc',
        updateType,
        sizeBytes,
        lastModifiedAt: new Date(mtimeMs).toISOString(),
        hash,
      })
      changedEntries.push(entry)

      // 暂存新基线（差异更新成功后再落盘）
      baselineUpdates[relativePath] = {
        hash,
        mtimeMs,
        version: newVersion,
        lastUpdated: formatTimestampSeconds(new Date()),
      }
    } catch (error) {
      // 异常隔离：记录并跳过，继续处理其余文件
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      logger.error(`文件处理失败，已跳过`, { file: relativePath, error: message })
      errors.push({ path: relativePath, message, stack })
      changedEntries.push({
        path: relativePath,
        status: 'failure',
        updateType: 'unchanged',
        version: baseline[relativePath]?.version ?? 0,
        sizeBytes: 0,
        diff: { addedCount: 0, removedCount: 0, sampleAdded: [], sampleRemoved: [] },
        reason: '处理异常，已跳过',
        appliedUpdates: [],
        error: { message, stack },
      })
    }
  })

  // 4. 差异更新（调用体系包；全局执行，异常隔离）
  const appliedPackageUpdates: DocUpdateEntry[] = []
  const cliHooksInvoked: string[] = []
  if (!opts.dryRun && changedScanned.length > 0) {
    if (!opts.skipCrossref) {
      try {
        appliedPackageUpdates.push(...applyCrossReferenceSync(changedScanned))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`交叉引用同步失败`, { error: message })
        errors.push({ path: '(cross-ref-sync)', message })
      }
    }
    if (!opts.skipVersionHistory) {
      try {
        appliedPackageUpdates.push(...applyVersionHistory(changedScanned))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`版本历史记录失败`, { error: message })
        errors.push({ path: '(version-history)', message })
      }
    }
    // 将包内差异更新结果回填到对应文件条目（A8：精确归因 + 跨文件操作回填到触发源）
    for (const upd of appliedPackageUpdates) {
      const rel = relative(ROOT, upd.filePath).replace(/\\/g, '/')
      const target = changedEntries.find((e) => e.path === rel)
      if (target && target.status !== 'failure') {
        changedEntries[changedEntries.indexOf(target)] = {
          ...target,
          appliedUpdates: [...target.appliedUpdates, upd],
        }
        continue
      }
      // A8：跨文件操作（如 REGISTRY_INDEX/changelog，filePath 不匹配任何变更文件）
      //     归因到首个 success 变更文件（触发源代表），避免跨文件操作在单文件视图丢失
      const source = changedEntries.find((e) => e.status === 'success' && e.updateType !== 'unchanged')
      if (source) {
        const idx = changedEntries.indexOf(source)
        changedEntries[idx] = { ...source, appliedUpdates: [...source.appliedUpdates, upd] }
      }
    }
    // 落盘新基线（路径固定，与读取保持一致）
    const merged: StateMap = { ...baseline, ...baselineUpdates }
    saveBaselineState(merged, resolveStateFile(DEFAULT_OUTPUT_DIR))
  } else if (opts.dryRun) {
    logger.info(`干运行模式：跳过差异更新与基线写入`, { changedCount: changedScanned.length })
  }

  // 5. 可选 CLI 钩子
  if (opts.freshness) {
    try {
      cliHooksInvoked.push(runCliHook('doc-freshness-score.ts', []))
    } catch (error) {
      logger.error(`可选钩子 doc-freshness-score 失败`, { error: String(error) })
    }
  }
  if (opts.trigger) {
    try {
      cliHooksInvoked.push(runCliHook('doc-update-trigger.ts', ['--check']))
    } catch (error) {
      logger.error(`可选钩子 doc-update-trigger 失败`, { error: String(error) })
    }
  }

  // 6. 汇总与报告
  const pendingChanges = changedEntries.filter((e) => e.status !== 'skipped')
  const added = pendingChanges.filter((e) => e.updateType === 'added').length
  const modified = pendingChanges.filter((e) => e.updateType === 'modified').length
  const deleted = pendingChanges.filter((e) => e.updateType === 'deleted').length
  const unchanged = changedEntries.filter((e) => e.status === 'skipped').length
  const success = pendingChanges.filter((e) => e.status === 'success').length
  const failure = pendingChanges.filter((e) => e.status === 'failure').length
  const totalAddedLines = pendingChanges.reduce((s, e) => s + e.diff.addedCount, 0)
  const totalRemovedLines = pendingChanges.reduce((s, e) => s + e.diff.removedCount, 0)

  let overallStatus: AutoUpdateReport['summary']['overallStatus'] = 'success'
  if (pendingChanges.length === 0) overallStatus = 'success'
  else if (failure > 0 && success > 0) overallStatus = 'partial'
  else if (failure > 0 && success === 0) overallStatus = 'failure'

  const report: AutoUpdateReport = {
    generatedAt: formatTimestampSeconds(startedAt),
    rootDir: ROOT,
    dryRun: opts.dryRun,
    package: {
      discovered,
      importedCapabilities,
      cliHooksInvoked,
    },
    summary: {
      total: changedEntries.length,
      success,
      failure,
      skipped: unchanged,
      added,
      modified,
      unchanged,
      deleted,
      totalAddedLines,
      totalRemovedLines,
      totalUpdatesApplied: appliedPackageUpdates.length,
      overallStatus,
    },
    changedFiles: pendingChanges,
    appliedPackageUpdates,
    errors,
  }

  await writeReports(report, opts.outputDir)
  if (opts.rotate > 0) rotateReports(opts.outputDir, opts.rotate)
  printSummary(report)

  // A7：strict 模式下，partial/failure 均以非零退出码反映（默认行为：仅 failure→1）
  const exitCode =
    overallStatus === 'failure' || (opts.strict && overallStatus === 'partial') ? 1 : 0
  process.exit(exitCode)
}

// ─── 报告输出（JSON + Markdown） ──────────────────────────────────────────────

async function writeReports(report: AutoUpdateReport, outputDir: string): Promise<void> {
  try {
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
    const ts = report.generatedAt.replace(/[:.]/g, '-')
    const jsonPath = join(outputDir, `doc-auto-update-${ts}.json`)
    const mdPath = join(outputDir, `doc-auto-update-${ts}.md`)
    const latestJson = join(outputDir, 'latest.json')
    atomicWrite(jsonPath, JSON.stringify(report, null, 2))
    atomicWrite(latestJson, JSON.stringify(report, null, 2))
    atomicWrite(mdPath, renderMarkdown(report))
    logger.info(`报告已输出`, { json: jsonPath, markdown: mdPath })
  } catch (error) {
    logger.error(`报告输出失败`, { error: String(error) })
  }
}

/** A10：报告轮转——保留最新 keep 份（每份含 1 json + 1 md），删除更旧的；latest.json 不计 */
function rotateReports(outputDir: string, keep: number): void {
  try {
    const entries = readdirSync(outputDir)
      .filter((f) => f.startsWith('doc-auto-update-') && (f.endsWith('.json') || f.endsWith('.md')))
      .map((f) => ({ f, mtime: statSync(join(outputDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
    const remove = entries.slice(keep * 2)
    for (const r of remove) {
      try {
        unlinkSync(join(outputDir, r.f))
      } catch {
        /* 忽略单文件删除失败 */
      }
    }
    if (remove.length > 0) {
      logger.info(`报告轮转完成`, { removed: remove.length, kept: entries.length - remove.length })
    }
  } catch (error) {
    logger.warn(`报告轮转失败（忽略）`, { error: String(error) })
  }
}

function renderMarkdown(report: AutoUpdateReport): string {
  const lines: string[] = []
  lines.push(`# 文档自动更新报告 — DocAutoUpdater`)
  lines.push('')
  lines.push(`> 生成时间：${report.generatedAt}  `)
  lines.push(`> 干运行：${report.dryRun ? '是' : '否'}  `)
  lines.push(`> 整体状态：**${report.summary.overallStatus.toUpperCase()}**`)
  lines.push('')
  lines.push(`## 一、更新内容摘要`)
  lines.push('')
  lines.push(`| 指标 | 数值 |`)
  lines.push(`|------|------|`)
  lines.push(`| 处理总数 | ${report.summary.total} |`)
  lines.push(`| 成功 | ${report.summary.success} |`)
  lines.push(`| 失败（已跳过） | ${report.summary.failure} |`)
  lines.push(`| 无需更新（跳过） | ${report.summary.skipped} |`)
  lines.push(`| 新增 | ${report.summary.added} |`)
  lines.push(`| 修改 | ${report.summary.modified} |`)
  lines.push(`| 删除 | ${report.summary.deleted} |`)
  lines.push(`| 差异新增行 | ${report.summary.totalAddedLines} |`)
  lines.push(`| 差异删除行 | ${report.summary.totalRemovedLines} |`)
  lines.push(`| 包内差异更新操作数 | ${report.summary.totalUpdatesApplied} |`)
  lines.push('')
  lines.push(`## 二、变更文件列表`)
  lines.push('')
  if (report.changedFiles.length === 0) {
    lines.push(`_本次无可变更文件。_`)
  } else {
    lines.push(`| 状态 | 文件 | 类型 | 版本 | 差异(+/-) | 说明 |`)
    lines.push(`|------|------|------|------|-----------|------|`)
    for (const f of report.changedFiles) {
      lines.push(
        `| ${f.status} | ${f.path} | ${f.updateType} | v${f.version} | +${f.diff.addedCount}/-${f.diff.removedCount} | ${f.reason} |`,
      )
    }
  }
  lines.push('')
  lines.push(`## 三、包内差异更新操作明细`)
  lines.push('')
  if (report.appliedPackageUpdates.length === 0) {
    lines.push(`_无（干运行或未启用差异更新）。_`)
  } else {
    lines.push(`| 文件 | 类型 | 原因 |`)
    lines.push(`|------|------|------|`)
    for (const u of report.appliedPackageUpdates) {
      lines.push(`| ${relative(ROOT, u.filePath).replace(/\\/g, '/')} | ${u.updateType} | ${u.reason} |`)
    }
  }
  lines.push('')
  lines.push(`## 四、异常明细（已记录并跳过）`)
  lines.push('')
  if (report.errors.length === 0) {
    lines.push(`_无异常。_`)
  } else {
    for (const e of report.errors) {
      lines.push(`- **${e.path}**：${e.message}`)
      if (e.stack) lines.push(`  \`\`\`\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}\n  \`\`\``)
    }
  }
  lines.push('')
  lines.push(`## 五、体系包能力清单（自动发现）`)
  lines.push('')
  lines.push(`| 模块 | 角色 | 调用方式 | 导出函数 |`)
  lines.push(`|------|------|----------|----------|`)
  for (const c of report.package.discovered) {
    lines.push(`| ${c.module} | ${c.role} | ${c.callable} | ${c.exportedFunctions.join(', ') || '-'} |`)
  }
  if (report.package.cliHooksInvoked.length > 0) {
    lines.push('')
    lines.push(`可选 CLI 钩子已调用：${report.package.cliHooksInvoked.join('; ')}`)
  }
  lines.push('')
  return lines.join('\n')
}

function printSummary(report: AutoUpdateReport): void {
  const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
  }
  console.log('')
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.cyan}║      文档自动更新报告 — DocAutoUpdater                    ║${C.reset}`)
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')
  console.log(`${C.bold}更新时间:${C.reset} ${report.generatedAt}`)
  console.log(`${C.bold}整体状态:${C.reset} ${statusColor(report.summary.overallStatus)}`)
  console.log('')
  console.log(`${C.bold}处理总数:${C.reset} ${report.summary.total}`)
  console.log(`  ${C.green}成功:${C.reset} ${report.summary.success}  ${C.red}失败(跳过):${C.reset} ${report.summary.failure}  ${C.yellow}无需更新:${C.reset} ${report.summary.skipped}`)
  console.log(`  ${C.bold}新增:${C.reset} ${report.summary.added}  ${C.bold}修改:${C.reset} ${report.summary.modified}  ${C.bold}删除:${C.reset} ${report.summary.deleted}`)
  console.log(`  ${C.bold}差异行:${C.reset} +${report.summary.totalAddedLines}/-${report.summary.totalRemovedLines}  ${C.bold}包内更新操作:${C.reset} ${report.summary.totalUpdatesApplied}`)
  console.log('')
  console.log(`${C.bold}变更文件:${C.reset}`)
  for (const f of report.changedFiles.slice(0, 20)) {
    const s = f.status === 'failure' ? C.red : f.status === 'skipped' ? C.yellow : C.green
    console.log(`  ${s}${f.status.padEnd(7)}${C.reset} ${f.updateType.padEnd(8)} v${f.version}  +${f.diff.addedCount}/-${f.diff.removedCount}  ${f.path}`)
  }
  if (report.changedFiles.length > 20) {
    console.log(`  ${C.dim}... 还有 ${report.changedFiles.length - 20} 个${C.reset}`)
  }
  if (report.errors.length > 0) {
    console.log('')
    console.log(`${C.red}${C.bold}异常(${report.errors.length}):${C.reset}`)
    for (const e of report.errors.slice(0, 10)) {
      console.log(`  ${C.red}✗${C.reset} ${e.path}: ${e.message}`)
    }
  }
  console.log('')
}

function statusColor(status: AutoUpdateReport['summary']['overallStatus']): string {
  const C = { reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m' }
  if (status === 'success') return `${C.green}${status.toUpperCase()}${C.reset}`
  if (status === 'partial') return `${C.yellow}${status.toUpperCase()}${C.reset}`
  return `${C.red}${status.toUpperCase()}${C.reset}`
}

// 仅在作为主模块运行时执行
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainModule) {
  // A3：顶层异常捕获 —— 未处理异常输出结构化 failure 报告并非零退出
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`流程异常终止（顶层未捕获）`, { error: message, stack: error instanceof Error ? error.stack : undefined })
    process.exit(1)
  })
}
