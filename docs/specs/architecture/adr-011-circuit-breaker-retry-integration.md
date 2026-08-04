---
title: ADR-011 熔断器与重试机制集成架构
status: proposed
date: 2026-08-04
doc_id: V9-ADR-011
type: adr
domain: architecture
tier: T1
related_files:
  - src/services/fetcher/fetcherClient.ts
  - src/services/resilience.ts
  - src/store/sevenDimConfigStore.ts
  - tests/__tests__/integration/infrastructure-extreme.test.ts
---

# ADR-011: 熔断器与重试机制集成架构

## 状态（Status）

提议中（Proposed），2026-08-04。

## 背景（Context）

### 现有架构

当前 `fetcherClient.ts` 的容错链路为**单层线性重试**，无熔断保护：

```
collectBasic(symbol)
  └─> request(path, options, retries=3)
        └─> for attempt 0..3
              └─> tryRequest → fetchWithTimeout → fetch
              └─> 失败且为 TypeError/FetcherError → 继续重试
        └─> 全部耗尽 → throw FetcherError("服务未启动或无法连接")
```

`src/services/resilience.ts` 已实现完整的熔断器（`createCircuitBreaker`），具备 closed → open → half-open → closed 状态机，但**未被 `fetcherClient` 或 `sevenDimConfigStore` 引用**（R2 覆盖报告 §1 确认）。

### 问题

| 问题 | 影响 |
|------|------|
| 数据源持续宕机时，每次采集调用都走完整 4 次 fetch 重试 | 无谓的网络请求堆积，加剧服务端压力 |
| 无快速失败机制 | UI 层需等待 30s × 4 = 120s 才能感知"服务不可达" |
| `sevenDimConfigStore.runCollection` 7 维并发，每维 4 次重试 | 最坏情况 28 次无效请求 |
| 熔断器已实现但闲置 | 代码资产浪费，已有 10 个测试用例验证的模块未被生产路径使用 |

## 决策（Decision）

### 方案选择：熔断器包裹重试循环（Breaker wraps Retry）

```
                ┌──────────────────────────────────────┐
                │          CircuitBreaker              │
                │  (closed / open / half-open)         │
                │                                      │
                │  ┌────────────────────────────────┐  │
请求 ──────────→│  │       Retry Loop               │  │
                │  │  (attempt 0..maxRetries)       │  │
                │  │  ┌──────────────────────────┐  │  │
                │  │  │   tryRequest (单次请求)   │  │  │
                │  │  │   fetchWithTimeout        │  │  │
                │  │  └──────────────────────────┘  │  │
                │  └────────────────────────────────┘  │
                └──────────────────────────────────────┘
```

**核心原则**：熔断器将"一次完整重试循环"视为一个原子单元。

- 重试循环全部成功 → 熔断器计 1 次 success
- 重试循环全部耗尽 → 熔断器计 1 次 failure
- 熔断器 open → 直接 reject `CircuitOpenError`，不进入重试循环

**否决方案**：重试包裹熔断器（Retry wraps Breaker）

```
withRetry(() => breaker.execute(tryRequest))  // ❌ 否决
```

此方案下，熔断器 open 时抛出 `CircuitOpenError`，重试循环会将其视为可重试错误继续重试——但熔断器 open 状态不会因重试而改变，导致无意义的 N 次拒绝。

### 集成方案

#### 方案 A：最小改动（推荐第一步）

在 `fetcherClient.ts` 的 `request()` 函数外层包裹单例熔断器，保留现有线性重试不变。

```typescript
// fetcherClient.ts 新增

import { createCircuitBreaker, CircuitOpenError, type CircuitBreaker } from '@/services/resilience'

// 单例熔断器：fetcherClient 全局共享一个实例
let _breaker: CircuitBreaker | null = null
function getBreaker(): CircuitBreaker {
  if (!_breaker) {
    _breaker = createCircuitBreaker({
      failureThreshold: 5,      // 连续 5 轮重试全失败 → 熔断
      resetTimeoutMs: 60_000,   // 熔断 60s 后尝试半开探测
      successThreshold: 2,      // 半开状态下连续 2 次成功 → 恢复
    })
  }
  return _breaker
}

// 修改 request() 函数
async function request<T>(path: string, options: RequestInit = {}, retries?: number): Promise<T> {
  const breaker = getBreaker()
  return breaker.execute(async () => {
    // ── 原有重试循环逻辑保持不变 ──
    const maxRetries = retries ?? getConfig().retries
    let lastError: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await tryRequest<T>(path, options, getConfig().timeoutMs)
      if (result.ok) return result.data
      lastError = result.error
      const isNetworkError = result.error instanceof TypeError || result.error instanceof FetcherError
      if (!isNetworkError || attempt === maxRetries) break
      logger.warn(`[fetcherClient] 请求失败，第 ${attempt + 1} 次重试`, { path, err: result.error })
    }
    if (lastError instanceof TypeError) {
      throw new FetcherError('数据采集服务未启动或无法连接，请检查 Python 服务是否运行', lastError)
    }
    throw lastError instanceof Error
      ? new FetcherError(lastError.message, lastError)
      : new FetcherError(String(lastError), lastError)
    // ── 重试循环结束 ──
  })
}
```

#### 方案 B：完整集成（推荐第二步）

用 `withResilience` 一站式替换 `request()` 内部逻辑，同时升级为指数退避重试。

```typescript
async function request<T>(path: string, options: RequestInit = {}, retries?: number): Promise<T> {
  const { retries: defaultRetries, timeoutMs } = getConfig()
  const maxRetries = retries ?? defaultRetries

  return withResilience(
    async () => {
      const result = await tryRequest<T>(path, options, timeoutMs)
      if (result.ok) return result.data
      throw result.error
    },
    {
      maxAttempts: maxRetries + 1,
      baseDelayMs: 500,
      maxDelayMs: 5_000,
      factor: 2,
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 60_000,
        successThreshold: 2,
      },
      fallback: undefined, // 不降级，让错误透出到上层
      context: { source: 'fetcherClient', operation: path },
    },
  )
}
```

### 错误传播链路

```
fetch(url) 超时/网络错误
  ↓
tryRequest 捕获 → { ok: false, error: TypeError }
  ↓
retry loop 重试 maxRetries 次，全部失败
  ↓
throw FetcherError("服务未启动或无法连接")
  ↓
breaker.execute 的 reject 回调 → failures++ → 达阈值 → state = 'open'
  ↓
breaker.execute throw FetcherError（原始错误透出）
  ↓
collectBasic catch → logger.error → throw err
  ↓
sevenDimConfigStore.runCollection → Promise.allSettled → failures.push(rejected)
  ↓
set({ error: "${N} 个维度采集失败" })
  ↓
下次调用 collectBasic → breaker.execute → state === 'open'
  ↓
直接 reject CircuitOpenError（不进入重试循环，不发任何网络请求）
  ↓
collectBasic catch → throw CircuitOpenError
  ↓
sevenDimConfigStore → Promise.allSettled → 全部 reject
  ↓
set({ error: "${N} 个维度采集失败" })  // 快速失败，无 120s 等待
```

### 状态机与重试的交互时序

```
时间轴 ─────────────────────────────────────────────────────────────→

T0   collectBasic('600519.SH')
     │ breaker.state = closed
     │ → retry: attempt 0 fail, attempt 1 fail, attempt 2 fail, attempt 3 fail
     │ → breaker.failures = 1
     │ → throw FetcherError
     │
T1   collectBasic('000001.SZ')
     │ breaker.state = closed, failures = 1
     │ → retry: 4 次全部失败
     │ → breaker.failures = 2
     │ → throw FetcherError
     │
...  （重复 3 次）
     │
T5   collectBasic('300750.SZ')
     │ breaker.state = closed, failures = 4
     │ → retry: 4 次全部失败
     │ → breaker.failures = 5 ≥ threshold
     │ → breaker.state = 'open', openedAt = T5
     │ → throw FetcherError
     │
T6   collectBasic('600036.SH')
     │ breaker.state = 'open', T6 - T5 < 60s
     │ → 立即 reject CircuitOpenError（0 次 fetch 调用）
     │ → collectBasic 抛出 CircuitOpenError
     │
T66s collectBasic('601318.SH')
     │ breaker.state = 'open', T66 - T5 = 61s ≥ 60s
     │ → breaker.state = 'half-open'
     │ → retry: attempt 0 成功
     │ → breaker.successes = 1
     │ → 返回数据
     │
T67s collectBasic('601398.SH')
     │ breaker.state = 'half-open', successes = 1
     │ → retry: attempt 0 成功
     │ → breaker.successes = 2 ≥ successThreshold
     │ → breaker.state = 'closed', failures = 0
     │ → 返回数据
     │
T68s 后续所有调用 → breaker.state = closed → 正常重试循环
```

### 配置参数关系

| 参数 | 当前值 | 集成后值 | 关系说明 |
|------|--------|----------|----------|
| `timeoutMs` | 30,000 | 30,000（不变） | 单次 fetch 超时 |
| `retries` | 3 | 3（不变） | 单轮重试次数 |
| `failureThreshold` | — | 5 | 连续 5 轮重试全失败才熔断（= 5 × 4 = 20 次 fetch 失败） |
| `resetTimeoutMs` | — | 60,000 | 熔断 60s（> 单轮最大耗时 30s × 4 = 120s 的 1/2） |
| `successThreshold` | — | 2 | 半开状态下 2 次连续成功才完全恢复 |

**最坏场景耗时对比**：

| 场景 | 当前（无熔断） | 集成后 |
|------|---------------|--------|
| 服务正常 | 1 次 fetch ≈ 200ms | 1 次 fetch ≈ 200ms（无变化） |
| 服务宕机第 1 次 | 4 次 × 30s = 120s | 4 次 × 30s = 120s（无变化） |
| 服务宕机第 2~5 次 | 每次 120s × 4 = 480s | 每次 120s × 4 = 480s（无变化） |
| 服务宕机第 6 次起 | 每次 120s（无快速失败） | **≈ 0ms**（熔断器直接 reject） |
| 服务恢复后第 1 次 | 120s（第 1 次 fetch 即成功） | 60s 等待 + 200ms（半开探测成功） |
| 服务恢复后第 3 次起 | 200ms | 200ms（熔断器关闭，正常直通） |

### sevenDimConfigStore 层面的影响

`runCollection` 使用 `Promise.allSettled` 并发 7 维采集，熔断器集成后：

```
场景：服务宕机，7 维并发采集

当前（无熔断）：
  7 维 × 4 次重试 × 30s = 28 次 fetch，最坏 840s 才全部失败
  第 2 次手动采集 → 又 28 次 fetch

集成后（熔断器 open）：
  第 1 次采集 → 7 维 × 4 次 = 28 次 fetch → 5 轮后熔断
  第 2 次采集 → 7 维 × breaker.execute → 0 次 fetch → 立即 7 个 CircuitOpenError
  → set({ error: "7 个维度采集失败" }) → 几乎瞬时
```

### 熔断器状态暴露

建议通过 `checkFetcherHealth` 返回熔断器状态，供 UI 层展示：

```typescript
export async function checkFetcherHealth(): Promise<{
  ok: boolean
  error?: string
  circuitState?: 'closed' | 'open' | 'half-open'
}> {
  const breaker = getBreaker()
  if (breaker.state === 'open') {
    return {
      ok: false,
      error: '数据采集服务熔断中，请稍后重试',
      circuitState: 'open',
    }
  }
  // ... 原有健康检查逻辑
  return { ok: true, circuitState: breaker.state }
}
```

## 后果（Consequences）

### 正面

- **快速失败**：服务持续宕机时，从 120s/次 降至 ≈0ms/次（熔断器 open 后直接 reject）
- **降低服务端压力**：熔断期间零网络请求，给后端恢复时间
- **自动恢复**：半开探测机制无需人工干预，服务恢复后自动回到 closed
- **资产复用**：激活已实现的 `createCircuitBreaker`，10 个测试用例覆盖的模块投入生产
- **向后兼容**：方案 A 不改变 `request()` 签名和返回类型，上层代码无需修改

### 代价

- **首次恢复延迟**：服务恢复后需等待 `resetTimeoutMs`（60s）才能首次探测
- **单例粒度**：全局共享一个熔断器实例，无法按 endpoint 区分（如 `/collect/basic` 熔断但 `/collect/kline` 正常时不影响）
- **状态非持久化**：页面刷新后熔断器状态重置（closed），极端场景下可能再次经历 5 轮重试

### 风险与对冲

| 风险 | 对冲措施 |
|------|----------|
| `failureThreshold=5` 过高，首次熔断需 5 × 4 = 20 次失败 | 可配置化，生产环境调低至 3 |
| `resetTimeoutMs=60s` 期间所有请求被拒 | UI 层通过 `checkFetcherHealth` 展示"熔断中"提示 |
| `CircuitOpenError` 未被上层识别 | `sevenDimConfigStore` catch 中增加 `instanceof CircuitOpenError` 判断，设置友好 error 文案 |
| 熔断器状态不随服务重启重置 | 可接受：前端刷新即重置，后端重启后首次请求即恢复 |

## 测试验证

| 测试组 | 文件 | 覆盖内容 | 状态 |
|--------|------|----------|------|
| R2（4 用例） | `infrastructure-extreme.test.ts` | 熔断器状态机：closed→open→half-open→closed | ✅ 全通过 |
| N2（3 用例） | `infrastructure-extreme.test.ts` | fetcherClient 重试循环：maxRetries=3/0 | ✅ 全通过 |
| N1（2 用例） | `infrastructure-extreme.test.ts` | AbortController 超时 | ✅ 全通过 |
| resilience.test.ts（10 用例） | `resilience.test.ts` | withRetry / withFallback / withResilience 基础 | ✅ 全通过 |
| **集成测试（待新增）** | `infrastructure-extreme.test.ts` | 熔断器 + 重试循环联合：open 时零 fetch、half-open 探测经过重试 | 📋 待实现 |

### 待新增集成测试用例

| 用例 ID | 场景 | 断言 |
|---------|------|------|
| R2-5 | 熔断器 open 时调用 collectBasic → 零次 fetch 调用，reject CircuitOpenError | `fetch` mock 调用次数 = 0 |
| R2-6 | 熔断器 half-open 探测 → 第 1 次 fetch 失败但第 2 次成功 → 探测成功，breaker 保持 half-open | `fetch` 调用 2 次，breaker.state = 'half-open' |
| R2-7 | 连续 5 轮 × 4 次重试全失败 → 第 6 轮调用零 fetch | 前 5 轮每轮 fetch 4 次，第 6 轮 fetch 0 次 |

## 实施路线

| 阶段 | 内容 | 前置条件 |
|------|------|----------|
| Phase 1 | 方案 A：`request()` 外层包裹 `breaker.execute()` | 无 |
| Phase 2 | `checkFetcherHealth` 暴露 `circuitState` | Phase 1 |
| Phase 3 | `sevenDimConfigStore` 识别 `CircuitOpenError`，设置友好文案 | Phase 1 |
| Phase 4 | 新增 R2-5/R2-6/R2-7 集成测试 | Phase 1 |
| Phase 5 | 方案 B：升级为 `withResilience`（指数退避） | Phase 1 验证稳定后 |

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-04 | v1.0.0 | ADR 初稿，提议熔断器包裹重试循环方案 |
