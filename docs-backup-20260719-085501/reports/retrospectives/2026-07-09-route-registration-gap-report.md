---
title: 路由注册缺失报告
type: reports
domain: frontend
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "**Date**: 2026-07-09 | **严重级别**: P1 | **影响范围**: 交易舱 × 3, 输出舱 × 2 **Source**: E2E 测试 + 单元回归测试 `p1-..."
tags: [frontend, routing, spec, report]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 路由注册缺失报告

> **Date**: 2026-07-09 | **严重级别**: P1 | **影响范围**: 交易舱 × 3, 输出舱 × 2
> **Source**: E2E 测试 + 单元回归测试 `p1-fix-regression.test.ts`

---

## 一、概述

侧边栏（`PortalShell.tsx` PANEL_ITEMS）中定义了 5 个按钮，但其指向的路径未在路由注册表（`ROUTE_REGISTRY`）中注册，导致用户点击侧边栏按钮后进入 404 页面。

**三层架构对照**：

```
ROUTE_REGISTRY (routes.ts)  →  PortalShell → App 分发器 → 页面组件
     ? 5个缺口                    ? 已定义       ? 无分支       ? 不存在
```

---

## 二、缺失路由清单

### 缺口 1：`/trading/portfolio` — 投资组合

| 检查项 | 状态 | 说明 |
|--------|------|------|
| ROUTE_REGISTRY | ? 未注册 | 路由表中无此路径 |
| PortalShell PANEL_ITEMS | ? 已定义 | `key: 'portfolio', label: '投资组合', path: '/trading/portfolio'` |
| TradingApp 分发分支 | ? 无分支 | 现有分支：`/trading/strategy-snapshots`, `/trading/holdings`, `/trading/execution-plans` |
| 页面组件 | ? 不存在 | `src/pages/trading/` 下仅有 `StrategySnapshotPage.tsx`, `HoldingsPage.tsx` |
| 点击后果 | 404 | 路由未注册 → 侧边栏导航 → 白屏/404 |

**修复方案**：
- 方案 A（推荐）：创建 `src/pages/trading/PortfolioPage.tsx`，在 `ROUTE_REGISTRY` 注册，在 `TradingApp.tsx` 添加分发分支
- 方案 B（临时）：将侧边栏按钮指向已存在的路由（如 `/trading/holdings`）

---

### 缺口 2：`/trading/execution` — 执行管理

| 检查项 | 状态 | 说明 |
|--------|------|------|
| ROUTE_REGISTRY | ? 未注册 | 路由表中无此路径 |
| PortalShell PANEL_ITEMS | ? 已定义 | `key: 'execution', label: '执行管理', path: '/trading/execution'` |
| TradingApp 分发分支 | ? 无分支 | 注意：存在 `/trading/execution-plans` 路由（指向 ExecutionPlanPanel），但侧边栏指向 `/trading/execution` |
| 页面组件 | ? 不存在 | 可复用 `ExecutionPlanPanel`（`src/apps/trading/panels/ExecutionPlanPanel`） |
| 点击后果 | 404 | 路由未注册 → 侧边栏导航 → 白屏/404 |

**修复方案**：
- 方案 A（推荐）：在 `ROUTE_REGISTRY` 注册 `/trading/execution`，在 `TradingApp.tsx` 添加分发分支指向 `ExecutionPlanPanel`
- 方案 B（最小改动）：将侧边栏 path 改为 `/trading/execution-plans`（已存在的路由）

---

### 缺口 3：`/trading/risk` — 风险控制

| 检查项 | 状态 | 说明 |
|--------|------|------|
| ROUTE_REGISTRY | ? 未注册 | 路由表中无此路径 |
| PortalShell PANEL_ITEMS | ? 已定义 | `key: 'risk', label: '风险控制', path: '/trading/risk'` |
| TradingApp 分发分支 | ? 无分支 | 无任何风险控制相关页面 |
| 页面组件 | ? 不存在 | 需新建 |
| 点击后果 | 404 | 路由未注册 → 侧边栏导航 → 白屏/404 |

**修复方案**：
- 方案 A（推荐）：创建 `src/pages/trading/RiskControlPage.tsx`，在 `ROUTE_REGISTRY` 注册，在 `TradingApp.tsx` 添加分发分支
- 方案 B：如果暂不实现，从 PANEL_ITEMS 中移除"风险控制"按钮

---

### 缺口 4：`/output/reports` — 研报复盘（路径不一致）

| 检查项 | 状态 | 说明 |
|--------|------|------|
| ROUTE_REGISTRY | ? 未注册 | 路由表中无此路径 |
| 实际路由 | `/output/research` | 已注册，指向 `ResearchReportPage` |
| PortalShell PANEL_ITEMS | ?? 路径不一致 | `key: 'reports', label: '研报复盘', path: '/output/reports'` |
| OutputApp 分发分支 | ?? 使用 `/output/research` | `else if (path === '/output/research') → ResearchReportPage` |
| 页面组件 | ? 已存在 | `ResearchReportPage.tsx` 在 `/output/research` 下正常工作 |
| 点击后果 | 404 | 侧边栏导航到 `/output/reports` → 路由未注册 → 404 |

**根本原因**：侧边栏路径 `/output/reports` 与实际页面路由 `/output/research` 不一致。

**修复方案**（推荐）：
- 将 PortalShell PANEL_ITEMS 中 `reports` 的 `path` 从 `/output/reports` 改为 `/output/research`
- 或在 ROUTE_REGISTRY 中新增 `/output/reports` 作为 `/output/research` 的别名路由

---

### 缺口 5：`/output/dashboard` — 仪表盘

| 检查项 | 状态 | 说明 |
|--------|------|------|
| ROUTE_REGISTRY | ? 未注册 | 路由表中无此路径 |
| PortalShell PANEL_ITEMS | ? 已定义 | `key: 'dashboard', label: '仪表盘', path: '/output/dashboard'` |
| OutputApp 分发分支 | ? 无分支 | OutputApp 仅处理 `/output/export`, `/output/research`, `/output/review`, `/output`(Hub) |
| 页面组件 | ? 不存在 | 需新建 |
| 点击后果 | 404 | 路由未注册 → 侧边栏导航 → 白屏/404 |

**修复方案**：
- 方案 A（推荐）：创建 `src/pages/output/DashboardPage.tsx`，在 `ROUTE_REGISTRY` 注册，在 `OutputApp.tsx` 添加分发分支
- 方案 B：如果暂不实现，从 PANEL_ITEMS 中移除"仪表盘"按钮

---

## 三、影响汇总

| 舱室 | 缺口数 | 影响用户数 | 严重级别 |
|------|--------|-----------|---------|
| 交易舱 | 3 | 全部交易舱用户 | P1（高） |
| 输出舱 | 2 | 全部输出舱用户 | P1（高） |

**当前行为**：用户点击这 5 个侧边栏按钮后，页面白屏或显示 404。

---

## 四、修复优先级建议

| 优先级 | 缺口 | 理由 | 推荐方案 |
|--------|------|------|---------|
| **P0（立即修复）** | `/output/reports` | 页面已存在，仅路径不一致，修复成本最低 | 改侧边栏 path 为 `/output/research` |
| **P1（尽快修复）** | `/trading/execution` | 可复用 ExecutionPlanPanel，修复成本低 | 改侧边栏 path 为 `/trading/execution-plans` 或注册路由 |
| **P2（规划修复）** | `/trading/portfolio` | 需新建页面 | 创建 PortfolioPage + 注册路由 |
| **P2（规划修复）** | `/trading/risk` | 需新建页面 | 创建 RiskControlPage + 注册路由 |
| **P2（规划修复）** | `/output/dashboard` | 需新建页面 | 创建 DashboardPage + 注册路由 |

---

## 五、修复 SOP

### 标准新增页面流程（参考 AGENTS.md §5）

1. 在 `src/pages/{cabin}/` 创建页面组件
2. 在 `src/config/routes.ts` 的 `ROUTE_REGISTRY` 中注册路由
3. 在对应 `src/apps/{cabin}/{Cabin}App.tsx` 中添加 `React.lazy()` 导入和 else-if 分支
4. 运行 `npm run audit:deadcode` 确认页面不再出现在「未注册页面」列表中
5. 运行 `npx vitest run tests/__tests__/regression/p1-fix-regression.test.ts` 确认回归测试通过

### 仅修复路径不一致（缺口 4）

1. 修改 `src/portal/PortalShell.tsx` 中 PANEL_ITEMS 的 `reports.path` 为 `/output/research`
2. 更新 `tests/__tests__/regression/p1-fix-regression.test.ts` 中 KNOWN_SIDEBAR_ITEMS 对应条目
3. 运行 E2E 测试 `npx playwright test e2e/output-cabin.spec.ts` 验证

---

## 六、相关文件

| 文件 | 角色 |
|------|------|
| `src/config/routes.ts` | 路由注册表（ROUTE_REGISTRY） |
| `src/portal/PortalShell.tsx` | 侧边栏配置（PANEL_ITEMS） |
| `src/apps/trading/TradingApp.tsx` | 交易舱子路由分发 |
| `src/apps/output/OutputApp.tsx` | 输出舱子路由分发 |
| `tests/__tests__/regression/p1-fix-regression.test.ts` | 回归测试（标记为 skipped 的 5 个测试） |
| `e2e/output-cabin.spec.ts` | 输出舱 E2E 测试 |
| `e2e/data-migration.spec.ts` | 面包屑导航 E2E 测试 |