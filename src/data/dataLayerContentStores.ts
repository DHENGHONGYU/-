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

  async remove(id: string): Promise<DataLayerResult<void>> {
    const agent = await queryGet<CustomAgent>(STORE_NAME.customAgents, id)
    if (!agent) return { success: false, error: 'Agent not found' }
    return sendWriteEnvelope('deleteCustomAgent', { ...agent, _deleted: true }, 'system')
  },
}

// ── 双通道数据同步 Store 操作（v31 新增，P2-1 整改） ──

import type {
  CollectionHistoryEntry,
  FileImportProofreadReport,
  GlobalScheduleConfig,
} from '@/types/modules/data-sync.types'

/** 冲突日志条目（内联类型，数据层操作专用） */
interface ConflictLogEntry {
  id: string
  timestamp: string
  symbol: string
  fieldDiffs?: unknown[]
  resolution?: string
  resolvedBy?: 'auto' | 'user'
  resolvedAt?: string
}

/** 文件导入记录条目（内联类型，数据层操作专用） */
interface FileImportRecordEntry {
  id: string
  timestamp: string
  fileName: string
  fileHash: string
  dataType?: string
  targetStore?: string
  recordCount?: number
  status?: string
}

/** 采集历史 Store — collection_history */
export const collectionHistoryStore = {
  async save(entry: CollectionHistoryEntry): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveCollectionHistory', entry, 'fetcher')
  },

  async list(): Promise<CollectionHistoryEntry[]> {
    return queryList<CollectionHistoryEntry>(STORE_NAME.collectionHistory)
  },

  async listByChannel(channel: string): Promise<CollectionHistoryEntry[]> {
    return queryByIndex<CollectionHistoryEntry>(STORE_NAME.collectionHistory, 'by-channel', channel)
  },

  async listByDate(date: string): Promise<CollectionHistoryEntry[]> {
    return queryByIndex<CollectionHistoryEntry>(STORE_NAME.collectionHistory, 'by-date', date)
  },

  async listByStatus(status: string): Promise<CollectionHistoryEntry[]> {
    return queryByIndex<CollectionHistoryEntry>(STORE_NAME.collectionHistory, 'by-status', status)
  },

  async remove(id: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteCollectionHistory', { id, _deleted: true }, 'fetcher')
  },
}

/** 冲突日志 Store — conflict_log */
export const conflictLogStore = {
  async save(entry: ConflictLogEntry): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveConflictLog', entry, 'fetcher')
  },

  async list(): Promise<ConflictLogEntry[]> {
    return queryList<ConflictLogEntry>(STORE_NAME.conflictLog)
  },

  async listBySymbol(symbol: string): Promise<ConflictLogEntry[]> {
    return queryByIndex<ConflictLogEntry>(STORE_NAME.conflictLog, 'by-symbol', symbol)
  },

  async listByResolution(resolution: string): Promise<ConflictLogEntry[]> {
    return queryByIndex<ConflictLogEntry>(STORE_NAME.conflictLog, 'by-resolution', resolution)
  },
}

/** 文件导入记录 Store — file_import_records */
export const fileImportRecordStore = {
  async save(entry: FileImportRecordEntry): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveFileImportRecord', entry, 'fetcher')
  },

  async list(): Promise<FileImportRecordEntry[]> {
    return queryList<FileImportRecordEntry>(STORE_NAME.fileImportRecords)
  },

  async getByHash(fileHash: string): Promise<FileImportRecordEntry | undefined> {
    const list = await queryByIndex<FileImportRecordEntry>(STORE_NAME.fileImportRecords, 'by-hash', fileHash)
    return list[0]
  },

  async listByFileName(fileName: string): Promise<FileImportRecordEntry[]> {
    return queryByIndex<FileImportRecordEntry>(STORE_NAME.fileImportRecords, 'by-fileName', fileName)
  },
}

/** 调度配置 Store — schedule_configs */
export const scheduleConfigStore = {
  async save(config: GlobalScheduleConfig): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveScheduleConfig', { ...config, _timestamp: now() }, 'system')
  },

  async get(scheduleId: string): Promise<GlobalScheduleConfig | undefined> {
    return queryGet<GlobalScheduleConfig>(STORE_NAME.scheduleConfigs, scheduleId)
  },

  async list(): Promise<GlobalScheduleConfig[]> {
    return queryList<GlobalScheduleConfig>(STORE_NAME.scheduleConfigs)
  },

  async listEnabled(): Promise<GlobalScheduleConfig[]> {
    return queryByIndex<GlobalScheduleConfig>(STORE_NAME.scheduleConfigs, 'by-enabled', 'true')
  },

  async remove(scheduleId: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteScheduleConfig', { scheduleId, _deleted: true }, 'system')
  },
}

/** 校对报告 Store — proofread_reports（嵌套 keyPath: meta.reportId） */
export const proofreadReportStore = {
  async save(report: FileImportProofreadReport): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveProofreadReport', report, 'fetcher')
  },

  async get(reportId: string): Promise<FileImportProofreadReport | undefined> {
    return queryGet<FileImportProofreadReport>(STORE_NAME.proofreadReports, reportId)
  },

  async list(): Promise<FileImportProofreadReport[]> {
    return queryList<FileImportProofreadReport>(STORE_NAME.proofreadReports)
  },

  async getByFileHash(fileHash: string): Promise<FileImportProofreadReport | undefined> {
    const list = await queryByIndex<FileImportProofreadReport>(STORE_NAME.proofreadReports, 'by-fileHash', fileHash)
    return list[0]
  },
}

/** 分析结果条目（内联类型，数据层操作专用；与 analysis_results store 对齐：keyPath=docId） */
interface AnalysisResultEntry {
  docId: string
  symbol: string
  version: string
  createdAt: string
  [key: string]: unknown
}

/**
 * 分析结果 Store — analysis_results（v30 新增，AnalysisOrchestrator 持久化）
 * 原仅创建于 db-schema 与 STORE_NAME，缺 domain store 对象，未接入 dataLayer barrel（审计告警）。
 * module 使用 'analyzer' 以匹配 ACL_MATRIX[MODULE_ID.analyzer].write 的 analysisResults 授权。
 */
export const analysisResultStore = {
  async save(entry: AnalysisResultEntry): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveAnalysisResult', entry, 'analyzer')
  },

  async get(docId: string): Promise<AnalysisResultEntry | undefined> {
    return queryGet<AnalysisResultEntry>(STORE_NAME.analysisResults, docId)
  },

  async list(): Promise<AnalysisResultEntry[]> {
    return queryList<AnalysisResultEntry>(STORE_NAME.analysisResults)
  },

  async listBySymbol(symbol: string): Promise<AnalysisResultEntry[]> {
    return queryByIndex<AnalysisResultEntry>(STORE_NAME.analysisResults, 'by-symbol', symbol)
  },
}
