---
title: 平台环境配置卡 · Qoder
type: reference
domain: project
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "Qoder 平台 repowiki 机器生成产物的登记与禁手改约定"
tags: [wiki, platform, qoder, environment]
version: v1.0.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-WIKI-006
related_docs: [V9-DOC-WIKI-002]
change_log:
  - version: v1.0.0
    changes: "初版：Qoder 平台环境配置卡"
    date: 2026-08-23
---

# 平台环境配置卡 · Qoder

<!-- WIKI-ADAPTER: source=wiki/ -->

> 契约见 [wiki/CONTRACT.md](../CONTRACT.md)；本卡只描述 Qoder 平台专属的环境事实。

## 目录布局

| 路径 | 性质 | 说明 |
|---|---|---|
| `.qoder/repowiki/` | 机器生成产物（`generated: true`，禁手改） | Qoder 平台自动生成的仓库 Wiki（knowledge 知识卡片 + `zh/content` 中文 Wiki + metadata） |
| `.qoder/repowiki/wiki_plan.yaml` | 机器文件 | 平台生成计划 |
| `.qoder/repowiki/zh/meta/repowiki-metadata.json` | 机器文件 | 平台元数据 |
| `.qoder/better-harness/` | 平台运行时 | 平台运行时产物，不进契约 |

## 加载机制与约定

- `.qoder/repowiki/` 由 Qoder 平台扫描代码自动生成，内容与 `wiki/` 可能存在时差。
- **禁止手改**该目录下任何文件；需要更新时触发平台重生成。
- 事实冲突时以 `wiki/` 与 `AGENTS.md` 为准；repowiki 仅作平台检索辅助。

## 与真相源的映射

- 对外权威代码 Wiki → `wiki/code-wiki/`（人工维护、代码扫描核对）
- 契约 → `wiki/CONTRACT.md`
