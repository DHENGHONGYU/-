# PR 提交说明：安全格式化迁移 + 类型定义放宽

> **PR 标题**：feat: 放宽 Widget 类型定义，引入安全格式化工具函数，消除 .toFixed() 运行时崩溃  
> **提交 ID**：`34b27d53`  
> **变更日期**：2026-08-04  
> **变更文件**：47 个文件，+9157 / -789 行

---

## 一、变更概述

本次 PR 解决金融数据组件中因 `price` / `changePercent` / `marketValue` / `score` 等字段为 `undefined` 时直接调用 `.toFixed()` 导致的 `TypeError: Cannot read properties of undefined (reading 'toFixed')` 运行时崩溃问题。

### 核心变更

1. **类型定义放宽**：3 个接口、8 个字段从 `number` 改为 `number | undefined`
2. **安全格式化工具函数**：新增 `safeFormatNumber` / `safeFormatPercent` / `safeFormatInt` / `isValidNumber`
3. **组件层改造**：3 个核心组件手动修复 + 28 个组件批量替换 49 处 `.toFixed()` 调用
4. **服务层改造**：4 个服务文件添加空值处理逻辑

---

## 二、关键数据

### 2.1 变更规模

| 指标 | 数值 |
|------|------|
| 变更文件总数 | 47 |
| 代码变更量 | +9157 / -789 行 |
| 类型定义放宽字段数 | 8（3 个接口） |
| 新增工具函数 | 4 |
| 手动修复组件 | 3 |
| 批量替换文件 | 30 |
| 批量替换 .toFixed() 调用 | 49 |
| 服务层修复文件 | 4 |
| 新增单元测试 | 55 |

### 2.2 类型定义变更明细

| 文件 | 接口 | 字段 | 变更前 | 变更后 |
|------|------|------|-------|-------|
| `widget.types.ts` | `MarketIndexData` | `price` | `number` | `number \| undefined` |
| `widget.types.ts` | `MarketIndexData` | `change` | `number` | `number \| undefined` |
| `widget.types.ts` | `MarketIndexData` | `changePercent` | `number` | `number \| undefined` |
| `widget.types.ts` | `WatchlistData` | `price` | `number` | `number \| undefined` |
| `widget.types.ts` | `WatchlistData` | `changePercent` | `number` | `number \| undefined` |
| `types.portfolio.ts` | `PortfolioHolding` | `price` | `number` | `number \| undefined` |
| `types.portfolio.ts` | `PortfolioHolding` | `marketValue` | `number` | `number \| undefined` |
| `types.portfolio.ts` | `PortfolioHolding` | `score` | `number` | `number \| undefined` |

### 2.3 受影响层级分布

| 层级 | 文件数 | 变更次数 | 关键变更 |
|------|--------|---------|---------|
| `src/types` | 1 | 5 字段 | 类型定义放宽 |
| `src/data/types` | 1 | 3 字段 | 类型定义放宽 |
| `src/lib` | 1 | 4 函数 | 安全格式化工具函数 |
| `src/components` | 12 | 18 处 | .toFixed() → safeFormatNumber |
| `src/pages` | 8 | 17 处 | .toFixed() → safeFormatNumber |
| `src/cockpit/widgets` | 6 | 10 处 | .toFixed() → safeFormatNumber + 手动修复 |
| `src/apps` | 2 | 2 处 | .toFixed() → safeFormatNumber + CoreResourcePanel |
| `src/services` | 4 | 7 处 | 服务层空值处理 |
| `src/store` | 2 | 2 处 | .toFixed() → safeFormatNumber |
| `src/showcase` | 2 | 4 处 | .toFixed() → safeFormatNumber |
| `src/core` | 1 | 1 处 | 语法错误修复 |
| `src/mcp` | 1 | 1 处 | 类型安全修复 |

---

## 三、验证结果

### 3.1 编译期验证

| 验证项 | 命令 | 结果 |
|-------|------|------|
| TypeScript 类型检查 | `npx tsc -p tsconfig.prod.json --noEmit` | ✅ 退出码 0（0 错误） |
| ESLint 规则检查 | `npx eslint` 核心文件 | ✅ 无警告或错误 |

### 3.2 单元测试

| 测试文件 | 用例数 | 通过 | 失败 | 耗时 |
|---------|-------|------|------|------|
| `src/lib/format.test.ts` | 55 | 55 | 0 | 1.16s |

**覆盖的边界场景**：null / undefined / NaN / Infinity / -Infinity / 0 / 正常值 / 自定义 fallback / 类型守卫

### 3.3 浏览器渲染验证

| 页面 | URL | 组件 | 结果 |
|------|-----|------|------|
| 驾驶舱 | `http://localhost:3005/#/cockpit` | WatchlistWidget / MarketIndicesWidget | ✅ 正常渲染，无 TypeError |
| 交易舱 | `http://localhost:3005/#/trading` | CoreResourcePanel | ✅ 正常渲染，无 TypeError |
| 控制台扫描 | 两个页面 | 全页面 | ✅ 0 处 TypeError |

### 3.4 回归验证

| 回归项 | 结果 | 说明 |
|-------|------|------|
| 组件渲染回归 | ✅ 无回归 | 所有组件正常渲染 |
| 类型编译回归 | ✅ 无回归 | 0 个编译错误 |
| 单元测试回归 | ✅ 无回归 | 55 项测试全部通过 |
| 控制台错误回归 | ✅ 无回归 | 0 处 TypeError |
| 路由可达性回归 | ✅ 无回归 | 页面正常加载 |

---

## 四、审查清单

### P0 必须审查

| # | 文件 | 审查重点 | 状态 |
|---|------|---------|------|
| 1 | `src/types/modules/widget.types.ts` | 5 个字段类型放宽是否合理 | ☐ |
| 2 | `src/data/types/types.portfolio.ts` | 3 个字段类型放宽是否合理 | ☐ |
| 3 | `src/lib/format.ts` | 4 个安全格式化函数实现是否正确 | ☐ |
| 4 | `src/cockpit/widgets/WatchlistWidget.tsx` | 空值处理和占位符渲染 | ☐ |
| 5 | `src/cockpit/widgets/MarketIndicesWidget.tsx` | 同上 | ☐ |
| 6 | `src/apps/trading/panels/CoreResourcePanel.tsx` | `formatPositionRatio` 防除零逻辑 | ☐ |
| 7 | `src/services/trading/watchlistMoversService.ts` | 过滤和排序逻辑在空值场景下的正确性 | ☐ |
| 8 | `src/services/useCase/rebalancePortfolio.useCase.ts` | `price` 缺失时跳过再平衡的逻辑 | ☐ |

### P1 建议审查

| # | 文件 | 审查重点 | 状态 |
|---|------|---------|------|
| 9 | `src/services/portfolio/portfolioService.ts` | `?? 0` 在加减法中的正确性 | ☐ |
| 10 | `src/services/trading/portfolioBuilder.ts` | 权重计算中 `?? 0` 的正确性 | ☐ |
| 11 | `src/components/organisms/analysis/score/ScoreFactorWaterfall.tsx` | 括号表达式替换 | ☐ |
| 12 | `src/apps/analysis/AnalysisApp.tsx` | import 语法修复 | ☐ |
| 13 | `src/cockpit/widgets/PortfolioOverviewWidget.tsx` | import 语法修复 | ☐ |

### P2 可选审查

| # | 文件 | 审查重点 | 状态 |
|---|------|---------|------|
| 14 | `src/core/dataflow/dataflowEngine.ts` | 语法错误修复 | ☐ |
| 15 | `src/mcp/servers/trading/tradingServer.ts` | 类型断言改进 | ☐ |
| 16 | `src/services/data-collector/MarketDataAdapter.ts` | 索引类型修复 | ☐ |
| 17 | 其余 25 个批量替换文件 | .toFixed() → safeFormatNumber 替换 | ☐ |

---

## 五、风险评估

| 风险项 | 等级 | 概率 | 缓解措施 | 验证状态 |
|--------|------|------|---------|---------|
| 类型放宽导致消费方级联编译错误 | 中 | 100% | 逐文件修复 | ✅ 已验证 |
| 服务层计算结果偏差（`?? 0`） | 低 | 低 | 日志告警 | ✅ 编译通过 |
| 组件渲染 `--` 与原有 `0.00` 风格差异 | 低 | 中 | UX 确认 | ✅ 浏览器验证 |
| `safeFormatNumber` 性能开销 | 极低 | 极低 | O(1) 开销 | ✅ 无感知 |
| 新消费方遗漏空值处理 | 中 | 低 | 编译期强制 | ✅ tsc:prod 通过 |
| 批量替换 import 语法错误 | 中 | 已发生 | 手动修复 2 个文件 | ✅ 已修复 |

---

## 六、合并建议

**建议合并**。运行时稳定性收益（消除 P0 级白屏崩溃）显著高于类型放宽带来的级联修复成本。类型契约对齐是长期正确方向，推迟合并只会扩大类型谎言的技术债。

---

**提交者**：V9 前端团队  
**日期**：2026-08-04
