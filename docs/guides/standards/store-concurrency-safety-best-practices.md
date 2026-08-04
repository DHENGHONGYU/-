# V9 Store 并发安全最佳实践

## 1. 概述

本文档定义 V9 项目中 Zustand Store 的并发安全最佳实践，旨在防止异步 action 在高并发场景下出现数据竞争、重复请求和状态不一致问题。

## 2. 核心问题

Store 中的异步 action（如 `refresh`、`load*`、`fetch*` 等）在以下场景下可能触发并发问题：

1. **用户快速点击**：用户连续触发刷新按钮，导致重复请求
2. **跨组件调用**：多个组件同时调用同一 Store 的刷新方法
3. **自动刷新**：定时任务与用户操作重叠执行
4. **级联调用**：一个 Store 的刷新触发另一个 Store 的刷新

---

## 3. 防重入模式

### 模式 A：isRefreshing 锁（标准模式）

适用于独立 Store 的简单防重入场景。

#### 实现步骤

1. **状态定义**：在 Store State 接口中添加 `isRefreshing: boolean`
2. **初始状态**：在 `initialState` 中设置 `isRefreshing: false`
3. **防重入检查**：在异步 action 首行检查 `isRefreshing`
4. **状态管理**：执行前置 `isRefreshing: true`，完成后重置为 `false`

#### 代码示例

```typescript
// 1. 定义 State 接口
interface MyStoreState {
  // ... 其他状态
  isRefreshing: boolean  // 防重入锁
  refresh: () => Promise<void>
}

// 2. 初始化状态
const initialState = {
  // ... 其他状态
  isRefreshing: false,
}

// 3. 创建 Store（注意：需要 get 参数来读取当前状态）
export const useMyStore = create<MyStoreState>((set, get) => ({
  ...initialState,

  // 4. 异步 action 实现
  refresh: async () => {
    // ① 首行检查防重入锁
    if (get().isRefreshing) {
      logger.debug('[myStore] refresh skipped: isRefreshing is true')
      return
    }

    // ② 设置锁和加载状态
    set({ isRefreshing: true, loading: true, error: null })

    try {
      // ③ 执行业务逻辑
      const result = await someAsyncOperation()

      // ④ 成功：更新数据并释放锁
      set({
        data: result,
        loading: false,
        isRefreshing: false,  // 关键：重置锁
      })
    } catch (err) {
      // ⑤ 失败：记录错误并释放锁
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[myStore] refresh failed', { error: message })
      set({ 
        error: message, 
        loading: false,
        isRefreshing: false,  // 关键：确保锁被释放
      })
    }
  },
}))
```

#### 注意事项

- ⚠️ **必须使用 `get` 参数**：`create((set, get) => ...)` 而不是 `create((set) => ...)`
- ⚠️ **try-finally 模式**：确保异常场景下锁也能被释放
- ⚠️ **首行检查**：防重入检查必须在函数体前 5 行内

### 模式 B：RefreshCoordinator 协调模式（高级模式）

适用于跨 Store 协调刷新场景，需要等待正在进行的刷新完成。

#### 实现步骤

1. **引入 RefreshCoordinator**：使用项目提供的协调器（`@/core/refreshCoordinator`）
2. **协调调用**：将刷新逻辑包装在 `coordinateRefresh` 中
3. **内部实现**：实际的刷新逻辑放在内部方法（如 `_doRefresh`）

#### 代码示例

```typescript
import { refreshCoordinator } from '@/core/refreshCoordinator'

export const useOrderStore = create<OrderState>((set, get) => ({
  // ... 其他状态

  // 公开的 refresh 方法：使用协调模式
  refresh: async () => {
    // 协调器会等待正在进行的刷新完成，而不是直接返回
    await refreshCoordinator.coordinateRefresh('orderStore', () =>
      get()._doRefresh(),  // 调用内部实现
    )
  },

  // 内部实现：包含 isRefreshing 锁
  _doRefresh: async () => {
    const state = get()

    // 保存旧快照，用于失败回滚
    const snapshot = { data: state.data }

    set({ isRefreshing: true, loading: true, error: null })

    try {
      const result = await fetchData()
      set({
        data: result,
        loading: false,
        isRefreshing: false,
      })
    } catch (err) {
      // 失败时回滚到旧快照
      set({
        ...snapshot,
        error: message,
        loading: false,
        isRefreshing: false,
      })
    }
  },
}))
```

#### 优势

- **请求合并**：多个并发请求只触发一次实际刷新
- **结果共享**：后续请求等待第一个请求完成后直接使用结果
- **解耦调用**：调用方不需要关心刷新状态

### 模式 C：通用 Coordinator 模式（参考）

适用于需要自定义协调逻辑的场景。此模式为通用参考模式，具体实现需根据项目实际需求扩展。

#### 代码示例

```typescript
// 如需实现通用 Coordinator 模式，可基于 RefreshCoordinator 扩展
// 示例实现（伪代码，仅供参考）：
class GenericCoordinator {
  private pendingPromises = new Map<string, Promise<any>>()

  async coordinate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.pendingPromises.has(key)) {
      return this.pendingPromises.get(key)!
    }

    const promise = fn().finally(() => {
      this.pendingPromises.delete(key)
    })
    this.pendingPromises.set(key, promise)
    return promise
  }
}

const _coordinator = new GenericCoordinator()

export const useMyStore = create<MyState>((set, get) => ({
  refresh: async () => {
    await _coordinator.coordinate('refresh', async () => {
      set({ isRefreshing: true })
      try {
        // ... 业务逻辑
      } finally {
        set({ isRefreshing: false })
      }
    })
  },
}))
```

---

## 4. ESLint 规则说明

### 规则名称

`v9-store/no-async-without-is-refreshing`

### 检测目标

Store 文件中返回 Promise 的异步 action（`async` 函数）。

### 规则要求

异步 action 必须在函数体前 5 行内包含以下任一防重入检查：

1. **isRefreshing 检查**：`if (get().isRefreshing) { return }`
2. **RefreshCoordinator 调用**：`refreshCoordinator.coordinateRefresh(...)`
3. **通用 Coordinator 调用**：`_coordinator.coordinate(...)`

### 豁免场景

- 内部 helper 函数（以下划线开头）
- 纯同步函数（无 `async` 关键字）
- 特定豁免文件（如 `useSearchStore`、`useTokenStore`）

### 严重级别

- **error**（P0 级别）：违反规则的代码将导致 ESLint 检查失败

### 配置示例

```javascript
// eslint.config.js
import v9Store from './scripts/quality/eslint-plugin-v9-store.js'

export default tseslint.config(
  // ... 其他配置
  {
    plugins: { 'v9-store': v9Store },
    rules: {
      'v9-store/no-async-without-is-refreshing': 'error',
    },
  },
)
```

### 运行扫描

```bash
# 扫描所有 Store 文件
npx eslint src/store/ --ext .ts

# 扫描特定文件
npx eslint src/store/executionStore.ts src/store/orderStore.ts
```

---

## 5. 单元测试

### 并发场景测试模板

```typescript
// 1. Mock 异步服务
let resolvePromise!: (value: any) => void
const mockService = vi.fn().mockImplementationOnce(
  () => new Promise((resolve) => { resolvePromise = resolve })
)

// 2. 测试用例
describe('并发场景', () => {
  it('第二个请求被防重入锁阻止', async () => {
    // 发起第一个请求（不等待完成）
    const promise1 = useStore.getState().refresh()

    // 验证防重入锁已激活
    expect(useStore.getState().isRefreshing).toBe(true)

    // 立即发起第二个请求
    await useStore.getState().refresh()

    // 验证服务仅被调用一次
    expect(mockService).toHaveBeenCalledTimes(1)

    // 完成第一个请求
    resolvePromise(mockData)
    await promise1

    // 验证锁已释放
    expect(useStore.getState().isRefreshing).toBe(false)
  })

  it('失败后防重入锁正确释放', async () => {
    mockService.mockRejectedValueOnce(new Error('网络超时'))

    await useStore.getState().refresh()

    // 验证锁已释放
    expect(useStore.getState().isRefreshing).toBe(false)
    expect(useStore.getState().error).toBe('网络超时')
  })
})
```

### 测试要点

1. **Mock 异步服务**：使用 `vi.fn().mockImplementationOnce()` 创建可延迟解析的 Promise
2. **不等待第一个请求**：在第一个请求未完成时发起第二个请求
3. **验证调用次数**：断言服务仅被调用一次
4. **验证状态恢复**：成功和失败场景下锁都应被正确释放

---

## 6. 检查清单

### 新建 Store 时

- [ ] State 接口定义了 `isRefreshing: boolean`
- [ ] `initialState` 中包含 `isRefreshing: false`
- [ ] `create` 函数使用 `(set, get)` 参数
- [ ] 所有异步 action 首行包含防重入检查
- [ ] try-catch 或 try-finally 确保锁被释放
- [ ] 包含并发场景的单元测试

### 代码审查时

- [ ] 异步 action 是否包含防重入检查
- [ ] `get().isRefreshing` 是否在函数体前 5 行
- [ ] 异常路径是否释放锁
- [ ] 是否有对应的并发场景测试

### ESLint 检查

- [ ] 运行 `npx eslint src/store/` 无违规
- [ ] 新增的 Store 文件已在插件规则范围内

---

## 7. 参考文档

- ESLint 插件实现：[eslint-plugin-v9-store.js](file:///d:/FinSightV9/scripts/quality/eslint-plugin-v9-store.js)
- 规则配置：[eslint.config.js](file:///d:/FinSightV9/eslint.config.js)
- 代码示例：[executionStore.ts](file:///d:/FinSightV9/src/store/executionStore.ts#L250-L306)
- 协调模式示例：[orderStore.ts](file:///d:/FinSightV9/src/store/orderStore.ts#L220-L280)
