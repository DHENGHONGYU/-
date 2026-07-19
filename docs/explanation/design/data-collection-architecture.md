---
title: 数据采集模块架构设计
type: explanation
domain: architecture
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "本文档融�?v6-pro-cockpit 数据采集策略�?V9 五层架构，定�?V9 数据采集模块（Data..."
tags: [architecture, collection, design, data]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-ARCH-029
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 数据采集模块架构设计

> **Status**: Current  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24
>
> 本文档融�?v6-pro-cockpit 数据采集策略�?V9 五层架构，定�?V9 数据采集模块（Data Fetcher）的职责、数据流、接口契约与落地路径�? 
> 关联文档：`../../reference/05-engine-specs.md`、`../../reference/08-implementation-plan.md`

---

## 1. 设计原则

### 1.1 半自动化采集

| 维度 | 全自动化 | V9 半自动化 |
|------|---------|------------|
| 股票选择 | 系统全市场扫�?| 用户录入/导入/从候选池选取 |
| 数据维度 | 系统决定 | 用户勾选或按策略预�?|
| 触发时机 | 定时自动执行 | 手动触发 / 事件触发 / 可配置定�?|
| 结果确认 | 直接入库 | 展示摘要，异常可重试 |

**核心价�?*：用户保留对"采集什么、何时采�?的控制权，系统负责高效执行、错误透明、本地优先存储�?
### 1.2 数据主权与本地优�?
- 所有核心数据落盘在本地 IndexedDB，离线可用�?- 外部数据仅作为输入源，经清洗/适配后通过 `DataBridge.forward()` 写入�?- Python 数据采集服务仅运行在用户本地或用户可控服务器，不上传云端�?
### 1.3 两层架构融合

- **v6 策略**：八维参数化、时间分层、AKShare 优先、两类数据分流、采集调度器�?- **V9 约束**：五层架构、DataBridge/ACL 跨模块写管控、服务层抽取、audit:layers 零违规�?- **融合结果**：fetcher 作为 L3 引擎层服务，所有写操作�?DataBridge；配置与适配器解耦；Python 服务通过 HTTP 接口契约对接�?
---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────────────────�?�?                             数据采集模块总览                              �?├─────────────────────────────────────────────────────────────────────────�?�?                                                                        �?�?  L5 / L4          InputApp / Cockpit / Analysis Pages                  �?�?       �?                          �?                                   �?�?       �?                          �?                                   �?�?  ┌──────────────────────────────────────────────────────────────�?    �?�?  �?                   L3 引擎�?services/fetcher/                �?    �?�?  �? ┌──────────────�? ┌──────────────�? ┌──────────────────────�?�?    �?�?  �? �?fetcherConfig �? �?fetcherClient �? �?fetcherService      �?�?    �?�?  �? �?  (配置)      �? �?  (HTTP 客户�?�? �?(高层 API + 持久�?  �?�?    �?�?  �? └──────────────�? └──────────────�? └──────────────────────�?�?    �?�?  �? ┌──────────────�? ┌──────────────�? ┌──────────────────────�?�?    �?�?  �? │fetcherAdapter�? │fetcherScheduler�?�?  fetcherTypes       �?�?    �?�?  �? �?(数据转换)    �? �?  (调度�?     �? �?  (类型定义)          �?�?    �?�?  �? └──────────────�? └──────────────�? └──────────────────────�?�?    �?�?  └──────────────────────────────────────────────────────────────�?    �?�?                             �?                                         �?�?                             �?DataBridge.forward()                     �?�?  ┌──────────────────────────────────────────────────────────────�?    �?�?  �?             L2 数据�?dataLayer / IndexedDB                  �?    �?�?  �?        stocks / v6_scores / orders / research_logs           �?    �?�?  └──────────────────────────────────────────────────────────────�?    �?�?                             �?                                         �?�?                             �?HTTP                                     �?�?  ┌──────────────────────────────────────────────────────────────�?    �?�?  �?             Python 数据采集服务 (本地 FastAPI)                �?    �?�?  �?     AKShare 接口封装 / 限流 / 错误处理 / 健康检�?            �?    �?�?  └──────────────────────────────────────────────────────────────�?    �?�?                                                                        �?└─────────────────────────────────────────────────────────────────────────�?```

### 2.1 层间调用规则

- L5/L4 只允许调�?`services/fetcher/fetcherService.ts` 暴露的高�?API�?- `services/fetcher/` 内部可调�?`fetcherClient` �?`fetcherAdapter`�?- 所有对 IndexedDB 的写操作必须通过 `DataBridge.forward()`，source �?`MODULE_ID.fetcher`�?- `src/config/fetcherConfig.ts` 禁止依赖 `services/` �?`core/`，仅提供类型与默认值�?
---

## 3. 数据维度与生命周�?
### 3.1 八维数据模型（v6 �?V9 映射�?
> P1 已落�?K�?行情维度，数据写�?`daily_quotes` 存储并同步更�?`Stock.price`�?
| 维度代码 | 维度名称 | 数据来源 | V9 写入目标 | Phase |
|---------|---------|---------|------------|-------|
| 01 | 基本信息 | AKShare `stock_individual_info_em` | `Stock` 字段 | P0 |
| 02 | K�?行情 | AKShare `stock_zh_a_hist` | `Stock.price` + `daily_quotes` | P1 |
| 03 | 筹码分布 | AKShare `stock_comment_em` / `stock_zh_a_gdhs` | `Stock` 扩展字段 | P1 |
| 04 | 重大事项 | AKShare `stock_notice_report` | `news` / `events` | P2 |
| 05 | 热点新闻 | AKShare `stock_news_em` | `news` | P2 |
| 06 | 行业竞品 | AKShare `stock_board_industry_cons_em` | `industry_scores` 辅助 | P2 |
| 07 | 关联指数 | AKShare `fund_etf_spot_em` | `Stock` 扩展字段 | P2 |
| 08 | 研报中心 | AKShare `stock_research_report` | `news` / 研报缓存 | P2 |

> Phase P0 仅实�?01 基本信息拉取，为 V6 自动评分与交易价格提供真实数据；其余维度保留接口与配置，后续迭代补齐�?
### 3.2 两类数据分流策略

| 类型 | 特征 | 存储方式 | 触发下载条件 |
|------|------|---------|-------------|
| 资讯/事件�?| 文本、事件、小体量、高价�?| 直接写入 IndexedDB / localStorage | 用户请求、事件触发、定时增�?|
| 数�?时序�?| K线、财务、大体量 | 仅保留关键�?+ 来源路径/摘要 | 日期变化、价格变�?5%、用户查�?|

### 3.3 时间分层（后续迭代）

| 层级 | 时间�?| 数据类型 | 默认频率 |
|------|--------|---------|---------|
| L1 实时�?| 交易�?9:30-15:00 | 行情、资金流向、新闻快�?| 15 分钟 |
| L2 日终�?| 15:00-17:30 | 日K、成交量、估�?| 日终 1 �?|
| L3 夜盘�?| 19:00-22:00 | 公告、研报、港�?美股 | 每日 1 �?|
| L4 周末�?| 周末/假日 | 财务、行业、宏观、股�?| 每周 1 �?|
| L5 事件�?| 重大事件 | 个股公告、政策、业�?| 事件触发 |

---

## 4. 配置模型

### 4.1 服务配置

```ts
// src/config/fetcherConfig.ts
export interface FetcherServiceConfig {
  baseURL: string           // Python 服务地址，默�?http://localhost:8000
  timeoutMs: number         // 请求超时
  retries: number           // 失败重试次数
}
```

### 4.2 维度配置

```ts
export interface FetcherDimensionConfig {
  code: string
  name: string
  enabled: boolean
  frequency: 'realtime' | '1h' | '3h' | 'daily' | '3d' | 'weekly' | 'monthly' | 'manual'
  sources: string[]         // 源优先级，如 ['akshare', 'cache']
  cacheTtlMinutes: number
  fields: string[]
}
```

### 4.3 环境变量

```env
VITE_AKSHARE_BASE_URL=http://localhost:8000
```

---

## 5. Python 服务接口契约

服务基于 FastAPI，前缀 `/api/collect`�?
### 5.1 通用响应模型

```python
class CollectResponse(BaseModel):
    success: bool
    symbol: str
    dimension: str
    data: dict | list | None
    records: int
    error: str | None
    fetched_at: str
```

### 5.2 端点列表

#### 健康检�?
```http
GET /health
```

响应�?
```json
{
  "status": "ok",
  "service": "v9-data-collector",
  "version": "0.1.0"
}
```

#### 基本信息

```http
POST /api/collect/basic
Content-Type: application/json

{
  "symbol": "600519"
}
```

响应�?
```json
{
  "success": true,
  "symbol": "600519",
  "dimension": "basic",
  "data": {
    "name": "贵州茅台",
    "price": 1680.0,
    "pe": 28.5,
    "pb": 8.2,
    "roe": 25.3,
    "market_cap": 2112000000000
  },
  "records": 1,
  "error": null,
  "fetched_at": "2026-06-24T08:00:00"
}
```

#### K线数�?
```http
POST /api/collect/kline
Content-Type: application/json

{
  "symbol": "600519",
  "period": "daily",
  "adjust": "qfq",
  "start_date": "2025-06-24",
  "end_date": "2026-06-24"
}
```

响应�?
```json
{
  "success": true,
  "symbol": "600519",
  "dimension": "kline",
  "data": {
    "latest": {
      "date": "2026-06-24",
      "open": 1675.0,
      "high": 1685.0,
      "low": 1670.0,
      "close": 1680.0,
      "volume": 12345,
      "amount": 20739600000
    },
    "history": [ ... ]
  },
  "records": 244,
  "error": null,
  "fetched_at": "2026-06-24T08:00:00"
}
```

前端写入 `daily_quotes`（主�?`symbol`），并将 `latest.close` 同步�?`Stock.price`�?
### 5.3 错误处理

- 服务未启动：前端 `fetcherClient` 捕获 `TypeError`，返�?`"数据采集服务未启动，请检�?Python 服务是否运行"`�?- AKShare 接口异常：Python 端返�?`success: false` + 明确 `error` 字段�?- 非法代码：返�?`success: false` + `error: "无效的股票代�?`�?- 超时/限流：前端重�?3 次后返回错误�?
---

## 6. 前端服务 API

```ts
// src/services/fetcher/fetcherService.ts

// 健康检�?export async function checkFetcherHealth(): Promise<{ ok: boolean; error?: string }>

// 单只股票基础信息拉取并持久化
export async function fetchStockBasic(symbol: string): Promise<DataLayerResult<Stock>>

// 批量拉取基础信息
export async function fetchStocksBasic(symbols: string[]): Promise<DataLayerResult<Stock[]>>

// 刷新本地某只股票（先读本地，再拉取更新）
export async function refreshSymbol(symbol: string): Promise<DataLayerResult<Stock>>
```

---

## 7. 与现有模块集�?
### 7.1 输入�?
- 用户录入股票后，提供「录入并拉取 AKShare 数据」按钮�?- 拉取成功后更�?`Stock.price/pe/pb/roe/marketCap`，`source` 标记�?`akshare`�?
### 7.2 V6 自动评分

- `v6ScoreService.ts` 优先使用 `Stock` 中的真实基础数据计算因子分�?- 当真实数据缺失或服务不可用时，回退到随机数模拟，并在日志中标记�?
### 7.3 交易�?
- `tradingService.ts` 创建订单时使�?`stock.price ?? DEFAULT_PRICE`�?- 随着 fetcher 落地，`DEFAULT_PRICE` 回退逐步减少使用�?
---

## 8. 落地路径

| Phase | 目标 | 关键交付 |
|-------|------|---------|
| P0 | 基础信息采集 | �?`fetcherService.fetchStockBasic`、Python `/api/collect/basic` 契约、输入舱集成 |
| P1 | 行情与筹�?| �?`/api/collect/kline`、`daily_quotes` 存储、V6 评分使用真实行情、交易价格真实化 |
| P2 | 事件与新�?| `/api/collect/events`、`/api/collect/news`、资讯类数据直接入库 |
| P3 | 调度与策�?| `fetcherScheduler`、时间分层、策略预设、限流额度管�?|

---

## 9. 风险与降�?
| 风险 | 应对 |
|------|------|
| Python 服务未部�?| 前端健康检查明确提示；保留 mock 数据降级 |
| AKShare 接口不稳�?| 接口契约独立；失败重试；记录错误日志 |
| 数据质量影响评分 | V6 评分保留随机数降级开关；真实数据缺失时自动降�?|
| 跨层调用违规 | 所有写操作�?DataBridge；`audit:layers` 持续守护 |

---

## 10. 附录：启�?Python 服务（参考）

```bash
cd python/data_service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

前端默认通过 `VITE_AKSHARE_BASE_URL` 连接该服务�?