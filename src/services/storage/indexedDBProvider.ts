/**
 * indexedDBProvider — IndexedDB StorageProvider 实现
 * @note P1-12（已确认合规）：dataLayer store 内部通过 sendWriteEnvelope() → DataBridge 写入，
 *   queryList/queryGet 走 DataBridge 查询，是 DataBridge 的类型安全包装层。
 *   符合 services → data 分层规则（AGENTS.md §一），无需迁移。
 *
 * 包装现有的 dataLayer 子模块 store，将其适配为 StorageProvider 规范。
 * 当新的存储后端就绪时，调用方仅需切换 Provider 实例，无需修改调用代码。
 *
 * @convergence 数据流收敛计划（Phase 2）：
 *   当前 dataLayer store 直接操作 IndexedDB，不经 DataBridge ACL/审计日志。
 *   计划将写入路径重路由：store.write() → DataBridge.forward(envelope) → gateway.write()，
 *   读取路径：DataBridge.query() → store.get/list()。
 *   完成后 service 层仅依赖 DataBridge facade，不再 import dataLayer store 实例。
 *
 * @see src/core/databridge.ts — 统一数据访问门面
 * @see docs/03-development/mock-data-cleanup-lessons.md §"Service 绕过 DataBridge"
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
