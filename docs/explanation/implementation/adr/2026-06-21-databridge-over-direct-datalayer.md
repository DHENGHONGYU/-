---
title: ADR-003: DataBridge 替代直接 dataLayer 写入
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
# ADR-003: DataBridge 替代直接 dataLayer 写入

> **Status**: Accepted  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24

- 状态：已接受
- 日期：2026-06-21
- 决策人：@architect

## 背景

跨模块写操作需要来源追溯、权限控制、审计日志与事件通知。

## 选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| A. DataBridge + Envelope | 明确边界、ACL、审计、广播 | 增加少量样板代码 |
| B. 直接调用 dataLayer | 简单直接 | 来源难追溯、权限分散、难以审计 |

## 决策

选择 A。所有跨模块写操作必须经 `DataBridge.forward()`。

## 后果

- L5/L4 禁止直接写 dataLayer。
- 每个 envelope 携带 source/target/action/traceId/timestamp。
- 自动写入 `research_logs` 审计日志。

## 相关文档

- `../../05-engine-specs.md`
- `docs/explanation/implementation/data-interaction-protocols.md`
