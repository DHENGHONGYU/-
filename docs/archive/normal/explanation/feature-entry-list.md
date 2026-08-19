---
doc_id: V9-DOC-EXP-921
title: feature-entry-list
code_version: "2.0.0-rc.2"
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# V9 功能入口清单

> 扫描来源：`src/config/routes.ts`（路由唯一真相源）、`src/pages/`（25 页面组件）、`src/apps/`（15 应用/面板组件）  
> 路由方式：`HashRouter`（`src/App.tsx`）  
> 注：项目无 `../../src/showcase/index.ts`，路由定义在 `src/config/routes.ts`

---

## 一、门户与驾驶舱（3 个入口）

| 序号 | 功能模块名称 | 页面路径 | 路由路径 | 用户操作描述 |
|:---|:---|:---|:---|:---|
| 1 | 首页 | `src/pages/HomePage.tsx` | `/` | 系统入口页，展示四舱导航卡片，提供进入输入舱/驾驶舱/总控中心的快捷入口 |
| 2 | 驾驶舱 Dashboard | `src/cockpit/CockpitShell.tsx` | `/cockpit` | 多 Widget 仪表盘，12 个可拖拽/缩放的金融数据组件，支持数据采集状态监控 |
| 3 | 404 页面 | `src/App.tsx`（内联） | `*` | 兜底路由，显示"页面未找到" |

---

## 二、输入舱（6 个入口）

| 序号 | 功能模块名称 | 页面路径 | 路由路径 | 用户操作描述 |
|:---|:---|:---|:---|:---|
| 4 | 输入舱 Hub | `src/apps/input/InputApp.tsx` | `/input/hub` | 输入舱模块首页，展示输入功能导航与概览 |
| 5 | 录入看板 | `src/apps/input/InputApp.tsx` → `InputDashboard` | `/input` | 股票录入主面板，候选池管理 |
| 6 | 批量导入 | `src/apps/input/InputApp.tsx` → `BulkImportPanel` | `/input/bulk-import` | 批量导入股票数据 |
| 7 | 热门板块 | `src/apps/input/InputApp.tsx` → `HotSectorPanel` | `/input/hot-sectors` | 展示当前热门板块，支持一键加入候选池 |
| 8 | 本地知识库 | `src/pages/input/LocalKnowledgePage.tsx` | `/input/local-knowledge` | 本地知识库管理，股票搜索与筛选 |
| 9 | 采集测试 | `src/apps/input/InputApp.tsx` → `DataTestPanel` | `/input/data-test` | 数据采集功能测试面板 |
| — | 交互原型（临时） | `src/apps/input/InputApp.tsx` → `InputPrototype` | `/input/prototype` | 临时交互原型页（路由已注册，非正式功能） |

---

## 三、分析舱（9 个入口）

| 序号 | 功能模块名称 | 页面路径 | 路由路径 | 用户操作描述 |
|:---|:---|:---|:---|:---|
| 10 | 分析舱 Hub | `src/apps/analysis/AnalysisApp.tsx` | `/analysis/hub` | 分析舱模块首页，展示分析功能导航 |
| 11 | V4 行业评分 | `src/pages/analysis/IndustryScorePage.tsx` | `/analysis/industry-score` | V4 行业评分分析 |
| 12 | V6 个股评分 | `src/pages/analysis/StockAnalysisPage.tsx` | `/analysis/stock-score` | V6 个股九维评分分析 |
| 13 | V6 个股评分（带代码） | `src/pages/analysis/StockAnalysisPage.tsx` | `/analysis/stock-score/:symbol` | 带股票代码的个股九维评分分析 |
| 14 | V6 智能评分 | `src/pages/analysis/IntelligentScorePage.tsx` | `/analysis/intelligent-score` | V6 个股智能评分 |
| 15 | 行业分析 | `src/pages/analysis/SectorAnalysisPage.tsx` | `/analysis/sector` | 行业与板块分析 |
| 16 | 策略回测 | `src/pages/analysis/BacktestPage.tsx` | `/analysis/backtest` | 策略回测功能 |
| 17 | 评分文档 | `src/pages/analysis/ScoreDocPage.tsx` | `/analysis/score-docs` | 评分文档版本库 |
| 18 | 智能资讯 | `src/pages/analysis/NewsPage.tsx` | `/analysis/news` | 智能资讯（V9 原生版） |
| 19 | 智能资讯 V6 | `src/pages/analysis/NewsPage.tsx` | `/analysis/news-v6` | 智能资讯（V6 风格迁移版），含 NewsCard/NewsFeed/FilterPanel 子组件 |

---

## 四、交易舱（4 个入口）

| 序号 | 功能模块名称 | 页面路径 | 路由路径 | 用户操作描述 |
|:---|:---|:---|:---|:---|
| 20 | 交易舱 Hub | `src/apps/trading/TradingApp.tsx` | `/trading/hub` | 交易舱模块首页 |
| 21 | 交易信号 | `src/apps/trading/TradingApp.tsx` | `/trading` | 交易信号面板，含 CoreResourcePanel 核心资源主题，支持观察池、订单、信号、策略组合 |
| 22 | 策略快照 | `src/pages/trading/StrategySnapshotPage.tsx` | `/trading/strategy-snapshots` | 策略快照查看 |
| 23 | 交易持仓 | `src/pages/trading/HoldingsPage.tsx` | `/trading/holdings` | 持仓列表查询/筛选/分页，含 TradeModal 补仓/平仓，支持 CSV 导出 |

---

## 五、输出舱 + 总控舱（4 个入口）

| 序号 | 功能模块名称 | 页面路径 | 路由路径 | 用户操作描述 |
|:---|:---|:---|:---|:---|
| 24 | 输出舱 | `src/apps/output/OutputApp.tsx` | `/output` | 数据导出（JSON 全量导出），研究报告生成 |
| 25 | 总控舱 Hub | `src/apps/command/CommandApp.tsx` | `/command/hub` | 总控舱模块首页 |
| 26 | 总控舱 | `src/apps/command/CommandApp.tsx` | `/command` | 系统监控（统计信息）、配置管理、数据重置、V6 迁移面板 |

---

## 六、其他（1 个入口）

| 序号 | 功能模块名称 | 页面路径 | 路由路径 | 用户操作描述 |
|:---|:---|:---|:---|:---|
| 27 | Mock 测试页 | `src/pages/MockTestPage.tsx` | `/mock-test` | V9 模块 Mock 验证页（Slider/Sheet/Toggle/Engine） |

---

## 七、汇总统计

| 类别 | 入口数 | 说明 |
|:---|:---|:---|
| 门户与驾驶舱 | 3 | 首页 + 驾驶舱 + 404 |
| 输入舱 | 6 (+1 临时) | Hub + 4 子面板 + 本地知识库 + 采集测试 |
| 分析舱 | 9 | Hub + 8 子页面 |
| 交易舱 | 4 | Hub + 交易信号 + 策略快照 + 持仓管理 |
| 输出舱 + 总控舱 | 4 | 输出舱 + 总控 Hub + 总控 + — |
| 其他 | 1 | Mock 测试页 |
| **合计** | **27** | 已注册路由 26 条（含 1 条 `*` 兜底） |

---

## 八、路由注册说明

- **路由注册表**：`src/config/routes.ts` — 项目路由唯一真相源
- **路由方式**：`HashRouter`（`src/App.tsx`）
- **舱室入口路由**（`/input` `/analysis` `/trading` `/output` `/command`）统一渲染 `PortalShell`，由 PortalShell 根据 `pathname` 激活对应舱室应用
- **子路由分发**：InputApp 内部通过 `useLocation().pathname` 判断当前路径，渲染对应子面板（BulkImportPanel / HotSectorPanel / DataTestPanel / InputPrototype / InputDashboard）
- **分析舱子页面**：`/analysis/stock-score` 等路由排在舱室入口之后，React Router 按顺序匹配

---

## 九、变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|:---|:---|:---|:---|
| 2026-06-27 | v1.0.0 | 阶段二：扫描 routes.ts + pages/ + apps/ 生成完整功能入口清单（27 个入口） | Quality Auditor |