---
title: 平台环境配置卡 · Cursor / VS Code
type: reference
domain: project
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: ".cursorrules 薄适配与 prompts/ 模板体系的编码与维护约定"
tags: [wiki, platform, cursor, vscode, environment]
version: v1.0.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-WIKI-008
related_docs: [V9-DOC-WIKI-002]
change_log:
  - version: v1.0.0
    changes: "初版：Cursor / VS Code 平台环境配置卡"
    date: 2026-08-23
---

# 平台环境配置卡 · Cursor / VS Code

<!-- WIKI-ADAPTER: source=wiki/ -->

> 契约见 [wiki/CONTRACT.md](../CONTRACT.md)；本卡只描述 Cursor / VS Code 专属的环境事实。

## 文件布局

| 路径 | 性质 | 说明 |
|---|---|---|
| `.cursorrules` | 薄适配 | 指向 `wiki/CONTRACT.md` + `prompts/` 模板的强制行为清单，不复述契约正文 |
| `prompts/` | 提示词模板体系 | `system-prompt-template.md` / `component-prompt-template.md` / `service-prompt-template.md` / `store-prompt-template.md` / `types-prompt-template.md` 等，供 Cursor 与各类 AI 工具加载 |
| `.devcontainer/devcontainer.json` | 容器环境 | Dev Container 统一开发环境定义 |

## 维护约定

- `.cursorrules` 与 `prompts/` 下模板必须保持 **UTF-8（无 BOM）**；历史曾因 GBK 编码产生乱码，发现乱码先修复再编辑。
- 强制行为清单（分层生成顺序、颜色令牌、DataBridge、门禁假设等）变更时，同步核对 `wiki/CONTRACT.md` 与 AGENTS.md 对应章节。
- VS Code 无专属知识目录要求；工作区级配置以 `.devcontainer/` 与本仓配置为准。

## 与真相源的映射

- 契约与平台治理 → `wiki/CONTRACT.md`
- 提示词模板本体 → `prompts/`（保持原位，`.cursorrules` 引用）
- 运行环境 → `wiki/environment/environment-setup.md`
