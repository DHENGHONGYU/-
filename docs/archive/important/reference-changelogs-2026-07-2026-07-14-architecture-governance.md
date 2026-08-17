---
title: 2026-07-14-architecture-governance
status: archived
tier: reference
code_version: "2.0.0-rc.1"
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# 2026-07-14 架构治理与代码整理

## 变更范围

- 工作树清理
- 类型/Lint 修复
- 循环依赖消除
- Store 拆分
- 文档同步
- CI/Hooks 增强保留

## 主要变更

### 新增文件

- `src/services/backtest/backtestEngine.types.ts`：承载 `BacktestEngine` 公共类型。
- Store 拆分新增 14 个文件：
  - `src/store/collectionWizardStore.configActions.ts`
  - `src/store/collectionWizardStore.fieldActions.ts`
  - `src/store/collectionWizardStore.taskActions.ts`
  - `src/store/executionStore.actions.ts`
  - `src/store/executionStore.planOps.ts`
  - `src/store/marketDataStore.actions.ts`
  - `src/store/orderStore.actions.ts`
  - `src/store/orderStore.subscriptions.ts`
  - `src/store/utils/collectionWizardStore.constants.ts`
  - `src/store/utils/riskDerived.circuit.ts`
  - `src/store/utils/riskDerived.execution.ts`
  - `src/store/utils/riskDerived.stats.ts`
  - `src/store/utils/riskDerived.symbol.ts`
  - `src/store/utils/riskDerived.trend.ts`
- `../../../archive/architecture-cleanup-completion-report-2026-07-14.md`：本次治理完成报告。

### 修改文件

- `src/lib/validation.ts`：修复 `validateEnumValue` 类型错误。
- `src/services/backtest/BacktestEngine.ts`：改为从 `backtestEngine.types.ts` 导入并 re-export 类型。
- `src/services/data-collector/dataSourceOrchestrator.ts`：导出 `type DataSource = QuoteDataSourceId`。
- `src/services/data-collector/qualityMetricsCollector.ts`：改用 `QuoteDataSourceId` 类型。
- `src/services/scoring/v6-engine/confidence.ts`：修复 `sourceGrades.C` 可能 undefined。
- `src/services/scoring/v6-engine/calculators/l3/l3a-financial.ts`：移除未使用变量。
- `src/store/executionStore.ts`：不再 re-export `initExecutionStoreSubscriptions`。
- `src/store/executionStoreSubscriptions.ts`：职责重新对齐。
- `src/apps/trading/panels/ExecutionPlanPanel.tsx`：直接订阅 `executionStoreSubscriptions`。
- `../../data-dictionary-index.md`：补充 Store 拆分文件索引。
- `../../../../AGENTS.md`：`lib` 基础设施白名单新增 `perf`。
- `.gitignore`：新增历史/生成产物忽略规则。
- `.github/workflows/quality-check.yml`：保留增强后的门禁配置。
- `.husky/pre-commit`：保留增强后的钩子配置。

### 删除文件

- `coverage_cmd/` 目录及全部内容
- `../../../how-to/file-management-guide.md`
- `../../pr-description.md`
- `../../release-notes.md`
- `../../ui设计优化实施计划-详细版.md`
- `audit-tests-output.txt`
- `audit-tests-output2.txt`
- `complexity-remediation-plan.md`
- `deadcode-result.txt`

## 门禁结果

| 门禁 | 结果 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 错误 |
| `npm run lint` | ✅ 0 error / 1818 warnings |
| `npm run audit:layers` | ✅ 0 违规 |
| `npm run audit:hardcode` | ✅ 0 违规，1 warning |
| `npm run audit:deadcode` | ✅ 0 违规，20 warnings |
| `npm run audit:docs` | ✅ 0 违规 |
| `npx madge --circular --extensions ts src/` | ✅ 0 循环依赖 |
| `npm run build` | ✅ 通过 |

## 后续跟踪

- GitHub Issue：待创建（关联本 changelog 与完成报告）。
- 剩余债务：1818 ESLint warnings、单元测试全量回归、20 处条件 `return null` 审查、1 处静默回退。
