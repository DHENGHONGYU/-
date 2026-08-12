/**
 * indexedDBProvider — IndexedDB StorageProvider 实现
 *
 * P1-12 已闭环（2026-08-13 实跑验证）：
 *   dataLayer store 内部通过 sendWriteEnvelope() → dataBridge.forward() 写入，
 *   queryGet/queryList/queryByIndex 走 dataBridge.query() 查询，全程经 DataBridge ACL/审计。
 *   证据链：
 *     - src/data/dataLayerStockStores.ts L42 调用 sendWriteEnvelope('insertStock', ...)
 *     - src/data/dataLayerHelpers.ts re-export 自 '@/core/databridgeQueries'
 *     - src/core/databridgeQueries.ts L56 执行 await dataBridge.forward(envelope)
 *     - npm run audit:layers 返回 0 违规（1317 文件，2026-08-12T23:39:35Z）
 *   符合 services → data 分层规则（AGENTS.md §一），无需迁移。
 *
 * 包装现有的 dataLayer 子模块 store，将其适配为 StorageProvider 规范。
 * 当新的存储后端（DuckDB/Vector）就绪时，调用方仅需切换 Provider 实例，无需修改调用代码。
 *
 * 当前状态（2026-08-13）：
 *   - IndexedDB 后端：✅ 已落地（本文件，包装 dataLayer store）
 *   - DuckDB 后端：🟡 已设计未激活（time_series 形态仍走 IndexedDB）
 *   - Vector 后端：🟡 已设计未激活（embedding 仍走 IndexedDB）
 *   - 外部消费者：暂无（业务代码当前直接走 dataBridge / dataLayer store）
 *   新代码可选择走 StorageProvider（推荐，便于未来切换后端）或直接走 dataBridge。
 *
 * @see src/core/databridge.ts — 统一数据访问门面
 * @see src/core/databridgeQueries.ts — sendWriteEnvelope/queryGet 实现
 * @see src/services/storage/storageFactory.ts — 后端选择工厂
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type {
  DataMorphology,
  GetOptions,
  ListOptions,
  SaveOptions,
  DeleteOptions,
  StorageProvider,
  QueryResult,
  ListResult,
} from './storageProvider'

// ── domain store 子模块（内部经 DataBridge gateway 访问 IndexedDB）──
import { stockStore, dailyQuoteStore, financialReportStore } from '@/data/dataLayerStockStores'
import {
  v6ScoreStore,
  intelligentScoreStore,
  industryScoreStore,
  rotationScoreStore,
  hotSectorScoreStore,
  valuePitScoreStore,
  sectorScoreStore,
  scoreDocStore,
} from '@/data/dataLayerScoreStores'
import {
  orderStore,
  signalStore,
  executionPlanStore,
  executionLogStore,
  portfolioStore,
  tradeReviewStore,
} from '@/data/dataLayerTradingStores'
import {
  researchLogStore,
  strategySnapshotStore,
  localDocStore,
  newsStore,
  newsStockMapStore,
  sentimentCacheStore,
  missingReportStore,
  customAgentStore,
  collectionHistoryStore,
  conflictLogStore,
  fileImportRecordStore,
  scheduleConfigStore,
  proofreadReportStore,
  analysisResultStore,
} from '@/data/dataLayerContentStores'
import {
  newsBookmarkStore,
  collectConfigStore,
  traceRecordStore,
  workflowDefStore,
  workflowScheduleStore,
  workflowTriggerStore,
  workflowRunStore,
} from '@/data/dataLayerInternalStores'
import { watchlistStore } from '@/data/dataLayerWatchlistStore'

const logger = getLogger()

/**
 * store 名称 → store 实例映射表
 * 保持与原 dataLayer barrel 一致的键名，确保调用方无感知。
 */
const STORE_REGISTRY: Record<string, Record<string, unknown>> = {
  stocks: stockStore,
  v6Scores: v6ScoreStore,
  dailyQuotes: dailyQuoteStore,
  financialReports: financialReportStore,
  intelligentScores: intelligentScoreStore,
  industryScores: industryScoreStore,
  researchLogs: researchLogStore,
  orders: orderStore,
  signals: signalStore,
  rotationScores: rotationScoreStore,
  sectorScores: sectorScoreStore,
  scoreDocs: scoreDocStore,
  strategySnapshots: strategySnapshotStore,
  localDocs: localDocStore,
  news: newsStore,
  newsStockMap: newsStockMapStore,
  sentimentCache: sentimentCacheStore,
  hotSectorScores: hotSectorScoreStore,
  valuePitScores: valuePitScoreStore,
  executionPlans: executionPlanStore,
  executionLogs: executionLogStore,
  missingReports: missingReportStore,
  portfolios: portfolioStore,
  tradeReviews: tradeReviewStore,
  watchlists: watchlistStore,
  customAgents: customAgentStore,
  newsBookmarks: newsBookmarkStore,
  collectConfig: collectConfigStore,
  traceRecords: traceRecordStore,
  workflowDefs: workflowDefStore,
  workflowSchedules: workflowScheduleStore,
  workflowTriggers: workflowTriggerStore,
  workflowRuns: workflowRunStore,
  collectionHistory: collectionHistoryStore,
  conflictLog: conflictLogStore,
  fileImportRecords: fileImportRecordStore,
  scheduleConfigs: scheduleConfigStore,
  proofreadReports: proofreadReportStore,
  analysisResults: analysisResultStore,
}

/**
 * IndexedDBProvider — 基于 dataLayer 子模块的存储提供者
 *
 * 支持的数据形态：
 * - document: 文档/关系数据（使用现有 IndexedDB store）
 * - file: 大文件（使用 IndexedDB blob 存储）
 */
export class IndexedDBProvider implements StorageProvider {
  readonly backend = 'indexeddb' as const
  readonly morphologies: DataMorphology[] = ['document', 'file']

  /**
   * 根据 store 名称获取对应的 dataLayer store 对象
   */
  private resolveStore(store?: string): Record<string, unknown> | null {
    if (!store) return null
    const storeObj = STORE_REGISTRY[store]
    if (!storeObj) {
      logger.warn('[IndexedDBProvider] store 不存在', { store })
      return null
    }
    return storeObj
  }

  async get<T>(options: GetOptions): Promise<QueryResult<T>> {
    try {
      const store = this.resolveStore(options.store)
      if (store && typeof store.get === 'function') {
        const result = await (store.get as (key: string | number) => Promise<T | undefined>)(options.key)
        return { success: true, data: result }
      }
      return { success: false, error: `Store "${options.store}" 无 get 方法` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async list<T>(options?: ListOptions): Promise<ListResult<T>> {
    try {
      if (options?.store) {
        const store = this.resolveStore(options.store)
        if (store && typeof store.list === 'function') {
          const result = await (store.list as () => Promise<T[]>)()

          let filtered = result

          // 按字段过滤
          if (options.filter) {
            for (const [key, value] of Object.entries(options.filter)) {
              filtered = filtered.filter((item) => {
                const itemRecord = item as Record<string, unknown>
                return itemRecord[key] === value
              })
            }
          }

          // 排序
          if (options.orderBy) {
            filtered = [...filtered].sort((a, b) => {
              const aVal = (a as Record<string, unknown>)[options.orderBy!]
              const bVal = (b as Record<string, unknown>)[options.orderBy!]
              if (typeof aVal === 'number' && typeof bVal === 'number') {
                return options.orderDir === 'desc' ? bVal - aVal : aVal - bVal
              }
              return 0
            })
          }

          // 限制
          if (options.limit && filtered.length > options.limit) {
            filtered = filtered.slice(0, options.limit)
          }

          return { success: true, data: filtered }
        }
      }

      return { success: true, data: [] }
    } catch (err) {
      return { success: false, data: [], error: err instanceof Error ? err.message : String(err) }
    }
  }

  async save<T>(data: T, options?: SaveOptions): Promise<QueryResult<void>> {
    try {
      const store = this.resolveStore(options?.store)
      if (store && typeof store.save === 'function') {
        await (store.save as (data: T) => Promise<{ success: boolean; error?: string }>)(data)
        return { success: true }
      }
      return { success: false, error: `Store "${options?.store}" 无 save 方法` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async delete(options: DeleteOptions): Promise<QueryResult<void>> {
    try {
      const store = this.resolveStore(options.store)
      if (store && typeof store.delete === 'function') {
        await (store.delete as (key: string | number) => Promise<void>)(options.key)
        return { success: true }
      }
      return { success: false, error: `Store "${options.store}" 无 delete 方法` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 探测 registry 是否就绪（任一 store 存在即认为可用）
      return Object.keys(STORE_REGISTRY).length > 0
    } catch (err) { console.warn('[indexedDBProvider.ts]', err);
      return false
    }
  }
}
