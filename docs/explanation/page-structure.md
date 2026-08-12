---
title: 页面结构与五舱布局
type: explanation
domain: frontend
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 1. 定位 V9 前端采用五舱（cabin）架构，页面统一置于 `src/pages/<cabin>/`，路由定义集中于 `src/config/routes.ts`（详见..."
tags: [frontend, plan, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-FRONT-039
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 页面结构与五舱布局

> **Status**: Current  
> **Version**: v1.0.0  
> **Last Updated**: 2026-07-12  
> **Related**: `src/pages/`、`src/config/routes.ts`、`../reference/06-routing-specs.md`

---

## 1. 定位

V9 前端采用**五舱（cabin）架构**，页面统一置于 `src/pages/<cabin>/`，路由定义集中于 `src/config/routes.ts`（详见 `../reference/06-routing-specs.md`）。各舱室规格见 `docs/specs/design/*-cabin-spec.md`。

---

## 2. 五舱总览

| 舱室 | 目录 | 页面文件数 | 职责 |
|------|------|-----------|------|
| 输入舱 | `src/pages/input/` | 4 | 数据采集、配置、本地知识 |
| 分析舱 | `src/pages/analysis/` | 16 | 评分、筛选、回测、新闻、板块 |
| 交易舱 | `src/pages/trading/` | 10 | 持仓、组合、风控、流水 |
| 输出舱 | `src/pages/output/` | 6 | 看板、研报、复盘向导 |
| 指挥舱 | `src/pages/command/` | 25 | 智能体、MCP、健康、Showcase |

---

## 3. 各舱页面清单

### 3.1 输入舱（input）

- `CollectTaskPage.tsx` — 采集任务
- `FetcherConfigPage.tsx` — 采集器配置
- `LocalKnowledgePage.tsx` — 本地知识
- `SevenDimConfigPage.tsx` — 七维配置

### 3.2 分析舱（analysis）

- `BacktestPage.tsx` — 回测
- `HotSectorPage.tsx` — 热门板块（含 `.test.tsx`）
- `IndustryScorePage.tsx` — 行业评分
- `IntelligentScorePage.tsx` — 智能选股评分
- `MultiFactorFilterPage.tsx` — 多因子筛选
- `NewsPage.tsx` — 新闻
- `ScoreComparisonPage.tsx` — 评分对比
- `ScoreDocPage.tsx` — 评分文档
- `SectorAnalysisPage.tsx` — 板块分析（含 `.test.tsx`）
- `StockAnalysisPage.tsx` — 个股分析（含 `.test.tsx`）
- `StockPoolBoardPage.tsx` — 股票池看板
- `ValuePitPage.tsx` — 价值洼地（含 `.test.tsx`）

### 3.3 交易舱（trading）

- `HoldingsPage.tsx` — 持仓
- `PortfolioPage.tsx` — 组合
- `RiskControlPage.tsx` — 风控
- `StrategySnapshotPage.tsx` — 策略快照
- `TradingFlowPage.tsx` — 交易流水
- `components/` — `HoldingsFilter`、`HoldingsTable`、`Pagination`、`TradeModal`、`VirtualizedHoldingsTable`

### 3.4 输出舱（output）

- `DashboardPage.tsx` — 看板
- `OutputHubPage.tsx` — 输出中心（含 `__tests__`）
- `ResearchReportPage.tsx` — 研报
- `ReviewWizardPage.tsx` — 复盘向导
- `TradeReviewPage.tsx` — 交易复盘

### 3.5 指挥舱（command）

- `MCPServerDashboardPage.tsx` — MCP 服务看板（含 `__tests__`）
- `agent/` — `AgentDetailPage`、`AgentFeedbackPage`、`AgentHubPage`、`AgentRegistryPage`、`AgentTasksPage`、`AgentTriggerPage`、`ApiConfigurationPage`、`CapabilityGraphPage`、`ChangelogPage`、`CustomAgentPage`、`DagSchedulerPage`、`DataLabelManagementPage`、`LlmManagementPage`、`ModelUpgradePage`、`OptimizationSuggestionsPage`、`SkillAuditPage`（部分含 `__tests__`）
- `health/HealthDashboardPage.tsx` — 健康看板
- `showcase/ComponentShowcasePage.tsx` — 组件 Showcase

---

## 4. 舱室规格文档

| 舱室 | 规格文档 |
|------|---------|
| 输入舱 | `../reference/input-cabin-spec.md` |
| 分析舱 | `../reference/analysis-cabin-spec.md` |
| 交易舱 | `../reference/trading-cabin-spec.md` |
| 输出舱 | `../reference/output-cabin-spec.md` |
| 指挥舱 | `../reference/command-cabin-spec.md` |

---

## 5. 变更触发

> 触发事件 **T8（页面组件变更）** — 匹配 `src/pages/**/*.tsx`、`src/pages/**/*.ts`

| 动作 | 文档 |
|------|------|
| 主更新动作 | 本文档（`./page-structure.md`） |
| 补充文档 | `../reference/06-routing-specs.md` |
| 写后校验 | `npm run audit:docs`（是） |

详见 `docs/meta/doc-trigger-action-map.md` §二 T8 行。
