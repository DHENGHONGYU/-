---
title: data-collection-route-ui-audit
type: explanation
domain: data
phase: design
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "V9·עUI嵥FV6ĵάУ Versionv1.0 | ڣ2026-07-01"
tags: [data, collection, audit, plan, architecture, component, explanation, routing]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-034
related_docs: [V9-DOC-FRONT-004]
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ݲɼģ·UIУԷ

> V9·עUI嵥FV6ĵάУ
> 
> **Version**v1.0 | ڣ2026-07-01

---

## һ·ӳУ

### 1.1 V9·ע vs V6·ɼܹ

| V6· | V6ҳ | V9Ӧ· | V9ҳ | УԽ |
|:---|:---|:---|:---|:---:|
| `/data-hub` | ݹ4 Tab | `/input` | `InputDashboard` | ??  |
| `/seven-dim` | άɼ | `/input/seven-dim` | `SevenDimConfigPage` | ? ½ |
| `/fetcher` | ץȡ |  |  | ? ȱʧ |
| `/collect-task` | ɼ |  |  | ? ȱʧ |
| `/news` | Ѷ | `/analysis/news` | `NewsPage` | ?? λǨ |
| `/data` | ݹ |  |  | ? ȱʧ |
|  |  | `/input/bulk-import` | `BulkImportPanel` | ? V9 |
|  |  | `/input/hot-sectors` | `HotSectorPanel` | ? V9 |
|  |  | `/input/data-test` | `DataTestPanel` | ? V9 |
|  |  | `/input/local-knowledge` | `LocalKnowledgePage` | ? V9 |

### 1.2 ·עϹ

| ȼ |  | Ӱ |  |
|:---:|:---|:---|:---|
| **** | `/input/seven-dim` δ `ROUTE_REGISTRY` ע | ·ɱܿأΥ"ҵ·ɱڴע" | ? ޸2026-07-01 |
| **** | `ResearchReportPage.tsx` / `TradeReviewPage.tsx` Ϊȫ¶ | ʵֵҳ޷ | ? ޸2026-07-01 |
| **** | `../../reference/06-routing-specs.md` 8ڲ `/hub`  `/analysis/news-v6` | ĵ벻һ | ͬĵӳ |
| **** | ĵ汾ìܣv1.5.0 vs v1.2.0 / 29 vs 31 | ĵŶȽ | 汾·ɼ |
| **** | ĵ7"ErrorBoundary·"ͺ | `RouteErrorBoundary` ʵֵĵδ | ĵעѱջ |
| **** | `OutputApp` δʽ `<React.Suspense>` | Suspense߽粻ȷ | ʽ |

### 1.3 V6ݹ4 Tab  V9Ǩ״̬

V6ݹ `/data-hub` 4TabV9Ǩ

| V6 Tab |  | V9Ӧ | Ǩ״̬ |
|:---|:---|:---|:---:|
| ģ | 6ģڿƬ | `InputHubPage`6Ƭ | ? Ǩ |
| ݿ | 8άݿƬ |  | ? ȱʧ |
| ά״̬ | ʵʱɼ״̬ |  | ? ȱʧ |
| ݵ | JSON/CSV | `/output/export` | ?? Ǩ |

---

## UIУ

### 2.1 V6ɼģUI  V9

| V6 | V6 | V9Ӧ | УԽ |
|:---|:---|:---|:---:|
| `SevenDimCollectPage` | άɼҳ~400У | `SevenDimConfigPage` | ? ½ܣ |
| `CollectParamPanel` | ɼ | SevenDimConfigPageǶ | ?? 򻯰 |
| `CollectMonitor` | ɼؽ棨7ά״̬ |  | ? ȱʧ |
| `CollectTaskPage` | ɼҳ3Tab//־ |  | ? ȱʧ |
| `FetcherPage` | ץȡҳԴб/־ |  | ? ȱʧ |
| `DataHubPage` | ݹ4Tabܹ | `InputHubPage` + `InputDashboard` | ?? Ǩ |
| `NewsPage`(V6) | Ѷҳ | `NewsPage`(V9, `/analysis/news`) | ?? λǨ |
| `DirectDataAPI` | ǰֱѶ// | `fetcherClient` | ?? AKShare |
| ӿڲԵ | 5ӿһ | `DataTestPanel` | ? ʵ֣򻯰棩 |

### 2.2 V9вɼUI嵥Ϲ

|  | ļ | ErrorBoundary | ĲԼ | //̬ | ۺ |
|:---|:---|:---:|:---:|:---:|:---:|
| `InputHubPage` | [InputHubPage.tsx](file:///C:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/pages/input/InputHubPage.tsx) | ? |  | ޣ̬ҳ | ??  |
| `SevenDimConfigPage` | [SevenDimConfigPage.tsx](../../../src/pages/input/SevenDimConfigPage.tsx) | ? |  | ȫ | ??  |
| `LocalKnowledgePage` | [LocalKnowledgePage.tsx](../../../src/pages/input/LocalKnowledgePage.tsx) | ? |  | ȫ | ?? 貹EB |
| `InputDashboard` | [InputDashboard.tsx](../../../src/apps/input/InputDashboard.tsx) | ? | **Υ** | м/ | ?? DF-002 |
| `DataTestPanel` | [DataTestPanel.tsx](../../../src/apps/input/DataTestPanel.tsx) | ? |  | ȫ | ?? 貹EB |
| `HotSectorPanel` | [HotSectorPanel.tsx](../../../src/apps/input/HotSectorPanel.tsx) | ? | **Υ** | м/ | ?? DF-002 |
| `BulkImportPanel` | [BulkImportPanel.tsx](../../../src/apps/input/BulkImportPanel.tsx) | ? | **Υ** | м/ | ?? DF-002 |
| `StockSearch` | [StockSearch.tsx](../../../src/components/organisms/input/StockSearch.tsx) | ? | **Υ** | м/̬ | ?? DF-002 |

### 2.3 ȱʧUI½

| ȼ |  | V6ο |  | · |
|:---:|:---|:---|:---|:---|
| P0 | `CollectTaskPage` | V6 CollectTaskPage | ɼб/ֿƬ/ɼ־ 3Tab | `/input/collect-task` |
| P0 | `CollectMonitor` | V6 CollectMonitor | 7ά״̬+ͳ+䶯ʼ+ʵʱ־ | `/input/collect-monitor` |
| P1 | `FetcherConfigPage` | V6 FetcherPage | Դб++ɼ־+Զϴ | `/input/fetcher` |
| P1 | `DataDashboard` | V6 ݿTab | 8άݿƬ+ | `/input/dashboard`ǿ |
| P2 | `CollectParamPanel` | V6 CollectParamPanel | ԤǱ+Kimiײ+8άƵʱ | ǶSevenDimConfigPage |

---

## SevenDimConfigPage V6V9 UI

### 3.1 ҳ沼ֶԱ

| UI | V6 | V9ʵ |  |
|:---|:---|:---|:---|
| ҳͷ | +h1++鿴 | м+h1++V9 | ?? ȱ"鿴ɼ" |
| ģ忨Ƭ | 5Ƭ////죩 | 5Ƭޱ߿ɫ | ?? ȱɫʶ |
| άѡ | 7άȿأȫ/ǩ | 8άȿأɫ+Badge+ֶαǩ | ? V9ḻ |
| Ҳ | ĿƱ+ʷ+Դ+Ԥ+ʼɼ | +ʷ򻯰棩 | ?? ȱĿƱ롢Ԥ |
| ɼ | µ3Ƭ+Ƚ+Kimiײ+Ƶʱ+ | ԤƬµ++AKShare+ʹʣ | ?? ȱKimiײ͡Ƶʱ |
| ɼ | Ĳܹͼ+άȽӿӳ+Ƶʱ+ӿڲ+ʼɼ |  | ? ȫȱʧ |
| ӿڲԵ | 5ӿһ+ԴԱ+ |  | ? ȫȱʧ |

### 3.2 

| ģ | V6 | V9ʵֶ |  |
|:---|:---:|:---:|:---:|
| ģѡ | 100% | 90% | 10% |
| άȿ | 100% | 95% | 5% |
|  | 100% | 40% | 60% |
| Ԥ | 100% | 50% | 50% |
| ɼ | 100% | 0% | 100% |
| ӿڲ | 100% | 0% | 100% |
| Ĳ㽵չʾ | 100% | 0% | 100% |
| **Ȩƽ** | **100%** | **~40%** | **~60%** |

---

## ġģУ

### 4.1 V6V9Ǩ

| V6ģ | V9Ǩ״̬ | ˵ |
|:---|:---:|:---|
| Ʊع4/32ֻ/뵼 | ?? 60% | PoolBoard+StockSearchȱǿ |
| άɼ5ģ/7ά/ã | ?? 40% | SevenDimConfigPageܣȱɼ |
| ɼ񣨽ȼ/ֿƬ/־ | ?? 0% | ȫȱʧ |
| Ѷ/б/з | ?? 20% | newsService棬 |
| ץȡ棨Դ//ϴ | ?? 30% | fetcherService+fetcherClientȱUI |
| ش洢7άJSON/ݿ/ | ?? 40% | IndexedDBʵ֣ȱݿ |
| ˮ߿ӻ7ڵ㣩 | ?? 0% | ȫȱʧ |
| ݵJSON/CSV/άɸѡ | ?? 50% | OutputAppе |
| ӿڲԣ5ӿһԣ | ?? 30% | DataTestPanel򻯰 |
| ĲԴѶAKShareKimiMock | ?? 10% | AKShare+MockProvider |

### 4.2 V6ݹ6ģ  V9ӳ

| V6ģ | V6 | V9 | V9 | ӳ״̬ |
|:---|:---|:---|:---|:---:|
| Ʊع | `/data-hub`ģ | `/input` | `InputDashboard` | ? ӳ |
| άɼ | `/seven-dim` | `/input/seven-dim` | `SevenDimConfigPage` | ? ӳ |
| ɼ | `/collect-task` |  |  | ? ȱʧ |
| Ѷ | `/news` | `/analysis/news` | `NewsPage` | ?? Ǩ |
| ץȡ | `/fetcher` |  |  | ? ȱʧ |
| ش洢 | `/data-hub`ݿ |  |  | ? ȱʧ |

---

## 塢ܹ

### 5.1 ·ɲ

```
1/input/seven-dim δ ROUTE_REGISTRY ע ? ޸2026-07-01
   Ӱ죺·ɱܿأisPathWhitelisted() ·
   գⲿתУܾܾURL
   ޸routes.ts  { path: '/input/seven-dim', component: PortalShell, ... }  

2ResearchReportPage.tsx / TradeReviewPage.tsx ȫ¶ ? ޸2026-07-01
   Ӱ죺ʵֵҳ޷ͨ·ɷ
   ״OutputApp  PlaceholderPanel ռλ
   ޸滻 PlaceholderPanel  lazy import ʵҳ  

3docs/06-routing-specs.md 벻һ
   8ڲ /hub ·Ƴ
   8ڲ /analysis/news-v6ɾ
   8ȱʧ14ע·
   9ڰ汾ìܣv1.5.0 vs v1.2.0
   7 ErrorBoundary ͺʵ RouteErrorBoundary
```

### 5.2 UI

```
44ΥĲԼDF-002 Υ棩
   InputDashboardֱӵ inputService/stockpoolService
   HotSectorPanelֱӵ hotSectorService
   BulkImportPanelֱӵ batchImportService
   StockSearchֱӵ inputService
   ķ򣺲װ Store action

55ȱErrorBoundary
   LocalKnowledgePage
   InputDashboard
   DataTestPanel
   HotSectorPanel
   BulkImportPanel
   ķ򣺲 InputApp ģʽ ErrorBoundary

6AnalysisApp/TradingApp/OutputApp/CommandApp ڲ޶ ErrorBoundary
    InputApp  <ErrorBoundary> ·
   4 RouteErrorBoundary 
   ķͳһ ErrorBoundary
```

### 5.3 ȱʧ

```
74UIȫȱʧ
   CollectTaskPageɼأ
   CollectMonitorɼʵʱأ
   FetcherConfigPageץȡã
   DataDashboard8άݿ壩

8SevenDimConfigPage ܲ
   ȱɼ壨Ĳܹͼ/άȽӿӳ/Ƶʱ
   ȱӿڲԵ
   ȱKimi Workײѡ
   ȱ8άƵʱ
   ȱչʾ
   ȱĿƱ

9ˮ߿ӻȫȱʧ
   V67ڵˮ++״ָ̬ʾV9δʼ
```

---

## Ż

### 6.1 ʱ޸P0 - ·ɺϹ棩

|  |  | ļ | Ӷ |
|:---:|:---|:---|:---:|
| F-01 | `/input/seven-dim` עᵽ `ROUTE_REGISTRY` | [routes.ts](../../../src/config/routes.ts) | ?  |
| F-02 | 滻 OutputApp  PlaceholderPanel  ʵҳ | [OutputApp.tsx](../../../src/apps/output/OutputApp.tsx) | ?  |
| F-03 | ͬ docs/06-routing-specs.md ·ɱ | [06-routing-specs.md](06-routing-specs.md) |  |

### 6.2 ŻP1 - UIϹ棩

|  |  | Ӱļ | Ӷ |
|:---:|:---|:---|:---:|
| F-04 | 4 ErrorBoundary | LocalKnowledgePage/DataTestPanel/HotSectorPanel/BulkImportPanel |  |
| F-05 | 4CabinAppڲErrorBoundary | AnalysisApp/TradingApp/OutputApp/CommandApp |  |
| F-06 | DF-002ģInputDashboardװStore | InputDashboard.tsx + inputHubStore.ts |  |
| F-07 | DF-002ģHotSectorPanelװStore | HotSectorPanel.tsx + poolStore.ts |  |
| F-08 | DF-002ģBulkImportPanelװStore | BulkImportPanel.tsx + poolStore.ts |  |

### 6.3 ڽ裨P2 - ȱʧ

|  |  | ½ļ | Ӷ |
|:---:|:---|:---|:---:|
| F-09 | ½ CollectTaskPageɼ3Tab | `src/pages/input/CollectTask/index.tsx` |  |
| F-10 | ½ CollectMonitorʵʱɼأ | `src/pages/input/CollectTask/index.tsx` |  |
| F-11 | ½ FetcherConfigPageץȡã | `src/pages/input/FetcherConfigPage.tsx` |  |
| F-12 | SevenDimConfigPage ȫɼ | SevenDimConfigPage.tsx |  |
| F-13 | ½ DataDashboard8άݿ壩 | `src/apps/input/InputDashboard.tsx` |  |
| F-14 | ½ˮ߿ӻ | `src/core/pipelineScheduler.ts` |  |

### 6.4 ݽP3 - V6룩

|  |  | ˵ |
|:---:|:---|:---|
| F-15 | ĲԴ | ѶAKShareKimiMock Զ |
| F-16 | ӿڲԵ5ӿһԣ | V6 DirectDataAPI |
| F-17 | Kimi WorkײѡUI | Andante/Allegretto/Presto |
| F-18 | 8άȵƵʱ | 8άȡƵʡԴ |
| F-19 |  | /Сʱ/ |

---

## ߡУԽ

### 7.1 彡

| ά |  | ˵ |
|:---|:---:|:---|
| ·עϹ | 70% | ȫ޸2026-07-01 |
| UIϹ | 55% | 4DF-002Υ + 5ȱErrorBoundary |
| V6Ǩ | 35% | 6ģ2Ǩƣ4ȱʧ |
| SevenDimConfigPage | 40% | ѽɼȱʧ |
| ɼʵ | 12% | 8άȽ2пܣ0ʵ |

### 7.2 ҪһŻĺ

> **ҪŻ**

1. **·עϹ滯**P0ʱ
   - `/input/seven-dim` עᵽ `ROUTE_REGISTRY`
   - ¶ҳ `ResearchReportPage` / `TradeReviewPage` · ? 
   - ·ĵͬ

2. **ȱʧUI**P2ڣ
   - ½ `CollectTaskPage`ɼأ
   - ½ `CollectMonitor`ʵʱɼأ
   - ȫ `SevenDimConfigPage` Ĳɼ

3. **ĲԼϹ滯**P1ڣ
   - 4DF-002ΥģװStore action
   - 5ErrorBoundary
   - 4CabinAppڲErrorBoundary

### 7.3 V6V9ܹǨƳ

```
V6ݲɼܹ
   ݹ  ? ǨƣInputHubPage
   άɼ  ?? ѽ40%
   ɼ  ? ȫȱʧ
   ץȡ  ? ȫȱʧ
   Ѷ  ?? Ǩգ20%
   ݿ  ? ȫȱʧ
   ˮ  ? ȫȱʧ
   ĲԴ  ?? 1/4㣨10%
   ӿڲ  ?? 򻯰棨30%

ǨƳȣԼ 30%
```
