---
title: 平台环境配置卡 · 全局契约（AGENTS.md / .agents）
type: reference
domain: project
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "AGENTS.md 全局契约与 .agents/ 物理技能目录的定位与最小改动约定"
tags: [wiki, platform, agents, environment]
version: v1.0.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-WIKI-009
related_docs: [V9-DOC-WIKI-002, V9-DOC-WIKI-010]
change_log:
  - version: v1.0.0
    changes: "初版：全局契约平台环境配置卡"
    date: 2026-08-23
---

# 平台环境配置卡 · 全局契约（AGENTS.md / .agents）

<!-- WIKI-ADAPTER: source=wiki/ -->

> 本卡描述全局契约与 `.agents/` 目录的定位；跨平台契约正文见 [wiki/CONTRACT.md](../CONTRACT.md)。

## 文件布局

| 路径 | 性质 | 说明 |
|---|---|---|
| `AGENTS.md` | 全局 AI 行为约束契约 | 版本化管理（当前 v1.7.7），`audit:agents-consistency` 校验 A1–A7；与 `wiki/CONTRACT.md` 冲突时以 AGENTS.md 为准 |
| `.agents/skills/<slug>/SKILL.md` | L1 物理技能本体（22 项） | 所有项目级技能唯一物理位置；新增必须从 `_SKILL-TEMPLATE.md` 复制起步 |
| `.agents/skills/_SKILL-TEMPLATE.md` | 官方骨架模板 | 5 段式 S 级模板，不计入技能计数 |
| `.agents/skills/README.md` | 适配指针 | 指向 `wiki/skills/INDEX.md` 与 `wiki/CONTRACT.md` |

## 维护约定

- AGENTS.md 升级遵循版本化流程：`last_updated` / `code_version` / `change_log` 同步，基准日校对三步法（R1 取真值 → R2 PATCH++ → 闭环）。
- `.agents/skills/` 变更后须重跑 `npm run skill:mirror`（同步 WorkBuddy 镜像）与 `npm run audit:skill-coverage`。
- AGENTS.md 保持「最小改动原则」：跨平台体系性内容下沉 `wiki/`，AGENTS.md 只留契约声明与指针。

## 与真相源的映射

- 技能体系索引 → `wiki/skills/INDEX.md`
- 跨平台契约 → `wiki/CONTRACT.md`
- 机器注册表 → `.trae/skills/skill-registry.json`
