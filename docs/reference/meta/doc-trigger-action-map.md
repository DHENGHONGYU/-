---
title: doc-trigger-action-map
tier: important
code_version: 2.0.0
---

---
tier: important
code_version: 2.0.0
---

# 触发事件 → 更新动作 一一映射权威表

> 文档日期：2026-07-12（N2/N3 修订）
> 维护者：架构治理（里程碑 M1 / T1 产出；N2/N3 收尾）
> 关联文档：`../../00-meta/文档自动更新体系-架构梳理与任务清单.md` §三 约束1、`scripts/docs-tool/doc-update-trigger.ts` 的 `TRIGGER_RULES`

---

## 一、目的与范围

本文件是改进计划 **§三 约束 1「触发条件与更新动作需一一映射」** 的**单一事实源（single source of truth）**。

**核心约束：**

1. **1:1 映射**：每个触发事件**精确对应唯一主更新动作**（一个最具体的主文档）。其余相关文档列为「补充文档」并在备注中说明，更新器不得越界写其它文件。
2. **禁止无差别全仓库扫描**：更新器（`doc-update-trigger --auto-update` 以及 `doc-auto-updater`）**严禁**「扫描全仓库并批量改写」式误写；写入路径必须严格落在本表指定范围，未列于本表的文档**不得被自动改写**。
3. **与代码同步**：本表的 **T1–T10** 必须与 `scripts/docs-tool/doc-update-trigger.ts` 的 `TRIGGER_RULES` 保持同步。代码改动 `TRIGGER_RULES` 时，本表须同步修订（反之亦然）。
4. **M2 落地点**：`doc-update-trigger --auto-update`（**已落地，见 N3**）以本表为唯一依据，将每个命中模式映射到对应主文档 + 补充文档，并在写后跑 `audit:docs`（除非本表标注「否」）。当前内容生成为**扩展点**（`DocGenerator` 注册表），内置默认生成器（缺失建骨架 / 存在刷新校验标记）与 T10 版本校验生成器；后续可注入按触发类型生成正文的生成器。

> 本文件为纯规范文档，不改动任何源码或 CI。

---

## 二、权威映射矩阵

列说明：

- **主更新动作（唯一）**：该触发事件对应的**唯一最具体文档**，更新器优先改写它。
- **是否触发 audit:docs**：写完后是否运行 `npm run audit:docs` 做引用同步校验。
- **补充文档**：与主动作并列、需同步维护的其它文档（非越界，仍属本触发事件的明示范围）。

> **路径基准（N2 修订后）**：下表所有目标文档路径均已对齐磁盘真实文件——9 个原指向 `docs/` 根的文档修订为真实路径（`docs/01-requirements/`、`docs/02-design/`）；4 个原本确实缺失的文档（`../data-definition.md`、`../../explanation/state-management.md`、`../../how-to/hooks-guide.md`、`../../explanation/page-structure.md`）已新建。故 `--auto-update` 不再因 `FILE_NOT_FOUND` 全失败。

| 触发事件 | 匹配模式 (glob) | 对应更新动作（唯一主文档） | 是否触发 audit:docs | 备注 |
|---|---|---|---|---|
| **T1 类型定义变更** | `src/data/types.ts`、`src/types/modules/*.ts`、`src/services/scoring/v6-engine/types.ts`、`../../../src/showcase/types.ts` | 更新 `../data-dictionary-index.md` | 是 | 补充：`../v9核心数据字典与类型定义(整合版).md`、`../data-definition.md`、`../news-data-definition.md`。仅改命中文件对应的条目，禁止全量重写。 |
| **T2 接口变更** | `src/services/**/index.ts`、`src/core/databridge.ts`、`src/data/dataLayer.ts`、`src/services/fetcher`、`src/services/analysis` | 更新 `../api-contract.md` | 是 | 补充：`../databridge端点与数据映射清单.md`、`../功能模块数据契约.md`。按变更接口精确改写签名/端点段。 |
| **T3 架构调整** | `src/config/routes.ts`、`src/config/dbConfig.ts`、`../../../AGENTS.md`、`src/config/thresholds.ts` | 更新 `../03-architecture-standards.md` | 是 | 补充：`../06-routing-specs.md`、`../../explanation/03-architecture-standards.md`。注意 `src/config/thresholds.ts` 同属 T4，命中时 T3/T4 均触发，各自只改本职文档。 |
| **T4 配置参数变更** | `src/constants/*.ts`、`src/config/thresholds.ts`、`src/services/scoring/v6-engine/config.ts` | 更新 `../05-engine-specs.md` | 是 | 补充：`../09-quality-gates.md`。 |
| **T5 Store 状态管理变更** | `src/store/**/*.ts` | 更新 `../../explanation/state-management.md` | 是 | 补充：`../data-flow-spec.md`。 |
| **T6 UI 组件变更** | `src/components/**/*.tsx`、`src/components/**/*.ts` | 更新 `../../explanation/design/component-library-guide.md` | 是 | 补充：`../../explanation/design/ui-design-system.md`。 |
| **T7 Hook 自定义变更** | `src/hooks/**/*.ts`、`src/hooks/**/*.tsx` | 更新 `../../how-to/hooks-guide.md` | 是 | 补充：`../data-flow-spec.md`。 |
| **T8 页面组件变更** | `src/pages/**/*.tsx`、`src/pages/**/*.ts` | 更新 `../06-routing-specs.md` | 是 | 补充：`../../explanation/page-structure.md`。 |
| **T9 Widget 注册表变更** | `src/cockpit/core/widgetRegistry.ts` | 重写 `../data-definition.md` | 是 | 补充：增量维护 `../registry-index.md`（非全量重写，见任务 A1）+ 跑 `audit:docs`。注册表结构变更时 cockpit 数据定义需整体对齐。 |
| **T10 版本发布（package.json version bump）** | `package.json`（仅 `version` 字段变更） | 全仓 `docs/**/*.md` frontmatter `code_version` 同步 | 否（由 `doc:version-check` 覆盖） | 补充：将 `CHANGELOG` 的 `[Unreleased]` 段提升为对应版本段（对应计划 T4/T5/T6）。此事件为**跨仓库元数据同步**，不触达正文，故不跑 `audit:docs`；`--auto-update` 对 T10 对接 `npm run doc:version-check`。 |

> **关于 1:1 的说明**：上表每个触发事件只有一个「主文档」作为唯一主动作；「补充文档」是该触发事件**明示附带**的同步范围，仍属本事件，不属于越界。任何未出现在本表的文档都不在自动改写范围内。

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

> 同步要求：任何对 `scripts/docs-tool/doc-update-trigger.ts` `TRIGGER_RULES` 的增删改，或对 `widgetRegistry.ts` / `package.json` 触发语义的调整，均须同步修订本表，确保二者始终一致。
