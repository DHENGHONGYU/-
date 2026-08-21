---
title: fetcher 服务契约
type: reference
domain: project
phase: design
tier: important
status: active
maintainer: fetcher 子域 / 架构组
summary: "统一外部行情/资讯 API 适配层，负责采集、限流、缓存、错误恢复。"
tags: [project, collection, contract, reference, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-092
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17

covers_code:
  - src/config/fetcherConfig.ts


---
# fetcher-contract.md — 行情/资讯抓取服务

> **定位**：统一外部行情/资讯 API 适配层，负责采集、限流、缓存、错误恢复。  
> **Source**：`./services-catalog.md`（子域 #8）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

1. **多源采集**：对接 Tushare、Yahoo Finance、AkShare 等外部数据源，统一适配为内部数据模型。
2. **限流与调度**：按 API 限频规则调度请求，避免触发源站封禁。
3. **缓存与降级**：热点数据本地缓存；源站不可用时降级到缓存数据或 mock 数据。
4. **错误恢复**：网络超时自动重试（指数退避），连续失败切换备用源。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/fetcher/`（服务层 #8） |
| 依赖方向 | `core/`（DataBridge）、`lib/`（logger、errors、format）、外部 API |
| 禁止事项 | 禁止直写 IndexedDB（须经 DataBridge.forward()） |
| 被依赖方 | `services/data-collector/`（采集编排）、`services/analysis/`（分析消费） |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `data-collector` | 上游调用方 | `data-collector` → `fetcher`（触发采集任务） |
| `analysis` | 下游消费方 | `fetcher` → DataBridge → IndexedDB → `analysis`（读取行情） |
| `news` | 下游消费方 | `fetcher` → DataBridge → IndexedDB → `news`（读取资讯） |

---

## 2. 公共接口

### 2.1 类型定义

```typescript
// src/services/fetcher/fetcherTypes.ts

export interface FetcherRequest {
  source: DataSource;        // 'tushare' | 'yahoo' | 'akshare' | 'mock'
  symbol: string;            // 股票代码
  endpoint: FetcherEndpoint; // 'daily_quotes' | 'financial_report' | 'news'
  params?: Record<string, unknown>;
  priority?: 'high' | 'normal' | 'low';
}

export interface FetcherResponse {
  data: UnifiedStockData[];
  meta: {
    source: DataSource;
    fetchedAt: string;       // ISO 8601
    cacheHit: boolean;
    nextAvailableAt?: string; // 限流恢复时间
  };
}

export type DataSource = 'tushare' | 'yahoo' | 'akshare' | 'mock';
export type FetcherEndpoint = 'daily_quotes' | 'financial_report' | 'news' | 'sector_data';
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `fetchQuotes()` | `(req: FetcherRequest) => Promise<FetcherResponse>` | 按数据源拉取行情 | 限流等待 → 重试 → 降级缓存 → ErrorBus 上报 |
| `fetchBatch()` | `(reqs: FetcherRequest[]) => Promise<FetcherResponse[]>` | 批量并行拉取 | 部分失败返回成功项 + 失败项列表 |
| `scheduleFetch()` | `(req: FetcherRequest, cron: string) => void` | 定时采集（如每日 15:30 收盘后） | 定时器异常 → logger 记录 |

### 2.3 事件接口

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `fetcher:quotes:loaded` | fetcher | `data-collector` / `analysis` | 行情加载完成 |
| `fetcher:limit:hit` | fetcher | `errorBus` | API 限流触发 |
| `fetcher:source:switch` | fetcher | `errorBus` | 主源失败，切换备用源 |

---

## 3. 数据流

```
外部 API (Tushare/Yahoo/AkShare)
  ↓
fetcherService.fetchQuotes()
  ├─> 限流检查（rateLimiter）
  ├─> 缓存检查（memoryCache → IndexedDB cache store）
  ├─> HTTP 请求（axios/fetch adapter）
  ├─> 数据转换（source-specific → UnifiedStockData）
  ↓
DataBridge.forward(envelope) → routeToDB() → IndexedDB
  ↓
EventBus.publish('fetcher:quotes:loaded')
  ↓
store/stockStore (Zustand + withBroadcast)
  ↓
components/pages
```

---

## 4. 配置与依赖

### 4.1 依赖白名单

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 采集日志、限流日志、错误日志 |
| EventBus | `@/lib/eventBus` | 加载完成事件 |
| errors | `@/lib/errors` | FetcherError、RateLimitError |
| format | `@/lib/format` | 日期格式化、数值格式化 |
| localStorageManager | `@/lib/localStorageManager` | API Key 加密存储 |

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `VITE_TUSHARE_TOKEN` | '' | Tushare Pro API Token | 用户输入（加密存储） |
| `VITE_YAHOO_API_KEY` | '' | Yahoo Finance API Key | 用户输入（加密存储） |
| `FETCHER_RATE_LIMIT` | 200 | 每分钟最大请求数 | `src/config/fetcherConfig.ts` |
| `FETCHER_RETRY_MAX` | 3 | 最大重试次数 | `src/config/fetcherConfig.ts` |
| `FETCHER_CACHE_TTL` | 300000 | 内存缓存 TTL（毫秒） | `src/config/fetcherConfig.ts` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `fetcherAdapter.test.ts` | 适配器逻辑、数据转换 |
| 单元测试 | `fetcherInterceptor.test.ts` | 拦截器（限流、重试、错误） |
| 集成测试 | `fetcherClient.test.ts` | 端到端 HTTP 请求（mock server） |
| E2E | `__dirty-data-e2e-verify.test.ts` | 脏数据验证 |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |
