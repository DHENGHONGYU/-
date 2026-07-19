---
title: export-contract.md — 导出服务接口契约
type: reference
domain: project
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：定义 `export` 子域的接口契约、职责边界、数据流与依赖关系。 关联：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md`..."
tags: [project, contract, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-221
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# export-contract.md — 导出服务接口契约

> **定位**：定义 `export` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **回测报告数据格式化**：将 `BacktestResult` 与 `BacktestConfig` 转换为结构化的 Excel 多 Sheet 数据（`BacktestExcelSheets`）和报告元数据（`BacktestReportMeta`）。
- **Excel 文件导出**：基于 `xlsx` 库动态构建含「摘要 / 持仓 / 交易 / 净值」四个 Sheet 的 `.xlsx` 文件，通过浏览器下载交付。
- **PDF 文件导出**：基于 `jspdf` + `jspdf-autotable` 动态生成含标题、摘要、持仓表、交易明细表和净值序列表的 `.pdf` 文件。
- **第三方库按需加载**：`xlsx` / `jspdf` / `jspdf-autotable` 均采用 `import()` 动态导入，仅在导出触发时加载，降低主包体积。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`）；本服务为纯文件生成，不写入数据库 |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `backtest` | 上游：提供输入 | `BacktestResult` + `BacktestConfig` → `export/backtestExportService` |
| `backtestStore` | 上游：提供原始数据 | 页面层通过 `backtestStore` 获取回测结果后传入本服务 |
| `pages/output` | 下游：消费输出 | 本服务返回 `Blob` + `filename`，由页面层触发浏览器下载 |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/types/modules/backtest.types.ts

export type BacktestStrategy = 'hot_sector' | 'value_pit' | 'composite'

export interface BacktestPosition {
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
}

export interface BacktestDailyValue {
  date: string
  totalValue: number
  cash: number
}

export type BacktestExportFormat = 'pdf' | 'excel'

export interface BacktestReportMeta {
  strategy: string
  startDate: string
  endDate: string
  initialCapital: number
  generatedAt: string
}

export interface BacktestExcelSheets {
  summary: Array<Record<string, string | number>>
  positions: Array<Record<string, string | number>>
  trades: Array<Record<string, string | number>>
  dailyValues: Array<Record<string, string | number>>
}

export interface BacktestExportConfig {
  format: BacktestExportFormat
  filename?: string
}

export interface BacktestExportResult {
  success: boolean
  filename: string
  blob?: Blob
  error?: string
}

export interface BacktestTrade {
  symbol: string
  direction: 'buy' | 'sell'
  price: number
  quantity: number
  date: string
  pnl: number
  pnlPct: number
  reason: string
}

export interface BacktestResult {
  totalReturn: number
  annualizedReturn: number
  maxDrawdown: number
  sharpeRatio: number
  winRate: number
  tradeCount: number
  profitTrades: number
  lossTrades: number
  avgProfit: number
  avgLoss: number
  pnlCurve: number[]
  trades: BacktestTrade[]
  positions?: BacktestPosition[]
  dailyValues?: BacktestDailyValue[]
}

export interface BacktestConfig {
  strategy: BacktestStrategy
  startDate: string
  endDate: string
  initialCapital: number
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `buildReportMeta()` | `(config: BacktestConfig) => BacktestReportMeta` | 根据回测配置构建报告元数据（策略标签、时间区间、资金、生成时间） | 纯计算，无副作用 |
| `buildExcelSheets()` | `(result: BacktestResult, meta: BacktestReportMeta) => BacktestExcelSheets` | 将回测结果转换为四个 Sheet 的数据结构 | 纯计算，对缺失字段做空数组兜底 |
| `exportBacktestReport()` | `(result: BacktestResult, config: BacktestConfig, options: BacktestExportConfig) => Promise<BacktestExportResult>` | 统一导出入口，根据 `options.format` 路由到 Excel 或 PDF 导出 | 捕获异常，返回 `{ success: false, error: msg }`；logger 记录错误 |

### 2.3 事件接口

> 本服务为纯文件生成服务，不发布/订阅 EventBus 事件。错误通过 `logger.error` 记录，并随返回结果传递。

---

## 3. 数据流

```
[backtestStore / backtestService]
    ↓ 提供 BacktestResult + BacktestConfig
exportBacktestReport(result, config, options)
    ↓ 内部路由
buildReportMeta() → buildExcelSheets()
    ↓
exportExcel() 或 exportPdf()
    ↓ 动态 import('xlsx') / import('jspdf')
生成 Blob 文件
    ↓ 返回 BacktestExportResult
pages/output（页面层触发浏览器下载）
```

> **说明**：本服务为文件生成型服务，数据流不涉及 `DataBridge` 或 `IndexedDB` 写入。输入为回测结果对象，输出为可直接下载的 `Blob` 文件。

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 日志输出（导出成功/失败记录） |

### 4.2 其他依赖

| 依赖 | 路径 | 说明 |
|------|------|------|
| types | `@/types/modules/backtest.types` | 回测相关类型定义（零依赖类型层） |
| constants | `@/constants/backtest.constants` | 回测常量（策略标签、Sheet 名、PDF 排版参数等） |
| xlsx | 动态 `import('xlsx')` | Excel 生成第三方库，仅在导出时加载 |
| jspdf | 动态 `import('jspdf')` | PDF 生成第三方库，仅在导出时加载 |
| jspdf-autotable | 动态 `import('jspdf-autotable')` | PDF 表格渲染第三方库，仅在导出时加载 |

### 4.3 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `BACKTEST_EXPORT_FILENAME` | `'BacktestReport'` | 导出文件名前缀 | `src/constants/backtest.constants` |
| `PDF_TITLE_FONT_SIZE` | `20` | PDF 标题字号 | `src/constants/backtest.constants` |
| `PDF_SUMMARY_FONT_SIZE` | `12` | PDF 摘要字号 | `src/constants/backtest.constants` |
| `PDF_SECTION_FONT_SIZE` | `14` | PDF 章节标题字号 | `src/constants/backtest.constants` |
| `PDF_TABLE_FONT_SIZE` | `10` | PDF 表格字号 | `src/constants/backtest.constants` |
| `PDF_TABLE_HEADER_COLOR` | `[52, 73, 94]` | PDF 表头背景色（RGB） | `src/constants/backtest.constants` |
| `PDF_MAX_TRADE_ROWS` | `50` | 交易明细表最大行数（防止 PDF 溢出） | `src/constants/backtest.constants` |
| `PERCENT_BASE` | `100` | 百分比转换基数 | 模块内常量 |
| `PERCENT_DECIMAL_PLACES` | `2` | 百分比显示小数位 | 模块内常量 |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/export/__tests__/backtestExportService.test.ts` | 覆盖 `buildReportMeta`、`buildExcelSheets`、`exportBacktestReport`；含 6 个用例（元数据生成、Excel 四 Sheet、缺失字段兜底、Excel 导出、PDF 导出、错误处理） |
| Mock 策略 | `vi.mock('xlsx')`、`vi.mock('jspdf')`、`vi.mock('jspdf-autotable')` | 隔离第三方库，确保测试不依赖外部包 |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：请按本模板填充 §1-§5，确保与 `services-catalog.md` 的摘要一致。完成后运行 `tsc --noEmit` + `audit:layers` 验证。
