# PR: 安全格式化迁移 + Widget/Portfolio 类型定义放宽

## 变更概述

本次 PR 解决 `price`/`changePercent`/`marketValue`/`score` 等字段在数据缺失时直接调用 `.toFixed()` 导致的 `TypeError: Cannot read properties of undefined (reading 'toFixed')` 运行时崩溃问题。

**变更规模**：25 个文件，+1727 / -160 行  
**提交数**：5 个  
**测试**：71 项全部通过（55 format + 5 CoreResourcePanel + 11 回归测试）

---

## 提交历史

| # | 提交 ID | 类型 | 说明 |
|---|---------|------|------|
| 1 | `f79fcf5c` | refactor | 提取 safeFormat 为独立模块，补充完整 JSDoc |
| 2 | `f92aed30` | fix | Widget 组件直接传 undefined 给 safeFormatNumber |
| 3 | `4639d486` | fix | 放宽 PortfolioHolding 类型定义，修复 CoreResourcePanel 空值处理 |
| 4 | `4290eaf7` | docs | PR 技术实现细节追加变更对比和风险评估 |
| 5 | `a5f9294c` | chore | 清理根目录非白名单文件和旧分析目录 |

---

## 核心变更

### 1. 类型定义放宽（8 字段）

| 接口 | 字段 | 变更前 | 变更后 |
|------|------|--------|--------|
| `MarketIndexData` | `price` / `change` / `changePercent` | `number` | `?: number` |
| `WatchlistData` | `price` / `changePercent` | `number` | `?: number` |
| `PortfolioHolding` | `price` / `marketValue` / `score` | `number` | `?: number` |

### 2. 安全格式化工具（safeFormat.ts）

| 函数 | 功能 |
|------|------|
| `safeFormatNumber(value, decimals, fallback?)` | 空值/NaN/Infinity → `--` |
| `safeFormatPercent(value, decimals?, fallback?)` | 同上，正数添加 `+` |
| `safeFormatInt(value, fallback?)` | 整数版本 |
| `isValidNumber(v)` | 类型守卫 |

### 3. 组件修复

| 组件 | 修改内容 |
|------|---------|
| WatchlistWidget | `isValidNumber` 守卫 + `safeFormatNumber`/`safeFormatPercent` + 移除 `?? 0` |
| MarketIndicesWidget | 同上 + high/low/volume 空值处理 |
| CoreResourcePanel | `safeFormatNumber` 替换 `.toFixed()` + `formatNumber` 空值处理 |

### 4. 服务层修复

| 服务 | 修改内容 |
|------|---------|
| watchlistMoversService | 类型守卫过滤 + `?? 0` 排序 |

---

## 渲染行为变更

| 场景 | 修改前 | 修改后 |
|------|--------|--------|
| `price = undefined` | `0.00`（`?? 0`）或崩溃（`.toFixed()`） | `--` |
| `changePercent = undefined` | `0.00%`（`?? 0`）或崩溃 | `--` |
| `score = undefined` | 崩溃（`.toFixed()`） | `--` |
| `marketValue = undefined` | 类型错误 | `--` |
| `high / low = undefined` | `0`（`?? 0`） | `--` |

---

## 验证结果

| 验证项 | 结果 | 详情 |
|--------|------|------|
| TypeScript 编译 | ✅ 通过 | `tsc -p tsconfig.prod.json --noEmit` 退出码 0 |
| format 单元测试 | ✅ 55 项通过 | 覆盖 undefined/null/NaN/Infinity/-Infinity |
| CoreResourcePanel 测试 | ✅ 5 项通过 | 含空数据、正常数据、loading、刷新 |
| Widget 回归测试 | ✅ 11 项通过 | undefined 不崩溃 + `--` 占位符 + 正常值无回归 |

---

## 风险评估

| 风险项 | 等级 | 缓解措施 | 落实状态 |
|--------|------|---------|---------|
| 类型放宽导致消费方级联编译错误 | 中 | 逐文件修复所有消费方 | ✅ tsc 通过 |
| `isValidNumber` 守卫遗漏 | 低 | 守卫在函数入口处拦截 | ✅ 编译通过 |
| `--` 与 `0.00` 风格差异 | 低 | `--` 为金融标准占位符 | ✅ 测试通过 |
| `safeFormatNumber` 性能开销 | 极低 | O(1) 开销 | ✅ 无感知 |

---

## 审查清单

### P0 必审

- [ ] [widget.types.ts](file:///d:/FinSightV9/src/types/modules/widget.types.ts) — 5 字段改为 `?:`
- [ ] [types.portfolio.ts](file:///d:/FinSightV9/src/data/types/types.portfolio.ts) — 3 字段改为 `?:` + JSDoc 修复
- [ ] [safeFormat.ts](file:///d:/FinSightV9/src/lib/safeFormat.ts) — 4 个函数实现
- [ ] [WatchlistWidget.tsx](file:///d:/FinSightV9/src/cockpit/widgets/WatchlistWidget.tsx) — `isValidNumber` 守卫 + `--` 占位符
- [ ] [MarketIndicesWidget.tsx](file:///d:/FinSightV9/src/cockpit/widgets/MarketIndicesWidget.tsx) — 同上 + high/low
- [ ] [CoreResourcePanel.tsx](file:///d:/FinSightV9/src/apps/trading/panels/CoreResourcePanel.tsx) — `safeFormatNumber` + `formatNumber` 空值处理

### P1 建议审

- [ ] [watchlistMoversService.ts](file:///d:/FinSightV9/src/services/trading/watchlistMoversService.ts) — 类型守卫 + `?? 0`

---

## 相关文档

- [变更摘要](file:///d:/FinSightV9/docs/code-review-summary.md)
- [设计决策](file:///d:/FinSightV9/docs/pr-safe-format-design-decisions.md)
- [审查指南](file:///d:/FinSightV9/docs/code-review-guide.md)
- [变更影响报告](file:///d:/FinSightV9/docs/change-impact-report.md)
- [回归测试](file:///d:/FinSightV9/src/cockpit/widgets/WidgetNullSafety.regression.test.tsx)
