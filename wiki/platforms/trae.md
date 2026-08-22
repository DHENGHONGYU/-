---
title: 平台环境配置卡 · TRAE
type: reference
domain: project
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "TRAE 平台在本项目的目录布局、加载机制、环境要求与真相源映射"
tags: [wiki, platform, trae, environment]
version: v1.0.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-WIKI-004
related_docs: [V9-DOC-WIKI-002, V9-DOC-WIKI-010]
change_log:
  - version: v1.0.0
    changes: "初版：TRAE 平台环境配置卡"
    date: 2026-08-23
---

# 平台环境配置卡 · TRAE

<!-- WIKI-ADAPTER: source=wiki/ -->

> 契约见 [wiki/CONTRACT.md](../CONTRACT.md)；本卡只描述 TRAE 平台专属的环境事实。

## 目录布局

| 路径 | 性质 | 说明 |
|---|---|---|
| `.trae/skills/INDEX.md` | 适配指针 | 指向 `wiki/skills/INDEX.md`，不复述技能清单 |
| `.trae/skills/skill-registry.json` | 平台专属机器真相 | 技能注册表单一真相源（L1/L2/L3 分层、triggers/gates/mandatory 字段），`audit:skill-coverage` 消费 |
| `.trae/skills/usage.log` | 平台日志 | `skill-router` 命中记录 |
| `.trae/specs/` | 平台规格 | 如 `pre-launch-sop-suite` |
| `.trae/mcp-whitelist-policy.json` | 平台专属机器配置（代码声明） | `src/config/security-policy.ts` 强制加载的安全策略；当前磁盘缺失时须按代码 schema 补建后方可运行相关门禁 |
| `.trae/logs/` | 平台日志 | 平台运行日志 |

## 加载机制

- TRAE 经 `.trae/skills/skill-registry.json` 解析技能触发（关键词/文件/事件 × mandatory 门禁）。
- 路由器 `scripts/skill-router.cjs` 挂 pre-commit 提醒模式、pre-push 强制模式（`--enforce --since <base>`）。
- 技能本体不在 `.trae/skills/`，而在 `.agents/skills/*/SKILL.md`（L1 物理）与 `plugins/*/skills/`（L2 插件）。

## 环境要求

- Node 20；技能路由与审计脚本经 `npm run skill:route` / `npm run audit:skill-coverage` 执行。
- 新增/变更技能必须三方同步：SKILL.md frontmatter ↔ skill-registry.json ↔ AGENTS.md 技能索引（`audit:skill-coverage` 强校验）。

## 与真相源的映射

- 技能体系人类可读索引 → `wiki/skills/INDEX.md`
- 技能触发词/门禁机器字段 → `.trae/skills/skill-registry.json`（保持不动）
- 契约与平台治理规则 → `wiki/CONTRACT.md`
