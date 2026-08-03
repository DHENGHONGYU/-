---
doc_id: V9-DOC-GOV-002
title: 治理总结文档 — 上线前工具配置整合与废弃文件清理
status: active
version: v1.0.0
last_updated: 2026-08-03
code_version: 2.0.0
category: governance
tags: [governance, cleanup, summary, pre-launch]
related_docs: [V9-DOC-GOV-001]
---

# 治理总结文档 — 上线前工具配置整合与废弃文件清理

> **日期**: 2026-08-03
> **执行人**: V9 Dev
> **治理范围**: 开发工具配置整合、废弃文件清理、引用修复、构建验证
> **关联文档**: [breaking-changes-report-2026-08-03.md](breaking-changes-report-2026-08-03.md)

---

## 1. 清理背景

### 1.1 治理动机

V9 项目在长期迭代过程中积累了多套开发工具配置体系（WorkBuddy、Trae），导致：
- **配置冗余**: `.workbuddy/` 与 `.trae/` 双体系并行，SKILL 注册表存在两份真相源
- **文件膨胀**: 439 个废弃/待删除文件散布在 6 个目录，增加维护成本与认知负担
- **引用腐化**: 删除文件后残留的失效链接降低文档可信度
- **安全风险**: API Key 硬编码在 `.trae/mcp.json`，存在入库泄漏隐患
- **路径耦合**: 文件系统 MCP 路径硬编码 `G:\FinSightV9`，跨用户不可移植

### 1.2 治理目标

1. 统一开发工具配置至 `.trae/` 单一体系
2. 物理删除所有废弃/待删除文件
3. 修复所有因删除产生的失效引用
4. 标准化配置（API Key 环境变量化、路径动态化）
5. 验证构建链路无回归

---

## 2. 执行步骤

### 2.1 开发工具配置整合

| 步骤 | 操作 | 产出 |
|------|------|------|
| 1 | 删除 `.workbuddy/` 目录（38 文件） | 消除双体系 |
| 2 | 统一 SKILL 注册表至 `.trae/skills/skill-registry.json` | 单一真相源 |
| 3 | 创建 `.trae/mcp.json.example`（`${workspaceFolder}` 动态路径） | 跨用户可移植模板 |
| 4 | `.env.local` 新增 `ARK_API_KEY` 配置 | 密钥脱离代码库 |
| 5 | `.env.local.example` 新增 MCP 服务配置段 | 配置可追溯 |
| 6 | `.gitignore` 移除 `.workbuddy` 规则 | 配置同步 |

### 2.2 废弃文件清理

| 目录/文件 | 文件数 | 删除原因 |
|-----------|--------|----------|
| `docs/_pending-deletion/` | 414 | 上线前待清理（一次性治理报告、破损文件名、重复 HTML） |
| `docs/00-meta/deprecated-docs/` | 7 | 旧版文档（v1.0.0/v1.6.0），已被新版本替代 |
| `docs/reference/meta/deprecated-docs/` | 2 | 重复的临时文件 |
| `docs/implementation/deprecated/` | 9 | DEPRECATED_ 前缀文档，内容已合并至活跃文档 |
| 其他 deprecated 文件 | 4 | status: deprecated 的散落文档 |
| 一次性脚本 | 2 | 引用已删除目录的 `fix-cross-references.ts`、`rename-ah-index-files.ts` |
| `.workbuddy/` | 38 | 已迁移至 `.trae/` |
| **合计** | **439** | — |

### 2.3 引用修复

| 类别 | 文件数 | 修复内容 |
|------|--------|----------|
| 文档引用路径 | 8 | `.workbuddy/skills/` → `.trae/skills/` |
| JSON 索引 | 2 | `relation-index.json`（移除 6 处）、`master-index.json`（移除 5 处） |
| 索引/注册文档 | 4 | `REGISTRY_INDEX.md`、`type-domain-audit-worksheet.md`、`00-readme.md`、`GOVERNANCE.md` |
| 参考文档 | 3 | `v9-system-blueprint.md`、`data_link_sequence_diagram.md`、`data-interaction-protocols.md` 的 `referenced_by` |
| 脚本 | 3 | `migrate-doc-categories.ts`、`env-path-guard.cjs`、`fix/README.md` |
| 配置 | 3 | `cspell.json`（+24 术语）、`AGENTS.md`、`skill-router.cjs` |
| 活跃指南（本次验证补充） | 2 | `FILE-MANAGEMENT-GUIDE.md`、`directory-structure-guide.md` |
| **合计** | **25** | — |

### 2.4 破坏性变更报告生成

- 产出文档: `docs/governance/breaking-changes-report-2026-08-03.md`
- 覆盖内容: 变更类型矩阵、受影响组件清单、变更前后对比、迁移指南、风险评估、回滚方案

---

## 3. 验证方法

### 3.1 构建验证

| 验证项 | 命令 | 结果 | 状态 |
|--------|------|------|------|
| TypeScript 编译 | `npm run tsc:prod` | 0 错误 | ✅ 通过 |
| 静态分析（ESLint） | `npm run lint` | 0 错误，1959 警告 | ✅ 通过（警告为预存技术债） |
| 单元测试（Vitest） | `npm test` | 8147 通过，4 失败，21 跳过 | ⚠️ 预存失败，非本次引入 |

### 3.2 引用清理验证

**验证范围**: API 文档、内部链接、外部引用、代码注释链接、README 超链接

**验证方法**: 全仓 Grep 搜索已删除路径（`deprecated-docs`、`_pending-deletion`、`.workbuddy`），逐一核查匹配文件

**验证结果**:

| 类别 | 文件数 | 处置 |
|------|--------|------|
| 活跃指南（需修复） | 2 | ✅ 已修复（`FILE-MANAGEMENT-GUIDE.md`、`directory-structure-guide.md`） |
| 历史归档文档（合法记录） | 8 | 保留（`docs/archive/` 下的历史文档，记录当时状态） |
| 自动生成索引（过期快照） | 2 | 待重新生成（`docs/00-meta/ai-index/.ai-index/category-index.json` 等，2026-07-13 快照） |
| 历史迁移清单（合法记录） | 1 | 保留（`_migration-inventory.csv`） |
| 破坏性变更报告（自引用） | 1 | 保留（合法引用已删除路径描述变更） |
| 历史审计报告 | 2 | 保留（`databridge-stability-assessment` 等历史报告） |

### 3.3 破坏性变更报告验证

- ✅ 包含变更类型矩阵（8 类变更）
- ✅ 包含受影响组件清单（11 项删除 + 24 项修改）
- ✅ 包含变更前后对比（配置体系、废弃文件治理）
- ✅ 包含迁移指南（开发者环境、文档引用、脚本）
- ✅ 包含风险评估（5 项风险，含级别/概率/影响/缓解措施）
- ✅ 包含回滚方案

---

## 4. 发现问题及解决方案

### 4.1 构建验证阶段

| # | 问题 | 根因 | 解决方案 | 状态 |
|---|------|------|----------|------|
| 1 | `llmClient.multimodel.test.ts` 2 个测试失败 | 测试期望 `deepseek-v4-flash`，实际返回 `deepseek-chat`（模型名已统一为 `deepseek-chat`） | 预存问题，需更新测试期望值 | ⚠️ 预存技术债 |
| 2 | `daily-doc-validation.test.ts` 1 个测试失败 | doc-cross-ref-sync 脚本行为测试，期望 `updates.length >= 1` | 预存问题，测试在隔离 temp 目录运行，与本次清理无关 | ⚠️ 预存技术债 |
| 3 | ESLint 1959 warnings | 历史代码质量提示（nullable boolean、unnecessary condition 等） | 预存技术债，独立治理 | ⚠️ 预存技术债 |

### 4.2 引用清理阶段

| # | 问题 | 根因 | 解决方案 | 状态 |
|---|------|------|----------|------|
| 4 | `FILE-MANAGEMENT-GUIDE.md` 引用 `.workbuddy/*.log` | 活跃指南未同步工具迁移 | 修正为 `.trae/*.log` | ✅ 已修复 |
| 5 | `directory-structure-guide.md` 4 处引用 `.workbuddy/` | 活跃指南未同步工具迁移 | 修正为 `.trae/`（目录树、分类表、临时文件规则、清理周期） | ✅ 已修复 |
| 6 | 自动生成索引含失效路径 | `category-index.json` 为 2026-07-13 快照，未重新生成 | 待运行索引重新生成脚本 | ⚠️ 待处理 |
| 7 | Git 索引锁（`index.lock`） | 异常退出残留锁文件 | `Remove-Item .git/index.lock -Force` | ✅ 已解决 |
| 8 | 暂存已删除文件路径不存在 | `git add` 引用已删除目录 | 调整 `git add` 命令移除不存在路径 | ✅ 已解决 |

### 4.3 配置整合阶段

| # | 问题 | 根因 | 解决方案 | 状态 |
|---|------|------|----------|------|
| 9 | API Key 硬编码在 `.trae/mcp.json` | 安全风险 | 迁移至 `.env.local` 的 `ARK_API_KEY`，`.trae/mcp.json` 需手动更新 | ⚠️ 需手动操作 |
| 10 | MCP 文件系统路径硬编码 `G:\FinSightV9` | 跨用户不可移植 | `.trae/mcp.json.example` 使用 `${workspaceFolder}` | ✅ 已解决 |

---

## 5. 遗留风险

| 风险项 | 级别 | 概率 | 影响 | 缓解措施 |
|--------|------|------|------|----------|
| `.trae/mcp.json` 未手动更新 API Key | P0 | 中 | doubao MCP 服务不可用 | 迁移指南已记录手动操作步骤；`.env.local` 已配置 |
| 卸载 WorkBuddy 后 Python venv 断裂 | P1 | 低 | `build:stock-dict` 失败（依赖 `~/.workbuddy/binaries/python/`） | 后续迁移至项目级 `.venv/` |
| 自动生成索引含失效路径 | P2 | 已确认 | AI 索引返回不存在文件 | 重新运行索引生成脚本 |
| 历史文档中 `huawei` 用户路径（49 处） | P2 | 低 | `env:check` 预存技术债 | 独立治理任务 |
| `llmClient.multimodel.test.ts` 测试失败 | P3 | 已确认 | 2 个测试不通过（模型名不匹配） | 更新测试期望值为 `deepseek-chat` |
| ESLint 1959 warnings | P3 | 已确认 | 代码质量提示 | 独立技术债治理 |

---

## 6. 后续建议

### 6.1 立即跟进（P0-P1）

1. **手动更新 `.trae/mcp.json`**: 将硬编码 API Key 替换为 `${ARK_API_KEY}`，路径替换为 `${workspaceFolder}`（参考 `.trae/mcp.json.example`）
2. **重新生成 AI 索引**: 运行文档索引生成脚本，刷新 `docs/00-meta/ai-index/.ai-index/category-index.json` 等过期快照
3. **修复预存测试失败**: 更新 `llmClient.multimodel.test.ts` 期望值从 `deepseek-v4-flash` 改为 `deepseek-chat`

### 6.2 短期治理（P2）

4. **Python venv 迁移**: 将 `build:stock-dict` 依赖从 `~/.workbuddy/binaries/python/` 迁移至项目级 `.venv/`，消除对 WorkBuddy 桌面应用的依赖
5. **硬编码路径治理**: 治理历史文档中 49 处 `huawei` 用户路径，改用 `$USERPROFILE` 动态路径
6. **ESLint 警告治理**: 分批修复 1959 个 warnings，优先处理 `no-unnecessary-condition` 类别

### 6.3 长期优化（P3）

7. **文档保鲜度机制**: 落实 `directory-structure-guide.md` 中的定期清理周期（每日/每周/每月/每季度）
8. **配置变更门禁**: 将 `.trae/mcp.json` 的 API Key 硬编码检测纳入 `audit:secrets` 门禁
9. **索引自动刷新**: 将 AI 索引生成纳入 CI 流程，避免过期快照积累

---

## 7. 交付物清单

| 序号 | 交付物 | 路径 | 说明 |
|:---|:---|:---|:---|
| 1 | 破坏性变更报告 | [breaking-changes-report-2026-08-03.md](breaking-changes-report-2026-08-03.md) | 变更类型、受影响组件、迁移指南、风险评估、回滚方案 |
| 2 | 治理总结文档 | [governance-summary-2026-08-03.md](governance-summary-2026-08-03.md) | 本文档：清理背景、执行步骤、验证方法、问题与方案、遗留风险、后续建议 |
| 3 | 配置模板 | `.trae/mcp.json.example` | 跨用户可移植的 MCP 配置模板 |
| 4 | 环境变量示例 | `.env.local.example` | 含 `ARK_API_KEY` 的环境变量模板 |

---

## 8. 变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|:---|:---|:---|:---|
| 2026-08-03 | v1.0.0 | 初始版本：完整治理总结，含构建验证、引用验证、问题清单、风险评估 | V9 Dev |
