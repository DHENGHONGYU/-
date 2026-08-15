---
title: V9 双策略体系 — 更新日志与一致性检查
type: reference
domain: backend
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "问题来源：用户提出「整体交易策略进行结构性调整，将原先单行的股票选择和交易策略调整为双策略交易策略」，需确认相关文件是否已更新并提供更新日志。 检查范围：DOC..."
tags: [backend, strategy, dual-strategy]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-BACK-024
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 双策略体系 — 更新日志与一致性检查

> **问题来源**：用户提出「整体交易策略进行结构性调整，将原先单行的股票选择和交易策略调整为双策略交易策略」，需确认相关文件是否已更新并提供更新日志。  
> **检查范围**：DOC 核心文档（`docs/01~10`、`docs/explanation/implementation/*`）、源码实现（`src/services/*`、`src/store/*`、`src/cockpit/*`、`src/pages/*`）、数据层（`src/data/*`）、测试（`tests/*`）。  
> **检查日期**：2026-06-27

---

## 一、结论总览

| 检查项 | 状态 | 说明 |
|:---|:---|:---|
| 双策略核心代码 | ? 已更新 | 存在两套实现，需统一 |
| DOC 核心文档 | ? 已更新 | `03-architecture-standards.md`、`05-engine-specs.md`、`02-functional-specs.md`、`10-glossary.md` 已对齐 |
| ADR | ? 已创建 | `ADR-009` 已接受，但实施状态清单未勾选 |
| 数据层 Schema | ? 已更新 | DB_VERSION 14，新增 `hot_sector_scores` / `value_pit_scores` |
| DataBridge | ? 已更新 | 新增 `REFRESH_HOT_SECTOR_SCORES` / `REFRESH_VALUE_PIT_SCORES` action |
| 驾驶舱 Widget | ? 已更新 | `HotSectorWidget`、`ValuePitWidget` 已注册 |
| 分析舱页面 | ? 已更新 | `/analysis/hot-sectors`、`/analysis/value-pit` 页面已存在 |
| Store | ? 已更新 | `hotSectorStore`、`valuePitStore`、`rotationSignalStore` 已存在 |
| 测试 | ? 已更新 | 单元测试覆盖 `services/scoring/*` 与 `services/trading/*` 两个版本 |
| **一致性风险** | ?? **需整改** | `src/services/trading/*` 与 `src/services/scoring/*` 存在两套并行实现，类型、输入、输出均不一致 |

---

## 二、已更新文件清单（按层级）

### 2.1 架构/文档层

| 文件 | 更新内容 |
|:---|:---|
| `./03-architecture-standards.md` | 新增 §3.3.2 双策略数据流；L3 引擎层增加 HotSectorAnalyzer / ValuePitAnalyzer / RotationSignalDetector / DualStrategyEngine；IndexedDB Schema 增加 `hot_sector_scores` / `value_pit_scores`；D20 偏差项标记为已验收 |
| `./05-engine-specs.md` | 新增 §2.5 双策略评分引擎；明确热门/洼地五维权重；新增轮动信号检测；列出实现文件 |
| `./02-functional-specs.md` | 新增 US-010/US-011 用户故事；新增流程 4「双策略选股 → 评分 → 交易信号」；新增 §2.4.15/§2.4.16 策略功能规格 |
| `./10-glossary.md` | 新增 §10.10 双策略体系术语：热门板块策略、价值洼地策略、HotSectorScore、ValuePitScore、Rotation Signal Detector、Dual Strategy Engine、HotSectorWidget、ValuePitWidget |
| `./v9-system-blueprint.md` | D20 标记为已落地；ADR-009 已接受；双策略数据流规格与差异分析文档索引 |
| `../explanation/design/2026-06-27-dual-strategy-system.md` | ADR-009 创建并 Accepted，决策采用「独立 Store + 独立 Analyzer + dualStrategyEngine 编排」 |
| `./dual-strategy-dataflow-spec.md` | 用户输入规格文档化（proposal） |
| `../explanation/dual-strategy-gap-analysis.md` | 差异分析报告（proposal） |

### 2.2 配置层

| 文件 | 更新内容 |
|:---|:---|
| `src/config/dualStrategyRules.ts` | 新增双策略阈值配置：热门 V6≥3.5 / HotSectorScore 4.0 立即跟进；洼地 V6 2.8–3.5 / ValuePitScore 4.0 立即建仓；轮动信号条件（量比 1.5、资金连续 2 日、价格站上 MA20 3%）；止盈止损配置 |
| `src/config/dbConfig.ts` | DB_VERSION 13→14；新增 `STORE_NAME.hotSectorScores` / `valuePitScores`；新增 `ENVELOPE_ACTION.REFRESH_HOT_SECTOR_SCORES` / `REFRESH_VALUE_PIT_SCORES`；ACL 授权 `analyzer` / `tradinghub` 读写这两个 Store |

### 2.3 数据层

| 文件 | 更新内容 |
|:---|:---|
| `src/data/types.ts` | 新增 `HotSectorScore`、`ValuePitScore`、`DualStrategyResult` 类型（`trading` 版本使用） |
| `src/data/db.ts` | `onupgradeneeded` 中新增 `hot_sector_scores`、`value_pit_scores` Store 及 `by-calculated-at` 索引 |
| `src/data/dataLayer.ts` | 新增 `hotSectorScoreStore`、`valuePitScoreStore` helper（基于 `src/data/types.ts` 类型） |
| `src/core/databridge.ts` | 新增 `STRATEGY_CHANNEL`（`strategy:hotSector` / `strategy:valuePit` / `strategy:rotationSignal`）；新增 `REFRESH_HOT_SECTOR_SCORES`、`REFRESH_VALUE_PIT_SCORES` action 路由，保存到 IndexedDB 并广播 |

### 2.4 策略引擎层（?? 两套实现并存）

#### 版本 A：`src/services/trading/*`（基于 `Stock[]`，持久化到 IndexedDB）

| 文件 | 职责 | 输入 | 输出 |
|:---|:---|:---|:---|
| `src/services/scoring/hotSectorAnalyzer.ts` | 热门板块五维评分 | `Stock[]` | `HotSectorScore[]`（`src/data/types.ts`） |
| `src/services/scoring/valuePitAnalyzer.ts` | 价值洼地五维评分 | `Stock[]` | `ValuePitScore[]`（`src/data/types.ts`） |
| `src/services/scoring/rotationSignalDetector.ts` | 轮动信号检测 | `ValuePitScore[]` | `Signal[]` + watchlistCandidates |
| `src/services/trading/dualStrategyEngine.ts` | 双策略编排 | `Stock[]` | `DualStrategyResult` |

#### 版本 B：`src/services/scoring/*`（基于自定义输入类型，被 DataBridge/页面/Store 使用）

| 文件 | 职责 | 输入 | 输出 |
|:---|:---|:---|:---|
| `src/services/scoring/hotSectorAnalyzer.ts` | 热门板块五维评分 | `HotSectorAnalyzerInput` | `HotSectorScore`（自定义：overallScore/signal/generatedAt） |
| `src/services/scoring/valuePitAnalyzer.ts` | 价值洼地五维评分 | `ValuePitAnalyzerInput` | `ValuePitScore`（自定义：overallScore/status/generatedAt） |
| `src/services/scoring/rotationSignalDetector.ts` | 轮动信号检测 | `RotationSignalInput` | `RotationSignal` |

#### 数据适配器

| 文件 | 更新内容 |
|:---|:---|
| `src/services/fetcher/strategyDataAdapter.ts` | 腾讯 API → `HotSectorAnalyzerInput`；东财 API → `ValuePitAnalyzerInput`；量价数据 → `RotationSignalInput`（均映射到 `services/scoring` 版本） |

### 2.5 状态管理层

| 文件 | 更新内容 |
|:---|:---|
| `src/store/hotSectorStore.ts` | 管理 `services/scoring` 版本的热门板块评分，含默认样本数据 |
| `src/store/valuePitStore.ts` | 管理 `services/scoring` 版本的价值洼地评分，含默认样本数据 |
| `src/store/rotationSignalStore.ts` | 管理 `services/scoring` 版本的轮动信号，含默认样本数据 |

### 2.6 展示层

| 文件 | 更新内容 |
|:---|:---|
| `src/cockpit/widgets/HotSectorWidget.tsx` | 驾驶舱热门板块 Widget，展示 `HotSectorData`（action: immediate/probe/ignore，五维评分） |
| `src/cockpit/widgets/ValuePitWidget.tsx` | 驾驶舱价值洼地 Widget，展示 `ValuePitData`（含轮动信号标记） |
| `src/cockpit/core/widgetRegistry.ts` | 注册 `hotSector`、`valuePit` Widget |
| `src/cockpit/CockpitShell.tsx` | 默认布局包含两个 Widget |
| `src/pages/analysis/HotSectorPage.tsx` | 分析舱「热门板块策略」页面，使用 `services/scoring/hotSectorAnalyzer` + 硬编码样本 |
| `src/pages/analysis/ValuePitPage.tsx` | 分析舱「价值洼地策略」页面，使用 `services/scoring/valuePitAnalyzer` + `services/scoring/rotationSignalDetector` + 硬编码样本 |
| `src/types/modules/widget.types.ts` | 新增 `HotSectorData`、`ValuePitData`，被 Widget 使用 |
| `src/services/data-collector/MarketDataAdapter.ts` | 新增 `hotSectors` / `valuePit` 数据适配分支 |
| `src/services/data-collector/collectors/MockCollector.ts` | 新增 `/hot-sectors`、`/value-pit` 路由，返回 mock 数据 |
| `src/services/stock-analysis/mockStockAnalysisProvider.ts` | 新增 `getHotSectors()` / `getValuePit()` mock 数据生成 |

### 2.7 路由层

| 文件 | 更新内容 |
|:---|:---|
| `src/config/routes.ts` | 新增 `/analysis/hot-sectors`、`/analysis/value-pit` 路由 |
| `./06-routing-specs.md` | 同步新增路由映射（已检查） |

### 2.8 测试层

| 文件 | 覆盖内容 |
|:---|:---|
| `tests/dualStrategyEngine.test.ts` | `services/trading/dualStrategyEngine.ts` |
| `tests/hotSectorAnalyzer.test.ts` | `services/scoring/hotSectorAnalyzer.ts` |
| `tests/valuePitAnalyzer.test.ts` | `services/scoring/valuePitAnalyzer.ts` |
| `tests/rotationSignalDetector.test.ts` | `services/scoring/rotationSignalDetector.ts` |
| `tests/HotSectorWidget.test.tsx` | 驾驶舱 HotSectorWidget |
| `tests/ValuePitWidget.test.tsx` | 驾驶舱 ValuePitWidget |
| `src/services/scoring/hotSectorAnalyzer.test.ts` | 维度评分函数单元测试 |
| `src/services/scoring/valuePitAnalyzer.test.ts` | 维度评分函数单元测试 |
| `src/services/scoring/rotationSignalDetector.test.ts` | 成交量/资金/金叉检测单元测试 |
| `src/services/scoring/hotSectorAnalyzer.test.ts` | `trading` 版本热门板块分析 |
| `src/services/scoring/valuePitAnalyzer.test.ts` | `trading` 版本价值洼地分析 |
| `src/services/scoring/rotationSignalDetector.test.ts` | `trading` 版本轮动信号检测 |

---

## 三、关键一致性检查

### 3.1 ? 已对齐项

| 对齐项 | 说明 |
|:---|:---|
| 文档与实现命名 | `HotSectorScore` / `ValuePitScore` / `RotationSignal` / `DualStrategyEngine` 在文档与代码中命名一致 |
| 五维权重 | 文档与 `services/scoring/*` 实现中热门 35/25/20/15/5、洼地 30/25/20/15/10 权重一致 |
| 阈值 | `src/config/dualStrategyRules.ts` 与 `./05-engine-specs.md`、`./02-functional-specs.md` 阈值一致 |
| 数据层 | `hot_sector_scores` / `value_pit_scores` Store 在 `dbConfig.ts`、`db.ts`、`dataLayer.ts` 中一致 |
| DataBridge | action 名称、channel 名称、ACL 授权在 `dbConfig.ts` 与 `databridge.ts` 中一致 |
| Widget 注册 | `widgetRegistry.ts` 与 `cockpit.constants.ts`（通过 `DEFAULT_WIDGET_CONFIG`）一致 |

### 3.2 ?? 未对齐项 / 架构风险

| 编号 | 问题 | 影响 | 建议 |
|:---|:---|:---|:---|
| UC-001 | **两套并行 Analyzer 实现**：`src/services/trading/*` 与 `src/services/scoring/*` 同时存在，类型、输入、输出均不同 | 维护成本翻倍；文档引用混乱；后续开发者不知道该用哪套 | 保留 `services/scoring` 版本（当前被 DataBridge/页面/Store/适配器使用），将 `services/trading` 版本重构为基于 `services/scoring` 的 Stock→Input 适配 + 编排，或删除 `services/trading` 版本 |
| UC-002 | **ADR-009 实施状态清单未更新**：ADR 中所有复选框仍为 `[ ]`，但代码已实现 | 文档与代码状态不同步 | 更新 ADR-009 实施状态为全部 `[x]`，或注明实际完成项 |
| UC-003 | **DataBridge 使用 scoring 版本**：`databridge.ts` 导入 `services/scoring/hotSectorAnalyzer`，但 IndexedDB 保存的 `hot_sector_scores` Store 类型是 `src/data/types.ts` 中的 `HotSectorScore`（trading 版本类型） | 类型不匹配风险：DataBridge 保存 scoring 版本评分到按 trading 版本类型设计的 Store | 统一类型定义：让 `src/data/types.ts` 的 `HotSectorScore` / `ValuePitScore` 与 Widget 使用的 `HotSectorData` / `ValuePitData` 对齐；或让 DataBridge 保存的数据符合 Store 类型 |
| UC-004 | **页面/Store 使用硬编码样本**：`HotSectorPage`、`ValuePitPage`、`hotSectorStore`、`valuePitStore`、`rotationSignalStore` 内含大量硬编码样本 | 演示可用，但无法反映真实股票池；数据新鲜度无法保证 | 将页面/Store 接入 `dataLayer` 或 `MarketDataProvider`，替换样本数据为真实数据或迁移到 mock provider 统一维护 |
| UC-005 | **双策略引擎未接入交易执行**：`tradingService.ts` / `riskEngine.ts` / `positionSizer.ts` 未读取 `hot_sector_scores` / `value_pit_scores` 或 `DualStrategyResult` | 双策略评分尚未真正驱动下单、仓位、止盈止损 | 在 `tradingService.scanWatchingSignals` 中增加对双策略评分的调用；在 `riskEngine.ts` 中根据标的策略分类读取差异化止盈止损 |
| UC-006 | **`dualStrategyEngine.ts` 未被调用**：除测试外，无其他代码调用 `runDualStrategy` | 编排引擎闲置 | 在合适的入口（如 `tradingService`、`AnalysisHubPage`、驾驶舱数据刷新）调用 `runDualStrategy`，或明确其定位 |
| UC-007 | **Widget 类型与 Store/Engine 类型字段名不一致**：Widget 使用 `action`（immediate/probe/ignore/wait），`services/scoring` 使用 `signal`（buy/hold/avoid）或 `status`（build/test/wait_signal），`services/trading` 使用 `triggerAction`（immediate/probe/wait/ignore） | 数据转换容易遗漏，组件层需要做额外映射 | 统一输出字段为 `action`，并在各 Analyzer 中统一返回 `action` 而非 `signal`/`status`/`triggerAction` |

---

## 四、继续整改建议清单

### 4.1 高优先级（P0）

| 编号 | 任务 | 涉及文件 | 验收标准 |
|:---|:---|:---|:---|
| FIX-001 | 统一双策略 Analyzer 实现 | `src/services/scoring/hotSectorAnalyzer.ts`、`valuePitAnalyzer.ts`、`rotationSignalDetector.ts`、`dualStrategyEngine.ts` | 删除或合并重复实现；`tsc`、`lint`、`test` 全通过 |
| FIX-002 | 统一类型定义 | `src/data/types.ts`、`src/types/modules/widget.types.ts`、`src/services/scoring/*` | `HotSectorScore` / `ValuePitScore` 字段与 Widget 的 `HotSectorData` / `ValuePitData` 一致；消除类型转换警告 |
| FIX-003 | 更新 ADR-009 实施状态 | `../explanation/design/2026-06-27-dual-strategy-system.md` | 所有已实现项勾选为 `[x]`；未实现项（如交易执行差异化）保留为 `[ ]` 并说明计划 |

### 4.2 中优先级（P1）

| 编号 | 任务 | 涉及文件 | 验收标准 |
|:---|:---|:---|:---|
| FIX-004 | 移除页面/Store 中的硬编码样本 | `src/pages/analysis/HotSectorPage.tsx`、`ValuePitPage.tsx`、`src/store/hotSectorStore.ts`、`valuePitStore.ts`、`rotationSignalStore.ts` | 数据来自 `dataLayer` 或 `MarketDataProvider`；删除组件内硬编码样本 |
| FIX-005 | 将 `dualStrategyEngine` 接入实际调用链 | `src/services/trading/tradingService.ts` 或 `src/apps/analysis/AnalysisApp.tsx` | 至少一个真实入口调用 `runDualStrategy`；输出可被 Widget/交易层消费 |
| FIX-006 | 双策略评分驱动交易执行 | `src/services/trading/tradingService.ts`、`riskEngine.ts`、`positionSizer.ts`、`tradingConfig.ts` | `TradingSignal` 增加 `strategy` 字段；风控/仓位读取策略差异化配置 |

### 4.3 低优先级（P2）

| 编号 | 任务 | 涉及文件 | 验收标准 |
|:---|:---|:---|:---|
| FIX-007 | 更新 `./08-implementation-plan.md` 中双策略任务状态 | `./08-implementation-plan.md` | 2.4.1 状态改为 ?? 已验收；补充 FIX-005/FIX-006 后续任务 |
| FIX-008 | 补全 CHANGELOG 双策略条目 | `CHANGELOG.md` | 在 `[Unreleased]` 或新版本中记录双策略落地明细 |

---

## 五、质量门禁验证建议

执行上述整改后，必须跑通：

```bash
npx tsc --noEmit
npm run lint
npm test -- --run
npm run build
npm run audit:layers
npm run audit:hardcode
```

当前基线（参考）：
- `tsc --noEmit`：通过
- `eslint src/ --max-warnings 0`：通过
- `npx vitest run`：64 文件 / 480 用例 通过
- `audit:layers`：0 违规 / 1 警告
- `audit:hardcode`：735（基线 749）

---

## 六、变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|:---|:---|:---|:---|
| 2026-06-27 | v1.0.0 | 基于用户询问，生成双策略体系更新日志与一致性检查文档 | V9 Architecture Team |
