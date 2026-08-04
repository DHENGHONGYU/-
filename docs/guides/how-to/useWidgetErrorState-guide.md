# useWidgetErrorState Hook 使用指南

## 概述

`useWidgetErrorState` 是 Cockpit Widget 组件的统一错误状态管理 Hook，封装了所有 Widget 共用的视觉状态判定逻辑，消除各组件重复的 if-else 样板代码。

**源码位置**：`src/cockpit/hooks/useWidgetErrorState.ts`

## 核心能力

| 功能 | 说明 |
|------|------|
| 状态判定 | 根据 loading / error / hasData 自动计算 `visualState`（ready / loading / error） |
| 错误格式化 | 当 error 为空但数据不可用时，自动填充 fallback 错误提示 |
| 便捷判断 | 提供 `isError` / `isLoading` / `isReady` 互斥属性 |
| 性能优化 | 内部使用 `useMemo` 缓存计算结果 |

## 状态判定规则

```
error 有值        → 'error'   （显示错误提示 + 重试按钮）
loading=true      → 'loading' （显示骨架屏）
loading=false 且无数据 → 'error'   （接口失败兜底，显示友好提示 + 重试按钮）
有数据            → 'ready'   （正常渲染）
```

> **关键设计**：当 `loading=false` 且无数据时，视为接口失败（即使 error 未被正确设置），显示错误提示而非骨架屏或空状态。这解决了 `marketDataStore` 桥接层 errorMap 未同步的兜底问题。

## API

### 参数

```typescript
interface UseWidgetErrorStateOptions {
  /** 是否正在加载 */
  loading: boolean
  /** 错误信息（来自 errorMap） */
  error: string | null | undefined
  /** 是否有可用数据 */
  hasData: boolean
  /** 当 error 为空但数据不可用时的默认错误提示 */
  fallbackErrorMessage?: string
}
```

### 返回值

```typescript
interface UseWidgetErrorStateResult {
  /** 当前视觉状态，传递给 WidgetStateShell.visualState */
  visualState: 'ready' | 'loading' | 'empty' | 'error'
  /** 格式化后的错误信息（含 fallback），传递给 WidgetStateShell.error */
  displayError: string | null
  /** 便捷判断：是否为错误状态 */
  isError: boolean
  /** 便捷判断：是否为加载状态 */
  isLoading: boolean
  /** 便捷判断：是否为就绪状态 */
  isReady: boolean
}
```

## 使用示例

### 基础用法

```tsx
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { useWidgetErrorState } from '@/cockpit/hooks/useWidgetErrorState'
import { WidgetStateShell } from './components/WidgetStateShell'

function MyWidget({ config }: { config: WidgetConfig }): React.JSX.Element {
  const { data, loadingMap, errorMap, refreshWidget } = useMarketData()
  const myData = data?.myField
  const loading = loadingMap?.[config.instanceId] ?? true
  const error = errorMap?.[config.instanceId]

  const { visualState, displayError } = useWidgetErrorState({
    loading,
    error,
    hasData: !!myData,
    fallbackErrorMessage: '我的数据暂不可用，请检查后端服务或稍后重试',
  })

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={displayError}
      onRetry={() => refreshWidget(config.instanceId)}
      loadingLabel="加载数据中…"
      skeleton={<Skeleton className="h-40" />}
    >
      {/* 正常渲染内容 */}
      <div>{myData.value}</div>
    </WidgetStateShell>
  )
}
```

### 数组类型数据

当数据是数组时，使用 `.length > 0` 判断 `hasData`：

```tsx
const indices = data?.marketIndices ?? []

const { visualState, displayError } = useWidgetErrorState({
  loading,
  error,
  hasData: indices.length > 0,
  fallbackErrorMessage: '大盘行情数据暂不可用，请检查后端服务或稍后重试',
})
```

### 使用便捷判断属性

```tsx
const { isError, isLoading, isReady } = useWidgetErrorState({
  loading,
  error,
  hasData: !!portfolio,
})

if (isLoading) return <CustomSkeleton />
if (isError) return <CustomErrorView />
// isReady 时正常渲染
```

## 已接入的组件

以下 7 个核心 Widget 组件已统一接入此 Hook：

| 组件 | 数据字段 | hasData 判定 | fallbackErrorMessage |
|------|----------|-------------|---------------------|
| PortfolioOverviewWidget | `portfolio` | `!!portfolio` | 持仓数据暂不可用，请检查后端服务或稍后重试 |
| MarketIndicesWidget | `indices` | `indices.length > 0` | 大盘行情数据暂不可用，请检查后端服务或稍后重试 |
| SectorHeatmapWidget | `sectors` | `sectors.length > 0` | 板块热力图数据暂不可用，请检查后端服务或稍后重试 |
| FundFlowWidget | `flows` | `flows.length > 0` | 资金流向数据暂不可用，请检查后端服务或稍后重试 |
| WatchlistWidget | `watchlist` | `watchlist.length > 0` | 自选行情数据暂不可用，请检查后端服务或稍后重试 |
| MarketSentimentWidget | `sentiment` | `!!sentiment` | 市场情绪数据暂不可用，请检查后端服务或稍后重试 |
| AITradeReviewWidget | `tradeReview` | `!!tradeReview` | AI交易复盘数据暂不可用，请检查后端服务或稍后重试 |

## 新组件接入步骤

1. 在组件文件顶部添加 import：

```tsx
import { useWidgetErrorState } from '@/cockpit/hooks/useWidgetErrorState'
```

2. 从 `useMarketData()` 获取 `loadingMap` 和 `errorMap`：

```tsx
const { data, loadingMap, errorMap, refreshWidget } = useMarketData()
const loading = loadingMap?.[config.instanceId] ?? true
const error = errorMap?.[config.instanceId]
```

3. 调用 Hook 替换原有 visualState 逻辑：

```tsx
const { visualState, displayError } = useWidgetErrorState({
  loading,
  error,
  hasData: !!myData,  // 根据实际数据字段调整
  fallbackErrorMessage: 'XX数据暂不可用，请检查后端服务或稍后重试',
})
```

4. 将 `visualState` 和 `displayError` 传递给 `WidgetStateShell`：

```tsx
<WidgetStateShell
  visualState={visualState}
  error={displayError}
  onRetry={() => refreshWidget(config.instanceId)}
  // ...其他 props
>
```

5. 删除原有的 if-else visualState 判定代码。

## 测试

Hook 单元测试位于 `src/cockpit/hooks/useWidgetErrorState.test.ts`，覆盖以下场景：

- 视觉状态判定（error 优先、loading、兜底 error、ready）
- displayError 格式化（原始 error、fallback、默认提示、null）
- 便捷判断属性互斥性

运行测试：

```bash
npx vitest run src/cockpit/hooks/useWidgetErrorState.test.ts --reporter=verbose
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/cockpit/hooks/useWidgetErrorState.ts` | Hook 实现 |
| `src/cockpit/hooks/useWidgetErrorState.test.ts` | Hook 单元测试 |
| `src/cockpit/widgets/components/WidgetStateShell.tsx` | 状态外壳组件（消费 visualState） |
| `src/cockpit/providers/MarketDataProvider.tsx` | 数据提供者（提供 loadingMap / errorMap） |
| `src/store/marketDataStore.ts` | Zustand Store（数据状态持久化） |
