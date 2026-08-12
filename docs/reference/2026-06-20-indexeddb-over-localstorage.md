---
title: ADR-002: IndexedDB 替代 localStorage
type: reference
domain: data
phase: design
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "Architecture Decision Record: IndexedDB 替代 localStorage"
tags: [data, adr, registry, store, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-DATA-037
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ADR-002: IndexedDB 替代 localStorage

> **Status**: Accepted  
> **Version**: v1.0.0  
> **Last Updated**: 2026-06-24

- 状态：已接受
- 日期：2026-06-20
- 决策人：@architect

## 背景

需要存储 stocks、scores、orders、quotes 等结构化数据，localStorage 容量与功能不足。

## 选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| A. IndexedDB | 容量大、结构化、异步、支持索引 | API 底层、需自行迁移 |
| B. localStorage | 简单易用 | 容量 5–10 MB、同步阻塞、无索引 |
| C. WebSQL | 关系型 | 已废弃、兼容性差 |

## 决策

选择 A。IndexedDB 满足结构化、大容量、离线需求。

## 后果

- 所有数据操作经 `src/data/db.ts` 封装。
- 需自行实现版本迁移与错误处理。

## 相关文档

- `./03-architecture-standards.md`
