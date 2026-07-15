#!/usr/bin/env node
/**
 * complexity-scan.ts — 代码复杂度扫描 + 回归闸门
 *
 * 基于 TypeScript Compiler API 扫描三类复杂度问题：
 *   1. 深层嵌套（deeplyNestedBlocks）：If/For/While/Do/Try/Catch/Switch/Block 嵌套深度 ≥ 4
 *   2. 长链式条件（longElseIfChains）：连续 if-else-if 分支 ≥ 6
 *   3. 重复条件（duplicateIfConditions）：同一函数内相同 if 条件出现 ≥ 2 次
 *
 * 回归闸门：
 *   - 默认：按 .complexity-baseline.json 比对，新增即失败（债务只减不增）
 *   - --update-baseline：重新生成基线并退出 0
 *   - --strict：任意 P0 模块违规即失败
 *   - --p0-only：仅扫描 P0 模块
 *   - --json：stdout 输出 JSON
 *
 * 退出码：0=通过, 1=回归/严格失败, 2=执行错误
 */

import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 本脚本位于 scripts/quality/，需上溯两级才能到达仓库根（此前误写为 '..' 只到 scripts/，
// 导致 SRC_DIR=scripts/src 空扫、BASELINE_PATH=scripts/.complexity-baseline.json 找不到基线）
const ROOT = path.resolve(__dirname, '..', '..')
const SRC_DIR = path.join(ROOT, 'src')
const BASELINE_PATH = path.join(ROOT, '.complexity-baseline.json')

const P0_MODULES = [
  'src/core/databridge.ts',
  'src/core/databridgeHandlers.ts',
  'src/mcp/core/server.ts',
  'src/mcp/core/client.ts',
  'src/data/db-migrations.ts',
  'src/data/sectorDefinitions.ts',
]

const DEPTH_THRESHOLD = 4
const CHAIN_THRESHOLD = 6
const DUPLICATE_THRESHOLD = 2

const NESTING_KINDS = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.TryStatement,
])

const argv = process.argv.slice(2)
const FLAG_UPDATE = argv.includes('--update-baseline')
const FLAG_STRICT = argv.includes('--strict')
const FLAG_P0 = argv.includes('--p0-only')
const FLAG_JSON = argv.includes('--json')

interface Location {
  file: string
  function: string
  functionLine: number
  line: number
  column: number
}

interface NestedFinding extends Location {
  depth: number
  kind: string
  snippet: string
}

interface ChainFinding extends Location {
  branchCount: number
  lastLine: number
  snippet?: string
}

interface DuplicateFinding {
  file: string
  function: string
  condition: string
  occurrences: (Location & { snippet: string })[]
}

interface Report {
  summary: {
    filesScanned: number
    deeplyNestedBlocks: number
    longElseIfChains: number
    duplicateIfConditions: number
  }
  deeplyNestedBlocks: NestedFinding[]
  longElseIfChains: ChainFinding[]
  duplicateIfConditions: DuplicateFinding[]
}

interface BaselineShape {
  version: number
  generatedAt: string
  deeplyNestedBlocks: number
  longElseIfChains: number
  duplicateIfConditions: number
}

function rel(filePath: string): string {
  return path.relative(ROOT, filePath).replace(/\\/g, '/')
}

function walkDir(dir: string, ext: string, results: string[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(fullPath, ext, results)
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath)
    }
  }
}

function collectFiles(): string[] {
  if (FLAG_P0) {
    return P0_MODULES.map((m) => path.join(ROOT, m)).filter((f) => fs.existsSync(f))
  }
  const files: string[] = []
  walkDir(SRC_DIR, '.ts', files)
  walkDir(SRC_DIR, '.tsx', files)
  return files
}

function getLineAndColumn(sourceFile: ts.SourceFile, pos: number): { line: number; column: number } {
  const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, pos)
  return { line: line + 1, column: character + 1 }
}

function getNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile).replace(/\s+/g, ' ').trim().slice(0, 120)
}

function getConditionText(node: ts.IfStatement, sourceFile: ts.SourceFile): string {
  return node.expression.getText(sourceFile).replace(/\s+/g, ' ').trim()
}

function findFunctionName(node: ts.Node, sourceFile: ts.SourceFile): { name: string; line: number } {
  let current: ts.Node | undefined = node
  while (current) {
    if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current) || ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
      const name =
        (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current) || ts.isFunctionExpression(current)) && current.name
          ? current.name.getText(sourceFile)
          : '<arrow>'
      const line = getLineAndColumn(sourceFile, current.getStart(sourceFile)).line
      return { name, line }
    }
    if (ts.isClassDeclaration(current)) {
      return { name: current.name?.getText(sourceFile) ?? '<class>', line: getLineAndColumn(sourceFile, current.getStart(sourceFile)).line }
    }
    current = current.parent
  }
  return { name: '<module>', line: 1 }
}

function isElseIfChain(node: ts.IfStatement): number {
  let count = 1
  let current: ts.IfStatement = node
  while (current.parent && ts.isIfStatement(current.parent) && current.parent.elseStatement === current) {
    count++
    current = current.parent
  }
  return count
}

function getChainRoot(node: ts.IfStatement): ts.IfStatement {
  let current: ts.IfStatement = node
  while (current.parent && ts.isIfStatement(current.parent) && current.parent.elseStatement === current) {
    current = current.parent
  }
  return current
}

function scanFile(filePath: string): { nested: NestedFinding[]; chains: ChainFinding[]; duplicates: DuplicateFinding[] } {
  const content = fs.readFileSync(filePath, 'utf-8')
  const sourceFile = ts.createSourceFile(rel(filePath), content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const nested: NestedFinding[] = []
  const chains = new Map<string, ChainFinding>()
  const conditionsByFunction = new Map<string, Map<string, (Location & { snippet: string })[]>>()

  function walk(node: ts.Node, depth: number): void {
    const isNesting = NESTING_KINDS.has(node.kind)
    const nextDepth = isNesting ? depth + 1 : depth

    if (isNesting && nextDepth >= DEPTH_THRESHOLD) {
      const fn = findFunctionName(node, sourceFile)
      const { line, column } = getLineAndColumn(sourceFile, node.getStart(sourceFile))
      const kindName = ts.SyntaxKind[node.kind]
      nested.push({
        file: rel(filePath),
        function: fn.name,
        functionLine: fn.line,
        line,
        column,
        depth: nextDepth,
        kind: kindName,
        snippet: getNodeText(node, sourceFile),
      })
    }

    if (ts.isIfStatement(node)) {
      const branchCount = isElseIfChain(node)
      if (branchCount >= CHAIN_THRESHOLD) {
        const root = getChainRoot(node)
        const rootKey = `${filePath}:${root.getStart(sourceFile)}`
        if (!chains.has(rootKey)) {
          const fn = findFunctionName(root, sourceFile)
          const { line, column } = getLineAndColumn(sourceFile, root.getStart(sourceFile))
          const lastLine = getLineAndColumn(sourceFile, node.getEnd()).line
          chains.set(rootKey, {
            file: rel(filePath),
            function: fn.name,
            functionLine: fn.line,
            line,
            column,
            branchCount,
            lastLine,
            snippet: getNodeText(root, sourceFile),
          })
        }
      }

      const fn = findFunctionName(node, sourceFile)
      const fnKey = [rel(filePath), fn.name, String(fn.line)].join('::')
      if (!conditionsByFunction.has(fnKey)) conditionsByFunction.set(fnKey, new Map())
      const condMap = conditionsByFunction.get(fnKey)!
      const condText = getConditionText(node, sourceFile)
      const loc: Location & { snippet: string } = {
        file: rel(filePath),
        function: fn.name,
        functionLine: fn.line,
        ...getLineAndColumn(sourceFile, node.getStart(sourceFile)),
        snippet: getNodeText(node, sourceFile),
      }
      condMap.set(condText, [...(condMap.get(condText) || []), loc])
    }

    ts.forEachChild(node, (child) => walk(child, nextDepth))
  }

  walk(sourceFile, 0)

  const duplicates: DuplicateFinding[] = []
  for (const [fnKey, condMap] of conditionsByFunction) {
    const [file, fnName] = fnKey.split('::', 2)
    for (const [condition, occurrences] of condMap) {
      if (occurrences.length >= DUPLICATE_THRESHOLD) {
        duplicates.push({
          file,
          function: fnName,
          condition,
          occurrences,
        })
      }
    }
  }

  return { nested, chains: [...chains.values()], duplicates }
}

function collectAll(): Report {
  const files = collectFiles()
  const deeplyNestedBlocks: NestedFinding[] = []
  const longElseIfChains: ChainFinding[] = []
  const duplicateIfConditions: DuplicateFinding[] = []

  for (const file of files) {
    const result = scanFile(file)
    deeplyNestedBlocks.push(...result.nested)
    longElseIfChains.push(...result.chains)
    duplicateIfConditions.push(...result.duplicates)
  }

  return {
    summary: {
      filesScanned: files.length,
      deeplyNestedBlocks: deeplyNestedBlocks.length,
      longElseIfChains: longElseIfChains.length,
      duplicateIfConditions: duplicateIfConditions.length,
    },
    deeplyNestedBlocks,
    longElseIfChains,
    duplicateIfConditions,
  }
}

function buildBaseline(current: Report): BaselineShape {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    deeplyNestedBlocks: current.summary.deeplyNestedBlocks,
    longElseIfChains: current.summary.longElseIfChains,
    duplicateIfConditions: current.summary.duplicateIfConditions,
  }
}

function loadBaseline(): BaselineShape | null {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as BaselineShape
  } catch {
    return null
  }
}

function humanReport(current: Report, baseline: BaselineShape | null, regression: boolean): void {
  const w = (s: string) => process.stderr.write(s + '\n')
  w('╔══════════════════════════════════════════════════════════════════╗')
  w('║  代码复杂度扫描 — complexity-scan.ts v1.0                        ║')
  w('╚══════════════════════════════════════════════════════════════════╝')
  w('')
  w('扫描文件数: ' + current.summary.filesScanned)
  w('')
  w('── 深层嵌套（≥ ' + DEPTH_THRESHOLD + ' 层）────────────────────────────────────────')
  w('  当前: ' + current.summary.deeplyNestedBlocks + (baseline ? '  基线: ' + baseline.deeplyNestedBlocks : ''))
  if (current.summary.deeplyNestedBlocks > 0) {
    const top = current.deeplyNestedBlocks.slice(0, 5)
    for (const v of top) w('    · ' + v.file + ':' + v.line + ' (' + v.function + ') depth=' + v.depth)
    if (current.summary.deeplyNestedBlocks > 5) w('    · … 共 ' + current.summary.deeplyNestedBlocks + ' 处')
  }
  w('')
  w('── 长链式条件（≥ ' + CHAIN_THRESHOLD + ' 分支）──────────────────────────────────────')
  w('  当前: ' + current.summary.longElseIfChains + (baseline ? '  基线: ' + baseline.longElseIfChains : ''))
  if (current.summary.longElseIfChains > 0) {
    const top = current.longElseIfChains.slice(0, 5)
    for (const v of top) w('    · ' + v.file + ':' + v.line + ' (' + v.function + ') branches=' + v.branchCount)
    if (current.summary.longElseIfChains > 5) w('    · … 共 ' + current.summary.longElseIfChains + ' 处')
  }
  w('')
  w('── 重复 if 条件（≥ ' + DUPLICATE_THRESHOLD + ' 次）────────────────────────────────────')
  w('  当前: ' + current.summary.duplicateIfConditions + (baseline ? '  基线: ' + baseline.duplicateIfConditions : ''))
  if (current.summary.duplicateIfConditions > 0) {
    const top = current.duplicateIfConditions.slice(0, 5)
    for (const v of top) w('    · ' + v.file + ' (' + v.function + '): ' + v.condition)
    if (current.summary.duplicateIfConditions > 5) w('    · … 共 ' + current.summary.duplicateIfConditions + ' 处')
  }
  w('')
  if (FLAG_STRICT) {
    const total = current.summary.deeplyNestedBlocks + current.summary.longElseIfChains + current.summary.duplicateIfConditions
    w(total > 0 ? '⛔ 严格模式：发现 ' + total + ' 处违规 → 失败' : '✅ 严格模式：无违规')
  } else if (regression) {
    w('⛔ 回归：新增复杂度债务超过基线，CI 拦截')
  } else {
    w('✅ 通过：复杂度债务 ≤ 基线（债务只减不增）')
  }
  w('────────────────────────────────────────────────────────────────────')
}

function main(): void {
  let current: Report
  try {
    current = collectAll()
  } catch (e) {
    process.stderr.write('❌ 执行错误: ' + (e instanceof Error ? e.message : String(e)) + '\n')
    process.exit(2)
    return
  }

  const baseline = FLAG_UPDATE ? null : loadBaseline()

  if (FLAG_UPDATE) {
    const bl = buildBaseline(current)
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(bl, null, 2) + '\n', 'utf-8')
    if (FLAG_JSON) process.stdout.write(JSON.stringify({ action: 'baseline-updated', baseline: bl }, null, 2))
    humanReport(current, bl, false)
    process.stderr.write('📌 已生成基线: ' + rel(BASELINE_PATH) + '\n')
    process.exit(0)
    return
  }

  if (FLAG_JSON) {
    process.stdout.write(JSON.stringify({ current, baseline }, null, 2))
  }

  let regression = false
  if (FLAG_STRICT) {
    regression =
      current.summary.deeplyNestedBlocks > 0 ||
      current.summary.longElseIfChains > 0 ||
      current.summary.duplicateIfConditions > 0
  } else if (baseline) {
    regression =
      current.summary.deeplyNestedBlocks > baseline.deeplyNestedBlocks ||
      current.summary.longElseIfChains > baseline.longElseIfChains ||
      current.summary.duplicateIfConditions > baseline.duplicateIfConditions
  } else {
    process.stderr.write('⚠️ 未找到基线文件，请先运行: npm run complexity-scan -- --update-baseline\n')
  }

  humanReport(current, baseline, regression)
  process.exit(baseline || FLAG_STRICT ? (regression ? 1 : 0) : 0)
}

main()
