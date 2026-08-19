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
version: v1.1.0
last_updated: 2026-08-15
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-185
related_docs: [V9-DOC-META-003, V9-DOC-PROJ-184]
change_log:
  - version: v1.1.0
    changes: "重定向至 REGISTRY_INDEX.md（原 registry-index.md 已归档）"
    date: 2026-08-15
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17
---

# 文档索引已迁移

> ⚠️ 本文件为旧入口兼容页，**权威文档索引已迁移至** [REGISTRY_INDEX.md](./REGISTRY_INDEX.md)。

## 说明

- **权威索引**：[REGISTRY_INDEX.md](./REGISTRY_INDEX.md) — V9 模块注册体系索引（V9-DOC-META-003）
- **doc_id 注册表**：[doc-id-registry.md](./doc-id-registry.md) — 全量 doc_id 注册表
- **文档导航**：[README.md](README.md) — 按优先级分级的文档导航入口
- **本页保留原因**：兼容旧路径引用，所有访问将被引导至权威版本

## 修复记录

- 2026-08-15：原 registry-index.md 已归档至 archive/historical-2026-08-15/（frontmatter 损坏，263 断链），重定向至 REGISTRY_INDEX.md
- 2026-07-17：修复 `doc-cross-ref-sync.ts` 输出路径bug（原错误输出到docs根目录），统一指向00-meta/
