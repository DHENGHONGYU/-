---
title: doc-cross-check-report
type: explanation
domain: project
phase: design
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "检查日期: 2026-07-01 检查范围: 七维采集配置模块（`/input/seven-dim`）相关路由、类型、组件、测试、文档版本 检查人: 文档交叉检查代理 报告版本:..."
tags: [project, report, plan, architecture, documentation, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-172
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 七维采集配置模块 — 文档交叉检查报告

> **检查日期**: 2026-07-01
> **检查范围**: 七维采集配置模块（`/input/seven-dim`）相关路由、类型、组件、测试、文档版本
> **检查人**: 文档交叉检查代理
> **报告版本**: v1.1（2026-07-02 更新：路由总数 32 → 35）

---

## v1.1 更新说明（2026-07-02）

本次更新涉及以下变化，已同步至所有相关文档：

1. **路由总数变更**：32 条 → 35 条
   - 新增 `/input/collect-task`（采集任务监控页，组件 `CollectTaskPage`）
   - 新增 `/input/fetcher`（抓取引擎配置页，组件 `FetcherConfigPage`）
   - 新增 `/input/local-knowledge`（本地知识库页，组件 `LocalKnowledgePage`）
   - 三条路由均已同步至 `src/config/routes.ts` 的 `ROUTE_REGISTRY` 与 `ROUTE_WHITELIST`
2. **DB_VERSION 升级**：v15 → v16
   - v15 新增 `execution_logs`、`missing_reports` Store
   - v16 新增 `execution_plans`、`portfolios` Store
3. **Store 总数变更**：20 → 24
4. **ModuleId 枚举扩展**：11 → 16（新增 `orderstore`/`backtest`/`execution`/`portfolio`/`dataCollector`）
5. **HotSectorScore 字段重命名**：`composite` → `marketEnv`，`triggerAction` → `action`
6. **Stock 类型字段更新**：废弃 `sectorCodes`/`lastUpdated`，新增 `industryCode`/`theme`/`sector`/`ingestedAt`/`updatedAt`，`dataVersion` 类型从 `string` 改为 `number`

受影响文档均已同步：`../../reference/V9数据宪法.md`、`v9-indexeddb-store-schema.md`、`../03-architecture-standards.md`、`06-routing-specs.md`、`../10-glossary.md`。

---

## 一、检查概要

| 指标 | 数量 |
|------|------|
| 检查项总数 | 19 |
| 通过（一致） | 6 |
| 部分一致 | 3 |
| 不一致 | 10 |
| 阻塞项 | 0 |
| 高优先级修复项 | 4 |

> **总体结论**：七维采集配置模块的代码实现（Store / Page / Config / Tests）内部一致性良好，但与项目级真相源（`ROUTE_REGISTRY`、`../../reference/06-routing-specs.md`、`../../reference/data-dictionary-index.md`、`../../../CHANGELOG.md`）存在多处脱节。该问题已于 2026-07-01 修复，`/input/seven-dim` 已注册到 `ROUTE_REGISTRY`（原 `data-collection-route-ui-audit.md` P0 项 F-01 已闭环）。

---

## 二、检查明细

### 1. 路由一致性检查

#### 1a) ROUTE_REGISTRY 路由数 vs 路由规格文档声明 — ? 已修复（2026-07-01）

| 来源 | 路由数 |
|------|--------|
| `src/config/routes.ts` ROUTE_REGISTRY | 32 |
| `../../reference/06-routing-specs.md` 第2.1节表格（第31-61行） | 32 |
| `../../reference/06-routing-specs.md` 第65行声明 | 32 |
| `../../reference/06-routing-specs.md` 第288行（第9节）声明 | 32 |

**不一致点**：
- 该问题已于 2026-07-01 修复：`../../reference/06-routing-specs.md` 第9节路由数已统一为 32 条，与 `routes.ts` 实际数量（32）一致，原 29 vs 31 文档内部矛盾已消除。

**修复建议**：已闭环（2026-07-01）。

#### 1b) InputHubPage 链接路径是否都有对应路由注册 — ? 已修复（2026-07-01）

`src/apps/input/InputApp.tsx` 中 `INPUT_MODULES`（第34-71行）链接路径检查：

| 链接路径 | ROUTE_REGISTRY 注册 | 状态 |
|----------|---------------------|------|
| `/input/dashboard` | ? `routes.ts:56` | 通过 |
| `/input/bulk-import` | ? `routes.ts:62` | 通过 |
| `/input/hot-sectors` | ? `routes.ts:68` | 通过 |
| `/input/data-test` | ? `routes.ts:74` | 通过 |
| `/input/local-knowledge` | ? `routes.ts:202` | 通过 |
| **`/input/seven-dim`** | ? **已注册到 ROUTE_REGISTRY** | **已修复** |

**不一致点**：
- 该问题已于 2026-07-01 修复：`/input/seven-dim` 已注册到 `src/config/routes.ts` 的 `ROUTE_REGISTRY`，`ROUTE_WHITELIST` 已覆盖该路径，`isPathWhitelisted('/input/seven-dim')` 精确匹配通过。

**修复建议**：已闭环（2026-07-01）。

#### 1c) `/input/seven-dim` 是否在所有文档中一致出现 — ? 已修复（2026-07-01）

| 文件 | 是否包含 `/input/seven-dim` | 行号 |
|------|----------------------------|------|
| `src/config/routes.ts` (ROUTE_REGISTRY) | ? 已注册 | — |
| `src/apps/input/InputApp.tsx` (子路由) | ? 存在 | 41 |
| `src/apps/input/InputApp.tsx` (卡片链接) | ? 存在 | 68 |
| `../../reference/06-routing-specs.md` (第2.1节路由表) | ? 已补入 | — |
| `../../reference/06-routing-specs.md` (第3.2节输入舱子路由映射) | ? 已补入 | — |
| `../../reference/06-routing-specs.md` (第8节路由→组件映射) | ? 已补入 | — |
| `../../reference/data-collection-route-ui-audit.md` | ? 已记录并标记为已修复 | 16, 30, 142, 155, 226 |

**修复建议**：已闭环（2026-07-01）。路由已注册，文档已补入，路由总数已更新为 32 条。

#### 1d) 文档中列出但代码中不存在的路由 — ? 已修复（2026-07-01）

**不一致点**：
- 该问题已于 2026-07-01 修复：`../../reference/06-routing-specs.md` 第8节已删除 `/analysis/news-v6` 残留行，与代码保持一致。
- 第8节列出的 `/input/hub`、`/analysis/hub`、`/trading/hub`、`/command/hub` 属"已接受偏差"（Hub 页由 PortalShell 内部分发），不计为不一致。

**修复建议**：已闭环（2026-07-01）。

#### 1e) 代码中存在但文档中未列出的路由 — ? 已修复（2026-07-01）

**不一致点**：
- 该问题已于 2026-07-01 修复：`/input/seven-dim` 已在 `../../reference/06-routing-specs.md` 第2.1节、第3.2节、第8节中补入。
- `/input/hub` 属设计选择（由 CabinApp 内部 Routes 处理），不计为不一致。

**修复建议**：已闭环（2026-07-01）。

---

### 2. 类型定义一致性检查

#### 2a) collectConfig.ts 导出类型是否在数据字典中有对应条目 — ? 不一致

`src/config/collectConfig.ts` 导出的类型与常量：

| 导出项 | 类型 | 数据字典条目 |
|--------|------|--------------|
| `UpdateFrequency` | type | ? 无 |
| `DataSourceType` | type | ? 无 |
| `StorageType` | type | ? 无 |
| `DimensionImportance` | type | ? 无 |
| `DimensionConfig` | interface | ? 无 |
| `StrategyTemplateId` | type | ? 无 |
| `StrategyTemplate` | interface | ? 无 |
| `DEFAULT_DIMENSIONS` | const | ? 无 |
| `STRATEGY_TEMPLATES` | const | ? 无 |
| `GLOBAL_LIMITS` | const | ? 无 |

**不一致点**：
- `../../reference/data-dictionary-index.md` 的"按模块索引"表格（第13-20行）未包含七维采集配置模块条目。
- "通用类型与常量"表格（第26-43行）未列出 `src/config/collectConfig.ts`。

**修复建议**：
1. 在 `../../reference/data-dictionary-index.md` "按模块索引"表新增一行：七维采集配置模块 → 新建 `docs/data-collection/COLLECT_CONFIG_data-definition.md`。
2. 在"通用类型与常量"表新增 `src/config/collectConfig.ts` 条目。

#### 2b) sevenDimConfigStore.ts 的 State 接口字段是否与数据字典一致 — ? 不一致

`src/store/sevenDimConfigStore.ts:35-87` 定义了 `SevenDimConfigState` 接口，含 10 个状态字段、4 个派生计算、10 个 action 方法。

**不一致点**：
- 数据字典中无 `sevenDimConfigStore` 条目，无法进行字段级比对。

**修复建议**：在数据字典中登记 `SevenDimConfigState` 的全部字段、action 签名与初始值。

#### 2c) DimensionConfig 的 fields 是否与 types.ts 中的相关类型兼容 — ? 已修复（2026-07-01）

| 类型 | 来源 | 维度覆盖 |
|------|------|----------|
| `DimensionConfig.code` | `collectConfig.ts:102` | `string`，实际值 `01`~`08` |
| `DataDimensionType` | `types.ts:694-702` | 已扩展至 8 维度（`01_basic`~`08_research`） |
| `DataDimensionMeta.code` | `types.ts:705` | `DataDimensionType`（8个） |
| `DimensionStatus` | `types.ts:713` | `Record<string, DimensionStatus>` 泛型 |

**不一致点**：
- 该问题已于 2026-07-01 修复：`src/data/types.ts` 的 `DataDimensionType` 联合类型已扩展至 8 维度，新增 `'08_research'`（研报中心），与 `collectConfig.ts` 的 `DEFAULT_DIMENSIONS` 8 个维度完全对齐。
- `DimensionConfig.fields` 为 `string[]`，与 `types.ts` 中的字段无强类型关联，属弱耦合，可接受。

**修复建议**：已闭环（2026-07-01）。

#### 2d) DEFAULT_DIMENSIONS 的8个维度 code 是否与文档描述一致 — ? 通过

| 维度 code | 名称 | collectConfig.ts | 文档描述 |
|-----------|------|------------------|----------|
| 01 | 基本信息 | ? `collectConfig.ts:198` | ? 一致 |
| 02 | K线数据 | ? `collectConfig.ts:210` | ? 一致 |
| 03 | 筹码分布 | ? `collectConfig.ts:222` | ? 一致 |
| 04 | 重大事项 | ? `collectConfig.ts:234` | ? 一致 |
| 05 | 热点新闻 | ? `collectConfig.ts:246` | ? 一致 |
| 06 | 行业竞品 | ? `collectConfig.ts:258` | ? 一致 |
| 07 | 关联指数 | ? `collectConfig.ts:270` | ? 一致 |
| 08 | 研报中心 | ? `collectConfig.ts:282` | ? `data-collection-gap-analysis.md:68` 描述"8维度" |

**结论**：8 个维度 code 与文档"七维+研报中心=8维度"描述一致。

---

### 3. 组件依赖一致性检查

#### 3a) SevenDimConfigPage 导入的 Store 方法是否都在 Store 中定义 — ? 通过

`src/pages/input/SevenDimConfigPage.tsx` 使用的 Store 方法/派生计算：

| 方法 | Store 定义行号 | 状态 |
|------|----------------|------|
| `enabledCount()` | `sevenDimConfigStore.ts:58, 121` | ? |
| `monthlyCallEstimate()` | `sevenDimConfigStore.ts:60, 123` | ? |
| `isClickable()` | `sevenDimConfigStore.ts:62, 126` | ? |
| `tooltipText()` | `sevenDimConfigStore.ts:64, 131` | ? |
| `applyTemplate()` | `sevenDimConfigStore.ts:68, 139` | ? |
| `toggleDimension()` | `sevenDimConfigStore.ts:70, 159` | ? |
| `setSymbolCount()` | `sevenDimConfigStore.ts:76, 193` | ? |
| `setHistoryDays()` | `sevenDimConfigStore.ts:78, 199` | ? |
| `reset()` | `sevenDimConfigStore.ts:80, 204` | ? |
| `saveConfig()` | `sevenDimConfigStore.ts:82, 219` | ? |
| `runCollection()` | `sevenDimConfigStore.ts:84, 246` | ? |
| `clearError()` | `sevenDimConfigStore.ts:86, 275` | ? |

**结论**：页面调用的所有方法均在 Store 中定义。

#### 3b) SevenDimConfigPage 导入的配置常量是否都在 collectConfig 中导出 — ? 通过

`SevenDimConfigPage.tsx:43-55` 导入项检查：

| 导入项 | collectConfig.ts 导出 | 状态 |
|--------|----------------------|------|
| `STRATEGY_TEMPLATES` | `collectConfig.ts:143` | ? |
| `DEFAULT_DIMENSIONS` | `collectConfig.ts:195` | ? |
| `FREQUENCY_LABELS` | `collectConfig.ts:31` | ? |
| `DATA_SOURCE_LABELS` | `collectConfig.ts:63` | ? |
| `STORAGE_TYPE_LABELS` | `collectConfig.ts:78` | ? |
| `IMPORTANCE_LABELS` | `collectConfig.ts:89` | ? |
| `IMPORTANCE_BADGE_VARIANT` | `collectConfig.ts:309` | ? |
| `DIMENSION_COLORS` | `collectConfig.ts:298` | ? |
| `GLOBAL_LIMITS` | `collectConfig.ts:320` | ? |
| `StrategyTemplateId` (type) | `collectConfig.ts:127` | ? |
| `UpdateFrequency` (type) | `collectConfig.ts:19` | ? |

**结论**：所有导入项均在 `collectConfig.ts` 中导出。

#### 3c) SevenDimConfigPage 使用的UI组件是否都在组件库指南中有记录 — ? 不一致

`SevenDimConfigPage.tsx` 使用的UI组件 vs `./component-library-guide.md` 记录：

| UI组件 | 组件库指南记录 | 状态 |
|--------|----------------|------|
| `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` | ? 第183-185行 | 通过 |
| `Button` | ? 第42-46行 | 通过 |
| `Switch` | ? 第92-104行 | 通过 |
| `Input` | ? 第55-72行 | 通过 |
| `Separator` | ? 第187-189行 | 通过 |
| `ErrorBoundary` | ? 未记录 | 不一致 |
| **`Badge`** | ? **未记录** | **不一致** |
| **`Label`** | ? **未记录** | **不一致** |
| **`Progress`** | ? **未记录** | **不一致** |
| **`Breadcrumb` 及子组件** | ? **未记录** | **不一致** |

**不一致点**：
- `./component-library-guide.md` 组件清单缺少 `Badge`、`Label`、`Progress`、`Breadcrumb` 四个组件的文档条目，而这些组件在 `src/components/ui/` 下已实现且被 SevenDimConfigPage 使用。

**修复建议**：在 `component-library-guide.md` "基础组件"或"反馈组件"/"布局组件"章节补入 `Badge`、`Label`、`Progress`、`Breadcrumb` 的 Props、变体、无障碍属性与使用示例。

#### 3d) Store 的 action 方法是否都在页面中被调用 — ? 不一致

`sevenDimConfigStore.ts` 定义的 action 方法在页面中的调用情况：

| Action | 页面调用 | 状态 |
|--------|----------|------|
| `applyTemplate()` | ? `SevenDimConfigPage.tsx:282` | 通过 |
| `toggleDimension()` | ? `SevenDimConfigPage.tsx:320` | 通过 |
| `setDimensionFrequency()` | ? **未调用** | **不一致** |
| `setDimensionSources()` | ? **未调用** | **不一致** |
| `setSymbolCount()` | ? `SevenDimConfigPage.tsx:344` | 通过 |
| `setHistoryDays()` | ? `SevenDimConfigPage.tsx:359` | 通过 |
| `reset()` | ? `SevenDimConfigPage.tsx:421` | 通过 |
| `saveConfig()` | ? `SevenDimConfigPage.tsx:413` | 通过 |
| `runCollection()` | ? `SevenDimConfigPage.tsx:405` | 通过 |
| `clearError()` | ? `SevenDimConfigPage.tsx:249` | 通过 |

**不一致点**：
- `setDimensionFrequency` 和 `setDimensionSources` 两个 action 在 Store 中定义且有单元测试覆盖，但 `SevenDimConfigPage` 未提供修改维度频率和数据源的 UI 控件，导致这两个 action 在页面层无法被用户触发。
- 这与 `data-collection-route-ui-audit.md:206-207` 记录的"SevenDimConfigPage 功能不完整 / 缺采集方案整合面板"问题对应。

**修复建议**：
- 方案A（补全UI）：在 `DimensionRow` 组件中增加频率下拉选择和数据源多选控件，调用 `setDimensionFrequency` / `setDimensionSources`。
- 方案B（标注为预期）：若当前版本刻意省略，在 Store 注释中说明这两个 action 为后续版本预留。

---

### 4. 测试覆盖一致性检查

#### 4a) Store 测试是否覆盖了所有 Store action 方法 — ? 通过

`tests/__tests__/sevenDimConfigStore.test.ts` 覆盖情况：

| Action | 测试用例 | 行号 |
|--------|----------|------|
| `applyTemplate` | ? 5个模板 + 无效ID + isDirty + historyDays | 60-110 |
| `toggleDimension` | ? 禁用/启用/连续切换/不存在code/全禁用 | 113-152 |
| `setDimensionFrequency` | ? 设置频率 + isDirty + 不存在维度 | 156-183 |
| `setDimensionSources` | ? 设置数据源 + isDirty | 167-183 |
| `setSymbolCount` | ? 正常值 + isDirty + 上下限边界 | 187-209 |
| `setHistoryDays` | ? 正常值 + 上下限边界 | 212-225 |
| `reset` | ? 恢复所有字段 | 278-313 |
| `saveConfig` | ? 成功 + isDirty恢复 + 重复调用拦截 | 316-334 |
| `runCollection` | ? 完成 + 进度100 + 重复调用拦截 | 337-352 |
| `clearError` | ? 清除错误 | 355-360 |
| `enabledCount` | ? 派生计算 | 229-233 |
| `monthlyCallEstimate` | ? >0 + 全禁用=0 | 235-246 |
| `isClickable` | ? 初始 + isSaving + isCollecting | 248-260 |
| `tooltipText` | ? 三态 | 262-275 |

**结论**：Store 测试覆盖全部 10 个 action 和 4 个派生计算，覆盖率 100%。

#### 4b) 组件测试是否覆盖了所有主要用户交互 — ?? 部分一致

`tests/__tests__/SevenDimConfigPage.test.tsx` 覆盖情况：

| 交互场景 | 覆盖 | 行号 |
|----------|------|------|
| 页面渲染（标题/面包屑/分区） | ? | 49-95 |
| 策略模板卡片渲染 | ? | 97-128 |
| 维度开关面板渲染 | ? | 130-182 |
| 模板切换交互（5模板） | ? | 184-229 |
| 维度 Switch 切换交互 | ? | 231-263 |
| 全局参数输入（标的数/历史天数） | ? | 265-296 |
| 额度预估显示 | ? | 298-329 |
| 操作按钮（采集/保存/重置/禁用态） | ? | 331-368 |
| 边界测试（全禁用/错误/进度条/保存中） | ? | 370-430 |
| 可访问性（h1/h2/Label/链接） | ? | 432-465 |
| **维度频率修改交互** | ? | — |
| **维度数据源修改交互** | ? | — |

**部分一致点**：
- 维度频率和数据源修改交互未覆盖，根因是页面本身未提供对应 UI（见 3d），属同源问题。
- 测试本身质量良好，已覆盖页面提供的全部交互。

#### 4c) 测试中使用的 mock 数据是否符合 collectConfig 中的类型定义 — ? 通过

**结论**：
- 测试未使用独立 mock 数据，而是直接导入真实配置常量 `STRATEGY_TEMPLATES`、`GLOBAL_LIMITS`、`DEFAULT_DIMENSIONS`（`sevenDimConfigStore.test.ts:17`、`SevenDimConfigPage.test.tsx:22`）。
- 通过 `useSevenDimConfigStore.getState().reset()` 重置为基于 `DEFAULT_DIMENSIONS` 的真实初始状态。
- mock 仅限 `ErrorBoundary` 和 `logger`（`SevenDimConfigPage.test.tsx:25-32`），不涉及业务数据类型。
- 数据形态完全符合 `collectConfig.ts` 的类型定义。

#### 4d) 测试文件导入的模块是否与源文件导出一致 — ? 通过

| 测试文件 | 导入项 | 源文件导出 | 状态 |
|----------|--------|------------|------|
| `sevenDimConfigStore.test.ts:16` | `useSevenDimConfigStore` | `sevenDimConfigStore.ts:108` | ? |
| `sevenDimConfigStore.test.ts:17` | `STRATEGY_TEMPLATES` | `collectConfig.ts:143` | ? |
| `sevenDimConfigStore.test.ts:17` | `GLOBAL_LIMITS` | `collectConfig.ts:320` | ? |
| `SevenDimConfigPage.test.tsx:20` | `SevenDimConfigPage` (default) | `SevenDimConfigPage.tsx:185` | ? |
| `SevenDimConfigPage.test.tsx:21` | `useSevenDimConfigStore` | `sevenDimConfigStore.ts:108` | ? |
| `SevenDimConfigPage.test.tsx:22` | `STRATEGY_TEMPLATES` | `collectConfig.ts:143` | ? |
| `SevenDimConfigPage.test.tsx:22` | `DEFAULT_DIMENSIONS` | `collectConfig.ts:195` | ? |

**结论**：全部导入项与源文件导出一致。

---

### 5. 文档版本号一致性检查

#### 5a) 所有文档的版本号是否一致或合理递进 — ? 不一致

| 文件 | 版本号 | 日期 | 状态 |
|------|--------|------|------|
| `package.json:4` | `0.9.17` | — | 基准 |
| `README.md:3` | `v0.9.17` | — | ? 与 package.json 一致 |
| `CHANGELOG.md:8` | `Unreleased` | 2026-07-01 | ?? 见下 |
| `CHANGELOG.md:409` | 最新发布 `0.9.6` | 2026-06-29 | ? 落后 |
| `docs/06-routing-specs.md:4` | `v1.5.0` | 2026-07-01 | ?? 见下 |
| `docs/06-routing-specs.md:281` | 第9节自称 `v1.2.0` | — | ? 内部矛盾 |
| `docs/data-dictionary-index.md:4` | `v2.2.0` | 2026-06-30 | 文档独立版本号 |

**不一致点**：
1. **CHANGELOG 落后**：`package.json` 为 `0.9.17`，但 `../../../CHANGELOG.md` 最新发布版本仅到 `0.9.6`（2026-06-29），中间 `0.9.7`~`0.9.17` 共 11 个版本未在 CHANGELOG 记录。`Unreleased` 部分未提及七维采集配置模块的新增。
2. **06-routing-specs.md 内部版本矛盾**：文件头（第4行）声明 `Version: v1.5.0`，但第9节（第281行）自称"本文档当前版本为 `v1.2.0`"，且第9节描述的"29 条路由"与第2.1节的"31 条"矛盾。
3. **CHANGELOG 未记录七维采集模块**：`Unreleased` 段落（第8-80行）未包含 `collectConfig.ts`、`sevenDimConfigStore.ts`、`SevenDimConfigPage.tsx`、`/input/seven-dim` 路由等相关新增条目。

**修复建议**：
1. 在 `../../../CHANGELOG.md` `Unreleased` 段补入七维采集配置模块的 Added 条目（collectConfig / Store / Page / Tests）。
2. 统一 `../../reference/06-routing-specs.md` 版本号：将第9节的 `v1.2.0` 更新为 `v1.5.0`，并更新版本比对说明。
3. 待 `/input/seven-dim` 路由注册后，更新第9节路由数为 32。

#### 5b) 日期是否统一为 2026-07-01 — ?? 部分一致

| 文件 | 日期 | 状态 |
|------|------|------|
| `docs/06-routing-specs.md:5` | 2026-07-01 | ? |
| `../../../CHANGELOG.md` Unreleased | 2026-07-01 | ? |
| `docs/data-dictionary-index.md:6` | 2026-06-30 | ?? 落后1天 |
| `docs/data-dictionary-index.md:7` (Scan Time) | 2026-06-30 23:07:32 | ?? 落后 |

**部分一致点**：
- `data-dictionary-index.md` 日期为 2026-06-30，未同步至 2026-07-01，且该文档未纳入七维采集配置模块的字典条目（见 2a/2b）。

**修复建议**：在补入七维采集配置模块数据字典条目后，将 `data-dictionary-index.md` 的 `Last Updated` 更新为 2026-07-01。

---

## 三、不一致项汇总与优先级

| 编号 | 优先级 | 不一致项 | 涉及文件 | 行号 | 修复建议 |
|------|--------|----------|----------|------|----------|
| D-01 | ?? 高 | `/input/seven-dim` 未在 ROUTE_REGISTRY 注册 | `src/config/routes.ts` | 202行后 | ? 已修复（2026-07-01） |
| D-02 | ?? 高 | `/input/seven-dim` 未在路由规格文档列出 | `../../reference/06-routing-specs.md` | 2.1/3.2/8节 | ? 已修复（2026-07-01） |
| D-03 | ?? 高 | CHANGELOG 未记录七维采集模块新增 | `../../../CHANGELOG.md` | Unreleased段 | 补入 Added 条目 |
| D-04 | ?? 高 | 数据字典未登记 collectConfig / sevenDimConfigStore | `../../reference/data-dictionary-index.md` | 模块索引表 | 新增模块字典条目 |
| D-05 | ?? 中 | types.ts 的 DataDimensionType 缺 `08_research` | `src/data/types.ts` | 694-702 | ? 已修复（2026-07-01） |
| D-06 | ?? 中 | 06-routing-specs.md 第9节路由数 29 vs 31 矛盾 | `../../reference/06-routing-specs.md` | 288 | ? 已修复（2026-07-01） |
| D-07 | ?? 中 | 06-routing-specs.md 版本号 v1.5.0 vs v1.2.0 矛盾 | `../../reference/06-routing-specs.md` | 4 vs 281 | ? 已修复（2026-07-01） |
| D-08 | ?? 中 | 第8节残留 `/analysis/news-v6` 已删路由 | `../../reference/06-routing-specs.md` | 263 | ? 已修复（2026-07-01） |
| D-09 | ?? 中 | 组件库指南缺 Badge/Label/Progress/Breadcrumb | `./component-library-guide.md` | 组件清单 | 补入组件文档 |
| D-10 | ?? 低 | Store 的 setDimensionFrequency/setDimensionSources 未在页面调用 | `src/pages/input/SevenDimConfigPage.tsx` | — | 补全UI或标注预留 |
| D-11 | ?? 低 | CHANGELOG 最新发布版本 0.9.6 落后于 package.json 0.9.17 | `../../../CHANGELOG.md` | 409 | 补齐中间版本记录 |
| D-12 | ?? 低 | DATA_DICTIONARY_INDEX 日期 2026-06-30 | `../../reference/data-dictionary-index.md` | 6 | 更新为 2026-07-01 |

---

## 四、通过项确认

| 检查项 | 结果 |
|--------|------|
| 2d) DEFAULT_DIMENSIONS 8维度code与文档一致 | ? |
| 3a) SevenDimConfigPage 导入的 Store 方法均已定义 | ? |
| 3b) SevenDimConfigPage 导入的配置常量均已导出 | ? |
| 4a) Store 测试覆盖全部 action（100%） | ? |
| 4c) 测试数据符合 collectConfig 类型定义 | ? |
| 4d) 测试导入与源文件导出一致 | ? |

---

## 五、修复优先级建议

### P0（即时修复）
1. **D-01**：? 已完成（2026-07-01）— 在 `src/config/routes.ts` 注册 `/input/seven-dim` 路由（与 `data-collection-route-ui-audit.md` F-01 对应）。
2. **D-02**：? 已完成（2026-07-01）— 在 `../../reference/06-routing-specs.md` 补入 `/input/seven-dim` 路由条目。
3. **D-03**：? 已完成（2026-07-01）— 在 `../../../CHANGELOG.md` Unreleased 段补入七维采集配置模块的 Added 记录。
4. **D-04**：在数据字典中登记 collectConfig 与 sevenDimConfigStore 的类型与字段。

### P1（短期修复）
5. **D-05**：? 已完成（2026-07-01）— 扩展 `DataDimensionType` 至 8 维度。
6. **D-06/D-07/D-08**：? 已完成（2026-07-01）— 统一 `06-routing-specs.md` 内部路由数、版本号，清理已删路由残留。
7. **D-09**：? 已完成（2026-07-01）— 补全组件库指南的组件文档。

### P2（后续完善）
8. **D-10**：补全 SevenDimConfigPage 的维度频率/数据源修改 UI。
9. **D-11/D-12**：补齐 CHANGELOG 版本记录与数据字典日期。

---

## 六、附录：检查文件清单

| 文件 | 用途 |
|------|------|
| `src/config/routes.ts` | ROUTE_REGISTRY 路由注册表 |
| `src/apps/input/InputApp.tsx` | 输入舱子路由分发 |
| `../../reference/06-routing-specs.md` | 路由规格文档 |
| `src/apps/input/InputApp.tsx` | Hub页面模块卡片 |
| `src/config/collectConfig.ts` | 七维采集配置常量 |
| `src/store/sevenDimConfigStore.ts` | 七维采集配置 Store |
| `src/data/types.ts` | 全局类型定义 |
| `../../reference/data-dictionary-index.md` | 数据字典索引 |
| `src/pages/input/SevenDimConfigPage.tsx` | 七维采集配置页面 |
| `./component-library-guide.md` | 组件库指南 |
| `tests/__tests__/sevenDimConfigStore.test.ts` | Store 单元测试 |
| `tests/__tests__/SevenDimConfigPage.test.tsx` | 页面组件测试 |
| `package.json` | 项目版本 |
| `../../../CHANGELOG.md` | 更新日志 |
| `../../../README.md` | 项目说明 |
| `src/components/atoms/Switch.tsx` | Switch 组件源码（辅助核对） |
| `../../reference/data-collection-route-ui-audit.md` | 数据采集路由UI审计（参考） |
| `./data-collection-gap-analysis.md` | 数据采集差距分析（参考） |

---

*报告结束*
