/**
 * @fileoverview 内容/日志类 Store
 *
 * 从 dataLayer.ts 拆分而来，包含 8 个内容域 Store：
 * - researchLogStore: 研究日志 list
 * - strategySnapshotStore: 策略快照 save/get/list/getLatest
 * - localDocStore: 本地文档 save/get/list/listBySymbol
 * - newsStore: 新闻 save/get/getByHash/list
 * - newsStockMapStore: 新闻-股票映射 save/listBySymbol/listByNews
 * - sentimentCacheStore: 情绪缓存 save/get/getByContentHash
 * - missingReportStore: 缺失报告 report/list/listBySymbol/listBySeverity/incrementRetry
 * - customAgentStore: 用户自定义智能体 list/get/save/delete（v26 新增，阶段 B-1）
 */
import { STORE_NAME } from '@/config/dbConfig'
import { now } from './db'
import type {
  DataLayerResult,
  LocalDoc,
  MissingReport,
  NewsArticle,
  NewsStockMap,
  ResearchLog,
  SentimentCache,
  StrategySnapshot,
  CustomAgent,
} from './types'
import { sendWriteEnvelope, queryGet, queryList, queryByIndex } from './dataLayerHelpers'
import { nanoid } from 'nanoid'

export const researchLogStore = {
  async list(): Promise<ResearchLog[]> {
    return queryList<ResearchLog>(STORE_NAME.researchLogs)
  },
}

export const strategySnapshotStore = {
  async save(snapshot: StrategySnapshot): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveStrategySnapshots', snapshot, 'tradinghub')
  },

  async get(id: string): Promise<StrategySnapshot | undefined> {
    return queryGet<StrategySnapshot>(STORE_NAME.strategySnapshots, id)
  },

  async list(): Promise<StrategySnapshot[]> {
    return queryList<StrategySnapshot>(STORE_NAME.strategySnapshots)
  },

  async getLatest(): Promise<StrategySnapshot | undefined> {
    const list = await this.list()
    return list.sort((a, b) => b.timestamp - a.timestamp)[0]
  },
}

export const localDocStore = {
  async save(doc: LocalDoc): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveLocalDocs', doc, 'system')
  },

  async get(id: string): Promise<LocalDoc | undefined> {
    return queryGet<LocalDoc>(STORE_NAME.localDocs, id)
  },

  async list(): Promise<LocalDoc[]> {
    return queryList<LocalDoc>(STORE_NAME.localDocs)
  },

  async listBySymbol(symbol: string): Promise<LocalDoc[]> {
    return queryByIndex<LocalDoc>(STORE_NAME.localDocs, 'by-symbol', symbol)
  },
}

export const newsStore = {
  async save(article: NewsArticle): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveNews', article, 'news')
  },

  async get(id: string): Promise<NewsArticle | undefined> {
    return queryGet<NewsArticle>(STORE_NAME.news, id)
  },

  async getByHash(hash: string): Promise<NewsArticle | undefined> {
    const list = await queryByIndex<NewsArticle>(STORE_NAME.news, 'by-hash', hash)
    return list[0]
  },

  async list(): Promise<NewsArticle[]> {
    return queryList<NewsArticle>(STORE_NAME.news)
  },
}

export const newsStockMapStore = {
  async save(mapping: NewsStockMap): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveNewsStockMap', mapping, 'news')
  },

  async listBySymbol(symbol: string): Promise<NewsStockMap[]> {
    return queryByIndex<NewsStockMap>(STORE_NAME.newsStockMap, 'by-symbol', symbol)
  },

  async listByNews(newsId: string): Promise<NewsStockMap[]> {
    return queryByIndex<NewsStockMap>(STORE_NAME.newsStockMap, 'by-news', newsId)
  },
}

export const sentimentCacheStore = {
  async save(cache: SentimentCache): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveSentimentCache', cache, 'news')
  },

  async get(id: string): Promise<SentimentCache | undefined> {
    return queryGet<SentimentCache>(STORE_NAME.sentimentCache, id)
  },

  async getByContentHash(contentHash: string): Promise<SentimentCache | undefined> {
    const list = await queryByIndex<SentimentCache>(STORE_NAME.sentimentCache, 'by-content-hash', contentHash)
    return list[0]
  },
}

export const missingReportStore = {
  async report(report: Omit<MissingReport, 'id'>): Promise<DataLayerResult<MissingReport>> {
    const id: string = nanoid()
    const fullReport: MissingReport = { ...report, id, createdAt: now() }
    await sendWriteEnvelope('saveMissingReport', fullReport, 'missingReports')
    return { success: true, data: fullReport }
  },

  async list(): Promise<MissingReport[]> {
    return queryList<MissingReport>(STORE_NAME.missingReports)
  },

  async listBySymbol(symbol: string): Promise<MissingReport[]> {
    return queryByIndex<MissingReport>(STORE_NAME.missingReports, 'by-symbol', symbol)
  },

  async listBySeverity(severity: string): Promise<MissingReport[]> {
    const all = await queryList<MissingReport>(STORE_NAME.missingReports)
    return all.filter((r) => r.severity === severity)
  },

  async incrementRetry(id: string): Promise<DataLayerResult<MissingReport>> {
    const report = await queryGet<MissingReport>(STORE_NAME.missingReports, id)
    if (!report) return { success: false, error: 'Report not found' }
    const updated = { ...report, retryCount: report.retryCount + 1 }
    const result = await sendWriteEnvelope<MissingReport>('incrementMissingReportRetry', updated, 'missingReports')
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: updated }
  },
}

// ── 阶段 B-1：customAgentStore（用户自定义智能体） ─────────────
export const customAgentStore = {
  async list(): Promise<CustomAgent[]> {
    return queryList<CustomAgent>(STORE_NAME.customAgents)
  },
  async listByType(type: string): Promise<CustomAgent[]> {
    return queryByIndex<CustomAgent>(STORE_NAME.customAgents, 'by-type', type)
  },
  async get(id: string): Promise<CustomAgent | undefined> {
    return queryGet<CustomAgent>(STORE_NAME.customAgents, id)
  },
  async save(agent: Omit<CustomAgent, 'createdAt' | 'updatedAt'> & { createdAt?: number }): Promise<DataLayerResult<CustomAgent>> {
    const existing = await queryGet<CustomAgent>(STORE_NAME.customAgents, agent.id)
    const full: CustomAgent = {
      ...agent,
      createdAt: existing?.createdAt ?? agent.createdAt ?? now(),
      updatedAt: now(),
    }
    return sendWriteEnvelope<CustomAgent>('saveCustomAgent', full, 'user')
  },
  async remove(id: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope<void>('deleteCustomAgent', { id }, 'user')
  },
}
