---
title: deprecated-v9-issue-execution-board
tier: reference
code_version: 2.0.0
status: archived
---

tier: reference
code_version: 2.0.0
---

# V9 问题整改执行看板

> 调度官：Multi-Agent Orchestrator  
> 基线版本：V9-RC-0  
> 最后更新：2026-06-25

---

## 执行批次总览

| 批次 | 执行方式 | 状态 |
|------|----------|------|
| 批次0 | DOC-001~007 并行 | ✅ 已完成 |
| 批次1 | ARCH/DF/INT 完全并行战团 | ⏳ 进行中 |
| 批次2 | JT-004 → JT-002 → JT-003 → JT-001 串行 | ⏳ 待执行 |
| 批次3 | 全量回归收口 | ⏳ 待执行 |

---

## 问题状态明细

| 问题ID | 责任Agent | 修改代码责任（牵头Agent） | 涉及文件 | 状态 |
|--------|-----------|---------------------------|----------|------|
| ARCH-001 | Architecture-Fix | Architecture-Fix | `src/App.tsx`, `src/services/system/bootstrapService.ts` | ✅ 已完成（已作为 JT-001 一部分执行） |
| ARCH-002 | Architecture-Fix | Architecture-Fix | `src/services/*/*Service.ts` 等 13+ 文件 | ⏳ 待执行（批次1 / 与 DF-002 在 tradingService.ts 联合为 JT-002） |
| ARCH-003 | Architecture-Fix | Architecture-Fix | `src/services/system/v6MigrationService.ts` → `src/services/system/migration/` | ⏳ 待执行（批次2 JT-003） |
| ARCH-004 | Architecture-Fix | Architecture-Fix | `src/services/analysis/rotationScoreService.ts` | ⏳ 待执行（批次1） |
| ARCH-005 | Architecture-Fix | Architecture-Fix | `src/pages/analysis/ScoreDocPage.tsx`, `src/pages/trading/StrategySnapshotPage.tsx` | ⏳ 待执行（批次1） |
| ARCH-006 | Architecture-Fix | Architecture-Fix | `src/config/themeRegistry.ts`, `src/config/symbols.ts`, `src/data/sectorDefinitions.ts` | ⏳ 待执行（批次1） |
| ARCH-007 | Architecture-Fix | Architecture-Fix | `src/pages/analysis/IndustryScorePage.tsx`, `src/pages/analysis/IntelligentScorePage.tsx`, `src/hooks/cabin/` | ⏳ 待执行（批次2 JT-004） |
| DF-001 | Data-Flow-Fix | Data-Flow-Fix | `src/core/databridge.ts` | ✅ 已完成 |
| DF-002 | Data-Flow-Fix | Architecture-Fix（JT-002 牵头） | `src/services/trading/tradingService.ts` | ⏳ 待执行（批次2 JT-002） |
| DF-003 | Data-Flow-Fix | Data-Flow-Fix | `src/store/dataflowStore.ts`, `src/store/pageStore.ts`, `src/store/widgetStore.ts`, `src/store/agentStore.ts` | ⏳ 待执行（批次1） |
| DF-004 | Data-Flow-Fix | Data-Flow-Fix | `src/core/databridge.ts` | ⏳ 待执行（批次1） |
| DF-005 | Data-Flow-Fix | Data-Flow-Fix | `src/core/databridge.ts`, `src/core/fallbackQueue.ts` | ⏳ 待执行（批次1） |
| DF-006 | Data-Flow-Fix | Data-Flow-Fix | `src/core/dataflow/dataflowEngine.ts` | ⏳ 待执行（批次1） |
| DF-007 | Data-Flow-Fix | Architecture-Fix（JT-003 牵头） | `src/data/db.ts`, `src/services/system/v6MigrationService.ts` | ⏳ 待执行（批次2 JT-003） |
| INT-001 | Interaction-Fix | Interaction-Fix | `src/apps/trading/TradingApp.tsx` | ✅ 已完成 |
| INT-002 | Interaction-Fix | Interaction-Fix | `src/apps/input/HotSectorPanel.tsx` | ✅ 已完成 |
| INT-003 | Interaction-Fix | Interaction-Fix | `src/apps/analysis/AnalysisApp.tsx` | ⏳ 待执行（批次1） |
| INT-004 | Interaction-Fix | Interaction-Fix | `src/components/organisms/input/StockSearch.tsx` | ⏳ 待执行（批次1） |
| INT-005 | Interaction-Fix | Interaction-Fix | `src/pages/input/LocalKnowledgePage.tsx` | ⏳ 待执行（批次1） |
| INT-006 | Interaction-Fix | Architecture-Fix（JT-004 牵头） | `src/pages/analysis/IndustryScorePage.tsx`, `src/pages/analysis/IntelligentScorePage.tsx` | ⏳ 待执行（批次2 JT-004） |
| INT-007 | Interaction-Fix | Architecture-Fix（JT-001 牵头） | `src/App.tsx` | ✅ 已完成（已作为 JT-001 一部分执行） |
| DOC-001 | Doc-Sync-Fix | Doc-Sync-Fix | `src/vite-env.d.ts`, `.env.example` | ✅ 已完成 |
| DOC-002 | Doc-Sync-Fix | Doc-Sync-Fix | `../reference/05-engine-specs.md` | ✅ 已完成 |
| DOC-003 | Doc-Sync-Fix | Doc-Sync-Fix | `../reference/05-engine-specs.md` | ✅ 已完成 |
| DOC-004 | Doc-Sync-Fix | Doc-Sync-Fix | `../reference/05-engine-specs.md` | ✅ 已完成 |
| DOC-005 | Doc-Sync-Fix | Doc-Sync-Fix | `../reference/01-vision-and-goals.md`, `../reference/02-functional-specs.md`, `../reference/04-ui-ux-specs.md`, `../reference/05-engine-specs.md`, `../reference/07-operation-strategy.md`, `../reference/10-glossary.md`, `../reference/data-interaction-protocols.md`, `../reports/retrospectives/v9-current-state-review.md`, `../reference/architecture-version-comparison.md` | ✅ 已完成 |
| DOC-006 | Doc-Sync-Fix | Doc-Sync-Fix | `../reference/09-quality-gates.md` | ✅ 已完成 |
| DOC-007 | Doc-Sync-Fix | Doc-Sync-Fix | `../reference/06-routing-specs.md` | ✅ 已完成 |

---

## 基线更新广播

📢 基线更新：`../reference/05-engine-specs.md`、`../reference/06-routing-specs.md`、`../reference/09-quality-gates.md`、`src/vite-env.d.ts` 及 6 个核心/实施文档 frontmatter 已修改至 V9-RC-1 版本，请各位 Agent 拉取最新上下文。

---

## 已完成的基线修改（V9-RC-0 → V9-RC-0.1）

| 文件 | 修改内容 | 验证状态 |
|------|----------|----------|
| `src/App.tsx` | 使用 `bootstrapService.initializeApp()` 替换 `db.init()`；增加 `useToast` 错误提示 | lint ✅ / build ✅ |
| `src/services/system/bootstrapService.ts` | 新增 | lint ✅ / build ✅ |
| `src/core/databridge.ts` | 广播目标从 `meta.target` 改为 `targetStore`，触发 `${store}:changed` | databridge test ✅ / lint ✅ / build ✅ |
| `src/apps/trading/TradingApp.tsx` | 增加 `processingSymbols` + `useToast` pending/反馈 | lint ✅ |
| `src/apps/input/HotSectorPanel.tsx` | 增加 `addingAll` + `useToast` pending/反馈 | lint ✅ |
| `tests/TradingApp.test.tsx` | mock `useToast` | TradingApp test ✅ |
