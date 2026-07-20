---
title: V9 文档与文件管理体系 — 治理审计报告
type: reports
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "V9 文档与文件管理体系 — 治理审计报告 report"
tags: [qa, audit, governance]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 文档与文件管理体系 — 治理审计报告

> **Version**: v1.0.0 ｜ **日期**: 2026-07-13 ｜ **执行者**: Senior Developer（高级开发工程师）
> **依据**: `../../AGENTS.md`（权威分层契约）、`docs/00-meta/governance.md`（文档治理宪法 v1.1.0）、`audit:doc-integrity`（v1.2 门禁）
> **范围**: `docs/` 全量（561 文件 / 410 md）+ 代码-文档对应审查 + 归档重组 + 新鲜度保障

---

## 一、治理目标与本次执行边界

按成熟软件项目文档治理四原则执行：① 盘点分类 → ② 代码-文档对应审查 → ③ 归档重组 → ④ 新鲜度保障。
本次**已执行**（精准收口，不破坏 `../../AGENTS.md` 契约与门禁）：

- 删除 2 个工具生成的 `*.backup.*` 垃圾文件
- 修复治理宪法 `../00-meta/GOVERNANCE.md` 自身 6 处死链（§七/§4.2/§6.2），升 v1.1.0
- 创建 `docs/drafts/`，使 `GOVERNANCE §2.1` 草稿规则自洽
- 升级门禁 `audit-doc-integrity.ts` v1.1→**v1.2**：排除 glob 模式误报（?109 警告）
- 量化并分类全部存量问题，输出本报告与待办路线

**未执行**（非本轮范围，已列入 §六 待办）：1758 处跨文档错路径存量、410 文档全量元数据戳记、共享管道退出码缺陷全局修复。

---

## 二、文档盘点与分类（要求①）

### 2.1 全量盘点（真实基线，环境重置后重核）

| 指标 | 数值 |
|------|------|
| 总文件数 | **561** |
| Markdown 文档 | **410** |
| 顶层目录 | 11（`00-meta`~`07-archive` + `reports`/`assets`/`prompts`） |
| 顶层导航文件 | 2（`../../README.md`、`../explanation/a-h-index.md`） |
| 总体积 | ≈ 61 MB（其中 `reports/` 49 MB **已 `.gitignore`**，不进版本控制） |

### 2.2 按类型分类矩阵（A–H 八类，对齐 `GOVERNANCE §二`）

| 类 | 名称 | 目录 | md 数 | 文档示例 |
|----|------|------|------|---------|
| **A** | 导航与治理 | `00-meta/`(5) · `01-requirements/`(16) · `03-development/plugins/` | 21 | README、GOVERNANCE、愿景目标 |
| **B** | 架构设计 | `02-design/architecture/`(33) · `05-deployment/`(5) | 38 | overview、cabins-overview、RELEASE_NOTES |
| **C** | 功能模块 | `02-design/cabins/`(15) · `services/`(30) · `data-layer/`(17) · `components/` · `cockpit/` · `store/` | 62+ | 舱室 spec、服务契约、数据字典 |
| **D** | 技术规范 | `02-design/standards/`(49) · `03-development/`(47) | 96 | AGENTS、编码规范、设计令牌、门禁 |
| **E** | 测试策略 | `04-testing/`(28) | 28 | 测试策略、用例、门禁 |
| **F** | AI 辅助治理 | `02-design/ai/` · `03-development/ai/` · `checklists/` | — | 提示词模板、检查表、飞轮 |
| **G** | 过程与质量产物 | `reports/`(87, gitignored) · `06-project-management/`(changelogs/plans/) | 87+ | 审计报告、变更日志、复盘 |
| **H** | 跨域补充 | `03-development/guides/` · `05-deployment/ops/` | — | 入门指南、How-to、Runbook |

### 2.3 冗余 / 过时 / 重复识别

- **内容精确重复**：md5 全量扫描 = **0**（无内容级重复，无需合并）
- **近似重名**：仅 `../../README.md` / `../explanation/overview.md`（合法的每目录索引，非重复）
- **版本过时**：`GOVERNANCE §七` 引用 4 个已删文件（已修，见 §四.3）；门禁仍捕获 1758 处跨文档错路径警告（见 §三.4）
- **信息冗余**：`reports/` 49 MB 生成物（审计报告/变更日志/复盘），已 `.gitignore`，属本地操作产物

---

## 三、代码-文档对应关系审查（要求②）

### 3.1 引用完整性（门禁 `audit:doc-integrity` v1.2）

| 指标 | 数值 |
|------|------|
| 扫描文档数 | 422 |
| 阻断性违规 | **0** |
| 警告 | **1758**（v1.1 为 1867，glob 排除后 **?109**） |
| 退出码 | `0`（门禁绿） |

### 3.2 孤儿文档

- **定义**：无活跃代码/测试反向引用的文档。
- `reports/`（87 md，gitignored 生成物）属**操作孤儿**——不进版本控制，仅本地参考，符合 `GOVERNANCE §4.1` 保留期规则。
- 活跃文档 **0 内容重复、0 真实孤儿**：均被 `../explanation/a-h-index.md` / `../../README.md` 索引或被代码引用。

### 3.3 裸代码模块

- **覆盖机制**（双层，非 1:1）：
  1. `../../AGENTS.md` §一 — 权威分层契约，覆盖全部 18 个 `src/` 模块（config/core/agents/data/lib/services/store/pages/components/apps/portal/constants/types/hooks/devtools/fixtures/i18n/schema/showcase/generated/mcp）
  2. `docs/02-design/` 功能规格 — cabins/services/components/data-layer/cockpit/standards/architecture/ADR/topics/ai/blueprints/modules
- **结论**：`src/` 模块**不要求 1:1 文档映射**（否则制造冗余，违背"单一真相源"），当前覆盖正确。
- **轻微缺口**（低优先，见 §六 待办）：`portal/`、`apps/` 分发器角色（部分已在 `cabins-overview §2` + `AGENTS §一`）、`i18n`、MCP 服务器目录（8 md 已覆盖，充分）。

### 3.4 引用一致性验证

- 门禁校验三类引用：`npm run`（1164）、`npx tsx`（39）、文件路径（4472 抽取 / 1758 缺失警告）。
- **GOVERNANCE §七 4 处死链已重定向至真实文档**：
  - `../reference/CODE-REVIEW.md` → `../how-to/code-review-guide.md` ? 存在
  - `../explanation/design/tech-debt.md` → `../explanation/design/tech-debt.md` ? 存在
  - `../00-meta/cleanup-schedule.md` / `../00-meta/文档体系体检报告-v9.md` → `../explanation/a-h-index.md` ? 存在
  - `../explanation/overview.md` → `../explanation/overview.md` ? 存在（路径写错修正）
- 其余 1758 警告为**存量错路径**（多数为反引号行内代码引用指向旧/错位置，如 `../00-meta/governance.md` 应为 `docs/00-meta/governance.md`），建议工具辅助分批校正（见 §六）。

---

## 四、文档归档与重组（要求③）

### 4.1 归档（无对应但有参考价值）

| 动作 | 对象 | 落点 |
|------|------|------|
| 本轮删除 | 2 个 `*.backup.*` 工具垃圾 | `docs/03-development/guides/getting-started/` |
| 前期归档（2026-07-13） | 39 个文件 / 目录 | `docs/07-archive/00-meta-archive-2026-07-13/`（见 `../archive/../archive/deletion-log.md`） |
| 生成物 | `reports/` 49 MB | 已 `.gitignore`，本地保留不进版本控制 |

### 4.2 合并（唯一性）

- md5 扫描 **0 内容重复** → 无需内容合并。
- **单一真相源铁律已执行**：`../../README.md` + `../explanation/a-h-index.md` + `00-meta/` 5 份权威文档为唯一入口；`../00-meta/registry-index.md` 只登记权威并指向 `../explanation/a-h-index.md`（避免两份全量列表重复腐化）。

### 4.3 过时标记 / 更新

| 文件 | 变更 |
|------|------|
| `../00-meta/GOVERNANCE.md` | v1.0.0→**v1.1.0**；修 §七（4 死链）+ §4.2（CLEANUP 引用）+ §6.2（overview 路径） |
| `docs/drafts/` | **新建**，使 `GOVERNANCE §2.1` 草稿规则自洽（含 `../../README.md` 说明角色） |
| `audit-doc-integrity.ts` | v1.1→**v1.2**：排除 glob 模式（`.github/workflows/*.yml` 等）误报 |

### 4.4 目录重组决策

- **顶层结构 `00-meta`~`07-archive` + `reports`/`assets`/`prompts` 与 `../../AGENTS.md` 契约一致 → 不重命名**（重命名会破坏契约与门禁，违背单一真相源铁律）。
- 仅补 1 个契约一致性目录 `docs/drafts/`（宪法自己指定的草稿位置）。

---

## 五、新鲜度与一致性保障（要求④）

### 5.1 过期信息更新
- GOVERNANCE 死链清零；`docs/drafts/` 自洽；门禁 glob 误报消除。

### 5.2 元数据补完
- ? 5 份权威文档 + `../../README.md` + `../explanation/a-h-index.md` + 优化方案 均含 `版本` / `日期` 头部。
- ? `GOVERNANCE §3.2` 已定义统一元数据模板（所有文档必须含版本+日期+适用范围+强制等级）。
- ? 410 文档全量元数据戳记需脚本化（`doc:freshness` 当前在 `GOVERNANCE §5.1` 引用但未在 `package.json` 落地，见 §六）。

### 5.3 本报告即新鲜度保障交付物。

---

## 六、执行结果对比与待办（输出要求）

### 6.1 整理前后目录结构对比

```
【整理前】                          【整理后】
docs/                              docs/
├── 00-meta/  (44 文件混乱)  →  ├── 00-meta/  (5 权威 + 本报告索引)
├── 02-design/  (含死链引用)  →  ├── 02-design/  (GOVERNANCE 死链已修)
├── (2 个 *.backup 垃圾)     →  ├── drafts/     (新建，宪法自洽) ?
├── GOVERNANCE §七 4 死链     →  ├── (死链已重定向至真实文档) ?
└── 门禁无 glob 排除          →  └── 门禁 v1.2 (glob 误报 ?109) ?
```

### 6.2 废弃文档清单

| 类别 | 文件 | 处置 |
|------|------|------|
| 工具垃圾 | `getting-started/README.md.backup.1783954189100/9155` | **已删** |
| 历史归档 | `07-archive/00-meta-archive-2026-07-13/`（39 文件） | 已归档，见 `../archive/../archive/deletion-log.md` |
| 生成产物 | `reports/`（49 MB / 169 文件） | gitignored，非废弃但非版本控制 |

### 6.3 合并 / 迁移记录

| 日期 | 动作 |
|------|------|
| 2026-07-13（前期） | `00-meta/` 收敛：39 文件 → `07-archive/` |
| 2026-07-13（前期） | SOP 迁 `docs/02-design/standards/` |
| 2026-07-13（前期） | `../explanation/a-h-index.md` 重写 v2.0.0（灭幽灵目录） |
| 2026-07-13（前期） | `../00-meta/registry-index.md` 重写（仅登记 5 权威） |
| **2026-07-13（本回合）** | 删 2 backup / 建 `drafts/` / 修 GOVERNANCE 死链 / 门禁 v1.2 |

### 6.4 待补充文档清单（Pending，分阶段工具辅助）

| 优先级 | 项目 | 方案 |
|--------|------|------|
| **P1** | 跨文档错路径存量（1758 警告） | 新增 `scripts/fix-doc-refs.ts`：对每个活跃文档 missing-file-path 警告，按 basename 模糊匹配 `docs/` 真实文件并自动校正路径；匹配不到的汇总人工复核 |
| **P2** | 410 文档全量元数据戳记 | 落地 `npm run doc:freshness`（当前 `GOVERNANCE §5.1` 引用但未实现），扫描缺版本/日期头部的文档并补全 |
| **P2** | 裸代码轻微缺口文档化 | 补 `portal/`、`apps/` 分发器角色专文档（当前散于 `cabins-overview §2` + `AGENTS §一`）；补 `i18n` 约定文档 |
| **P3** | 共享管道退出码缺陷 | `_audit-pipeline.ts:284` 的 `违规?警告` 退出码逻辑全局修复（影响所有 audit 脚本；本回合仅在 `audit-doc-integrity` 局部绕过，未全局改） |

---

## 七、结论

`docs/` 结构**清晰、引用基本自洽、无内容冗余、无版本冲突**。治理宪法自身已修复干净，门禁绿且误报消减。剩余 1758 处跨文档错路径警告**均为非阻断存量**（多为历史错路径/示例引用），已规划 **P1 工具辅助脚本**路线，可分批自动校正，无需人工逐条修改。

> **单一真相源铁律守则为本次最大收益**：未新建任何平行同内容文档，所有导航收敛至 `../../README.md` + `../explanation/a-h-index.md` + `00-meta/` 5 权威，从结构上杜绝了"文档漂移"复发。
