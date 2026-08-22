---
title: V9 SKILL 索引（指针）
type: meta
domain: project
phase: development
tier: reference
status: active
maintainer: current developer
summary: "指针文件：技能统一索引已迁至 wiki/skills/INDEX.md，本文件不再维护内容副本"
tags: [project, skill, meta, governance, index]
version: v2.0.0
last_updated: 2026-08-23
doc_id: V9-DOC-PROJ-SKILLINDEX-001
change_log:
  - version: v2.0.0
    changes: "跨平台 WIKI 统一契约：改写为指针文件，内容真相源迁至 wiki/skills/INDEX.md（机器真相源仍为同目录 skill-registry.json）"
    date: 2026-08-23
  - version: v1.5.1
    changes: '文档新鲜度刷新：同步 frontmatter 与变更日志至 2026-08-11'
    date: 2026-08-11
---

# V9 SKILL 索引（指针）

<!-- WIKI-ADAPTER: source=wiki/ -->

> **本文件不再维护技能清单内容**（历史版本曾停留 19 项旧口径，已与真相源漂移）。
> 按 [跨平台 WIKI 统一契约](../../wiki/CONTRACT.md)，技能索引统一由单一真相源承载：

| 需求 | 入口 |
|---|---|
| 人类可读统一技能索引（L1+L2+L3 分层） | [wiki/skills/INDEX.md](../../wiki/skills/INDEX.md) |
| 机器可读注册表（triggers/gates/mandatory） | [skill-registry.json](skill-registry.json)（本目录，保持不动） |
| 跨平台加载契约与平台目录布局 | [.agents/skills/README.md](../../.agents/skills/README.md) |
| 技能路由（会话级） | AGENTS.md「技能路由表」 |
| 技能触发使用日志 | [usage.log](usage.log)（skill-router 写入，运行时产物） |

## 本目录约定

`.trae/skills/` **仅存放索引文件，无技能本体**：`INDEX.md`（本指针）+ `skill-registry.json`（机器真相源，`audit:skill-coverage` 依赖路径不可迁移）+ `usage.log`。
技能本体一律位于 `.agents/skills/*/SKILL.md`（L1 物理 22 项，5 段式骨架）；WorkBuddy / Qoder 经 `.workbuddy/skills` 目录联接（junction）加载，重建命令：`npm run skill:mirror`。

变更纪律：新增/变更技能三方同步（SKILL.md frontmatter ↔ skill-registry.json ↔ wiki/skills/INDEX.md），交付前跑 `npm run audit:skill-coverage`。
