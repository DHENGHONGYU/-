---
title: ADR-007: 补齐筛选引擎、信号持久化与复盘引擎
type: explanation
domain: architecture
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "ADR-007: 补齐筛选引擎、信号持久化与复盘引擎 - explanation documentation (architecture)"
tags: [architecture, screening, adr, plan, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-ARCH-007
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ADR-007: 补齐筛选引擎、信号持久化与复盘引擎

> **状态**: Accepted（部分条款被 ADR-009 取代）  
> **决策日期**: 2026-06-24  
> **版本**: v1.0.0

---

## 1. 背景（Context）

V9 早期版本中，analysis 舱缺少三个关键引擎：

- **筛选引擎（screening）**：用户无法按条件（如「PE < 20 且 ROE > 15%」）筛选股票。
- **信号持久化（signal）**：交易信号仅存在于内存，刷新后丢失，无法回溯。
- **交易复盘引擎（review）**：用户无法系统性地回顾交易决策，缺乏纪律性分析工具。

这三个引擎是 V6 用户反馈中最高频的需求缺口。

### 触发条件

- `./2026-06-24-pool-screening-signal-persistence-review-engine.md`（已归档） 提出补齐方案。
- 用户调研：80% 用户认为「筛选」和「复盘」是最高优先级功能。

---

## 2. 决策（Decision）

**补齐 `screening`（选股筛选）、`signal`（信号持久化）、`review`（交易复盘）三个引擎。**

- **筛选引擎**：支持多条件组合筛选（基本面 + 技术面 + 资金面 + 消息面 + 估值面），输出符合条件的股票列表。
- **信号持久化**：所有交易信号（买入/卖出/观望）写入 IndexedDB，支持历史回溯和性能评估。
- **交易复盘引擎**：基于订单数据生成复盘报告（错误分类、纪律分析、筹码波动复盘）。

> **注意**：ADR-007 中「热门板块」与「价值洼地」相关条款已被 ADR-009 取代。ADR-009 引入了更完整的双策略评分体系，覆盖并扩展了 ADR-007 中「筛选引擎」的范畴。

### 决策理由

- 三个引擎是用户高频需求，缺失导致 V9 核心功能不完整。
- 三个引擎可独立开发，互不阻塞（screening 和 signal 无依赖，review 依赖 orders Store）。

---

## 3. 备选方案（Alternatives Considered）

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **A. 补齐三引擎**（最终选择） | 满足用户核心需求 | 工作量大，需分阶段交付 | ? 采纳 |
| **B. 仅做筛选** | 工作量小 | 信号和复盘仍缺失，用户满意度低 | ? 否决 |
| **C. 使用第三方筛选服务** | 无需自研 | 数据隐私风险、定制性差、长期依赖 | ? 否决 |

---

## 4. 后果（Consequences）

### 正面影响

- 筛选引擎使用户可按自定义条件选股，提高投研效率。
- 信号持久化支持历史回溯，用户可评估策略有效性。
- 交易复盘引擎帮助用户建立纪律性，减少重复错误。

### 负面影响 / 技术债

- 「热门板块」和「价值洼地」筛选逻辑被 ADR-009 的双策略体系取代，部分代码需要重构。
  - **技术债**：`./design/tech-debt.md`（已归档） — 「ADR-007 筛选逻辑迁移至 ADR-009 双策略」。
- 复盘引擎需要访问订单数据，涉及隐私敏感信息（持仓、盈亏）。
  - **缓解**：数据完全本地存储，不上传任何服务器；提供数据导出加密选项。

### 影响范围

| 模块 | 影响 |
|------|------|
| `src/services/screening/` | 新增筛选引擎 |
| `src/services/analysis/` | 消费筛选结果 |
| `src/store/signalStore/` | 新增信号持久化 Store |
| `src/services/tradeReview/` | 新增复盘引擎（tradeReviewAI） |
| `src/pages/output/` | 新增复盘报告页面 |

---

## 5. 实施与验证

### 实施步骤

- [x] Step 1：实现筛选引擎核心（条件解析 + 股票过滤）
- [x] Step 2：实现信号持久化（signalStore + DataBridge 写入）
- [x] Step 3：实现交易复盘引擎（tradeReviewAI）
- [ ] Step 4：将筛选逻辑迁移至 ADR-009 双策略框架（hotSectorAnalyzer / valuePitAnalyzer）
- [ ] Step 5：复盘引擎 Widget 完善（ discipline analysis、筹码波动）

### 验证命令

```bash
npm run test:clean   # 验证筛选/信号/复盘测试
npm run audit:layers # 验证引擎层依赖合规
```

---

## 6. 关联文档

| 文档 | 路径 |
|------|------|
| ADR-009（取代部分条款） | `adr-009-dual-strategy-system.md` |
| 引擎规格 | `05-engine-specs.md` §3.7-3.8 |
| 原始提案 | `./2026-06-24-pool-screening-signal-persistence-review-engine.md`（已归档） |

---

## 7. 状态变更记录

| 日期 | 状态 | 变更人 | 备注 |
|------|------|--------|------|
| 2026-06-24 | proposed | @architect | 初始提案 |
| 2026-06-24 | accepted | 架构组 | 评审通过 |
| 2026-06-27 | accepted | 架构组 | ADR-009 取代部分条款（热门板块/价值洼地） |
| 2026-07-12 | accepted | docs 治理组 | 扩写为完整 ADR v1.0.0 |
