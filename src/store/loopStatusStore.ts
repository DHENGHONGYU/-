/**
 * @module loopStatusStore
 * @lifecycle @Global
 * 投研闭环状态全局管理（Zustand）。
 *
 * 管理范围：
 * - 数据层：stages（五阶段状态 Record）/ updatedAt / loading / error
 * - 写操作：markStageEvent（事件脉搏）/ refresh（重算 health 与当日计数）/ reset
 *
 * 响应式约束（AGENTS.md §二）：
 * - 组件仅通过 selector 订阅 stages / updatedAt，禁止在组件中裸用 getState() 派生函数
 * - 本文件导出的 deriveXxx / computeXxx / buildXxx 均为纯函数（类型 B），无副作用、不访问 store
 * - 订阅管理模块（store/loopStatusSubscriptions）允许通过 getState() 调用 actions
 */
import { create } from 'zustand'
import type { LoopSnapshot, LoopStage, LoopStageHealth, LoopStageId } from '@/types/modules/loop.types'
import { getDefaultLoopConfig } from '@/config/loopConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getLogger } from '@/lib/logger'
import { withBroadcast } from '@/lib/withBroadcast'

const logger = getLogger()

// ============================================================
// 纯函数（类型 B：无副作用，可在 useMemo / 测试中安全使用）
// ============================================================

/**
 * 判断两个时间戳是否位于同一本地自然日
 *
 * @param a 时间戳 a（epoch ms）
 * @param b 时间戳 b（epoch ms）
 * @returns 同一本地自然日返回 true
 */
export function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

/**
 * 推导阶段健康状态（纯函数）
 *
 * 规则：无事件 → idle；最近事件超过 stale 阈值 → stale；否则 → active。
 *
 * @param lastEventAt 最近事件时间戳，null 表示从未收到事件
 * @param now 当前时间戳
 * @param staleThresholdMs stale 判定阈值（毫秒）
 * @returns 阶段健康状态
 */
export function deriveStageHealth(
  lastEventAt: number | null,
  now: number,
  staleThresholdMs: number,
): LoopStageHealth {
  if (lastEventAt === null) return 'idle'
  if (now - lastEventAt > staleThresholdMs) return 'stale'
  return 'active'
}

/**
 * 推导阶段当日事件计数（纯函数）
 *
 * 当日无事件时归零，用于跨天后的 refresh 重算。
 *
 * @param lastEventAt 最近事件时间戳
 * @param todayCount 当前记录的当日计数
 * @param now 当前时间戳
 * @returns 重算后的当日计数
 */
export function deriveTodayCount(lastEventAt: number | null, todayCount: number, now: number): number {
  if (lastEventAt === null) return 0
  return isSameLocalDay(lastEventAt, now) ? todayCount : 0
}

/**
 * 判断闭环是否达成（纯函数）：五阶段当日均有事件
 *
 * @param stages 五阶段状态
 * @param now 当前时间戳
 * @returns 闭环达成返回 true
 */
export function computeLoopComplete(stages: Record<LoopStageId, LoopStage>, now: number): boolean {
  return getDefaultLoopConfig().stageOrder.every((id) => {
    const stage = stages[id]
    return stage.lastEventAt !== null && isSameLocalDay(stage.lastEventAt, now) && stage.todayCount > 0
  })
}

/**
 * 构建闭环快照（纯函数）：供组件 useMemo 派生渲染视图
 *
 * @param stages 五阶段状态
 * @param now 快照时间戳
 * @returns 闭环快照
 */
export function buildLoopSnapshot(stages: Record<LoopStageId, LoopStage>, now: number): LoopSnapshot {
  const { stageOrder } = getDefaultLoopConfig()
  return {
    stages: stageOrder.map((id) => stages[id]),
    updatedAt: now,
    loopComplete: computeLoopComplete(stages, now),
  }
}

// ============================================================
// Store
// ============================================================

/**
 * 闭环状态 Store 接口
 */
export interface LoopStatusState {
  /** 五阶段状态（按 LoopStageId 索引） */
  stages: Record<LoopStageId, LoopStage>
  /** 最近一次状态更新时间戳 */
  updatedAt: number
  /** 加载中标志（预留给未来的持久化恢复） */
  loading: boolean
  /** 错误信息 */
  error: string | null

  /**
   * 记录某阶段发生一次事件：更新 lastEventAt、递增 todayCount、置 health 为 active
   * @param stageId 阶段标识
   * @param at 事件时间戳，默认 Date.now()
   */
  markStageEvent: (stageId: LoopStageId, at?: number) => void
  /**
   * 重算所有阶段的 health 与 todayCount（stale 判定 + 跨天归零）
   * @param now 当前时间戳，默认 Date.now()
   */
  refresh: (now?: number) => void
  /** 重置为初始状态 */
  reset: () => void
}

/**
 * 构建初始五阶段状态
 *
 * @returns 各阶段 health=idle、lastEventAt=null、todayCount=0 的 Record
 */
function buildInitialStages(): Record<LoopStageId, LoopStage> {
  const { stageOrder, stageLabels } = getDefaultLoopConfig()
  const stages = {} as Record<LoopStageId, LoopStage>
  for (const id of stageOrder) {
    stages[id] = { id, label: stageLabels[id], health: 'idle', lastEventAt: null, todayCount: 0 }
  }
  return stages
}

const initialState = {
  stages: buildInitialStages(),
  updatedAt: 0,
  loading: false,
  error: null as string | null,
}

/**
 * useLoopStatusStore
 */
export const useLoopStatusStore = create<LoopStatusState>((set, get) => ({
  ...initialState,

  markStageEvent: (stageId, at = Date.now()) => {
    const prev = get().stages[stageId]
    const todayCount =
      prev.lastEventAt !== null && isSameLocalDay(prev.lastEventAt, at) ? prev.todayCount + 1 : 1
    set((s) => ({
      stages: {
        ...s.stages,
        [stageId]: { ...prev, lastEventAt: at, todayCount, health: 'active' as LoopStageHealth },
      },
      updatedAt: at,
      error: null,
    }))
    logger.info('[loopStatusStore] markStageEvent', { stageId, todayCount })
    withBroadcast(EVENT_NAMES.LOOP_STATUS_CHANGED, { action: 'markStageEvent', stageId, todayCount })
  },

  refresh: (now = Date.now()) => {
    const { staleThresholdMs, stageOrder } = getDefaultLoopConfig()
    set((s) => {
      const stages = {} as Record<LoopStageId, LoopStage>
      for (const id of stageOrder) {
        const stage = s.stages[id]
        stages[id] = {
          ...stage,
          todayCount: deriveTodayCount(stage.lastEventAt, stage.todayCount, now),
          health: deriveStageHealth(stage.lastEventAt, now, staleThresholdMs),
        }
      }
      return { stages, updatedAt: now }
    })
  },

  reset: () => {
    set({ ...initialState, stages: buildInitialStages() })
    logger.info('[loopStatusStore] reset')
    withBroadcast(EVENT_NAMES.LOOP_STATUS_CHANGED, { action: 'reset' })
  },
}))
