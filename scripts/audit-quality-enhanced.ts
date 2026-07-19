#!/usr/bin/env tsx
/**
 * audit-quality-enhanced.ts
 * 增强型静态代码分析器 v1.4（六类检测规则扩展 · 新增 13 条规则 · 提升检测精度与覆盖）
 *
 * 设计目标（对应增强需求 4 项）：
 *  1) 扩展静态分析能力：覆盖「潜在缺陷 / 代码异味 / 安全漏洞 / 性能隐患」四类规则，并新增
 *     死代码、SQL 注入、Hooks 依赖、跨文件架构健康等专项检测。
 *  2) 提升检测准确性与深度、降低误报率：基于 TypeScript 编译器 API（AST）做上下文感知
 *     判断，仅在语义危险处报警；测试/生成/脚本类文件默认豁免，避免噪音。
 *  3) 优化输出格式：每条 Finding 含 file / line / column / severity / category / ruleId /
 *     message / suggestion / context，机器可读 JSON + 人类可读报告双通道；新增 SARIF 输出。
 *  4) 支持复杂代码结构与多文件项目整体分析：--root 指定扫描根，递归遍历整项目，
 *     跨文件聚合按严重度/类别/规则统计；--cross-file 提供项目级架构健康度分析。
 *
 * 架构约定（复用现有审计管道，不改变既有功能架构）：
 *  - 复用 ./_debug/_audit-pipeline 的 scan/formatReport/main 白盒契约。
 *  - stdout = JSON 数据流（或 --format sarif 的 SARIF）；stderr = 诊断 + 人类可读报告；
 *    持久化 docs/reports/audit/。
 *  - 退出码：0=无阻断性违规（或基线无新增），1=有阻断性违规，2=执行错误。
 *    Warning 类不阻断，便于渐进式整改。
 *
 * 新增能力（v1.1，纯新增，不改既有 12 条规则）：
 *  - P1.1 死代码/未用符号检测（unused-import / unused-var / unused-fn）
 *  - P1.2 SQL/NoSQL 注入检测（sec:sql-injection）
 *  - P1.3 React Hooks 依赖遗漏检测（smell:hooks-missing-deps）
 *  - P1.4 误报再收敛（嵌套循环仅当内层依赖外层索引时报警；阈值可配）
 *  - P1.5 SARIF 输出（--format sarif）
 *  - P2.1 跨文件引用分析（--cross-file：循环依赖/未用导出/孤儿模块）
 *  - P2.2 基线门禁（--baseline save / check，仅阻断新增违规）
 *  - P2.3 规则配置化（scripts/audit-quality.config.json）
 *  - P2.4 与既有审计聚合（--aggregate → health-dashboard.json）
 *
 * 用法：
 *   npx tsx scripts/audit-quality-enhanced.ts [--root src] [--include-tests] [--quiet]
 *        [--no-persist] [--output <path>] [--format json|sarif]
 *        [--cross-file] [--baseline save|check] [--aggregate] [--config <path>]
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as ts from 'typescript'
import {
  runAuditPipeline,
  colorize,
  writeStdoutJson,
  writeStderr,
  logDiagnostic,
  persistReport,
  type AuditReport,
} from './_debug/_audit-pipeline'

// ============================================================
// 类型与常量
// ============================================================

/** 单条发现（在既有 Finding 基础上新增 column / ruleId / suggestion / isNew） */
export interface Finding {
  file: string
  line: number
  column: number
  severity: 'Fatal' | 'Critical' | 'Major' | 'Minor' | 'Warning'
  category: string
  ruleId: string
  message: string
  suggestion: string
  context: string
  /** 基线对比标记：是否相对基线为新增违规（仅 --baseline check 时填充） */
  isNew?: boolean
}

/** 增强审计报告 */
export interface Report extends AuditReport {
  violations: Finding[]
  summary: {
    totalFiles: number
    totalViolations: number
    totalWarnings: number
    bySeverity: Record<string, number>
    byCategory: Record<string, number>
    byRule: Record<string, number>
    /** 基线对比信息（仅 --baseline check 时填充） */
    baseline?: { baselineCount: number; newViolations: number; newBlocking: number }
  }
}

const SCRIPT_NAME = 'audit-quality-enhanced'
const VERSION = '1.4'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// ============================================================
// 规则配置化（P2.3）
// ============================================================

interface QualityConfig {
  /** 规则开关：ruleId -> 是否启用（缺省启用；显式 false 关闭） */
  rules: Record<string, boolean>
  /** 阈值 */
  thresholds: {
    fnLenWarn: number
    fnLenMajor: number
    maxNesting: number
    /** 架构：导出符号数超过此值视为上帝模块（arch:god-module） */
    godModuleExports: number
    /** 架构：物理行数超过此值视为上帝模块（arch:god-module） */
    godModuleLines: number
    /** 架构：相对导入上溯目录层数 >= 此值视为深层导入（arch:deep-import） */
    deepImportUpLevels: number
  }
  /** 按目录前缀覆盖阈值（key 为相对 ROOT 的目录前缀，最长匹配胜出） */
  directories?: Record<string, { fnLenWarn?: number; fnLenMajor?: number }>
  /** 跨文件架构检测的可选配置 */
  arch?: {
    /** 未用导出白名单前缀：匹配的相对路径前缀不报 arch:unused-export，收敛公共 API / 类型模块的噪音 */
    allowUnusedExportsPrefixes?: string[]
  }
}

const DEFAULT_CONFIG: QualityConfig = {
  rules: {},
  thresholds: { fnLenWarn: 100, fnLenMajor: 200, maxNesting: 4, godModuleExports: 25, godModuleLines: 800, deepImportUpLevels: 3 },
  directories: {},
  arch: { allowUnusedExportsPrefixes: [] },
}

function deepMerge<T>(base: T, over: Partial<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object') {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>)
    } else if (v !== undefined) {
      out[k] = v
    }
  }
  return out as T
}

function loadConfig(): QualityConfig {
  const candidates = [
    CLI.config ? path.resolve(CLI.config) : null,
    path.resolve(__dirname, 'audit-quality.config.json'),
  ].filter((p): p is string => !!p)
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
        return deepMerge(DEFAULT_CONFIG, raw as Partial<QualityConfig>)
      }
    } catch {
      // 忽略损坏配置，回退默认
    }
  }
  return DEFAULT_CONFIG
}

// ============================================================
// CLI 参数解析
// ============================================================

interface CliOptions {
  root: string
  includeTests: boolean
  quiet: boolean
  noPersist: boolean
  output: string | null
  format: 'json' | 'sarif'
  baseline: 'save' | 'check' | null
  crossFile: boolean
  aggregate: boolean
  config: string | null
}

function resolveCli(): CliOptions {
  const argv = process.argv.slice(2)
  const get = (k: string): string | null => {
    const i = argv.indexOf(k)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1]! : null
  }
  return {
    root: get('--root') ?? 'src',
    includeTests: argv.includes('--include-tests'),
    quiet: argv.includes('--quiet'),
    noPersist: argv.includes('--no-persist'),
    output: get('--output'),
    format: (get('--format') as 'json' | 'sarif') ?? 'json',
    baseline: (get('--baseline') as 'save' | 'check' | null) ?? null,
    crossFile: argv.includes('--cross-file'),
    aggregate: argv.includes('--aggregate'),
    config: get('--config'),
  }
}

const CLI = resolveCli()
const QUALITY_CONFIG = loadConfig()

/** 规则是否启用（未显式关闭即启用） */
function ruleEnabled(id: string): boolean {
  return QUALITY_CONFIG.rules[id] !== false
}

/** 取某文件适用的 fn-len 阈值（按目录覆盖） */
function fnLenThreshold(rel: string): { warn: number; major: number } {
  const dirs = QUALITY_CONFIG.directories ?? {}
  let bestKey = ''
  let best = { warn: QUALITY_CONFIG.thresholds.fnLenWarn, major: QUALITY_CONFIG.thresholds.fnLenMajor }
  for (const [prefix, override] of Object.entries(dirs)) {
    if (rel.startsWith(prefix) && prefix.length > bestKey.length) {
      bestKey = prefix
      best = {
        warn: override.fnLenWarn ?? best.warn,
        major: override.fnLenMajor ?? best.major,
      }
    }
  }
  return best
}

/** 遍历时跳过的目录 */
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'coverage',
  'outputs', 'archive', '.workbuddy', 'releases',
])

const MAX_NESTING = QUALITY_CONFIG.thresholds.maxNesting

/** 安全：敏感变量名模式（命中且赋值为字符串字面量 → 硬编码凭证） */
const SECRET_NAME_RE =
  /(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|私钥|密钥|secretkey|authtoken)/i

/** 值看起来像占位符/掩码/哨兵（非真实凭证），规避误报 */
function isPlaceholderValue(v: string): boolean {
  if (v.length === 0) return true
  if (/^[\*\u2022xX0#_=\-]+$/i.test(v)) return true
  if (/xxxx|••/.test(v)) return true
  if (/^__.*__$/.test(v)) return true
  const common = ['api key', 'apikey', 'token', 'password', 'passwd', 'secret', 'access key', 'auth token']
  if (common.includes(v.trim().toLowerCase())) return true
  return false
}

/** 变量名表明这是存储键/掩码/占位/标签/展示文本，而非凭证本身 */
function isSafeName(name: string): boolean {
  const n = name.toLowerCase()
  return /(storage|mask|placeholder|label|display|uitext|text|example|sample|title|field|prompt|desc|default_?label)/.test(n)
}

/** 仅这些函数经 shell 解释命令字符串，存在命令注入风险。
 *  execFile/execFileSync/spawn/spawnSync 不启动 shell，对其命令参数做插值不构成注入，须排除以免误报。 */
const SHELL_INJECTION_FNS = new Set(['exec', 'execSync'])

/** 性能：循环内的同步阻塞调用 */
const SYNC_FS_FNS = new Set([
  'readFileSync', 'writeFileSync', 'appendFileSync', 'readdirSync',
  'statSync', 'lstatSync', 'copyFileSync', 'readlinkSync', 'realpathSync',
])

/** 安全：数据库查询方法（SQL 注入检测对象）。
 *  注意：不含过于通用的 `get`（会误伤 Map.get），仅保留 DB 语义明确的方法名。 */
const SQL_METHODS = new Set(['query', 'execute', 'exec', 'raw', 'run', 'all', 'sql'])

/** Hooks 依赖检测对象 */
const HOOK_FNS = new Set([
  'useEffect', 'useMemo', 'useCallback', 'useLayoutEffect', 'useInsertionEffect',
])

/** 视为全局内置、不计入 Hooks 自由变量的标识符 */
const GLOBALS = new Set([
  'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Promise', 'Date', 'RegExp', 'Map', 'Set', 'Symbol', 'Error', 'window', 'document',
  'globalThis', 'process', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'requestAnimationFrame', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'undefined',
  'null', 'true', 'false', 'NaN', 'Infinity', 'require', 'module', 'exports', 'Reflect',
  'Proxy', 'WeakMap', 'WeakSet', 'BigInt', 'decodeURI', 'encodeURI', 'fetch',
  'structuredClone', 'React',
])

/** 性能：数组方法集合（用于链式调用中间分配检测 perf:array-method-chain） */
const ARRAY_METHODS = new Set([
  'map', 'filter', 'forEach', 'flatMap', 'reduce', 'some', 'every',
  'find', 'findIndex', 'slice', 'sort', 'concat', 'flat',
])

// ============================================================
// 文件收集
// ============================================================

function isTsFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx')
}

function relative(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, '/')
}

function isTestFile(rel: string): boolean {
  return /(__tests__|\.test\.|\.spec\.|[/\\]tests[/\\])/.test(rel)
}

function isGeneratedFile(rel: string): boolean {
  return /[/\\]generated[/\\]|\.generated\.|[/\\]fixtures[/\\]/.test(rel)
}

function safeRead(full: string): string {
  try {
    return fs.readFileSync(full, 'utf-8')
  } catch {
    return ''
  }
}

function collectFiles(dir: string): string[] {
  const out: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      out.push(...collectFiles(full))
    } else if (entry.isFile() && isTsFile(entry.name)) {
      out.push(full)
    }
  }
  return out
}

// ============================================================
// 检测核心
// ============================================================

interface Ctx {
  rel: string
  sf: ts.SourceFile
  lines: string[]
  findings: Finding[]
  includeTests: boolean
  /** 当前函数是否已因过深嵌套报过一次 */
  fnFlagged: boolean
  /** 嵌套循环检测：外层循环索引变量名栈 */
  loopVars: string[]
  /** 当前函数作用域内被初始化为字符串的累加器变量名集合（用于循环内字符串拼接检测，降低误报） */
  stringAccs: Set<string>
}

function loc(sf: ts.SourceFile, pos: number): { line: number; column: number } {
  const lc = sf.getLineAndCharacterOfPosition(pos)
  return { line: lc.line + 1, column: lc.character + 1 }
}

function snippet(lines: string[], line: number): string {
  const raw = lines[line - 1] ?? ''
  return raw.trim().slice(0, 120)
}

function makeFinding(
  file: string, line: number, column: number, ruleId: string,
  severity: Finding['severity'], category: string, message: string, suggestion: string,
): Finding | null {
  if (!ruleEnabled(ruleId)) return null
  return { file, line, column, severity, category, ruleId, message, suggestion, context: '' }
}

/** 统一落库一条发现（受规则开关控制） */
function add(
  ctx: Ctx,
  node: ts.Node,
  ruleId: string,
  severity: Finding['severity'],
  category: string,
  message: string,
  suggestion: string,
): void {
  if (!ruleEnabled(ruleId)) return
  const { line, column } = loc(ctx.sf, node.getStart(ctx.sf))
  ctx.findings.push({
    file: ctx.rel,
    line,
    column,
    severity,
    category,
    ruleId,
    message,
    suggestion,
    context: snippet(ctx.lines, line),
  })
}

function isFunctionLike(n: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) ||
    ts.isFunctionExpression(n) || ts.isArrowFunction(n) ||
    ts.isGetAccessor(n) || ts.isSetAccessor(n) || ts.isConstructorDeclaration(n)
  )
}

function isLoop(n: ts.Node): boolean {
  return (
    ts.isForStatement(n) || ts.isForOfStatement(n) ||
    ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)
  )
}

/** 向上查找最近的循环祖先：若在遇到函数边界前命中循环，说明该节点"位于循环体内"；
 *  若先跨越函数边界则视为不在循环（如循环内定义并被调用的辅助函数），用于降低 perf 类误报。 */
function nearestLoopAncestor(node: ts.Node): ts.Node | null {
  let cur: ts.Node | undefined = node.parent
  while (cur) {
    if (isFunctionLike(cur)) return null
    if (isLoop(cur)) return cur
    cur = cur.parent
  }
  return null
}

/** 提取循环索引变量名（用于嵌套循环依赖判定） */
function loopVarName(n: ts.Node): string {
  if (ts.isForStatement(n)) {
    const init = n.initializer
    if (init && ts.isVariableDeclarationList(init)) {
      const d = init.declarations[0]
      if (d && ts.isIdentifier(d.name)) return d.name.text
    } else if (init && ts.isBinaryExpression(init) && ts.isIdentifier(init.left)) {
      return init.left.text
    }
  } else if (ts.isForOfStatement(n) || ts.isForInStatement(n)) {
    const v = n.initializer
    if (ts.isVariableDeclarationList(v)) {
      const d = v.declarations[0]
      if (d && ts.isIdentifier(d.name)) return d.name.text
    } else if (ts.isIdentifier(v)) {
      return v.text
    }
  }
  return ''
}

/** 取循环头部文本（initializer/condition/incrementor，不含循环体），用于判定内层是否依赖外层索引 */
function loopHeaderText(n: ts.Node, sf: ts.SourceFile): string {
  if (ts.isForStatement(n)) {
    return [n.initializer, n.condition, n.incrementor]
      .filter((x): x is ts.Node => !!x)
      .map((x) => x.getText(sf))
      .join(' ')
  }
  if (ts.isForOfStatement(n) || ts.isForInStatement(n)) {
    return `${n.initializer?.getText(sf) ?? ''} ${n.expression.getText(sf)}`
  }
  if (ts.isWhileStatement(n) || ts.isDoStatement(n)) {
    return n.expression.getText(sf)
  }
  return ''
}

/** 检查 if/while/do 的条件里是否存在 `=` 赋值（疑似笔误） */
function checkAssignmentInCondition(ctx: Ctx, cond: ts.Expression | undefined): void {
  if (!cond) return
  if (
    ts.isBinaryExpression(cond) &&
    cond.operatorToken.kind === ts.SyntaxKind.EqualsToken
  ) {
    add(ctx, cond, 'defect:assign-in-cond', 'Major', '潜在缺陷',
      '条件表达式中使用了赋值 `=` 而非比较 `===`，疑似笔误',
      '若确需赋值后判断，请加括号明确意图；否则改为 `===`')
  }
}

function isStringLiteral(n: ts.Node): n is ts.StringLiteral {
  return ts.isStringLiteral(n)
}

/** 硬编码凭证检测：敏感变量名 + 字符串字面量赋值（排除占位符/掩码/标签） */
function checkSecret(ctx: Ctx, nameNode: ts.Node, valueNode: ts.Node): void {
  const name = nameNode.getText(ctx.sf)
  if (!SECRET_NAME_RE.test(name)) return
  if (!isStringLiteral(valueNode)) return
  const value = valueNode.text
  if (value.length < 8) return
  if (isPlaceholderValue(value) || isSafeName(name)) return
  add(ctx, valueNode, 'sec:hardcoded-secret', 'Critical', '安全漏洞',
    `敏感变量 "${name}" 被硬编码为字符串字面量，存在凭证泄露风险`,
    '改为从环境变量/密钥管理服务读取（如 process.env.*），切勿入库明文')
}

/** 子进程命令注入检测：首个参数为模板字符串或字符串拼接 */
function checkChildProcExec(ctx: Ctx, node: ts.CallExpression): void {
  const callee = node.expression
  let fnName = ''
  if (ts.isIdentifier(callee)) fnName = callee.text
  else if (ts.isPropertyAccessExpression(callee)) fnName = callee.name.text
  if (!SHELL_INJECTION_FNS.has(fnName)) return
  const arg0 = node.arguments[0]
  if (!arg0) return
  const interpolated =
    ts.isTemplateExpression(arg0) ||
    (ts.isBinaryExpression(arg0) && arg0.operatorToken.kind === ts.SyntaxKind.PlusToken)
  if (interpolated) {
    add(ctx, arg0, 'sec:command-injection', 'Critical', '安全漏洞',
      `子进程调用 "${fnName}" 的命令参数由变量拼接/模板插值构成，存在命令注入风险`,
      `使用参数数组形式 ${fnName}(['cmd', arg])，或对变量做白名单/转义校验`)
  }
}

/** 判断节点内是否包含标识符（用于区分 "纯字符串拼接" 与 "含变量的拼接"） */
function containsIdentifier(n: ts.Node): boolean {
  let found = false
  function visit(x: ts.Node): void {
    if (found) return
    if (ts.isIdentifier(x)) {
      found = true
      return
    }
    ts.forEachChild(x, visit)
  }
  visit(n)
  return found
}

/** SQL 注入检测：数据库查询方法参数由模板/拼接构成，或 Prisma raw（含 Unsafe） */
function checkSqlInjection(ctx: Ctx, node: ts.CallExpression): void {
  const callee = node.expression
  let name = ''
  if (ts.isIdentifier(callee)) name = callee.text
  else if (ts.isPropertyAccessExpression(callee)) name = callee.name.text
  if (!name) return
  const arg0 = node.arguments[0]
  if (!arg0) return
  const interpolated =
    ts.isTemplateExpression(arg0) ||
    (ts.isBinaryExpression(arg0) &&
      arg0.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      containsIdentifier(arg0))
  const isPrismaUnsafe =
    /\$(query|execute)RawUnsafe$/.test(name) || name === '$queryRawUnsafe' || name === '$executeRawUnsafe'
  const isPrismaRaw = /\$(query|execute)Raw$/.test(name)

  if (SQL_METHODS.has(name) && interpolated) {
    add(ctx, arg0, 'sec:sql-injection', 'Critical', '安全漏洞',
      `数据库查询方法 "${name}" 的参数由变量拼接/模板插值构成，存在 SQL 注入风险`,
      '使用参数化查询（占位符 + 参数数组）或 ORM 构造器，禁止字符串拼接')
  } else if (isPrismaUnsafe) {
    add(ctx, node, 'sec:sql-injection', 'Critical', '安全漏洞',
      `Prisma "${name}" 直接拼接原始 SQL，存在 SQL 注入风险`,
      '改用参数化 $queryRaw`...${prisma.raw(param)}` 或类型安全的 ORM 查询')
  } else if (isPrismaRaw && interpolated) {
    add(ctx, arg0, 'sec:sql-injection', 'Critical', '安全漏洞',
      `Prisma "${name}" 模板中含外部变量，存在 SQL 注入风险`,
      '对插值变量使用 prisma.$params 或 prisma.raw() 转义')
  }
}

/** 判断标识符是否处于"声明名"位置（用于符号表分析排除自引用） */
function isDeclNameNode(n: ts.Identifier): boolean {
  const p = n.parent
  if (!p) return false
  if (ts.isVariableDeclaration(p) && p.name === n) return true
  if (ts.isFunctionDeclaration(p) && p.name === n) return true
  if (ts.isParameter(p) && p.name === n) return true
  if (ts.isBindingElement(p) && p.name === n) return true
  if (ts.isClassDeclaration(p) && p.name === n) return true
  if (ts.isInterfaceDeclaration(p) && p.name === n) return true
  if (ts.isTypeAliasDeclaration(p) && p.name === n) return true
  if (ts.isEnumDeclaration(p) && p.name === n) return true
  if (ts.isImportSpecifier(p) && (p.name === n || p.propertyName === n)) return true
  if (ts.isImportClause(p) && p.name === n) return true
  if (ts.isNamespaceImport(p) && p.name === n) return true
  return false
}

/** 收集某子树的作用域信息：used=被引用的根标识符，declared=子树内声明的名字 */
function collectScopeInfo(node: ts.Node): { used: Set<string>; declared: Set<string> } {
  const used = new Set<string>()
  const declared = new Set<string>()
  function visit(n: ts.Node): void {
    if (ts.isIdentifier(n)) {
      const isPropName = n.parent && ts.isPropertyAccessExpression(n.parent) && n.parent.name === n
      if (!isDeclNameNode(n) && !isPropName) used.add(n.text)
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) declared.add(n.name.text)
    else if (ts.isFunctionDeclaration(n) && n.name) declared.add(n.name.text)
    else if (ts.isParameter(n) && ts.isIdentifier(n.name)) declared.add(n.name.text)
    else if (ts.isBindingElement(n) && ts.isIdentifier(n.name)) declared.add(n.name.text)
    else if (ts.isClassDeclaration(n) && n.name) declared.add(n.name.text)
    ts.forEachChild(n, visit)
  }
  visit(node)
  return { used, declared }
}

/** React Hooks 依赖遗漏检测 */
function checkHooksDeps(ctx: Ctx, node: ts.CallExpression): void {
  if (!ts.isIdentifier(node.expression) || !HOOK_FNS.has(node.expression.text)) return
  const cb = node.arguments[0]
  if (!cb || !(ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) return
  const scope = collectScopeInfo(cb)
  const free = [...scope.used].filter((v) => !scope.declared.has(v) && !GLOBALS.has(v))
  const depsArg = node.arguments[1]
  const deps = new Set<string>()
  if (depsArg && ts.isArrayLiteralExpression(depsArg)) {
    for (const el of depsArg.elements) {
      if (ts.isIdentifier(el)) deps.add(el.text)
      else if (ts.isSpreadElement(el) && ts.isIdentifier(el.expression)) deps.add(el.expression.text)
    }
  }
  const missing = free.filter((v) => !deps.has(v))
  if (missing.length > 0) {
    add(ctx, cb, 'smell:hooks-missing-deps', 'Warning', '代码异味',
      `Hook ${node.expression.text} 的依赖数组缺少闭包变量: ${missing.join(', ')}`,
      '将缺失变量加入依赖数组，或用 useRef/useCallback 稳定引用，避免过期闭包')
  }
}

// ============================================================
// walk 的子检测函数（S1：从 walk 拆分，降低圈复杂度、提升复用与可读性）
// ============================================================

/** 宽松相等 == / != 检测（排除与 null/undefined 比较的常见惯用法，避免误报） */
function checkLooseEquality(ctx: Ctx, node: ts.Node): void {
  if (!ts.isBinaryExpression(node)) return
  const k = node.operatorToken.kind
  if (k !== ts.SyntaxKind.EqualsEqualsToken && k !== ts.SyntaxKind.ExclamationEqualsToken) return
  const isNullish = (n: ts.Node): boolean =>
    n.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(n) && (n.text === 'undefined' || n.text === 'null'))
  if (!isNullish(node.left) && !isNullish(node.right)) {
    add(ctx, node, 'defect:loose-equality', 'Major', '潜在缺陷',
      '使用了宽松相等运算符（== / !=），可能因类型 coercion 产生非预期结果',
      '改用严格相等（=== / !==）')
  }
}

/** 显式 any 检测（测试文件豁免，由 ctx.includeTests 控制） */
function checkExplicitAny(ctx: Ctx, node: ts.Node): void {
  if (node.kind !== ts.SyntaxKind.AnyKeyword) return
  if (ctx.includeTests || !isTestFile(ctx.rel)) {
    add(ctx, node, 'smell:explicit-any', 'Warning', '代码异味',
      '使用了显式 any，削弱类型安全',
      '用具体类型或 unknown + 类型守卫替代 any')
  }
}

/** 调用表达式综合检测：eval / 子进程命令注入 / SQL 注入 / Hooks 依赖 / 调试日志 / parseInt 缺 radix / 循环内阻塞。 */
function checkCallExpression(ctx: Ctx, node: ts.CallExpression): void {
  const callee = node.expression
  // eval
  if (ts.isIdentifier(callee) && callee.text === 'eval') {
    add(ctx, node, 'sec:eval', 'Critical', '安全漏洞',
      '使用 eval() 执行动态字符串，存在代码注入与性能风险',
      '用 JSON.parse / 函数表 / 受限解释器替代 eval')
  }
  // 子进程命令注入
  checkChildProcExec(ctx, node)
  // SQL 注入（P1.2）
  checkSqlInjection(ctx, node)
  // Hooks 依赖遗漏（P1.3）
  checkHooksDeps(ctx, node)
  // console 调试日志（仅 src 应用代码，排除脚本/测试）
  if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) && callee.expression.text === 'console'
  ) {
    const m = callee.name.text
    if (['log', 'info', 'debug', 'trace'].includes(m) && ctx.rel.startsWith('src/')) {
      add(ctx, node, 'smell:debug-log', 'Warning', '代码异味',
        `遗留调试日志 console.${m}（生产代码应移除或走 logger）`,
        '改用项目 logger 或构建期移除，避免生产噪音与信息泄露')
    }
  }
  // parseInt 缺 radix
  if (ts.isIdentifier(callee) && callee.text === 'parseInt' && node.arguments.length === 1) {
    add(ctx, node, 'defect:parseint-no-radix', 'Warning', '潜在缺陷',
      'parseInt 缺少进制参数，默认按 10 进制但易误读',
      '显式传入进制，如 parseInt(x, 10)')
  }
  // 循环内同步阻塞 / JSON / await（仅当调用位于循环体内且未跨越函数边界，降低误报）
  if (nearestLoopAncestor(node) !== null) {
    const syncName = ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : ts.isIdentifier(callee) ? callee.text : ''
    if (SYNC_FS_FNS.has(syncName)) {
      add(ctx, node, 'perf:sync-in-loop', 'Major', '性能隐患',
        `循环内调用同步阻塞 IO（${syncName}），会串行化并阻塞事件循环`,
        '移到循环外、改用异步 API，或批量读取')
    }
    if (ts.isPropertyAccessExpression(callee) && callee.expression.getText(ctx.sf) === 'JSON' &&
        (callee.name.text === 'parse' || callee.name.text === 'stringify')) {
      add(ctx, node, 'perf:json-in-loop', 'Warning', '性能隐患',
        '循环内频繁 JSON.parse/stringify，存在重复序列化开销',
        '将解析/序列化提升到循环外，或缓存结果')
    }
    if (ts.isAwaitExpression(node)) {
      add(ctx, node, 'perf:await-in-loop', 'Warning', '性能隐患',
        '循环内顺序 await，请求被串行化导致整体变慢',
        '用 Promise.all 并发，或批量接口')
    }
  }
}

/** new Function 动态编译检测（代码注入） */
function checkNewFunction(ctx: Ctx, node: ts.Node): void {
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') {
    add(ctx, node, 'sec:new-function', 'Critical', '安全漏洞',
      '使用 new Function() 动态编译代码，存在代码注入风险',
      '用函数表 / 策略模式 / 受限沙箱替代')
  }
}

/** XSS 风险检测：innerHTML 直接赋值 / dangerouslySetInnerHTML */
function checkXss(ctx: Ctx, node: ts.Node): void {
  if (ts.isPropertyAccessExpression(node) && node.name.text === 'innerHTML') {
    add(ctx, node, 'sec:inner-html', 'Critical', '安全漏洞',
      '直接赋值 innerHTML，未转义内容可致 XSS',
      '使用 textContent，或对来源做 DOMPurify 消毒')
  }
  if (ts.isJsxAttribute(node) && node.name.getText(ctx.sf) === 'dangerouslySetInnerHTML') {
    add(ctx, node, 'sec:dangerous-html', 'Critical', '安全漏洞',
      'dangerouslySetInnerHTML 注入原始 HTML，存在 XSS 风险',
      '改用受控文本/消毒后的内容')
  }
}

/** switch 缺 default 分支检测（仅当分支数 >= 2 时） */
function checkSwitchNoDefault(ctx: Ctx, node: ts.Node): void {
  if (!ts.isSwitchStatement(node) || node.caseBlock.clauses.length < 2) return
  const hasDefault = node.caseBlock.clauses.some((c) => ts.isDefaultClause(c))
  if (!hasDefault) {
    add(ctx, node, 'defect:switch-no-default', 'Warning', '潜在缺陷',
      'switch 语句缺少 default 分支，未覆盖的枚举/值将被忽略',
      '补充 default 分支（兜底或抛错）')
  }
}

/** 硬编码凭证检测：变量声明 / 属性赋值 / 二元赋值 三类位置 */
function checkSecretNode(ctx: Ctx, node: ts.Node): void {
  if (ts.isVariableDeclaration(node) && node.initializer) {
    checkSecret(ctx, node.name, node.initializer)
  } else if (ts.isPropertyAssignment(node)) {
    checkSecret(ctx, node.name, node.initializer)
  } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const lhs = node.left
    if (ts.isIdentifier(lhs) || ts.isPropertyAccessExpression(lhs) || ts.isElementAccessExpression(lhs)) {
      checkSecret(ctx, lhs, node.right)
    }
  }
}

/** 嵌套循环检测（仅当内层头部依赖外层索引变量时报警，降低误报 / P1.4） */
function checkNestedLoops(ctx: Ctx, node: ts.Node, loopDepth: number): void {
  if (!isLoop(node) || loopDepth < 1) return
  const header = loopHeaderText(node, ctx.sf)
  const refsOuter = ctx.loopVars.some((v) => v && header.includes(v))
  if (refsOuter) {
    add(ctx, node, 'perf:nested-loops', 'Warning', '性能隐患',
      '检测到嵌套循环且内层迭代依赖外层索引，时间复杂度可能达 O(n^2)',
      '评估是否能用 Map/Set/索引或单次遍历替代内层循环')
  }
}

/** 过深嵌套检测（函数级只报一次）：以 Block 为单元，排除 else-if 链误报 */
function checkDeepNesting(ctx: Ctx, node: ts.Node, depth: number): void {
  if (!ts.isBlock(node)) return
  const d = depth + 1
  if (d > MAX_NESTING && !ctx.fnFlagged) {
    add(ctx, node, 'smell:deep-nesting', 'Warning', '代码异味',
      `嵌套层级达 ${d} 层（> ${MAX_NESTING}），可读性与可测性下降`,
      '抽取早期返回 / 卫语句 / 独立函数，降低嵌套')
    ctx.fnFlagged = true
  }
}

/** 函数体过长检测（阈值按目录可配 / P2.3） */
function checkLongFn(ctx: Ctx, node: ts.Node): void {
  if (!isFunctionLike(node)) return
  const start = ctx.sf.getLineAndCharacterOfPosition(node.getStart(ctx.sf)).line
  const end = ctx.sf.getLineAndCharacterOfPosition(node.getEnd(ctx.sf)).line
  const len = end - start + 1
  const thr = fnLenThreshold(ctx.rel)
  if (len > thr.major) {
    add(ctx, node, 'smell:long-fn', 'Warning', '代码异味',
      `函数体约 ${len} 行（> ${thr.major}），职责过重`,
      '按单一职责拆分为更小函数，提升可测试性')
  } else if (len > thr.warn) {
    add(ctx, node, 'smell:long-fn', 'Warning', '代码异味',
      `函数体约 ${len} 行（> ${thr.warn}），建议收敛`,
      '审视是否可抽取子逻辑')
  }
}

// ============================================================
// 六类新增检测函数（v1.4：潜在缺陷 / 代码异味 / 安全漏洞 / 性能隐患 / 架构健康 / 规范）
// ============================================================

/** 潜在缺陷：不可达代码（Block 内 return/throw 之后的语句不可达；break/continue 仅终止循环/分支，不计） */
function checkUnreachableCode(ctx: Ctx, node: ts.Block): void {
  const stmts = node.statements
  for (let i = 0; i < stmts.length - 1; i++) {
    const s = stmts[i]!
    if (ts.isReturnStatement(s) || ts.isThrowStatement(s)) {
      for (let j = i + 1; j < stmts.length; j++) {
        add(ctx, stmts[j]!, 'defect:unreachable-code', 'Warning', '潜在缺陷',
          'return/throw 之后的代码不可达（死代码）', '移除死代码，或检查分支逻辑是否正确')
      }
      return
    }
  }
}

/** 潜在缺陷：switch case 穿透（非末尾、非空、且未以 break/return/throw 结束） */
function checkSwitchFallthrough(ctx: Ctx, node: ts.SwitchStatement): void {
  const clauses = node.caseBlock.clauses
  for (let i = 0; i < clauses.length - 1; i++) {
    const c = clauses[i]!
    const stmts = c.statements
    if (stmts.length === 0) continue // 空 case 属有意穿透分组
    const last = stmts[stmts.length - 1]!
    const terminates = ts.isBreakStatement(last) || ts.isReturnStatement(last) ||
      ts.isThrowStatement(last) || ts.isContinueStatement(last)
    if (!terminates) {
      add(ctx, c, 'defect:switch-fallthrough', 'Warning', '潜在缺陷',
        'case 分支未以 break/return/throw 结束，会落入下一分支（fall-through）',
        '补充 break/return，或在有意穿透处加注释说明')
    }
  }
}

/** 代码异味：嵌套三元表达式（可读性差）。需解包括号后再判定。 */
function checkNestedTernary(ctx: Ctx, node: ts.ConditionalExpression): void {
  const unwrap = (n: ts.Node): ts.Node => (ts.isParenthesizedExpression(n) ? unwrap(n.expression) : n)
  if (ts.isConditionalExpression(unwrap(node.whenTrue)) || ts.isConditionalExpression(unwrap(node.whenFalse))) {
    add(ctx, node, 'smell:nested-ternary', 'Warning', '代码异味',
      '嵌套三元表达式可读性差，易出错', '用 if/else 或独立变量/查表替代嵌套三元')
  }
}

/** 代码异味：函数含过多布尔型位置参数（>=3 个布尔参数） */
function checkBooleanParams(ctx: Ctx, node: ts.Node): void {
  if (!isFunctionLike(node)) return
  const sig = node as ts.SignatureDeclaration
  const bools = sig.parameters.filter((p) => p.type?.kind === ts.SyntaxKind.BooleanKeyword).length
  if (sig.parameters.length >= 3 && bools >= 3) {
    add(ctx, node, 'smell:boolean-param', 'Warning', '代码异味',
      `函数含 ${bools} 个布尔型位置参数，调用点难以理解`,
      '改用选项对象 { ... } 或枚举/标志位，提升可读性')
  }
}

/** 代码异味：扫描注释中的待办标记（TODO / FIXME / XXX / HACK） */
function scanTodoMarkers(ctx: Ctx): void {
  const re = /\b(TODO|FIXME|XXX|HACK)\b/i
  ctx.lines.forEach((line, i) => {
    const cIdx = line.indexOf('//')
    const hIdx = line.indexOf('#')
    const start = cIdx >= 0 ? cIdx : (hIdx >= 0 ? hIdx : -1)
    const text = start >= 0 ? line.slice(start) : line
    if (re.test(text)) {
      const f = makeFinding(ctx.rel, i + 1, 1, 'smell:todo-fixme', 'Warning', '代码异味',
        `发现待办标记: ${text.trim().slice(0, 48)}`, '跟踪并尽快处理，或移入 issue 跟踪系统')
      if (f) ctx.findings.push(f)
    }
  })
}

/** 安全漏洞：开放重定向（location.href = x / location.replace/assign(x)，x 非字面量） */
function checkOpenRedirect(ctx: Ctx, node: ts.Node): void {
  const isLocationObj = (n: ts.Node): boolean =>
    (ts.isIdentifier(n) && n.text === 'location') ||
    (ts.isPropertyAccessExpression(n) && n.name.text === 'location')
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const lhs = node.left
    if (ts.isPropertyAccessExpression(lhs) && lhs.name.text === 'href' && isLocationObj(lhs.expression)) {
      if (!ts.isStringLiteral(node.right)) {
        add(ctx, node, 'sec:open-redirect', 'Critical', '安全漏洞',
          '将用户可控的值赋给 location.href 可能导致开放重定向',
          '校验目标域名白名单，或改用路由内部跳转')
      }
    }
  } else if (ts.isCallExpression(node)) {
    const callee = node.expression
    if (ts.isPropertyAccessExpression(callee) &&
        (callee.name.text === 'replace' || callee.name.text === 'assign') && isLocationObj(callee.expression)) {
      const arg0 = node.arguments[0]
      if (arg0 && !ts.isStringLiteral(arg0)) {
        add(ctx, node, 'sec:open-redirect', 'Critical', '安全漏洞',
          'location.replace/assign 接收用户可控参数可能导致开放重定向',
          '校验目标域名白名单后再跳转')
      }
    }
  }
}

/** 安全漏洞：正则注入（new RegExp(非字面量)，不可信来源可致 ReDoS） */
function checkRegexInjection(ctx: Ctx, node: ts.Node): void {
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'RegExp') {
    const arg0 = node.arguments[0]
    if (arg0 && !ts.isStringLiteral(arg0) && !ts.isNoSubstitutionTemplateLiteral(arg0)) {
      add(ctx, node, 'sec:regex-injection', 'Major', '安全漏洞',
        'RegExp 由非字面量构造，若来源不可信可能导致 ReDoS / 拒绝服务',
        '对正则来源做白名单校验，或使用固定字面量模式')
    }
  }
}

/** 性能隐患：数组方法链式调用产生中间数组（如 .filter().map()） */
function checkArrayMethodChain(ctx: Ctx, node: ts.CallExpression): void {
  const callee = node.expression
  if (!ts.isPropertyAccessExpression(callee) || !ARRAY_METHODS.has(callee.name.text)) return
  const recv = callee.expression
  if (ts.isCallExpression(recv) && ts.isPropertyAccessExpression(recv.expression) &&
      ARRAY_METHODS.has(recv.expression.name.text)) {
    add(ctx, node, 'perf:array-method-chain', 'Warning', '性能隐患',
      `数组方法链式调用（${recv.expression.name.text}().${callee.name.text}()）会产生中间数组`,
      '用 reduce 单次遍历，或 Array.from 映射 + 过滤，减少中间分配')
  }
}

/** 性能隐患：循环内字符串 += 拼接（O(n^2) 且产生大量临时字符串） */
function checkStringConcatInLoop(ctx: Ctx, node: ts.Node): void {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.PlusEqualsToken) return
  if (nearestLoopAncestor(node) === null) return
  const involvesString = (n: ts.Node): boolean => {
    if (ts.isStringLiteral(n) || ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) return true
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return true
    return false
  }
  // 累加器被初始化为字符串（let s = '' / let s = ``），或任一操作数含字符串字面量/模板/字符串拼接
  const leftName = ts.isIdentifier(node.left) ? node.left.text : null
  const isAcc = leftName !== null && ctx.stringAccs.has(leftName)
  if (isAcc || involvesString(node.left) || involvesString(node.right)) {
    add(ctx, node, 'perf:string-concat-in-loop', 'Warning', '性能隐患',
      '循环内使用 += 拼接字符串，O(n^2) 且产生大量临时字符串',
      '改用数组 push 后 join，或模板字符串累积')
  }
}

/** 规范：接口命名使用 I 前缀（不符合 TypeScript 惯用命名） */
function checkInterfacePrefix(ctx: Ctx, node: ts.Node): void {
  if (!ts.isInterfaceDeclaration(node) || !node.name) return
  if (/^I[A-Z]/.test(node.name.text)) {
    add(ctx, node, 'norm:interface-prefix', 'Minor', '规范',
      `接口命名使用 I 前缀（"${node.name.text}"），不符合 TypeScript 惯用命名`,
      '去掉 I 前缀，直接以业务语义命名接口')
  }
}

/** 规范：使用 var 声明（存在变量提升与块级作用域歧义） */
function checkVarKeyword(ctx: Ctx, node: ts.Node): void {
  if (!ts.isVariableDeclarationList(node)) return
  if (node.flags & ts.NodeFlags.Let) return
  if (node.flags & ts.NodeFlags.Const) return
  add(ctx, node, 'norm:var-keyword', 'Warning', '规范',
    '使用了 var 声明，存在变量提升与块级作用域歧义', '改用 const / let')
}

/** AST 遍历主逻辑（S1：主调度，具体检测拆分到上方 checkX 函数） */
function walk(ctx: Ctx, node: ts.Node, depth: number, loopDepth: number): void {
  const enterLoop = isLoop(node)
  // 以 Block 作用域为嵌套单元统计深度：else-if 链无额外 Block，不会误报为深嵌套
  const enterBlock = ts.isBlock(node)
  const newLoop = loopDepth + (enterLoop ? 1 : 0)

  // 进入函数：重置过深嵌套标记与字符串累加器集合（保存外层以便恢复）
  const isFn = isFunctionLike(node)
  const savedAccs = isFn ? ctx.stringAccs : null
  if (isFn) { ctx.fnFlagged = false; ctx.stringAccs = new Set() }

  // 潜在缺陷：条件内赋值（if/while/do）
  if (ts.isIfStatement(node)) checkAssignmentInCondition(ctx, node.expression)
  else if (ts.isWhileStatement(node)) checkAssignmentInCondition(ctx, node.expression)
  else if (ts.isDoStatement(node)) checkAssignmentInCondition(ctx, node.expression)

  // 各专项检测（已拆分为独立 checkX 函数，见上方）
  checkLooseEquality(ctx, node)
  checkExplicitAny(ctx, node)
  if (ts.isCallExpression(node)) checkCallExpression(ctx, node)
  checkNewFunction(ctx, node)
  checkXss(ctx, node)

  // 空 catch / 吞掉异常（仅当既无重抛也无错误日志调用时报警，避免误报 rethrow）
  if (ts.isCatchClause(node)) {
    const stmts = node.block.statements
    if (stmts.length > 0) {
      // v1.5: 递归检测嵌套块（if/for/while/try）中的 CallExpression/Throw，消除嵌套 logger.error 误报
      const hasHandler = (list: readonly ts.Statement[]): boolean =>
        list.some((s) => {
          if (ts.isThrowStatement(s)) return true
          if (ts.isExpressionStatement(s) && ts.isCallExpression(s.expression)) return true
          // Recurse into nested blocks
          if (ts.isIfStatement(s)) {
            return hasHandler(s.thenStatement ? [s.thenStatement] : [])
              || (s.elseStatement ? hasHandler([s.elseStatement]) : false)
          }
          if (ts.isBlock(s)) return hasHandler(Array.from(s.statements))
          if (ts.isTryStatement(s)) return hasHandler(Array.from(s.tryBlock.statements))
          if (ts.isForStatement(s) || ts.isWhileStatement(s) || ts.isDoStatement(s)) {
            return hasHandler(ts.isBlock((s as ts.IterationStatement).statement)
              ? Array.from(((s as ts.IterationStatement).statement as ts.Block).statements)
              : [])
          }
          if (ts.isSwitchStatement(s)) {
            return s.caseBlock.clauses.some((c) => hasHandler(Array.from(c.statements)))
          }
          return false
        })
      if (hasHandler(stmts)) {
        ts.forEachChild(node, (child) => walk(ctx, child, enterBlock ? depth + 1 : depth, newLoop))
        return
      }
    }
    add(ctx, node, 'defect:empty-catch', 'Major', '潜在缺陷',
      'catch 块为空或仅做无意义的 return/赋值，异常被静默吞掉',
      '至少记录错误日志（logger.error(e)），或显式向上抛出')
  }

  checkSwitchNoDefault(ctx, node)
  checkSecretNode(ctx, node)
  checkNestedLoops(ctx, node, loopDepth)
  checkDeepNesting(ctx, node, depth)
  checkLongFn(ctx, node)

  // v1.4 六类新增检测（below）
  if (ts.isBlock(node)) checkUnreachableCode(ctx, node)
  if (ts.isSwitchStatement(node)) checkSwitchFallthrough(ctx, node)
  if (ts.isConditionalExpression(node)) checkNestedTernary(ctx, node)
  checkBooleanParams(ctx, node)
  checkOpenRedirect(ctx, node)
  checkRegexInjection(ctx, node)
  if (ts.isCallExpression(node)) checkArrayMethodChain(ctx, node)
  if (ts.isBinaryExpression(node)) checkStringConcatInLoop(ctx, node)
  if (ts.isInterfaceDeclaration(node)) checkInterfacePrefix(ctx, node)
  if (ts.isVariableDeclarationList(node)) checkVarKeyword(ctx, node)

  // 识别字符串累加器声明（let/var x = '' 或 ``），供循环内字符串拼接检测降低误报
  if (ts.isVariableStatement(node) && !(node.declarationList.flags & ts.NodeFlags.Const)) {
    for (const d of node.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer &&
          (ts.isStringLiteral(d.initializer) || ts.isNoSubstitutionTemplateLiteral(d.initializer))) {
        ctx.stringAccs.add(d.name.text)
      }
    }
  }

  // 递归：循环节点需维护 loopVars 栈
  if (enterLoop) {
    const lv = loopVarName(node)
    if (lv) ctx.loopVars.push(lv)
    ts.forEachChild(node, (child) => walk(ctx, child, enterBlock ? depth + 1 : depth, newLoop))
    if (lv) ctx.loopVars.pop()
  } else {
    ts.forEachChild(node, (child) => walk(ctx, child, enterBlock ? depth + 1 : depth, newLoop))
  }
  if (savedAccs) ctx.stringAccs = savedAccs
}

/** 行级补充检测：注释掉的代码（仅作 Warning 提示，避免噪音） */
function scanCommentedCode(ctx: Ctx): void {
  const re = /^\s*\/\/\s*(const|let|var|function|class|return|if\s*\(|for\s*\(|while\s*\(|import\s|export\s|\.then\()/
  ctx.lines.forEach((line, i) => {
    if (re.test(line)) {
      const f = makeFinding(ctx.rel, i + 1, 1, 'smell:commented-code', 'Warning', '代码异味',
        '疑似被注释掉的代码，应删除或恢复', '若已废弃请删除；若需保留示例请移至文档')
      if (f) ctx.findings.push(f)
    }
  })
}

/** P1.1 死代码/未用符号检测（基于符号表） */
function analyzeUnused(ctx: Ctx): void {
  const allIds: ts.Identifier[] = []
  const bindingIds = new Set<ts.Node>()
  function visit(n: ts.Node): void {
    if (ts.isIdentifier(n)) {
      allIds.push(n)
      if (isDeclNameNode(n)) bindingIds.add(n)
    }
    ts.forEachChild(n, visit)
  }
  visit(ctx.sf)

  // 引用计数（排除声明自身那一次出现）
  const usages = new Map<string, number>()
  for (const id of allIds) {
    if (bindingIds.has(id)) continue
    usages.set(id.text, (usages.get(id.text) ?? 0) + 1)
  }

  const importBindings: { name: string; node: ts.Node }[] = []
  const fnDecls: { name: string; node: ts.Node; exported: boolean }[] = []
  const varDecls: { name: string; node: ts.Node }[] = []
  function isExported(n: ts.Node): boolean {
    return !!n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  }
  function collect(n: ts.Node, exported: boolean): void {
    if (ts.isImportDeclaration(n)) {
      const clause = n.importClause
      if (clause) {
        if (clause.name) importBindings.push({ name: clause.name.text, node: clause.name })
        const nb = clause.namedBindings
        if (nb) {
          if (ts.isNamespaceImport(nb)) importBindings.push({ name: nb.name.text, node: nb.name })
          else if (ts.isNamedImports(nb)) for (const el of nb.elements) {
            importBindings.push({ name: el.name.text, node: el.name })
            if (el.propertyName) importBindings.push({ name: el.propertyName.text, node: el.propertyName })
          }
        }
      }
    } else if (ts.isFunctionDeclaration(n) && n.name) {
      fnDecls.push({ name: n.name.text, node: n.name, exported: exported || isExported(n) })
    } else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && !ts.isCatchClause(n.parent)) {
      // 排除导出变量（跨文件使用合法，非死代码）与仅副作用调用（如 const r = doThing()）
      const vstmt = n.parent?.parent
      const isExportedVar = !!vstmt && ts.isVariableStatement(vstmt) &&
        vstmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      const sideEffectInit = !!n.initializer && ts.isCallExpression(n.initializer)
      if (!isExportedVar && !sideEffectInit) varDecls.push({ name: n.name.text, node: n.name })
    }
    const isExp = exported || isExported(n)
    ts.forEachChild(n, (c) => collect(c, isExp))
  }
  collect(ctx.sf, false)

  for (const imp of importBindings) {
    if (!usages.has(imp.name)) {
      add(ctx, imp.node, 'smell:unused-import', 'Warning', '代码异味',
        `导入 "${imp.name}" 未被使用`, '删除未使用的导入，或检查是否拼写错误')
    }
  }
  for (const fn of fnDecls) {
    if (!fn.exported && !usages.has(fn.name)) {
      add(ctx, fn.node, 'smell:unused-fn', 'Warning', '代码异味',
        `函数 "${fn.name}" 已声明但从未被调用`, '若确为遗留代码请删除；若为回调请确保被引用')
    }
  }
  for (const vd of varDecls) {
    if (!usages.has(vd.name)) {
      add(ctx, vd.node, 'smell:unused-var', 'Warning', '代码异味',
        `变量 "${vd.name}" 已声明但从未被使用`, '删除未使用变量，或确认是否应被引用')
    }
  }
}

/** 已解析的源文件（S3：建树一次，单文件分析与跨文件分析复用，避免二次建树） */
interface ParsedFile {
  full: string
  rel: string
  sf: ts.SourceFile
  content: string
  lines: string[]
}

/**
 * 读取并解析单个源文件为 ParsedFile；测试/生成/脚本类文件按 includeTests 豁免。
 * @param full 文件绝对路径
 * @param includeTests 是否纳入测试文件（false 时测试文件返回 null）
 * @returns 解析结果；豁免或读取失败时返回 null
 */
function parseFile(full: string, includeTests: boolean): ParsedFile | null {
  const rel = relative(full)
  if (!includeTests && isTestFile(rel)) return null
  if (isGeneratedFile(rel)) return null
  const content = safeRead(full)
  if (!content) return null
  const kind = full.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  // setParentNodes=true：analyzeUnused / collectScopeInfo / isDeclNameNode 依赖 node.parent
  const sf = ts.createSourceFile(rel, content, ts.ScriptTarget.Latest, true, kind)
  return { full, rel, sf, content, lines: content.split('\n') }
}

/**
 * 分析单个已解析文件（潜在缺陷 / 代码异味 / 安全 / 性能 / 死代码 / 注释代码）。
 * @param p 已解析的源文件
 * @returns 该文件内的所有发现
 */
function analyzeFile(p: ParsedFile): Finding[] {
  const ctx: Ctx = {
    rel: p.rel,
    sf: p.sf,
    lines: p.lines,
    findings: [],
    includeTests: false,
    fnFlagged: false,
    loopVars: [],
    stringAccs: new Set(),
  }
  walk(ctx, p.sf, 0, 0)
  analyzeUnused(ctx)
  scanCommentedCode(ctx)
  scanTodoMarkers(ctx)
  return ctx.findings
}

// ============================================================
// 跨文件引用分析（P2.1，--cross-file 启用）
// ============================================================

interface ModInfo {
  rel: string
  /** 该模块解析后的源文件（S4：跨文件发现精确定位时复用，避免二次建树） */
  sf: ts.SourceFile
  /** 命名导出集合（含 'default' 以建模默认导出） */
  exports: Set<string>
  imports: Array<{ name: string; from: string }>
  /** barrel 再导出（export { X } from './y'），用于精确引用建模，降低误报 */
  reExports: Array<{ name: string; from: string }>
  isBarrel: boolean
  /** 导出名 -> 声明节点（用于 arch:unused-export 精确定位，S4） */
  exportNodes: Map<string, ts.Node>
  /** 该模块各 import 声明节点（用于 arch:circular-dep 精确定位，S4） */
  importNodes: ts.Node[]
}

/** 判断声明节点是否带 `default` 修饰符（export default ...） */
function hasDefaultModifier(n: ts.Node): boolean {
  return !!n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
}

function collectDeclNames(d: ts.BindingName, set: Set<string>): void {
  if (ts.isIdentifier(d)) set.add(d.text)
  else if (ts.isObjectBindingPattern(d)) for (const el of d.elements) collectDeclNames(el.name, set)
  else if (ts.isArrayBindingPattern(d)) for (const el of d.elements) {
    if (ts.isBindingElement(el)) collectDeclNames(el.name, set)
  }
}

/**
 * 将 import 说明符解析为项目内的模块相对路径（用于跨文件引用建模）。
 * 支持两类：
 *  - 相对导入：`'./x'` / `'../x'`（基于 importer 所在目录）
 *  - 路径别名：`'@/x'`（tsconfig paths `@/*` → `src/*`，本项目主别名）
 * 裸模块名（npm 包，如 'react'）返回 null，不参与项目内依赖图。
 */
function resolveImport(fromRel: string, spec: string, relSet: Set<string>): string | null {
  let base: string
  let rest: string
  if (spec.startsWith('@/')) {
    base = 'src'
    rest = spec.slice(2)
  } else if (spec.startsWith('.')) {
    base = path.posix.dirname(fromRel)
    rest = spec
  } else {
    return null
  }
  const resolved = path.posix.normalize(path.posix.join(base, rest))
  const cands = [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}/index.ts`, `${resolved}/index.tsx`]
  for (const c of cands) if (relSet.has(c)) return c
  return null
}

/** 在模块 mod 的各 import 声明中，查找目标模块 resolvedRel 对应的 import 声明节点；
 *  用于 arch:circular-dep 将发现定位到具体的 import 语句（S4 精确定位）。 */
function findImportNode(mod: ModInfo, resolvedRel: string, relSet: Set<string>): ts.Node | undefined {
  for (const imp of mod.importNodes) {
    if (!ts.isImportDeclaration(imp) || !imp.moduleSpecifier || !ts.isStringLiteral(imp.moduleSpecifier)) continue
    if (resolveImport(mod.rel, imp.moduleSpecifier.text, relSet) === resolvedRel) return imp
  }
  return undefined
}

/**
 * 检测模块依赖图中的循环依赖。
 * 采用显式栈迭代 DFS（而非递归），避免万级文件项目递归过深导致调用栈溢出；
 * 同时去除原递归版对 >1500 节点"整体跳过"的限制，可覆盖整项目级依赖图。
 * @param graph 模块相对路径 -> 其直接 import 的模块相对路径列表
 * @returns 每个循环依赖的节点序列（从环中首个 GRAY 节点切片，不含重复首尾）
 */
function findCycles(graph: Map<string, string[]>): string[][] {
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const k of graph.keys()) color.set(k, WHITE)
  const cycles: string[][] = []
  const VISIT_LIMIT = 100000 // 病态超深图的兜底上限，避免极端卡死
  let visited = 0
  for (const start of graph.keys()) {
    if (color.get(start) !== WHITE) continue
    // 显式栈帧：{ u: 当前节点, i: 已遍历到的子节点下标 }
    const stack: Array<{ u: string; i: number }> = [{ u: start, i: 0 }]
    const pathStack: string[] = [start]
    color.set(start, GRAY)
    while (stack.length > 0) {
      if (visited++ > VISIT_LIMIT) break
      const frame = stack[stack.length - 1]!
      const neighbors = graph.get(frame.u) ?? []
      if (frame.i < neighbors.length) {
        const v = neighbors[frame.i]!
        frame.i++
        const c = color.get(v)
        if (c === GRAY) {
          // 命中仍在栈中的祖先 -> 发现循环
          const idx = pathStack.indexOf(v)
          if (idx >= 0) cycles.push(pathStack.slice(idx))
        } else if (c === WHITE) {
          color.set(v, GRAY)
          pathStack.push(v)
          stack.push({ u: v, i: 0 })
        }
        // BLACK 邻居：已完整探索，跳过（与原递归版语义一致）
      } else {
        color.set(frame.u, BLACK)
        pathStack.pop()
        stack.pop()
      }
    }
  }
  return cycles
}

/**
 * 跨文件引用分析（--cross-file）：构建模块依赖图，检测循环依赖、未用导出、孤儿模块。
 * S3/S5：复用 ParsedFile（建树一次），并以 'default' 哨兵建模默认导出/导入配对，降低漏报。
 * S4：arch:unused-export / arch:circular-dep 的发现定位到具体导出/导入声明节点（loc 精确定位）。
 * @param parsed 已解析的源文件列表（相对路径为键，供依赖解析）
 * @param relSet 项目内所有模块相对路径集合（用于 import 说明符解析）
 * @returns 跨文件架构健康类发现（arch:*）
 */
function analyzeCrossFile(parsed: ParsedFile[], relSet: Set<string>): Finding[] {
  const findings: Finding[] = []
  const mods = new Map<string, ModInfo>()

  for (const p of parsed) {
    const rel = p.rel
    const sf = p.sf
    const mod: ModInfo = {
      rel, sf, exports: new Set(), imports: [], reExports: [],
      isBarrel: /(^|\/)(index|barrel)\./.test(rel),
      exportNodes: new Map(), importNodes: [],
    }
    sf.forEachChild(function visit(n: ts.Node): void {
      if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
        const from = n.moduleSpecifier.text
        if (n.exportClause && ts.isNamedExports(n.exportClause)) {
          for (const el of n.exportClause.elements) {
            mod.reExports.push({ name: el.name.text, from })
            mod.exports.add(el.name.text)
            mod.exportNodes.set(el.name.text, n)
          }
        } else if (!n.exportClause) {
          mod.isBarrel = true
        }
      } else if (ts.isImportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
        const from = n.moduleSpecifier.text
        mod.importNodes.push(n)
        // arch:deep-import —— 跨目录深层 / 内部路径导入，破坏封装（违反 AGENTS.md 分层）
        const up = (from.match(/\.\.\//g) ?? []).length
        const isInternal = /(^|\/)(internal|privates?|_)(\/|$)/.test(from)
        if ((up >= (QUALITY_CONFIG.thresholds.deepImportUpLevels ?? 3)) || isInternal) {
          const pos = loc(sf, n.getStart(sf))
          const f = makeFinding(rel, pos.line, pos.column, 'arch:deep-import', 'Warning', '架构健康',
            `深层/内部路径导入 "${from}"（上溯 ${up} 层），加剧模块耦合`,
            '改为经由 barrel（index）或 @/ 别名公开 API 导入')
          if (f) findings.push(f)
        }
        const clause = n.importClause
        if (clause) {
          // 默认导入（import Foo from './x'）记为 'default'，与 export default 配对，降低漏报
          if (clause.name) mod.imports.push({ name: 'default', from })
          const nb = clause.namedBindings
          if (nb) {
            if (ts.isNamedImports(nb)) for (const el of nb.elements) mod.imports.push({ name: el.name.text, from })
            else if (ts.isNamespaceImport(nb)) mod.imports.push({ name: '*', from })
          }
        }
      } else if (ts.isExportAssignment(n)) {
        // export default <expr>
        mod.exports.add('default')
        mod.exportNodes.set('default', n)
      } else if (ts.isVariableStatement(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const d of n.declarationList.declarations) {
          const names = new Set<string>()
          collectDeclNames(d.name, names)
          for (const nm of names) {
            mod.exports.add(nm)
            mod.exportNodes.set(nm, n)
          }
        }
        if (hasDefaultModifier(n)) { mod.exports.add('default'); mod.exportNodes.set('default', n) }
      } else if (ts.isFunctionDeclaration(n) && n.name && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        // export default function NAME() 中 NAME 为默认导出内部名，仅记 'default'，避免误报未用导出
        if (hasDefaultModifier(n)) { mod.exports.add('default'); mod.exportNodes.set('default', n) }
        else { mod.exports.add(n.name.text); mod.exportNodes.set(n.name.text, n) }
      } else if (ts.isClassDeclaration(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        if (hasDefaultModifier(n) || !n.name) { mod.exports.add('default'); mod.exportNodes.set('default', n) }
        else if (n.name) { mod.exports.add(n.name.text); mod.exportNodes.set(n.name.text, n) }
      } else if (ts.isInterfaceDeclaration(n) && n.name && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        mod.exports.add(n.name.text)
        mod.exportNodes.set(n.name.text, n)
        if (hasDefaultModifier(n)) { mod.exports.add('default'); mod.exportNodes.set('default', n) }
      } else if (ts.isTypeAliasDeclaration(n) && n.name && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        mod.exports.add(n.name.text)
        mod.exportNodes.set(n.name.text, n)
        if (hasDefaultModifier(n)) { mod.exports.add('default'); mod.exportNodes.set('default', n) }
      } else if (ts.isEnumDeclaration(n) && n.name && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        mod.exports.add(n.name.text)
        mod.exportNodes.set(n.name.text, n)
        if (hasDefaultModifier(n)) { mod.exports.add('default'); mod.exportNodes.set('default', n) }
      }
      ts.forEachChild(n, visit)
    })
    mods.set(rel, mod)
  }

  // arch:god-module —— 导出符号过多 / 体量过大的"上帝模块"
  const godExports = QUALITY_CONFIG.thresholds.godModuleExports ?? 25
  const godLines = QUALITY_CONFIG.thresholds.godModuleLines ?? 800
  for (const mod of mods.values()) {
    if (mod.isBarrel) continue
    const exportCount = mod.exports.size
    const lineCount = mod.sf.getLineStarts().length
    if (exportCount > godExports || lineCount > godLines) {
      const firstNode = mod.exportNodes.size > 0 ? mod.exportNodes.values().next().value : undefined
      const pos = firstNode ? loc(mod.sf, firstNode.getStart(mod.sf)) : { line: 1, column: 1 }
      const reasons: string[] = []
      if (exportCount > godExports) reasons.push(`导出 ${exportCount} 个符号（> ${godExports}）`)
      if (lineCount > godLines) reasons.push(`约 ${lineCount} 行（> ${godLines}）`)
      const f = makeFinding(mod.rel, pos.line, pos.column, 'arch:god-module', 'Warning', '架构健康',
        `疑似上帝模块：${reasons.join('；')}`,
        '按单一职责拆分为更小的模块，降低认知负荷与耦合')
      if (f) findings.push(f)
    }
  }

  // 解析使用关系：target -> 被导入的名字集合（含 barrel 再导出，降低误报）
  const usages = new Map<string, Set<string>>()
  for (const mod of mods.values()) {
    for (const imp of mod.imports) {
      const target = resolveImport(mod.rel, imp.from, relSet)
      if (target) {
        if (!usages.has(target)) usages.set(target, new Set())
        usages.get(target)!.add(imp.name)
      }
    }
    // barrel 再导出也视为对原模块对应导出的引用
    for (const re of mod.reExports) {
      const target = resolveImport(mod.rel, re.from, relSet)
      if (target) {
        if (!usages.has(target)) usages.set(target, new Set())
        usages.get(target)!.add(re.name)
      }
    }
  }

  const ENTRY_PREFIXES = ['src/pages', 'src/apps', 'src/portal', 'src/showcase', 'src/main', 'src/index']
  const allowUnusedPrefixes = QUALITY_CONFIG.arch?.allowUnusedExportsPrefixes ?? []

  // 未使用导出
  for (const mod of mods.values()) {
    if (mod.isBarrel) continue
    if (ENTRY_PREFIXES.some((p) => mod.rel.startsWith(p))) continue
    // 白名单前缀（如公共类型/常量模块）不报未用导出，收敛噪音（S8）
    if (allowUnusedPrefixes.some((p) => mod.rel.startsWith(p))) continue
    for (const e of mod.exports) {
      if (!usages.get(mod.rel)?.has(e)) {
        const node = mod.exportNodes.get(e)
        const pos = node ? loc(mod.sf, node.getStart(mod.sf)) : { line: 1, column: 1 }
        const f = makeFinding(mod.rel, pos.line, pos.column, 'arch:unused-export', 'Minor', '架构健康',
          `导出 "${e}" 在项目中未被任何模块导入`, '若确为公共 API 请在文档标注；否则删除或收敛导出')
        if (f) findings.push(f)
      }
    }
  }

  // 循环依赖
  const graph = new Map<string, string[]>()
  for (const mod of mods.values()) {
    const edges: string[] = []
    for (const imp of mod.imports) {
      const t = resolveImport(mod.rel, imp.from, relSet)
      if (t && !edges.includes(t)) edges.push(t)
    }
    // barrel 再导出也视为对原模块的依赖边，避免再导出模块被误报为孤儿
    for (const re of mod.reExports) {
      const t = resolveImport(mod.rel, re.from, relSet)
      if (t && !edges.includes(t)) edges.push(t)
    }
    graph.set(mod.rel, edges)
  }
  for (const cyc of findCycles(graph)) {
    const m0 = mods.get(cyc[0]!)
    const next = cyc.length > 1 ? cyc[1]! : cyc[0]!
    const node = m0 ? findImportNode(m0, next, relSet) : undefined
    const pos = (node && m0) ? loc(m0.sf, node.getStart(m0.sf)) : { line: 1, column: 1 }
    const f = makeFinding(cyc[0]!, pos.line, pos.column, 'arch:circular-dep', 'Warning', '架构健康',
      `检测到循环依赖: ${cyc.join(' → ')}`, '重构依赖方向，抽取公共模块打破循环')
    if (f) findings.push(f)
  }

  // 孤儿模块
  const importers = new Set<string>()
  for (const edges of graph.values()) for (const e of edges) importers.add(e)
  for (const mod of mods.values()) {
    if (ENTRY_PREFIXES.some((p) => mod.rel.startsWith(p))) continue
    const outgoing = (graph.get(mod.rel)?.length ?? 0) > 0
    const incoming = importers.has(mod.rel)
    if (!outgoing && !incoming) {
      const f = makeFinding(mod.rel, 1, 1, 'arch:orphan-module', 'Minor', '架构健康',
        `模块 "${mod.rel}" 既无项目内导入也无被引用，疑似孤儿模块`,
        '确认是否仍被使用；若为死代码请删除')
      if (f) findings.push(f)
    }
  }

  return findings
}

// ============================================================
// 基线门禁（P2.2）
// ============================================================

const BASELINE_PATH = path.resolve(ROOT, 'docs/reports/audit/quality-baseline.json')

function keyOf(f: Finding): string {
  return `${f.file}:${f.line}:${f.ruleId}`
}

function saveBaseline(violations: Finding[]): void {
  const entries: Record<string, { severity: string; ruleId: string }> = {}
  for (const v of violations) entries[keyOf(v)] = { severity: v.severity, ruleId: v.ruleId }
  const data = { version: 1, savedAt: new Date().toISOString(), totalViolations: violations.length, entries }
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true })
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

function applyBaselineCheck(violations: Finding[]): { baselineCount: number; newViolations: number; newBlocking: number } {
  let base: { entries?: Record<string, unknown> } | null = null
  try {
    base = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'))
  } catch {
    base = null
  }
  const entries = base?.entries ?? {}
  let newViolations = 0
  let newBlocking = 0
  for (const v of violations) {
    const isNew = !(keyOf(v) in entries)
    v.isNew = isNew
    if (isNew) {
      newViolations++
      if (v.severity !== 'Warning') newBlocking++
    }
  }
  return { baselineCount: Object.keys(entries).length, newViolations, newBlocking }
}

// ============================================================
// 复用既有审计管道契约
// ============================================================

/**
 * 扫描（纯数据，供管道与测试复用）。
 * 统一入口：收集文件 → 解析为 ParsedFile（建树一次，单文件与跨文件分析复用）→ 单文件分析 → 可选跨文件分析 → 基线处理。
 * @param options.root 相对 ROOT 的扫描根目录（默认 CLI.root，即 'src'）
 * @param options.crossFile 是否启用跨文件架构分析（默认 CLI.crossFile）
 * @param options.baseline 'save' 保存基线 | 'check' 对比基线（默认 CLI.baseline）
 * @param options.includeTests 是否纳入测试文件（默认 CLI.includeTests）
 * @returns 结构化的扫描报告（含 violations 与聚合 summary）
 */
export function scan(options?: {
  root?: string
  crossFile?: boolean
  baseline?: 'save' | 'check' | undefined
  includeTests?: boolean
}): Report {
  const root = options?.root ?? CLI.root
  const crossFile = options?.crossFile ?? CLI.crossFile
  const baseline = options?.baseline ?? CLI.baseline
  const includeTests = options?.includeTests ?? CLI.includeTests

  const absRoot = path.resolve(ROOT, root)
  const files = collectFiles(absRoot)
  // S3：建树一次，单文件与跨文件分析复用同一 ParsedFile，避免二次建树
  const parsed = files
    .map((f) => parseFile(f, includeTests))
    .filter((p): p is ParsedFile => p !== null)
  const relSet = new Set(parsed.map((p) => p.rel))

  const violations: Finding[] = []
  for (const p of parsed) violations.push(...analyzeFile(p))
  if (crossFile) violations.push(...analyzeCrossFile(parsed, relSet))

  let baselineResult: { baselineCount: number; newViolations: number; newBlocking: number } | undefined
  if (baseline === 'save') {
    saveBaseline(violations)
  } else if (baseline === 'check') {
    baselineResult = applyBaselineCheck(violations)
  }

  const bySeverity: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  const byRule: Record<string, number> = {}
  for (const v of violations) {
    bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1
    byCategory[v.category] = (byCategory[v.category] ?? 0) + 1
    byRule[v.ruleId] = (byRule[v.ruleId] ?? 0) + 1
  }
  const totalWarnings = violations.filter((v) => v.severity === 'Warning').length

  return {
    violations,
    summary: {
      totalFiles: parsed.length,
      totalViolations: violations.length,
      totalWarnings,
      bySeverity,
      byCategory,
      byRule,
      ...(baselineResult ? { baseline: baselineResult } : {}),
    },
  }
}

const SEV_ORDER: Finding['severity'][] = ['Fatal', 'Critical', 'Major', 'Minor', 'Warning']
const SEV_COLOR: Record<Finding['severity'], 'red' | 'yellow' | 'green'> = {
  Fatal: 'red', Critical: 'red', Major: 'yellow', Minor: 'yellow', Warning: 'green',
}

/** 人类可读报告（输出到 stderr），含按严重度的整改分组 */
export function formatReport(report: Report): string {
  const out: string[] = []
  out.push('╔════════════════════════════════════════════════════════════╗')
  out.push('║  增强型静态代码分析 — audit-quality-enhanced v1.4          ║')
  out.push('╚════════════════════════════════════════════════════════════╝')
  out.push('')

  if (report.violations.length === 0) {
    out.push(colorize('✅ 未发现阻断性代码质量问题', 'green'))
  } else {
    for (const sev of SEV_ORDER) {
      const items = report.violations.filter((v) => v.severity === sev)
      if (items.length === 0) continue
      out.push(colorize(`\n── ${sev}（${items.length}）──`, SEV_COLOR[sev]))
      for (const v of items) {
        const tag = v.isNew ? ' [NEW]' : ''
        out.push(`  ${v.file}:${v.line}:${v.column} [${v.ruleId}]${tag}`)
        out.push(`    ${v.message}`)
        out.push(`    修复建议: ${v.suggestion}`)
        if (v.context) out.push(`    上下文: ${v.context}`)
      }
    }
  }

  out.push('\n────────────────────────────────────────────────────────────')
  out.push(`扫描文件数: ${report.summary.totalFiles}`)
  out.push(`问题总数: ${report.summary.totalViolations}（其中 Warning ${report.summary.totalWarnings}）`)
  out.push('按严重度: ' + Object.entries(report.summary.bySeverity).map(([k, n]) => `${k}=${n}`).join('  '))
  out.push('按类别: ' + Object.entries(report.summary.byCategory).map(([k, n]) => `${k}=${n}`).join('  '))

  if (report.summary.baseline) {
    const b = report.summary.baseline
    out.push(`\n── 基线对比（--baseline check）──`)
    out.push(`基线存量: ${b.baselineCount} 条；本次新增: ${b.newViolations} 条（其中阻断 ${b.newBlocking} 条）`)
    out.push('仅新增阻断项会退出码 1，存量渐进收敛。')
  }

  const blocking = report.violations.filter((v) => v.severity !== 'Warning')
  if (blocking.length > 0) {
    out.push('\n──────── 整改计划 ────────────────')
    out.push(`P0/P1 阻断项（${blocking.length}）：优先修复安全漏洞(Critical)与潜在缺陷(Major)`)
    const crit = blocking.filter((v) => v.severity === 'Critical' || v.severity === 'Major')
    const byRule = new Map<string, number>()
    for (const v of crit) byRule.set(v.ruleId, (byRule.get(v.ruleId) ?? 0) + 1)
    for (const [rule, n] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
      out.push(`  - ${rule}: ${n} 处`)
    }
    out.push('预期改进目标：消除全部 Critical/Major，将阻断项降至 0；Warning 类逐步收敛。')
  }
  return out.join('\n')
}

// ============================================================
// SARIF 输出（P1.5）
// ============================================================

function buildSarif(report: Report): unknown {
  const rules = new Map<string, { id: string; short: string }>()
  for (const v of report.violations) {
    if (!rules.has(v.ruleId)) rules.set(v.ruleId, { id: v.ruleId, short: `${v.category} - ${v.ruleId}` })
  }
  const sarifRules = [...rules.values()].map((r) => ({
    id: r.id,
    shortDescription: { text: r.short },
    properties: { category: r.short.split(' - ')[0] },
  }))
  const results = report.violations.map((v) => {
    const level = v.severity === 'Warning' || v.severity === 'Minor' ? 'warning' : 'error'
    return {
      ruleId: v.ruleId,
      level,
      message: { text: `${v.message} | 修复建议: ${v.suggestion}` },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: v.file },
          region: { startLine: v.line, startColumn: v.column },
        },
      }],
      properties: { category: v.category, severity: v.severity },
    }
  })
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: SCRIPT_NAME,
          version: VERSION,
          rules: sarifRules,
        },
      },
      results,
    }],
  }
}

// ============================================================
// 与既有审计聚合（P2.4，--aggregate）
// ============================================================

interface RawAuditReport {
  meta?: { scriptName?: string; timestamp?: string }
  scriptName?: string
  summary?: Record<string, unknown>
}

/**
 * 与既有审计报告聚合（--aggregate）：扫描落盘目录中的各脚本 JSON 报告，
 * 按脚本名/时间聚合"问题总数"与按严重度分布，生成 docs/reports/audit/health-dashboard.json。
 * 独立分支：不触发扫描，直接退出。
 */
function runAggregate(): void {
  // 同时覆盖顶层归档与管道实际落盘目录（scripts/_debug 管道的 ROOT 解析差异），按文件名去重
  const dirs = [
    path.resolve(ROOT, 'docs/reports/audit'),
    path.resolve(ROOT, 'scripts/docs/reports/audit'),
  ]
  const seen = new Set<string>()
  const reports: Array<{
    file: string; scriptName: string; timestamp: string | null;
    totalViolations: number; totalFiles: number | null;
    bySeverity: Record<string, number> | null; byRule: Record<string, number> | null;
  }> = []
  for (const dir of dirs) {
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.json')) continue
      if (seen.has(e.name)) continue
      if (e.name === 'quality-baseline.json' || e.name === 'health-dashboard.json') continue
      seen.add(e.name)
      const fp = path.join(dir, e.name)
      let r: RawAuditReport
      try {
        r = JSON.parse(fs.readFileSync(fp, 'utf-8')) as RawAuditReport
      } catch {
        continue
      }
    const sum = r.summary
    if (!sum || typeof sum !== 'object') continue
    // 兼容异构既有报告：提取可加总的"问题总数"
    const total =
      typeof sum.totalViolations === 'number' ? sum.totalViolations :
      typeof sum.total === 'number' ? sum.total :
      ((typeof sum.errorCount === 'number' ? sum.errorCount : 0) +
        (typeof sum.warnCount === 'number' ? sum.warnCount : 0) +
        (typeof sum.circularCount === 'number' ? sum.circularCount : 0) +
        (typeof sum.orphanCount === 'number' ? sum.orphanCount : 0))
    if (typeof total !== 'number') continue
    reports.push({
      file: e.name,
      scriptName: r.meta?.scriptName ?? (r.scriptName ?? e.name.replace(/\.json$/, '')),
      timestamp: r.meta?.timestamp ?? null,
      totalViolations: total,
      totalFiles: typeof sum.totalFiles === 'number' ? sum.totalFiles : null,
      bySeverity: (sum.bySeverity && typeof sum.bySeverity === 'object') ? (sum.bySeverity as Record<string, number>) : null,
      byRule: (sum.byRule && typeof sum.byRule === 'object') ? (sum.byRule as Record<string, number>) : null,
    })
    }
  }
  reports.sort((a, b) => b.totalViolations - a.totalViolations)
  const totals = reports.reduce(
    (acc, r) => {
      acc.totalViolations += r.totalViolations
      if (r.bySeverity) {
        for (const [k, n] of Object.entries(r.bySeverity)) {
          acc.bySeverity[k] = (acc.bySeverity[k] ?? 0) + (n as number)
        }
      }
      return acc
    },
    { totalViolations: 0, bySeverity: {} as Record<string, number> },
  )
  const dashboard = { generatedAt: new Date().toISOString(), reportCount: reports.length, totals, reports }
  const outPath = path.resolve(ROOT, 'docs/reports/audit/health-dashboard.json')
  fs.writeFileSync(outPath, JSON.stringify(dashboard, null, 2), 'utf-8')
  writeStdoutJson(dashboard)
  logDiagnostic(`📋 聚合 ${reports.length} 份审计报告 → 健康看板: ${outPath}`, CLI.quiet)
  process.exit(0)
}

// ============================================================
// CLI 入口
// ============================================================

function blockingCount(report: Report): number {
  return report.summary.totalViolations - report.summary.totalWarnings
}

/**
 * CLI 入口：按参数分派运行模式。
 *  - --aggregate：跨报告聚合生成健康看板（独立分支）
 *  - --baseline save：保存当前违规为基线并退出 0
 *  - --baseline check：对比基线，仅新增阻断项退出码 1
 *  - --format sarif：输出 SARIF
 *  - 默认：复用既有审计管道（stdout=JSON，stderr=报告，落盘 docs/reports/audit）
 * 退出码：0=无阻断/基线无新增，1=有阻断性违规，2=执行错误。
 */
export function main(): void {
  // 聚合模式：独立分支，不触发扫描
  if (CLI.aggregate) {
    runAggregate()
    return
  }

  // 基线保存模式：独立分支，退出码 0
  if (CLI.baseline === 'save') {
    const report = scan()
    const out = {
      baselineSaved: true,
      totalViolations: report.summary.totalViolations,
      path: relative(BASELINE_PATH),
    }
    writeStdoutJson(out)
    logDiagnostic(`💾 基线已保存: ${report.summary.totalViolations} 条违规 → ${out.path}`, CLI.quiet)
    process.exit(0)
  }

  // 基线检查模式：仅新增阻断项退出码 1
  if (CLI.baseline === 'check') {
    const report = scan()
    writeStdoutJson(report)
    if (!CLI.quiet) writeStderr('\n' + formatReport(report) + '\n')
    if (!CLI.noPersist) persistReport(report, SCRIPT_NAME, CLI.output)
    const newBlocking = report.summary.baseline?.newBlocking ?? 0
    logDiagnostic(`✅ 基线检查完成，新增阻断项: ${newBlocking}`, CLI.quiet)
    process.exit(newBlocking > 0 ? 1 : 0)
  }

  // SARIF 输出模式
  if (CLI.format === 'sarif') {
    const report = scan()
    writeStdoutJson(buildSarif(report))
    if (!CLI.quiet) logDiagnostic(`📊 SARIF 输出: ${report.summary.totalViolations} 条结果`, CLI.quiet)
    process.exit(blockingCount(report) > 0 ? 1 : 0)
  }

  // 默认：复用既有审计管道
  const result = runAuditPipeline({
    scriptName: SCRIPT_NAME,
    version: VERSION,
    scanFn: scan,
    formatReportFn: formatReport,
  })
  process.exit(result.exitCode)
}

// 兼容两种调用方式：
//  - npx tsx scripts/audit-quality-enhanced.ts  → 脚本为 argv[1]
//  - node ./node_modules/tsx/dist/cli.mjs scripts/audit-quality-enhanced.ts → 脚本为 argv[2]
const isMain =
  process.argv[1] &&
  (import.meta.url === pathToFileURL(process.argv[1]).href ||
    import.meta.url === pathToFileURL(process.argv[2] ?? 'x').href)
if (isMain) {
  main()
}
