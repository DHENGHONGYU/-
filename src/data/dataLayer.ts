/**
 * @fileoverview dataLayer - 数据访问层统一入口
 *
 * 职责：
 * - 聚合所有 domain store 为 dataLayer barrel 对象
 * - 提供 dataManager（reset/export/import）数据库管理操作
 * - re-export 所有子模块的 store，保持原导入路径兼容
 *
 * 子模块（从本文件拆分）：
 * - dataLayerHelpers.ts: sendWriteEnvelope / queryGet / queryList / queryByIndex
 * - dataLayerStockStores.ts: stockStore / dailyQuoteStore / financialReportStore
 * - dataLayerScoreStores.ts: v6ScoreStore / intelligentScoreStore / industryScoreStore /
 *   rotationScoreStore / hotSectorScoreStore / valuePitScoreStore / sectorScoreStore / scoreDocStore
 * - dataLayerTradingStores.ts: orderStore / signalStore / executionPlanStore /
 *   executionLogStore / portfolioStore / tradeReviewStore
 * - dataLayerContentStores.ts: researchLogStore / strategySnapshotStore / localDocStore /
 *   newsStore / newsStockMapStore / sentimentCacheStore / missingReportStore
 * - dataLayerWatchlistStore.ts: watchlistStore（观察列表快照，修复 C4 孤立表）
  * @doc []
*/
import { db } from './db'

// re-export 子模块的 store，保持原导入路径兼容
export { stockStore, dailyQuoteStore, financialReportStore } from './dataLayerStockStores'
export {
  v6ScoreStore,
  intelligentScoreStore,
  industryScoreStore,
  rotationScoreStore,
  hotSectorScoreStore,
  valuePitScoreStore,
  sectorScoreStore,
  scoreDocStore,
} from './dataLayerScoreStores'
export {
  orderStore,
  signalStore,
  executionPlanStore,
  executionLogStore,
  portfolioStore,
  tradeReviewStore,
} from './dataLayerTradingStores'
export {
  researchLogStore,
  strategySnapshotStore,
  localDocStore,
  newsStore,
  newsStockMapStore,
  sentimentCacheStore,
  missingReportStore,
  customAgentStore, // 阶段 B-1：用户自定义智能体（v26 新增）
  collectionHistoryStore, // v31 采集历史
  conflictLogStore, // v31 冲突日志
  fileImportRecordStore, // v31 文件导入记录
  scheduleConfigStore, // v31 调度配置
  proofreadReportStore, // v31 校对报告
  analysisResultStore, // v30 分析结果
  generatedReportStore, // v33 报告资产化
  reportTemplateStore, // v33 报告资产化
  screeningResultStore, // v34 筛选结果集持久化
  observationReviewStore, // v35 观察池复盘持久化
} from './dataLayerContentStores'
export {
  collectConfigStore, // v25 采集配置
  traceRecordStore, // v27 采集链路追踪
  workflowDefStore, // v28 工作流定义
  workflowScheduleStore, // v28 工作流定时调度
  workflowTriggerStore, // v28 工作流事件触发器
  workflowRunStore, // v28 工作流运行实例
} from './dataLayerInternalStores'
export { watchlistStore } from './dataLayerWatchlistStore'
export {
  profileItemStore,
  scoreEvidenceStore,
  stockProfileStore,
  profileTagStore,
} from './dataLayerProfileStores'

// 子模块 store 导入（用于组装 dataLayer barrel）
import { stockStore, dailyQuoteStore, financialReportStore } from './dataLayerStockStores'
import {
  v6ScoreStore,
  intelligentScoreStore,
  industryScoreStore,
  rotationScoreStore,
  hotSectorScoreStore,
  valuePitScoreStore,
  sectorScoreStore,
  scoreDocStore,
} from './dataLayerScoreStores'
import {
  orderStore,
  signalStore,
  executionPlanStore,
  executionLogStore,
  portfolioStore,
  tradeReviewStore,
} from './dataLayerTradingStores'
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
  generatedReportStore,
  reportTemplateStore,
  screeningResultStore,
  observationReviewStore,
} from './dataLayerContentStores'
import {
  collectConfigStore,
  traceRecordStore,
  workflowDefStore,
  workflowScheduleStore,
  workflowTriggerStore,
  workflowRunStore,
} from './dataLayerInternalStores'
import { watchlistStore } from './dataLayerWatchlistStore'
import {
  profileItemStore,
  scoreEvidenceStore,
  stockProfileStore,
  profileTagStore,
} from './dataLayerProfileStores'

/**
 * 数据库管理器（reset/export/import）
 */
export const dataManager = {
  async reset(): Promise<void> {
    await db.reset()
  },

  async export(): Promise<Record<string, unknown[]>> {
    return db.export()
  },

  async import(data: Record<string, unknown[]>): Promise<void> {
    await db.import(data)
  },
}

/**
 * dataLayer barrel - 聚合所有 store 的统一入口
 * 外部模块通过 `import { dataLayer } from '@/data/dataLayer'` 访问所有 store
 */
export const dataLayer = {
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
  // 阶段 B-1：用户自定义智能体
  customAgents: customAgentStore,
  // v25 采集配置
  collectConfig: collectConfigStore,
  // v27 采集链路追踪
  traceRecords: traceRecordStore,
  // v28 工作流存储
  workflowDefs: workflowDefStore,
  workflowSchedules: workflowScheduleStore,
  workflowTriggers: workflowTriggerStore,
  workflowRuns: workflowRunStore,
  // v30/v31 数据网关补全 Store（原未接入 barrel，审计告警）
  collectionHistory: collectionHistoryStore,
  conflictLog: conflictLogStore,
  fileImportRecords: fileImportRecordStore,
  scheduleConfigs: scheduleConfigStore,
  proofreadReports: proofreadReportStore,
  analysisResults: analysisResultStore,
  // 报告资产化（v33，P1 报告资产化）
  generatedReports: generatedReportStore,
  reportTemplates: reportTemplateStore,
  // 筛选结果集持久化（v34，P0 筛选结果集持久化）
  screeningResults: screeningResultStore,
  // 观察池复盘持久化（v35，spec 缺口② 闭环）
  observationReviews: observationReviewStore,
  // 八域资料体系（v32，ADR-010）
  profileItems: profileItemStore,
  scoreEvidence: scoreEvidenceStore,
  stockProfiles: stockProfileStore,
  profileTags: profileTagStore,
  manager: dataManager,
}
