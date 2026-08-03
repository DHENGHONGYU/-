---
title: 触发事件 → 更新动作 一一映射权威表
type: meta
domain: project
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "文档日期：2026-07-14（pr-6 Diátaxis 重组后路径同步修订） 维护者：架构治理（里程碑 M1 / T1 产出；N2/N3 收尾；2026-07-14 pr-6 重组后路径重对齐）..."
tags: [meta, documentation, automation, workflow, project]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-325
referenced_by: [V9-DOC-PROJ-032, V9-DOC-META-000, V9-DOC-PROJ-175]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 触发事件 → 更新动作 一一映射权威表

> 文档日期：2026-07-14（pr-6 Diátaxis 重组后路径同步修订）
> 维护者：架构治理（里程碑 M1 / T1 产出；N2/N3 收尾；2026-07-14 pr-6 重组后路径重对齐）
> 关联文档：`./文档自动更新体系-架构梳理与任务清单.md` §三 约束1、`scripts/docs-tool/doc-update-trigger.ts` 的 `TRIGGER_RULES`

---

## 一、目的与范围

本文件是改进计划 **§三 约束 1「触发条件与更新动作需一一映射」** 的**单一事实源（single source of truth）**。

**核心约束：**

1. **1:1 映射**：每个触发事件**精确对应唯一主更新动作**（一个最具体的主文档）。其余相关文档列为「补充文档」并在备注中说明，更新器不得越界写其它文件。
2. **禁止无差别全仓库扫描**：更新器（`doc-update-trigger --auto-update` 以及 `doc-auto-updater`）**严禁**「扫描全仓库并批量改写」式误写；写入路径必须严格落在本表指定范围，未列于本表的文档**不得被自动改写**。
3. **与代码同步**：本表的 **T1–T14** 必须与 `scripts/docs-tool/doc-update-trigger.ts` 的 `TRIGGER_RULES` 保持同步。代码改动 `TRIGGER_RULES` 时，本表须同步修订（反之亦然）。
4. **M2 落地点**：`doc-update-trigger --auto-update`（**已落地，见 N3**）以本表为唯一依据，将每个命中模式映射到对应主文档 + 补充文档，并在写后跑 `audit:docs`（除非本表标注「否」）。当前内容生成为**扩展点**（`DocGenerator` 注册表），内置默认生成器（缺失建骨架 / 存在刷新校验标记）与 T10 版本校验生成器；后续可注入按触发类型生成正文的生成器。

> 本文件为纯规范文档，不改动任何源码或 CI。

---

## 二、权威映射矩阵

列说明：

- **主更新动作（唯一）**：该触发事件对应的**唯一最具体文档**，更新器优先改写它。
- **是否触发 audit:docs**：写完后是否运行 `npm run audit:docs` 做引用同步校验。
- **补充文档**：与主动作并列、需同步维护的其它文档（非越界，仍属本触发事件的明示范围）。

> **路径基准（2026-07-14 pr-6 重组后重对齐）**：pr-6 提交（4e736e9）将 docs 从旧编号目录（`01-requirements/`、`02-design/`、`03-development/`、`04-testing/`、`05-deployment/`）整体迁移到 Diátaxis 新结构（`explanation/`、`reference/`、`how-to/`、`tutorials/`、`reports/`、`00-meta/`）。本次修订将下表所有目标文档路径重新对齐到新结构的真实权威位置，消除 pr-6 重组导致的路径脱节。规范/契约/数据字典类归 `reference/`，设计决策/ADR 归 `explanation/`，实操指南归 `how-to/`，治理核心归 `00-meta/`。

| 触发事件 | 匹配模式 (glob) | 对应更新动作（唯一主文档） | 是否触发 audit:docs | 备注 |
|---|---|---|---|---|
| **T1 类型定义变更** | `src/data/types.ts`、`src/types/modules/*.ts`、`src/services/scoring/v6-engine/types.ts`、`../../src/showcase/types.ts` | 更新 `docs/reference/data-dictionary-index.md` | 是 | 补充：`docs/reference/v9核心数据字典与类型定义(整合版).md`、`docs/reference/cockpit/data-definition.md`、`docs/explanation/news-data-definition.md`、团队手册 `docs/guides/team-handbook/04-model-runtime.md`。仅改命中文件对应的条目，禁止全量重写。 |
| **T2 接口变更** | `src/services/**/index.ts`、`src/core/databridge.ts`、`src/data/dataLayer.ts`、`src/services/fetcher`、`src/services/analysis` | 更新 `docs/reference/api-contract.md` | 是 | 补充：`docs/reference/databridge端点与数据映射清单.md`、`docs/reference/功能模块数据契约.md`、团队手册 `docs/guides/team-handbook/02-architecture.md` 与 `docs/guides/team-handbook/04-model-runtime.md`。按变更接口精确改写签名/端点段。 |
| **T3 架构调整** | `src/config/routes.ts`、`src/config/dbConfig.ts`、`../../AGENTS.md`、`src/config/thresholds.ts` | 更新 `docs/reference/03-architecture-standards.md` | 是 | 补充：`docs/reference/06-routing-specs.md`、`docs/explanation/architecture.md`、团队手册 `docs/guides/team-handbook/02-architecture.md`。注意 `src/config/thresholds.ts` 同属 T4，命中时 T3/T4 均触发，各自只改本职文档。 |
| **T4 配置参数变更** | `src/constants/*.ts`、`src/config/thresholds.ts`、`src/services/scoring/v6-engine/config.ts` | 更新 `docs/reference/05-engine-specs.md` | 是 | 补充：`docs/reference/09-quality-gates.md`、团队手册 `docs/guides/team-handbook/04-model-runtime.md`。 |
| **T5 Store 状态管理变更** | `src/store/**/*.ts` | 更新 `docs/explanation/state-management.md` | 是 | 补充：`docs/reference/data-flow-spec.md`、团队手册 `docs/guides/team-handbook/02-architecture.md`。 |
| **T6 UI 组件变更** | `src/components/**/*.tsx`、`src/components/**/*.ts` | 更新 `docs/explanation/design/component-library-guide.md` | 是 | 补充：`docs/explanation/design/component-specs.md`（基础组件规范唯一事实源）、`docs/explanation/design/ui-design-system.md`、团队手册 `docs/guides/team-handbook/03-ui-components.md`。 |
| **T7 Hook 自定义变更** | `src/hooks/**/*.ts`、`src/hooks/**/*.tsx` | 更新 `docs/guides/how-to/hooks-guide.md` | 是 | 补充：`docs/reference/data-flow-spec.md`、团队手册 `docs/guides/team-handbook/03-ui-components.md`。 |
| **T8 页面组件变更** | `src/pages/**/*.tsx`、`src/pages/**/*.ts` | 更新 `docs/reference/06-routing-specs.md` | 是 | 补充：`docs/explanation/page-structure.md`、团队手册 `docs/guides/team-handbook/02-architecture.md`。 |
| **T9 Widget 注册表变更** | `src/cockpit/core/widgetRegistry.ts` | 重写 `docs/reference/cockpit/data-definition.md` | 是 | 补充：增量维护 `docs/meta/registry-index.md`（非全量重写，见任务 A1）、团队手册 `docs/guides/team-handbook/03-ui-components.md` + 跑 `audit:docs` 和 `audit:widget-registry`。变更 defaultLayout 时必须同步更新 `AGENTS.md` §7.2 布局原则。 |
| **T10 版本发布（package.json version bump）** | `package.json`（仅 `version` 字段变更） | 全仓 `docs/**/*.md` frontmatter `code_version` 同步 | 否（由 `doc:version-check` 覆盖） | 补充：将 `CHANGELOG` 的 `[Unreleased]` 段提升为对应版本段（对应计划 T4/T5/T6）。此事件为**跨仓库元数据同步**，不触达正文，故不跑 `audit:docs`；`--auto-update` 对 T10 对接 `npm run doc:version-check`。 |
| **T11 Mock 模块安全** | `scripts/audit/audit-mock-modules.ts`、`tests/**/*.test.ts`（新增全量 mock 时） | 更新本表（当前文件）+ `AGENTS.md` §7.3 | 否 | 新增 SAFE_FULL_MOCKS allowlist 条目必须附带 `reason` 注释。audit:mock-modules exit 0 即无新增违规。 |
| **T12 ESLint/门禁变更** | `eslint.config.js`、`eslint-rules/*.js`、`scripts/quality/*.js`、`package.json`（scripts 段） | 更新 `AGENTS.md` §三 类型安全 + §七 验证命令 | 否 | 新增规则需在 AGENTS.md 登记规则用途和背景教训编号（如 P3 → no-record-string-to-branded）。 |
| **T13 ACL 权限矩阵变更** | `src/config/dbConfig.ts`（ACL_MATRIX 段）、`src/core/databridgeHandlers.ts`（PutHandler 段）、`src/core/databridge.ts`（ACTION_TO_STORE_MAP 段） | 运行 `npm run audit:acl-consistency` + 更新本表 | 否 | 修改 ACL_MATRIX、ENVELOPE_ACTION、ACTION_TO_STORE_MAP 或 Handler 注册表后必须运行 audit:acl-consistency 验证配对一致性。违规必须修复后才可提交。
| **T14 股票字典生成/校验** | `scripts/generate-stock-dict.py`、`scripts/verify-stock-dict.py`、`src/services/stock/stockDictionary.ts` | 更新 `docs/reference/stock-dictionary-generation.md` | 是 | 补充：同步本表（doc-trigger-action-map.md）。数据源=akshare（受管 venv python），四交易所 8331 条（SH 2308 / SZ 2892 / BJ 328 / HK 2803），单一事实源；每周日 03:00 自动刷新（automation-1784399510483）。注：T13 已由「ACL 权限矩阵变更」占用（见 AGENTS.md §七），故本规则顺延为 T14。

> **关于 1:1 的说明**：上表每个触发事件只有一个「主文档」作为唯一主动作；「补充文档」是该触发事件**明示附带**的同步范围，仍属本事件，不属于越界。任何未出现在本表的文档都不在自动改写范围内。

> **团队手册接入（2026-07-15）**：团队体系手册 `docs/guides/team-handbook/`（01 设计原创 / 02 整体架构 / 03 UI 组件 / 04 模型运行 / 05 竞品对比）已注册为上述 T1–T9 的补充文档，按维度映射：02 整体架构 ← T2/T3/T5/T8；03 UI 组件 ← T6/T7/T9；04 模型运行 ← T1/T2/T4。触发对应规则时，`--auto-update` 会刷新手册 `.md` 末尾的 `<!-- auto-update -->` 校验标记并提示人工复核（手册为人工策展文档，生成器仅刷新标记，不重写正文）。手册的 HTML 版（`docs/assets/team-handbook-html/`）由 `node scripts/convert-handbook-to-html.mjs` 从 `.md` 派生，**`.md` 更新后须重跑该脚本重新生成 HTML**；HTML 不纳入自动改写范围，避免覆盖派生产物。

---

## 三、错误码分类学

更新器（`--auto-update`、`doc-auto-updater`）写文档时发出的结构化错误码，供后续告警适配器（T3）做分诊与重试决策。

| 错误码 | 含义 | 触发场景 | 是否可重试 |
|---|---|---|---|
| `FILE_NOT_FOUND` | 显式指定文件不存在 | `--files` 传入的路径在磁盘上不存在；或本表要求改写的主/补充文档缺失 | 否（立即失败，对应任务 A2） |
| `PATH_OUTSIDE_ROOT` | 路径越界 / 目录穿越被拒 | 写入或读取路径解析到仓库根目录之外（如 `../`、绝对路径逃逸） | 否（安全拒绝，立即失败） |
| `IO` | 读写异常 | 文件读写失败、权限不足、磁盘错误 | 是（指数退避，默认 maxRetries=3，对应任务 T2） |
| `TRANSIENT` | 可重试的瞬时错误 | 临时性锁定、并发竞争、网络/临时文件系统抖动 | 是（指数退避，默认 maxRetries=3，对应任务 T2） |

> 不可重试错误（`FILE_NOT_FOUND` / `PATH_OUTSIDE_ROOT`）应**立即**向 T3 告警适配器上报并终止；可重试错误仅对 `IO` / `TRANSIENT` 重试，且需受 lockfile（A6）约束，避免丢失更新。
> `--auto-update` 默认生成器对缺失文档会**创建骨架**而非硬失败（保障首跑可用），仅 `PATH_OUTSIDE_ROOT` 立即失败。

---

## 四、与计划任务对照

本权威表服务的计划任务与后续落地点：

| 计划项 | 关系 |
|---|---|
| **约束 1**（§三） | 本文件即约束 1 的落地载体，定义「触发-动作一一映射」。 |
| **T1**（里程碑 M1，P0） | 本文件即 T1 交付物。 |
| **A1**（限域 / 防越界） | 本表为 A1「crossref 限域 `changedScanned`、REGISTRY_INDEX 增量」提供范围边界依据。 |
| **T7b**（`doc-automation.yml`，M2 CI） | CI 在 push/PR 触发时引用本表判定应改写文档与是否跑 `audit:docs`。 |
| **N2**（P0，已闭环） | 本表 §二 所有目标文档路径已对齐磁盘真实文件（9 修订 + 4 新建），消除 `FILE_NOT_FOUND` 风险。 |
| **N3**（P0，已落地） | `doc-update-trigger --auto-update` 已按本表 §二 矩阵实现：触发规则匹配 → 主/补充文档生成（扩展点）→ 按需 `audit:docs`；T10 对接 `doc:version-check`。 |

> 同步要求：任何对 `scripts/docs-tool/doc-update-trigger.ts` `TRIGGER_RULES` 的增删改（含新增触发规则如 **T14 股票字典生成/校验**），或对 `widgetRegistry.ts` / `package.json` 触发语义的调整，均须**双向同步**本表 §二 与 `doc-update-trigger.ts`，确保二者始终一致、规则 id 不冲突。注意：本表 **T13（ACL 权限矩阵变更）** 为映射表定义的规则，当前 `doc-update-trigger.ts` 未实现对应运行时规则；后续若补实现须保持 id 一致，且新增规则须顺延编号避免与既有 T13 冲突。


<!-- merge-source: docs/reference/meta/doc-trigger-action-map.md (2026-07-14 内容融合，避免去重丢失有效信息) -->
## 补充内容（合并自 `docs/reference/meta/doc-trigger-action-map.md`）

> 文档日期：2026-07-12（N2/N3 修订）
> 维护者：架构治理（里程碑 M1 / T1 产出；N2/N3 收尾）
> 关联文档：`./文档自动更新体系-架构梳理与任务清单.md` §三 约束1、`scripts/docs-tool/doc-update-trigger.ts` 的 `TRIGGER_RULES`
3. **与代码同步**：本表的 **T1–T14** 必须与 `scripts/docs-tool/doc-update-trigger.ts` 的 `TRIGGER_RULES` 保持同步。代码改动 `TRIGGER_RULES` 时，本表须同步修订（反之亦然）。
> **路径基准（N2 修订后）**：下表所有目标文档路径均已对齐磁盘真实文件——9 个原指向 `docs/` 根的文档修订为真实路径（`docs/specs/requirements/`、`docs/specs/design/`）；4 个原本确实缺失的文档（`../reference/data-definition.md`、`../explanation/state-management.md`、`../how-to/hooks-guide.md`、`../explanation/page-structure.md`）已新建。故 `--auto-update` 不再因 `FILE_NOT_FOUND` 全失败。

> **一致性治理说明（2026-07-21）**：上方 §二 主矩阵已采用 pr-6 重组后的真实权威路径
> （`docs/reference/...`、`docs/explanation/...`、`docs/guides/how-to/...` 等），并由 N2 对齐磁盘。
> 本段早期合并自 `docs/reference/meta/doc-trigger-action-map.md` 的 `../reference/...` 旧路径矩阵
> 已被 §二 取代，特此删除以消除路径冲突（避免 FILE_NOT_FOUND）。映射表与
> `scripts/docs-tool/doc-update-trigger.ts` 的 `TRIGGER_RULES` 以 §二 为单一事实源。

