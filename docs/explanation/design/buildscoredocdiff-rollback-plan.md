---
title: buildScoreDocDiff ޸  عԤ
type: explanation
domain: backend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "汾: v1.0 | : 2026-07-04 : Bug ޸ +  Ӱ췶Χ: ձȶԹģ յȼ: ?? (޸ 1 ļ,3 ,漰ַ)..."
tags: [backend, scoring, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-BACK-037
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# buildScoreDocDiff ޸  عԤ

> **汾**: v1.0 | ****: 2026-07-04
> ****: Bug ޸ + 
> **Ӱ췶Χ**: ձȶԹģ
> **յȼ**: ?? (޸ 1 ļ,3 ,漰ַ)
> **عԤʱ**: ع  5  / ֻع  3 

---

## һ

### 1.1 ļ嵥

| ļ· |  |  | յȼ |
|----------|------|----------|----------|
| [src/services/analysis/scoreDocService.ts](../../../src/services/analysis/scoreDocService.ts) | ޸ | +75 / -1 | ??  |

### 1.2 

޸İ 3 , `src/services/analysis/scoreDocService.ts`:

####  1: DEFAULT_THRESHOLDS ( 11 )

```typescript
// 
import { DEFAULT_THRESHOLDS } from '@/services/scoring/v6-engine/config'
```

**Ŀ**: Ϊ 3(滻Ӳ)ṩá

####  2: ScoreDocDiff ӿ buildScoreDocDiff ( 111-184 )

```typescript
/** ĵṹ(ʷ汾Ա) */
export interface ScoreDocDiff {
  newerVersion: number
  olderVersion: number
  compositeDelta: number
  l3vDelta: number
  layerChanges: Array<{
    code: string
    oldScore: number
    newScore: number
    delta: number
  }>
  addedLayers: string[]
  removedLayers: string[]
  ratingChanged: boolean
  oldRating: string
  newRating: string
}

export function buildScoreDocDiff(newer: ScoreDocVersion, older: ScoreDocVersion): ScoreDocDiff {
  // ... ʵ
}
```

**Ŀ**: ޸ `ScoreHistoryPanel.tsx`  `src/services/analysis/__tests__/scoreDocService.test.ts` жԲڵ `buildScoreDocDiff` ô

####  3:滻Ӳ( 305 ,ԭ 229 )

```typescript
// ޸ǰ
const coreStocks = all.filter((d) => d.composite >= 4.0).length

// ޸
const coreStocks = all.filter((d) => d.composite >= DEFAULT_THRESHOLDS.rating.strongBuy).length
```

**Ŀ**: Ӳ, AGENTS.md ڡӲ롹Լ,ʹĹƱֵ `DEFAULT_THRESHOLDS.rating.strongBuy` ͬ

### 1.3 Ӱ

| Ӱ | ˵ |
|--------|------|
| **ֱӵ÷** | `ScoreHistoryPanel.tsx`(UI )`scoreDocService.test.ts`(Ԫ) |
| **Ӱ** | ʷ汾Աû(޷Ⱦ  Ⱦ) |
| **ݼ** | ? ȫ(δ޸ݽṹ,) |
| **API ** | ? ȫ(,δɾ޸е) |
| **ü** | ? ȫ(Ѵڵ `DEFAULT_THRESHOLDS` ) |

---

## ǰ֤

### 2.1 ֤嵥

| ֤ |  |  | ˵ |
|--------|------|------|------|
| ͼ | `npx tsc --noEmit` | ? | `scoreDocService.ts`  `ScoreHistoryPanel.tsx` ʹ |
| ESLint | `npx eslint src/services/analysis/scoreDocService.ts` | ? | 0 errors,19 warnings(ΪԤ) |
| Ԫ | `npx vitest run src/services/analysis/__tests__/scoreDocService.test.ts` | ? | 4/4 ͨ(buildScoreDocDiff) |
| в | `npx vitest run walkthroughScoreDoc` | ? | 43/43 ͨ(2.49s) |
| ܹ | `npm run audit:layers` | ? | 0 violations,1 warning(Ԥڵ SectorAnalysisPage ) |
|  | `npx vite build` | ?? | ʧ(Ԥڵ `trade.constants` ,뱾޸޹) |

### 2.2 Ԥ˵

ʧܵԭ `src/services/trading/tradeErrorClassifier.ts`  `trade.constants.ts` вڵ `PERCENTAGE_BASE``MAX_SCORE``MIN_SCORE` 뱾 `buildScoreDocDiff` ޸**ȫ޹**,ڶ P0 ,ڱλعΧڡ

---

## ع

### 3.1 ع(һ㼴)

| # |  | ⷽʽ | ض |
|---|------|----------|--------|
| 1 | `ScoreHistoryPanel.tsx` Ⱦ | û /  | ??  |
| 2 | `buildScoreDocDiff` ش( delta ) | Ԫʧ / û | ??  |
| 3 | `getFileLibraryStats` ش coreStocks ͳ | û / У | ??  |
| 4 | ͼ´ | `npx tsc --noEmit` | ??  |
| 5 | вʧ | `npx vitest run walkthroughScoreDoc` | ??  |

### 3.2 ѡع

| # |  | ⷽʽ | ض |
|---|------|----------|--------|
| 6 | ܻ(buildScoreDocDiff ִʱ > 100ms) | ܼ | ??  |
| 7 | ESLint  warnings | `npm run lint` | ??  |

---

## ġع

### 4.1 ع(Ƽ:ȫ 3 )

**ó**:  1+2+3 ع( buildScoreDocDiff ߼)

**Ԥʱ**:  5 

****:

```powershell
#  1:ĿĿ¼
cd C:\Users\huawei\Documents\kimi\Workspaces\ͶиϵͳV9

#  2:鿴 git ״̬,ȷ޸ļ
git status src/services/analysis/scoreDocService.ts

#  3:鿴
git diff src/services/analysis/scoreDocService.ts

#  4:ع޸ǰ汾(޸ǰύ)
# ʽ A:޸δύ,ʹ checkout
git checkout HEAD -- src/services/analysis/scoreDocService.ts

# ʽ B:޸ύ,ʹ revert
git revert <commit-hash> --no-edit

#  5:֤ع
npx tsc --noEmit 2>&1 | Select-String "scoreDocService"
# Ԥ:( ScoreHistoryPanel.tsx ±,ǻعԤ״̬)

#  6:ȷ ScoreHistoryPanel.tsx ±(ԤΪ)
npx tsc --noEmit 2>&1 | Select-String "ScoreHistoryPanel"
# Ԥ:ʾ buildScoreDocDiff ڵĴ

#  7:()
# Ctrl+C ֹͣ vite dev,Ȼ
npm run dev
```

### 4.2 ֻع A:ع 3(Ӳ滻)

**ó**: `DEFAULT_THRESHOLDS.rating.strongBuy` õ, `buildScoreDocDiff` 

**Ԥʱ**:  2 

****:

```typescript
// ༭ src/services/analysis/scoreDocService.ts  305 
// :
const coreStocks = all.filter((d) => d.composite >= DEFAULT_THRESHOLDS.rating.strongBuy).length
// Ļ:
const coreStocks = all.filter((d) => d.composite >= 4.0).length
```

**֤**:

```powershell
npx vitest run walkthroughScoreDoc --reporter=default
# Ԥ:43/43 ͨ( 4.6 Ӳͨ,Ϊ 4.0 === DEFAULT_THRESHOLDS.rating.strongBuy)
```

### 4.3 ֻع B:ع 2(buildScoreDocDiff )

**ó**: `buildScoreDocDiff` , P1 Ӳ޸

**Ԥʱ**:  3 

****:

```typescript
// ༭ src/services/analysis/scoreDocService.ts
// ɾ 111-184 е ScoreDocDiff ӿ buildScoreDocDiff 
//  11 е DEFAULT_THRESHOLDS 
//  305 е DEFAULT_THRESHOLDS.rating.strongBuy 
```

**ע**: ˻عᵼ `ScoreHistoryPanel.tsx`  `scoreDocService.test.ts` ±Ҫͬʱעͻعļ:

```powershell
# ʱע ScoreHistoryPanel.tsx е buildScoreDocDiff 
# ʱ scoreDocService.test.ts е buildScoreDocDiff 
```

### 4.4 ع(޸)

**ó**: ,Ҫع

**Ԥʱ**:  1 

****:

```powershell
#  1:ֹͣ
# (ʵʲʽִ)

#  2:ع
git checkout HEAD~1 -- src/services/analysis/scoreDocService.ts

#  3:¹()
npm run build

#  4:
# (ʵʲʽִ)

#  5:֪ͨԱ
# ֪ͨŶӡƷά
```

---

## 塢ع֤嵥

### 5.1 ع֤

| # | ֤ |  | Ԥڽ |
|---|--------|------|----------|
| 1 | ļ״̬ | `git status src/services/analysis/scoreDocService.ts` | ޸ |
| 2 | ͼ | `npx tsc --noEmit 2>&1 \| Select-String "scoreDocService"` | (scoreDocService.ts ޴) |
| 3 | ScoreHistoryPanel  | `npx tsc --noEmit 2>&1 \| Select-String "ScoreHistoryPanel"` | ʾ buildScoreDocDiff (Ԥ) |
| 4 | в | `npx vitest run walkthroughScoreDoc` | ʧ(Ԥ,ļ buildScoreDocDiff) |
| 5 | Ԫ | `npx vitest run src/services/analysis/__tests__/scoreDocService.test.ts` | ʧ(Ԥ, buildScoreDocDiff) |

### 5.2 ֻع֤

ݻع A/B,ִжӦ֤:

- ** A(عӲ)**: в 43/43 ͨ
- ** B(ع buildScoreDocDiff)**: ͬʱع ScoreHistoryPanel.tsx ļ

---

## 

```
쳣
    
      ScoreHistoryPanel Ⱦ?
          ع(4.1)
          
    
      buildScoreDocDiff ش?
          ع(4.1)򲿷ֻع B(4.3)
          
    
      getFileLibraryStats  coreStocks ͳƴ?
          ֻع A(4.2)
          
    
     ͼ´?
          ع(4.1)
          
    
     Ǵвʧ?
          ع(4.1)
          
    
       ع
```

---

## ߡ

### 7.1 վ

|  |  | Ӱ | յȼ | ʩ |
|--------|------|------|----------|----------|
| `buildScoreDocDiff` ߼ |  |  | ??  | 4 Ԫ + 4 в |
| `DEFAULT_THRESHOLDS.rating.strongBuy` ֵ޸ĵ coreStocks ͳƫ |  |  | ??  | ֵ config.ts ѹ̶Ϊ 4.0 |
| 뵼ѭ |  |  | ??  | ܹͨ(services ͬ) |
| `ScoreHistoryPanel.tsx` Ⱦ쳣 |  |  | ??  | ͼͨ,ȷ |
| ع `ScoreHistoryPanel.tsx` ± | 100% |  | ??  | عԤ˵(ԤΪ) |

### 7.2 ع

|  |  | Ӱ | ʩ |
|--------|------|------|----------|
| ع `ScoreHistoryPanel.tsx` ± | 100% |  | ͬʱعע͸ |
| ع `scoreDocService.test.ts` ʧ | 100% |  | ͬʱعò |
| عɾ޸ |  |  | ʹ `git checkout <file>`  `git reset --hard` |

---

## ˡ鸽¼

### 8.1  diff(ο)

```diff
--- a/src/services/analysis/scoreDocService.ts
+++ b/src/services/analysis/scoreDocService.ts
@@ -8,6 +8,7 @@
 import { dataLayer } from '@/data/dataLayer'
 import type { DataLayerResult, FileLibraryStats, ScoreDocVersion, V6LayerScore } from '@/data/types'
 import { getLogger } from '@/lib/logger'
+import { DEFAULT_THRESHOLDS } from '@/services/scoring/v6-engine/config'

 const logger = getLogger()

@@ -108,6 +109,79 @@
   }
 }

+/** ĵṹ(ʷ汾Ա) */
+export interface ScoreDocDiff {
+  newerVersion: number
+  olderVersion: number
+  compositeDelta: number
+  l3vDelta: number
+  layerChanges: Array<{
+    code: string
+    oldScore: number
+    newScore: number
+    delta: number
+  }>
+  addedLayers: string[]
+  removedLayers: string[]
+  ratingChanged: boolean
+  oldRating: string
+  newRating: string
+}
+
+export function buildScoreDocDiff(newer: ScoreDocVersion, older: ScoreDocVersion): ScoreDocDiff {
+  // ... ʵ
+}
+
 export async function getNextVersion(symbol: string): Promise<number> {
   const versions = await dataLayer.scoreDocs.listBySymbol(symbol)
   if (versions.length === 0) return 1
@@ -226,7 +300,7 @@
     const totalComposite = all.reduce((sum, d) => sum + d.composite, 0)
-    const coreStocks = all.filter((d) => d.composite >= 4.0).length
+    const coreStocks = all.filter((d) => d.composite >= DEFAULT_THRESHOLDS.rating.strongBuy).length
```

### 8.2 ļ(δ޸,Ӱ)

| ļ· | Ӱ | ˵ |
|----------|----------|------|
| [src/components/analysis/score/ScoreHistoryPanel.tsx](../../../src/components/organisms/analysis/score/ScoreHistoryPanel.tsx) | ÷ |  `buildScoreDocDiff`,ͼͨ |
| [src/services/analysis/__tests__/scoreDocService.test.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/ͶиϵͳV9/src/services/analysis/__tests__/scoreDocService.test.ts) |  | 4  buildScoreDocDiff ͨ |
| [tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts](../../../tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts) |  | 43 вͨ |

---

## šϵ

### 9.1 

1. **쳣**  ¼븴ֲ
2. **ض**  οڴ
3. **ع**  οھ
4. **ִлع**  Ľڲ
5. **֤ع**  嵥֤
6. **֪ͨط**  ŶӡƷά
7. **º**  ,¼ lessons learned

### 9.2 ع

| ȼ |  |  |
|--------|------|--------|
| P0 | عԭ,λ |  |
| P0 | ޸ |  |
| P1 | ²޸汾 |  + ά |
| P2 | ²,© |  |
| P2 | ĵ,¼¼ |  |

---

## ʮ¼:֤ٲ

```powershell
# ͼ( scoreDocService )
npx tsc --noEmit 2>&1 | Select-String "scoreDocService|ScoreHistoryPanel" -SimpleMatch

# ESLint( scoreDocService)
npx eslint src/services/analysis/scoreDocService.ts

# Ԫ(buildScoreDocDiff)
npx vitest run src/services/analysis/__tests__/scoreDocService.test.ts --reporter=default

# в(43 )
npx vitest run walkthroughScoreDoc --reporter=default

# ܹ(ֲ)
npm run audit:layers

# (ע:Ԥ trade.constants ᵼʧ)
npx vite build
```

---

## ʮһ־

| 汾 |  | ժҪ |
|------|------|----------|
| v1.0 | 2026-07-04 | ʼ汾: 3 عԤ |
