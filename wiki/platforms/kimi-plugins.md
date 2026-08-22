---
title: 平台环境配置卡 · KIMI / 外部插件
type: reference
domain: project
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "plugins/ 外部插件技能（含 kimi-webbridge）的目录布局与登记约定"
tags: [wiki, platform, kimi, plugins, environment]
version: v1.0.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-WIKI-007
related_docs: [V9-DOC-WIKI-002, V9-DOC-WIKI-010]
change_log:
  - version: v1.0.0
    changes: "初版：KIMI / 外部插件平台环境配置卡"
    date: 2026-08-23
---

# 平台环境配置卡 · KIMI / 外部插件

<!-- WIKI-ADAPTER: source=wiki/ -->

> 契约见 [wiki/CONTRACT.md](../CONTRACT.md)；本卡只描述外部插件（KIMI 生态）专属的环境事实。

## 目录布局

| 路径 | 性质 | 说明 |
|---|---|---|
| `plugins/<name>/SKILL.md` | 插件技能本体（L2） | 每插件一份技能描述，由 TRAE CN / Kimi Code 等插件加载器消费 |
| `plugins/<name>/scripts/` | 插件脚本 | 各数据源 Python 调用脚本（如 `ifind_tool.py`） |
| `plugins/README.md` | 适配指针 | 指向 `wiki/skills/INDEX.md` L2 段 |
| `docs/plugins/` | 插件整理文档 | 各插件的详细说明（属 docs/ Diataxis 体系） |

## 插件清单（9 项，与 skill-registry.json externalPluginSkills 对齐）

| 插件 | 用途 |
|---|---|
| ifind | 同花顺数据采集 |
| imf | IMF 数据 |
| kimi-webbridge | Kimi 网页桥接 |
| scholar | 学术文献 |
| sec_edgar | SEC EDGAR |
| tianyancha | 天眼查 |
| world_bank_open_data | 世界银行开放数据 |
| yahoo_finance | 雅虎财经 |
| yuandian_law | 圆点法律 |

## 登记约定

- 新增/删除插件必须三方同步：`plugins/<name>/SKILL.md` ↔ `.trae/skills/skill-registry.json`（externalPluginSkills）↔ `wiki/skills/INDEX.md` L2 段。
- 插件保持原位，不迁入 `.agents/skills/`（外部生态边界清晰）。

## 与真相源的映射

- 技能体系索引 → `wiki/skills/INDEX.md`（L2 段）
- 契约 → `wiki/CONTRACT.md`
