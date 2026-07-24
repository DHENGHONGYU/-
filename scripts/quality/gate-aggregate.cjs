#!/usr/bin/env node
/**
 * gate-aggregate.cjs — 统一量化质量门禁聚合器（SonarQube 式）
 *
 * 目的：将分散的 pre-push / CI 门禁汇总为单一质量门禁结论，输出
 *   - 各门禁 通过/阻断 状态
 *   - 加权质量分（0-100）
 *   - 趋势基线（.quality-gate-baseline.json），用于检测门禁健康度退化
 *
 * 设计原则（对齐项目"状态事实实时校验"铁律）：
 *   - 每个门禁实际运行并读取真实退出码，不做记忆估算
 *   - 任一 P0 门禁失败 → 整体 FAIL
 *   - 权重反映各门禁对"可发布性"的贡献度
 *
 * 退出码：0=全部通过, 1=有阻断项, 2=执行异常
 *
 * 用法：node scripts/quality/gate-aggregate.cjs [--json]
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const BASELINE_PATH = path.join(ROOT, '.quality-gate-baseline.json')

// 门禁定义：权重之和为 100
const GATES = [
  { id: 'tsc:prod', npm: 'tsc:prod', weight: 25, desc: '生产类型检查' },
  { id: 'layers', npm: 'audit:layers', weight: 15, desc: '跨层调用审计' },
  { id: 'acl-consistency', npm: 'audit:acl-consistency', weight: 10, desc: 'ACL 权限矩阵一致性' },
  { id: 'atomic', npm: 'audit:atomic', weight: 10, desc: '原子组件层级边界' },
  { id: 'db-references', npm: 'audit:db-references', weight: 10, desc: '数据库定义交叉引用' },
  { id: 'secrets', npm: 'audit:secrets', weight: 10, desc: '密钥/敏感信息扫描' },
  { id: 'widget-registry', npm: 'audit:widget-registry', weight: 8, desc: 'Widget 三处注册一致性' },
  { id: 'complexity', npm: 'complexity-scan', weight: 7, desc: '代码复杂度（债务上限冻结）' },
  { id: 'version-drift', npm: 'audit:docs', weight: 5, desc: '文档版本/同步' },
]

function runGate(gate) {
  try {
    execFileSync('npm', ['run', gate.npm], {
      cwd: ROOT,
      stdio: 'ignore',
      timeout: 180000,
    })
    return { id: gate.id, desc: gate.desc, weight: gate.weight, passed: true, error: null }
  } catch (e) {
    const err = e.code === 'ETIMEDOUT' ? 'timeout' : (e.stderr ? e.stderr.toString().slice(0, 200) : e.message)
    return { id: gate.id, desc: gate.desc, weight: gate.weight, passed: false, error: err }
  }
}

function loadBaseline() {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'))
  } catch {
    return null
  }
}

function main() {
  const jsonMode = process.argv.includes('--json')
  const results = GATES.map(runGate)
  const failed = results.filter((r) => !r.passed)
  const score = results.reduce((sum, r) => sum + (r.passed ? r.weight : 0), 0)
  const passedCount = results.length - failed.length
  const overall = failed.length === 0

  const report = {
    timestamp: new Date().toISOString(),
    overall: overall ? 'PASS' : 'FAIL',
    score,
    passed: passedCount,
    total: results.length,
    gates: results,
  }

  if (jsonMode) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } else {
    process.stderr.write('╔════════════════════════════════════════════════════════════╗\n')
    process.stderr.write('║  统一质量门禁聚合 — gate-aggregate.cjs                     ║\n')
    process.stderr.write('╚════════════════════════════════════════════════════════════╝\n\n')
    for (const r of results) {
      const icon = r.passed ? '✅' : '🔴'
      process.stderr.write(`  ${icon} [${String(r.weight).padStart(2)}] ${r.id.padEnd(16)} ${r.desc}\n`)
    }
    process.stderr.write(`\n  质量分: ${score}/100  (通过 ${passedCount}/${results.length})\n`)
    process.stderr.write(`  结论: ${overall ? '✅ PASS（可发布）' : '❌ FAIL（存在阻断项）'}\n`)
  }

  // 趋势基线：首次运行记录，后续对比分数退化
  const baseline = loadBaseline()
  if (baseline) {
    const delta = score - (baseline.score ?? 0)
    if (!jsonMode) {
      process.stderr.write(`  趋势: 上次 ${baseline.score}/100，本次 ${score}/100（${delta >= 0 ? '+' : ''}${delta}）\n`)
    }
  } else if (!jsonMode) {
    process.stderr.write('  趋势: 首次运行，已建立基线\n')
  }
  try {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({ score, timestamp: report.timestamp }, null, 2) + '\n')
  } catch {
    /* 非关键 */
  }

  process.exit(overall ? 0 : 1)
}

main()
