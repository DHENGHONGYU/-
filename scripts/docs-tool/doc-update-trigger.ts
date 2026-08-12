#!/usr/bin/env node
/**
 * @module scripts/doc-update-trigger
 * @description 文档自动更新触发器 — 监控代码变更并按「触发-动作映射表」生成/更新对应文档
 *
 * 触发器类型（与 docs/00-meta/doc-trigger-action-map.md §二 一一对应）：
 * - T1 类型定义变更 → 数据字典
 * - T2 接口变更 → API 契约
 * - T3 架构调整 → 架构标准
 * - T4 配置参数变更 → 引擎规格
 * - T5 Store 状态管理变更 → 状态管理
 * - T6 UI 组件变更 → 组件指南
 * - T7 Hook 自定义变更 → Hook 指南
 * - T8 页面组件变更 → 页面结构
 * - T9 Widget 注册表变更 → 驾驶舱数据定义
 * - T10 版本发布 → frontmatter code_version 同步（对接 doc:version-check）
 * - T11 Mock 模块安全 → 映射表 + AGENTS.md §7.3
 * - T12 ESLint/门禁变更 → AGENTS.md §三 + §七
 * - T13 ACL 权限矩阵变更 → doc-trigger-action-map.md §二（映射表定义，本文件未实现运行时规则，故股票字典规则顺延 T14）
 * - T14 股票字典生成/校验 → 股票字典生成参考文档（docs/reference/stock-dictionary-generation.md）
 *
 * 用法：
 *   npx tsx scripts/doc-update-trigger.ts [选项]
 *
 * 选项：
 *   --check            仅检查，不生成更新建议
 *   --auto-update      按映射表自动生成/更新对应文档（内容生成为扩展点）
 *   --since <ref>      git diff 起点（缺省 HEAD~1）
 *   --base-ref <ref>   git diff 基线 ref（与 --since 互斥）
 *   --files <a,b,...>  显式指定变更文件（覆盖 git diff，可重复）
 *   --dry-run          仅模拟，不写盘、不跑 audit
 *   --strict           任意失败/跳过以非零退出
 *   --help, -h         显示帮助
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { safeWriteFileSync } from '../../src/lib/safeFs'

// ─── 常量 ────────────────────────────────────────────────────────────────────

const ROOT = process.cwd()

// ANSI 颜色码
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const

// ─── 触发器规则 ───────────────────────────────────────────────────────────────

interface TriggerRule {
  readonly id: string
  readonly name: string
  readonly patterns: readonly string[]
  readonly docsToUpdate: readonly string[]
  readonly description: string
  /** 写完后是否触发 npm run audit:docs（映射表「是否触发 audit:docs」列） */
  readonly auditDocs: boolean
}

/**
 * 触发规则权威集（单一事实源：docs/00-meta/doc-trigger-action-map.md §二）。
 * docsToUpdate 路径已对齐 Diátaxis 新结构（2026-07-14 pr-6 重组后修订），
 * 新增/改动须同步映射表。
 */
export const TRIGGER_RULES: readonly TriggerRule[] = [
  {
    id: 'T1',
    name: '类型定义变更',
    patterns: [
      'src/data/types.ts',
      'src/types/modules/*.ts',
      'src/services/scoring/v6-engine/types.ts',
      'src/showcase/types.ts',
    ],
    docsToUpdate: [
      'docs/reference/data-dictionary-index.md',
      'docs/reference/v9核心数据字典与类型定义(整合版).md',
      'docs/reference/cockpit/data-definition.md',
      'docs/explanation/news-data-definition.md',
      'docs/guides/team-handbook/04-model-runtime.md',
    ],
    description: '类型定义变更时，需更新数据字典文档',
    auditDocs: true,
  },
  {
    id: 'T2',
    name: '接口变更',
    patterns: [
      'src/services/**/index.ts',
      'src/core/databridge.ts',
      'src/data/dataLayer.ts',
      'src/services/fetcher/**',
      'src/services/analysis/**',
    ],
    docsToUpdate: [
      'docs/reference/api-contract.md',
      'docs/reference/databridge端点与数据映射清单.md',
      'docs/reference/功能模块数据契约.md',
      'docs/guides/team-handbook/02-architecture.md',
      'docs/guides/team-handbook/04-model-runtime.md',
    ],
    description: '接口签名变更时，需更新 API 契约文档',
    auditDocs: true,
  },
  {
    id: 'T3',
    name: '架构调整',
    patterns: [
      'src/config/routes.ts',
      'src/config/dbConfig.ts',
      'AGENTS.md',
      'src/config/thresholds.ts',
    ],
    docsToUpdate: [
      'docs/explanation/03-architecture-standards.md',
      'docs/explanation/06-routing-specs.md',
      'docs/explanation/system-architecture.md',
      'docs/guides/team-handbook/02-architecture.md',
    ],
    description: '架构调整时，需更新架构标准文档',
    auditDocs: true,
  },
  {
    id: 'T4',
    name: '配置参数变更',
    patterns: [
      'src/constants/*.ts',
      'src/config/thresholds.ts',
      'src/services/scoring/v6-engine/config.ts',
    ],
    docsToUpdate: [
      'docs/reference/05-engine-specs.md',
      'docs/reference/09-quality-gates.md',
      'docs/guides/team-handbook/04-model-runtime.md',
    ],
    description: '配置参数变更时，需更新引擎规格文档',
    auditDocs: true,
  },
  {
    id: 'T5',
    name: 'Store 状态管理变更',
    patterns: ['src/store/**/*.ts'],
    docsToUpdate: [
      'docs/explanation/state-management.md',
      'docs/reference/data-flow-spec.md',
      'docs/guides/team-handbook/02-architecture.md',
    ],
    description: '状态管理变更时，需更新状态管理文档和数据流说明',
    auditDocs: true,
  },
  {
    id: 'T6',
    name: 'UI 组件变更',
    patterns: ['src/components/**/*.tsx', 'src/components/**/*.ts'],
    docsToUpdate: [
      'docs/explanation/design/component-specs.md',
      'docs/explanation/design/component-library-guide.md',
      'docs/explanation/design/ui-design-system.md',
      'docs/guides/team-handbook/03-ui-components.md',
    ],
    description: 'UI 组件变更时，需更新组件文档和设计规范',
    auditDocs: true,
  },
  {
    id: 'T7',
    name: 'Hook 自定义变更',
    patterns: ['src/hooks/**/*.ts', 'src/hooks/**/*.tsx'],
    docsToUpdate: [
      'docs/how-to/hooks-guide.md',
      'docs/reference/data-flow-spec.md',
      'docs/guides/team-handbook/03-ui-components.md',
    ],
    description: '自定义 Hook 变更时，需更新 Hook 使用指南和数据流说明',
    auditDocs: true,
  },
  {
    id: 'T8',
    name: '页面组件变更',
    patterns: ['src/pages/**/*.tsx', 'src/pages/**/*.ts'],
    docsToUpdate: [
      'docs/explanation/06-routing-specs.md',
      'docs/explanation/page-structure.md',
      'docs/guides/team-handbook/02-architecture.md',
    ],
    description: '页面组件变更时，需更新路由规格和页面结构文档',
    auditDocs: true,
  },
  {
    id: 'T9',
    name: 'Widget 注册表变更',
    patterns: ['src/cockpit/core/widgetRegistry.ts'],
    docsToUpdate: [
      'docs/reference/cockpit/data-definition.md',
      'docs/00-meta/registry-index.md',
      'docs/guides/team-handbook/03-ui-components.md',
    ],
    description: 'Widget 注册表结构变更时，需重写驾驶舱数据定义并增量维护注册索引',
    auditDocs: true,
  },
  {
    id: 'T10',
    name: '版本发布',
    patterns: ['package.json'],
    docsToUpdate: [],
    description: 'package.json version 变更时，同步全仓 frontmatter code_version（对接 doc:version-check）',
    auditDocs: false,
  },
  {
    id: 'T11',
    name: 'Mock 模块安全',
    patterns: ['scripts/audit/audit-mock-modules.ts', 'tests/**/*.test.ts'],
    docsToUpdate: ['docs/00-meta/doc-trigger-action-map.md'],
    description: 'Mock 审计脚本变更或新增全量 mock 时，更新映射表 + AGENTS.md §7.3',
    auditDocs: false,
  },
  {
    id: 'T12',
    name: 'ESLint/门禁变更',
    patterns: ['eslint.config.js', 'eslint-rules/*.js', 'scripts/quality/*.js'],
    docsToUpdate: [],
    description: 'ESLint 规则或 npm scripts 段变更时，更新 AGENTS.md §三 类型安全 + §七 验证命令',
    auditDocs: false,
  },
  // 注：T13 已分配给「ACL 权限矩阵变更」（见 doc-trigger-action-map.md §二 与 AGENTS.md §七），
  // 本文件未实现 T13 运行时规则，故股票字典生成/校验规则顺延为 T14，避免 id 冲突。
  {
    id: 'T14',
    name: '股票字典生成/校验',
    patterns: [
      'scripts/generate-stock-dict.py',
      'scripts/verify-stock-dict.py',
      'src/services/stock/stockDictionary.ts',
    ],
    docsToUpdate: [
      'docs/reference/stock-dictionary-generation.md',
      'docs/00-meta/doc-trigger-action-map.md',
    ],
    description: '股票字典生成/校验脚本或字典源文件变更时，更新「股票字典生成」参考文档（数据源=akshare、受管 venv python、四交易所 8331 条、单一事实源、每周自动刷新）',
    auditDocs: true,
  },
]

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/** 获取 git 变更文件列表（相对仓库根） */
function getChangedFiles(ref = 'HEAD~1'): string[] {
  try {
    const output = execSync(`git diff --name-only ${ref} HEAD`, {
      encoding: 'utf-8',
      cwd: ROOT,
    })
    return output.split('\n').filter((line) => line.trim().length > 0)
  } catch {
    console.warn(`${C.yellow}⚠️  无法获取 git diff（ref=${ref}），尝试扫描全部 src 文件${C.reset}`)
    return []
  }
}

/** 将单段 glob 转为正则片段：双星后跟斜杠=零或多个目录段，单星=非斜杠单段 */
function globToRegex(pattern: string): string {
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        i++
        if (pattern[i + 1] === '/') {
          re += '(?:[^/]+/)*'
          i++
        } else {
          re += '.*'
        }
      } else {
        re += '[^/]*'
      }
    } else if ('.+?^${}()|[]\\'.includes(ch)) {
      re += '\\' + ch
    } else {
      re += ch
    }
  }
  return re
}

/** 通配符匹配：单星=非斜杠单段，双星=跨段；store 目录（含子目录）下所有 .ts 均可命中 */
function matchPattern(filePath: string, pattern: string): boolean {
  return new RegExp('^' + globToRegex(pattern) + '$').test(filePath)
}

/** 按规则匹配变更文件，返回「规则 → 命中文件」映射 */
function findTriggeredRules(changedFiles: readonly string[]): Map<TriggerRule, string[]> {
  const triggered = new Map<TriggerRule, string[]>()
  for (const rule of TRIGGER_RULES) {
    const matchedFiles: string[] = []
    for (const file of changedFiles) {
      for (const pattern of rule.patterns) {
        if (matchPattern(file, pattern)) {
          matchedFiles.push(file)
          break
        }
      }
    }
    if (matchedFiles.length > 0) {
      triggered.set(rule, matchedFiles)
    }
  }
  return triggered
}

/** 检查目标文档是否存在 */
function checkDocExists(docPath: string): boolean {
  try {
    statSync(join(ROOT, docPath))
    return true
  } catch {
    return false
  }
}

// ─── 自动更新：接口与扩展点 ───────────────────────────────────────────────────

/** 单个文档的生成上下文 */
interface GenerateContext {
  readonly docPath: string
  readonly rule: TriggerRule
  readonly matchedFiles: readonly string[]
  readonly dryRun: boolean
  readonly root: string
}

/** 单个文档的生成结果 */
interface GenerateResult {
  readonly docPath: string
  readonly status: 'updated' | 'created' | 'skipped' | 'failed'
  readonly detail: string
  readonly errorCode?: 'FILE_NOT_FOUND' | 'PATH_OUTSIDE_ROOT' | 'IO' | 'TRANSIENT'
  readonly needsAudit: boolean
}

/**
 * 文档生成器接口（扩展点）。
 *
 * 后续完整实现可注入「按触发类型生成正文内容」的生成器；
 * 当前内置：
 * - {@link versionCheckGenerator}：T10 版本发布 → 运行 `doc:version-check`（对接现有模块）
 * - {@link defaultDocGenerator}：兜底 → 缺失则建骨架、存在则幂等刷新校验标记
 */
interface DocGenerator {
  readonly id: string
  canHandle(ctx: GenerateContext): boolean
  generate(ctx: GenerateContext): GenerateResult
}

/** 判断绝对路径是否位于仓库根之内（防目录穿越） */
function isUnderRoot(absPath: string, root: string): boolean {
  const rel = relative(root, absPath)
  return rel !== '' && !rel.startsWith('..')
}

/** 渲染缺失文档的最小骨架（blockquote 风格，与 02-design 一致） */
function renderScaffold(ctx: GenerateContext): string {
  const name = basename(ctx.docPath, '.md')
  const date = new Date().toISOString().slice(0, 10)
  return [
    `# ${name}`,
    '',
    `> **Status**: Auto-scaffold`,
    `> **Last Updated**: ${date}`,
    `> **Triggered by**: ${ctx.rule.id} ${ctx.rule.name}`,
    '',
    `> 本文件由 \`doc-update-trigger --auto-update\` 创建骨架，待补充完整内容。`,
    '',
    '## 变更触发',
    '',
    `匹配规则：${ctx.rule.id}（${ctx.rule.name}）`,
    '',
    '详见 `docs/00-meta/doc-trigger-action-map.md`。',
    '',
  ].join('\n')
}

const AUTO_UPDATE_MARKER_RE = /<!-- auto-update:[\s\S]*?-->\n?/

/** 幂等地写入/刷新文档末尾的 `<!-- auto-update -->` 校验标记 */
function upsertAutoUpdateMarker(absPath: string, ctx: GenerateContext): void {
  const content = readFileSync(absPath, 'utf-8')
  const ts = new Date().toISOString()
  const matched = ctx.matchedFiles.slice(0, 5).join(',')
  const marker = `<!-- auto-update: last_verified=${ts}; rule=${ctx.rule.id}; matched=${matched} -->\n`
  const body = content.replace(/\s+$/, '')
  const next = AUTO_UPDATE_MARKER_RE.test(content)
    ? content.replace(AUTO_UPDATE_MARKER_RE, marker)
    : `${body}\n\n${marker}`
  safeWriteFileSync(absPath, next)
}

/** 默认生成器：缺失建骨架、存在刷新标记（非破坏性） */
const defaultDocGenerator: DocGenerator = {
  id: 'default',
  canHandle: () => true,
  generate(ctx: GenerateContext): GenerateResult {
    const abs = resolve(ctx.root, ctx.docPath)
    const needsAudit = ctx.rule.auditDocs
    if (!isUnderRoot(abs, ctx.root)) {
      return { docPath: ctx.docPath, status: 'failed', detail: '路径越界，拒绝写入', errorCode: 'PATH_OUTSIDE_ROOT', needsAudit }
    }
    if (!existsSync(abs)) {
      if (ctx.dryRun) {
        return { docPath: ctx.docPath, status: 'created', detail: '（dry-run）将创建骨架', needsAudit }
      }
      try {
        safeWriteFileSync(abs, renderScaffold(ctx))
        return { docPath: ctx.docPath, status: 'created', detail: '已创建骨架', needsAudit }
      } catch (err) {
        return { docPath: ctx.docPath, status: 'failed', detail: `IO: ${msgOf(err)}`, errorCode: 'IO', needsAudit }
      }
    }
    if (ctx.dryRun) {
      return { docPath: ctx.docPath, status: 'skipped', detail: '（dry-run）已存在，将刷新校验标记', needsAudit }
    }
    try {
      upsertAutoUpdateMarker(abs, ctx)
      return { docPath: ctx.docPath, status: 'updated', detail: '已刷新校验标记', needsAudit }
    } catch (err) {
      return { docPath: ctx.docPath, status: 'failed', detail: `IO: ${msgOf(err)}`, errorCode: 'IO', needsAudit }
    }
  },
}

/** T10 生成器：运行现有 `doc:version-check` 做 frontmatter code_version 校验（对接现有模块） */
const versionCheckGenerator: DocGenerator = {
  id: 'version-check',
  canHandle: (ctx) => ctx.rule.id === 'T10',
  generate(ctx: GenerateContext): GenerateResult {
    if (ctx.dryRun) {
      return { docPath: '(frontmatter sync)', status: 'skipped', detail: '（dry-run）将运行 doc:version-check', needsAudit: false }
    }
    const res = runNpmScript('doc:version-check')
    return {
      docPath: '(frontmatter sync)',
      status: res.ok ? 'updated' : 'failed',
      detail: res.summary,
      errorCode: res.ok ? undefined : 'IO',
      needsAudit: false,
    }
  },
}

/** 生成器注册表（扩展点）：按顺序首个 canHandle 命中者执行，否则用 defaultDocGenerator */
const DEFAULT_GENERATORS: readonly DocGenerator[] = [versionCheckGenerator, defaultDocGenerator]

/** 运行 npm 脚本并捕获成败（resilient：失败不抛出） */
function runNpmScript(name: string): { ok: boolean; summary: string } {
  try {
    execSync(`npm run ${name} --silent`, { encoding: 'utf-8', cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    return { ok: true, summary: `${name} 通过` }
  } catch (err) {
    const first = msgOf(err).split('\n')[0]
    return { ok: false, summary: `${name} 失败：${first}` }
  }
}

/** 安全提取错误信息 */
function msgOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ─── 自动更新主流程 ───────────────────────────────────────────────────────────

/** --auto-update 选项 */
interface AutoUpdateOptions {
  readonly dryRun: boolean
  readonly strict: boolean
  readonly generators: readonly DocGenerator[]
}

/** 自动更新执行报告 */
interface AutoUpdateReport {
  readonly results: readonly GenerateResult[]
  readonly audit: { ran: boolean; ok: boolean; summary: string }
  readonly failures: number
  readonly skips: number
}

/** 运行 audit:docs（写后校验，对接现有门禁） */
function runAudit(): { ran: boolean; ok: boolean; summary: string } {
  const res = runNpmScript('audit:docs')
  return { ran: true, ok: res.ok, summary: res.summary }
}

/**
 * 执行自动更新：按触发规则逐文档选生成器生成，按需运行 audit:docs。
 * @param options 选项
 * @param changedFiles 变更文件（复用，避免重复 git diff）
 * @param triggered 已触发规则
 */
function runAutoUpdate(
  options: AutoUpdateOptions,
  changedFiles: readonly string[],
  triggered: Map<TriggerRule, string[]>,
): AutoUpdateReport {
  const results: GenerateResult[] = []
  for (const [rule, matched] of triggered) {
    const docs = rule.docsToUpdate.length > 0 ? rule.docsToUpdate : ['(frontmatter sync)']
    for (const docPath of docs) {
      const ctx: GenerateContext = { docPath, rule, matchedFiles: matched, dryRun: options.dryRun, root: ROOT }
      const gen = options.generators.find((g) => g.canHandle(ctx)) ?? defaultDocGenerator
      results.push(gen.generate(ctx))
    }
  }
  const needsAudit = !options.dryRun && results.some((r) => r.needsAudit)
  const audit = needsAudit ? runAudit() : { ran: false, ok: true, summary: '未运行（dry-run 或无需校验）' }
  const failures = results.filter((r) => r.status === 'failed').length
  const skips = results.filter((r) => r.status === 'skipped').length
  return { results, audit, failures, skips }
}

/** 计算退出码 */
function computeExitCode(report: AutoUpdateReport, options: AutoUpdateOptions): number {
  if (options.dryRun) return 0
  if (report.failures > 0) return 1
  if (report.audit.ran && !report.audit.ok) return 1
  if (options.strict && report.skips > 0) return 1
  return 0
}

/** 打印自动更新报告 */
function printAutoUpdateReport(report: AutoUpdateReport, options: AutoUpdateOptions): void {
  console.log(`${C.bold}${C.cyan}── 自动更新（--auto-update${options.dryRun ? ' --dry-run' : ''}）──${C.reset}`)
  console.log('')
  for (const r of report.results) {
    const icon = r.status === 'failed' ? `${C.red}✗${C.reset}`
      : r.status === 'created' ? `${C.green}＋${C.reset}`
      : r.status === 'updated' ? `${C.green}✓${C.reset}`
      : `${C.yellow}·${C.reset}`
    console.log(`  ${icon} ${r.docPath} — ${r.detail}`)
  }
  console.log('')
  const auditIcon = report.audit.ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`
  console.log(`  ${auditIcon} audit:docs — ${report.audit.summary}`)
  console.log('')
  const exitCode = computeExitCode(report, options)
  console.log(`${C.bold}${exitCode === 0 ? C.green : C.red}✓ 自动更新完成（failures=${report.failures}, skips=${report.skips}, exit=${exitCode}）${C.reset}`)
}

// ─── CLI 参数 ─────────────────────────────────────────────────────────────────

interface ParsedArgs {
  readonly check: boolean
  readonly autoUpdate: boolean
  readonly since: string
  readonly baseRef?: string
  readonly files: readonly string[]
  readonly dryRun: boolean
  readonly strict: boolean
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const args: { check: boolean; autoUpdate: boolean; since: string; baseRef?: string; files: string[]; dryRun: boolean; strict: boolean } = {
    check: false,
    autoUpdate: false,
    since: 'HEAD~1',
    files: [],
    dryRun: false,
    strict: false,
  }

  const list = argv.slice(2)
  for (let i = 0; i < list.length; i++) {
    const arg = list[i]
    if (arg === '--check') {
      args.check = true
    } else if (arg === '--auto-update') {
      args.autoUpdate = true
    } else if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--strict') {
      args.strict = true
    } else if (arg === '--since') {
      args.since = requireValue(list, i, '--since')
      i++
    } else if (arg === '--base-ref') {
      args.baseRef = requireValue(list, i, '--base-ref')
      i++
    } else if (arg === '--files') {
      const val = requireValue(list, i, '--files')
      args.files.push(...val.split(',').map((s) => s.trim()).filter(Boolean))
      i++
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      console.error(`${C.red}未知参数: ${arg}${C.reset}`)
      console.error(`${C.dim}使用 --help 查看用法${C.reset}`)
      process.exit(1)
    }
  }

  if (args.baseRef && args.since !== 'HEAD~1') {
    console.error(`${C.red}--since 与 --base-ref 互斥${C.reset}`)
    process.exit(1)
  }

  return args
}

/** 取带值参数的下一项，缺失则报错退出 */
function requireValue(list: readonly string[], index: number, name: string): string {
  const val = list[index + 1]
  if (!val || val.startsWith('--')) {
    console.error(`${C.red}${name} 需要一个值${C.reset}`)
    process.exit(1)
  }
  return val
}

function printHelp(): void {
  console.log(`
${C.bold}doc-update-trigger${C.reset} — 文档自动更新触发器

${C.bold}用法:${C.reset}
  npx tsx scripts/doc-update-trigger.ts [选项]

${C.bold}选项:${C.reset}
  ${C.cyan}--check${C.reset}            仅检查，不生成更新建议
  ${C.cyan}--auto-update${C.reset}      按映射表自动生成/更新对应文档
  ${C.cyan}--since <ref>${C.reset}      git diff 起点（缺省 HEAD~1）
  ${C.cyan}--base-ref <ref>${C.reset}   git diff 基线 ref（与 --since 互斥）
  ${C.cyan}--files <a,b,...>${C.reset}  显式指定变更文件（覆盖 git diff，可重复）
  ${C.cyan}--dry-run${C.reset}          仅模拟，不写盘、不跑 audit
  ${C.cyan}--strict${C.reset}           任意失败/跳过以非零退出
  ${C.cyan}--help${C.reset}             显示此帮助信息

${C.bold}触发器类型（与映射表 §二 一一对应）:${C.reset}
  ${C.green}T1${C.reset} 类型定义变更 → 数据字典
  ${C.green}T2${C.reset} 接口变更 → API 契约文档
  ${C.green}T3${C.reset} 架构调整 → 架构标准文档
  ${C.green}T4${C.reset} 配置参数变更 → 引擎规格文档
  ${C.green}T5${C.reset} Store 状态管理变更 → 状态管理文档
  ${C.green}T6${C.reset} UI 组件变更 → 组件文档和设计规范
  ${C.green}T7${C.reset} Hook 自定义变更 → Hook 使用指南
  ${C.green}T8${C.reset} 页面组件变更 → 路由规格与页面结构
  ${C.green}T9${C.reset} Widget 注册表变更 → 驾驶舱数据定义
  ${C.green}T10${C.reset} 版本发布 → frontmatter code_version 同步
  ${C.green}T11${C.reset} Mock 模块安全 → 映射表 + AGENTS.md §7.3
  ${C.green}T12${C.reset} ESLint/门禁变更 → AGENTS.md §三 + §七
  ${C.green}T14${C.reset} 股票字典生成/校验 → 股票字典生成参考文档
`)
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv)

  console.log('')
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.cyan}║  文档自动更新触发器 — doc-update-trigger.ts              ║${C.reset}`)
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')

  const changedFiles = args.files.length > 0 ? [...args.files] : getChangedFiles(args.baseRef ?? args.since)
  if (changedFiles.length === 0) {
    console.log(`${C.yellow}未检测到代码变更${C.reset}`)
    return
  }

  console.log(`${C.bold}检测到 ${changedFiles.length} 个文件变更:${C.reset}`)
  for (const file of changedFiles.slice(0, 10)) {
    console.log(`  ${C.dim}-${C.reset} ${file}`)
  }
  if (changedFiles.length > 10) {
    console.log(`  ${C.dim}... 还有 ${changedFiles.length - 10} 个文件${C.reset}`)
  }
  console.log('')

  const triggeredRules = findTriggeredRules(changedFiles)
  if (triggeredRules.size === 0) {
    console.log(`${C.green}✓ 未触发任何文档更新规则${C.reset}`)
    return
  }

  console.log(`${C.bold}${C.yellow}⚠️  触发 ${triggeredRules.size} 个文档更新规则:${C.reset}`)
  console.log('')

  const docsToUpdate = new Set<string>()
  const missingDocs: string[] = []
  for (const [rule, matchedFiles] of triggeredRules) {
    console.log(`${C.bold}${C.cyan}[${rule.id}] ${rule.name}${C.reset}`)
    console.log(`  ${C.dim}${rule.description}${C.reset}`)
    console.log(`  ${C.bold}匹配文件:${C.reset}`)
    for (const file of matchedFiles) {
      console.log(`    ${C.dim}-${C.reset} ${file}`)
    }
    console.log(`  ${C.bold}需要更新的文档:${C.reset}`)
    const docs = rule.docsToUpdate.length > 0 ? rule.docsToUpdate : ['(frontmatter sync → doc:version-check)']
    for (const doc of docs) {
      const exists = doc.startsWith('(') || checkDocExists(doc)
      const status = exists ? `${C.green}✓${C.reset}` : `${C.red}✗ 不存在${C.reset}`
      console.log(`    ${status} ${doc}`)
      if (exists) docsToUpdate.add(doc)
      else missingDocs.push(doc)
    }
    console.log('')
  }

  if (args.autoUpdate) {
    const options: AutoUpdateOptions = { dryRun: args.dryRun, strict: args.strict, generators: DEFAULT_GENERATORS }
    const report = runAutoUpdate(options, changedFiles, triggeredRules)
    printAutoUpdateReport(report, options)
    process.exit(computeExitCode(report, options))
  }

  if (docsToUpdate.size === 0) {
    console.log(`${C.yellow}没有需要更新的文档${C.reset}`)
    return
  }

  console.log(`${C.bold}${C.green}═══════════════════════════════════════════════════════════${C.reset}`)
  console.log(`${C.bold}需要更新 ${docsToUpdate.size} 个文档:${C.reset}`)
  console.log('')
  for (const doc of docsToUpdate) {
    console.log(`  ${C.cyan}→${C.reset} ${doc}`)
  }
  console.log('')

  if (args.check) {
    console.log(`${C.dim}（仅检查模式，不生成更新建议）${C.reset}`)
    if (missingDocs.length > 0) {
      console.log(`${C.red}✗ 发现 ${missingDocs.length} 个触发文档缺失（映射表 docsToUpdate 路径不存在）：${C.reset}`)
      for (const d of missingDocs) {
        console.log(`    ${C.red}-${C.reset} ${d}`)
      }
      console.log(`${C.dim}请同步修正 docs/00-meta/doc-trigger-action-map.md §二 与 TRIGGER_RULES。${C.reset}`)
      process.exit(1)
    }
    console.log(`${C.green}✓ 所有触发文档均存在${C.reset}`)
    return
  }

  console.log(`${C.bold}更新建议:${C.reset}`)
  console.log('')
  console.log(`  ${C.cyan}1.${C.reset} 手动更新上述文档，确保与代码变更保持一致`)
  console.log(`  ${C.cyan}2.${C.reset} 运行 ${C.bold}npm run audit:docs${C.reset} 验证文档同步状态`)
  console.log(`  ${C.cyan}3.${C.reset} 或使用 ${C.bold}--auto-update${C.reset} 自动生成/更新（内容生成为扩展点）`)
  console.log('')
  console.log(`${C.bold}${C.green}✓ 文档更新触发器执行完成${C.reset}`)
}

if (process.argv[1] && process.argv[1].endsWith('doc-update-trigger.ts')) main()
