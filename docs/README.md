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
| **A** | 导航与治理 | 索引、宪法、归类、体检 | `README.md`(本文件)、`GOVERNANCE.md`、`00-meta/文档归类体系结构.md`、`00-meta/trae-file-management-review.md`、`00-meta/prompt-execute-remediation.md`、`00-meta/V9-文档治理修复行动计划.md`、`00-meta/V9-项目健康状态总览.md`、`00-meta/文档体系体检报告-v9.md`、`00-meta/文档理解核查报告.md`、`00-meta/文档管理系统评分报告.md`、`00-meta/REGISTRY_INDEX.md`、`00-meta/执行校验报告.md` | ✅ |
| **B** | 架构设计 | 全局架构、舱室、服务、引擎、数据层、安全模型 | `architecture/overview.md`(P0✅)、`architecture/cabins-overview.md`(P0✅)、`architecture/services-catalog.md`(P0✅)、`architecture/security-model.md`(P1✅)、`architecture/deployment.md`(P1✅)、`modules/data-layer-overview.md`(P1✅)、`02-design/05-engine-specs.md`、`02-design/06-routing-specs.md`、`02-design/00-README.md` | ✅ |
| **C** | 功能模块 | 各舱 spec、Widget、页面 | `01-requirements/input-cabin-spec.md`、`02-design/analysis-cabin-spec.md`(P0✅)、`trading-cabin-spec.md`(P0✅)、`output-cabin-spec.md`(P0✅)、`command-cabin-spec.md`(P0✅)、`02-design/atomic-component-system.md` | ✅ |
| **D** | 技术规范 | 分层、门禁、令牌、复杂度、API 契约、开发工作流 | `AGENTS.md`(根)、`eslint.colors.config.js`、`03-development/complexity-governance.md`、`03-development/jsdoc-convention.md`、`03-development/development-workflow-sop.md`、`02-design/design-token-mapping.md`、`02-design/API_CONTRACT.md`(P0✅) | ✅ |
| **E** | 测试策略 | 单元/e2e/覆盖率 | `04-testing/testing-strategy.md`(P1✅)、`testing/test-catalog.md` | ✅ |
| **F** | AI 辅助工程治理 | 提示词模板、记忆层、飞轮、AI 工程入口 | `prompts/README.md`、`ai/README.md`(P1✅)、`ai/store-integration-guide.md`、`ai/service-integration-guide.md`、`docs/ai-memory-layer.md`、`docs/ai-generate-audit-fix-loop.md`、`ui-migration-checklist.md`、`widget-integration-checklist.md` | ✅ |
| **G** | 过程与质量产物 | 报告、审计、changelog、草稿 | `reports/`（自动产物，已隔离规划）、`CHANGELOG.md`(根)、`GOVERNANCE.md`(P1✅)、`CLEANUP_SCHEDULE.md`(P1✅) | ✅ |
| **H** | 跨域补充 | 入门、How-to、安全、部署、i18n | `guides/getting-started.md`(P1✅)、`guides/how-to-add-widget.md`(P1✅)、`guides/how-to-add-store.md`(P1✅)、`guides/how-to-add-service.md`(P1✅)、`guides/mcp-acl-guide.md`、`architecture/security-model.md`(P1✅)、`architecture/deployment.md`(P1✅)、`design/song-aesthetics.md`(P2)、`design/a11y-i18n.md`(P2)、`ops/runbook.md`(P2✅)、`standards/coding-conventions.md`(P0✅) | ✅ |

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
