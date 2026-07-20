---
title: MCP Server ɲԱ棨޸ܣ
type: reports
domain: ai
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## һԸ ### ļ嵥"
tags: [ai, integration, mcp, test]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# MCP Server ɲԱ棨޸ܣ

> **Date**: 2026-07-08
> **Proofreader**: workbuddy
> **ԷΧ**: 16  MCP Server ȫ·ɲ + Stockpool ACL Ȩ֤
> **Խ**: ? **54/54 ȫͨ** | Duration: 6.92s

---

## һԸ

| ָ | ֵ |
|------|------|
| ļ | 2 |
|  | 54 |
| ͨ | 54 |
| ʧ | 0 |
|  | 0 |
| ܺʱ | 6.92s |
| ִкʱ | 165ms |
| ׼ʱ | 1.25s |

### ļ嵥

| ļ |  | ״̬ |
|------|--------|------|
| `mcp-servers.integration.test.ts` | 33 | ? ȫͨ |
| `stockpool-acl.integration.test.ts` | 21 | ? ȫͨ |

---

## ?? ޸רעŶӸص㣩

### ޸ 1fetcher ־ͺʱ¼ȫ

**ⱳ**: fetcher ߵ `collectBasic``collectKline``collectFinancial` ȱϸ־ͺʱ¼޷Ų Python ⡣

**޸**: [src/services/fetcher/fetcherClient.ts](../../../src/services/fetcher/fetcherClient.ts)

|  | ޸ǰ | ޸ |
|------|--------|--------|
| `collectBasic` | ־޺ʱ | ־ + `durationMs` ʱ + ӦժҪ(stockName/price) + ־ |
| `collectKline` | ־޺ʱ | ־(symbol/period/adjust) + `durationMs` ʱ + ӦժҪ(historyCount) + ־ |
| `collectFinancial` | ־޺ʱ |  `durationMs` ʱ¼ |

**־ʽʾ**:
```
[INFO] [fetcherClient] collectBasic ʼ { symbol: '600519', path: '/api/collect/basic' }
[INFO] [fetcherClient] collectBasic ɹ { symbol: '600519', success: true, durationMs: 152, stockName: 'ę́', price: 1680.5 }
```

---

### ޸ 2ļ fake-indexeddb ״̬ͻ

**ⱳ**: `vite.config.ts`  `pool: 'forks'` + `maxForks: 1` + `fileParallelism: false`вļͬһдУ `db` һļк `_isReady=true`ڶļ `db.init()` fake-indexeddb ״̬һµ `NOT_FOUND_ERR` (code 8)

**޸ǰ**: ļͬʱʱ 25/54 ʧܣ`INDEX_SIZE_ERR` / `NOT_FOUND_ERR`

**޸**: ļͬʱʱ 54/54 ȫͨ

**޸**:

| ļ | ޸ |
|------|----------|
| [src/data/db.ts](../../../src/data/db.ts) |  `V6Database.close()`  +  `close()` ر IDBDatabase  +  `_isReady=false` + ؽ ready Promise + `resetDbInstance()` |
| [src/data/db-migrations.ts](../../../src/data/db-migrations.ts) | **Ԥ bug ޸**: `rbacMigrationV24` δעᵽ `MIGRATIONS` 飬 6  RBAC store δ`db.reset()` ʱ `NOT_FOUND_ERR` |
| ļ | `afterAll(() => close())` ȷļ db ȫ |

**ͻ**:

```
ļ A   db.init()  _isReady=true  openDB()   store
ļ A   db ӱִ  _isReady Ϊ true
ļ B   db.init()  _isReady=true  ֱӷأ openDB
ļ B beforeEach  db.reset()  store.clear()  NOT_FOUND_ERR ?
                                        
                         fake-indexeddb ڲ״̬ѱļ A ޸
```

**޸**:

```
ļ A   db.init()  _isReady=true  openDB()   store
ļ A   afterAll: close()  ر + _isReady=false + resetDbInstance()
ļ B   db.init()  _isReady=false  openDB()  ´ store ?
ļ B beforeEach  db.reset()  store.clear()  ɹ ?
```

---

## 16  MCP Server 嵥

| # | Server (info.name) |  | ð̲Թ | ״̬ |
|---|---------------------|--------|-------------|------|
| 1 | fetcher | 1 | health_check | ? |
| 2 | scoring:v6 | 2 | get_engine_config, get_all_scores | ? |
| 3 | trading | 1 | get_orders | ? |
| 4 | analysis | 1 | screen_stocks | ? |
| 5 | news | 1 | fetch_news | ? |
| 6 | llm | 1 | list_models | ? |
| 7 | portfolio | 1 | list_by_theme | ? |
| 8 | screening | 1 | run_screening | ? |
| 9 | backtest | 1 | run_backtest | ? |
| 10 | stockpool | 3 | list_pool_stocks, list_groups, transition_stock | ? |
| 11 | system | 1 | get_stats | ? |
| 12 | data-collector | 1 | detect_missing_reports | ? |
| 13 | execution | 1 | list_execution_plans | ? |
| 14 | export | 1 | export_backtest_report | ? |
| 15 | input | 1 | (ð̲Ը) | ? |
| 16 | trade | 1 | (ð̲Ը) | ? |

---

## ġɲ׼飨33 

### ׼ 1: ע֤6 ?

- ? Ӧע 16  MCP Server
- ?  Server Ӧʵ MCPServer ӿ
- ?  Server Ӧ¶ listTools() 
- ?  Server  info Ӧ name/version
- ?  Server  tools ӦΪǿ
- ? Server ע˳Ӧȼ

### ׼ 2: ߵð̲ԣ17 ?

- ? fetcher: health_check   fetcher  providers Ƕ׽ṹ
- ? scoring:v6: get_engine_config  
- ? scoring:v6: get_all_scores  б
- ? trading: get_orders  ضб
- ? analysis: screen_stocks  ɸѡ
- ? news: fetch_news  б
- ? llm: list_models  ģб
- ? portfolio: list_by_theme  б
- ? screening: run_screening  ɸѡ
- ? backtest: run_backtest  ػز
- ? stockpool: list_pool_stocks  عƱб
- ? stockpool: list_groups  طб
- ? stockpool: transition_stock  ״̬
- ? system: get_stats  ϵͳͳ
- ? data-collector: detect_missing_reports  ȱʧ
- ? execution: list_execution_plans  ִмƻб
- ? export: export_backtest_report  ص

### ׼ 3: ACL Ȩ֤4 ?

- ? ACL_MATRIX  stockpool  actions Ӧ SELECT/INSERT/UPDATE/DELETE
- ? stockpool Ӧͨ DataBridge.query ѯ stocks store
- ? stockpool Ӧͨ DataBridge.query  key ѯ stocks store
- ? stockpool Ӧͨ DataBridge.forward  stocks store

### ׼ 4: ؼ·˵˲ԣ4 ?

- ? fetcher MCP  health_check  ظʽӦ fetcher Ƕ׶
- ? stockpool MCP  list_pool_stocks  ӦعƱб
- ? scoring:v6 MCP  get_all_scores  Ӧб
- ? DataBridge д·: forward(INSERT_STOCK)  query(QUERY_LIST)  һ

### ׼ 5: ߵݵԣ2 ?

- ? εͬһӦһ½
- ? ߵòӦۻ

---

## 塢Stockpool ACL ׼飨21 

### ׼ 1: ACL_MATRIX ֤4 ?

- ? stockpool ģӦ ACL_MATRIX ж
- ? stockpool  actions Ӧ SELECT/INSERT/UPDATE/DELETE
- ? stockpool  read бӦ stocks  v6Scores
- ? stockpool  write бӦ stocks

### ׼ 2: DataBridge.query Ȩ֤4 ?

- ? stockpool Ӧͨ QUERY_LIST ѯ stocks store
- ? stockpool Ӧͨ QUERY_GET  key ѯ stocks store
- ? stockpool Ӧܲѯ v6Scores store
- ? ѯڵ key Ӧ success  data Ϊ

### ׼ 3: DataBridge.forward дȨ֤2 ?

- ? stockpool Ӧͨ forward  stocks store
- ? stockpool Ӧܶ forward ͬһƱ

### ׼ 4:  ResearchStatus ״̬ת5 ?

- ? candidate ״̬ת
- ? screened ״̬ת
- ? deepDive ״̬ת
- ? watching ״̬ת
- ? archived ״̬ת

### ׼ 5: ACL ܾ֤4 ?

- ? fetcher ģû stocks  SELECT Ȩ
- ? fetcher ģӦд stocks ܲѯ
- ? user ģû stocks  SELECT Ȩ
- ? system ģӵ store Ȩ

### ׼ 6:  ACL һԣ2 ?

- ? invalidateCache  stockpool ȷѯ
- ? ͬһƱѯνһ

---

## ܷ

### 6.1 ʱͳ

| ָ | ֵ |
|------|------|
| ܺʱ¼ | 100  |
| 󵥴κʱ | 8ms (QUERY_LIST orders) |
| Сκʱ | 0ms |
| ƽʱ | ~0.5ms |
|  1  | **0** |
|  100ms  | **0** |

### 6.2 ͷֲ

|  | ¼ | ʱ | ƽʱ |
|----------|--------|----------|----------|
| QUERY_GET (stocks) | 42 | 1ms | ~0.5ms |
| QUERY_LIST (stocks) | 3 | 0ms | 0ms |
| QUERY_LIST (v6_scores) | 2 | 1ms | 0.5ms |
| QUERY_LIST (orders) | 1 | 8ms | 8ms |
| QUERY_BY_INDEX (stocks) | 2 | 1ms | 1ms |
| QUERY_BY_INDEX (news_stock_map) | 1 | 0ms | 0ms |
| QUERY_LIST (portfolios) | 1 | 0ms | 0ms |
| INSERT_STOCK (routeToDB) | 25 | 1ms | ~0.3ms |
| INSERT_STOCK (forward) | 25 | 2ms | ~0.5ms |
| UPDATE_STOCK (routeToDB) | 4 | 0ms | 0ms |
| UPDATE_STOCK (forward) | 4 | 1ms | 0.5ms |
|  (QUERY_GET) | 3 | 0ms | 0ms |

### 6.3 

**κκʱ 1 쳣** DataBridge  0-8ms Χɣܱ졣

> **ע**: fetcher  `collectBasic`/`collectKline`/`collectFinancial` ڱβδPython δhealth_check ״̬־Ѿ Python ʱԶ¼ `durationMs` ʱ

---

## ߡԸ

```powershell
# ɲļͬʱУ֤ db 룩
npx vitest run tests/__tests__/integration/mcp-servers.integration.test.ts tests/__tests__/integration/stockpool-acl.integration.test.ts --reporter=verbose

#  MCP Server ɲ
npx vitest run tests/__tests__/integration/mcp-servers.integration.test.ts --reporter=verbose

#  ACL 
npx vitest run tests/__tests__/integration/stockpool-acl.integration.test.ts --reporter=verbose

#  JUnit XMLCI ɣ
npx vitest run tests/__tests__/integration/stockpool-acl.integration.test.ts --reporter=junit --outputFile=docs/reports/test-logs/stockpool-acl-junit.xml
```

---

## ˡ޸ļ嵥

| ļ | ޸ | ˵ |
|------|----------|------|
| `src/services/fetcher/fetcherClient.ts` | ޸ | ȫ collectBasic/collectKline/collectFinancial ־ͺʱ¼ |
| `src/data/db.ts` | ޸ |  V6Database.close()  close()  |
| `src/data/db-migrations.ts` | ޸ | ע rbacMigrationV24  MIGRATIONS 飨Ԥ bug ޸ |
| `tests/__tests__/integration/mcp-servers.integration.test.ts` | ؽ | 33 afterAll  close() |
| `tests/__tests__/integration/stockpool-acl.integration.test.ts` | ؽ | 21 afterAll  close() |

---

## š

1. **CI **:  JUnit XML  CI ˮߣÿ PR Զмɲ
2. **ܻ**: ǰв < 10ms CI ֵ澯 > 100ms Ϊ warning
3. **Python **: fetcher ־Ѿ Python ʱ˵ܲ
4. **RBAC ǨƸ**: rbacMigrationV24 ע޸󣬽鲹 RBAC  schema ֤

---

*ʱ: 2026-07-08 19:32 (Asia/Shanghai)*
*־: [integration-rerun-2026-07-08.txt](./test-logs/integration-rerun-2026-07-08.txt)*
