---
title: cockpit-command-blueprint
tier: T0
status: active
type: spec
domain: architecture
phase: design
doc_id: V9-DOC-ARCH-050
code_version: "2.0.0-rc.1"
last_updated: 2026-07-24
maintainer: V9 Architecture Team
version: v2.0.0
change_log:
  - version: v2.0.0
    changes: "P0 版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-07-24
---

# Cockpit / Command 结构设计蓝图

> **版本**: v2.0.0 | **日期**: 2026-07-24
> **v2.1.0 → v2.2.0 变更**: Phase 1 纵横交叉骨架全部落地（步骤 1.2-1.6 完成）；新增 CockpitCrossLayout + CrossMatrixOverview + WidgetSheetDrawer 三个组件；CockpitShell 从 ReactGridLayout 切换为纵横交叉布局；StockChat/IndustryChain 收为 Sheet 抽屉；WatchlistMovers 复用为 Watchlist 子 Tab（注：该集成实际未落地，WatchlistMoversWidget 及 watchlistMoversService 已于 2026-08-15 作为死代码删除）；tsc 0 错误，24 files / 350 tests 全绿
> **v1.0.0 → v2.0.0 变更**: Phase 0 已落地（26→21 Widget，4 类标准 category，共享 score.ts 抽取）；新增各舱布局校对分析；新增 Cockpit-Command 组件去重与数据流治理；基于 Command 模块实际探索结果修正迁移方案
> **核心原则**: 不重写原子组件代码，仅做排列组合与重新引用；保持数据链条传递的完整性与效率
> **设计哲学**: 从消费者视角出发 — 投资者的思维路径是"扫市场 → 筛机会 → 看持仓 → 做决策"，运维者的路径是"看健康 → 调 Agent → 管配置"

---

## 1. 变更摘要

### 1.1 v2.0.0 → v2.1.0

| 维度 | v2.0.0 状态 | v2.1.0 状态 | 变更依据 |
|------|------------|------------|---------|
| agentPerformance category | `'agent'`（第 5 类，偏离 4 类标准） | **`'ai'`（对齐 4 类标准）** | 代码级审计发现偏差，已修复 |
| WidgetMeta 类型 | 无 domain/perspective 字段 | **新增 `WidgetDomain` + `WidgetPerspective` 类型，WidgetMeta 可选字段** | Phase 1 步骤 1.1 落地 |
| 交叉布局元数据 | 仅蓝图矩阵描述 | **`WIDGET_CROSS_LAYOUT` 常量表，21 Widget 全量注入** | `cockpit.constants.ts` 新增 |
| 交叉矩阵覆盖 | 19/21 Widget（缺 HotSector/ValuePit） | **21/21 Widget 全覆盖** | 补全遗漏 |
| 代码级审计 | 未执行 | **6 项关键断言逐一 grep/阅读验证** | 本节 §1.3 |

### 1.2 v1.0.0 → v2.0.0

| 维度 | v1.0.0 状态 | v2.0.0 状态 | 变更依据 |
|------|------------|------------|---------|
| Widget 数量 | 26（规划降至 21） | **21（已落地）** | Phase 0 完成，vitest 350/350 通过 |
| Category 体系 | 7 类含 system/analysis/trading/sector | **4 类：market/portfolio/ai/strategy** | 对齐 `../../explanation/03-architecture-standards.md`（已归档） 蓝图标准 |
| 共享逻辑 | 规划抽取 score.ts | **已落地 `src/cockpit/shared/score.ts`** | 消除 7 处重复函数 |
| Command 结构认知 | 模糊（"五舱之一"） | **精确：22 子页面，3 分组，无 Cockpit import** | Command 模块完整探索 |
| 重叠组件处理 | "移出 3 个 Widget 到 Command" | **修正：Command 未 import 任何 Cockpit Widget；MechanismHealthPanel 已自建并共享 Store** | 探索发现实际代码零依赖 |
| 布局令牌 | 规划 COCKPIT_LAYOUT | **已落地** | `cockpit.constants.ts` 增补 |
| SidebarLayout | 假定可用 | **确认：已定义但全项目零引用，可安全复用** | 全项目 grep 实证 |

### 1.3 代码级校对审计结果（v2.1.0 新增）

| 审计项 | 审计方法 | 蓝图断言 | 实际代码 | 结果 |
|--------|---------|---------|---------|------|
| Widget 注册数 | 阅读 `widgetRegistry.ts` | 21 | 21 | ✅ 一致 |
| Category 类型数 | grep `category:` in `cockpit.constants.ts` | 4 类 | 发现 `'agent'`（第 5 类） | ❌ 已修复 → `'ai'` |
| Command 不依赖 Cockpit | grep `from '@/cockpit` in `src/apps/command/` + `src/pages/command/` | 零 import | 零匹配 | ✅ 验证 |
| Command 子页面数 | 阅读 `PortalShell.tsx` PANEL_ITEMS | 22 | 系统 6 + 智能体 15 + MCP 1 = 22 | ✅ 一致 |
| CockpitShell 布局 | 阅读 `CockpitShell.tsx` | 平铺网格待改造 | ReactGridLayout + category Tab 筛选 | ✅ 确认待改造 |
| Command Hub 现状 | 阅读 `CommandApp.tsx` | 仅 4 张导航卡片 | 4 张 HUB_NAV_CARDS | ✅ 确认待增强 |

---

## 2. 系统全景架构

### 2.1 模块全景

```
┌─────────────────────────────────────────────────────────────────┐
│                    V9 智能投研复盘系统                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐  ┌──────────────────────────────┐           │
│  │  驾驶舱 Cockpit │  │  PortalShell（统一壳）        │           │
│  │  /cockpit       │  │  顶栏 Tab + 侧边栏分组        │           │
│  │  纵横交叉布局    │  │                              │           │
│  │  21 Widget       │  │  ┌──────┬──────┬──────┐     │           │
│  │  4 域 × 4 视角   │  │  │输入舱 │分析舱 │交易舱 │     │           │
│  │  L5 展示层       │  │  │9页面  │12页面 │7页面  │     │           │
│  │                  │  │  ├──────┼──────┼──────┤     │           │
│  │  纯业务仪表盘    │  │  │输出舱 │总控舱 │      │     │           │
│  │  只读消费        │  │  │9页面  │22页面 │      │     │           │
│  └────────────────┘  │  └──────┴──────┴──────┘     │           │
│                       └──────────────────────────────┘           │
│                                                                  │
│  数据链：marketDataStore ← DataBridge ← IndexedDB (17 Stores)   │
│  事件链：eventBus ← 各舱 Store → 各舱 UI                       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 三大模块定位

| 模块 | 定位 | 层级 | Widget/页面数 | 消费者场景 |
|------|------|------|:------------:|-----------|
| **Cockpit** | 投研全景仪表盘（纯业务） | L5 展示层 | 21 Widget | 盘前扫描 / 盘中监控 / 盘后复盘 |
| **Command** | 系统指挥舱（运维+编排+监控） | L4 应用层 | 22 子页面 | 系统运维 / Agent 调度 / 开发调试 |
| **五舱** | 业务深度操作页面 | L4 应用层 | 37 子页面 | 深度研究 / 交易执行 / 复盘产出 |

**铁律**：Cockpit 只做"一眼洞悉+快捷下钻"，不做业务操作；Command 只做"系统管理"，不承载业务分析；五舱承载所有深度业务操作。

### 2.3 导航关系

```
首页 ──→ 驾驶舱(/cockpit) ──→ Widget 点击下钻 ──→ 五舱对应页面
  │       纵横交叉布局              ↕ 双向跳转
  │       矩阵总览首屏              (Cockpit↔Analysis/Trading)
  │
  └──→ PortalShell(五舱+总控舱)
              顶栏 Tab 切换
              左侧边栏分组
              │
              └──→ 总控舱(/command)
                    系统运维 + Agent 编排 + MCP 管理
```

---

## 3. 各舱布局校对分析

### 3.1 PortalShell 布局模式校对

PortalShell 采用**固定顶栏 + 固定侧边栏 + 主内容区**的三段式布局，这是项目内最大的纵横交叉实现：

| 维度 | 实现 | 文件位置 |
|------|------|---------|
| 顶栏 | CABINS 5 舱切换 + 驾驶舱入口 + 主题/采集状态/信号频谱 | `PortalShell.tsx` header |
| 侧边栏 | `PANEL_ITEMS[activeCabin]` 动态分组，w-60 | `PortalShell.tsx` aside |
| 主内容 | `getActiveApp()` 懒加载 + Suspense | `cabinDispatcher.ts` |
| 移动端 | 底部导航栏 + Sheet 左侧抽屉 | `PortalShell.tsx` mobile |

**校对结论**：PortalShell 的"顶栏(横) × 侧边栏(纵)"范式已验证，Cockpit 的纵横交叉布局直接复用此模式，无需新建布局组件。

### 3.2 各舱子页面与分组校对

| 舱 | 分组数 | 子页面数 | 布局模式 | 布局组件 |
|---|:------:|:-------:|---------|---------|
| input | 2 | 9 | 标题+内容 | `div.space-y-4` + Suspense |
| analysis | 2 | 12 | 模板卡片+子页面 | `div.space-y-4` + Suspense |
| trading | 1 | 7 | 标题+内容 | `div.space-y-4` + Suspense |
| output | 1 | 9 | ErrorBoundary+子页面 | `ErrorBoundary` + Suspense |
| command | 3 | 22 | 标题+内容 | `div.space-y-4` + Suspense |
| **cockpit** | **0** | **21 Widget** | **平铺网格（待改造）** | `ReactGridLayout` |

**关键发现**：Cockpit 是唯一没有"分组"概念的模块 — 五舱全部使用 `PANEL_ITEMS` 侧边栏分组，Cockpit 却把 21 个 Widget 平铺成一堵墙。这正是 Phase 1 纵横交叉骨架要解决的核心问题。

### 3.3 子页面通用布局模式校对

大多数子页面采用 `PageContainer + Breadcrumb + PageHeader + Card 网格` 的标准模式。复杂页面叠加 `Tabs` 纵横切换。项目内已有的纵横交叉案例：

| 案例 | 文件 | 纵横模式 | Cockpit 复用价值 |
|------|------|---------|-----------------|
| BacktestPage | `src/pages/analysis/BacktestPage.tsx` | Tabs 三视图切换（绩效/交易/持仓） | 横轴视角 Tab 直接参照 |
| ScoreComparisonPage | `src/pages/analysis/ScoreComparisonPage.tsx` | Tabs 双模式 + 三栏对比 | 横轴视角切换+交叉筛选参照 |
| DashboardPage | `src/pages/output/DashboardPage.tsx` | 四列 KPI + 三列摘要 + 热力图 | 矩阵总览+跨 Store 聚合参照 |
| IndustryDashboardPage | `src/pages/analysis/IndustryDashboardPage.tsx` | KPI + 热力图 + 三列排名 + 排序表 | 矩阵总览+下钻交互参照 |
| PortalShell | `src/portal/PortalShell.tsx` | 顶栏(横) × 侧边栏(纵) | 纵横交叉骨架直接参照 |

### 3.4 可复用布局组件校对

| 组件 | 文件 | 当前使用情况 | Cockpit 复用方式 |
|------|------|------------|-----------------|
| SidebarLayout | `src/components/templates/SidebarLayout.tsx` | **零引用**（全项目 grep 确认） | 作为 DomainRail 骨架，无破坏风险 |
| Tabs | `src/components/molecules/Tabs.tsx` | 9 个文件引用 | 作为 PerspectiveTabs，已验证 |
| Sheet | `src/components/atoms/Sheet.tsx` | PortalShell 移动端使用 | 重型 Widget 下钻抽屉 |
| PageContainer | `src/components/templates/PageContainer.tsx` | 几乎所有子页面 | Cockpit 内容区容器 |
| PageHeader | `src/components/templates/PageHeader.tsx` | 几乎所有子页面 | Cockpit 顶部标题区 |
| CockpitLayout | `src/components/templates/CockpitLayout.tsx` | `/cockpit` 路由使用 | 已有，可增强 |
| DashboardLayout | `src/components/templates/DashboardLayout.tsx` | 少量使用 | Command Hub 可参照 |

---

## 4. 驾驶舱（Cockpit）设计

### 4.1 Phase 0 已落地状态

| 指标 | 变更前 | 变更后 | 验证 |
|------|--------|--------|------|
| Widget 模板数 | 26 | 21 | vitest 确认 |
| 默认实例数 | 26 | 21 | `[WidgetRegistry] Created 21 default instances` |
| Category 类型 | 7 类 | 4 类 (market/portfolio/ai/strategy) | 三方同步测试通过 |
| 重复函数 | 7 处 | 0 处 | `src/cockpit/shared/score.ts` 单一真相 |
| 系统运维区 | 折叠 toggle | 已移除 | CockpitShell 简化 |
| 布局令牌 | 仅 GRID_GAP/ROW_HEIGHT | +COCKPIT_LAYOUT (6 项) | `cockpit.constants.ts` |

### 4.2 移出/去重/归类明细

| 操作 | Widget | 处理方式 | 组件文件 | 状态 |
|------|--------|---------|---------|------|
| 去重 | researchPoolBoard | 删除注册，保留 poolBoard 单实例 | PoolBoardWidget.tsx 保留 | 已完成 |
| 去重 | watchlistMovers | 删除注册（异动功能 Phase 1 作为子 Tab 复用） | WatchlistMoversWidget.tsx 已删除（2026-08-15 死代码清理） | 已完成→已撤销 |
| 移出 | engineStatus | 取消 Cockpit 注册，Phase 2 在 Command/monitor 引入 | EngineStatusWidget.tsx 保留 | 已完成 |
| 移出 | systemArchitecture | 取消 Cockpit 注册，Phase 2 在 Command 引入 | SystemArchitectureWidget.tsx 保留 | 已完成 |
| 移出 | mechanismHealth | 取消 Cockpit 注册（Command 已有 MechanismHealthPanel） | MechanismHealthWidget.tsx 保留 | 已完成 |
| 归类 | agentPerformance | system → ai（AI 决策域；v2.1.0 修复遗留 'agent' 偏差） | 不变 | 已完成 |
| 归类 | riskMonitor | system → portfolio（持仓观察域） | 不变 | 已完成 |
| 归类 | pnlAnalysis | trading → portfolio | 不变 | 已完成 |
| 归类 | signalMonitor | trading → strategy | 不变 | 已完成 |
| 归类 | industryChain | sector → market | 不变 | 已完成 |
| 归类 | kaiScore/investmentProfile/poolBoard | analysis → market | 不变 | 已完成 |

### 4.3 纵横交叉布局设计（Phase 1）

**设计理念**：投资者看仪表盘的路径不是"看 21 个卡片"，而是"沿决策流扫视"。

```
┌──────────────────────────────────────────────────────────────┐
│  Cockpit 顶栏                                                │
│  [V9 Logo]                    [概览] [深度分析] [信号验证] [风控] │
│  ┌──────────┐               ← 横轴: 视角 Tabs                │
│  │          │                                                │
│  │  矩阵总览  │  ┌────────────────────────────────────────┐  │
│  │  (首屏)   │  │                                        │  │
│  │  域×视角  │  │     当前交叉点的 Widget 网格区域        │  │
│  │  热力矩阵  │  │     (2-4 个 Widget, 2列 grid)          │  │
│  │          │  │                                        │  │
│  ├──────────┤  │     重型 Widget → Sheet 抽屉下钻          │  │
│  │ 研究全景  │  └────────────────────────────────────────┘  │
│  │ 市场背景  │                                                │
│  │ AI 决策   │                                                │
│  │ 持仓观察  │  ← 纵轴: 业务域 Rail (复用 SidebarLayout)    │
│  └──────────┘                                                │
├──────────────────────────────────────────────────────────────┤
│  Footer: 合规免责声明                                         │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 四大业务域（纵轴）

| 域 | 定位 | 包含 Widget | 消费者思维 |
|---|------|-----------|-----------|
| **研究全景** | 从宏观到微观的研究路径 | KaiScore、InvestmentProfile、PoolBoard、ValuePit | "今天该研究什么？" |
| **市场背景** | 大盘环境与板块动态 | MarketIndices、SectorHeatmap、FundFlow、MarketSentiment、IndustryChain、HotSector | "市场今天怎么样？" |
| **AI 决策** | AI 辅助分析与复盘 | AITradeReview、ModelCompare、AgentPerformance、StockChat(抽屉)、SignalQuality | "AI 给我什么建议？" |
| **持仓观察** | 持仓、盈亏、风控 | PortfolioOverview、Watchlist、PnLAnalysis、PositionControl、RiskMonitor、SignalMonitor | "我持有什么？赚了还是亏了？" |

### 4.5 四大视角（横轴）

| 视角 | 定位 | 消费者意图 |
|------|------|-----------|
| **概览** | 摘要指标 + 趋势判断 | "一眼洞悉全局" |
| **深度分析** | 详细数据 + 下钻交互 | "告诉我具体原因" |
| **信号验证** | 交易信号 + 策略匹配 | "有没有操作机会？" |
| **风控** | 风险指标 + 仓位合规 | "我的风险敞口如何？" |

### 4.6 Widget 交叉归属矩阵

| 业务域(纵) \ 视角(横) | 概览 | 深度分析 | 信号验证 | 风控 |
|---|---|---|---|---|
| **研究全景** | KaiScore、InvestmentProfile | PoolBoard | ValuePit | — |
| **市场背景** | MarketIndices、SectorHeatmap | FundFlow、MarketSentiment、IndustryChain(抽屉) | HotSector | — |
| **AI 决策** | AITradeReview、AgentPerformance | ModelCompare、StockChat(抽屉) | SignalQuality | — |
| **持仓观察** | PortfolioOverview、Watchlist | PnLAnalysis | SignalMonitor | PositionControl、RiskMonitor |

**交叉效果**：单屏只呈现「选中域 × 选中视角」的 2-4 个 Widget，长墙彻底消除。

**矩阵密度统计**：

| 域 | 概览 | 深度分析 | 信号验证 | 风控 | 合计 |
|---|:---:|:---:|:---:|:---:|:---:|
| 研究全景 | 2 | 1 | 1 | 0 | 4 |
| 市场背景 | 2 | 3 | 1 | 0 | 6 |
| AI 决策 | 2 | 2 | 1 | 0 | 5 |
| 持仓观察 | 2 | 1 | 1 | 2 | 6 |
| **合计** | **8** | **7** | **4** | **2** | **21** |

### 4.7 可复用的现有组件（不重写，仅引用）

| 复用目标 | 现有组件 | 文件路径 | 复用方式 | 风险 |
|---------|---------|---------|---------|------|
| 左轨侧边栏 | SidebarLayout | `src/components/templates/SidebarLayout.tsx` | 直接引用为 DomainRail | 零引用，无破坏风险 |
| 顶视角 Tab | Tabs | `src/components/molecules/Tabs.tsx` | 直接引用为 PerspectiveTabs | 9 文件已验证 |
| 矩阵总览 | IndustryHeatmap 模式 | `src/components/chart/industry/IndustryHeatmap.tsx` | 适配为 域×视角 密度矩阵 | 适配渲染逻辑 |
| 重型下钻 | Sheet | `src/components/atoms/Sheet.tsx` | StockChat/IndustryChain 下钻 | PortalShell 已验证 |
| 卡片外壳 | WidgetStateShell | `src/cockpit/widgets/components/WidgetStateShell.tsx` | 不变 | 25/25 Widget 统一 |
| Widget 错误边界 | WidgetErrorBoundary | `src/cockpit/widgets/components/WidgetErrorBoundary.tsx（已废弃，不再存在）` | 不变 | 已有 |

---

## 5. 总控舱（Command）设计

### 5.1 当前结构（探索实证）

Command 包含 **22 个子页面**，分 3 个侧边栏分组：

| 分组 | 页面数 | 核心页面 |
|------|:------:|---------|
| 系统 | 6 | Hub、Monitor、Config、Showcase、Health、Test |
| 智能体 | 15 | Hub、Registry、Detail、Trigger、Tasks、Custom、LLM、CapabilityGraph、DagScheduler、Feedback、DataLabels、ApiConfig、ModelUpgrade、SkillAudit、Optimization、Changelog |
| MCP 服务 | 1 | MCPServerDashboard |

### 5.2 关键发现：Command 与 Cockpit 的实际代码关系

**探索结论**：Command 模块**未直接 import 任何 Cockpit Widget 组件**。`src/apps/command/` 和 `src/pages/command/` 下所有文件中，无任何 `from '@/cockpit/...'` 的 import 语句。

| Cockpit Widget | Command 对应实现 | 实际关系 | 处理方案 |
|---------------|----------------|---------|---------|
| EngineStatusWidget | 无（SystemMonitorPage 不引用 EngineStatusCard） | **零耦合** — Widget 在 Cockpit 取消注册后，Command 也没有使用 | Phase 2 在 SystemMonitorPage 引入 EngineStatusWidget |
| MechanismHealthWidget | MechanismHealthPanel（自建） | **Store 共享** — 两者消费同一 `mechanismHealthStore`，Panel 提供下钻视图 | Cockpit 取消注册，Command 已有完整实现 |
| SystemArchitectureWidget | 无（ComponentShowcasePage 是 UI 示例库） | **零耦合** — Showcase 不展示系统架构 | Phase 2 在 HealthDashboardPage 或新建页面引入 |
| AgentPerformanceWidget | AgentHubPage（自建指标卡） | **Store 共享** — 两者消费同一 `agentStore` | 保留在 Cockpit（AI 决策域），Command Hub 引入摘要卡 |

### 5.3 Command Hub 增强设计

当前 Hub 仅有 4 张导航卡片。增强为**运维信息总览页**：

```
┌──────────────────────────────────────────────────────────┐
│  总控舱 · Hub                                            │
│                                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│  │Agent │ │任务   │ │完成   │ │失败   │  ← 统计卡片(已有) │
│  │总数  │ │运行中  │ │      │ │      │                   │
│  └──────┘ └──────┘ └──────┘ └──────┘                  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  摘要 Widget 区（从 Cockpit 移出的轻量版）          │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐              │    │
│  │  │引擎状态  │ │架构健康  │ │Agent性能│              │    │
│  │  │3 指标    │ │综合分    │ │Top3     │              │    │
│  │  │[详情→]   │ │[详情→]   │ │[详情→]  │              │    │
│  │  └─────────┘ └─────────┘ └─────────┘              │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│  │系统监控 │ │配置管理 │ │智能体   │ │MCP服务  │ ← 快捷导航 │
│  └────────┘ └────────┘ └────────┘ └────────┘            │
│  ┌────────┐ ┌────────┐                                  │
│  │架构健康 │ │压力测试 │                                   │
│  └────────┘ └────────┘                                  │
└──────────────────────────────────────────────────────────┘
```

### 5.4 移入 Command 的 Widget 处理

| 移入 Widget | 目标位置 | 渲染方式 | 数据源 |
|-----------|---------|---------|--------|
| EngineStatusWidget | `/command/monitor` 页面内 | 直接 import 嵌入 | `commandStore`（已有） |
| SystemArchitectureWidget | `/command/health` 页面内或新建 `/command/architecture` | 直接 import 嵌入 | `API_SYSTEM_ARCHITECTURE` |
| MechanismHealthWidget | 不移入（Command 已有 MechanismHealthPanel） | 仅取消 Cockpit 注册 | `mechanismHealthStore`（共享） |

**处理方式**：Widget 组件代码不删除、不重写，仅在 `widgetRegistry.ts` 中取消注册（Phase 0 已完成）。在 Command 对应页面中直接 import 并使用。

---

## 6. Cockpit-Command 关系治理

### 6.1 职责边界固化

| 维度 | Cockpit 做什么 | Cockpit 不做什么 | Command 做什么 | Command 不做什么 |
|------|---------------|----------------|--------------|----------------|
| 数据展示 | 市场指标、持仓概览、AI 分析摘要 | 引擎状态、架构健康、系统架构 | 引擎健康、架构评分、Agent 统计 | 市场行情、个股分析 |
| 用户交互 | Widget 折叠/展开、视角切换、域切换 | 业务操作（买入/卖出/配置） | Agent 注册/触发/DAG/反馈 | 研究分析、评分计算 |
| 数据操作 | 只读消费 marketDataStore | 写入任何 Store / IndexedDB | 读写 commandStore/agentStore | 股票池管理、持仓操作 |
| 下钻跳转 | 点击 Widget → 跳转五舱对应页面 | 直接承载完整业务页面 | 点击摘要卡 → 跳转详情子页面 | 承载业务分析 Widget |

### 6.2 数据流契约（显式化）

| 数据主题 | 生产者(写入) | Cockpit 消费 | Command 消费 | 同步方式 |
|---------|------------|------------|------------|---------|
| 市场数据 | MarketDataProvider → marketDataStore | 全部 Widget | 不消费 | Zustand 订阅 |
| Agent 统计 | AgentHubPage → agentStore | AgentPerformanceWidget（只读） | Hub 摘要卡 + AgentPages | Zustand 订阅 |
| 引擎状态 | SystemMonitorPage → commandStore | 不消费（已移出） | Hub 摘要卡 + Monitor 页 | Zustand 订阅 |
| 架构健康 | HealthDashboard → health-report.json | 不消费（已移出） | Hub 摘要卡 + Health 页 | 静态文件 + 轮询 |
| 机制健康 | mechanismHealthStore | 不消费（已移出） | MechanismHealthPanel | Zustand 订阅 |

**铁律**：Cockpit Widget 只消费 `marketDataStore` 和 `agentStore`（只读），不直接访问 `commandStore`。Phase 0 将 AgentPerformanceWidget 的 category 从 `system` 改为 `ai`（v2.1.0 修复遗留的 `'agent'` 偏差），使其数据消费与 category 归属自洽。

### 6.3 组件去重策略

| 组件对 | 当前状态 | 去重方案 | 风险 |
|-------|---------|---------|------|
| Cockpit EngineStatusWidget ↔ Command EngineStatusCard | 两个独立组件，零引用关系 | Cockpit 取消注册（已完成）；Command/monitor 直接 import EngineStatusWidget | 低 — 组件自包含 |
| Cockpit MechanismHealthWidget ↔ Command MechanismHealthPanel | 共享 Store，代码独立 | Cockpit 取消注册（已完成）；Command 已有完整 Panel | 零 — 无代码变更 |
| Cockpit SystemArchitectureWidget ↔ Command ShowcasePage | 零关系 | Cockpit 取消注册（已完成）；Command 新增 import | 低 — 组件自包含 |
| Cockpit AgentPerformanceWidget ↔ Command AgentHubPage | 共享 agentStore | 保留 Cockpit（AI 决策域）；Command Hub 引入摘要版 | 中 — 需区分摘要 vs 详情 |
| Cockpit PoolBoardWidget ↔ Input PoolBoardPage | 同一组件 PoolBoard | Cockpit 保留看板版；Input 保留操作版 | 低 — 已是单实例 |

### 6.4 组件共享原则

```
组件复用层级：

  Cockpit Widget（仪表盘卡片）
       ↕ 共享组件文件，不同渲染上下文
  Command Page（系统管理页面）
       ↕ 共享 Store，不同 UI 组件
  五舱 Page（业务操作页面）

共享规则：
  1. Widget 组件文件不删除 — 取消注册后仍可被其他页面 import
  2. Store 是唯一数据真相源 — Cockpit 和 Command 各自的 UI 组件消费同一 Store
  3. 不创建"Widget ↔ Card"适配层 — 直接 import 原始 Widget 组件
  4. Cockpit Widget 的 config/data props 接口保持不变 — Command 页面按需传入
```

---

## 7. 数据链条完整性保障

### 7.1 数据流全景图

```
                        ┌─────────────┐
                        │  IndexedDB   │
                        │  17 Stores   │
                        └──────┬──────┘
                               │ DataBridge.forward()
                               ▼
                        ┌─────────────┐
                        │ dataLayer   │
                        └──────┬──────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
            ┌──────────┐ ┌──────────┐ ┌──────────┐
            │ market   │ │ command  │ │ trading  │
            │ DataStore│ │ Store    │ │ Store    │
            └────┬─────┘ └────┬─────┘ └────┬─────┘
                 │            │            │
         ┌───────┤      ┌─────┤      ┌─────┤
         ▼       ▼      ▼     ▼      ▼     ▼
    ┌─────────┐ ┌────────┐  ┌────────┐ ┌──────────┐
    │Cockpit  │ │五舱    │  │Command │ │Trading   │
    │Widget   │ │业务页面│  │Hub+Pages│ │Dashboard │
    │(只读)   │ │(读写)  │  │(读写)   │ │(读写)    │
    └─────────┘ └────────┘  └────────┘ └──────────┘
```

### 7.2 数据链完整性检查

| 数据链 | 生产者 | Cockpit 消费 | Command 消费 | 事件 | 状态 |
|-------|-------|------------|------------|------|------|
| 采集→评分 | fetcherService → v6ScoreService | KaiScore | 不消费 | `scores:changed` | 正常 |
| 评分→信号 | v6ScoreService → signalGenerator | SignalMonitor | 不消费 | 信号写入 | 正常 |
| 信号→订单 | signalGenerator → tradingService | PnLAnalysis | 不消费 | `orders:changed` | 正常 |
| 股票池→展示 | poolTransitionEngine | PoolBoard | 不消费 | `stocks:changed` | 正常 |
| 市场数据→Cockpit | MarketDataProvider | 全部 Widget | 不消费 | Store 订阅 | 正常 |
| Agent→Command | agentRuntime → agentStore | AgentPerformance(只读) | Hub + AgentPages | Store 订阅 | 正常 |
| 健康报告→Command | HealthDashboard | 不消费 | Hub + Health 页 | 文件读取 | 正常 |
| Cockpit→五舱跳转 | Widget onClick | navigate() | 不涉及 | URL 路由 | 正常 |

### 7.3 数据链效率保障

| 原则 | 规则 |
|------|------|
| 单一事实源 | Cockpit Widget 只从 `marketDataStore` 读取市场数据 |
| 避免重复采集 | 同一数据通道不重复注册采集任务 |
| 懒加载感知 | 不可见 Widget 暂停数据采集（IntersectionObserver） |
| 分批启动 | PRELOAD_WIDGETS 6 个优先启动，其他延迟 |
| 缓存复用 | marketDataStore 10s TTL，多 Widget 共享缓存 |

---

## 8. 视觉审美与消费者体验

### 8.1 设计审美原则

| 原则 | 实现方式 | 参照标准 |
|------|---------|---------|
| 信息分组 | 纵横交叉布局，域×视角自然分区 | Apple HIG · Layout |
| 视觉层次 | 矩阵总览(高层) → Widget 网格(中层) → 抽屉详情(深层) | Material 3 · Spatial Systems |
| 节奏感 | Section 间 24px gap，Header 12px gap，Widget 间 16px gap | 8px 栅格体系 |
| 轻重分离 | 微型指标卡平铺，重型 Widget 收为抽屉 | shadcn/ui · Composition |
| 留白呼吸 | 单屏最多 4 Widget，避免信息过载 | 宋瓷美学 — 釉面留白 |

### 8.2 消费者体验路径

**场景 1：盘前快速扫描（3 秒完成）**
1. 打开驾驶舱 → 矩阵总览首屏
2. 纵轴选"市场背景" → 横轴"概览" → 看到 MarketIndices + SectorHeatmap
3. 发现板块热力图有异动 → 点击下钻到分析舱 `/analysis/sector`

**场景 2：盘中持仓监控**
1. 驾驶舱纵轴选"持仓观察" → 横轴"概览" → 看到 Portfolio + Watchlist
2. 切换到"风控"视角 → 看到 PositionControl + RiskMonitor
3. 有信号触发 → 切换到"信号验证"视角 → 看到 SignalMonitor

**场景 3：盘后复盘回顾**
1. 驾驶舱纵轴选"AI 决策" → 横轴"深度分析" → 看到 ModelCompare + StockChat(抽屉)
2. 切换到"研究全景" → 看到 KaiScore → 点击下钻到分析舱评分页面

**场景 4：系统运维（Command）**
1. PortalShell 切换到总控舱 → Hub 首页看到摘要卡片
2. 引擎状态异常 → 点击"详情" → 跳转 `/command/monitor`
3. 检查 Agent 运行情况 → `/command/agents` → AgentHubPage

### 8.3 统一间距令牌（Phase 0 已落地）

```ts
export const COCKPIT_LAYOUT = {
  SECTION_GAP: 24,        // 域分区之间
  SECTION_HEADER_GAP: 12, // 域标题与 Widget 网格之间
  WIDGET_GAP: 16,          // Widget 之间（复用 GRID_GAP）
  ZONE_PADDING: 16,        // 左轨与内容区之间
  MATRIX_CELL_GAP: 4,      // 矩阵总览单元格间距
} as const
```

---

## 9. 实施路径

### 9.1 Phase 0：快赢治理 — 已完成

| 步骤 | 操作 | 状态 |
|------|------|------|
| 0.1 | 删除 researchPoolBoard 注册 | 已完成 |
| 0.2 | 删除 watchlistMovers 注册 | 已完成 |
| 0.3 | 移出 engineStatus/systemArchitecture/mechanismHealth 注册 | 已完成 |
| 0.4 | AgentPerformance → agent，RiskMonitor → portfolio 归类 | 已完成 |
| 0.5 | 消除 system/analysis/trading/sector 非标 category | 已完成 |
| 0.6 | 抽取 src/cockpit/shared/score.ts（消除 7 处复制） | 已完成 |
| 0.7 | 增补 COCKPIT_LAYOUT 布局令牌 | 已完成 |
| 0.8 | 移除 CockpitShell system zone 逻辑 | 已完成 |

**验收结果**：tsc 0 新增错误；vitest 24 files / 350 tests 全绿；Widget 数 = 21

### 9.2 Phase 1：纵横交叉骨架

| 步骤 | 操作 | 涉及文件 | 改动类型 | 状态 |
|------|------|---------|---------|------|
| 1.1 | Widget 元数据新增 `domain` + `perspective` 字段 | `widget.types.ts`、`cockpit.constants.ts`、`widgetRegistry.ts` | 扩展类型 + 常量表 + 注入逻辑 | **已完成** |
| 1.2 | 新增 `CockpitCrossLayout` 组件（引用 Tabs + SidebarLayout 模式） | 新增 `src/cockpit/layout/CockpitCrossLayout.tsx` | 新增文件 | **已完成** |
| 1.3 | 新增矩阵总览组件（引用 IndustryHeatmap 色阶模式） | 新增 `src/cockpit/layout/CrossMatrixOverview.tsx` | 新增文件 | **已完成** |
| 1.4 | 改造 `CockpitShell` 使用 CrossLayout 替换平铺 map | `CockpitShell.tsx` | 替换渲染逻辑 | **已完成** |
| 1.5 | StockChat/IndustryChain 收为 Sheet 抽屉触发 | 新增 `WidgetSheetDrawer.tsx` + 改造 `CockpitCrossLayout` | 新增组件 + 网格分离 | **已完成** |
| 1.6 | WatchlistMoversWidget 作为 Watchlist 子 Tab 复用 | `WatchlistWidget.tsx` + `WatchlistMoversWidget.tsx` | 内部加 Tab + 导出 Content | **已撤销**（集成未落地，2026-08-15 删除死代码） |

**步骤 1.1 落地明细**：
- `widget.types.ts`：新增 `WidgetDomain`（'research'|'market'|'ai'|'portfolio'）和 `WidgetPerspective`（'overview'|'analysis'|'signal'|'risk'）类型，`WidgetMeta` 新增可选 `domain` + `perspective` 字段
- `cockpit.constants.ts`：新增 `WIDGET_CROSS_LAYOUT` 常量表，21 Widget 全量定义 domain/perspective 映射
- `widgetRegistry.ts`：`registerDefaultWidgets()` 末尾新增注入循环，从 `WIDGET_CROSS_LAYOUT` 读取并写入 `widget.meta.domain` / `widget.meta.perspective`

**步骤 1.2-1.4 落地明细**：
- `CockpitCrossLayout.tsx`：左轨业务域 Rail（4 域按钮 + 计数徽章）+ 顶部视角 Tab（4 视角 + 禁用态）+ 矩阵总览切换 + 交叉点 Widget 网格
- `CrossMatrixOverview.tsx`：4×4 矩阵热力图，单元格按 Widget 密度着色，点击跳转对应交叉点
- `CockpitShell.tsx`：移除 ReactGridLayout，引入 CockpitCrossLayout；移动端降级为纵向堆叠

**步骤 1.5 落地明细**：
- `cockpit.constants.ts`：新增 `DRAWER_WIDGETS` 常量（`Set<'stockChat', 'industryChain'>`）
- `WidgetSheetDrawer.tsx`：紧凑触发卡片（图标 + 标题 + 描述 + 箭头）→ 点击 → Sheet 右侧抽屉展开完整 Widget
- `CockpitCrossLayout.tsx`：交叉点实例分为 `gridInstances`（网格直接渲染）和 `drawerInstances`（触发卡片渲染），抽屉卡片在网格下方排列

**步骤 1.6 落地明细**（注：原设计计划在 `WatchlistWidget.tsx` 中新增 Tabs 并复用 `WatchlistMoversWidget.tsx` 的纯内容组件，但该集成实际未落地；`WatchlistMoversWidget.tsx` 及其依赖 `watchlistMoversService.ts` 已于 2026-08-15 作为死代码删除）：
- `WatchlistWidget.tsx`：当前实现为简单的 4 列网格展示自选股，未集成异动榜子 Tab

**验收结果**：tsc 0 新增错误；vitest 24 files / 350 tests 全绿；首屏矩阵总览可渲染；交叉筛选单屏 ≤4 Widget

### 9.3 Phase 2：Command Hub 增强 + 收口

| 步骤 | 操作 | 涉及文件 | 改动类型 | 状态 |
|------|------|---------|---------|------|
| 2.1 | Command Hub 新增摘要 Widget 区 | `CommandApp.tsx` | 新增组件 | ✅ 已完成 |
| 2.2 | SystemMonitorPage 引入 EngineStatusWidget | `SystemMonitorPage.tsx` | 新增 import | ✅ 已完成 |
| 2.3 | HealthDashboardPage 引入 SystemArchitectureWidget | `HealthDashboardPage.tsx` | 新增 import | ✅ 已完成 |
| 2.4 | 验收 SOP 增补组合层检查清单 | `outputs/interaction-component-qa-gate-SOP.md`（已废弃） §八 | 新增文档 | ✅ 已完成 |
| 2.5 | ADR-010 决策记录归档 | `docs/specs/architecture/adr-010-cockpit-command-cross-layout.md` | 新增文档 | ✅ 已完成 |

**验收标准**：Command Hub 展示摘要卡片；点击跳转详情页；移出 Widget 在 Command 正常渲染

> **进度（2026-07-24）**：2.1–2.3 已落地（代码 — Command Hub 新增「运维摘要」区嵌入 EngineStatusWidget/SystemArchitectureWidget/AgentPerformanceWidget；SystemMonitorPage 引入 EngineStatusWidget；HealthDashboardPage 引入 SystemArchitectureWidget）。2.4（SOP 增补组合层维度）/2.5（ADR-010 归档）待补。跨模块评分逻辑已抽至 `@/lib/score`（原 cockpit 内联 `getScoreColor5`/`getActionLabel` 及 services 内联 `getScoreColor` 统一），`cockpit/shared/score.ts` 降级为 re-export 垫片。

---

### 9.4 Phase 3：纵横交叉布局体验打磨

| 步骤 | 操作 | 涉及文件 | 改动类型 | 状态 |
|------|------|---------|---------|------|
| 3.1 | 矩阵切换按钮、业务域 Rail 按钮、矩阵单元格按钮补充 `focus-visible:ring` 焦点环 | `CockpitCrossLayout.tsx`、`CrossMatrixOverview.tsx` | a11y 合规 | ✅ 已完成 |
| 3.2 | 矩阵切换按钮补 `aria-pressed` 状态 | `CockpitCrossLayout.tsx` | a11y | ✅ 已完成 |
| 3.3 | 矩阵单元格新增原生 `title` tooltip，列出交叉点的 Widget 名称 | `CrossMatrixOverview.tsx` + CockpitCrossLayout.tsx（下传 `matrixTitles`） | 体验提升 | ✅ 已完成 |
| 3.4 | 内容区冗余 inline `gap` 清理（改 `space-y-3`） | `CockpitCrossLayout.tsx` | 清理 | ✅ 已完成 |

**验收**：tsc:prod 0 错误；audit:layers 0 违规；CockpitShell.test.tsx 14/14 通过；eslint 0 error（仅存文件既有 style warning，与全文 `||`/`?.` 风格一致）。提交 `37880ac`。

> **说明（2026-07-24）**：移动端降级（`<768px` 纵向堆叠）已在 Phase 1 步骤 1.4 于 `CockpitShell.tsx` 通过 `useMediaQuery` 落地，非 Phase 3 新增；本次未改动。矩阵空交叉点（`研究全景/市场背景/AI决策 × 风控`）因对应视角 Tab 与矩阵单元格均 `disabled`，不可达，空态兜底保留为安全网。

## 10. 架构决策记录（ADR-010）

> 本文为 ADR-010 摘要，完整归档见 `docs/specs/architecture/adr-010-cockpit-command-cross-layout.md`（V9-ADR-010）。

> **ADR-010: Cockpit/Command 职责边界与纵横交叉布局**

**背景**：Cockpit 26 Widget 平铺堆砌，与 Command 存在 4 个功能重叠 Widget，category 体系（7 类）偏离蓝图标准（4 类），系统运维 Widget 侵入 L4 职责域。探索确认 Command 未直接 import 任何 Cockpit Widget，实际耦合仅限于 MechanismHealth 共享 Store。v2.1.0 代码级审计发现 agentPerformance category 偏差（'agent' 而非 'ai'），已修复。

**决策**：
1. Cockpit 采用纵横交叉布局（域×视角），回归 L5 纯展示层定位
2. 3 个纯系统 Widget 移出 Cockpit 到 Command（Phase 0 已取消注册，Phase 2 引入 Command 页面）
3. Widget category 对齐蓝图 4 类标准（market/portfolio/ai/strategy）— Phase 0 已完成，v2.1.0 修复 agentPerformance 遗留偏差
4. Command 增强为系统指挥舱，Hub 页新增运维摘要
5. 数据流显式契约化：Cockpit 只消费 marketDataStore + agentStore（只读）
6. AgentPerformanceWidget 保留在 Cockpit（AI 决策域），因为其消费 agentStore 且面向投资者
7. WidgetMeta 新增 domain + perspective 可选字段，为纵横交叉布局提供元数据基础 — Phase 1 步骤 1.1 已落地

**后果**：Cockpit 从 26 降至 21 Widget，单屏从 19 降至 2-4，信息过载消除；Command 获得完整的系统管理视图；两舱职责边界清晰；共享 score.ts 消除 7 处重复逻辑；21 Widget 全量具备 domain/perspective 元数据，为 CrossLayout 组件实施铺平道路。
