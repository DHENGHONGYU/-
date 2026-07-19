/**
 * @module store/initGlobalSubscriptions
 * @description 统一的全局Store订阅初始化入口。
 *
 * 设计原则：
 * - 应用启动时一次性初始化所有核心Store的DataBridge订阅
 * - 全局订阅不会随组件卸载而销毁，确保懒加载Widget挂载前数据已就绪
 * - 统一防抖300ms + 最小刷新间隔2000ms，防止信号震荡
 * - 提供测试环境统一重置函数
 *
 * 使用方式：
 * ```ts
 * // 在App.tsx的useEffect中调用一次
 * import { initAllGlobalSubscriptions } from '@/store/initGlobalSubscriptions'
 * initAllGlobalSubscriptions()
 * ```
 */

import { getLogger } from '@/lib/logger'
import { initSignalStoreGlobalSubscriptions, _resetSignalStoreSubscriptionsForTest } from '@/store/signalStore'
import { initMarketDataStoreGlobalSubscriptions, _resetMarketDataStoreSubscriptionsForTest } from '@/store/marketDataStore'
import { initDualStrategyStoreGlobalSubscriptions, _resetDualStrategyStoreSubscriptionsForTest } from '@/store/dualStrategyStore'
import { initRiskStoreGlobalSubscriptions, _resetRiskStoreSubscriptionsForTest } from '@/store/riskStore'

const logger = getLogger()

let _initialized = false

/**
 * 初始化所有核心Store的全局订阅。
 * 幂等：重复调用安全，只会初始化一次。
 */
export function initAllGlobalSubscriptions(): void {
  if (_initialized) {
    logger.debug('[initGlobalSubscriptions] Already initialized, skipping')
    return
  }

  logger.info('[initGlobalSubscriptions] Initializing all global store subscriptions...')

  // 按数据依赖顺序初始化：基础数据 → 分析计算 → 信号输出
  initMarketDataStoreGlobalSubscriptions()
  initDualStrategyStoreGlobalSubscriptions()
  initRiskStoreGlobalSubscriptions()
  initSignalStoreGlobalSubscriptions()

  _initialized = true
  logger.info('[initGlobalSubscriptions] All global store subscriptions initialized')
}

/**
 * 测试环境：重置所有Store订阅状态。
 * 仅用于测试，生产环境不应调用。
 */
export function _resetAllGlobalSubscriptionsForTest(): void {
  _resetMarketDataStoreSubscriptionsForTest()
  _resetDualStrategyStoreSubscriptionsForTest()
  _resetRiskStoreSubscriptionsForTest()
  _resetSignalStoreSubscriptionsForTest()
  _initialized = false
  logger.info('[initGlobalSubscriptions] All subscriptions reset for test')
}
