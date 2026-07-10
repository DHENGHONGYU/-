/**
 * @module rotationSignalStore.derived
 * @description rotationSignalStore 派生查询函数集合
 *
 * 设计原则：
 *   1. 纯函数：通过 useRotationSignalStore.getState() 访问状态
 *   2. 性能优化：memoizeByRef 缓存无参数派生（signals 引用未变时直接返回缓存）
 *   3. 派生不调用派生：sectorStats 直接遍历 signals，避免调用 signalsByStrength
 *   4. 空状态安全
 *
 * @compliance AGENTS.md §一 分层规则
 */

import { useRotationSignalStore } from '@/store/rotationSignalStore'
import type { RotationSignal } from '@/services/scoring/rotationSignalDetector'
import { memoizeByRef, safeDivide, safeLength } from '@/lib/derivedCache'

// ============================================================
// 类型定义
// ============================================================

/** 强度分布统计 */
export interface StrengthDistribution {
  strong: number
  medium: number
  weak: number
  none: number  // 未触发
}

/** 板块统计聚合 */
export interface SectorStat {
  sectorId: string
  signalCount: number
  hasTriggered: boolean
  latestDetectedAt: number
  strengthLevel: 'strong' | 'medium' | 'weak' | 'none'
}

/** 信号条件详情（用于 tooltip） */
export interface SignalConditionsDetail {
  volumeBreakthrough: boolean
  capitalInflow: boolean
  goldenCross: boolean
  satisfiedCount: number  // 0-3
}

// ============================================================
// 派生查询：基础聚合
// ============================================================

/**
 * 信号列表是否为空
 */
export function isSignalsEmpty(): boolean {
  return useRotationSignalStore.getState().signals.length === 0
}

/**
 * 信号总数
 */
export function signalsCount(): number {
  return safeLength(useRotationSignalStore.getState().signals)
}

/**
 * 综合加载状态
 */
export function isLoading(): boolean {
  return useRotationSignalStore.getState().loading
}

/**
 * 综合错误
 */
export function hasError(): boolean {
  return useRotationSignalStore.getState().error !== null
}

// ============================================================
// 派生查询：信号筛选（memoizeByRef 缓存）
// ============================================================

/**
 * 已触发信号列表
 * 性能优化：基于 signals 引用记忆化
 */
export const triggeredSignalsMemo = memoizeByRef((signals: readonly RotationSignal[]): RotationSignal[] => {
  return signals.filter(s => s.triggered)
}, 'triggeredSignals')

/**
 * 获取已触发信号（自动传入最新 signals）
 */
export function triggeredSignals(): RotationSignal[] {
  return triggeredSignalsMemo(useRotationSignalStore.getState().signals)
}

/**
 * 按强度筛选信号
 */
export function signalsByStrength(strength: 'weak' | 'medium' | 'strong'): RotationSignal[] {
  return useRotationSignalStore.getState().signals.filter(
    s => s.triggered && s.strength === strength
  )
}

/**
 * 强信号快捷访问
 */
export function strongSignals(): RotationSignal[] {
  return signalsByStrength('strong')
}

/**
 * 中等信号
 */
export function mediumSignals(): RotationSignal[] {
  return signalsByStrength('medium')
}

/**
 * 弱信号
 */
export function weakSignals(): RotationSignal[] {
  return signalsByStrength('weak')
}

/**
 * 按板块查询信号
 */
export function bySector(sectorId: string): RotationSignal | undefined {
  return useRotationSignalStore.getState().signals.find(s => s.sectorId === sectorId)
}

// ============================================================
// 派生查询：统计聚合（memoizeByRef 缓存）
// ============================================================

/**
 * 强度分布统计
 * 性能优化：基于 signals 引用记忆化，单次遍历完成所有计数
 */
export const strengthDistribution = memoizeByRef((signals: readonly RotationSignal[]): StrengthDistribution => {
  const dist: StrengthDistribution = {
    strong: 0,
    medium: 0,
    weak: 0,
    none: 0,
  }
  for (const s of signals) {
    if (!s.triggered) {
      dist.none++
    } else if (s.strength === 'strong') {
      dist.strong++
    } else if (s.strength === 'medium') {
      dist.medium++
    } else if (s.strength === 'weak') {
      dist.weak++
    } else {
      dist.none++  // 未知强度归为 none
    }
  }
  return dist
}, 'strengthDistribution')

/**
 * 获取强度分布（自动传入最新 signals）
 */
export function getStrengthDistribution(): StrengthDistribution {
  return strengthDistribution(useRotationSignalStore.getState().signals)
}

/**
 * 已触发信号数量
 */
export function triggeredCount(): number {
  return triggeredSignals().length
}

/**
 * 信号触发率（0-1）
 */
export function triggeredRate(): number {
  const total = signalsCount()
  return safeDivide(triggeredCount(), total)
}

/**
 * 是否有信号触发
 */
export function hasAnyTriggered(): boolean {
  return triggeredCount() > 0
}

// ============================================================
// 派生查询：时间排序
// ============================================================

/**
 * 最新触发的信号（按 detectedAt 降序）
 * 注意：sort 会修改原数组，使用 [...].sort() 避免副作用
 */
export function latestSignals(limit: number = 10): RotationSignal[] {
  const triggered = triggeredSignals()
  return [...triggered]
    .sort((a, b) => b.detectedAt - a.detectedAt)
    .slice(0, limit)
}

/**
 * 最近 N 小时内触发的信号
 */
export function recentTriggered(hours: number = 24): RotationSignal[] {
  const now = Date.now()
  const threshold = now - hours * 60 * 60 * 1000
  return triggeredSignals().filter(s => s.detectedAt >= threshold)
}

// ============================================================
// 派生查询：板块聚合
// 注意：直接遍历 signals 基础状态，避免调用其他派生（性能优化）
// ============================================================

/**
 * 板块统计聚合
 * 性能优化：单次遍历 signals 完成所有计算，避免调用 signalsByStrength
 */
function updateStrengthLevel(stat: SectorStat, strength: Exclude<RotationSignal['strength'], 'none'>): void {
  const STRENGTH_PRIORITY: Record<SectorStat['strengthLevel'], number> = {
    none: 0,
    weak: 1,
    medium: 2,
    strong: 3,
  }
  if (STRENGTH_PRIORITY[strength] > STRENGTH_PRIORITY[stat.strengthLevel]) {
    stat.strengthLevel = strength
  }
}

/**
 * 板块统计聚合（memoized）。
 *
 * @param signals - 轮动信号列表
 * @returns 板块统计数组
 */
export const sectorStatsMemo = memoizeByRef((signals: readonly RotationSignal[]): SectorStat[] => {
  const statsMap = new Map<string, SectorStat>()

  for (const sig of signals) {
    let stat = statsMap.get(sig.sectorId)
    if (!stat) {
      stat = {
        sectorId: sig.sectorId,
        signalCount: 0,
        hasTriggered: false,
        latestDetectedAt: 0,
        strengthLevel: 'none',
      }
      statsMap.set(sig.sectorId, stat)
    }

    stat.signalCount++
    if (sig.triggered && sig.detectedAt > stat.latestDetectedAt) {
      stat.hasTriggered = true
      stat.latestDetectedAt = sig.detectedAt
      updateStrengthLevel(stat, sig.strength)
    }
  }

  return Array.from(statsMap.values())
}, 'sectorStats')

/**
 * 获取板块统计（自动传入最新 signals）
 */
export function getSectorStats(): SectorStat[] {
  return sectorStatsMemo(useRotationSignalStore.getState().signals)
}

/**
 * 是否为热门板块（触发 strong 信号）
 */
export function isHotSector(sectorId: string): boolean {
  const sig = bySector(sectorId)
  return sig?.triggered === true && sig.strength === 'strong'
}

/**
 * 板块热度排序（按强度+时间）
 */
export function hotSectors(limit: number = 10): string[] {
  const stats = getSectorStats()
  const strengthOrder = { strong: 3, medium: 2, weak: 1, none: 0 }
  return stats
    .filter(s => s.hasTriggered)
    .sort((a, b) => {
      const strengthDiff = strengthOrder[b.strengthLevel] - strengthOrder[a.strengthLevel]
      if (strengthDiff !== 0) return strengthDiff
      return b.latestDetectedAt - a.latestDetectedAt
    })
    .slice(0, limit)
    .map(s => s.sectorId)
}

/**
 * 信号条件详情（用于 tooltip）
 */
export function signalConditions(sectorId: string): SignalConditionsDetail | null {
  const sig = bySector(sectorId)
  if (!sig) return null
  const conditions = sig.conditions
  const satisfiedCount = [
    conditions.volumeBreakthrough,
    conditions.capitalInflow,
    conditions.goldenCross,
  ].filter(Boolean).length
  return {
    ...conditions,
    satisfiedCount,
  }
}

// ============================================================
// React Hook 形式派生（可选）
// ============================================================

/**
 * Hook：订阅强度分布
 */
export function useStrengthDistribution(): StrengthDistribution {
  const signals = useRotationSignalStore(state => state.signals)
  return strengthDistribution(signals)
}

/**
 * Hook：订阅板块统计
 */
export function useSectorStats(): SectorStat[] {
  const signals = useRotationSignalStore(state => state.signals)
  return sectorStatsMemo(signals)
}

/**
 * Hook：订阅已触发信号数量
 */
export function useTriggeredCount(): number {
  const signals = useRotationSignalStore(state => state.signals)
  return signals.filter(s => s.triggered).length
}
