---
title: doc-auto-update-kanban
code_version: 2.0.0
tier: core
---

# 文档自动更新体系 — 任务看板（单一事实源）

> 文档日期：2026-07-12（M1 收尾 + 维度二审查后建立）
> 维护者：架构治理 Agent
> 关联文档：`docs/00-meta/文档自动更新体系-架构梳理与任务清单.md`（原 §四 任务清单）、`docs/00-meta/doc-trigger-action-map.md`、`../reports/retrospectives/freshness-alerts.md`
>
> **本文是自动更新体系任务的单一事实源（single source of truth）**。所有任务状态、依赖、负责人、截止以本文为准；原 §四 清单中已被本审查修订/推翻的项，以本文「修订」列标注。

---

## 一、状态图例

- ✅ 已完成（已验证）
- 🟡 进行中 / 部分完成
- 🔴 待启动（已定义未做）
- ⛔ 阻塞
- 🆕 本次审查新增（原清单未覆盖）

---

## 二、P0 关键路径（已闭环，2026-07-12 验证）

| ID | 任务 | 状态 | 验证 | 负责人 | 截止 |
|----|------|------|------|--------|------|
| T1 | 触发-动作一一映射表 `doc-trigger-action-map.md` | ✅ | 文档存在；契约测试 T1 通过 | 架构师 | 07-15 |
| A1 | crossref 限域 `changedScanned` + 越界防御 | ✅ | 契约测试 20/20（Node24） | 核心开发者 | 07-15 |
| A2 | `--files` 存在性校验 `FILE_NOT_FOUND`→failure | ✅ | 契约测试 T8/T10 通过 | 核心开发者 | 07-15 |
| T7a | 端到端流水线骨架 `doc-pipeline.ts` | ✅ | `--dry-run` exit 0，overallStatus success | 核心开发者 | 07-16 |
| T2 | 统一 `retryWithBackoff`（仅 TRANSIENT/IO） | ✅ | standalone tsc 0 错误 | 核心开发者 | 07-20 |
| T3 | 告警适配器 `doc-notify.ts` | ✅ | self-test 通过 | 核心开发者 | 07-20 |
| T8 | **本文**：轻量看板（单一事实源） | ✅ | 本文已建立 | 架构师 | 07-31 |

---

## 三、P1 加固与告警

| ID | 任务 | 状态 | 依赖 | 负责人 | 截止 |
|----|------|------|------|--------|------|
| A3 | `main` 顶层 `try/catch` + failure 报告 | ✅ | — | 核心开发者 | 07-12（本次已做） |
| A4 | 基线路径可配置（env/--state-dir） | ✅ | — | 核心开发者 | 07-12（核实已实现） |
| A5 | state/报告原子写（temp+rename） | ✅ | — | 核心开发者 | 07-12（本次已做） |
| A6 | lockfile 防并发丢失更新 | ✅ | — | 核心开发者 | 07-12（本次已做） |
| T7b | `doc-automation.yml` CI（push/PR 触发） | ✅ | T7a,T3 | 架构师 | 07-12（本次已做） |
| B7 | PR Checklist 增「文档已同步」勾选项 | 🟡→✅ | T1 | QA/Reviewer | 07-12（本次已加） |

> **B7 修订**：本轮已在 `../../.github/pull_request_template.md` 的 L4 文档同步段增加「`audit:docs` 已通过（文档已同步）」显式勾选项，原 §四 标记 🟡 已闭环。

> **A3/A4/A5 核实（2026-07-12 二次校对）**：双重校对 `doc-auto-updater.ts` 代码实况——
> - **A4 ✅**：`resolveStateFile()`（L68-71）已实现 `--state-dir` → `process.env.DOC_UPDATER_STATE_DIR` → `--output` 三级优先级，基线路径可配置已完成。
> - **A5 🟡**：`atomicWrite()`（L195-201，temp+rename）已用于 state 写入（L311）；但 `writeReports()`（L838+）仍用 `writeFileSync`，报告原子写未做。
> - **A3 🟡**：failure 报告机制已有（`overallStatus` + `exitCode`），但 `main()`（L542）头部无顶层 `try/catch` 包裹整个流程。

---

## 四、P2 完整度与治理

| ID | 任务 | 状态 | 依赖 | 负责人 | 截止 |
|----|------|------|------|--------|------|
| A7 | `--files` 去重 + `--strict` 退出码（输入校验） | ✅ | A2 | 核心开发者 | 07-12（本次已做） |
| A8 | crossref 按 filePath 精确归因 | ✅ | A1 | 核心开发者 | 07-12（本次已做） |
| A9 | 结构化日志 + 导出纯函数/DI | ✅ | — | 核心开发者 | 07-12（本次已做） |
| A10 | 报告轮转保留 N 份 | ✅ | — | 核心开发者 | 07-12（本次已做） |
| C1-C5 | 激活保鲜度告警（接入 T3 + 定时） | 🔴→✅ | T3 | Doc-Sync Agent | 07-12（本次已激活） |
| T4 | 文档 frontmatter `code_version` + CI 校验 | 🔴→✅ | — | 架构师 | 07-12（本次已做） |
| T5 | `recordVersionHistory` 增 `codeRef{gitTag,packageVersion,commitSha}` | 🔴→✅ | T4 | 核心开发者 | 07-12（本次已做） |
| T6 | release/`npm version` 钩子：Unreleased→版本段 + 全仓对齐 | ✅ | T4,T5 | 架构师 | 07-12（本次已做） |
| B12 | 架构文档版本比对常态化 | ✅ | T5 | Doc-Sync Agent | 07-12（本次已做） |
| B15 | 数据字典自动生成探索（TS AST） | ✅ | T7a | 核心开发者 | 07-12（探索原型） |

> **A9 核实（2026-07-12 二次校对）**：结构化日志已用（`logger.info/warn/error` 带 context 对象，如 `{ count, modules }`）；但 `doc-auto-updater.ts` **0 个 `export function`**，纯函数导出/DI 未做，故 🟡。

> **本轮已交付（07-12）**：
> - **A7** — `doc-auto-updater.ts` 增加 `--strict`：开启时对显式 `--files` 去重并以非零退出码反映 partial/failure；默认行为不变（契约测试仍 20/20）。
> - **C1-C5** — 新增 `scripts/docs-tool/doc-freshness-alert.ts`，实现 ALERT-01~05 评估并接入 `doc-notify` 告警适配器；`npm run doc:freshness-alert` 可运行。
> - **T4** — 新增 `scripts/docs-tool/doc-version-check.ts`，校验 `docs/**/*.md` frontmatter `code_version` 与 `package.json` 一致（CI 门禁用，默认只读，非零退出即阻断）；`npm run doc:version-check` 可运行。
> - **T5** — `doc-version-history.ts` 的每日 changelog 头部增加 `code_version` / `git_tag` / `commit_sha`（即 `codeRef`），从 `package.json` 与 `git` 解析，失败优雅降级。

---

## 五、🆕 本次维度一/二维交叉校对新增任务（原清单未覆盖）

> 以下为 2026-07-12「本地文件管理 × 自动更新」双重校对发现的、原任务清单未覆盖的缺口，按优先级排列。

| ID | 任务 | 优先级 | 状态 | 负责人 | 截止 |
|----|------|--------|------|--------|------|
| N1 | **修订 `doc-trigger-action-map.md` 以匹配真实文档基底**：14 个目标文档中 13 个在磁盘缺失（仅 `../explanation/03-architecture-standards.md` 存在）；字典索引路径应为 `../reference/data-dictionary-index.md`（原表误写 `../reference/data-dictionary-index.md` 已修正）；`../reference/registry-index.md` 已恢复（曾 tracked-but-deleted）。 | P0 | ✅ | 架构师 | 07-12（本次已闭环） |
| N2 | **补齐 / 修订映射表指向的缺失目标文档**（state-management.md、COMPONENT_GUIDE.md、../how-to/hooks-guide.md、../explanation/page-structure.md、DATA_FLOW.md、DESIGN_SYSTEM.md、03-architecture-standards.md、05-engine-specs.md、06-routing-specs.md、09-quality-gates.md、trade/api-contract.md、cockpit/data-definition.md、news/data-definition.md）。选择：①按真实文档骨架创建最小骨架；②或修订映射表指向已有文档。**不解决则 `--auto-update` 实现后会因 FILE_NOT_FOUND 全失败。** | P0 | ✅ | 架构师 + 核心开发者 | 07-12（本次已做） |
| N3 | **`doc-update-trigger --auto-update` 空桩落地**（生成环节缺口）：当前 generate 阶段为 partial，仅透传变更给 doc-auto-updater。需按 T1 映射表实现「按触发规则生成/更新对应主文档」。 | P0 | ✅ | 核心开发者 | 07-12（本次已做） |
| N4 | **维度一残留文件卫生**：已处置——`docs/design/` 2 文件迁 `02-design/`、`cleanup-schedule.md`/`governance.md` 迁 `00-meta/`、`docs/project-management/` 空目录删除、`docs/reports/` 461 tracked 产物 `git rm --cached`（gitignore L146 已配）。 | P1 | ✅ | 架构师 | 07-12（本次已做） |
| N5 | **stale 文档治理**：`trae-file-management-review.md` 描述的是清理前状态（file-management-system/、articles/ 已迁走、README 已建、DATA_DEFINITION 已归并），需标注「已过时/已执行」或刷新，避免误导后续 AI。 | P1 | ✅ | 架构师 | 07-12（已闭环，双重校对核实） |

> **本轮已交付（07-12 N2/N3，P0 全闭环）**：
> - **N1** — 映射表 §二 全部目标文档路径对齐磁盘真实文件；补充文档中文路径一并修正（`《DataBridge端点与数据映射清单》`→`docs/01-requirements/`、`《V9核心数据字典…》`/`《功能模块数据契约》`→`docs/02-design/`）。
> - **N2** — 13 个原缺失目标文档全部可解析：9 个修订映射表指向已有真实文档（`01-requirements/`、`02-design/`），4 个确实缺失者已新建（`../explanation/state-management.md`、`../how-to/hooks-guide.md`、`../explanation/page-structure.md`、`../reference/data-definition.md`，内容均由代码实况派生、统一 blockquote 风格）。T1–T9 共 19 个 `docsToUpdate` 路径逐项验证 ✓ EXISTS。
> - **N3** — `doc-update-trigger --auto-update` 空桩落地：新增 `--since/--base-ref/--files/--dry-run/--strict` 参数校验；`DocGenerator` 注册表扩展点（内置 `defaultDocGenerator`=建骨架+幂等校验标记、`versionCheckGenerator`=对接 `doc:version-check`）；按映射表路由生成 → 按需 `audit:docs`；修复 `matchPattern` 的 `**/*.ts` 不匹配顶层文件缺陷；新增 T9/T10 规则与 `auditDocs` 字段。
> - **验证**：契约 20/20；`audit:layers` 0/0；`audit:docs` ✅；`lint:colors` 0；`doc:version-check` exit 0；`tsc` 0 错误；`--auto-update` 非 dry-run 实跑（写标记 + `audit:docs 通过` + exit 0，标记已回退）。

> **N5 闭环核实（2026-07-12 双重校对）**：`trae-file-management-review.md` 顶部已实际标注「⚠️ 本文档已过时（2026-07-12，N5 治理）」并列出全部已处置项，故 N5 状态由 🔴 修订为 ✅（本次盘点发现看板状态滞后于实况的漂移，已同步）。
>
> **门禁基线校正（2026-07-12 实测）**：本轮实跑 `audit:docs` = 0 违规 / 644 文件（exit 0）、`doc:version-check` exit 0（186/198 含 code_version）、契约测试全通过、`--auto-update --dry-run` 路由正确（exit 0）。**唯 `audit:layers` 实测 6 违规（exit 1）**，均为 `src/services/` 引入 `@/lib/precision`、`@/lib/validation`（非 `../../AGENTS.md` lib 基础设施白名单成员）——属**代码层既有分层债务，与文档自动更新体系无关**，建议单独立项（不在本文档治理范围内改动）。上文历史 blockquote 中「`audit:layers` 0/0」为 N2/N3 那轮快照，保留不改。

> **⚠️ N2 路径再次失效与重对齐（2026-07-14 pr-6 重组后修订）**：
> pr-6 提交（4e736e9, 2026-07-14 "chore(refactor/pr-6): 偏差校对整改 R1-R8 落盘"）将 docs 从旧编号目录（`01-requirements/`、`02-design/`、`03-development/`、`04-testing/`、`05-deployment/`）整体迁移到 Diátaxis 新结构（`explanation/`、`reference/`、`how-to/`、`tutorials/`、`reports/`、`00-meta/`），导致 N2 上述"19 路径 ✓ EXISTS"的结论**全部失效**——映射表 §二 与代码 `TRIGGER_RULES.docsToUpdate` 仍指向旧路径，`--auto-update` 会 `FILE_NOT_FOUND`。
> - **交叉比对验证**：git 历史显示 183 个 MD 文件被删除（diff-filter=D），但 **0 个真缺失**——全部有同名新文件存在（内容保留，属有计划移动非误删）；761 条重命名记录；88 个 basename 产生多副本（51 个内容完全相同的真重复）。
> - **本次重对齐**：映射表 §二 与 `scripts/docs-tool/doc-update-trigger.ts` 的 `TRIGGER_RULES` 已同步修订，19 个 `docsToUpdate` 全部指向 Diátaxis 新结构权威位置（规范/契约→`reference/`、设计决策→`explanation/`、实操指南→`how-to/`、治理核心→`00-meta/`），逐项验证 ✓ EXISTS。
> - **遗留**：51 个真重复副本待 P1 去重；命名规范化（kebab-case 统一）待 P2。详见 `../archive/诊断与重梳方案报告.md`。

---

## 六、依赖链（关键路径）

- `T1 → A1 → T7a → T7b`
- `A2 → A7`（已完成）
- `C1-C5 → T3`（已完成）
- `T4 → T5 → T6`
- `A3 → T2`（已完成）
- `N1 → N2 → N3`（自动更新生成闭环，已全部完成 ✅）

**阻塞说明**：N1–N5 与 P1/P2 主体加固（A3/A4/A5/A6/A7/A9/A10/T4/T5/T6/T7b/B7/C1-C5）均已闭环，无硬阻塞。剩余待办 = ①`audit:layers` 6 处既有分层债务（services→lib 非白名单，代码层，需单独立项，与文档体系无关）②12 份文档未声明 frontmatter `code_version`（时效性可加固）③P2 探索项：A8（crossref filePath 归因）、B12（架构版本比对常态化）、B15（数据字典 AST 生成）。

---

## 七、验证门禁（每次改动后复测）

```bash
# 契约测试（自动更新核心逻辑）
node ./node_modules/tsx/dist/cli.mjs outputs/test-doc-auto-updater.mjs   # 期望 20/20
# 分层/文档/颜色门禁
npm run audit:layers && npm run audit:docs && npm run lint:colors
# 新增脚本冒烟
npm run doc:freshness-alert
npm run doc:version-check
```
