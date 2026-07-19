/**
 * @fileoverview 交易复盘评分计算
 *
 * 职责：
 * - 将交易复盘相关的评分计算（如纪律分）从采集层/Mock 数据生成器中提取到分析层
 * - 支持注入评分策略，便于生产环境接入真实复盘分析服务
 *
 * 架构变更（P5-7）：
 * - disciplineScore 等评分不再在 mockDataCollection.ts 中硬编码生成
 * - 通过 ScoreCalculator 接口统一计算入口
 *
 * @see src/services/data-collector/mockDataCollection.ts — 消费方
/**
 * 交易复盘评分计算器接口
 */
export interface TradeReviewScoreCalculator {
  /** 计算交易纪律分（0-100） */
  calculateDisciplineScore(): number
}

/**
 * Mock 交易复盘评分计算器
 * @description 开发/测试环境默认实现
 */
export class MockTradeReviewScoreCalculator implements TradeReviewScoreCalculator {
  calculateDisciplineScore(): number {
    // Mock 环境返回 50-100 之间的随机纪律分
    return Math.floor(Math.random() * 51) + 50
  }
}

/**
 * 真实交易复盘评分计算器（占位实现）
 * @description 生产环境应注入此实现，从交易记录和行为分析服务计算真实纪律分
 */
export class RealTradeReviewScoreCalculator implements TradeReviewScoreCalculator {
  calculateDisciplineScore(): number {
    // TODO: 接入真实交易复盘分析服务
    throw new Error('RealTradeReviewScoreCalculator.calculateDisciplineScore() not implemented')
  }
}

let injectedCalculator: TradeReviewScoreCalculator | undefined

/**
 * 注入交易复盘评分计算器
 */
export function setTradeReviewScoreCalculator(calculator: TradeReviewScoreCalculator): void {
  injectedCalculator = calculator
}

/**
 * 获取当前评分计算器
 */
export function getTradeReviewScoreCalculator(): TradeReviewScoreCalculator {
  if (!injectedCalculator) {
    injectedCalculator = new MockTradeReviewScoreCalculator()
  }
  return injectedCalculator
}

/**
 * 重置为默认 Mock 评分计算器
 */
export function resetTradeReviewScoreCalculator(): void {
  injectedCalculator = new MockTradeReviewScoreCalculator()
}
