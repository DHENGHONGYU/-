---
title: 文档索引已迁移
type: reference
domain: project
phase: planning
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "Document category index registry with domain and type-based library navigation"
tags: [project, registry, migration, documentation, governance]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-PROJ-185
related_docs: [V9-DOC-META-000, V9-DOC-PROJ-184]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 文档索引已迁移

> ⚠️ 本文件为旧入口兼容页，**权威文档索引已迁移至** [00-meta/registry-index.md](./registry-index.md)。

## 说明

- **权威索引**：[00-meta/registry-index.md](./registry-index.md) — 自动生成的全量文档索引
- **文档导航**：[README.md](README.md) — 按优先级分级的文档导航入口
- **本页保留原因**：兼容旧路径引用，所有访问将被引导至权威版本

## 修复记录

- 2026-07-17：修复 `doc-cross-ref-sync.ts` 输出路径bug（原错误输出到docs根目录），统一指向00-meta/
- `doc-ref-path-map.json` 已配置重定向规则：`docs/registry-index.md` → `docs/meta/registry-index.md`
