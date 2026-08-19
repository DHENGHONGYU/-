---
spec_version: v1.0.0
spec_date: 2026-08-19
code_version: 2.0.0-rc.1
architect: V9 Architecture Team
status: draft
phase: Specify
---

# 规范：系统上线前测试调整 · 全阶段标准化操作文档体系（SOP Suite）

## 一、问题定义（Problem）

### 1.1 背景与痛点

FinSightV9 项目已积累大量零散的规范文档（质量门禁、Git 提交治理、审计脚本指南、模块完成标准等），但存在以下问题：

| # | 痛点 | 具体表现 | 影响范围 |
|---|------|---------|---------|
| P1 | **阶段断裂**：文档按功能域零散分布，未按开发全生命周期（SDLC）串联 | 新成员无法按"入职→开发→提交→审查→合并→上线→运维"的时间线找到对应操作指南 | 团队新成员上手周期长（≥3 天） |
| P2 | **重复造轮子**：同一主题在多处文档有不一致的描述 | 质量门禁同时出现在 `09-quality-gates.md`（内容过时）、`standards/quality-gates.md`（仅重定向）、`AGENTS.md §七`三处，且阈值与命令不一致 | 开发人员不知道以哪份为准 |
| P3 | **"如何做"缺失**：现有文档多为"定义是什么"，缺少"按什么步骤做"、"每步的通过标准"、"失败怎么修复" | `09-quality-gates.md` 只列了 13 项门禁名和目标值，但没有逐步操作步骤、输出示例、常见失败的修复路径 | 新成员遇到门禁失败需反复问老成员 |
| P4 | **上线前流程无标准**：缺少一份"上线前全面体检 SOP"，把真数测试、全量审计、构建验证、回滚预案等串成可执行清单 | 现有 `上线前全面校验报告-v2.0.0.md` 只是一次历史校验的**结果报告**，不是可复用的**操作流程** | 每次上线靠经验记忆，容易漏项 |
| P5 | **文档双向引用不完整**：新 SOP 需要在文档索引（`REGISTRY_INDEX.md`）和架构契约（`AGENTS.md`）中注册并双向引用 | 现有部分 how-to 文档未在 meta 索引中登记、未被 AGENTS.md 引用 | 文档孤岛化，搜索不到 |

### 1.2 目标用户（Users）

| 角色 | 文档使用场景 | 核心需求 |
|------|------------|---------|
| **新开发人员** | 入职后按 SOP 搭建环境、完成第一个提交 | 清晰的步骤、通过/失败判定、修复路径 |
| **资深开发人员** | 上线前组织体检、版本发布、回滚演练 | 完整的检查清单、证据采集模板、异常处理分支 |
| **代码审查者** | 按标准 CR 流程审查 PR | 可核对的检查项、严重度分级标准、不合格模板 |
| **QA / 测试** | 执行集成测试、E2E、真数测试 | 测试数据要求、环境配置步骤、报告归档规范 |
| **架构师 / 发布经理** | 版本质量最终把关 | 综合评分模板、P0/P1/P2 判定标准、上线 Go/No-Go 决策框架 |

### 1.3 目标（Goals）

1. **体系化**：按 SDLC 7 个阶段组织 SOP，形成闭环时间线（入职→开发→提交→审查→合并→上线→运维）。
2. **可操作**：每篇 SOP 必须包含「前置条件 → 操作步骤 → 通过标准 → 失败修复 → 证据模板」五段式结构。
3. **复用现有**：绝不重写已有成熟文档（`git-commit-governance.md`、`how-to-use-audit-scripts.md`、`testing-strategy.md` 等），改为在 SOP 中引用并补充缺失的操作步骤和修复路径。
4. **双向引用**：所有新文档必须在 `REGISTRY_INDEX.md` 中注册、在 `AGENTS.md` 中添加引用、被对应阶段文档交叉链接。
5. **上线前可用**：优先完成阶段 4（合并前集成测试）、阶段 5（上线前全面体检）、阶段 6（版本发布与部署）的 SOP，确保当前 2.0.0-rc.1 → 2.0.0 正式版的上线流程有标准可依。

### 1.4 非目标（Non-Goals）

- ❌ 不修改代码逻辑、不修复任何 bug 或测试失败。
- ❌ 不重写 `AGENTS.md` 架构契约，仅在合适位置追加 SOP 引用索引。
- ❌ 不创建新的审计脚本或质量门禁命令，仅梳理和文档化现有命令的使用流程。
- ❌ 不编写产品功能规格说明、不设计新功能。
- ❌ 不覆盖 30+ 专项 how-to 文档（如颜色令牌、Widget 开发等），仅在对应阶段 SOP 中做索引链接。

---

## 二、功能需求（Functional Requirements）

### 2.1 SOP 文档体系结构（FR-1）

必须创建 7 篇标准化操作文档，对应 SDLC 的 7 个连续阶段。文档统一存放在 `docs/guides/sops/` 目录下，文件名采用 `SXX-阶段名.md` 格式（S01-S07）。

| 编号 | SOP 文档 | 对应阶段 | 核心内容 | 优先级 |
|------|---------|---------|---------|:---:|
| S01 | `S01-dev-env-setup.md` | 阶段 1：开发环境搭建与准备 | Node 版本、Python venv、npm 依赖、Vite 代理、Husky 钩子安装、首次环境验证步骤 | P1 |
| S02 | `S02-daily-development.md` | 阶段 2：日常开发与代码提交 | 分支策略、模块完成标准（DoD）、十域同步清单、提交前预检（Gate:dev）、Git 提交规范（含 --only 使用） | P1 |
| S03 | `S03-code-review.md` | 阶段 3：代码审查 | CR 检查项（架构/安全/质量三维）、严重度分级、不合格模板、Reviewer/Author 分工、时间 SLAs | P1 |
| S04 | `S04-pre-merge-integration.md` | 阶段 4：合并前集成测试 | Gate:quick 运行、可信单元测试（test:stable）、集成测试套件、类型双检（tsc:prod + tsc:test）、Mock 残留审计 | **P0** |
| S05 | `S05-pre-launch-checklist.md` | 阶段 5：上线前全面体检 | 20 步强制门禁 + 真数测试要求 + RAG 幻觉门禁 + 复杂度不增 + 生产构建验证 + AGENTS 契约一致性 + 综合评分模板 | **P0** |
| S06 | `S06-release-deployment.md` | 阶段 6：版本发布与部署 | 版本号规则、CHANGELOG 生成、Git Tag 规范、构建产物校验、Windows 部署清单、回滚预案演练 | **P0** |
| S07 | `S07-post-launch-ops.md` | 阶段 7：上线后运维与应急 | 健康监控指标、告警处理、用户反馈闭环、问题排查路径（How-to-troubleshooting 索引）、热修复流程 | P1 |

### 2.2 每篇 SOP 的五段式标准结构（FR-2）

每篇 SOP 必须严格包含以下 5 个标准章节（缺一不可）：

1. **前置条件**：列出执行本 SOP 前必须满足的环境、权限、数据要求。
2. **操作步骤**：按编号列出逐步执行的命令和操作。每条命令必须与 `package.json` 中实际脚本名或 `AGENTS.md` 定义完全一致。
3. **通过标准**：每条步骤的 pass/fail 判定依据。对于输出数字的命令（如 tsc、audit），必须写明阈值。
4. **常见失败与修复**：列出 Top 5 最常见的失败场景、根因、修复命令。引用对应 SKILL（如 tsc-gate-scope-audit、doc-encoding-remediation）。
5. **证据与归档**：要求产出的截图、日志、报告文件路径，以及归档目录规范。

### 2.3 现有文档的体系化引用与补充（FR-3）

新建 SOP 不得重复造轮子。必须按以下映射复用已有文档，并补充缺失的操作段：

| 已有文档 | 在哪些 SOP 中引用 | 需补充的内容 |
|---------|------------------|------------|
| `git-commit-governance.md` | S02 §3 Git 提交规范 | 补充"十域同步检查清单"（来自 module-sync-checklist SKILL）与 `git commit --only` 实操示例 |
| `how-to-use-audit-scripts.md` | S04 §2 Gate:quick；S05 §3 全量审计 | 补充各审计脚本失败时的 Top 3 修复命令示例（当前文档只有命令说明，没有失败修复路径） |
| `testing-strategy.md` | S04 §3 单元/集成测试；S05 §4 真数测试 | 补充"**上线前禁止 MOCK，必须真数**"的强制条款（来自 AGENTS.md v1.6.0），并列出真数测试数据要求 |
| `09-quality-gates.md` | S05 §2 P0 门禁 | 更新过时的阈值数据（如"38 failed"等），替换为当前 AGENTS.md v1.6.0 的 22 步门禁定义，增加综合评分计算模板 |
| `module-completion-standard.md` | S02 §2 模块完成标准 | 补充"孤岛模块检测命令"（`npm run audit:deadcode` + `npm run audit:routes` 的实操步骤） |
| `how-to-troubleshooting.md` | S07 §4 问题排查 | 补充"告警分级响应 SLA"与"热修复分支策略" |
| `DEPLOYMENT-CHECKLIST-2026-08-14.md` | S06 §4 专项检查清单 | 抽象为通用部署检查模板，保留 NaN 防护等专项检查作为"功能专项附录"模式 |
| `上线前全面校验报告-v2.0.0.md` | S05 §5 综合评分 | 抽取其评分维度与权重作为通用模板，将具体数值替换为占位符和计算方法 |

### 2.4 文档注册与双向引用（FR-4）

- **FR-4.1**：7 篇 SOP 必须在 `docs/meta/REGISTRY_INDEX.md` 中注册，分配唯一 `doc_id`（按 `V9-DOC-SOP-001` 至 `V9-DOC-SOP-007` 序列），填写 frontmatter 所有必填字段（title/type/domain/tier/status/maintainer/summary/tags/version/last_updated/code_version/doc_id/related_docs/referenced_by/change_log）。
- **FR-4.2**：`AGENTS.md` 必须追加「§十七 SOP 体系索引」章节，列出 7 篇 SOP 的标题、路径、一句话用途的索引表。
- **FR-4.3**：每篇 SOP 的 `related_docs` 字段必须引用所复用的已有文档 doc_id；被引用的已有文档如存在 `referenced_by` 字段则追加对应 SOP 的 doc_id。
- **FR-4.4**：`docs/guides/how-to/README.md` 必须在导航区新增「SOP 体系」子索引块，按阶段链接 S01-S07。
- **FR-4.5**：`docs/meta/README.md` 必须在 Meta 索引的「标准操作流程」分类下登记 7 篇 SOP。

### 2.5 S05 上线前全面体检的真数测试强制条款（FR-5）

针对 AGENTS.md v1.6.0 新增的"**上线前测试禁止 MOCK，必须真数**"硬约束，S05 必须包含：

- 真数测试环境启动命令：Python AkShare 服务（`uvicorn collect_endpoints:app --host 0.0.0.0 --port 8000 --reload`）与 Vite 前端（`npm run dev`）的联动启动步骤。
- 真数校验清单：至少 25 只真实股票（沪深港美 + ETF）的采集链路验证，引用 `npm run test:e2e-verify` 命令。
- Mock 残留清扫命令：`npm run audit:mock-modules` 必须作为 BLOCK 级门禁。
- 数据质量断言：`validate:dataConsistency`、`validate:blueprint` 必须通过。

### 2.6 S05 与 S06 的综合评分与 Go/No-Go 决策框架（FR-6）

- S05 必须包含「P0/P1/P2 分级验收标准」表格。P0 = BLOCK（不通过不允许上线）；P1 = WARNING（允许上线，但必须在 CHANGELOG 中登记遗留项并排期修复）；P2 = INFO（允许上线，排入常规迭代）。
- S05 必须包含「综合评分计算模板」：6 维度加权（文档15% + 架构20% + 数据链20% + UI15% + UX15% + 测试15%），≥90 = 绿（可上线），80-89 = 黄（需审批），<80 = 红（禁止上线）。
- S06 必须包含「上线决策会议模板」：参会人、各项检查确认签字、Go/No-Go 结论、If-No-Go 的回滚命令。

---

## 三、非功能需求（Non-Functional Requirements）

### NFR-1：准确性（Accuracy）

**类型**：rule
- SOP 中引用的每一条 `npm run xxx` 命令必须在当前 `package.json` 中真实存在且拼写一致（可通过 `npm run` 验证）。
- SOP 中引用的每一条规则必须与 `AGENTS.md` v1.6.0 的定义一致（可通过 grep 比对）。
- SOP 中列出的通过标准阈值不得低于 AGENTS.md 和质量门禁的硬性阈值。

### NFR-2：可执行性（Actionability）

**类型**：rubric
- 维度：每篇 SOP 的「步骤明确度 + 失败修复覆盖度」
- 量表：0-2
  - 2 = 每步都有具体命令 + Top 3 失败场景有修复命令 + 有通过/失败的明确输出示例
  - 1 = 有步骤和命令，但缺少失败修复场景或输出示例
  - 0 = 只有原则性描述，缺少可直接复制执行的命令
- 通过阈值：≥ 1.5（7 篇平均）

### NFR-3：双向引用完整性（Link Integrity）

**类型**：rule
- 7 篇 SOP 的 `doc_id` 必须全部出现在 `REGISTRY_INDEX.md` 中。
- `AGENTS.md` 的 SOP 索引章节必须列出 7 篇 SOP 的完整路径。
- 每篇 SOP 至少有 2 个 `related_docs` 引用，且被引用文档存在。
- `npm run audit:docs` 运行后无 SOP 相关的 inconsistency 告警。

### NFR-4：不重复造轮子（No Duplication）

**类型**：rule
- 禁止在 SOP 中逐字复制已有文档的完整章节（超过 50 字的段落应使用引用链接）。
- 允许的内容：已有文档缺失的操作步骤、通过标准阈值、失败修复命令、证据模板。
- 引用格式：`参见 [文档标题](相对路径) §章节号`，并在 SOP 开头列出「参考文档清单」。

### NFR-5：版本一致性（Version Alignment）

**类型**：rule
- 每篇 SOP 的 frontmatter 必须声明：
  - `code_version: "2.0.0-rc.1"`（与 AGENTS.md v1.6.0 的 code_version 一致）
  - `version: v1.0.0`（SOP 自身初始版本）
  - `last_updated: 2026-08-19`（创建日期）
  - `change_log` 首条记录为 `v1.0.0 / 2026-08-19 / Initial version`
- 所有 SOP 引用的文档版本号必须与被引用文档头部声明的版本号一致。

### NFR-6：团队可用性（Team Readiness）

**类型**：rubric
- 维度：新成员按 S01-S03 完成首次提交的无障碍度
- 量表：0-2
  - 2 = 新成员无需询问任何人，按文档即可完成环境搭建 + 首次提交（模拟评审通过）
  - 1 = 基本可独立完成，但 1-2 处需询问老成员（文档有歧义或缺步骤）
  - 0 = 多处缺失，必须依赖老成员口口相传
- 通过阈值：≥ 1.5

---

## 四、约束、依赖与假设

### 4.1 约束（Constraints）

| C | 约束内容 | 影响范围 |
|---|---------|---------|
| C1 | **禁止修改代码**：本 Spec 仅涉及文档编写，不得修改 `src/`、`tests/`、`scripts/` 下的任何代码文件。 | 全任务 |
| C2 | **禁止降低阈值**：SOP 中定义的通过标准不得低于 AGENTS.md v1.6.0、Husky 22 步门禁、质量门禁的现有硬性阈值。 | S04/S05 |
| C3 | **禁止绕过门禁**：不得在 SOP 中提供任何"跳出门禁的捷径"（除非标记为 EMERGENCY 且附带审批流程）。 | 全部 SOP |
| C4 | **纯文档改动也受门禁约束**：SOP 文档的提交本身必须通过 pre-commit 的文档门禁（doc:gate、audit:doc-id、audit:docs）。 | 提交流程 |
| C5 | **禁止 MOCK 测试声明**：S05 上线前体检必须使用真实数据，不得提供使用 MOCK 的"快速模式"。 | S05 |

### 4.2 依赖（Dependencies）

| # | 依赖项 | 类型 | 说明 |
|---|--------|------|------|
| D1 | `AGENTS.md` v1.6.0 | 已存在 | 架构契约真相源，所有规则必须与之对齐 |
| D2 | `package.json` scripts 段 | 已存在 | 所有命令名的真相源 |
| D3 | `.husky/pre-commit`（22步） + `.husky/pre-push`（6步） | 已存在 | S02/S04/S05 门禁步骤的真相源 |
| D4 | 现有 7 类零散文档（见 FR-3 映射表） | 已存在 | SOP 通过引用复用，避免重复 |
| D5 | `docs/meta/REGISTRY_INDEX.md` 注册体系 | 已存在 | SOP doc_id 分配与注册的框架 |

### 4.3 假设（Assumptions）

| A | 假设内容 | 若不成立的处理 |
|---|---------|--------------|
| A1 | 当前 `package.json` 中的脚本名（`gate:dev`、`audit:layers`、`tsc:prod` 等）在上线前不会改名。 | 如果改名，同步修改 SOP 中的命令引用。 |
| A2 | `REGISTRY_INDEX.md` 的 doc_id 序列 `V9-DOC-SOP-001`~`V9-DOC-SOP-007` 当前未被占用。 | 写入前先用 `npm run audit:doc-id --changed-only` 校验冲突，如冲突则顺延编号。 |
| A3 | SOP 编写完成后，现有 CI 的文档门禁（`audit:docs`、`audit:doc-id-reverse`）不会报新的违规。 | 若出现违规，按 FR-4 要求在 Implement 阶段即时修复。 |

---

## 五、开放问题（Open Questions）

> 待用户确认。以下问题不影响当前 Spec 推进，可在 Implement 阶段按默认方案执行，如有调整则在 Implement 中更新。

| # | 问题 | 建议默认方案 | 影响 |
|---|------|------------|------|
| Q1 | SOP 文档的存放目录：`docs/guides/sops/`（新子目录）vs `docs/guides/how-to/`（已有目录） | 采用 `docs/guides/sops/` 新子目录，与 how-to 平级。SOP 是跨 how-to 的流程编排，不属于单一操作指南。 | 文档组织结构 |
| Q2 | S01 开发环境搭建是否需要包含 Python venv + AkShare 服务的完整安装步骤？ | 需要。因为真数测试强依赖 AkShare，且环境问题是新成员 Top 1 痛点。附 Windows + macOS 双平台命令。 | S01 篇幅 |
| Q3 | 是否需要为 SOP 创建一个「总览入口页」（`S00-sop-overview.md`），展示 7 阶段流程图和快速跳转？ | 建议创建。总览页 + 7 阶段文档 = 8 篇。总览页放在 `docs/guides/sops/README.md`，作为目录索引。 | 工作量增加 ~1 篇 |
| Q4 | S06 版本发布是否需要集成 Electron 打包（`dist-electron/`）的步骤？ | 建议集成。V9 是 Electron 桌面应用，发布流程必须包含桌面端构建验证。 | S06 增加 1 节 |

---

## 六、验收标准（Acceptance Criteria）

### Rule 类（客观可验证 = Pass/Fail）

| # | AC 编号 | 验收条件 | 验证方式 |
|---|--------|---------|---------|
| R1 | AC-FR1 | `docs/guides/sops/` 目录下存在 7（或 8，含总览）篇 SOP 文件，命名符合 `SXX-*.md` 规范。 | `Glob` 扫描目录 |
| R2 | AC-FR2 | 每篇 SOP 都包含「前置条件 / 操作步骤 / 通过标准 / 常见失败与修复 / 证据与归档」5 个标准章节标题。 | Grep 每篇文档的 5 个章节正则。 |
| R3 | AC-FR3-1 | SOP 中引用的每一条 `npm run <cmd>` 在 `package.json` scripts 中真实存在。 | 编写 JS 脚本：提取 SOP 中的命令，在 package.json scripts 中逐一验证。 |
| R4 | AC-FR3-2 | 引用的已有文档路径真实存在，且链接格式为 Markdown 相对路径。 | 运行 `npm run audit:docs` → 无 broken link。 |
| R5 | AC-FR4-1 | 7 篇 SOP 的 frontmatter 都有唯一 doc_id（`V9-DOC-SOP-001`~`007`）。 | 运行 `npm run audit:doc-id-reverse --changed-only` → 无 blocking 违规。 |
| R6 | AC-FR4-2 | `AGENTS.md` 存在「§十七 SOP 体系索引」章节，列出 7 篇 SOP。 | Grep `AGENTS.md` 中的章节标题和 7 个路径。 |
| R7 | AC-FR4-3 | `docs/guides/how-to/README.md` 存在「SOP 体系」索引块。 | Grep README.md 中的块标题。 |
| R8 | AC-FR5 | S05 包含「真数测试」独立章节，且明确写了禁止 MOCK、AkShare 启动命令、25+ 股票校验清单。 | 读取 S05 全文检查章节存在性 + 关键词命中（`禁止 MOCK` / `uvicorn collect_endpoints` / `25`）。 |
| R9 | AC-FR6-1 | S05 包含 P0/P1/P2 三级分级表，P0 项 ≥ 10 个。 | 读取 S05 §分级表格并计数 P0 行。 |
| R10 | AC-FR6-2 | S05 包含 6 维度加权评分模板（文档/架构/数据链/UI/UX/测试）和计算公式。 | 读取 S05 §评分模板，验证 6 维度 + 权重（总和 100%）。 |
| R11 | AC-NFR3 | `npm run audit:docs` 运行后无 SOP 文档相关的 inconsistency 告警。 | 实际运行命令并筛选输出。 |
| R12 | AC-C1（约束） | 本次变更不包含 `src/`、`tests/`、`scripts/` 目录下的任何代码文件修改（允许 `scripts/docs-tool/` 与 `scripts/audit/` 相关但仅限 doc-id 注册辅助脚本的配置变动，不涉及代码逻辑）。 | `git diff --name-only` → 统计并确认非文档路径。 |
| R13 | AC-NFR5 | 每篇 SOP frontmatter 的 `code_version` 字段 = `"2.0.0-rc.1"`，`version` = `"v1.0.0"`。 | Grep 7 篇文档并逐一比对。 |

### Rubric 类（评估性质量维度）

| # | AC 编号 | 维度 | 量表（0-2） | Pass 阈值 | 证据来源 |
|---|--------|------|:---:|:---:|---------|
| U1 | AC-NFR2 | SOP 步骤明确度 + 失败修复覆盖度 | 0-2 | ≥ 1.5 | 独立 Reviewer 按每篇 SOP 的 5 段式结构评分，取 7 篇平均值。 |
| U2 | AC-NFR6 | 新成员首次提交无障碍度 | 0-2 | ≥ 1.5 | 独立 Reviewer 模拟新成员，按 S01→S02→S03 的步骤执行完整流程（可跳过真实提交，仅流程验证），统计卡顿点。 |
| U3 | AC-SOP-Suite-Coverage | 7 阶段闭环完整性（无阶段断裂） | 0-2 | ≥ 2.0 | 独立 Reviewer 按 SDLC 时间线走查：入职（S01）→开发（S02）→CR（S03）→合并（S04）→上线（S05+S06）→运维（S07），验证每阶段的输出可作为下一阶段的输入，无断点。 |
| U4 | AC-Doc-Quality | 文档语言专业性、结构清晰度、无冗余 | 0-2 | ≥ 1.5 | 独立 Reviewer 通读 7 篇 SOP，评估：(a) 是否有口语化/模糊表述；(b) 步骤是否按时间线排序；(c) 表格/代码块格式是否规范。 |

---

## 七、词汇表与版本声明

| 术语 | 定义 |
|------|------|
| SOP | Standard Operating Procedure，标准操作流程，定义了"谁在什么时间、按什么步骤、做什么事、达到什么标准"的可重复执行流程。 |
| P0 / P1 / P2 | 优先级分级。P0 = 阻断性（必须修复，不满足禁止上线）；P1 = 严重性（允许上线但需排期）；P2 = 优化性（排入常规迭代）。 |
| Gate:dev / Gate:quick | V9 的三级质量门禁中的前两级（见 `how-to-use-audit-scripts.md`）。 |
| 真数测试 | 使用真实市场数据（通过 AkShare / Tushare / iFinD 等接口实时获取）而非 Mock 数据的测试，AGENTS.md v1.6.0 明确要求上线前必须使用。 |
| 十域同步 | 代码改动后必须同步更新的 10 个衍生域（类型/消费者/测试/Mock/监控/注册表/文档/配置/Store/记忆），见 `module-sync-checklist` SKILL。 |

> **本文档基于**：`AGENTS.md` v1.6.0（2026-08-19）、`package.json` code_version `2.0.0-rc.1`。
> **兼容版本**：≥ AGENTS.md v1.6.0。若 AGENTS.md 升级，需同步评审 SOP 体系的阈值与命令是否需要更新。
