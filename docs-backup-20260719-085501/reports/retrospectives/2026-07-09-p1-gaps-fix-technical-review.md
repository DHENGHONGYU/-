---
title: P1 缺口修复技术复?
type: reports
domain: project
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "优先?*: P1（高）| 验证状?*: 全部通过"
tags: [project, fix, review]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---orts
domain: project
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [project, fix, review]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# P1 缺口修复技术复?
> **Date**: 2026-07-09 | **状?*: 已完?| **修复缺口?*: 3/3
> **优先?*: P1（高）| **验证状?*: 全部通过

---

## 一、缺口概?
| 缺口路径 | 侧边栏标?| 问题描述 | 修复类型 | 影响范围 |
|---------|-----------|---------|---------|---------|
| `/trading/risk` | 风险控制 | 侧边栏按钮存在但页面未注册，点击?404 | 新建页面 | 交易舱风控功?|
| `/trading/portfolio` | 投资组合 | 侧边栏按钮存在但页面未注册，点击?404 | 新建页面 | 交易舱组合管?|
| `/output/dashboard` | 仪表?| 侧边栏按钮存在但页面未注册，点击?404 | 新建页面 | 输出舱数据概?|

---

## 二、变更摘?
### 2.1 新增文件? 个）

| 文件 | 路径 | 说明 |
|------|------|------|
| RiskControlPage.tsx | `src/pages/trading/RiskControlPage.tsx` | 风险控制页面，展示风控三态、熔断回路、裁决统计、裁决记?|
| PortfolioPage.tsx | `src/pages/trading/PortfolioPage.tsx` | 投资组合页面，展示核心组合持仓、策略筛选结?|
| DashboardPage.tsx | `src/pages/output/DashboardPage.tsx` | 仪表盘页面（占位），预留研报统计、导出记录等面板位置 |

### 2.2 修改文件? 个）

| 文件 | 修改内容 |
|------|---------|
| [routes.ts](../../../src/config/routes.ts) | 新增 `/trading/portfolio`、`/trading/risk`、`/output/dashboard` 路由注册 |
| [TradingApp.tsx](../../../src/apps/trading/TradingApp.tsx) | 新增 PortfolioPage、RiskControlPage 的懒加载导入和路由分发分?|
| [OutputApp.tsx](../../../src/apps/output/OutputApp.tsx) | 新增 DashboardPage 的懒加载导入和路由分发分?|
| [p1-fix-regression.test.ts](../../../tests/__tests__/regression/p1-fix-regression.test.ts) | 清空 `KNOWN_GAPS` ?`KNOWN_MISMATCHES`，所有测试转为通过 |

---

## 三、技术实现细?
### 3.1 RiskControlPage ?风险控制页面

**核心设计**：复?`riskStore` 及其派生查询，实现完整的风控状态可视化?
**数据来源**?
| 数据 | Store / Hook | 用?|
|------|-------------|------|
| triState | `useRiskStore` | 当前风控三态（normal/warning/blocked?|
| circuitState | `useRiskStore` | 熔断回路状态（closed/open/half-open?|
| verdicts | `useRiskStore` | 裁决记录列表 |
| isExecutable | `useIsExecutable()` | 是否可执行交?|
| levelText | `useRiskLevelText()` | 风险等级中文描述 |
| isCircuitOpen | `useIsCircuitOpen()` | 回路是否开?|
| blocks | `usePendingBlocks()` | 当前阻断原因列表 |
| blockedCount/warningCount/normalCount | 派生函数 | 统计数据 |
| blockedRate | 派生函数 | 阻断比例 |

**UI 结构**?- 三态卡片：显示当前风险等级 + 阻断原因
- 熔断回路卡片：显示回路状?+ 干预提示
- 裁决统计卡片：总数、阻断率、各状态计?- 裁决记录列表：最?20 条裁决记?
**代码亮点**?- 使用 `COLOR_TOKENS` 令牌系统控制颜色（高风险=红色、中风险=黄色、低风险=绿色?- 组件挂载时记录初始化日志，便于追踪问?- 使用 `memo` 优化渲染性能

### 3.2 PortfolioPage ?投资组合页面

**核心设计**：复?`tradingStore` Facade ?`portfolioStore`，展示组合持仓和策略结果?
**数据来源**?
| 数据 | Store / Hook | 用?|
|------|-------------|------|
| portfolio | `useTradingStore` | 核心组合数据 |
| portfolioLoading | `useTradingStore` | 加载状?|
| loadPortfolio | `useTradingStore` | 触发组合构建 |
| strategyResult | `usePortfolioStore` | 策略筛选结?|
| stocks/orders | `useTradingStore` | 观察池和订单数据（日志用?|

**UI 结构**?- 操作按钮：触发组合加?- 核心组合卡片：组合名称、持仓数、持仓列?- 策略结果卡片：策略名称、总候选数、选中?
**代码亮点**?- 兼容 `PortfolioHolding` 接口的实际字段（`currentShares`/`currentWeight`?- 兼容 `StrategyResult` 接口的实际结构（`summary.selectedCount`?- 使用 `ErrorBoundary` 包裹，防止页面崩?
### 3.3 DashboardPage ?仪表盘页?
**核心设计**：占位页面，预留未来扩展空间?
**UI 结构**?- 概览卡片：说明功能开发中
- 研报统计卡片（待实现?- 导出记录卡片（待实现?
**代码亮点**?- 使用 `memo` 优化渲染性能
- 预留清晰的扩展说明，便于后续开?
---

## 四、路由注册与分发

### 4.1 路由注册表（routes.ts?
新增 3 条路由，统一指向 `PortalShell`?
```typescript
// 交易?{ path: '/trading/portfolio', component: PortalShell, category: 'trading', description: '投资组合管理' },
{ path: '/trading/risk', component: PortalShell, category: 'trading', description: '风险控制管理' },

// 输出?{ path: '/output/dashboard', component: PortalShell, category: 'output', description: '输出?- 仪表? },
```

### 4.2 子路由分发（TradingApp.tsx?
新增两个懒加载导入和对应分支?
```typescript
const PortfolioPage = React.lazy(() => import('@/pages/trading/PortfolioPage'))
const RiskControlPage = React.lazy(() => import('@/pages/trading/RiskControlPage'))

// 日志分支
} else if (path === '/trading/portfolio') { branch = 'portfolio'; componentName = 'PortfolioPage' }
} else if (path === '/trading/risk') { branch = 'risk'; componentName = 'RiskControlPage' }

// 渲染分支
} else if (path === '/trading/portfolio') { content = <PortfolioPage /> }
} else if (path === '/trading/risk') { content = <RiskControlPage /> }
```

### 4.3 子路由分发（OutputApp.tsx?
新增 DashboardPage 懒加载导入和分支?
```typescript
const DashboardPage = React.lazy(() => import('@/pages/output/DashboardPage'))

// 日志分支
} else if (path === '/output/dashboard') { branch = 'dashboard'; componentName = 'DashboardPage' }

// 渲染分支
} else if (path === '/output/dashboard') { content = <DashboardPage /> }
```

---

## 五、测试验证结?
### 5.1 回归测试

```
测试文件: tests/__tests__/regression/p1-fix-regression.test.ts
测试数量: 70 ?通过: 70 ?跳过: 0 ?失败: 0 ?耗时: 2.66s
```

**关键测试覆盖**?
| 测试套件 | 用例?| 说明 |
|---------|--------|------|
| 路由注册完整?| 12 | 验证所有关键路由已注册，含新增?3 ?|
| 侧边栏路径与路由注册一致?| 22 | 验证所有侧边栏按钮路径在路由表中注?|
| 路由分类正确?| 4 | 验证新增路由分类正确（trading/output?|
| PANEL_ITEMS 结构完整?| 7 | 验证侧边栏配置结构正?|

### 5.2 类型检?
```
命令: npx tsc --noEmit
结果: 0 个新错误（预存错误：reportGenerator.ts ?4 个未使用变量?```

### 5.3 死代码审?
```
命令: npm run audit:deadcode
结果: 
  violations: 0
  unregisteredPages: 0
```

### 5.4 架构合规?
- ?分层规则：`pages/` 仅依?`store/` ?`components/`
- ?四步契约：类型定??Store ?Service ?UI（复用现?Store?- ?颜色令牌：使?`COLOR_TOKENS`，无硬编码颜?- ?日志规范：核心逻辑?`logger.info` 输出

---

## 六、修复前后对?
### 6.1 回归测试状态变?
| 测试?| 修复?| 修复?|
|--------|--------|--------|
| /trading/portfolio 路由注册 | skipped | passed |
| /trading/risk 路由注册 | skipped | passed |
| /output/dashboard 路由注册 | skipped | passed |
| KNOWN_GAPS 大小 | 3 | 0 |
| KNOWN_MISMATCHES 大小 | 3 | 0 |

### 6.2 用户体验变化

| 操作 | 修复?| 修复?|
|------|--------|--------|
| 点击"风险控制"按钮 | 404 页面 | 展示风控三态、熔断状态、裁决记?|
| 点击"投资组合"按钮 | 404 页面 | 展示组合持仓、策略结?|
| 点击"仪表?按钮 | 404 页面 | 展示占位页面，提示功能开发中 |

---

## 七、后续优化建?
### 7.1 风险控制页面

- 增加风险趋势图表（使?Recharts?- 增加人工干预按钮（恢复熔断回路）
- 增加按标的聚合的风险统计

### 7.2 投资组合页面

- 增加组合收益曲线图表
- 增加持仓权重饼图
- 增加再平衡建?
### 7.3 仪表盘页?
- 集成研报统计数据
- 集成交易复盘摘要
- 集成数据导出记录
- 增加实时数据更新（WebSocket?
---

## 八、变更清?
```
新增文件:
  src/pages/trading/RiskControlPage.tsx      (240 ?
  src/pages/trading/PortfolioPage.tsx        (162 ?
  src/pages/output/DashboardPage.tsx         (72 ?

修改文件:
  src/config/routes.ts                       (+12 ?
  src/apps/trading/TradingApp.tsx            (+20 ?
  src/apps/output/OutputApp.tsx              (+9 ?
  tests/__tests__/regression/p1-fix-regression.test.ts  (+2 ? -6 ?
```

---

**文档版本**: v1.0.0 | **生成时间**: 2026-07-09 | **作?*: AI Agent