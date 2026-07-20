/**
 * loopStatusStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态：五阶段 idle、lastEventAt=null、todayCount=0
 * 2. markStageEvent：首次事件 → active + todayCount=1
 * 3. markStageEvent：当日重复事件 → todayCount 递增
 * 4. markStageEvent：跨天事件 → todayCount 重置为 1
 * 5. refresh：超过 stale 阈值 → stale；当日计数跨天归零
 * 6. deriveStageHealth 纯函数：idle / active / stale 三分支
 * 7. computeLoopComplete：五阶段当日均有事件 → true
 * 8. reset：恢复初始状态
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

import {
  useLoopStatusStore,
  deriveStageHealth,
  computeLoopComplete,
  isSameLocalDay,
} from './loopStatusStore'
import { getDefaultLoopConfig } from '@/config/loopConfig'
import type { LoopStageId } from '@/types/modules/loop.types'

const ALL_STAGES: readonly LoopStageId[] = ['collect', 'score', 'signal', 'trade', 'review']

/** 基准时间：2026-07-20 10:00 本地时间 */
const BASE_TIME = new Date(2026, 6, 20, 10, 0, 0).getTime()
/** 一小时（毫秒） */
const HOUR_MS = 60 * 60 * 1000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE_TIME)
  useLoopStatusStore.getState().reset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('loopStatusStore', () => {
  // ============================================================
  // 初始状态
  // ============================================================
  it('初始状态：五阶段均为 idle 且无事件', () => {
    const { stages, updatedAt, loading, error } = useLoopStatusStore.getState()
    expect(loading).toBe(false)
    expect(error).toBeNull()
    expect(updatedAt).toBe(0)
    for (const id of ALL_STAGES) {
      expect(stages[id].health).toBe('idle')
      expect(stages[id].lastEventAt).toBeNull()
      expect(stages[id].todayCount).toBe(0)
      expect(stages[id].label).toBe(getDefaultLoopConfig().stageLabels[id])
    }
  })

  // ============================================================
  // markStageEvent
  // ============================================================
  it('markStageEvent：首次事件置为 active 且 todayCount=1', () => {
    useLoopStatusStore.getState().markStageEvent('collect')
    const stage = useLoopStatusStore.getState().stages.collect
    expect(stage.health).toBe('active')
    expect(stage.todayCount).toBe(1)
    expect(stage.lastEventAt).toBe(BASE_TIME)
    expect(useLoopStatusStore.getState().updatedAt).toBe(BASE_TIME)
  })

  it('markStageEvent：当日重复事件 todayCount 递增', () => {
    const { markStageEvent } = useLoopStatusStore.getState()
    markStageEvent('score', BASE_TIME)
    markStageEvent('score', BASE_TIME + HOUR_MS)
    markStageEvent('score', BASE_TIME + 2 * HOUR_MS)
    expect(useLoopStatusStore.getState().stages.score.todayCount).toBe(3)
  })

  it('markStageEvent：跨天事件 todayCount 重置为 1', () => {
    const { markStageEvent } = useLoopStatusStore.getState()
    markStageEvent('trade', BASE_TIME)
    markStageEvent('trade', BASE_TIME + HOUR_MS)
    // 次日同一时间（+24h 后同日不同时）
    const nextDay = BASE_TIME + 24 * HOUR_MS
    markStageEvent('trade', nextDay)
    const stage = useLoopStatusStore.getState().stages.trade
    expect(stage.todayCount).toBe(1)
    expect(stage.lastEventAt).toBe(nextDay)
  })

  // ============================================================
  // refresh / stale 推导
  // ============================================================
  it('refresh：最近事件超过 stale 阈值判定为 stale', () => {
    const { staleThresholdMs } = getDefaultLoopConfig()
    const { markStageEvent } = useLoopStatusStore.getState()
    markStageEvent('signal', BASE_TIME)
    expect(useLoopStatusStore.getState().stages.signal.health).toBe('active')

    // 前进到阈值之外
    const beyondThreshold = BASE_TIME + staleThresholdMs + 1
    useLoopStatusStore.getState().refresh(beyondThreshold)
    expect(useLoopStatusStore.getState().stages.signal.health).toBe('stale')
  })

  it('refresh：跨天后当日计数归零且未超阈值仍为 active', () => {
    const { markStageEvent } = useLoopStatusStore.getState()
    markStageEvent('review', BASE_TIME)
    expect(useLoopStatusStore.getState().stages.review.todayCount).toBe(1)

    // 次日早晨（2 小时后为当天中午，跨天需 +14h 到次日 00:00 之后；直接 +16h 到次日凌晨 2 点）
    const nextDay = BASE_TIME + 16 * HOUR_MS
    expect(isSameLocalDay(BASE_TIME, nextDay)).toBe(false)
    useLoopStatusStore.getState().refresh(nextDay)
    const stage = useLoopStatusStore.getState().stages.review
    expect(stage.todayCount).toBe(0)
    expect(stage.health).toBe('active') // 16h < 24h 阈值
  })

  it('refresh：idle 阶段保持 idle', () => {
    useLoopStatusStore.getState().refresh(BASE_TIME + 48 * HOUR_MS)
    expect(useLoopStatusStore.getState().stages.collect.health).toBe('idle')
  })

  // ============================================================
  // 纯函数
  // ============================================================
  it('deriveStageHealth：三分支推导正确', () => {
    const threshold = getDefaultLoopConfig().staleThresholdMs
    expect(deriveStageHealth(null, BASE_TIME, threshold)).toBe('idle')
    expect(deriveStageHealth(BASE_TIME, BASE_TIME + threshold, threshold)).toBe('active')
    expect(deriveStageHealth(BASE_TIME, BASE_TIME + threshold + 1, threshold)).toBe('stale')
  })

  it('computeLoopComplete：五阶段当日均有事件方为 true', () => {
    const { markStageEvent } = useLoopStatusStore.getState()
    expect(computeLoopComplete(useLoopStatusStore.getState().stages, BASE_TIME)).toBe(false)

    for (const id of ALL_STAGES) {
      markStageEvent(id, BASE_TIME)
    }
    expect(computeLoopComplete(useLoopStatusStore.getState().stages, BASE_TIME)).toBe(true)
  })

  // ============================================================
  // reset
  // ============================================================
  it('reset：恢复初始状态', () => {
    const { markStageEvent } = useLoopStatusStore.getState()
    markStageEvent('collect', BASE_TIME)
    useLoopStatusStore.getState().reset()
    const { stages, updatedAt } = useLoopStatusStore.getState()
    expect(updatedAt).toBe(0)
    expect(stages.collect.health).toBe('idle')
    expect(stages.collect.lastEventAt).toBeNull()
    expect(stages.collect.todayCount).toBe(0)
  })
})
