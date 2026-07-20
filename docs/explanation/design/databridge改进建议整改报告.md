---
title: DataBridge 
type: explanation
domain: data
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## ..."
tags: [data, databridge, report, design, remediation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-065
related_docs: [V9-DOC-DATA-051]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# DataBridge 

## 
DataBridgeP0P1P2
| |  | |  |
|--------|------|------|---------|
| P0 |  | | 2026-07-08 |
| P0 | | | 2026-07-08 |
| P1 | | | 2026-07-08 |
| P1 | forward | | 2026-07-08 |
| P2 |  | | 2026-07-07 |

---

## 
### 2.1 P0-1: 

****BULK_*  Action

****?
1. **Action **[dbConfig.ts](../../../src/config/dbConfig.ts)?   -  `bulkInsertStock``bulkSaveDailyQuotes``bulkSaveScores``bulkSaveFinancialReports``bulkSaveNews` 5 Action

2. **Handler **[databridgeHandlers.ts](../../../src/core/databridgeHandlers.ts)?   -  `BulkHandler`  `db.withTransaction()` 
   -  payload
   - 
3. ****[databridge.ts](../../../src/core/databridge.ts)?   - ?`ACTION_TO_STORE_MAP` 

4. ** Handler**[databridgeHandlers.ts](../../../src/core/databridgeHandlers.ts)?   - ?`createHandlerRegistry()` `BulkHandler`

***?-  IndexedDB - - 

### 2.2 P0-2: 
****`stocks:{symbol}` 
****?
1. ****[databridge.ts](../../../src/core/databridge.ts)?   -  `getMatchingSubscribers()`    - `stocks:000001``stocks:*``stocks`?
2. ****[databridge.ts](../../../src/core/databridge.ts)?   -  `broadcast()` Store  symbol    - ?payload symbol`stocks:{symbol}` 
   -  `getMatchingSubscribers()` 
3. ****[databridge.ts](../../../src/core/databridge.ts)?   -  `extractSymbolFromPayload()`  payload symbol
   -  symbol 

***?- 
- 
-  symbol 

### 2.3 P1-1: 
**** DB `event:*` 

****?
1. ** Action **[databridge.ts](../../../src/core/databridge.ts)?   -  `isEventAction()` `newsArticleLoaded``holdingsDataLoaded``tradeActionExecuted``loadHoldingsData`?
2. ****[databridge.ts](../../../src/core/databridge.ts)?   - ?`forward()`    - 

3. ****[databridge.ts](../../../src/core/databridge.ts)?   -  `routeToEvent()`    -  `event:{action}` ?`event:*` 
***?- - NotificationHandler - 

### 2.4 P1-2: forward

****QUERY_*  Action DataBridge forward()

****?
1. ** Action **[databridge.ts](../../../src/core/databridge.ts)?   -  `isQueryAction()` `queryGet``queryList``queryByIndex`?
2. ****[databridge.ts](../../../src/core/databridge.ts)?   - ?`forward()`    - 
3. ****[databridge.ts](../../../src/core/databridge.ts)?   -  `routeToQuery()`    - ?payload keyindexNameindexValue?   -  `query()` 
   -  `query:{store}` 

4. ****[databridge.ts](../../../src/core/databridge.ts)?   - ?`ACTION_TO_STORE_MAP` 

***?- 
- - `query()` 
---

## 
### 3.1 
```
npx tsc --noEmit
# ```

### 3.2 ESLint 
```
npm run lint
# ```

### 3.3 

```
npm test -- --run
# 
```

### 3.4 

| |  |  | |
|--------|---------|---------|------|
|  | 100 | | |
|  | 50  K |  | |
| |  `stocks:000001`| 000001  | |
|  |  `stocks:*`|  | |
|  | Action |  | |
|  |  forward()  |  | |

### 3.5 

| |  |  | |
|--------|---------|---------|------|
|  |  vs  100 |  < 1/5 | |
|  | 100  symbol |  < 10ms | |
|  | 1000 |  < 20ms | |

### 3.6 
| |  |  | |
|--------|---------|---------|------|
|  |  Action |  | |
|  | | | |
|  |  | | |

---

## 
|  |  | |
|------|---------|------|
| |  IndexedDB  | |
| |  symbol | |
| DB  | `event:*`  | |
|  |  forward()  | |

---

## 

### 5.1 

1. **** API
2. **** `BulkHandler`  Handler 
3. ****
4. ****DB?
### 5.2 

1. **store** storestore 
2. ***3. ****readCache
---

## 

| |  |  |
|--------|---------|------|
|  | [databridge.md](docs/reference/databridge.md) | |
|  | [pipelineScheduler.ts](../../../src/core/pipelineScheduler.ts) | PipelineSchedulerPipelineCycleDataIntegrityGuard |
| DataBridge  | [databridge.ts](../../../src/core/databridge.ts) | |
| Handler | [databridgeHandlers.ts](../../../src/core/databridgeHandlers.ts) | BulkHandler  |
| Action  | [dbConfig.ts](../../../src/config/dbConfig.ts) | BULK_* Action  |
|  | [databridge.md](docs/explanation/design/databridge.md) |  |

---

> ****
