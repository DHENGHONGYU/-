/**
 * find-dups.ts — 诊断脚本（不修改源码）
 * 复用 measure-complexity-now.ts 的重复条件判定口径，
 * 额外打印每个违规函数里「逐字重复出现 >=2 次」的 if 条件文本及其出现位置。
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SRC = path.join(ROOT, 'src')

interface Hit { text: string; line: number }

function collectConds(n: ts.Node, sf: ts.SourceFile, out: Hit[]): void {
  if (ts.isIfStatement(n)) {
    const text = n.expression.getText(sf).replace(/\s+/g, ' ').trim()
    const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
    out.push({ text, line })
    collectConds(n.thenStatement, sf, out)
    if (n.elseStatement) collectConds(n.elseStatement, sf, out)
    return
  }
  n.forEachChild((c) => collectConds(c, sf, out))
}

function analyzeFunction(file: string, fn: ts.Node, sf: ts.SourceFile): void {
  const conds: Hit[] = []
  collectConds(fn, sf, conds)
  const counts = new Map<string, Hit[]>()
  for (const h of conds) {
    if (!counts.has(h.text)) counts.set(h.text, [])
    counts.get(h.text)!.push(h)
  }
  const dups = [...counts.entries()].filter(([, v]) => v.length >= 2)
  if (dups.length === 0) return
  const name =
    (ts.isFunctionDeclaration(fn) && fn.name?.getText(sf)) ||
    (ts.isMethodDeclaration(fn) && (fn.name as ts.Identifier).getText(sf)) ||
    (ts.isVariableStatement(fn.parent) && '') ||
    '<arrow>'
  let fnName = name as string
  if (ts.isVariableStatement(fn.parent)) {
    const vs = fn.parent as ts.VariableStatement
    fnName = vs.declarationList.declarations[0]?.name.getText(sf) ?? '<arrow>'
  }
  console.log(`\n### ${path.relative(ROOT, file)} :: ${fnName}`)
  for (const [text, hits] of dups) {
    console.log(`  重复(${hits.length}次): ${text}`)
    console.log(`    出现行: ${hits.map((h) => 'L' + h.line).join(', ')}`)
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
      analyzeFunction(file, n, sf)
    }
    if (ts.isVariableStatement(n)) {
      for (const decl of n.declarationList.declarations) {
        if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
          analyzeFunction(file, decl.initializer, sf)
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
      if (['node_modules', 'dist', 'coverage', '__tests__'].includes(ent.name)) continue
      collectFiles(full, acc)
    } else if (/\.(ts|tsx)$/.test(ent.name) && !/\.test\.|\.spec\.|\.d\.ts$/.test(ent.name)) {
      acc.push(full)
    }
  }
}

const files: string[] = []
collectFiles(SRC, files)
for (const f of files) analyzeFile(f)
