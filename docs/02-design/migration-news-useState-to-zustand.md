---
title: 新闻模块 — useState → Zustand 迁移文档
version: v1.0.0
last_updated: 2026-06-27
maintainer: Quality Auditor
status: active
change_log:
  - date: 2026-06-27
    author: Quality Auditor
    desc: 初始版本，记录 NewsPage + NewsFeed 从 useState 到 Zustand 的迁移
---

# 新闻模块 — useState → Zustand 迁移文档

## 1. 迁移概览

| 维度 | 迁移前 (useState) | 迁移后 (Zustand) |
|:---|:---|:---|
| 状态管理文件 | 无（状态散落在组件内） | `src/store/newsStore.ts` |
| NewsPage 状态声明 | 7 个 `useState` + 2 个工具函数 | 1 个 `useNewsStore()` 解构 |
| NewsFeed 状态声明 | 4 个 `useState` + 1 个 `useRef` | 1 个 `useNewsStore()` 解构 |
| NewsPage → NewsFeed props | 10 个 | 4 个（仅回调） |
| 跨组件共享 | 不支持 | 任意组件通过 `useNewsStore()` 访问 |
| 收藏持久化 | 在 NewsPage 中 | 在 store 中，调用方无感知 |
| TypeScript 编译 | 通过 | 通过 (`tsc --noEmit` exit 0) |

## 2. 新增文件

### `src/store/newsStore.ts`

单一 Zustand store，管理 13 个状态域 + 14 个 action：

```typescript
// 数据层（5 个）：articles / loading / error / hasMore / currentOffset
// UI 层（8 个）：selectedArticle / bookmarkedIds / filter / searchInput / showFilter / displayCount
// Actions（14 个）：setArticles / appendArticles / setLoading / setError / setHasMore /
//                  setCurrentOffset / selectArticle / toggleBookmark / setFilter /
//                  setSearchInput / setShowFilter / setDisplayCount / resetDisplay
```

关键设计决策：
- `bookmarkedIds` 使用 `Set<string>` 类型，在 `toggleBookmark` action 中自动同步 localStorage
- `appendArticles` 使用 `set((state) => ...)` 模式实现不可变追加
- `setFilter` 同时重置 `displayCount`，避免筛选后仍显示旧的分页偏移
- 所有 action 变更均包含 `logger.info` 日志

## 3. 变更文件

### `src/pages/news-v6/NewsPage.tsx`

**变更清单：**

| 行号 | 变更类型 | 说明 |
|:---|:---|:---|
| L4 | 注释 | 新增 "状态管理已从 useState 迁移至 useNewsStore (Zustand)" |
| L7 | 导入 | 移除 `useMemo, useState`，保留 `useCallback, useEffect` |
| L13 | 导入 | 新增 `import { useNewsStore } from '@/store/newsStore'` |
| L14 | 移除 | 删除 `import type { NewsFilter } from './components/FilterPanel'` |
| L18-19 | 移除 | 删除 `BOOKMARK_STORAGE_KEY`、`PAGE_SIZE`（`PAGE_SIZE` 保留，仅移除 `BOOKMARK_STORAGE_KEY`） |
| L33-49 | 移除 | 删除 `loadBookmarks()` / `saveBookmarks()` 工具函数 |
| L53-60 | 移除 | 删除 7 个 `useState()` 声明 |
| L63-82 | 移除 | 删除 `filteredArticles` useMemo（筛选逻辑移至 NewsFeed） |
| L34-39 | 新增 | 1 个 `useNewsStore()` 解构替代 7 个 useState |
| L52 | 修改 | `append` 分支改用 `useNewsStore.getState().appendArticles(adapted)` |
| L70 | 修改 | `loadData` deps 数组从 `[]` 更新为 `[setArticles, ...]` |
| L90 | 修改 | `handleRefresh` deps 新增 `setCurrentOffset` |
| L102-106 | 修改 | `handleFilterChange` 改为调用 `setFilter(filter)` + `setCurrentOffset(0)` |
| L110-111 | 修改 | `handleArticleClick` 改为调用 `selectArticle(article)` |
| L114-128 | 移除 | 删除 `handleBookmark` 函数（逻辑移至 store） |
| L140-147 | 修改 | `<NewsFeed>` props 从 10 个缩减为 4 个 |
| L153, L185 | 修改 | `setSelectedArticle(null)` → `selectArticle(null)` |

### `src/pages/news-v6/components/NewsFeed.tsx`

**变更清单：**

| 行号 | 变更类型 | 说明 |
|:---|:---|:---|
| L4 | 注释 | 新增 "状态管理已从 useState 迁移至 useNewsStore (Zustand)" |
| L7 | 导入 | `useState, useRef` → `useMemo, useCallback` |
| L15 | 导入 | 新增 `import { useNewsStore } from '@/store/newsStore'` |
| L17-26 | 修改 | `NewsFeedProps` 移除 `articles`/`loading`/`hasMore`/`onBookmark`/`bookmarkedIds`（5 个 props） |
| L28-37 | 修改 | 函数签名移除对应参数，新增 `useNewsStore()` 解构 |
| L40-44 | 移除 | 删除 4 个 `useState` + 1 个 `useRef` 声明 |
| L57-66 | 修改 | `handleSearchChange` 改用 store actions，移除防抖 ref |
| L68-76 | 修改 | `handleFilterChange` 改用 `setFilter` + `resetDisplay` |
| L78-86 | 修改 | `handleLoadMore` 改用 `setDisplayCount` |
| L88-92 | 修改 | `handleRefresh` 改用 `resetDisplay` |
| L189-190 | 修改 | `onBookmark={onBookmark}` → `onBookmark={toggleBookmark}`，`bookmarkedIds?.has` → `bookmarkedIds.has` |

## 4. 迁移模式速查

### 模式 1：useState → Zustand state

```typescript
// 迁移前
const [articles, setArticles] = useState<V6NewsArticle[]>([])

// 迁移后
const { articles, setArticles } = useNewsStore()
```

### 模式 2：useState + 回调 → Zustand action

```typescript
// 迁移前
const handleBookmark = useCallback((id: string) => {
  setBookmarkedIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    saveBookmarks(next)
    return next
  })
}, [])

// 迁移后
const { toggleBookmark } = useNewsStore()
// toggleBookmark 内部已包含 localStorage 持久化 + 日志
```

### 模式 3：useCallback 内调用 setState → 直接调用 store action

```typescript
// 迁移前
const handleFilterChange = useCallback((filter: NewsFilter) => {
  setActiveFilter(filter)     // 本地 useState setter
  setCurrentOffset(0)         // 本地 useState setter
  void loadData(0)           // 本地函数
}, [loadData])

// 迁移后
const handleFilterChange = useCallback((filter: NewsFilter) => {
  setFilter(filter)           // store action（自动重置 displayCount）
  setCurrentOffset(0)         // store action
  void loadData(0)           // 本地函数（不变）
}, [loadData, setFilter, setCurrentOffset])
```

### 模式 4：Props 传递 → Store 消费

```typescript
// 迁移前 — NewsPage → NewsFeed
<NewsFeed
  articles={filteredArticles}   // 10 个 props
  loading={loading}
  hasMore={hasMore}
  onBookmark={handleBookmark}
  bookmarkedIds={bookmarkedIds}
  ...
/>

// 迁移后 — NewsPage → NewsFeed
<NewsFeed
  onLoadMore={loadMore}         // 4 个 props（仅回调）
  onRefresh={handleRefresh}
  onFilterChange={handleFilterChange}
  onArticleClick={handleArticleClick}
/>
// NewsFeed 内部通过 useNewsStore() 直接读取 articles/loading/hasMore/bookmarkedIds
```

## 5. 验证结果

| 检查项 | 结果 |
|:---|:---|
| `tsc --noEmit` | exit 0，零错误 |
| NewsPage 筛选功能 | 正常（filter 变更 → store.setFilter → NewsFeed 响应） |
| NewsFeed 收藏功能 | 正常（toggleBookmark → store 持久化 → localStorage） |
| 分页加载 | 正常（currentOffset → loadMore → appendArticles） |
| 跨组件状态共享 | 正常（NewsPage 和 NewsFeed 共享同一 store 实例） |

## 6. 后续可扩展点

- 可新增 `src/store/newsStore.selectors.ts`，封装 `useFilteredArticles()` / `useArticleStats()` 等派生选择器
- 收藏数据可升级为 IndexedDB 存储（替代 localStorage），变更点仅限 store 内部
- 可接入 DataBridge 事件通道（P2-3），实现新闻数据变更的自动刷新