# 代码复杂度专项治理规范

> 版本：v1.0.0 | 日期：2026-07-10

## 1. 度量指标

| 指标 | 当前基线 | 短期目标 | 中期目标 |
|------|----------|----------|----------|
| 函数嵌套深度 ≥ 4 | 104 处 | ≤ 90 | ≤ 60 |
| 链式条件分支 ≥ 6 | 0 处 | ≤ 3 | ≤ 2 |
| 重复 if 条件 | 39 处 | ≤ 30 | ≤ 15 |
| 函数行数 ≥ 100 | 待接入 | 不再新增 | 逐步拆解 |
| 圈复杂度 ≥ 15 | 待接入 | 不再新增 | 逐步拆解 |

## 2. 治理原则

### 2.1 嵌套深度

```ts
// ❌ 深度嵌套
if (a) {
  if (b) {
    if (c) {
      // ...
    }
  }
}

// ✅ 卫语句 + 提前返回
if (!a) return
if (!b) return
if (c) {
  // ...
}
```

### 2.2 链式条件

```ts
// ❌ 长链式 if-else
if (x === 'a') {
  // ...
} else if (x === 'b') {
  // ...
} else if (x === 'c') {
  // ...
} else if (x === 'd') {
  // ...
}

// ✅ 查找表
const handlers: Record<string, () => void> = {
  a: handleA,
  b: handleB,
  c: handleC,
  d: handleD,
}
handlers[x]?.()
```

### 2.3 重复判断

```ts
// ❌ 重复
const isUp = change > 0
if (isUp) { ... }
// ... 后面又出现
if (change > 0) { ... }

// ✅ 提取常量/函数
const isUp = change > 0
if (isUp) { ... }
// ...
if (isUp) { ... }
```

## 3. 扫描脚本

运行 `npm run audit:complexity`（即 `npm run complexity-scan`）扫描：
- 嵌套深度 ≥ 4 的代码块
- 链式 if/else if 分支 ≥ 6 的语句
- 同一函数内重复出现的 if 条件
- 函数行数 ≥ 100（v1.2 规划中）
- 圈复杂度 ≥ 15（v1.2 规划中）

输出结果到 `.complexity-baseline.json` 与命令行报告。

## 4. 重构流程

1. 扫描得到优先级列表（按影响范围排序）
2. 每次重构一个函数，运行 `npm run test` 和 `npm run audit:layers`
3. 提取可复用函数到 `src/lib/` 或 `src/services/` 的 helpers
4. 更新 JSDoc 与单元测试
5. 重新扫描确认指标下降

## 5. CI 门禁

新增代码必须满足：
- 不新增深度 ≥ 4 的嵌套
- 不新增 ≥ 6 分支的链式条件
- 不新增重复 if 条件

`audit:complexity` 作为 CI 检查项，与 `.complexity-baseline.json` 对比，只统计新增违规（债务只减不增）。
