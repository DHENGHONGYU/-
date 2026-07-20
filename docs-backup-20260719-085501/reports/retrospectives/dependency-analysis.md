---
title: TODO-ADD-TITLE
type: reports
domain: project
phase: requirements
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "生成时间: 2026-07-15T23:45:26.236Z"
tags: [project, research, spec, report]
version: v1.0.0
last_updated: 2026-07-16
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-16
---

# 依赖分析报告

生成时间: 2026-07-15T23:45:26.236Z

## 模块统计

| 指标 | 数值 |
|------|------|
| 总模块数 | 3446 |
| 总依赖数 | 9188 |
| 循环依赖数 | 0 |
| 孤立模块数 | 125 |

## 循环依赖

无循环依赖 ?

## 孤立模块

- src/cockpit/data/mockDataProvider.ts
- src/components/componentRegistry.ts
- src/config/analysisTemplatesConfig.ts
- src/config/apiPaths.ts
- src/config/collectConfig.ts
- src/config/dataDimensions.ts
- src/config/dataSourceUrls.ts
- src/config/hybridProofreadConfig.ts
- src/config/inputConfig.ts
- src/config/marketDataEndpoints.ts
- src/config/mathConstants.ts
- src/config/mcpAclMatrix.ts
- src/config/mcpAclMonitoring.ts
- src/config/mcpServerRegistry.ts
- src/config/multiFactorScreeningConfig.ts
- src/config/quality-gate.config.ts
- src/config/rbacThresholds.ts
- src/config/symbols.ts
- src/config/timeouts.ts
- src/config/uiPlaceholders.ts
- src/constants/ai-center.constants.ts
- src/constants/backtest.constants.ts
- src/constants/execution.constants.ts
- src/constants/health.constants.ts
- src/constants/healthStatusStyles.ts
- src/constants/math.constants.ts
- src/constants/newsColorTokens.ts
- src/constants/pool.constants.ts
- src/constants/score.constants.ts
- src/constants/sectorConstants.ts
- src/constants/store-channels.constants.ts
- src/core/dataflow/dataflowTypes.ts
- src/core/entityValidators.ts
- src/core/refreshCoordinator.ts
- src/core/result.ts
- src/core/statistics.ts
- src/data/industryHierarchy.ts
- src/data/sectorDefinitions.ts
- src/data/sectorSkillData.ts
- src/data/types.ts
- src/data/types/types.collectConfig.ts
- src/data/types/types.customAgent.ts
- src/data/types/types.dataLayer.ts
- src/data/types/types.execution.ts
- src/data/types/types.hybridProofread.ts
- src/data/types/types.knowledge.ts
- src/data/types/types.marketData.ts
- src/data/types/types.order.ts
- src/data/types/types.portfolio.ts
- src/data/types/types.rbac.ts
- src/data/types/types.rotation.ts
- src/data/types/types.schemaMigrations.ts
- src/data/types/types.score.ts
- src/data/types/types.scoreDoc.ts
- src/data/types/types.sector.ts
- src/data/types/types.sevenDimensions.ts
- src/data/types/types.signal.ts
- src/data/types/types.stock.ts
- src/data/types/types.strategy.ts
- src/data/types/types.traceRecords.ts
- src/data/types/types.tradeReview.ts
- src/data/types/types.workflow.ts
- src/fixtures/dualStrategyMockData.ts
- src/generated/tokens.ts
- src/i18n/zh-CN.ts
- src/lib/batchQueue.ts
- src/lib/derivedCache.ts
- src/lib/errors.ts
- src/lib/format.ts
- src/lib/precision.ts
- src/lib/safeCoerce.ts
- src/lib/seededRandom.ts
- src/lib/store-audit/types.ts
- src/lib/xssSanitizer.ts
- src/services/analysis/industryChainData.ts
- src/services/backtest/backtestTypes.ts
- src/services/fetcher/fetcherTypes.ts
- src/services/fetcher/types.ts
- src/services/llm/llmTypes.ts
- src/services/pwa/registerServiceWorker.ts
- src/services/scoring/v6ScorePrompt.ts
- src/services/storage/storageProvider.ts
- src/services/system/aiMemoryService.ts
- src/services/system/healthDashboardService.ts
- src/services/trading/pnlComputer.ts
- src/services/trading/positionComputer.ts
- src/services/trading/tradeReviewScoring.ts
- src/showcase/types.ts
- src/theme.config.ts
- src/types/base.types.ts
- src/types/guards.ts
- src/types/modules/agent.types.ts
- src/types/modules/ai-center.types.ts
- src/types/modules/analysisOrchestrator.types.ts
- src/types/modules/backtest.types.ts
- src/types/modules/cascade.types.ts
- src/types/modules/collection.types.ts
- src/types/modules/data-sync.types.ts
- src/types/modules/databridge.types.ts
- src/types/modules/dataflow.types.ts
- src/types/modules/doc-validation.types.ts
- src/types/modules/engine.types.ts
- src/types/modules/health.types.ts
- src/types/modules/input.types.ts
- src/types/modules/mcp.types.ts
- src/types/modules/news.types.ts
- src/types/modules/page.types.ts
- src/types/modules/perf.types.ts
- src/types/modules/pool.types.ts
- src/types/modules/prediction.types.ts
- src/types/modules/rbac.types.ts
- src/types/modules/risk.types.ts
- src/types/modules/score.types.ts
- src/types/modules/screening.types.ts
- src/types/modules/service.types.ts
- src/types/modules/strategy.types.ts
- src/types/modules/system.types.ts
- src/types/modules/trade.types.ts
- src/types/modules/tradeReview.types.ts
- src/types/modules/tradeReviewAI.types.ts
- src/types/modules/widget.types.ts
- src/types/modules/workflow.types.ts
- src/types/role.types.ts
- src/types/widget.ts
- src/vite-env.d.ts

## 不可达模块

无不可达模块 ?

## 问题统计

| 级别 | 数量 |
|------|------|
| 错误 | 0 |
| 警告 | 0 |
