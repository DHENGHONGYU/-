# V9 数据架构五大问题治理计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 治理 V9 数据架构的五个核心问题：Store 碎片化、刷新风暴、Python 依赖瓶颈、IndexedDB 无 JOIN、硬编码残留，并逐项验证。

**Architecture:** 采用渐进式治理策略——P0 删除死代码（零风险），P1 在 DataBridge broadcast 中引入优先级队列和重入锁保护（低侵入），P2 抽象 DataSourceProvider 接口解耦 Python 依赖（中侵入），P3 引入 queryBuilder 封装跨 Store 聚合查询（低侵入），P4 硬编码提取到常量（持续治理）。

**Tech Stack:** TypeScript, Zustand, Vitest (jsdom + fake-indexeddb)

---

## 前置条件（必读）

### 约束
- 所有 Page 组件必须处理 isLoading 状态
- 所有 engine 计算必须零硬编码数字/字符串
- L3/L4/L7/L8 是确定性层，L0/L1/L2/L5/L6 是 LLM 增强层
- 新模块必须遵循四步集成合同（类型定义 → Store → Builder → 核心集成）
- 测试必须在修改代码之前编写（TDD Red-Green-Refactor）

### 关键发现
- **hotSectorStore / valuePitStore / rotationSignalStore** 三个 Store 已标记 `@deprecated`，**零页面/组件消费者**，是可安全删除的死代码
- **DataFlowEngine ChannelMeta 已定义 `priority: 'high'|'normal'|'low'`** 但未用于调度排序
- **6 个 Store 中仅 3 个有 isRefreshing 防重入锁**（signalStore/dualStrategyStore/disciplineStore），orderStore/holdingsStore/poolStore 和 positionStore 无保护
- **DataSourceProvider 接口不存在**，需新建
- **跨 Store JOIN 核心场景在 dataFusionEngine.ts**（6 Store 并行查询后内存聚合）
- **现有测试 80+ 文件**，覆盖 fetcher/scoring/trading/strategy 等模块，盲区在 fetcherClient、dataFusionEngine、unifiedStockService

---

## Batch A — Store 碎片化治理（P0，零风险删除）

### Task 1: 删除 3 个废弃 Store 文件

**Files:**
- Delete: `src/store/hotSectorStore.ts`
- Delete: `src/store/valuePitStore.ts`
- Delete: `src/store/rotationSignalStore.ts`
- Delete: `tests/hotSectorStore.test.ts`
- Delete: `tests/valuePitStore.test.ts`
- Delete: `tests/rotationSignalStore.test.ts`
- Modify: `src/store/dualStrategyStore.ts` — 移除文件头 `@deprecated` 相关注释（如有引用旧 Store）
- Test: 运行全量测试确认无编译错误

- [ ] **Step 1: 验证无消费者引用**

```bash
# 在项目根目录执行
grep -r "hotSectorStore" src/ --include="*.ts" --include="*.tsx" -l
grep -r "valuePitStore" src/ --include="*.ts" --include="*.tsx" -l
grep -r "rotationSignalStore" src/ --include="*.ts" --include="*.tsx" -l
```
Expected: 无任何 src/ 下的非自身文件引用（仅 db.ts 的 objectStore schema 定义除外，不影响运行）

- [ ] **Step 2: 删除 6 个废弃文件**

```bash
rm src/store/hotSectorStore.ts src/store/valuePitStore.ts src/store/rotationSignalStore.ts
rm tests/hotSectorStore.test.ts tests/valuePitStore.test.ts tests/rotationSignalStore.test.ts
```

- [ ] **Step 3: 运行全量测试确认无破坏**

```bash
npx vitest run
```
Expected: 全部 PASS，无编译错误

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: remove 3 deprecated stores (hotSector/valuePit/rotationSignal) and their tests"
```

---

## Batch B — 刷新风暴治理（P0，低侵入修复）

### Task 2: 为 orderStore/holdingsStore/poolStore 添加 isRefreshing 防重入锁

**Files:**
- Modify: `src/store/orderStore.ts` — initOrderStoreSubscriptions 的 debounce callback 中添加 isRefreshing 检查
- Modify: `src/store/holdingsStore.ts` — 同上
- Modify: `src/store/poolStore.ts` — 同上
- Test: `tests/storeSubscriptions.test.ts`

- [ ] **Step 1: 编写失败测试 — orderStore 去抖后无重入保护**

在 `tests/storeSubscriptions.test.ts` 中添加：

```typescript
describe('[Batch B] orderStore isRefreshing guard', () => {
  it('should skip refresh when isRefreshing is true', async () => {
    const { initOrderStoreSubscriptions } = await import('../src/store/orderStore')
    const cleanup = initOrderStoreSubscriptions()

    // 设置 isRefreshing = true
    useOrderStore.setState({ isRefreshing: true })

    // 模拟 broadcast 触发 debounce callback
    // ...
    // 验证 refresh 未被再次调用

    cleanup()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/storeSubscriptions.test.ts
```
Expected: FAIL — isRefreshing guard 尚未实现

- [ ] **Step 3: 在 orderStore.ts 的 debounce callback 中添加 isRefreshing 检查**

```typescript
// 在 debounce 回调中，调用 refresh() 之前添加：
if (getState().isRefreshing) return
```

同时确保 state 中添加 `isRefreshing: boolean` 字段（如果不存在），并在 refresh 开始时设为 true、完成时设为 false。

- [ ] **Step 4: 对 holdingsStore.ts 和 poolStore.ts 重复 Step 3**

- [ ] **Step 5: 运行测试确认通过**

```bash
npx vitest run tests/storeSubscriptions.test.ts
```
Expected: PASS

- [ ] **Step 6: 运行全量测试**

```bash
npx vitest run
```
Expected: 全部 PASS

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "fix: add isRefreshing guard to orderStore/holdingsStore/poolStore debounce callbacks"
```

---

### Task 3: 为 positionStore 添加去抖 + isRefreshing 保护

**Files:**
- Modify: `src/store/positionStore.ts` — initPositionStoreSubscriptions 中添加 200ms 去抖 + isRefreshing 锁
- Test: `tests/storeSubscriptions.test.ts`

- [ ] **Step 1: 编写失败测试**

```typescript
describe('[Batch B] positionStore debounce + isRefreshing guard', () => {
  it('should debounce recomputeFromOrders and skip when isRefreshing', async () => {
    // 验证高频 orders 变化不会每次都触发 recompute
    // 验证 isRefreshing=true 时不触发 recompute
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 实现 positionStore 去抖 + isRefreshing**

```typescript
// initPositionStoreSubscriptions 中：
let _debounceTimer: ReturnType<typeof setTimeout> | null = null
const _isRefreshing = { value: false }

useOrderStore.subscribe(
  (state) => state.orders,
  (orders) => {
    if (_isRefreshing.value) return
    if (_debounceTimer) clearTimeout(_debounceTimer)
    _debounceTimer = setTimeout(() => {
      _isRefreshing.value = true
      usePositionStore.getState().recomputeFromOrders(orders)
        .finally(() => { _isRefreshing.value = false })
    }, 200)
  }
)
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/storeSubscriptions.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "fix: add debounce + isRefreshing guard to positionStore subscriptions"
```

---

### Task 4: DataBridge broadcast 引入优先级调度队列

**Files:**
- Create: `src/core/priorityBroadcastQueue.ts`
- Modify: `src/core/databridge.ts` — broadcast() 方法中引入 queueMicrotask 优先级排序
- Test: `tests/priorityBroadcastQueue.test.ts`
- Test: `tests/databridge.test.ts`

- [ ] **Step 1: 编写失败测试 — PriorityBroadcastQueue**

```typescript
// tests/priorityBroadcastQueue.test.ts
describe('PriorityBroadcastQueue', () => {
  it('should execute high priority callbacks before normal and low', async () => {
    const executionOrder: string[] = []
    const queue = new PriorityBroadcastQueue()

    queue.subscribe('orders', () => executionOrder.push('normal'), 'normal')
    queue.subscribe('orders', () => executionOrder.push('high'), 'high')
    queue.subscribe('orders', () => executionOrder.push('low'), 'low')

    queue.broadcast('orders', mockEnvelope)
    expect(executionOrder).toEqual(['high', 'normal', 'low'])
  })

  it('should maintain default behavior when no priority specified', () => {
    // 无 priority 时按注册顺序执行（向后兼容）
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/priorityBroadcastQueue.test.ts
```

- [ ] **Step 3: 实现 PriorityBroadcastQueue**

```typescript
// src/core/priorityBroadcastQueue.ts
export interface PrioritizedSubscriber {
  callback: (envelope: StandardEnvelope) => void
  priority: 'high' | 'normal' | 'low'
  order: number // 注册顺序，同优先级内排序用
}

export class PriorityBroadcastQueue {
  private subscribers = new Map<string, PrioritizedSubscriber[]>()
  private counter = 0

  subscribe(channel: string, cb: (envelope: StandardEnvelope) => void, priority: 'high' | 'normal' | 'low' = 'normal'): () => void {
    // 注册 subscriber，记录 priority 和 order
    // 返回 unsubscribe 函数
  }

  broadcast(channel: string, envelope: StandardEnvelope): void {
    const subs = this.subscribers.get(channel)
    if (!subs) return
    // 按 priority 排序: high > normal > low，同优先级按 order
    const sorted = [...subs].sort((a, b) => {
      const p = { high: 0, normal: 1, low: 2 }
      return p[a.priority] !== p[b.priority] ? p[a.priority] - p[b.priority] : a.order - b.order
    })
    sorted.forEach(s => { try { s.callback(envelope) } catch(e) { /* log */ } })
  }
}
```

- [ ] **Step 4: 在 databridge.ts 的 broadcast() 中使用 PriorityBroadcastQueue**

向后兼容改造：
1. 保持现有 `subscribers` Map 结构不变
2. 将 `subscribers` 的 callback 类型扩展为带可选 priority
3. 在 broadcast forEach 前按 priority 排序
4. 不改变 API 签名，默认 priority='normal'

- [ ] **Step 5: 运行全部测试**

```bash
npx vitest run tests/priorityBroadcastQueue.test.ts tests/databridge.test.ts
```
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add PriorityBroadcastQueue to DataBridge broadcast for priority-ordered subscriber execution"
```

---

## Batch C — Python 依赖瓶颈治理（P1，中侵入抽象）

### Task 5: 创建 DataSourceProvider 接口与 AkshareProvider 实现

**Files:**
- Create: `src/services/fetcher/types.ts` — DataSourceProvider 接口定义
- Create: `src/services/fetcher/akshareProvider.ts` — 基于 fetcherClient 的 AkShare 适配
- Create: `src/services/fetcher/mockProvider.ts` — 内存 Mock 数据源（离线降级用）
- Create: `src/services/fetcher/dataSourceRegistry.ts` — 数据源注册表
- Modify: `src/services/fetcher/fetcherService.ts` — 注入 Provider 而非直接调用 fetcherClient
- Test: `tests/fetcher/dataSourceProvider.test.ts`

- [ ] **Step 1: 编写接口测试**

```typescript
// tests/fetcher/dataSourceProvider.test.ts
describe('DataSourceProvider interface contract', () => {
  it('AkshareProvider implements DataSourceProvider', async () => {
    const provider = new AkshareProvider({ baseURL: 'http://localhost:8000', timeout: 5000 })
    expect(provider.name).toBe('akshare')
    // 测试 healthCheck() 在服务不可用时返回 unhealthy
    const health = await provider.healthCheck()
    // localhost:8000 大概率不可用
    expect(['healthy', 'unhealthy']).toContain(health.status)
  })

  it('MockProvider provides fallback data without network', async () => {
    const provider = new MockProvider()
    const health = await provider.healthCheck()
    expect(health.status).toBe('healthy')
    const data = await provider.fetchBasicData(['000001'])
    expect(data.length).toBeGreaterThan(0)
  })

  it('DataSourceRegistry supports fallback chain', async () => {
    const registry = new DataSourceRegistry()
    registry.register(new MockProvider())
    registry.register(new AkshareProvider({ baseURL: 'http://localhost:8000' }))
    // 第一个 healthy 的 provider 应被选中
    const active = await registry.getActiveProvider()
    expect(active.name).toBe('mock') // akshare 不可用时降级到 mock
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/fetcher/dataSourceProvider.test.ts
```

- [ ] **Step 3: 定义 DataSourceProvider 接口**

```typescript
// src/services/fetcher/types.ts
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown'
  latency?: number
  error?: string
}

export interface BasicDataResult {
  symbol: string
  name: string
  price: number
  changePercent: number
  volume: number
  // ... 按 fetcherService 实际需要的字段
}

export interface KlineDataResult {
  symbol: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface DataSourceProvider {
  readonly name: string
  healthCheck(): Promise<HealthStatus>
  fetchBasicData(symbols: string[]): Promise<BasicDataResult[]>
  fetchKlineData(symbol: string, period: string): Promise<KlineDataResult[]>
}
```

- [ ] **Step 4: 实现 AkshareProvider（包装现有 fetcherClient）**

将 `fetcherClient` 的 `collectBasic`/`collectKline`/`healthCheck` 适配到 `DataSourceProvider` 接口。不修改 fetcherClient 本身，只在外层包装。

- [ ] **Step 5: 实现 MockProvider（内存数据，离线降级）**

提供预置的 A 股基础数据（10 只股票的模拟行情），不需要网络连接。

- [ ] **Step 6: 实现 DataSourceRegistry（自动健康检查 + 降级）**

```typescript
export class DataSourceRegistry {
  private providers: DataSourceProvider[] = []

  register(provider: DataSourceProvider): void
  async getActiveProvider(): Promise<DataSourceProvider>
  // 遍历 providers，返回第一个 healthCheck() === 'healthy' 的
  // 如果全部 unhealthy，返回最后一个注册的（降级策略）
}
```

- [ ] **Step 7: 修改 fetcherService 注入 Provider**

在 fetcherService 的采集方法中，通过 Registry 获取 active provider，而非直接调用 fetcherClient。保留 fetcherClient 作为 AkshareProvider 的底层实现。

- [ ] **Step 8: 运行测试**

```bash
npx vitest run tests/fetcher/dataSourceProvider.test.ts
npx vitest run tests/fetcher/fetcherService.test.ts
```
Expected: 全部 PASS

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "feat: abstract DataSourceProvider interface with Akshare/Mock providers and auto-fallback registry"
```

---

## Batch D — IndexedDB 跨 Store JOIN 治理（P1，低侵入封装）

### Task 6: 创建 QueryBuilder 封装跨 Store 聚合查询

**Files:**
- Create: `src/data/queryBuilder.ts` — QueryBuilder 工具类
- Modify: `src/services/analysis/dataFusionEngine.ts` — 使用 QueryBuilder 替代手动 Promise.all
- Test: `tests/queryBuilder.test.ts`

- [ ] **Step 1: 编写失败测试**

```typescript
// tests/queryBuilder.test.ts
describe('QueryBuilder', () => {
  it('should join stock with scores in single call', async () => {
    // 测试 QueryBuilder 按 symbol 同时获取 stocks + v6Scores + intelligentScores
    // 返回合并后的 UnifiedStockData 对象
  })

  it('should handle missing data gracefully (stock exists but no score)', async () => {
    // 验证部分数据缺失时不会 throw，而是填充 null/undefined
  })

  it('should batch multiple symbols efficiently', async () => {
    // 验证批量查询时使用 Promise.all 并行而非串行
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/queryBuilder.test.ts
```

- [ ] **Step 3: 实现 QueryBuilder**

```typescript
// src/data/queryBuilder.ts
export interface UnifiedStockQuery {
  symbol: string
  includeBasic?: boolean
  includeQuotes?: boolean
  includeV6Score?: boolean
  includeIntelligentScore?: boolean
  includeIndustryScore?: boolean
  includeSignals?: boolean
  includeNews?: boolean
}

export interface UnifiedStockData {
  stock?: Stock
  quotes?: DailyQuotes
  v6Score?: V6Score
  intelligentScore?: IntelligentScore
  industryScore?: IndustryScore
  signals?: Signal[]
  news?: NewsArticle[]
}

export class QueryBuilder {
  constructor(private dataLayer: DataLayer) {}

  async queryStock(params: UnifiedStockQuery): Promise<UnifiedStockData> {
    const tasks: Promise<any>[] = []
    if (params.includeBasic) tasks.push(this.dataLayer.stocks.get(params.symbol).catch(() => null))
    if (params.includeV6Score) tasks.push(this.dataLayer.v6Scores.get(params.symbol).catch(() => null))
    // ... 其他维度

    const results = await Promise.all(tasks)
    // 组装为 UnifiedStockData
  }

  async queryStocksBatch(symbols: string[], params: Omit<UnifiedStockQuery, 'symbol'>): Promise<Map<string, UnifiedStockData>> {
    // 批量并行查询
  }
}
```

- [ ] **Step 4: 在 dataFusionEngine.ts 中使用 QueryBuilder**

替换手动 6 次 dataLayer 调用为 `queryBuilder.queryStock({ symbol, includeBasic: true, includeV6Score: true, ... })`

- [ ] **Step 5: 运行测试**

```bash
npx vitest run tests/queryBuilder.test.ts
npx vitest run
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add QueryBuilder for cross-store aggregated queries, used in dataFusionEngine"
```

---

## Batch E — 硬编码残留治理（P2，持续渐进）

### Task 7: 提取组件 HEX 颜色到 chartColors 配置

**Files:**
- Modify: `src/config/chartColors.ts` — 扩展颜色常量
- Test: `tests/chartColors.test.ts`

- [ ] **Step 1: 扫描残留 HEX 硬编码**

```bash
grep -rn "#[0-9a-fA-F]\{6\}" src/components/ --include="*.tsx" --include="*.ts" | head -30
```

- [ ] **Step 2: 将高频出现的 HEX 颜色提取到 chartColors.ts**

将重复 >=3 次的 HEX 值提取为语义化命名常量（如 `CHART_UP_COLOR`, `CHART_DOWN_COLOR`, `CHART_NEUTRAL_COLOR`）。

- [ ] **Step 3: 编写测试验证颜色常量完整性**

```typescript
describe('chartColors', () => {
  it('should export all semantic color constants', () => {
    expect(CHART_UP_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(CHART_DOWN_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})
```

- [ ] **Step 4: 运行全量测试**

```bash
npx vitest run
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: extract repeated HEX colors to chartColors constants"
```

---

### Task 8: 提取高频魔法数字到 thresholds 配置

**Files:**
- Modify: `src/config/thresholds.ts` — 添加新阈值
- Test: `tests/thresholds.test.ts`

- [ ] **Step 1: 扫描高频魔法数字**

```bash
# 搜索组件中的数字字面量（排除 0, 1, -1, 100 等通用值）
grep -rn "\b[2-9][0-9]\{2,\}\b" src/components/ --include="*.tsx" | head -20
```

- [ ] **Step 2: 将业务含义明确的数字提取到 thresholds.ts**

- [ ] **Step 3: 编写测试验证阈值覆盖**

- [ ] **Step 4: 运行全量测试**

```bash
npx vitest run
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: extract magic numbers to thresholds config"
```

---

## 执行顺序与验收标准

| 批次 | Task | 风险 | 预估时间 | 依赖 |
|------|------|------|---------|------|
| **Batch A** | Task 1: 删除废弃 Store | 零风险 | 10 min | 无 |
| **Batch B** | Task 2: Store isRefreshing 锁 | 低 | 20 min | 无 |
| **Batch B** | Task 3: positionStore 去抖 | 低 | 15 min | 无 |
| **Batch B** | Task 4: 优先级广播队列 | 低 | 30 min | 无 |
| **Batch C** | Task 5: DataSourceProvider | 中 | 45 min | 无 |
| **Batch D** | Task 6: QueryBuilder | 低 | 30 min | 无 |
| **Batch E** | Task 7: 颜色常量提取 | 低 | 15 min | 无 |
| **Batch E** | Task 8: 魔法数字提取 | 低 | 15 min | 无 |

**每个 Batch 完成后需运行 `npx vitest run` 全量测试确认无回归。**

**最终验收：**
- [ ] Store 文件数从 30+ 降至 ~27（删除 3 个废弃 Store）
- [ ] 全部 6 个订阅 Store 均有 isRefreshing 防重入锁
- [ ] DataBridge broadcast 支持优先级排序
- [ ] fetcherService 通过 DataSourceProvider 接口调用数据源，支持 Mock 降级
- [ ] dataFusionEngine 通过 QueryBuilder 执行跨 Store 查询
- [ ] 全量测试 80+ 文件全部 PASS
