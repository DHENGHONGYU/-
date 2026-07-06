/**
 * @fileoverview dataLayer 模块 mock 实现
 * @description 提供给 vi.mock('@/data/dataLayer', () => dataLayerMock) 使用
 *
 * 设计原则：
 * - 所有方法返回成功结果（默认空数组/undefined）
 * - 测试中可通过 vi.mocked(dataLayer.xxx).mockResolvedValueOnce(...) 覆盖具体返回值
 * - 写操作返回 { success: true }，符合 DataLayerResult 类型
 *
 * 使用示例：
 * ```typescript
 * import { dataLayerMock } from '../__mocks__/dataLayerMock'
 *
 * vi.mock('@/data/dataLayer', () => dataLayerMock)
 *
 * it('应调用 dataLayer.stocks.getAll', async () => {
 *   await myService.fetchStocks()
 *   expect(dataLayerMock.dataLayer.stocks.getAll).toHaveBeenCalled()
 * })
 * ```
 */

import { vi } from 'vitest'
import type {
  DailyQuotes,
  ExecutionLog,
  ExecutionPlan,
  HotSectorScore,
  IndustryScore,
  IntelligentScore,
  LocalDoc,
  MissingReport,
  NewsArticle,
  Order,
  Portfolio,
  ResearchLog,
  RotationSectorScore,
  ScoreDocVersion,
  SectorScoreRecord,
  SentimentCache,
  Signal,
  Stock,
  StrategySnapshot,
  ValuePitScore,
  V6Score,
} from '@/data/types'
import type { TradeReviewRecord } from '@/services/trading/tradeReviewAI'
import type { DataLayerResult } from '@/data/types'

// ============================================================
// 类型定义
// ============================================================

/** 通用成功结果 */
const successResult = <T>(): DataLayerResult<T> => ({ success: true })

// ============================================================
// 各业务域 mock（按 dataLayer.ts 的导出结构组织）
// ============================================================

export const stocks = {
  getAll: vi.fn(async (): Promise<Stock[]> => []),
  getById: vi.fn(async (_symbol: string): Promise<Stock | undefined> => undefined),
  upsert: vi.fn(async (_stock: Stock): Promise<DataLayerResult<Stock>> => successResult()),
  updateStatus: vi.fn(
    async (_symbol: string, _status: string): Promise<DataLayerResult<Stock>> => successResult(),
  ),
  delete: vi.fn(async (_symbol: string): Promise<DataLayerResult<void>> => successResult()),
  getByGroup: vi.fn(async (_group: string): Promise<Stock[]> => []),
  getByStatus: vi.fn(async (_status: string): Promise<Stock[]> => []),
}

export const orders = {
  getAll: vi.fn(async (): Promise<Order[]> => []),
  getById: vi.fn(async (_id: string): Promise<Order | undefined> => undefined),
  create: vi.fn(async (_order: Order): Promise<DataLayerResult<Order>> => successResult()),
  update: vi.fn(async (_order: Order): Promise<DataLayerResult<Order>> => successResult()),
}

export const signals = {
  getAll: vi.fn(async (): Promise<Signal[]> => []),
  getBySymbol: vi.fn(async (_symbol: string): Promise<Signal[]> => []),
  upsert: vi.fn(async (_signal: Signal): Promise<DataLayerResult<Signal>> => successResult()),
}

export const portfolios = {
  getAll: vi.fn(async (): Promise<Portfolio[]> => []),
  getById: vi.fn(async (_id: string): Promise<Portfolio | undefined> => undefined),
  upsert: vi.fn(async (_p: Portfolio): Promise<DataLayerResult<Portfolio>> => successResult()),
}

export const v6Scores = {
  getAll: vi.fn(async (): Promise<V6Score[]> => []),
  getBySymbol: vi.fn(async (_symbol: string): Promise<V6Score | undefined> => undefined),
  upsert: vi.fn(async (_score: V6Score): Promise<DataLayerResult<V6Score>> => successResult()),
}

export const valuePitScores = {
  getAll: vi.fn(async (): Promise<ValuePitScore[]> => []),
  getBySymbol: vi.fn(async (_symbol: string): Promise<ValuePitScore | undefined> => undefined),
  upsert: vi.fn(async (_s: ValuePitScore): Promise<DataLayerResult<ValuePitScore>> => successResult()),
}

export const industryScores = {
  getAll: vi.fn(async (): Promise<IndustryScore[]> => []),
  upsert: vi.fn(async (_s: IndustryScore): Promise<DataLayerResult<IndustryScore>> => successResult()),
}

export const sectorScores = {
  getAll: vi.fn(async (): Promise<SectorScoreRecord[]> => []),
  upsert: vi.fn(
    async (_s: SectorScoreRecord): Promise<DataLayerResult<SectorScoreRecord>> => successResult(),
  ),
}

export const rotationScores = {
  getAll: vi.fn(async (): Promise<RotationSectorScore[]> => []),
  upsert: vi.fn(
    async (_s: RotationSectorScore): Promise<DataLayerResult<RotationSectorScore>> => successResult(),
  ),
}

export const hotSectorScores = {
  getAll: vi.fn(async (): Promise<HotSectorScore[]> => []),
  upsert: vi.fn(
    async (_s: HotSectorScore): Promise<DataLayerResult<HotSectorScore>> => successResult(),
  ),
}

export const intelligentScores = {
  getAll: vi.fn(async (): Promise<IntelligentScore[]> => []),
  getBySymbol: vi.fn(async (_symbol: string): Promise<IntelligentScore | undefined> => undefined),
  upsert: vi.fn(
    async (_s: IntelligentScore): Promise<DataLayerResult<IntelligentScore>> => successResult(),
  ),
}

export const dailyQuotes = {
  getBySymbol: vi.fn(async (_symbol: string): Promise<DailyQuotes | undefined> => undefined),
  upsert: vi.fn(async (_q: DailyQuotes): Promise<DataLayerResult<DailyQuotes>> => successResult()),
}

export const news = {
  articles: {
    getAll: vi.fn(async (): Promise<NewsArticle[]> => []),
    getById: vi.fn(async (_id: string): Promise<NewsArticle | undefined> => undefined),
    upsert: vi.fn(async (_n: NewsArticle): Promise<DataLayerResult<NewsArticle>> => successResult()),
  },
}

export const researchLogs = {
  getAll: vi.fn(async (): Promise<ResearchLog[]> => []),
  upsert: vi.fn(async (_l: ResearchLog): Promise<DataLayerResult<ResearchLog>> => successResult()),
}

export const missingReports = {
  getAll: vi.fn(async (): Promise<MissingReport[]> => []),
  upsert: vi.fn(async (_r: MissingReport): Promise<DataLayerResult<MissingReport>> => successResult()),
}

export const executionPlans = {
  getAll: vi.fn(async (): Promise<ExecutionPlan[]> => []),
  upsert: vi.fn(async (_p: ExecutionPlan): Promise<DataLayerResult<ExecutionPlan>> => successResult()),
}

export const executionLogs = {
  getAll: vi.fn(async (): Promise<ExecutionLog[]> => []),
  upsert: vi.fn(async (_l: ExecutionLog): Promise<DataLayerResult<ExecutionLog>> => successResult()),
}

export const strategySnapshots = {
  getAll: vi.fn(async (): Promise<StrategySnapshot[]> => []),
  upsert: vi.fn(
    async (_s: StrategySnapshot): Promise<DataLayerResult<StrategySnapshot>> => successResult(),
  ),
}

export const localDocs = {
  getAll: vi.fn(async (): Promise<LocalDoc[]> => []),
  upsert: vi.fn(async (_d: LocalDoc): Promise<DataLayerResult<LocalDoc>> => successResult()),
}

export const scoreDocs = {
  getAll: vi.fn(async (): Promise<ScoreDocVersion[]> => []),
  upsert: vi.fn(
    async (_s: ScoreDocVersion): Promise<DataLayerResult<ScoreDocVersion>> => successResult(),
  ),
}

export const sentimentCaches = {
  getAll: vi.fn(async (): Promise<SentimentCache[]> => []),
  upsert: vi.fn(
    async (_s: SentimentCache): Promise<DataLayerResult<SentimentCache>> => successResult(),
  ),
}

export const tradeReviews = {
  getAll: vi.fn(async (): Promise<TradeReviewRecord[]> => []),
  upsert: vi.fn(
    async (_t: TradeReviewRecord): Promise<DataLayerResult<TradeReviewRecord>> => successResult(),
  ),
}

// ============================================================
// 统一导出（与 dataLayer.ts 的命名导出结构对齐）
// ============================================================

export const dataLayer = {
  stocks,
  orders,
  signals,
  portfolios,
  v6Scores,
  valuePitScores,
  industryScores,
  sectorScores,
  rotationScores,
  hotSectorScores,
  intelligentScores,
  dailyQuotes,
  news,
  researchLogs,
  missingReports,
  executionPlans,
  executionLogs,
  strategySnapshots,
  localDocs,
  scoreDocs,
  sentimentCaches,
  tradeReviews,
}

/**
 * 重置所有 dataLayer mock 的调用记录
 * 在 beforeEach 中调用，避免跨测试用例污染
 *
 * @example
 * ```typescript
 * import { resetDataLayerMocks } from '../__mocks__/dataLayerMock'
 *
 * beforeEach(() => {
 *   resetDataLayerMocks()
 * })
 * ```
 */
export function resetDataLayerMocks(): void {
  const allMocks = Object.values(dataLayer).flatMap((group) => Object.values(group))
  for (const mockFn of allMocks) {
    if (typeof mockFn === 'function' && 'mockReset' in mockFn) {
      ;(mockFn as ReturnType<typeof vi.fn>).mockReset()
    }
  }
}

/**
 * 默认导出：用于 vi.mock 工厂函数
 *
 * @example
 * ```typescript
 * vi.mock('@/data/dataLayer', () => dataLayerMockModule.dataLayer)
 * ```
 */
export default dataLayer
