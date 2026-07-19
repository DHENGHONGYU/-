---
title: a-h-index
type: explanation
domain: project
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "本索引为逻辑分类层（A–H）↔ 物理存储层的真实映射。所有链接均指向磁盘真实存在的文件，已清除旧版（v1.0.0）指�?A/ B/ C/�?幽灵目录的失效链接�?
tags: [project, registry, plan, explanation, governance, documentation, strategy]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-032
related_docs: [V9-DOC-PROJ-016, V9-DOC-PROJ-007, V9-DOC-META-000, V9-DOC-PROJ-325, V9-DOC-PROJ-009, V9-DOC-PROJ-173, V9-DOC-PROJ-271, V9-DOC-ARCH-002, V9-DOC-PROJ-036, V9-DOC-BACK-023, V9-DOC-DATA-004, V9-DOC-DATA-005, V9-DOC-PROJ-225, V9-DOC-PROJ-279, V9-DOC-ARCH-021, V9-DOC-PROJ-217, V9-DOC-PROJ-161, V9-DOC-PROJ-095, V9-DOC-QA-008, V9-DOC-PROJ-104, V9-DOC-PROJ-230]
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 文档体系 �?A-H 分类索引（真实映射）

> **Version**: v2.0.0 | **日期**: 2026-07-13
> **说明**: 本索引为**逻辑分类层（A–H）↔ 物理存储�?*的真实映射。所有链接均指向磁盘真实存在的文件，已清除旧版（v1.0.0）指�?`A/ B/ C/…` 幽灵目录的失效链接�?> 物理目录�?`docs/00-meta` ~ `docs/07-archive` + 顶层 `reports/ prompts/ assets/`。本文件位于 `./a-h-index.md`�?
## 一、分类总览

| 逻辑�?| 主题 | 物理落点 |
|--------|------|----------|
| A | 导航与治�?| `00-meta/`、`01-requirements/` |
| B | 架构设计 | `02-design/architecture/` |
| C | 功能模块 | `02-design/cabins/`、`02-design/standards/`（数据字典） |
| D | 技术规�?| `02-design/standards/` |
| E | 测试策略 | `04-testing/` |
| F | AI 辅助工程治理 | `prompts/`、`03-development/`（ai/checklists/migration�?|
| G | 过程与质量产�?| `reports/`、`06-project-management/`、`04-testing/audit-reports/` |
| H | 跨域补充 | `05-deployment/`、`03-development/`（guides/plugins/templates�?|

## 二、逐类索引（仅列真实文件）

### [A] 导航与治�?- [文档治理宪法](../00-meta/governance.md)
- [目录结构指南](../00-meta/directory-structure-guide.md)
- [文档注册索引](../00-meta/registry-index.md)
- [文档自动更新触发映射](../00-meta/doc-trigger-action-map.md)
- [文档与文件管理优化方案](../00-meta/doc-file-management-optimization-plan.md)
- [需�?/ 愿景 / 架构标准](01-requirements/)（含 `../reference/v9-system-blueprint.md`、`01-vision-and-goals.md`、`../reference/02-functional-specs.md`、`03-architecture-standards.md`、`../reference/V9数据宪法.md`�?- [数字目录结构总入口](../explanation/README.md)

### [B] 架构设计
- [架构概览](overview.md)
- [子系统架构（architecture.md）](architecture.md)
- [舱室总览](cabins-overview.md)
- [服务目录](../reference/services-catalog.md)
- [舱室业务规格](02-design/cabins/)（`*-cabin-spec.md`、`*-strategy.md`�?- [合规审计](02-design/architecture/compliance/)
- [架构决策记录 ADR](02-design/architecture/adr/)

### [C] 功能模块
- [舱室业务规格](02-design/cabins/)
- [数据字典](design/data-definition.md)
- [数据字典索引](design/data-dictionary-index.md)
- [各类业务数据字典](02-design/standards/)（`*-data-definition.md`�?
### [D] 技术规�?- [编码规范](../reference/coding-conventions.md)
- [JSDoc 规范](jsdoc-convention.md)
- [复杂度治理](../reference/complexity-governance.md)
- [设计令牌](02-design/standards/design-tokens/)
- [开发工作流 SOP](../reference/development-workflow-sop.md)
- [代码评审指南](../how-to/code-review-guide.md)
- [网关写入权限规范](../reference/gateway-write-permission-spec.md)

### [E] 测试策略
- [测试策略](../how-to/testing/testing-strategy.md)
- [测试用例](04-testing/test-cases/)
- [测试门禁](04-testing/gates/)
- [测试报告](04-testing/reports/)
- [审计 / 自动化测试报告](04-testing/audit-reports/)

### [F] AI 辅助工程治理
- [系统提示词模板](../../prompts/system-prompt-template.md)
- [组件 / 服务 / Store / 类型提示词模板](../../prompts/)
- [检查清单](03-development/checklists/)
- [AI 记忆与文档自动更新](03-development/ai/)
- [迁移规范](03-development/migration/)

### [G] 过程与质量产�?- [审计报告](reports/audit/)
- [变更日志](06-project-management/changelogs/)�?[副本](reports/changelogs/))
- [复盘报告](reports/retrospectives/)
- [草稿](reports/drafts/)
- [发布管理](reports/release-management/)�?[发布说明](../reference/release-notes.md))

### [H] 跨域补充
- [运维手册](05-deployment/ops/)
- [开发指南](03-development/guides/)
- [插件集成](03-development/plugins/)
- [文档模板](03-development/templates/)
- [PR 说明模板](../reference/pr-description.md)

## 三、维护约�?- 本索引随 `../00-meta/governance.md` 同步修订；新增文档须在对应类下补链接�?- 任何链接指向不存在文件，视为缺陷，由 `npm run audit:doc-integrity` 捕获（warn 级，不阻断）�?