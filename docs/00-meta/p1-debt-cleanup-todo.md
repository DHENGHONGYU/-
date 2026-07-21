---
title: TODO-ADD-TITLE
type: meta
domain: project
phase: planning
tier: quick-note
status: draft
maintainer: V9 Architecture Team
tags: [project, cleanup, list]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-338
related_docs: [docs/archive/01-architecture-audit-report-2026-07-16.md]
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-304, V9-DOC-PROJ-175]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# P1 架构债务清理 TODO 清单

> **Version**: v1.0.0  
> **创建日期**: 2026-07-16  
> **负责人员**: 当前开发者（单人维护）  
> **目标**: 完成 P1 级架构债务清理，消除安全/防腐层/大组件/僵尸代码风险  
> **关联文档**:
> - [架构校验报告](../archive/01-architecture-audit-report-2026-07-16.md)（待生成）
> - [architecture-debt-remediation SKILL](../.trae/skills/architecture-debt-remediation/SKILL.md)
> - [AGENTS.md](../../AGENTS.md)

---

## 1. 高优先级（P1-H）

| 编号 | 任务名称 | 具体工作内容 | 验收标准 | 建议截止日期 | 负责人 | 状态 |
|------|----------|-------------|----------|-------------|--------|------|
| P1-H1 | 修复路由守卫按钮权限默认放行 | 将 `src/core/routeGuard.tsx:102` 的未注册模块默认返回值由 `true` 改为 `false`；补充 `registerButtonPermission` 白名单覆盖所有敏感模块 | `npm run lint` 通过；相关单元测试通过；无功能回归 | 2026-07-18 | 当前开发者 | 已完成 |
| P1-H2-1 | 迁移前 8 个 services 直连 dataLayer | 从 `scripts/docs/reports/audit/audit-layer-calls-*.json` 中选取前 8 个警告，将 `import { db } / dataLayer` 改为 `DataBridge.forward()` 或 `data/gateway` | `audit:layers` 警告数减少 8 个；`tsc:prod` + `vitest` 全绿 | 2026-07-21 | 当前开发者 | 已完成 |
| P1-H2-2 | 迁移剩余 3 个 services 直连 dataLayer | 处理 `src/services/storage/indexedDBProvider.ts`、`src/services/system/bootstrapService.ts`、`src/services/useCase/rebalancePortfolio.useCase.ts` 的 dataLayer/db 直连，改为 DataBridge 或子 store 模块 | `audit:layers` 警告数 = 0；`tsc:prod` + `vitest` 全绿 | 2026-07-25 | 当前开发者 | 已完成 |
| P1-H2-3 | （已无剩余 services 迁移任务） | audit:layers 剩余警告为 0，无需继续分批次迁移 | — | 2026-07-28 | 当前开发者 | 不适用 |
| P1-H2-4 | （已无剩余 services 迁移任务） | audit:layers 剩余警告为 0，无需继续分批次迁移 | — | 2026-08-01 | 当前开发者 | 不适用 |

---

## 2. 中优先级（P1-M）

| 编号 | 任务名称 | 具体工作内容 | 验收标准 | 建议截止日期 | 负责人 | 状态 |
|------|----------|-------------|----------|-------------|--------|------|
| P1-M1 | 清理 104 个未使用组件 | 依据 `scripts/component-audit-report.txt`，逐个确认 `未使用组件` 列表；删除无用文件或迁移至 `src/showcase/` | 未使用组件数 ≤ 20；`npm run build` 成功；无 import 残留 | 2026-08-05 | 当前开发者 | 待开始 |
| P1-M2 | 拆分 10 个大组件 | 对 >300 行组件进行容器/展示拆分，重点处理 `ReviewWizard.tsx` / `MigrationPanel.tsx` / `SystemArchitectureDiagram.tsx` | 目标组件行数 ≤ 300；单测覆盖新增逻辑；`vitest` 全绿 | 2026-08-10 | 当前开发者 | 待开始 |
| P1-M3 | 补充 DataBridge 删除级联逻辑 | 在 `src/core/databridge.ts` 的 `ACTION_TO_STORE_MAP` 中增加父子 store 级联映射，防止删除父级后子级数据悬空 | 删除操作单测覆盖；`audit:db-references` 通过 | 2026-08-13 | 当前开发者 | 待开始 |

---

## 3. 低优先级（P1-L）

| 编号 | 任务名称 | 具体工作内容 | 验收标准 | 建议截止日期 | 负责人 | 状态 |
|------|----------|-------------|----------|-------------|--------|------|
| P1-L1 | 清理前 50% lint warnings | 优先处理 `no-magic-numbers`、`strict-boolean-expressions`、`no-unsafe-*` 三类警告 | warnings 数 ≤ 826；`npm run lint` 通过 | 2026-08-18 | 当前开发者 | 待开始 |
| P1-L2 | 清理剩余 lint warnings | 处理 `no-unnecessary-condition`、`prefer-nullish-coalescing` 等剩余警告 | warnings 数 ≤ 100；`npm run lint` 通过 | 2026-08-22 | 当前开发者 | 待开始 |
| P1-L3 | 建立架构债务巡检机制 + P1 总结 | 编写 `./archive/01-architecture-audit-report-2026-07-16.md`；在 CI 中加入双周 `audit:layers` + `audit:hardcode` 巡检；更新 SKILL | 文档合并；CI 脚本可执行；SKILL v1.0 发布 | 2026-08-25 | 当前开发者 | 待开始 |

---

## 4. 批次执行顺序

```
批次 1 (07.18): P1-H1
批次 2 (07.21): P1-H2-1
批次 3 (07.25): P1-H2-2（剩余 3 个 services 迁移，H2-3/H2-4 因无剩余任务关闭）
批次 6 (08.05): P1-M1
批次 7 (08.10): P1-M2
批次 8 (08.13): P1-M3
批次 9 (08.18): P1-L1
批次 10 (08.22): P1-L2
批次 11 (08.25): P1-L3
```

---

## 5. 每日验证命令

每个批次完成后必须运行：

```powershell
npm run tsc:prod
npm run lint
npx vitest run
npm run audit:layers
npm run audit:hardcode
npm run build
```

---

## 6. 变更日志

| 日期 | 版本 | 变更说明 | 修改人 |
|------|------|----------|--------|
| 2026-07-16 | v1.0.0 | 初始创建，基于 2026-07-16 架构校验报告 | 当前开发者 |
| 2026-07-16 | v1.1.0 | P1-H1 / P1-H2-1 完成；验证全绿；audit:layers 剩余 3 警告；合并 H2-3/H2-4 至 H2-2 | 当前开发者 |
| 2026-07-16 | v1.2.0 | P1-H2-2 完成；audit:layers 降至 0 警告；剩余 3 个 services 迁移至 DataBridge/子 store | 当前开发者 |
