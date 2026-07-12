---
title: 状态管理规范
code_version: 2.0.0
---

# 状态管理规范

> **Status**: Current  
> **Version**: v1.0.0  
> **Last Updated**: 2026-07-12  
> **Related**: `src/store/`、`src/lib/withBroadcast.ts`、`src/store/helpers/`、`docs/02-design/data-flow-spec.md`

---

## 1. 定位与职责

V9 的状态层（`src/store/`）基于 **Zustand**，采用**平铺目录结构**（无业务子目录，仅 `helpers/` 放公共工具）。所有跨 Tab 同步通过 `withBroadcast` 广播；所有落盘写操作**禁止直接调用 IndexedDB**，必须经 `DataBridge.forward()` 委托（见 `AGENTS.md` §一 依赖方向）。

| 职责 | 属于状态层 | 不属于状态层 |
|------|-----------|-------------|
| 持有 UI / 业务运行态、派生计算、跨 Tab 广播 | ✅ | |
| 直接读写 IndexedDB | | ✅，经 `DataBridge` |
| 发起网络请求 / 采集 | | ✅，由 `services/` |
| 渲染、路由 | | ✅，由 `pages/` `components/` |

---

## 2. 跨 Tab 广播

`withBroadcast` 的**实际实现**位于 `src/lib/withBroadcast.ts`（导出 `withBroadcast`、`createBroadcaster`）。

- `src/store/helpers/withBroadcast.ts` 为**已废弃的 re-export 垫片**，新代码请直接 `import { withBroadcast } from '@/lib/withBroadcast'`。
- `src/store/helpers/withOptimisticUpdate.ts` 提供乐观更新包装。

> 规范：新增 Store 若需跨 Tab 一致，必须用 `withBroadcast` 包装 `set`；禁止使用 `localStorage` 直接同步业务态（基础设施白名单除外）。

---

## 3. Store 总览

`src/store/` 当前共 **99 个 `.ts` 文件**（含测试与 helpers），其中非测试 Store 约 **60 个**，按业务域分组如下。

### 3.1 市场行情与数据采集

| Store | 职责 |
|-------|------|
| `marketDataStore` | 行情快照与实时报价缓存 |
| `databridgeStore` | DataBridge 路由与转发状态 |
| `dataflowStore` | 数据流编排状态 |
| `dataTestStore` | 数据自测任务态 |
| `collectionRuntimeStore` | 采集运行时任务态 |
| `collectionWizardStore` | 采集向导步骤态 |
| `sevenDimConfigStore` | 七维配置 |

### 3.2 分析与评分

| Store | 职责 |
|-------|------|
| `analysisStore` / `analysisStore.derived` | 分析舱主态与派生 |
| `analysisHubStore` | 分析中心聚合 |
| `analysisNewsStore` | 分析舱新闻态 |
| `stockAnalysisStore` | 个股分析 |
| `sectorAnalysisStore` | 板块分析 |
| `industryScoreStore` | 行业评分 |
| `intelligentScoreStore` | 智能选股评分 |
| `multiFactorScreeningStore` | 多因子筛选 |
| `scoreDocStore` | 评分文档 |
| `engineStore` | 评分引擎运行态 |
| `backtestStore` | 回测 |

### 3.3 交易与持仓

| Store | 职责 |
|-------|------|
| `tradingStore` / `tradingHubStore` | 交易舱主态 / 聚合 |
| `holdingsStore` | 持仓 |
| `portfolioStore` | 组合 |
| `positionStore` | 仓位 |
| `orderStore` | 委托单 |
| `executionStore` / `executionStoreSubscriptions` | 执行与订阅 |
| `runtimeTradingConfigStore` | 运行时交易配置 |
| `strategySnapshotStore` | 策略快照 |
| `dualStrategyStore` | 双策略 |
| `disciplineStore` | 交易纪律 |

### 3.4 信号与风控

| Store | 职责 |
|-------|------|
| `signalStore` | 交易信号 |
| `signalQualityStore` / `.derived` | 信号质量与派生 |
| `signalAdviceStore` | 信号建议 |
| `rotationSignalStore` / `.derived` | 轮动信号与派生 |
| `riskStore` / `.derived` | 风险与派生 |
| `valuePitStore` | 价值洼地 |
| `hotSectorStore` | 热门板块 |

### 3.5 自选、输出与复盘

| Store | 职责 |
|-------|------|
| `watchlistStore` | 自选股 |
| `poolStore` | 股票池 |
| `outputStore` | 输出舱 |
| `hybridProofreadStore` | 混合校对 |

### 3.6 智能体与系统

| Store | 职责 |
|-------|------|
| `agentStore` / `agentFeedbackStore` / `customAgentStore` | 智能体与反馈 |
| `mcpServerStore` | MCP 服务 |
| `commandStore` | 指挥舱 |
| `systemMonitorStore` | 系统监控 |
| `pageStore` | 页面可见性 |
| `widgetStore` | Widget 布局 |
| `chatStore` / `.derived` | 聊天与派生 |
| `localKnowledgeStore` | 本地知识 |
| `workflowStore` | 工作流 |

### 3.7 公共与派生

- `helpers/withBroadcast.ts`（废弃 re-export）、`helpers/withOptimisticUpdate.ts`
- `derived.index.ts`（派生 Store 统一索引）

---

## 4. 编码规范

1. **测试同目录**：`xxxStore.test.ts` 与 Store 同目录，覆盖核心 set/get。
2. **派生分离**：派生计算放入 `xxxStore.derived.ts`，勿污染主 Store。
3. **事件清理**：`useEffect` 中订阅 Store/EventBus 必须在 cleanup 显式取消（见 `AGENTS.md` 标准清理模板）。
4. **日志前缀**：`[Store名] 操作名`，如 `[MarketData] refresh()`。

---

## 5. 变更触发

> 触发事件 **T5（Store 状态管理变更）** — 匹配 `src/store/**/*.ts`

| 动作 | 文档 |
|------|------|
| 主更新动作 | 本文档（`docs/02-design/STATE_MANAGEMENT.md`） |
| 补充文档 | `docs/02-design/data-flow-spec.md` |
| 写后校验 | `npm run audit:docs`（是） |

详见 `docs/00-meta/doc-trigger-action-map.md` §二 T5 行。
