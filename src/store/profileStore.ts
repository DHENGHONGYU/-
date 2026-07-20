/**
 * @module profileStore
 * @lifecycle @Global
 * @description 八域资料浏览页面状态管理。管理股票代码选择、资料列表、
 *              八域导航、资料详情、证据链视图，提供加载、筛选、搜索等操作。
 *
 * @see @/pages/output/ProfileBrowsePage.tsx - 消费此 Store 的资料浏览页面
 *
 * @compliance
 * - 所有数据请求经 Store Action 分发
 * - 核心分支包含 logger.info 打印
 * - 异步操作有 try-catch + error 状态
 * - 遵循现有 Zustand Store 风格
 * @doc [V9-DOC-DATA-028, V9-DOC-DATA-029]
 */

import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { listPoolItems } from '@/services/pool/poolService'
import type { PoolItem } from '@/types/modules/pool.types'
import type { Stock } from '@/data/types'
import type {
  ProfileItem,
  ProfileDomain,
  ScoreEvidence,
  ScoreLayerId,
  ProfileItemType,
  SentimentLabel,
  StockProfile,
} from '@/data/types/types.profile'
import { DOMAIN_META } from '@/data/types/types.profile'

const logger = getLogger()

// ============================================================
// 辅助函数
// ============================================================

function poolItemToStock(item: PoolItem): Stock {
  return {
    ...item,
    researchStatus: item.status,
  }
}

// ============================================================
// 筛选条件类型
// ============================================================

export interface ProfileFilter {
  /** 资料类型筛选 */
  itemType?: ProfileItemType
  /** 情绪筛选 */
  sentiment?: SentimentLabel
  /** 最低质量分 */
  minQuality?: number
  /** 搜索关键词 */
  keyword?: string
  /** 来源筛选 */
  source?: string
}

// ============================================================
// Store State & Actions
// ============================================================

export interface ProfileState {
  // ---- 基础选择 ----
  /** 当前选中的股票代码 */
  symbol: string
  /** 股票列表（用于下拉选择） */
  stocks: Stock[]
  /** 股票列表加载状态 */
  stocksLoading: boolean

  // ---- 当前域 ----
  /** 当前选中的域（null 表示全部） */
  activeDomain: ProfileDomain | null

  // ---- 资料列表 ----
  /** 资料条目列表 */
  items: ProfileItem[]
  /** 资料加载状态 */
  itemsLoading: boolean
  /** 资料加载错误 */
  itemsError: string | null

  // ---- 筛选条件 ----
  filter: ProfileFilter

  // ---- 资料详情 ----
  /** 当前选中的资料 ID */
  selectedItemId: string | null
  /** 资料详情加载状态 */
  detailLoading: boolean

  // ---- 证据链 ----
  /** 评分证据列表 */
  evidence: ScoreEvidence[]
  /** 证据加载状态 */
  evidenceLoading: boolean

  // ---- 资料包元数据 ----
  /** 股票资料包元数据 */
  profile: StockProfile | null
  /** 资料包加载状态 */
  profileLoading: boolean
}

export interface ProfileActions {
  // ---- 基础操作 ----
  setSymbol: (symbol: string) => void
  loadStocks: () => Promise<void>

  // ---- 域导航 ----
  setActiveDomain: (domain: ProfileDomain | null) => void

  // ---- 资料列表 ----
  loadItems: () => Promise<void>
  refreshItems: () => Promise<void>

  // ---- 筛选 ----
  setFilter: (filter: Partial<ProfileFilter>) => void
  resetFilter: () => void

  // ---- 资料详情 ----
  selectItem: (itemId: string | null) => void
  loadItemDetail: (itemId: string) => Promise<ProfileItem | null>

  // ---- 证据链 ----
  loadEvidence: () => Promise<void>

  // ---- 资料包 ----
  loadProfile: () => Promise<void>

  // ---- 删除操作 ----
  deleteItem: (itemId: string) => Promise<boolean>
  deleteTag: (tagId: string) => Promise<boolean>
}

const initialFilter: ProfileFilter = {
  itemType: undefined,
  sentiment: undefined,
  minQuality: 0,
  keyword: '',
  source: undefined,
}

const initialState: ProfileState = {
  symbol: '',
  stocks: [],
  stocksLoading: false,
  activeDomain: null,
  items: [],
  itemsLoading: false,
  itemsError: null,
  filter: initialFilter,
  selectedItemId: null,
  detailLoading: false,
  evidence: [],
  evidenceLoading: false,
  profile: null,
  profileLoading: false,
}

export const useProfileStore = create<ProfileState & ProfileActions>((set, get) => ({
  ...initialState,

  // ============================================================
  // 基础操作
  // ============================================================

  setSymbol: (symbol: string) => {
    logger.info(`[profileStore] setSymbol: ${symbol}`)
    set({ symbol, selectedItemId: null, items: [], evidence: [], profile: null })
    // 切换股票后自动加载资料
    const { loadItems, loadEvidence, loadProfile } = get()
    void loadItems()
    void loadEvidence()
    void loadProfile()
  },

  loadStocks: async () => {
    if (get().stocks.length > 0) return
    set({ stocksLoading: true })
    try {
      const result = await listPoolItems()
      if (result.success && result.data) {
        const stocks = result.data.map(poolItemToStock)
        set({ stocks, stocksLoading: false })
        logger.info(`[profileStore] loadStocks: ${stocks.length} 只股票`)
      } else {
        set({ stocks: [], stocksLoading: false })
      }
    } catch (err) {
      logger.error('[profileStore] loadStocks 失败', { error: err instanceof Error ? err.message : String(err) })
      set({ stocks: [], stocksLoading: false })
    }
  },

  // ============================================================
  // 域导航
  // ============================================================

  setActiveDomain: (domain: ProfileDomain | null) => {
    logger.info(`[profileStore] setActiveDomain: ${domain ?? 'all'}`)
    set({ activeDomain: domain, selectedItemId: null })
    void get().loadItems()
  },

  // ============================================================
  // 资料列表
  // ============================================================

  loadItems: async () => {
    const { symbol, activeDomain, filter } = get()
    if (!symbol) {
      set({ items: [], itemsLoading: false })
      return
    }

    set({ itemsLoading: true, itemsError: null })
    try {
      // 按索引查询：by-symbol-domain-quality
      const queryAction = activeDomain
        ? ({
            action: ENVELOPE_ACTION.queryByIndex,
            store: STORE_NAME.profileItems,
            indexName: 'by-symbol-domain-quality',
            indexValue: [symbol, activeDomain],
            source: MODULE_ID.analyzer,
          } as const)
        : ({
            action: ENVELOPE_ACTION.queryByIndex,
            store: STORE_NAME.profileItems,
            indexName: 'by-symbol-domain-quality',
            indexValue: [symbol],
            source: MODULE_ID.analyzer,
          } as const)

      const result = await dataBridge.query<ProfileItem[]>(queryAction)

      if (result.success && result.data) {
        let items = result.data

        // 客户端筛选
        if (filter.itemType) {
          items = items.filter((i) => i.itemType === filter.itemType)
        }
        if (filter.sentiment) {
          items = items.filter((i) => i.sentiment === filter.sentiment)
        }
        if (filter.minQuality && filter.minQuality > 0) {
          items = items.filter((i) => (i.qualityScore ?? 0) >= filter.minQuality!)
        }
        if (filter.keyword && filter.keyword.trim()) {
          const kw = filter.keyword.toLowerCase()
          items = items.filter(
            (i) =>
              i.title.toLowerCase().includes(kw) ||
              i.summary.toLowerCase().includes(kw) ||
              i.topicTags?.some((t) => t.toLowerCase().includes(kw)),
          )
        }
        if (filter.source) {
          items = items.filter((i) => i.source === filter.source)
        }

        // 按质量分 × 证据权重排序
        items.sort((a, b) => {
          const scoreA = (a.qualityScore ?? 50) * (a.evidenceWeight ?? 0.5)
          const scoreB = (b.qualityScore ?? 50) * (b.evidenceWeight ?? 0.5)
          return scoreB - scoreA
        })

        set({ items, itemsLoading: false })
        logger.info(`[profileStore] loadItems: ${items.length} 条资料 (${activeDomain ?? '全部域'})`)
      } else {
        set({ items: [], itemsLoading: false, itemsError: result.error ?? '查询失败' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.warn('[profileStore] loadItems 失败', { symbol, error: msg })
      set({ items: [], itemsLoading: false, itemsError: msg })
    }
  },

  refreshItems: async () => {
    logger.info('[profileStore] refreshItems')
    await get().loadItems()
  },

  // ============================================================
  // 筛选
  // ============================================================

  setFilter: (partial: Partial<ProfileFilter>) => {
    const newFilter = { ...get().filter, ...partial }
    logger.info('[profileStore] setFilter', { filter: newFilter })
    set({ filter: newFilter })
    void get().loadItems()
  },

  resetFilter: () => {
    logger.info('[profileStore] resetFilter')
    set({ filter: initialFilter })
    void get().loadItems()
  },

  // ============================================================
  // 资料详情
  // ============================================================

  selectItem: (itemId: string | null) => {
    set({ selectedItemId: itemId })
  },

  loadItemDetail: async (itemId: string): Promise<ProfileItem | null> => {
    set({ detailLoading: true })
    try {
      const result = await dataBridge.query<ProfileItem>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.profileItems,
        key: itemId,
        source: MODULE_ID.analyzer,
      })
      set({ detailLoading: false })
      if (result.success && result.data) {
        return result.data
      }
      return null
    } catch (err) {
      logger.error('[profileStore] loadItemDetail 失败', { itemId, error: err instanceof Error ? err.message : String(err) })
      set({ detailLoading: false })
      return null
    }
  },

  // ============================================================
  // 证据链
  // ============================================================

  loadEvidence: async () => {
    const { symbol } = get()
    if (!symbol) {
      set({ evidence: [], evidenceLoading: false })
      return
    }

    set({ evidenceLoading: true })
    try {
      const result = await dataBridge.query<ScoreEvidence[]>({
        action: ENVELOPE_ACTION.queryByIndex,
        store: STORE_NAME.scoreEvidence,
        indexName: 'by-symbol-layer',
        indexValue: [symbol],
        source: MODULE_ID.analyzer,
      })

      if (result.success && result.data) {
        set({ evidence: result.data, evidenceLoading: false })
        logger.info(`[profileStore] loadEvidence: ${result.data.length} 条证据`)
      } else {
        set({ evidence: [], evidenceLoading: false })
      }
    } catch (err) {
      logger.warn('[profileStore] loadEvidence 失败', { symbol, error: err instanceof Error ? err.message : String(err) })
      set({ evidence: [], evidenceLoading: false })
    }
  },

  // ============================================================
  // 资料包元数据
  // ============================================================

  loadProfile: async () => {
    const { symbol } = get()
    if (!symbol) {
      set({ profile: null, profileLoading: false })
      return
    }

    set({ profileLoading: true })
    try {
      const result = await dataBridge.query<StockProfile>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stockProfiles,
        key: symbol,
        source: MODULE_ID.analyzer,
      })

      if (result.success && result.data) {
        set({ profile: result.data, profileLoading: false })
        logger.info(`[profileStore] loadProfile: ${symbol} 完整度 ${result.data.evidenceCoverage}`)
      } else {
        set({ profile: null, profileLoading: false })
      }
    } catch (err) {
      logger.warn('[profileStore] loadProfile 失败', { symbol, error: err instanceof Error ? err.message : String(err) })
      set({ profile: null, profileLoading: false })
    }
  },

  // ============================================================
  // 删除操作
  // ============================================================

  deleteItem: async (itemId: string): Promise<boolean> => {
    const { symbol, items } = get()
    if (!symbol) {
      logger.warn('[profileStore] deleteItem 跳过: symbol 为空')
      return false
    }

    logger.info('[profileStore] deleteItem 开始', { symbol, itemId })
    try {
      const envelope = EnvelopeFactory.create({
        action: ENVELOPE_ACTION.deleteProfileItem,
        source: MODULE_ID.analyzer,
        target: ENVELOPE_TARGET.db,
        traceId: nanoid(),
      }, { id: itemId })

      await dataBridge.forward(envelope)

      // 从本地状态移除
      set({ items: items.filter((item) => item.id !== itemId), selectedItemId: null })
      logger.info('[profileStore] deleteItem 成功', { symbol, itemId })
      return true
    } catch (err) {
      logger.error('[profileStore] deleteItem 异常', { symbol, itemId, error: err instanceof Error ? err.message : String(err) })
      return false
    }
  },

  deleteTag: async (tagId: string): Promise<boolean> => {
    const { symbol } = get()
    if (!symbol) {
      logger.warn('[profileStore] deleteTag 跳过: symbol 为空')
      return false
    }

    logger.info('[profileStore] deleteTag 开始', { symbol, tagId })
    try {
      const envelope = EnvelopeFactory.create({
        action: ENVELOPE_ACTION.deleteProfileTag,
        source: MODULE_ID.analyzer,
        target: ENVELOPE_TARGET.db,
        traceId: `profile-delete-tag-${nanoid(8)}-${tagId}`,
      }, { id: tagId })

      await dataBridge.forward(envelope)

      logger.info('[profileStore] deleteTag 成功', { symbol, tagId })
      // 刷新资料包以同步标签变更
      void get().loadProfile()
      return true
    } catch (err) {
      logger.error('[profileStore] deleteTag 异常', { symbol, tagId, error: err instanceof Error ? err.message : String(err) })
      return false
    }
  },
}))

// ============================================================
// Selectors（选择器函数，避免不必要的重渲染）
// ============================================================

export const selectSymbol = (state: ProfileState): string => state.symbol
export const selectStocks = (state: ProfileState): Stock[] => state.stocks
export const selectActiveDomain = (state: ProfileState): ProfileDomain | null => state.activeDomain
export const selectItems = (state: ProfileState): ProfileItem[] => state.items
export const selectItemsLoading = (state: ProfileState): boolean => state.itemsLoading
export const selectFilter = (state: ProfileState): ProfileFilter => state.filter
export const selectSelectedItemId = (state: ProfileState): string | null => state.selectedItemId
export const selectEvidence = (state: ProfileState): ScoreEvidence[] => state.evidence
export const selectProfile = (state: ProfileState): StockProfile | null => state.profile

/**
 * 按域统计资料数量
 * @nonReactive 每次调用返回新对象，禁止直接作为 useProfileStore 的 selector
 *              （会导致 getSnapshot 未缓存告警/死循环）；请在组件中订阅原始
 *              字段后用 useMemo 调用本纯函数派生。
 */
export function selectDomainCounts(state: ProfileState): Record<ProfileDomain, number> {
  const counts: Record<string, number> = {}
  for (const item of state.items) {
    counts[item.domain] = (counts[item.domain] ?? 0) + 1
  }
  // 确保所有 8 个域都有值
  const result: Record<ProfileDomain, number> = {
    D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0, D7: 0, D8: 0,
  }
  Object.assign(result, counts)
  return result
}

/** 获取当前选中的资料条目 */
export function selectSelectedItem(state: ProfileState): ProfileItem | undefined {
  if (!state.selectedItemId) return undefined
  return state.items.find((i) => i.id === state.selectedItemId)
}

/**
 * 按层分组证据（纯函数，AGENTS.md §二 铁律 2 类型 B）
 *
 * 组件中请订阅原始 `evidence` 字段后用 useMemo 调用本函数派生，
 * 禁止直接把「按 state 返回新对象」的 selector 传给 useProfileStore。
 */
export function groupEvidenceByLayer(
  evidence: ScoreEvidence[],
): Record<ScoreLayerId, ScoreEvidence[]> {
  const grouped: Record<string, ScoreEvidence[]> = {}
  for (const ev of evidence) {
    if (!grouped[ev.layer]) grouped[ev.layer] = []
    grouped[ev.layer]!.push(ev)
  }
  return grouped as Record<ScoreLayerId, ScoreEvidence[]>
}

/**
 * 获取所有可用的来源列表
 * @nonReactive 每次调用返回新数组，禁止直接作为 useProfileStore 的 selector；
 *              请在组件中订阅 items 后用 useMemo 派生。
 */
export function selectAvailableSources(state: ProfileState): string[] {
  const sources = new Set<string>()
  for (const item of state.items) {
    sources.add(item.source)
  }
  return Array.from(sources).sort()
}

// 导出域元数据常量供组件使用
export { DOMAIN_META }
