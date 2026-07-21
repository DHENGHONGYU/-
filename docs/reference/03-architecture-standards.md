---
title: 03-architecture-standards
type: reference
domain: architecture
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 
tags: [architecture, spec, standards, reference, design]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-ARCH-004
related_docs: [V9-DOC-META-000, V9-DOC-QA-007, V9-DOC-PROJ-058, V9-DOC-PROJ-119, V9-DOC-PROJ-085, V9-DOC-PROJ-121]
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-QA-007, V9-DOC-PROJ-058, V9-DOC-QA-034, V9-DOC-ARCH-026, V9-DOC-PROJ-264, V9-DOC-PROJ-119, V9-DOC-PROJ-331, V9-DOC-PROJ-176, V9-DOC-QA-095, V9-DOC-ARCH-030, V9-DOC-QA-025, V9-DOC-PROJ-182, V9-DOC-PROJ-179, V9-DOC-QA-070, V9-DOC-FRONT-044, V9-DOC-BACK-040, V9-DOC-QA-102, V9-DOC-PROJ-193, V9-DOC-PROJ-085, V9-DOC-BACK-028, V9-DOC-PROJ-121, docs/archive/reference-historical/v9-code-quality-audit-report-20260629.md, docs/00-meta/deprecated-docs/old-versions/registry-index-v1.0.0-02-design.md, V9-DOC-FRONT-051, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 03. 

> **Status**: Current  
> **Version**: v2.7.0  
> **Last Updated**: 2026-07-15
>
>  V9  
> / 
> `./architecture-version-comparison.md`
---

## 3.1 

```
 L5 pages/, components/                                           UI                                                   L4 apps/, cockpit/                                                                                             L3 services/, agents/trading/                                                                        L2 data/, db/                                                    IndexedDB schema                              L1 lib/, config/, core/                                      DataBridge                                 ```

### 3.1.1 
|  |  |  | |
|------|----------|--------------|------|
| L5 | `pages/`, `components/` | `pages/`, `components/`, `portal/`, `cockpit/` 21 Widget |  |
| L4 | `apps/`, `cockpit/` | `apps/`, `cockpit/` CockpitShell + Widget  + Widget  Dashboard / BulkImport / HotSector / DataTest |  |
| L3 | `agents/`, `trading/`, `services/` | `services/``src/services/trading/` positionComputer/pnlComputer/riskComputer UseCase `src/services/useCase/` 11 UseCase createExecutionPlan/executePlan/fetchSectorAnalysis/fetcherOrchestrator/generateTradeReview/getUnifiedStockView/hotSectorQuery/rebalancePortfolio/runDualStrategy/strategySnapshotSave/submitOrder `src/services/fetcher/` `src/services/data-collector/``src/services/news/`newsService + sentimentAnalyzer + stockLinker `src/agents/agentRuntime.ts` /`src/core/dataflow/` UnifiedStockData |  |
| L2 | `data/`, `db/` | `src/data/` `db.ts`, `dataLayer.ts`, `types.ts``daily_quotes``signals``research_logs` store |  |
| L1 | `lib/`, `config/`, `core/` | `src/lib/`, `src/config/`, `src/core/``eventBus`  `on/emit/off`/ `src/core/dataflow/dataflowEngine.ts`  |  |

####  TradePair v2.5.0 
`positionComputer.ts`TradePair 
|  |  | |  |
|------|----------|------|---------|
| `TradePair` | `tradeReviewAI.types.ts` | |  |
| `MatchedTradePair` | `positionComputer.ts` | FIFO **extends TradePair** | `buyDate`, `sellDate`, `quantity`, `realizedAmount` |
| `SymbolTradePair` | `positionComputer.ts` | symbol | `symbol`, `buyOrders`, `sellOrders`, `pairs: MatchedTradePair[]`, `avgCostPrice`, `openPositions` |
| `PositionItem` | `positionComputer.ts` |  | `symbol`, `quantity`, `avgCost`, `costValue`, `direction` |

> ****`TradePair` `tradeReviewAI.types.ts``MatchedTradePair`  `extends TradePair` `positionComputer.ts`  `TradePair` 
### 3.1.2 DataFlow Engine

****- ***SSE + 
- ****0 TTL200  `priority`  TTL//  - ***`refreshInterval``priority``persist` 
- ***microtask  16ms 
- ***
****```
src/core/dataflow/
 dataflowEngine.ts      #  dataflowTypes.ts       # 
 defaultDataBuilder.ts  # ```

****```ts
interface DataChannel {
  id: string;
  refreshInterval: number;     // ms  priority: 'high' | 'medium' | 'low';
  persist: boolean;            //  DB
  maxCacheSize: number;        // 
  ttl: number;                 // ms}
```

***`src/core/dataflow/dataflowEngine.ts` SSE/ `priority`  TTL
***`src/types/modules/dataflow.types.ts`

|  | |  |
|------|------|---------|
| `DataFlowModuleInput` | | `channel`string, , `callback`packet: DataPacket) => void, , `options.intervalMs`number `options.persist`boolean|
| `DataFlowModuleOutput` | | `unsubscribe`) => void, , `stats.connected`boolean `stats.channels`number `stats.subscribers`number `stats.cacheEntries`number|
| `DataPacket` | | `channel`string, , `data`unknown, , `timestamp`number, , `seq`number,  |
| `ChannelMeta` | | `channel`string, , `description`string, , `refreshInterval`number, , `persist`boolean, , `priority`high' \| 'normal' \| 'low',  |

> ****: 2026-06-26 | v1.1.0 |  DataFlow | 
### 3.1.3 Data Fusion
K
****- ****`UnifiedStockData` - ****- ***
- ****
****```
src/services/analysis/
 unifiedStockService.ts    # 
 dataFusionEngine.ts       # 
 unifiedStockTypes.ts      # 
```

**UnifiedStockData Schema**```ts
interface UnifiedStockData {
  symbol: string;
  basic: StockBasic;
  kline: DailyQuotes | null;
  finance: StockFinance | null;
  v6Score: V6Score | null;
  intelligentScore: IntelligentScore | null;
  signals: TradingSignal[];
  dataQuality: StockDataQuality;
  lastFusedAt: number;
}
```

*** `UnifiedStockData`  `src/data/types.ts:665``unifiedStockService.ts` 
### 3.1.4 Widget 

 Widget 
****- ***Widget + - ****mount/unmount/update 
- **Widget **`WidgetEventBus` Widget 
- ****2
****```
src/cockpit/
 CockpitShell.tsx              # react-grid-layout 
 core/
   widgetRegistry.ts         # Widget  +  + 
   widgetEngine.ts           # Widget    widgetEventBus.ts         # Widget 
 widgets/
     MarketIndicesWidget.tsx    # 
     SectorHeatmapWidget.tsx    # 
     FundFlowWidget.tsx         # 
     MarketSentimentWidget.tsx  # 
     WatchlistWidget.tsx        # 
     PortfolioOverviewWidget.tsx # 
     AITradeReviewWidget.tsx    # AI 
     InvestmentProfileWidget.tsx # /
     StockPoolWidget.tsx        # 
     KaiScoreWidget.tsx         # KAI 
     ModelCompareWidget.tsx     # AI      StockChatWidget.tsx        # /
     AgentPerformance.tsx       # Agent 
     EngineStatus.tsx           #      SystemArchitecture.tsx     #      PnlAnalysis.tsx            # 
     PositionControl.tsx        #      RiskMonitor.tsx            # 
     SignalMonitor.tsx          # 
```

**Widget **```ts
interface WidgetDefinition {
  id: string;
  name: string;
  category: 'market' | 'portfolio' | 'strategy' | 'agent';
  icon: string;
  defaultSize: { cols: number; rows: number };
  defaultPosition: { x: number; y: number };
  component: React.ComponentType<WidgetProps>;
  dataChannels: string[];      // 
  dependencies: string[];      // Widget
}
```

*** `CockpitShell.tsx` Widget `src/cockpit/core/widgetEngine.ts` / `widgetRegistry.ts` Widget  CockpitShell 
### 3.1.4.1 Widget 
 Widget  `DataSourceConfig` `TaskScheduler` 
```
DataSourceConfig TaskScheduler BaseCollectorMock/Rest/WebSocket                                                                                                                              RawMarketData
                                                                                                                           MarketDataAdapter
                                                                                                                               MarketData
                                                                                                                      MarketDataProviderReact Context                                                                                                                                                                Widget A          Widget B
```

***- **BaseCollector**3 / 10s - **TaskScheduler**/
- **MarketDataAdapter**`MarketData` 

*** `src/services/data-collector/` `src/cockpit/core/widgetRegistry.ts` 21 Widget 7  Widget`CockpitShell` Widget `WidgetErrorBoundary`
### 3.1.5 Agent 
Agent  Agent  AI 
****- **Agent *///A2A
- ****Agent 
- **AI **+ 
****```
src/agents/
 agentRuntime.ts           # Agent  agentRegistry.ts          # Agent  taskQueue.ts              # 
 healthMonitor.ts          # 
 aiAssistant/              # AI 
     chatService.ts        # 
     localKnowledge.ts     #      skillRouter.ts        # ```

***`src/agents/agentRuntime.ts` Agent /AI 
### 3.1.5.1 Agent 
****: `src/types/modules/agent.types.ts`

|  | |  |
|------|------|---------|
| `AgentModuleInput` | Agent  | `agentId`, `type`, `payload`, `options.timeout`, `options.priority` |
| `AgentModuleOutput` | Agent  | `taskId`, `status`pending/running/completed/failed/timeout `result`, `error`, `executionTimeMs` |
| `AgentDefinition` | Agent  | `id`, `name`, `description`, `type`, `version`, `capabilities[]`, `metadata.tags`, `metadata.config` |
| `AgentInstance` | Agent  | `instanceId`, `agentId`, `name`, `status`idle/running/completed/failed/stopped `startTime`, `lastHeartbeat`, `stats.{totalTasks,successTasks,failedTasks,avgExecutionTime}` |
| `IOModule` |  | `input: AgentModuleInput`, `output: AgentModuleOutput` |

***```
pending running completed / failed / timeout
```

***```
idle running completed / failed / stopped
```

### 3.1.6 Engine 
Engine DataFlow Agent 
****- **DataFlow **SSE////- **Agent *- ****
****`src/types/modules/engine.types.ts`

|  | |  |
|------|------|---------|
| `EngineConfig` | Engine  | `enableSSE`, `sseUrl`, `enableAgentHealthCheck`, `agentHealthCheckInterval` |
| `DataflowStats` | DataFlow  | `channels`, `subscriberChannels`, `connected` |
| `AgentRuntimeStats` | Agent | `totalAgents`, `runningTasks`, `completedTasks`, `failedTasks` |
| `EngineStats` | Engine  | `dataflow: DataflowStats`, `agents: AgentRuntimeStats` |
| `EngineLifecycleEvent` |  | `timestamp` |
| `EngineHealthAlertEvent` |  | `stats: AgentRuntimeStats` |

***`src/core/dataflow/` DataFlow Agent 
### 3.1.7 Page 


****- ***
- ****loading/error/visible/clickable - ****
****`src/types/modules/page.types.ts`

|  | |  |
|------|------|---------|
| `PageModuleInput` |  | `routeParams`Record\<string, string\>, , `dataSources`Array\<{key: string, fetcher: () => Promise\<unknown\>}\>,  |
| `PageModuleOutput` |  | `data`Map\<string, unknown\>, , `loading`boolean, , `error`string \| null, , `isVisible`boolean, , `isClickable`boolean,  |
| `PageGuard` |  | `isVisible`boolean, , `isClickable`boolean, , `tooltipText`string,  |

> ****: 2026-06-26 | v1.1.0 |  Page  | 
### 3.1.8 v2.3.0 v2.5.0 
V9 StoreComponentWidget 
> **v2.5.0 **`src/services/contracts.ts` agent Service  `./../explanation/design/registry-index.md` 
****
```
 Widget RegistryClass                            widgetRegistry.ts 21 Widget  +                     Store Registry                                    storeRegistry.ts 7 Store            Component Registry10+                         componentRegistry.ts                             ```

****
| |  |  | |  |
|--------|----------|----------|--------|------|
| Widget | `src/cockpit/core/widgetRegistry.ts` | Class  | 19 | `() => import(...)` |
| Store | ~~`src/store/derived.index.ts`~~ | | 47 | 47 Store  |
| Component | `src/components/componentRegistry.ts` | | 10+ |  `suggestedTarget`  |

***
```
available active/
active deprecateddeprecated 
```

****- - ~~`storeRegistry.ts`~~ 47 Store  `src/store/` 
- `componentRegistry.ts`  `src/components/`
***Widget Registry Component Registry Store Registry 7 Store 
> ****: 2026-07-05 | v2.5.0 | Service Registry  | > ****: 2026-07-05 | v2.3.0 |  | 
### 3.1.9 Hybrid Proofread v2.6.0 

****- ****- ****- ****Markdown/HTML/JSON- ****
****```
src/services/hybrid-proofread/
 index.ts                  # runFullProofread 
 hashService.ts            # SHA-256 localCollector.ts         #  ruleEngine.ts             # / cloudSyncClient.ts        #  reportGenerator.ts        # 
```

***`src/config/hybridProofreadConfig.ts`
- API 
- SHA-256 50- 
- 

****`src/store/hybridProofreadStore.ts`
- isScanningscanStatusscanProgress- reportlocalScancloudRisk- rulesrulesVersion
***`src/data/types/types.hybridProofread.ts`7 

|  | |  |
|------|------|---------|
| `FileHash` |  | `file_hash`, `file_type`, `file_path`, `project_id`, `last_modified`, `size_bytes` |
| `RuleConfig` |  | `rule_id`, `name`, `description`, `severity`, `pattern`, `category`, `action_type` |
| `RuleMatchResult` |  | `rule_id`, `rule_name`, `severity`, `category`, `file_path`, `line_number`, `match_text` |
| `LocalScanResult` |  | `project_id`, `scan_time`, `total_files`, `scanned_files`, `rule_matches`, `hashes` |
| `CloudRiskResult` |  | `project_id`, `checked_at`, `hash_count`, `risky_count`, `risks` |
| `ProofreadReport` |  | `id`, `project_id`, `project_name`, `scan_time`, `overall_risk_level`, `total_issues`, `local_scan`, `cloud_risk`, `summary`, `recommendations` |
| `RiskDetail` |  | `hash`, `cve_id`, `description`, `remediation_advice`, `severity` |
| `RulesSyncResult` |  | `current_version`, `latest_version`, `updated`, `downloaded_rules`, `skipped_rules` |

****```
runFullProofread(projectId, projectName, projectPath)
   Step 1: +    Step 2: +    Step 3: +    Step 4:  +    Step 5:  + 
```

*** 9 
> ****: 2026-07-08 | v2.6.0 |  Hybrid Proofread  | 
### 3.1.10 Store v2.6.0 
#### 3.1.10.1 

Derived Computations Store 
****1. *** `useStore.getState()` 2. ****`memoizeByRef` `buildIndex`  O(n) 
3. ***4. *** Store `lib/derivedCache`

****- `memoizeByRef`Zustand 
- `memoizeByKey`hash - `buildIndex` Map O(1)  O(n) filter
****.derived.ts - 
- React Hook 

****
|  |  Store |  |  |
|------|-----------|---------|---------|
| `analysisStore.derived.ts` | analysisStore | 22 |  |
| `chatStore.derived.ts` | chatStore | 23 | Token  |
| `riskStore.derived.ts` | riskStore | 22 | |
| `signalQualityStore.derived.ts` | signalQualityStore | 30 | |

***  JSDoc 
#### 3.1.10.2 

`executionStoreSubscriptions.ts`  DataBridge  signals orders 
****- **** `insertSignal`  
- **** `insertOrder`/`updateOrder`  
- **** `saveExecutionPlan`/`updateExecutionPhase`  

****1. *** source 
2. ****00ms 
3. ***init 4. ****

*** JSDoc 
#### 3.1.10.3 

|  |  |  |
|------|------|------|
|  | `src/lib/derivedCache.ts` | VERBOSE  |
|  | `src/lib/localStorageCrypto.ts` | AES-GCM 256 CryptoKey STOR-001 |
|  | `src/services/errorBus.ts` | V9Error  |
| | `src/services/resilience.ts` |  |

#### 3.1.10.4 UI Hooks

|  |  |  |
|------|------|------|
|  | `src/components/organisms/shared/installGlobalErrorHandler.ts` | window.error unhandledrejection  |
|  | `src/components/templates/PageContainer.tsx` | 200px  |
|  | `src/components/templates/PageHeader.tsx` | +  +  |
| | `src/hooks/useConfirmDialog.tsx` | window.confirm |

#### 3.1.10.5 

|  |  |  |
|------|------|------|
|  | `src/constants/sectorConstants.ts` | 5 |

> ****: 2026-07-08 | v2.6.0 |  Store | 
### 3.1.11 Store v2.7.0 
audit:docs -LLM 
#### `src/services/data-sync/`
|  |  |
|------|------|
| `src/services/data-sync/globalScheduler.ts` | cron-like |
| `src/services/data-sync/conflictResolver.ts` |  |
| `src/services/data-sync/fieldMerger.ts` |  |
| `src/services/data-sync/stalenessDetector.ts` |  |
| `src/services/data-sync/updateExecutor.ts` |  |

#### `src/services/data-sync-search/`
|  |  |
|------|------|
| `src/services/data-sync-search/codeSearcher.ts` | |
| `src/services/data-sync-search/docSearcher.ts` | |
| `src/services/data-sync-search/historySearcher.ts` | |
| `src/services/data-sync-search/semanticSearcher.ts` |  TF-IDF + |

#### `src/services/file-import/`
|  |  |
|------|------|
| `src/services/file-import/parserRegistry.ts` |  |
| `src/services/file-import/unifiedFileValidator.ts` |  |
| `src/services/file-import/diffAnalyzer.ts` |  |
| `src/services/file-import/hashComparator.ts` | |
| `src/services/file-import/proofreadReportGenerator.ts` |  |

#### LLM 

|  |  |
|------|------|
| `src/pages/command/agent/LlmManagement/index.tsx` | LLM API Key |

#### 

|  |  |
|------|------|
| `src/pages/input/CollectTask/index.tsx` |  |

####  Store

|  |  |
|------|------|
| `src/store/predictionStore.ts` | |
| `src/store/analysisOrchestratorStore.ts` | |
| `src/store/dataSyncStore.ts` | |
| `src/store/fileImportStore.ts` | |
| `src/store/searchStore.ts` | |

#### v2.8.0 
|  |  |
|------|------|
| `src/services/scoring/scoreAutoTrigger.ts` | |
| `src/services/scoring/scoringInputValidation.ts` | /warn-only |

> ****: 2026-07-15 | v2.7.0 |  data-syncdata-sync-searchfile-importLlmManagementpredictionStore | AI Agent
> ****: 2026-07-15 | v2.8.0 |  scoreAutoTriggerscoringInputValidation  | AI Agent

---

## 3.2 

1. ***2. **L5/L4  `dataLayer`** `DataBridge` / Service / `eventBus`3. **/*4. ****`src/apps/trading/` 
### 3.2.1 

| /  | L5  | L4  | L3  | L2  | L1  |
|------------------------|---------|---------|---------|---------|-------------|
| L5  |  | | |  | lib/config/core  |
| L4  | |  | | | |
| L3  | | |  | dataLayer / DataBridge | |
| L2  | | | |  | config/dbConfig |
| L1  | | | | |  |

---

## 3.3 

```
L5/L4 DataBridge.forward() L2 IndexedDBL5/L4 Service / dataLayer L2 IndexedDBServiceL3    dataLayer/ DataBridgeL2    db.ts IndexedDB ```

### 3.3.1 DataBridge

|  |  dataLayer |  DataBridge |
|------|-------------------|-----------------|
|  |  | `meta.source` + `traceId` |
|  | |  ACL  |
|  |  |  `research_logs` |
|  |  emit | `broadcast()`  |
|  mock |  mock db | mock DataBridge fake-indexeddb |

### 3.3.2 DataBridge.query() v2.2.1 
dataLayer `dataBridge.query()`** mock `db.get`/`db.getAll`/`db.getAllByIndex`** `mockDataBridgeQuery`  `dataBridge.query()` 
***
```ts
//  mock db  mockDbGet.mockResolvedValue(score)
const result = await v6ScoreStore.get('000001')
expect(mockDbGet).toHaveBeenCalledWith('v6_scores', '000001')
```

****
```ts
// mock dataBridge.query() const score = createV6Score()
mockDataBridgeQuery.mockResolvedValue({ success: true, data: score })

const result = await v6ScoreStore.get('000001')

expect(mockDataBridgeQuery).toHaveBeenCalledWith({
  action: ENVELOPE_ACTION.queryGet,
  store: STORE_NAME.v6Scores,
  key: '000001',
  source: MODULE_ID.datalayer,
})
expect(result).toEqual(score)
```

** query mock *
| dataLayer  |  | mock |
|---|---|---|
| `queryGet<T>(store, key)` | `dataBridge.query({ action: queryGet, store, key, source })` | `{ success: true, data: T \| undefined }` |
| `queryList<T>(store)` | `dataBridge.query({ action: queryList, store, source })` | `{ success: true, data: T[] }` |
| `queryByIndex<T>(store, indexName, indexValue)` | `dataBridge.query({ action: queryByIndex, store, indexName, indexValue, source })` | `{ success: true, data: T[] }` |

** mock**
```ts
// query undefinedqueryGetqueryList/queryByIndexmockDataBridgeQuery.mockResolvedValue({ success: false, error: '' })

const result = await v6ScoreStore.get('000001')
expect(result).toBeUndefined()  // queryGet  undefined

const list = await v6ScoreStore.list()
expect(list).toEqual([])        // queryList  []
```

***`src/data/dataLayer.test.ts`7  store queryGet/queryList/queryByIndex 
> ****: 2026-07-05 | v2.2.1 |  DataBridge.query()  | 
---

## 3.4 
|  |  |  |
|------|------|------|
| `src/config/routes.ts` | |  |
| `src/config/dbConfig.ts` | DB ACL|  |
| `src/config/scoreFactors.ts` | | |
| `src/config/thresholds.ts` | /| |
| `src/config/thresholds.ts` scoreFactors|  | |
| `src/config/symbols.ts` | | |
| `src/config/llmConfig.ts` | LLM  | API  |
| `src/config/fetcherConfig.ts` |  | /|
| `src/config/tradingConfig.ts` |  | |
| `src/config/inputConfig.ts` | | UI / |
| `src/config/apiPaths.ts` |  API 2 //|  API |
| `src/config/dataSourceUrls.ts` | URL  | URL |
| `src/config/mathConstants.ts` | /MS_PER_DAY/TRADING_DAYS_PER_YEAR/VAR_95_Z_SCORE 10  |  |
| `src/config/timeouts.ts` | ///LLM  4  |  |
| `src/theme.config.ts` |  |  UI |
| `src/constants/cockpit.constants.ts` | Cockpit Widget | Widget / |

---

## 3.5 
- `?? []` / `|| 0`- -  API 
-  O(n??) - - DB`DataBridge.forward()`

### 3.5.1 V6  L3 
`src/services/scoring/v6-engine/calculators/l3/helpers.ts` 
|  | |  |
|------|------|---------|
| `scoreMoat()` | 1-5  | ROE |
| `scoreCompetition()` | -5  | |

****- 0%+.0 10%.0  ROE - >40%20%
---

## 3.6 UI
- HEX Tailwind 
- /-  props -  `theme.config.ts` 

---

## 3.7  Schema

`V6ProDB`  
`21`V9 
> `1`/`3``21`v3v4  `daily_quotes` `signals` Storev4v5 `stocks`  `group` by-group v5v6  `rotation_scores``sector_scores``score_docs``strategy_snapshots``local_docs``news``news_stock_map``sentiment_cache` StoreV6 Pro v6v13 V9 v13v14  `hot_sector_scores``value_pit_scores` Storev14v19  schema v19v20  `command_audit_logs` v20v21  `execution_plans``execution_logs``missing_reports``portfolios``trade_reviews` 
### Store

| Store |  | |
|-------|------|------|
| `stocks` | `symbol` |  |
| `v6_scores` | `symbol` | V6  |
| `intelligent_scores` | `id` | V6 LLM |
| `industry_scores` | `id` | V4  |
| `orders` | `id` |  |
| `watchlists` | `id` |  |
| `signals` | `id` |  |
| `research_logs` |  |  |
| `daily_quotes` | `symbol` | K |
| `rotation_scores` | `id` |  |
| `sector_scores` | `id` | |
| `score_docs` | `docId` | |
| `strategy_snapshots` | `id` |  |
| `local_docs` | `id` | |
| `news` | `id` |  |
| `news_stock_map` | `id` | - |
| `sentiment_cache` | `id` |  |
| `news_bookmarks` | `id` | |
| `hot_sector_scores` | `symbol` |  |
| `value_pit_scores` | `symbol` | |
| `execution_plans` | `id` |  |
| `execution_logs` | `id` |  |
| `missing_reports` | `id` |  |
| `portfolios` | `id` |  |
| `trade_reviews` | `id` |  |

### 

|  |  |  |
|------|------|------|
| `symbol` | string |  `600519.SH` |
| `researchStatus` | enum | `candidate / screened / deepDive / watching / archived` |
| `source` | enum | `manual / import / akshare` |
| `dataVersion` | number |  |
| `calculatedAt` | number | |
| `algorithmVersion` | string |  `v9-auto` |
| `dataQuality` | object |  `{ basic: boolean; kline: boolean; finance: boolean }` |

### 3.7.2 

/`dataQuality` UI  `QualityIndicator` 
```ts
interface StockDataQuality {
  basic: boolean      // name/industry/price/pe/pb  kline: boolean      // K  finance: boolean    //   lastChecked?: number // 
}
```

> `dataQuality`  `stocks` `stock_quality` store
### 3.7.3 
V9 `researchStatus` 
```
candidate screened deepDive watching archived
```

- *** `poolTransitionEngine`  `DataBridge.forward(UPDATE_STOCK)` - ****`orders` Store  `stocks.researchStatus`- `watching`  `orders` - `orders` 
### 3.7.4 `src/data/types.ts`
 `src/data/types.ts`V6 Pro 

|  | |  |
|------|------|---------|
| `DimensionScore` | | `name`string `score`number \| null `rationale`string `evidence`string[] `weight`number|
| `IndustryDimensionScore` | | `name`string `score`number \| null `rationale`string `evidence`string[] `weight`number|
| `IndustryScore` |  | `code`string `name`string `overallScore`number \| null `dimensionScores`IndustryDimensionScore[] `summary`string `basis`string `sectorSnapshot`object `configSnapshot`object `modelResponse`string `scoredAt`number|
| `PortfolioHolding` |  | `symbol`string `name`string `currentShares`number `currentWeight`number `targetWeight`number `targetShares`number `price`number `marketValue`number `score`number `rationale`string|
| `RebalanceAction` | | `symbol`string `action`buy' \| 'sell' \| 'hold' `shares`number `reason`string|
| `StrategyClassification` |  | `'core-scarce'` \| `'value-bargain'` \| `'hot-momentum'` \| `'excluded'` |
| `StrategyCandidate` | | `symbol`string `name`string `composite`number `valuationScore`number \| null `industryScore`number \| null `momentum`number \| null `sector`string \| null `classification`StrategyClassification `reasons`string[]|
| `StrategyResult` |  | `selected`StrategyCandidate[] `coreScarce`StrategyCandidate[] `valueBargain`StrategyCandidate[] `hotMomentum`StrategyCandidate[] `rejected`StrategyCandidate[] `summary`object|
| `SignalSnapshot` |  | `pePercentile`number `pbPercentile`number `priceToMA20`number `priceToMA60`number `volumeRatio`number `rsi14`number `macdDirection`red' \| 'green' \| 'neutral'|
| `ResearchLog` |  | `traceId`string, , `timestamp`number, , `actor`string, , `action`string, , `targetType`string, , `targetCode`string, , `payload`string|
| `KlineBar` | K | `date`string, , `open`number, , `high`number, , `low`number, , `close`number, , `volume`number, , `amount`number,  |
| `SectorScoreDimensions` | | `planAlignment`number 0-5 `policySupport`number 0-5 `usChinaParity`number 0-5|
| `SectorUsChinaData` |  | `chinaShare`string `usStatus`string `gap`string|
| `SectorDefinition` |  | `code`string `name`string `category`' \| '' \| '' `description`string `keywords`string[] `dimensions`SectorScoreDimensions `weight`object `composite`number `isCore`boolean `usChina`SectorUsChinaData `keyStocks`Array `relatedConcepts`string[]|
| `SectorStockMapping` | - | `sectorCode`string `sectorName`string `stockSymbols`string[] `matchType`primary' \| 'secondary'|
| `SectorScoreRecord` |  | `sectorCode`string `scoreDate`string `dimensions`SectorScoreDimensions `composite`number `isCore`boolean `modelUsed`string `createdAt`string|
| `MarketStyle` |  | `'growth'` \| `'value'` \| `'balanced'` |
| `RotationSubFactor` | | `code`string `name`string `score`number `calcMethod`string `dataSource`string `freq`string `fullRule`string `midRule`string `zeroRule`string `redLine`string|
| `RotationFactor` |  | `code`string `name`string `weight`number `maxScore`number `subCount`number `role`string `color`string `subs`RotationSubFactor[]|
| `RotationSignalGrade` |  | `minResonance`number `maxResonance`number `label`string `signalType`string `position`string `action`string `color`string `bg`string|
| `RotationScoreBucket` |  | `min`number `label`string `pos`string `desc`string `color`string|
| `RotationAlertLevel` | | `code`string `name`string `color`string `condition`string `action`string|
| `DeclineNature` |  | `type`' \| '' \| ' `severity`' \| '' \| '' `action`string `color`string|
| `RotationSectorScore` |  | `sectorCode`string `sectorName`string `f1Jingqi`number `f2Zijin`number `f3Guzhi`number `f4Beta`number `f5Nengliang`number `total`number 0-100 `resonance`number 0-10 `signal`string `alertLevel`string `declineType`string `poolStocks`Array `analysisReport`string `modelUsed`string `createdAt`string|
| `V6LayerScore` | V6| `score`number `reason`string `weight`number|
| `ScoreDocVersion` |  | `docId`string `symbol`string `stockName`string `version`number `scoreDate`string `composite`number `l3v`number `layers`Record\<string, V6LayerScore\> `recommendation`object `targetPrice`object `keyRisks`string[] `keyCatalysts`string[] `reportMd`string `modelUsed`string `market`string `changeFromPrev`object `createdAt`string|
| `StrategyGroupSnapshot` |  | `count`number `avgComposite`number `maxComposite`number `symbols`string[] `items`Array|
| `StrategySnapshot` |  | `id`string `version`number `timestamp`number `date`string `stockCount`number `scoreCount`number `rotationCount`number `core`StrategyGroupSnapshot `hot`StrategyGroupSnapshot `value`StrategyGroupSnapshot `changeFromPrev`object `trigger`string|
| `HotSectorScore` |  | `symbol`string `score`number 0-5 `dimensions`{ momentum, sentiment, technical, valuation, composite } `triggerAction`immediate' \| 'probe' \| 'ignore' `calculatedAt`number `dataVersion`number|
| `ValuePitScore` | | `symbol`string `score`number 0-5 `dimensions`{ catalyst, valuation, chip, rotation, liquidity } `rotationSignal`boolean `triggerAction`immediate' \| 'probe' \| 'wait' \| 'ignore' `calculatedAt`number `dataVersion`number|
| `DualStrategyResult` | | `hotSectorScores`HotSectorScore[] `valuePitScores`ValuePitScore[] `signals`TradingSignal[] `watchlistCandidates`{ symbol, reason }[] `summary`object|
| `LocalDoc` | | `id`string `symbol`string `name`string `content`string `category`' \| '' \| '' \| '' \| '' \| '' `tags`string[] `sourcePath`string `size`number `addedAt`number|
| `NewsArticle` |  | `id`string `title`string `content`string `url`string `source`string `category`string `publishTime`string `fetchTime`string `sentiment`positive' \| 'negative' \| 'neutral' `sentimentConfidence`number `relatedStocks`string[] `keywords`string[] `hash`string|
| `NewsStockMap` | - | `symbol`string `newsId`string `relevanceScore`number `isTitleMatch`boolean `isContentMatch`boolean `industryMatch`boolean|
| `SentimentCache` |  | `contentHash`string `sentiment`positive' \| 'negative' \| 'neutral' `confidence`number `method`rule' \| 'llm' \| 'hybrid' `analyzedAt`number `llmModel`string|
| `DataDimensionType` |  | `'01_basic'` \| `'02_kline'` \| `'03_chip'` \| `'04_events'` \| `'05_news'` \| `'06_industry'` \| `'07_index'` |
| `DimensionStatus` | | `status`pending' \| 'collecting' \| 'completed' \| 'failed' `records`number `updatedAt`string `hash`string|

> ****: 2026-06-26 | v1.1.0 |  34 | 
---

## 3.8 

```ts
interface StandardEnvelope {
  meta: {
    source: ModuleId;
    target: EnvelopeTarget;
    action: EnvelopeAction;
    traceId: string;
    timestamp: number;
  };
  payload: unknown;
}
```

 `../reference/05-engine-specs.md` 4 
### 3.8.1 DataBridge 
****: `src/types/modules/databridge.types.ts`

|  | |  |
|------|------|---------|
| `DataBridgeAdapterConfig` | DataBridgeAdapter  | `enableFallbackQueue`boolean `defaultTimeout`number|
| `DataAction` |  | `'FETCH_NEWS'` \| `'FETCH_STOCKS'` \| `'FETCH_SCORES'` \| `'FETCH_DAILY_QUOTES'` \| `'FETCH_INDUSTRY_SCORES'` \| `'FETCH_INTELLIGENT_SCORES'` \| `'FETCH_STRATEGY_SNAPSHOTS'` \| `'FETCH_LOCAL_DOCS'` \| `'SAVE_NEWS'` \| `'SAVE_STOCK'` \| `'SAVE_SCORE'` \| `'UPDATE_WATCHLIST'` \| `'DELETE_NEWS'` \| `'DELETE_STOCK'` |
| `BridgeQueryOptions` |  | `timeout`number `fallbackToCache`boolean `retryCount`number|
| `BridgeQueryResult<T>` |  | `success`boolean, , `data`T `error`string `fromCache`boolean `traceId`string,  |
| `DataBridgeAdapterStats` | | `pendingQueries`number, , `enableFallbackQueue`boolean,  |

> ****: 2026-06-26 | v1.1.0 |  DataBridge | 
---

## 3.9 

### 3.9.1 

- ****- ****- ***- ****
### 3.9.2 IndexedDB  localStorage

- ****IndexedDB  MBlocalStorage 50 MB- ***object store- ****IndexedDB API- ****API 
### 3.9.3 DataBridge  Store

- ****source/target/action- ****ACL - ***`research_logs`- ****
### 3.9.4 React Router HashRouter

- ***GitHub Pages rewrite- **404**hash - ****URL SEO 
### 3.9.5 Zustand  Redux

- ****TypeScript - ****UI - ****Redux 
---

## 3.9.6 
`DataBridge.forward()`
```ts
{
  meta: {
    source: 'input-cabin';           // 
    target: 'indexeddb';
    action: 'INSERT_STOCK' | 'BULK_IMPORT' | 'UPDATE_STOCK' | 'SAVE_DAILY_QUOTES';
    traceId: string;
    timestamp: number;
    dataVersion: number;             // stocks.dataVersion 
  },
  payload: unknown;
}
```



| |  | |
|--------|----------|--------|
| `input:poolChanged` | ///| `StockPoolBoardPage`, `PoolBoard` |
| `input:fetcherStatusChanged` |  | `DataTestPanel`,  |
| `input:importProgress` |  | `BulkImportPanel` |

### 3.9.7  StateBoard 
V10 `StateBoard` V9  `eventBus` + DataBridge + Zustand

| / |  | |  |
|-----------|------|--------|------|
| `Stock.dataQuality` | `fetcherService` / `inputService` | `QualityIndicator`, `PoolCard`, `DataTestPanel` | |
| `V6Score.score` / `factors` | `v6ScoreService` | `StockAnalysisPage`, `TradingApp` |  |
| `TradingSignal.type` / `confidence` | `signalGenerator` | `TradingApp`, `RiskBanner` |  |
| `Order.riskReview` | `riskEngine` | `FinalConfirm`, `RiskBanner` | |

> 
---

## 3.10 

### 3.10.1 

- PWA v1.0.0 - - V6 LLM 
### 3.10.2 
- `navigator.onLine` `online/offline` - UI LLM/
### 3.10.3 

- IndexedDB- 
---

## 3.11 
|  |  |
|------|------|
| DataBridge ACL  | `AclError`UI |
|  | `EnvelopeError`|
| DB  | `EnvelopeError` |
| |  `{ success: false, error }`UI  |
| LLM | V6 UI |
| AKShare  | |
| IndexedDB  |   |

---

## 3.12 -V6 Pro 
 V6 Pro  V9 
| # |  |  |  |  |
|---|------|----------|------|------|
| D01 | `agents/` `agentRuntime.ts`| `src/agents/agentRuntime.ts` | /AI | Phase 2  |
| D02 |  `trading/`  `src/services/trading/` | `src/services/trading/*` | | |
| D03 | V6 / | `src/services/scoring/v6ScoreService.ts` |  | Phase 2 |
| D04 |  | `src/config/routes.ts` |  404 | |
| D05 |  `thresholds.ts` / `symbols.ts` | `src/config/` | | Phase 2  |
| D06 |  | `scripts/audit/audit-layer-calls.ts` |  0  / 0  |  |
| D07 |  `inputConfig.ts`  | `src/config/inputConfig.ts` | //| |
| D08 | | `src/config/routes.ts` vs `src/apps/`/`src/pages/` | /| Phase 2  `audit-dead-code.ts` - |
| D09 | UI  Tailwind /| `src/apps/input/prototype/*` | | Phase 2  |
| D10 | V10 Agent/StateBoard/Gateway  | `src/` | | Phase 2/P3  |
| D11 |  | `../reference/03-architecture-standards.md` | |  3.9.7  |
| **D12** | **`src/core/dataflow/`* | `src/core/dataflow/` | SSE//// | Phase 2  |
| **D13** |  `dataFusionEngine.ts` + `unifiedStockService.ts`| `src/services/analysis/` | |  |
| **D14** |  Widget  `CockpitShell` | `src/cockpit/CockpitShell.tsx` | Shell |  Widget |
| **D15** | **** | `src/services/scoring/v6ScoreService.ts` |  +  LLM | Phase 2  LLM |
| **D16** |   | `package.json` | `lightweight-charts` `recharts`|  |
| **D17** | **`rotationScoreService.ts` `SectorAnalysisPage` * | `src/services/analysis/rotationScoreService.ts` | | Phase 2 `SectorAnalysisPage`  |
| **D18** | **** | `src/components/atoms/Toast.tsx` |  Toast| Phase 2  |
| **D19** |  `WidgetErrorBoundary` `CockpitShell` Widget  | `src/cockpit/CockpitShell.tsx` | Widget Widget  | |
| **D20** | **** | `src/services/trading/``src/cockpit/widgets/` | / HotSectorScore / ValuePitScore | Phase 2  StoreAnalyzerDetectorWidget`./design/2026-06-27-dual-strategy-system.md` |

---

## 3.13 Page 
> ****
### 3.13.1 pending 
****`useEffect`/`componentDidMount`  loading/pending 
****""Response Time 
**V9 **-  `isLoading` / `loading` - Skeleton
-  `loading = true`/ `loading = false`
-  `try-catch-finally`  loading 

***`src/pages/``src/apps/` 

****- `StockAnalysisPage.tsx` (2-28`loadStockForAnalysis`/`loadDailyQuotesForAnalysis`/`loadV6ScoreForAnalysis` loading - `AnalysisApp.tsx` (5-20`loadStocks` loading 
****```typescript
// StockAnalysisPage.tsx 2-28useEffect(() => {
  if (symbol) {
    setLoading(true)
    Promise.all([
      loadStockForAnalysis(symbol),
      loadDailyQuotesForAnalysis(symbol),
      loadV6ScoreForAnalysis(symbol),
    ]).then(([stockData, quotesData, scoreData]) => {
      setStock(stockData)
      setQuotes(quotesData)
      setScore(scoreData)
    }).catch(console.error).finally(() => {
      setLoading(false)
    })
  }
}, [symbol])
```

---

### 3.13.2 
****Engine/EventBus  `useEffect` /`componentWillUnmount` `removeListener`/`off`
**** CPU 
**V9 **-  `removeListener` / `off` / `unsubscribe`
-  `useEffect` 
-  `WeakRef` 
-  `eventBus.on()` `off` 

***EventBus/DataFlowEngine 
****- `StockAnalysisPage.tsx`- `TradingApp.tsx`-  Widget 
****```typescript
// Widget 
useEffect(() => {
  const unsubscribe = eventBus.on('market:index', handleIndexUpdate)
  return () => unsubscribe()
}, [])
```

---

### 3.13.3 
****`useParams`  DataBridge 
**** A B  A Cognitive Mismatch
**V9 **-  `resetState + refetch` 
-  `useEffect`  `params` 
- -  stale closure

***
****- `StockAnalysisPage.tsx` (2-28`useEffect` `symbol` resetState 

****```typescript
// StockAnalysisPage.tsx 2-28useEffect(() => {
  if (symbol) {
    setStock(undefined)
    setQuotes(undefined)
    setScore(undefined)
    setLoading(true)
    Promise.all([
      loadStockForAnalysis(symbol),
      loadDailyQuotesForAnalysis(symbol),
      loadV6ScoreForAnalysis(symbol),
    ]).then(([stockData, quotesData, scoreData]) => {
      setStock(stockData)
      setQuotes(quotesData)
      setScore(scoreData)
    }).catch(console.error).finally(() => {
      setLoading(false)
    })
  }
}, [symbol])
```

---

### 3.13.4 

|  | | |
|--------|----------|--------|
|  loading |  + ESLint  | |
| |  + | |
| |  +  | |
|  try-catch-finally |  + ESLint  | |

---

## 3.14 
- [ ] `src/apps/` / `src/pages/` / `src/components/` / `src/portal/` / `src/cockpit/` import `dataLayer` - [ ] `src/config/` import `src/services/` / `src/apps/` / `src/pages/`- [ ] `src/core/` import `src/components/` / `src/pages/`- [ ] `src/services/` `DataBridge.forward()`- [ ]  `src/apps/trading/` `src/apps/input/``src/apps/analysis/``src/apps/output/` 
---

## 3.15 

 `v0.9.0-migration-implemented` `v0.9.0-docs-base` 
- `../reference/architecture-version-comparison.md`


1.  L3/L4 2.  `daily_quotes` store`dataQuality` 3. 4. `fetcherConfig.ts``tradingConfig.ts` `inputConfig.ts` 5. v2.3.03.1.8 Store/Service/Component/Widget Registry6. v2.3.0Widget  12  217  Widget Widget7. v2.3.0D19 WidgetErrorBoundary CockpitShell8. v2.5.0 `timeouts.ts``apiPaths.ts`/`mathConstants.ts` 9. v2.5.0L3 positionComputer/pnlComputer/riskComputer UseCase 11 createExecutionPlan/executePlan/fetchSectorAnalysis/fetcherOrchestrator/generateTradeReview/getUnifiedStockView/hotSectorQuery/rebalancePortfolio/runDualStrategy/strategySnapshotSave/submitOrder10. v2.5.0.1.8 Service Registry 11. v2.5.0TradePair MatchedTradePair extends TradePairSymbolTradePair symbol 12. v2.6.03.16 
---

## 3.16 
### 3.16.1 
- - 
- 
- 

***
### 3.16.2 
|  |  |  |
|------|------|---------|
| *** | 30% |  |
| **** | 20% | |
| **** | 25% |  |
| *** | 25% | CC|

### 3.16.3 
|  |  |
|------|------|
| 70 |  |
| 50-69 |  |
| < 50 | |

### 3.16.4 


1. ****2. ****/config/constants 
3. **** interface/type types 
4. ****

### 3.16.5 
|  |  |
|--------|---------|
| | < 5 |
| | |
|  | |
| | 80% |
|  | re-export |

### 3.16.6 

***- - 
- 

****- 
- 
- 

****|  |  |  |
|------|------|---------|
|  | |  re-export  |
|  | |  re-export  |
| | | |
| | | |

### 3.16.7 
```

        0% + 20% + 25% + 5%         < 50
        50  < 70//                                                            
                                                                             
         70                                                        
                                                                        
```

### 3.16.8 AGENTS.md 
 `../../AGENTS.md`  ./../AGENTS.md  AI 

## 

 V9 

- [](../00-meta/../explanation/design/registry-index.md)
- [V9  ](../explanation/design/v9-code-quality-kanban-20260629.md)
- [](../explanation/design/.md)
- [](.md)
- [pr-8-dedup-plan](changelogs/2026-07/pr-8-dedup-plan.md)
- [](../team-handbook/06-team-operation-guide.md)

