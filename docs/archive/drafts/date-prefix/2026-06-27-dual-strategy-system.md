---
title: ADR-009: 引入热门板块与价值洼地双策略体系
version: v0.9.0
last_updated: 2026-06-27
maintainer: V9 Architecture Team
status: active
change_log:
  - version: v0.9.0
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-06-27
  - date: 2026-06-27
    author: Kimi Code CLI
    desc: 依据用户输入的双策略规格创建 ADR，明确与 ADR-008 主题策略的关系
---

# ADR-009: 引入热门板块与价值洼地双策略体系

- **状态**：已接受 / Accepted
- **日期**：2026-06-27
- **决策人**：V9 Architecture Team

---

## 背景

V9 当前已通过 ADR-008 引入「第四次工业革命稀缺核心资源」主题策略，并在 `src/services/trading/strategyEngine.ts` 中实现 `core-scarce / value-bargain / hot-momentum / excluded` 四分类选股逻辑。该实现以 V6 综合评分、行业评分、热门板块排名为输入，输出入选标的组合。

用户进一步提出希望系统支持「双策略体系」：

- **热门板块策略**：板块已在动，跟着趋势走；持有期短、止损紧、止盈快；
- **价值洼地策略**：等板块开始动了再进；持有期长、分步建仓、逐步止盈。

该体系要求：

1. 独立的 `HotSectorScore` 与 `ValuePitScore` 评分输出；
2. 各自独立的五维评分因子；
3. 价值洼地路径配套「轮动信号检测引擎」；
4. 驾驶舱新增 `HotSectorWidget`、`ValuePitWidget`；
5. 数据流通道支持策略评分的实时订阅与刷新。

本 ADR 讨论是否引入该双策略体系、以何种架构方式引入，以及与现有 ADR-008 的边界。

---

## 目标

1. 在 V9 中支持「热门板块策略」与「价值洼地策略」两条独立选股路径；
2. 输出结构化的 `HotSectorScore` / `ValuePitScore`，支持持久化、订阅、复盘；
3. 价值洼地路径支持「未触发轮动信号则加入观察池」的流转逻辑；
4. 驾驶舱可实时展示双策略评分与候选标的；
5. 保持 V9 架构原则：跨模块写操作走 `DataBridge`、L5/L4 不直接写 `dataLayer`、配置层禁止依赖引擎层。

---

## 选项

### 选项 A：新增独立 Store + 独立 Analyzer + dualStrategyEngine 编排（推荐）

- 新增 `hot_sector_scores`、`value_pit_scores` 两个 IndexedDB Store；
- 新增 `src/services/scoring/hotSectorAnalyzer.ts`、`valuePitAnalyzer.ts`、`rotationSignalDetector.ts`；
- 新增 `src/services/trading/dualStrategyEngine.ts` 作为编排入口；
- 新增 `src/config/dualStrategyRules.ts` 承载双策略阈值；
- 驾驶舱新增 `HotSectorWidget`、`ValuePitWidget`，走 `MarketDataProvider` 统一数据管线；
- 新增 `SAVE_HOT_SECTOR_SCORES`、`SAVE_VALUE_PIT_SCORES` DataBridge action，ACL 授权给 `analyzer` / `tradinghub`。

| 优点 | 缺点 |
|---|---|
| 架构清晰，策略评分与通用 V6 评分解耦 | 初期需要新增 Store、DataBridge action、ACL 条目 |
| 便于未来做评分历史序列、回测、多策略并行 | 需要 DB_VERSION 升级与迁移逻辑 |
| 数据血缘清晰，独立 action 与 Store | 开发和测试工作量略大 |
| 与现有 `strategyEngine.ts` 可并存，不破坏既有接口 | |

### 选项 B：扩展 `v6_scores` Store + 复用 `strategyEngine.ts`

- 在 `V6Score` 类型中扩展 `hotSectorScore` / `valuePitScore` 可选字段；
- 继续使用 `v6_scores` Store 与 `SAVE_SCORES` action；
- 直接修改 `strategyEngine.ts`，在现有分类逻辑中嵌入双策略五维评分计算。

| 优点 | 缺点 |
|---|---|
| 初期开发快，无需新增 Store/Action/ACL | 污染通用 `V6Score` 语义，使其变成「上帝对象」 |
| 无需 DB_VERSION 升级 | 热门/洼地评分与 V6 评分生命周期被迫耦合 |
| | 未来拆分成本中到高（3–10 人天，取决于消费端数量） |
| | 数据血缘模糊，审计与调试困难 |

### 选项 C：仅 Analyzer + Widget，不持久化

- 新增 Analyzer 计算双评分；
- 驾驶舱 Widget 直接订阅 Analyzer 输出；
- 不写入 IndexedDB，数据仅在内存中流转。

| 优点 | 缺点 |
|---|---|
| 最快出 Demo，1–2 天可落地 | 破坏数据流一致性 |
| 无需 DB 升级 | 无法复盘、回测、离线使用 |
| | 驾驶舱刷新后数据丢失 |

---

## 决策

**推荐选项 A**：新增独立 Store + 独立 Analyzer + `dualStrategyEngine` 编排。

### 决策理由

1. **架构一致性**：V9 已建立 DataBridge + ACL + 五层架构，独立 Store 与独立 action 最符合既有约束。
2. **语义清晰**：`HotSectorScore` / `ValuePitScore` 是策略层派生数据，与通用 `V6Score` 职责不同，应分离。
3. **未来可扩展**：独立 Store 便于后续做评分历史序列、策略回测、多策略并行。
4. **与 ADR-008 兼容**：ADR-008 的「第四次工业革命稀缺核心资源」主题策略可作为热门/核心路径的输入之一；双策略体系是更上层的框架，二者不是替代关系。
5. **风险可控**：分阶段 MVP 可先验证双策略引擎，再逐步补齐 Widget 与交易执行差异化。

---

## 实施范围

### 第一阶段：数据层与配置层

1. **Schema 变更**
   - `src/data/types.ts`：新增 `HotSectorScore`、`ValuePitScore` 类型；
   - `src/config/dbConfig.ts`：新增 Store、Envelope Action、ACL 条目，DB_VERSION 升级到 `14`；
   - `src/data/db.ts`：在 `onupgradeneeded` 中创建新 Store 与索引；
   - `src/core/databridge.ts`：增加新 action 的路由；
   - `src/data/dataLayer.ts`：新增 `hotSectorScoreStore`、`valuePitScoreStore` helper。

2. **配置层**
   - 新建 `src/config/dualStrategyRules.ts`，定义热门/洼地进入阈值、动作阈值、轮动信号条件。

### 第二阶段：分析引擎

1. `src/services/scoring/hotSectorAnalyzer.ts`：
   - 输入：股票列表 + 市场热点；
   - 输出：`HotSectorScore[]`（momentum / sentiment / technical / valuation / composite 五维）。
2. `src/services/scoring/valuePitAnalyzer.ts`：
   - 输入：股票列表；
   - 输出：`ValuePitScore[]`（catalyst / valuation / chip / rotation / liquidity 五维，rotation 复用 `rotationScoreService.ts`）。
3. `src/services/scoring/rotationSignalDetector.ts`：
   - 对 `ValuePitScore` 候选检测成交量放大 + 资金净流入 + 技术金叉；
   - 命中：生成 `TradingSignal`；
   - 未命中：返回观察池候选。
4. `src/services/trading/dualStrategyEngine.ts`：
   - 编排 Analyzer 与 Detector；
   - 输出 `DualStrategyResult`。

### 第三阶段：驾驶舱 Widget

1. 扩展 `src/types/modules/widget.types.ts`、`MarketDataAdapter.ts`、`MockCollector.ts`；
2. 新增 `src/cockpit/widgets/HotSectorWidget.tsx`、`ValuePitWidget.tsx`；
3. 在 `widgetRegistry.ts`、`cockpit.constants.ts` 注册并配置默认布局。

### 第四阶段：文档与测试

1. 更新 `docs/explanation/03-architecture-standards.md`、`docs/explanation/05-engine-specs.md`、`docs/reference/10-glossary.md`；
2. 新增单元测试与集成测试；
3. 运行质量门禁：`lint`、`test`、`build`、`audit`。

---

## 与 ADR-008 的关系

| 维度 | ADR-008 | ADR-009 |
|---|---|---|
| 定位 | 主题持仓策略 | 双策略选股框架 |
| 核心输入 | 主题注册表 + V6/行业评分 | 市场热点 + V6/行业/轮动评分 |
| 输出 | 主题持仓组合 | HotSectorScore / ValuePitScore / TradingSignal |
| 关系 | 被 ADR-009 复用：主题匹配可作为热门/核心路径的过滤条件之一 | 上层框架，可调用 ADR-008 相关服务 |

**兼容性保证**：

- 保留 `strategyEngine.ts` 现有接口不变；
- `portfolioBuilder.ts` 可继续消费 `StrategyResult`；
- 研究体系不依赖交易层：删除 `src/services/trading/` 后，输入舱/分析舱功能完整运行。

---

## 后果

### 正面后果

- V9 从单一主题策略升级为「热门板块 + 价值洼地」双路径选股体系；
- 驾驶舱展示层与分析引擎形成更完整的投研闭环；
- 独立 Store 为后续策略回测、绩效归因提供数据基础。

### 负面后果与风险

- IndexedDB Schema 变更需要迁移逻辑，老用户数据需兼容；
- V6 评分当前仍部分依赖模拟数据，双策略输出质量受数据质量影响；
- 新增 2 个 Widget 可能增加驾驶舱首屏加载时间，需验证懒加载效果。

### 兼容性

- 写操作仍走 `DataBridge.forward()`；
- L5/L4 不直接写 `dataLayer`；
- 配置层不依赖引擎层。

---

## 相关文档

- `docs/explanation/implementation/dual-strategy-dataflow-spec.md`
- `docs/explanation/implementation/dual-strategy-gap-analysis.md`
- `docs/explanation/implementation/adr/2026-06-24-adopt-v6-core-resource-trading-strategy.md`
- `docs/explanation/03-architecture-standards.md`
- `docs/explanation/05-engine-specs.md`
- `docs/reference/10-glossary.md`
- `docs/guides/08-implementation-plan.md`

---

## 实施状态

- [x] ADR-009 评审通过
- [ ] 更新 `src/data/types.ts`（新增 HotSectorScore / ValuePitScore）
- [ ] 更新 `src/config/dbConfig.ts`（Store / Action / ACL / DB_VERSION）
- [ ] 更新 `src/data/db.ts`（升级脚本）
- [ ] 更新 `src/core/databridge.ts`（action 路由）
- [ ] 更新 `src/data/dataLayer.ts`（Store helper）
- [ ] 新建 `src/config/dualStrategyRules.ts`
- [ ] 新建 `src/services/scoring/hotSectorAnalyzer.ts`
- [ ] 新建 `src/services/scoring/valuePitAnalyzer.ts`
- [ ] 新建 `src/services/scoring/rotationSignalDetector.ts`
- [ ] 新建 `src/services/trading/dualStrategyEngine.ts`
- [ ] 新建 `src/cockpit/widgets/HotSectorWidget.tsx`
- [ ] 新建 `src/cockpit/widgets/ValuePitWidget.tsx`
- [ ] 更新 `docs/explanation/03-architecture-standards.md`、`docs/explanation/05-engine-specs.md`、`docs/reference/10-glossary.md`
- [ ] 新增测试并确保质量门禁通过
