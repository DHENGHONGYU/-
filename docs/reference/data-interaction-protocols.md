---
title: 
type: reference
domain: data
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "research_logs store  DataBridge "
tags: [contract, api, reference, data, data-definition, store]
version: v0.9.0
last_updated: 2026-06-25
code_version: 2.0.0
doc_id: V9-DOC-DATA-020
related_docs: [V9-DOC-META-000, V9-DOC-DATA-007, V9-DOC-DATA-019, V9-DOC-PROJ-193, V9-DOC-PROJ-174, V9-DOC-PROJ-164]
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-DATA-007, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-DATA-019, V9-DOC-PROJ-182, V9-DOC-PROJ-193, docs/00-meta/deprecated-docs/old-versions/registry-index-v1.0.0-02-design.md, V9-DOC-PROJ-149]
change_log: 
---

# 

> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-25
>
>  V9   
> 

---

## 1. 

-  `DataBridge.forward(StandardEnvelope)`??
- L5/L4  `dataLayer`  Service
- traceId
- 

---

## 2. 

```ts
interface StandardEnvelope {
  meta: {
    source: ModuleId;        // / 'input-cabin'
    target: EnvelopeTarget;  // 'indexeddb' / 'event-bus' / 'engine'
    action: EnvelopeAction;  //  dbConfig.ts
    traceId: string;         //  ID
    timestamp: number;       // 
    dataVersion: number;     // 
  };
  payload: unknown;
}
```

---

## 3. 

|  ?? /  ?? | L5  | L4  | L3  | L2  | L1  |
|------------------------|---------|---------|---------|---------|-------------|
| L5  | ?  | ? | ? | ?  | lib/config/core  |
| L4  | ? | ?  | ? | ?  | ? |
| L3  | ? | ? | ?  | ? ?? dataLayer / ?? DataBridge | ? |
| L2  | ? | ? | ? | ?  | config/dbConfig  |
| L1  | ? | ? | ? | ? | ?  |

---

## 4. 

```
L5/L4 ??  DataBridge.forward()  ACL  IndexedDB
L5/L4 ??  Service / dataLayer  IndexedDB Service??
L3   dataLayer
L3   DataBridge.forward()
L2   db.ts IndexedDB 
```

---

## 5. 

### 5.1 

- `{domain}:{event}` `stocks:changed`, `scores:changed`, `orders:changed`??
- `{cabin}:{event}` `input:poolChanged`, `input:importProgress`??
-  UI  `src/lib/eventBus.ts`??

### 5.2 

- 
-  Service ?? DataBridge??

---

## 6. 

### 6.1 

- `stocks.dataVersion`
- `v6_scores.algorithmVersion`
- `v6_scores.calculatedAt`
- `orders.signalId` ID `Order` /

### 6.2 

`research_logs` store  DataBridge 

```ts
interface ResearchLog {
  id?: number;
  traceId: string;
  source: ModuleId;
  action: EnvelopeAction;
  timestamp: number;
  payloadSummary: string;
}
```

---

## 7. 

### 7.1  action

- `INSERT_STOCK`
- `BULK_IMPORT` `INSERT_STOCK`
- `UPDATE_STOCK`
- `SAVE_DAILY_QUOTES`/K

### 7.2 

|  |  |  |
|------|------|--------|
| `input:poolChanged` | stocks  | `InputDashboard`, `PoolBoard` |
| `input:fetcherStatusChanged` |  | `DataTestPanel`,  |
| `input:importProgress` |  | `BulkImportPanel` |

### 7.3 

/ `Stock.dataQuality`??

```ts
interface StockDataQuality {
  basic: boolean;
  kline: boolean;
  finance: boolean;
  lastChecked?: number;
}
```

---

## 8. 

-  IndexedDB??
-  LLM/
- AKShare 

---

## 9. 

|  |  |  |
|------|------|------|
| v0.9.0-docs-base | 2026-06-24 ?? |  `03-architecture-standards.md`  |
| v0.9.0-docs-review | 2026-06-24 |  action// |

## 

 V9 

- [](../00-meta/../explanation/design/registry-index.md)
- [V9 ](../explanation/design/data-flow-spec.md)
- [V9 ](data-flow-spec.md)
- [V9 Data Constitution?](V9.md)
- [](../explanation/design/../explanation/design/registry-index.md)
- [V9 ](../explanation/design/00-readme.md)

