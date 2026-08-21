---
doc_id: V9-DOC-GUIDE-043
title: "如何新增一个 Store（Zustand + withBroadcast）"
domain: project
status: active
last_updated: 2026-08-17
---
covers_code:
  - src/constants/store-channels.constants.ts
  - src/data/types.ts
  - src/store/sectorAnalysisStore.test.ts
  - src/lib/withBroadcast.ts


---
doc_id: V9-DOC-GUIDE-027
title: "如何新增一个 Store（Zustand + withBroadcast）"
domain: guide
status: active
last_updated: 2026-08-15
---

# 如何新增一个 Store（Zustand + withBroadcast）

> **版本**：v1.0.0  
> **日期**：2026-07-12  
> **目标**：在 15 分钟内完成新增 Store 的全流程，不踩注册遗漏、广播缺失、类型守卫等常见坑

---

## 前置检查

在开始之前，确认以下事项：

- [ ] 已阅读 `docs/guides/getting-started.md`（了解四步集成契约）
- [ ] 已确定 Store 的数据类型（在 `src/types/` 或 `src/data/types.ts` 中定义 Interface）
- [ ] 已确定对应的 Service 层接口（Store 只能依赖 `services/` 和 `core/`）
- [ ] 已检查 `src/constants/store-channels.constants.ts` 中是否有合适的事件名，或需要新增

---

## 步骤 1：定义类型（3 分钟）

在 `src/types/modules/` 或 `src/data/types.ts` 中定义 Store 相关的类型。

```typescript
// 示例：新增 sectorAnalysisStore 的类型
export interface SectorAnalysisData {
  sectorId: string
  sectorName: string
  score: number
  trend: 'up' | 'down' | 'flat'
  updatedAt: number
}

export interface SectorAnalysisTrendPoint {
  date: string
  score: number
}
```

> **规则**：复杂泛型必须有 `Expect<Equals>` 类型测试（位于 `tests/__tests__/types/`）。

---

## 步骤 2：创建 Store（5 分钟）

在 `src/store/` 下新建文件，命名规范：`{domain}Store.ts`（camelCase + `Store` 后缀）。

### 2.1 标准模板

```typescript
/**
 * @module sectorAnalysisStore
 * @description 板块分析状态管理。集中管理板块评分、趋势数据。
 *
 * @see @/services/analysis/sectorAnalysisService.ts - 底层数据服务
 * @see @/pages/analysis/SectorAnalysisPage.tsx - 消费方
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { SectorAnalysisData, SectorAnalysisTrendPoint } from '@/data/types'
import { loadSectorAnalysis, loadSectorTrend } from '@/services/analysis/sectorAnalysisService'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/lib/withBroadcast'

const logger = getLogger()

// ============================================================
// Store 接口
// ============================================================

interface SectorAnalysisState {
  /** 板块列表 */
  sectors: SectorAnalysisData[]
  /** 趋势数据 */
  trendData: SectorAnalysisTrendPoint[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null

  // Actions
  /** 加载板块列表 */
  loadSectors: () => Promise<void>
  /** 加载指定板块趋势 */
  loadTrend: (sectorId: string) => Promise<void>
  /** 清空错误 */
  clearError: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  sectors: [] as SectorAnalysisData[],
  trendData: [] as SectorAnalysisTrendPoint[],
  loading: false,
  error: null as string | null,
}

// ============================================================
// Store
// ============================================================

export const useSectorAnalysisStore = create<SectorAnalysisState>((set, get) => ({
  ...initialState,

  loadSectors: async () => {
    logger.info('[sectorAnalysisStore] loadSectors 开始')
    set({ loading: true, error: null })

    try {
      const result = await loadSectorAnalysis()
      if (result.success && result.data) {
        set({ sectors: result.data, loading: false })
        logger.info(`[sectorAnalysisStore] loadSectors 完成: ${result.data.length} 个板块`)
        // D-3: 广播变更事件
        withBroadcast(EVENT_NAMES.SECTOR_ANALYSIS_CHANGED, { action: 'load', count: result.data.length })
      } else {
        const message = result.error ?? '无法加载板块数据'
        logger.error(`[sectorAnalysisStore] loadSectors 失败: ${message}`)
        set({ loading: false, error: message })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法加载板块数据'
      logger.error(`[sectorAnalysisStore] loadSectors 异常: ${message}`)
      set({ loading: false, error: message })
    }
  },

  loadTrend: async (sectorId: string) => {
    logger.info(`[sectorAnalysisStore] loadTrend 开始: ${sectorId}`)
    set({ loading: true, error: null })

    try {
      const result = await loadSectorTrend(sectorId)
      if (result.success && result.data) {
        set({ trendData: result.data, loading: false })
        logger.info(`[sectorAnalysisStore] loadTrend 完成: ${result.data.length} 个周期点`)
      } else {
        const message = result.error ?? '无法加载趋势数据'
        logger.error(`[sectorAnalysisStore] loadTrend 失败: ${message}`)
        set({ loading: false, error: message })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法加载趋势数据'
      logger.error(`[sectorAnalysisStore] loadTrend 异常: ${message}`)
      set({ loading: false, error: message })
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))

// ============================================================
// 派生查询（可选）
// 设计原则：派生查询独立函数模式，通过 getState() 访问状态，不存入 State
// ============================================================
// export * from './sectorAnalysisStore.derived'
```

### 2.2 关键要素检查清单

| 要素 | 是否必须 | 说明 | 常见错误 |
|------|----------|------|----------|
| `interface *State` | ✅ 必须 | 完整定义 State 类型 | 遗漏 Action 类型 |
| `initialState` | ✅ 必须 | 提取为常量对象 | 在 create 中内联定义，难以重置 |
| `withBroadcast()` | ✅ 必须 | 写操作后广播跨 Tab 事件 | 忘记广播，其他 Tab 数据不同步 |
| `logger.info/error` | ✅ 必须 | 核心分支打印日志 | 无日志，线上难以调试 |
| 错误处理 `try/catch` | ✅ 必须 | 所有 async Action 包裹 | 未捕获异常，导致 UI 卡 loading |
| `set({ loading: false })` | ✅ 必须 | 无论成功失败都要关闭 loading | 成功时未关闭 loading |
| 派生查询 `.derived.ts` | 🟡 建议 | 复杂计算用 memoizeByRef 缓存 | 在 State 中存派生数据，导致冗余渲染 |

---

## 步骤 3：注册广播事件（2 分钟）

如果使用了新的事件名，必须在 `src/constants/store-channels.constants.ts` 的 `EVENT_NAMES` 中注册：

```typescript
export const EVENT_NAMES = {
  // ... 现有事件 ...
  /** 板块分析数据变更（sectorAnalysisStore 写操作触发） */
  SECTOR_ANALYSIS_CHANGED: 'sector_analysis:changed',
} as const
```

> **命名规范**：`{domain}_{subdomain}:changed`，全小写，下划线分隔。

---

## 步骤 4：验证（3 分钟）

### 4.1 类型检查

```bash
npx tsc --noEmit
```

### 4.2 单元测试（最小模板）

在 `src/store/sectorAnalysisStore.test.ts` 中创建：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { useSectorAnalysisStore } from './sectorAnalysisStore'

describe('sectorAnalysisStore', () => {
  it('should have initial state', () => {
    const state = useSectorAnalysisStore.getState()
    expect(state.sectors).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('should clear error', () => {
    useSectorAnalysisStore.setState({ error: 'test error' })
    useSectorAnalysisStore.getState().clearError()
    expect(useSectorAnalysisStore.getState().error).toBeNull()
  })
})
```

### 4.3 架构审计

```bash
npm run audit:layers
# 确认：sectorAnalysisStore.ts 无跨层调用违规
```

---

## 步骤 5：在页面中接入（2 分钟）

```typescript
import { useSectorAnalysisStore } from '@/store/sectorAnalysisStore'

export function SectorAnalysisPage() {
  const { sectors, loading, error, loadSectors, clearError } = useSectorAnalysisStore()

  useEffect(() => {
    loadSectors()
  }, [loadSectors])

  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={clearError} />

  return (
    <div>
      {sectors.map((sector) => (
        <SectorCard key={sector.sectorId} data={sector} />
      ))}
    </div>
  )
}
```

---

## 常见踩坑与规避

### 坑 1：Store 直接调用 dataLayer（跨层违规）

```typescript
// ❌ 错误：Store 直接访问 dataLayer
import { dataLayer } from '@/data/dataLayer'
const data = await dataLayer.sectors.list() // 违规！Store 只能依赖 services/

// ✅ 正确：通过 Service 层间接访问
import { loadSectorAnalysis } from '@/services/analysis/sectorAnalysisService'
const result = await loadSectorAnalysis()
```

### 坑 2：忘记广播跨 Tab 事件

```typescript
// ❌ 错误：set 后未广播
set({ sectors: result.data })

// ✅ 正确：set 后广播
set({ sectors: result.data })
withBroadcast(EVENT_NAMES.SECTOR_ANALYSIS_CHANGED, { action: 'load' })
```

### 坑 3：在 create 中定义内联函数导致类型推断丢失

```typescript
// ❌ 错误：内联定义，类型推断不完整
export const useStore = create<State>((set) => ({
  loadData: async () => { /* ... */ }, // 类型推断可能不完整
}))

// ✅ 正确：先定义 State 接口
interface State {
  loadData: () => Promise<void>
}
export const useStore = create<State>((set) => ({
  loadData: async () => { /* ... */ },
}))
```

### 坑 4：派生状态存入 State

```typescript
// ❌ 错误：在 State 中存计算结果
interface State {
  sectors: SectorData[]
  topSector: SectorData | null // 派生数据，不应存 State
}

// ✅ 正确：派生查询独立函数
export function getTopSector(): SectorData | null {
  const sectors = useSectorAnalysisStore.getState().sectors
  return sectors.length > 0 ? sectors.reduce((a, b) => a.score > b.score ? a : b) : null
}
```

---

## 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 新增 Service | `docs/guides/how-to-add-service.md` | Store 的下游依赖 |
| 新增 Widget | `docs/guides/how-to-add-widget.md` | Store 的上游消费方 |
| Store 广播规范 | `src/constants/store-channels.constants.ts` | 事件命名常量 |
| withBroadcast 实现 | `src/lib/withBroadcast.ts` | 广播工具实现 |
| AGENTS.md 契约 | `AGENTS.md` | 分层规则与四步集成 |

---

> **验证完成后**：更新 `../../README.md` 的 C 类索引，将新增 Store 链接回主索引。
