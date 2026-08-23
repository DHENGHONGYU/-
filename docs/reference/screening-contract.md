---
title: screening-contract.md — 选股/筛选子域接口契约
type: reference
domain: backend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：定义 `screening` 子域的接口契约、职责边界、数据流与依赖关系。 关联：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md`..."
tags: [backend, screening, contract]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-BACK-022
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17

covers_code:
  - src/config/multiFactorScreeningConfig.ts
  - src/config/screeningConfig.ts
  - src/services/screening/multiFactorScreeningEngine.test.ts
---
# screening-contract.md — 选股/筛选子域接口契约

> **定位**：定义 `screening` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **多因子条件筛选**：按条件组（`ScreeningConditionGroup`）对股票池执行 PE/PB/ROE/市值/营收增速/净利润增速等因子筛选，支持组内 `and`/`or` 逻辑及 `gt`/`lt`/`gte`/`lte`/`eq`/`between` 操作符。
- **筛选模板生成**：根据当前条件组生成可持久化的筛选模板（`createTemplateFromGroups`），含随机后缀防 ID 碰撞。
- **结果导出**：将筛选结果生成带 BOM 的 UTF-8 CSV（`generateScreeningCsv`），并触发浏览器文件下载（`exportScreeningResults`）。
- **股票池加载**：从 `dataLayer.stocks` 与 `unifiedStockService` 聚合加载可筛选股票视图，统一字段映射并填充缺失值占位。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`）；本服务不直接写 DB，结果经返回值交给 Store 处理 |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `dataLayer` | 上游：提供股票列表 | `dataLayer.stocks.list()` → `loadScreenableStocks()` |
| `unifiedStockService` | 上游：提供统一股票视图 | `getUnifiedStockViews()` → `loadScreenableStocks()` |
| `multiFactorScreeningStore` | 下游：消费筛选结果 | `runMultiFactorScreening()` → `multiFactorScreeningStore` |
| `analysis/screeningEngine` | 相关：分析子域内负责 candidate→screened→deepDive 晋升流转 | 与本目录 `multiFactorScreeningEngine` 并列，但职责不同（后者为交互式多因子条件引擎） |
| `mcp/servers/screening` | 下游：MCP Server 封装 `analysis/screeningEngine` | `analysis/screeningEngine` → `ScreeningServer`（非本目录 engine） |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/types/modules/screening.types.ts

export type ScreeningFactor =
  | 'pe' | 'pb' | 'roe' | 'marketCap' | 'revenueGrowth' | 'profitGrowth'

export type ScreeningOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'between'
export type ScreeningLogic = 'and' | 'or'

export interface ScreeningCriterion {
  id: string
  factor: ScreeningFactor
  operator: ScreeningOperator
  value: number
  value2?: number
}

export interface ScreeningConditionGroup {
  id: string
  logic: ScreeningLogic
  criteria: ScreeningCriterion[]
}

export interface ScreeningTemplate {
  id: string
  name: string
  description?: string
  groups: ScreeningConditionGroup[]
  createdAt: number
  updatedAt: number
}

export interface ScreenableStockData {
  symbol: string
  name: string
  sector: string | null
  pe: number | null
  pb: number | null
  roe: number | null
  marketCap: number | null
  revenueGrowth: number | null
  profitGrowth: number | null
}

export interface ScreeningResultItem extends ScreenableStockData {
  matchedGroups: string[]
}

export interface ScreeningRunResult {
  items: ScreeningResultItem[]
  total: number
  elapsedMs: number
}

export interface ScreeningFactorMeta {
  factor: ScreeningFactor
  label: string
  unit: string
  step: number
  defaultOperator: ScreeningOperator
  defaultValue: number
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `loadScreenableStocks()` | `() => Promise<ScreenableStockData[]>` | 从 dataLayer + unifiedStockService 加载可筛选股票池 | `logger.info` 记录空池/完成；异常向上抛 |
| `runMultiFactorScreening()` | `(stocks: ScreenableStockData[], groups: ScreeningConditionGroup[]) => ScreeningRunResult` | 执行多条件组筛选（组间为 AND） | 纯计算，无副作用；`logger.info` 记录入选/拒绝样本与耗时 |
| `generateScreeningCsv()` | `(items: ScreeningResultItem[]) => string` | 生成带 BOM 的 CSV 字符串 | 纯字符串处理，无副作用 |
| `exportScreeningResults()` | `(items: ScreeningResultItem[], filenamePrefix: string) => void` | 触发浏览器下载 CSV | 空数组直接返回；DOM 操作创建临时 Blob/URL |
| `createTemplateFromGroups()` | `(name: string, groups: ScreeningConditionGroup[], description?: string) => ScreeningTemplate` | 根据条件组生成模板对象 | 纯构造，无副作用；ID 含时间戳+随机后缀防碰撞 |

### 2.3 事件接口

本子域当前**未使用 EventBus** 发布/订阅事件，所有状态流转通过函数返回值直接传递。Store 层（`multiFactorScreeningStore`）通过 `logger` 记录错误。

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| — | — | — | 本子域无 EventBus 事件；状态经返回值同步传递 |

---

## 3. 数据流

### 3.1 多因子筛选主链路

```
[dataLayer.stocks.list()] ──→ [getUnifiedStockViews()] ──→ [loadScreenableStocks()]
                                                                     ↓
[MultiFactorFilterPanel] ←── [multiFactorScreeningStore] ←── [runMultiFactorScreening()]
       ↑                              ↓
   用户操作                  conditionGroups / results / templates
                              （模板持久化经 localStorageManager）
```

### 3.2 结果导出链路

```
[multiFactorScreeningStore.results] ──→ [exportScreeningResults()]
                                              ↓
                                    [generateScreeningCsv()] → Blob → 浏览器下载
```

### 3.3 说明

- 本服务**不直接写入 IndexedDB**，筛选结果通过返回值交由 `multiFactorScreeningStore` 管理。
- 筛选模板的持久化由 Store 层通过 `localStorageManager` 完成，不经 `DataBridge`。
- `exportScreeningResults` 内部使用 DOM API（`document.createElement('a')`）触发下载，属于服务层对浏览器 API 的边界调用，当前由 UI 层通过 Store 间接调用。

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 日志输出（加载进度、筛选完成、入选/拒绝明细） |
| dataLayer | `@/data/dataLayer` | 加载股票列表（`dataLayer.stocks.list()`） |
| unifiedStockService | `@/services/unifiedStockService` | 获取统一股票视图（`getUnifiedStockViews()`） |
| types | `@/types/modules/screening.types` | 类型定义（零依赖，纯类型） |

> 注：本子域未使用 `eventBus`、`format`、`errors` 等 lib 模块。

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `MULTI_FACTOR_SCREENING_FACTORS` | 6 个因子（PE/PB/ROE/市值/营收增速/净利润增速） | 可筛选因子元数据 | `src/config/multiFactorScreeningConfig.ts` |
| `MULTI_FACTOR_SCREENING_OPERATORS` | 6 个操作符（`>`/`≥`/`<`/`≤`/`=`/`区间`） | 操作符选项 | `src/config/multiFactorScreeningConfig.ts` |
| `MULTI_FACTOR_SCREENING_LOGICS` | `and`/`or` | 条件组内逻辑选项 | `src/config/multiFactorScreeningConfig.ts` |
| `MULTI_FACTOR_SCREENING_STORAGE_KEY` | `'templates'` | 模板 localStorage 存储 key | `src/config/multiFactorScreeningConfig.ts` |
| `MULTI_FACTOR_SCREENING_TEMPLATE_NAME_MAX_LENGTH` | `50` | 模板名称长度限制 | `src/config/multiFactorScreeningConfig.ts` |
| `MULTI_FACTOR_SCREENING_CSV_FILENAME_PREFIX` | `'multi_factor_screening'` | CSV 文件名前缀 | `src/config/multiFactorScreeningConfig.ts` |

> 晋升阈值配置（candidate→screened→deepDive）位于 `src/config/screeningConfig.ts`，由 `analysis/screeningEngine.ts` 消费，不在本子域内。

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/screening/multiFactorScreeningEngine.test.ts` | 纯函数、计算逻辑；覆盖单条件组 AND、条件组 OR、between 操作符、缺失因子值视为不匹配、多条件组全部命中、CSV 生成、模板创建、股票池加载 |
| 集成测试 | — | 当前无独立集成测试；股票池加载逻辑通过 `vi.mock` 模拟 `dataLayer` 与 `unifiedStockService` |
| Mock 策略 | 同文件内联 `vi.mock` | `dataLayer.stocks.list` 与 `getUnifiedStockViews` 均被 mock |

> 测试用例数：8 个（涵盖 `runMultiFactorScreening`、`generateScreeningCsv`、`createTemplateFromGroups`、`loadScreenableStocks`）。

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：请按本模板填充 §1-§5，确保与 `services-catalog.md` 的摘要一致。完成后运行 `tsc --noEmit` + `audit:layers` 验证。
