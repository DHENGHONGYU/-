---
title: P1 批次行动清单 — 2026-07-05
type: reference
domain: project
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 批次执行顺序 按依赖关系与风险由低到高执行："
tags: [project, changelog, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-PROJ-213
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-QA-035, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# P1 批次行动清单 — 2026-07-05

## 批次执行顺序
按依赖关系与风险由低到高执行：

**A → E → D → C → B → F**

- A：颜色令牌迁移（纯 UI 常量替换，零业务风险）
- E：事务工具推广（新增 core/transaction.ts，独立验证）
- D：UseCase 抽取（依赖事务工具）
- C：Service 直调修正（依赖 UseCase / core 路由）
- B：上帝 Store 拆分（影响面最大，最后执行）
- F：MCP-DataBridge 集成（独立模块，可在任意批次后执行）

## 批次 A：颜色令牌迁移

- 修改 `src/components/chart/ScoreRadar.tsx`：默认 fill/stroke 改为引用 `CHART_PALETTE` 常量。
- 修改 `src/components/chart/FactorHeatmap.tsx`：移除 rgb 硬编码，改为 `CHART_PALETTE.factorHeatmap`。
- 修改 `src/cockpit/widgets/SectorHeatmapWidget.tsx`：移除 Tailwind 颜色类字面量与 rgb 计算，改为 theme tokens。

## 批次 E：事务工具推广

- 新建 `src/core/transaction.ts`：
  - `runInTransaction<T>(stores: string[], mode: IDBTransactionMode, callback: (tx: IDBTransaction) => Promise<T>): Promise<T>`
  - 自动回滚/错误处理/超时。
- 在 `src/data/db.ts` 中暴露 `getDatabase()` 只读访问。
- 应用到 `executePlan.useCase.ts`、`submitOrder.useCase.ts`、`portfolioService.rebalance()`。

## 批次 D：UseCase 抽取

- 新建 `src/services/useCase/getUnifiedStockView.useCase.ts`
- 新建 `src/services/useCase/rebalancePortfolio.useCase.ts`
- 新建 `src/services/useCase/runDualStrategy.useCase.ts`
- 新建 `src/services/useCase/generateTradeReview.useCase.ts`
- 将原 `unifiedStockService.getUnifiedStockView`、`portfolioService.rebalance`、`dualStrategyEngine.runDualStrategy`、`tradeReviewAI.generateReviewAsync` 内部逻辑迁移到对应 UseCase，原函数改为薄包装。

## 批次 C：Service 直调修正

- 将 `analysis/dataFreshnessGuard` 下沉到 `src/core/freshnessGuard.ts`
- 将 `llm/llmClient.chat()` 封装到 `src/services/llm/llmGateway.ts`（L3 服务）
- 将跨域直调改为调用 UseCase / core 工具 / L3 gateway：
  - `dualStrategyEngine` → `RunDualStrategyUseCase`
  - `inputService` → `FetcherOrchestratorUseCase`
  - `strategyEngine` → `HotSectorQueryUseCase`
- 修正 audit:layers 检测到的 services → store 直接依赖。

## 批次 B：上帝 Store 拆分

- `tradingStore.ts` → `watchlistStore.ts` + `signalAdviceStore.ts` + `portfolioStore.ts`
- `marketDataStore.ts` → 按 widget/舱室拆分为多个 `DataSourceStore`
- `dualStrategyStore.ts` 改为只读 facade，或恢复独立策略 Store
- `positionStore.ts` 去除 `useOrderStore` 直接引用，改为 DataBridge 订阅
- `orderStore.ts` 保留 orders 可信源，派生计算拆分到 `positionComputer/pnlComputer/riskComputer`

## 批次 F：MCP-DataBridge 集成

- 修改 `src/mcp/bridge/mcpBridge.ts`：
  - 在 `callTool` 路径中加入 `DataBridge.forward()` 信封写入（用于审计日志/数据变更）
  - 读取路径仍走现有 Client/Server 分发
- 新增 `src/mcp/core/mcpAuditLogger.ts` 记录所有 MCP tool 调用
