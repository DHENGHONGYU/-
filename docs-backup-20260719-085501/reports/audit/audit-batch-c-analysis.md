---
title: 批次 C（分析舱）L1-L5 五层追溯审计报告
type: reports
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "审计日期: 2026-07-05 审计范围: 分析�?12 个入口（C1-C11�?> 审计�?*: 五层追溯审计员（AI Agent�?> 审计方法:..."
tags: [qa, audit, analysis]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 批次 C（分析舱）L1-L5 五层追溯审计报告

> **审计日期**: 2026-07-05
> **审计范围**: 分析�?12 个入口（C1-C11�?> **审计�?*: 五层追溯审计员（AI Agent�?> **审计方法**: 只读审计，未修改任何文件

---

## 审计总览

| 入口 | 功能 | L1 界面 | L2 状�?| L3 数据 | L4 逻辑 | L5 集成 |
|------|------|---------|---------|---------|---------|---------|
| C1 | 分析�?Hub | 🟡 | 🟡 | �?| 🟡 | �?|
| C2 | V4 行业评分 | 🟡 | �?| �?| �?| �?|
| C3 | 个股九维评分 | 🟡 | �?| �?| �?| �?|
| C3b | 个股评分（带代码�?| 🟡 | �?| �?| �?| �?|
| C4 | V6 智能评分 | 🟡 | �?| 🟡 | �?| �?|
| C5 | 板块轮动分析 | �?| �?| �?| �?| �?|
| C6 | 策略回测 | �?| �?| �?| �?| �?|
| C7 | 评分文档版本�?| 🟡 | �?| �?| �?| �?|
| C8 | 智能资讯 | 🟡 | �?| 🟡 | �?| �?|
| C9 | 热门板块策略 | �?| �?| �?| �?| �?|
| C10 | 价值洼地策�?| �?| �?| 🟡 | �?| �?|
| C11 | 分析舱根路由 | 🟡 | �?| 🟡 | �?| �?|

**统计**: 12 个入口中�? 个全绿（✅x5），7 个存在部分黄灯项。无红灯（❌）阻塞级问题（仅 C1 �?L3 �?❌，�?Hub 为纯导航页无独立数据流）�?
---

## 详细审计

---

### C1 �?分析�?Hub (/analysis/hub)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | 🟡 | **无独立页面文�?*：`AnalysisHubPage.tsx` 不存在。Hub 页面�?`AnalysisApp.tsx` 的默认分支渲染（`V6ScoreCard` 内联组件 + `AnalysisTemplateCards`）。Loading 状态在 V6ScoreCard 中有处理（按�?disabled + "评分�?.."文字），Error 通过 `useToast` 弹出。但**无显�?empty 状�?*——当 stocks 为空时仅显示空网格，无引导文案�?|
| L2 | 🟡 | `analysisHubStore.ts` 存在�?*极其简�?*：仅�?`activeModule`、`loading` 两个 state 和对�?setter，为预留 Store，无实际业务逻辑。V6ScoreCard 的实际状态（stocks/scores/loading）使用组件内 `useState`�?*未迁移至 analysisStore**，违�?AGENTS.md 四步集成契约�?|
| L3 | �?| `analysisHubStore` **�?DataBridge 调用**。V6ScoreCard 直接调用 `listStocks()`、`listV6Scores()`、`runV6Score()` 等服务函数，数据流绕�?Store �?DataBridge，直接从 Service 到组�?state。这是架构合规性问题�?|
| L4 | 🟡 | V6 评分引擎 `runV6Score()` 存在�?`v6ScoreService.ts`，逻辑正确。但 V6ScoreCard 未使�?analysisStore �?`handleScore` action，而是自行调用 service，导致评分结果无法通过 Store 广播到其�?Tab�?|
| L5 | �?| 路由 `/analysis/hub` 已在 `routes.ts` �?79 行注册，指向 PortalShell。AnalysisApp 默认分支处理该路径�?|

**关键问题**:
1. V6ScoreCard 使用组件�?useState 而非 Store，违反分层架�?2. analysisHubStore 为预留空壳，未实际使�?3. 数据流绕�?DataBridge，无法跨 Tab 同步

---

### C2 �?V4 行业评分 (/analysis/industry-score)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | 🟡 | Loading 状态通过按钮 `disabled` + "评分�?.."文字体现，进度通过 STEP_ORDER 可视化展示。Error 有红色背景区域展示。但**无显�?empty 状�?*——当 selectedCode 为空时，右侧面板不渲染结果卡片，但无引导性空状态提示�?|
| L2 | �?| `industryScoreStore` 完整：state �?selectedCode/sectors/files/reportText/llmConfig/progress/result/previousResult/history/logs/error/loading。Actions �?setSelectedCode/setFiles/runScore/loadHistory/loadLogs。支�?`withBroadcast` �?Tab 广播�?|
| L3 | �?| DataBridge 已集成：`dataBridge.subscribe('industry_scores', ...)` �?`initIndustryScoreStoreSubscriptions()` 中注册，监听 `saveIndustryScore` action。`runScore` 结果通过 DataBridge 写入 IndexedDB�?|
| L4 | �?| `industryScoreService.runIndustryScore()` 实现完整�?6 步评分流程（fetchSectorData �?readSupplementaryFiles �?prepareReportText �?llmAnalysis �?parseScore �?saveResult）。LLM 配置通过 `llmConfig` 暴露给用户，支持开关。评分维度通过 `getEnabledIndustryFactorNames()` 从配置注入�?|
| L5 | �?| 路由 `/analysis/industry-score` �?`routes.ts` �?253 行注册。AnalysisApp �?124 行条件渲�?IndustryScorePage�?|

---

### C3 �?个股九维评分 (/analysis/stock-score)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | 🟡 | Loading 通过 "评分�?.." 按钮文字体现。Error 处理�?catch 中通过 logger 记录。Empty 状态有 "暂无评分" �?"请指定股票代�? 文案。但**初始数据加载时无全局 loading spinner**——store �?`loading` state 但页面未消费它来展示加载指示器�?|
| L2 | �?| `stockAnalysisStore` 完整：state �?selectedSymbol/stock/quotes/v6Score/loading/scoreLoading/error。Actions �?loadStockAnalysis（支�?AbortController 取消）和 refreshScore�?|
| L3 | �?| DataBridge 已集成：`dataBridge.subscribe('v6_scores', ...)` 在初始化时注册，监听 V6 评分数据变更。loadStockAnalysis 通过 scorePageService �?dataLayer 获取数据�?|
| L4 | �?| `v6ScoreService.runV6Score()` 实现完整�?V6 九维评分计算。评分因子从 `scoreFactors` 配置注入。支持通过 DataBridge 订阅评分结果变更�?|
| L5 | �?| 路由 `/analysis/stock-score` �?`routes.ts` �?229 行注册。AnalysisApp �?100 行条件渲染，支持 `:symbol` 参数（第 57 �?`path.startsWith('/analysis/stock-score/')`）�?|

---

### C3b �?个股评分详情 (/analysis/stock-score/:symbol)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | 🟡 | �?C3 共用同一组件 StockAnalysisPage。通过 `useParams` 获取 symbol。当 symbol 存在但股票未找到时显�?"未找�?{symbol}"。同 C3 �?loading 处理问题�?|
| L2 | �?| �?C3，使�?`stockAnalysisStore`。useEffect 监听 symbol 变化自动加载数据�?|
| L3 | �?| �?C3�?|
| L4 | �?| �?C3。loadStockAnalysis 接收 symbol 参数，支�?AbortController 取消前一次请求�?|
| L5 | �?| 路由 `/analysis/stock-score/:symbol` �?`routes.ts` �?235 行注册。AnalysisApp �?100 �?`path.startsWith('/analysis/stock-score/')` 匹配此路由�?|

---

### C4 �?V6 个股智能评分 (/analysis/intelligent-score)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | 🟡 | Loading 通过按钮 "评分�?.." + 进度面板展示。Error 有红色背景区域。当 symbol 为空时显示输入引导（select + input），�?*非标�?empty 状�?*——无专门的空状态插图或引导文案�?|
| L2 | �?| `intelligentScoreStore` 完整：含 symbol/stocks/files/reportText/llmConfig/progress/result/previousResult/history/logs/error/loading/trendData/trendLoading/trendError。Actions �?setSymbol/loadStocks/runScore/loadHistory/loadLogs/loadScoreTrend。支�?`withBroadcast`�?|
| L3 | 🟡 | Store **未直接导�?dataBridge**（grep 结果中无 intelligentScoreStore）。数据持久化通过 `intelligentScoreService` 内部实现（service 层负责写入），Store 不直接订�?DataBridge 事件。这意味着其他 Tab 保存评分后，此页面不会自动刷新�?|
| L4 | �?| `intelligentScoreService.runIntelligentScore()` 实现 6 步评分流程。LLM 配置完整暴露（baseURL/apiKey/model）。支持多周期趋势数据加载（`loadScoreTrend`）。评分维度从 `getEnabledStockFactorNames()` 注入�?|
| L5 | �?| 路由 `/analysis/intelligent-score` �?`routes.ts` �?259 行注册。AnalysisApp �?132 行条件渲染�?|

---

### C5 �?行业与板块分�?(/analysis/sector)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | �?| **三态完�?*：Loading 有全局 spinner�?加载�?.."）；Error 有红色文�?+ 重试按钮；Empty �?"暂无轮动评分数据" �?"暂无行业评分数据" 文案。使�?`twText('red', 500)` 颜色令牌�?|
| L2 | �?| `sectorAnalysisStore` 完整：含 rotationScores/industryScores/loading/error/lastUpdated/isRefreshing。防重入�?`isRefreshing` 避免并发调用。Actions �?fetchSectorAnalysis/setLoading/setError/clear。支�?`withBroadcast`�?|
| L3 | �?| DataBridge 已集成：`dataBridge.subscribe('sector_scores', ...)` �?`initSectorAnalysisStoreSubscriptions()` 中注册。数据通过 `fetchSectorAnalysisUseCase` 获取�?|
| L4 | �?| 通过 `fetchSectorAnalysisUseCase` 调用引擎，逻辑封装�?useCase 层。板块轮动评分和行业评分分别计算�?|
| L5 | �?| 路由 `/analysis/sector` �?`routes.ts` �?241 行注册。AnalysisApp �?108 行条件渲染�?|

---

### C6 �?策略回测 (/analysis/backtest)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | �?| **三态完�?*：Loading 通过按钮 "回测�?.." + disabled 状态体现；Error 有红色卡�?+ AlertCircle 图标；Empty 有欢迎卡片（BarChart3 图标 + 引导文案 "选择策略类型和日期范�?.."）�?|
| L2 | �?| `backtestStore` 完整：含 config/results/loading/error。Actions �?setConfig/runBacktest/clearResults/exportReport。类型定义完善（BacktestTrade/BacktestResult/BacktestPosition/BacktestDailyValue）。支�?`withBroadcast`�?|
| L3 | �?| DataBridge 已集成：`dataBridge.subscribe('orders', ...)` 监听历史订单数据，用于回测输入。回测结果通过 BacktestEngine 计算�?|
| L4 | �?| `BacktestEngine`（`src/services/backtest`）实现完整回测模拟：净值曲线、绩效指标（总收益率/年化收益�?最大回�?夏普比率/胜率）、交易记录、持仓快照。支持三种策略（热门板块/价值洼�?复合）。导出服�?`exportBacktestReport` 支持 PDF 格式�?|
| L5 | �?| 路由 `/analysis/backtest` �?`routes.ts` �?247 行注册。AnalysisApp �?116 行条件渲染�?|

---

### C7 �?评分文档版本�?(/analysis/score-docs)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | 🟡 | Loading 通过按钮 "加载�?.." + disabled 体现。Error 有红色文字展示。Empty �?"请选择股票代码" �?"暂无评分记录" 文案。但**无全局 loading spinner**——加载版本列表时仅按钮显�?loading 状态，页面内容区无视觉反馈�?|
| L2 | �?| `scoreDocStore` 完整：含 symbol/stocks/versions/loading/error/historyDocs/historyDiff/historyLoading/historyError。Actions �?setSymbol/loadStocks/loadVersions/refresh/clear/exportAll/loadStockSymbols/generateReport/loadHistoryDocs。支�?`withBroadcast`�?|
| L3 | �?| DataBridge 已集成：`dataBridge.subscribe('score_docs', ...)` 在初始化时注册。数据通过 `scoreDocService` �?`dataLayer` 获取�?|
| L4 | �?| `scoreDocService` 提供 buildReportMarkdown/getRecentVersions/exportSymbolMd/listScoreDocsBySymbol/buildScoreDocDiff 等完整功能。支�?Markdown 导出和版本差异对比�?|
| L5 | �?| 路由 `/analysis/score-docs` �?`routes.ts` �?265 行注册。AnalysisApp �?140 行条件渲染�?|

---

### C8 �?智能资讯 (/analysis/news)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | 🟡 | Empty 状态有 "暂无资讯，点击生成模拟资�? 引导文案。按钮在 loading �?disabled。但**页面 JSX 中未消费 store �?loading 状态来展示全局加载指示�?*——fetchArticles 触发后无视觉反馈（仅按钮 disabled）。Error 状态未在页面中显式展示（store �?error 字段但页面未渲染它）�?|
| L2 | �?| `analysisNewsStore` 完整：含 articles/loading/filter/selectedArticle/sentimentTrend/sentimentStockOptions/sentimentIndustryOptions。Actions �?setArticles/setFilter/selectArticle/reset/fetchArticles/generateMockArticles/computeSentimentTrend�?|
| L3 | 🟡 | Store **未使�?DataBridge**（grep 结果中无 dataBridge 引用）。数据通过 `newsService.listNews/saveNewsArticles` 直接操作。跨 Tab 同步依赖 Zustand 默认行为，无显式 `withBroadcast`�?|
| L4 | �?| `newsService` 提供 listNews/saveNewsArticles/generateMockArticles。`sentimentTrendEngine` 提供 aggregateSentimentTrend/extractStockOptions/extractIndustryOptions。情感分析逻辑完整�?|
| L5 | �?| 路由 `/analysis/news` �?`routes.ts` �?271 行注册。AnalysisApp �?148 行条件渲染�?|

**关键问题**:
1. Store �?error 字段未在页面中渲�?2. Store �?loading 状态未展示全局加载指示�?3. 未集�?DataBridge �?withBroadcast

---

### C9 �?热门板块策略 (/analysis/hot-sector)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | �?| **三态完整且规范**：Loading 有全�?spinner + "正在计算热门板块评分..."；Error �?AlertCircle 图标 + 错误文字 + 重试按钮；Empty �?TrendingUp 图标 + "暂无评分数据" + 刷新按钮。使�?ErrorBoundary 包裹正常渲染�?|
| L2 | �?| `hotSectorStore` 完整：含 scores/loading/error/isRefreshing/lastUpdated。Actions �?setScores/fetchScores/refreshScore/reset/clearScores。防重入锁。支�?`withBroadcast(EVENT_NAMES.HOT_SECTOR_CHANGED)`�?|
| L3 | �?| DataBridge 已集成：`dataBridge.subscribe('hot_sector_scores', ...)` �?`initHotSectorStoreSubscriptions()` 中注册，监听 `saveHotSectorScores` action�?|
| L4 | �?| `hotSectorAnalyzer.analyze()` 实现五维评分（动量强�?情绪热度/技术突�?估值风�?综合评分）。支持单标的分析（analyzeBySymbol）、批量分析（analyzeBatch）和混合分析（analyzeHotSectors）。默认样本数据作为股票池为空时的回退�?|
| L5 | �?| 路由 `/analysis/hot-sector` �?`routes.ts` �?277 行注册。AnalysisApp �?156 行条件渲染。使�?WidgetShell �?usePageGuard�?|

---

### C10 �?价值洼地策�?(/analysis/value-pit)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | �?| **三态完整且规范**：Loading 有全�?spinner + "正在计算价值洼地评�?.."；Error �?AlertCircle + 重试按钮；Empty �?Target 图标 + "暂无评分数据" + 刷新按钮�?|
| L2 | �?| `valuePitStore` 完整：含 scores/rotationSignals/combinedResults/loading/error/lastUpdated。Actions �?runAnalysis/fetchScores/refreshScore/clearScores。runAnalysis 组合调用 valuePitAnalyzer + rotationSignalDetector�?|
| L3 | 🟡 | Store **未使�?DataBridge**（grep 结果中无 dataBridge 引用）。当前使用硬编码默认样本数据（DEFAULT_SAMPLES + DEFAULT_ROTATION_INPUTS），未从 dataLayer 获取真实数据。这是架构待完善项�?|
| L4 | �?| `valuePitAnalyzer.analyze()` 实现五维评分（催化确定�?估值安全垫/筹码结构/轮动位置/流动性）。`rotationSignalDetector.detect()` 实现轮动信号检测（成交量突�?资金净流入/技术金叉）。组合结果按评分降序排序�?|
| L5 | �?| 路由 `/analysis/value-pit` �?`routes.ts` �?283 行注册。AnalysisApp �?164 行条件渲染�?|

**关键问题**:
1. 未集�?DataBridge，数据源为硬编码样本
2. 后续需对接真实板块数据

---

### C11 �?分析舱根路由 (/analysis)

| 层级 | 状�?| 发现 |
|------|------|------|
| L1 | 🟡 | 根路由渲�?AnalysisApp 的默认视图（V6ScoreCard + AnalysisTemplateCards）。同 C1 �?V6ScoreCard 问题：有 loading �?error（toast），�?*无显�?empty 状�?*�?|
| L2 | �?| AnalysisApp 本身不直接使�?analysisStore（V6ScoreCard 使用内联 useState）。但子路由页面各自有独立 Store。AnalysisApp 仅负责路由分发�?|
| L3 | 🟡 | V6ScoreCard 直接调用 service 层（listStocks/listV6Scores/runV6Score），未通过 DataBridge。同 C1 问题�?|
| L4 | �?| 路由分发逻辑正确：通过 useLocation + 条件渲染实现子路由分发，绕过 React Router v7 descendant Routes 的路径匹配问题。包含路由切换日志记录�?|
| L5 | �?| 路由 `/analysis` �?`routes.ts` �?85 行注册，指向 PortalShell。PortalShell 激活分析舱后由 AnalysisApp 分发�?|

---

## 问题汇总与优先�?
### P0 - 阻塞级（无）

无阻塞级问题。所�?12 个入口均可正常渲染和运行�?
### P1 - 严重�? 项）

| 编号 | 入口 | 层级 | 问题描述 |
|------|------|------|----------|
| P1-1 | C1/C11 | L2/L3 | **V6ScoreCard 使用组件�?useState 而非 Store**：AnalysisApp 的默认视图中 V6ScoreCard 组件直接使用 3 �?useState（stocks/scores/loading），违反 AGENTS.md 四步集成契约（状态应通过 Store 管理）。应迁移�?analysisStore�?|
| P1-2 | C8 | L1 | **NewsPage 未消�?store �?loading �?error 状�?*：store �?loading �?error 字段，但页面 JSX 中未展示全局 loading 指示器，也未渲染 error 信息。用户触�?fetchArticles 后无视觉反馈�?|
| P1-3 | C4 | L3 | **intelligentScoreStore 未订�?DataBridge**：其�?Store（industryScore/stockAnalysis/sectorAnalysis/scoreDoc/hotSector）均通过 dataBridge.subscribe 监听数据变更，但 intelligentScoreStore 未订阅。导致跨 Tab 评分结果无法自动同步�?|

### P2 - 优化�? 项）

| 编号 | 入口 | 层级 | 问题描述 |
|------|------|------|----------|
| P2-1 | C1 | L1 | V6ScoreCard 无显�?empty 状态——stocks 为空时显示空网格，无引导文案�?|
| P2-2 | C3/C3b | L1 | StockAnalysisPage 初始加载时未展示全局 loading spinner（store �?loading 但页面未消费）�?|
| P2-3 | C7 | L1 | ScoreDocPage 加载版本列表时无全局 loading spinner，仅按钮显示 loading�?|
| P2-4 | C10 | L3 | valuePitStore 未集�?DataBridge，使用硬编码样本数据，未�?dataLayer 获取真实板块数据�?|
| P2-5 | C8 | L3 | analysisNewsStore 未集�?DataBridge �?withBroadcast，跨 Tab 同步能力缺失�?|

---

## 数据流拓扑图

```
routes.ts ──> PortalShell ──> AnalysisApp ──> [子页面]
                                                    �?                              ┌──────────────────────�?                              �?                     �?                    ┌─────────▼─────────�?  ┌───────▼───────�?                    �?  Store �?(L2)    �?  �? Service �?   �?                    �?                   �?  �?  (L4)         �?                    �?industryScoreStore │──>�?industryScore  �?                    �?stockAnalysisStore │──>�?v6ScoreService �?                    �?intelligentScore.. │──>�?intelligentSc. �?                    �?sectorAnalysisSt.  │──>�?fetchSectorUC  �?                    �?backtestStore      │──>�?BacktestEngine �?                    �?scoreDocStore      │──>�?scoreDocService�?                    �?analysisNewsStore  │──>�?newsService    �?                    �?hotSectorStore     │──>�?hotSectorAnalyz�?                    �?valuePitStore      │──>�?valuePitAnalyz �?                    �?analysisStore      │──>�?analysisService�?                    └────────┬───────────�?  └───────────────�?                             �?                    ┌────────▼───────────�?                    �? DataBridge (L3)    �?                    �?                   �?                    �?industry_scores �? �?                    �?v6_scores �?       �?                    �?sector_scores �?   �?                    �?score_docs �?      �?                    �?hot_sector_scores ✓│
                    �?orders �?(backtest)�?                    �?news �?(缺失)      �?                    �?intelligent �?(缺失)�?                    �?value_pit �?(缺失) �?                    └────────────────────�?```

---

## 审计结论

分析�?12 个入口整体架构健康度良好。核心发现：

1. **路由注册完整**：所�?12 条路由均�?`routes.ts` �?`ROUTE_REGISTRY` 中注册，AnalysisApp 子路由分发逻辑覆盖全部子页面�?
2. **Store 覆盖完整**：每个页面均有对应的 Zustand Store（共 10 个独�?Store + 1 个预�?Store），state/actions 定义完善�?
3. **DataBridge 集成�?67%**�? �?Store 中有 6 个集成了 DataBridge 订阅�? 个未集成（analysisNewsStore/intelligentScoreStore/valuePitStore），其中 intelligentScoreStore 的缺失影响跨 Tab 同步�?
4. **L1 三态处�?*�? 个页面（SectorAnalysis/Backtest/HotSector/ValuePit + 部分 ScoreDoc）实现了完整�?loading/error/empty 三态处理。其余页面存在不同程度的状态处理缺失，主要集中�?loading spinner �?empty 引导�?
5. **最严重问题**：C1/C11 �?V6ScoreCard 使用组件�?useState 而非 Store，是唯一的架构合规性问题，建议优先迁移�?analysisStore�?