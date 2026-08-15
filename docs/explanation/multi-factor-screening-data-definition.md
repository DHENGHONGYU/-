---
title: multi-factor-screening-data-definition
type: explanation
domain: data
phase: planning
tier: important
status: deprecated
maintainer: V9 Architecture Team
summary: "多因子选股筛选器（DA-007）支持基于 PE、PB、ROE、市值、营收增速、净利润增速 六个因子构建条件组，对全量股票进行筛选，并支持模板保存/加载与 CSV 导出。"
tags: [data, data-definition, screening, plan, factor, explanation]
version: v1.0.0
last_updated: 2026-08-15
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-DATA-011
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
    changes: "DEPRECATED（2026-07-14）；2026-08-15 系统性核对：仍保持废弃状态，最新定义见 docs/explanation/design/multi-factor-screening-data-definition.md v1.0.1 与 docs/reference/data-dictionary-index.md v1.1.0。"
    date: 2026-08-15
---

# DEPRECATED - multi-factor-screening-data-definition.md

> ⚠️ **此文件已废弃**（2026-07-14）
> 
> 数据字典已整合至 `docs/reference/data-dictionary-index.md`，请通过主索引访问最新定义。

---

# 多因子选股筛选器数据字典

> **Version**：v1.0.0  
> **Date**：2026-07-05（版本号补标）  
> **模块代号**：DA-007

## 模块概述

多因子选股筛选器（DA-007）支持基于 PE、PB、ROE、市值、营收增速、净利润增速 六个因子构建条件组，对全量股票进行筛选，并支持模板保存/加载与 CSV 导出。

## 集成合约

严格遵循四步集成合约：

1. **类型** — `src/types/modules/screening.types.ts`
2. **Store** — `src/store/multiFactorScreeningStore.ts`
3. **Builder** — `src/services/screening/multiFactorScreeningEngine.ts`
4. **UI** — `src/pages/analysis/MultiFactorFilterPage.tsx` + `src/components/organisms/analysis/screening/MultiFactorFilterPanel.tsx`

## 核心类型

| 类型 | 文件 | 说明 |
|------|------|------|
| `ScreeningFactor` | `src/types/modules/screening.types.ts` | 可筛选因子枚举：`pe`/`pb`/`roe`/`marketCap`/`revenueGrowth`/`profitGrowth` |
| `ScreeningOperator` | 同上 | 操作符：`gt`/`lt`/`gte`/`lte`/`eq`/`between` |
| `ScreeningLogic` | 同上 | 条件组内逻辑：`and` / `or` |
| `ScreeningCriterion` | 同上 | 单条筛选条件（因子、操作符、数值、区间上限） |
| `ScreeningConditionGroup` | 同上 | 条件组（ID、逻辑、条件列表） |
| `ScreeningTemplate` | 同上 | 用户保存的模板（名称、条件组、时间戳） |
| `ScreenableStockData` | 同上 | 可被筛选的股票数据视图 |
| `ScreeningResultItem` | 同上 | 筛选结果（包含 `matchedGroups`） |
| `ScreeningRunResult` | 同上 | 一次筛选运行的结果元数据 |

## 数据源

- 全量股票代码通过 `dataLayer.stocks.list()` 获取。
- 股票详细指标通过 `getUnifiedStockViews(symbols, { includeQuotes: false, includeV6Score: false })` 获取。
- `revenueGrowth` / `profitGrowth` 当前由统一视图预留字段承载，后续接入真实财报数据后自动生效。

## 筛选规则

- 条件组内部按 `and`/`or` 计算。
- 多个条件组之间为 **且** 关系，即股票必须命中所有条件组才进入结果。
- 当某因子值为 `null` 时，该条件判定为不匹配。

## 持久化

- 模板使用 `LocalStorageManager`（命名空间 `multiFactorScreening`）存储，key 为 `templates`。

## 导出格式

- CSV 带 UTF-8 BOM，列：代码、名称、行业、PE、PB、ROE、总市值(亿)、营收增速(%)、净利润增速(%)。

## 相关文件

- `src/config/multiFactorScreeningConfig.ts`：因子元数据、操作符、逻辑选项、存储 key。
- `src/config/routes.ts`：页面路由 `/analysis/multi-factor-screening`。
