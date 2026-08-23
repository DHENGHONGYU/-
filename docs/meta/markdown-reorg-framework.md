---
title: "V9 Markdown 文档体系梳理与重构方案"
domain: project
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v1.0.1
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

---
title: V9 Markdown 文档体系梳理与重构方案
type: meta
domain: architecture
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: **梳理范围：全项目业务 .md 共 **1238 份（排除 `node_modules/` 1169、` .venv/` 39 第三方产物后）
tags: [architecture, refactor, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-ARCH-047
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-331, V9-DOC-PROJ-175]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---meta
domain: architecture
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [architecture, refactor, documentation]
phase: planning
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# V9 Markdown 文档体系梳理与重构方案

> **Date**：2026-07-16
> **梳理范围**：全项目业务 .md 共 **1238** 份（排除 `node_modules/` 1169、` .venv/` 39 第三方产物后）
> **主战场**：`docs/` 共 **693** 份（占 56%）
> **现有编号体系**：doc-manifest.csv（已废弃，595 登记，缺口 98）+ `docs/meta/REGISTRY_INDEX.md`（C-/I-/R- 三层）
> **配套文档**：`docs/meta/agent-app-docs-classification.md`（scene#17 Agent 应用 19 份归类）
> **风格治理**：`docs/meta/doc-style-standard.md`（唯一正源标准）、doc-style-remediation-plan.md（已废弃，P0–P3 执行方案与验收）、doc-style-remediation-log.md（已废弃，执行日志）
> **⚠️ 路径归档说明（2026-08-16）**：本文档中引用的文件路径均为 2026-07-16 规划阶段的快照路径。经历多轮文档治理（batch6-8 归档）后，部分目标文件已归档至 `docs/archive/historical-2026-08-16/` 或已被重命名/合并。本文档作为历史规划记录保留，文中路径不再更新。现行文档结构见 [AGENTS.md](AGENTS.md) 和 [GOVERNANCE.md](GOVERNANCE.md)。

---

## 一、现状诊断（数据说话）
| 维度 | 现状 | 问题 |
|------|------|------|
| 总量 | 1238 份业务 .md，docs/ 占 693 | 文档规模已失控，缺乏统一治理入口 |
| 分布 | `explanation/` 204 + `reference/` 198 + `reports/` 114 + `00-meta/` 59 + `archive/` 56 居前五位 | 解释性与过程文件占比过高（≈ 75%），"活文档"被淹没 |
| 重复 | `docs/specs/01-vision-and-goals.md`、`docs/explanation/03-architecture-standards.md`、`../archive/historical-2026-08-16/batch8/complexity-governance.md（已归档）` 曾同时存在于 `explanation/` 与 `reference/`（已合并去重） | 同名跨目录，单一事实源被破坏，AI 易取错版本 |
| 缺口 | docs/ 实际 693 → manifest 仅登记 595（**缺口 98**） | 索引漂移，新文档未入册 |
| 过程文件 | 带日期/报告/复盘/诊断命名者约 345 份（docs 229 + outputs 68 + archive 41） | 未做生命周期管理，越积越多 |
| 编号 | C- 71 / I- 302 / R- 222，类目 17 种 | 类目过细（MISC 136 占最大），编号与 slug 混用 |

**核心矛盾**：用户视角的"三类诉求"与现有"tier 三层 + 17 类目"存在映射断层，且过程文件未受生命周期约束。
---

## 二、三级分类体系（你的诉求 → 可执行标准）

将你提出的三类诉求，与现有 `tier` + 编号体系对齐：

### 🟢 A 类 · APP 运行直接相关（活文档 / 事实标准）
> **定义**：APP 能跑、门禁能过、测试能对、代码能写，直接依赖的文档。改代码必须先改这些，否则门禁假绿灯。
> **对应现有**：`tier=core`（71）+ `tier=important` 中偏"规范/契约/门禁"子集
> **落地编号**：**C-（核心，变更需评审）** + 部分 **I-（重要，变更需 review）**

| 子类 | 内容 | 代表文件 |
|------|------|----------|
| 行为契约 | AI/分层/四步集成强制约束 | `AGENTS.md`（项目根，P0 事实标准） |
| 编码规范 | 类型安全、复杂度治理、lint 规则 | `docs/reference/coding-conventions.md`、`../archive/historical-2026-08-16/batch8/complexity-redlines.md（已归档）` |
| 质量门禁 | 12 道门禁定义与基线 | `docs/guides/standards/quality-gates.md`、`docs/guides/09-quality-gates.md`、`docs/reference/踩坑规则门禁指南.md` |
| 测试规范 | 单测/集成/E2E 基线 | `docs/reports/testing/*`、`../archive/historical-2026-08-16/batch6/docs/reference/test-catalog.md（已归档）` |
| 校对契约 | 文档-代码双向校对规则 | `docs/reference/hybrid-proofread-contract.md`、doc-proofreading-strategy.md（已废弃） |
| 开发 SOP | 工作流、工具链地图 | `../archive/historical-2026-08-16/batch7/docs/reference/development-workflow-sop.md（已归档）`（P0） |

### 🔵 B 类 · 系统初始文档（定义与边界）
> **定义**：系统"是什么、怎么定义、数据怎么存、架构怎么画、各板块怎么说明"。是 AI 与新人理解系统的唯一正源。
> **对应现有**：`tier=core`/`important` 中偏"定义/契约/架构"子集
> **落地编号**：**C-（核心事实源）** + **I-（重要说明）**

| 子类 | 内容 | 代表文件 |
|------|------|----------|
| 系统入口 | 项目/文档总 README | 根 `README.md`、`../../README.md` |
| 架构总览 | 分层、舱室、PortalShell | `../archive/historical-2026-08-16/batch7/docs/explanation/architecture/overview.md（已归档）`、`docs/explanation/ARCHITECTURE.md` |
| 数据宪法/字典 | 数据定义规范、主数据字典 | `docs/reference/v9数据宪法.md`（P0）、`../archive/historical-2026-08-16/batch7/docs/reference/data-definition.md（已归档）`、`../archive/historical-2026-08-16/batch8/ai-center-data-definition.md`（已归档） |
| API 契约 | 27 个 service 契约 | docs/reference/*-contract.md、`../archive/historical-2026-08-16/batch7/docs/explanation/architecture/api-contracts.md（已归档）` |
| ADR 决策 | 架构决策记录 | docs/reference/adr-*.md、docs/explanation/adr-*.md |
| 板块说明 | 各舱/模块/子系统说明 | `docs/reference/modules/*`、`../archive/historical-2026-08-16/batch7/docs/explanation/cabins-overview.md（已归档）`、`team-handbook/*` |

### 🟡 C 类 · 解释性 / 验证性过程文件（过程产物）
> **定义**：带日期、报告、复盘、诊断、计划、看板，记录"我们做过什么、发现什么、怎么改"。**有时效性，需生命周期管理**。
> **对应现有**：`tier=reference`（222）+ `reports/` + 部分 `archive/`
> **落地编号**：**R-（参考，只读归档）**，并按 DOCS 目录清单 + 编号规则归位

| 子类 | 内容 | 代表文件 |
|------|------|----------|
| 审计/检视报告 | 架构/安全/智能体审计 | `docs/reports/audit/*`（agent-audit-report.md 已于 2026-08-23 合并汇总中删除，无后继） |
| 定期更新报告 | 文档治理/同步报告 | 已归档 |
| 复盘/诊断 | 故障 RCA、功能遗漏诊断 | 2026-07-12 安全审计报告（已删除）、`docs/assets/team-handbook-html/supplementary/V9_MCP_Server与Agent功能遗漏诊断.html` |
| 计划/看板 | 整改计划、执行看板 | `../archive/historical-2026-08-16/batch6/docs/reference/meta/doc-auto-update-kanban.md（已归档）`、prompt-execute-remediation.md（已删除） |
| 验证基线 | 集成基线比对、完成度校验 | 已归档、`../archive/historical-2026-08-16/batch7/docs/explanation/design/quality-audit-plan.md`（已归档） |

---

## 三、与现有编号体系的对齐映射
| 你的诉求 | 现状 tier | 现状编号 | 建议编号锚点 | 类目收敛 |
|----------|-----------|----------|--------------|----------|
| A 类 活文档 | core + 重要子集 | C- / I- | **C-**（强制核心）、**I-**（规范指南） | GOV/ARC/SPEC/TEST/DESIGN |
| B 类 系统初始 | core + 重要子集 | C- / I- | **C-**（事实源）、**I-**（说明） | DAT/API/ADR/ARC/GUIDE |
| C 类 过程文件 | reference | R- | **R-**（只读归档） | RPT/LOG/MISC（建议拆 MIGR/RETRO） |

**类目收敛建议**：现有 17 类目中 `MISC`（136）过大，建议将过程文件细分为 `RPT`（报告）、`RETRO`（复盘）、`MIGR`（迁移）、`LOG`（日志），使类目语义清晰。
---

## 四、目录级重梳规则（逐目录去留判定）

基于 `docs/meta/directory-structure-guide.md` §2.2 + 实测分布，给出每个 docs 子目录的"职责 + 归属类 + 重梳动作"：

| docs 子目录 | .md 数 | 主导类 | 重梳规则 |
|-------------|-------|--------|----------|
| `00-meta/` | 59 | C 类过程+治理 | 治理文档（manifest/registry/guide）→ **A 类**；核验报告 → **C 类 R-**，按日期入 `reports/` 或 `archive/` |
| `01-product/` | 3 | B 类 | 保留为产品需求基线（B 类） |
| `01-requirements/` | 1 | B 类 | ADR/需求，保留（B 类） |
| `04-testing/` | 6 | A 类 | 测试计划/清单，归 **A 类**（活文档） |
| `ai/` | 3 | B 类（旧入口） | 标注 deprecated，内容已并入 `reference/` + `prompts/`，建议重定向 |
| `architecture/` | 5 | B 类 | 架构/契约，归 **B 类** |
| `archive/` | 56 | C 类 | 历史归档，全部 **C 类 R-**，定期清理（指南规定每月） |
| `design/` | 2 | B 类 | 设计说明，归 **B 类** |
| `drafts/` | 2 | C 类 | 草稿，归 **C 类**，成熟后转正或删 |
| `explanation/` | 204 | 混合（B+C） | **重灾区**：与 `reference/` 同名文件需合并去重；设计说明留 B 类，报告/计划归 C 类 |
| `guides/` | 4 | A 类 | 操作指南，归 **A 类** |
| `how-to/` | 13 | A 类 | 含 code-review/hooks，归 **A 类** |
| `modules/` | 1 | B 类 | 模块总览，归 **B 类** |
| `ops/` | 2 | A 类 | 部署/runbook，归 **A 类** |
| `prompts/` | 5 | A 类 | AI 提示词模板，归 **A 类** |
| `reference/` | 198 | 混合（B 为主） | 契约/数据字典/ADR → **B 类**；过程性 reference → **C 类** |
| `reports/` | 114 | C 类 | 全部 **C 类 R-**，按 `YYYY-MM-DD-*` 命名，每月清理归档 |
| `standards/` | 2 | A 类 | 编码/门禁，归 **A 类**（P0 活文档） |
| `team-handbook/` | 6 | B 类 | 团队手册，归 **B 类** |
| `testing/` | 1 | A 类 | 测试目录，归 **A 类** |
| `tutorials/` | 1 | B 类 | 教程，归 **B 类** |
| `assets/` | 3 | — | 静态资源，非文档，移出计数 |
| `docs 根` | 2 | A 类 | `README.md` 入口（B 类），`../archive/historical-2026-08-16/batch6/docs/reports/project-management/01-p1-debt-cleanup-todo.md（已归档）` → C 类 R- |

> **关键动作**：`explanation/` 与 `reference/` 同名文件（已确认 3 个）必须合并——以 `reference/` 为权威定义源，`explanation/` 仅保留"为什么这样设计"的解释，删除重复定义。
---

## 五、具体清理动作清单（可执行）

| 优先级 | 动作 | 范围 | 风险 |
|--------|------|------|------|
| **P0** | 合并跨目录同名重复文件（explanation ↔ reference） | 3 组已确认 + 全量扫描其余同名 | 低（先 diff 再合并） |
| **P0** | 重建 manifest 消除 98 缺口 | `npm run doc:manifest` | 低（自动生成） |
| **P1** | C 类过程文件按 `YYYY-MM-DD-*` 重命名归位 `reports/` | 345 份中带日期者 | 中（需改引用链接） |
| **P1** | 类目收敛：MISC 拆 RPT/RETRO/MIGR/LOG | manifest.csv + registry-index | 低 |
| **P2** | `docs/reference/ai/` 标 deprecated 并重定向 | 3 份 | 低 |
| **P2** | `drafts/`、`archive/` 季度清理 | 58 份 | 中（需确认无引用） |
| **P3** | 建立统一"Agent 文档专区"（scene#17 遗留项） | 整合散落核心文档 | 低 |

---

## 六、开发经验分享（文档治理最佳实践沉淀）

结合本项目踩坑（AGENTS.md 教训 1/5/6、doc-code-dual-proofreading 技能），沉淀以下原则：

1. **单一事实源（Single Source of Truth）**
   - 每个定义只在一处。跨目录同名 = 腐败信号。合并后立即更新 `links_to/linked_by`。
   - 例：数据字典只在 `../archive/historical-2026-08-16/batch7/docs/reference/data-definition.md（已归档）`，别处引用，不复制。

2. **文档即镜像（Docs as Mirror）**
   - 代码改 → 文档必须同步改，靠 `docs/meta/doc-trigger-action-map.md` 的 T1–T10 触发规则 + `--auto-update` 强制。
   - 移动文档须同步 3 处：映射表、TRIGGER_RULES、各目录 README，否则报 FILE_NOT_FOUND。

3. **编号是索引，slug 是真相**
   - 文档间引用用 **slug（文件名）**，不用 C-/I-/R- 编号（编号可因重排改变）。
   - 改编号只改 CSV 一处，`npm run doc:manifest` 重建。

4. **过程文件必须有生命周期**
   - 报告/复盘/诊断带 `YYYY-MM-DD-` 前缀，落地 `reports/` 或 `archive/`，**每月清理**。
   - `outputs/`（306 份 AI 产物）建议 gitignore，不进 manifest。

5. **门禁联动，治标治本**
   - `audit:layers`/`audit:atomic`/`audit:hardcode` 等 12 道门禁是 A 类活文档的"执行器"。
   - 文档漂移会导致门禁假绿灯——文档治理与代码门禁同属 A 类，必须同步维护。
6. **类目语义要窄**
   - `MISC` 占 136 是治理失效 signal。类目应可枚举、互斥、语义清晰（GOV/ARC/DAT/API/RPT/RETRO…）。
---

## 七、落地步骤（分阶段）

```
阶段 1（P0，1 天）：合并同名重复 → 重建 manifest → 验证 0 缺口
阶段 2（P1，2-3 天）：C 类过程文件按日期重命名归位 + 类目收敛
阶段 3（P2，1 天）：deprecated 标注 + 草稿/归档清理
阶段 4（P3，持续）：建 Agent 专区 + 接入 doc:manifest 自动门禁
```

---

## 八、配套产出
- [x] `docs/meta/agent-app-docs-classification.md`（scene#17 Agent 19 份归类，已完成）
- [x] `docs/meta/markdown-reorg-framework.md`（本文，分类标准 + 重梳规则 + 经验）
- [ ] 执行 P0 合并与 manifest 重建（待确认启动）
- [ ] 生成 C 类过程文件重命名脚本（待确认）

> **下一步建议**：确认后我先执行 **P0**（合并 3 组同名文件 + 跑 `npm run doc:manifest` 补 98 缺口），这是零风险、高收益的第一步。
