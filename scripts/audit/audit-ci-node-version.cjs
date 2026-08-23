#!/usr/bin/env node
/**
 * audit-ci-node-version.cjs — CI 工作流 Node 版本防漂移审计
 *
 * better-harness F-005 防回归门禁：核对 .github/workflows/*.yml 中所有
 * node-version / NODE_VERSION 声明与 .nvmrc 声明的 Node 主版本一致。
 *
 * 背景：2026-08-23 前 8+ 个工作流停留在 Node 20，而 .nvmrc / DevContainer /
 * pre-commit / ci.yml 均为 Node 22，导致"本地绿、CI 异"的信号分裂。
 *
 * 退出码：0 = 全量一致；1 = 存在版本漂移（列出文件与行号）。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const NVMRC = path.join(ROOT, '.nvmrc')
const WF_DIR = path.join(ROOT, '.github', 'workflows')

const expected = fs.readFileSync(NVMRC, 'utf8').trim().replace(/^v/i, '')
if (!/^\d+$/.test(expected)) {
  console.error(`[audit-ci-node-version] 无法解析 .nvmrc 主版本: "${expected}"`)
  process.exit(1)
}

const violations = []
for (const file of fs.readdirSync(WF_DIR).filter(f => /\.(yml|yaml)$/.test(f))) {
  const lines = fs.readFileSync(path.join(WF_DIR, file), 'utf8').split(/\r?\n/)
  lines.forEach((line, idx) => {
    // 仅检查字面量版本声明；${{ env.* }} 间接引用由 NODE_VERSION 源头行兜住
    const m = line.match(/^\s*(?:-\s*)?(node-version|NODE_VERSION):\s*['"]?(\d+(?:\.\d+)*)['"]?/)
    if (!m) return
    const declaredMajor = m[2].split('.')[0]
    if (declaredMajor !== expected) {
      violations.push(`${file}:${idx + 1} ${m[1]}: ${m[2]}（期望主版本 ${expected}，与 .nvmrc 对齐）`)
    }
  })
}

console.log(`=== CI Node 版本防漂移审计（基线：.nvmrc = Node ${expected}） ===`)
if (violations.length === 0) {
  console.log(`审计通过：所有工作流 node-version 均为 Node ${expected}`)
  process.exit(0)
}
console.error(`发现 ${violations.length} 处版本漂移：`)
violations.forEach(v => console.error('  ✗ ' + v))
process.exit(1)
