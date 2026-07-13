---
# Kimi 加载提示：本项目为 V9 智能投研复盘系统，按 AGENTS.md v1.4.3 分层架构运行
# 快速入口：docs/GOVERNANCE.md | docs/architecture/overview.md | docs/00-meta/文档体系体检报告-v9.md
# 加载策略：先读取本文件获取文档地图，再按需深入对应子类；不要逐个扫描 docs/ 全部文件
title: V9 智能投研复盘系统 — 文档中心（主控索引）
code_version: 2.0.0
kimi_index: true
---

# V9 智能投研复盘系统 — 文档中心（主控索引）

> **用途**：本文件是 `docs/` 的唯一顶层入口。任何新成员或 AI Agent 应从这里 1 步定位核心文档。
> **维护规则**：新增/移动文档后必须同步更新本索引（见 `GOVERNANCE.md` 保鲜规则）。
> **AI 加载提示（Kimi / 通用 LLM）**："请先读取 `docs/README.md` 获取文档地图，再按需深入对应子类；不要逐个扫描 `docs/` 全部 1794 个文件。"

---

## 一、文档归类体系（A–H 八类）

基于《文档归类体系结构.md》，所有文档归入以下八类。每类下给出**现有锚点**与**缺口标记（🔴 缺 / 🟡 弱 / ✅ 就绪）**。

| 类 | 名称 | 职责 | 现有锚点 | 状态 |
|----|------|------|----------|------|
| **A** | 导航与治理 | 索引、宪法、归类、体检、需求规格、插件集成 | `README.md`(本文件)、`00-meta/GOVERNANCE.md`、`00-meta/文档归类体系结构.md`、`00-meta/V9-文档治理修复行动计划.md`、`00-meta/文档体系体检报告-v9.md`、`00-meta/REGISTRY_INDEX.md`、`01-requirements/01-vision-and-goals.md`、`01-requirements/V9数据宪法.md`、`03-development/plugins/index.md` | ✅ |
| **B** | 架构设计 | 全局架构、舱室、服务、引擎、数据层、安全模型、版本发布 | `02-design/architecture/overview.md`(P0✅)、`02-design/architecture/cabins-overview.md`(P0✅)、`02-design/architecture/services-catalog.md`(P0✅)、`02-design/architecture/security-model.md`(P1✅)、`02-design/architecture/deployment.md`(P1✅)、`02-design/architecture/adr/`、`05-deployment/RELEASE_NOTES.md` | ✅ |
| **C** | 功能模块 | 各舱 spec、组件体系、Widget、Store、服务契约、数据层、数据字典 | `02-design/input-cabin-spec.md`、`02-design/analysis-cabin-spec.md`(P0✅)、`02-design/trading-cabin-spec.md`(P0✅)、`02-design/output-cabin-spec.md`(P0✅)、`02-design/command-cabin-spec.md`(P0✅)、`02-design/atomic-component-system.md`、`02-design/widget-development-guide.md`、`02-design/API_CONTRACT.md`、`02-design/standards/DATA_DICTIONARY_INDEX.md` | ✅ |
| **D** | 技术规范 | 分层、门禁、令牌、复杂度、API 契约、开发工作流、迁移规范 | `AGENTS.md`(根)、`02-design/standards/coding-conventions.md`(P0✅)、`03-development/complexity-governance.md`、`03-development/jsdoc-convention.md`、`03-development/development-workflow-sop.md`、`02-design/design-tokens.md`、`02-design/design-token-mapping.md`、`03-development/v6-to-v9-migration-spec.md` | ✅ |
| **E** | 测试策略 | 单元/e2e/覆盖率、测试用例、门禁 | `04-testing/testing-strategy.md`(P1✅)、`04-testing/test-catalog.md`、`04-testing/production-release-checklist-SKILL.md` | ✅ |
| **F** | AI 辅助工程治理 | 提示词模板、记忆层、飞轮、AI 工程入口、检查表 | `03-development/ai/README.md`(P1✅)、`03-development/ai/store-integration-guide.md`、`03-development/ai/service-integration-guide.md`、`02-design/ai-memory-layer.md`、`02-design/ai-generate-audit-fix-loop.md`、`03-development/ui-migration-checklist.md`、`02-design/widget-integration-checklist.md` | ✅ |
| **G** | 过程与质量产物 | 报告、审计、changelog、草稿、发布管理 | `docs/reports/audit/`（自动产物）、`docs/reports/changelogs/`、`CHANGELOG.md`(根)、`00-meta/CLEANUP_SCHEDULE.md`(P1✅)、`02-design/v9-post-dev-review.md`、`02-design/发布计划与评审_R01.md` | ✅ |
| **H** | 跨域补充 | 入门、How-to、安全、部署、i18n | `03-development/guides/getting-started.md`(P1✅)、`03-development/guides/how-to-add-widget.md`(P1✅)、`03-development/guides/how-to-add-store.md`(P1✅)、`03-development/guides/how-to-add-service.md`(P1✅)、`03-development/guides/mcp-acl-guide.md`、`05-deployment/ops/runbook.md`(P2✅)、`02-design/a11y-i18n.md`(P2) | ✅ |

---

## 二、按使用场景的快速入口

| 场景 | 推荐文档路径 |
|------|-------------|
| **新成员 30 分钟上手** | `H/getting-started.md` → `B/architecture/overview.md` → `C/*-cabin-spec.md` |
| **新增 Widget** | `F/widget-integration-checklist.md` + `H/how-to-add-widget.md` + `02-design/atomic-component-system.md` |
| **新增 Store / Service / Page** | `F/*-prompt-template.md` + `H/how-to-add-*.md` + `AGENTS.md` §二 四步集成 |
| **了解全局架构** | `B/architecture/overview.md` → `B/architecture/cabins-overview.md` → `B/architecture/services-catalog.md` |
| **代码评审 / 合规检查** | `D/AGENTS.md` + `D/03-development/development-workflow-sop.md` + `D/eslint.colors.config.js` + `npm run audit:layers` |
| **了解开发工作流** | `D/03-development/development-workflow-sop.md` → `D/AGENTS.md` → `F/*-prompt-template.md` |
| **拆解复杂任务 / 回归套件** | `D/03-development/templates/task-graph-template.md` + `D/03-development/templates/regression-suite.md` |
| **查安全架构** | `B/architecture/security-model.md` → `H/guides/mcp-acl-guide.md` → `D/AGENTS.md` §三/六/八 |
| **查部署基线** | `B/architecture/deployment.md` → `B/ops/runbook.md` → `.github/workflows/quality-check.yml` |
| **查 AI 工程治理** | `F/ai/README.md` → `F/prompts/README.md` → `F/ai/service-integration-guide.md` |
| **查数据层架构** | `B/modules/data-layer-overview.md` → `standards/DATA_DICTIONARY_INDEX.md` |
| **查数据字段定义** | `standards/DATA_DICTIONARY_INDEX.md` → `02-design/API_CONTRACT.md` |
| **查 API 契约** | `02-design/API_CONTRACT.md` → `B/modules/data-layer-overview.md` |
| **质量门禁结果** | `G/reports/` + 根 `audit-*-result.txt` |
| **AI Agent 快速加载** | `docs/.ai-index/`（code-graph + ai-memory-index） |

---

## 三、目录健康与治理状态（实时锚点）

- **文档治理层评分**：85/100 → 目标 90+（见 `00-meta/V9-文档治理修复行动计划.md`）
- **双向一致性评分**：85/100 → 目标 90+（同上）
- **当前迭代**：**P1 已完成**（A–H 八类全部 ✅）
- **P2 已完成**：
  - ✅ 自动化索引生成（`docs/.ai-index/`：code-graph 708 文件 / 138K 行 + ai-memory-index 288KB）
  - ✅ 视觉回归基线冻结（6 → 20 场景，20/20 全量回归通过，基线 1.6MB）
  - ✅ 根级 `audit-*-result.txt` 迁移（已确认根级无残留，`docs/reports/audit/` 已创建）
- **归档目录**：`07-archive/`（DEPRECATED 文档统一归此）
- **自动产物**：`reports/`（由 `CLEANUP_SCHEDULE.md` 管理保留期，CI 生成）
- **本次新增 / 更新文档清单（全量）**：
  - `architecture/security-model.md` — 安全模型总览（L1-L7 纵深防御）
  - `architecture/deployment.md` — 部署基线（纯前端 SPA + CI/CD）
  - `ai/README.md` — AI 工程治理入口（LLM 调用栈 / Agent 系统 / 提示词工程）
  - `04-testing/testing-strategy.md` — 三层测试策略 v2.0.0（金字塔 / 契约 / 覆盖率）
  - `GOVERNANCE.md` — 文档治理宪法（A–H 归类 / 版本规范 / 归档规则）
  - `CLEANUP_SCHEDULE.md` — 自动产物清理周期表（保留矩阵 / 清理脚本）
  - `02-design/API_CONTRACT.md` — 交易持仓 API 契约（v1.4.0 已检索更新）
  - `docs/README.md` — 主控索引更新（A–H 全部 ✅，14 条快速入口）
- `docs/03-development/development-workflow-sop.md` — V9 开发工作流 SOP（编码前/中/后/上线后全周期）
- `docs/03-development/jsdoc-convention.md` — JSDoc 编写规范
- `docs/03-development/complexity-governance.md` — 代码复杂度治理规范
- `docs/03-development/templates/task-graph-template.md` — 任务图模板
- `docs/03-development/templates/regression-suite.md` — 回归测试套件模板
- `docs/00-meta/DIRECTORY_STRUCTURE_GUIDE.md` — 项目目录结构规范与使用指南（对齐 AGENTS.md v1.4.6）
- `docs/00-meta/DIRECTORY_AUDIT_FEASIBILITY_PLAN.md` — 目录结构审计可行性复核方案
- `docs/00-meta/DIRECTORY_AUDIT_TODO.md` — 目录结构审计整改 TODO
- `docs/00-meta/DIRECTORY_STRUCTURE_AUDIT_REPORT.md` — 目录结构文档审计报告（已归档）
- `docs/00-meta/V9-PRE-LAUNCH-AUDIT-REPORT-20260713.md` — V9 上线前系统性梳理报告
- `docs/00-meta/CHANGELOG_WARNINGS_HANDLING_STRATEGY.md` — CHANGELOG 警告项处理策略
- `docs/01-requirements/v9-code-quality-audit-report-20260713.md` — V9 代码质量量化审计报告
- `archive/ARCHIVE_INDEX.md` — 归档目录索引

---

## 四、贡献约定（摘要，详见 GOVERNANCE.md）

1. 所有新增文档必须落入 A–H 对应子类目录，**禁止散落 `docs/` 根**。
2. 文件名 `kebab-case`，英文/数字优先；数据定义统一 `*-data-definition.md`（见 `DATA_DICTIONARY_INDEX.md`）。
3. 新增文档后**必须**回链本 README 对应类目。
4. 破坏性移动/删除需先列清单确认，并 `git status` 核对。

---

---

## 五、二级子类速查表（P2-3）

> 基于《文档体系体检报告》§3.1，A–H 八类扩展为以下二级子类，用于更精确归类孤儿文档。
> 新增文档时，先落入一级类，再按内容归入对应二级子类。

| 二级子类 | 归属一级类 | 说明 | 代表文档 |
|----------|-----------|------|----------|
| **A2 需求规格** | A | 愿景、功能规格、目标 | `01-requirements/01-vision-and-goals.md`、`02-functional-specs.md` |
| **A3 插件集成** | A | 插件/扩展文档 | `plugins/*.md`（10 份 + index） |
| **B5 版本发布** | B | 版本说明、发布计划、PR 描述 | `05-deployment/RELEASE_NOTES.md`、`05-deployment/PR_DESCRIPTION.md`、`发布计划与评审_R01.md` |
| **C7 数据字典** | C | 数据定义、字段契约、ER 图 | `standards/DATA_DICTIONARY_INDEX.md` + 7 份 `*-data-definition.md` |
| **D5 迁移规范** | D | 版本迁移、Schema 升级、架构对齐 | `v6-to-v9-migration-spec.md`、`db-migration-v4-to-v6.md` |
| **G4 草稿/临时** | G | 过程草稿、临时产物 | `drafts/*.md`（8 份 + .log） |
| **G5 发布管理** | G | 发布计划、回滚方案、过程排期 | `02-design/发布计划与评审_R01.md`、`回滚方案与演练_R03.md`、`plans/` |

> **命名规范**：二级子类文档命名建议加子类前缀，如 `a2-vision-and-goals.md`、`c7-data-dictionary-index.md`（可选，不强制）。

---

_本索引由文档治理整改（P0）创建，P1 已补全（A–H 八类 ✅），P2-3 已扩展二级子类，随 P3 迭代持续优化。_
