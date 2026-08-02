/**
 * @file tests/type-tests/use-case-contracts.type-test.ts
 * @description 用例层类型契约测试 —— 确保用例 API 返回类型稳定，不意外变更
 *
 * 类型测试的目的：
 *   - 在编译期捕获接口契约变更
 *   - 防止"看起来改对了，其实类型变了"的隐性破坏
 *   - 作为 CI 门禁的一部分（tsc --noEmit 即可检测）
 *
 * 运行方式：
 *   npx tsc -p tsconfig.test.json --noEmit
 *
 * 如果此文件编译失败，说明用例层的公开类型契约发生了不兼容变更，
 * 需要同步更新此处的断言，并评估对调用方的影响。
 */

// ============================================================
// 用例层返回类型契约
// ============================================================
// 这里通过赋值测试确保用例层返回类型结构稳定
// （如果类型结构变了，赋值会编译失败）

import { placeBuyOrder, placeSellOrder } from '@/services/trading/use-cases/placeOrder'

// 验证用例函数存在且是异步函数
// 如果返回类型结构变化，下面的类型赋值会编译失败
const _testPlaceBuyOrder: (input: {
  symbol: string
  price: number
  quantity: number
  direction: 'buy' | 'sell'
}) => Promise<{ success: boolean; data?: unknown; error?: string }> = placeBuyOrder

const _testPlaceSellOrder: (input: {
  symbol: string
  price: number
  quantity: number
  direction: 'buy' | 'sell'
}) => Promise<{ success: boolean; data?: unknown; error?: string }> = placeSellOrder

// 引用防止 unused 警告
export const __use_case_contract_checks = {
  placeBuyOrder: typeof _testPlaceBuyOrder,
  placeSellOrder: typeof _testPlaceSellOrder,
}

// ============================================================
// DuckDB Provider 类型契约
// ============================================================
// 确保 DuckDBProvider 的公开接口类型稳定

import { DuckDBProviderImpl } from '@/services/storage/duckDBProvider'
import type { TimeSeriesProvider } from '@/services/storage/storageProvider'

// 验证 DuckDBProviderImpl 实现了 TimeSeriesProvider 接口
const _testDuckDBIsTimeSeriesProvider: TimeSeriesProvider = new DuckDBProviderImpl()

// 验证单例导出存在
const _testDuckDBSingleton: TimeSeriesProvider = duckDbProvider

// 验证 backend 和 morphologies 属性
const _testDuckDBBackend: 'duckdb' = duckDbProvider.backend
const _testDuckDBMorphologies: readonly ['time_series'] = duckDbProvider.morphologies

export const __duckdb_type_checks = {
  provider: typeof _testDuckDBIsTimeSeriesProvider,
  singleton: typeof _testDuckDBSingleton,
  backend: typeof _testDuckDBBackend,
  morphologies: typeof _testDuckDBMorphologies,
}

// ============================================================
// DuckDB querySQL 返回类型契约
// ============================================================

import type { SQLQueryResult, OHLCVRow } from '@/services/storage/duckDBProvider'

// 验证 SQLQueryResult 结构
const _testSQLQueryResult: SQLQueryResult = {
  success: true,
  data: [{ col1: 'value1' }],
  columns: ['col1'],
  rowCount: 1,
}

// 验证失败结果结构
const _testSQLQueryError: SQLQueryResult = {
  success: false,
  error: 'something went wrong',
}

// 验证 OHLCVRow 结构
const _testOHLCVRow: OHLCVRow = {
  timestamp: 1000,
  open: 100,
  high: 110,
  low: 90,
  close: 105,
  volume: 1000,
}

export const __duckdb_return_type_checks = {
  querySuccess: typeof _testSQLQueryResult,
  queryError: typeof _testSQLQueryError,
  ohlcv: typeof _testOHLCVRow,
}

// ============================================================
// MCP Tool 类型契约
// ============================================================
// 确保工具描述符结构稳定

import type { ToolDescriptor } from '@/mcp/core/types'

// 验证 ToolDescriptor 有 name 和 handler 字段
const _testToolDescriptor: Pick<ToolDescriptor, 'name' | 'handler'> = {
  name: 'test_tool',
  handler: async () => ({ content: [] }),
}

export const __tool_descriptor_check = typeof _testToolDescriptor

// ============================================================
// SemanticSearcher 类型契约
// ============================================================

import { semanticSearcher, semanticSearch } from '@/services/data-sync-search/semanticSearcher'
import type { SearchItem } from '@/types/modules/data-sync.types'

// 验证单例导出存在
const _searcher = semanticSearcher

// 验证核心方法存在且类型正确
const _testIndexDocs: (items: readonly SearchItem[]) => void = _searcher.index.bind(_searcher)
const _testSearch: (query: string, topK?: number) => Array<{ item: SearchItem; score: number }> = _searcher.search.bind(_searcher)

// 验证便捷函数
const _testSemanticSearch: (
  query: string,
  items: readonly SearchItem[],
  topK?: number,
) => Array<{ item: SearchItem; score: number }> = semanticSearch

export const __semantic_search_type_checks = {
  index: typeof _testIndexDocs,
  search: typeof _testSearch,
  helper: typeof _testSemanticSearch,
}

// ============================================================
// DataLayerResult 类型契约
// ============================================================

import type { DataLayerResult } from '@/data/types'

// 验证成功结果
const _testDataLayerSuccess: DataLayerResult<string> = {
  success: true,
  data: 'hello',
}

// 验证失败结果
const _testDataLayerError: DataLayerResult<string> = {
  success: false,
  error: 'not found',
}

export const __data_layer_result_checks = {
  success: typeof _testDataLayerSuccess,
  error: typeof _testDataLayerError,
}

// ============================================================
// 运行时占位（防止 tree-shaking 移除类型导入）
// ============================================================
export const __type_test__ = 'USE_CASE_CONTRACTS'
