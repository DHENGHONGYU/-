---
title: docs/test-strategy.md
code_version: 2.0.0-rc.2
---

# 测试策略：isProgrammingError 子类原型链极端边界用例

**文档编号**：V9-DOC-TEST-001
**创建日期**：2026-08-09
**关联源码**：`src/core/databridgeAdapter.ts` → `isProgrammingError()` + `safeErrorMessage()`
**关联测试**：`src/core/databridgeAdapter.branch-coverage.test.ts` → "极端原型链边界" describe 块

---

## 1. 背景与设计动机

### 1.1 isProgrammingError 双重判断架构

`isProgrammingError(err)` 函数用于区分**编程错误**（bug，应 fail-fast reject）与**操作错误**（网络/超时等，应优雅降级 resolve success=false）。

核心判定逻辑采用 **Set 精确匹配 + instanceof 原型链遍历** 的双重架构：

```typescript
const PROGRAMMING_ERROR_CONSTRUCTORS = new Set<unknown>([
  TypeError, SyntaxError, ReferenceError, RangeError, EvalError, URIError,
])

function isProgrammingError(err: unknown): boolean {
  // 分支 1：非对象 → false
  if (!err || typeof err !== 'object') return false

  // 分支 2：Object.create(null) 无 constructor → false
  const constructor = (err as object).constructor
  if (!constructor) return false

  // 分支 3：Set 精确匹配 OR instanceof 原型链遍历
  if (PROGRAMMING_ERROR_CONSTRUCTORS.has(constructor) ||
      err instanceof TypeError || err instanceof SyntaxError ||
      err instanceof ReferenceError || err instanceof RangeError ||
      err instanceof EvalError || err instanceof URIError) {
    return true
  }

  // 分支 4：普通 Error → false
  return false
}
```

### 1.2 为什么需要双重判断？

| 检查机制 | 优势 | 劣势 |
|----------|------|------|
| `Set.has(constructor)` | O(1) 精确匹配，性能最优 | 无法识别子类（`class CustomTypeError extends TypeError` 的 constructor 是 `CustomTypeError`，不在 Set 中） |
| `instanceof` | 自动遍历原型链，覆盖子类和孙类 | 跨 realm（iframe/worker）时失效；原型链被篡改后结果不可控 |

双重判断 = Set 快速路径 + instanceof 兜底路径，覆盖以下场景：
- 直接实例 → Set 命中（快速路径）
- 子类/孙类实例 → Set 未命中，instanceof 命中（兜底路径）
- constructor 被覆写 → Set 未命中，instanceof 仍能匹配（兜底路径核心价值）

---

## 2. 极端边界用例详解

### 2.1 用例 1：constructor 属性被覆写为 Error，但原型链不变

**场景**：某些第三方库（如 Babel transpile 后的代码、自定义 Error 子类）会覆写 `this.constructor` 属性，导致 `Set.has(constructor)` 检查失败。

**测试逻辑**：

```typescript
it('constructor 被覆写为 Error 但原型链不变 → instanceof 回退匹配 → reject（编程错误）', async () => {
  const err = new TypeError('original type error')
  // 覆写 constructor 属性，模拟第三方库行为
  Object.defineProperty(err, 'constructor', { value: Error, writable: true, configurable: true })

  mockForward.mockRejectedValueOnce(err)
  const adapter = new DataBridgeAdapter()

  // Set.has(Error) → false，但 instanceof TypeError → true → 仍判定为编程错误
  await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow(TypeError)
  expect(mockLogger.debug).toHaveBeenCalledWith(
    expect.stringContaining('编程错误(fail-fast reject)'),
  )
})
```

**验证思路**：
1. 创建真实的 `TypeError` 实例
2. 用 `Object.defineProperty` 将 `constructor` 覆写为 `Error`
3. 此时 `Set.has(Error)` → false（Error 不在编程错误 Set 中）
4. 但 `err instanceof TypeError` → true（原型链未被修改，仍指向 `TypeError.prototype`）
5. 验证双重判断的兜底路径生效：最终判定为编程错误 → fail-fast reject

**核心价值**：这是双重判断架构的核心价值验证。如果仅有 Set 检查，此场景会被误判为操作错误，导致编程 bug 被静默吞掉。

### 2.2 用例 2：TypeError 原型链被 setPrototypeOf 篡改为 Error.prototype

**场景**：原型链被故意或意外修改（如 monkey-patching、原型污染攻击），使 `instanceof TypeError` 返回 false。

**测试逻辑**：

```typescript
it('TypeError 原型链被篡改为 Error.prototype → instanceof 失败 → resolve success=false（操作错误）', async () => {
  const err = new TypeError('original type error')
  // 篡改原型链，使 instanceof TypeError 返回 false
  Object.setPrototypeOf(err, Error.prototype)

  mockForward.mockRejectedValueOnce(err)
  const adapter = new DataBridgeAdapter()
  const result = await adapter.query('FETCH_STOCKS', {})

  // constructor → Error（不在 Set 中），instanceof TypeError → false → 判定为操作错误
  expect(result.success).toBe(false)
  expect(result.error).toBe('original type error')
  expect(mockLogger.debug).toHaveBeenCalledWith(
    expect.stringContaining('操作错误(优雅降级)'),
  )
})
```

**验证思路**：
1. 创建真实的 `TypeError` 实例
2. 用 `Object.setPrototypeOf` 将原型改为 `Error.prototype`
3. 此时 `err.constructor` → Error（不在 Set 中）
4. `err instanceof TypeError` → false（原型链不再包含 `TypeError.prototype`）
5. `err instanceof Error` → true（但 Error 不在编程错误检查列表中）
6. 验证结果判定为操作错误 → 优雅降级 resolve success=false

**核心价值**：验证原型链断裂后的安全降级行为。当原型链被篡改导致 instanceof 不可信时，不会误判为编程错误，避免对被篡改对象 fail-fast reject 导致的级联失败。

### 2.3 用例 3：Object.create(TypeError.prototype) 伪造 TypeError

**场景**：未经 `new TypeError()` 构造函数调用，仅通过 `Object.create` 直接创建原型链上的"伪 TypeError"。

**测试逻辑**：

```typescript
it('Object.create(TypeError.prototype) 伪造 TypeError → reject（编程错误 fail-fast）', async () => {
  const fakeTypeError = Object.create(TypeError.prototype) as TypeError
  fakeTypeError.message = 'fake type error via prototype'

  mockForward.mockRejectedValueOnce(fakeTypeError)
  const adapter = new DataBridgeAdapter()

  await expect(adapter.query('FETCH_STOCKS', {})).rejects.toThrow()
  expect(mockLogger.debug).toHaveBeenCalledWith(
    expect.stringContaining('编程错误(fail-fast reject)'),
  )
})
```

**验证思路**：
1. 用 `Object.create(TypeError.prototype)` 创建对象，不调用构造函数
2. 手动设置 `message` 属性
3. 此时 `err.constructor` → TypeError（通过原型链继承，在 Set 中）
4. `err instanceof TypeError` → true（原型链包含 `TypeError.prototype`）
5. Set 和 instanceof 双重匹配 → 判定为编程错误 → fail-fast reject

**核心价值**：验证未经构造函数创建的"伪 TypeError"也能被正确识别。这种对象在实际代码中极少出现，但验证了判定逻辑对原型链匹配的正确性——不依赖 `new` 构造的副作用，纯粹基于原型链结构判定。

---

## 3. 覆盖矩阵总结

| # | 场景 | constructor | instanceof TypeError | Set.has | 最终判定 | 验证路径 |
|---|------|-------------|---------------------|---------|----------|----------|
| 1 | constructor 覆写为 Error | Error | true | false | **true（编程错误）** | instanceof 兜底 |
| 2 | 原型链篡改为 Error.prototype | Error | false | false | **false（操作错误）** | 双重否定 → 分支 4 |
| 3 | Object.create 伪造 TypeError | TypeError | true | true | **true（编程错误）** | 双重肯定 → 分支 3 |

---

## 4. 调试日志规范

每个极端边界用例均在关键分支点前后输出 `debugLog`，格式为：

```
[test-debug] <分支名> <上下文JSON>
```

示例输出：
```
[test-debug] 极端-constructor覆写 { errorType: 'TypeError with constructor overridden to Error', constructorName: 'Error', instanceofTypeError: true, setHasConstructor: false, branch: 'constructor-override-instanceof-fallback' }
[test-debug] 极端-constructor覆写 结果 { rejected: true, fallbackPath: 'instanceof', setCheckFailed: true, instanceofSucceeded: true }
```

**用途**：测试失败时可通过控制台输出快速定位失败分支、constructor 名称、instanceof 结果和 Set 匹配状态，无需额外加断点。

---

## 5. 后续维护建议

1. **新增编程错误类型**：如果未来需要将新的 Error 子类（如 `AggregateError`）纳入编程错误分类，只需在 `PROGRAMMING_ERROR_CONSTRUCTORS` Set 中添加，并在 instanceof 检查链中补充对应类型
2. **跨 realm 场景**：当前 `instanceof` 在跨 iframe/worker 场景下可能失效（每个 realm 有独立的 TypeError 构造器）。如需支持，可考虑追加 `err.constructor?.name` 字符串匹配作为第三重兜底
3. **性能考量**：Set 检查在前（O(1)），instanceof 在后（O(n) 原型链遍历），大多数情况下 Set 即可命中，instanceof 仅作为兜底路径执行
