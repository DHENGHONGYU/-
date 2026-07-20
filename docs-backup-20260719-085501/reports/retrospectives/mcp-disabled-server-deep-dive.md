---
title: 6 �?Disabled MCP Server 深度复盘报告
type: reports
domain: ai
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "审计日期: 2026-07-20 审计对象: `backtest`, `export`, `input`, `screening`, `stockpool`, `trade` 审计范围:..."
tags: [ai, mcp, review]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 6 �?Disabled MCP Server 深度复盘报告

> **审计日期**: 2026-07-20  
> **审计对象**: `backtest`, `export`, `input`, `screening`, `stockpool`, `trade`  
> **审计范围**: 源码实现、Service 依赖、业务调用链、设计意图对�? 
> **报告存放**: `./mcp-disabled-server-deep-dive.md`

---

## 执行摘要

| Server | 源码状�?| Service �?| 业务调用 | 设计意图达成�?| 核心根因 | 建议 |
|--------|---------|-----------|---------|--------------|---------|------|
| backtest | �?完整 | �?存在 | 0（ACL矩阵+测试引用�?| ⚠️ 部分 | 参数复杂，MCP 薄包装无人需�?| �?保留（Agent 编排用） |
| export | �?完整 | �?存在 | 0 | �?未达�?| 依赖 backtest（已 disabled）；�?MCP 调用入口 | ⚠️ 降级�?service 函数 |
| input | �?完整 | �?活跃使用 | 0（Service 层被多处调用�?| �?未达�?| UI 直接�?Service，MCP 薄包装无人需�?| ⚠️ 合入 fetcher:data |
| screening | �?完整 | �?存在 | 0（UI 直接�?engine�?| ⚠️ 部分 | UI 有完整交互组件，MCP 无人�?| �?保留（Agent 编排用） |
| stockpool | �?完整 | �?活跃使用 | 0（Service 层被多处调用�?| ⚠️ 部分 | UI 直接�?Service，MCP 薄包装无人需�?| �?保留（Agent 内省工具�?|
| trade | �?完整 | �?存在 | 0 | �?未达�?| �?trading:main 功能重叠，边界不�?| ⚠️ 合入 trading:main |

> **关键洞察**: 6 �?Server 中有 4 个（input/screening/stockpool/backtest）的 Service 层实际上被业务代码活跃使用，�?*全部�?UI 旁路**——UI 直接调用 Service/Store，不�?MCP 层。这�?V9 项目 MCP 架构的系统性问题：**MCP �?薄包�?，有 Service 直连路径时无人需�?*�?
---

## 一、backtest �?回测引擎

### 1.1 设计意图验证

**原始设计意图**�?- 作为 Agent 编排能力的组成部分，提供策略回测、绩效分析、风险指标计�?- 支持通过 MCP 参数化配置（symbol, startDate, endDate, strategy, initialCapital�?- 依赖 fetcher 获取行情数据，依�?scoring:v6 获取评分数据

**实际表现**�?- `BacktestEngine` Service 完整存在，`src/services/backtest/BacktestEngine.ts` 已实�?- `BacktestServer` �?`run_backtest` Tool 参数定义清晰，支�?4 个配置字�?- `run_backtest` �?`mcpAclMatrix.ts` 和单元测试中有引用，�?*无业务代码直接调�?*
- �?`analysisTemplatesConfig.ts` 中被列为分析模板之一，但模板本身仅配置，不触发实际调�?
**设计意图达成�?*: ⚠️ **部分达成** �?引擎核心资产完整，但 MCP 包装层交付即闲置�?
### 1.2 偏差原因排查

**根因：MCP �?薄包�?，但回测参数不适合 schema 化表�?*

具体表现�?1. **参数复杂�?*: `run_backtest` 需�?symbol + startDate + endDate + strategy + initialCapital。虽�?schema 可以定义，但回测的真正复杂度在于策略规则（MA 交叉、评分阈值、止损条件等），这些规则无法通过 5 个简单参数表达�?2. **UI 路径缺失**: 没有页面或组件通过 `mcpBridge.callTool('backtest', 'run_backtest', ...)` 发起回测。现有的分析页面（`AnalysisApp.tsx`）直接调�?`analysisService` �?`scoringEngine`，不经过 MCP�?3. **Agent 编排未接�?*: `agentComponentRegistry.ts` 中没有注册回�?Agent，Agent 运行时不会自动调�?`run_backtest`�?
**责任归属**: 技术方案缺陷（将复杂引擎强�?MCP 化）+ 资源限制（未建设回测 UI 页面）�?
### 1.3 当前卡点定位

| 卡点 | 优先�?| 说明 |
|------|--------|------|
| 无回测触发页�?| P1 | 缺少回测配置页面，用户无法通过 UI 发起回测 |
| 策略参数难以 MCP �?| P1 | 复杂策略规则（如"MA20 上穿 MA60 �?V6 评分 > 4.0"）无法通过简�?JSON schema 表达 |
| Agent 未注�?| P2 | 未在 `agentComponentRegistry.ts` 中注册回�?Agent |
| 依赖 scoring:v6 未就�?| P2 | 虽然 scoring:v6 �?enabled，但 backtest 本身未启用，无法形成调用�?|

### 1.4 遗漏项识�?
- **边界场景**: 未考虑回测结果的可视化展示（收益曲线、回撤图、交易明细表）。当�?`run_backtest` 返回�?JSON 文本，无配套 UI 组件消费�?- **性能影响**: `BacktestEngine` 每次调用�?`new BacktestEngine()` 实例，无缓存或状态复用。高频回测可能导�?GC 压力�?- **兼容�?*: `strategy` 字段使用 `as BacktestStrategy` 强制类型转换，若传入非法策略名会运行时错误，�?schema 中未限制 enum 值�?- **异常处理**: handler 中未捕获 `engine.run()` 的异常，若引擎抛出错误会直接向上传播，可能导�?MCP 通道崩溃�?
### 1.5 复盘与提�?
| 5W1H | 内容 |
|------|------|
| **What** | 回测引擎 MCP 化后交付即闲置，Tool 零业务调�?|
| **Why** | 复杂策略参数不适合 MCP schema 表达；缺少回�?UI 页面；Agent 未注�?|
| **Where** | `src/mcp/servers/backtest/backtestServer.ts` / `src/services/backtest/BacktestEngine.ts` |
| **When** | Phase 1 MCP 核心业务 Server 迁移�?026-07-04）引�?|
| **Who** | 架构决策 + 前端开�?|
| **How** | 保留引擎（核心资产），但 disabled MCP 包装层；待建设回测页面和 Agent 后再恢复 |

**经验教训**�?1. **复杂引擎不适合 MCP 薄包�?*: 回测引擎的参数复杂度远超 MCP 适合处理的范畴。此类引擎应作为 Service 直接暴露�?UI，或设计专门�?DSL 配置界面�?2. **MCP 化前必须确认调用�?*: 在将引擎包装�?MCP Server 之前，必须确认至少有一个调用方（UI 页面、Agent、或定时任务）会通过 MCP 调用它。否则就�?�?MCP �?MCP"�?3. **核心资产与包装层分离**: `BacktestEngine` 是核心资产，应始终保留；`BacktestServer` 是包装层，可以按需启停。这种分离是正确的，但应在文档中明确区分�?
---

## 二、export �?数据导出

### 2.1 设计意图验证

**原始设计意图**�?- 导出回测报告�?PDF �?Excel 格式
- 依赖 backtest 结果，接�?`BacktestResult` + `BacktestConfig` 生成报告
- 早期设计通过 `backtestStore.getBacktestById()` 查询结果，后改为方案 B（直接传�?result/config�?
**实际表现**�?- `backtestExportService.ts` 存在，`exportBacktestReport` 函数已实�?- `ExportServer` �?`export_backtest_report` Tool 定义完整，注释说明已解除 store 依赖
- **零业务调�?*：无任何页面、Agent、或组件调用�?Tool
- �?`mcpAclInterceptor.test.ts` �?`exportServer.test.ts` 中有测试覆盖

**设计意图达成�?*: �?**未达�?* �?从未真正可用�?
### 2.2 偏差原因排查

**根因：依赖未就绪 + 无调用入口，双重阻塞**

1. **P0 阻塞（已解除�?*: 原始设计依赖 `backtestStore.getBacktestById()`，但�?API 未实现�?026-07-13 方案 B 改为直接�?result/config，解除了跨层违规。但解除后仍无人调用�?2. **上游依赖 disabled**: `backtest` Server 本身�?disabled，即�?export 恢复，也没有回测结果可以导出�?3. **UI 无导出入�?*: 没有页面或按钮触�?`export_backtest_report`。交易复盘页面（`TradeReviewPage.tsx`）展示的是交易记录，不是回测报告�?4. **报告生成�?MCP 无关**: 导出报告�?*纯输出型操作**，不需�?MCP �?请求-响应"模式。UI 可以直接调用 `exportBacktestReport(result, config, {format: 'pdf'})`，不需要经�?MCP 层�?
**责任归属**: 需求理解偏差（将纯输出操作强行 MCP 化）+ 技术阻塞（backtest 未就绪）�?
### 2.3 当前卡点定位

| 卡点 | 优先�?| 说明 |
|------|--------|------|
| 上游 backtest 未启�?| P0 | 没有回测结果，export 无数据可导出 |
| �?UI 导出入口 | P0 | 没有任何页面提供"导出回测报告"按钮 |
| 报告生成不需�?MCP | P1 | 导出是纯副作用操作，MCP 层增加无意义延迟 |

### 2.4 遗漏项识�?
- **边界场景**: 未考虑大报告的分片导出。若回测结果包含数万条交易记录，JSON �?PDF/Excel 可能内存溢出�?- **异常处理**: `exportBacktestReport` 的异常处理未�?handler 中捕获，若导出失败会返回 `isError: undefined`（未设置）�?- **格式扩展**: 仅支�?pdf/excel，未考虑 csv/html/markdown 等轻量格式�?- **国际�?*: 报告中的中文标题和描述未接入 i18n 系统�?
### 2.5 复盘与提�?
| 5W1H | 内容 |
|------|------|
| **What** | Export MCP Server 从未被调用，P0 阻塞解除后仍无使用场�?|
| **Why** | 纯输出操作不需�?MCP 包装；上�?backtest 未就绪；�?UI 入口 |
| **Where** | `src/mcp/servers/portfolio/portfolioServer.ts` / `src/services/export/backtestExportService.ts` |
| **When** | 2026-07-05 创建�?026-07-13 方案 B 解除 P0 阻塞 |
| **Who** | 架构决策 |
| **How** | 降级�?Service 函数，移�?MCP 包装层；�?backtest 恢复后，UI 直接调用 export service |

**经验教训**�?1. **纯输出操作不�?MCP �?*: 导出、下载、打印等纯副作用操作不需�?MCP �?工具调用"抽象。MCP 适合"查询-计算-决策"型交互，不适合"生成-下载"型操作�?2. **P0 阻塞解除 �?功能可用**: 解除技术阻塞后，必须验证是否有真实的业务调用链。export 是典型例子：P0 解除后，发现根本无人需要调用它�?3. **依赖倒置检�?*: �?design 阶段应检�?谁依赖谁"。export 依赖 backtest，但 backtest 本身未就绪。这�?依赖链断�?应在设计评审时发现�?
---

## 三、input �?数据录入

### 3.1 设计意图验证

**原始设计意图**�?- 提供股票添加、搜索、股票池导入导出�?MCP 工具
- 作为 fetcher 的补充，处理"数据录入"这一独立子域
- 6 �?Tool：add_stock, search_stocks, add_stock_from_search, list_input_stocks, export_stock_pool, import_stock_pool

**实际表现**�?- `inputService.ts` �?*多处业务代码活跃使用**�?  - `InputDashboard.tsx` 直接调用 `addStock`
  - `batchImportExecutor.ts` 直接调用 `addStock`
  - `hotSectorService.ts` 直接调用 `addStock`
  - `StockSearch.tsx` 通过 `useInputHubStore` 调用 `addStockFromSearch`
- **但全部直接调�?Service，不�?MCP**。`InputServer` �?6 �?Tool 零业务引用�?
**设计意图达成�?*: �?**未达�?* �?Service 层被活跃使用，但 MCP 层完全闲置�?
### 3.2 偏差原因排查

**根因：input �?6 个工具与 fetcher 天然配合，UI 直接�?Service/Store**

1. **UI 组件直接绑定 Service**: `InputDashboard.tsx` �?51 行直�?`import { addStock } from '@/services/input/inputService'`，没有任�?MCP 调用�?2. **Store 封装**: `useInputHubStore` 封装�?`addStockFromSearch`，组件通过 Store 而非 MCP 获取数据�?3. **MCP �?薄包�?**: `InputServer.add_stock` �?handler 就是 `await addStock({symbol, name})`，没有任何额外逻辑。UI 直接调用 Service 更直接、更快�?4. **自然合并趋势**: input 的添�?搜索功能�?fetcher 的数据获取功能天然配合。在 UI 层面，用�?搜索股票 �?添加股票"的流程由 `StockSearch` 组件 + `InputHubStore` 完成，不需要经�?MCP 层�?
**责任归属**: 架构设计问题（input 作为独立 MCP Server 的必要性未充分论证�? 前端开发习惯（直接调用 Service）�?
### 3.3 当前卡点定位

| 卡点 | 优先�?| 说明 |
|------|--------|------|
| UI 组件已绑�?Service | P0 | InputDashboard、StockSearch 等组件直�?import Service，改造成 MCP 调用需大面积重�?|
| �?fetcher 功能重叠 | P1 | input �?search_stocks �?fetcher �?fetch_stock_basic 功能重叠 |
| �?Agent 注册 | P2 | 未在 `agentComponentRegistry.ts` 中注�?input Agent |

### 3.4 遗漏项识�?
- **批量导入边界**: `import_stock_pool` �?handler �?`args.payload as never` 是类型安全漏洞。未校验 payload 结构，恶意数据可能导致导入失败或数据污染�?- **事务一致�?*: `add_stock` 先添加股票到股票池，然后异步拉取基础数据（`fetchStockBasic`）。若拉取失败，股票已在池中但数据不完整，形成"脏数�?�?- **重复添加**: `addStock` 未检�?symbol 是否已存在，重复添加可能导致唯一键冲突（取决于底�?DB schema）�?- **权限控制**: 未区�?录入权限"�?查看权限"。任何调用方都可�?export/import 股票池�?
### 3.5 复盘与提�?
| 5W1H | 内容 |
|------|------|
| **What** | Input MCP Server �?6 �?Tool 零业务调用，�?Service 层被活跃使用 |
| **Why** | UI 直接�?Service/Store，MCP 薄包装无人需要；input �?fetcher 功能重叠 |
| **Where** | `src/mcp/servers/data-collector/dataCollectorServer.ts` / `src/services/input/inputService.ts` |
| **When** | 2026-07-05 创建 |
| **Who** | 前端开发习�?+ 架构设计 |
| **How** | 合入 fetcher:data；保�?Service 层；inputServer 作为独立 Server 无必�?|

**经验教训**�?1. **"薄包�?Server 是反模式**: 如果 MCP Server �?handler 只是简单转发到 Service 函数，那这个 Server 就是"薄包�?。在已有 Service 直连路径时，薄包�?Server 永远不会被使用�?2. **功能重叠检�?*: 在新�?Server 前，必须检查现�?Server 是否已覆盖相似功能。input �?`search_stocks` �?fetcher �?`fetch_stock_basic` 功能重叠，应合并而非拆分�?3. **Store 优先 vs MCP 优先**: 前端组件倾向于通过 Store 获取数据，而非通过 MCP 调用。若设计目标�?前端通过 MCP 调用"，必须在组件层面强制约束（如通过 lint 规则禁止直接 import Service）�?
---

## 四、screening �?多因子筛�?
### 4.1 设计意图验证

**原始设计意图**�?- 提供多因子筛选的 MCP 工具：全量筛选（`run_screening`）和单股评估（`screen_single`�?- 作为 analysis 的下游能力，接收筛选条件返回符合条件的股票列表
- 支持 Resource 接口：通过 `screening://stock/{symbol}` �?`screening://all` 获取筛选结�?
**实际表现**�?- `screeningEngine.ts` �?`analysisServer.ts` 引用（`screen_stocks` Tool 内部调用 `runScreening`�?- `MultiFactorFilterPanel.tsx` 直接调用 `screeningEngine`，不通过 MCP
- `ScreeningServer` �?2 �?Tool �?2 �?Resource 零业务引�?
**设计意图达成�?*: ⚠️ **部分达成** �?引擎�?analysis �?UI 使用，但 MCP 层闲置�?
### 4.2 偏差原因排查

**根因：UI 有完整交互组件，直接调用 engine 更高�?*

1. **组件直接绑定引擎**: `MultiFactorFilterPanel.tsx` 是完整的筛�?UI，用户在前端直接配置筛选条件并执行。组件通过 `useScreeningStore` 或直接使�?`screeningEngine` 获取结果，无需经过 MCP 层�?2. **分析 Server 已覆�?*: `analysisServer` �?`screen_stocks` Tool 已经内部调用�?`runScreening()`。如�?Agent 需要筛选能力，它可以通过 `analysis:main` 而非 `screening:main` 获取�?3. **实时性要�?*: 筛选操作需要实时响应用户交互（点击"筛�?按钮�?200ms 内返回结果）。MCP 调用增加一次序列化/反序列化 + ACL 校验，延迟不可接受�?
**责任归属**: 技术方案缺陷（将实时交互操�?MCP 化）+ 需求理解偏差（未区�?实时筛�?�?批量筛�?场景）�?
### 4.3 当前卡点定位

| 卡点 | 优先�?| 说明 |
|------|--------|------|
| 实时性要求与 MCP 延迟冲突 | P0 | 筛选是实时交互，MCP 延迟不可接受 |
| analysis Server 已覆�?| P1 | Agent 可通过 `analysis.screen_stocks` 获取筛选结果，无需单独 screening Server |
| Resource 接口无消费�?| P2 | `screening://stock/{symbol}` �?`screening://all` 无任何引�?|

### 4.4 遗漏项识�?
- **分页缺失**: `run_screening` �?`limit` 参数默认 20，但�?offset/page 参数。全量筛选结果可能很大，无法分页展示�?- **条件持久�?*: 未提�?保存筛选条�?的功能。用户每次筛选都需重新配置条件�?- **结果排序**: 未提供排序参数（如按评分、按市值、按涨跌幅排序）�?- **缓存策略**: `screening://all` Resource 每次请求都重新计算，无缓存。高频访问可能导致性能问题�?
### 4.5 复盘与提�?
| 5W1H | 内容 |
|------|------|
| **What** | Screening MCP Server 闲置，UI 直接�?engine，analysis Server 已覆盖筛选能�?|
| **Why** | 实时筛选操作不适合 MCP 化；analysis Server 已提�?screen_stocks 代理 |
| **Where** | `src/mcp/servers/screening/screeningServer.ts` / `src/components/organisms/analysis/screening/MultiFactorFilterPanel.tsx` |
| **When** | 2026-07-04 创建 |
| **Who** | 架构设计 |
| **How** | 保留 engine（核心资产），disabled MCP 包装层；Agent 通过 analysis Server 获取筛选能�?|

**经验教训**�?1. **实时交互操作不应 MCP �?*: 筛选、过滤、搜索等需要实时响应的操作，应通过 Store/Service 直接处理，不应经�?MCP 层。MCP 适合"异步任务"�?Agent 编排"场景�?2. **能力聚合优于拆分**: screening 的筛选能力已整合�?analysis Server �?`screen_stocks` 中。这说明"聚合相关能力到同一 Server"�?为每个子能力建独�?Server"更合理�?3. **Resource 接口需确认消费�?*: 在定�?Resource 前，必须确认有消费者通过 `readResource` 读取它。screening �?2 �?Resource 定义完善但零消费者，是过度设计�?
---

## 五、stockpool �?股票池管�?
### 5.1 设计意图验证

**原始设计意图**�?- 管理股票池中的标的：列出（`list_pool_stocks`）、状态流转（`transition_stock`）、分组管理（`list_groups`�?- 支持研究状态机：`candidate` �?`screened` �?`deepDive` �?`watching` �?`archived`
- 提供 Resource 接口：`stockpool://stocks` �?`stockpool://groups`

**实际表现**�?- `stockpoolService.ts` �?*多处业务代码活跃使用**�?  - `usePoolDataFromStore.ts` 调用 `listStocks`
  - `useStockPoolBoard.ts` 调用 `transitionStock` �?`updateStockGroup`
  - `screeningEngine.ts` 调用 `transitionStock`
  - `scoreDocStore.ts` �?`strategySnapshotStore.ts` 调用 `listStocks`
- **但全部直接调�?Service，不�?MCP**。`StockPoolServer` �?3 �?Tool �?2 �?Resource 零业务引用（`list_pool_stocks`/`list_groups` 仅在 ACL 矩阵中引用）�?
**设计意图达成�?*: ⚠️ **部分达成** �?Service 层被活跃使用，但 MCP 层闲置。状态流转功能是核心资产�?
### 5.2 偏差原因排查

**根因：UI 直接�?Service/Store，MCP 薄包装无人需要（�?input 相同模式�?*

1. **Store 封装**: `useStockPoolBoard.ts` �?`usePoolDataFromStore.ts` 是前端状态管理层，直接调�?`stockpoolService` 获取数据。组件通过 Store 消费数据，无需经过 MCP�?2. **状态流转在 UI 中完�?*: `transition_stock` 的研究状态变更由用户在股票池看板中操作（�?移入观察"�?归档"），看板组件直接调用 `transitionStock()` 更新状态�?3. **MCP �?薄包�?**: `StockPoolServer.list_pool_stocks` �?handler 就是 `await listStocks()`，无任何额外逻辑�?
**责任归属**: 架构设计问题（stockpool 作为独立 MCP Server 的必要性未充分论证�? 前端开发习惯�?
### 5.3 当前卡点定位

| 卡点 | 优先�?| 说明 |
|------|--------|------|
| Store 层已覆盖 | P0 | `useStockPoolBoard.ts`、`usePoolDataFromStore.ts` 已提供完整数据获取能�?|
| �?Agent 使用 | P1 | 未在 `agentComponentRegistry.ts` 中注�?stockpool Agent |
| transition_stock 零引�?| P2 | �?MCP 层零引用，但 Service 层被多处使用 |

### 5.4 遗漏项识�?
- **状态流转校验缺�?*: `transitionStock` �?Service 层未校验流转是否合法（如 `candidate` �?`archived` 是否允许跳过中间状态）。当前仅校验目标状态是否有效，不校验流转路径�?- **并发冲突**: 若两个用户同时操作同一只股票的状态变更，无乐观锁或版本控制，可能导致状态覆盖�?- **分组权限**: `list_groups` 返回所有分组，未按用户权限过滤。若系统后期支持多用户，可能出现数据泄露�?- **历史追溯**: 状态流转无历史记录。无法回�?这只股票什么时候从 candidate 变成 watching 的？"

### 5.5 复盘与提�?
| 5W1H | 内容 |
|------|------|
| **What** | StockPool MCP Server 闲置，但 Service 层被活跃使用；状态流转是核心资产 |
| **Why** | UI 直接�?Service/Store；MCP 薄包装无人需�?|
| **Where** | `src/mcp/servers/pool/poolServer.ts` / `src/services/pool/poolService.ts` / `src/components/organisms/pool/usePoolDataFromStore.ts` |
| **When** | 2026-07-04 创建 |
| **Who** | 架构设计 + 前端开�?|
| **How** | 保留 Service 层和状态流转能力；disabled MCP 包装层；�?Agent 需�?内省股票�?时恢�?|

**经验教训**�?1. **核心资产与包装层分离是正确的**: `stockpoolService` 是核心资产，应保留；`StockPoolServer` 是包装层，可以按需启停。这验证�?V9 架构"Service 层独立于 MCP �?的设计�?2. **状态机需校验流转路径**: 研究状态机（candidate �?screened �?deepDive �?watching �?archived）不能仅校验目标状态有效，必须校验流转路径是否合法。否则可能出现状态跳跃�?3. **历史记录是遗漏项**: 状态流转应有审计日志（who/when/from/to）。这在合规场景中可能是必需的�?
---

## 六、trade �?持仓管理

### 6.1 设计意图验证

**原始设计意图**�?- 提供持仓查询（`fetch_holdings`）、交易操作（`execute_trade_action`）、持仓导出（`export_holdings_csv`）的 MCP 工具
- 依赖 `trading` Server，作�?trading 的下游持仓管理模�?- 封装 `/api/v1/trade/holdings` 接口调用，包含请求超时、重试、错误处�?
**实际表现**�?- `holdingsService.ts` 实现完整，包�?fetchHoldings、executeTradeAction、exportHoldingsCSV 三个函数
- 使用 `dataBridge` �?`EnvelopeFactory` 进行事件转发（可观测性）
- `TradeServer` �?3 �?Tool 零业务引�?- `trading:main` 已提�?`get_orders`、`create_buy_order`、`create_sell_order` 等订单管理工具，�?trade 的功能重�?
**设计意图达成�?*: �?**未达�?* �?功能�?trading 重叠，边界不清，无人使用�?
### 6.2 偏差原因排查

**根因：与 trading:main 功能重叠，d4200a7 合并未彻底整�?*

1. **功能重叠矩阵**�?
| 功能 | trade Server | trading Server | 重叠�?|
|------|-------------|---------------|--------|
| 持仓查询 | `fetch_holdings` | `get_orders`（订单历史）+ `get_strategy_snapshot`（策略快照含持仓�?| �?|
| 买入 | `execute_trade_action` (buy) | `create_buy_order` | 完全重叠 |
| 卖出 | `execute_trade_action` (sell) | `create_sell_order` | 完全重叠 |
| 导出 | `export_holdings_csv` | 无直接对�?| �?|

2. **命名混淆**: `trade` �?`trading` 命名过于相似，开发者难以区分。`trading` �?交易引擎"（信�?订单+风控），`trade` �?持仓管理"（查�?操作+导出），但两者都涉及订单操作�?3. **数据模型不一�?*: 
   - `trade` 使用 `TradeActionRequest`（`code`, `action`, `quantity`），`action` �?`ADD_POSITION`/`CLOSE_POSITION`
   - `trading` 使用订单模型（`symbol`, `direction`, `quantity`, `price`, `status`�?   - 两者的字段命名和枚举值不一致，增加理解成本
4. **d4200a7 合并遗留**: 提交 d4200a7 �?trade 的部分功能合并到 trading，但保留�?trade Server 的源码。合并未彻底，导致两�?Server 并存�?
**责任归属**: 架构决策（d4200a7 合并不彻底）+ 命名规范缺失�?
### 6.3 当前卡点定位

| 卡点 | 优先�?| 说明 |
|------|--------|------|
| �?trading 功能重叠 | P0 | 买入/卖出/持仓查询功能完全重叠，无法共�?|
| 数据模型不一�?| P1 | TradeActionRequest vs trading 订单模型，字段命名和枚举值不一�?|
| 命名混淆 | P1 | `trade` vs `trading` 难以区分，增加维护成�?|
| 无独立调用方 | P2 | 没有任何页面�?Agent 调用 trade �?Tool |

### 6.4 遗漏项识�?
- **持仓导出是唯一差异**: `export_holdings_csv` �?trade 独有的功能，trading 无直接对应。但导出功能也应通过 trading �?报告生成"能力提供，而非独立 Server�?- **API 路径硬编�?*: `holdingsService.ts` 中硬编码�?`/api/v1/trade/holdings` 路径。若后端 API 变更，需要修改两处（service �?constants）�?- **DataBridge 异常吞没**: `fetchHoldings` 中的 `dataBridge.forward()` 使用 `void` + `.catch()` 吞没异常，若 DataBridge 失败不会报错，但事件丢失�?- **CSV 导出无进度反�?*: `exportHoldingsCSV` 是同步操作，大数据量导出时会阻塞 UI 线程。未使用 Web Worker 或分片下载�?- **请求参数丢失**: `fetchHoldings` �?handler 中，`page`/`pageSize` 被硬编码�?1/50，用户传入的 `page`/`pageSize` 参数被忽略�?
### 6.5 复盘与提�?
| 5W1H | 内容 |
|------|------|
| **What** | Trade MCP Server �?trading:main 功能重叠�? �?Tool 零业务调�?|
| **Why** | d4200a7 合并不彻底；命名混淆导致边界不清；数据模型不一�?|
| **Where** | `src/mcp/servers/trading/tradingServer.ts` / `src/services/trading/portfolioService.ts` / `src/mcp/servers/trading/tradingServer.ts` |
| **When** | 2026-07-05 创建，d4200a7 合并时未彻底整合 |
| **Who** | 架构决策（合并方案）+ 开发执�?|
| **How** | 合入 trading:main；保�?`export_holdings_csv` 功能并迁移到 trading；移�?trade Server �?holdingsService |

**经验教训**�?1. **合并必须彻底**: d4200a7 �?部分合并"——保留了 trade Server 源码�?disabled 它。这�?半合�?状态是技术债务的根源。合并时应彻底移除被合并方的源码，或明确标注"待迁移清�?�?2. **命名是架�?*: `trade` vs `trading` 的命名混淆导致边界不清。Server 命名应遵�?领域 + 职责"格式，如 `trading-engine`（交易引擎）�?`trading-holdings`（持仓管理），或合并为统一�?`trading`�?3. **数据模型一致性检�?*: 在新�?Server 前，必须检查现�?Server 的数据模型。若字段命名、枚举值不一致，应在设计阶段统一，而非在代码中做转换适配�?4. **硬编码是隐患**: `holdingsService.ts` 中硬编码�?page=1/pageSize=50 是明显的 bug，说明代码未经充分测试就被提交。应在代码审查中检�?所�?handler 参数是否被使�?�?
---

## 七、跨模块共性根因分�?
### 7.1 根因分类

6 �?Disabled Server 的失效原因可归为 **3 大类**�?
| 类别 | 涉及 Server | 占比 | 核心特征 |
|------|-----------|------|---------|
| **A. MCP 薄包装，Service 直连替代** | input, screening, stockpool | 3/6 | Service 被活跃使用，�?UI/Store 直接调用，MCP 层无价�?|
| **B. 功能重叠，合并未彻底** | trade | 1/6 | �?trading 边界不清，d4200a7 合并遗留 |
| **C. 依赖未就绪，无调用入�?* | backtest, export | 2/6 | 上游依赖 disabled 或参数复杂，�?UI/Agent 调用入口 |

### 7.2 系统性问题："MCP 优先"架构假设不成�?
V9 项目�?MCP 架构假设是：**所有能力通过 MCP 暴露，UI �?Agent 统一通过 MCP 调用**�?
实际执行中发现：
1. **前端开发习�?*: React 组件倾向于通过 `import` 直接调用 Service/Store，而非通过异步 MCP 调用。MCP 调用增加�?`await` 和错误处理复杂度�?2. **性能要求**: 实时交互（筛选、搜索、状态流转）无法承受 MCP 的序列化 + ACL 校验延迟�?3. **Agent 生态未成熟**: `agentComponentRegistry.ts` 仅注册了 5 �?Agent，大�?Server 没有对应�?Agent 调用方�?4. **MCP �?可选路�?而非"唯一路径"**: �?Service 直接暴露时，MCP 成为"可�?而非"必需"。在资源有限时，开发者自然选择更简单的路径�?
### 7.3 决策树：何时需�?MCP Server�?
基于本次复盘，建议建立以下决策树�?
```
是否需要新�?MCP Server�?├── 能力是否涉及外部系统调用（API/数据�?文件系统）？
�?  └── �?�?必须通过 Service 层封装，但不一定需�?MCP Server
├── 是否�?Agent 调用需求？
�?  └── �?�?需�?MCP Server（Agent 统一�?MCP 通道�?├── 是否有跨 Tab/跨窗口数据同步需求？
�?  └── �?�?需�?MCP Server（通过 withBroadcast 实现�?├── 是否需要权限控制（ACL）？
�?  └── �?�?需�?MCP Server（ACL �?MCP 层拦截）
├── 是否是纯输出操作（导�?下载/打印）？
�?  └── �?�?不需�?MCP Server（UI 直接调用 Service�?├── 是否是实时交互操作（筛�?搜索/拖拽）？
�?  └── �?�?不需�?MCP Server（Store/Service 直接处理�?└── 现有 Server 是否已覆�?80% 功能�?    └── �?�?扩展现有 Server，而非新建
```

---

## 八、改进措施与行动清单

### 8.1 立即执行（P0，本周内�?
| # | 措施 | 责任�?| 验收标准 |
|---|------|--------|---------|
| 1 | �?export 降级为纯 Service 函数，移�?`ExportServer` �?`backtestExportService` | 架构 | `src/services/export/` 目录承载，功能迁移到 `src/services/export/`（无 MCP 包装�?|
| 2 | �?trade 合并�?trading:main，移�?`TradeServer` �?`holdingsService` | 架构 | `src/mcp/servers/trade/` �?`src/services/trading/` 删除；持仓导出功能迁移到 `tradingServer` |
| 3 | 修复 `holdingsService.ts` 中的硬编�?bug（page=1/pageSize=50 忽略用户参数�?| 开�?| 参数透传正确，单元测试覆�?|
| 4 | �?`agentComponentRegistry.ts` 中注�?backtest Agent（即�?Server disabled，提前预留注册位�?| 开�?| 注册位存在，注释说明恢复条件 |

### 8.2 短期优化（P1，本月内�?
| # | 措施 | 责任�?| 验收标准 |
|---|------|--------|---------|
| 5 | input Service 层合并入 fetcher:data | 架构 | `inputService` 功能迁移�?`fetcherService`，`InputServer` 删除；组�?import 路径更新 |
| 6 | �?screening 建设 Agent 调用路径（通过 analysis Server 代理�?| 开�?| Agent 可通过 `analysis.screen_stocks` 触发筛选，无需恢复 `screening:main` |
| 7 | �?stockpool 建设 Agent 内省能力（通过 `agentComponentRegistry` 注册�?| 开�?| 注册 `stockpool-inspector` Agent，默�?Tool �?`list_pool_stocks` |
| 8 | 统一数据模型：trade �?`TradeActionRequest` �?trading 的订单模型合�?| 架构 | 单一定义 `OrderCreateRequest`，两处共�?|

### 8.3 中期治理（P2，下季度�?
| # | 措施 | 责任�?| 验收标准 |
|---|------|--------|---------|
| 9 | 建立 MCP Server 生命周期管理 SOP（决策树 + 检查清单） | 架构 | 文档化入 `../../archive/adr-xxx-mcp-server-lifecycle.md` |
| 10 | 建立 Tool 调用监控（mcpBridge 层计数器�?| 开�?| 每月输出 "MCP Tool 调用热力�? |
| 11 | �?backtest 建设回测 UI 页面 + 报告展示组件 | 产品+前端 | 用户可通过页面配置策略并执行回测，结果展示收益曲线和回撤图 |
| 12 | �?stockpool 状态流转添加历史审计日�?| 开�?| 每次 `transitionStock` 记录 who/when/from/to，支持查�?|

---

## 九、SKILL 经验沉淀

### SKILL: MCP Server 必要性评�?
**触发条件**: 新建或改�?MCP Server �?**步骤**�?1. 检查现�?Server 是否已覆�?80% 功能（避免重复）
2. 确认至少一个调用方（UI 页面、Agent、定时任务）
3. 判断操作类型：实时交�?�?不走 MCP；纯输出 �?不走 MCP；跨系统编排 �?�?MCP
4. 检查是否需�?ACL 权限控制（需�?�?�?MCP�?5. 检查是否需要跨 Tab 广播（需�?�?�?MCP�?
### SKILL: 合并技术债务清理

**触发条件**: 执行 Server/模块合并�?**步骤**�?1. 列出被合并方的所�?Tool/Resource/Service 函数
2. 逐一迁移到目标方，更�?import 路径
3. 删除被合并方的源码目�?4. 更新 `mcpServerRegistry.ts`，将条目设为 `enabled: false` 或删�?5. 运行 `npm run audit:layers` 确认无跨层违�?6. 运行 `npm run tsc:prod` 确认类型安全

### SKILL: 状态机设计检查清�?
**触发条件**: 设计状态流转系统（�?stockpool 的研究状态）
**步骤**�?1. 定义状态图（哪些状态、哪些转换允许）
2. 实现流转校验（不允许的状态跳跃应报错�?3. 添加历史审计日志（who/when/from/to�?4. 考虑并发控制（乐观锁或版本号�?5. 单元测试覆盖所有合法和非法流转路径

---

*本报告基于源码静态分析、git 历史回溯（d4200a7）和业务调用链追踪生成。建议每季度复用 `scripts/audit/mcp-tool-usage-audit.py` 重新审计，持续追�?MCP 模块健康度�?
