/**
 * @module services/trading/dualStrategyEngine
 * @description 双策略编排引擎 facade
 *
 * 原跨域编排逻辑已抽取至 services/useCase/runDualStrategy.useCase。
 * 本文件保留为兼容入口，重新导出 UseCase 函数，避免上游调用方立即变更。
 *
 * @deprecated 请优先使用 services/useCase/runDualStrategy.useCase
 */

import {
  runDualStrategyUseCase,
  type RunDualStrategyInput,
} from '@/services/useCase/runDualStrategy.useCase'
import type { DataLayerResult, DualStrategyResult } from '@/data/types'

export type { RunDualStrategyOptions } from '@/services/useCase/runDualStrategy.useCase'

/**
 * 双策略编排引擎（兼容入口）
 *
 * @deprecated 请直接使用 runDualStrategyUseCase
 */
export async function runDualStrategy(
  stocks: Parameters<typeof runDualStrategyUseCase>[0]['stocks'],
  options: Omit<RunDualStrategyInput, 'stocks'> = {},
): Promise<DataLayerResult<DualStrategyResult>> {
  return runDualStrategyUseCase({ stocks, ...options })
}
