---
title: 2026-06-20-indexeddb-over-localstorage
code_version: 2.0.0

tier: reference
---

---
title: ADR-002: IndexedDB 替代 localStorage
version: v0.9.0
last_updated: 2026-06-24
maintainer: V9 Architecture Team
status: active
change_log:
  - date: 2026-06-24
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）
code_version: 2.0.0
tier: reference
---
# ADR-002: IndexedDB 替代 localStorage

> **Status**: Accepted  
> **Version**: v0.9.0-docs-review  
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
