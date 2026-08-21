---
title: V9 文档体系总览与导航
type: how-to
domain: project
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 智能投研复盘系统文档体系顶层导航入口：聚合 docs/ 下全部一级目录与核心治理/索引文档的快速选择指南。"
tags: [documentation, index, navigation, overview, governance]
version: v1.0.0
last_updated: 2026-08-21
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-DOCS-000
related_docs: [V9-DOC-PROJ-175, V9-DOC-META-000, V9-DOC-PROJ-316, V9-DOC-PROJ-320]
change_log:
  - version: v1.0.0
    changes: "创建 docs/ 顶层导航入口（P0-1），聚合全部分级目录导航与快速选择指南"
    date: 2026-08-21
---

# V9 文档体系总览与导航

> **定位**：本项目文档体系的一级入口。若是第一次进入 docs/，从此处按需导航。
> **分类宪法**：[document-classification-system.md](meta/document-classification-system.md)
> **元数据标准**：[document-metadata-standard.md](meta/document-metadata-standard.md)
> **治理索引**：[REGISTRY_INDEX.md](meta/REGISTRY_INDEX.md)

---

## 一、快速选择指南

| 你想解决什么问题 | 去这里 |
|---|---|
| 项目怎么搭起来、跑起来、API 契约在哪 | [reference/](reference/)（契约/数据定义/规格）· [guides/tutorials/](guides/tutorials/) |
| 架构与设计决策、ADR、分层规范 | [explanation/](explanation/) · [specs](specs) 即 `docs/specs`（若存在） |
| 某个代码模块/功能怎么用（How-To） | [guides/how-to/](guides/how-to/) |
| 上线/发布/门禁/检查清单 | [guides/sops/](guides/sops/) · [releases/](releases/) |
| 想了解当前产品与功能范围 | [specs](specs)（vision/functional/UI）· [wiki/](wiki) |
| 文档本身怎么治理/归档/编号 | [meta/](meta/) |
| 已归档的历史/废弃文档 | [archive/](archive/) |

---

## 二、一级目录导航

| 目录 | 定位 | 入口文档 |
|---|---|---|
| [specs](specs) | 需求、功能、UI、架构、ADR（分类规格层） | [requirements](specs/requirements/README.md) · [product](specs/product/README.md) |
| [explanation](explanation) | 架构与设计解释、实现细节、分析报告 | [ARCHITECTURE.md](explanation/ARCHITECTURE.md) · [design](explanation/design/) |
| [guides](guides) | 操作指南（How-To / 标准 / SOP / 教程） | [how-to](guides/how-to/README.md) · [sops](guides/sops/README.md) |
| [reference](reference) | 契约、数据定义、数据字典、规格索引 | [specs 入口](reference/specs) 即契约文档集合 |
| [meta](meta) | 文档治理、元数据规范、索引、登记 | [README](meta/README.md) · [GOVERNANCE](meta/GOVERNANCE.md) |
| [wiki](wiki) | 代码 Wiki（架构/模块/类/数据流/上手） | [wiki/README.md](wiki/README.md) |
| [releases](releases) | 版本发布记录、金丝雀/灰度报告 | `releases/` |
| [release-notes](release-notes) | Release Notes / 变更日志 | `release-notes/` |
| [reports](reports) | 审计/交付报告 | `docs/reports/` |
| [audit](audit) | 审计报告与质量基线 | `audit/` |
| [design](design) | 设计类专题文档 | `design/` |
| [lessons](lessons) | 踩坑/教训沉淀 | `lessons/` |
| [archive](archive) | 已归档的历史文档（只读，不更新） | [archive/README.md](archive/README.md) |

> 注：部分目录（specs/wiki）若当前分支未持续维护，其内容归并入对应层级，仍以上表为准。
> 本文档导航始终以仓库 `docs/` 实际一级目录为真源，更新时以 [docs-as-mirror](meta/document-organization-workflow.md) 原则为准。

---

## 三、核心治理与索引文档（漫画导航）

- 文档分类宪法：[document-classification-system.md](meta/document-classification-system.md) `V9-DOC-PROJ-316`
- 元数据 Frontmatter 标准：[document-metadata-standard.md](meta/document-metadata-standard.md)
- 文档风格指南：[document-style-guide.md](meta/document-style-guide.md)
- 文档组织工作流：[document-organization-workflow.md](meta/document-organization-workflow.md)
- 归档与死文档生命周期：[document-archive-management.md](meta/document-archive-management.md)
- 全仓 doc_id 注册表：[doc-id-registry.md](meta/doc-id-registry.md)

---

## 四、维护说明

- 任何新增/移动一级目录后，须同步更新本 README「二级 目录导航」表。
- Frontmatter 元数据须符 [document-metadata-standard.md](meta/document-metadata-standard.md)；变更本文件版本/日期时在 `change_log` 追加条目，并保持与 `version`/`last_updated` 三对齐。
- 分类编号采用 numeric（1-8）体系，详见 [document-classification-system.md](meta/document-classification-system.md)。