/**
 * @module riskStore.derived
 * @description riskStore 派生查询函数集合
 *
 * 设计原则：
 *   1. 纯函数：通过 useRiskStore.getState() 访问状态
 *   2. 性能优化：memoizeByRef 缓存无参数派生（verdicts 引用未变时直接返回缓存）
 *   3. 派生不调用派生：blockedCount 等直接遍历 verdicts，避免调用 latestVerdict
 *   4. 空状态安全
 *
 * @compliance AGENTS.md §一 分层规则
 */

import { useRiskStore } from '@/store/riskStore'
import type { RiskVerdict, RiskTriState } from '@/store/riskStore'
import { memoizeByRef, safeDivide, safeLength } from '@/lib/derivedCache'

// ============================================================
// 类型定义
// ============================================================

/** 风险等级文字描述 */
export type RiskLevelText = '正常' | '警告' | '阻塞'

/** 回路状态文字描述 */
export type CircuitStateText = '闭合' | '开启' | '半开'

/** 风险趋势方向 */
export type RiskTrendDirection = 'worsening' | 'improving' | 'stable'

/** 单 symbol 风险统计 */
export interface SymbolRiskStats {
  totalChecks: number
  blockedCount: number
  warningCount: number
  normalCount: number
  lastTriState: RiskTriState
  lastCheckedAt: number
}

/** 裁决时间线条目 */
export interface VerdictTimelineEntry {
  verdict: RiskVerdict
  timeGap: number  // 距上次检查的间隔（ms）
}

// ============================================================
// 派生查询：执行决策（必需）
// ============================================================

/**
 * 当前是否可执行（triState !== 'blocked'）
 * UI 场景：ExecutionPlanPanel 提交按钮的禁用判定
 */
export function isExecutable(): boolean {
  return useRiskStore.getState().triState !== 'blocked'
}

/**
 * 当前风险等级文字描述
 */
export function riskLevelText(): RiskLevelText {
  const triState = useRiskStore.getState().triState
  switch (triState) {
    case 'normal': return '正常'
    case 'warning': return '警告'
    case 'blocked': return '阻塞'
  }
}

/**
 * 最近一次裁决
 */
export function latestVerdict(): RiskVerdict | null {
  const verdicts = useRiskStore.getState().verdicts
  if (verdicts.length === 0) return null
  return verdicts[verdicts.length - 1]!
}

/**
 * 待解决的 blocks 列表
 * UI 场景：ExecutionPlanPanel 显示阻断原因
 */
export function pendingBlocks(): string[] {
  const latest = latestVerdict()
  return latest?.result.blocks ?? []
}

/**
 * 待解决的 warnings 列表
 */
export function pendingWarnings(): string[] {
  const latest = latestVerdict()
  return latest?.result.warnings ?? []
}

// ============================================================
// 派生查询：回路状态（必需）
// ============================================================

/**
 * 回路是否开启（阻断所有执行）
 */
export function isCircuitOpen(): boolean {
  return useRiskStore.getState().circuitState === 'open'
}

/**
 * 是否需要人工干预（circuitState === 'open'）
 */
export function needsManualIntervention(): boolean {
  return useRiskStore.getState().circuitState === 'open'
}

/**
 * 回路状态文字描述
 */
export function circuitStateText(): CircuitStateText {
  const state = useRiskStore.getState().circuitState
  switch (state) {
    case 'closed': return '闭合'
    case 'open': return '开启'
    case 'half-open': return '半开'
  }
}

/**
 * 回路是否处于半开状态（可尝试恢复）
 */
export function isCircuitHalfOpen(): boolean {
  return useRiskStore.getState().circuitState === 'half-open'
}

// ============================================================
// 派生查询：风控统计（memoizeByRef 缓存）
// ============================================================

/**
 * 风控统计聚合
 * 性能优化：单次遍历 verdicts 完成所有计数
 */
export const verdictStats = memoizeByRef((verdicts: readonly RiskVerdict[]) => {
  let blockedCount = 0
  let warningCount = 0
  let normalCount = 0
  for (const v of verdicts) {
    if (v.triState === 'blocked') blockedCount++
    else if (v.triState === 'warning') warningCount++
    else normalCount++
  }
  return { blockedCount, warningCount, normalCount, total: verdicts.length }
}, 'verdictStats')

/**
 * blocked 次数
 */
export function blockedCount(): number {
  return verdictStats(useRiskStore.getState().verdicts).blockedCount
}

/**
 * warning 次数
 */
export function warningCount(): number {
  return verdictStats(useRiskStore.getState().verdicts).warningCount
}

/**
 * normal 次数
 */
export function normalCount(): number {
  return verdictStats(useRiskStore.getState().verdicts).normalCount
}

/**
 * blocked 比例（0-1）
 */
export function blockedRate(): number {
  const stats = verdictStats(useRiskStore.getState().verdicts)
  return safeDivide(stats.blockedCount, stats.total)
}

/**
 * 裁决总数
 */
export function verdictsCount(): number {
  return safeLength(useRiskStore.getState().verdicts)
}

// ============================================================
// 派生查询：趋势分析
// ============================================================

/**
 * 风险趋势（最近 N 次检查的三态序列）
 */
export function riskTrend(limit: number = 10): RiskTriState[] {
  const verdicts = useRiskStore.getState().verdicts
  return verdicts.slice(-limit).map(v => v.triState)
}

/**
 * 风险趋势方向（恶化/改善/平稳）
 * 基于最近 N 次检查中 blocked 比例的变化
 */
export function riskTrendDirection(): RiskTrendDirection {
  const trend = riskTrend(10)
  if (trend.length < 4) return 'stable'

  const half = Math.floor(trend.length / 2)
  const firstHalf = trend.slice(0, half)
  const secondHalf = trend.slice(half)

  const firstBlockedRate = safeDivide(
    firstHalf.filter(t => t === 'blocked').length,
    firstHalf.length
  )
  const secondBlockedRate = safeDivide(
    secondHalf.filter(t => t === 'blocked').length,
    secondHalf.length
  )

  const diff = secondBlockedRate - firstBlockedRate
  if (diff > 0.1) return 'worsening'
  if (diff < -0.1) return 'improving'
  return 'stable'
}

/**
 * 裁决时间线视图（按时间排序，含间隔）
 */
export function verdictsTimeline(limit: number = 20): VerdictTimelineEntry[] {
  const verdicts = useRiskStore.getState().verdicts
  const sorted = [...verdicts].sort((a, b) => a.timestamp - b.timestamp)
  const result: VerdictTimelineEntry[] = []
  let lastTimestamp = 0
  for (const verdict of sorted.slice(-limit)) {
    result.push({
      verdict,
      timeGap: verdict.timestamp - lastTimestamp,
    })
    lastTimestamp = verdict.timestamp
  }
  return result
}

// ============================================================
// 派生查询：按 symbol 聚合
// ============================================================

/**
 * 按 symbol 聚合风险统计
 */
export function symbolRiskStats(symbol: string): SymbolRiskStats {
  const verdicts = useRiskStore.getState().verdicts
  const symbolVerdicts = verdicts.filter(v => v.symbol === symbol)

  let blockedCnt = 0
  let warningCnt = 0
  let normalCnt = 0
  let lastTriState: RiskTriState = 'normal'
  let lastCheckedAt = 0

  for (const v of symbolVerdicts) {
    if (v.triState === 'blocked') blockedCnt++
    else if (v.triState === 'warning') warningCnt++
    else normalCnt++

    if (v.timestamp > lastCheckedAt) {
      lastCheckedAt = v.timestamp
      lastTriState = v.triState
    }
  }

  return {
    totalChecks: symbolVerdicts.length,
    blockedCount: blockedCnt,
    warningCount: warningCnt,
    normalCount: normalCnt,
    lastTriState,
    lastCheckedAt,
  }
}

// ============================================================
// React Hook 形式派生（可选）
// ============================================================

/**
 * Hook：订阅当前是否可执行
 */
export function useIsExecutable(): boolean {
  return useRiskStore(state => state.triState !== 'blocked')
}

/**
 * Hook：订阅当前风险等级文字
 */
export function useRiskLevelText(): RiskLevelText {
  const triState = useRiskStore(state => state.triState)
  switch (triState) {
    case 'normal': return '正常'
    case 'warning': return '警告'
    case 'blocked': return '阻塞'
  }
}

/**
 * Hook：订阅回路是否开启
 */
export function useIsCircuitOpen(): boolean {
  return useRiskStore(state => state.circuitState === 'open')
}

/**
 * Hook：订阅待解决的 blocks
 */
export function usePendingBlocks(): string[] {
  const verdicts = useRiskStore(state => state.verdicts)
  if (verdicts.length === 0) return []
  return verdicts[verdicts.length - 1]!.result.blocks
}
