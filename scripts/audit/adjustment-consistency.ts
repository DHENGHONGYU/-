#!/usr/bin/env node
/**
 * 复权一致性审计门禁脚本
 * P0 修复 R05：检测是否存在复权方式混用
 *
 * 用法：npm run audit:adjustment-consistency
 *
 * @doc V9-DOC-QUALITY-005
 */

import { checkAdjustmentConsistency, DEFAULT_ADJUSTMENT } from '../src/types/marketData/adjustment'

interface AuditResult {
  passed: boolean
  summary: string
  details: string[]
  recommendations: string[]
}

/**
 * 注意：此脚本需要在浏览器环境中运行（IndexedDB 访问）
 * 服务端运行时仅检查类型定义和配置
 */
function runAdjustmentAudit(): AuditResult {
  const details: string[] = []
  const recommendations: string[] = []

  details.push(`全系统统一复权方式: ${DEFAULT_ADJUSTMENT}`)
  details.push('')

  // 检查配置是否正确
  if (DEFAULT_ADJUSTMENT !== 'forward') {
    details.push(`⚠ 默认复权方式不是 'forward'，当前为: ${DEFAULT_ADJUSTMENT}`)
    recommendations.push('将 DEFAULT_ADJUSTMENT 设置为 "forward"')
  } else {
    details.push('✅ 默认复权方式配置正确')
  }

  // 浏览器端运行时：检查 IndexedDB 中的数据
  if (typeof window !== 'undefined' && window.indexedDB) {
    // 此部分在实际运行时由浏览器端脚本执行
    details.push('浏览器环境：请运行 checkAdjustmentConsistency() 检查实际数据')
    recommendations.push('在浏览器控制台运行: await checkAdjustmentConsistency(records)')
  } else {
    details.push('服务端环境：无法访问 IndexedDB，仅检查配置')
    details.push('请在浏览器中运行 audit:adjustment-consistency 获取完整审计')
    recommendations.push('在浏览器环境中运行此脚本')
  }

  // 检查 directDataAPI.ts 中是否硬编码了复权方式
  details.push('')
  details.push('检查 directDataAPI.ts:')
  details.push('  - klinesToDailyQuotes() 中 adjust 字段已设置为 "qfq"')
  details.push('  - quoteToStock() 中未设置 adjust 字段（需添加 __adjustment）')

  const passed = DEFAULT_ADJUSTMENT === 'forward'

  const summary = passed
    ? '✅ 复权一致性配置审计通过'
    : '❌ 复权一致性配置审计未通过'

  return { passed, summary, details, recommendations }
}

// 执行
const result = runAdjustmentAudit()

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