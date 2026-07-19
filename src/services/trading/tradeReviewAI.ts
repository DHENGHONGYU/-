/**
 * @module services/trading/tradeReviewAI
 * @description AI 交易复盘报告生成器 - Facade 入口
 *
 * 具体实现已抽取至 services/useCase/generateTradeReview.useCase。
 * 本文件保留为兼容入口，新代码请直接从 UseCase 导入。
 *
 * @deprecated 请优先使用 services/useCase/generateTradeReview.useCase
  * @doc [V9-DOC-BACK-013, V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-ARCH-008, V9-DOC-BACK-005]
*/

export { generateTradeReviewUseCase as generateReview } from '@/services/useCase/generateTradeReview.useCase'
export { generateTradeReviewAsyncUseCase as generateReviewAsync } from '@/services/useCase/generateTradeReview.useCase'

// 重新导出所有类型与辅助模块（保持向后兼容）
export * from './tradeReviewAI.types'
export { SKILL_DIMENSIONS } from './tradeReviewAI.dimensions'
export { generatePsychologicalProfile, generateRiskProfile } from './tradeReviewAI.profileGenerator'
