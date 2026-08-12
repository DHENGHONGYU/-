export type QualityPhase = 'intensive' | 'normal' | 'lightweight'

export interface AuditConfig {
  name: string
  command: string
  enabled: boolean
  timeoutMs: number
  failThreshold: number
}

export interface PhaseConfig {
  name: string
  description: string
  auditFrequencyDays: number
  auditConfig: AuditConfig[]
  qualityGate: {
    minScore: number
    maxCriticalIssues: number
    maxHighIssues: number
    requiredTestCoverage: number
    requiredDocFreshness: number
  }
  automationRatio: number
  manualReviewRatio: number
}

export const QUALITY_PHASES: Record<QualityPhase, PhaseConfig> = {
  intensive: {
    name: '高强度开发测试期',
    description: '适用于功能密集开发、架构重构、模块迁移阶段',
    auditFrequencyDays: 1,
    auditConfig: [
      { name: 'doc-update-trigger', command: 'npx tsx scripts/doc-update-trigger.ts', enabled: true, timeoutMs: 60000, failThreshold: 1 },
      { name: 'daily-doc-validation', command: 'npx tsx scripts/daily-doc-validation.ts --auto-update', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'system-health-dashboard', command: 'npx tsx scripts/system-health-dashboard.ts', enabled: true, timeoutMs: 300000, failThreshold: 1 },
      { name: 'doc-freshness-score', command: 'npx tsx scripts/doc-freshness-score.ts', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:layers', command: 'npm run audit:layers', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:hardcode', command: 'npm run audit:hardcode', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:deadcode', command: 'npm run audit:deadcode', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:docs', command: 'npm run audit:docs', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:mcp', command: 'npm run audit:mcp', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:token', command: 'npm run audit:token', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:routes', command: 'npm run audit:routes', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:tests', command: 'npm run audit:tests', enabled: true, timeoutMs: 300000, failThreshold: 1 },
      { name: 'audit:reserved-stores', command: 'npm run audit:reserved-stores', enabled: true, timeoutMs: 60000, failThreshold: 1 },
      { name: 'audit:tokens', command: 'npm run audit:tokens', enabled: true, timeoutMs: 120000, failThreshold: 1 },
    ],
    qualityGate: {
      minScore: 85,
      maxCriticalIssues: 0,
      maxHighIssues: 2,
      requiredTestCoverage: 70,
      requiredDocFreshness: 80,
    },
    automationRatio: 0.85,
    manualReviewRatio: 0.15,
  },
  normal: {
    name: '稳定维护期',
    description: '适用于功能稳定、常规迭代、Bug修复阶段',
    auditFrequencyDays: 3,
    auditConfig: [
      { name: 'doc-update-trigger', command: 'npx tsx scripts/doc-update-trigger.ts', enabled: true, timeoutMs: 60000, failThreshold: 1 },
      { name: 'daily-doc-validation', command: 'npx tsx scripts/daily-doc-validation.ts --auto-update', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'system-health-dashboard', command: 'npx tsx scripts/system-health-dashboard.ts', enabled: true, timeoutMs: 300000, failThreshold: 1 },
      { name: 'doc-freshness-score', command: 'npx tsx scripts/doc-freshness-score.ts', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:layers', command: 'npm run audit:layers', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:hardcode', command: 'npm run audit:hardcode', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:deadcode', command: 'npm run audit:deadcode', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:docs', command: 'npm run audit:docs', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:mcp', command: 'npm run audit:mcp', enabled: false, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:token', command: 'npm run audit:token', enabled: false, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:routes', command: 'npm run audit:routes', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:tests', command: 'npm run audit:tests', enabled: false, timeoutMs: 300000, failThreshold: 1 },
      { name: 'audit:reserved-stores', command: 'npm run audit:reserved-stores', enabled: false, timeoutMs: 60000, failThreshold: 1 },
      { name: 'audit:tokens', command: 'npm run audit:tokens', enabled: true, timeoutMs: 120000, failThreshold: 1 },
    ],
    qualityGate: {
      minScore: 75,
      maxCriticalIssues: 1,
      maxHighIssues: 5,
      requiredTestCoverage: 60,
      requiredDocFreshness: 70,
    },
    automationRatio: 0.90,
    manualReviewRatio: 0.10,
  },
  lightweight: {
    name: '低维护期',
    description: '适用于功能冻结、仅安全更新、长期维护阶段',
    auditFrequencyDays: 7,
    auditConfig: [
      { name: 'doc-update-trigger', command: 'npx tsx scripts/doc-update-trigger.ts', enabled: false, timeoutMs: 60000, failThreshold: 1 },
      { name: 'daily-doc-validation', command: 'npx tsx scripts/daily-doc-validation.ts --auto-update', enabled: false, timeoutMs: 120000, failThreshold: 1 },
      { name: 'system-health-dashboard', command: 'npx tsx scripts/system-health-dashboard.ts', enabled: true, timeoutMs: 300000, failThreshold: 1 },
      { name: 'doc-freshness-score', command: 'npx tsx scripts/doc-freshness-score.ts', enabled: false, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:layers', command: 'npm run audit:layers', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:hardcode', command: 'npm run audit:hardcode', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:deadcode', command: 'npm run audit:deadcode', enabled: false, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:docs', command: 'npm run audit:docs', enabled: false, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:mcp', command: 'npm run audit:mcp', enabled: false, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:token', command: 'npm run audit:token', enabled: false, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:routes', command: 'npm run audit:routes', enabled: true, timeoutMs: 120000, failThreshold: 1 },
      { name: 'audit:tests', command: 'npm run audit:tests', enabled: false, timeoutMs: 300000, failThreshold: 1 },
      { name: 'audit:reserved-stores', command: 'npm run audit:reserved-stores', enabled: false, timeoutMs: 60000, failThreshold: 1 },
      { name: 'audit:tokens', command: 'npm run audit:tokens', enabled: false, timeoutMs: 120000, failThreshold: 1 },
    ],
    qualityGate: {
      minScore: 65,
      maxCriticalIssues: 2,
      maxHighIssues: 8,
      requiredTestCoverage: 50,
      requiredDocFreshness: 60,
    },
    automationRatio: 0.95,
    manualReviewRatio: 0.05,
  },
}

export function getCurrentPhase(): QualityPhase {
  console.error('[QualityConfig] ===== 阶段自动判断开始 =====')
  
  const envPhase = process.env.QUALITY_PHASE as QualityPhase
  console.error(`[QualityConfig] 环境变量 QUALITY_PHASE: ${envPhase || '(未设置)'}`)
  
  if (envPhase && QUALITY_PHASES[envPhase]) {
    console.error(`[QualityConfig] ✅ 环境变量指定阶段: ${envPhase} → ${QUALITY_PHASES[envPhase].name}`)
    console.error('[QualityConfig] ===== 阶段自动判断结束 =====')
    return envPhase
  }
  
  console.error('[QualityConfig] 环境变量未设置或无效，开始基于 git commit 数自动判断')
  
  let commitCount = 0
  try {
    const gitLogOutput = execSync('git log --oneline --since="7 days ago"', {
      encoding: 'utf-8',
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const lines = gitLogOutput.split('\n').filter((l) => l.trim())
    commitCount = lines.length
    console.error(`[QualityConfig] git log 输出行数: ${commitCount}`)
    console.error(`[QualityConfig] git log 命令: git log --oneline --since="7 days ago"`)
    console.error(`[QualityConfig] 近7天 commit 数: ${commitCount}`)
  } catch (error) {
    console.error(`[QualityConfig] ⚠️ 获取 git commit 数失败: ${(error as Error).message}`)
    console.error('[QualityConfig] 回退到 lightweight 阶段')
    console.error('[QualityConfig] ===== 阶段自动判断结束 =====')
    return 'lightweight'
  }
  
  console.error('[QualityConfig] 判断逻辑:')
  console.error(`[QualityConfig]   commitCount >= 30 → intensive (高强度开发测试期)`)
  console.error(`[QualityConfig]   commitCount >= 10 → normal (稳定维护期)`)
  console.error(`[QualityConfig]   commitCount < 10 → lightweight (低维护期)`)
  
  let result: QualityPhase
  if (commitCount >= 30) {
    result = 'intensive'
    console.error(`[QualityConfig] ✅ 判断结果: ${result} (${QUALITY_PHASES[result].name})`)
    console.error(`[QualityConfig]   原因: commitCount ${commitCount} >= 30`)
  } else if (commitCount >= 10) {
    result = 'normal'
    console.error(`[QualityConfig] ✅ 判断结果: ${result} (${QUALITY_PHASES[result].name})`)
    console.error(`[QualityConfig]   原因: commitCount ${commitCount} >= 10 且 < 30`)
  } else {
    result = 'lightweight'
    console.error(`[QualityConfig] ✅ 判断结果: ${result} (${QUALITY_PHASES[result].name})`)
    console.error(`[QualityConfig]   原因: commitCount ${commitCount} < 10`)
  }
  
  console.error('[QualityConfig] ===== 阶段自动判断结束 =====')
  return result
}

import { execSync } from 'node:child_process'

export function getPhaseConfig(phase?: QualityPhase): PhaseConfig {
  const currentPhase = phase || getCurrentPhase()
  return QUALITY_PHASES[currentPhase]
}

export function getEnabledAudits(phase?: QualityPhase): AuditConfig[] {
  return getPhaseConfig(phase).auditConfig.filter((a) => a.enabled)
}

export function validateQualityGate(report: {
  totalScore: number
  criticalIssues: number
  highIssues: number
  testCoverage?: number
  docFreshness?: number
}, phase?: QualityPhase): {
  passed: boolean
  violations: string[]
} {
  const config = getPhaseConfig(phase)
  const violations: string[] = []
  
  if (report.totalScore < config.qualityGate.minScore) {
    violations.push(`综合评分 ${report.totalScore} 低于阈值 ${config.qualityGate.minScore}`)
  }
  if (report.criticalIssues > config.qualityGate.maxCriticalIssues) {
    violations.push(`严重问题 ${report.criticalIssues} 超过阈值 ${config.qualityGate.maxCriticalIssues}`)
  }
  if (report.highIssues > config.qualityGate.maxHighIssues) {
    violations.push(`高优先级问题 ${report.highIssues} 超过阈值 ${config.qualityGate.maxHighIssues}`)
  }
  if (report.testCoverage !== undefined && report.testCoverage < config.qualityGate.requiredTestCoverage) {
    violations.push(`测试覆盖率 ${report.testCoverage}% 低于阈值 ${config.qualityGate.requiredTestCoverage}%`)
  }
  if (report.docFreshness !== undefined && report.docFreshness < config.qualityGate.requiredDocFreshness) {
    violations.push(`文档保鲜度 ${report.docFreshness}% 低于阈值 ${config.qualityGate.requiredDocFreshness}%`)
  }
  
  return { passed: violations.length === 0, violations }
}
