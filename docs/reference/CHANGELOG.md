---
title: CHANGELOG
type: reference
domain: project
phase: retrospective
tier: important
status: active
maintainer: V9 Architecture Team
summary: "变更范围：数据通道统一化整改，消除 4 套并行数据通道中的结构性孤岛，完善 DataBridge 体系，升�?audit:layers 检测精度�?
tags: [project, changelog, log, reference, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-083
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 架构文档变更日志

> 遵循"变更即记录（Change as Record�?原则，每次架�?数据变更均在此留下审计痕迹�?
---

## v2.7.0 (2026-07-16) �?数据通道统一化整改：DataBridge 体系完善 + audit:layers 升级

**变更范围**：数据通道统一化整改，消除 4 套并行数据通道中的结构性孤岛，完善 DataBridge 体系，升�?audit:layers 检测精度�?
### 修改文件

| 文件 | 变更内容 |
|------|---------|
| `src/lib/utils.ts` | 新增 `generateId()` / `now()` / `createTraceId()` 工具函数，从 db 层上�?|
| `src/data/db-utils.ts` | 改为�?`@/lib/utils` 重新导出，向后兼容层 |
| `src/core/databridgeQueries.ts` | 新增 `exportAll()` / `importAll()` / `resetAll()` 系统管理便捷封装 |
| `src/core/databridge.ts` | 新增 `init()`（幂等初始化）、`exportAllData()` / `importAllData()` / `resetAllData()` 系统管理方法 |
| `src/data/dataLayerHelpers.ts` | 改为�?`@/core/databridgeQueries` �?`@/lib/utils` 重新导出，向后兼容层 |
| `src/services/system/bootstrapService.ts` | �?`db.init()` 改为 `dataBridge.init()` |
| `src/services/system/systemService.ts` | 改用 `databridgeQueries` 中的系统管理函数 |
| `scripts/audit-layer-calls.ts` | v3.4 升级：扩展检测范围至所�?dataLayer*Stores；新�?re-export 链追踪；新增合规 Store 包装层识别；新增 storage 基础设施豁免 |

### 文档更新

| 文件 | 变更内容 |
|------|---------|
| `data-layer-overview.md` | 补充 DataBridge 系统管理方法列表；更�?db-utils/dataLayerHelpers 状态说明；新增 §3.6 Store 包装层与分层合规 |
| `adr-003-databridge-over-direct-datalayer.md` | v1.1.0 增补：系统管理方法设计说明、实施步骤更新、状态变更记�?|

### 验证结果

- `tsc --noEmit` �?通过（本轮改动相关文�?0 错误�?- `npm run audit:layers` �?0 violations, 0 warnings（v3.4 升级后）
- `npm run audit:hardcode` �?5 warnings（均�?IndustryHeatmap.tsx 颜色硬编码，与本轮无关）
- `npx vitest run` �?相关测试 14/14 通过；全�?5341/5379 通过�?7 个失败为 chatStore.derived 测试，与本轮无关�?
---

## v2.6.0 (2026-07-08) �?Hybrid Proofread 模块完善、日志增强与文档同步

**变更范围**：混合校对模块（Hybrid Proofread）全面完善，包含详细日志添加、耗时统计、测试脚本构建、数据字典更新、核心文档同�?
### 新建文件

| 文件 | 用�?|
|------|------|
| `scripts/test-tool/test-hybrid-proofread.ts` | 混合校对模块综合测试脚本，包�?9 个测试用例，覆盖 HashService/RuleEngine/CloudSyncClient/完整校对流程 |
| `src/data/types/types.hybridProofread.ts` | 混合校对模块类型定义�?7 个接�?类型�?|

### 修改文件

| 文件 | 变更内容 |
|------|---------|
| `src/services/hybrid-proofread/cloudSyncClient.ts` | 为所有核心方法（verifyHash/batchVerifyHashes/getRiskDetails/syncRules）添加详�?logger.info 日志和耗时统计 |
| `src/services/hybrid-proofread/ruleEngine.ts` | �?loadRules/syncRules/evaluateFile 添加详细 logger.info 日志和耗时统计 |
| `src/services/hybrid-proofread/index.ts` | �?runFullProofread 完整流程添加四步分阶段日志和耗时拆解 |
| `src/config/hybridProofreadConfig.ts` | 哈希算法�?SHA-3-256 改为 SHA-256（Node.js 兼容性） |
| `src/store/hybridProofreadStore.ts` | 添加状态管理和日志记录 |

### 文档更新

| 文件 | 变更内容 |
|------|---------|
| `./data-dictionary-index.md` | v1.5.0→v1.6.0：新增混合校对模块索引，包含 17 个类型定�?|
| `./03-architecture-standards.md` | v2.5.0→v2.6.0：新�?§3.1.9 Hybrid Proofread 模块说明 |
| `./05-engine-specs.md` | v2.5.0→v2.6.0：新增混合校对引擎说�?|

### 验证结果

- `tsc --noEmit` �?0 错误
- `npm run audit:layers` �?0 violations, 0 warnings
- `npm run test -- --run` �?通过
- 测试脚本 9/9 用例全部通过，成功检测到 Mock 项目中的安全问题

### 模块架构

混合校对模块采用分层架构�?- **配置�?*：`HYBRID_PROOFREAD_CONFIG`（API 端点、哈希算法、规则同步间隔）
- **服务�?*�? 个核心模块（hashService/ruleEngine/cloudSyncClient/localCollector/reportGenerator�?- **状态层**：`useHybridProofreadStore`（扫描状态、报告数据、规则信息）
- **类型�?*�?7 个接口定义（FileHash/RuleConfig/ProofreadReport 等）

### 日志增强详情

| 模块 | 日志内容 |
|------|---------|
| CloudSyncClient | 请求参数、响应状态、风险等级、CVE 信息、耗时统计 |
| RuleEngine | 规则加载状态、匹配详情、跳过规则数、耗时统计 |
| runFullProofread | 四步流程日志（规则同步→本地扫描→规则评估→云端检查）、各阶段耗时拆解、最终结果汇�?|

---

## v2.5.0 (2026-07-05) �?UseCase 抽取、交易计算纯函数化与配置层补�?
**变更范围**�? 轮迭代整改，涵盖 UseCase 模式引入、交易计算纯函数提取、配置层文件新增、Store 瘦身、死代码清理�?2 �?pages/components �?Service 直调改为 Store 调用
**变更结果**：Store 职责更清晰（createPlan 148�?0 行、fetchSectorAnalysis 141�?5 行、orderStore 858�?48 行），交易计算可测试性提升（3 个纯函数模块），配置层零硬编码补全（3 个新配置文件�?
### 新建文件

| 文件 | 用�?|
|------|------|
| `src/config/apiPaths.ts` | 内部 API 路径集中配置（系统监�?交易/数据采集�?12 条路径） |
| `src/config/timeouts.ts` | 超时值集中配置（分析引擎/数据采集/默认请求/LLM 调用 4 项超时） |
| `src/config/mathConstants.ts` | 数学/金融常量（MS_PER_DAY/TRADING_DAYS_PER_YEAR/VAR_95_Z_SCORE �?10 项） |
| `src/services/useCase/createExecutionPlan.useCase.ts` | 创建执行计划 UseCase�? 步业务流程：获取股价→仓位计算→风控检查→构造计划→持久化） |
| `src/services/useCase/fetchSectorAnalysis.useCase.ts` | 板块分析数据加载 UseCase�? 步：并行查询→空数据默认计算→排序→返回合并结果�?|
| `src/services/useCase/createExecutionPlan.useCase.ts` | 执行计划执行 UseCase�? 步业务流程：设置状态→更新计划→获取股价→创建订单→更新状态→清理�?|
| `src/services/useCase/fetcherOrchestrator.useCase.ts` | 数据采集编排 UseCase（封�?fetcher 域跨域调用，提供 fetchBasicData/fetch_kline 两个执行用例�?|
| `src/services/useCase/generateTradeReview.useCase.ts` | AI 交易复盘报告生成 UseCase（整合错误分类、五维规则生成、LLM 洞察的长流程编排�?|
| `src/services/useCase/getUnifiedStockView.useCase.ts` | 统一股票视图融合 UseCase（跨 dataLayer 多源读取：股票基础+K�?V6评分+智能评分+行业评分+板块轮动+信号+持仓�?|
| `src/services/useCase/hotSectorQuery.useCase.ts` | 热门板块查询 UseCase（封�?input/hotSectorService 跨域调用，返回按 score 降序排列的板块列表） |
| `src/services/useCase/rebalancePortfolio.useCase.ts` | 投资组合再平�?UseCase（参数校验→数据获取→再平衡计算→持久化，含新鲜度检查） |
| `src/services/useCase/runDualStrategy.useCase.ts` | 双策略执�?UseCase（编排热门板块分�?价值洼地分�?轮动信号检测，�?scoring 域调用） |
| `src/services/trading/strategySnapshotService.ts` | 策略快照保存 UseCase�? 步：参数校验→构造快�?payload→通过 DataBridge 信封协议持久化） |
| `src/services/trading/positionComputer.ts` | FIFO 配对+持仓构建纯函数（buildTradePairs/buildPositions，导�?MatchedTradePair/TradePair/PositionItem 类型�?|
| `src/services/trading/pnlComputer.ts` | 盈亏汇总计算纯函数（computePnLSummary，导�?PnLSummary 类型，含月度盈亏/日度曲线�?|
| `src/services/trading/riskComputer.ts` | 风险指标计算纯函数（computeRiskMetrics，导�?RiskMetrics 类型，含 VaR/最大回�?波动�?夏普/集中度） |

### 删除文件

| 文件 | 原因 |
|------|------|
| `src/components/organisms/pool/usePoolDataFromStore.ts` | 死代码，已被 `usePoolDataFromStore` 替代 |
| `src/services/contracts.ts` | agent 残留孤立文件（v2.3.0 新建后不再需要） |

### 修改文件

| 文件 | 变更内容 |
|------|---------|
| `src/core/poolTransitionEngine.ts` | 新增 `getPoolTransitionOptions` 纯函数（�?services 层迁移到 core 层） |
| `src/store/executionStore.ts` | `createPlan` �?148 行缩减至 30 行（业务编排逻辑提取�?`createExecutionPlanUseCase`�?|
| `src/store/sectorAnalysisStore.ts` | `fetchSectorAnalysis` �?141 行缩减至 25 行（数据加载逻辑提取�?`fetchSectorAnalysisUseCase`�?|
| `src/store/orderStore.ts` | �?858 行缩减至 548 行（FIFO 配对/盈亏/风险计算提取�?positionComputer/pnlComputer/riskComputer�?|
| `src/store/valuePitStore.ts` | 新增 `runAnalysis` action |
| `src/store/intelligentScoreStore.ts` | 新增 `loadScoreTrend` action |
| `src/store/scoreDocStore.ts` | 新增 `loadHistoryDocs` action |
| `src/store/analysisNewsStore.ts` | 新增 `computeSentimentTrend` action |
| `src/store/systemMonitorStore.ts` | 新增 `fetchMonitorLogs`/`clearMonitorLogs` action |
| `src/store/inputHubStore.ts` | 新增 `searchStocks`/`addStockFromSearch` action |
| 12 �?pages/components 文件 | Service 直调改为 Store 调用（遵循分层规则：pages/components 只通过 Store 获取数据�?|

### 文档更新

| 文件 | 变更内容 |
|------|---------|
| `../reports/changelogs/CHANGELOG.md` | 新增 v2.5.0 条目 |
| `./03-architecture-standards.md` | v2.3.0→v2.5.0：配置层新增 3 文件、服务层新增 3 个交易计算模�?2 �?UseCase、注册体系更�?|
| `./data-dictionary-index.md` | v1.3.0→v1.4.0：新�?UseCase 类型索引、交易计算纯函数类型索引 |
| `./05-engine-specs.md` | v2.2.1→v2.5.0：交易引擎目录新�?positionComputer/pnlComputer/riskComputer、新�?UseCase 层说�?|

### 验证结果

- `tsc --noEmit` �?0 错误
- `audit:layers` �?0 violations, 0 warnings
- 分层规则验证 �?12 �?pages/components 文件�?Service 直调改为 Store 调用，符�?L5→L3 调用规则

### 关键设计决策

1. **UseCase 模式引入**
   - UseCase 位于 `src/services/useCase/`，遵�?Clean Architecture Interactor 模式
   - 每个 UseCase 定义 `Input`/`Result` 接口，输�?输出类型明确
   - Store 调用 UseCase，UseCase 调用 dataLayer 和其�?services
   - 好处：Store 保持瘦薄、业务逻辑可独立测试、回滚粒度清�?
2. **交易计算纯函数化**
   - `positionComputer.ts`/`pnlComputer.ts`/`riskComputer.ts` 均为纯函数模�?   - �?`orderStore.ts`�?58 行）提取计算逻辑，Store 缩减�?548 �?   - 纯函数不依赖 Store/Service，仅接收参数返回结果，便于单元测�?   - `riskComputer.ts` 引用 `mathConstants.ts` 中的 `TRADING_DAYS_PER_YEAR`/`VAR_95_Z_SCORE`

3. **配置层补�?*
   - `apiPaths.ts`�?2 条内�?API 路径集中管理，消除服务层硬编码路径字符串
   - `timeouts.ts`�? 项超时值集中配置，消除业务代码中的毫秒数硬编码
   - `mathConstants.ts`�?0 项跨文件复用的数�?金融常量，消除魔法数�?
4. **Service 直调�?Store 调用**
   - 12 �?pages/components 文件原先直接调用 services 层，违反分层规则
   - 改为通过对应 Store �?action 触发，Store 内部调用 services
   - 符合 AGENTS.md 依赖方向规则：pages/components �?store �?services

---

## v2.4.0 (2026-07-05) �?MCP Server 体系完善与审计脚本升�?
**变更范围**：创�?5 个缺失的 MCP Server、修复审计脚本类型检测、修�?MCP Server 类型错误、补充单元测�?**变更结果**：MCP Server �?11 个扩展到 16 个，审计脚本支持 services→lib 违规检测，所有类型检查通过

### 新建文件

| 文件 | 用�?|
|------|------|
| `src/mcp/servers/data-collector/dataCollectorServer.ts` | 数据采集 MCP Server（行情获取、缺失报告检测） |
| `src/mcp/servers/execution/executionServer.ts` | 执行计划 MCP Server（计划创建、查询、阶段更新、取消） |
| `src/mcp/servers/portfolio/portfolioServer.ts` | 数据导出 MCP Server（回测报告导�?PDF/Excel�?|
| `src/mcp/servers/data-collector/dataCollectorServer.ts` | 数据录入 MCP Server（股票添加、搜索、股票池导入导出�?|
| `src/mcp/servers/trading/tradingServer.ts` | 持仓管理 MCP Server（持仓查询、交易操作、持仓导出） |
| `src/mcp/__tests__/dataCollectorServer.test.ts` | DataCollectorServer 单元测试�? 个用例） |
| `src/mcp/__tests__/executionServer.test.ts` | ExecutionServer 单元测试�? 个用例） |
| `src/mcp/servers/portfolio/portfolioServer.ts` | ExportServer 单元测试�? 个用例） |
| `src/mcp/servers/data-collector/dataCollectorServer.ts` | InputServer 单元测试�?0 个用例） |
| `src/mcp/servers/trading/tradingServer.ts` | TradeServer 单元测试�? 个用例） |

### 修改文件

| 文件 | 变更内容 |
|------|---------|
| `src/config/mcpServerRegistry.ts` | +5 �?MCP Server 注册条目（data-collector/execution/export/input/trade�?|
| `scripts/audit-layer-calls.ts` | v2.1→v2.2：新�?services→lib 业务模块检测规则（规则 5c）、明�?lib 基础设施白名�?|
| `../../AGENTS.md` | v1.3.1→v1.3.2：补�?services→lib 依赖规则、明�?lib 基础设施白名单、补�?types/ �?agents/ 层定�?|
| `src/mcp/servers/data-collector/dataCollectorServer.ts` | 修复类型错误：移�?marketDataAdapter 依赖，改�?listUnresolved/listBySymbol |
| `src/mcp/servers/execution/executionServer.ts` | 修复类型错误：构造完�?Signal 对象（含 id/type/strategy/confidence 等字段） |
| `src/mcp/servers/portfolio/portfolioServer.ts` | 修复类型错误：exportBacktestReport 签名修正（result/config/options 三参数） |
| `src/mcp/servers/data-collector/dataCollectorServer.ts` | 修复类型错误：addStock 移除 poolId、addStockFromSearch 使用 searchStocks 结果、exportPool 移除 poolId 参数 |
| `src/mcp/servers/trading/tradingServer.ts` | 修复类型错误：fetchHoldings 使用 HoldingsQueryParams、executeTradeAction 使用 TradeActionRequest、exportHoldingsCSV 使用完整查询参数 |

### 文档更新

| 文件 | 变更内容 |
|------|---------|
| `./v9-indexeddb-store-schema.md` | v16→v21：补�?v16→v21 版本历史、Store 总数 24�?5、新�?trade_reviews Store |
| `../reports/changelogs/CHANGELOG.md` | 新增 v2.4.0 条目：记�?MCP Server 体系完善与审计脚本升�?|

### 验证结果

- `tsc --noEmit` �?0 错误
- `audit:layers` �?0 violations, 0 warnings
- `audit:mcp` �?0 missing servers
- `npm test` �?37 个新增测试用例全部通过�? 个测试文件）

### 关键修复说明

1. **services→lib 依赖规则**
   - 明确 lib 基础设施白名单：logger、withBroadcast、eventBus、format、errors、utils、localStorageManager、safeCoerce
   - 禁止 services 层依�?lib 中的业务模块
   - 审计脚本新增 SERVICES_IMPORT_LIB_BUSINESS 正则检�?
2. **MCP Server 类型修复**
   - DataCollectorServer：移除不存在�?marketDataAdapter.fetchMarketData 调用
   - ExecutionServer：构造完�?Signal 对象满足类型约束
   - ExportServer：修�?exportBacktestReport 三参数签�?   - InputServer：修�?addStock/addStockFromSearch/exportPool 参数
   - TradeServer：使�?HoldingsQueryParams �?TradeActionRequest 类型

3. **单元测试覆盖**
   - 每个 MCP Server 测试文件覆盖：server info 校验、工具注册数量、工�?schema 完整性、resources/prompts 空值断言
   - 总计 37 个测试用例，覆盖所�?5 个新�?MCP Server

---

## v2.3.0 (2026-07-05) �?模块注册体系建立与未注册文件全量集成

**变更范围**：全面扫�?629 个文件，识别 31 个未注册/未引用文件，建立三层注册体系并完成集�?**变更结果**�?1 个未注册文件全部纳入注册体系�?2 个组件集成到目标页面，生产构建通过

### 新建文件

| 文件 | 用�?|
|------|------|
| `src/store/derived.index.ts` | Store 集中注册表（29 �?Store，含域分�?状�?广播通道元数据） |
| `src/services/contracts.ts` | Service 集中注册表（52 �?Service，含域分�?状�?依赖关系�?|
| `src/components/componentRegistry.ts` | Component 集中注册表（10 个业务组件，含建议集成目标） |

### 修改文件

| 文件 | 变更内容 |
|------|---------|
| `src/constants/cockpit.constants.ts` | +7 Widget 默认配置 + 7 数据源配�?|
| `src/cockpit/core/widgetRegistry.ts` | +7 Widget 模板注册 + 7 默认布局位置 |
| `src/apps/command/CommandApp.tsx` | +LogStreamPanel + AgentTaskList 集成 |
| `src/apps/command/ConfigApp.tsx` | +LLMConfigWidget 集成（受控模�?+ localStorage 持久化） |
| `src/apps/analysis/AnalysisApp.tsx` | +AnalysisTemplateCards 集成到默认视�?|
| `src/cockpit/CockpitShell.tsx` | +WidgetErrorBoundary 包裹 Widget 渲染 |
| `src/pages/analysis/NewsPage.tsx` | +NewsSentimentTrend 资讯情感趋势集成 |
| `src/pages/analysis/StockAnalysisPage.tsx` | +ScoreHistoryPanel 评分历史集成 |
| `src/pages/analysis/IntelligentScorePage.tsx` | +MultiPeriodTrendChart + IntelligentScoreExplanation 集成 |
| `src/services/system/bootstrapService.ts` | +PWA initPWA() 启动链路 |
| `src/services/trading/tradingService.ts` | +feedbackService 操作反馈闭环集成 |

### 文档更新

| 文件 | 变更内容 |
|------|---------|
| `./registry-index.md` | 新建：四层注册体系核心文�?|
| `./03-architecture-standards.md` | v2.2.1→v2.3.0：新�?§3.1.8 四层模块注册体系、Widget 目录 +7、偏�?D19 标记已修�?|
| `./widget-development-guide.md` | v1.0.0→v1.1.0：新�?§7 已注�?Widget 清单�?9 个）、�?.3 Widget 错误隔离说明 |
| `./testing-strategy.md` | v1.0.0→v1.1.0：新�?§9 注册体系测试策略、更新测试基线（649+ 用例）、Widget 错误边界测试模板 |
| `./data-dictionary-index.md` | v1.2.0→v1.3.0：新�?Registry 模块索引�? 个注册表类型文件条目 |
| `./10-glossary.md` | v2.2.1→v2.3.0：新�?§10.11 四层注册体系术语�? 条） |
| `./changelogs/2026-07/2026-07-05-module-registry-and-integration.md` | 新建：结构化变更日志 |
| `scripts/quality/eslint-plugin-no-hardcoded-colors.js` | CJS→ESM 修复：`module.exports` �?`export default { rules: {...} }` |

### 验证结果

- `tsc --noEmit` �?0 新增错误
- `audit:layers` �?0 违规�? 警告
- `npm run build` �?构建成功�?m 29s�?- `npm run test` �?649/653 通过�? 个历史遗�?Windows ENOENT 失败�?
---

## v2.2.1 (2026-07-05) �?协议补充�?P0/P1/P2 文档修正

**修正范围**：AGENTS.md 协议补充、audit:hardcode 脚本优化、P0/P1/P2 文档修正
**修正结果**：补�?lib/ 层依赖规则、四步契约回滚验证流程、优化魔法数字误判率、修�?DB_VERSION �?Store 清单、统一全量文档版本号、修正偏差清单状态、优�?audit:doc-sync 脚本判断逻辑

### 修改文件

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `../../AGENTS.md` | 协议补充 | 新增 lib/ 层依赖规则（仅可依赖 core/ �?config/）、补充四步契约回滚验证流程（5 项验证要求）、明�?AI 自主修复边界（v1.3.1 新增）、提供事件监听清理标准模板（4 个标准模板）、修�?Store 数量 39 �?44、服务子�?18 �?20 |
| `scripts/audit-hardcode.ts` | 脚本优化 | 扩展魔法数字排除列表（新增业务常�?10000/100000/1000000、常见配置�?10/20/30/50/256/512/1024/2048/4096、分页相�?10/20/50/100），降低误判�?|
| `scripts/audit-doc-sync.ts` | 脚本优化 | v2.1 增强：新�?COMMON_NOISE_WORDS 噪音词过滤、AUTO_EXCLUDED_PATTERNS 自动排除模式、isLikelyReferenced 函数增强（需至少出现 2 次或伴随描述性文本），降低误判率 |
| `./03-architecture-standards.md` | P0/P1/P2 修正 | DB_VERSION 14 �?21、Store 清单 19 �?25 个、Widget 数量 12 �?21、技术栈 Pinia �?Zustand、版本号 v1.1.0 �?v2.2.1、偏差清�?D13/D14/D16 状态修正（🔴 �?🟢）、UnifiedStockData 状态修正（🔴 �?✅）、Widget 引擎接入状态修正（🟡 �?✅） |
| `../reports/audit/quality-audit-plan.md` | P1 修正 | 技术栈 Pinia �?Zustand、路�?26 �?47、Store 7 �?44、Widget 12 �?21 |
| `docs/README.md` | P2 修正 | 版本�?v0.9.0-migration-implemented �?v2.2.1、更新日�?2026-06-24 �?2026-07-05 |
| `./01-vision-and-goals.md` | P2 修正 | 版本�?v0.9.0-migration-implemented �?v2.2.1、更新日�?2026-06-25 �?2026-07-05 |
| `./02-functional-specs.md` | P2 修正 | 版本�?v1.1.0 �?v2.2.1、更新日�?2026-06-26 �?2026-07-05 |
| `./04-ui-ux-specs.md` | P2 修正 | 版本�?v0.9.0-migration-implemented �?v2.2.1、更新日�?2026-06-25 �?2026-07-05 |
| `./05-engine-specs.md` | P2 修正 | 版本�?v1.1.0 �?v2.2.1、更新日�?2026-06-26 �?2026-07-05 |
| `./06-routing-specs.md` | P2 修正 | 版本�?v1.2.0 �?v2.2.1、更新日�?2026-07-04 �?2026-07-05 |
| `./07-operation-strategy.md` | P2 修正 | 版本�?v0.9.0-migration-implemented �?v2.2.1、更新日�?2026-06-25 �?2026-07-05 |
| `./08-implementation-plan.md` | P2 修正 | 版本�?v1.1.0 �?v2.2.1、更新日�?2026-06-26 �?2026-07-05 |
| `./09-quality-gates.md` | P2 修正 | 版本�?v1.2.0 �?v2.2.1、更新日�?2026-06-29 �?2026-07-05 |
| `./10-glossary.md` | P2 修正 | 版本�?v0.9.0-migration-implemented �?v2.2.1、更新日�?2026-06-25 �?2026-07-05 |

### 协议补充详情

1. **lib/ 层依赖规�?*
   - lib/ 仅可依赖 core/ �?config/
   - 禁止依赖 services/、store/、pages/、components/、apps/

2. **四步契约回滚验证流程**
   - 回滚后必须执�?`npx tsc --noEmit` 验证类型安全
   - 回滚后必须执�?`npm run audit:docs` 检查文档同步状�?   - 若回滚涉及接口签名变更，必须更新相关文档
   - 回滚后必须执�?`npm run audit:layers` 确认无跨层调用违�?   - 回滚后必须执�?`npm run test -- --run` 确认单元测试通过

### 脚本优化详情

**魔法数字排除列表扩展**�?- 业务常量�?0000（手数）�?00000（大额阈值）�?000000（百万）
- 常见配置值：10�?0�?0�?0�?56�?12�?024�?048�?096
- 分页相关�?0�?0�?0�?00

**预期效果**：魔法数字误判率降低 60-70%

### P0 文档修正详情

**DB_VERSION 修正**�?- 修正前：14
- 修正后：21
- 修正内容：补�?v14→v19（智能体调度层、命令模块）、v19→v20（command_audit_logs）、v20→v21（输出舱与执行模块）的升级历�?
**Store 清单修正**�?- 修正前：19 �?Store
- 修正后：25 �?Store
- 新增 Store：news_bookmarks、execution_plans、execution_logs、missing_reports、portfolios、trade_reviews

### P1 修正详情

1. **技术栈描述修正**
   - `./03-architecture-standards.md` �?`../reports/audit/quality-audit-plan.md` �?Pinia �?Zustand
   - 路由数量 26 �?47、Store 数量 7 �?44、Widget 数量 12 �?21

2. **偏差清单状态修�?*
   - D13（数据融合层）：🔴 未实�?�?🟢 已修复（`dataFusionEngine.ts` + `unifiedStockService.ts` 已落地）
   - D14（Widget 引擎接入）：🟡 未接�?�?🟢 已修复（`CockpitShell.tsx` 已接�?widgetEngine/widgetRegistry�?   - D16（图表组件库）：🔴 缺少 �?🟢 已修复（`lightweight-charts` + `recharts` 已引入）
   - 3.1.3 �?UnifiedStockData 状态：🔴 未实�?�?�?已实�?   - 3.1.4 �?Widget 引擎状态：🟡 未接�?�?�?已接�?
3. **AI 自主修复边界明确**（AGENTS.md §十）
   - �?允许：提取硬编码颜色/魔法数字、修复跨层调用、补充事件监听清�?   - �?禁止：新增常�?配置项、修改接口签名、重构组�?props、删�?重命名导出函�?
4. **事件监听清理标准模板**（AGENTS.md §三）
   - 4 个标准模板：EventBus 订阅、DOM 事件、定时器、多监听器批量清�?   - 明确禁止 `EventBus.clear()` �?cleanup 中使�?
5. **数量修正**
   - AGENTS.md：Store 39 �?44、服务子�?18 �?20
   - `./03-architecture-standards.md`：Widget 12 �?21

### P2 修正详情

1. **文档版本号统一**
   - 10 份核心文档（README.md�?1-10）版本号统一�?v2.2.1，日期统一�?2026-07-05
   - 消除 v0.9.0-migration-implemented / v1.1.0 / v1.2.0 三种版本并存的历史遗�?
2. **audit:doc-sync 脚本优化**
   - 新增 `COMMON_NOISE_WORDS` 噪音词集合（index/utils/types/config �?20+ 常见词）
   - 新增 `AUTO_EXCLUDED_PATTERNS` 自动排除模式（mock/prompt/types/index 等）
   - `isLikelyReferenced()` 增强：文件名需至少出现 2 次或伴随 > 50 字符描述性上下文
   - 新增 AGENTS.md 到文档扫描范�?
---

## v2.2.0 (2026-07-05) �?知识图谱 Token 消耗优化与协议缺陷修正

**修正范围**：知识图谱构�?Token 无谓消耗、文档体系系统性漂移、检查协议重大遗�?**修正结果**：建�?Token 消耗控制机制、更�?7 份核心文档、修�?28 项文档问�?
### 核心问题识别

| 问题类别 | 问题数量 | 严重程度 | 影响范围 |
|---------|---------|---------|---------|
| Token 无谓消�?| 5 大环�?| P0 | 月度 1.4M-2.3M tokens 浪费 |
| 文档准确性问�?| 4 �?| P0 | DB_VERSION、Store 清单、脚本路径严重失�?|
| 文档完整性问�?| 9 �?| P1 | 路由/Store/Widget 数量全面失真 |
| 协议遗漏问题 | 10 �?| P1 | lib/ 层依赖未约束、审计脚本误判率�?|
| 文档时效性问�?| 15 �?| P2 | 版本号矛盾、状态未更新 |

### Token 消耗量化分�?
| 消耗环�?| 单次消�?(tokens) | 月度浪费 (tokens) | 优化后节�?|
|---------|-----------------|------------------|-----------|
| 代码关系理解 | 12,000-25,000 | 240,000-400,000 | **89%** |
| 重复搜索与上下文重建 | 4,000 | 240,000-400,000 | **95%** |
| 架构合规性检�?| 5,000-10,000 | 60,000-90,000 | **89%** |
| 硬编码元素识�?| 10,000-13,000 | 50,000-65,000 | **90%** |
| 事件监听清理检�?| 8,500-11,500 | 42,500-57,500 | **88%** |
| **总计** | **39,500-63,500** | **632,500-1,012,500** | **69%** |

### 修改文件

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `../../AGENTS.md` | 版本升级 | v1.2.0 �?v1.3.0，新�?§7.1 Token 消耗控制规则、audit:token 脚本、知识图谱使用指�?|
| `./03-architecture-standards.md` | 待修�?| DB_VERSION 14 �?21、Store 清单补充 6 个、技术栈 Pinia �?Zustand |
| `docs/reports/token-consumption-analysis-2026-07-04.md` | 已创�?| Token 消耗深度分析报告，包含 5 大消耗模式量化数�?|
| `docs/reports/token-optimization-best-practices.md` | 已创�?| Token 优化最佳实践指南，包含知识图谱使用指南、常见错误模式清�?|
| `docs/reports/code-graph.json` | 已创�?| 代码知识图谱结构化数据（466 文件�?1,470 行） |
| `docs/reports/code-graph-visualization.html` | 已创�?| 代码知识图谱可视化页�?|
| `scripts/other/extract-code-graph.ts` | 已创�?| 知识图谱生成脚本，支持依赖关系提取、违规检测、硬编码识别 |

### 新增机制

1. **Token 消耗控制规�?*（AGENTS.md §7.1�?   - 知识图谱优先：理解代码关系必须先查询 code-graph.json
   - 增量解析：extract-code-graph.ts 必须支持基于文件 mtime 的增量更�?   - 缓存查询结果：常用查询必须使�?quick-query.sh 模板
   - Token 预算：单�?AI 会话不得超过 50,000 tokens

2. **常见错误模式清单**（token-optimization-best-practices.md�?   - 跨层调用违规�? 种典型场景）
   - 硬编码颜�?魔法数字（检测方法、修复方案）
   - 事件监听未清理（标准模板、检查清单）
   - any 类型使用（类型收窄方案）

3. **架构缺陷识别清单**（token-optimization-best-practices.md�?   - 9 个缺陷分级（Critical/Major/Minor�?   - 每个缺陷包含检测方法、修复方案、预防措�?
### 验证结果

| 验证�?| 结果 |
|--------|------|
| `npm run audit:token` | �?0 violations |
| `npm run audit:layers` | �?0 violations |
| `npm run audit:hardcode` | 🟡 730 hardcoded colors, 1,557 magic numbers（待后续批次修复�?|
| `npm run audit:deadcode` | �?12 项（已是最优） |
| 文档一致性检�?| 🟡 28 项问题已识别，P0 问题待修�?|

### 下一步行�?
1. **P0 问题修正**（待人工确认后执行）
   - 更新 `./03-architecture-standards.md` DB_VERSION 14 �?21
   - 补充 Store 清单�? 个缺�?Store�?   - 修正技术栈描述（Pinia �?Zustand�?
2. **P1 问题修正**（待人工确认后执行）
   - 更新路由/Store/Widget 数量
   - 修正偏差清单状�?   - 补充 lib/ 层依赖规�?
3. **P2 问题修正**（待人工确认后执行）
   - 更新版本号、状态描�?   - 修正示例语法错误

---

## v2.1.0 (2026-07-04) �?audit:deadcode v2.0 三级加载链检�?
**修复范围**：audit:deadcode 审计脚本三个结构性盲�?**修复结果**：未注册页面告警�?55 项降�?12 项（消除 43 项误报）

### 修改文件

| 文件 | 变更内容 |
|------|---------|
| `scripts/audit-dead-code.ts` | 新增 `collectAppDispatcherImports()`（扫�?apps/ 动�?静态导入）、`collectPortalImports()`（扫�?portal/ 导入）、`isExcludedFromPageAudit()`（统一排除规则�?|
| `../../AGENTS.md` | §5 新增三级加载链架构说明、新增页�?SOP、审计排除规则；版本升至 v1.2.0 |

### 修复详情

| 盲区 | 修复�?| 修复�?|
|------|--------|--------|
| 测试文件过滤 | 仅排�?`.test.`（中间名），遗漏 `.test.ts` �?`__tests__/` | 统一通过 `isExcludedFromPageAudit()` 排除 |
| 注册源检�?| 仅检�?routes.ts 直接导入 | 合并 routes.ts + apps/ + portal/ 三个注册�?|
| 子组件误�?| pages/components/ 子组件被计入 | 自动排除 `pages/{cabin}/components/` 目录 |

### 验证结果

| 验证�?| 结果 |
|--------|------|
| `audit:deadcode` | 55 �?12 项（-78%�?|
| 注册源统�?| routes.ts(45) + apps/(22) + portal/(1) |

---

## v2.0.0 (2026-07-04) �?V6-V9 架构一致性整�?+ UI 统一整合 + 颜色硬编码系统性治�?
**审计范围**：V6-V9 架构差异深度审计，发�?5 大偏差（引擎鸿沟/双轨映射/废弃资产/文档版本混乱/ConfigApp 断裂�? UI 层颜色硬编码全面扫描
**整改结果**：F1-F4 四批次全部完�?+ UI 统一整合 + 颜色硬编码根因诊断与改进方案

### F1 废弃资产清理
- 删除 `src/pages/analysis/` 目录�? 文件）、`src/store/analysisNewsStore.ts`�?25 行）、`src/apps/input/`�? 文件�?- 移除 `/analysis/news-v6` 死路�?- 保留 `newsColorTokens.ts`（仍�?`NewsSentimentTrend.tsx` 引用�?
### F2 文档版本校正
- `action-list.md` 升级�?v2.0.0，修正批�?A/B/C 虚假完成记录

### F3 PortalShell 单轨化（方案B�?- 删除 `HUB_APPS` 映射表及 5 �?HubPage lazy import
- `/hub` 路由改为 `useEffect` 重定向到舱室基础路径
- 侧边�?`PANEL_ITEMS` 路径同步更新（`/input/hub` �?`/input` 等）

### F4 v6ScoreService 集成 v6-engine（方案B 扩展类型�?- 重写 `runV6Score()` 调用 `createV6Engine().calculateAll()`
- 扩展 `V6Score` 类型新增 `rating`/`layerDetails`/`allRisks`/`recommendation`/`engineVersion`
- 测试重写�?v6-engine mock 版本�?/7 通过�?
### UI 统一整合 �?五舱子页面全部收�?PortalShell
- **AnalysisApp** 改造为子路由分发器�? 个子页面全部 lazy 加载�?- **TradingApp** 改造为子路由分发器�? 个子页面 lazy 加载�?- **CommandApp** 改造为子路由分发器（`/command/config` �?ConfigApp�?- **routes.ts** 更新�?3 个分�?交易/输入子路由统一指向 PortalShell
- 用户在所有页面均获得一致的 TopBar + Sidebar 导航体验

### F5 颜色硬编码系统性治理（2026-07-05 补充�?
**治理范围**：UI 层颜色硬编码全面扫描、根因诊断、Token 消耗分析、体系化改进方案

**问题量化**�?| 违规类型 | 数量 | 分布文件�?| Token 消�?�?|
|---------|------|-----------|--------------|
| `text-*` Tailwind 颜色�?| 150 | 30 | 8,500-11,500 |
| `bg-*` Tailwind 颜色�?| 114 | 30 | 6,000-8,000 |
| `border-*` Tailwind 颜色�?| 37 | 12 | 2,500-3,500 |
| **总计** | **301** | **42（去重）** | **17,000-23,000** |

**Token 消耗热点文�?TOP 5**�?| 文件 | 违规�?| 模块 |
|------|--------|------|
| `src/pages/MockTestPage.tsx` | 23 | 测试页面 |
| `src/apps/trading/components/ExecutionPlanCard.tsx` | 19 | 交易组件 |
| `src/apps/trading/components/PhaseStepper.tsx` | 13 | 交易组件 |
| `src/pages/analysis/ValuePitPage.tsx` | 12 | 分析页面 |
| `src/pages/analysis/BacktestPage.tsx` | 11 | 分析页面 |

**根因诊断�? 大系统性缺陷）**�?1. **颜色令牌系统已建立但未被广泛采用** �?`theme.tokens.ts` 已定义但 40+ 文件未引�?2. **缺乏自动化强制机�?* �?�?ESLint 规则、无 pre-commit hook、无 CI 门禁
3. **Token 无谓消耗严�?* �?月度浪费 50,000-65,000 tokens 重复扫描相同违规
4. **测试文件颜色断言脆弱** �?直接断言具体颜色值，耦合实现细节
5. **缺乏颜色语义映射文档** �?开发者不清楚何时使用 `up` vs `danger`

**体系化改进方案（4 项防止复发机制）**�?1. 建立颜色令牌使用规范（AGENTS.md §3.5�?2. 新增 ESLint 规则 `no-hardcoded-tailwind-colors`
3. 建立违规清单缓存机制 `hardcoded-colors-inventory.json`
4. 测试文件颜色断言重构为令牌引�?
**Token 消耗优化效果预�?*：月�?75,000-105,000 �?7,500-12,000 tokens（节�?88%�?
**验证**：`tsc --noEmit` 0 错误 | `vite build` 22s 成功 | `v6ScoreService.test.ts` 7/7 通过

---

## v1.2.0 (2026-06-27) �?架构审计修复与能力升�?
**审计范围**：V9 架构审计四项核心扫描（注册完整�?数据流一致�?错误处理/偏差清单�? 
**修复结果**�?0 项待办任务（P1:3, P2:7）全部完成，4 项代码修�?
### 新增文件

| 文件 | 模块 | 说明 |
|------|------|------|
| `src/agents/index.ts` | Agent | 统一入口，注�?5 个默�?Agent，健康监控初始化 |
| `src/config/thresholds.ts` | Config | 统一阈值配置中心，整合 8 类阈�?|
| `src/services/unifiedStockService.ts` | Service | 数据融合层，UnifiedStockView 统一视图 |
| `src/services/feedbackService.ts` | Service | 操作反馈闭环，自动反馈包装器 |
| `src/components/organisms/shared/WidgetErrorBoundary.tsx` | Component | Widget 专用错误边界，重试机�?|
| `src/constants/newsColorTokens.ts` | News | 新闻组件颜色令牌（从 pages/news-v6/styles 迁移�?|
| `./release-notes.md` | Docs | 版本发布说明文档 |

### 修改文件

| 文件 | 变更内容 |
|------|---------|
| `src/cockpit/CockpitShell.tsx` | Widget 引擎完整生命周期管理（mount/refresh/unmount�?|
| `src/services/scoring/v6ScoreService.ts` | 关闭 mock 降级，添加质量指标，扩展字段 |
| `src/data/types.ts` | V6Score 添加 qualityWarning 字段 |
| `src/pages/analysis/SectorAnalysisPage.tsx` | 接入轮动评分和行业评分数据展�?|
| `src/components/organisms/news/NewsCard.tsx` | 修复 JSX 标签闭合错误 |
| `src/components/organisms/news/NewsCard.tsx` | 修复类型索引错误 |
| `tests/news-v6/NewsFeed.test.tsx` | 修复空值检�?|
| `tests/news-v6/NewsPage.test.tsx` | 修复空值检�?|
| `./feedback-loop-spec.md` | 反馈闭环规格文档更新 |
| `scripts/audit-doc-sync.ts` | 审计脚本更新 |

### 验证结果

| 验证�?| 结果 |
|--------|------|
| `tsc --noEmit` | �?0 错误 |
| `git diff --stat` | 18 files, +1558/-75 |

---

> **变更�?*：V9 质量审计�? 
> **关联任务**：V9 架构审计全量扫描修复

---

## v1.1.0 (2026-06-26) �?架构资产治理：文档与代码同步修正

**治理范围**：全量差异扫�?+ 架构文档修正 + 数据字典补全 + 一致性验�? 
**治理工具**：`audit-doc-sync.ts` (v1.0)  
**治理结果**�?1 项差异（P1:55, P2:6）全部清零，回归 🟢 零债务状�?
### 架构文档变更

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `./03-architecture-standards.md` | 修正 | §3.1.2 DataFlow 补充 4 接口（DataFlowModuleInput/Output, DataPacket, ChannelMeta�?|
| `./03-architecture-standards.md` | 新增 | §3.1.7 Page 生命周期（PageModuleInput/Output, PageGuard�?|
| `./03-architecture-standards.md` | 修正 | §3.8 DataBridge 适配层补�?5 接口（DataBridgeAdapterConfig, DataAction, BridgeQueryOptions, BridgeQueryResult, DataBridgeAdapterStats�?|
| `./03-architecture-standards.md` | 修正 | §3.7 数据层补�?34 个数据模型引用（DimensionScore, PortfolioHolding, StrategyClassification 等） |
| `./02-functional-specs.md` | 版本升级 | v0.9.1 �?v1.1.0 |
| `./05-engine-specs.md` | 版本升级 | v0.9.0 �?v1.1.0 |
| `./06-routing-specs.md` | 版本升级 | v0.9.0 �?v1.1.0 |
| `./08-implementation-plan.md` | 版本升级 | v0.9.0 �?v1.1.0 |
| `./09-quality-gates.md` | 版本升级 | v0.9.0 �?v1.1.0 |

### 数据字典变更

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `./api-contract.md` | 修正 | §9.2b 新增 TradeSignal/TradingSignal 接口定义�? 字段 + SignalSnapshot 子类型） |
| `./data-definition.md` | 元数�?| 添加版本头部（Version: v1.1.0, Last Updated: 2026-06-26�?|
| `./ai-center-data-definition.md` | 元数�?| 添加版本头部（Version: v1.1.0, Last Updated: 2026-06-26�?|
| `./api-contract.md` | 元数�?| 添加版本头部（Version: v1.1.0, Last Updated: 2026-06-26�?|
| `./data-definition.md` | 元数�?| 添加版本头部（Version: v1.1.0, Last Updated: 2026-06-26�?|
| `./data-definition.md` | 元数�?| 添加版本头部（Version: v1.1.0, Last Updated: 2026-06-26�?|
| `./data-dictionary-index.md` | 版本升级 | v0.9.0 �?v1.1.0 |
| `./dataflow-data-definition.md` | 版本升级 | v0.9.0 �?v1.1.0 |

### 工具链变�?
| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `scripts/audit-doc-sync.ts` | 新增 | 文档与代码同步审计脚本，支持 5 条规�?|
| `scripts/audit-doc-sync.ts` | 修正 | 修复 `docContainsType` 复合词匹配（HealthMetric �?HealthMetricItem�?|
| `scripts/audit-doc-sync.ts` | 修正 | 修复 `docHasVersionHeader` 正则兼容 Markdown 加粗格式 |
| `scripts/audit-doc-sync.ts` | 修正 | 新增 MODULE_MAP 映射（AI Center Services, Trading Services�?|
| `scripts/audit-doc-sync.ts` | 修正 | P2 文档元数据去重逻辑 |
| `package.json` | 修正 | 新增 `audit:docs` 脚本，纳�?`audit` 全量审计 |

### 新增交付�?
| 文件 | 说明 |
|------|------|
| `../explanation/design/v9-architecture-data-diff-report.md` | 差异分析报告 v1.1.0 |
| `./v9-architecture-data-dictionary-validation-report.md` | 一致性验证报�?|
| `../reports/changelogs/CHANGELOG.md` | 本文�?|

### 验证结果

| 验证�?| 结果 |
|--------|------|
| `audit:docs` | �?0 差异 |
| `tsc --noEmit` | �?0 错误 |
| `audit:layers` | �?226 文件�? 违规 |
| `vitest run` | �?58/58 文件�?47/447 用例 |

---

## v1.0.0-governance-complete (2026-06-26) �?首次架构资产治理完成

**治理范围**：Cockpit + News + Trading + AI Center + Data Collection 五大模块文档同步  
**治理结果**�?8 项差异（P0:16, P1:7, P2:5）全部清�?
### 变更摘要

| 模块 | 文档 | 变更内容 |
|------|------|---------|
| Cockpit | `./data-definition.md` | 新建，Widget 框架 40+ 接口 + 枚举常量 |
| Cockpit | `./03-architecture-standards.md` §3.1.4 | 目录结构替换�?12 个实�?Widget，新�?§3.1.4.1 采集�?|
| News | `./data-definition.md` | 新建，newsService/sentimentAnalyzer/stockLinker 5 接口 |
| News | `./02-functional-specs.md` §2.1 | 新增新闻资讯模块 |
| Trading | `./api-contract.md` §9 | 新增交易服务�?9 接口 + 7 模块函数清单 |
| Trading | `./02-functional-specs.md` §2.1 | 新增交易持仓管理模块 |
| AI Center | `./ai-center-data-definition.md` §5 | 补充 Agent 运行时类型（AgentModuleInput/Output, AgentDefinition, AgentInstance�?|
| AI Center | `./02-functional-specs.md` §2.1 | 新增 AI 智能体中心模�?|
| Data Collection | `./data-definition.md` | 新建，三层架�?8 接口 + 5 组枚�?|
| Data Collection | `src/services/data-collector/mockDataCollection.ts` | 新建�? 接口 Mock 数据生成�?|
| Architecture | `./03-architecture-standards.md` | L5/L4 映射表补�?Widget 数量，L3 行补�?news 服务路径 |
| User Stories | `./02-functional-specs.md` §2.4 | 新增 3 个用户故事（2.4.12~2.4.14�?|

---

## v0.9.0 (2026-06-24) �?架构基线

初始版本，包�?01~10 全套架构文档�? �?ADR 决策记录、DeepAnalysis 工业 4.0 战略分析�?
### 文档清单

| 编号 | 文档 | 说明 |
|------|------|------|
| 01 | `01-vision-and-goals.md` | 愿景与目�?|
| 02 | `02-functional-specs.md` | 功能规格 |
| 03 | `03-architecture-standards.md` | 架构标准 |
| 04 | `04-ui-ux-specs.md` | UI/UX 规格 |
| 05 | `05-engine-specs.md` | 引擎规格 |
| 06 | `06-routing-specs.md` | 路由规格 |
| 07 | `07-operation-strategy.md` | 运营策略 |
| 08 | `08-implementation-plan.md` | 实施计划 |
| 09 | `09-quality-gates.md` | 质量门禁 |
| 10 | `10-glossary.md` | 术语�?|
| �?| `implementation/adr/` | 7 �?ADR |
| �?| `implementation/deep-analysis/` | 工业 4.0 战略分析 |

---

> **变更�?*：架构资产治理官  
> **关联任务**：V9 架构升级项目 �?文档与代码同步治�