---
title: TODO-ADD-TITLE
type: reference
domain: product
phase: requirements
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "01-requirements directory document index and navigation entry"
tags: [requirements, index, documentation, reference, product]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 01-requirements — 需求与架构决策

> **状态**：? 活跃目录（需求管理专区）
> **定位**：不属于 Diátaxis 技术文档分类，独立维护的需求与 ADR 专区

本目录存放需求规格与架构决策记录：

| 子目录/文件 | 内容 | 说明 |
|------------|------|------|
| `adr/` | 架构决策记录 | 与 `../reference/adr-*.md` 互补，存放非核心 ADR |

## 与技术文档体系的关系

大部分需求规格已迁移至技术文档体系：
- 功能规格 → [../reference/02-functional-specs.md](../reference/02-functional-specs.md)
- 各舱室规格 → `../reference/*-cabin-spec.md`
- 核心 ADR → `../reference/adr-*.md`

本目录保留需求管理视角的文档，与技术文档体系形成互补。
