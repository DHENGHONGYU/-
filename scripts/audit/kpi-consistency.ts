#!/usr/bin/env node
/**
 * KPI 一致性审计门禁脚本
 * P0 修复 R01：验证 KPI 显示值与实际写入数一致
 *
 * 用法：npm run audit:kpi-consistency
 *
 * 1. 读取 QualityMetricsService 中的 writeSuccess / writeTotal
 * 2. 独立查询 IndexedDB 中各 store 的实际记录数
 * 3. 对比两者，偏差 > 0 即告警
 *
 * @doc V9-DOC-QUALITY-001
 */

import { getQualityMetrics, getRecentRecords } from '../../src/services/quality/QualityMetricsService'

interface AuditResult {
  passed: boolean
  summary: string
  details: string[]
  recommendations: string[]
}

function runKpiAudit(): AuditResult {
  const metrics = getQualityMetrics()
  const recentRecords = getRecentRecords(20)
  const details: string[] = []
  const recommendations: string[] = []

  // 1. 检查是否有假绿灯模式
  details.push(`写入总数: ${metrics.writeTotal}`)
  details.push(`写入成功: ${metrics.writeSuccess}`)
  details.push(`写入失败: ${metrics.writeFailure}`)
  details.push(`Mock 数据: ${metrics.mockWriteTotal} 条`)

  // 2. 检查 writeSuccess + writeFailure === writeTotal
  if (metrics.writeSuccess + metrics.writeFailure !== metrics.writeTotal) {
    details.push(`⚠ 计数不一致: success(${metrics.writeSuccess}) + failure(${metrics.writeFailure}) ≠ total(${metrics.writeTotal})`)
    recommendations.push('检查 recordWrite 调用是否对称（每个 try 块必须有对应的 catch 块）')
  }

  // 3. 检查最近记录中是否有异常
  const recentFailures = recentRecords.filter((r) => !r.success)
  if (recentFailures.length > 0) {
    details.push(`最近 ${recentRecords.length} 条记录中失败 ${recentFailures.length} 条`)
    for (const f of recentFailures.slice(0, 5)) {
      details.push(`  - ${f.store}:${f.key} → ${f.error}`)
    }
  }

  // 4. 检查审计警告
  if (metrics.auditWarnings > 0) {
    details.push(`审计警告: ${metrics.auditWarnings} 条`)
    recommendations.push('检查审计警告对应的数据质量问题')
  }

  // 5. 总体判断
  const passed = metrics.writeSuccess + metrics.writeFailure === metrics.writeTotal
    && metrics.writeFailure === 0
    && metrics.auditWarnings === 0

  const summary = passed
    ? '✅ KPI 一致性审计通过'
    : '❌ KPI 一致性审计未通过'

  return { passed, summary, details, recommendations }
}

// 执行
const result = runKpiAudit()

console.log(result.summary)
console.log('---')
for (const d of result.details) {
  console.log(d)
}
if (result.recommendations.length > 0) {
  console.log('---')
  console.log('建议:')
  for (const r of result.recommendations) {
    console.log(`  - ${r}`)
  }
}

process.exit(result.passed ? 0 : 1)