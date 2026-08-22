---
title: 平台环境配置卡 · WorkBuddy
type: reference
domain: project
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "WorkBuddy 平台目录布局、镜像同步机制与禁改约定"
tags: [wiki, platform, workbuddy, environment]
version: v1.0.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-WIKI-005
related_docs: [V9-DOC-WIKI-002, V9-DOC-WIKI-010]
change_log:
  - version: v1.0.0
    changes: "初版：WorkBuddy 平台环境配置卡"
    date: 2026-08-23
---

# 平台环境配置卡 · WorkBuddy

<!-- WIKI-ADAPTER: source=wiki/ -->

> 契约见 [wiki/CONTRACT.md](../CONTRACT.md)；本卡只描述 WorkBuddy 平台专属的环境事实。

## 目录布局

| 路径 | 性质 | 说明 |
|---|---|---|
| `.workbuddy/skills/` | 镜像目标（禁手改） | 经 `npm run skill:mirror` v2 同步：Windows 首选目录联接（junction，物理只有一份、零漂移），失败降级覆盖式 cp 镜像；供 WorkBuddy 加载器经 `Skill()` 消费 |
| `.workbuddy/skills/README.md` | 适配指针 | 指向 `wiki/skills/INDEX.md`，标注镜像维护方式 |
| `.workbuddy/memory/` | 平台记忆 | WorkBuddy 会话记忆（MEMORY.md + 按日快照），平台专属，不进 `wiki/` |

## 加载机制与同步

- WorkBuddy 加载器仅扫描 `~/.workbuddy/skills/` 与 `{workspace}/.workbuddy/skills/`，不扫 `.agents/skills/`，故需镜像。
- 镜像唯一入口：`npm run skill:mirror`（`scripts/skill-mirror.cjs` v2：junction 优先，cp 兜底；`.workbuddy/skills/` 已 gitignore，不影响 git）。
- 已是 cp 副本的旧环境：重跑镜像脚本会自动清理并重建 junction（失败降级重建 cp）。
- 每目录须含 `SKILL.md` 且 `name` 字段与目录名一致。

## 环境要求与禁改约定

- 修改技能一律改源头 `.agents/skills/<slug>/SKILL.md`；junction 模式下自动生效，cp 降级模式下须重跑镜像。
- 禁止直接编辑 `.workbuddy/skills/` 下任何副本；发现副本与源头不一致以源头为准重跑镜像。
- `.workbuddy/memory/` 为平台运行时产物，不参与文档契约审计。

## 与真相源的映射

- 技能体系索引 → `wiki/skills/INDEX.md`（L1 段）
- 技能本体真相源 → `.agents/skills/`
- 契约 → `wiki/CONTRACT.md`
