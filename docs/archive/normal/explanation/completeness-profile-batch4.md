---
doc_id: V9-DOC-EXP-916
title: completeness-profile-batch4
code_version: "2.0.0-rc.1"
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# V9 模块完成度剖面图 — 批次 D（交易舱）

> **审计范围**：交易舱 4 个子页面  
> **审计方法**：L1 界面 → L2 状态 → L3 数据 → L4 逻辑 → L5 集成  
> **审计日期**：2026-06-27

---

## 批次 D 汇总

| 模块 | L1 界面 | L2 状态 | L3 数据 | L4 逻辑 | L5 集成 | 综合评分 | 健康度 |
|:---|:---|:---|:---|:---|:---|:---|:---|
| D1 交易舱 Hub | ✅ | 🟡 | ✅ | ✅ | ✅ | 90 | 🟢 健康 |
| D2 交易信号 | ✅ | 🟡 | ✅ | ✅ | ✅ | 90 | 🟢 健康 |
| D3 策略快照 | ✅ | 🟡 | ✅ | ✅ | ✅ | 90 | 🟢 健康 |
| D4 交易持仓 | ✅ | ✅ | ✅ | ✅ | ✅ | 100 | 🟢 健康 |

---

## D1：交易舱 Hub

| 层级 | 内容 | 状态 | 发现 |
|:---|:---|:---|:---|
| L1 界面 | `TradingHubPage.tsx` | ✅ | UI 完整，包含核心功能卡片（交易信号/模拟持仓/策略快照）和可扩展能力卡片（策略管理/策略执行/AI交易复盘/交易记录），带"数据层待建"标记 |
| L2 状态 | useState | 🟡 | 纯展示页面，仅使用 useState 管理渲染状态，无独立 Zustand Store；因页面功能简单，影响较低 |
| L3 数据 | 无数据接入 | ✅ | 纯导航页面，无需数据接入 |
| L4 逻辑 | 无业务逻辑 | ✅ | 纯展示，无复杂业务逻辑 |
| L5 集成 | 路由已注册 | ✅ | `/trading/hub` 和 `/trading` 已在 `routes.ts:91/97` 注册，category='trading' |

**问题发现**：Hub 中"交易信号"和"模拟持仓"的链接均指向 `/trading`，与 D2 交易信号共用同一路由，存在导航路径不明确的问题。

---

## D2：交易信号

| 层级 | 内容 | 状态 | 发现 |
|:---|:---|:---|:---|
| L1 界面 | `TradingApp.tsx` | ✅ | UI 完整，包含操作按钮区（加载观察池/加载持仓/扫描信号/构建核心组合）、观察池交易建议卡片、核心稀缺组合面板、全部信号列表、持仓订单列表 |
| L2 状态 | useState | 🟡 | 使用 useState 管理 stocks/orders/signals/adviceMap/portfolio/strategyResult/portfolioLoading/processingSymbols，无独立 Zustand Store |
| L3 数据 | `tradingService` + `portfolioBuilder` + `signalGenerator` | ✅ | `getWatchlistStocks`/`getOrders`/`createBuyOrder`/`createSellOrder`/`scanWatchingSignals`/`adviseForStock` 通过数据层获取数据 |
| L4 逻辑 | `tradingService.ts` + `strategyEngine.ts` + `riskEngine.ts` + `positionSizer.ts` | ✅ | 核心逻辑完整：观察池加载、信号扫描、AI 交易建议、风控评估、仓位计算、组合构建、买卖下单 |
| L5 集成 | 路由已注册 | ✅ | `/trading` 已在 `routes.ts:97` 注册，category='trading' |

**问题发现**：`TradingApp.tsx` 使用大量 useState（9 个状态变量），状态管理分散，不利于跨组件共享和维护。

---

## D3：策略快照

| 层级 | 内容 | 状态 | 发现 |
|:---|:---|:---|:---|
| L1 界面 | `StrategySnapshotPage.tsx` | ✅ | UI 完整，包含面包屑、标题、Tabs（当前策略/历史快照）、保存快照按钮、三策略分组卡片（核心稀缺/热点动量/价值洼地）、历史快照列表、快照详情、变更追踪面板 |
| L2 状态 | useState | 🟡 | 使用 useState 管理 activeTab/stocks/v6Scores/rotationScores/items/snapshots/selectedSnapshot/loading/saving/error，无独立 Zustand Store |
| L3 数据 | `strategySnapshotService` + `stockpoolService` + `v6ScoreService` + `rotationScoreService` | ✅ | `classifyStocks`/`listSnapshots`/`saveStrategySnapshot`/`listStocks`/`getAllV6Scores`/`listRotationScores` 通过数据层获取数据 |
| L4 逻辑 | `strategySnapshotService.ts` | ✅ | 核心逻辑完整：多源数据整合、股票分类（核心/热点/价值）、快照保存、历史查询、变更对比 |
| L5 集成 | 路由已注册 | ✅ | `/trading/strategy-snapshots` 已在 `routes.ts:177` 注册，category='trading' |

**问题发现**：`StrategySnapshotPage.tsx` 使用 10 个 useState，状态管理分散；与 D4 交易持仓共用 `/trading` 作为父路由，但策略快照页面无独立导航入口（需从 Hub 进入）。

---

## D4：交易持仓

| 层级 | 内容 | 状态 | 发现 |
|:---|:---|:---|:---|
| L1 界面 | `HoldingsPage.tsx` | ✅ | UI 完整，已在批次 A 审计，包含面包屑、标题、筛选区、数据表格、分页、交易确认弹窗 |
| L2 状态 | `useHoldingsStore` | ✅ | 独立 Zustand Store，已在批次 A 创建，支持跨组件状态共享和 DataBridge 订阅 |
| L3 数据 | `holdingsService` + DataBridge | ✅ | `fetchHoldings`/`executeTradeAction`/`exportHoldingsCSV` 通过数据层获取数据，支持 DataBridge 订阅 |
| L4 逻辑 | `holdingsStore.ts` + `holdingsService.ts` | ✅ | 核心逻辑完整：数据加载、筛选、分页、交易操作、导出 |
| L5 集成 | 路由已注册 | ✅ | `/trading/holdings` 已在 `routes.ts:183` 注册，category='trading' |

**问题发现**：交易持仓模块状态管理已完善（Zustand + DataBridge），是交易舱中架构最完整的模块。

---

## 批次 D 问题汇总

| 编号 | 模块 | 严重度 | 问题描述 | 文件路径 |
|:---|:---|:---|:---|:---|
| D1-P2-001 | 交易舱 Hub | P2 | Hub 中"交易信号"和"模拟持仓"链接均指向 `/trading`，导航路径不明确 | `src/pages/trading/TradingHubPage.tsx:36/42` |
| D1-P2-002 | 交易舱 Hub | P2 | 无独立 Zustand Store | `src/apps/trading/TradingApp.tsx` |
| D2-P2-003 | 交易信号 | P2 | 使用 9 个 useState，状态管理分散，无独立 Zustand Store | `src/apps/trading/TradingApp.tsx` |
| D3-P2-004 | 策略快照 | P2 | 使用 10 个 useState，状态管理分散，无独立 Zustand Store | `src/pages/trading/StrategySnapshotPage.tsx` |

---

## 批次 D 健康度评估

| 健康度 | 模块数 | 说明 |
|:---|:---|:---|
| 🟢 健康 | 4 | D1-D4 均无 ❌ 缺失层，功能完整可用 |
| 🟡 需关注 | 0 | — |
| 🔴 过时 | 0 | — |

**结论**：批次 D（交易舱）整体良好，4 个模块均健康可用。D4 交易持仓已在批次 A 中完成 Zustand Store 改造，是交易舱中架构最完善的模块。主要问题为 D1-D3 缺少独立 Zustand Store（P2 级），以及 Hub 导航路径不明确（P2 级）。