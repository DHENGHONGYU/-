---
title: reports 目录文档索引与导航入口
type: reports
domain: project
phase: retrospective
tier: T1
status: active
maintainer: V9 Architecture Team
summary: "reports directory document index and navigation entry"
tags: [project, report, list, checklist, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
related_docs: [V9-DOC-PROJ-173]
referenced_by: [V9-DOC-PROJ-304]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
doc_id: V9-DOC-PROJ-145
---

# reports 目录文档索引与导航入口

> **目录定位**：项目全部审计报告、复盘报告、经验教训与发布管理文档的归档根目录。
> **使用说明**：按子目录分类检索；带日期的文件为时点快照，无日期的文件为主题持续更新版。

---

## 子目录导航

| 子目录 | 内容说明 | 更新频率 |
|------|------|---------|
| [audit/](audit/) | 各类专项审计报告（代码质量、硬编码、测试覆盖率、上线前终审等） | 按审计批次产生 |
| [reports/changelogs/](./changelogs/CHANGELOG_changelogs.md) | 版本变更记录与发布变更日志 | 每次发布产生 |
| [lessons-learned/](lessons-learned/) | 开发教训总结与最佳实践沉淀 | 持续更新 |
| [retrospectives/](retrospectives/) | 阶段复盘、计划方案与历程类报告 | 按阶段产生 |
| [release-management/](release-management/) | 发布管理流程与检查清单 | 按发布周期更新 |
| [doc-freshness/](doc-freshness/) | 文档新鲜度审计产物（机器生成） | 定期任务生成 |
| [doc-sync/](doc-sync/) | 文档与代码同步校验产物（机器生成） | 定期任务生成 |
| [automation-pipeline/](automation-pipeline/) | CI/CD 自动化流水线报告（机器生成） | 定期任务生成 |
| [action-plans/](action-plans/) | 整改行动计划与跟踪 | 按整改批次产生 |
| `_generated/` | 工具自动生成的中间产物 | 机器生成，勿手工编辑 |

---

## 根目录常驻报告

根目录下保留若干跨批次的主题性报告（如 `monthly-2026-07_changelogs.md`、`project-audit-report-2026-07-16.md`、`refactoring-plan-2026-07-04_retrospectives.md`、`token-optimization-best-practices_lessons-learned.md` 等），按文件名日期与主题检索即可。

---

## 维护约定

1. 新增审计/复盘报告按主题归入对应子目录，禁止在根目录无限堆积。
2. 机器生成的瞬态报告（doc-sync、doc-freshness、mcp-usage 等）可随时重新生成，损坏即归档标记，不做正文抢救性重写。
3. 带日期前缀的文件名为只读快照，后续更新请新建文件而非覆盖。

---

**返回上级索引**：见 [../README_root.md](../specs/README_root.md)
