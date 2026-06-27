// @module newsStore
// @lifecycle @Global
// 新闻资讯模块全局状态管理（Zustand）。
// 从 NewsPage 组件内 useState 迁移至独立 Store，实现跨组件状态共享。
//
// 管理范围：
// - 数据层：articles / loading / error / hasMore / currentOffset
// - UI 层：selectedArticle / bookmarkedIds / filter / searchInput / showFilter / displayCount
//
// @migration 从 NewsPage.tsx 的 7 个 useState + 2 个工具函数迁移而来
import { create } from 'zustand'
import type { V6NewsArticle } from '@/pages/news-v6/types'
import type { NewsFilter } from '@/pages/news-v6/components/FilterPanel'
import { DEFAULT_FILTER } from '@/pages/news-v6/components/newsFeedUtils'
import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { db } from '@/data/db'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'

const logger = getLogger()
const BOOKMARK_STORAGE_KEY = 'v9_news_bookmarks'

interface NewsBookmarkRecord {
  id: string
  bookmarkedAt: number
}

/** 从 localStorage 迁移旧收藏数据（一次性） */
function loadLegacyBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(BOOKMARK_STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

/** 清除已迁移的 localStorage 数据 */
function clearLegacyBookmarks(): void {
  try {
    localStorage.removeItem(BOOKMARK_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** 异步加载收藏状态；首次从 IndexedDB 读取为空时，尝试从 localStorage 迁移 */
async function loadBookmarksFromDB(): Promise<Set<string>> {
  try {
    await db.init()
    const records = await db.getAll<NewsBookmarkRecord>(STORE_NAME.newsBookmarks)
    if (records.length > 0) {
      return new Set(records.map((r) => r.id))
    }

    // 迁移旧数据
    const legacy = loadLegacyBookmarks()
    if (legacy.size > 0) {
      await saveBookmarksToDB(legacy)
      clearLegacyBookmarks()
      logger.info('[newsStore] Migrated bookmarks from localStorage to IndexedDB', { count: legacy.size })
      return legacy
    }

    return new Set()
  } catch (err) {
    logger.error('[newsStore] Failed to load bookmarks from IndexedDB, falling back to localStorage', { error: err })
    return loadLegacyBookmarks()
  }
}

/** 异步保存收藏状态到 IndexedDB */
async function saveBookmarksToDB(ids: Set<string>): Promise<void> {
  try {
    await db.init()
    await db.clear(STORE_NAME.newsBookmarks)
    for (const id of ids) {
      await db.put(STORE_NAME.newsBookmarks, { id, bookmarkedAt: Date.now() })
    }
  } catch (err) {
    logger.error('[newsStore] Failed to save bookmarks to IndexedDB, falling back to localStorage', { error: err })
    try {
      localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify([...ids]))
    } catch {
      logger.warn('[newsStore] Failed to save bookmarks fallback')
    }
  }
}

export interface NewsState {
  // ===== 数据层 =====
  articles: V6NewsArticle[]
  loading: boolean
  error: string | null
  hasMore: boolean
  currentOffset: number

  // ===== UI 层 =====
  selectedArticle: V6NewsArticle | null
  bookmarkedIds: Set<string>
  filter: NewsFilter
  searchInput: string
  showFilter: boolean
  displayCount: number

  // ===== Actions =====
  setArticles: (articles: V6NewsArticle[]) => void
  appendArticles: (articles: V6NewsArticle[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setHasMore: (hasMore: boolean) => void
  setCurrentOffset: (offset: number) => void
  selectArticle: (article: V6NewsArticle | null) => void
  toggleBookmark: (id: string) => void
  setFilter: (filter: NewsFilter) => void
  setSearchInput: (input: string) => void
  setShowFilter: (show: boolean) => void
  setDisplayCount: (count: number) => void
  resetDisplay: () => void
  initBookmarks: () => Promise<void>
}

export const useNewsStore = create<NewsState>((set) => ({
  articles: [],
  loading: false,
  error: null,
  hasMore: false,
  currentOffset: 0,
  selectedArticle: null,
  bookmarkedIds: new Set(),
  filter: DEFAULT_FILTER,
  searchInput: '',
  showFilter: false,
  displayCount: 20,

  setArticles: (articles) => set({ articles }),
  appendArticles: (articles) =>
    set((state) => ({ articles: [...state.articles, ...articles] })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setHasMore: (hasMore) => set({ hasMore }),
  setCurrentOffset: (offset) => set({ currentOffset: offset }),
  selectArticle: (article) => set({ selectedArticle: article }),
  toggleBookmark: (id) =>
    set((state) => {
      const next = new Set(state.bookmarkedIds)
      const isBookmarked = !next.has(id)
      if (isBookmarked) {
        next.add(id)
        logger.info('[newsStore] Bookmark added', { id, total: next.size })
      } else {
        next.delete(id)
        logger.info('[newsStore] Bookmark removed', { id, total: next.size })
      }
      void saveBookmarksToDB(next)

      // DataBridge 事件转发：收藏状态变更（异步，不影响状态更新）
      try {
        const envelope = EnvelopeFactory.create(
          {
            source: MODULE_ID.news,
            target: ENVELOPE_TARGET.db,
            action: ENVELOPE_ACTION.newsArticleBookmarked,
            traceId: `news-bookmark-${Date.now()}-${id}`,
          },
          { id, bookmarked: isBookmarked, total: next.size },
        )
        void dataBridge.forward(envelope).catch((err) => {
          logger.error('[newsStore] DataBridge forward failed for bookmark', { id, error: err })
        })
      } catch (err) {
        logger.error('[newsStore] Failed to create bookmark envelope', { id, error: err })
      }

      return { bookmarkedIds: next }
    }),
  setFilter: (filter) => {
    logger.info('[newsStore] Filter changed', { filter })
    set({ filter, displayCount: 20 })
  },
  setSearchInput: (input) => set({ searchInput: input }),
  setShowFilter: (show) => set({ showFilter: show }),
  setDisplayCount: (count) => set({ displayCount: count }),
  resetDisplay: () => set({ displayCount: 20 }),
  initBookmarks: async () => {
    const ids = await loadBookmarksFromDB()
    set({ bookmarkedIds: ids })
    logger.info('[newsStore] Bookmarks initialized', { count: ids.size })
  },
}))

// ===== DataBridge 订阅生命周期 =====
// 由组件层 useEffect 调用 init，返回的 cleanup 函数中调用 destroy
// 避免模块级副作用导致的 HMR 重复订阅和内存泄漏

let _unsubscribeNews: (() => void) | null = null

/** 初始化 DataBridge 新闻通道订阅，返回 cleanup 函数 */
export function initNewsStoreSubscriptions(): () => void {
  if (_unsubscribeNews) {
    logger.warn('[newsStore] Subscriptions already initialized, skipping')
    return _unsubscribeNews
  }

  _unsubscribeNews = dataBridge.subscribe('news', (envelope) => {
    if (envelope.meta.action === ENVELOPE_ACTION.saveNews) {
      logger.info('[newsStore] DataBridge event received: saveNews', {
        traceId: envelope.meta.traceId,
        source: envelope.meta.source,
      })
    }
    if (envelope.meta.action === ENVELOPE_ACTION.newsArticleBookmarked) {
      logger.info('[newsStore] DataBridge event received: bookmark', {
        traceId: envelope.meta.traceId,
      })
    }
  })

  return () => {
    _unsubscribeNews?.()
    _unsubscribeNews = null
    logger.info('[newsStore] DataBridge subscriptions destroyed')
  }
}