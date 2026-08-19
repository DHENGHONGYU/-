---
title: DEPRECATED - backtest-data-definition.md
type: reference
domain: data
phase: testing
tier: standard
status: deprecated
maintainer: V9 Architecture Team
summary: "⚠️ 此文件已废弃（2026-07-14） 数据定义已整合至 `docs/reference/data-dictionary-index.md`（已归档），请通过主索引访问最新定义。"
tags: [data, data-definition, test]
version: v2.4.0
last_updated: 2026-08-15
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-DATA-060
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v2.4.0
    changes: "DEPRECATED（2026-07-14）；2026-08-15 系统性核对：仍保持废弃状态，最新定义见 docs/reference/data-dictionary-index.md v1.1.0 与《V9核心数据字典与类型定义（整合版）》.md v1.5。"
    date: 2026-08-15
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17
---

# DEPRECATED - backtest-data-definition.md

> ⚠️ **此文件已废弃**（2026-07-14）
> 
> 数据定义已整合至 `docs/reference/data-dictionary-index.md`（已归档），请通过主索引访问最新定义。

---

# 策略回测模块数据字典

> **Status**: Current  
> **Version**: v2.4.0  
> **Last Updated**: 2026-07-02  
> **Covers**: DA-006 回测报告导出扩展

本文档定义 V9 策略回测模块（BacktestPage）的核心数据结构、Store 状态、服务 API 与导出数据契约。

---

## 1. 核心类型

### 1.1 BacktestConfig

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `strategy` | `BacktestStrategy` | 是 | 回测策略：`hot_sector` / `value_pit` / `composite` |
| `startDate` | `string` | 是 | 回测开始日期，格式 `YYYY-MM-DD` |
| `endDate` | `string` | 是 | 回测结束日期，格式 `YYYY-MM-DD` |
| `initialCapital` | `number` | 是 | 初始资金（元） |

定义位置：`src/store/backtestStore.ts`

### 1.2 BacktestResult

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `totalReturn` | `number` | 是 | 总收益率（百分比，例如 12.34） |
| `annualizedReturn` | `number` | 是 | 年化收益率（百分比） |
| `maxDrawdown` | `number` | 是 | 最大回撤（百分比） |
| `sharpeRatio` | `number` | 是 | 夏普比率 |
| `winRate` | `number` | 是 | 胜率（百分比） |
| `tradeCount` | `number` | 是 | 交易总次数 |
| `profitTrades` | `number` | 是 | 盈利交易次数 |
| `lossTrades` | `number` | 是 | 亏损交易次数 |
| `avgProfit` | `number` | 是 | 平均盈利（百分比） |
| `avgLoss` | `number` | 是 | 平均亏损（百分比） |
| `pnlCurve` | `number[]` | 是 | 净值曲线，以 1 为起点 |
| `trades` | `BacktestTrade[]` | 是 | 交易记录 |
| `positions` | `BacktestPosition[]` | 否 | **DA-006 新增**：最终持仓快照，由 BacktestEngine 计算并注入，用于导出 |
| `dailyValues` | `BacktestDailyValue[]` | 否 | **DA-006 新增**：每日总资产/现金序列，由 BacktestEngine 计算并注入，用于导出 |

定义位置：`src/store/backtestStore.ts`

### 1.3 BacktestTrade

| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | `string` | 标的代码 |
| `direction` | `'buy' \| 'sell'` | 买卖方向 |
| `price` | `number` | 成交价格 |
| `quantity` | `number` | 成交数量 |
| `date` | `string` | 成交日期 `YYYY-MM-DD` |
| `pnl` | `number` | 已实现盈亏 |
| `pnlPct` | `number` | 盈亏百分比 |
| `reason` | `string` | 交易原因 |

### 1.4 BacktestPosition（导出扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | `string` | 标的代码 |
| `quantity` | `number` | 持仓数量 |
| `avgCost` | `number` | 平均成本 |
| `currentPrice` | `number` | 当前价格 |
| `marketValue` | `number` | 市值 |
| `unrealizedPnL` | `number` | 浮动盈亏 |

定义位置：`src/types/modules/backtest.types.ts`

### 1.5 BacktestDailyValue（导出扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| `date` | `string` | 日期 `YYYY-MM-DD` |
| `totalValue` | `number` | 当日总资产 |
| `cash` | `number` | 当日现金 |

定义位置：`src/types/modules/backtest.types.ts`

---

## 2. Store 状态

`useBacktestStore` 管理以下状态：

| 字段 | 类型 | 说明 |
|------|------|------|
| `config` | `BacktestConfig` | 当前回测配置 |
| `results` | `BacktestResult \| null` | 最新回测结果（含持仓/净值，用于导出） |
| `loading` | `boolean` | 是否正在运行回测 |
| `error` | `string \| null` | 错误信息 |
| `lastRunAt` | `number \| null` | 上次运行时间戳 |

Actions：

| Action | 签名 | 说明 |
|--------|------|------|
| `setConfig` | `(partial: Partial<BacktestConfig>) => void` | 更新部分配置 |
| `runBacktest` | `() => Promise<void>` | 运行回测，结果写入 `results` |
| `clearResults` | `() => void` | 清空结果 |

定义位置：`src/store/backtestStore.ts`

---

## 3. 导出服务

### 3.1 服务入口

`src/services/export/backtestExportService.ts`

### 3.2 导出格式

| 格式 | 动态导入库 | 输出内容 |
|------|------------|----------|
| PDF | `jspdf`、`jspdf-autotable` | 封面摘要 + 交易明细表 |
| Excel | `xlsx`（SheetJS） | 4 个 Sheet：摘要、持仓、交易记录、净值序列 |

### 3.3 导出 Sheet 名称

由 `src/constants/backtest.constants.ts` 中 `BACKTEST_EXCEL_SHEETS` 定义：

- `summary` → `摘要`
- `positions` → `持仓`
- `trades` → `交易记录`
- `dailyValues` → `净值序列`

### 3.4 文件名模板

默认：`回测报告_{策略标签}_{YYYY-MM-DD}.{pdf|xlsx}`

由 `BACKTEST_EXPORT_FILENAME` 常量定义。

### 3.5 API

```ts
async function exportBacktestReport(
  result: BacktestResult,
  config: BacktestConfig,
  exportConfig: BacktestExportConfig,
): Promise<BacktestExportResult>
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `result` | `BacktestResult` | `backtestStore.results` |
| `config` | `BacktestConfig` | `backtestStore.config` |
| `exportConfig.format` | `'pdf' \| 'excel'` | 导出格式 |
| `exportConfig.filename` | `string`（可选） | 自定义文件名前缀 |

约束：

- **导出数据仅读取 `backtestStore`，禁止在导出逻辑中重复计算回测结果。**
- 第三方库全部通过 `import()` 动态加载，避免增加主包体积。

---

## 4. 常量

`src/constants/backtest.constants.ts`

| 常量 | 说明 |
|------|------|
| `BACKTEST_STRATEGY_LABELS` | 策略代码到中文标签映射 |
| `BACKTEST_EXCEL_SHEETS` | Excel Sheet 名称 |
| `BACKTEST_EXPORT_FILENAME` | 默认文件名前缀 |
| `BACKTEST_EXPORT_DATE_FORMAT` | 文件名日期格式 |

---

## 5. 页面集成

`src/pages/analysis/BacktestPage.tsx`

- 使用 `BACKTEST_STRATEGY_LABELS` 替换硬编码策略选项。
- 新增「导出 PDF」「导出 Excel」按钮，调用 `exportBacktestReport`。
- 导出按钮仅在存在 `results` 时可用。

---

## 6. 变更日志

| 版本 | 日期 | 说明 |
|------|------|------|
| v2.4.0 | 2026-07-02 | DA-006：新增回测报告 PDF/Excel 导出，BacktestResult 扩展 `positions`/`dailyValues`，新增 `backtestExportService`、`backtest.constants.ts`、`backtest.types.ts` |
