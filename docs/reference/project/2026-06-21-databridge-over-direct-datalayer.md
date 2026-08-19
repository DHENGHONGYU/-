---
title: ADR-003: DataBridge 替代直接 dataLayer 写入
type: reference
domain: data
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 背景 跨模块写操作需要来源追溯、权限控制、审计日志与事件通知。"
tags: [data, databridge, adr]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-DATA-042
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ADR-003: DataBridge 替代直接 dataLayer 写入

> **Status**: Accepted  
> **Version**: v1.0.0  
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

- `../../explanation/05-engine-specs.md`
- `../data-interaction-protocols.md`（已归档）
