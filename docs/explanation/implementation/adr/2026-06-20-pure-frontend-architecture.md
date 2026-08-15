---
title: ADR-001: 纯前端无后端架构
version: v0.9.0-docs-review
last_updated: 2026-06-24
maintainer: V9 Architecture Team
status: active
change_log:
  - version: v0.9.0-docs-review
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-06-24
  - date: 2026-06-24
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）
---
# ADR-001: 纯前端无后端架构

> **Status**: Accepted  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24

- 状态：已接受
- 日期：2026-06-20
- 决策人：@architect

## 背景

V9 面向中国 A 股个人投资者，需要本地主权数据、离线可用、低运维成本。

## 选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| A. 纯前端 + IndexedDB | 数据不上传、离线可用、静态托管 | 无法跨设备同步、计算受浏览器性能限制 |
| B. 轻量后端 + SQLite | 可跨设备、计算能力强 | 需要服务器、运维成本高、数据主权风险 |

## 决策

选择 A。V9 作为个人研究工具，数据主权与离线可用优先级最高。

## 后果

- 所有数据持久化到 IndexedDB。
- 复杂计算（评分、回测）需控制数据量与算法复杂度。
- 跨设备同步通过导入/导出 JSON 实现。

## 相关文档

- `../../03-architecture-standards.md`
- `docs/explanation/implementation/data-interaction-protocols.md`
