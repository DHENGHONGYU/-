---
title: V9 文档体系化审计与补全建议�?tier: reference
type: explanation
domain: qa
phase: testing
status: active
maintainer: V9 Architecture Team
tags: [qa, audit, report, design, documentation]
version: v0.9.0
last_updated: 2026-06-25
code_version: 2.0.0
doc_id: V9-DOC-QA-022
change_log: 
---

# V9 文档体系化审计与补全建议�?
> **角色**：架构治理官  
> **审计对象**：`docs/` 根目录核心架构文�?+ `docs/implementation/` 专项实施文档 + 根目�?`../../../README.md`  
> **代码基线**：`v0.9.0-migration-implemented`（`src/` 当前 HEAD 状态）  
> **审计时间**�?026-06-25  
> **审计结论**：当前文档体系在总体框架、数据协议、质量门禁目标上仍有效，但与代码实现存在**系统性滞�?*。大量已落地的模块（数据流引擎、Agent 运行时、板块轮动评分、V6 迁移、DB v6 等）未被文档准确记录，导致「文档即代码契约」原则出现偏差�?
---

## 1. 执行摘要

### 1.1 核心发现

| 维度 | 当前状�?| 关键问题 |
|------|----------|----------|
| **文档-代码一致�?* | 🟡 中等风险 | 至少 12 处文档声明与代码实现明显不符�? 份文档存在内部自相矛盾�?|
| **版本标识** | 🟡 需统一 | `docs/../../../README.md` 与各文档元信息版本号不统一；`../../../README.md` 根目录版本号缺失�?|
| **质量门禁基线** | 🔴 严重滞后 | `09-quality-gates.md` 中硬编码/死代�?跨层调用基线与实测结果相�?5~10 倍�?|
| **Schema 文档** | 🔴 严重滞后 | DB 版本仍写�?`4`，实际已升级�?`6`；新�?8 �?store 未在架构文档中完整列出�?|
| **模块状�?* | 🟡 需更新 | `agents/`、`core/dataflow/`、`cockpit/core/`、`rotationScoreService.ts` 等已实现，文档仍标注为「未创建」�?|
| **路由一致�?* | 🟡 需补全 | 路由注册表遗�?5 条实际路由；HubPage 设计未在文档中解释�?|

### 1.2 建议总览

- **保留**：五层架构、DataBridge/ACL/信封协议、输入舱业务规格、数据交互协议总则、质量门禁框架、词汇表核心概念�?- **重构**：`../03-architecture-standards.md`、`06-routing-specs.md`、`08-implementation-plan.md`、`09-quality-gates.md`、`../10-glossary.md`、根目录 `../../../README.md`、`docs/../../../README.md`、若�?`implementation/` 文档�?- **新增**：数据流引擎、Agent 运行时、板块轮动评分、DB v4→v6 迁移、路由注册表审计说明等补充文档�?
---

## 2. 审计范围与方�?
### 2.1 审计范围

**纳入审计的文�?*�?
- 根目录：`../../../README.md`
- `docs/` 根目录：`../../../README.md`、`../../../README.md`
- `docs/implementation/`�?  - `../architecture-version-comparison.md`
  - `../../reference/data-interaction-protocols.md`
  - `implementation-governance.md`
  - `input-cabin-spec.md`
  - `../../reference/v9-system-blueprint.md`
  - `../v10-architecture-alignment.md`
  - `../../archive/ui-module-alignment.md`
  - `../../reference/v6-to-v9-migration-spec.md`

**未纳入审计的文档**�?
- 所�?`Future Reference / Deferred` 标注的参考文档（本次仅核对其与当前架构的引用关系，不做内容审计）�?- `../../../CHANGELOG.md`（已�?V6 迁移任务中同步，本次仅作为版本参考）�?
### 2.2 审计方法

1. **代码扫描**：`find src/ -type f` 核对目录/文件存在性；`tsc --noEmit`、`npm run lint`、`npm test -- --run`、`npm run build`、`npm run test:e2e`�?2. **脚本基线实测**：`npm run audit:layers`、`npm run audit:hardcode`、`npm run audit:deadcode`�?3. **文档交叉比对**：同一主题在多份文档中的表述是否一致�?4. **文档-代码比对**：文档声明的模块状态、Schema 版本、路由、质量基线与代码实际是否一致�?
---

## 3. 当前文档体系全景�?
| 文档 | 当前版本标识 | 与代码一致�?| 优先�?|
|------|--------------|--------------|--------|
| `../../../README.md`（根�?| 无版本号 | 🟡 部分滞后 | �?|
| `docs/README.md` | `v0.9.0-migration-implemented` | 🟡 版本号与内部导航表不一�?| �?|
| `../../reference/01-vision-and-goals.md` | `v0.9.0-docs-review` | 🟢 基本有效 | �?|
| `../../reference/02-functional-specs.md` | `v0.9.0-docs-review` | 🟡 流程图需补充新模�?| �?|
| `../03-architecture-standards.md` | `v0.9.0-docs-review` | 🔴 多处严重滞后 | 最�?|
| `04-ui-ux-specs.md` | `v0.9.0-docs-review` | 🟡 图表/Widget 状态需更新 | �?|
| `..` | `v0.9.0-docs-review` | 🟡 需核对（本次未全文审计�?| �?|
| `06-routing-specs.md` | `v0.9.0-docs-v6pro-assessment` | 🟡 路由表遗�?映射错误 | �?|
| `07-operation-strategy.md` | `v0.9.0-docs-v6pro-assessment` | 🟢 基本有效 | �?|
| `08-implementation-plan.md` | `v0.9.0-migration-implemented` | 🔴 任务状态滞�?| 最�?|
| `09-quality-gates.md` | `v0.9.0-migration-implemented` | 🔴 基线数据严重滞后 | 最�?|
| `../10-glossary.md` | `v0.9.0-docs-v6pro-assessment` | 🟡 字段/模块 ID 遗漏 | �?|
| `../../reference/architecture-version-comparison.md` | 未标�?| 🟡 部分状态已过时 | �?|
| `../../reference/data-interaction-protocols.md` | 未标�?| 🟢 基本有效 | �?|
| `./implementation-governance.md` | 未标�?| 🟡 ADR 数量不一�?| �?|
| `../../reference/input-cabin-spec.md` | 未标�?| 🟡 `inputConfig.ts` 状态需更新 | �?|
| `../../reference/v9-system-blueprint.md` | 未标�?| 🔴 多处状态滞�?| �?|
| `../../reference/v10-architecture-alignment.md` | Future Reference | 🟡 �?`agents/` 目录判断已过�?| �?|
| `../../archive/ui-module-alignment.md` | Future Reference | 🟢 参考文档，未作为代码依�?| �?|
| `../../reference/v6-to-v9-migration-spec.md` | 未标�?| 🟢 与实现一�?| �?|

---

## 4. 保留清单

以下文档或章�?*在当前代码基线下仍然正确**，建议保留并作为真相源继续维护：

### 4.1 架构原则与分�?
- `../../reference/01-vision-and-goals.md`：纯前端、IndexedDB、离线可用、SMART 目标�?- `../03-architecture-standards.md` §3.2「调用方向铁律」、�?.3「数据访问规范」、�?.8「信封结构」：�?`DataBridge` + `ACL` 实现一致�?- `../../reference/data-interaction-protocols.md` §2.1~§2.5：跨模块写操作走 `DataBridge.forward()`、调用方向矩阵、事件总线命名规范�?
### 4.2 数据协议与输入舱规格

- `input-cabin-spec.md` §4.1~§4.4：输入舱职责、端到端流程、数据协议、事件名�?- `../../reference/v6-to-v9-migration-spec.md`：V6 Pro 导出结构�?2 �?store 映射、转换规则、导入顺序，�?`v6MigrationService.ts` 实现一致�?
### 4.3 运营与治理框�?
- `07-operation-strategy.md`：GitHub Flow、语义化提交、文档先行、外部参考管控、ADR 触发条件�?- `implementation-governance.md` §3.1~§3.5：治理目标、文档版本比对机制、代�?文档同步规则�?
### 4.4 词汇表核心概�?
- `../10-glossary.md` §10.1 股票池五态、�?0.1.2 交易持仓边界、�?0.4 交易术语、�?0.5 核心字段表（除遗漏项外）�?
---

## 5. 重构清单

按文档列出需要修改的内容、问题依据与建议修改方式�?
### 5.1 `../../reference/03-architecture-standards.md`（最高优先级�?
| # | 问题 | 位置 | 代码事实 | 建议修改 |
|---|------|------|----------|----------|
| R3.1 | DB 版本写为 `4` | §3.7 �?261 | `src/config/dbConfig.ts:2` 已定�?`DB_VERSION = 6`；`src/data/db.ts` 已记�?v4→v5→v6 升级历史 | 改为 `当前版本�?`，并补充 v5（group 字段）、v6（V6 Pro 迁移 store）升级说�?|
| R3.2 | Store 清单遗漏 8 �?store | §3.7 �?265-277 | `dbConfig.ts` 已定�?`rotationScores`、`sectorScores`、`scoreDocs`、`strategySnapshots`、`localDocs`、`news`、`newsStockMap`、`sentimentCache` | 补全 Store 清单与用途说�?|
| R3.3 | `agents/` 目录状态错�?| §3.1.1 �?40 | `src/agents/agentRuntime.ts` 已存�?| 改为「已存在基础实现（`agentRuntime.ts`），注册�?任务队列/健康监控待完善�?|
| R3.4 | 数据流引擎状态错�?| §3.1.2 �?76 | `src/core/dataflow/{dataflowEngine.ts,dataflowTypes.ts,defaultDataBuilder.ts}` 已存�?| 改为「已实现，文档待补充详细规格�?|
| R3.5 | 板块轮动评分状态错�?| D17 �?473 | `src/services/analysis/rotationScoreService.ts` 已存在（775 行） | 从偏差清单移除或改为「已实现，待接入上层页面�?|
| R3.6 | `inputConfig.ts` 状态错�?| �?233 vs �?629 | `src/config/inputConfig.ts` 已存�?| 统一为「已建�?|
| R3.7 | 章节编号重复 | 两个�?.14�?| �?| 将第二个改为�?.15」或合并 |
| R3.8 | `eventBus.subscribe` 示例错误 | §3.13 �?547 | `src/lib/eventBus.ts` 只有 `on/emit/off` | 改为 `eventBus.on('market:index', handleIndexUpdate)` |
| R3.9 | 偏差清单 D01/D12/D13/D14/D15/D16/D17/D19 状态滞�?| §3.12 �?451-476 | 对应代码已存在或部分存在 | 逐项复核并更新状�?|
| R3.10 | 数据质量字段落地情况 | §3.7.2 �?290-301 | `Stock` 类型已含 `group`；`dataQuality` 仍在 `types.ts` 定义但未完全写入 stocks �?| 明确当前实现状态与待补全点 |

### 5.2 `../../reference/06-routing-specs.md`（高优先级）

| # | 问题 | 位置 | 代码事实 | 建议修改 |
|---|------|------|----------|----------|
| R6.1 | 路由注册表遗�?5 条实际路�?| §2.1 �?28-50 | `src/config/routes.ts` 注册�?`/input/prototype`、`/analysis/score-docs`、`/analysis/news`、`/trading/strategy-snapshots`、`/input/local-knowledge` | 补全表格 |
| R6.2 | �?8 节组件映射错�?| §8 �?214-233 | `/analysis`、`/trading`、`/output`、`/command` 入口实际渲染 `PortalShell`，非 `AnalysisApp`/`TradingApp` �?| 修正�?`PortalShell` + 内部分发 |
| R6.3 | HubPage 设计未解�?| �?| `PortalShell.tsx` 内部 lazy 引用 `InputHubPage` 等，�?`ROUTE_REGISTRY` �?`/input/hub` 也指�?`PortalShell` | 增加说明：HubPage �?`PortalShell` 内部子组件，不进 `ROUTE_REGISTRY` 是设计选择 |
| R6.4 | `/input/prototype` 状�?| §3.2 / §7 �?208 | 仍注册为正式路由 | 明确删除计划或改为归�?|

### 5.3 `../../reference/08-implementation-plan.md`（最高优先级�?
| # | 问题 | 位置 | 代码事实 | 建议修改 |
|---|------|------|----------|----------|
| R8.1 | Phase 1 测试数量表述不一�?| §1 �?18 vs §2 �?42 | 当前�?44 files / 291 tests | 统一�?44 files / 291 tests |
| R8.2 | 多项任务状态滞�?| §3.1 �?48-94 | 2.1.8 数据流引擎�?.4.1 板块轮动�?.13 Widget 框架�?.17 Agent 运行时�?.19 ErrorBoundary 已有代码 | �?🔴 改为 🟡 �?✅（视集成度而定�?|
| R8.3 | V6 迁移任务状�?| �?93 | 已实现并通过测试 | 保持 ✅，补充测试数量 |
| R8.4 | `/input/prototype` 处理建议 | �?216 | 仍注�?| 更新为已确认删除或保留决�?|

### 5.4 `../../reference/09-quality-gates.md`（最高优先级�?
| # | 问题 | 位置 | 实测结果 | 建议修改 |
|---|------|------|----------|----------|
| R9.1 | 跨层调用基线错误 | §1 �?22 / §7.1 | `audit:layers`�? 违规 / **2 警告** | 改为 0 违规 / 2 警告，并列出警告文件 |
| R9.2 | 硬编码基线错�?| §1 �?23 / §7.2 | `audit:hardcode`�?*389 �?*�?83 静默回退 + 29 Tailwind 颜色 + 77 魔法数字�?| 更新基线并重新分�?|
| R9.3 | 死代码基线错�?| §1 �?24 / §7.3 | `audit:deadcode`�?*11 �?*�? 条件返回 null + 5 未注册页面） | 更新基线并解�?HubPage 设计 |
| R9.4 | `.nvmrc` 引用不存�?| §6.1 �?178 | 根目录无 `.nvmrc` | 创建该文件或移除引用 |
| R9.5 | 覆盖率阈值未配置 | §4.1 | 仍标�?🟡 | 补充 `vitest.config.ts` coverage 阈值配�?|

### 5.5 `../../reference/10-glossary.md`（高优先级）

| # | 问题 | 位置 | 代码事实 | 建议修改 |
|---|------|------|----------|----------|
| R10.1 | 模块 ID 遗漏 | §10.6 �?183-194 | `dbConfig.ts` 还定义了 `rotation`、`sector` | 补全 |
| R10.2 | `Stock` 字段遗漏 `group` | §10.5 �?133-149 | `Stock` 类型�?`group?: string`，且 `db.ts` �?`by-group` 索引 | 补全字段说明 |
| R10.3 | `watchlists` store 未说�?| §10.1/§10.5 | `dbConfig.ts` 定义�?`watchlists` | 在字段表�?store 表中补充 |
| R10.4 | 新增 V6 迁移术语 | �?| `v6MigrationService.ts` 引入 V6/V9 术语 | 补充迁移相关术语 |

### 5.6 `docs/README.md`（高优先级）

| # | 问题 | 位置 | 代码事实 | 建议修改 |
|---|------|------|----------|----------|
| RDR.1 | 版本号与内部导航表不一�?| �?4 vs �?20-29 | �?4 �?`v0.9.0-migration-implemented`，导航表各文档为 `v0.9.0-docs-review` | 统一版本标识策略：核心文档与�?README 采用一致版本，或说明子文档版本规则 |
| RDR.2 | 未标注临�?参考文�?| �?31-50 | 部分文档�?`Future Reference / Deferred` | 在表格中增加「文档性质」列 |

### 5.7 根目�?`../../../README.md`（高优先级）

| # | 问题 | 位置 | 代码事实 | 建议修改 |
|---|------|------|----------|----------|
| RR.1 | 无版本号 | 全文 | �?| 增加版本标识 `v0.9.0-migration-implemented` |
| RR.2 | 待实现列表滞�?| §待实�?| AKShare 已接入、板块轮动已有实现、PWA 未建立、CI 未配�?| 更新勾选状�?|
| RR.3 | 架构层描�?| §架构 | L3 写为 `services/, agents/`，但 `agents/` 仅为初始实现 | 改为 `services/（agents/ 初始实现）` |

### 5.8 `./implementation-governance.md`（中优先级）

| # | 问题 | 位置 | 代码事实 | 建议修改 |
|---|------|------|----------|----------|
| RIG.1 | ADR 数量前后不一�?| �?59-68 vs �?146 | 实际 8 �?ADR 文件 | 统一�?8 �?|
| RIG.2 | ADR 编号与文件名映射 | �?59-68 | 编号�?ADR-001~ADR-008，但文件名为日期前缀 | 增加「编号↔文件名」对照表 |

### 5.9 `../../reference/v9-system-blueprint.md`（高优先级）

| # | 问题 | 位置 | 代码事实 | 建议修改 |
|---|------|------|----------|----------|
| RVB.1 | ADR 列表错误 | �?332-339 | 实际 8 �?ADR，非 6 个；日期也不一�?| 更新�?8 个并附文件名 |
| RVB.2 | `agents/` 状态错�?| �?68 / D01 | `src/agents/agentRuntime.ts` 已存�?| 更新状�?|
| RVB.3 | 数据�?轮动/Widget/ErrorBoundary 状态错�?| §5.7 / D 列表 | 对应代码已存�?| 更新状�?|
| RVB.4 | 质量门禁基线错误 | §5.7 �?297-312 | 与实测不一�?| 同步为当前实测基�?|
| RVB.5 | Store 数量 | §5.4 | 写为 8 个当�?+ 未来扩展，实际当前已�?16 �?| 更新�?16 个当�?store |

### 5.10 `../../reference/input-cabin-spec.md`（中优先级）

| # | 问题 | 位置 | 代码事实 | 建议修改 |
|---|------|------|----------|----------|
| RIC.1 | `inputConfig.ts` 状�?| §4.7 �?214-237 | 已存�?| 改为「已建」并引用 |
| RIC.2 | 子页面映�?| §4.3 | 未包�?`/input/local-knowledge` | 补充 |

---

## 6. 新增清单

建议新增以下文档或章节，填补已实现但未被文档化的模块�?
| # | 新增内容 | 目标路径 | 优先�?| 说明 |
|---|----------|----------|--------|------|
| N1 | 数据流引擎规�?| `../../reference/dataflow-engine-spec.md` | �?| 补充 `src/core/dataflow/dataflowEngine.ts` 的通道模型、缓存策略、SSE/轮询、优先级、慢订阅者检�?|
| N2 | Agent 运行时规�?| `../../reference/agent-runtime-spec.md` | �?| 补充 `src/agents/agentRuntime.ts` 的注册、调度、任务队列、超时机�?|
| N3 | 板块轮动评分引擎规格 | `../../reference/rotation-score-spec.md` | �?| 补充 `rotationScoreService.ts` 的五因子十六指标模型、输入输出、调用方�?|
| N4 | 数据库迁移说�?v4→v6 | `../db-migration-v4-to-v6.md` | �?| 记录每次 DB 版本升级�?schema 变更、回退策略、兼容性处�?|
| N5 | 路由注册表审计说�?| `../../archive/route-registry-audit-notes.md` | �?| 解释 HubPage 不进 `ROUTE_REGISTRY`、`/input/prototype` 临时路由、PortalShell 分发机制 |
| N6 | 质量门禁当前基线说明 | `../quality-gates-baseline.md` | �?| 详细记录 audit 脚本输出、问题分类、收敛计�?|
| N7 | V6 Pro 迁移 ADR | `../../archive/adr-2026-06-24-v6-migration.md` | �?| �?V6 迁移决策正式归档�?ADR-009 |
| N8 | 词汇表补充章�?| `../../reference/10-glossary.md` §10.8 | �?| 增加 V6 迁移、数据流引擎、Agent 运行时相关术�?|

---

## 7. 关键冲突与偏差详�?
| 编号 | 冲突�?| 涉及文档 | 文档声明 | 代码/实测事实 | 风险等级 |
|------|--------|----------|----------|---------------|----------|
| C1 | DB 版本 | `../03-architecture-standards.md` §3.7 | 当前版本 `4` | `DB_VERSION = 6` | 🔴 �?|
| C2 | Store 清单 | `../03-architecture-standards.md` §3.7 / `../../reference/v9-system-blueprint.md` §5.4 | 8 个当�?store | 实际 16 �?store | 🔴 �?|
| C3 | `agents/` 状�?| `../03-architecture-standards.md` §3.1.1 / `../../reference/v9-system-blueprint.md` | 未创�?| `src/agents/agentRuntime.ts` 已存�?| 🟡 �?|
| C4 | 数据流引擎状�?| `../03-architecture-standards.md` §3.1.2 / `08-implementation-plan.md` 2.1.8 | 未实�?🔴 | `src/core/dataflow/` 已实�?| 🔴 �?|
| C5 | 板块轮动评分状�?| `../03-architecture-standards.md` D17 / `08-implementation-plan.md` 2.4.1 | 缺失/静态样�?🔴 | `rotationScoreService.ts` 已实�?| 🔴 �?|
| C6 | Widget 框架状�?| `../03-architecture-standards.md` D14 / `08-implementation-plan.md` 2.13 | 缺失 🔴 | `src/cockpit/core/widgetEngine.ts` 已存�?| 🟡 �?|
| C7 | ErrorBoundary 状�?| `08-implementation-plan.md` 2.19 | 缺失 🔴 | `src/components/organisms/shared/ErrorBoundary.tsx` 已存在并�?`App.tsx` 使用 | 🟡 �?|
| C8 | 跨层调用基线 | `09-quality-gates.md` / `../../reference/v9-system-blueprint.md` | 0 违规 / 0 警告 | 0 违规 / **2 警告** | 🔴 �?|
| C9 | 硬编码基�?| `09-quality-gates.md` / `../../reference/v9-system-blueprint.md` | 71 �?| **389 �?* | 🔴 �?|
| C10 | 死代码基�?| `09-quality-gates.md` / `../../reference/v9-system-blueprint.md` | 4 �?| **11 �?* | 🔴 �?|
| C11 | 路由注册表遗�?| `06-routing-specs.md` §2.1 | 列出 14 条路�?| 实际注册 19 �?| 🟡 �?|
| C12 | 路由组件映射错误 | `06-routing-specs.md` §8 | `/analysis` �?`AnalysisApp` | `/analysis` �?`PortalShell` | 🟡 �?|
| C13 | `inputConfig.ts` 状�?| `../03-architecture-standards.md` �?629 / `input-cabin-spec.md` | 待建/新增 | 已存�?| 🟡 �?|
| C14 | 模块 ID 遗漏 | `../10-glossary.md` §10.6 | 7 �?| `dbConfig.ts` 定义 10 �?| 🟡 �?|
| C15 | `Stock.group` 字段遗漏 | `../10-glossary.md` §10.5 | 字段表未�?`group` | `Stock` 类型�?`db.ts` 索引均含 `group` | 🟡 �?|
| C16 | ADR 数量不一�?| `implementation-governance.md` / `../../reference/v9-system-blueprint.md` | 7 �?/ 6 �?| 实际 8 �?| 🟡 �?|
| C17 | `.nvmrc` 不存�?| `09-quality-gates.md` §6.1 | CI 使用 `.nvmrc` | 文件不存�?| 🟡 �?|
| C18 | 章节编号重复 | `../03-architecture-standards.md` | 两个�?.14�?| �?| 🟢 �?|
| C19 | `eventBus.subscribe` 示例 | `../03-architecture-standards.md` §3.13 | 使用 `subscribe` | API 只有 `on/emit/off` | 🟢 �?|

---

## 8. 补全优先级与路线�?
### 8.1 立即执行（P0�?-2 天）

1. 修正 `../03-architecture-standards.md`：DB_VERSION 6、Store 清单 16 个、偏差清单状态�?2. 修正 `09-quality-gates.md`：audit 基线同步为实测值（0/2�?89�?1）�?3. 修正 `08-implementation-plan.md`：Phase 2 任务状态、测试数量�?4. 修正 `docs/../../../README.md` 与根目录 `../../../README.md` 版本标识与待实现列表�?
### 8.2 短期执行（P1�?-5 天）

1. 新增 `../db-migration-v4-to-v6.md`�?2. 新增 `../quality-gates-baseline.md`�?3. 修正 `06-routing-specs.md`：补全路由表、修正组件映射、解�?HubPage 设计�?4. 修正 `../10-glossary.md`：补全模�?ID、`group` 字段、`watchlists`、迁移术语�?5. 修正 `../../reference/v9-system-blueprint.md`：ADR 列表、模块状态、质量基线�?
### 8.3 中期执行（P2�?-2 周）

1. 新增 `../../reference/dataflow-engine-spec.md`�?2. 新增 `../../reference/agent-runtime-spec.md`�?3. 新增 `../../reference/rotation-score-spec.md`�?4. 新增 `../../archive/route-registry-audit-notes.md`�?5. 新增 ADR-009 V6 Pro 迁移决策�?6. 创建 `.nvmrc` 或移�?CI 引用�?7. 配置 `vitest.config.ts` coverage 阈值�?
### 8.4 治理规则强化

1. �?`implementation-governance.md` 中增加「文�?代码同步检查单」：
   - 新增/修改 store �?同步 `../03-architecture-standards.md` + `../10-glossary.md` + `src/data/db.ts` 注释�?   - 新增/修改路由 �?同步 `06-routing-specs.md` + `src/config/routes.ts` 注释�?   - 修改质量脚本 �?同步 `09-quality-gates.md` 基线�?2. 每次发布版本必须同步 `docs/../../../README.md`、根目录 `../../../README.md`、`../../../CHANGELOG.md`、`package.json` 版本号�?
---

## 9. 附录：质量门禁实测数�?
> 实测时间�?026-06-25  
> 命令：`npm test -- --run`、`npm run audit:layers`、`npm run audit:hardcode`、`npm run audit:deadcode`

### 9.1 单元测试

```
Test Files  44 passed (44)
Tests       291 passed (291)
Duration    23.75s
```

### 9.2 跨层调用审计

```
扫描文件�? 152
违规�? 0
警告�? 2

警告文件�?- src/pages/analysis/ScoreDocPage.tsx:14  import { dataLayer } from '@/data/dataLayer'
- src/pages/trading/StrategySnapshotPage.tsx:18  import { dataLayer } from '@/data/dataLayer'
```

### 9.3 硬编码审�?
```
扫描文件�? 152
问题总数: 389

按类别：
- 静默回退: 283
- 硬编�?Tailwind 颜色�? 29
- 魔法数字: 77
```

### 9.4 死代码审�?
```
扫描文件�? 152
空函�?组件: 0
路由文件缺失: 0
未注册页�? 5

未注册页面：
- src/pages/analysis/AnalysisHubPage.tsx
- src/pages/command/CommandHubPage.tsx
- src/pages/defaultPageBuilder.tsx
- src/pages/input/InputHubPage.tsx
- src/pages/trading/TradingHubPage.tsx
```

> 说明�? 个「未注册页面」中�? �?HubPage �?`PortalShell` 内部懒加载组件，不进 `ROUTE_REGISTRY` 是设计选择；`defaultPageBuilder.tsx` 为工具文件，非页面。建议在 `audit-dead-code.ts` 中增加白名单或在文档中说明�?
### 9.5 构建�?E2E

```
npm run build     �?4.19s
npm run test:e2e  �?5/5（历史记录）
npm run lint      �?通过
tsc --noEmit      �?通过
```

---

## 10. 结论

V9 项目在经�?V6 Pro 迁移、输入舱重塑、数据流引擎�?Agent 运行时补充后�?*代码基线已显著领先于文档体系**。当前文档体系不再能准确反映代码真相，若不及时补全，将在后续开发中导致�?
1. 新成员对已实现能力误判，重复造轮子�?2. 质量门禁基线失真，无法有效阻止技术债恶化�?3. Schema 与路由变更缺乏文档约束，增加回归风险�?
建议以本建议书为任务清单，在下一个迭代中优先完成 P0/P1 文档重构，并�?`implementation-governance.md` 中固化「文�?代码同步检查单」，使架构治理从「一次性审计」转为「持续机制」�?