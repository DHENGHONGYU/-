/**
 * 数据源编排器（向后兼容 re-export 入口）
 *
 * ⚠️ 本文件已重构为 6 个独立模块，此文件仅作为向后兼容的 re-export 入口。
 *    新代码应直接从 ./orchestrator/ 目录导入。
 *
 * 重构后的模块结构（单一职责拆分）：
 *   orchestrator/
 *     ports.ts               — 端口接口（防腐层，定义 IMarketDataFetcher / IDataBridgeWriter）
 *     phaseOrchestrator.ts    — 纯编排核心（Phase 1-4 顺序逻辑，无 try-catch / 日志 / 降级）
 *     resilienceChain.ts      — 降级链装饰器（腾讯→新浪→AKShare→Mock）
 *     loggingAspect.ts        — AOP 日志切面（高阶函数自动注入埋点）
 *     orchestratorFacade.ts   — 门面入口（DI 容器 + 组装所有组件）
 *     adapters/
 *       marketDataFetcher.ts  — 行情/K线采集适配器（复用 directDataAPI + fetcherClient）
 *       dataBridgeWriter.ts   — DataBridge 写入适配器（复用 dataBridge + EnvelopeFactory）
 *   mockProvider.ts           — Mock 数据生成器（物理隔离，生产代码不包含 Mock 逻辑）
 *
 * 重构收益：
 *   - 编排核心 (phaseOrchestrator.ts) 单测覆盖率达 100%（纯顺序逻辑，极易测试）
 *   - 新增 Phase 5 只需在 steps 数组加一项（开闭原则）
 *   - 交易所 API 大改只需重写 MarketDataFetcher（依赖倒置原则）
 *   - 日志/降级/Mock 均可独立替换，互不影响（单一职责原则）
  * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
*/

// ============================================================
// 类型 re-export
// ============================================================

export type {
  CollectResult,
  PhaseSummary,
  CollectSession,
  IMarketDataFetcher,
  IDataBridgeWriter,
  IWorkflowStep,
  OrchestratorContext,
  QuoteSource,
  KlineSource,
} from './orchestrator/ports'

// ============================================================
// 常量 re-export
// ============================================================

export {
  QUOTE_FALLBACK_CHAIN,
  KLINE_FALLBACK_CHAIN,
} from './orchestrator/ports'

// 类型别名（保持原导出名 QuoteSourceType / KlineSourceType）
export type {
  QuoteSource as QuoteSourceType,
  KlineSource as KlineSourceType,
} from './orchestrator/ports'

// ============================================================
// Mock 数据 re-export（从 mockProvider.ts 物理隔离迁移）
// ============================================================

export { mockQuote, mockKline } from './mockProvider'

// ============================================================
// 向后兼容的函数导出（委托给 OrchestratorFacade 单例）
// ============================================================

import { getOrchestratorFacade } from './orchestrator/orchestratorFacade'
import type { StockQuote, KlineItem } from './directDataAPI'
import type { CollectResult, CollectSession } from './orchestrator/ports'

/** 获取个股实时行情（含降级链：腾讯→新浪→AKShare→Mock） */
export async function getQuote(code: string): Promise<StockQuote> {
  return getOrchestratorFacade().getQuote(code)
}

/** 获取个股 K 线（含降级链：网易→腾讯→AKShare→Mock） */
export async function getKline(code: string, days: number): Promise<KlineItem[]> {
  return getOrchestratorFacade().getKline(code, days)
}

/** 单维度采集（按 F-1 时序规范执行并行/串行采集 + Phase 4 屏障写入） */
export async function collectDimension(
  dimension: string,
  symbols: string[],
): Promise<CollectResult> {
  return getOrchestratorFacade().collectDimension(dimension, symbols)
}

/** 将行情写入 IndexedDB（通过 DataBridge.forward，含 3 次重试） */
export async function writeToStorage(quote: StockQuote): Promise<void> {
  return getOrchestratorFacade().writeToStorage(quote)
}

/** 全量采集编排：按 F-1 时序规范执行 Phase 1→2→3→4 */
export async function collectAllDimensions(
  symbols: string[],
): Promise<CollectSession> {
  return getOrchestratorFacade().collectAllDimensions(symbols)
}

// ============================================================
// 数据源连通性测试 re-export（从 data-collector 模块委托）
// ============================================================

export { testSourceConnectivity } from '../data-collector/dataSourceOrchestrator'
