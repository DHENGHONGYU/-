---
title: testing-strategy
type: reference
domain: qa
phase: testing
tier: important
status: active
maintainer: V9 Architecture Team
summary: "src/data/ 35% IndexedDB  Schema  ROI src/core/ 75% ACL??Envelope??"
tags: [qa, strategy, test, testing, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-010
related_docs: [V9-DOC-QA-009, V9-DOC-META-000, V9-DOC-PROJ-121, V9-DOC-QA-081, V9-DOC-QA-108, V9-DOC-PROJ-295]
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-QA-081, V9-DOC-QA-029, V9-DOC-QA-009, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-179, V9-DOC-QA-108, V9-DOC-PROJ-295, V9-DOC-PROJ-121, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 

> **Version**: v2.0.0 | ****: 2026-07-12
> ****: V9 
> ****: [](test-catalog.md) ?? 

---

## 

V9 ****

```
        ??
       / \     (Playwright Snapshot)
      /   \    UI 
     /\  ~5  20 ??
    /       \
   /\  E2E (Playwright)
  /           \ 
 /             \~17 ?? spec 5 
/\
/                 \  (Vitest + fake-indexeddb)
/                   \DataBridge??ACL??Widget 
/\~15  suite
/                       \
/\  (Vitest + jsdom)
/                           \Store??Service
/                             \~200 

```

|  |  | / |  |  |
|------|------|-----------|------|----------|
| **** | Store??Service/ | Vitest + jsdom |  ?? 70% 80% | pre-commit / CI |
| **** | DataBridge??EventBus??ACL??Widget Store ?? Tab  | Vitest + fake-indexeddb |  | CI |
| **E2E ** |  | Playwright (Chromium) |  |  |
| **** |  | Playwright `toHaveScreenshot` |  ?? 2% |  |

> ****??
> 1. ****E2E 
> 2. ****
> 3. ****/ CI E2E/
> 4. **** `vi.useFakeTimers()` / `EventBus.subscribe()` / `window.addEventListener()`  cleanup AGENTS.md 

---

## 

### 2.1 

```
 e2e/                          ?? E2E &  (Playwright)
??    *.spec.ts                 ??  (~17 ??)
??    visual-regression.spec.ts ?? 
??    visual-regression.spec.ts-snapshots/ ?? 
??
 tests/                        ??  & 
??    setup.ts                  ?? fake-indexeddb + jsdom mock + cleanup??
??    contracts/                ?? DataBridge / Envelope / Store / Strategy??
??    __tests__/                ??  /  /  / 
??    __mocks__/                ??  mock
??    fixtures/                 ?? 
??    helpers/                  ?? 
??
 src/                          ?? 
     **/*.test.ts              ?? 
     **/*.test.tsx             ?? 
```

### 2.2  vs 

|  |  |  |
|------|------|---------|
| **** | `src/{layer}/ModuleName.test.ts` |  Store??Service |
| **** | `tests/`  | E2Efixtures ?? helpers?? |

**** ?? // ?? 

---

## Layer 1??

### 3.1 

|  |  |  |
|---------|---------|---------|
| Zustand Store |  action |  action  1 ?? success + 1 ?? error  |
| Service | ////ACL  |  mock |
|  (Atoms/Molecules) |  | `@testing-library/react` + `userEvent` |
|  |  |  |
|  |  +  | `Expect<Equals>`  |

### 3.2 Store 

```typescript
// ? Zustand Store 
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { useAnalysisStore } from '@/store/analysisStore'

const initialState = useAnalysisStore.getState()

describe('analysisStore', () => {
  beforeEach(() => {
    act(() => {
      useAnalysisStore.setState(initialState, true) // true = replace
    })
  })

  afterEach(() => {
    vi.useRealTimers() // ?? AGENTS.md  
  })

  it('should update score on fetch success', async () => {
    // Arrange
    const mockScore = { symbol: '600519', v6Score: 4.5 }
    vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(mockScore)

    // Act
    await act(async () => {
      await useAnalysisStore.getState().fetchScore('600519')
    })

    // Assert
    expect(useAnalysisStore.getState().scoreMap.get('600519')).toEqual(mockScore)
  })

  it('should set error on fetch failure', async () => {
    vi.mocked(dataLayer.v6Scores.get).mockRejectedValue(new Error('DB error'))

    await act(async () => {
      await useAnalysisStore.getState().fetchScore('600519')
    })

    expect(useAnalysisStore.getState().error).toBe('DB error')
  })
})
```

### 3.3 

```typescript
// ? React 
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Badge } from '@/components/atoms/Badge'

describe('Badge', () => {
  it('renders label and applies variant class', () => {
    render(<Badge label="" variant="success" />)
    expect(screen.getByText('')).toBeVisible()
    expect(screen.getByText('')).toHaveClass('bg-green-500')
  })

  it('handles click event', () => {
    const onClick = vi.fn()
    render(<Badge label="" onClick={onClick} />)
    fireEvent.click(screen.getByText(''))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

---

## Layer 2??

### 4.1 

****

|  |  |  |
|------|---------|---------|
| **DataBridge ** | `tests/contracts/databridge.contract.ts` |  action ?? `EnvelopeError`??Query  `payload.store` +  |
| **Envelope ** | `tests/contracts/envelope.contract.ts` |  target ?? reject traceId ?? reject??timestamp ?? 0 ?? reject |
| **Store ?? Tab ** | `tests/contracts/store.contract.ts` | `withBroadcast`  `eventBus.emit` |
| **Widget ** | `tests/contracts/strategy.contract.ts` |  `widgetRegistry`  widgetId ?? `DEFAULT_WIDGET_CONFIG` ?? `WIDGET_DEFAULT_DATA_SOURCE`  |
| **ACL ** | `tests/__tests__/integration/stockpool-acl.integration.test.ts` |  ACL_MATRIX  |
| **MCP Server ** | `tests/__tests__/integration/mcp-servers.integration.test.ts` | 16 ?? Server  |

### 4.2 

```typescript
// ? 
import { describe, it, expect } from 'vitest'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'

describe('DataBridge ?? DB ', () => {
  it('should route saveScores to v6_scores store and invalidate cache', async () => {
    const envelope = EnvelopeFactory.create(
      { source: 'analyzer', target: 'db', action: 'SAVE_SCORES', traceId: 'test-1' },
      { symbol: '600519', score: 4.5 },
    )

    await dataBridge.forward(envelope)

    //  DB
    const saved = await db.get('v6_scores', '600519')
    expect(saved?.score).toBe(4.5)

    //  query  DB??
    //  MemoryCache  spyOn invalidateCache
  })
})
```

---

## E2E Layer 3??

### 5.1 

E2E ****

|  |  | spec  |
|------|---------|----------|
| **** |  | `e2e/input-data-collection.spec.ts` / `input-stock-pool.spec.ts` / `bulk-import-full.spec.ts` |
| **** |  | `e2e/analysis-scoring.spec.ts` / `analysis-extended.spec.ts` / `stock-score.spec.ts` |
| **** | / | `e2e/trading.spec.ts` / `trade-review.spec.ts` / `pool-group.spec.ts` |
| **** |  | `e2e/output-cabin.spec.ts` / `output-command.spec.ts` |
| **** | MCP  | `e2e/mcp-verify.spec.ts` / `data-migration.spec.ts` |
| **** |  | `e2e/responsive.spec.ts` / `accessibility.spec.ts` |

### 5.2 E2E 

1. ****
2. ****/
3. ****
4. **** spec 

---

## Layer 4??

### 6.1 

|  | ?? |  |
|--------|-----|------|
|  | Playwright `toHaveScreenshot` |  |
|  | `maxDiffPixelRatio: 0.02` |  2%  |
|  | `threshold: 0.2` |  |
|  | Desktop Chrome |  |
|  | `e2e/visual-regression.spec.ts-snapshots/` |  |

### 6.2  ?? 

| # |  |  |
|---|------|------|
| 1 |  | ? |
| 2 |  | ? |
| 3 |  | ? |
| 4 |  | ? |
| 5 |  | ? |
| 6-20 |  | ?? P3?? |

### 6.3 

```powershell
# 
npm run test:e2e:visual

# UI 
npm run test:e2e:visual:update
```

---

## 

### 7.1 

|  |  |  |  |
|------|--------|----------|------|
| **Statements** | ?? 80% | ??  |  |
| **Branches** | ?? 75% | ??  |  |
| **Functions** | ?? 80% | ??  |  |
| **Lines** | ?? 80% | ??  |  |

### 7.2 vite.config.ts??

 Vitest `coverage.thresholds` CI 

|  | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| `src/core/**` | 55 | 75 | 60 | 55 |
| `src/data/**` | 35 | 35 | 35 | 35 |
| `src/lib/**` | 70 | 65 | 80 | 70 |
| `src/services/**` | 70 | 65 | 70 | 70 |

> ****??`src/data/**` 35% IndexedDB  Schema  ROI `src/core/**` 75% ACL??Envelope??RouteGuard 

---

## Mock 

### 8.1 Mock 

|  | / |  |
|------|-----------|------|
| ** Mock** | `tests/__mocks__/` | `nanoid`??`dayjs`?? |
| **Fixtures** | `tests/fixtures/` | orders??portfolios??signals?? |
| **Factories** | `tests/unit/mockFactories.ts` |  |
| **Helpers** | `tests/helpers/` | LLM Mock Fetch??Widget  |
| ** Mock** |  `vi.mock()` |  |

### 8.2  Mock 

|  | Mock  |  |
|---------|----------|------|
| **IndexedDB** | `fake-indexeddb`  | `tests/setup.ts` |
| **LLM API** | `tests/helpers/llmMockFetch.ts`  fetch |  |
| **** | `tests/mockStockData.ts`  |  |
| **Browser API** | `matchMedia` / `IntersectionObserver` / `ResizeObserver` no-op mock | `tests/setup.ts` |

---

## AGENTS.md  

### 9.1 

```typescript
// ? 
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })
```

### 9.2 

```typescript
// ? 
const unsubscribe = EventBus.subscribe('event', handler)
// ...  ...
unsubscribe() // ?? 
```

### 9.3 DOM 

```typescript
// ?  tests/setup.ts
// afterEach(() => cleanup())
```

---

##  CI 

### 10.1 `test:clean`??

 8  CI 

| # |  |  |  |
|---|----------|----------|--------|
| 1 | `src/store/agentStore.test.ts` | LLM  Mock  | P1 |
| 2 | `src/services/fetcher/fetcherClient.test.ts` |  I/O  | P1 |
| 3 | `src/services/llm/llmClient.multimodel.test.ts` |  Provider  | P1 |
| 4 | `tests/fetcher/dataSourceProvider.test.ts` |  | P2 |
| 5 | `tests/ui-components.test.tsx` |  | P2 |
| 6 | `tests/agentModule.integration.test.tsx` | Agent  | P2 |
| 7 | `tests/engine.test.ts` |  | P1 |
| 8 | `tests/sectorScoreService.test.ts` | Mock  | P2 |

### 10.2 CI 

```powershell
# CI  8 
npm run test:clean

# 
npm run test:known

# 
npm test -- --run
```

> ****??`audit:tests`  `test:clean` ?? `test:known` 

---

## 

 AGENTS.md 

```powershell
# 1. 
npx tsc --noEmit

# 2. 
npm run audit:docs

# 3. 
npm run audit:layers

# 4. clean 
npm run test:clean

# 5. E2E 
npm run test:e2e
```

---

## 

```powershell
#   
npm run test              # Vitest run??
npm run test:watch        # 
npm run test:ci           # CI  + 
npm run test:staged       #  git staged 
npm run test:clean        # 
npm run test:known        # 

#  E2E &  
npm run test:e2e          # Playwright  E2E
npm run test:e2e:ui       # Playwright UI 
npm run test:e2e:visual   # 
npm run test:e2e:visual:update  # 

#   
npm run coverage          # 

#   
npm run audit:tests       # 
```

---

## 

|  |  |  |
|------|------|--------|
| **P1??** |  8  `src/core/**`  75% | 2 ?? |
| **P2??** |  ~23  Store??organisms  | 1  |
| **P3??** |  20 E2E  Safari/Firefox | 2  |

---

## 

|  |  |  |
|------|------|------|
|  | `./test-catalog.md` | //Store  |
| ../../AGENTS.md  | `../../AGENTS.md` /??/?? |  |
|  | `./coding-conventions.md` |  |
|  | `../explanation/runbook.md` | CI/CD  |
| Vite  | `vite.config.ts` | pool  |
|  setup | `tests/setup.ts` | fake-indexeddb??Browser API mock??cleanup |


<!-- merge-source: docs/how-to/testing/testing-strategy.md (2026-07-14 ) -->
##  `docs/how-to/testing/testing-strategy.md`??

|  |  |  |  |  |
|  | Store??Service | Vitest + jsdom |  ?? 70% ?? 85% | pre-commit / CI |
|  | DataBridge??EventBus??Widget  | Vitest + fake-indexeddb |  | CI |
| E2E  |  | Playwright |  |  |
## 2. 
### 2.1 Widget 
 Widget 
1. `src/cockpit/core/widgetRegistry.ts` 
2. `src/constants/cockpit.constants.ts` ?? `DEFAULT_WIDGET_CONFIG` 
3.  `WIDGET_DEFAULT_DATA_SOURCE` 
 `widgetRegistry`  widgetId
### 2.2 DataBridge 
-  action  `EnvelopeError`
- Query  `payload.store`
- 
-  ACL  `success: false`
### 2.3 Store ?? Tab 
- `withBroadcast`  `eventBus.emit`
- 
-  Store 
## 3. 
Store??Service??UI
1.  `tests/__tests__/types/` 
2. Store action
3. Service///
4. UI
## 4. 
- `src/lib/validation.test.ts` ?? `__tests__/ModuleName.test.ts`
- `tests/integration/xxx.integration.test.ts`
- E2E `e2e/xxx.spec.ts`
- `tests/__tests__/types/xxx.spec.ts`
npm run test
# lint-staged 
npm run test:staged
npm run test -- tests/integration
npm run test:ci
- Husky pre-commit??
-  PR 
- E2E 
-  DataBridge??withBroadcast??Widget 
- UI 
- 

## 

 V9 

- [](../00-meta/../explanation/design/registry-index.md)
- [V9 ](test-catalog.md)
- [](../team-handbook/06-team-operation-guide.md)
- [](../testing/test-catalog.md)
- [](../standards/quality-gates.md)
- [V9  ?? ](../reports/retrospectives/-v2.0.0.md)

