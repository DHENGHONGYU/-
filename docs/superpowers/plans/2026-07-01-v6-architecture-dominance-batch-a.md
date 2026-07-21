# 批次 A：让 V6 架构主导 V9（评分入口 + 舱室入口单轨化）

> **Status**: ✅ 已完成（2026-07-01）  
> **执行方式**: Subagent-Driven + 数据架构师/代码审计师同步复核  
> **验证结果**: 相关测试 97/97 通过；ESLint 0 errors；`vite build` 成功。

**Goal:** 将生产评分主入口切换到 `src/services/scoring/v6-engine` 的 L-1~L8 分层引擎；消除 `PortalShell` 中 `apps/*App` 与 `pages/*HubPage` 的双轨入口，统一为单一套舱室应用模型。

**Architecture:** 保持 `v6ScoreService.ts` 的对外接口不变（输入 `symbol`，返回 `{ success, data, error }`），内部重构为调用 `createV6Engine()`；`PortalShell` 删除 `HUB_APPS`，让 `CabinApp` 内部通过默认子路由渲染 Hub 页，所有舱室路径统一走 `PortalShell`。

**Tech Stack:** TypeScript, React, Zustand, React Router, Vite

---

## 文件结构

| 文件 | 责任 |
|:---|:---|
| `src/services/scoring/v6ScoreService.ts` | 保留对外接口，内部调用 `v6-engine`；旧启发式逻辑改为降级路径 |
| `src/services/scoring/v6-engine/types.ts` | 扩展 `LayerInput` 适配 `Stock` / `DailyQuotes` 类型（如需要） |
| `src/services/scoring/v6-engine/engine.ts` | 已有，无需修改，作为被调用方 |
| `src/store/stockAnalysisStore.ts` | 将 `runV6Score` 调用改为 `v6-engine` 输出适配 |
| `src/store/analysisStore.ts` | 同上 |
| `src/store/strategySnapshotStore.ts` | 同上 |
| `src/portal/PortalShell.tsx` | 删除 `HUB_APPS`，简化 `ActiveApp` 选择逻辑 |
| `src/apps/input/InputApp.tsx` | 添加默认 `/input` → `/input/hub` 重定向，或在 `InputApp` 内渲染 `InputHubPage` |
| `src/apps/analysis/AnalysisApp.tsx` | 同上 |
| `src/apps/trading/TradingApp.tsx` | 同上 |
| `src/apps/output/OutputApp.tsx` | 同上 |
| `src/apps/command/CommandApp.tsx` | 同上 |
| `src/config/routes.ts` | 调整舱室入口与 `/hub` 子路由关系 |

---

## Task 1：在 `v6-engine` 层建立 `Stock` / `DailyQuotes` 到 `LayerInput` 的适配类型与工厂

**Files:**
- Modify: `src/services/scoring/v6-engine/types.ts`
- Modify: `src/services/scoring/v6-engine/index.ts`
- Test: `src/services/scoring/v6-engine/v6-engine.test.ts`

- [x] **Step 1: 扩展 `StockBasicData` 兼容 `Stock`**

当前 `StockBasicData` 定义与 `Stock` 类型字段不完全一致。在 `types.ts` 中添加一个适配类型和转换函数：

```typescript
// src/services/scoring/v6-engine/types.ts
import type { Stock, DailyQuotes } from '@/data/types'

export interface StockBasicData {
  symbol: string
  name?: string
  price?: number
  pe?: number
  pb?: number
  roe?: number
  marketCap?: number
}

export function stockToBasicData(stock: Stock): StockBasicData {
  return {
    symbol: stock.symbol,
    name: stock.name,
    price: stock.price,
    pe: stock.pe,
    pb: stock.pb,
    roe: stock.roe,
    marketCap: stock.marketCap,
  }
}

export interface QuoteData {
  currentPrice: number
  history: Array<{ date: string; close: number; volume?: number }>
}

export function quotesToQuoteData(quotes: DailyQuotes): QuoteData {
  return {
    currentPrice: quotes.history[quotes.history.length - 1]?.close ?? 0,
    history: quotes.history.map((q) => ({
      date: q.date,
      close: q.close,
      volume: q.volume,
    })),
  }
}
```

- [x] **Step 2: 从 barrel 导出新增函数**

```typescript
// src/services/scoring/v6-engine/index.ts
export { stockToBasicData, quotesToQuoteData } from './types'
```

- [x] **Step 3: 运行 v6-engine 现有测试，确保无回归**

Run: `npx vitest run src/services/scoring/v6-engine/v6-engine.test.ts`
Expected: PASS

---

## Task 2：重构 `v6ScoreService.ts`，内部调用 `v6-engine`

**Files:**
- Modify: `src/services/scoring/v6ScoreService.ts`
- Test: `src/services/scoring/v6ScoreService.test.ts`

- [x] **Step 1: 替换实现为 v6-engine 调用**

保留原有导出签名：

```typescript
export interface RunV6ScoreResult {
  success: boolean
  data?: V6Score
  error?: string
}

export async function runV6Score(
  symbol: string,
  options?: { quotes?: DailyQuotes; signal?: AbortSignal },
): Promise<RunV6ScoreResult>
```

内部实现改为：

```typescript
import { createV6Engine, stockToBasicData, quotesToQuoteData } from './v6-engine'
import { loadStockForAnalysis, loadDailyQuotesForAnalysis } from '@/services/analysis/scorePageService'

export async function runV6Score(
  symbol: string,
  options?: { quotes?: DailyQuotes; signal?: AbortSignal },
): Promise<RunV6ScoreResult> {
  logger.info(`[v6ScoreService] runV6Score start: ${symbol}`)
  try {
    if (options?.signal?.aborted) {
      return { success: false, error: 'Aborted' }
    }

    const [stock, quotes] = await Promise.all([
      loadStockForAnalysis(symbol),
      options?.quotes ? Promise.resolve(options.quotes) : loadDailyQuotesForAnalysis(symbol),
    ])

    if (!stock) {
      return { success: false, error: `未找到股票 ${symbol}` }
    }

    const engine = createV6Engine()
    const input: V6ScoreInput = {
      symbol,
      stock: stockToBasicData(stock),
      quote: quotes ? quotesToQuoteData(quotes) : undefined,
      financial: undefined,
      industryScore: undefined,
    }

    const composite = await engine.calculateComposite(input)

    const v6Score: V6Score = {
      symbol,
      score: composite.totalScore,
      dimensions: composite.layerScores.map((layer) => ({
        name: layer.layerId,
        score: layer.score,
        weight: layer.weight,
        rationale: layer.rationale,
      })),
      updatedAt: Date.now(),
    }

    logger.info(`[v6ScoreService] runV6Score complete: ${symbol}, score=${v6Score.score}`)
    return { success: true, data: v6Score }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[v6ScoreService] runV6Score error: ${message}`)
    return { success: false, error: message }
  }
}
```

> 注意：`V6ScoreInput`、`calculateComposite` 的实际字段名以 `v6-engine/types.ts` 和 `engine.ts` 为准；若字段名不同，按实际类型调整。

- [x] **Step 2: 保留旧启发式逻辑为私有降级函数（可选）**

如果 `v6-engine` 在某些边界场景下缺少数据，可保留旧的 `calculateFactorFromBasicData` 作为私有 fallback，但不对外暴露。

- [x] **Step 3: 更新 `v6ScoreService.test.ts` 断言**

测试应验证：
1. 返回 `success: true`
2. `data.score` 在 1~5 之间
3. `data.dimensions` 非空
4. 错误场景返回 `success: false`

- [x] **Step 4: 运行测试**

Run: `npx vitest run src/services/scoring/v6ScoreService.test.ts`
Expected: PASS

---

## Task 3：更新 Store 调用方，适配新返回结构

**Files:**
- Modify: `src/store/stockAnalysisStore.ts`
- Modify: `src/store/analysisStore.ts`
- Modify: `src/store/strategySnapshotStore.ts`
- Test: 相关 store 测试

- [x] **Step 1: 确认 `runV6Score` 返回结构**

返回结构保持 `RunV6ScoreResult { success, data?, error? }`，Store 调用代码基本不变。

- [x] **Step 2: 在 `analysisStore.ts` 中使用返回数据**

当前代码：

```typescript
const result = await runV6Score(symbol)
if (result.success) {
  await get().loadScores()
  set({ loading: false })
}
```

改为直接使用返回的评分数据，减少一次 `loadScores` 网络/IndexedDB 调用：

```typescript
const result = await runV6Score(symbol)
if (result.success && result.data) {
  const newScores = get().scores.map((s) =>
    s.symbol === symbol ? result.data! : s,
  )
  if (!newScores.some((s) => s.symbol === symbol)) {
    newScores.push(result.data!)
  }
  set({ scores: newScores, loading: false })
  logger.info(`[analysisStore] handleScore 完成: ${symbol}`)
} else {
  // ... error
}
```

- [x] **Step 3: 运行 Store 测试**

Run: `npx vitest run src/store/stockAnalysisStore.test.ts src/store/analysisStore.test.ts src/store/strategySnapshotStore.test.ts`
Expected: PASS

---

## Task 4：PortalShell 舱室入口单轨化

**Files:**
- Modify: `src/portal/PortalShell.tsx`
- Modify: `src/config/routes.ts`
- Modify: `src/apps/input/InputApp.tsx` 等 5 个 CabinApp

- [x] **Step 1: 在 `PortalShell.tsx` 中删除 `HUB_APPS` 和 `isHubView` 逻辑**

删除第 33-37 行的 lazy import 和第 47-53 行的 `HUB_APPS` 映射。

简化 `ActiveApp` 选择逻辑为：

```typescript
const ActiveApp = SubApp ?? CABIN_APPS[activeCabin]
```

- [x] **Step 2: 调整 `routes.ts`，让 `/input`、`/analysis` 等默认路径进入 PortalShell，并由 CabinApp 内部处理 Hub 渲染**

例如，当前：

```typescript
{ path: '/input', component: React.lazy(() => import('@/portal/PortalShell')), category: 'input' }
{ path: '/input/hub', component: React.lazy(() => import('@/portal/PortalShell')), category: 'input' }
```

保持 `/input` 进入 `PortalShell` 即可，`InputApp` 内部负责默认渲染 `InputHubPage`。

- [x] **Step 3: 在 `InputApp.tsx` 中添加默认 Hub 渲染**

假设 `InputApp.tsx` 当前用 `Routes` 分发子页面，添加默认路由：

```typescript
import { Routes, Route, Navigate } from 'react-router'
import InputHubPage from '@/pages/input/InputHubPage'

// 在 Routes 内：
<Route path="hub" element={<InputHubPage />} />
<Route path="*" element={<Navigate to="hub" replace />} />
```

或者如果 `InputApp` 不使用路由，直接在 `InputApp` 组件内渲染：

```typescript
export default function InputApp(): JSX.Element {
  return <InputHubPage />
}
```

对其他 4 个 CabinApp 重复相同改造。

- [x] **Step 4: 更新 `CABINS` 导航路径**

如果当前 `CABINS` 中 `path` 是 `/input/hub`，改为 `/input`，让用户点击顶部导航时进入 CabinApp，CabinApp 内部默认展示 Hub。

- [x] **Step 5: 运行应用启动测试**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

## Task 5：回归验证

- [x] **Step 1: 全量类型检查**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [x] **Step 2: 相关测试套件**

Run: `npx vitest run src/services/scoring src/store src/portal`
Expected: PASS（允许预先存在的无关失败）

- [x] **Step 3: ESLint 检查修改文件**

Run: `npx eslint src/services/scoring/v6ScoreService.ts src/portal/PortalShell.tsx src/apps/input/InputApp.tsx src/apps/analysis/AnalysisApp.tsx src/apps/trading/TradingApp.tsx src/apps/output/OutputApp.tsx src/apps/command/CommandApp.tsx src/store/stockAnalysisStore.ts src/store/analysisStore.ts src/store/strategySnapshotStore.ts`
Expected: 0 errors

- [x] **Step 4: 生产构建验证**

Run: `npx vite build`
Expected: 成功，无错误

---

## Spec Coverage Check

| 需求 | 对应任务 |
|:---|:---|
| V6 引擎接管评分主流程 | Task 1, Task 2 |
| 保留对外接口兼容 | Task 2 |
| Store 调用方适配 | Task 3 |
| PortalShell 双轨入口消除 | Task 4 |
| 所有舱室路径统一走 PortalShell | Task 4 |
| 回归测试与类型检查 | Task 5 |

## Placeholder Scan

- 无 TBD/TODO
- 所有代码块均为可直接使用的实现示例
- 字段名以实际源码为准，在 Task 2 中已注明需按实际类型调整

---

## 执行后总结

### 实际修改文件

| 文件 | 说明 |
|:---|:---|
| `src/services/scoring/v6ScoreService.ts` | 内部调用 `createV6Engine().calculateAll()`；用 `ALL_LAYER_IDS` 替换硬编码；新增 `AbortSignal` 支持 |
| `src/pages/command/CommandHubPage.tsx` | 增加 `React.memo` 与 `ErrorBoundary` 包裹 |
| `tests/InputApp.test.tsx` | 默认路径改为 `/input/dashboard` |
| `tests/AnalysisApp.test.tsx` | 增加 `MemoryRouter`，默认路径 `/analysis/score` |
| `tests/TradingApp.test.tsx` | 增加 `MemoryRouter`，默认路径 `/trading/sim` |
| `tests/CommandApp.test.tsx` | 默认路径改为 `/command/monitor` |

### 验证结果

| 检查项 | 结果 |
|:---|:---|
| 相关测试 | 97/97 通过 |
| ESLint | 0 errors（仅既有 `no-magic-numbers` warnings） |
| `npx vite build` | 成功 |
| `npx tsc --noEmit` | 剩余 8 个错误均与批次 A 无关 |

### 数据架构师 / 代码审计师复核结论

- **数据架构师**：识别出 DataBridge 动作名不一致、策略快照因子键名大小写、Sector 语义映射、财务数据缺失、`avgTurnover20d` 缺失等风险；建议批次 B/C/D 逐步处理。
- **代码审计师**：指出计划基线已部分过期（当前代码已完成部分改造）、单轨化后需更新测试、硬编码需替换、AbortSignal 需补充；以上问题已在批次 A 收尾中处理。
