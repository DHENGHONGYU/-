---
doc_id: V9-DOC-DEV-020
title: "V9-DOC-GUIDE-012：`no-unsafe-*` 14 种修复模式手册"
domain: project
status: active
last_updated: 2026-08-17
code_version: 2.0.0-rc.2
---
covers_code:
  - scripts/audit/apply-no-unsafe-fix-patterns.cjs


---
title: '@typescript-eslint/no-unsafe-* 系列规则 14 种修复模式实战手册'
doc_id: V9-DOC-GUIDE-012
domain: guide
type: how-to
summary: 基于 GOV-P1-03 Batch 4/5 人工清零实战（42 文件 125 处违规）提炼出的可机械复用模式，含模式编号、根因、Before/After、风险点、适用域；是编写自动化修复脚本（apply-no-unsafe-fix-patterns.cjs）的权威输入。
last_updated: 2026-08-15
version: 1.0.0
change_log:
  - version: 1.0.0
    date: 2026-08-15
    author: gov-batch4-team
    description: 首版，覆盖 14 种模式，来自 Batch 4（25 文件 / 108 条）+ Batch 5（17 文件 / 17 条）清零实战
related_docs:
  - V9-DOC-GUIDE-036  # 踩坑规则门禁指南
  - V9-DOC-TECH-027   # no-unsafe 大盘扫描与批次拆分脚本
covers_code:
  - scripts/audit/analyze-no-unsafe-inventory.cjs
  - eslint.config.js
  - src/vite-env.d.ts
  - src/services/scoring/v6-engine/enhancer.ts
  - src/core/cascadeExecutor.ts
  - src/services/storage/SnapshotManager.ts
tags:
  - type-safety
  - eslint
  - @typescript-eslint
  - tech-debt
  - automation-playbook
---

# V9-DOC-GUIDE-012：`no-unsafe-*` 14 种修复模式手册

> 面向对象：需要批量清零 `@typescript-eslint/no-unsafe-assignment / no-unsafe-member-access / no-unsafe-call / no-unsafe-return / no-unsafe-argument` 的开发者，以及自动化脚本（GOV-P1-02）作者。
> 本手册的每条模式都经过人工落地验证（非理论猜想），可在 `scripts/audit/apply-no-unsafe-fix-patterns.cjs` 中按 ID 映射为 AST 替换模板。

---

## 0. 背景与适用范围

`no-unsafe-*` 是 TypeScript ESLint 的 5 条联合规则，约束**将 `any` 类型流泄漏到具体运行时操作**的 5 个时刻：赋值（assignment）、成员访问（member）、函数调用（call）、参数传递（argument）、返回值（return）。

- 修复原则：**绝不在同一行增加 `as any` / `eslint-disable-line`**；允许的放行方式只有 `as 具体类型` / `unknown 收窄 + 类型守卫` / 根因修复（环境变量声明、泛型补全等）。
- 不适用：`*.test.ts / *.test.tsx` 中为构造输入故意使用的 `any`（测试域维持 warn）。
- 推荐配套：`tsc:prod` 零错误 + 受影响域测试后再合入。

---

## 1. 模式速查表

| # | 模式名 | 触发规则 | 占比（125 条） | 典型代码域 | 自动化难度 |
|---|--------|----------|----------------|------------|-----------|
| 01 | `JSON.parse → unknown + 类型断言` | assignment | 18% | scoring / LLM enhancers、import/export、MCP | 中 |
| 02 | `resp.json() 直接赋值` | assignment | 10% | fetcher、REST collector、API client | 低 |
| 03 | `new Array(n).fill(x)` 泛型缺失 | assignment | 11% | 数值矩阵、mock 构造、统计库 | 低 |
| 04 | 动态 import 模块无类型 | assignment/call | 3% | optional 依赖（@xenova/transformers 等）| 中 |
| 05 | `.catch(err)` 隐式 any 取 `.message` | member/call | 4% | 异步服务、worker | 低 |
| 06 | 环境变量未在 `vite-env.d.ts` 声明 | assignment | 7% | config、provider、constants | 根因修复 |
| 07 | `String.replace` / `.map` 回调参数无类型 | assignment/argument | 5% | core utils、lib、文本清洗 | 低 |
| 08 | 第三方库 `as any` 返回（XLSX.write 等）| assignment | 5% | export、Excel IO | 低 |
| 09 | `localStorage.getItem + JSON.parse` 无断言 | assignment | 4% | ConfigApp、seed 读写、mock 存储 | 低 |
| 10 | `payload[0]` / `arr[i]` 索引裸取 | assignment/member | 3% | databridge、handler 参数解构 | 低 |
| 11 | `toSafeArray<T>(value)` 未做 `as T[]` | return | 2% | lib/safeCoerce 等类型辅助 | 低 |
| 12 | `Process.env.XXX \|\| default` 恒真判定 | member/assignment | 2% | cache dir、base URL 配置 | 低/需 tsc 验证 |
| 13 | JSON.parse 结构化校验（`Partial<Record>` 守卫）| 全域 | 14% | MCP payload、DataFlow packet、importSnapshot | 中/高 |
| 14 | 统一解析辅助函数（DRY：同文件 2+ 解析点）| 全域 | 10% | SnapshotManager 等 | 重构 |

合计 125 条 = GOV-P1-03 总清零量（生产域 100% 覆盖）。

---

## 2. 各模式详解

### 模式 01：`JSON.parse → unknown + 类型断言`

- **触发规则**：`no-unsafe-assignment`（80%）+ 成员/调用泄漏（20%）
- **根因**：`JSON.parse` 返回类型为 `any`；直接赋值给具体类型变量即泄漏
- **Before / After**

```ts
// ❌ Before
const scoreData: CompositeScore = JSON.parse(cs)
const results = await runFullIndustryAnalysisEnhanced(JSON.parse(args.data as string), options)

// ✅ After（版本 A：断言型，适用于结构可信 / 上游有校验）
const scoreData = JSON.parse(cs) as CompositeScore

// ✅ After（版本 B：unknown + 守卫型，适用于外部输入 / 文件导入）
const parsed: unknown = JSON.parse(text)
const obj: Record<string, unknown> = typeof parsed === 'object' && parsed !== null ? parsed : {}
if (!Array.isArray(obj.stores)) throw new Error('missing stores')
```

- **实践参考**：[enhancer.ts](file:///d:/FinSightV9/src/services/scoring/v6-engine/enhancer.ts)、[v6ScoringServer.ts](file:///d:/FinSightV9/src/mcp/servers/scoring/v6ScoringServer.ts)、[workflowServer.ts](file:///d:/FinSightV9/src/mcp/servers/workflow/workflowServer.ts)
- **自动化风险点**：断言型需先从左侧或后续 `await fn(...)` 推导目标类型；守卫型需脚本能识别 `Record<string, unknown>` 模板

---

### 模式 02：`resp.json() 直接赋值`

- **触发规则**：`no-unsafe-assignment`
- **根因**：`Response.json()` 返回 `Promise<any>`；直接赋给具体类型接口变量泄漏
- **Before / After**

```ts
// ❌ Before
const body: SectorApiResponse = await resp.json()
const rawData = await response.json()  // 后续传给 wrapData(dataType, rawData)
```

```ts
// ✅ After（断言型）
const body = (await resp.json()) as SectorApiResponse
const rawData: unknown = await response.json()
```

- **实践参考**：[sectorApiClient.ts](file:///d:/FinSightV9/src/services/scoring/sectorApiClient.ts)、[RestCollector.ts](file:///d:/FinSightV9/src/services/data-collector/collectors/RestCollector.ts)、[multiSourceFetcher.ts](file:///d:/FinSightV9/src/services/data-collector/multiSourceFetcher.ts)、[crawlerProvider.ts](file:///d:/FinSightV9/src/services/data-collector/crawlerProvider.ts)
- **自动化风险点**：断言 vs unknown 的选择需看后续使用——若下游参数类型为 `unknown`，用 `: unknown`；否则 `as TargetType`

---

### 模式 03：`new Array(n).fill(x)` 泛型缺失

- **触发规则**：`no-unsafe-assignment`
- **根因**：`new Array(n)` 创建 `any[]`，再 `.fill(0)` 依然是 `any[]`；赋给 `number[][]` 子层泄漏
- **Before / After**

```ts
// ❌ Before
const ranks = new Array(values.length).fill(0)        // any[]
const result: number[][] = Array.from({length: cols},
  () => new Array(rows).fill(0))                       // any[] → number[]
const results = Array(5).fill(0)
```

```ts
// ✅ After
const ranks = new Array<number>(values.length).fill(0)
const result: number[][] = Array.from({length: cols},
  () => new Array<number>(rows).fill(0))
const results = Array<number>(5).fill(0)
```

- **实践参考**：[statistics.ts](file:///d:/FinSightV9/src/core/statistics.ts)、[regressionAnalyzer.ts](file:///d:/FinSightV9/src/services/scoring/v6-engine/regressionAnalyzer.ts)、[portfolioBuilder.ts](file:///d:/FinSightV9/src/services/trading/portfolioBuilder.ts)、[localStorageCrypto.ts](file:///d:/FinSightV9/src/lib/localStorageCrypto.ts)、[dualStrategyMockData.ts](file:///d:/FinSightV9/src/fixtures/dualStrategyMockData.ts)、[v6ScoreTaskScheduler.ts](file:///d:/FinSightV9/src/services/workers/v6ScoreTaskScheduler.ts)
- **自动化风险点**：需从赋值左值或 `.fill(x)` 字面量推断元素类型（number / string / CompositeScore | null 等）

---

### 模式 04：动态 `import(moduleStr)` 模块无类型

- **触发规则**：`no-unsafe-assignment` / `no-unsafe-call`
- **根因**：用字符串拼接变量绕过静态解析，`import(mod)` 返回 `Promise<any>`
- **Before / After**

```ts
// ❌ Before
const transformerModule = '@xenova' + '/transformers'
const { pipeline } = await import(transformerModule)
// pipeline(...) 的返回值与参数全体为 any
```

```ts
// ✅ After：显式断言 `as typeof import('pkg')`
const transformerModule = '@xenova' + '/transformers'
const mod = (await import(transformerModule)) as typeof import('@xenova/transformers')
const { pipeline } = mod
```

- **实践参考**：[localEmbeddingService.ts](file:///d:/FinSightV9/src/services/system/localEmbeddingService.ts)
- **自动化风险点**：需从拼接字符串反推出真实包名；`typeof import('pkg')` 在项目无该包类型时会 tsc 失败（本项目已安装）

---

### 模式 05：`.catch(err)` 隐式 any 取 `.message`

- **触发规则**：`no-unsafe-member-access`（访问 `.message`）
- **根因**：`.catch((err) => ...)` 中 `err` 类型默认 `any`（除非 `useUnknownInCatchVariables: true`）
- **Before / After**

```ts
// ❌ Before
.catch((err) => logger.warn('...', { error: err.message }))
```

```ts
// ✅ After（推荐：instanceof Error 守卫）
.catch((err) => logger.warn('...', {
  error: err instanceof Error ? err.message : String(err)
}))

// ✅ After（备选：unknown 标注 + String 兜底）
.catch((err: unknown) => logger.warn('...', { error: String(err) }))
```

- **实践参考**：[profileService.ts](file:///d:/FinSightV9/src/services/profile/profileService.ts)、[tagService.ts](file:///d:/FinSightV9/src/services/profile/tagService.ts)、[BaseCollector.ts](file:///d:/FinSightV9/src/services/data-collector/collectors/BaseCollector.ts)、[sevenDimConfigStore.ts](file:///d:/FinSightV9/src/store/sevenDimConfigStore.ts)
- **自动化风险点**：`String(err)` 在 no-base-to-string 下会告警（unknown 不可），优先用 `instanceof` 三元模式

---

### 模式 06：环境变量未在 `vite-env.d.ts` 声明

- **触发规则**：`no-unsafe-assignment`
- **根因**：`import.meta.env.XXX` 未显式声明 → 类型为 any；赋给 `string` 变量泄漏
- **Before / After**

```ts
// src/config/fetcherConfig.ts
const base = import.meta.env.VITE_API_BASE_URL ?? defaultUrl    // ❌ any

// vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_AKSHARE_BASE_URL?: string
  // 缺少 VITE_API_BASE_URL / VITE_WS_URL / VITE_QWEN_API_KEY 等
}
```

```ts
// ✅ After：在 vite-env.d.ts 补齐声明（根因修复，一处声明 N 处清零）
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_QWEN_API_KEY?: string
  readonly VITE_DATA_SOURCE_TYPE?: string
  readonly VITE_TUSHARE_TOKEN?: string
}
```

- **实践参考**：[vite-env.d.ts](file:///d:/FinSightV9/src/vite-env.d.ts) + 受惠文件 [fetcherConfig.ts](file:///d:/FinSightV9/src/config/fetcherConfig.ts)、[llmSearchAgent.ts](file:///d:/FinSightV9/src/services/data-collector/llmSearchAgent.ts)、[cockpit.constants.ts](file:///d:/FinSightV9/src/constants/cockpit.constants.ts)、[tushareProvider.ts](file:///d:/FinSightV9/src/services/data-collector/tushareProvider.ts)、[fetcherClient.ts](file:///d:/FinSightV9/src/services/fetcher/fetcherClient.ts)
- **自动化风险点**：需扫描 `import.meta.env.VITE_` 全仓引用，与 vite-env.d.ts 做差集补齐；必须用 `?: string`（optional），避免 `?? null` 与 `string \| undefined` 返回类型不兼容

---

### 模式 07：`String.replace` / `.map` 回调参数无类型

- **触发规则**：`no-unsafe-assignment`、`no-unsafe-argument`
- **根因**：回调 `(_, c) => c.toUpperCase()` 中 `c` 的类型从左侧变量推断失败 → 隐式 any
- **Before / After**

```ts
// ❌ Before
return base.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
obj.map((item) => sanitizeObject(item, maxDepth - 1, seen)) as unknown as T
```

```ts
// ✅ After：在回调参数位置显式标注类型
return base.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())
obj.map((item: unknown) => sanitizeObject(item, maxDepth - 1, seen)) as unknown as T
.replace(/'([^']*)'/g, (_m: string, body: string) => `"${body}"`)
```

- **实践参考**：[cascadeExecutor.ts](file:///d:/FinSightV9/src/core/cascadeExecutor.ts)、[jsonParser.ts](file:///d:/FinSightV9/src/services/llm/jsonParser.ts)、[validation.ts](file:///d:/FinSightV9/src/lib/validation.ts)
- **自动化风险点**：AST 级提取回调参数个数，从已知规则（正则替换第 1 参数是 string；map 回调第 1 参数元素类型为 unknown）机械套用；不可用上下文推理

---

### 模式 08：第三方库 `as any` 返回（XLSX.write 等）

- **触发规则**：`no-unsafe-assignment`
- **根因**：`XLSX.write(wb, { type: 'array' })` 返回类型声明为 `any`；下游需要 `ArrayBuffer`
- **Before / After**

```ts
// ❌ Before
const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
const blob = new Blob([buffer], { ... })
```

```ts
// ✅ After：`as ArrayBuffer` / `as Uint8Array`（按 type 参数匹配）
const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
const blob = new Blob([buffer], { ... })
```

- **实践参考**：[strategySnapshotExport.ts](file:///d:/FinSightV9/src/domain/export/strategySnapshotExport.ts)（3 处）、[backtestExportService.ts](file:///d:/FinSightV9/src/services/export/backtestExportService.ts)
- **自动化风险点**：需根据 `type: 'array' | 'binary' | 'string' | 'buffer'` 映射目标类型；同文件批量出现 >2 次时可一次扫完

---

### 模式 09：`localStorage.getItem + JSON.parse` 无断言

- **触发规则**：`no-unsafe-assignment`
- **根因**：读写对之间缺少类型约束；读到的内容以 any 形式泄漏给 UI 配置、mock 数据
- **Before / After**

```ts
// ❌ Before
const stored = localStorage.getItem(LLM_CONFIG_KEY)
return stored ? JSON.parse(stored) : {}    // 泄漏给 PartialLlmConfig
```

```ts
// ✅ After：`as TargetType`，并保留 `: {}` 空对象默认值
return stored ? (JSON.parse(stored) as PartialLlmConfig) : {}
```

- **实践参考**：[ConfigApp.tsx](file:///d:/FinSightV9/src/apps/command/ConfigApp.tsx)、[mockDataGenerator.ts](file:///d:/FinSightV9/src/services/trading/mockDataGenerator.ts)、[llmSearchCache.ts](file:///d:/FinSightV9/src/services/data-collector/llmSearchCache.ts)
- **自动化风险点**：目标类型需从函数返回值或左侧变量反推；CacheEntry<T> 类泛型用 `as CacheEntry<T>`

---

### 模式 10：`payload[0]` / `arr[i]` 索引裸取

- **触发规则**：`no-unsafe-assignment`（`any[] → unknown[]` 型）
- **根因**：`unknown[]` 访问后得到 `any`；后续再做类型判断即泄漏
- **Before / After**

```ts
// ❌ Before（databridge handler 通用路径）
const firstItem = payload[0]
return firstItem.kind === '...'
```

```ts
// ✅ After：显式 unknown 接住
const firstItem: unknown = payload[0]
return typeof firstItem === 'object' && firstItem !== null
  && (firstItem as Record<string, unknown>).kind === '...'
```

- **实践参考**：[databridge.ts](file:///d:/FinSightV9/src/core/databridge.ts)
- **自动化风险点**：当且仅当上游 payload 类型为 `unknown[]` 时用 `: unknown`；若是 `any[]` 需走模式 01/13

---

### 模式 11：`toSafeArray<T>(value)` 未做 `as T[]`

- **触发规则**：`no-unsafe-return`
- **根因**：`Array.isArray(value)` 仅能把 `unknown` 收窄到 `unknown[]`，无法直接等价 `T[]`
- **Before / After**

```ts
// ❌ Before
export function toSafeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []    // unknown[] → T[]
}
```

```ts
// ✅ After：显式 `as T[]`（由调用方决定 T）
export function toSafeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}
```

- **实践参考**：[safeCoerce.ts](file:///d:/FinSightV9/src/lib/safeCoerce.ts)
- **自动化风险点**：仅在签名含 `<T>` 的泛型工具函数适用；非泛型函数应写 `as TargetType[]`

---

### 模式 12：`process.env.XXX || default` 恒真判定

- **触发规则**：`prefer-nullish-coalescing` + 关联的 `no-unsafe-assignment`（当 default 为 any 时）
- **根因**：`||` 会把空字符串视为 falsy，与 "环境变量未设置" 语义不一致；在 V9 代码中多伴生 `any` 流入
- **Before / After**

```ts
// ❌ Before
const envDir = process.env.LLM_SEARCH_CACHE_DIR
return envDir || path.join(process.cwd(), 'cache', 'llm-search')
```

```ts
// ✅ After：`?? ''` + 显式空串比较
const envDir = process.env.LLM_SEARCH_CACHE_DIR ?? ''
return envDir !== '' ? envDir : path.join(process.cwd(), 'cache', 'llm-search')
```

- **实践参考**：[llmSearchCache.ts](file:///d:/FinSightV9/src/services/data-collector/llmSearchCache.ts)、[tushareProvider.ts](file:///d:/FinSightV9/src/services/data-collector/tushareProvider.ts)（`?? null` 确保与 `string \| null` 返回签名一致）
- **自动化风险点**：`?? null` vs `?? ''` 需看函数签名；误将 `?? null` 写 `?? ''` 会触发 tsc 返回类型不兼容错误

---

### 模式 13：JSON.parse 结构化校验（`Partial<Record>` 守卫）

- **触发规则**：全域（assignment/member/call/argument/return 常同时出现）
- **根因**：模式 01-A 仅做 `as 类型` 断言，遇到损坏数据仍会在运行时崩溃；对外部文件 / 用户上传 / 跨进程消息应做真守卫
- **Before / After**

```ts
// ❌ Before
const snapshot: Snapshot = JSON.parse(json)
if (!snapshot.id || !Array.isArray(snapshot.stores)) throw 'bad'
return snapshot.stores.map(s => s.records.length)  // s.records 已 any
```

```ts
// ✅ After：unknown → Record<string, unknown> → Partial<T>，逐项守卫
let parsed: unknown
try { parsed = JSON.parse(json) } catch { throw 'not JSON' }

const obj: Record<string, unknown> =
  typeof parsed === 'object' && parsed !== null ? parsed : {}
if (typeof obj.id !== 'string' || !Array.isArray(obj.stores)) throw 'bad'

const snapshot: Snapshot = {
  id: obj.id,
  label: typeof obj.label === 'string' ? obj.label : '',
  timestamp: typeof obj.timestamp === 'number' ? obj.timestamp : 0,
  stores: obj.stores as StoreSnapshot[],
}
```

- **实践参考**：[SnapshotManager.ts](file:///d:/FinSightV9/src/services/storage/SnapshotManager.ts)（importSnapshot + parseStoreSnapshots）、[tradingServer.ts](file:///d:/FinSightV9/src/mcp/servers/trading/tradingServer.ts)（parseLLMResponse 含 `toDisplay` 辅助）、[dataflowEngine.ts](file:///d:/FinSightV9/src/core/dataflow/dataflowEngine.ts)（SSE packet）、[embeddingMigration.ts](file:///d:/FinSightV9/src/services/system/embeddingMigration.ts)
- **自动化风险点**：属于"手写结构+字段枚举"型，**不适合脚本直接生成**，建议脚本将命中的 JSON.parse 点标注为模式 13 候选项，由人工在 PR review 中二次裁定

---

### 模式 14：统一解析辅助函数（DRY：同文件 2+ 解析点）

- **触发规则**：全域
- **根因**：同文件多处 `JSON.parse`，按模式 01/13 各自重复代码，维护成本高且易漏字段
- **Before / After（SnapshotManager 为例）**

```ts
// ❌ Before：restoreSnapshot / diffSnapshots / importSnapshot / importFromFile 四处裸解析
const stores: StoreSnapshot[] = JSON.parse(json)   // ×4
```

```ts
// ✅ After：同文件顶部写 parseStoreSnapshots() 辅助，统一调用
function parseStoreSnapshots(json: string): StoreSnapshot[] {
  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) throw 'expected store array'
  return parsed.map((entry: unknown, i: number) => {
    if (typeof entry !== 'object' || entry === null) throw `entry #${i} not object`
    const obj = entry as Record<string, unknown>
    if (typeof obj.name !== 'string' || !Array.isArray(obj.records)) throw `entry #${i} missing`
    return { name: obj.name, records: obj.records as SnapshotRecord[] }
  })
}

const stores = parseStoreSnapshots(json)   // ×4 处全部改为辅助调用
```

- **实践参考**：[SnapshotManager.ts](file:///d:/FinSightV9/src/services/storage/SnapshotManager.ts)
- **自动化风险点**：同文件解析计数 ≥2 时，脚本可先输出"建议抽取辅助函数"的报告，不改代码（避免人工后续合并冲突）；计数 =1 直接套用模式 01/13

---

## 3. 次生效应对

以下 3 类告警常在 no-unsafe 修复时被触发，脚本/人工都需识别，不应盲目上 `eslint-disable`：

| 次生效 | 触发原因 | 推荐消解 |
|--------|----------|----------|
| `@typescript-eslint/no-base-to-string` | `String(unknown_value)` | 改用 `typeof x === 'string' ? x : String(x as unknown)` 或包装 `toDisplay(x)` 辅助 |
| `@typescript-eslint/strict-boolean-expressions` | `if (obj.score)` 改为 `typeof obj.score !== 'number'` 或 `??` 比较 | 当 obj.score 可能为 `0` / `false` 合法值时用类型判断；纯"是否设置"用 `!== undefined` |
| `@typescript-eslint/prefer-nullish-coalescing` | 引入 `||` 的地方 | 一律用 `??`；如需区分空字符串用 `?? '' + 显式 !== ''` |

---

## 4. 自动化脚本（GOV-P1-02）输入约束

脚本 `scripts/audit/apply-no-unsafe-fix-patterns.cjs` 的输入输出规范如下：

- **输入**：eslint JSON 报告（`npx eslint src --format json -o report.json`）
- **流程**：
  1. 扫描 `messages[].ruleId` 前缀 `@typescript-eslint/no-unsafe-` 全部条目
  2. 按文件聚合，每文件统计违规数 → 对应模式优先级队列（模式 03/06 低难度先处理，模式 13/14 不改动、只输出报告）
  3. 每文件生成 AST 替换补丁（JSON Patch format，输出到 stdout 或 `.patch.json`）
  4. 生成 `nounsafe-dryrun-summary.md（已废弃）`，列出：
     - ✅ 可自动修复（模式 02/03/06/07/08/09/10/11/12）
     - ⚠️ 半自动（模式 01/04/05）—— 已生成补丁但依赖类型推断
     - 🛑 人工（模式 13/14）—— 仅输出候选，需人工裁定
- **出口**：不直接 `fs.writeFile` 改源码；输出补丁文件由开发者 `git apply` 或二次审阅；防止批处理引入语法破坏
- **验证钩子**：每批文件补丁应用后自动跑 `eslint --fix-dry-run`；若还有剩余告警则回滚该文件补丁并记录到失败报告

---

## 5. 验收清单（DoD）

- [ ] 生产域 `no-unsafe-*` 总条数 = 0（`eslint --format json` 后按 ruleId 求和）
- [ ] `tsc:prod` 零错误（不允许为了清零引入 `as any`）
- [ ] 受影响域测试通过（不接受 "测试早就是红的" 预存失败被误判为本轮失败，用 `git stash` 基线交叉验证）
- [ ] GOV-P1-02 自动化脚本至少覆盖模式 01/02/03/05/07/08/09/10/11/12（共 10 种，占已知样本 70%）
- [ ] 本手册 version 字段与 batch-04 治理文档进度同步
