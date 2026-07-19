---
title: doc-file-management-optimization-plan
code_version: 2.0.0
tier: core
status: archived
---

# V9 智能投研复盘系统 — 文档与文件管理体系优化方案

> **Version**: v1.0.0 ｜ **日期**: 2026-07-13 ｜ **作者**: Senior Developer（高级开发工程师）
> **基准文档**: 本文以三份核心文档为基底，进行整合与升级：
> - 《v9-文档治理修复行动计划.md》(AI 文档治理 Agent, v1.0.0, 2026-07-12)
> - 《文档归类体系结构.md》(DocTaxonomy V9, v1.1.0)
> - 《23-core-docs-final-verification-report.md》(421 文档全扫, 14 缺失 / 5 部分 / 4 已存在)
> **目标**: 将"诊断 + 分类设计 + 行动清单"三份分散文档，整合为**单一可落地的管理体系方案**，并补齐原三份文档缺失的"命名规范 / 版本控制 / 访问权限 / 行业对标"四块。
> **设计铁律**: 单一事实源（Single Source of Truth）。禁止平行同内容文档——所有治理规则只在一处定义，其余文档引用之。

---

## 〇、执行摘要（Executive Summary）

**当前状态（实地核验，环境已回退至数字目录式）**：

| 维度 | 现状 | 严重程度 |
|------|------|----------|
| **分类** | 三套互相矛盾的"分类"并存：①DocTaxonomy 设计稿(A–H) ②`../explanation/a-h-index.md` 幽灵索引（指向 50+ 个**磁盘不存在**的 `A/ B/ C/…` 文件）③物理数字目录（`00-meta`…`07-archive`）。无单一事实源 | 🔴 P0 |
| **命名** | 5 种风格混用：`UPPER_SNAKE`(`directory-structure-guide.md`)、`V9-`前缀中文、`23-core-`数字前缀、`kebab`(`doc-auto-update-kanban.md`)、typo 目录(`standards`→应为 `standards`)。无强制约定 | 🔴 P0 |
| **版本** | Frontmatter 版本散乱：`v1.0.0`/`v1.1.0`/`v2.0.0 rev.1`/`v1.4.3`/`v3.1.0`（宣称）。无"文档版本↔AGENTS.md 版本"绑定机制 | 🟡 P1 |
| **权限** | 本地单用户工具，物理权限=仓库访问（合理）。真正缺口是 **AI 读取分级** 与 **变更权威**（治理文档谁能动） | 🟡 P1 |
| **冗余/混乱** | `00-meta/` 已成 44 文件"治理报告垃圾场"，≥8 份重叠的审计/计划报告（report sprawl）；幽灵索引 + SOP 4 链接全断 | 🔴 P0 |

**根因**：诊断→报告→再诊断的循环从未收敛为"一次性整合落地"。每份新审计都新建文档，而非修订同一份权威文档，导致 `00-meta/` 膨胀、索引失焦、链接断裂。

**本方案动作**：① 确立 `docs/README.md`(顶层入口) + `./governance.md`(宪法) + `directory-structure-guide.md`(目录指南) 三件套为**唯一权威**；② 把 `00-meta/` 的 44 文件**收敛至 5 份权威 + 其余归档**；③ 把幽灵 `../explanation/a-h-index.md` 重写为指向真实文件的映射索引；④ 修 SOP 全部断链 + 2 缺失引用；⑤ 落地命名/版本/权限三套规范，并升级 `audit:doc-integrity` 为**阻断级**以钉死链接完整性。

---

## 一、现状诊断（Current State Diagnosis）

### 1.1 分类体系：三套矛盾，无事实源

| 分类表述 | 载体 | 问题 |
|----------|------|------|
| A–H 八类（设计稿） | `文档归类体系结构.md` v1.1.0 | 纯设计，未落地为物理结构 |
| A–H 索引（幽灵） | `../explanation/a-h-index.md` v1.0.0 | 声称"逻辑层 A–H + 物理层双轨制"，但链接的 `../archive/a-navigation-governance.md`、`../archive/b-architecture-design.md` 等 **50+ 文件磁盘全不存在**（已用 `ls docs/A…docs/H` 实测确认） |
| 物理数字目录 | `00-meta` `01-requirements` `02-design` `03-development` `04-testing` `05-deployment` `06-project-management` `07-archive` | 真实存在，但**与 A–H 无 1:1 映射**（如 `02-design` 同时装架构/舱室/组件/标准；`00-meta` 装治理+体检+垃圾场） |

**结论**：分类停留在"设计稿 + 失效索引"，物理目录自成一套。开发者无法从任一入口稳定定位文档。

### 1.2 命名规范：五风格混用 + typo 目录

| 风格 | 实例 | 问题 |
|------|------|------|
| `UPPER_SNAKE` | `directory-structure-guide.md` `governance.md` | 与全仓 kebab 主流冲突 |
| `V9-` 前缀中文 | `v9-文档治理修复行动计划.md` | 版本号进文件名，违反"版本只在 Frontmatter" |
| 数字前缀 | `23-core-docs-final-verification-report.md` `p5-verification-report.md` | 序号语义模糊，易重复 |
| `kebab` | `doc-auto-update-kanban.md` | 正确方向，但未强制 |
| typo 目录 | `docs/02-design/standards/`（应为 `standards`） | 目录拼写错误，破坏规律 |

### 1.3 版本控制：散乱无绑定

- `governance.md` 无版本字段；`文档归类体系结构.md` v1.1.0；`../explanation/a-h-index.md` v1.0.0；SOP v2.0.0 rev.1；`../../AGENTS.md` v1.4.6；某处 GUIDE 自称 v3.1.0。
- SOP §九 写"本 SOP 版本与 AGENTS.md 版本绑定"——但**无任何脚本/门禁校验该绑定**，纯靠人记，已失效。

### 1.4 访问权限：本地单用户，缺口在"读取分级 + 变更权威"

- **物理权限**：FinSightV9 是本地个人投研工具（`../../AGENTS.md` §十五），仓库访问即全权。无需 OS 级 ACL。
- **真实缺口 ① AI 读取分级**：哪些文档 AI 可自动加载、哪些需人工确认、哪些禁读——当前无定义，AI 全仓瞎找。
- **真实缺口 ② 变更权威**：治理宪法 `governance.md` 谁能改、走什么流程——当前等于"有仓库权限就能改"，无保护。

### 1.5 冗余与混乱：`00-meta/` 治理报告垃圾场

`00-meta/` 现 44 文件，按性质可归为：

| 类别 | 文件 | 处理 |
|------|------|------|
| **权威（应留）** | `governance.md` `directory-structure-guide.md` `registry-index.md` `doc-trigger-action-map.md` `月度文档体检检查清单.md` | **保留** |
| **三核心基底（本文已整合）** | `v9-文档治理修复行动计划.md` `文档归类体系结构.md` `23-core-docs-*-report.md`(`final`/`functional-match`/`v2-final` + json) `23个核心文档重新检索报告.md` | **归档至 `07-archive/`**（已整合进本文） |
| **重叠审计/计划（应归档）** | `DIRECTORY_AUDIT_*` `directory-structure-audit-report.md` `directory-audit-report-v1.4.3.md` `doc-system-check-v9.md` `文档体系体检报告-v9.md` `文档体系修复执行计划-v1.md` `文档理解核查报告.md` `文档管理系统评分报告.md` `执行校验报告.md` `v9-项目健康状态总览.md` `v9-pre-launch-audit-report-20260713.md` | **归档至 `07-archive/`** |
| **FILE-MANAGEMENT 系列（应归档）** | `file-management-guide-cleanup-decisions.md` `../archive/…-file-wandering-report.md` `../archive/…-optimization-prompt.md` `../archive/…-RCA-report.md` `../archive/…-task-list.md` | **归档至 `07-archive/`**（与本方案重复） |
| **本人此前诊断产出（应归档）** | `directory-audit-feasibility-plan.md` `directory-audit-todo.md` | **归档至 `07-archive/`** |
| **零散** | `cleanup-schedule.md` `migration-plan.md` `v9-next-phase-todo.md` `prompt-execute-remediation.md` `prompt-merge-dedup.md` `p5-verification-report.md` `outputs-and-undefined-src-evaluation-report.md` `src-directories-evaluation-report.md` `trae-file-management-review.md` `changelog-warnings-handling-strategy.md` `deprecated-docs/` `ai-index/` | 评估后归档/并入既有 |

> **核心治理原则**：以上重叠报告全部源于"未收敛的审计循环"。本文落地后，`00-meta/` 只应剩 **5 份权威文件**，其余一律进 `07-archive/`。

### 1.6 链接完整性：SOP 锚点自己断链

`../reference/development-workflow-sop.md`（用户指定的"所有文件整理规则依赖此"的锚点）现位于 `docs/02-design/standards/`，其 L6 四个关联链接**全部错位**：

| SOP 原链接 | 解析目标（错） | 真实位置 |
|--------------|--------------|--------------|
| `../../AGENTS.md` | `../../AGENTS.md` | 根 `../../AGENTS.md`（需 `../../AGENTS.md`） |
| `../../AGENTS.md` | 根 `../../AGENTS.md` | 根 `../../AGENTS.md` |
| `./governance.md` | `./governance.md` | `docs/00-meta/governance.md`（需 `./governance.md`） |
| `../explanation/architecture.md` | `../explanation/architecture.md` | `../explanation/architecture.md` |
| `../../../../CHANGELOG.md` | `../reference/CHANGELOG.md` | 根 `../../CHANGELOG.md` |

另引用 `../explanation/task-graph-template.md`（实际在 `../reference/templates/task-graph-template.md`）、`../reference/06-routing-specs.md`（实际在 `../explanation/design/06-routing-specs.md`）**均路径错位**。

**讽刺点**：SOP §4.1 已把 `audit:doc-integrity` 列为 Husky 步骤，但其描述为"文档-代码双向完整性（npm scripts / 脚本文件 / 路径存在性）"——**只查脚本/代码路径，不查 `.md` 内部相对链接**，故 SOP 自身断链未被捕获。这正是"文档滞后于目录"的活样本。

---

## 二、对标行业最佳实践（Benchmark）

对标成熟 APP 开发企业（Diátaxis 四型文档、arc42 架构模板、ADR 决策记录、Docs-as-Code、Quality Gates），映射到用户要求的四维度：

| 维度 | 成熟企业实践 | 本项目目标达标 | 差距 / 动作 |
|------|--------------|------------------|--------------|
| **协作效率** | 单一顶层入口 + 稳定分类检索 + 模板化 | `docs/README.md`(新) + 修正后的 `../explanation/a-h-index.md` 真实映射 + 模板 | 补 README + 修幽灵索引 + 建模板 |
| **安全性** | 最小权限 + 审计轨迹 + 变更受控 | 仓库访问(单用户合理) + Husky 门禁链 + 变更日志(`changelogs/`) + **AI 读取分级 T0/T1/T2** | 补 AI 读取分级；治理文档变更升 PR + 门禁 |
| **可追溯性** | 语义版本 + 版本绑定 + 决策记录(ADR) + 变更日志 | Frontmatter `version` + **文档版本↔AGENTS.md 主版本绑定** + `changelogs/` + `adr/` | 落地版本绑定（脚本校验）；补 ADR 主索引 |
| **可扩展性** | 自动索引 + 门禁守护 + 物理/逻辑分离 | `registry-index.md`(自动) + `audit:*` 门禁链 + 物理数字桶(稳定)↔逻辑 A–H(索引) | 升 `audit:doc-integrity` 为**阻断**以钉死链接 |

> **核心判断**：本项目的"安全性/可追溯性"短板，不是缺 OS 级 ACL（本地单用户无需），而是缺 **AI 读取分级** 与 **版本绑定机制**。补这两点即达专业水准。

---

## 三、目标体系设计（Target System Design）

### 3.1 目录结构设计（核心交付物）

**设计决策**：保留"物理数字桶"为**稳定存储层**（避免再次大迁移引发断链），在其上建立"逻辑 A–H"为**索引视角**。二者通过**一份真实映射索引**连接，杜绝幽灵索引。

**目标物理结构**：

```
docs/
├── README.md                    ← 【NEW, A1】顶层入口：八类导航 + 本方案链接 + AI 加载提示
├── 00-meta/                   ← 【A1 导航与治理】收敛为 5 份权威
│   ├── governance.md                 ★ 文档治理宪法（唯一权威，含保鲜/DoD/权限）
│   ├── directory-structure-guide.md  ★ 目录结构指南（rename 自 UPPER_SNAKE）
│   ├── registry-index.md            ★ 自动生成的文档链接导航
│   ├── doc-trigger-action-map.md    ★ 触发事件→更新动作 1:1 单一事实源
│   └── monthly-doc-health-checklist.md ★ 月度体检清单
├── 01-requirements/            ← 【A2 需求规格】KEEP
├── 02-design/                 ← 【B 架构 + C 功能 + D 技术规范】主桶
│   ├── architecture/           ← B1–B3（overview/cabins/subsystems/adr）
│   ├── cabins/ components/ cockpit/ store/ services/ data-layer/  ← C1–C7
│   ├── standards/             ← D1–D5（rename standands→standards）
│   └── ai/                  ← F3 记忆层
├── 03-development/           ← 【F2 检查表 + H3 指南】rename 拼写
│   ├── checklists/  guides/  plugins/  migration/
├── 04-testing/              ← 【E1–E4】rename testing→testing
├── 05-deployment/           ← 【B5 + H2】
├── 06-project-management/     ← 【G2 变更日志 + 项目】
├── 07-archive/              ← 【归档】DEPRECATED + 历史治理报告（含本文整合掉的 8+ 份）
├── reports/                  ← 【G1 自动产物】_generated/ 子目录 .gitignore
├── assets/                   ← 图片等二进制
├── prompts/                  ← 【F1 提示词模板】
└── a-h-index.md             ← 【修正】指向 REAL 文件的 A–H 映射（非幽灵）
```

**映射关系（A–H ↔ 物理桶，写入修正后的 `../explanation/a-h-index.md`）**：

| 逻辑类 | 物理落点 | 说明 |
|--------|----------|------|
| A 导航与治理 | `00-meta/` + `../../README.md` | 宪法/索引/体检 |
| B 架构设计 | `02-design/architecture/` `05-deployment/` | overview/子系统/ADR/发布 |
| C 功能模块 | `02-design/{cabins,components,cockpit,store,services,data-layer}/` `standards/` | 舱室/组件/Widget/Store/Service/数据层 |
| D 技术规范 | `02-design/standards/` `03-development/migration/` | 编码/令牌/门禁/文档/JSDoc/迁移 |
| E 测试策略 | `04-testing/` | 分层/用例/报告/门禁 |
| F AI 工程 | `prompts/` `03-development/checklists/` `02-design/ai/` | 提示词/检查表/记忆层 |
| G 过程产物 | `reports/` `06-project-management/changelogs/` | 审计/变更/复盘 |
| H 跨域补充 | `03-development/guides/` `05-deployment/ops/` | 安全/运维/教程/无障碍 |

### 3.2 命名规范（Naming Convention）

**强制规则（写入 `governance.md` §命名）**：

1. **文件名 kebab-case，ASCII 安全**：全小写 + 连字符。例：`doc-file-management-optimization-plan.md`。
2. **禁止**：`UPPER_SNAKE`（`DIRECTORY_STRUCTURE_GUIDE`→`directory-structure-guide`）、`V9-`/`23-`/`P5-` 等版本/序号前缀进文件名、中文文件名（标题放 Frontmatter）、目录 typo（`standards`≠`standards`）。
3. **版本只在 Frontmatter**：文件名零版本号；版本见下文 3.3。
4. **目录拼写校对**：新增目录须经拼写检查（禁用 `standands`/`developmet` 类 typo）。
5. **过渡处理**：既有 `UPPER_SNAKE` 治理文件（GUIDE/GOVERNANCE）在本文落地时一并 rename；大量历史文档允许保留原名但**禁止新增**违规命名。

### 3.3 版本控制（Version Control）

**强制规则（写入 `governance.md` §版本）**：

1. **语义版本 Frontmatter**：每份治理/规范文档头部含：
   ```yaml
   ---
   title: "..."
   version: "1.0.0"        # 语义版本
   updated: "2026-07-13"     # ISO 日期
   ---
   ```
2. **文档版本 ↔ ../../AGENTS.md 主版本绑定**：文档 `version` 的 **MAJOR** 必须与 `../../AGENTS.md` 的 MAJOR 对齐（如 AGENTS v1.x → 治理文档 v1.x）。AGENTS 升主版本时，所有引用它的治理文档须同步升主版本。
3. **门禁校验**：`doc:version-check`（已存在）校验 ① Frontmatter `version` 字段存在 ② 主版本与 AGENTS.md 一致。Husky `audit:docs` 已覆盖同步，追加 `doc:version-check` 为**阻断**。
4. **禁止裸版本号**：任何文档内部引用其他文档版本时，须引用其 Frontmatter 版本，不得硬编码于正文导致漂移。

### 3.4 访问权限模型（Access / Permission Model）

针对本地单用户工具，重新定义"权限"为两层：

**① AI 读取分级（Tier）** — 写入 `governance.md` §AI读取权限：

| Tier | 含义 | 文档范围 | AI 行为 |
|------|------|----------|---------|
| **T0 自动加载** | 每次会话必载 | `../../AGENTS.md`(根) `governance.md` `directory-structure-guide.md` `docs/README.md` | 无需询问，直接注入上下文 |
| **T1 按需加载** | AI 查询时载 | 各 `*spec.md`/`*-checklist.md`/`standards/*`/`adr/*` | 用户问及对应主题时加载 |
| **T2 禁自动加载** | 需人工确认 | 含个人数据/密钥的文档（本项目基本无，留接口） | 加载前必须显式征求用户同意 |

**② 变更权威（Change Authority）** — 写入 `governance.md` §变更：

- 治理三件套（`GOVERNANCE`/`DIRECTORY_STRUCTURE_GUIDE`/`README`）的变更**须经 PR + Husky 全量门禁**（`audit:doc-integrity` 升阻断 + `audit:docs` + `file:check`），禁止随意直改。
- 所有文档变更记入 `06-project-management/changelogs/YYYY-MM/`，形成可追溯轨迹。
- 对标企业"最小权限 + 审计轨迹"：本项目的等价实现 = **门禁链 + 变更日志 + AI 读取分级**，非 OS ACL。

---

## 四、管理流程（Management Flow）

### 4.1 新增文档 Intake 流程

```
新建文档 → ① 落位（按 §3.1 映射选物理桶）
         → ② 加 Frontmatter（title/version/updated，见 §3.3）
         → ③ 登记 a-h-index.md（真实路径，非幽灵）
         → ④ 若属治理文档：跑 doc:version-check
         → ⑤ 若被 AI 需自动加载：在 GOVERNANCE §AI读取权限 标 Tier
```

### 4.2 代码变更 → 文档同步（复用既有触发地图）

沿用 `doc-trigger-action-map.md`（`TRIGGER_RULES` T1–T10）与 `--auto-update` 机制：

| 代码变更类型 | 必须同步的文档 | 校验命令 |
|--------------|------------------|----------|
| 类型/Interface 变更 | 数据字典 / API 契约 | `audit:docs` |
| 路由变更 | `02-design/architecture/subsystems/` 路由 specs | `audit:docs` |
| 架构变更 | `../../AGENTS.md` / ADR | `audit:docs` + `doc:version-check` |
| 治理文档变更 | 所有引用它的文档 | `audit:doc-integrity`（**升阻断**） |

### 4.3 月度体检 + 门禁联动

- **月度**：`npm run doc:freshness` 生成保鲜度评分 + 人工复核 `00-meta/` 是否重新膨胀（防 report sprawl 复发）。
- **Husky pre-commit**（§4.1 既有 15 步 + 本方案升级）：
  - `audit:doc-integrity`：**由 ⚠️ warn 升 ✅ 阻断**，且扩展其扫描范围——从"npm scripts / 代码路径"**增补 `.md` 内部相对链接可达性检查**（直接根治 SOP 断链类问题）。
  - `doc:version-check`：新增为阻断，校验 Frontmatter 版本 + 主版本绑定。

### 4.4 归档与清理（Retention）

| 类型 | 保留期 | 落点 |
|------|--------|------|
| G1 自动产物（`reports/` JSON/HTML） | 30 天 | `reports/_generated/`（`.gitignore`） |
| DEPRECATED 文档 | 6 月后删 | `07-archive/` |
| 历史治理报告（含本文整合掉的重叠报告） | 永久归档 | `07-archive/governance-history/` |
| drafts 草稿 | 7 天 | `07-archive/drafts/` |

---

## 五、关键规范定义（Key Spec Definitions）

> 以下为本方案确立的**唯一权威规范条目**，全部写入 `governance.md`，其余文档引用之（单一事实源）。

| 编号 | 规范 | 定义 |
|------|------|------|
| S1 | 权威三件套 | `governance.md`(宪法) + `directory-structure-guide.md`(目录) + `docs/README.md`(入口) 为唯一权威，禁止平行同内容文档 |
| S2 | 命名 | 文件名 kebab-case / ASCII 安全 / 零版本号 / 禁 typo 目录 |
| S3 | 版本 | Frontmatter 语义版本 + MAJOR 绑定 AGENTS.md + `doc:version-check` 校验 |
| S4 | 分类 | 物理数字桶(稳定) ↔ 逻辑 A–H(索引) 双轨，经真实映射索引连接 |
| S5 | AI 读取分级 | T0 自动 / T1 按需 / T2 禁自动（写入 GOVERNANCE §） |
| S6 | 变更权威 | 治理三件套变更须 PR + Husky 全门禁 + 变更日志 |
| S7 | 链接完整性 | 所有 `.md` 相对链接须可达；`audit:doc-integrity`(阻断) 钉死 |
| S8 | 防 sprawl | `00-meta/` 只留 5 份权威；新增审计须修订既有文档，禁新建平行报告 |

---

## 六、执行路线图（Execution Roadmap）

| 阶段 | 范围 | 关键动作 | 出口标准 |
|------|------|----------|----------|
| **P0（本周）** | 止血 | ① 建 `docs/README.md` ② 修 SOP 4 断链 + 2 缺失引用 ③ 重写 `../explanation/a-h-index.md` 为真实映射 ④ rename `standards`/`testing` typo ⑤ 收敛 `00-meta/` 至 5 权威 + 其余归档 | SOP 0 断链；`00-meta/` ≤5 文件；索引全可达 |
| **P1（2 周）** | 规范落地 | ⑥ `governance.md` 补 §命名/§版本/§AI读取/§变更 ⑦ 升 `audit:doc-integrity` 阻断 + 扩链接扫描 ⑧ 接 `doc:version-check` 阻断 ⑨ Frontmatter 版本回填既有文档 | 命名/版本/权限规范生效；门禁钉死 |
| **P2（1 月）** | 长效 | ⑩ 建文档模板(`templates/`) ⑪ ADR 主索引 ⑫ 月度体检防 sprawl 机制固化 | 可追溯性/可扩展性达标 |

**关键路径**：P0-①(README) 与 P0-②(SOP 断链) 是最高优先——前者是所有检索的入口，后者是你点名的锚点文档自身断裂，不修则任何"体系"都是空中楼阁。

---

## 七、本方案与三份核心文档的关系

| 核心文档 | 本方案处理 |
|----------|------------|
| 《v9-文档治理修复行动计划.md》 | **已整合**：其 P0–P2 行动项并入本文 §六路线图；原文件归档 `07-archive/` |
| 《文档归类体系结构.md》(DocTaxonomy) | **已升级**：A–H 八类设计稿落地为 §3.1 真实映射 + §3.4 权限补充；原文件归档 |
| 《23-core-docs-final-verification-report.md》 | **已吸收**：14 缺失文档清单并入 §六 P0–P2 补齐项；原 4 份变体报告归档 |

> **一句话**：三份核心文档是"诊断 + 设计 + 清单"，本文是"整合后的单一可落地方案"。落地后三份基底文档归档，避免平行同内容文档——严格遵守项目"单一事实源"铁律。

---

> **交付说明**：本文为文档与文件管理体系优化方案 v1.0.0，落地时须同步：① 修 SOP 断链 ② 重写 A-H-INDEX ③ 收敛 00-meta ④ 升 audit:doc-integrity 阻断。任何一步遗漏都会让"体系"重新沦为又一份无人执行的报告。
