/**
 * @module services/ai-center/aiCenterProvider
 * @description AI 智能体调度中心数据提供器。
 *
 * 提供 AICenterProvider 接口与本地 Mock 实现（MockAICenterProvider）。
 * 当前为纯前端个人研究工具，默认使用 Mock 实现生成本地模拟数据；
 * 未来接入后端时，新增 REST/WebSocket 实现并替换 getAICenterProvider() 工厂即可，
 * UI 与 Store 层无需改动。
 *
 * 架构变更（P5-7）：
 * - 原文件内含 Math.random 健康评分生成逻辑，现全部迁移到
 *   src/services/ai-center/healthScoringStrategy.ts 的策略实现中
 * - MockAICenterProvider 通过 setAIHealthScoringStrategy() 注入策略
 * - 生产环境应在应用启动时注入 RealAIHealthScoringStrategy 或后端 API 适配策略
 *
 * @see src/services/ai-center/healthScoringStrategy.ts — 策略接口与实现
 */

import type { AICenterData } from '@/types/modules/ai-center.types'
import { getLogger } from '@/lib/logger'
import { MockAIHealthScoringStrategy, type AIHealthScoringStrategy } from './healthScoringStrategy'

const logger = getLogger()

/** AI 中心数据提供器接口（可替换为 REST/WebSocket 实现） */
export interface AICenterProvider {
  /** 获取 AI 中心统一数据：智能体列表 + 健康监控 + 诊断分析 */
  getAICenterData: () => Promise<AICenterData>
}

let injectedStrategy: AIHealthScoringStrategy | undefined

/**
 * 注入 AI 中心健康评分策略。
 * @param strategy 健康评分策略实例
 */
export function setAIHealthScoringStrategy(strategy: AIHealthScoringStrategy): void {
  injectedStrategy = strategy
  logger.info('[MockAICenterProvider] 健康评分策略已注入', {
    strategy: strategy.constructor.name,
  })
}

/**
 * 获取当前健康评分策略。
 * DEV: 未注入时使用 Mock 策略（开发阶段回退）。
 * PROD: 未注入时抛出 Error（必须显式注入真实策略）。
 */
export function getAIHealthScoringStrategy(): AIHealthScoringStrategy {
  if (!injectedStrategy) {
    if (import.meta.env.PROD) {
      throw new Error('[AICenterProvider] 生产环境未注入 AIHealthScoringStrategy，禁止静默使用 Mock')
    }
    injectedStrategy = new MockAIHealthScoringStrategy()
  }
  return injectedStrategy
}

/**
 * 重置策略（主要用于测试隔离）。
 * DEV: 重置为 Mock。PROD: 禁止重置。
 */
export function resetAIHealthScoringStrategy(): void {
  if (import.meta.env.PROD) {
    logger.warn('[AICenterProvider] 生产环境禁止重置策略')
    return
  }
  injectedStrategy = new MockAIHealthScoringStrategy()
  logger.info('[MockAICenterProvider] 健康评分策略已重置为默认 Mock 策略')
}

/**
 * AI 中心 Mock 数据提供器
 * @description 所有方法委托给当前注入的 AIHealthScoringStrategy
 */
export class MockAICenterProvider implements AICenterProvider {
  getAICenterData(): Promise<AICenterData> {
    return getAIHealthScoringStrategy().getAICenterData()
  }
}
