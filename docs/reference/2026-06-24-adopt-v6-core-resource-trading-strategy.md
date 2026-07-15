---
title: 2026-06-24-adopt-v6-core-resource-trading-strategy
tier: reference
code_version: 2.0.0
---

---
title: ADR-008: 采用 v6-pro-cockpit "第四次工业革命稀缺核心资源" 交易策略
version: v0.9.0
last_updated: 2026-06-24
maintainer: V9 Architecture Team
status: active
change_log:
  - date: 2026-06-24
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）
tier: reference
---
# ADR-008: 采用 v6-pro-cockpit "第四次工业革命稀缺核心资源" 交易策略

- **状态**：已接受 / Accepted
- **日期**：2026-06-24
- **决策人**：待指定

---

## 背景

V9 交易舱当前已实现：
- 基于技术指标的买入/卖出信号生成
- 半 Kelly 仓位计算
- 基础风控（冷却期、仓位上限、数据新鲜度）
- 模拟买入/卖出订单
- 信号持久化（signals Store）

但交易舱与评分系统仍处于解耦状态，无法基于 V6 评分、个股智能评分、行业评分构建主题持仓组合。用户提出希望采纳 `D:/v6-pro-cockpit` 中围绕"第四次工业革命稀缺核心资源"的交易策略，以评分为驱动构建长期核心仓 + 中期战术仓的组合。

`D:/v6-pro-cockpit` 在 V9 文档体系中被标记为 `Future Reference / Deferred`。本 ADR 讨论是否将其中的核心稀缺策略引入 V9，以及引入的范围与方式。

---

## 目标

1. 在 V9 中支持以"第四次工业革命稀缺核心资源"为主题的投资策略。
2. 以 V6 评分、智能评分、行业评分为驱动，构建主题持仓组合。
3. 保持 V9 现有架构原则：跨模块写操作走 DataBridge、L5/L4 不直接写 dataLayer、研究体系不依赖交易层。
4. 不直接复制 `D:/v6-pro-cockpit` 代码，而是基于其策略思想重新实现，并与 V9 现有能力复用。

---

## 选项

### 选项 A：完整迁移 v6-pro-cockpit 交易模块

将 `D:/v6-pro-cockpit` 中的 `TradingOrchestrator`、`V6StrategyEngine`、`PaperTrading`、`PortfolioManager` 等模块整体迁移到 V9。

| 优点 | 缺点 |
|------|------|
| 功能完整，快速获得分步建仓、动态止盈、止损、模拟盘、组合再平衡等能力 | 代码风格、依赖关系与 V9 不一致，需大量适配 |
| 保留原有策略逻辑和参数 | 引入大量外部概念，增加维护复杂度 |
| | 违反外部参考文档管控规则（Future Reference / Deferred 须先 ADR） |

### 选项 B：仅采纳策略思想，按 V9 架构重新实现（推荐）

解析 `D:/v6-pro-cockpit` 的核心稀缺策略规则，在 V9 现有交易舱基础上增量开发：
- 扩展 `Stock` 类型，增加行业/主题字段
- 新增 `themeRegistry.ts` 主题映射配置
- 新增 `portfolioBuilder.ts` 组合构建器
- 扩展 `positionSizer.ts`、`riskEngine.ts`
- 新增 `strategyEngine.ts`、`takeProfitEngine.ts`、`stopLossEngine.ts`
- 分阶段落地，先 MVP 主题持仓组合，再完善策略执行

| 优点 | 缺点 |
|------|------|
| 与 V9 现有架构、ACL、数据协议保持一致 | 开发周期比直接迁移长 |
| 可复用现有 `v6ScoreService`、`industryScoreService`、`screeningEngine`、`stockpoolService` | 需要重新设计部分策略逻辑 |
| 风险可控，便于测试和迭代 | |
| 符合外部参考文档管控规则 | |

### 选项 C：暂缓引入，先完善复盘引擎

继续按原计划先落地复盘引擎（ReviewEngine），待交易复盘能力成熟后再引入主题持仓策略。

| 优点 | 缺点 |
|------|------|
| 保持当前实施节奏，避免交易舱过度扩张 | 无法满足用户当前提出的策略需求 |
| 先补齐交易错误识别、信号-订单血缘等基础 | 主题持仓策略与复盘引擎无强依赖，可并行 |

---

## 决策

**推荐选项 B**：采纳 `D:/v6-pro-cockpit` 中"第四次工业革命稀缺核心资源"策略思想，按 V9 架构重新实现，分阶段落地。

### 决策理由

1. **架构一致性**：V9 已建立 DataBridge + ACL + 五层架构，直接迁移外部代码会破坏既有约束。
2. **能力复用**：V9 已有 V6 评分、行业评分、筛选引擎、股票池流转、信号持久化等能力，可大幅降低实现成本。
3. **风险可控**：分阶段 MVP 可先验证主题持仓组合的可行性，再逐步扩展完整策略引擎。
4. **文档合规**：`D:/v6-pro-cockpit` 作为外部参考，其策略思想经 ADR 评审后可被吸收，避免直接复制代码。

---

## 实施范围

### 第一阶段：核心稀缺主题持仓组合 MVP

1. **Schema 变更**
   - `Stock` 类型增加 `industryCode?: string`、`theme?: string[]`、`sector?: string`。
   - 新增 `Portfolio`、`PortfolioHolding` 类型，持久化到 IndexedDB（新建 `portfolios` Store 或用现有 Store 扩展）。

2. **主题映射**
   - 新建 `src/config/themeRegistry.ts`，定义"第四次工业革命稀缺核心资源"主题。
   - 初始标的池可参考 v6-pro-cockpit 的 8 只核心标的，但需支持 A 股替代（如用 A 股中芯国际、中国移动替代 H 股）。

3. **评分消费**
   - 新建 `src/services/trading/scoringAdapter.ts`，统一读取 V6 / 智能 / 行业评分。

4. **组合构建**
   - 新建 `src/services/trading/portfolioBuilder.ts`：
     - 从 `watching` 池筛选 theme 匹配且综合分 ≥ 4.0 的标的
     - 按 `IndustryScore.sectorSnapshot.positionPct` 分配主题仓位
     - 输出目标持仓（symbol / targetShares / targetWeight）

5. **UI 扩展**
   - 在 `TradingApp` 增加"核心稀缺"面板，展示组合、目标权重、偏离度、再平衡建议。

### 第二阶段：完整策略引擎

1. 新增 `strategyEngine.ts`：20 进 13 筛选、价值洼地、热门追涨分类。
2. 扩展 `positionSizer.ts`：正/倒金字塔加仓计划。
3. 新增 `takeProfitEngine.ts`、`stopLossEngine.ts`：动态止盈、硬止损/移动止损/时间止损。
4. 增强模拟盘：手续费、滑点、印花税、资金扣减、净值曲线、绩效统计。
5. 新增 `tradingOrchestrator.ts`：串联评分→策略筛选→信号→仓位→风控→止损止盈→交易建议。

---

## 后果

### 正面后果

- V9 交易舱从"单票信号"升级为"评分驱动的主题组合管理"。
- 与 V6 评分、行业评分、筛选引擎形成完整投研闭环。
- 为用户提供可跟踪、可复盘的核心稀缺主题持仓方案。

### 负面后果与风险

- IndexedDB Schema 变更需要迁移逻辑，老用户数据需兼容。
- V6 评分当前仍部分依赖模拟数据，策略效果受数据质量影响。
- 主题映射和标的选择需要持续维护，避免静态映射过时。
- 引入港股或 A 股替代方案时需注意市场差异和可用数据。

### 兼容性

- 研究体系仍不依赖交易层：删除交易层后，输入舱/分析舱功能完整运行。
- 写操作仍走 DataBridge：`portfolioBuilder` / `tradingOrchestrator` 不直接写 `dataLayer`。

---

## 相关文档

- `./fourth-industrial-revolution-core-resource-strategy.md`
- `../explanation/trading-core-factors.md`
- `./05-engine-specs.md`
- `./02-functional-specs.md`
- `./10-glossary.md`
- `./08-implementation-plan.md`

---

## 实施状态

- [x] ADR-008 评审通过
- [x] 更新 `src/data/types.ts`（Stock / Portfolio 扩展）
- [x] 新建 `src/config/themeRegistry.ts`
- [x] 新建 `src/services/trading/scoringAdapter.ts`
- [x] 新建 `src/services/trading/portfolioBuilder.ts`
- [ ] 扩展 `src/apps/trading/TradingApp.tsx`（核心稀缺面板）—— Phase 2
- [x] 新增测试 `tests/portfolioBuilder.test.ts`、`tests/themeRegistry.test.ts`、`tests/scoringAdapter.test.ts`、`tests/CoreResourcePanel.test.ts`、`tests/TradingApp.test.tsx` 已扩展
- [x] 更新 `./02-functional-specs.md`、`./05-engine-specs.md`、`./10-glossary.md`
- [x] 质量门禁全部通过（159/159 tests，0 跨层违规）
