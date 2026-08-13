/**
 * @fileoverview 采集流水线纯转换函数
 *
 * 包含 DimensionConfig → DimensionPipelineConfig 的 upgrade 转换
 * 与数据源优先级链 buildDefaultSourcePriority 纯函数。
 *
 * 原实现位于 src/services/data-collector/collectionPipeline.ts，
 * P1-12 分层合规：纯函数落地 domain 层（从 lib/collection 迁移），services 侧 re-export 保持 API 兼容。
 *
 * @see src/services/data-collector/collectionPipeline.ts (re-export caller)
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */

import type {
  DimensionPipelineConfig,
  QuoteDataSourceId,
  SourcePriorityItem,
} from '@/types/modules/collection.types'

const BUSINESS_TO_QUOTE_SOURCE: Readonly<Record<string, QuoteDataSourceId[]>> = {
  akshare: ['tencent', 'sina', 'akshare'],
  ifind: ['tencent', 'sina'],
  yahoo: ['tencent', 'sina'],
  tianyancha: ['mock'],
  scholar: ['mock'],
  cache: ['mock'],
}

/**
 * 根据维度 sources 列表构建默认数据源优先级链。
 * P0 优化（2026-08-09）：腾讯/新浪升为日频基础盘主源。
 *
 * @param dimension 维度配置
 * @param allowMockFallback 为 false 时剔除 'mock'（假绿灯修复）
 */
export function buildDefaultSourcePriority(
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

  if (allowMockFallback && !seen.has('mock')) {
    items.push({ id: 'mock', priority, enabled: true })
  }
  return items.sort((a, b) => a.priority - b.priority)
}

/**
 * 将基础 `DimensionConfig[]` 升级为 `DimensionPipelineConfig[]`，
 * 补充默认的 sourcePriority、策略等字段。
 */
export function upgradeDimensionsToPipeline(
  dimensions: DimensionPipelineConfig[],
): DimensionPipelineConfig[] {
  return dimensions.map((dim) => {
    const fallbackPolicy = dim.fallbackPolicy
    const allowMock = fallbackPolicy?.allowMockFallback ?? true
    return {
      ...dim,
      sourcePriority:
        (dim.sourcePriority?.length ?? 0) > 0
          ? dim.sourcePriority
          : buildDefaultSourcePriority(dim, allowMock),
      concurrency: dim.concurrency,
      retryPolicy: dim.retryPolicy,
      timeoutPolicy: dim.timeoutPolicy,
      fallbackPolicy,
    }
  })
}
