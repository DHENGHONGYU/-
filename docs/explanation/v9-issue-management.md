---
title: V9 问题整改管理与调度记�?code_version: 2.0.0
type: explanation
domain: project
phase: planning
tier: important
status: active
maintainer: Issue Resolution Orchestrator
summary: "归并来源：`./design/v9-current-state-review.md` + `./deprecated-v9-issue-resolution-schedule.md` +...
tags: [project, plan, management, explanation, governance, documentation, strategy]
version: v1.0.0
last_updated: 2026-06-27
doc_id: V9-DOC-PROJ-067
change_log: 
---

# V9 问题整改管理与调度记�?
> 归并来源：`./design/v9-current-state-review.md` + `./deprecated-v9-issue-resolution-schedule.md` + `../00-meta/v9-next-phase-todo.md`  
> 归并日期�?026-06-27  
> 归并理由：三份文档覆盖同一问题整改流程的不同维度（执行看板、调度表、并行任务），合并后形成完整闭环

---

## 一、执行批次总览

| 批次 | 执行方式 | 状�?|
|------|----------|------|
| 批次0 | DOC-001~007 并行 | �?已完�?|
| 批次1 | ARCH/DF/INT 完全并行战团 | �?进行�?|
| 批次2 | JT-004 �?JT-002 �?JT-003 �?JT-001 串行 | �?待执�?|
| 批次3 | 全量回归收口 | �?待执�?|

---

## 二、问题状态明�?
| 问题ID | 责任Agent | 牵头Agent | 涉及文件 | 状�?|
|--------|-----------|-----------|----------|------|
| ARCH-001 | Architecture-Fix | Architecture-Fix | `src/App.tsx`, `src/services/system/bootstrapService.ts` | �?已完�?|
| ARCH-002 | Architecture-Fix | Architecture-Fix | `src/services/*/*Service.ts` �?13+ 文件 | �?待执行（批次1�?|
| ARCH-003 | Architecture-Fix | Architecture-Fix | `src/services/system/v6MigrationService.ts` | �?待执行（批次2�?|
| ARCH-004 | Architecture-Fix | Architecture-Fix | `src/services/analysis/rotationScoreService.ts` | �?待执行（批次1�?|
| ARCH-005 | Architecture-Fix | Architecture-Fix | `src/pages/analysis/ScoreDocPage.tsx`, `src/pages/trading/StrategySnapshotPage.tsx` | �?待执行（批次1�?|
| ARCH-006 | Architecture-Fix | Architecture-Fix | `src/config/themeRegistry.ts`, `src/config/symbols.ts`, `src/data/sectorDefinitions.ts` | �?待执行（批次1�?|
| ARCH-007 | Architecture-Fix | Architecture-Fix | `src/pages/analysis/IndustryScorePage.tsx`, `src/pages/analysis/IntelligentScorePage.tsx`, `src/hooks/cabin/` | �?待执行（批次2�?|
| DF-001 | Data-Flow-Fix | Data-Flow-Fix | `src/core/databridge.ts` | �?已完�?|
| DF-002 | Data-Flow-Fix | Architecture-Fix（JT-002�?| `src/services/trading/tradingService.ts` | �?待执行（批次2�?|
| DF-003 | Data-Flow-Fix | Data-Flow-Fix | `src/store/dataflowStore.ts`, `src/store/pageStore.ts`, `src/store/widgetStore.ts`, `src/store/agentStore.ts` | �?待执行（批次1�?|
| DF-004 | Data-Flow-Fix | Data-Flow-Fix | `src/core/databridge.ts` | �?待执行（批次1�?|
| DF-005 | Data-Flow-Fix | Data-Flow-Fix | `src/core/databridge.ts`, `src/core/fallbackQueue.ts` | �?待执行（批次1�?|
| DF-006 | Data-Flow-Fix | Data-Flow-Fix | `src/core/dataflow/dataflowEngine.ts` | �?待执行（批次1�?|
| DF-007 | Data-Flow-Fix | Architecture-Fix（JT-003�?| `src/data/db.ts`, `src/services/system/v6MigrationService.ts` | �?待执行（批次2�?|
| INT-001 | Interaction-Fix | Interaction-Fix | `src/apps/trading/TradingApp.tsx` | �?已完�?|
| INT-002 | Interaction-Fix | Interaction-Fix | `src/apps/input/HotSectorPanel.tsx` | �?已完�?|
| INT-003 | Interaction-Fix | Interaction-Fix | `src/apps/analysis/AnalysisApp.tsx` | �?待执行（批次1�?|
| INT-004 | Interaction-Fix | Interaction-Fix | `src/components/organisms/input/StockSearch.tsx` | �?待执行（批次1�?|
| INT-005 | Interaction-Fix | Interaction-Fix | `src/pages/input/LocalKnowledgePage.tsx` | �?待执行（批次1�?|
| INT-006 | Interaction-Fix | Architecture-Fix（JT-004�?| `src/pages/analysis/IndustryScorePage.tsx`, `src/pages/analysis/IntelligentScorePage.tsx` | �?待执行（批次2�?|
| INT-007 | Interaction-Fix | Architecture-Fix（JT-001�?| `src/App.tsx` | �?已完�?|
| DOC-001~007 | Doc-Sync-Fix | Doc-Sync-Fix | 见详�?| �?全部已完�?|

---

## 三、联合修复任�?
| 联合任务 | 牵头 Agent | 协作�?| 涉及文件 | 合并理由 |
|----------|------------|--------|----------|----------|
| JT-001 | Architecture-Fix | Interaction-Fix | `src/App.tsx` | ARCH-001 �?INT-007 均修改同一文件 |
| JT-002 | Architecture-Fix | Data-Flow-Fix | `src/services/trading/tradingService.ts` | ARCH-002 �?DF-002 均修改同一文件 |
| JT-003 | Architecture-Fix | Data-Flow-Fix | `src/services/system/v6MigrationService.ts` | ARCH-003 �?DF-007 均修改同一文件 |
| JT-004 | Architecture-Fix | Interaction-Fix | `src/pages/analysis/IndustryScorePage.tsx`, `IntelligentScorePage.tsx` | ARCH-007 �?INT-006 均修改同一文件 |

---

## 四、并行任务调度记录（已完成）

| Batch | 任务数量 | 执行 Agent | 状�?|
|-------|----------|------------|------|
| Batch-1 | 12 | Doc-Sync × 3、Refactor-Agent × 1 | �?已完�?|
| Batch-2 | 9 | Code-Reviewer × 3、Doc-Sync × 2 | �?已完�?|
| Batch-2.5 | 8 | Doc-Sync × 3 | �?已完�?|
| Batch-3 | 1 | Refactor-Agent + Test-Generator Agent | �?已完�?|

### 已完成的基线修改（V9-RC-0 �?V9-RC-0.1�?
| 文件 | 修改内容 | 验证状�?|
|------|----------|----------|
| `src/App.tsx` | 使用 `bootstrapService.initializeApp()` 替换 `db.init()` | lint �?/ build �?|
| `src/services/system/bootstrapService.ts` | 新增 | lint �?/ build �?|
| `src/core/databridge.ts` | 广播目标�?`meta.target` 改为 `targetStore` | test �?/ lint �?/ build �?|
| `src/apps/trading/TradingApp.tsx` | 增加 `processingSymbols` + `useToast` | lint �?|
| `src/apps/input/HotSectorPanel.tsx` | 增加 `addingAll` + `useToast` | lint �?|
| `tests/TradingApp.test.tsx` | mock `useToast` | test �?|

### 全量回归测试结果

| 门禁�?| 结果 |
|--------|------|
| `tsc --noEmit` | �?通过 |
| `npm run lint` | �?通过 |
| `npm test -- --run` | �?44 files / 291 tests |
| `npm run audit:layers` | �?0 违规 / 2 警告 |
| `npm run audit:hardcode` | �?389 处（基线�?|
| `npm run audit:deadcode` | �?11 处（基线�?|
| `npm run build` | �?通过 |
| `npm run test:e2e` | �?5/5 passed |

---

## 五、一键回滚预�?
若整改后出现问题，可快速回退�?
```bash
# Architecture-Fix 修改的文�?git checkout src/App.tsx src/services/system/bootstrapService.ts \
  src/services/analysis/rotationScoreService.ts src/services/analysis/sectorScoreService.ts \
  src/services/news/newsService.ts src/services/news/sentimentAnalyzer.ts \
  src/services/scoring/industryScoreService.ts src/services/scoring/intelligentScoreService.ts \
  src/services/scoring/v6ScoreService.ts src/services/stockpool/stockpoolService.ts \
  src/services/system/localDocService.ts src/services/system/v6MigrationService.ts \
  src/services/trading/strategySnapshotService.ts src/services/trading/tradingService.ts \
  src/pages/analysis/ScoreDocPage.tsx src/pages/trading/StrategySnapshotPage.tsx \
  src/config/themeRegistry.ts src/config/symbols.ts src/data/themeSymbolPool.ts \
  src/pages/analysis/IntelligentScorePage.tsx src/apps/input/InputDashboard.tsx \
  src/pages/analysis/IndustryScorePage.tsx src/hooks/cabin/

# Data-Flow-Fix 修改的文�?git checkout src/core/databridge.ts src/core/dataflow/dataflowEngine.ts \
  src/core/fallbackQueue.ts src/data/db.ts src/data/dataLayer.ts \
  src/store/dataflowStore.ts src/store/pageStore.ts src/store/widgetStore.ts \
  src/store/agentStore.ts src/services/fetcher/fetcherService.ts

# Interaction-Fix 修改的文�?git checkout src/apps/trading/TradingApp.tsx src/apps/input/HotSectorPanel.tsx \
  src/apps/analysis/AnalysisApp.tsx src/components/input/StockSearch.tsx \
  src/pages/input/LocalKnowledgePage.tsx

# Doc-Sync-Fix 修改的文�?git checkout src/vite-env.d.ts .env.example docs/05-engine-specs.md \
  docs/06-routing-specs.md docs/09-quality-gates.md docs/01-vision-and-goals.md \
  docs/02-functional-specs.md docs/04-ui-ux-specs.md docs/07-operation-strategy.md \
  docs/10-glossary.md docs/implementation/data-interaction-protocols.md \
  docs/implementation/v9-current-state-review.md docs/implementation/architecture-version-comparison.md
```

---

## 六、变更日�?
| 日期 | 版本 | 变更内容 | 变更�?|
|:---|:---|:---|:---|
| 2026-06-27 | v1.0.0 | 合并三份问题管理文档为统一记录 | Documentation Governor |
| 2026-06-25 | �?| 原始执行看板、调度表、并行任务表生成 | Issue Resolution Orchestrator |