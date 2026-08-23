/**
 * @fileoverview pipelineMappings
 * @description collectionPipeline 拆分（2026-08-23 遗留问题整改 P3）：
 * 维度 → 模式/动作/数据源 的静态映射与降级链解析（纯函数）。
 * 对外 API 由 `collectionPipeline.ts`（facade）统一 re-export，保持零破坏。
 *
 * @module services/data-collector/pipeline/pipelineMappings
 */

import { getLogger } from '@/lib/logger'
import { ENVELOPE_ACTION } from '@/config/dbConfig'
import type { EnvelopeAction } from '@/config/dbConfig'
import type {
  CollectionConfig,
  DimensionPipelineConfig,
  QuoteDataSourceId,
  SourcePriorityItem,
} from '@/types/modules/collection.types'
import { DIMENSION_TO_MODE, type CollectionMode } from './pipelineTypes'

const logger = getLogger()

/**
 * resolveDimensionMode
 * @param dimensionCode
 * @returns CollectionMode
 */
export function resolveDimensionMode(dimensionCode: string): CollectionMode {
  return DIMENSION_TO_MODE[dimensionCode] ?? 'unsupported'
}

/** 维度 → ENVELOPE_ACTION 映射（非行情维度写入时使用）
 * 导出供 data-collector:dry-run 静态接线校验（防「已注册未接线」漂移）。 */
export const DIMENSION_TO_ACTION: Readonly<Record<string, EnvelopeAction>> = {
  '03': ENVELOPE_ACTION.saveNews,             // 筹码 → news store (带 _mock 标记)
  '04': ENVELOPE_ACTION.saveNews,             // 重大事项 → news store
  '05': ENVELOPE_ACTION.saveNews,             // 热点新闻 → news store
  '06': ENVELOPE_ACTION.saveSectorScores,     // 行业竞品 → sector_scores store
  '07': ENVELOPE_ACTION.saveSectorScores,     // 关联指数 → sector_scores store
  '08': ENVELOPE_ACTION.saveResearchLog,      // 研报中心 → research_logs store
  // 2026-08-21 接线修复：10-14 统一写 local_docs（沿用 15/16 先例）；
  // 不写 hot_sector_scores —— 该 store 是双策略评分存储（keyPath=symbol），
  // 写入原始采集数据会覆盖 analyzer/dualStrategyStore 的策略评分。
  // 2026-08-22 升级（v36）：维度 10 改道 sector_collect_data 专用存储（结构化消费）。
  // 2026-08-23 升级（v38，遗留问题整改 P2）：维度 11-14 改道 dimension_collect_data
  // 通用专用存储（脱离 local_docs），15/16 仍写 local_docs（待后续立项）。
  '10': ENVELOPE_ACTION.saveSectorCollectData, // 热门板块 → sector_collect_data store（v36 专用存储）
  '11': ENVELOPE_ACTION.saveDimensionCollectData, // 技术指标 → dimension_collect_data store（v38 专用存储）
  '12': ENVELOPE_ACTION.saveDimensionCollectData, // 资金流向 → dimension_collect_data store（v38 专用存储）
  '13': ENVELOPE_ACTION.saveDimensionCollectData, // 机构持仓 → dimension_collect_data store（v38 专用存储）
  '14': ENVELOPE_ACTION.saveDimensionCollectData, // 估值分析 → dimension_collect_data store（v38 专用存储）
  '15': ENVELOPE_ACTION.saveLocalDocs,        // 分红股本 → local_docs store
  '16': ENVELOPE_ACTION.saveLocalDocs,        // 一致预期 → local_docs store
}

/**
 * 业务数据源 → 直连行情数据源的默认映射。
 *
 * P0 优化（2026-08-09）：腾讯/新浪升为日频基础盘主源，akshare（Python 后端）降为增强源。
 * 原因：腾讯/新浪经 Vite proxy 免费直连，延迟 <300ms，无需 Token；
 * akshare 依赖 Python :8000 服务，环境不稳定时首请求即超时浪费 ~5s。
 */
export const BUSINESS_TO_QUOTE_SOURCE: Readonly<Record<string, QuoteDataSourceId[]>> = {
  akshare: ['ifind_mcp', 'tencent_mcp', 'tencent', 'sina', 'akshare'],
  ifind: ['ifind_mcp', 'tencent_mcp', 'tencent', 'sina'],
  yahoo: ['ifind_mcp', 'tencent_mcp', 'tencent', 'sina'],
  tianyancha: ['ifind_mcp', 'tencent_mcp', 'mock'],
  scholar: ['ifind_mcp', 'tencent_mcp', 'mock'],
  cache: ['ifind_mcp', 'tencent_mcp', 'mock'],
}

/**
 * internalBuildDefaultSourcePriority
 *
 * @param dimension 维度配置
 * @param allowMockFallback 是否注入 mock 兜底（缺省 true 保持旧行为；
 *   传 false 时映射表中的 mock 项与末尾 mock 兜底均被剔除 —— 假绿灯修复）
 *
 * 注：对外 buildDefaultSourcePriority 从 @/domain/collection/pipeline re-export
 * （见 facade 文件顶部）；此处为内部副本（同语义）。
 */
export function internalBuildDefaultSourcePriority(
  dimension: DimensionPipelineConfig,
  allowMockFallback = true,
): SourcePriorityItem[] {
  const seen = new Set<QuoteDataSourceId>()
  const items: SourcePriorityItem[] = []
  let priority = 1

  for (const businessSource of dimension.sources) {
    const mapped = BUSINESS_TO_QUOTE_SOURCE[businessSource] ?? ['mock']
    for (const id of mapped) {
      if (!allowMockFallback && id === 'mock') continue
      if (seen.has(id)) continue
      seen.add(id)
      items.push({ id, priority, enabled: true })
      priority++
    }
  }

  // 兜底：允许 mock 时确保至少包含 mock
  if (allowMockFallback && !seen.has('mock')) {
    items.push({ id: 'mock', priority, enabled: true })
  }

  return items.sort((a, b) => a.priority - b.priority)
}

/**
 * resolveQuoteChain
 *
 * 按 fallbackPolicy.allowMockFallback 决定 mock 是否在链中：
 * 显式配置了 fallbackPolicy 且 allowMockFallback=false 时剔除 mock（假绿灯修复）；
 * 未配置 fallbackPolicy 的维度保持旧行为（含 mock）。
 * @param dimension
 * @returns QuoteDataSourceId[]
 */
export function resolveQuoteChain(dimension: DimensionPipelineConfig): QuoteDataSourceId[] {
  const chain = (dimension.sourcePriority?.length ?? 0) > 0
    ? dimension.sourcePriority
    : internalBuildDefaultSourcePriority(dimension)
  // 未配置 fallbackPolicy 时默认允许 mock（保持旧行为，见函数注释）
  const allowMock = dimension.fallbackPolicy?.allowMockFallback ?? true
  return chain
    .filter((item) => item.enabled)
    .filter((item) => allowMock || item.id !== 'mock')
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.id)
}

/**
 * resolveKlineChain
 *
 * mock 追加同样受 fallbackPolicy.allowMockFallback 门禁（假绿灯修复）。
 * @param dimension
 * @returns QuoteDataSourceId[]
 */
export function resolveKlineChain(dimension: DimensionPipelineConfig): QuoteDataSourceId[] {
  const quoteChain = resolveQuoteChain(dimension)
  // 未配置 fallbackPolicy 时默认允许 mock（保持旧行为）
  const allowMock = dimension.fallbackPolicy?.allowMockFallback ?? true
  // 腾讯同时支持行情+K线，优先使用
  const klineSources = quoteChain.filter((id) => id !== 'mock')
  if (klineSources.length > 0) return allowMock ? [...klineSources, 'mock'] : klineSources
  return allowMock ? ['mock'] : []
}

/**
 * getDimensionConfig
 */
export function getDimensionConfig(
  config: CollectionConfig,
  dimensionCode: string,
): DimensionPipelineConfig | undefined {
  return config.dimensions.find((dim) => dim.code === dimensionCode)
}

/**
 * 维度 → 已知数据源 ID 列表（用于熔断器前置检查）。
 * 只列出会实际发网络请求的源，不含 mock。
 */
export function getDimensionKnownSources(dimensionCode: string): string[] {
  const sourceMap: Record<string, string[]> = {
    '03': ['ifind_mcp', 'tencent_mcp', 'tushare', 'crawler', 'sina'],
    '04': ['ifind_mcp', 'tencent_mcp', 'tushare', 'crawler', 'sina'],
    '05': ['ifind_mcp', 'tencent_mcp', 'tushare', 'crawler', 'sina'],
    '06': ['ifind_mcp', 'tencent_mcp', 'tushare', 'crawler', 'tencent'],
    '07': ['ifind_mcp', 'tencent_mcp', 'tushare', 'tencent'],
    '08': ['ifind_mcp', 'tencent_mcp', 'tushare', 'crawler'],
    '10': ['ifind_mcp', 'tencent_mcp'],
    '11': ['ifind_mcp', 'tencent_mcp'],
    '12': ['ifind_mcp', 'tencent_mcp'],
    '13': ['ifind_mcp', 'tencent_mcp'],
    '14': ['ifind_mcp', 'tencent_mcp'],
    '15': ['ifind_mcp', 'tencent_mcp', 'tushare', 'crawler'],
    '16': ['ifind_mcp', 'tencent_mcp', 'crawler'],
  }
  return sourceMap[dimensionCode] ?? []
}

/** 将 multiSourceFetcher 返回的 _source 标签映射为熔断器 sourceId */
export function mapSourceLabelToId(label: string): string {
  const labelMap: Record<string, string> = {
    tushare: 'tushare',
    crawler: 'crawler',
    sina: 'sina',
    tencent: 'tencent',
    llm: 'llm',
    real: 'tushare',
    ifind_mcp: 'ifind_mcp',
    tencent_mcp: 'tencent_mcp',
  }
  const mapped: string = labelMap[label] ?? ''
  if (mapped !== '') return mapped
  logger.warn('[collectionPipeline] mapSourceLabelToId: 未知源标签，映射为 unknown', {
    unknownLabel: label,
    knownLabels: Object.keys(labelMap),
  })
  return 'unknown'
}
