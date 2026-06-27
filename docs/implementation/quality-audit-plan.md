---
title: V9 模块完成度逆向校验 — 执行计划
version: v1.0.0
last_updated: 2026-06-27
maintainer: Quality Auditor
status: active
change_log:
  - date: 2026-06-27
    author: Quality Auditor
    desc: 初始创建：审计执行计划
---

# V9 模块完成度逆向校验 — 执行计划

## 一、项目概况

| 项目 | 信息 |
|:---|:---|
| 项目名称 | 智能投研复盘系统 V9 |
| 技术栈 | React 18 + TypeScript + Vite + Pinia + Tailwind |
| 核心架构 | DataBridge（数据层）→ Store（状态层）→ Engine（逻辑层）→ UI（展示层） |
| 已注册路由 | **26 条**（覆盖 8 大分类） |
| 已注册 Store | **7 个**（workflowStore / dataflowStore / pageStore / widgetStore / agentStore / databridgeStore / engineStore） |
| 已注册 Widget | **12 个**（Cockpit 驾驶舱） |
| 五舱架构 | 输入舱 / 分析舱 / 交易舱 / 输出舱 / 总控舱 |

---

## 二、功能入口清单（用户视角，自顶向下）

### 批次 A：门户与驾驶舱（2 个入口）

| 编号 | 功能入口 | 路由 | 对应组件 | 用户感知 |
|:---|:---|:---|:---|:---|
| A1 | 首页 | `/` | `src/pages/HomePage` | 系统入口页 |
| A2 | 驾驶舱 | `/cockpit` | `src/cockpit/CockpitShell` + 12 Widgets | 多 Widget 仪表盘 |

### 批次 B：输入舱（4 个子页面 + 1 个 Hub）

| 编号 | 功能入口 | 路由 | 对应组件 |
|:---|:---|:---|:---|
| B1 | 输入舱 Hub | `/input/hub` | `src/pages/input/InputHubPage` |
| B2 | 录入看板 | `/input` | `src/apps/input/InputApp` |
| B3 | 批量导入 | `/input/bulk-import` | `src/apps/input/InputApp`（子路由） |
| B4 | 热门板块 | `/input/hot-sectors` | `src/apps/input/InputApp`（子路由） |
| B5 | 本地知识库 | `/input/local-knowledge` | `src/pages/input/LocalKnowledgePage` |
| B6 | 采集测试 | `/input/data-test` | `src/apps/input/InputApp`（子路由） |

### 批次 C：分析舱（8 个子页面 + 1 个 Hub）

| 编号 | 功能入口 | 路由 | 对应组件 |
|:---|:---|:---|:---|
| C1 | 分析舱 Hub | `/analysis/hub` | `src/pages/analysis/AnalysisHubPage` |
| C2 | V4 行业评分 | `/analysis/industry-score` | `src/pages/analysis/IndustryScorePage` |
| C3 | V6 个股评分 | `/analysis/stock-score` | `src/pages/analysis/StockAnalysisPage` |
| C4 | V6 智能评分 | `/analysis/intelligent-score` | `src/pages/analysis/IntelligentScorePage` |
| C5 | 行业分析 | `/analysis/sector` | `src/pages/analysis/SectorAnalysisPage` |
| C6 | 策略回测 | `/analysis/backtest` | `src/pages/analysis/BacktestPage` |
| C7 | 评分文档 | `/analysis/score-docs` | `src/pages/analysis/ScoreDocPage` |
| C8 | 智能资讯 | `/analysis/news` | `src/pages/analysis/NewsPage` |
| C9 | 智能资讯 V6 | `/analysis/news-v6` | `src/pages/news-v6/NewsPage` |

### 批次 D：交易舱（3 个子页面 + 1 个 Hub）

| 编号 | 功能入口 | 路由 | 对应组件 |
|:---|:---|:---|:---|
| D1 | 交易舱 Hub | `/trading/hub` | `src/pages/trading/TradingHubPage` |
| D2 | 交易信号 | `/trading` | `src/apps/trading/TradingApp` |
| D3 | 策略快照 | `/trading/strategy-snapshots` | `src/pages/trading/StrategySnapshotPage` |
| D4 | 交易持仓 | `/trading/holdings` | `src/pages/trading/HoldingsPage` |

### 批次 E：输出舱 + 总控舱 + 其他（4 个入口）

| 编号 | 功能入口 | 路由 | 对应组件 |
|:---|:---|:---|:---|
| E1 | 输出舱 | `/output` | `src/apps/output/OutputApp` |
| E2 | 总控舱 Hub | `/command/hub` | `src/pages/command/CommandHubPage` |
| E3 | 总控舱 | `/command` | `src/apps/command/CommandApp` |
| E4 | Mock 测试页 | `/mock-test` | `src/pages/MockTestPage` |

---

## 三、审计流程

### 3.1 五层追溯标准

| 层级 | 校验内容 | 判定标准 |
|:---|:---|:---|
| **L1 用户界面层** | 页面能否正常打开？UI 是否完整？有无 loading/error/empty 三种状态？ | ✅ 完整 / 🟡 部分 / ❌ 缺失 |
| **L2 状态管理层** | 对应的 Store 是否存在？state/getters/actions 是否完整？ | ✅ 完整 / 🟡 部分 / ❌ 缺失 |
| **L3 数据接入层** | DataBridge 端点是否存在？数据能否正常流入 Store？ | ✅ 完整 / 🟡 部分 / ❌ 缺失 |
| **L4 业务逻辑层** | 核心计算/校验/转换逻辑是否正确实现？ | ✅ 完整 / 🟡 部分 / ❌ 缺失 |
| **L5 注册集成层** | 路由是否注册？是否被其他模块正确引用？Widget/Agent 是否注册？ | ✅ 完整 / 🟡 部分 / ❌ 缺失 |

### 3.2 审计方法

```text
对于每个功能入口：
  1. L1: 读取 UI 组件源码 → 检查 JSX 结构、状态覆盖（loading/error/empty）、交互逻辑
  2. L2: 从 UI 组件追踪 useXxxStore() 调用 → 检查对应 Store 的 state/actions 定义
  3. L3: 从 Store 追踪 DataBridge.subscribe() / forward() 调用 → 检查端点是否存在
  4. L4: 追踪业务逻辑函数（Services/Engines/Utils）→ 检查实现完整性
  5. L5: 检查路由注册表 (routes.ts) → 检查 Widget 注册表 (widgetRegistry.ts) → 检查跨模块引用
```

### 3.3 完成度剖面图格式

```text
## 功能入口：XXX
| 层级 | 内容 | 状态 | 发现 |
|:---|:---|:---|:---|
| L1 界面 | 组件文件 | ✅/🟡/❌ | 具体发现 |
| L2 状态 | Store 名称 | ✅/🟡/❌ | 具体发现 |
| L3 数据 | DataBridge 端点 | ✅/🟡/❌ | 具体发现 |
| L4 逻辑 | 业务逻辑 | ✅/🟡/❌ | 具体发现 |
| L5 集成 | 路由/注册 | ✅/🟡/❌ | 具体发现 |
```

---

## 四、批次划分

| 批次 | 入口数 | 功能入口 | 预计工作量 |
|:---|:---|:---|:---|
| **批次 A** | 2 | 首页 + 驾驶舱（12 Widgets） | 最大（驾驶舱含 12 个子模块） |
| **批次 B** | 6 | 输入舱全部子页面 | 中等 |
| **批次 C** | 9 | 分析舱全部子页面 | 最大 |
| **批次 D** | 4 | 交易舱全部子页面 | 中等 |
| **批次 E** | 4 | 输出舱 + 总控舱 + Mock 测试页 | 较小 |

---

## 五、输出物

| 序号 | 交付物 | 路径 | 说明 |
|:---|:---|:---|:---|
| 1 | 执行计划 | `docs/implementation/quality-audit-plan.md` | 本文档 |
| 2 | 完成度剖面图 | `docs/implementation/completeness-profile.md` | 所有模块的五层剖面图汇总 |
| 3 | 修复行动清单 | `docs/implementation/action-list.md` | 按 P0/P1/P2 排序的修复建议 |

---

## 六、当前状态

| 阶段 | 状态 |
|:---|:---|
| 执行计划 | ✅ 已生成（本文档） |
| 等待用户确认 | ⏳ 待确认 |
| 批次 A 审计 | ⏳ 待执行 |
| 批次 B 审计 | ⏳ 待执行 |
| 批次 C 审计 | ⏳ 待执行 |
| 批次 D 审计 | ⏳ 待执行 |
| 批次 E 审计 | ⏳ 待执行 |

---

## 七、变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|:---|:---|:---|:---|
| 2026-06-27 | v1.0.0 | 初始创建：审计执行计划，覆盖 25 个功能入口，5 个批次 | Quality Auditor |