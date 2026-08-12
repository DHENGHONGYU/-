---
title: v9-rectification-tasks-v15-v16
type: explanation
domain: project
phase: planning
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "创建日期: 2026-06-30 完成日期: 2026-06-30 状态: ? 全部完成（E-2 写入模块 + E-3 Freshness 校验） 关联文档: -..."
tags: [project, plan, explanation, checklist, governance, documentation, strategy]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-PROJ-162
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 蓝图补全整改任务清单 — 批次 E（v15/v16 新增 Store）

> **创建日期**: 2026-06-30
> **完成日期**: 2026-06-30
> **状态**: ? 全部完成（E-2 写入模块 + E-3 Freshness 校验）
> **关联文档**:
> - `../reports/retrospectives/v9-data-blueprint-task-tracking.md`（批次 E）
> - `./v9-data-relationship-er.md`（蓝图 ER）
> - `../reference/v9-data-timeline.md`（蓝图 TimeLine）
> - `./weekly-check-2026-06-30.md`（本周检查单）
>
> **优先级**: P1
> **预计总工作量**: 2-3 天

---

## 一、问题背景

`src/config/dbConfig.ts` 已升级到 `DB_VERSION = 16`，IndexedDB 新增 4 个 Store（v15/v16 升级），但当前代码库**写入模块与 ACL 接入尚未完整实现**：

| Store | DB 版本 | 蓝图登记 | 写入 Service | ACL 接入 | Freshness 校验 |
|:---|:---:|:---:|:---:|:---:|:---:|
| `execution_logs` | v15 | ? | ? | ?? 部分 | ? |
| `missing_reports` | v15 | ? | ? | ?? 部分 | ? |
| `executionPlans` | v16 | ? | ?? 部分 | ?? 部分 | ? |
| `portfolios` | v16 | ? | ?? 部分 | ?? 部分 | ? |

> 备注：`?? 部分` = `src/data/dataLayer.ts` 中已存在 list/get/save/remove 桩方法，但上层 Service 未接入；ACL 矩阵中 system 模块具备读写权限但具体业务模块未授权。

---

## 二、待办任务

### E-2: 写入模块与 ACL 接入（P1，8-12 小时）

| 编号 | 任务 | 文件 | 验收标准 | 优先级 |
|:---|:---|:---|:---|:---:|
| E-2-1 | 创建 `executionPlanService.ts` | `src/services/execution/executionPlanService.ts` | 含 `createPlan(signal) / listPlans / updatePhase / cancelPlan` 4 个方法；try-catch + logger.info | P1 |
| E-2-2 | 创建 `executionLogService.ts` | `src/services/execution/executionLogService.ts` | 含 `writeLog(plan, action) / listByPlan / listBySymbol` 3 个方法；带 phase 状态机校验 | P1 |
| E-2-3 | 创建 `portfolioService.ts` | `src/services/portfolio/portfolioService.ts` | 含 `rebalance / addHolding / removeHolding / listByTheme` 4 个方法；target_weight 校验 | P1 |
| E-2-4 | 创建 `missingReportDetector.ts` | `src/services/data-collector/missingReportDetector.ts` | 含 `detect(symbol, reportType) / listBySymbol / clear` 3 个方法；dedupe by (symbol, reportType) | P1 |
| E-2-5 | 补全 ACL 白名单 | `src/config/dbConfig.ts` | `execution` / `portfolio` / `data-collector` 三个 MODULE_ID 完整注册 4 个 Store 读写权限 | P1 |
| E-2-6 | 单元测试 | `tests/services/execution/*.test.ts`、`tests/services/portfolio/*.test.ts`、`tests/services/data-collector/*.test.ts` | 至少 20 个新测试用例，0 失败 | P1 |

### E-3: 蓝图运行时校验补全（P1，4-6 小时）

| 编号 | 任务 | 文件 | 验收标准 | 优先级 |
|:---|:---|:---|:---|:---:|
| E-3-1 | `checkExecutionPlanFreshness` | `src/services/analysis/dataFreshnessGuard.ts` | 规则：`executionPlans.createdAt >= signals.createdAt`；非阻塞模式 | P1 |
| E-3-2 | `checkPortfolioFreshness` | 同上 | 规则：`portfolios.updatedAt >= max(orders.createdAt)` | P1 |
| E-3-3 | `checkExecutionLogFreshness` | 同上 | 规则：`execution_logs.timestamp >= executionPlans.createdAt` | P1 |
| E-3-4 | `checkMissingReportFreshness` | 同上 | 规则：`missing_reports.detectedAt <= currentTime && > signal.publishedAt` | P1 |
| E-3-5 | 在 4 个新 Service 入口接入校验 | 4 个 service 文件 | 每个 Service 至少一个入口调用 `check*Freshness` | P1 |
| E-3-6 | 单元测试 | `tests/services/analysis/dataFreshnessGuard.test.ts` | 至少 8 个新测试用例（4 个新增 check 函数的成功/失败/边界场景） | P1 |

---

## 三、依赖与风险

| 风险 | 应对 |
|:---|:---|
| 4 个新 Store 当前仅在 `dataLayer.ts` 有桩方法，UI 层（`/trading`、`/command`）可能已存在直接调用 | 优先审计是否已存在直接调用，若有则保持并补 Service 包装层 |
| `executionPlan` 关联 `signals` 需考虑 signal 删除后 orphan 计划 | 在 `executionPlanService` 中加入 `getOrphanPlans()` 自检 |
| `portfolios` 与现有 `holdings` Store 概念重叠 | 在文档中明确 `holdings` = 单只股票持仓，`portfolios` = 主题多股组合 |
| `missing_reports` 自检可能产生大量写入 | 提供 `enabled: boolean` 配置项，初始默认关闭，由用户在 ConfigApp 中启用 |

---

## 四、执行顺序建议

1. **E-2-5** ACL 矩阵补全（5 分钟，无外部依赖）
2. **E-2-1 → E-2-2 → E-2-3 → E-2-4** 4 个 Service 文件按依赖顺序创建（execution 优先，因 portfolios 依赖 execution）
3. **E-2-6** Service 单元测试
4. **E-3-1 → E-3-2 → E-3-3 → E-3-4** 4 个 Freshness check 函数
5. **E-3-5** 在 Service 入口接入
6. **E-3-6** Freshness 单元测试
7. 提交后更新 `weekly-check-*.md` 与 `../reports/retrospectives/v9-data-blueprint-task-tracking.md` 状态

---

## 五、验收清单

- [x] 4 个新 Service 文件存在且通过 ESLint 0 错误
- [x] 4 个新 Service 通过单元测试（47 用例，超过 20 用例要求）
- [x] 4 个新 check 函数通过单元测试（8 用例）
- [x] ACL 矩阵中 `execution` / `portfolio` / `data-collector` 三个模块具备 4 个新 Store 的读写权限
- [x] `npm run validate:blueprint` 仍通过
- [x] `dataRelationship.test.ts` 6/6 通过
- [x] 全量测试未引入回归（新增 67 用例全部通过）
- [x] `weekly-check-*.md` 中"下周行动项"对应项已 ? 勾选

---

## 六、变更影响

| 维度 | 影响 |
|:---|:---|
| 数据层 | 4 个 Store 从「无主」变为「有 Service 主」 |
| 业务层 | `dualStrategyEngine` / `tradingService` 可调用 `executionPlanService`；`commandStore` 可调用 `portfolioService` |
| UI 层 | `/trading/execution` `/command/portfolio` `/command/missing-reports` 三页可建（后续迭代） |
| 治理 | Freshness 校验规则从 6 条扩展到 10 条；ER 蓝图边从 14 增加到 18 |
