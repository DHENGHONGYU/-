---
title: input-contract.md — 输入处理子域接口契约
type: reference
domain: project
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：定义 `input` 子域的接口契约、职责边界、数据流与依赖关系。 关联：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。"
tags: [project, contract, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# input-contract.md — 输入处理子域接口契约

> **定位**：定义 `input` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

1. **候选股票录入管理**：提供 `addStock()` 等入口，将用户手动输入或搜索选中的股票写入意向候选池（`stocks` store），支持可选的自动拉取基础数据 / K 线数据。
2. **批量导入解析与执行**：支持文本批量粘贴、CSV/JSON/Excel 多格式文件解析，实现 `importStocks()` / `importStocksWithProgress()` 分批并发导入，并提供行级状态预览（valid / duplicate / invalid）。
3. **本地搜索与热门板块推荐**：维护离线 mock 股票库供 `searchStocks()` 模糊匹配；提供 `getHotSectors()` 配置化热门板块及一键将板块内推荐股票加入候选池。
4. **池数据导入导出**：支持候选池的 JSON 结构化导出（`exportPool`）与兼容性导入（`importPool`），实现跨设备/跨会话的数据迁移。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`） |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `fetcher` (useCase) | 上游：提供行情/基础数据拉取 | `fetchBasicDataUseCase` / `fetchKlineDataUseCase` → `inputService`（`addStock` 后自动补充数据） |
| `stockpool` (store/module) | 下游：消费录入结果 | `inputService` → `DataBridge.forward()` → `stocks` store → `stockpool` / `inputHubStore` |
| `scoring` / `analysis` | 下游：候选池触发评分与分析 | 用户录入后，上游页面可跳转至分析/评分舱 |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/input/inputService.ts

export interface AddStockInput {
  symbol: string
  name: string
}

export interface AddStockOptions {
  /** 是否在录入成功后立即拉取 AKShare 基础数据 */
  fetchBasicAfterAdd?: boolean
  /** 是否在录入成功后立即拉取 AKShare K线数据 */
  fetchKlineAfterAdd?: boolean
  /** 目标股票池分组，未指定时使用默认分组 */
  group?: string
}

export type StockSearchResult = MockStock

export interface PoolExportPayload {
  version: 'v9-pool-export-1'
  exportedAt: number
  stocks: Stock[]
}

export interface PoolImportResult {
  success: number
  failed: number
  errors: string[]
}

// 文件：src/services/input/batchImportParsers.ts

export type BulkImportRowStatus = 'valid' | 'duplicate' | 'invalid'

export interface BulkImportRow {
  code: string
  name: string
  symbol: string
  status: BulkImportRowStatus
  statusReason?: string
}

export interface BulkImportResult {
  total: number
  success: number
  failed: number
  errors: Array<{ row: number; raw: string; error: string }>
  stocks: Stock[]
}

// 文件：src/services/input/batchImportExecutor.ts

export interface ImportStocksOptions extends AddStockOptions {
  /** 遇到重复代码时是否跳过（默认 true） */
  skipDuplicates?: boolean
}

// 文件：src/services/input/hotSectorService.ts

export interface HotSectorStock {
  symbol: string
  name: string
}

export interface HotSector {
  code: string
  name: string
  score: number
  trend: 'up' | 'down' | 'neutral'
  factors: {
    momentum: number
    fundFlow: number
    valuation: number
    sentiment: number
  }
  stocks: HotSectorStock[]
}

export interface AddHotSectorStockResult {
  added: Stock[]
  failed: Array<{ symbol: string; error: string }>
}

export type AddHotSectorOptions = AddStockOptions

// 文件：src/services/input/mockStockLibrary.ts

export interface MockStock {
  symbol: string
  name: string
  industry: string
  pe?: number
  pb?: number
  marketCap?: number
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `addStock()` | `(input: AddStockInput, options?: AddStockOptions) => Promise<DataLayerResult<Stock>>` | 单条股票录入候选池，可选自动拉取基础/K线数据 | `addStockInFlight` 并发互斥 + logger 记录 + 返回错误信息 |
| `addStockFromSearch()` | `(result: StockSearchResult, options?: AddStockOptions) => Promise<DataLayerResult<Stock>>` | 从搜索结果快捷录入 | 委托 `addStock()` |
| `searchStocks()` | `(query: string) => StockSearchResult[]` | 本地 mock 库模糊搜索（代码/名称/行业） | 查询过短返回空数组 |
| `exportPool()` | `(status?: ResearchStatus) => Promise<DataLayerResult<PoolExportPayload>>` | 导出候选池为 JSON Payload | `DataBridge.query()` 错误透传 |
| `importPool()` | `(payload: PoolExportPayload) => Promise<DataLayerResult<PoolImportResult>>` | 导入候选池，逐条写入并跳过已存在项 | 版本校验 + 逐行 try/catch 聚合错误 |
| `listStocks()` | `() => Promise<DataLayerResult<Stock[]>>` | 获取全部股票列表 | `DataBridge.query()` 错误透传 |
| `listStocksByStatus()` | `(status: ResearchStatus) => Promise<DataLayerResult<Stock[]>>` | 按研究状态过滤列表 | `DataBridge.query()` 错误透传 |
| `parseBulkInput()` | `(text: string) => BulkImportRow[]` | 解析批量文本输入（多格式适配） | 无效行标记为 `invalid` |
| `parseFile()` | `(file: File) => Promise<BulkImportRow[]>` | 文件解析统一入口（CSV/JSON/Excel） | 不支持的格式抛异常 |
| `detectDuplicates()` | `(rows: BulkImportRow[], existingSymbols: Set<string>) => BulkImportRow[]` | 重复检测与行级状态标记 | 纯函数，无副作用 |
| `importStocks()` | `(rows: BulkImportRow[], options?: ImportStocksOptions) => Promise<DataLayerResult<BulkImportResult>>` | 批量导入（顺序执行） | 失败行记录到 `errors`，不阻塞 |
| `importStocksWithProgress()` | `(rows: BulkImportRow[], options?: ImportStocksOptions, onProgress?: fn) => Promise<DataLayerResult<BulkImportResult>>` | 带进度的分批并行导入 | 批次间隔控制并发 |
| `downloadTemplate()` | `() => void` | 下载 CSV 导入模板 | 异常由 logger 捕获 |
| `getHotSectors()` | `() => HotSector[]` | 获取配置化热门板块列表 | 返回浅拷贝 |
| `getHotSectorByCode()` | `(code: string) => HotSector \| undefined` | 按代码获取热门板块 | 无匹配返回 `undefined` |
| `addHotSectorStocks()` | `(sectorCode: string, options?: AddHotSectorOptions) => Promise<DataLayerResult<AddHotSectorStockResult>>` | 将板块全部推荐股加入候选池 | 逐条调用 `addStock()` 聚合结果 |
| `addHotSectorStock()` | `(sectorCode: string, symbol: string, options?: AddHotSectorOptions) => Promise<DataLayerResult<Stock>>` | 将单只推荐股加入候选池 | 委托 `addStock()` |

### 2.3 事件接口

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `BATCH_IMPORT_COMPLETED` | `batchImportExecutor` | `poolStore` / `inputHubStore` 等消费者 | 批量导入完成时发布，携带 `{ total, success, failed }` |

---

## 3. 数据流

```
[用户输入 / 搜索 / 文件上传]
    ↓
inputService.addStock() / batchImportExecutor.importStocks()
    ↓ (DataBridge.forward() 或 addStock 内部封装)
DataBridge → routeToDB() → dataLayer → IndexedDB
    ↓ (eventBus.emit('BATCH_IMPORT_COMPLETED'))
inputHubStore / poolStore (Zustand + withBroadcast)
    ↓
components/pages (仅经 Store 取数)
```

**说明**：
- 单条录入通过 `inputService.addStock()` 构建 `Envelope` 并调用 `dataBridge.forward()` 写入；
- 批量导入通过 `batchImportExecutor` 逐行调用 `addStock()`，最终同样走 `DataBridge`；
- 导入完成后通过 `eventBus.emit('BATCH_IMPORT_COMPLETED')` 广播事件，通知 Store 层刷新 UI。

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 模块级日志输出（`[inputService]` / `[batchImport]` 前缀） |
| eventBus | `@/lib/eventBus` | 批量导入完成事件发布 |

### 4.2 其他关键依赖

| 依赖 | 路径 | 用途 |
|------|------|------|
| dataBridge | `@/core/databridge` | 候选池写入与查询（`forward()` / `query()`） |
| EnvelopeFactory | `@/core/envelope` | 构建数据信封 |
| dataLayer | `@/data/dataLayer` | **注意**：`batchImportExecutor` 与 `hotSectorService` 中直接调用 `dataLayer.stocks.get()` 做存在性校验（建议后续统一收敛至 `DataBridge.query()`） |
| fetcherOrchestrator.useCase | `@/services/useCase/fetcherOrchestrator.useCase` | `addStock` 后自动拉取基础/K线数据 |

### 4.3 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `INPUT_CONFIG.bulkImport.maxRows` | `500` | 批量导入最大行数限制 | `src/config/inputConfig.ts` |
| `INPUT_CONFIG.bulkImport.batchSize` | `20` | 分批导入每批并发数 | `src/config/inputConfig.ts` |
| `INPUT_CONFIG.bulkImport.batchIntervalMs` | `500` | 批次间间隔（ms） | `src/config/inputConfig.ts` |
| `INPUT_CONFIG.search.minQueryLength` | `1` | 搜索触发最小字符数 | `src/config/inputConfig.ts` |
| `INPUT_CONFIG.search.maxResults` | `20` | 搜索最大返回条数 | `src/config/inputConfig.ts` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/input/` | **当前缺失** — 建议补充 `inputService`、`batchImportParsers`、`batchImportExecutor` 的纯函数与计算逻辑测试 |
| Store 测试 | `tests/__tests__/inputHubStore.enhanced.test.ts` | `inputHubStore` 的状态与交互测试（位于 Store 层） |
| 集成测试 | `tests/services/input.integration.test.ts` | **当前缺失** — 建议补充 DataBridge 交互、批量导入全链路测试 |
| Mock 策略 | `src/services/input/mockStockLibrary.ts` | 自带 mock 数据源，可用于隔离外部依赖 |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 补充 `src/services/input/` 单元测试（`batchImportParsers`、`inputService`）；
> 2. 收敛 `batchImportExecutor.ts` 与 `hotSectorService.ts` 中直接调用 `dataLayer.stocks.get()` 的写法，统一通过 `DataBridge.query()` 进行存在性校验；
> 3. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
