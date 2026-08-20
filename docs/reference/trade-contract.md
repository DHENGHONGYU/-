---
title: trade-contract
type: reference
domain: project
phase: design
tier: important
status: draft
maintainer: 架构组
summary: "定义 trade 子域的接口契约、职责边界、数据流与依赖关系。"
tags: [project, trading, contract, reference, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-109
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-331, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---
covers_code:
  - src/constants/trade.constants.ts
  - src/services/trading/portfolioService.ts


# trade-contract.md — 交易域接口契约

> **定位**：定义 `trade` 子域的接口契约、职责边界、数据流与依赖关系。  
> **Source**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

1. **持仓列表查询**：封装 `/api/v1/trade/holdings` 接口，支持分页、日期范围、交易方向、关键词筛选，内置请求超时（15s）与指数退避重试（最多 2 次）。
2. **交易操作执行**：封装补仓（`ADD_POSITION`）与平仓（`CLOSE_POSITION`）两类操作，通过 POST 请求与后端交互，返回操作成功/失败状态。
3. **持仓数据导出**：生成 CSV 格式持仓数据文件并触发浏览器下载，支持相同的筛选参数。
4. **可观测性事件**：持仓数据加载完成与交易操作完成后，通过 `DataBridge.forward()` 发送标准化 Envelope（`holdingsDataLoaded` / `tradeActionExecuted`），供下游 Store 订阅与日志追踪。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`）；禁止直接调用 `store/`、`pages/`、`components/` |
| 被依赖方 | `store/holdingsStore.ts`（状态层）、`pages/trading/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `constants/trade.constants` | 同层常量供给：枚举、配置、颜色映射 | `constants` → `trade`（只读常量） |
| `core/databridge` | 下游事件投递：通过 `DataBridge.forward()` 发送可观测性事件 | `trade` → `core`（Envelope 投递） |
| `store/holdingsStore` | 下游状态消费：Store 订阅 `DataBridge` 频道并调用本服务函数 | `trade` → `store`（函数调用 + 事件广播） |
| `trading`（页面/业务舱） | 下游 UI 消费：持仓页面通过 Store 间接消费本服务 | `store` → `pages/trading`（状态驱动 UI） |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/types/modules/trade.types.ts

/** 持仓明细项 */
export interface HoldingItem {
  code: string
  name: string
  quantity: number
  currentPrice: number
  avgCost: number
  floatingPnl: number
  floatingPnlPercent: number
  marketValueRatio: number
  strategyId: string
  strategyType: StrategyType
}

/** 持仓列表查询参数 */
export interface HoldingsQueryParams {
  page: number
  pageSize: number
  startDate: string
  endDate: string
  direction: TradeDirection
  keyword: string
}

/** 持仓列表 API 响应数据 */
export interface HoldingsListData {
  total: number
  list: HoldingItem[]
}

/** 统一 API 响应包装 */
export interface HoldingsApiResponse<T = HoldingsListData> {
  code: number
  data: T
  message?: string
}

/** 交易操作请求参数 */
export interface TradeActionRequest {
  code: string
  action: HoldingAction
  quantity: number
}

/** 交易操作响应 */
export interface TradeActionResponse {
  code: number
  success: boolean
  message: string
}

/** 分页状态 */
export interface PaginationState {
  page: number
  pageSize: number
  total: number
}

/** 分页操作回调 */
export interface PaginationHandlers {
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

/** 筛选条件 */
export interface FilterState {
  startDate: string
  endDate: string
  direction: TradeDirection
  keyword: string
}

/** 筛选操作回调 */
export interface FilterHandlers {
  onSearch: () => void
  onReset: () => void
  onExport: () => void
  onUpdateFilter: (partial: Partial<FilterState>) => void
}

/** 数据加载状态 */
export interface HoldingsLoadingState {
  isListLoading: boolean
  isActionLoading: boolean
  isExporting: boolean
}

/** 交易操作弹窗状态 */
export interface TradeModalState {
  open: boolean
  action: HoldingAction | null
  holding: HoldingItem | null
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `fetchHoldings()` | `(params: HoldingsQueryParams) => Promise<HoldingsApiResponse<HoldingsListData>>` | 请求持仓列表 API，支持超时与重试 | `logger.error` 记录后抛出；成功后通过 `DataBridge.forward()` 投递 `holdingsDataLoaded` 事件 |
| `executeTradeAction()` | `(req: TradeActionRequest) => Promise<TradeActionResponse>` | 执行补仓或平仓操作 | `logger.error` 记录后抛出；成功后通过 `DataBridge.forward()` 投递 `tradeActionExecuted` 事件 |
| `exportHoldingsCSV()` | `(params: HoldingsQueryParams) => Promise<void>` | 导出持仓 CSV 并触发浏览器下载 | `logger.error` 记录后抛出；无 DataBridge 事件 |

### 2.3 事件接口

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `holdingsDataLoaded` | `holdingsService.fetchHoldings()` | `dataBridge` → `STORE_NAME.stocks` | 持仓列表加载完成，Envelope 携带 `total` / `page` / `pageSize` |
| `tradeActionExecuted` | `holdingsService.executeTradeAction()` | `dataBridge` → `STORE_NAME.orders` | 交易操作完成，Envelope 携带 `code` / `action` / `quantity` / `success` |

> 注：上述事件通过 `DataBridge.forward()` 投递，由 `holdingsStore` 的 `initHoldingsStoreSubscriptions()` 订阅对应频道，实现服务层与状态层的解耦。

---

## 3. 数据流

```
[外部 API: /api/v1/trade/holdings]
    ↓
holdingsService.fetchHoldings(params)
    ↓ (成功响应)
Envelope(holdingsDataLoaded) ──DataBridge.forward()──→ dataLayer → IndexedDB (STORE_NAME.stocks)
    ↓ (DataBridge 广播)
holdingsStore 订阅频道 (STORE_NAME.stocks / STORE_NAME.orders)
    ↓ (Zustand + withBroadcast)
components/pages (仅经 Store 取数，如 TradingApp / CoreResourcePanel)
```

交易操作（`executeTradeAction`）的数据流类似：

```
[用户触发: 补仓/平仓]
    ↓
holdingsService.executeTradeAction(req)
    ↓ (POST → API)
Envelope(tradeActionExecuted) ──DataBridge.forward()──→ dataLayer → IndexedDB (STORE_NAME.orders)
    ↓
holdingsStore 订阅频道刷新状态 / UI 反馈操作结果
```

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| `logger` | `@/lib/logger` | 日志输出（请求/响应/错误） |

### 4.2 其他依赖（core / config / constants）

| 依赖 | 路径 | 用途 |
|------|------|------|
| `dataBridge` | `@/core/databridge` | `DataBridge.forward()` 投递可观测性 Envelope |
| `EnvelopeFactory` | `@/core/envelope` | 构造标准化 Envelope |
| `dbConfig` | `@/config/dbConfig` | `ENVELOPE_ACTION`、`ENVELOPE_TARGET`、`MODULE_ID` |
| `trade.constants` | `@/constants/trade.constants` | `HOLDINGS_API`、`HOLDINGS_REQUEST_CONFIG` 等常量 |
| `trade.types` | `@/types/modules/trade.types` | TypeScript 接口定义 |
| `nanoid` | `nanoid` | 生成 Envelope traceId（外部库） |

### 4.3 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `HOLDINGS_REQUEST_CONFIG.TIMEOUT` | `15000` | 请求超时（毫秒） | `src/constants/trade.constants.ts` |
| `HOLDINGS_REQUEST_CONFIG.MAX_RETRIES` | `2` | 最大重试次数 | `src/constants/trade.constants.ts` |
| `HOLDINGS_REQUEST_CONFIG.RETRY_DELAY` | `1000` | 重试间隔（毫秒） | `src/constants/trade.constants.ts` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `../../src/services/news/__tests__/` | **待创建**：纯函数（如 `requestWithTimeout`、`requestWithRetry` 的 mock 测试）、错误重试逻辑 |
| 集成测试 | `tests/services/trade.integration.test.ts` | **待创建**：`fetchHoldings` 与 `DataBridge.forward()` 的交互验证、Store 订阅联动 |
| Mock 策略 | `__mocks__/holdingsService.ts` | **待创建**：隔离 `fetch` 外部 API 调用，mock `DataBridge` 与 `EnvelopeFactory` |

> 当前状态：`src/services/trading/` 下尚无 `__tests__` 目录或测试文件。建议在实现新增功能时同步补充单元测试，覆盖 `requestWithRetry` 的退避逻辑和 `fetchHoldings` 的 Envelope 构造路径。

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿：基于 `holdingsService.ts` 单文件结构，提取 `trade.types.ts` 接口，梳理 DataBridge 事件流与依赖关系 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 补充 `src/services/trading/portfolioService.ts` 单元测试（覆盖 fetch/重试/错误路径）。
> 2. 若未来新增 `trade` 子域内其他文件（如 `orderService.ts`、`positionService.ts`），须同步更新本契约 §1 职责与 §2 接口列表。
> 3. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
