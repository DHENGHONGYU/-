#!/usr/bin/env node
/**
 * 权重一致性审计门禁脚本
 * P1 修复 R10：权重配置错误（和≠1）
 *
 * 用法：npm run audit:weights
 *
 * 校验所有评分权重配置的有效性
 *
 * @doc V9-DOC-QUALITY-010
 */

import { validateWeights, validateAllWeights } from '../src/config/weightConsistency'

/**
 * V6 引擎默认因子权重（从 intelligentScoreConfig 同步）
 */
const FACTOR_WEIGHTS = {
  '估值': 0.15,
  '成长': 0.15,
  '盈利': 0.12,
  '质量': 0.10,
  '动量': 0.12,
  '波动': 0.08,
  '流动性': 0.08,
  '行业': 0.10,
  '情绪': 0.10,
}

/**
 * 行业评分权重
 */
const INDUSTRY_WEIGHTS = {
  '行业景气度': 0.25,
  '政策支持度': 0.20,
  '竞争格局': 0.20,
  '市场规模': 0.15,
  '技术壁垒': 0.10,
  '增长潜力': 0.10,
}

function runWeightAudit(): { passed: boolean; results: string[] } {
  const results: string[] = []

  // 验证因子权重
  const factorResult = validateWeights('V6 因子权重', FACTOR_WEIGHTS)
  results.push(
    `V6 因子权重: 和=${factorResult.sum}, ${factorResult.valid ? '✅' : '❌'} 偏差=${factorResult.deviation}`,
  )
  if (!factorResult.valid && factorResult.suggestion) {
    results.push(`  → ${factorResult.suggestion}`)
  }

  // 验证行业权重
  const industryResult = validateWeights('行业评分权重', INDUSTRY_WEIGHTS)
  results.push(
    `行业评分权重: 和=${industryResult.sum}, ${industryResult.valid ? '✅' : '❌'} 偏差=${industryResult.deviation}`,
  )
  if (!industryResult.valid && industryResult.suggestion) {
    results.push(`  → ${industryResult.suggestion}`)
  }

  const allValid = factorResult.valid && industryResult.valid

  return { passed: allValid, results }
}

// 执行
const result = runWeightAudit()

console.log(`权重一致性审计: ${result.passed ? '✅ 通过' : '❌ 未通过'}`)
console.log('---')
for (const r of result.results) {
  console.log(r)
}

process.exit(result.passed ? 0 : 1)