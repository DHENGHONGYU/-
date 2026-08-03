---
title: V9 v2.6.0 代码审查自查清单
type: checklist
domain: quality
phase: review
tier: T1
status: active
maintainer: V9 Quality Team
summary: "Key code review checkpoints for v2.6.0 zero-fallback remediation — prevent regression of 3 core logic points"
tags: [checklist, code-review, regression, quality]
version: v2.6.0
created_at: 2026-07-26
related_release: v2.6.0
related_commit: b625a10
---

# V9 v2.6.0 代码审查自查清单

> **目的**: 确保零值兜底整改的核心逻辑在后续维护中不发生回归  
> **适用范围**: `positionPoolStore.ts` / `sectorDefinitions.ts` / `profileStore.ts`  
> **使用时机**: PR Review / 代码合入前 / 版本发布前

---

## 核心逻辑点 1：NaN 显式空值标记

### 检查目标
确认 `quantity`、`avgCost`、`currentPrice`、`v6Composite`、`qualityScore` 的缺失值处理使用 `Number.NaN` 而非 `?? 0`。

### 检查清单

| # | 检查项 | 文件 | 行号 | 预期值 | 状态 |
|---|--------|------|------|--------|:----:|
| 1.1 | `quantity` 兜底值 | positionPoolStore.ts | — | `?? Number.NaN` | ☐ |
| 1.2 | `avgCost` 兜底值 | positionPoolStore.ts | — | `?? Number.NaN` | ☐ |
| 1.3 | `currentPrice` 兜底值 | positionPoolStore.ts | — | `?? Number.NaN` | ☐ |
| 1.4 | `v6Composite` 兜底值 | sectorDefinitions.ts | — | `?? Number.NaN` | ☐ |
| 1.5 | `qualityScore` 兜底值 | profileStore.ts | — | `?? 50`（中值） | ☐ |

### 扫描命令

```bash
# 检查 positionPoolStore 中是否残留 ?? 0
grep -n '\?\? 0[^.]' src/store/positionPoolStore.ts
# 预期: 无匹配

# 检查 sectorDefinitions 中是否残留 ?? 0
grep -n '\?\? 0[^.]' src/data/sectorDefinitions.ts
# 预期: 无匹配

# 检查 profileStore 中是否残留 ?? 0（排除计数器初始化 L531）
grep -n '\?\? 0[^.]' src/store/profileStore.ts
# 预期: 仅 L531 计数器初始化
```

### 反模式

```typescript
// ❌ 错误：缺失值被静默替换为 0
quantity: stock.quantity ?? 0
v6Composite: s.v6Composite ?? 0
qualityScore: i.qualityScore ?? 0

// ✅ 正确：NaN 显式标记缺失值
quantity: stock.quantity ?? Number.NaN
v6Composite: s.v6Composite ?? Number.NaN
qualityScore: i.qualityScore ?? 50
```

---

## 核心逻辑点 2：缺失值/零值日志检测

### 检查目标
确认关键数据入口处存在区分「缺失值」与「显式零值」的 `logger.debug` 日志。

### 检查清单

| # | 检查项 | 文件 | 日志关键词 | 状态 |
|---|--------|------|-----------|:----:|
| 2.1 | positionPoolStore — 缺失字段日志 | positionPoolStore.ts | `用 NaN 替代 0 作为显式空值标记` | ☐ |
| 2.2 | positionPoolStore — 零值字段日志 | positionPoolStore.ts | `显式零值字段` | ☐ |
| 2.3 | sectorDefinitions — 缺失 v6Composite 日志 | sectorDefinitions.ts | `有.*缺失 v6Composite，用 NaN 替代 0` | ☐ |
| 2.4 | sectorDefinitions — 零值 v6Composite 日志 | sectorDefinitions.ts | `v6Composite 为显式 0` | ☐ |
| 2.5 | profileStore — 缺失 qualityScore 日志 | profileStore.ts | `缺失 qualityScore，以默认值 50 参与筛选` | ☐ |
| 2.6 | profileStore — 零值 qualityScore 日志 | profileStore.ts | `qualityScore 为显式 0` | ☐ |

### 反模式

```typescript
// ❌ 错误：静默替换，无日志
quantity: stock.quantity ?? Number.NaN

// ✅ 正确：先检测 + 记录，再替换
if (stock.quantity == null) {
  logger.debug(`[positionPoolStore] ${symbol} 缺失 quantity → 用 NaN 替代`)
} else if (stock.quantity === 0) {
  logger.debug(`[positionPoolStore] ${symbol} quantity 为显式 0`)
}
quantity: stock.quantity ?? Number.NaN
```

---

## 核心逻辑点 3：筛选阈值零值支持

### 检查目标
确认 profileStore 的 `minQuality` 筛选逻辑支持 `0` 作为有效阈值（而非将 0 等同于"无筛选"）。

### 检查清单

| # | 检查项 | 文件 | 行号 | 预期值 | 状态 |
|---|--------|------|------|--------|:----:|
| 3.1 | 筛选条件判断 | profileStore.ts | — | `filter.minQuality !== undefined` | ☐ |
| 3.2 | 缺失分参与筛选 | profileStore.ts | — | `(i.qualityScore ?? 50) >= filter.minQuality!` | ☐ |
| 3.3 | minQuality = 0 测试 | profileStore.test.ts | — | 有测试覆盖 minQuality=0 场景 | ☐ |

### 反模式

```typescript
// ❌ 错误：0 被误判为"无筛选"
if (filter.minQuality && filter.minQuality > 0) {
  // minQuality=0 时此分支不执行，等价于无筛选
}

// ✅ 正确：0 作为有效阈值
if (filter.minQuality !== undefined) {
  items = items.filter((i) => (i.qualityScore ?? 50) >= filter.minQuality!)
}
```

---

## 附录：profileStore L531 `?? 0` 保留说明

```typescript
// src/store/profileStore.ts L531
counts[item.domain] = (counts[item.domain] ?? 0) + 1
```

**性质**: `Record<string, number>` 计数器初始化  
**合理性**: 新 key 首次访问时必须从 0 开始累加，这是 JavaScript 的标准写法  
**风险**: 🟢 无风险 — 此场景中 0 是正确的初始值，不是兜底值  
**注意**: 此处的 `?? 0` 仅适用于 `Record<string, number>` 的初始化场景，**不可**作为通用数值兜底模式复制到其他场景

---

## 快速验证脚本

```bash
# 1. 检查 ?? 0 残留（排除 profileStore L531 计数器）
grep -rn '\?\? 0[^.]' src/store/positionPoolStore.ts src/data/sectorDefinitions.ts
# 预期: 无输出

# 2. 检查 NaN 使用
grep -rn 'Number.NaN' src/store/positionPoolStore.ts src/data/sectorDefinitions.ts
# 预期: 各文件至少 1 处

# 3. 运行目标测试
npx vitest run src/store/positionPoolStore.test.ts src/store/profileStore.test.ts src/data/sectorDefinitions.test.ts
# 预期: 183 tests passed

# 4. 检查日志断言
grep -n 'logger.debug' src/store/positionPoolStore.test.ts src/store/profileStore.test.ts src/data/sectorDefinitions.test.ts
# 预期: 测试中有对应的 mock 日志断言
```
