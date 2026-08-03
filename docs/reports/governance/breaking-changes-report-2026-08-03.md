---
doc_id: V9-DOC-GOV-001
title: 破坏性变更报告 — 上线前工具配置整合与废弃文件清理
status: active
version: v1.0.0
last_updated: 2026-08-03
code_version: 2.0.0
category: governance
tags: [breaking-changes, cleanup, deprecated, workbuddy, trae]
related_docs: [V9-DOC-GOV-002]
---

# 破坏性变更报告 — 上线前工具配置整合与废弃文件清理

> **日期**: 2026-08-03  
> **执行人**: V9 Dev  
> **变更类型**: 破坏性（文件删除 + 配置变更 + 引用迁移）

---

## 1. 变更概要

本次变更整合了 WorkBuddy/Trae 双开发工具配置体系，删除了所有废弃和待删除文件，清理了失效引用，并标准化了开发工具配置。共计删除 **439 个文件**，修改 **20+ 个引用文件**。

### 1.1 变更类型矩阵

| 变更类型 | 影响范围 | 严重级别 | 可逆性 |
|----------|----------|----------|--------|
| 目录删除（`.workbuddy/`） | 开发工具配置 | P1 | Git 历史可回溯 |
| 目录删除（`docs/_pending-deletion/`） | 文档（414 文件） | P2 | Git 历史可回溯 |
| 目录删除（`deprecated-docs/` × 3） | 文档（18 文件） | P2 | Git 历史可回溯 |
| 文件删除（deprecated × 7） | 文档 | P2 | Git 历史可回溯 |
| 脚本删除（一次性 × 2） | 工具脚本 | P3 | Git 历史可回溯 |
| 配置变更（mcp.json/API Key） | 开发工具配置 | P0 | 手动恢复 |
| 引用迁移（`.workbuddy/skills/` → `.trae/skills/`） | 文档/索引/脚本 | P1 | 已完成 |
| 代码清理（env-path-guard 死代码） | 工具脚本 | P3 | 已完成 |

---

## 2. 受影响组件清单

### 2.1 删除的目录与文件

| # | 路径 | 内容 | 文件数 | 删除原因 |
|---|------|------|--------|----------|
| 1 | `.workbuddy/` | WorkBuddy 工具配置（automations/bin/memory） | 38 | 已迁移至 `.trae/`，消除双体系 |
| 2 | `docs/_pending-deletion/` | 一次性治理报告、破损文件名、重复 HTML | 414 | 上线前待清理 |
| 3 | `docs/meta/deprecated-docs/` | 旧版文档（v1.0.0/v1.6.0）+ 临时文件 | 7 | 已被新版本替代 |
| 4 | `docs/reference/meta/deprecated-docs/` | 重复的临时文件 | 2 | 重复目录 |
| 5 | `docs/explanation/implementation/deprecated/` | DEPRECATED_ 前缀文档（9 份） | 9 | 内容已合并至活跃文档 |
| 6 | `docs/meta/cross-index-comprehensive-solution.md` | 交叉索引规划文档 | 1 | status: deprecated |
| 7 | `docs/explanation/deprecated-*.md` | 合并报告 + 问题解决计划 | 2 | status: deprecated |
| 8 | `docs/reference/deprecated-ui-module-alignment.md` | UI 模块对齐文档 | 1 | status: deprecated |
| 9 | `docs/reference/changelogs/2026-07/...jira-tickets.md` | JIRA 票据日志 | 1 | status: deprecated |
| 10 | `scripts/fix/fix-cross-references.ts` | 一次性修复脚本 | 1 | 引用已删除目录 |
| 11 | `scripts/other/rename-ah-index-files.ts` | 一次性重命名脚本 | 1 | 引用已删除目录 |

### 2.2 修改的引用文件

| # | 文件 | 变更内容 |
|---|------|----------|
| 1 | `AGENTS.md` | changelog 中 `.workbuddy/skills/` → `.trae/skills/` |
| 2 | `scripts/skill-router.cjs` | 注释路径修正 |
| 3 | `docs/meta/ai-index/skill-doc-index.json` | 3 个 SKILL 路径修正 |
| 4 | `docs/guides/development/mock-data-cleanup-lessons.md` | 2 处路径修正 |
| 5 | `docs/guides/development/mcp-cli-skill-strategy.md` | 1 处路径修正 |
| 6 | `docs/guides/how-to/COLOR-TOKEN-GUIDE.md` | 路径修正 |
| 7 | `docs/guides/how-to/MCP-LIFECYCLE-GUIDE.md` | 路径修正 |
| 8 | `docs/reports/ops/backup-governance.md` | 标记已删除脚本 |
| 9 | `scripts/docs-tool/migrate-doc-categories.ts` | 日志路径 + skipPatterns 修正 |
| 10 | `scripts/env-path-guard.cjs` | 移除 inMemory 死代码 + .workbuddy-backup SKIP_DIRS |
| 11 | `docs/meta/ai-index/relation-index.json` | 移除 6 处失效引用 |
| 12 | `docs/meta/ai-index/master-index.json` | 移除 5 处失效引用 |
| 13 | `docs/meta/GOVERNANCE.md` | 移除失效表格行 |
| 14 | `docs/meta/REGISTRY_INDEX.md` | 移除 3 个失效归档链接 |
| 15 | `docs/meta/type-domain-audit-worksheet.md` | 移除 3 行失效链接 |
| 16 | `docs/explanation/design/00-readme.md` | 废弃文档表改为删除记录 |
| 17 | `docs/reference/v9-system-blueprint.md` | referenced_by 移除失效条目 |
| 18 | `docs/reference/data_link_sequence_diagram.md` | referenced_by 移除失效条目 |
| 19 | `docs/reference/data-interaction-protocols.md` | referenced_by 移除失效条目 |
| 20 | `.gitignore` | 移除 .workbuddy 规则 |
| 21 | `cspell.json` | 新增 24 个项目术语 |
| 22 | `.env.local` / `.env.local.example` | 新增 ARK_API_KEY 配置 |
| 23 | `.trae/mcp.json.example` | 路径动态化 `${workspaceFolder}` |
| 24 | `scripts/fix/README.md` | 移除已删除脚本条目 |

### 2.3 配置变更

| 配置项 | 变更前 | 变更后 | 影响 |
|--------|--------|--------|------|
| API Key 存储 | `.trae/mcp.json` 硬编码 | `.env.local` 环境变量 | 密钥不再入库 |
| 文件系统 MCP 路径 | `G:\\FinSightV9` 硬编码 | `${workspaceFolder}` | 跨用户可移植 |
| SKILL 注册表 | `.workbuddy/skills/skill-registry.json` | `.trae/skills/skill-registry.json` | 单一真相源 |
| cSpell 词典 | 2 个词 | 26 个词 | 消除技术术语 Info 提示 |

---

## 3. 变更前后对比

### 3.1 开发工具配置体系

**变更前（双体系并行）**:
```
.workbuddy/
├── automations/     # WorkBuddy 自动化任务
├── bin/             # Kimi Desktop npm shim（硬编码路径）
├── memory/          # 每日日志
└── skills/          # SKILL 注册表（已删除，但文档仍引用）

.trae/
├── mcp.json         # MCP 配置（含硬编码 API Key）
├── settings.json    # Trae IDE 设置
└── skills/          # SKILL 注册表（单一真相源 v2.0.0）
```

**变更后（单一体系）**:
```
.trae/
├── mcp.json         # MCP 配置（${ARK_API_KEY} 环境变量，需手动更新）
├── mcp.json.example # 模板（${workspaceFolder} 动态路径）
├── settings.json    # Trae IDE 设置
└── skills/          # SKILL 注册表（单一真相源 v2.0.0，20 个技能）
```

### 3.2 废弃文件治理

**变更前**: 439 个废弃/待删除文件散布在 6 个目录  
**变更后**: 0 个废弃文件（全部物理删除，Git 历史可回溯）

---

## 4. 迁移指南

### 4.1 开发者环境迁移

1. **更新 `.trae/mcp.json`**（手动操作，IDE 受保护文件）:
   - `"G:\\FinSightV9"` → `"${workspaceFolder}"`
   - `"ark-f45dd4ca-..."` → `"${ARK_API_KEY}"`

2. **配置 API Key**:
   - 在 `.env.local` 中设置 `ARK_API_KEY=ark-...`

3. **Python venv 依赖**:
   - `~/.workbuddy/binaries/python/` 仍为 `build:stock-dict` 的依赖
   - 如卸载 WorkBuddy 桌面应用，需迁移至项目级 `.venv/` 或系统 Python

### 4.2 文档引用迁移

所有 `.workbuddy/skills/` 路径已迁移至 `.trae/skills/`，开发者无需手动更新。

### 4.3 脚本迁移

- `migrate-doc-categories.ts` 日志路径已从 `deprecated-docs/temporary/` 改为 `00-meta/`
- 已删除的一次性脚本（`fix-cross-references.ts`、`rename-ah-index-files.ts`）功能已内联至审计流程

---

## 5. 潜在风险评估

| 风险项 | 级别 | 概率 | 影响 | 缓解措施 |
|--------|------|------|------|----------|
| `.trae/mcp.json` 未手动更新 API Key | P0 | 中 | doubao MCP 服务不可用 | 文档记录手动操作步骤 |
| 卸载 WorkBuddy 后 Python venv 断裂 | P1 | 低 | `build:stock-dict` 失败 | 后续迁移至项目级 venv |
| 历史文档中 `huawei` 用户路径（49 处） | P1 | 低 | env:check 预存技术债 | 独立治理任务 |
| `llmClient.multimodel.test.ts` 测试失败 | P2 | 已确认 | 2 个测试不通过 | 预存问题，模型名不匹配 |
| ESLint 1953 warnings | P3 | 已确认 | 代码质量提示 | 独立技术债治理 |

---

## 6. 回滚方案

如需回滚本次变更：

1. **文件恢复**: `git checkout <commit-before-cleanup> -- <path>` 恢复已删除文件
2. **配置恢复**: 从 `.trae/mcp.json.example` 了解原始格式，手动恢复 API Key
3. **引用回退**: `git revert` 相关提交

> **注意**: 回滚后 `.workbuddy/` 目录将恢复，但 SKILL 注册表仍以 `.trae/skills/skill-registry.json` 为单一真相源。
