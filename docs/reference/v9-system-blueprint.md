---
title: v9-system-blueprint
type: reference
domain: architecture
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: " A   "
tags: [architecture, system, reference, design, documentation]
version: v1.0.0
last_updated: 2026-06-27
code_version: 2.0.0
doc_id: V9-DOC-ARCH-010
related_docs: [V9-DOC-META-000, V9-DOC-DATA-001, V9-DOC-PROJ-295, V9-DOC-PROJ-174, V9-DOC-PROJ-164, V9-DOC-PROJ-176]
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-DATA-001, V9-DOC-PROJ-182, V9-DOC-PROJ-179, V9-DOC-PROJ-295, docs/00-meta/deprecated-docs/old-versions/registry-index-v1.0.0-02-design.md, V9-DOC-PROJ-149]
change_log: 
---

# V9   

> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-24
>
>  `../archive/v10-architecture-whitepaper.md`  `../explanation/completeness-profile-batch4.md`  V9 UI 

---

## 1. 

|  |  | V9  |
|------|---------|-------------------|
|  |  |  |
|  |  | / |
|  |  |  IndexedDB |
|  |  |  |
|  |  |  |
|  |  |  |

**** A   

****

1. ""  ""
2. ""  ""
3. ""  ""
4. ""  " V6 "
5. ""  " +  + "

---

## 2. 

|  |  |  |
|------|---------|------|
|  | React 19 + TypeScript + Vite |  |
| UI  | Tailwind CSS + shadcn/ui + Radix UI |  CSS +  |
|  | Zustand |  UI  |
|  | React Router 7 HashRouter |  404 |
|  | recharts + lightweight-charts |  + K  |
|  | IndexedDB |  |
|  |  |  P3  |

****

1. 
2. L5/L4  `dataLayer` `DataBridge.forward()`
3. /
4.  `src/apps/trading/`  `src/services/trading/` 
5.  schema 

---

## 3. 

```

  L5 pages/, components/, portal/, cockpit/                       
  PortalShell  Widget                       

  L4 apps/                                                        
   /  /  /  /                               

  L3 services/agents/                                  
  scoring/ | fetcher/ | trading/ | input/ 
  core/dataflow/                                            

  L2 data/                                                        
  db.ts | dataLayer.ts | types.ts                                         

  L1 lib/, config/, core/                                     
  eventBus | DataBridge | ACL | Envelope | theme | routes                 

```

### 3.1  V10 

| V10  | V9  |  |
|----------|-------------|------|
| M1  | `src/data/` + `src/services/fetcher/` | V9  services/ |
| M2  | `src/services/scoring/` | V6/V4  |
| M3  | `src/agents/agentRuntime.ts` // | P2/P3  |
| M4  | `src/services/trading/` | P3  `ITradingGateway` |
| M5  | `src/services/scoring/industryScoreService.ts` | P1/P2  V4  |
| M6  | `src/pages/`, `src/components/` |  |
| M7  | `src/apps/` |  |
| M8  | `src/cockpit/` |  Widget  |
| M9  | `src/components/ui/` |  |
| M10  | `src/lib/`, `src/config/`, `src/core/` |  |

---

## 4. 

### 4.1  Store 

 IndexedDB  **17  Store**

| Store |  |  |
|-------|------|------|
| `stocks` | `symbol` |  |
| `daily_quotes` | `symbol` | /K |
| `v6_scores` | `symbol` | V6  |
| `intelligent_scores` | `id` | V6 LLM  |
| `industry_scores` | `id` | V4  |
| `orders` | `id` |  |
| `watchlists` | `id` |  |
| `signals` | `id` |  |
| `research_logs` | `id` |  |
| `rotation_scores` | `id` |  |
| `sector_scores` | `id` |  |
| `score_docs` | `docId` |  |
| `strategy_snapshots` | `id` |  |
| `local_docs` | `id` |  |
| `news` | `id` |  |
| `news_stock_map` | `id` | - |
| `sentiment_cache` | `id` |  |

### 4.2  Store

| Store |  |  |
|-------|----------|--------|
| `score_history` |  | P2 |
| `collect_tasks` |  | P1 |
| `trade_reviews` |  | P2 |
| `watch_configs` |  | P2 |

>  V10  20  Store V9 

### 4.3 

|  |  |  |
|------|------|------|
| `symbol` | string |  `600519.SH` |
| `researchStatus` | enum | `candidate / screened / deepDive / watching / archived` |
| `source` | enum | `manual / import / akshare` |
| `dataVersion` | number |  |
| `calculatedAt` | number |  |
| `algorithmVersion` | string |  `v9-auto` |
| `dataQuality` | object | `{ basic, kline, finance, lastChecked? }` |

---

## 5. 

### 5.1 

```ts
interface StandardEnvelope {
  meta: {
    source: ModuleId;        //  'input-cabin' / 'fetcher' / 'analyzer'
    target: EnvelopeTarget;  // 'indexeddb'
    action: EnvelopeAction;  // INSERT_STOCK / UPDATE_STOCK / SAVE_DAILY_QUOTES / ...
    traceId: string;
    timestamp: number;
    dataVersion: number;
  };
  payload: unknown;
}
```

### 5.2 

|   /   | L5  | L4  | L3  | L2  | L1  |
|------------------------|---------|---------|---------|---------|-------------|
| L5  | ? | ? | ? | ?  | ? |
| L4  | ? | ? | ? | ?  | ? |
| L3  | ? | ? | ? | ?  dataLayer /  DataBridge | ? |
| L2  | ? | ? | ? | ? | ? |
| L1  | ? | ? | ? | ? | ? |

### 5.3 

|  |  |  |
|--------|----------|--------|
| `input:poolChanged` | stocks  | `InputDashboard`, `PoolBoard` |
| `input:fetcherStatusChanged` |  | `DataTestPanel`,  |
| `input:importProgress` |  | `InputDashboard` Tab |
| `stocks:changed` |  |  |
| `scores:changed` |  |  |
| `orders:changed` |  |  |

### 5.4 

|  |  |  |  |  |  |
|------|------|------|------|------|------|
|  | `fetcherService` | `db.ts` | Stock / DailyQuotes | / | `src/services/fetcher/*` |
|  | `v6ScoreService` | `AnalysisApp` | V6Score | `scores:changed` | `src/services/scoring/*` |
|  | `signalGenerator` | `tradingService` | TradingSignal | / | `src/services/trading/*` |
|  | `poolTransitionEngine` | `stockpoolService` | Stock | `stocks:changed` | `src/services/stockpool/*` |
|  | `src/config/*` |  | ConfigObject | import | `src/config/*.ts` |

---

## 6.  UI 

### 6.1 

|  |  |  |  |
|------|------|------|------|
| `/` | `HomePage` |  | portal |
| `/cockpit` | `CockpitShell` |  | portal |
| `/input` | `InputDashboard` Tab | `inputService`, `stockpoolService`, `batchImportService` | input |
| `/input/hot-sectors` | `HotSectorPanel` | `hotSectorService` | input |
| `/input/data-test` | `DataTestPanel` | `fetcherService` | input |
| `/input/prototype` | `InputPrototype` | mock | input |
| `/analysis` | `AnalysisApp` |  | analysis |
| `/analysis/stock-score` | `StockAnalysisPage` | `v6ScoreService`, `intelligentScoreService` | analysis |
| `/analysis/stock-score/:symbol` | `StockAnalysisPage` | `v6ScoreService`, `intelligentScoreService` | analysis |
| `/analysis/sector` | `SectorAnalysisPage` | `industryScoreService` | analysis |
| `/analysis/backtest` | `BacktestPage` |  | analysis |
| `/analysis/industry-score` | `IndustryScorePage` | `industryScoreService` | analysis |
| `/analysis/intelligent-score` | `IntelligentScorePage` | `intelligentScoreService` | analysis |
| `/trading` | `TradingApp` | `tradingService`, `signalGenerator`, `riskEngine` | trading |
| `/output` | `OutputApp` |  | output |
| `/command` | `CommandApp` |  | command |

### 6.2 

|  |  |  |
|------|----------|------|
|  Tab | `StockSearch`, `QualityIndicator`, `PoolBoard` | / |
|  Tab | `BulkImportPanel` InputDashboard  |  |
|  | `HotSectorPanel` |  |
|  | `DataTestPanel` |  |

---

## 7. UI/UX 

### 7.1 PortalShell 

- 56px Logo 
- 260px  /  / 
-  `p-6`
-  `dark` `/`  `/cockpit` 

### 7.2  V6 Pro UI 

|  | V9  |  |
|--------|----------|--------|
|  | `QualityIndicator` | P0 |
|  | `RiskBanner` | P1 |
|  | `FinalConfirm` | P1 |
|  | `DebaterPanel` | P2 |
|  | `GatewayPanel` | P2 |
|  | `ReviewDrawer` | P2 |
| Markdown/PDF  | `ReportGenerator` | P2 |
|  | `LoopBanner` | P2 |

### 7.3 

- Widget 
- K /
- 
- / NL

---

## 8. P0 / P1 / P2

### Phase 2 

|  |  |  |  |
|------|--------|------|------|
| 2.1 AKShare  | P1 | ? |  |
| 2.2 / | P1 | ?? |  |
| 2.3  UI | P1 | ? |  |
| 2.3.5  UI  | P1 | ? |  |
| 2.3.6 /// | P0 | ?? |  |
| 2.3.7  | P0 | ?? |  |
| 2.3.8  | P1 | ?? |  |
| 2.3.9  | P1 | ?? |  |
| 2.3.10  UI | P2 | ?? |  |
| 2.4  | P1 | TBD |  |
| 2.4.1  | P1 | ?? | ADR-009 /Store/Analyzer/Widget  |
| 2.5  | P0 | ? |  |
| 2.6  | P0 | ? |  |
| 2.7  | P0 | ? |  |
| 2.8  | P1 | TBD |  |
| 2.9 AI  | P1 | TBD |  |
| 2.10  | P2 | TBD |  |
| 2.11  | P2 | TBD |  |
| 2.12  | P2 | TBD |  |

### Phase 3 

- PWA manifest + service worker
- E2E Playwright
- CI 
- 
- 

### Phase 4 v1.0.0

- 
- 
- 
- 
- GitHub Pages 

---

## 9. 

| # |  |  |  |
|---|--------|----------|------|
| 1 | TypeScript  | ?  | 0 errors |
| 2 | ESLint  | ?  | 0 warnings/errors |
| 3 |  | ? 291/291  | 0  |
| 4 |  | ?  |  |
| 5 |  | ? 0  / 2  | 0  |
| 6 |  | ??  389  | 0 / |
| 7 | / | ??  11  | 0  |
| 8 |  | ??  | core/data/utils  85%services  70% |
| 9 | E2E  | ? 5/5 passed | 0  |
| 10 |  | ??  0  | 0  |
| 11 | PWA  | ??  | service worker  |

---

## 10. 

| # |  |  |  |
|---|------|------|------|
| D01 | `agents/` `src/agents/agentRuntime.ts` // | Agent  | Phase 2  Agent  |
| D02 | ?? `trading/`  `src/services/trading/` |  |  |
| D03 | V6 / |  | Phase 2  |
| D04 | ??  |  404 |  |
| D05 |  `thresholds.ts` / `symbols.ts` |  | Phase 2  |
| D06 | ??  |  0  / 2  |  |
| D07 | ?? `inputConfig.ts`  | // |  |
| D08 |  | / | Phase 2  `audit-dead-code.ts` - |
| D09 | UI  Tailwind / |  | Phase 2  |
| D10 | V10  Agent/StateBoard/Gateway  |  | Phase 2/P3  |
| D11 |  |  |  3.9.7  |
| **D12** | **`src/core/dataflow/`** | `src/core/dataflow/`  SSE/ | Phase 2  |
| **D13** | **** | `src/services/analysis/`  `UnifiedStockData`  | Phase 2  `unifiedStockService.ts` |
| **D14** | **Widget `src/cockpit/core/widgetEngine.ts``CockpitShell` ** | /`CockpitShell`  | Phase 2  CockpitShell  Widget  |
| **D15** | **** | `src/services/scoring/v6ScoreService.ts`  +  LLM  | Phase 2  LLM |
| **D16** | **** | `src/components/ui/`  `lightweight-charts` / `recharts``./chart-integration.md` API  DataFlow  | Phase 2  |
| **D17** | **`rotationScoreService.ts`  `SectorAnalysisPage` ** |  | Phase 2  `SectorAnalysisPage`  |
| **D18** | **** | `src/components/atoms/Toast.tsx` `./feedback-loop-spec.md`  FeedbackService  EventBus  | Phase 2  |
| **D19** | **`ErrorBoundary.tsx`  `App.tsx` Widget ** | `./widget-error-handling.md`  Widget  UI | Phase 2  Widget  ErrorBoundary |
| **D20** | **** | // HotSectorScore / ValuePitScore  | Phase 2  StoreAnalyzerDetectorWidget ADR-009 |

---

## 11. ADR

|  |  |  |  |
|------|------|------|------|
| ADR-001 |  |  | 2026-06-20 |
| ADR-002 | IndexedDB  localStorage |  | 2026-06-20 |
| ADR-003 | DataBridge  dataLayer  |  | 2026-06-21 |
| ADR-004 | React Router HashRouter |  | 2026-06-21 |
| ADR-005 | PortalShell  Kimi  |  | 2026-06-23 |
| ADR-006 |  |  | 2026-06-24 |
| ADR-007 |  |  | 2026-06-24 |
| ADR-008 |  v6-pro-cockpit ""  |  | 2026-06-24 |
| ADR-009 |  |  | 2026-06-27 |

#### 

|  |  |
|------|--------|
| ADR-001 | 2026-06-20-pure-frontend-architecture.md |
| ADR-002 | 2026-06-20-indexeddb-over-localstorage.md |
| ADR-003 | 2026-06-21-databridge-over-direct-datalayer.md |
| ADR-004 | 2026-06-21-hashrouter-for-static-hosting.md |
| ADR-005 | 2026-06-23-portalshell-dark-kimi-layout.md |
| ADR-006 | 2026-06-24-input-cabin-subpages.md |
| ADR-007 | 2026-06-24-pool-screening-signal-persistence-review-engine.md |
| ADR-008 | 2026-06-24-adopt-v6-core-resource-trading-strategy.md |
| ADR-009 | 2026-06-27-dual-strategy-system.md |

---

## 12. 

### 

|  |  |  |
|------|------|------|
| 01 | `./01-vision-and-goals.md` |  |
| 02 | `./02-functional-specs.md` |  |
| 03 | `./03-architecture-standards.md` |  Schema |
| 04 | `./04-ui-ux-specs.md` | UI/UX  |
| 05 | `./05-engine-specs.md` | DataBridge |
| 06 | `./06-routing-specs.md` |  |
| 07 | `./07-operation-strategy.md` | ADR |
| 08 | `./08-implementation-plan.md` |  |
| 09 | `./09-quality-gates.md` |  |
| 10 | `./10-glossary.md` |  |

### 

|  |  |
|------|------|
| `./v9-system-blueprint.md` |  |
| `./dual-strategy-dataflow-spec.md` | / |
| `../explanation/dual-strategy-gap-analysis.md` |  |
| `./architecture-version-comparison.md` |  |
| `./input-cabin-spec.md` |  |
| `./data-interaction-protocols.md` |  |
| `../explanation/design/implementation-governance.md` |  ADR  |
| `./v9-input-cabin-strategy-report.md` |  |
| `./v10-architecture-alignment.md` | V10  |
| `../archive/ui-module-alignment.md` | V6 Pro UI  |
| `./v6-cockpit-ui-reference.md` | v6 UI  |
| `../explanation/trading-core-factors.md` |  |
| `./chart-integration.md` |  DataBridge  |
| `./feedback-loop-spec.md` |  EventBus  |
| `./widget-error-handling.md` | Widget  UI |
| `./pwa-offline-guide.md` | PWA Service Worker  |
| `../archive/ADR-001~009.md` |  |
| `CHANGELOG.md` |  |

---

## 13. 

|  |  |  |
|------|------|------|
| v0.9.0-docs-base | 2026-06-24  |  |
| v0.9.0-docs-review | 2026-06-24 | UI ADR V10/V6 Pro  |
| v0.9.0-migration-implemented | 2026-06-24 |  Store E2E/ |

## 

 V9 

- [](../00-meta/../explanation/design/registry-index.md)
- [data-security-and-privacy](../01-product/data-security-and-privacy.md)
- [V9  ?? ](../reports/retrospectives/-v2.0.0.md)
- [](../explanation/design/../explanation/design/registry-index.md)
- [V9 ](../explanation/design/00-readme.md)
- [](../00-meta/REGISTRY_INDEX.md)

