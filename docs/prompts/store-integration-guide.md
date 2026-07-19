---
title: Store 集成开发指南
type: reference
domain: data
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：本文档是 `src/store/` 目录的权威开发指南，指导开发者按统一模式创建、注册和测试新的 Zustand Store。所有新增 Store 必须遵循本指南，否则..."
tags: [data, integration, store]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# Store 集成开发指南

> **定位**：本文档是 `src/store/` 目录的**权威开发指南**，指导开发者按统一模式创建、注册和测试新的 Zustand Store。所有新增 Store 必须遵循本指南，否则 `audit:layers` / `audit:docs` 门禁将拦截。
>
> **权威契约**：`../../AGENTS.md` §一（分层规则）、§二（四步集成）、§四（命名约定）、§八（数据库版本管理）。本文档与 `../../AGENTS.md` 冲突时，以 `../../AGENTS.md` 为准。
> **回链**：`docs/README.md` → H 类 / `../how-to/how-to-add-store.md`(P1)

---

## 目录

1. [Store 分层定位](#1-store-分层定位)
2. [命名规范](#2-命名规范)
3. [Zustand Store 创建模板](#3-zustand-store-创建模板)
4. [withBroadcast 跨 Tab 广播](#4-withbroadcast-跨-tab-广播)
5. [派生查询（.derived.ts）](#5-派生查询derivedts)
6. [新 Store 创建 Checklist（四步集成）](#6新-store-创建-checklist四步集成)
7. [Store 注册与测试要求](#7-store-注册与测试要求)
8. [常见反模式](#8-常见反模式)
9. [验证命令](#9-验证命令)
10. [参考文档](#10-参考文档)

---

## 1. Store 分层定位

### 1.1 在全局分层中的位置

```
src/config/       ← 配置层（零硬编码锚点）
src/core/         ← 核心工具（DataBridge/ACL/EventBus/MemoryCache）
src/data/         ← 数据层（IndexedDB/dataLayer/queryBuilder/types）
src/lib/          ← 库函数（logger/format/errors/utils/derivedCache/withBroadcast）
src/services/     ← 服务层（24 子域）
src/store/        ← 状态层 ← **你在这里**
src/components/   ← 组件层
src/pages/        ← 页面层
src/portal/       ← PortalShell 舱室入口
src/apps/         ← App 分发器
```

### 1.2 Store 层的依赖铁律

| 规则 | 说明 | 违规后果 |
|------|------|----------|
| **只能依赖 `services/` 和 `core/`** | Store 通过 Service 获取数据，禁止直接调用 `dataLayer` / `db` | `audit:layers` 拦截 |
| **只能依赖 `lib/` 白名单基础设施** | `logger`、`eventBus`、`withBroadcast`、`format`、`errors`、`utils`、`derivedCache`、`safeCoerce`、`perf` | 禁止依赖 `lib/` 业务模块 |
| **禁止被 `services/` / `data/` / `core/` 依赖** | Store 层是被消费方，不能反向污染下层 | `audit:layers` 拦截 |
| **禁止在 Store 中写 UI 逻辑** | 如 JSX、DOM 操作、路由跳转 | 分层违规 |

> **数据流铁律**：`外部 API → fetcher → DataBridge.forward() → dataLayer → IndexedDB → services → store → components/pages`。Store 只能读取 services 的结果，**严禁直接操作 IndexedDB**。

---

## 2. 命名规范

### 2.1 文件名

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| **Store 主文件** | `kebab-case` + `Store.ts` | `analysisStore.ts` |
| **派生查询文件** | 同主文件 + `.derived.ts` | `analysisStore.derived.ts` |
| **测试文件** | 同主文件 + `.test.ts` | `analysisStore.test.ts` |
| **Store 内模块** | `kebab-case` | `withBroadcast.ts` |

### 2.2 导出命名

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| **Store Hook** | `use` + `PascalCase` + `Store` | `useAnalysisStore` |
| **State Interface** | `PascalCase` + `State` | `AnalysisState` |
| **派生函数** | `camelCase`（描述性） | `scoreBySymbol`, `topStocks` |
| **Hook 形式派生** | `use` + `camelCase` | `useScoreLevelDistribution` |

> 参见 `../../AGENTS.md` §四："Store: camelCase + `Store` 后缀（如 `analysisStore.ts`）"

---

## 3. Zustand Store 创建模板

### 3.1 标准模板（含 JSDoc、logger、错误处理）

```typescript
/**
 * @module {cabinName}Store
 * @description 【一句话描述 Store 职责】
 * @lifecycle 【@Global / @Session / @Page】
 * @see @/pages/{cabin}/* - 消费方
 * @see @/services/{domain}/{serviceName} - 底层数据服务
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
// import type { SomeType } from '@/data/types'  // 步骤1：类型定义
// import { someService } from '@/services/{domain}/{service}'  // 步骤3：Service 层

const logger = getLogger()

// ============================================================
// Store 接口（State + Actions）
// ============================================================

interface {Cabin}State {
  /** 数据列表 */
  items: SomeType[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null

  // Actions
  /** 加载数据 */
  loadItems: () => Promise<void>
  /** 清空错误 */
  clearError: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  items: [] as SomeType[],
  loading: false,
  error: null as string | null,
}

// ============================================================
// Store 创建
// ============================================================

export const use{Cabin}Store = create<{Cabin}State>((set, get) => ({
  ...initialState,

  loadItems: async () => {
    logger.info('[{cabin}Store] loadItems 开始')
    set({ loading: true, error: null })

    try {
      // TODO(步骤3完成后接入): const result = await someService()
      // if (result.success && result.data) {
      //   set({ items: result.data, loading: false })
      //   logger.info(`[{cabin}Store] loadItems 完成: ${result.data.length} 条`)
      // } else {
      //   const message = result.error ?? '加载失败'
      //   logger.error(`[{cabin}Store] loadItems 失败: ${message}`)
      //   set({ loading: false, error: message })
      // }

      // TODO: 占位实现，步骤3完成后替换为真实 Service 调用
      set({ loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败'
      logger.error(`[{cabin}Store] loadItems 异常: ${message}`)
      set({ loading: false, error: message })
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))

// ============================================================
// 派生查询导出（从 .derived.ts 统一导出）
// 设计原则：派生查询独立函数模式，通过 getState() 访问状态，不存入 State
// ============================================================
export * from './{cabin}Store.derived'
```

### 3.2 模板关键约定

| 约定 | 说明 | 强制 |
|------|------|------|
| **JSDoc `@module`** | 每文件顶部必须标注模块名和职责 | ? |
| **JSDoc `@lifecycle`** | 标注生命周期：`@Global`（全局单例）、`@Session`（会话级）、`@Page`（页面级） | 推荐 |
| **`logger.info` 前缀** | 格式：`[storeName] actionName 状态`，如 `[analysisStore] loadStocks 开始` | ? |
| **错误日志含 context** | `logger.error('操作失败', { error: message })` 或字符串插值 | ? |
| **`try/catch` 包裹** | 所有 async Action 必须包裹，set 到 `error` 状态 | ? |
| **初始状态常量** | 提取 `initialState` 便于重置和测试 | 推荐 |
| **类型断言** | 数组初始值用 `as T[]` 避免类型推断为 `never[]` | ? |

---

## 4. withBroadcast 跨 Tab 广播

### 4.1 为什么需要广播

V9 支持多 Tab 同时打开。当用户在一个 Tab 中修改数据（如评分、持仓、订单），其他 Tab 需要自动刷新以保持一致性。

### 4.2 广播机制

- **实现位置**：`@/lib/withBroadcast`（原 `@/store/helpers/withBroadcast` 已废弃，新代码必须使用 `@/lib/withBroadcast`）
- **底层**：`eventBus.emit()`，基于 `EventBus` 实现（详见 `src/lib/eventBus.ts`）
- **事件常量**：`@/constants/store-channels.constants` 的 `EVENT_NAMES`

### 4.3 使用方式

#### 方式 A：直接广播（写操作后触发）

```typescript
import { withBroadcast } from '@/lib/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'

// 在 Store 的 Action 中，set 完成后广播
addItem: (item) => {
  set((s) => ({ items: [...s.items, item] }))
  withBroadcast(EVENT_NAMES.STOCK_POOL_CHANGED, { action: 'add', symbol: item.symbol })
}
```

#### 方式 B：createBroadcaster（减少样板代码）

```typescript
import { createBroadcaster } from '@/lib/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'

const broadcastPool = createBroadcaster(EVENT_NAMES.STOCK_POOL_CHANGED)

addItem: (item) => {
  set((s) => ({ items: [...s.items, item] }))
  broadcastPool({ action: 'add', symbol: item.symbol })
}
```

### 4.4 事件命名规范

```typescript
// ? 从 EVENT_NAMES 常量引用
EVENT_NAMES.STOCKS_CHANGED
EVENT_NAMES.SCORES_CHANGED
EVENT_NAMES.HOLDINGS_CHANGED

// ? 禁止硬编码字符串字面量
'pool:changed'  // 不一致，难以追踪
```

### 4.5 订阅方（跨 Tab 接收广播）

```typescript
import { useEffect } from 'react'
import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { useSomeStore } from '@/store/someStore'

function useCrossTabSync() {
  useEffect(() => {
    const handleChange = (payload: unknown) => {
      const { action } = payload as { action: string }
      logger.info('[CrossTab] 收到广播事件', { action })
      // 刷新 Store 数据
      useSomeStore.getState().loadItems()
    }

    eventBus.subscribe(EVENT_NAMES.STOCK_POOL_CHANGED, handleChange)
    return () => eventBus.unsubscribe(EVENT_NAMES.STOCK_POOL_CHANGED, handleChange)
  }, [])
}
```

> **清理铁律**：所有 `EventBus.subscribe()` 必须配对 `EventBus.unsubscribe()`，在 `useEffect` cleanup 或组件卸载时执行。参见 `../../AGENTS.md` §三「事件监听清理」标准模板。

---

## 5. 派生查询（.derived.ts）

### 5.1 设计原则

派生查询（Derived Queries）是**纯函数**，从 Store 状态计算派生值，不修改状态。遵循以下原则：

1. **纯函数**：通过 `useStore.getState()` 访问状态，不调用 `set()`
2. **性能优化**：使用 `memoizeByRef` 缓存无参数派生，使用 `buildIndex` 优化 O(n) 查找
3. **空状态安全**：空数据时返回合理默认值（如 `[]`、`0`、`null`）
4. **不引入循环依赖**：仅依赖目标 Store 和 `lib/derivedCache`

### 5.2 文件结构

```typescript
// {storeName}.derived.ts

import { use{Store} } from '@/store/{storeName}'
import { memoizeByRef, buildIndex, safeLength } from '@/lib/derivedCache'

// ============================================================
// 类型定义
// ============================================================
export interface SomeDistribution { /* ... */ }

// ============================================================
// 基础聚合（无参数，使用 memoizeByRef）
// ============================================================
export function isItemsEmpty(): boolean {
  return use{Store}.getState().items.length === 0
}

export function itemsCount(): number {
  return safeLength(use{Store}.getState().items)
}

// ============================================================
// 筛选与查找（buildIndex 优化）
// ============================================================
export function itemById(id: string): SomeType | undefined {
  return use{Store}.getState().items.find(i => i.id === id)
}

// ============================================================
// 聚合统计（memoizeByRef 缓存）
// ============================================================
export const someDistribution = memoizeByRef((items: readonly SomeType[]): SomeDistribution => {
  // 计算逻辑
}, 'someDistribution')

export function getSomeDistribution(): SomeDistribution {
  return someDistribution(use{Store}.getState().items)
}

// ============================================================
// React Hook 形式（组件订阅自动刷新）
// ============================================================
export function useSomeDistribution(): SomeDistribution {
  const items = use{Store}(state => state.items)
  return someDistribution(items)
}
```

### 5.3 统一导出

所有派生查询在 `src/store/derived.index.ts` 中统一导出，UI 组件按需要导入：

```typescript
// src/store/derived.index.ts
export { useSomeDistribution, itemById } from '@/store/{storeName}.derived'
```

> **TODO**：新增 Store 派生后，必须同步更新 `derived.index.ts` 导出。详见 `src/store/derived.index.ts` 现有模式。

---

## 6. 新 Store 创建 Checklist（四步集成）

新 Store 必须按以下四步顺序创建，每步可独立回滚。参见 `../../AGENTS.md` §二。

### 步骤 1：类型定义（`src/types/` 或 `src/data/types.ts`）

- [ ] 定义 Store 管理的**数据结构 Interface**（如 `SomeData`、`SomeDataState`）
- [ ] 定义 Action 的**参数类型**（如 `LoadOptions`、`FilterParams`）
- [ ] 如果涉及 Service 返回结果，定义 `Result<T>` 类型或复用现有 `ServiceResult<T>`
- [ ] 运行 `npx tsc --noEmit` 验证类型安全

### 步骤 2：Store/状态（`src/store/{storeName}.ts`）

- [ ] 使用 §3 标准模板创建 Store
- [ ] 命名规范：`use{PascalCase}Store`
- [ ] 初始状态提取为 `initialState` 常量
- [ ] 所有 Action 包裹 `try/catch`，错误写入 `error` 状态
- [ ] 核心分支（数据加载、状态变更）打印 `logger.info`
- [ ] 写操作后调用 `withBroadcast` 广播变更事件（如需要跨 Tab 同步）
- [ ] 创建对应的 `{storeName}.derived.ts` 派生查询文件（§5）
- [ ] 在 `derived.index.ts` 中注册导出
- [ ] 运行 `npx tsc --noEmit` 验证类型安全

### 步骤 3：Service/适配层（`src/services/{domain}/`）

- [ ] 创建或复用 Service 获取数据
- [ ] Service 通过 `DataBridge.forward()` 或 `dataBridge.query()` 与数据层交互
- [ ] **禁止 Service 直接写 `db` / `dataLayer`**（必须通过 `DataBridge`）
- [ ] Service 返回标准 `Result<T>` 结构（含 `success`/`data`/`error`）
- [ ] 运行 `npx tsc --noEmit` 验证类型安全

### 步骤 4：核心集成（`src/pages/` 或 `src/components/`）

- [ ] UI 组件**仅通过 `use{Store}()` 和 `derived.index.ts` 获取数据**
- [ ] 禁止直接调用 `dataLayer` / `db` / `DataBridge`
- [ ] 禁止直接调用 Service（必须通过 Store Action）
- [ ] 组件卸载时清理 EventBus 订阅（如使用 `eventBus.subscribe`）
- [ ] 运行 `npx tsc --noEmit` 验证类型安全

### 四步完成后验证

```powershell
# 类型检查
npx tsc --noEmit

# 分层调用审计
npm run audit:layers
# 期望：0 violations, 0 warnings

# 颜色硬编码审计
npm run audit:hardcode
# 期望：0 hardcoded colors
```

---

## 7. Store 注册与测试要求

### 7.1 Store 注册（无需显式注册表）

V9 的 Store 采用**按需导入**模式，无需在全局注册表中注册。但新增 Store 必须满足：

| 检查项 | 要求 | 验证方式 |
|--------|------|----------|
| **文件位置** | `src/store/` 根目录 | 目录扫描 |
| **命名合规** | `kebab-case` + `Store.ts` | `audit:layers` 命名检查 |
| **导出命名** | `usePascalCaseStore` | 代码评审 |
| **derived 文件** | 同目录 `.derived.ts` | 文件存在性检查 |
| **测试文件** | 同目录 `.test.ts` | 文件存在性检查 |
| **derived.index.ts 导出** | 在 `derived.index.ts` 中统一导出 | 代码评审 |
| **事件常量** | 新增广播事件需加入 `EVENT_NAMES` | 常量文件检查 |

### 7.2 测试要求

每个 Store 必须包含 `.test.ts` 单元测试，覆盖以下场景：

| 测试场景 | 说明 | 示例 |
|----------|------|------|
| **初始状态** | 验证 `initialState` 正确 | `expect(store.loading).toBe(false)` |
| **Action 成功** | 模拟 Service 成功响应 | 验证状态更新正确 |
| **Action 失败** | 模拟 Service 失败/异常 | 验证 `error` 状态被设置 |
| **加载状态流转** | `loading: true → false` | 验证中间状态 |
| **派生查询** | 验证 `.derived.ts` 函数 | 空数据、单条、多条场景 |
| **并发锁** | 如使用 `isRefreshing` 防重入 | 验证重复调用被跳过 |
| **快照回滚** | 如失败恢复旧数据 | 验证数据未被污染 |

### 7.3 测试模板

```typescript
// {storeName}.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { use{Store} } from './{storeName}'

// 隔离 Store 状态：每个测试前重置
beforeEach(() => {
  use{Store}.setState(use{Store}.getState(), true) // 或调用 reset 方法
})

describe('{storeName}', () => {
  it('初始状态正确', () => {
    const state = use{Store}.getState()
    expect(state.items).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loadItems 成功更新状态', async () => {
    // TODO: mock Service 调用
  })

  it('loadItems 失败设置 error', async () => {
    // TODO: mock Service 失败
  })
})
```

> **TODO**：待测试组补充完整的 mock Service 示例和 `derivedCache` 测试指南。

---

## 8. 常见反模式

### 8.1 分层违规（Critical）

| 反模式 | 错误代码 | 正确做法 |
|--------|----------|----------|
| **Store 直接写 db** | `import { db } from '@/data/db'; db.put(...)` | 通过 Service → `DataBridge.forward()` |
| **Store 依赖 dataLayer** | `import { queryBuilder } from '@/data/queryBuilder'` | 通过 Service 封装查询逻辑 |
| **Store 依赖 UI 层** | `import { SomePage } from '@/pages/...'` | Store 零 UI 依赖 |
| **Store 引入 JSX** | 在 Store 中渲染 `<Component />` | 纯状态逻辑，无 JSX |
| **组件直接调用 DataBridge** | `useEffect(() => dataBridge.query(...), [])` | 组件 → Store Action → Service → DataBridge |

### 8.2 状态管理违规（Major）

| 反模式 | 错误代码 | 正确做法 |
|--------|----------|----------|
| **派生状态存入 State** | `set({ derivedCount: items.length })` | 使用 `.derived.ts` 纯函数计算 |
| **State 中存函数** | `set({ computed: () => ... })` | 派生函数在 `.derived.ts` 中定义 |
| **不重置初始状态** | 测试间状态泄漏 | 每个测试前 `setState(initialState)` |
| **无错误状态** | `catch` 中只 `console.log` | 设置 `error: string \| null` 状态 |
| **无加载状态** | async 操作不暴露 `loading` | 提供 `loading` + `set({ loading: true/false })` |

### 8.3 广播与事件违规（Major）

| 反模式 | 错误代码 | 正确做法 |
|--------|----------|----------|
| **硬编码事件名** | `withBroadcast('myEvent', ...)` | `withBroadcast(EVENT_NAMES.SOME_CHANGED, ...)` |
| **广播失败阻断写操作** | `withBroadcast` 抛异常导致数据未写入 | 见 `withBroadcast` 实现：catch 并 log，不阻断 |
| **订阅不清理** | `eventBus.subscribe(...)` 无 `unsubscribe` | `useEffect` cleanup 或组件卸载时清理 |
| **自激循环** | Store 订阅自己发出的事件再次触发 Action | 订阅时过滤 `source`（见 `signalStore.ts` 示例） |

### 8.4 日志与错误规范（Minor）

| 反模式 | 错误代码 | 正确做法 |
|--------|----------|----------|
| **日志前缀不统一** | `console.log('loaded')` | `logger.info('[storeName] actionName 状态')` |
| **错误不含 context** | `logger.error('失败')` | `logger.error('失败', { error: message })` |
| **使用 `console.log`** | `console.log(...)` | `import { getLogger } from '@/lib/logger'` |

---

## 9. 验证命令

新增或修改 Store 后，必须执行以下验证：

```powershell
# 1. 类型检查
npx tsc --noEmit

# 2. 分层调用审计（重点：Store 是否违规依赖 dataLayer / pages / components）
npm run audit:layers
# 期望：0 violations, 0 warnings

# 3. 单元测试（Store 级）
npm test -- --run src/store/{storeName}.test.ts
# 期望：全部通过

# 4. 全量测试（阶段性提交前）
npm test -- --run
# 期望：全部通过

# 5. 生产构建（最终验证）
npm run build
# 期望：0 errors
```

---

## 10. 参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| **AGENTS.md** | `../../AGENTS.md` | 工程分层契约（§一、§二、§四、§八） |
| **全局架构总览** | `../explanation/overview.md` | 分层架构与数据流 |
| **舱室总览** | `../explanation/cabins-overview.md` | 5 大舱页面清单 |
| **服务目录** | `../reference/services-catalog.md` | 24 服务子域目录 |
| **引擎规格** | `../reference/05-engine-specs.md` | L0-L8 引擎分层 |
| **路由规格** | `../reference/06-routing-specs.md` | 路由注册规则 |
| **编码规范** | `../reference/coding-conventions.md` | 代码风格 |
| **JSDoc 规范** | `../reference/jsdoc-convention.md` | JSDoc 注释标准 |
| **复杂度治理** | `../reference/complexity-governance.md` | 函数长度/嵌套深度 |
| **how-to-add-store** | `../how-to/how-to-add-store.md` (P1) | 面向新手的简化版指南 |
| **withBroadcast 实现** | `../../src/lib/withBroadcast.ts` | 广播工具源码 |
| **EVENT_NAMES 常量** | `../../src/constants/store-channels.constants.ts` | 广播事件常量 |
| **derived.index.ts** | `../../src/store/derived.index.ts` | 派生查询统一导出 |
| **analysisStore 示例** | `../../src/store/analysisStore.ts` | 完整 Store 示例 |
| **signalStore 示例** | `../../src/store/signalStore.ts` | 含 DataBridge 订阅示例 |
| **analysisStore.derived** | `../../src/store/analysisStore.derived.ts` | 派生查询完整示例 |

---

## 附录 A：Store 生命周期标注

| 标注 | 说明 | 示例 Store |
|------|------|-----------|
| `@Global` | 全局单例，应用生命周期内存在 | `analysisStore`、`signalStore` |
| `@Session` | 会话级，登录/退出时重置 | `portfolioStore`、`holdingsStore` |
| `@Page` | 页面级，路由切换时清理 | `collectionWizardStore` |

> **TODO**：待架构组扩写生命周期管理与自动清理策略（如 `@Page` Store 的路由离开重置机制）。

## 附录 B：Store 与 IndexedDB 的间接关系

Store **不直接**操作 IndexedDB，而是通过以下链路间接交互：

```
Store Action
  → Service（如 analysisService.ts）
    → DataBridge.forward() / dataBridge.query()
      → dataLayer / queryBuilder
        → IndexedDB
```

新增 Store 如需持久化数据，需同步检查：

- [ ] `src/config/dbConfig.ts` 中 `STORE_NAME` 是否包含对应 store 名称
- [ ] `src/config/dbConfig.ts` 中 `ACL_MATRIX` 是否配置 read/write 白名单
- [ ] `src/data/db-schema.ts` 中 `createSchema` 是否创建该 store（基线）或 Migration 中创建（增量）
- [ ] `DB_VERSION` 是否已递增（如为增量 store）

> 参见 `../../AGENTS.md` §八（数据库版本管理）。

---

_本文档基于 `../../AGENTS.md` v1.4.3 编写。当 `../../AGENTS.md` 版本升级时，需同步修订本文档。_
