---
title: 归档目录
type: meta
domain: project
phase: maintenance
status: active
maintainer: V9 团队
summary: "废弃/历史/草稿文档归档区（十目录架构之一）"
tags: [archive]
version: v2.0.0
last_updated: 2026-08-03
---

# 归档目录（archive/）

> **定位**：十目录架构之一，存放已废弃、过时或不再维护的文档与历史记录。
> 权威定义见 [doc-management-principles SKILL](../../../.trae/skills/doc-management-principles/SKILL.md)。

## 当前状态

本目录已于 2026-08-03 上线前精简中清空历史治理文档（原 `00-meta-historical/`、
`audit-reports/`、`migration-backup-20260724/` 等）。这些文件均经 git 历史保留备份，
符合"已备份非必要资料彻底删除"的上线精简原则。

## 归档规则

| 类型 | 命名 | 保留期限 | 清理规则 |
|------|------|----------|----------|
| 废弃文档 | `DEPRECATED_*.md` | 3 个月 | 标记废弃后 3 个月移除 |
| 历史版本 | `old-versions/` | 永久 | 重要里程碑保留 |
| 迁移备份 | `migration-backup-YYYYMMDD/` | 1 个月 | 迁移完成验证后清理 |

## 归档流程

1. 在原文件 frontmatter 标记 `status: archived`
2. 移动至 `archive/` 对应子目录
3. 更新 `../meta/` 下的索引与 `_redirect-map.json`
4. 在 frontmatter `change_log` 记录归档原因

## 注意事项

- **禁止直接删除**：必须先归档再清理，git 历史即备份
- **单一权威**：归档文件不再维护，引用应指向权威位置而非归档副本
- **失效即修**：发现指向归档的断链应立即更新或移除
