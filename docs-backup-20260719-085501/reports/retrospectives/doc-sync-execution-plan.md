---
title: 代码-文档同步整体方案与执行计划
type: reports
domain: project
phase: retrospective
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "目标读者：架构师、技术负责人、核心开发者、负责文档同步的 Agent"
tags: [project, spec, report, plan, governance, documentation, strategy]
version: v0.9.1
last_updated: 2026-06-26
code_version: 2.0.0
change_log: 
---

# 代码-文档同步整体方案与执行计划

> **Status**: Current  
> **Version**: v0.9.0-doc-sync-plan  
> **Last Updated**: 2026-06-26  
> 目标读者：架构师、技术负责人、核心开发者、负责文档同步的 Agent

---

## 1. 背景与问题定义

V9 项目进入 Phase 2 中后期后，代码迭代速度显著加快，新增模块（Data Fetcher、股票池分组、交易引擎、NewsPage PoC、驾驶舱 Widget、AI 中心等）持续落地。历史经验表明，**代码更新后文档停留在上一版本**是常见技术债务，会导致：

- 新成员难以理解真实数据模型与服务契约；
- 架构决策记录（ADR）与实际实现偏离；
- 数据字典缺失字段/枚举，前端硬编码风险上升；
- V9 与 V6 Pro / V10 的架构比对失去基准。

本方案建立一套可持续的 **“差异扫描 → 文档补齐 → 质量验证”** 闭环，确保新增模块的架构描述和数据字典完整、准确、可追溯。

---

## 2. 目标

1. **全量覆盖**：所有新增/修改的 `src/` 文件，在合并前必须完成对应文档同步。
2. **增量更新**：每个模块补充完毕后立即触发一次小规模文档同步，禁止集中到末期集中处理。
3. **可追溯**：文档变更与代码变更通过 `../../../CHANGELOG.md` 同批次记录。
4. **可验证**：文档同步后必须通过 `tsc / lint / test / build` 全量门禁。
5. **消除硬编码**：数据字典必须覆盖新增模块的颜色、状态、枚举、模型版本、轮询间隔等常量。

---

## 3. 范围

### 3.1 纳入同步的文档类型

| 文档类型 | 代表文件 | 同步时机 |
|----------|----------|----------|
| 数据字典 | `../../reference/data-definition.md`、`../../reference/news-contract.md`、`../../reference/data-definition.md` | 新增/修改数据模型、Store、Envelope Action、Service API 时 |
| 架构说明 | `../../explanation/03-architecture-standards.md`、`../../reference/03-architecture-standards.md` | 新增模块、调整分层、新增路由/注册表时 |
| 实施计划 | `../../reference/08-implementation-plan.md` | 任务状态变更、新增/拆分任务时 |
| 路由规格 | `../../reference/06-routing-specs.md` | 新增/修改路由、页面组件时 |
| 引擎规格 | `../../reference/05-engine-specs.md` | 新增/修改引擎、算法、数据流时 |
| 质量门禁 | `../../reference/09-quality-gates.md` | 测试基线、审计基线变化时 |
| 更新日志 | `../../../CHANGELOG.md` | 每次代码-文档同步完成后 |
| 验收确认书 | `../../explanation/v6pro-to-v9-migration-analysis.md` 等 | PoC/迁移任务完成后 |

### 3.2 纳入扫描的代码范围

- `src/data/types.ts`：新增/修改数据接口
- `src/config/*.ts`：新增环境变量、路由、阈值、枚举
- `src/constants/*.ts`：新增业务常量
- `src/services/**`：新增/修改服务层 API
- `src/core/**`：新增/修改 DataBridge、Envelope、ACL、数据流引擎
- `src/cockpit/**`：新增/修改 Widget、注册表、数据流
- `src/pages/**`：新增/修改页面、适配层
- `src/store/**`：新增/修改全局 Store

---

## 4. 核心工作流

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Phase 1: 扫描   │ ──? │  Phase 2: 补齐   │ ──? │  Phase 3: 验证   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 4.1 Phase 1：差异扫描（Scan）

**输入**：
- `../../explanation/deprecated-v9-issue-resolution-schedule.md` 中待执行的整改项；
- 最近一次代码变更的 diff（新增/修改文件清单）；
- 现有数据字典与架构文档。

**扫描规则**：

| 扫描维度 | 检查项 | 工具/方法 |
|----------|--------|-----------|
| 新文件 | 是否存在未纳入任何文档的 `src/**` 新文件 | `git diff --name-status` / `git status` |
| 数据模型 | 新增/修改的 TypeScript 接口是否已在数据字典中定义 | 人工核对 + `grep` |
| 枚举常量 | 新增的颜色、状态、维度、模型版本是否已常量化的同时被字典引用 | `scripts/audit-hardcode.ts` |
| 服务 API | 新增函数签名、参数、返回值是否已记录 | 人工核对 |
| DataBridge | 新增 Store / Envelope Action 是否在数据字典与架构文档中体现 | `grep -R "SAVE_" src/config/dbConfig.ts` |
| 路由 | 新增路由是否在 `../../reference/06-routing-specs.md` 中注册 | 比对 `src/config/routes.ts` 与文档 |

**输出**：`../../explanation/design/deprecated-doc-sync-gap-list.md`（差异清单），每条包含：
- 模块名
- 涉及文件
- 缺失文档类型
- 优先级（P0/P1/P2）
- 建议责任人

### 4.2 Phase 2：文档补齐（Sync）

**原则**：
- 每个模块一次只做一件事：先补代码，再补文档，最后更新日志。
- 禁止“先全部写代码，最后统一补文档”。

**补齐内容模板**：

#### 数据字典条目

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `...` | `...` | 是/否 | `...` | `...` |

#### 架构说明条目

- 模块职责
- 调用关系图（Mermaid）
- 依赖的常量/类型/服务
- 新增 Widget SOP（如适用）

#### CHANGELOG 条目

- 在 `[Unreleased]` 下按 `Added / Fixed / Changed` 分类追加
- 必须引用新增/修改的文件路径
- 必须记录验证结果

### 4.3 Phase 3：验证（Verify）

每次文档同步后必须执行：

```bash
npm run tsc        # TypeScript 无错误
npm run lint       # ESLint 0 warnings/errors
npm run test       # 全量测试通过
npm run build      # 生产构建成功
```

文档类 Markdown 不直接参与编译，但文档中引用的源码文件会被 `tsc/lint` 覆盖，因此全量门禁足以验证同步质量。

---

## 5. 执行计划

### 5.1 近期（当前 Sprint，1 周内）

| # | 任务 | 优先级 | 输入 | 输出 | 验收标准 |
|---|------|--------|------|------|----------|
| 1 | 建立文档同步工作流 | P0 | 本方案 | `./doc-sync-execution-plan.md` | 方案通过评审，团队知悉 |
| 2 | 补齐 NewsPage 数据字典 | P0 | PoC 报告、代码 | `../../reference/news-contract.md` | 已输出并通过验证 |
| 3 | 补齐金融业务 Widget 架构与字典 | P0 | Widget 代码 | `../../explanation/03-architecture-standards.md`、`../../reference/data-definition.md` | 已输出并通过验证 |
| 4 | 补齐 AI 中心板块字典与 Vue3 示例 | P0 | AI Center 代码 | `../../reference/ai-center-data-definition.md`、`../../explanation/ai-center-vue3-examples.md` | 已输出并通过验证 |
| 5 | 更新 `../../../../../../CHANGELOG.md` | P0 | 上述文档 | `../../../../../../CHANGELOG.md` `[Unreleased]` 新增条目 | 条目完整、引用路径准确 |
| 6 | 建立差异清单模板 | P1 | 本方案 | `../../explanation/design/deprecated-doc-sync-gap-list.md` | 模板可复用 |

### 5.2 中期（2~4 周）

| # | 任务 | 优先级 | 依赖 | 验收标准 |
|---|------|--------|------|----------|
| 7 | 将文档同步纳入 PR Checklist | P1 | 任务 1 | 每个 PR 必须勾选“已同步数据字典/架构说明/CHANGELOG” |
| 8 | 自动化差异扫描脚本 | P1 | 任务 6 | `scripts/audit-doc-sync.ts`：扫描新增文件并提示缺失文档 |
| 9 | 整改调度表文档项闭环 | P1 | `../../explanation/deprecated-v9-issue-resolution-schedule.md` | DOC-001 ~ DOC-007 全部完成，状态更新为“已执行” |
| 10 | 更新 `../../reference/08-implementation-plan.md` | P1 | 任务 1, 4 | 在实施计划中新增“文档同步”任务列，状态可追踪 |
| 11 | 数据字典索引页 | P1 | 任务 2, 3, 4 | `../../reference/data-dictionary-index.md`：汇总所有模块数据字典入口 |
| 12 | 架构文档版本比对常态化 | P2 | 任务 1 | 每次大版本变更后生成 `../../explanation/architecture-version-comparison.md` 片段 |

### 5.3 长期（持续）

| # | 任务 | 优先级 | 频率 | 验收标准 |
|---|------|--------|------|----------|
| 13 | 文档同步审计 | P2 | 每周 | `audit-doc-sync.ts` 输出差异清单，差异项 ≤ 3 个 |
| 14 | 文档与代码同行评审 | P2 | 每次 PR | Reviewer 必须确认文档同步完成 |
| 15 | 数据字典自动生成探索 | P3 | 按需 | 评估从 TypeScript AST 自动生成字段表的可行性 |

---

## 6. 与现有流程的衔接

### 6.1 与 V9 问题整改调度表的衔接

- **Phase 1 扫描**：将 `../../explanation/deprecated-v9-issue-resolution-schedule.md` 中所有“待执行”项涉及的文件纳入差异扫描范围。
- 每个整改项完成后，必须同步更新相关架构/数据字典/CHANGELOG，并在调度表中将状态改为“已执行”。
- 特别关注点：
  - ARCH-002（L3 写走 DataBridge）：需在数据字典中补充 Envelope Action 映射；
  - ARCH-003（v6MigrationService 拆分）：需更新架构说明与迁移规范；
  - DOC-001 ~ DOC-007：直接属于文档同步任务，优先闭环。

### 6.2 与实施计划的衔接

- 在 `../../reference/08-implementation-plan.md` Phase 2 中新增任务 **“2.22 代码-文档同步机制”**，归属 P1，依赖 2.1/2.3/2.13。
- 每个已有任务（如 2.1.8 数据流引擎、2.13 Widget 框架）的验收标准中增加一条：**“对应数据字典与架构说明已更新并通过验证”**。

### 6.3 与 NewsPage PoC 的衔接

- PoC 验收通过后，必须将新增/复用的 Store、DataBridge Action、Service API 同步到数据字典。
- 已落地：`../../reference/news-contract.md`。
- 后续其他页面 PoC（如 SectorAnalysisPage、ScoreDocPage）复用同一流程。

### 6.4 与 CHANGELOG 的衔接

- 每次文档同步完成后，在 `../../../CHANGELOG.md` `[Unreleased]` 追加条目。
- 条目必须包含：新增/修改的文件路径、验证结果、关联的问题 ID（如 ARCH-002、DOC-003）。

---

## 7. 角色与职责

| 角色 | 职责 |
|------|------|
| **架构师 / Tech Lead** | 审批文档同步方案；评审架构说明与数据字典；维护 `../../reference/03-architecture-standards.md` |
| **核心开发者** | 在实现功能时同步更新数据字典；执行 `tsc/lint/test/build` 验证 |
| **Doc-Sync Agent** | 执行 Phase 1 扫描；生成差异清单；补充模块级数据字典；更新 CHANGELOG |
| **QA / Reviewer** | PR 中检查文档同步项；确认数据字典字段、枚举、颜色无硬编码遗漏 |

---

## 8. 验收标准

1. **覆盖率**：新增/修改文件在 1 个工作日内完成文档同步。
2. **准确性**：数据字典字段、类型、枚举、范围与源码 100% 一致。
3. **无硬编码**：数据字典发布后，组件内不再出现未在 `src/constants/` 中定义的魔法字符串/颜色/数字。
4. **可追溯**：每个文档变更都能在 `../../../CHANGELOG.md` 中找到对应条目。
5. **质量门禁**：每次同步后 `tsc`、`lint`、`test`、`build` 全部通过。

---

## 9. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 开发者抗拒补文档 | 文档滞后 | 将文档同步纳入 PR Checklist，未勾选禁止合并 |
| 扫描脚本误报/漏报 | 覆盖不全 | 初期人工复核 + 脚本辅助，逐步迭代规则 |
| 数据字典与代码再次偏离 | 债务复发 | 每周运行 `audit-doc-sync.ts`，差异项控制在 3 个以内 |
| 多 Agent 同时修改同一文档 | 冲突 | 按模块拆分责任人，大改动前在群里同步 |
| 历史文档版本号混乱 | 难以追溯 | 统一 frontmatter 格式：`Status / Version / Last Updated` |

---

## 10. 一键执行脚本（建议）

```bash
# 1. 扫描新增/修改文件
git diff --name-status HEAD~1 HEAD

# 2. 检查新增文件是否已出现在文档中
grep -R "new-file-name" docs/

# 3. 检查新增枚举/常量是否被字典引用
grep -R "NEW_CONSTANT" docs/

# 4. 全量验证
npm run tsc && npm run lint && npm run test && npm run build
```

---

## 11. 附录：已落地的文档同步案例

| 模块 | 代码文件 | 同步文档 | 验证结果 |
|------|----------|----------|----------|
| 金融业务 Widget | `src/cockpit/widgets/*`、`src/services/stock-analysis/*` | `../../explanation/03-architecture-standards.md`、`../../reference/data-definition.md` | tsc/lint/test/build 通过 |
| AI 中心板块 | `src/constants/ai-center.constants.ts`、`src/services/ai-center/*` | `../../reference/ai-center-data-definition.md`、`../../explanation/ai-center-vue3-examples.md` | tsc/lint 通过 |
| NewsPage PoC | `src/pages/news-v6/*`、`src/services/news/newsService.ts` | `../../reference/news-contract.md` | tsc/lint/test 通过 |

---

*本方案作为 V9 项目文档治理的基线流程，后续根据团队反馈每两周迭代一次。*
