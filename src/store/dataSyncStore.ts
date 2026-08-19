/**
 * @fileoverview 数据同步状态 Store
 * @unused — 已实现但当前无 UI 层消费者，待后续产品规划接入。
 *
 * 管理双通道数据同步的全局状态，包括：
 * - 同步状态机（idle/checking/collecting/importing/...）
 * - 采集历史记录（从 IndexedDB 读写）
 * - 冲突日志
 * - 调度配置
 *
 * @module store/dataSyncStore
 * @created 2026-07-14 - 双通道整改 P2-1
  * @doc [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { STORE_NAME } from '@/config/dbConfig'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import type {
  CollectionHistoryEntry,
  GlobalScheduleConfig,
  SyncState,
} from '@/types/modules/data-sync.types'

const logger = getLogger()

/** 数据同步 Store 状态 */
interface DataSyncState {
  // 同步状态机
  syncState: SyncState
  lastSyncAt: string | null
  lastSyncChannel: 'auto-collect' | 'file-import' | 'manual-trigger' | null

  // 采集历史
  history: CollectionHistoryEntry[]
  historyLoading: boolean

  // 调度配置
  schedules: GlobalScheduleConfig[]

  // 统计
  totalAutoCollects: number
  totalFileImports: number
  totalConflicts: number

  // 操作
  setSyncState: (state: SyncState) => void
  addHistoryEntry: (entry: CollectionHistoryEntry) => void
  loadHistory: (limit?: number) => Promise<void>
  addSchedule: (config: GlobalScheduleConfig) => void
  updateSchedule: (scheduleId: string, updates: Partial<GlobalScheduleConfig>) => void
  removeSchedule: (scheduleId: string) => void
  reset: () => void
}

/** 初始状态 */
const initialState = {
  syncState: 'idle' as SyncState,
  lastSyncAt: null,
  lastSyncChannel: null,
  history: [] as CollectionHistoryEntry[],
  historyLoading: false,
  schedules: [] as GlobalScheduleConfig[],
  totalAutoCollects: 0,
  totalFileImports: 0,
  totalConflicts: 0,
}

/**
 * 数据同步 Store
 *
 * 通过 withBroadcast 在关键操作后广播跨 Tab 同步事件。
 */
export const useDataSyncStore = create<DataSyncState>((set) => ({
  ...initialState,

  setSyncState: (syncState) => {
    set({ syncState })
    withBroadcast(EVENT_NAMES.COLLECTION_WIZARD_CHANGED, { action: 'setSyncState', syncState })
    logger.info('[dataSyncStore] 同步状态变更', { syncState })
  },

  addHistoryEntry: (entry) => {
    set((state) => ({
      history: [entry, ...state.history].slice(0, 200),
      lastSyncAt: entry.timestamp,
      lastSyncChannel: entry.channel,
      totalAutoCollects: entry.channel === 'auto-collect' ? state.totalAutoCollects + 1 : state.totalAutoCollects,
      totalFileImports: entry.channel === 'file-import' ? state.totalFileImports + 1 : state.totalFileImports,
      totalConflicts: state.totalConflicts + entry.updateInfo.conflictsDetected,
    }))
    withBroadcast(EVENT_NAMES.COLLECTION_WIZARD_CHANGED, { action: 'addHistory', channel: entry.channel })
    logger.info('[dataSyncStore] 历史记录已添加', {
      channel: entry.channel,
      status: entry.status,
      added: entry.updateInfo.recordsAdded,
    })
  },

   
  loadHistory: async (limit = 100) => {
    set({ historyLoading: true })
    try {
      logger.info('[dataSyncStore] 加载历史记录', { limit })
      set({ historyLoading: false })
    } catch (err) {
      logger.error('[dataSyncStore] 加载历史失败', { error: String(err) })
      set({ historyLoading: false })
    }
  },

  addSchedule: (config) => {
    set((state) => ({
      schedules: [...state.schedules.filter(s => s.scheduleId !== config.scheduleId), config],
    }))
    withBroadcast(EVENT_NAMES.COLLECTION_WIZARD_CHANGED, { action: 'addSchedule', scheduleId: config.scheduleId })
    logger.info('[dataSyncStore] 调度配置已添加', { scheduleId: config.scheduleId })
  },

  updateSchedule: (scheduleId, updates) => {
    set((state) => ({
      schedules: state.schedules.map(s =>
        s.scheduleId === scheduleId ? { ...s, ...updates } : s,
      ),
    }))
    withBroadcast(EVENT_NAMES.COLLECTION_WIZARD_CHANGED, { action: 'updateSchedule', scheduleId })
    logger.info('[dataSyncStore] 调度配置已更新', { scheduleId })
  },

  removeSchedule: (scheduleId) => {
    set((state) => ({
      schedules: state.schedules.filter(s => s.scheduleId !== scheduleId),
    }))
    withBroadcast(EVENT_NAMES.COLLECTION_WIZARD_CHANGED, { action: 'removeSchedule', scheduleId })
    logger.info('[dataSyncStore] 调度配置已删除', { scheduleId })
  },

  reset: () => {
    set(initialState)
    withBroadcast(EVENT_NAMES.COLLECTION_WIZARD_CHANGED, { action: 'reset' })
    logger.info('[dataSyncStore] 状态已重置')
  },
}))

/** 导出 store 名称（供 ACL 注册） */
export const DATA_SYNC_STORE_NAME = STORE_NAME.collectionHistory
