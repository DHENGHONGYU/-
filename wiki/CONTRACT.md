---
title: 跨平台 WIKI 统一契约
type: contract
domain: project
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "TRAE/WorkBuddy/KIMI/Qoder/Cursor/VS Code 等平台 WIKI 与文档体系统一为环境配置的强制契约"
tags: [wiki, contract, governance, platform, environment]
version: v1.0.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-WIKI-002
related_docs: [V9-DOC-WIKI-001, V9-DOC-WIKI-003, V9-DOC-WIKI-010]
change_log:
  - version: v1.0.0
    changes: "初版：确立单一真相源原则、平台映射表、同步规则、禁止事项与变更纪律"
    date: 2026-08-23
---

# 跨平台 WIKI 统一契约

> **强制等级**：本契约对所有 AI 辅助开发工具与人工维护者同等生效。
> **机器可读注册表**：[platform-config.registry.json](platform-config.registry.json)（`npm run audit:platform-docs` 消费）。
> **上位契约**：[AGENTS.md](../AGENTS.md)（AI 行为约束）；冲突时以 AGENTS.md 为准并同步修订本契约。

## 一、单一真相源原则

1. `wiki/` 目录是跨平台 WIKI、环境配置、体系文档的**唯一权威位置**。
2. 各平台专属目录（`.trae/`、`.workbuddy/`、`plugins/`、`.qoder/`、`.agents/`、`.cursorrules`）只允许存放两类内容：
   - **适配指针**：头部带 `<!-- WIKI-ADAPTER: source=wiki/ -->` 标记、指向 `wiki/` 对应文档的薄文件；
   - **平台专属最小配置**：仅该平台加载器可消费、且 `wiki/` 无法表达的机器文件（如 `skill-registry.json`、`mcp-whitelist-policy.json`、平台日志）。
3. 任何体系性知识、SOP、索引、环境说明**首次编写与后续修改都只发生在 `wiki/`**；平台目录不得保留内容副本（机器镜像除外，见 §三）。
4. `docs/`（Diataxis 体系）保持原职责：开发过程文档（规格/解释/指南/参考/治理）。`wiki/` 是对外统一门面，两者通过 doc_id 与链接互引，不得互相复制正文。

## 二、平台映射表（平台 → 目录 → 适配文件 → 同步机制 → 漂移风险）

| 平台 | 目录 | 适配文件 | 内容来源 | 同步机制 | 漂移风险与对策 |
|---|---|---|---|---|---|
| TRAE | `.trae/` | `.trae/skills/INDEX.md`（指针） | `wiki/skills/INDEX.md` | 人工 + 审计 | 历史曾漂移（19 项旧索引）；改由指针消除 |
| TRAE（机器真相） | `.trae/skills/` | `skill-registry.json` | registry 自身 | `audit:skill-coverage` 三方一致性 | 保持机器真相源地位，不改写 |
| WorkBuddy | `.workbuddy/skills/` | `README.md`（指针） | `.agents/skills/`（物理技能） | `npm run skill:mirror` 覆盖式镜像 | 拷贝漂移；禁手改副本，改源头后重跑镜像 |
| KIMI / 外部插件 | `plugins/` | `plugins/README.md`（指针） | `wiki/skills/INDEX.md` L2 段 | 人工登记 | 新增插件须同步登记 |
| Qoder | `.qoder/repowiki/` | 无 | 平台自动生成 | 平台重生成 | `generated: true` 禁手改 |
| Cursor / VS Code | `.cursorrules` + `prompts/` | `.cursorrules`（薄适配） | `wiki/CONTRACT.md` + `prompts/*.md` | 人工 | 文件必须保持 UTF-8（历史 GBK 乱码教训） |
| 全局契约 | `AGENTS.md` | — | AGENTS.md 本体 | 版本化升级 + `audit:agents-consistency` | 最小改动原则 |

## 三、同步规则

1. **镜像型同步（WorkBuddy）**：`.agents/skills/` → `.workbuddy/skills/` 仅经 `npm run skill:mirror`（`scripts/skill-mirror.cjs` v2：Windows 首选目录联接 junction 零漂移，失败降级覆盖式 cp 镜像并告警）。
2. **指针型同步（TRAE/KIMI/Cursor）**：适配文件正文只写「指向 + 平台专属最小差异」，不复述 `wiki/` 内容。
3. **机器生成产物（`.qoder/repowiki`）**：registry JSON 中标注 `generated: true`；任何人不得手改，需求反馈到平台重生成流程。
4. **重定向**：从 `docs/` 迁往 `wiki/` 的文档，旧路径必须登记进 `docs/_redirect-map.json`（含 `diataxis_category` 与 `status`）。
5. **编码**：所有适配文件与 `wiki/` 文档一律 UTF-8（无 BOM）；发现乱码先按编码修复流程处理，不得在乱码上继续编辑。

## 四、禁止事项

1. 禁止在任何平台目录内私写知识副本（含重复的技能索引、环境说明、架构描述）。
2. 禁止手写空白 SKILL.md——新增 L1 物理技能必须从 `.agents/skills/_SKILL-TEMPLATE.md` 复制起步（AGENTS.md 骨架模板双保险规定）。
3. 禁止绕过 `wiki/platform-config.registry.json` 新增平台目录或适配文件。
4. 禁止手改 `.qoder/repowiki/` 下机器生成内容。
5. 禁止 `git add -A`；提交一律精确路径（沿用提交卫生硬约束）。

## 五、变更纪律

1. 修改本契约或平台映射：同步更新 `platform-config.registry.json`，并运行 `npm run audit:platform-docs` 全绿。
2. `wiki/` 下文档变更：Frontmatter 版本三对齐（version / last_updated / change_log），doc_id 登记 `docs/meta/doc-id-registry.md`。
3. 新增平台：先补 `wiki/platforms/<platform>.md` 环境配置卡 + registry 条目，再创建平台目录与适配文件。
4. 适配文件被平台工具覆写损坏时：以本契约与 `wiki/` 为准重建，并复盘是否需要在平台侧加只读保护。

## 六、审计门禁

| 命令 | 校验内容 |
|---|---|
| `npm run audit:platform-docs` | 契约三核心文件存在且新鲜；注册表 ↔ 物理目录/适配文件一致；`WIKI-ADAPTER` 标记与指向有效；无知识副本残留 |
| `npm run audit:skill-coverage` | SKILL frontmatter ↔ registry ↔ AGENTS.md 三方一致性（既有） |
| `npm run audit:agents-consistency` | AGENTS.md 契约一致性 A1–A7（既有） |
| `npm run audit:docs` | docs/ 文档同步与版本漂移（既有，不覆盖 wiki/） |
