/**
 * @fileoverview 内部/新增 Store 统一入口
 *
 * 包含 7 个在 `audit-db-references.ts` 中识别为未暴露的 Store：
 * - newsBookmarkStore: 资讯收藏
 * - collectConfigStore: 采集配置模板
 * - traceRecordStore: 采集链路追踪
 * - workflowDefStore: 工作流定义
 * - workflowScheduleStore: 定时调度
 * - workflowTriggerStore: 事件触发器
 * - workflowRunStore: 运行实例
 *
 * 写入统一通过 DataBridge.forward()，避免 services 层直接访问 IndexedDB。
 */
import { STORE_NAME } from '@/config/dbConfig'
import type {
  CollectionTraceSpan,
  NewsBookmark,
  PersistedWizardConfig,
  WorkflowDef,
  WorkflowRun,
  ScheduleDef,
  TriggerDef,
} from './types'
import type { DataLayerResult } from './types'
import { sendWriteEnvelope, queryGet, queryList, queryByIndex } from './dataLayerHelpers'

// ── 资讯收藏（v13 新增） ──
export const newsBookmarkStore = {
  async save(bookmark: NewsBookmark): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('newsArticleBookmarked', bookmark, 'news')
  },

  async get(id: string): Promise<NewsBookmark | undefined> {
    return queryGet<NewsBookmark>(STORE_NAME.newsBookmarks, id)
  },

  async list(): Promise<NewsBookmark[]> {
    return queryList<NewsBookmark>(STORE_NAME.newsBookmarks)
  },

  async listByBookmarkedAt(since: number): Promise<NewsBookmark[]> {
    return queryByIndex<NewsBookmark>(STORE_NAME.newsBookmarks, 'by-bookmarked-at', since)
  },
}

// ── 采集配置模板（v25 新增） ──
export const collectConfigStore = {
  async save(config: PersistedWizardConfig): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveCollectConfig', config, 'system')
  },

  async delete(id: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteCollectConfig', { id }, 'system')
  },

  async get(id: string): Promise<PersistedWizardConfig | undefined> {
    return queryGet<PersistedWizardConfig>(STORE_NAME.collectConfig, id)
  },

  async list(): Promise<PersistedWizardConfig[]> {
    return queryList<PersistedWizardConfig>(STORE_NAME.collectConfig)
  },

  async listByUpdatedAt(since: number): Promise<PersistedWizardConfig[]> {
    return queryByIndex<PersistedWizardConfig>(STORE_NAME.collectConfig, 'by-updated-at', since)
  },
}

// ── 采集链路追踪（v27 新增） ──
export const traceRecordStore = {
  async save(record: CollectionTraceSpan): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveTraceRecord', record, 'fetcher')
  },

  async get(traceId: string): Promise<CollectionTraceSpan | undefined> {
    return queryGet<CollectionTraceSpan>(STORE_NAME.traceRecords, traceId)
  },

  async list(): Promise<CollectionTraceSpan[]> {
    return queryList<CollectionTraceSpan>(STORE_NAME.traceRecords)
  },

  async listBySymbol(symbol: string): Promise<CollectionTraceSpan[]> {
    return queryByIndex<CollectionTraceSpan>(STORE_NAME.traceRecords, 'by-symbol', symbol)
  },

  async listByDimension(dimensionCode: string): Promise<CollectionTraceSpan[]> {
    return queryByIndex<CollectionTraceSpan>(STORE_NAME.traceRecords, 'by-dimension', dimensionCode)
  },
}

// ── 工作流定义（v28 新增） ──
export const workflowDefStore = {
  async save(def: WorkflowDef): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveWorkflowDef', def, 'system')
  },

  async delete(id: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteWorkflowDef', { id }, 'system')
  },

  async get(id: string): Promise<WorkflowDef | undefined> {
    return queryGet<WorkflowDef>(STORE_NAME.workflowDefs, id)
  },

  async list(): Promise<WorkflowDef[]> {
    return queryList<WorkflowDef>(STORE_NAME.workflowDefs)
  },
}

// ── 工作流定时调度（v28 新增） ──
export const workflowScheduleStore = {
  async save(schedule: ScheduleDef): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveWorkflowSchedule', schedule, 'system')
  },

  async delete(id: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteWorkflowSchedule', { id }, 'system')
  },

  async get(id: string): Promise<ScheduleDef | undefined> {
    return queryGet<ScheduleDef>(STORE_NAME.workflowSchedules, id)
  },

  async list(): Promise<ScheduleDef[]> {
    return queryList<ScheduleDef>(STORE_NAME.workflowSchedules)
  },

  async listByWorkflowId(workflowId: string): Promise<ScheduleDef[]> {
    return queryByIndex<ScheduleDef>(STORE_NAME.workflowSchedules, 'by-workflow-id', workflowId)
  },
}

// ── 工作流事件触发器（v28 新增） ──
export const workflowTriggerStore = {
  async save(trigger: TriggerDef): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveWorkflowTrigger', trigger, 'system')
  },

  async delete(id: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteWorkflowTrigger', { id }, 'system')
  },

  async get(id: string): Promise<TriggerDef | undefined> {
    return queryGet<TriggerDef>(STORE_NAME.workflowTriggers, id)
  },

  async list(): Promise<TriggerDef[]> {
    return queryList<TriggerDef>(STORE_NAME.workflowTriggers)
  },

  async listByWorkflowId(workflowId: string): Promise<TriggerDef[]> {
    return queryByIndex<TriggerDef>(STORE_NAME.workflowTriggers, 'by-workflow-id', workflowId)
  },
}

// ── 工作流运行实例（v28 新增） ──
export const workflowRunStore = {
  async save(run: WorkflowRun): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveWorkflowRun', run, 'system')
  },

  async get(runId: string): Promise<WorkflowRun | undefined> {
    return queryGet<WorkflowRun>(STORE_NAME.workflowRuns, runId)
  },

  async list(): Promise<WorkflowRun[]> {
    return queryList<WorkflowRun>(STORE_NAME.workflowRuns)
  },

  async listByWorkflowId(workflowId: string): Promise<WorkflowRun[]> {
    return queryByIndex<WorkflowRun>(STORE_NAME.workflowRuns, 'by-workflow-id', workflowId)
  },
}
