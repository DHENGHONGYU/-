# Code Review 变更摘要

> **PR 标题**：feat: 安全格式化迁移 + Widget/Portfolio 类型定义放宽  
> **分支**：`fix/autorecover-test-comment`  
> **变更日期**：2026-08-04  
> **变更规模**：25 个文件，+1727 / -160 行

---

## 一、提交历史

| # | 提交 ID | 类型 | 说明 |
|---|---------|------|------|
| 1 | `f79fcf5c` | refactor | 提取 safeFormat 为独立模块，补充完整 JSDoc 注释和示例 |
| 2 | `f92aed30` | fix | Widget 组件直接传 undefined 给 safeFormatNumber，确保占位符行为一致 |
| 3 | `4639d486` | fix | 放宽 PortfolioHolding 类型定义，修复 CoreResourcePanel 空值处理 |
| 4 | `4290eaf7` | docs | PR 技术实现细节追加 Widget 占位符行为修复变更对比和风险评估 |
| 5 | `a5f9294c` | chore | 清理根目录非白名单文件和旧分析目录 |

---

## 二、变更概览

### 2.1 按类别统计

| 变更类别 | 文件数 | 关键内容 |
|---------|--------|---------|
| 类型定义放宽 | 2 | `widget.types.ts`（5 字段）+ `types.portfolio.ts`（3 字段） |
| 安全格式化工具 | 2 | `safeFormat.ts`（独立模块）+ `format.ts`（重新导出） |
| 核心组件修复 | 3 | WatchlistWidget / MarketIndicesWidget / CoreResourcePanel |
| 服务层空值处理 | 1 | watchlistMoversService |
| 单元测试 | 3 | format.test.ts（55 项）+ CoreResourcePanel.test.tsx（5 项）+ 其他增强 |
| 文档 | 4 | PR 提交说明 / 审查指南 / 设计决策 / 变更对比报告 |

### 2.2 按层级统计

| 层级 | 文件数 | 关键变更 |
|------|--------|---------|
| `src/types` | 1 | `widget.types.ts` — 5 字段改为可选 `?:` |
| `src/data/types` | 1 | `types.portfolio.ts` — 3 字段改为可选 `?:` + JSDoc 修复 |
| `src/lib` | 2 | `safeFormat.ts`（新建）+ `format.ts`（重新导出） |
| `src/cockpit/widgets` | 2 | WatchlistWidget + MarketIndicesWidget — `isValidNumber` 守卫 + 移除 `?? 0` |
| `src/apps/trading` | 1 | CoreResourcePanel — `safeFormatNumber` + `formatNumber` 空值处理 |
| `src/services` | 1 | watchlistMoversService — 类型守卫过滤 + `?? 0` |
| `docs` | 4 | PR 文档 + 审查指南 |

---

## 三、类型定义变更

### 3.1 widget.types.ts

| 接口 | 字段 | 变更前 | 变更后 |
|------|------|--------|--------|
| `MarketIndexData` | `price` | `number` | `price?: number` |
| `MarketIndexData` | `change` | `number` | `change?: number` |
| `MarketIndexData` | `changePercent` | `number` | `changePercent?: number` |
| `WatchlistData` | `price` | `number` | `price?: number` |
| `WatchlistData` | `changePercent` | `number` | `changePercent?: number` |

### 3.2 types.portfolio.ts

| 接口 | 字段 | 变更前 | 变更后 |
|------|------|--------|--------|
| `PortfolioHolding` | `price` | `number` | `price?: number` |
| `PortfolioHolding` | `marketValue` | `number` | `marketValue?: number` |
| `PortfolioHolding` | `score` | `number` | `score?: number` |

**额外修复**：JSDoc 格式错误（两个连续 `/**` 开头 → `*/` + `/**`）

---

## 四、核心组件变更

### 4.1 WatchlistWidget.tsx

| 变更点 | 修改前 | 修改后 |
|--------|--------|--------|
| `getChangeIcon` 签名 | `(change: number)` | `(change: number \| undefined)` + `isValidNumber` 守卫 |
| `getChangeColor` 签名 | `(change: number)` | `(change: number \| undefined)` + `isValidNumber` 守卫 |
| price 渲染 | `safeFormatNumber(stock.price ?? 0, 2)` → `0.00` | `safeFormatNumber(stock.price, 2)` → `--` |
| changePercent 渲染 | `safeFormatPercent(stock.changePercent ?? 0, 2)` → `0.00%` | `safeFormatPercent(stock.changePercent, 2)` → `--` |
| import | `safeFormatNumber, safeFormatPercent` | 增加 `isValidNumber` |

### 4.2 MarketIndicesWidget.tsx

| 变更点 | 修改前 | 修改后 |
|--------|--------|--------|
| `getChangeIcon` / `getChangeColor` | 同 WatchlistWidget | 同上 |
| price 渲染 | `?? 0` → `0.00` | 直接传 → `--` |
| changePercent 渲染 | `?? 0` → `0.00%` | 直接传 → `--` |
| high / low 渲染 | `?? 0` → `0` | 直接传 → `--` |
| import | `safeFormatNumber, safeFormatPercent` | 增加 `isValidNumber` |

### 4.3 CoreResourcePanel.tsx

| 变更点 | 修改前 | 修改后 |
|--------|--------|--------|
| `holding.score` 渲染 | `holding.score.toFixed(2)` → 崩溃 | `safeFormatNumber(holding.score, 2)` → `--` |
| `holding.price` 渲染 | `holding.price.toFixed(2)` → 崩溃 | `safeFormatNumber(holding.price, 2)` → `--` |
| `formatNumber` 签名 | `(value: number)` | `(value: number \| undefined)` + 空值返回 `--` |
| `holding.marketValue` 渲染 | `formatNumber(holding.marketValue)` → 类型错误 | `formatNumber(holding.marketValue)` → `--` |
| import | 无 | `import { safeFormatNumber } from '@/lib/format'` |

---

## 五、工具函数新增

### 5.1 safeFormat.ts（独立模块）

| 函数 | 签名 | 功能 |
|------|------|------|
| `safeFormatNumber` | `(value: number \| undefined \| null, decimals: number, fallback?: string) => string` | 安全格式化数值，空值/NaN/Infinity 返回 `--` |
| `safeFormatPercent` | `(value: number \| undefined \| null, decimals?: number, fallback?: string) => string` | 安全格式化百分比，正数添加 `+` |
| `safeFormatInt` | `(value: number \| undefined \| null, fallback?: string) => string` | 安全格式化整数 |
| `isValidNumber` | `(v: number \| undefined \| null) => v is number` | 类型守卫 |
| `DEFAULT_FALLBACK` | `string` | 默认占位符 `'--'` |

### 5.2 format.ts（向后兼容）

通过 `export { ... } from './safeFormat'` 重新导出，现有 `import from '@/lib/format'` 无需修改。

---

## 六、服务层变更

| 文件 | 变更内容 | 处理策略 |
|------|---------|---------|
| `watchlistMoversService.ts` | `valid` 过滤器增加 `changePercent` 类型守卫校验；排序使用 `?? 0`；`toMover` 映射使用 `?? 0` | 数据过滤 + 空值合并 |

---

## 七、验证结果

| 验证项 | 结果 | 证据 |
|--------|------|------|
| TypeScript 编译 | ✅ 通过 | `tsc -p tsconfig.prod.json --noEmit` 退出码 0 |
| 单元测试 — format | ✅ 通过 | 55 项全部通过（231ms） |
| 单元测试 — CoreResourcePanel | ✅ 通过 | 5 项全部通过（86ms） |
| 合计 | ✅ 60 项通过 | 0 失败 |

---

## 八、审查清单

### P0 必审（6 项）

| # | 文件 | 审查要点 |
|---|------|---------|
| 1 | [widget.types.ts](file:///d:/FinSightV9/src/types/modules/widget.types.ts) | 5 个字段改为 `?:` 是否合理 |
| 2 | [types.portfolio.ts](file:///d:/FinSightV9/src/data/types/types.portfolio.ts) | 3 个字段改为 `?:` + JSDoc 修复 |
| 3 | [safeFormat.ts](file:///d:/FinSightV9/src/lib/safeFormat.ts) | 4 个函数实现 + JSDoc |
| 4 | [WatchlistWidget.tsx](file:///d:/FinSightV9/src/cockpit/widgets/WatchlistWidget.tsx) | `isValidNumber` 守卫 + `--` 占位符 |
| 5 | [MarketIndicesWidget.tsx](file:///d:/FinSightV9/src/cockpit/widgets/MarketIndicesWidget.tsx) | 同上 + high/low 空值 |
| 6 | [CoreResourcePanel.tsx](file:///d:/FinSightV9/src/apps/trading/panels/CoreResourcePanel.tsx) | `safeFormatNumber` + `formatNumber` 空值处理 |

### P1 建议审（1 项）

| # | 文件 | 审查要点 |
|---|------|---------|
| 7 | [watchlistMoversService.ts](file:///d:/FinSightV9/src/services/trading/watchlistMoversService.ts) | 类型守卫过滤逻辑 + `?? 0` 排序 |

---

## 九、风险评估

| 风险项 | 等级 | 概率 | 缓解措施 | 验证状态 |
|--------|------|------|---------|---------|
| 类型放宽导致消费方级联编译错误 | 中 | 已发生 | 逐文件修复所有消费方 | ✅ tsc 通过 |
| `isValidNumber` 守卫遗漏 | 低 | 极低 | 守卫在函数入口处拦截 | ✅ 编译通过 |
| 空值显示 `--` 与原有 `0.00` 风格差异 | 低 | 中 | `--` 为金融标准占位符 | ✅ 测试通过 |
| `safeFormatNumber` 性能开销 | 极低 | 极低 | O(1) 开销，`Number.isFinite` 检查 | ✅ 无感知 |

---

**摘要生成时间**：2026-08-04
