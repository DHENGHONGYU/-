---

title: ձȶԹģ  䴩вԱ

type: reports

domain: backend

phase: retrospective

tier: T2

status: active

maintainer: V9 Architecture Team

summary: "## ޶¼ ## һĿ뷶Χ"

tags: [backend, scoring, spec, report]

version: v1.0.0

last_updated: 2026-07-17

code_version: 2.0.0

change_log:

  - version: v1.0.0

changes: Initial version established

date: 2026-07-17
doc_id: V9-DOC-AUTO-D4B445
---



# ձȶԹģ  䴩вԱ



> **Version**: v1.1 | ****: 2026-07-04

> **Զ**: ձȶԹģ(`src/services/analysis/scoreDocService.ts`)

> ****: 5 ֻƱ(300227.SZ / 300518.SZ / 300712.SZ / 300926.SZ / 688615.SH)

> **ļ**: [tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts](../../../tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts)

> **Խ**: ? **43/43 ȫͨ**(ܺʱ 2.49s)

> **в**: 5 ֻƱ  16  = **80 ȫͨ**



---



## ޶¼



| 汾 |  | ժҪ |

|------|------|----------|

| v1.0 | 2026-07-04 | 汨(δ־ûĲļ,Ч) |

| **v1.1** | **2026-07-04** | **´ļͨ 43/43 ֤;P1 Ӳ޸;buildScoreDocDiff ޸();ͬԭд** |



> **Ҫ˵**: v1.0 δ־û̵Ĳļ,"39/39 ͨ"ȱʵݡv1.1 ʵʴ֤ͨĲļ(43/43 ͨ),н۾ʵ֤



---



## һĿ뷶Χ



### 1.1 Ŀ



û,β䴩вΧ 5 Ŀչ:



1. **֤չ**(`saveScoreDoc`)ִֿܷձ

2. **֤ȶԹ**(`buildChangeFromPrev` / `buildScoreDocDiff`)ܷȷ汾

3. **¼ɱȷֵ仯**(`compositeDelta` / `l3vDelta` / `layerChanges`)

4. **˲ֵ仯ľݼֵжϱ׼ĳ**

5. **йؼ̺ͱ߽**



### 1.2 ԷΧ



| ģ | ļ· | ֤Χ |

|------|----------|----------|

| շ | `src/services/analysis/scoreDocService.ts` | `saveScoreDoc` / `getNextVersion` / `makeScoreDocId` / `buildReportMarkdown` / `validateScoreDocInput` / `getRecentVersions` / `getFileLibraryStats` / `buildChangeFromPrev` / **`buildScoreDocDiff`()** |

| ֱ׼ | `src/services/scoring/v6-engine/config.ts` | `DEFAULT_THRESHOLDS` / `DEFAULT_WEIGHTS` / `INDUSTRY_BENCHMARKS` / `RISK_WARNINGS` |

|  | `src/data/types.ts` | `ScoreDocVersion` / `V6LayerScore` / `FileLibraryStats` |

| ʷ | `src/components/organisms/analysis/score/ScoreHistoryPanel.tsx` | ֤( `buildScoreDocDiff`  `ScoreDocDiff` ) |



### 1.3 Ըά



׼ **10  describe 顢43 **,ά:



| # | ά |  | ؼ֤ |

|---|------|--------|-----------|

| 1 | չ | 5 | 汾=1docId ʽchangeFromPrev=undefinedۺϷ/L3V/11 桢reportMd ǿ |

| 2 | ȶԹ | 5 | 汾=2docId ʽchangeFromPrev ǿաcompositeDelta/l3vDelta 㡢layerChanges 11 㡢reportMd  |

| 3 | ֵ仯 | 5 | delta (/½/ƽ)Ⱥ˲顢絵֤ |

| 4 | жϱ׼ | 6 | ֵԡַΧȨعһҵ׼ǡԤӲ޸֤ |

| 5 | ߽ | 10 | װ޲졢졢/仯ٽ㡢3 Уʧܡ汾 |

| 6 | buildChangeFromPrev  | 3 | ȱʧ㲻prevScore Ĭ 0delta (2 λС) |

| 7 | Markdown  | 2 | V1 ṹV2  |

| 8 | ļͳ | 2 | 52=10 ĵͳơcoreStocks ͳ |

| **9** | **buildScoreDocDiff ()** | **4** | **ۺϷ/L3V/άȱ仯άȡɾάȡ仯** |

| 10 | вԽ | 1 | 5 ֻƱȫɡ80 ȫͨ |



---



## 볡



### 2.1 Դ



 [walkthroughTest.sampled.test.ts](../../../tests/e2e-verify-25stocks.integration.test.ts) һ, PowerShell `Get-Random -Count 5` ޷Ż, 2026-07-03



### 2.2 



Ϊֱָ仯ĸֵͳ,βΪÿֻƱ V1(ʼ) V2()汾, 4 ͱ仯ģʽ:



| Ʊ |  | ҵ | V1 ۺ | V1 L3V | V2 ۺ | V2 L3V | ۺ | 仯 |  |

|----------|------|------|---------|--------|---------|--------|-------|----------|----------|

| 300227.SZ | 1 | 뵼 | 3.50 | 3.20 | 3.80 | 3.50 | +0.30 | buybuy | С, |

| 300518.SZ | 2 |  | 3.26 | 3.00 | 3.10 | 2.85 | -0.16 | buybuy | С½, |

| 300712.SZ | 3 | Դ | 3.58 | 3.30 | 3.58 | 3.30 | 0.00 | buybuy | ȫƽ() |

| 300926.SZ | 4 | AI/TMT | 3.11 | 2.90 | 4.20 | 4.00 | +1.09 | buystrong_buy | ,絵 |

| 688615.SH | 5 | ҽҩ | 2.95 | 2.70 | 1.50 | 1.30 | -1.45 | holdsell | ½,絵 |



### 2.3 Ƹ



- **򸲸**: (2 )½(2 )ƽ(1 )

- **仯**: (3 )絵(1  buystrong_buy)絵(1  holdsell)

- **ȸ**: (0.00)С(0.16~0.30)(1.09~1.45)



---



## Իʩ



### 3.1 Կ



- ****: Vitest 2.1.9

- **Mock **: `vi.hoisted` + `vi.mock`  `dataLayer`  `logger`,ģʹ**ʵʵ**( mock)

- **ڴ洢**: Զ `InMemoryScoreDocStore` ģ IndexedDB Ϊ, `saveScoreDoc` ñְ汾״̬



### 3.2 Mock 



```typescript

const { mockScoreDocsStore, mockLogger } = vi.hoisted(() => ({

  mockScoreDocsStore: { save: vi.fn(), listBySymbol: vi.fn(), list: vi.fn() },

  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },

}))

vi.mock('@/data/dataLayer', () => ({ dataLayer: { scoreDocs: mockScoreDocsStore } }))

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

```



### 3.3 ڴ洢ʵ



```typescript

class InMemoryScoreDocStore {

  private docs: Map<string, ScoreDocVersion> = new Map()

  reset(): void { this.docs.clear() }

  async save(doc: ScoreDocVersion): Promise<{ success: true }> {

    this.docs.set(doc.docId, doc)

    return { success: true }

  }

  async listBySymbol(symbol: string): Promise<ScoreDocVersion[]> {

    return Array.from(this.docs.values())

      .filter((d) => d.symbol === symbol)

      .sort((a, b) => a.version - b.version)

  }

  async list(): Promise<ScoreDocVersion[]> {

    return Array.from(this.docs.values())

  }

}

```



### 3.4 ӳ亯



ʹ `config.ts` `DEFAULT_THRESHOLDS` һµ:



```typescript

function getRating(composite: number): string {

  if (composite >= DEFAULT_THRESHOLDS.rating.strongBuy) return 'strong_buy'  // 4.0

  if (composite >= DEFAULT_THRESHOLDS.rating.buy) return 'buy'               // 3.0

  if (composite >= DEFAULT_THRESHOLDS.rating.hold) return 'hold'             // 2.0

  if (composite >= DEFAULT_THRESHOLDS.rating.sell) return 'sell'             // 1.0

  return 'strong_sell'                                                       // <1.0

}

```



---



## ġϵͳӦ(ϸ)



### 4.1  1:V1 (ʼ汾)



****: ÿֻƱ `saveScoreDoc(input)` ״֡



**ϵͳӦ**( 300227.SZ Ϊ):



|  |  | Ԥ | ʵ | ״̬ |

|------|------|------|------|------|

| 1.1 | `saveScoreDoc(input)` | `success=true` | `success=true` | ? pass |

| 1.2 | 汾ż | `version=1` | `version=1` | ? pass |

| 1.3 | docId ʽ | `300227.SZ__V1__{timestamp}` | ƥ `^300227\.SZ__V1__\d+$` | ? pass |

| 1.4 | changeFromPrev | `undefined`(װ) | `undefined` | ? pass |

| 1.5 | ۺϷ/L3V | `3.50/3.20` | `3.50/3.20` | ? pass |

| 1.6 | 11  | `11` | `11` | ? pass |

| 1.7 | reportMd ǿ | +ۺϷ | >0, `1(300227)`  `ۺ` | ? pass |



### 4.2  2:V2 (Զ)



****: ÿֻƱٴε `saveScoreDoc(input)` ,ϵͳӦԶ `changeFromPrev`



**ϵͳӦ**( 300926.SZ 絵Ϊ):



|  |  | Ԥ | ʵ | ״̬ |

|------|------|------|------|------|

| 2.1 | V2 汾 | `version=2` | `version=2` | ? pass |

| 2.2 | V2 docId | `300926.SZ__V2__{timestamp}` | ƥ | ? pass |

| 2.3 | changeFromPrev ǿ | defined | defined | ? pass |

| 2.4 | compositeDelta | `+1.09` | `1.09` | ? pass |

| 2.5 | l3vDelta | `+1.10` | `1.10` | ? pass |

| 2.6 | layerChanges  | `11` | `11` | ? pass |

| 2.7 | reportMd  | "һ" | pass | ? pass |



### 4.3  3:ֵ仯Ⱥ˲



ɺ˲ delta (/½/ƽ),"ֵ仯"



### 4.4  4:жϱ׼˲



˲ `DEFAULT_THRESHOLDS``DEFAULT_WEIGHTS``INDUSTRY_BENCHMARKS``RISK_WARNINGS` ,"ֵжϱ׼ĳ"



### 4.5  5:߽



 10 ߽,߽"߽"



### 4.6  6:buildScoreDocDiff ֤()



֤ `buildScoreDocDiff` ,ڰ˽"buildScoreDocDiff ֤"



---



## 塢ֵ仯



### 5.1 ۺϷֱ仯(compositeDelta)



| Ʊ | V1 ۺ | V2 ۺ | ۺ |  | || | 仯 | 仯 |

|----------|---------|---------|-------|------|-----|----------|----------|

| 300227.SZ | 3.50 | 3.80 | +0.30 |  | 0.30 | buybuy | ͬС |

| 300518.SZ | 3.26 | 3.10 | -0.16 | ½ | 0.16 | buybuy | ͬС½ |

| 300712.SZ | 3.58 | 3.58 | 0.00 | ƽ | 0.00 | buybuy |  |

| 300926.SZ | 3.11 | 4.20 | +1.09 |  | 1.09 | buystrong_buy | **絵** |

| 688615.SH | 2.95 | 1.50 | -1.45 | ½ | 1.45 | holdsell | **絵** |



### 5.2 L3V 仯(l3vDelta)



| Ʊ | V1 L3V | V2 L3V | L3V |  |

|----------|--------|--------|------|------|

| 300227.SZ | 3.20 | 3.50 | +0.30 |  |

| 300518.SZ | 3.00 | 2.85 | -0.15 | ½ |

| 300712.SZ | 3.30 | 3.30 | 0.00 | ƽ |

| 300926.SZ | 2.90 | 4.00 | +1.10 |  |

| 688615.SH | 2.70 | 1.30 | -1.40 | ½ |



### 5.3 仯(layerChanges)



ÿֻƱ V2 վ 11 ȫ(`layerChangeCount=11`), V6 ȫ 11 (L-1/L0/L1/L2/L3f/L3v/L4/L5/L6/L7/L8)



### 5.4 ֵ仯ݺ˲



#### 5.4.1 㹫ʽ



 [scoreDocService.ts](../../../src/services/analysis/scoreDocService.ts) е `buildChangeFromPrev` :



```typescript

compositeDelta = Number((newDoc.composite - prevDoc.composite).toFixed(2))

l3vDelta       = Number((newDoc.l3v - prevDoc.l3v).toFixed(2))

layerChanges[code] = Number((newLayer.score - prevLayer.score).toFixed(2))

```



#### 5.4.2 ֤



- ? 5 ֻƱ `compositeDelta` ֵȫһ( 2 λС,)

- ? 5 ֻƱ `l3vDelta` ֵȫһ

- ? 5 ֻƱ 11  `layerChanges` ȫȷ

- ? 絵(300926.SZ  688615.SH)仯ֵ



#### 5.4.3 絵ж֤



**300926.SZ(buy  strong_buy 絵)**:



```typescript

expect(sample.v1Composite).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.rating.buy)     // 3.11  3.0 ?

expect(sample.v1Composite).toBeLessThan(DEFAULT_THRESHOLDS.rating.strongBuy)         // 3.11 < 4.0 ?

expect(sample.v2Composite).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.rating.strongBuy) // 4.20  4.0 ?

```



**688615.SH(hold  sell 絵)**:



```typescript

expect(sample.v1Composite).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.rating.hold)    // 2.95  2.0 ?

expect(sample.v1Composite).toBeLessThan(DEFAULT_THRESHOLDS.rating.buy)               // 2.95 < 3.0 ?

expect(sample.v2Composite).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.rating.sell)    // 1.50  1.0 ?

expect(sample.v2Composite).toBeLessThan(DEFAULT_THRESHOLDS.rating.hold)              // 1.50 < 2.0 ?

```



### 5.5 쳡֤



300712.SZ  V1  V2 ȫͬ(composite=3.58l3v=3.30),֤:



- ? `compositeDelta = 0`

- ? `l3vDelta = 0`

- ? 11  `layerChanges` ȫΪ 0



### 5.6 ֵ֤(߽)



|  | V1 | V2 | ۺ | L3V | ״̬ |

|------|-----|-----|-------|-------|------|

| 仯 | 0 | 5 | +5 | +5 | ? pass |

| 仯 | 5 | 0 | -5 | -5 | ? pass |

| ٽ | 3.0 | 4.0 |  |  | ? pass |



---



## ֵжϱ׼ĳ



### 6.1 ֵ(`DEFAULT_THRESHOLDS.rating`)



**׼**:



```typescript

{ strongBuy: 4.0, buy: 3.0, hold: 2.0, sell: 1.0 }

```



****:



- ? **ĵ**:  strong_buy / buy / hold / sell / strong_sell(<1.0)弶

- ? **ֵݼ**: strongBuy(4.0) > buy(3.0) > hold(2.0) > sell(1.0),"ԽԽ"ֱ

- ? **ٽ֤**: `getRating(3.0)='buy'``getRating(2.99)='hold'``getRating(4.0)='strong_buy'``getRating(3.99)='buy'`

- ? **絵֤**: 300926.SZ  688615.SH Ŀ絵жȷ



****:



- ?? **λ**(Ϊ 1.0):ֱ,δֲַʵܶȡʷֲַλ( P75/P50/P25)

- ?? **δȷ"strong_sell"**:Դ `composite < 1.0` ʱ `'strong_sell'`, `DEFAULT_THRESHOLDS.rating` вδ `strongSell` ֶ,һ¡



### 6.2 ַΧ(`DEFAULT_THRESHOLDS.layerScore`)



**׼**: `{ min: 0, max: 5 }`



****:



- ? ۺϷһ(0~5),ì

- ? `composite: { min: 0, max: 5 }`  `layerScore` Χ



### 6.3 Ȩعһ(`DEFAULT_WEIGHTS`)



**׼**:



```typescript

{ lMinus1: 0.10, l0: 0.08, l1: 0.15, l2: 0.10, l3f: 0.10, l3v: 0.08, l4: 0.08, l5: 0.05, l6: 0.07, l7: 0.15, l8: 0.04 }

```



****:



- ? **11 **:  V6 ȫ 11 

- ? **һ֤**: `Object.values(DEFAULT_WEIGHTS).reduce((sum, w) => sum + w, 0) = 1.00`

- ? **Ȩ**: L1 Ǻ(0.15) L7 ڶ(0.15)Ȩ,ϼֵͶ;L5 T-M(0.05) L8 (0.04)Ȩ,ϳͶӽ



### 6.4 ҵ׼(`INDUSTRY_BENCHMARKS`)



**׼**: 8 ҵ(/뵼/Դ///ҽҩ/豸/AI-TMT),ÿ PE/PEG/PB 䡣



****:



- ? **8 ҵ**: ֤ `INDUSTRY_BENCHMARKS.length === 8`

- ? ****: ÿҵ `peLow < peHigh``pbLow < pbHigh`

- ? **ؼƥ**: ÿҵ `keywords.length > 0`,֧ҵʶ

- ?? **ҵǶ**: 8 ҵδȫһ(/ɫ//زҵȱʧ),չ



### 6.5 Ԥ(`RISK_WARNINGS`)



**׼**:



- ɫԤ 5 :ӪֽΪӦ˿>Ӫ50%+תͬӳ>30졢ɶѺ>50%ƷǱ

- ɫԤ 4 :ë»Ϣծ>ʲ١/ʲ>30%ͻжTOP5>50%



****:



- ? **ɫ 5  + ɫ 4 ** ĵһ

- ? **ɫԤǿ**: ֤ `rule` ǿ

- ? ** 1 **: ɫԤΪ"1",Ⱥ

- ?? **δ**: "ƷǱ"δϸ(׼ޱ///޷ʾ),ضȷּ



### 6.6 P1 Ӳ(? ޸)



**ԭ**: `getFileLibraryStats()` Ӳ `composite >= 4.0` Ϊ"ĹƱ"жֵ,δ `DEFAULT_THRESHOLDS.rating.strongBuy` 



**޸״̬**: ? **޸**



**޸**:



```typescript

// ޸ǰ(scoreDocService.ts)

import { getLogger } from '@/lib/logger'

// ...

const coreStocks = all.filter((d) => d.composite >= 4.0).length



// ޸

import { getLogger } from '@/lib/logger'

import { DEFAULT_THRESHOLDS } from '@/services/scoring/v6-engine/config'

// ...

const coreStocks = all.filter((d) => d.composite >= DEFAULT_THRESHOLDS.rating.strongBuy).length

```



**֤**:  4.6 ͨ `getFileLibraryStats()` ֤޸Ϊȷ(composite=4.20 ȷʶΪĹ)



---



## ߡ߽



### 7.1 ߽Ծ



| # | ߽糡 |  | Ԥ | ʵ | ״̬ |

|---|----------|------|------|------|------|

| 5.1 | װ(һ) |  saveScoreDoc | `changeFromPrev=undefined` | undefined | ? pass |

| 5.2 | ȫͬ() | V1=V2=3.0 |  delta=0 | ȫ 0 | ? pass |

| 5.3 | 仯 | V1=0, V2=5 | ۺ=+5, L3V=+5 | +5, +5 | ? pass |

| 5.4 | 仯 | V1=5, V2=0 | ۺ=-5, L3V=-5 | -5, -5 | ? pass |

| 5.5 | ٽ | composite=3.0 | `getRating='buy'` | buy | ? pass |

| 5.5 | ٽ(ٽ) | composite=2.99 | `getRating='hold'` | hold | ? pass |

| 5.5 | ٽ(ϵ) | composite=4.0 | `getRating='strong_buy'` | strong_buy | ? pass |

| 5.5 | ٽ(ٽ) | composite=3.99 | `getRating='buy'` | buy | ? pass |

| 5.6 | Уʧ:symbol Ϊ | `symbol=''` | `valid=false`, errors "symbol" | pass | ? pass |

| 5.7 | Уʧ:layers ն | `layers={}` | `valid=false`, errors "layers" | pass | ? pass |

| 5.8 | Уʧ:composite Ϊ NaN | `composite=NaN` | `valid=false`, errors "composite" | pass | ? pass |

| 5.9 | 汾( 3 ) | 3  saveScoreDoc | version=123 | 1, 2, 3 | ? pass |

| 5.10 | 汾 | `getRecentVersions(code, 2)` |  2 ,汾Ž | pass | ? pass |



### 7.2 ֤(buildChangeFromPrev)



| # |  |  | Ԥ | ״̬ |

|---|------|------|------|------|

| 6.1 |  newDoc.layers дڵĲ | newDoc.layers={l0}, prevDoc.layers={l0} | ,delta=1.0 | ? pass |

| 6.2 | prevDoc ȱʧ:prevScore Ĭ 0 | newDoc.layers={L5:4}, prevDoc.layers={} | `layerChanges.l5=4.0` | ? pass |

| 6.3 | delta :2 λС | newDoc.composite=3.567, prevDoc.composite=2.111 | `compositeDelta=1.46` | ? pass |



### 7.3 Markdown 



| # |  | ֤ | ״̬ |

|---|------|--------|------|

| 7.1 | V1 ṹ | //ۺϷ/L3V/άȵ÷/Ͷʽ/Ŀ//߻ | ? pass |

| 7.2 | V2  | "## һ" + ۺϷֱ仯 + L3V 仯 | ? pass |



### 7.4 ļͳ



| # |  |  | Ԥ | ״̬ |

|---|------|------|------|------|

| 8.1 | 5 Ʊ  2 汾 = 10 ĵ | ȫ | `totalDocs=10, totalStocks=5, totalVersions=10` | ? pass |

| 8.2 | coreStocks ͳ | compositestrongBuy(4.0) | `coreStocks1`( 300926.SZ V2=4.20) | ? pass |



---



## ˡbuildScoreDocDiff ֤()



### 8.1 



βԷ [ScoreHistoryPanel.tsx](../../../src/components/organisms/analysis/score/ScoreHistoryPanel.tsx)  [src/services/analysis/__tests__/scoreDocService.test.ts](../../../src/services/analysis/__tests__/scoreDocService.test.ts) ˲ڵ `buildScoreDocDiff`  `ScoreDocDiff` ,±



### 8.2 ޸



 [scoreDocService.ts](../../../src/services/analysis/scoreDocService.ts)  `ScoreDocDiff` ӿ `buildScoreDocDiff` , `buildChangeFromPrev` :ṩ/ɾάȡ仯Ϣ



### 8.3 ǩ



```typescript

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



export function buildScoreDocDiff(newer: ScoreDocVersion, older: ScoreDocVersion): ScoreDocDiff

```



### 8.4 



| # |  | ֤ | ״̬ |

|---|------|--------|------|

| 9.1 | ۺϷ֡L3V άȱ仯 | newerVersion=2, olderVersion=1, compositeDelta=0.5, l3vDelta=0.3 | ? pass |

| 9.2 | ʶά(addedLayers) | `addedLayers`  'ɳ', oldScore=0 | ? pass |

| 9.3 | ʶɾά(removedLayers) | `removedLayers`  'ɳ', newScore=0 | ? pass |

| 9.4 | ʶ仯 | `ratingChanged=true`, oldRating='', newRating='' | ? pass |



### 8.5 ޸֤



- ? `src/services/analysis/__tests__/scoreDocService.test.ts`: 4/4 ͨ

- ? ͼ: `ScoreHistoryPanel.tsx`  `scoreDocService.ts` ʹ



---



## šԽ



### 9.1 ̨ԭ



```

========== ձȶԴвԱ ==========



300227.SZ 1(300227)

  仯: buy  buy

  ۺϷֱ仯: 0.30

  L3V 仯: 0.30

  仯: 11

  : 16 (ȫ pass: true)



300518.SZ 2(300518)

  仯: buy  buy

  ۺϷֱ仯: -0.16

  L3V 仯: -0.15

  仯: 11

  : 16 (ȫ pass: true)



300712.SZ 3(300712)

  仯: buy  buy

  ۺϷֱ仯: 0.00

  L3V 仯: 0.00

  仯: 11

  : 16 (ȫ pass: true)



300926.SZ 4(300926)

  仯: buy  strong_buy

  ۺϷֱ仯: 1.09

  L3V 仯: 1.10

  仯: 11

  : 16 (ȫ pass: true)



688615.SH 5(688615)

  仯: hold  sell

  ۺϷֱ仯: -1.45

  L3V 仯: -1.40

  仯: 11

  : 16 (ȫ pass: true)



ܼ: 5 ֻƱ, 80 , 80 ͨ

==============================================

```



### 9.2 ͳ



| ָ | ֵ |

|------|------|

| ļ | 1 |

|  | **43** |

| ͨ | **43** |

| ʧ | **0** |

|  | 0 |

| ܺʱ | 2.49s |

| в | **80**(5 Ʊ  16 ) |

| вͨ | **80** |



### 9.3 ֲ



```

1. չ(saveScoreDoc)              5   ?

2. ȶԹ(buildChangeFromPrev)        5   ?

3. ֵ仯                          5   ?

4. жϱ׼                    6   ?

5. ߽                          10   ?

6. buildChangeFromPrev            3   ?

7. Markdown                   2   ?

8. ļͳ(getFileLibraryStats)     2   ?

9. buildScoreDocDiff ֤()    4   ?

10. вԽ                     1   ?

                                       

                                       ܼ 43 

```



---



## ʮֵĽ



### 10.1 ѷ޸״̬



| # |  | λ | ض | ״̬ | ޸ |

|---|------|------|--------|------|----------|

| 1 | `getFileLibraryStats`  `composite >= 4.0` Ӳ | [scoreDocService.ts](../../../src/services/analysis/scoreDocService.ts) |  | ? **޸** | Ϊ `DEFAULT_THRESHOLDS.rating.strongBuy` |

| 2 | `buildScoreDocDiff`  `ScoreDocDiff` ȱʧ | [scoreDocService.ts](../../../src/services/analysis/scoreDocService.ts) |  | ? **޸** | ,޸ ScoreHistoryPanel.tsx Եô |

| 3 | `DEFAULT_THRESHOLDS.rating` δ `strongSell` ֶ | config.ts |  | ?  | ع |

| 4 | λ(Ϊ 1.0),δʷֲַλ | config.ts |  | ?  | 鳤Ż |

| 5 | ҵ׼ 8 ҵ,δһȫҵ | config.ts |  | ?  | 鰴չ |

| 6 | "ƷǱ"δضȷּ | config.ts RISK_WARNINGS.red |  | ?  | ϸ |



### 10.2 Ľ



#### 10.2.1 P2 Ż: strongSell ֵ



```typescript

//  config.ts в

export const DEFAULT_THRESHOLDS: V6ScoreThresholdsConfig = {

  rating: {

    strongBuy: 4.0,

    buy: 3.0,

    hold: 2.0,

    sell: 1.0,

    strongSell: 1.0,  // :< ֵ  strong_sell

  },

  // ...

}

```



#### 10.2.2 Ż:ڷֲֵ



ռʷݺ,ʹ÷λλ,ʹֲʵ:



```typescript

// ʾ:ʷֲֵַ

const DATA_DRIVEN_THRESHOLDS = {

  strongBuy: 4.0,   // P75

  buy: 3.2,         // P50

  hold: 2.5,        // P25

  sell: 1.5,        // P10

}

```



---



## ʮһ



### 11.1 Խ



? **ձȶԹģ״̬,йؼ߽֤ͨ**



:



1. **չ**: `saveScoreDoc` ȷִֿձ,Զ汾,ɷϸʽ `docId`,װ `changeFromPrev`,11  Markdown 档

2. **ȶԹ**: `buildChangeFromPrev`  `buildScoreDocDiff` ȷ V2  V1 Ĳ,`compositeDelta`/`l3vDelta`/`layerChanges` ֵȫһ, 2 λСȷ

3. **ֵ仯**: 5 ֻ/½/ƽ/絵/絵 5 ೡ, delta ȾԤ,絵жֵȷִС

4. **жϱ׼**: ֵĵַΧۺϷַΧ롢11 ȨعһΪ 1.08 ҵ׼5+4 Ԥȫ

5. **߽ȫ**: 10 ߽(װ//ֵ/ٽ/Уʧ/汾/)ȫͨ

6. **֤**: `buildScoreDocDiff`  4 ȫͨ,֧άȡɾάȡ仯㡣



### 11.2 ޸ɹ



| ޸ | ޸ǰ | ޸ | ֤ |

|--------|--------|--------|------|

| P1 Ӳ | `composite >= 4.0` Ӳ |  `DEFAULT_THRESHOLDS.rating.strongBuy` | ?  4.6 ͨ |

| buildScoreDocDiff ȱʧ | ScoreHistoryPanel.tsx Ա |  `ScoreDocDiff`  `buildScoreDocDiff`  | ?  9.1-9.4 ͨ |



### 11.3 ʾ



- ?? **2 /Ƚ**(P2):`strongSell` ֶȱʧ"ƷǱ"δּ,Ӱϵ,Ż

- ?? **ҵ׼Ƕ**:8 ҵδһȫ,鰴չ



### 11.4 ж



| ȼ | ж | η | ֹ |

|--------|--------|--------|------|

| P2 |  `DEFAULT_THRESHOLDS.rating.strongSell` ֶ |  | ¸ |

| P2 | ϸ"ƷǱ"Ϊ 4 (׼ޱ///޷ʾ) | ҵ+ | ¸ |

| P2 | չҵ׼һȫҵ | ҵ+ | Q4 |

|  | ʷֲַŻֵ(λ) | + | Q4 |



---



## ¼ A:ִ



```powershell

npx vitest run walkthroughScoreDoc --reporter=default

```



## ¼ B:ļ嵥



| ļ | ; | ״̬ |

|------|------|------|

| [tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts](../../../tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts) | δвļ | ? Ѵͨ |

| [src/services/analysis/scoreDocService.ts](../../../src/services/analysis/scoreDocService.ts) | ķ | ? ޸(P1 + buildScoreDocDiff) |

| [src/services/scoring/v6-engine/config.ts](../../../src/services/scoring/v6-engine/config.ts) | жϱ׼ | δ޸ |

| [src/data/types.ts](../../../src/data/types.ts) | ScoreDocVersion Ͷ | δ޸ |

| [src/components/analysis/score/ScoreHistoryPanel.tsx](../../../src/components/organisms/analysis/score/ScoreHistoryPanel.tsx) | ʷ | ? ô(޸) |

| [src/services/analysis/__tests__/scoreDocService.test.ts](../../../src/services/analysis/__tests__/scoreDocService.test.ts) | buildScoreDocDiff Ԫ | ? 4/4 ͨ |



## ¼ C:AGENTS.md ϹԼ



|  | Ϲ | ˵ |

|------|------|------|

|  Ӳ | ? | P1 Ӳ޸,`getFileLibraryStats`  `DEFAULT_THRESHOLDS.rating.strongBuy` |

| Ľ Լ | ? | ļ kebab-case PascalCase UPPER_SNAKE_CASE PascalCase |

|  ܹԼ | ? | L3/L4/L7/L8 ȷԲ,config.ts עֵ/Ȩ |

| ߽ ֤ | ? | `npx vitest run` ͨ(43/43) |

| ڶ ĲɱԼ | ? |  `buildScoreDocDiff` ѭͶԵļ˳ |

