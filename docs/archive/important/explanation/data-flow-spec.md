---
doc_id: V9-DOC-EXP-927
title: "V9 数据流规范"
domain: exp
status: active
last_updated: 2026-08-15
---

# V9 数据流规范

> 版本：v0.9.14 P6-DATA
> 状态：生效中
> 最后更新：2026-06-30

## 1. 数据流向原则

### 1.1 单向数据流

```
Store → 组件（selector 读取）→ 用户交互 → Action → Store
     ↑                                                  │
     └────────────── Service / Hook ────────────────────┘
```

1. **单向性**：数据只能从 Store 流向组件，不能反向直接修改
2. **可追踪**：所有状态变更必须通过 action 发起，便于调试和追溯
3. **可预测**：相同的输入（action + 当前状态）产生相同的输出（新状态）

### 1.2 核心禁令

| 编号 | 禁令 | 违规等级 | 说明 |
|------|------|---------|------|
| DF-001 | 组件直接修改 Store 状态 | 高 | 必须通过 action 修改 |
| DF-002 | 组件直接调用 Service 层 API | 中 | 必须通过 Hook 或 action 中转 |
| DF-003 | Store 直接引用其他 Store 的内部状态 | 中 | 必须通过 selector 或中间层 |
| DF-004 | 异步数据缺少三态管理 | 中 | 必须有 loading / data / error 三态 |
| DF-005 | Service 层直接操作 Store | 高 | Service 只负责数据获取和转换 |

### 1.3 异步数据三态

所有异步数据必须具备完整三态：

```typescript
interface AsyncState<T> {
  loading: boolean
  data: T | null
  error: Error | null
}
```

- **loading**：数据加载中，用于展示骨架屏/加载动画
- **data**：加载成功的数据
- **error**：加载失败的错误信息

## 2. Store 分层架构

### 2.1 三层模型

```
┌─────────────────────────────────────────┐
│  L3: UI Store                            │  UI 状态管理
│  (pageStore, widgetStore, ...)          │
├─────────────────────────────────────────┤
│  L2: 组合 Store                          │  组合多个领域 Store
│  (analysisStore, tradingStore, ...)     │
├─────────────────────────────────────────┤
│  L1: 领域 Store                          │  纯数据 + 业务 action
│  (newsStore, holdingsStore, poolStore, ...)  │
└─────────────────────────────────────────┘
```

### 2.2 L1 - 领域 Store

**职责**：管理单一领域的数据状态和业务操作

**规范**：
- 命名：`<domain>Store`（如 `newsStore`, `holdingsStore`, `poolStore`）
- 纯数据 + 业务 action，不包含 UI 状态
- 不直接引用其他领域 Store
- 提供细粒度的 selector 供上层使用

**示例清单**：
- `newsStore` - 资讯数据
- `holdingsStore` - 持仓数据
- `poolStore` - 股票池数据
- `marketDataStore` - 行情数据
- `scoreDocStore` - 评分文档数据

### 2.3 L2 - 组合 Store

**职责**：组合多个 L1 领域 Store，提供跨领域的业务逻辑

**规范**：
- 命名：`<feature>Store`（如 `analysisStore`, `tradingStore`）
- 通过 selector 读取 L1 Store 数据
- 不持有独立的数据源，所有数据来源于 L1
- 提供跨领域的复合 action

**示例清单**：
- `analysisStore` - 分析页面组合状态
- `tradingStore` - 交易页面组合状态
- `dualStrategyStore` - 双策略组合状态

### 2.4 L3 - UI Store

**职责**：管理 UI 相关的状态，与业务数据分离

**规范**：
- 命名：`<ui-scope>Store`（如 `pageStore`, `widgetStore`）
- 只管理 UI 状态（展开/折叠、选中项、分页等）
- 不包含业务数据
- 生命周期与 UI 组件绑定

**示例清单**：
- `pageStore` - 页面级 UI 状态
- `widgetStore` - Widget 布局/显隐状态
- `commandStore` - 命令面板状态

### 2.5 Store 间通信规则

| 通信方向 | 允许方式 | 禁止方式 |
|---------|---------|---------|
| L2 → L1 | selector 读取 + action 调用 | 直接读取 state 属性 |
| L3 → L2 | selector 读取 | 直接修改 state |
| L3 → L1 | 通过 L2 间接访问 | 直接访问 L1 |
| L1 → L1 | 通过 action 回调 / 事件总线 | 直接 import 其他 store |

## 3. 服务层（Service）规范

### 3.1 职责边界

**Service 层负责**：
- 数据获取（API 调用、本地存储读取）
- 数据转换（DTO → 领域模型）
- 数据校验
- 错误处理（抛出标准化错误）

**Service 层不负责**：
- 不直接操作 Store 状态
- 不管理 UI 状态
- 不持有全局状态

### 3.2 接口规范

```typescript
// Service 函数返回 Promise，错误通过 throw 抛出
async function fetchNews(params: NewsParams): Promise<NewsData> {
  const response = await api.get('/news', { params })
  if (!response.ok) {
    throw new ServiceError('NEWS_FETCH_FAILED', response.error)
  }
  return transformNewsDTO(response.data)
}
```

### 3.3 错误处理

- Service 层捕获底层错误，抛出业务语义化的错误
- 错误包含：错误码（code）、错误消息（message）、原始错误（cause）
- 调用方（Store action 或 Hook）负责处理错误并更新状态

## 4. Hook 层规范

### 4.1 职责边界

**自定义 Hook 负责**：
- 组合 Store selector 和 Service 调用
- 封装组件的数据获取逻辑
- 提供数据和回调函数给组件使用

**Hook 不负责**：
- 不持有自己的状态（使用 Store 管理状态）
- 不直接渲染 UI
- 不包含复杂的业务逻辑（委托给 Service 或 Store action）

### 4.2 Hook 分类

| 类型 | 命名 | 职责 |
|------|------|------|
| 页面 Hook | `use<PageName>Page` | 组合页面所需的所有数据和操作 |
| 功能 Hook | `use<Feature>` | 封装特定功能的逻辑 |
| 工具 Hook | `use<Utility>` | 通用工具逻辑（如 `useDebounce`） |

### 4.3 页面 Hook 示例

```typescript
// 页面 Hook：组合 Store + Service
function useIndustryScorePage() {
  // 从 Store 读取数据（通过 selector）
  const { data, loading, error } = useIndustryScoreStore(
    state => state.scoreData
  )
  const refresh = useIndustryScoreStore(
    state => state.actions.refresh
  )
  
  // 提供给组件的回调
  const handleRefresh = useCallback(async () => {
    await refresh()
  }, [refresh])
  
  return {
    data,
    loading,
    error,
    refresh: handleRefresh,
  }
}
```

## 5. 组件层规范

### 5.1 数据流约束

| 操作 | 允许方式 | 禁止方式 |
|------|---------|---------|
| 读取数据 | 通过 selector 读取 Store | 直接访问 store.getState() |
| 修改状态 | 调用 Store action | 直接修改 state 属性 |
| 获取数据 | 通过 Hook 获取 | 直接调用 Service |
| 触发异步 | 调用 Hook 回调 / Store action | 组件内直接 fetch |

### 5.2 组件分类

| 类型 | 职责 | 数据来源 |
|------|------|---------|
| 页面组件 | 页面容器，组合数据和子组件 | Hook |
| 容器组件 | 业务逻辑封装，数据装配 | Store selector + action |
| 展示组件 | 纯 UI 渲染，无业务逻辑 | Props |
| UI 基础组件 | 通用 UI 原子组件 | Props |

### 5.3 selector 使用规范

```typescript
// ✅ 正确：使用细粒度 selector
const scoreData = useScoreStore(state => state.scoreData)
const loading = useScoreStore(state => state.loading)

// ❌ 避免：整个 state 订阅
const state = useScoreStore() // 导致不必要的重渲染
```

## 6. 数据流违规整改计划

### 6.1 当前违规统计（基线 v0.9.14）

| 违规类型 | 违规编号 | 数量 | 涉及文件 | 优先级 | 计划版本 |
|---------|---------|------|---------|--------|---------|
| 组件直接调用 Service | DF-002 | 6 | HotSectorPage, NewsPage, HoldingsPage, PoolList, PoolBoard, InputDashboard | 中 | v0.9.15 |
| Store 跨 Store 直接访问 | DF-003 | 2 | dualStrategyStore, positionStore | 中 | v0.9.16 |
| 组件直接修改 Store | DF-001 | 0 | - | 高 | v0.9.15 |
| Service 层直接操作 Store | DF-005 | 0 | - | 高 | v0.9.15 |
| 异步数据缺三态 | DF-004 | 待统计 | - | 中 | v0.9.16 |

### 6.2 整改优先级

1. **P0**：组件直接修改 Store 状态（可能导致数据不一致）
2. **P1**：Service 层直接操作 Store（架构违规）
3. **P2**：组件直接调用 Service（架构违规，影响可测试性）
4. **P3**：Store 跨 Store 直接访问（耦合问题）
5. **P4**：异步数据缺三态（用户体验问题）

## 7. 相关文档

- [V9 数据宪法](../../normal/reference/V9数据宪法.md)
- [数据流引擎规范](../dataflow-engine-spec.md)
- [双策略数据流规范](../../../explanation/design/dual-strategy-dataflow-spec.md)
- [数据交互协议](../../normal/explanation/data-interaction-protocols.md)
- [Widget 错误处理](../../../reference/widget-error-handling.md)
