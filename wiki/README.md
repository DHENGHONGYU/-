---
title: V9 统一 WIKI 总入口
type: reference
domain: project
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "跨平台 WIKI 单一真相源总入口，服务开发者与使用者双视角，各平台目录仅做薄适配"
tags: [wiki, contract, governance, platform, index]
version: v1.0.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-WIKI-001
related_docs: [V9-DOC-WIKI-002, V9-DOC-WIKI-003, V9-DOC-WIKI-010, V9-DOC-WIKI-011]
change_log:
  - version: v1.0.0
    changes: "初版：建立跨平台统一 WIKI 真相源，含契约、平台配置卡、环境配置、技能索引与代码 Wiki 迁入"
    date: 2026-08-23
---

# V9 统一 WIKI 总入口

> **单一真相源**：本目录（`wiki/`）是 FinSight V9 跨平台 WIKI / 环境配置 / 体系文档的唯一权威位置。
> TRAE、WorkBuddy、KIMI、Qoder、Cursor / VS Code 等平台的专属目录（`.trae/`、`.workbuddy/`、`plugins/`、`.qoder/`、`.cursorrules`）均为**薄适配层**，只承载加载器必需的最小入口，内容一律指向本目录。
> 契约正文见 [CONTRACT.md](CONTRACT.md)，机器可读注册表见 [platform-config.registry.json](platform-config.registry.json)。

## 一、平台映射总表

| 平台 | 专属目录 | 适配文件 | 内容来源（真相源） | 同步机制 |
|---|---|---|---|---|
| TRAE | `.trae/` | `.trae/skills/INDEX.md`（指针） | `wiki/skills/INDEX.md` + `.trae/skills/skill-registry.json`（机器真相） | 人工 + `audit:platform-docs` |
| WorkBuddy | `.workbuddy/` | `.workbuddy/skills/README.md`（指针） | `.agents/skills/`（经 `npm run skill:mirror` 覆盖式镜像） | `skill:mirror` 自愈 |
| KIMI / 外部插件 | `plugins/` | `plugins/README.md`（指针） | `wiki/skills/INDEX.md` L2 段 | 人工登记 |
| Qoder | `.qoder/repowiki/` | 无（机器生成产物，禁手改） | 平台自动生成，登记于契约 | 平台自动重生成 |
| Cursor / VS Code | `.cursorrules` / `prompts/` | `.cursorrules`（薄适配） | `wiki/CONTRACT.md` + `prompts/*.md` | 人工 |
| 全局契约 | `AGENTS.md` | — | `AGENTS.md` 本体 + `wiki/CONTRACT.md` 指针 | 版本化升级 |

## 二、开发者视图

面向参与开发、提交代码、维护文档的工程师：

| 主题 | 入口 |
|---|---|
| 跨平台统一契约（必读） | [CONTRACT.md](CONTRACT.md) |
| 代码 Wiki（架构/模块/核心 API/数据流/运行） | [code-wiki/README.md](code-wiki/README.md) |
| 技能体系索引（L1 物理 + L2 插件 + L3 虚拟） | [skills/INDEX.md](skills/INDEX.md) |
| 运行环境配置（Node/端口/环境变量/venv） | [environment/environment-setup.md](environment/environment-setup.md) |
| 各平台环境配置卡 | [platforms/](platforms/) |
| 开发过程文档（Diataxis 体系，不变） | [docs/README.md](../docs/README.md) |
| AI 行为约束契约 | [AGENTS.md](../AGENTS.md) |
| 团队流程 SOP | [docs/guides/sops/README.md](../docs/guides/sops/README.md) |

## 三、使用者视图

面向使用本系统进行投研复盘的最终用户：

| 主题 | 入口 |
|---|---|
| 快速开始（环境要求与启动） | [code-wiki/05-getting-started.md](code-wiki/05-getting-started.md) |
| 系统是什么（项目定位与五舱工作流） | [code-wiki/01-architecture-overview.md](code-wiki/01-architecture-overview.md) |
| 项目总览 | [README.md](../README.md) |
| 版本发布记录 | [docs/releases/](../docs/releases/) |

## 四、维护约定

- 本目录下所有 Markdown 一律携带 Frontmatter（title/version/last_updated/doc_id/change_log），版本三对齐。
- 平台专属目录内**禁止**私写知识副本；新增平台先在本目录登记（CONTRACT §二 + registry JSON），再建薄适配。
- 变更后必须运行 `npm run audit:platform-docs` 全绿。
