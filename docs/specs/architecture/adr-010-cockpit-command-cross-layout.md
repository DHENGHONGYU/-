---
phase: design
title: ADR-010 Cockpit/Command 职责边界与纵横交叉布局
status: accepted
date: 2026-07-24
doc_id: V9-ADR-010
type: explanation
domain: architecture
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "P0 版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# ADR-010: Cockpit/Command 职责边界与纵横交叉布局

> 本文为 ADR-010 完整归档。摘要见 `docs/specs/architecture/cockpit-command-blueprint.md` §10。

## 状态（Status）

已采纳（Accepted），2026-07-24。

## 背景（Context）

Cockpit 原将 26 个 Widget 平铺成一堵约 6 米高的长墙，与 Command 存在 4 个功能重叠 Widget，category 体系（7 类）偏离蓝图标准（4 类），系统运维 Widget 侵入持仓观察职责域。

代码级探索确认：Command 未直接 `import` 任何 Cockpit Widget，实际耦合仅限于 `MechanismHealth` 共享 Store（两者消费同一 `mechanismHealthStore`）。v2.1.0 代码级审计发现 `agentPerformance` category 偏差（`'agent'` 而非 `'ai'`），已修复。

投资者思维路径为「扫市场 → 筛机会 → 看持仓 → 做决策」，运维者路径为「看健康 → 调 Agent → 管配置」。平铺长墙无法支撑这两条路径的快速定位。

## 决策（Decision）

1. **Cockpit 采用纵横交叉布局（域×视角）**，回归 L5 纯展示层定位。纵轴=业务域（research/market/ai/portfolio），横轴=视角（overview/analysis/signal/risk），首屏以矩阵总览呈现「域×视角」密度，点击下钻至交叉点仅渲染 2–4 个 Widget。
2. **3 个纯系统 Widget 移出 Cockpit 到 Command**（Phase 0 已取消注册，Phase 2 引入 Command 页面）：`engineStatus` → SystemMonitorPage，`systemArchitecture` → HealthDashboardPage，`mechanismHealth` Command 已有自建 Panel。
3. **Widget category 对齐蓝图 4 类标准**（market/portfolio/ai/strategy）— Phase 0 已完成，v2.1.0 修复 `agentPerformance` 遗留偏差。
4. **Command 增强为系统指挥舱**，Hub 页新增运维摘要区（嵌入 EngineStatus / SystemArchitecture / AgentPerformance Widget）。
5. **数据流显式契约化**：Cockpit 只消费 `marketDataStore` + `agentStore`（只读），不写任何 Store；跨模块共享逻辑（评分/统计卡）抽至 `lib/utils` 与共享分子（`MetricCard`），消除跨文件复制。

## 后果（Consequences）

- **正面**：单屏可见 Widget 数从 26 降至 ≤4，消除堆砌；信息架构可导航（域 Rail + 视角 Tab + 矩阵总览）；category 体系标准化；共享逻辑单一源。
- **代价**：引入纵横交叉三层组件（CockpitCrossLayout / CrossMatrixOverview / WidgetSheetDrawer），布局令牌与 `domain`/`perspective` 元数据需随 widget 增减同步维护。
- **风险与对冲**：跨模块共享逻辑若重新散落，将导致组合层退化；已抽至 `lib/utils` 与共享分子，并由交互组件验收 SOP §八（组合层检查清单）持续校验，回归触发 `module-sync-checklist` 门禁。

## 关联文档

- 设计蓝图：`docs/specs/architecture/cockpit-command-blueprint.md`（§10 为本文摘要，§4 为纵横交叉设计）
- 组合层检查清单：`outputs/interaction-component-qa-gate-SOP.md`（已废弃） §八
- 堆砌诊断与方案：`outputs/cockpit-ui-consolidation-analysis-2026-07-24.md`（已废弃）
- 整改与优化落地：`outputs/cockpit-consolidation-p3-p4-2026-07-24.md`（已废弃）
