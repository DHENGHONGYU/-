/**
 * @module store/loopStatusSubscriptions
 * @description loopStatusStore EventBus 订阅管理
 *
 * 依据 loopConfig 的「EventBus 事件 → 闭环阶段」映射表订阅事件脉搏，
 * 事件到达时调用 loopStatusStore.markStageEvent 更新对应阶段状态。
 *
 * 落位说明：本模块原拟置于 services/loop/，但 audit:layers 规则 5
 * 禁止 services 直接依赖 store；项目既有惯例（executionStoreSubscriptions、
 * dataflowStore.initDataflowSubscriptions）均将「EventBus → store」订阅
 * 模块置于 store 层，故遵例落位于此。
 *
 * 核心设计原则：
 *   1. 幂等初始化：重复调用先销毁旧订阅再重建
 *   2. 完整清理：返回的 cleanup 取消全部事件订阅
 *
 * @compliance AGENTS.md §一 分层规则：store 层仅依赖 services / core / config / lib
 */

import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { getDefaultLoopConfig } from '@/config/loopConfig'
import { useLoopStatusStore } from './loopStatusStore'

const logger = getLogger()

/** 当前生效的清理函数（防止重复初始化导致订阅泄漏） */
let _activeCleanup: (() => void) | null = null

/**
 * 初始化闭环状态订阅
 *
 * 幂等：重复调用会先销毁旧订阅再重新注册。
 * 事件回调在订阅管理模块（非组件）中调用 getState() 属铁律类型 C 场景。
 *
 * @returns 清理函数，调用后取消全部事件订阅（必须在组件 cleanup 中调用）
 */
export function initLoopStatusSubscriptions(): () => void {
  if (_activeCleanup) {
    logger.info('[LoopStatusSubscriptions] 检测到旧订阅，先销毁再重建')
    _activeCleanup()
    _activeCleanup = null
  }

  const { eventStageMap } = getDefaultLoopConfig()
  const unsubscribes = eventStageMap.map(({ event, stage }) =>
    eventBus.on(event, () => {
      useLoopStatusStore.getState().markStageEvent(stage)
    }),
  )

  logger.info('[LoopStatusSubscriptions] initLoopStatusSubscriptions 完成', {
    subscriptions: unsubscribes.length,
  })

  const cleanup = (): void => {
    unsubscribes.forEach((unsubscribe) => unsubscribe())
    if (_activeCleanup === cleanup) {
      _activeCleanup = null
    }
    logger.info('[LoopStatusSubscriptions] subscriptions disposed', { count: unsubscribes.length })
  }

  _activeCleanup = cleanup
  return cleanup
}
