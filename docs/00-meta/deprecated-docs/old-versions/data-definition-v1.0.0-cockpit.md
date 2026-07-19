---
title: 驾驶舱 Widget 数据定义
type: meta
domain: data
phase: design
tier: standard
status: deprecated
maintainer: V9 Architecture Team
summary: "## 1. 定位 驾驶舱（command cabin）通过 WidgetRegistry 注册并管理可拖拽 Widget。本文档是 Widget 元信息、数据源与注册表 API 的单一事实源。"
tags: [data, data-definition, cockpit, widget]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
deprecated_by: "Cockpit Data Definition v2.0"
changes: Initial version established
date: 2026-07-17
---

# 驾驶舱 Widget 数据定义

> **Status**: Current  
> **Version**: v1.0.0  
> **Last Updated**: 2026-07-12  
> **Related**: `src/cockpit/core/widgetRegistry.ts`、`src/constants/cockpit.constants.ts`、`src/types/modules/widget.types.ts`

---

## 1. 定位

驾驶舱（command cabin）通过 **WidgetRegistry** 注册并管理可拖拽 Widget。本文档是 Widget 元信息、数据源与注册表 API 的**单一事实源**。

**新增 / 修改 Widget 必须同步三处**（见 `../../../../AGENTS.md` 与项目记忆「驾驶舱 Widget 扩展」）：

1. `src/cockpit/core/widgetRegistry.ts` — 注册 `WidgetTemplate`
2. `src/constants/cockpit.constants.ts` — `DEFAULT_WIDGET_CONFIG`（标题 / 分类 / 尺寸）+ `WIDGET_DEFAULT_DATA_SOURCE`（默认数据源 / 端点）
3. Widget 组件消费 `useMarketData()`，颜色走令牌（禁止硬编码）

---

## 2. 类型定义

类型来自 `src/types/modules/widget.types.ts`：

| 类型 | 说明 |
|------|------|
| `WidgetMeta` | Widget 元信息：`id`、`name`、`category`、`description`、`defaultSize`、`defaultDataSource`、`defaultConfig` |
| `WidgetConfig` | 实例配置：`instanceId`、`widgetId`、`size`、`position`、`title`、`settings`、`visible`、`collapsed`、`dataSource` |
| `WidgetRuntimeState` | 运行态：`instanceId`、`widgetId`、`status`（`idle`/…） |
| `MarketData` | Widget 统一接收的市场数据，可由 `MarketDataProvider` 注入 |

`WidgetTemplate`（注册单元）：

```ts
interface WidgetTemplate {
  meta: WidgetMeta
  component: () => Promise<{ default: React.ComponentType<{ config: WidgetConfig; data?: MarketData }> }>
  configPanel?: () => Promise<{ default: React.ComponentType }>
}
```

---

## 3. Widget 清单（22 个）

官方分类（`cockpit.constants.ts` `category`）：`market`、`portfolio`、`strategy`、`analysis`、`ai`。下表按业务域归类。

### 3.1 行情市场（market）

| id | 说明 | 组件 |
|----|------|------|
| `marketIndices` | 大盘指数实时数据 | `MarketIndicesWidget` |
| `sectorHeatmap` | 板块涨跌幅热力图 | `SectorHeatmapWidget` |
| `fundFlow` | 资金流向数据 | `FundFlowWidget` |
| `marketSentiment` | 市场情绪指标 | `MarketSentimentWidget` |

### 3.2 自选与持仓（portfolio）

| id | 说明 | 组件 |
|----|------|------|
| `watchlist` | 自选股列表（端点 `/user/watchlist`） | `WatchlistWidget` |
| `watchlistMovers` | 自选股涨幅榜 / 跌幅榜 / 振幅榜 | `WatchlistMoversWidget` |
| `portfolioOverview` | 持仓概览 | `PortfolioOverviewWidget` |

### 3.3 策略与评分（strategy）

| id | 说明 | 组件 |
|----|------|------|
| `aiTradeReview` | AI 交易复盘分析 | `AITradeReviewWidget` |
| `hotSector` | 热门板块策略评分与相关标的 | `HotSectorWidget` |
| `valuePit` | 价值洼地候选、五维评分与轮动信号状态 | `ValuePitWidget` |
| `kaiScore` | KAI 选股综合评分图谱 | `KaiScoreWidget` |
| `stockPool` | 股票池管理与监控列表 | `StockPoolWidget` |

### 3.4 AI 与分析（analysis / ai）

| id | 说明 | 组件 |
|----|------|------|
| `investmentProfile` | 投资画像 / 分析中心 | `InvestmentProfileWidget` |
| `modelCompare` | AI 大模型智能对比 | `ModelCompareWidget` |
| `stockChat` | 个股 / 市场深度分析聊天 | `StockChatWidget` |

### 3.5 系统监控

| id | 说明 | 组件 |
|----|------|------|
| `agentPerformance` | 智能体性能追踪与健康状态监控 | `AgentPerformanceWidget` |
| `engineStatus` | 评分引擎运行状态与性能指标 | `EngineStatusWidget` |
| `systemArchitecture` | 系统分层架构与模块依赖可视化 | `SystemArchitectureWidget` |

### 3.6 交易与风控

| id | 说明 | 组件 |
|----|------|------|
| `pnlAnalysis` | 交易盈亏归因分析与趋势追踪 | `PnLAnalysisWidget` |
| `positionControl` | 仓位管理与风险控制面板 | `PositionControlWidget` |
| `riskMonitor` | 实时风险指标监控与预警 | `RiskMonitorWidget` |
| `signalMonitor` | 交易信号实时追踪与置信度评估 | `SignalMonitorWidget` |

---

## 4. 注册表 API（`WidgetRegistry`）

| 方法 | 说明 |
|------|------|
| `register(template)` | 注册 Widget 模板（id 重复则覆盖并告警） |
| `createInstance(widgetId, overrides?)` | 创建实例，返回 `WidgetConfig`（实例 id 形如 `<widgetId>_<n>`） |
| `removeInstance(instanceId)` | 移除实例 |
| `getTemplate(widgetId)` | 取模板 |
| `getInstance(instanceId)` | 取实例配置 |
| `getAllInstances()` | 全部实例 |
| `updateRuntimeState(instanceId, state)` | 更新运行态 |
| `getRuntimeState(instanceId)` | 取运行态 |
| `subscribe(listener)` | 订阅注册表事件（返回取消函数） |
| `getStats()` | 统计：模板数 / 实例数 / 各实例状态 |

- 构造时自动 `registerDefaultWidgets()`（22 个）+ `createDefaultInstances()`（22 个默认布局实例）。
- 单例导出：`export const widgetRegistry = new WidgetRegistry()`。

---

## 5. 默认布局

`createDefaultInstances()` 按 `defaultLayout` 创建 22 个默认实例，`position` 以 `{ x, y }` 网格定位（详见 `widgetRegistry.ts` `defaultLayout`）。

---

## 6. 变更触发

> 触发事件 **T9（Widget 注册表变更）** — 匹配 `src/cockpit/core/widgetRegistry.ts`

| 动作 | 文档 |
|------|------|
| 主更新动作 | 本文档（`../../../reference/data-definition.md`）— 注册表结构变更时整体对齐 |
| 补充文档 | 增量维护 `../../../reference/registry-index.md`（非全量重写） |
| 写后校验 | `npm run audit:docs`（是） |

> 亦受 **T1（类型定义变更）** 影响：`widget.types.ts` 变更时本文档为补充更新目标。

详见 `docs/00-meta/doc-trigger-action-map.md` §二 T9 行。
