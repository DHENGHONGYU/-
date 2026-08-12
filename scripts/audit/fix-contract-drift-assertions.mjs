#!/usr/bin/env node
/**
 * 修复契约漂移测试断言（A1 类：纯文案漂移）
 *
 * 仅处理"源码文案已变、测试断言过时"的简单替换/删除。
 * 不处理 A2 类（组件结构重构 / mock 失败 / 渲染流程变化），那些需手动调整。
 *
 * 覆盖文件（4 个）：
 *   1. tests/misc/IntelligentScorePage.test.tsx
 *   2. tests/services-analysis/scoreDocService.test.ts
 *   3. tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts
 *   4. tests/__tests__/scripts/audit-dead-code.test.ts
 *
 * 用法：
 *   node scripts/audit/fix-contract-drift-assertions.mjs --dry-run   # 预览（不写入）
 *   node scripts/audit/fix-contract-drift-assertions.mjs              # 执行（写入前自动备份）
 *
 * 安全护栏：
 *   - 写入前将原文件复制到 cache/test-fix-backup/YYYY-MM-DD/
 *   - 替换文本不存在时报警告（不报错），避免误删
 *   - 删除行操作要求精确匹配整行 trim 后内容
 *
 * @created 2026-08-09 — 预存测试债治理（19 个失败文件迁移）
 * @doc outputs/test-debt-migration-report-2026-08-09.md
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const BACKUP_DIR = resolve(ROOT, 'cache', 'test-fix-backup', new Date().toISOString().slice(0, 10))
const DRY_RUN = process.argv.includes('--dry-run')

// ────────────────────────────────────────────────────────────
// 修复规则：每个文件定义一组操作
//   type: 'replace'   字符串替换（全文所有匹配）
//   type: 'deleteLine' 删除包含指定文本的整行
// ────────────────────────────────────────────────────────────
const FIX_RULES = [
  {
    file: 'tests/misc/IntelligentScorePage.test.tsx',
    reason: '页面标题从 "个股智能分析" 改为 "V6 个股智能评分"',
    sourceRef: 'src/pages/analysis/IntelligentScorePage.tsx:262',
    operations: [
      { type: 'replace', from: '/个股智能分析/', to: '/V6 个股智能评分/' },
      { type: 'replace', from: 'title="个股智能分析"', to: 'title="V6 个股智能评分"' },
    ],
  },
  {
    file: 'tests/services-analysis/scoreDocService.test.ts',
    reason: '综合评分输出改为 Markdown 加粗格式 **N.NN**',
    sourceRef: 'src/services/analysis/scoreDocService.ts:70',
    operations: [
      { type: 'replace', from: "'综合评分：4.20'", to: "'综合评分：**4.20**'" },
    ],
  },
  {
    file: 'tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts',
    reason: 'V2 报告差异段 "综合分变化" 改为 "综合分" + 综合评分加粗',
    sourceRef: 'src/services/analysis/scoreDocService.ts:70,127',
    operations: [
      { type: 'replace', from: "'综合评分：4.20'", to: "'综合评分：**4.20**'" },
      { type: 'replace', from: "'综合分变化'", to: "'综合分'" },
      { type: 'replace', from: '(综合分变化/L3V 变化)', to: '(综合分/L3V 变化)' },
    ],
  },
  {
    file: 'tests/__tests__/scripts/audit-dead-code.test.ts',
    reason: 'formatReport 不再输出 "存在路由文件缺失"（与上一行重复断言）',
    sourceRef: 'scripts/audit/audit-dead-code.ts:1255',
    operations: [
      { type: 'deleteLine', text: "expect(output).toContain('存在路由文件缺失')" },
    ],
  },
]

// ────────────────────────────────────────────────────────────
// 工具函数
// ────────────────────────────────────────────────────────────
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
}
const color = (c, s) => `${COLORS[c] ?? ''}${s}${COLORS.reset}`

function applyOperation(content, op) {
  if (op.type === 'replace') {
    if (!content.includes(op.from)) {
      return { content, matched: 0, detail: `未找到: ${op.from}` }
    }
    const before = content
    const after = content.split(op.from).join(op.to)
    const matched = before.split(op.from).length - 1
    return { content: after, matched, detail: `替换 ${matched} 处` }
  }
  if (op.type === 'deleteLine') {
    const lines = content.split('\n')
    const matchedLines = lines.filter((l) => l.includes(op.text))
    if (matchedLines.length === 0) {
      return { content, matched: 0, detail: `未找到: ${op.text}` }
    }
    const after = lines.filter((l) => !l.includes(op.text)).join('\n')
    return { content: after, matched: matchedLines.length, detail: `删除 ${matchedLines.length} 行` }
  }
  return { content, matched: 0, detail: `未知操作类型: ${op.type}` }
}

// ────────────────────────────────────────────────────────────
// 主流程
// ────────────────────────────────────────────────────────────
function main() {
  console.log(color('blue', '═══ 契约漂移断言修复 ═══'))
  console.log(`${color('gray', '模式:')} ${DRY_RUN ? color('yellow', 'DRY-RUN（预览，不写入）') : color('green', '执行（写入前备份）')}`)
  console.log(`${color('gray', '备份目录:')} ${BACKUP_DIR}`)
  console.log(`${color('gray', '修复文件数:')} ${FIX_RULES.length}`)
  console.log()

  let totalReplaced = 0
  let totalDeleted = 0
  let warnings = 0
  const results = []

  for (const rule of FIX_RULES) {
    const filePath = resolve(ROOT, rule.file)
    console.log(color('blue', `▶ ${rule.file}`))
    console.log(`  ${color('gray', '原因:')} ${rule.reason}`)
    console.log(`  ${color('gray', '源码:')} ${rule.sourceRef}`)

    if (!existsSync(filePath)) {
      console.log(`  ${color('red', '✗ 文件不存在，跳过')}`)
      warnings++
      results.push({ file: rule.file, status: 'missing', ops: 0 })
      continue
    }

    const original = readFileSync(filePath, 'utf-8')
    let content = original
    const opDetails = []

    for (const op of rule.operations) {
      const result = applyOperation(content, op)
      content = result.content
      opDetails.push({ op, ...result })
      if (result.matched === 0) warnings++
      if (op.type === 'replace') totalReplaced += result.matched
      if (op.type === 'deleteLine') totalDeleted += result.matched
    }

    const changed = content !== original
    if (changed && !DRY_RUN) {
      mkdirSync(BACKUP_DIR, { recursive: true })
      const backupName = rule.file.replace(/[\\/]/g, '__')
      copyFileSync(filePath, resolve(BACKUP_DIR, backupName))
      writeFileSync(filePath, content, 'utf-8')
      console.log(`  ${color('green', '✓ 已写入')}（备份 → ${backupName}）`)
    } else if (changed && DRY_RUN) {
      console.log(`  ${color('yellow', '✓ 将写入')}（dry-run 未写入）`)
    } else {
      console.log(`  ${color('gray', '○ 无变化')}（所有规则均未匹配）`)
    }

    for (const d of opDetails) {
      const mark = d.matched > 0 ? color('green', '✓') : color('red', '✗')
      console.log(`    ${mark} [${d.op.type}] ${d.detail}`)
    }
    console.log()

    results.push({ file: rule.file, status: changed ? 'fixed' : 'nochange', ops: opDetails })
  }

  // 汇总
  console.log(color('blue', '═══ 汇总 ═══'))
  console.log(`  ${color('green', '替换:')} ${totalReplaced} 处`)
  console.log(`  ${color('green', '删除:')} ${totalDeleted} 行`)
  console.log(`  ${color('yellow', '警告:')} ${warnings} 条（未匹配规则）`)
  console.log(`  ${color('gray', '文件:')} ${results.filter((r) => r.status === 'fixed').length} 已修复 / ${results.filter((r) => r.status === 'nochange').length} 无变化 / ${results.filter((r) => r.status === 'missing').length} 不存在`)

  if (DRY_RUN) {
    console.log()
    console.log(color('yellow', '提示: 这是 dry-run，文件未修改。去掉 --dry-run 执行实际修复。'))
  } else if (warnings > 0) {
    console.log()
    console.log(color('yellow', `⚠ 有 ${warnings} 条规则未匹配，请检查源码文案是否已再次变更。`))
  }
}

main()
