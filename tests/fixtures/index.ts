/**
 * @fileoverview 测试数据夹具统一入口
 * @description re-export 现有的测试数据生成器，提供按业务域组织的访问方式
 *
 * 设计原则：
 * - 不重复造轮子：re-export tests/mockStockData.ts 和 tests/helpers/widget-test.utils.ts
 * - 按业务域分类导出：stocks / widgets / llm
 * - 新增 fixture 优先放入 tests/fixtures/{业务域}/，再在此处 re-export
 *
 * 使用示例：
 * ```typescript
 * import { MOCK_STOCK_SCENARIOS, buildWidgetConfig } from '../fixtures'
 * ```
 */

// ============================================================
// 股票 / 评分 / 行业数据（来自 mockStockData.ts）
// ============================================================
export {
  generateKlineHistory,
  generateDailyQuotes,
  buildLayerInput,
  generateMockStocks,
  generateMockDailyQuotesList,
  MOCK_STOCK_HIGH_QUALITY,
  MOCK_FINANCIALS_HIGH_QUALITY,
  MOCK_QUOTES_HIGH_QUALITY,
  MOCK_STOCK_VALUE_PIT,
  MOCK_FINANCIALS_VALUE_PIT,
  MOCK_QUOTES_VALUE_PIT,
  MOCK_STOCK_HOT_MOMENTUM,
  MOCK_FINANCIALS_HOT_MOMENTUM,
  MOCK_QUOTES_HOT_MOMENTUM,
  MOCK_STOCK_PROBLEM,
  MOCK_FINANCIALS_PROBLEM,
  MOCK_QUOTES_PROBLEM,
  MOCK_INDUSTRY_SCORE_SEMICONDUCTOR,
  MOCK_INDUSTRY_SCORE_FINANCE,
  MOCK_INDUSTRY_SCORE_AI_TMT,
  MOCK_STOCK_SCENARIOS,
} from '../mockStockData'

// ============================================================
// Widget 测试数据（来自 helpers/widget-test.utils.ts）
// ============================================================
export { buildWidgetConfig, buildSectorHeatmapData, DEFAULT_HOT_SECTORS } from '../helpers/widget-test.utils'

// ============================================================
// 类型测试 fixture（来自 __tests__/types/fixtures/）
// ============================================================
export type { BaseUser, UserType } from '../__tests__/types/fixtures/userTypes'

// ============================================================
// 业务域 fixture（builder + override 模式）
// ============================================================
export * from './orders'
export * from './signals'
export * from './portfolios'
// 2026-08-09: 移除 export * from './profile'（profileStore 已归档删除，fixture 无消费者）
