#!/usr/bin/env node
/**
 * @module scripts/doc-pipeline
 * @description 文档自动更新体系 —— 端到端流水线骨架（M1 · T7a）
 *
 * 串联现有脚本，编排四阶段流水线：
 *   detect   → 解析变更文件（git diff / --files / --all），按 TRIGGER_RULES 匹配目标文档
 *   generate → 调用 doc-auto-updater.ts（骨架：--auto-update 仍是空桩，标注 partial）
 *   validate → 调用 audit-doc-sync.ts（CI 同款 P0 门禁）
 *   publish  → 骨架：成功时建议由 CI changelog-automation.yml 发布；失败时告警
 *
 * 接入本轮并行产出的能力：
 *   - ./doc-retry   (T2)：retryWithBackoff / isTransientError / classifyError
 *   - ./doc-notify  (T3)：notifyDocAlert / notifyDocAlerts
 *
 * 退出码：validate 失败或 generate 有错误 / 异常 → 1（异常 → 2）。CI 非零即阻断。
 *
 * 用法：
 *   npx tsx scripts/doc-pipeline.ts [--base <ref>] [--files <f...>] [--all]
 *                                [--dry-run] [--output <dir>] [--state-dir <dir>]
 *                                [--skip-publish] [--help]
 */

import { execFileSync, execSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname as pathDirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRIGGER_RULES } from './doc-update-trigger'
import { retryWithBackoff } from './doc-retry'
import { notifyDocAlert, type DocAlert } from './doc-notify'

// ─── 路径/常量 ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = pathDirname(__filename)
const ROOT = __dirname.replace(/[\\/]scripts$/, '')

/** tsx CLI 入口（mjs），用于以子进程方式运行其他 ts 脚本 */
const TSX_CLI = resolve(__dirname, '../node_modules/tsx/dist/cli.mjs')

const DOC_AUTO_UPDATER = 'scripts/doc-auto-updater.ts'
const AUDIT_DOC_SYNC = 'scripts/audit-doc-sync.ts'
const DEFAULT_OUTPUT = 'docs/reports/doc-pipeline'
const DOCS_DIR = join(ROOT, 'docs')

/** 从 TRIGGER_RULES 推断元素类型，避免依赖 doc-update-trigger 未导出的接口 */
type TriggerRule = (typeof TRIGGER_RULES)[number]

// ─── 导出类型 ──────────────────────────────────────────────────────────────────

/** 命令行选项 */
export interface CliOptions {
  /** git 基准引用，用于 git diff（默认 HEAD~1） */
  base: string
  /** 显式指定的变更文件（相对仓库根），覆盖 git diff */
  files: string[]
  /** 对全仓 docs 跑（骨架下等价于把 docs 全列） */
  all: boolean
  /** 只报告要做什么，不实际 generate/publish */
  dryRun: boolean
  /** 报告输出目录 */
  output: string
  /** 状态目录（骨架：仅记录，暂无持久化用途） */
  stateDir?: string
  /** 跳过发布阶段 */
  skipPublish: boolean
  /** 打印帮助 */
  help: boolean
}

/** 运行一个子脚本后的归一化结果 */
export interface RunScriptResult {
  /** 子进程退出码（0 表示成功） */
  exitCode: number
  /** 标准输出 */
  stdout: string
  /** 标准错误 */
  stderr: string
}

/** detect 阶段命中规则 */
export interface MatchedRule {
  id: string
  name: string
  description: string
  /** 命中的变更文件 */
  files: string[]
}

/** detect 阶段结果 */
export interface DetectStage {
  mode: 'files' | 'all' | 'diff'
  base: string
  changedFiles: string[]
  matchedRules: MatchedRule[]
  targetDocs: string[]
  notes: string[]
}

/** generate 阶段单次调用记录 */
export interface GenerateCall {
  file: string
  exitCode: number
  stdout: string
  stderr: string
}

/** generate 阶段结果（骨架：partial） */
export interface GenerateStage {
  status: 'partial'
  calls: GenerateCall[]
  hadError: boolean
  notes: string[]
}

/** validate 阶段结果 */
export interface ValidateStage {
  exitCode: number
  passed: boolean
  stderr: string
  notes: string[]
}

/** publish 阶段结果（骨架） */
export interface PublishStage {
  action: string
  notified: Array<{ level: string; code: string; title: string }>
  notes: string[]
}

/** 流水线四阶段汇总报告 */
export interface DocPipelineReport {
  meta: {
    tool: string
    version: string
    base: string
    mode: 'files' | 'all' | 'diff'
    dryRun: boolean
    skipPublish: boolean
    output: string
    stateDir?: string
    generatedAt: string
    changedFilesCount: number
    targetDocsCount: number
  }
  stages: {
    detect: DetectStage
    generate: GenerateStage
    validate: ValidateStage
    publish: PublishStage
  }
  summary: {
    matchedRulesCount: number
    generateCallsCount: number
    generateHadError: boolean
    validationPassed: boolean
    notes: string[]
  }
  overallStatus: 'success' | 'failed'
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

/**
 * 以子进程方式运行另一个 ts 脚本（通过 tsx）。
 * 失败时不会抛出，而是把非零退出码与 stderr 归一化进结果，便于流水线继续。
 *
 * @param scriptRelPath 相对于仓库根的脚本路径，如 'scripts/foo.ts'
 * @param args 传给目标脚本的命令行参数
 * @returns 归一化的运行结果（exitCode / stdout / stderr）
 */
function runScript(scriptRelPath: string, args: string[]): RunScriptResult {
  const scriptPath = join(ROOT, scriptRelPath)
  try {
    const stdout = execFileSync(process.execPath, [TSX_CLI, scriptPath, ...args], {
      cwd: ROOT,
      encoding: 'utf-8',
    })
    return { exitCode: 0, stdout, stderr: '' }
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer }
    const exitCode = typeof e.status === 'number' ? e.status : 1
    const stdout = typeof e.stdout === 'string' ? e.stdout : e.stdout?.toString() ?? ''
    const stderr = typeof e.stderr === 'string' ? e.stderr : e.stderr?.toString() ?? String(err)
    return { exitCode, stdout, stderr }
  }
}

/**
 * 简易 glob 匹配（自包含、无外部依赖）。
 * 支持 `**`（跨目录）、`*`（单段）、`?`（单字符）。
 *
 * @param filePath 待匹配的相对路径
 * @param pattern  glob 模式
 * @returns 是否匹配
 */
function matchGlob(filePath: string, pattern: string): boolean {
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|]/g, '\\$&')
        .replace(/\*\*/g, '(.*)')
        .replace(/\*/g, '([^/]*)')
        .replace(/\?/g, '[^/]') +
      '$',
  )
  return regex.test(filePath)
}

/**
 * 递归收集 docs/ 下所有 .md 文件（相对仓库根）。
 * 用于 --all 模式把全仓 docs 列出。
 *
 * @returns 相对仓库根的 markdown 文件路径数组
 */
function collectAllDocs(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      return
    }
    for (const name of names) {
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === '.git') continue
        walk(full)
      } else if (st.isFile() && name.endsWith('.md')) {
        out.push(relative(ROOT, full))
      }
    }
  }
  try {
    statSync(DOCS_DIR)
    walk(DOCS_DIR)
  } catch {
    /* docs 目录不存在则忽略 */
  }
  return out
}

/**
 * 解析命令行参数。
 *
 * @param argv process.argv
 * @returns 归一化后的命令行选项
 */
export function parseCliArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    base: 'HEAD~1',
    files: [],
    all: false,
    dryRun: false,
    output: DEFAULT_OUTPUT,
    skipPublish: false,
    help: false,
  }
  const args = argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === '--help' || token === '-h') {
      opts.help = true
    } else if (token === '--base') {
      opts.base = args[++i] ?? 'HEAD~1'
    } else if (token === '--files') {
      while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        opts.files.push(args[++i])
      }
    } else if (token === '--all') {
      opts.all = true
    } else if (token === '--dry-run') {
      opts.dryRun = true
    } else if (token === '--output') {
      opts.output = args[++i] ?? DEFAULT_OUTPUT
    } else if (token === '--state-dir') {
      opts.stateDir = args[++i]
    } else if (token === '--skip-publish') {
      opts.skipPublish = true
    } else {
      console.error(`未知参数: ${token}`)
      process.exit(1)
    }
  }
  return opts
}

/** 打印帮助信息 */
function printHelp(): void {
  console.log(`
${'doc-pipeline'} — 文档自动更新端到端流水线骨架（M1 · T7a）

${'用法:'}
  npx tsx scripts/doc-pipeline.ts [选项]

${'选项:'}
  ${'--base <git-ref>'}       git 基准引用（默认 HEAD~1），用于 git diff 取变更文件
  ${'--files <f1> <f2>'}      显式指定变更文件（相对仓库根），覆盖 git diff
  ${'--all'}                  对全仓 docs 跑（骨架下等价于把 docs 全列）
  ${'--dry-run'}              只报告要做什么，不实际 generate/publish
  ${'--output <dir>'}         报告输出目录（默认 docs/reports/doc-pipeline）
  ${'--state-dir <dir>'}      状态目录（骨架：仅记录）
  ${'--skip-publish'}         跳过发布阶段
  ${'--help, -h'}             显示此帮助

${'阶段: detect → generate → validate → publish'}
`)
}

// ─── 阶段实现 ──────────────────────────────────────────────────────────────────

/**
 * detect 阶段：解析变更文件并匹配目标文档。
 *
 * @param opts 命令行选项
 * @returns detect 阶段结果
 */
function runDetect(opts: CliOptions): DetectStage {
  const notes: string[] = []
  let changedFiles: string[]
  let mode: DetectStage['mode']

  if (opts.files.length > 0) {
    mode = 'files'
    changedFiles = opts.files
  } else if (opts.all) {
    mode = 'all'
    // 全仓模式：尝试用 git ls-files 取 src 文件；失败则降级为空（generate 无输入，仅列 docs）
    try {
      changedFiles = execSync('git ls-files -- src', { cwd: ROOT, encoding: 'utf-8' })
        .split('\n')
        .filter((l) => l.trim().length > 0)
    } catch {
      changedFiles = []
      notes.push('git ls-files 失败，--all 模式下变更文件降级为空（仅列出全仓 docs）')
    }
  } else {
    mode = 'diff'
    try {
      changedFiles = execSync(`git diff --name-only ${opts.base}...HEAD`, {
        cwd: ROOT,
        encoding: 'utf-8',
      })
        .split('\n')
        .filter((l) => l.trim().length > 0)
    } catch {
      changedFiles = []
      notes.push(`git diff --name-only ${opts.base}...HEAD 失败，降级为空数组（沙箱/无 git 历史时常见）`)
    }
  }

  const matchedRules: MatchedRule[] = []
  const targetDocs = new Set<string>()

  if (!opts.all) {
    for (const rule of TRIGGER_RULES) {
      const matched = changedFiles.filter((f) => rule.patterns.some((p) => matchGlob(f, p)))
      if (matched.length > 0) {
        matchedRules.push({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          files: matched,
        })
        for (const doc of rule.docsToUpdate) targetDocs.add(doc)
      }
    }
  } else {
    // --all：把全仓 docs 全部列出，并记录所有规则
    for (const rule of TRIGGER_RULES) {
      matchedRules.push({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        files: [],
      })
    }
    for (const doc of collectAllDocs()) targetDocs.add(doc)
  }

  if (changedFiles.length === 0) {
    notes.push('未检测到变更文件（git diff 为空或沙箱无历史），generate 阶段将无输入')
  }

  return {
    mode,
    base: opts.base,
    changedFiles,
    matchedRules,
    targetDocs: Array.from(targetDocs),
    notes,
  }
}

/**
 * generate 阶段：对每个变更文件调用 doc-auto-updater.ts（用 retryWithBackoff 包裹）。
 * 骨架：doc-update-trigger --auto-update 仍是空桩，真正的「按映射表生成文档」暂未实现。
 *
 * @param opts 命令行选项
 * @param changedFiles  detect 阶段得到的变更文件
 * @param output 报告输出目录
 * @returns generate 阶段结果（status 恒为 partial）
 */
async function runGenerate(
  opts: CliOptions,
  changedFiles: string[],
  output: string,
): Promise<GenerateStage> {
  const calls: GenerateCall[] = []
  let hadError = false

  for (const file of changedFiles) {
    const args = ['--files', file, '--output', output]
    if (opts.dryRun) args.push('--dry-run')
    try {
      const result = await retryWithBackoff<RunScriptResult>(async () => {
        const r = runScript(DOC_AUTO_UPDATER, args)
        if (r.exitCode !== 0) {
          throw new Error(`doc-auto-updater 非零退出(${r.exitCode}): ${r.stderr}`)
        }
        return r
      })
      calls.push({
        file,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      })
      if (result.exitCode !== 0) hadError = true
    } catch (err: unknown) {
      hadError = true
      calls.push({
        file,
        exitCode: -1,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    status: 'partial',
    calls,
    hadError,
    notes: [
      'generate 为骨架阶段：doc-update-trigger --auto-update 仍是空桩，' +
        '真正的「按 TRIGGER_RULES 映射表生成/更新文档」尚未实现，' +
        '当前仅透传变更文件给 doc-auto-updater.ts（差异检测/基线维护，不做内容生成）。',
    ],
  }
}

/**
 * validate 阶段：运行 audit-doc-sync.ts（CI 同款 P0 门禁）。
 *
 * @returns validate 阶段结果
 */
function runValidate(): ValidateStage {
  const res = runScript(AUDIT_DOC_SYNC, [])
  return {
    exitCode: res.exitCode,
    passed: res.exitCode === 0,
    stderr: res.stderr,
    notes: ['audit-doc-sync.ts 即 CI 的 audit:docs P0 门禁，exitCode===0 视为通过'],
  }
}

/**
 * publish 阶段：骨架。
 * - 成功且非 dry-run 且未跳过 → 记录「建议由 CI changelog-automation.yml 发布」
 * - 校验失败 → 发送 error 告警
 * - generate 有失败调用（校验通过）→ 发送 warning 告警
 *
 * @param opts 命令行选项
 * @param validation  validate 阶段结果
 * @param generate  generate 阶段结果
 * @returns publish 阶段结果
 */
async function runPublish(
  opts: CliOptions,
  validation: ValidateStage,
  generate: GenerateStage,
): Promise<PublishStage> {
  const notified: PublishStage['notified'] = []
  let action: string

  if (validation.passed) {
    if (!opts.dryRun && !opts.skipPublish) {
      action =
        '建议：由 CI changelog-automation.yml 完成 changelog 发布' +
        '（当前为人工/CI 流程，骨架暂不自动发布）'
    } else {
      action = opts.dryRun
        ? 'dry-run：未执行发布'
        : 'skip-publish：已跳过发布'
    }
  } else {
    action = '校验未通过，已发送 error 告警，跳过发布'
    await notifyDocAlert({
      level: 'error',
      code: 'PIPELINE_VALIDATION_FAILED',
      title: '文档校验未通过',
      message: `audit:docs 非零退出 (exitCode=${validation.exitCode})`,
      source: 'doc-pipeline',
      context: {
        exitCode: validation.exitCode,
        stderr: validation.stderr.slice(0, 2000),
      },
    } as DocAlert)
    notified.push({
      level: 'error',
      code: 'PIPELINE_VALIDATION_FAILED',
      title: '文档校验未通过',
    })
  }

  if (generate.hadError && validation.passed) {
    const failedCount = generate.calls.filter((c) => c.exitCode !== 0).length
    await notifyDocAlert({
      level: 'warning',
      code: 'PIPELINE_GENERATE_FAILED',
      title: '文档生成部分失败',
      message: `generate 阶段存在 ${failedCount} 个非零退出调用`,
      source: 'doc-pipeline',
      context: { failedCalls: failedCount },
    } as DocAlert)
    notified.push({
      level: 'warning',
      code: 'PIPELINE_GENERATE_FAILED',
      title: '文档生成部分失败',
    })
  }

  return {
    action,
    notified,
    notes: ['publish 为骨架：自动发布交由 CI，本阶段只建议/告警，不做实际写入'],
  }
}

/**
 * 组装并写出最终报告，返回退出码。
 *
 * @param report 流水线报告
 * @param exitCode 进程退出码
 */
function finalize(report: DocPipelineReport, exitCode: number): number {
  try {
    const outDir = join(ROOT, report.meta.output)
    mkdirSync(outDir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(join(outDir, `doc-pipeline-${ts}.json`), JSON.stringify(report, null, 2), 'utf-8')
  } catch (err: unknown) {
    console.error(`[doc-pipeline] 写入报告失败: ${err instanceof Error ? err.message : String(err)}`)
  }
  console.log(JSON.stringify(report, null, 2))
  return exitCode
}

// ─── 主流程 ────────────────────────────────────────────────────────────────────

/**
 * 主流程：detect → generate → validate → publish，最终输出报告并返回退出码。
 * 异常被捕获并转换为退出码 2。
 *
 * @returns 进程退出码：0=成功, 1=校验失败或生成错误, 2=异常
 */
export async function main(): Promise<number> {
  const opts = parseCliArgs(process.argv)
  if (opts.help) {
    printHelp()
    return 0
  }

  try {
    const detect = runDetect(opts)
    const generate = await runGenerate(opts, detect.changedFiles, opts.output)
    const validate = runValidate()
    const publish = await runPublish(opts, validate, generate)

    const overallStatus: DocPipelineReport['overallStatus'] =
      validate.passed && !generate.hadError ? 'success' : 'failed'

    const report: DocPipelineReport = {
      meta: {
        tool: 'doc-pipeline',
        version: 'M1-T7a',
        base: opts.base,
        mode: detect.mode,
        dryRun: opts.dryRun,
        skipPublish: opts.skipPublish,
        output: opts.output,
        stateDir: opts.stateDir,
        generatedAt: new Date().toISOString(),
        changedFilesCount: detect.changedFiles.length,
        targetDocsCount: detect.targetDocs.length,
      },
      stages: { detect, generate, validate, publish },
      summary: {
        matchedRulesCount: detect.matchedRules.length,
        generateCallsCount: generate.calls.length,
        generateHadError: generate.hadError,
        validationPassed: validate.passed,
        notes: [
          ...(opts.dryRun ? ['dry-run：未实际 generate 写入/发布'] : []),
          ...(generate.status === 'partial' ? generate.notes : []),
        ],
      },
      overallStatus,
    }

    const exitCode = validate.passed && !generate.hadError ? 0 : 1
    return finalize(report, exitCode)
  } catch (err: unknown) {
    console.error(`[doc-pipeline] 异常: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
    const errorReport: DocPipelineReport = {
      meta: {
        tool: 'doc-pipeline',
        version: 'M1-T7a',
        base: opts.base,
        mode: opts.files.length > 0 ? 'files' : opts.all ? 'all' : 'diff',
        dryRun: opts.dryRun,
        skipPublish: opts.skipPublish,
        output: opts.output,
        stateDir: opts.stateDir,
        generatedAt: new Date().toISOString(),
        changedFilesCount: 0,
        targetDocsCount: 0,
      },
      stages: {
        detect: {
          mode: 'diff',
          base: opts.base,
          changedFiles: [],
          matchedRules: [],
          targetDocs: [],
          notes: ['流水线在 main 中异常终止'],
        },
        generate: { status: 'partial', calls: [], hadError: true, notes: [] },
        validate: { exitCode: -1, passed: false, stderr: '', notes: ['未执行'] },
        publish: {
          action: '未执行（异常）',
          notified: [],
          notes: [err instanceof Error ? err.message : String(err)],
        },
      },
      summary: {
        matchedRulesCount: 0,
        generateCallsCount: 0,
        generateHadError: true,
        validationPassed: false,
        notes: ['异常终止，退出码 2'],
      },
      overallStatus: 'failed',
    }
    finalize(errorReport, 2)
    return 2
  }
}

if (process.argv[1] && process.argv[1].endsWith('doc-pipeline.ts')) void main()
