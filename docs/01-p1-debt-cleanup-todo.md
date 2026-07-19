---
title: TODO-ADD-TITLE
type: reference
domain: product
phase: requirements
tier: quick-note
status: draft
maintainer: V9 Architecture Team
tags: [product, cleanup, list]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROD-011
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# P1 架构债务清理 TODO 清单

> **Version**: v1.0.0  
> **创建日期**: 2026-07-16  
> **负责人员**: 当前开发者（单人维护�? 
> **目标**: 完成 P1 级架构债务清理，消除安�?防腐�?大组�?僵尸代码风险  
> **关联文档**:
> - [架构校验报告](./archive/01-architecture-audit-report-2026-07-16.md)（待生成�?> - [architecture-debt-remediation SKILL](../.trae/skills/architecture-debt-remediation/SKILL.md)
> - [AGENTS.md](../AGENTS.md)

---

## 1. 高优先级（P1-H�?
| 编号 | 任务名称 | 具体工作内容 | 验收标准 | 建议截止日期 | 负责�?| 状�?|
|------|----------|-------------|----------|-------------|--------|------|
| P1-H1 | 修复路由守卫按钮权限默认放行 | �?`src/core/routeGuard.tsx:102` 的未注册模块默认返回值由 `true` 改为 `false`；补�?`registerButtonPermission` 白名单覆盖所有敏感模�?| `npm run lint` 通过；相关单元测试通过；无功能回归 | 2026-07-18 | 当前开发�?| 已完�?|
| P1-H2-1 | 迁移�?8 �?services 直连 dataLayer | �?`scripts/docs/reports/audit/audit-layer-calls-*.json` 中选取�?8 个警告，�?`import { db } / dataLayer` 改为 `DataBridge.forward()` �?`data/gateway` | `audit:layers` 警告数减�?8 个；`tsc:prod` + `vitest` 全绿 | 2026-07-21 | 当前开发�?| 已完�?|
| P1-H2-2 | 迁移剩余 3 �?services 直连 dataLayer | 处理 `src/services/storage/indexedDBProvider.ts`、`src/services/system/bootstrapService.ts`、`src/services/useCase/rebalancePortfolio.useCase.ts` �?dataLayer/db 直连，改�?DataBridge 或子 store 模块 | `audit:layers` 警告�?= 0；`tsc:prod` + `vitest` 全绿 | 2026-07-25 | 当前开发�?| 已完�?|
| P1-H2-3 | （已无剩�?services 迁移任务�?| audit:layers 剩余警告�?0，无需继续分批次迁�?| �?| 2026-07-28 | 当前开发�?| 不适用 |
| P1-H2-4 | （已无剩�?services 迁移任务�?| audit:layers 剩余警告�?0，无需继续分批次迁�?| �?| 2026-08-01 | 当前开发�?| 不适用 |

---

## 2. 中优先级（P1-M�?
| 编号 | 任务名称 | 具体工作内容 | 验收标准 | 建议截止日期 | 负责�?| 状�?|
|------|----------|-------------|----------|-------------|--------|------|
| P1-M1 | 清理 104 个未使用组件 | 依据 `scripts/component-audit-report.txt`，逐个确认 `未使用组件` 列表；删除无用文件或迁移�?`src/showcase/` | 未使用组件数 �?20；`npm run build` 成功；无 import 残留 | 2026-08-05 | 当前开发�?| 待开�?|
| P1-M2 | 拆分 10 个大组件 | �?>300 行组件进行容�?展示拆分，重点处�?`ReviewWizard.tsx` / `MigrationPanel.tsx` / `SystemArchitectureDiagram.tsx` | 目标组件行数 �?300；单测覆盖新增逻辑；`vitest` 全绿 | 2026-08-10 | 当前开发�?| 待开�?|
| P1-M3 | 补充 DataBridge 删除级联逻辑 | �?`src/core/databridge.ts` �?`ACTION_TO_STORE_MAP` 中增加父�?store 级联映射，防止删除父级后子级数据悬空 | 删除操作单测覆盖；`audit:db-references` 通过 | 2026-08-13 | 当前开发�?| 待开�?|

---

## 3. 低优先级（P1-L�?
| 编号 | 任务名称 | 具体工作内容 | 验收标准 | 建议截止日期 | 负责�?| 状�?|
|------|----------|-------------|----------|-------------|--------|------|
| P1-L1 | 清理�?50% lint warnings | 优先处理 `no-magic-numbers`、`strict-boolean-expressions`、`no-unsafe-*` 三类警告 | warnings �?�?826；`npm run lint` 通过 | 2026-08-18 | 当前开发�?| 待开�?|
| P1-L2 | 清理剩余 lint warnings | 处理 `no-unnecessary-condition`、`prefer-nullish-coalescing` 等剩余警�?| warnings �?�?100；`npm run lint` 通过 | 2026-08-22 | 当前开发�?| 待开�?|
| P1-L3 | 建立架构债务巡检机制 + P1 总结 | 编写 `./archive/01-architecture-audit-report-2026-07-16.md`；在 CI 中加入双�?`audit:layers` + `audit:hardcode` 巡检；更�?SKILL | 文档合并；CI 脚本可执行；SKILL v1.0 发布 | 2026-08-25 | 当前开发�?| 待开�?|

---

## 4. 批次执行顺序

```
批次 1 (07.18): P1-H1
批次 2 (07.21): P1-H2-1
批次 3 (07.25): P1-H2-2（剩�?3 �?services 迁移，H2-3/H2-4 因无剩余任务关闭�?批次 6 (08.05): P1-M1
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

| 日期 | 版本 | 变更说明 | 修改�?|
|------|------|----------|--------|
| 2026-07-16 | v1.0.0 | 初始创建，基�?2026-07-16 架构校验报告 | 当前开发�?|
| 2026-07-16 | v1.1.0 | P1-H1 / P1-H2-1 完成；验证全绿；audit:layers 剩余 3 警告；合�?H2-3/H2-4 �?H2-2 | 当前开发�?|
| 2026-07-16 | v1.2.0 | P1-H2-2 完成；audit:layers 降至 0 警告；剩�?3 �?services 迁移�?DataBridge/�?store | 当前开发�?|
| 2026-07-18 | v1.3.0 | 全量验证修复：tsc:prod 0 error，lint 0 error，audit:hardcode 0 violation；修复 stressTestService 未使用变量、multiSourceFetcher 类型安全、IndustryHeatmap 硬编码颜色迁移至 CHART_PALETTE、CockpitShell 调试代码清理；关键测试全部通过 | 当前开发�?|
