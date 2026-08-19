---
title: ADR-009: 引入热门板块与价值洼地双策略体系
type: explanation
domain: architecture
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "状态: Accepted（supersedes ADR-007 部分条款） 决策日期: 2026-06-27 版本: v1.0.0"
tags: [architecture, strategy, adr, dual-strategy, design, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-ARCH-009
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ADR-009: 引入热门板块与价值洼地双策略体系

> **状态**: Accepted（supersedes ADR-007 部分条款）  
> **决策日期**: 2026-06-27  
> **版本**: v1.0.0

---

## 1. 背景（Context）

V9 投研系统需要覆盖两种截然不同的选股逻辑：

- **热门板块策略（Momentum）**：追踪市场热点，筛选动量强势、情绪高涨、技术面突破的板块和个股。适合趋势交易者。
- **价值洼地策略（Value Pit）**：挖掘被市场低估、基本面改善、催化剂临近的标的。适合价值投资者。

ADR-007 曾提出「补齐筛选引擎、信号持久化与复盘引擎」，但仅覆盖单一选股路径，未区分策略类型。随着 V6 核心资源交易策略（ADR-008）的引入，系统需要更完整的策略体系来覆盖不同投资风格。

### 触发条件

- `./2026-06-27-dual-strategy-system.md`（已归档） 提出双策略体系设计。
- 用户反馈：单一评分模型无法同时满足趋势交易和价值投资两种需求。

---

## 2. 决策（Decision）

**引入「热门板块策略」与「价值洼地策略」两条独立选股路径，输出 `HotSectorScore` / `ValuePitScore`，并配套轮动信号检测引擎。**

- **热门板块策略**：五维评分（动量 / 情绪 / 技术 / 估值 / 大盘），16 个指标，输出 `HotSectorScore`。
- **价值洼地策略**：五维评分（催化 / 估值 / 筹码 / 轮动 / 流动性），16 个指标，输出 `ValuePitScore`。
- **轮动信号检测**：比较两个策略的得分，检测共振信号（`rotationSignal`），输出买入/卖出/观望建议。

### 决策理由

- **Why not 单一评分模型**：单一模型无法同时捕捉趋势动量和价值洼地，容易在风格切换期失效。
- **Why not 更多策略**：两条策略已覆盖 80% 的用户需求；更多策略会增加维护成本。
- **与 ADR-007 的关系**：ADR-009 取代 ADR-007 中「热门板块」与「价值洼地」相关条款；ADR-007 的「筛选引擎」和「复盘引擎」条款仍然有效。

---

## 3. 备选方案（Alternatives Considered）

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **A. 双策略体系**（最终选择） | 覆盖趋势+价值两种风格，轮动信号提高胜率 | 代码量增加，需要维护两套评分模型 | ? 采纳 |
| **B. 单一策略 + 参数切换** | 代码量少，维护简单 | 无法同时展示两种视角，切换需重新计算 | ? 否决 |
| **C. 多策略（>2）** | 覆盖更多投资风格 | 维护成本指数级增长，个人开发者难以支撑 | ? 否决 |

---

## 4. 后果（Consequences）

### 正面影响

- 用户可同时查看热门板块和价值洼地两种视角，提高决策质量。
- 轮动信号检测可捕捉风格切换时机，降低单一策略失效风险。
- 五因子十六指标模型为 L3 纯计算层，无副作用，可独立单测。

### 负面影响 / 技术债

- `HotSectorScore` / `ValuePitScore` 类型与 Store 待新增（`v6ScoreService` 需扩展）。
  - **技术债登记**：`./design/tech-debt.md`（已归档） — 「双策略 Store 待新增」。
- Analyzer（`hotSectorAnalyzer.ts`、`valuePitAnalyzer.ts`）与 Widget 待实现。
  - **技术债登记**：`./design/tech-debt.md`（已归档） — 「双策略 Widget 待实现」。
- 计算量翻倍：每次评分需要跑两套模型，浏览器端性能压力增大。
  - **缓解**：使用 Web Worker 跑评分计算；结果缓存于 IndexedDB。

### 影响范围

| 模块 | 影响 |
|------|------|
| `src/services/scoring/` | 新增 `hotSectorAnalyzer.ts`、`valuePitAnalyzer.ts`、`rotationSignalDetector.ts` |
| `src/store/` | 新增 `hotSectorScoreStore`、`valuePitScoreStore`、`rotationSignalStore` |
| `src/pages/analysis/` | 新增「热门板块」和「价值洼地」页面/Widget |
| `src/data/db-schema.ts` | 新增 `hot_sector_scores`、`value_pit_scores`、`rotation_scores` Store |

---

## 5. 实施与验证

### 实施步骤

- [x] Step 1：定义五因子十六指标模型（`hotSectorDimensions.ts`、`valuePitDimensions.ts`）
- [x] Step 2：实现 `hotSectorAnalyzer.ts` 和 `valuePitAnalyzer.ts`（L3 纯计算层）
- [x] Step 3：实现 `rotationSignalDetector.ts`（共振检测）
- [ ] Step 4：新增 `HotSectorScore` / `ValuePitScore` 类型和 Store
- [ ] Step 5：实现分析页面 Widget（热门板块看板、价值洼地列表）
- [ ] Step 6：补充集成测试（双策略联动、轮动信号触发）

### 验证命令

```bash
npm run test:clean    # 验证核心测试（含 scoring 测试）
npm run audit:layers  # 验证 scoring → core/data 无跨层调用
```

---

## 6. 关联文档

| 文档 | 路径 |
|------|------|
| ADR-007（被取代） | `adr-007-screening-signal-persistence-review.md` |
| ADR-008（V6 策略） | `adr-008-v6-core-resource-trading-strategy.md` |
| 引擎规格 | `../explanation/05-engine-specs.md` §2.5 |
| 舱室总览 | `./cabins-overview.md`（已归档） §4 |
| 双策略原始设计 | `./2026-06-27-dual-strategy-system.md`（已归档） |

---

## 7. 状态变更记录

| 日期 | 状态 | 变更人 | 备注 |
|------|------|--------|------|
| 2026-06-27 | proposed | @architect | 初始提案 |
| 2026-06-27 | accepted | 架构组 | 取代 ADR-007 部分条款 |
| 2026-07-12 | accepted | docs 治理组 | 扩写为完整 ADR v1.0.0 |
