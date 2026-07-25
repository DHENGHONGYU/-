# 技术复盘：minQuality=0 筛选逻辑根因分析与预防机制

> **文档编号**: V9-RCA-2026-0722-001
> **日期**: 2026-07-22
> **影响组件**: `profileStore.ts`, `ProfileBrowsePage.tsx`
> **严重等级**: P1 — 数据筛选逻辑错误

---

## 1. 问题概述

### 1.1 问题描述

在资料浏览页面（ProfileBrowsePage）中，当用户设置 `minQuality` 筛选条件为 `0` 时，系统错误地将所有 `qualityScore === 0` 的资料排除在结果之外，导致用户无法查看质量分为 0 的资料。

### 1.2 影响范围

| 模块 | 文件 | 影响程度 |
|------|------|----------|
| Store 逻辑 | `src/store/profileStore.ts` | 核心筛选逻辑错误 |
| UI 展示 | `src/pages/output/ProfileBrowsePage.tsx` | 筛选状态判断错误 |
| 测试 | `src/store/profileStore.test.ts` | 缺少边界测试覆盖 |

### 1.3 用户影响

- 用户无法筛选出"质量分恰好为 0"的资料
- 低质量资料（负分、0 分）的筛选功能完全失效
- 可能导致用户误判资料覆盖范围

---

## 2. 根因分析

### 2.1 核心问题：默认值语义混淆

**问题代码**：

```typescript
// profileStore.ts - 修复前
const initialFilter: ProfileFilter = {
  minQuality: 0,  // ❌ 问题所在：0 被用作"无筛选"的默认值
  itemType: undefined,
  sentiment: undefined,
  // ...
}
```

**根因分析**：

1. **语义过载**：`minQuality = 0` 同时表达了两个含义：
   - "不筛选任何质量分"（默认值语义）
   - "筛选质量分 >= 0 的资料"（实际业务语义）
   
2. **边界冲突**：当用户明确设置 `minQuality = 0` 时，系统无法区分：
   - 这是用户的真实意图（筛选 0 分以上的资料）
   - 还是默认值（不进行质量筛选）

### 2.2 次要问题：条件判断逻辑错误

**问题代码**：

```typescript
// profileStore.ts - 修复前
if (filter.minQuality > 0) {  // ❌ 问题所在：使用 > 而非 >= 或 !== undefined
  // 执行筛选逻辑
}
```

**根因分析**：

1. **边界排除**：`> 0` 条件将 `qualityScore === 0` 的资料完全排除
2. **类型不当**：使用数值比较而非 `undefined` 检查，丧失了"无筛选"的语义表达

### 2.3 连锁问题：UI 层判断不一致

**问题代码**：

```typescript
// ProfileBrowsePage.tsx - 修复前
const hasActiveFilter = (filter.minQuality ?? 0) > 0  // ❌ 与 Store 层逻辑不一致
```

**根因分析**：

1. **双重否定**：`?? 0` 将 `undefined` 转为 `0`，然后 `> 0` 又排除了 `0`
2. **逻辑冗余**：不必要的空值合并 + 数值比较

---

## 3. 修复方案

### 3.1 修复策略

| 层次 | 修改点 | 修复前 | 修复后 |
|------|--------|--------|--------|
| Store 默认值 | `initialFilter.minQuality` | `0` | `undefined` |
| 筛选条件 | `if (filter.minQuality ...)` | `> 0` | `!== undefined` |
| UI 状态 | `hasActiveFilter` | `(filter.minQuality ?? 0) > 0` | `filter.minQuality !== undefined` |

### 3.2 修复代码

**profileStore.ts**：

```typescript
// 修复后
const initialFilter: ProfileFilter = {
  minQuality: undefined,  // ✅ 使用 undefined 表示"无筛选"
  itemType: undefined,
  sentiment: undefined,
}

// 筛选条件
if (filter.minQuality !== undefined && item.qualityScore !== null && item.qualityScore !== undefined) {
  // ✅ 只有当用户明确设置了 minQuality 时才筛选
  if (item.qualityScore < filter.minQuality) {
    keep = false
  }
}
```

**ProfileBrowsePage.tsx**：

```typescript
// 修复后
const hasActiveFilter = filter.itemType || filter.sentiment || filter.minQuality !== undefined || ...
// ✅ 直接检查 undefined 而非数值比较
```

### 3.3 测试补充

新增 8 个边界测试用例，覆盖以下场景：

| 测试场景 | 说明 |
|----------|------|
| 超高分筛选 (200+) | 验证极大分值不溢出 |
| 边界等值 (=== minQuality) | 验证临界值正确包含 |
| 负分阈值 | 验证负数 minQuality 正确处理 |
| null/undefined 数据 | 验证异常数据容错 |
| 混合筛选条件 | 验证多条件组合 |
| 累积筛选步骤 | 验证多次 setFilter 叠加 |

---

## 4. 预防机制

### 4.1 类型系统强化

#### 4.1.1 使用可空类型明确语义

```typescript
// 推荐：使用联合类型明确表达"无筛选"语义
interface ProfileFilter {
  minQuality?: number  // undefined 表示"无筛选"，0 表示"筛选 0 分以上"
}
```

#### 4.1.2 添加 JSDoc 注释

```typescript
/**
 * 最低质量分阈值
 * - undefined: 不筛选质量分（默认）
 * - 0: 包含所有质量分（包括 0 分和负分）
 * - >0: 只包含质量分 >= 该值的资料
 */
minQuality?: number
```

### 4.2 测试驱动开发

#### 4.2.1 边界测试数据管理

已创建独立测试数据文件 `tests/fixtures/profile.ts`：

```typescript
// 测试场景接口
interface MinQualityTestScenario {
  description: string
  filter: { minQuality?: number }
  items: MinQualityTestItem[]
  expectedIds: string[]
}

// 预定义场景
export const exactMatchScenario: MinQualityTestScenario = {
  description: '边界等值测试',
  filter: { minQuality: 50 },
  items: [/* ... */],
  expectedIds: ['item-50', 'item-80'],  // 50 分应被包含
}
```

#### 4.2.2 核心测试清单

| 序号 | 测试项 | 优先级 |
|------|--------|--------|
| 1 | minQuality=0 时所有资料通过 | P0 |
| 2 | minQuality=-10 时负分资料通过 | P0 |
| 3 | minQuality=undefined 时不筛选 | P0 |
| 4 | qualityScore=null 资料的处理 | P1 |
| 5 | 多条件组合筛选正确性 | P1 |

### 4.3 代码审查检查清单

在 Code Review 阶段，增加以下检查项：

- [ ] **默认值检查**：数值类型的默认值是否可能与业务边界值冲突？
- [ ] **条件判断检查**：是否使用了正确的"存在性"检查（`!== undefined`）而非数值比较（`> 0`）？
- [ ] **边界值测试**：是否覆盖了最小值（0、负数）的测试？
- [ ] **语义注释**：可选数值参数是否有明确的 JSDoc 说明？

### 4.4 静态分析规则

建议在 ESLint 中添加自定义规则（或使用 TypeScript 严格模式）：

```typescript
// tsconfig.json 建议配置
{
  "compilerOptions": {
    "strictNullChecks": true,          // 启用严格空值检查
    "noUncheckedIndexedAccess": true,   // 禁止未检查的索引访问
    "exactOptionalPropertyTypes": true // 精确可选属性类型
  }
}
```

### 4.5 文档与知识库

在 `docs/` 目录下添加编码规范条目：

> **数值默认值规范**
> 
> 当数值参数需要表达"无筛选"语义时：
> - 使用 `undefined` 作为默认值
> - 使用 `!== undefined` 检查是否启用筛选
> - 永远不要使用 `0` 或其他业务边界值作为"无筛选"的默认值

---

## 5. 改进建议

### 5.1 短期改进

1. **全量扫描**：搜索代码库中所有使用 `?? 0` 或 `|| 0` 的数值默认值，检查是否存在类似的语义混淆
2. **测试数据复用**：已迁移至 `tests/fixtures/profile.ts` 项目统一的测试数据管理模块
3. **Code Review 门禁**：在 PR 模板中增加"边界值检查"勾选项

### 5.2 长期改进

1. **引入 Option 类型**：在项目中推广使用 `Option<T>` 或 `Result<T>` 模式，显式处理"无值"语义
2. **属性测试**：引入属性测试（Property-Based Testing）框架，自动生成边界场景
3. **静态代码分析**：考虑引入自定义 ESLint 规则，检测"数值默认值与边界值冲突"模式

---

## 6. 附录

### 6.1 修复文件清单

| 文件路径 | 修改类型 | 说明 |
|----------|----------|------|
| `src/store/profileStore.ts` | 修改 | 修复默认值和筛选条件 |
| `src/pages/output/ProfileBrowsePage.tsx` | 修改 | 修复 UI 层判断逻辑 |
| `src/store/profileStore.test.ts` | 修改 | 增加边界测试用例 |
| `tests/fixtures/profile.ts` | 新增 | 测试数据文件（原 `src/store/__tests__/profileStore.minQuality.test-data.ts`） |

### 6.2 测试数据文件结构

```typescript
// 导出的测试场景
export const superHighScoreFilterScenario    // 超大分值筛选
export const superHighScoreSortScenario      // 超大分值排序
export const exactMatchScenario              // 边界等值测试
export const negativeMinQualityScenario      // 负分阈值测试
export const nullEvidenceWeightSortScenario  // null/undefined 数据排序
export const itemTypeAndMinQualityScenario   // 混合筛选条件
export const sentimentMinQualityKeywordScenario // 情感+质量+关键词组合
export const accumulativeFilterSteps        // 累积筛选步骤

// 导出的工具函数
export function toProfileItem(item: MinQualityTestItem): ProfileItem
```

### 6.3 相关文档

- [V9 编码规范](file:///L:/FinSightV9/docs)
- [ProfileFilter 类型定义](file:///L:/FinSightV9/src/data/types/types.profile.ts)

---

> **文档维护者**: V9 前端团队
> **最后更新**: 2026-07-22
