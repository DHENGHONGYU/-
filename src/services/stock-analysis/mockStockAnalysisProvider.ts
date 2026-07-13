/**
 * @fileoverview 股票分析业务数据提供者
 *
 * 职责：
 * - 为投资画像、KAI 评分、模型对比、股票池、智能聊天、热门板块、价值洼地等 Widget 提供数据
 * - 通过 Strategy 模式注入评分/数据来源，不再在内部硬编码评分计算
 *
 * 架构变更（P5-7）：
 * - 原文件内含大量 Math.random 评分生成逻辑，现全部迁移到
 *   src/services/stock-analysis/scoringStrategy.ts 的策略实现中
 * - 本文件仅作为策略消费方和公共 API 入口
 * - MockStockAnalysisProvider 默认使用 MockStockAnalysisScoringStrategy，
 *   保持开发/测试环境行为不变
 * - 生产环境应在应用启动时调用 setStockAnalysisScoringStrategy() 注入真实策略
 *
 * @see src/services/stock-analysis/scoringStrategy.ts — 策略接口与实现
 * @see src/services/data-collector/collectors/MockCollector.ts — 采集层不再生成评分
 */

import type {
  AnalysisScores,
  ModelComparison,
  PoolBoard,
  ChatHistory,
  ChatMessage,
  HotSectorData,
  ValuePitData,
} from '@/types/modules/widget.types'
import { getLogger } from '@/lib/logger'
import {
  MockStockAnalysisScoringStrategy,
  type StockAnalysisScoringStrategy,
} from './scoringStrategy'

const logger = getLogger()

let injectedStrategy: StockAnalysisScoringStrategy | undefined

/**
 * 注入股票分析评分策略。
 * @param strategy 评分策略实例
 * @remarks 生产环境应在 bootstrap 阶段注入 RealStockAnalysisScoringStrategy 或后端 API 适配策略
 */
export function setStockAnalysisScoringStrategy(strategy: StockAnalysisScoringStrategy): void {
  injectedStrategy = strategy
  logger.info('[MockStockAnalysisProvider] 评分策略已注入', {
    strategy: strategy.constructor.name,
  })
}

/**
 * 获取当前评分策略。未注入时返回默认 Mock 策略。
 */
export function getStockAnalysisScoringStrategy(): StockAnalysisScoringStrategy {
  if (!injectedStrategy) {
    injectedStrategy = new MockStockAnalysisScoringStrategy()
  }
  return injectedStrategy
}

/**
 * 重置为默认 Mock 策略（主要用于测试隔离）。
 */
export function resetStockAnalysisScoringStrategy(): void {
  injectedStrategy = new MockStockAnalysisScoringStrategy()
  logger.info('[MockStockAnalysisProvider] 评分策略已重置为默认 Mock 策略')
}

/**
 * 股票分析业务数据提供者
 * @description 所有静态方法委托给当前注入的 StockAnalysisScoringStrategy
 */
export class MockStockAnalysisProvider {
  /**
   * 获取投资画像 / 分析评分数据
   */
  static getAnalysisScores(): Promise<AnalysisScores> {
    return getStockAnalysisScoringStrategy().getAnalysisScores()
  }

  /**
   * 获取 AI 大模型对比数据
   */
  static getModelComparison(): Promise<ModelComparison> {
    return getStockAnalysisScoringStrategy().getModelComparison()
  }

  /**
   * 获取股票池看板数据
   */
  static getPoolBoard(page = 1, pageSize = 8): Promise<PoolBoard> {
    return getStockAnalysisScoringStrategy().getPoolBoard(page, pageSize)
  }

  /**
   * 获取聊天历史数据
   */
  static getChatHistory(target = '000858'): Promise<ChatHistory> {
    return getStockAnalysisScoringStrategy().getChatHistory(target)
  }

  /**
   * 获取热门板块策略评分数据
   */
  static getHotSectors(): Promise<HotSectorData[]> {
    return getStockAnalysisScoringStrategy().getHotSectors()
  }

  /**
   * 获取价值洼地策略评分数据
   */
  static getValuePit(): Promise<ValuePitData[]> {
    return getStockAnalysisScoringStrategy().getValuePit()
  }

  /**
   * 模拟发送聊天消息并返回助手回复
   */
  static sendChatMessage(target: string, question: string): Promise<ChatMessage> {
    return getStockAnalysisScoringStrategy().sendChatMessage(target, question)
  }
}
