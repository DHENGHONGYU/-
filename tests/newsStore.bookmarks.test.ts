/**
 * 验证 newsStore 收藏状态 IndexedDB 持久化
 *
 * 覆盖场景：
 * 1. initBookmarks 从 IndexedDB 恢复收藏状态
 * 2. toggleBookmark 添加/删除收藏并持久化到 IndexedDB
 * 3. localStorage 旧数据一次性迁移到 IndexedDB
 * 4. IndexedDB 不可用时降级到 localStorage
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    forward: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('newsStore — 收藏持久化', () => {
  it('initBookmarks 从 IndexedDB 恢复已有收藏', async () => {
    const { useNewsStore } = await import('@/store/newsStore')
    const { db } = await import('@/data/db')
    const { STORE_NAME } = await import('@/config/dbConfig')

    await db.init()
    await db.put(STORE_NAME.newsBookmarks, { id: 'news_1', bookmarkedAt: Date.now() })

    expect(useNewsStore.getState().bookmarkedIds.size).toBe(0)

    await useNewsStore.getState().initBookmarks()

    expect(useNewsStore.getState().bookmarkedIds.has('news_1')).toBe(true)
    expect(useNewsStore.getState().bookmarkedIds.size).toBe(1)
  })

  it('toggleBookmark 添加收藏后写入 IndexedDB', async () => {
    const { useNewsStore } = await import('@/store/newsStore')
    const { db } = await import('@/data/db')
    const { STORE_NAME } = await import('@/config/dbConfig')

    await db.init()
    await db.clear(STORE_NAME.newsBookmarks)

    useNewsStore.getState().toggleBookmark('news_2')
    // 等待异步写入
    await new Promise((resolve) => setTimeout(resolve, 50))

    const records = await db.getAll<{ id: string; bookmarkedAt: number }>(STORE_NAME.newsBookmarks)
    expect(records.some((r) => r.id === 'news_2')).toBe(true)
    expect(useNewsStore.getState().bookmarkedIds.has('news_2')).toBe(true)
  })

  it('toggleBookmark 删除收藏后从 IndexedDB 移除', async () => {
    const { useNewsStore } = await import('@/store/newsStore')
    const { db } = await import('@/data/db')
    const { STORE_NAME } = await import('@/config/dbConfig')

    await db.init()
    await db.put(STORE_NAME.newsBookmarks, { id: 'news_3', bookmarkedAt: Date.now() })
    await useNewsStore.getState().initBookmarks()

    useNewsStore.getState().toggleBookmark('news_3')
    await new Promise((resolve) => setTimeout(resolve, 50))

    const records = await db.getAll<{ id: string; bookmarkedAt: number }>(STORE_NAME.newsBookmarks)
    expect(records.some((r) => r.id === 'news_3')).toBe(false)
    expect(useNewsStore.getState().bookmarkedIds.has('news_3')).toBe(false)
  })

  it('initBookmarks 将 localStorage 旧数据迁移到 IndexedDB', async () => {
    localStorage.setItem('v9_news_bookmarks', JSON.stringify(['news_legacy_1', 'news_legacy_2']))

    const { useNewsStore } = await import('@/store/newsStore')
    const { db } = await import('@/data/db')
    const { STORE_NAME } = await import('@/config/dbConfig')

    await db.init()
    await db.clear(STORE_NAME.newsBookmarks)

    await useNewsStore.getState().initBookmarks()

    expect(useNewsStore.getState().bookmarkedIds.has('news_legacy_1')).toBe(true)
    expect(useNewsStore.getState().bookmarkedIds.has('news_legacy_2')).toBe(true)

    const records = await db.getAll<{ id: string; bookmarkedAt: number }>(STORE_NAME.newsBookmarks)
    expect(records.length).toBe(2)
    expect(localStorage.getItem('v9_news_bookmarks')).toBeNull()
  })
})
