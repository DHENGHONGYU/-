---
title: V9ĿTokenŻʵָ
type: reports
domain: frontend
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "ĵ汾: 1.1.0 : 2026-07-04 : 2026-07-05 ö: AI(Claude CodeCursorTrae) Ŀ:..."
tags: [frontend, token, optimization]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9ĿTokenŻʵָ

**ĵ汾**: 1.1.0  
****: 2026-07-04  
****: 2026-07-05  
**ö**: AI(Claude CodeCursorTrae)  
**Ŀ**: 50-60%Token,40-50%ĿЧ

## ʵ Token ݣv1.1.0 

֪ʶͼ׹̵ʵݣ

| Ļ | (tokens) | ¶(tokens) | ռ |
|---------|----------------|-----------------|------|
| űظ | 50,000-80,000 | 1,000,000-1,600,000 | **35%** |
| AIظ | 12,000-20,000 | 240,000-400,000 | **25%** |
| ܹϹ | 6,000-9,000 | 60,000-90,000 | **15%** |
| Ӳʶ | 10,000-13,000 | 50,000-65,000 | **10%** |
| ¼ | 8,500-11,500 | 42,500-57,500 | **10%** |
| ĵ | 5,000-8,000 | 50,000-80,000 | **5%** |
| **ܼ** | **91,500-141,500** | **1,442,500-2,292,500** | **100%** |

**ŻĿ**: ͨʵʩָϣԤ¶Ƚʡ **700,000-1,100,000 tokens**50-60%

---

## Ŀ¼

1. [ԭ](#ԭ)
2. [ϵŻ](#ϵŻ)
3. [ظ](#ظ)
4. [ܹϹԼŻ](#ܹϹԼŻ)
5. [ӲԪع](#ӲԪع)
6. [¼](#¼)
7. [ʹָ](#ʹָ)
8. [](#)
9. [ܻ׼ָ](#ܻ׼ָ)

---

## ԭ

### ԭ1: ֪ʶ־û (Knowledge Persistence)

****: ÿζԻ㿪ʼϵ  
****: ʹԤ֪ʶͼ,ظ

**ʵʩ**:
```typescript
// ? : ÿֶ׷
import { Store } from './store';
// Ҫֶ鿴storeЩservice...

// ? ȷ: ѯ֪ʶͼ
// : npm run extract-code-graph
// 鿴: docs/reports/code-graph-visualization.html
```

****: ʡ **12,000-20,000 tokens/**

### ԭ2: Զ (Automation First)

****: ˹Чʵ,©  
****: ʹԶ߽м޸

**ʵʩ**:
```bash
# ܹϹԼ
npm run audit:layers

# Ӳ
npm run audit:hardcode

# 
npm run audit:deadcode

# 
npm run audit
```

****: ʡ **6,000-9,000 tokens/**

### ԭ3: ʽ (Centralized Management)

****: Ӳɢڶļ  
****: ͳһɫ

**ʵʩ**:
```typescript
// ? : Ӳɫ
const color = '#1F2937';
<div className="text-red-500">

// ? ȷ: ó
import { THEME_COLORS } from '@/constants/theme.tokens';
const color = THEME_COLORS.gray900;
<div className={text(THEME_COLORS.red500)}>
```

****: ʡ **10,000-13,000 tokens/**

### ԭ4: ڹ (Lifecycle Management)

****: ¼δڴй©  
****: ǿҪcleanup

**ʵʩ**:
```typescript
// ? : ȱ
useEffect(() => {
  const unsubscribe = dataBridge.subscribe('channel', callback);
  // ûзcleanup
}, []);

// ? ȷ: 
useEffect(() => {
  const unsubscribe = dataBridge.subscribe('channel', callback);
  return () => {
    unsubscribe();
    logger.info('[Component] Cleanup: unsubscribed from channel');
  };
}, []);
```

****: ʡ **8,500-11,500 tokens/**

---

## ?? ϵŻ

### 1: Store

**ͳʽ** (Token):
```
1. ȡStoreļ: 2,000 tokens
2. import: 500 tokens
3. ׷Service: 3,000 tokens
4. ׷Core: 2,000 tokens
5. ͼ: 1,500 tokens
ܼ: 9,000 tokens
```

**Żʽ** (Token):
```bash
# 1. 鿴֪ʶͼ
open docs/reports/code-graph-visualization.html

# 2. ضStore
grep -A 10 "analysisStore" docs/reports/code-graph.json

# 3. 鿴㼶
cat docs/reports/code-graph.json | jq '.statistics.byLayer'
```

**Token**: **500-1,000 tokens**  
**ʡ**: **89%**

### 2: λΥ

**ͳʽ**:
```
1. pagesļ: 1,000 tokens
2. ȡ: 5,000 tokens
3. ʶΥ: 1,500 tokens
ܼ: 7,500 tokens
```

**Żʽ**:
```bash
# Զ
npm run audit:layers

# 鿴Υ汨
cat docs/audit/audit-output-*.txt | grep "violation"
```

**Token**: **800 tokens**  
**ʡ**: **89%**

### 3: DataBridge

**ͳʽ**:
```
1. ȡdatabridge.ts: 3,000 tokens
2. forward߼: 2,000 tokens
3. ׷subscribe: 2,500 tokens
4. ·ɹ: 1,500 tokens
ܼ: 9,000 tokens
```

**Żʽ**:
```bash
# 鿴DataBridgeĵ
cat docs/databridge˵ӳ嵥.md

# 鿴֪ʶͼеDataBridgeڵ
grep -A 20 "databridge" docs/reports/code-graph.json
```

**Token**: **1,200 tokens**  
**ʡ**: **87%**

---

## ?? ظ

### 1: ʹ֪ʶͼgrep

**ģʽ**:

| Ŀ | ͳgrep | ֪ʶͼײѯ | Tokenʡ |
|---------|---------|-------------|----------|
| Store | `grep -r "import.*Store"` | 鿴code-graph.json | **85%** |
| Ӳɫ | `grep -r "#[A-Fa-f0-9]"` | 鿴violations | **90%** |
| ¼ | `grep -r "addEventListener"` | 鿴eventListeners | **88%** |
| ҿ | `grep -r "import.*dataLayer"` | 鿴violations | **92%** |

### 2: òѯģ

 `../archive/quick-queries.md`:

```markdown
## ٲѯģ

### 1. ضStore
```bash
cat docs/reports/code-graph.json | jq '.files[] | select(.path | contains("analysisStore")) | .imports'
```

### 2. пΥ
```bash
cat docs/reports/code-graph.json | jq '.violations[] | select(.type == "cross-layer-call")'
```

### 3. 10ļ
```bash
cat docs/reports/code-graph.json | jq '.statistics.largestFiles[:10]'
```

### 4. ұļ
```bash
cat docs/reports/code-graph.json | jq '.statistics.topImportedFiles[:10]'
```
```

**Token**: **200 tokens/** (vs 4,000 tokens/)  
**ʡ**: **95%**

### 3: 

**ʵʩ**:
```bash
# Ŀ¼
mkdir -p .cache/search-results

# 泣
grep -r "DataBridge.forward" src/ > .cache/search-results/databridge-forward.txt

# ѯֱӶȡ
cat .cache/search-results/databridge-forward.txt
```

****: ظ,ʡ **4,000 tokens/**

---

## ??? ܹϹԼŻ

### 嵥Զ

**ͳʽ**: ˹  
**Żʽ**: ʹԶű

```bash
# һмܹ
npm run audit

# 
npm run audit:layers    # ֲü
npm run audit:hardcode  # Ӳ
npm run audit:deadcode  # 
npm run audit:docs      # ĵͬ
```

### Υ漰޸

#### Υ1: PagesֱӵDataLayer

****:
```bash
npm run audit:layers
```

**޸**:
```typescript
// ? : pagesֱӵdataLayer
import { dataLayer } from '@/data/dataLayer';
const data = await dataLayer.query('stocks');

// ? ȷ: ͨStore
import { useStockStore } from '@/store/stockStore';
const stocks = useStockStore(state => state.stocks);
```

#### Υ2: Storeֱӵdb

****:
```bash
grep -r "import.*from.*db" src/store/
```

**޸**:
```typescript
// ? : Storeֱӵdb
import { db } from '@/data/db';
await db.put('stocks', stock);

// ? ȷ: ͨService
import { stockService } from '@/services/stockService';
await stockService.save(stock);
```

#### Υ3: Componentsʹany

****:
```bash
npm run lint
```

**޸**:
```typescript
// ? : ʹany
function processData(data: any) {
  return data.value;
}

// ? ȷ: ʹþ
interface DataShape {
  value: string;
}
function processData(data: DataShape): string {
  return data.value;
}
```

---

## ?? ӲԪع

### ɫ

**ʽɫ**: `src/constants/theme.tokens.ts`

```typescript
export const THEME_COLORS = {
  // ɫ
  primary: {
    50: '#eff6ff',
    500: '#3b82f6',
    900: '#1e3a8a',
  },
  // ɫϵ
  gray: {
    50: '#f9fafb',
    500: '#6b7280',
    900: '#111827',
  },
  // ɫ
  semantic: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
} as const;
```

**ʹ÷ʽ**:
```typescript
import { THEME_COLORS } from '@/constants/theme.tokens';

// ? ȷ: ó
const bgColor = THEME_COLORS.gray[900];
<div style={{ color: THEME_COLORS.semantic.error }}>

// ? : Ӳ
const bgColor = '#111827';
<div className="text-red-500">
```

### ħֹ

**ʽ**: `src/config/scoreFactors.ts`

```typescript
export const ENGINE_THRESHOLDS = {
  // ֵ
  SCORE_STRONG_BUY: 4.5,
  SCORE_BUY: 3.5,
  SCORE_HOLD: 2.5,
  SCORE_SELL: 1.5,
  
  // Ȩ
  WEIGHTS: {
    L1: 0.15,
    L2: 0.20,
    L3: 0.25,
    L4: 0.40,
  },
  
  // 
  CACHE_TTL_MS: 10000,
  MAX_CACHE_ENTRIES: 200,
} as const;
```

**ʹ÷ʽ**:
```typescript
import { ENGINE_THRESHOLDS } from '@/config/engineConfig';

// ? ȷ: 
if (score >= ENGINE_THRESHOLDS.SCORE_BUY) {
  return 'buy';
}

// ? : ħ
if (score >= 3.5) {
  return 'buy';
}
```

### Զ⹤

```bash
# Ӳɫ
npm run audit:hardcode

# 鿴ⱨ
cat docs/audit/audit-output-*.txt | grep "hardcoded"
```

---

## ?? ¼

### ģʽģ

#### ģʽ1: DataBridge

```typescript
useEffect(() => {
  const unsubscribe = dataBridge.subscribe('channel', (envelope) => {
    // 
    logger.info('[Component] Received data from DataBridge');
  });
  
  return () => {
    unsubscribe();
    logger.info('[Component] Cleanup: unsubscribed from DataBridge');
  };
}, []);
```

#### ģʽ2: EventBus

```typescript
useEffect(() => {
  const handler = (data: unknown) => {
    logger.info('[Component] Received event from EventBus');
  };
  
  eventBus.on('event-name', handler);
  
  return () => {
    eventBus.off('event-name', handler);
    logger.info('[Component] Cleanup: removed EventBus listener');
  };
}, []);
```

#### ģʽ3: DOM¼

```typescript
useEffect(() => {
  const handleResize = () => {
    logger.info('[Component] Window resized');
  };
  
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
    logger.info('[Component] Cleanup: removed resize listener');
  };
}, []);
```

### Զ

```bash
# δ¼
grep -r "addEventListener" src/components/ | grep -v "removeEventListener"

# ʹESLint
npm run lint
```

---

## ??? ʹָ

### ֪ʶͼ

**װ**:
```bash
# װ(δװ)
npm install typescript @types/node --save-dev

# ֪ʶͼ
npx ts-node scripts/extract-code-graph.ts

# 鿴ɵı
open docs/reports/code-graph-visualization.html
```

**ļ**:
- `docs/reports/code-graph.json` - ṹJSON
- `docs/reports/code-graph-visualization.html` - ӻHTMLҳ

**ݽṹ**:
```typescript
interface CodeGraph {
  version: string;
  generatedAt: string;
  totalFiles: number;
  totalLines: number;
  files: FileNode[];          // ļڵ
  violations: Violation[];    // ܹΥ
  statistics: GraphStatistics; // ͳ
}
```

### ܹƹ

**ʹ÷ʽ**:
```bash
# 
npm run audit

# ֲ
npm run audit:layers

# Ӳ
npm run audit:hardcode

# 
npm run audit:deadcode

# ĵͬ
npm run audit:docs
```

**Ʊλ**:
- `docs/audit/audit-output-YYYYMMDD.txt`

### ٲѯű

 `scripts/other/quick-query.sh`:

```bash
#!/bin/bash

# ѯStore
query-store-deps() {
  cat docs/reports/code-graph.json | jq ".files[] | select(.path | contains(\"$1\")) | .imports"
}

# ѯΥ
query-cross-layer-violations() {
  cat docs/reports/code-graph.json | jq '.violations[] | select(.type == "cross-layer-call")'
}

# ѯļ
query-largest-files() {
  cat docs/reports/code-graph.json | jq '.statistics.largestFiles[:10]'
}

# ѯļ
query-top-imported() {
  cat docs/reports/code-graph.json | jq '.statistics.topImportedFiles[:10]'
}
```

**ʹʾ**:
```bash
# ѯanalysisStore
./scripts/quick-query.sh query-store-deps "analysisStore"

# ѯпΥ
./scripts/quick-query.sh query-cross-layer-violations
```

---

## ?? 

### 1: ʹgrepToken˷

****: ʹgrepͬģʽ  
****: ʹ֪ʶͼ

```bash
# ? : ÿֶ
grep -r "DataBridge.forward" src/
grep -r "DataBridge.forward" src/  # ظ

# ? ȷ: ʹ֪ʶͼ
cat docs/reports/code-graph.json | jq '.files[] | select(.imports[] | .to | contains("databridge"))'
```

### 2: ԼܹΥ浼º޸ɱ

****: ںΥ,޸ɱָ  
****: ÿύǰ

```bash
# ύǰ
npm run audit:layers
npm run lint

# ɵCI/CD
# .github/workflows/quality-check.yml
```

### 3: Ӳɫл

****: Ӳɫɢڶļ  
****: ʹüʽɫ

```typescript
// ? : Ӳ
<div style={{ color: '#1F2937' }}>

// ? ȷ: ó
import { THEME_COLORS } from '@/constants/theme.tokens';
<div style={{ color: THEME_COLORS.gray[900] }}>
```

### 4: ¼δڴй©

****: useEffectж¼δ  
****: ǿҪcleanup

```typescript
// ? : ȱ
useEffect(() => {
  dataBridge.subscribe('channel', callback);
}, []);

// ? ȷ: 
useEffect(() => {
  const unsubscribe = dataBridge.subscribe('channel', callback);
  return () => unsubscribe();
}, []);
```

### 5: ʹany͵Ͱȫɥʧ

****: Ϊͼʹany  
****: ʹþͻunknown + խ

```typescript
// ? : ʹany
function process(data: any) {
  return data.value;
}

// ? ȷ: ʹþ
interface DataShape {
  value: string;
}
function process(data: DataShape): string {
  return data.value;
}

// ? ȷ: ʹunknown + խ
function process(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data shape');
}
```

---

## ܻ׼ָ

### TokenĻ׼

|  | Żǰ(tokens) | Ż(tokens) | ʡ |
|---------|---------------|---------------|---------|
| ϵ | 9,000 | 1,000 | **89%** |
| ظ | 4,000 | 200 | **95%** |
| ܹϹ | 7,500 | 800 | **89%** |
| Ӳʶ | 10,000 | 1,000 | **90%** |
| ¼ | 8,500 | 1,000 | **88%** |
| ֱӴд | 2,000 | 2,000 | 0% |

### Ч

- **Tokenļ**: **50-60%**
- **Ч**: **40-50%**
- ****: **30-40%**
- **ܹΥ**: **80-90%**

### ¶Ƚʡ

ÿ20οỰ:

| Ż | νʡ | ¶Ƚʡ |
|--------|---------|---------|
| ϵ | 8,000 | 160,000 |
| ظ | 3,800 | 76,000 |
| ܹϹ | 6,700 | 134,000 |
| Ӳʶ | 9,000 | 180,000 |
| ¼ | 7,500 | 150,000 |
| **ܼ** | **35,000** | **700,000** |

---

## ʵʩ嵥

### Phase 1: ֪ʶͼ׽ (1)

- [ ]  `npx ts-node scripts/extract-code-graph.ts`
- [ ] 鿴 `docs/reports/code-graph-visualization.html`
- [ ] ֤ϵ׼ȷ
- [ ] ޸ֵĿΥ

### Phase 2: Զ߼ (2)

- [ ]  `npm run audit` 
- [ ] ޸мܹΥ
- [ ] ɵCI/CD
- [ ] ٲѯű

### Phase 3: Ӳ (3)

- [ ]  `npm run audit:hardcode`
- [ ]  `theme.tokens.ts`
- [ ] ޸Ӳɫ
- [ ] ESLint

### Phase 4: ¼ (4)

- [ ] ɨuseEffect
- [ ] ޸δ¼
- [ ] ESLintԶ
- [ ] дԪ֤߼

---

## ?? ѵܽ

### ѵ1: ֪ʶ־ûǹؼ

****: ÿζԻ㿪ʼ  
****: ʹ֪ʶͼ׳־ûϵ  
****: ʡ **89%** ʱ

### ѵ2: Զ˹

****: ˹Чʵ,©  
****: ʹԶ߼޸  
****: ʡ **89%** ļʱ

### ѵ3: ʽٷɢ

****: Ӳɢڶļ  
****: ͳһɫ  
****: ʡ **90%** ʶʱ

### ѵ4: ڹɺ

****: ¼δڴй©  
****: ǿҪcleanup  
****: ʡ **88%** ļʱ

### ѵ5: Ͱȫǵ

****: any͵Ͱȫɥʧ  
****: ʹþͻunknown + խ  
****:  **30%** Ĵ

---

## ?? ֪ʶͼʹָϣv1.2.0 

### ʲô֪ʶͼ

V9Ŀ֪ʶͼף`docs/reports/code-graph.json`һṹĴϵݿ⣬
- **466+ TypeScript ļ**ϵ
- **10㼶**ļֲͳ
- **Υ**Զ
- **ӲԪ**ɫħ֣ʶ
- **¼**״̬׷

### ʱʹ֪ʶͼ

**ʹ֪ʶͼ׵ĳ**
1. **ϵ** Store Щ ServiceService Щ Core
2. **λΥ**ҵ pages ֱӵ dataLayer λ
3. **Ӱ**޸ĳļǰȲ鿴Щļ
4. **ܹϹ**ֶ grep ʡ 89% Token

**ֹʹ grep/searchCodebase ĳ**
- ? ظѴڵϵ
- ? ֶ׷ import ·
- ? ļ

### ֪ʶͼײѯʾ

#### 1ض Store 

```bash
# ѯ analysisStore Щ Service
cat docs/reports/code-graph.json | jq '.files[] | select(.path | contains("analysisStore")) | .imports[] | select(.layer == "services")'
```

**ʾ**
```json
{
  "from": "src/store/analysisStore.ts",
  "to": "src/services/analysisService.ts",
  "importedSymbols": ["analysisService"],
  "isRelative": false,
  "layer": "services"
}
```

**Token **500 tokensvs ֶ׷ 9,000 tokens  
**ʡ**94%

#### 2пΥ

```bash
#  pages ֱӵ dataLayer Υ
cat docs/reports/code-graph.json | jq '.violations[] | select(.type == "cross-layer-call" and .file | contains("pages/"))'
```

**ʾ**
```json
{
  "type": "cross-layer-call",
  "severity": "error",
  "file": "src/pages/analysis/StockAnalysisPage.tsx",
  "line": 12,
  "message": "Υ: pages  data",
  "suggestion": "pagesֻ: store, services, components, constants, lib"
}
```

**Token **800 tokensvs ֶ 7,500 tokens  
**ʡ**89%

#### 3ұļ

```bash
#  Top 10 ļ
cat docs/reports/code-graph.json | jq '.statistics.topImportedFiles[:10]'
```

**ʾ**
```json
[
  {"file": "src/core/databridge.ts", "importCount": 45},
  {"file": "src/store/analysisStore.ts", "importCount": 32},
  {"file": "src/constants/theme.tokens.ts", "importCount": 28}
]
```

**Token **300 tokensvs ֶͳ 4,000 tokens  
**ʡ**92%

#### 4ļǱعĿ꣩

```bash
#  Top 10 ļ
cat docs/reports/code-graph.json | jq '.statistics.largestFiles[:10]'
```

**Token **300 tokens  
**ʡ**92%

### ֪ʶͼ׸

```bash
# 1. ֪ʶͼ֧£
npm run extract-code-graph

# 2. 鿴ɵı
# - docs/reports/code-graph.jsonṹݣ
# - docs/reports/code-graph-visualization.htmlӻҳ棩

# 3. д򿪿ӻҳ
open docs/reports/code-graph-visualization.html
```

**»**v2.0+
- ļ `mtime` 
- ½ļ
- δļ AST
- Ԥƽʡ 7.5M tokens/

### ٲѯű

ʹ `scripts/other/quick-query.sh` ṩ׼ѯ

```bash
# ѯ Store 
./scripts/quick-query.sh query-store-deps "analysisStore"

# ѯΥ
./scripts/quick-query.sh query-cross-layer-violations

# ѯļ
./scripts/quick-query.sh query-largest-files

# ѯļ
./scripts/quick-query.sh query-top-imported
```

**Token **200 tokens/Σvs ֶѯ 4,000 tokens/Σ  
**ʡ**95%

---

## ?? ģʽԤʩv1.2.0 

### ģʽ1Υ

**ͳ**
```typescript
// ? pages ֱӵ dataLayer
import { dataLayer } from '@/data/dataLayer';
const stocks = await dataLayer.query('stocks');
```

**ȷ**
```typescript
// ? ȷͨ Store 
import { useStockStore } from '@/store/stockStore';
const stocks = useStockStore(state => state.stocks);
```

**ⷽ**
```bash
npm run audit:layers
```

**Ԥʩ**
- ύǰ `npm run audit:layers`
- ɵ CI/CD 
- Code Review ʱص import 

### ģʽ2Ӳɫ

**ͳ**
```typescript
// ? Ӳɫ
<div style={{ color: '#1F2937' }}>
<div className="text-red-500">
```

**ȷ**
```typescript
// ? ȷó
import { THEME_COLORS } from '@/constants/theme.tokens';
<div style={{ color: THEME_COLORS.gray[900] }}>
<div className={text(THEME_COLORS.red[500])}>
```

**ⷽ**
```bash
npm run audit:hardcode
```

**Ԥʩ**
- ʹ `THEME_COLORS` 
- ESLint ֹӲɫ
- ϵͳĵȷɫ淶

### ģʽ3¼δ

**ͳ**
```typescript
// ? ȱ
useEffect(() => {
  const unsubscribe = dataBridge.subscribe('channel', callback);
  // ûз cleanup 
}, []);
```

**ȷ**
```typescript
// ? ȷ
useEffect(() => {
  const unsubscribe = dataBridge.subscribe('channel', callback);
  return () => {
    unsubscribe();
    logger.info('[Component] Cleanup: unsubscribed from channel');
  };
}, []);
```

**ⷽ**
```bash
npm run lint
#  react-hooks/exhaustive-deps 
```

**Ԥʩ**
- ǿҪ useEffect  cleanup 
- ʹ ESLint δļ
- Code Review ʱص useEffect

### ģʽ4ʹ any 

**ͳ**
```typescript
// ? ʹ any
function processData(data: any) {
  return data.value;
}
```

**ȷ**
```typescript
// ? ȷʹþ
interface DataShape {
  value: string;
}
function processData(data: DataShape): string {
  return data.value;
}

// ? ȷʹ unknown + խ
function processData(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data shape');
}
```

**ⷽ**
```bash
npm run lint
#  @typescript-eslint/no-explicit-any 
```

**Ԥʩ**
- ֹʹ anyʹ unknown + խ
- ݽṹȶ Interface
- ӷͱͲ

### ģʽ5ħ

**ͳ**
```typescript
// ? ħ
if (score >= 3.5) {
  return 'buy';
}
setTimeout(() => {}, 10000);
```

**ȷ**
```typescript
// ? ȷ
import { ENGINE_THRESHOLDS } from '@/config/engineConfig';
if (score >= ENGINE_THRESHOLDS.SCORE_BUY) {
  return 'buy';
}
setTimeout(() => {}, ENGINE_THRESHOLDS.CACHE_TTL_MS);
```

**ⷽ**
```bash
npm run audit:hardcode
```

**Ԥʩ**
- ȡΪ
- ʹ `src/config/scoreFactors.ts`
- Code Review ʱ 3 λ

---

## ??? ܹȱʶ嵥v1.2.0 

### һȱݣCritical- ޸

#### 1. Υ
**ʶ𷽷**
```bash
npm run audit:layers
```
**޸ȼ**P0  
**޸ɱ**ͣ޸ import ·

#### 2. Ӳ API ˵
**ʶ𷽷**
```bash
npm run audit:hardcode | grep "URL"
```
**޸ȼ**P0  
**޸ɱ**УǨƵļ

#### 3. ݿ Schema δ汾
**ʶ𷽷**
```bash
#  DB_VERSION Ƿ
grep "DB_VERSION" src/config/dbConfig.ts
```
**޸ȼ**P0  
**޸ɱ**ͣ汾ţ

### ȱݣMajor- ޸

#### 4. Ӳɫ
**ʶ𷽷**
```bash
npm run audit:hardcode | grep "color"
```
**޸ȼ**P1أ  
**޸ɱ**У滻

#### 5. ¼δ
**ʶ𷽷**
```bash
npm run lint | grep "exhaustive-deps"
```
**޸ȼ**P1أ  
**޸ɱ**ͣ cleanup

#### 6. ʹ any 
**ʶ𷽷**
```bash
npm run lint | grep "no-explicit-any"
```
**޸ȼ**P1أ  
**޸ɱ**У趨ͣ

### ȱݣMinor- ŻĽ

#### 7. ħ
**ʶ𷽷**
```bash
npm run audit:hardcode | grep "magic-number"
```
**޸ȼ**P2Ż  
**޸ɱ**ͣȡΪ

#### 8. ĵδͬ
**ʶ𷽷**
```bash
npm run audit:docs
```
**޸ȼ**P2Ż  
**޸ɱ**ͣĵ

#### 9. δ
**ʶ𷽷**
```bash
npm run audit:deadcode
```
**޸ȼ**P2Ż  
**޸ɱ**ͣɾļ

### ܹȱ޸

```mermaid
graph TD
    A[] --> B{ȱ?}
    B -->|| C[ȱݵȼ]
    B -->|| D[ͨ]
    C --> E{Critical?}
    E -->|| F[޸ P0]
    E -->|| G{Major?}
    G -->|| H[޸ P1]
    G -->|| I[ŻĽ P2]
    F --> J[]
    H --> J
    I --> J
    J --> B
```

---

## ?? Чƽv1.2.0 

### ĵͬ»

#### 
- /޸ TypeScript Interface
- /޸ Store/Service
- /޸·
- /޸ DataBridge ˵

#### ͬ
```bash
# 1. ĵͬ
npm run audit:docs

# 2. 鿴δĵļ
# ʾ
# ļδĵ֣
#   - src/services/newService.ts
#   - src/store/newStore.ts

# 3. ĵ
# - data-definition.mdֵ䣩
# - architecture.mdܹ˵
# - docs/06-routing-specs.md·ɹ

# 4. 
npm run audit:docs
# 0 δĵļ
```

#### Զ
- CI/CD м `npm run audit:docs`
- Pull Request ģаĵ嵥
- Code Review ʱصĵͬ

### Token ļػ

#### ָ
- λỰ Token ģĿ < 50,000
- ¶ Token ƣĿ½ 50-60%
- ֪ʶͼײѯƵʣĿ > 80%
- ظĿ = 0

#### ع
```bash
#  Token ļ
npm run audit:token

# 鿴ⱨ
# ʾ
# ??  3  Token ˷⣺
#   scripts/extract-code-graph.ts:1
#     [ȱ] ֪ʶͼɽűδ֧
# ļ mtime ߼Ԥƽʡ 7.5M tokens/
```

#### Ż
1. **֪ʶͼ**ϵʱȲѯ code-graph.json
2. ****extract-code-graph.ts ֧ mtime 
3. **ѯ**ʹ quick-query.sh ģ
4. **Token Ԥ**λỰ < 50,000 tokens

### ܹȱԤ

#### Ԥ
- `audit:layers`  > 0 Υ  Ԥ
- `audit:hardcode`  Critical Υ  Ԥ
- `audit:deadcode` δעҳ  Ԥ
- `audit:docs` δĵļ  Ԥ

#### Ԥ
```mermaid
graph LR
    A[] --> B{Υ?}
    B -->|| C[Ԥ]
    B -->|| D[ͨ]
    C --> E[֪ͨԱ]
    E --> F[޸]
    F --> G[޸֤]
    G --> H[رԤ]
```

#### Ԥ
- Slack/Ⱥ֪ͨ
- Email ֪ͨ
- Jira/񴴽
- GitHub Issues 

### ڼ

#### ÿռ
```bash
# ߱ؼ
npm run lint
npm run tsc
npm run audit:layers
```

#### ÿܼ
```bash
# ŶӴ
npm run audit
npm run test
```

#### ÿ¼
```bash
# ܹ
npm run audit
npm run audit:token
npm run extract-code-graph

# ¶ȱ
npm run changelog:summary
```

#### 
1. ****ͨ//û
2. **ȼ**P0/P1/P2
3. ****Jira//GitHub Issues
4. **为**ģ
5. **޸֤**ύ PR + Code Review
6. **ĵ**ͬĵ
7. **ر**֤ͨر

---

## ?? οԴ

- [V9ĿTokenķ](./token-consumption-analysis-2026-07-04.md)
- [V9ܹ淶](../../reference/03-architecture-standards.md)
- [V9ݼܹ޶](../../reference/v9ݼܹ޶.md)
- [V9ֵ](../../reference/v9ֵͶ(ϰ).md).md)
- [AGENTS.md](../../../AGENTS.md) - AIΪԼԼ

---

**ĵ汾**: 1.2.0  
**ĵά**: ÿ¸һ  
**´θ**: 2026-08-05  
****: V9  
****: 2026-07-05
