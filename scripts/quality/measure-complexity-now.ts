/**
 * measure-complexity-now.ts
 *
 * 独立、口径对齐当前代码的复杂度实测工具。
 * 口径对齐 optimization-plan.md（源自已删除的 nested-review-v2.cjs）：
 *   - 深层嵌套：函数体内最大花括号嵌套深度 >= 4（不强制要求含循环）
 *   - 长链条件：if / else if / else 链分支数 >= 4
 *   - 重复条件：同一函数内逐字相同的 if/else-if 条件文本重复出现 >= 2 次
 *
 * 与项目 canonical complexity-scan.ts 的区别：
 *   canonical 对"深层嵌套"强制 loopDepth>=1、对"长链"阈值>=6、对"重复"要求同函数逐字，
 *   因此 canonical 报告 0/0/0 会漏报本脚本能捕获的真实债务。
 *
 * 输出：stdout JSON（summary + violations[]），供后续优化与回归比对。
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

const NEST_THRESHOLD = 4
const CHAIN_THRESHOLD = 4

interface Violation {
  file: string
  func: string
  line: number
  type: 'deep-nesting' | 'long-chain' | 'dup-condition'
  metric: number // 嵌套深度 / 链分支数 / 重复组数
  detail: string
}

const violations: Violation[] = []

/** 计算函数体内最大花括号嵌套深度（不把内部嵌套函数体计入同一深度） */
function measureNestingDepth(node: ts.Node): { maxDepth: number; current: number } {
  let maxDepth = 0
  function walk(n: ts.Node, depth: number): void {
    if (ts.isBlock(n)) {
      const d = depth + 1
      if (d > maxDepth) maxDepth = d
      n.statements.forEach((s) => walk(s, d))
      return
    }
    // 进入新的函数作用域：深度归零后重新计算
    if (
      ts.isFunctionDeclaration(n) ||
      ts.isMethodDeclaration(n) ||
      ts.isFunctionExpression(n) ||
      ts.isArrowFunction(n) ||
      ts.isGetAccessorDeclaration(n) ||
      ts.isConstructorDeclaration(n)
    ) {
      // 函数体单独测
      const body = (n as ts.FunctionLikeDeclaration).body
      if (body && ts.isBlock(body)) {
        const d = 1
        if (d > maxDepth) maxDepth = d
        body.statements.forEach((s) => walk(s, d))
      }
      // 不递归进参数/类型，但函数表达式可能出现在语句中（如变量赋值），已由上层 block walk 覆盖
      return
    }
    n.forEachChild((c) => walk(c, depth))
  }
  // 从函数体顶层开始
  const body = (node as ts.FunctionLikeDeclaration).body
  if (body && ts.isBlock(body)) {
    body.statements.forEach((s) => walk(s, 1))
  }
  return { maxDepth, current: 0 }
}

/** 返回从某个 if 语句开始的最长 if/else-if/else 链分支数 */
function chainLengthOf(ifNode: ts.IfStatement): number {
  let len = 1
  let cur: ts.Statement | undefined = ifNode.elseStatement
  while (cur) {
    if (ts.isIfStatement(cur)) {
      len += 1
      cur = cur.elseStatement
    } else {
      // else 块（非 if）算 1 个收尾分支
      len += 1
      break
    }
  }
  return len
}

/** 收集函数内所有 if/else-if 的条件的标准化文本 */
function collectConditionTexts(n: ts.Node, out: string[]): void {
  if (ts.isIfStatement(n)) {
    out.push(n.expression.getText().replace(/\s+/g, ' ').trim())
    collectConditionTexts(n.thenStatement, out)
    if (n.elseStatement) collectConditionTexts(n.elseStatement, out)
    return
  }
  n.forEachChild((c) => collectConditionTexts(c, out))
}

function analyzeFunction(file: string, fn: ts.Node, name: string, line: number): void {
  // 嵌套深度
  const { maxDepth } = measureNestingDepth(fn)
  if (maxDepth >= NEST_THRESHOLD) {
    violations.push({
      file: path.relative(ROOT, file),
      func: name,
      line,
      type: 'deep-nesting',
      metric: maxDepth,
      detail: `真实嵌套深度 ${maxDepth}`,
    })
  }

  // 最长链
  let maxChain = 0
  function findChains(n: ts.Node): void {
    if (ts.isIfStatement(n)) {
      const len = chainLengthOf(n)
      if (len > maxChain) maxChain = len
      // 递归进入 then/else 找嵌套链
      findChains(n.thenStatement)
      if (n.elseStatement) findChains(n.elseStatement)
    } else {
      n.forEachChild((c) => findChains(c))
    }
  }
  findChains(fn)
  if (maxChain >= CHAIN_THRESHOLD) {
    violations.push({
      file: path.relative(ROOT, file),
      func: name,
      line,
      type: 'long-chain',
      metric: maxChain,
      detail: `if-else-if 链最长 ${maxChain} 分支`,
    })
  }

  // 重复条件
  const conds: string[] = []
  collectConditionTexts(fn, conds)
  const counts = new Map<string, number>()
  for (const c of conds) counts.set(c, (counts.get(c) ?? 0) + 1)
  let dupGroups = 0
  for (const [, v] of counts) if (v >= 2) dupGroups += 1
  if (dupGroups >= 1) {
    violations.push({
      file: path.relative(ROOT, file),
      func: name,
      line,
      type: 'dup-condition',
      metric: dupGroups,
      detail: `重复条件 ${dupGroups} 组`,
    })
  }
}

function analyzeFile(file: string): void {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function walk(n: ts.Node): void {
    if (
      ts.isFunctionDeclaration(n) ||
      ts.isMethodDeclaration(n) ||
      ts.isGetAccessorDeclaration(n) ||
      ts.isConstructorDeclaration(n)
    ) {
      const name =
        (n as ts.FunctionDeclaration).name?.getText(sf) ??
        (ts.isMethodDeclaration(n) ? (n.name as ts.Identifier).getText(sf) : '<arrow>')
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
      analyzeFunction(file, n, name, line)
    }
    // 顶层箭头函数赋值（const x = () => {...}）
    if (ts.isVariableStatement(n)) {
      for (const decl of n.declarationList.declarations) {
        if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
          const name = decl.name.getText(sf)
          const line = sf.getLineAndCharacterOfPosition(decl.getStart(sf)).line + 1
          analyzeFunction(file, decl.initializer, name, line)
        }
      }
    }
    n.forEachChild(walk)
  }
  walk(sf)
}

function collectFiles(dir: string, acc: string[]): void {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'coverage' || ent.name === '__tests__') continue
      collectFiles(full, acc)
    } else if (/\.(ts|tsx)$/.test(ent.name) && !/\.test\.|\.spec\.|\.d\.ts$/.test(ent.name)) {
      acc.push(full)
    }
  }
}

const files: string[] = []
collectFiles(SRC, files)
for (const f of files) analyzeFile(f)

const byType: Record<string, number> = {}
for (const v of violations) byType[v.type] = (byType[v.type] ?? 0) + 1

// 按文件聚合，便于阅读
const byFile = new Map<string, Violation[]>()
for (const v of violations) {
  if (!byFile.has(v.file)) byFile.set(v.file, [])
  byFile.get(v.file)!.push(v)
}

const result = {
  summary: {
    filesScanned: files.length,
    totalViolations: violations.length,
    byType,
  },
  violations: violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
}

console.log(JSON.stringify(result, null, 2))
