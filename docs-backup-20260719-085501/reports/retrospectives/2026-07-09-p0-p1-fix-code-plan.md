---
title: P0/P1 路由缺口修复代码方案
type: reports
domain: project
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## P0：`/output/reports` 路径不一致（已修复）"
tags: [project, fix, routing, report, spec]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# P0/P1 路由缺口修复代码方案

> **Date**: 2026-07-09 | **状�?*: P0 已修复，P1 待执�?
---

## P0：`/output/reports` 路径不一致（已修复）

**问题**：侧边栏路径 `/output/reports` 与实际页面路�?`/output/research` 不一致，点击侧边�?研报复盘"按钮 �?404�?
**修复内容**�? 行代码）�?
### 文件 1：`src/portal/PortalShell.tsx` L123

```diff
- { key: 'reports', label: '研报复盘', path: '/output/reports', icon: FileText },
+ { key: 'reports', label: '研报复盘', path: '/output/research', icon: FileText },
```

### 文件 2：`tests/__tests__/regression/p1-fix-regression.test.ts`

```diff
// KNOWN_SIDEBAR_ITEMS 中更�?- { key: 'reports', label: '研报复盘', path: '/output/reports', cabin: 'output' },
+ { key: 'reports', label: '研报复盘', path: '/output/research', cabin: 'output' },

// KNOWN_GAPS 中移�?- '/output/reports',   // 实际页面路由�?/output/research

// KNOWN_MISMATCHES 中移�?- '/output/reports',      // 侧边栏路径，实际页面路由�?/output/research
```

**验证结果**：tsc 零错误，回归测试 66 passed / 4 skipped，研报复盘测试由 skip �?pass�?
---

## P1：`/trading/execution` 侧边栏指向未注册路由

**问题**：侧边栏"执行管理"按钮指向 `/trading/execution`，但路由表中仅注册了 `/trading/execution-plans`。ExecutionPlanPanel 组件已存在，只需添加路由别名�?
**修复涉及 3 个文�?*�?
### 文件 1：`src/config/routes.ts` �?�?L347 后新增路由注�?
```typescript
// �?/trading/execution-plans 之后插入
{
  path: '/trading/execution',
  component: React.lazy(() => import('@/portal/PortalShell')),
  category: 'trading',
  description: '执行管理（别�?�?execution-plans�?,
},
```

**插入位置**：在 `routes.ts` L347 �?`},` 之后，`{ path: '/input/local-knowledge'` 之前�?
### 文件 2：`src/apps/trading/TradingApp.tsx` �?两处修改

**修改 A：路由分发日志（L74-77 之间插入�?*

```typescript
// �?} else if (path === '/trading/execution-plans') { 之后添加
} else if (path === '/trading/execution') {
  branch = 'execution'
  componentName = 'ExecutionPlanPanel'
```

**修改 B：子路由渲染（L130-135 之间插入�?*

```typescript
// �?} else if (path === '/trading/execution-plans') { ... } 之后添加
} else if (path === '/trading/execution') {
  content = (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载执行管理�?..</div>}>
      <ExecutionPlanPanel />
    </Suspense>
  )
```

**完整修改后的 TradingApp.tsx 路由分发代码**�?
```typescript
// 路由映射（更新注释）
// - /trading/strategy-snapshots �?StrategySnapshotPage
// - /trading/holdings          �?HoldingsPage
// - /trading/execution-plans   �?ExecutionPlanPanel
// - /trading/execution         �?ExecutionPlanPanel（别名）
// - /trading（默认）           �?交易看板（TradingDashboard�?
// 日志分支（L66-80�?let branch: string
let componentName: string
if (path === '/trading/strategy-snapshots') {
  branch = 'strategy-snapshots'
  componentName = 'StrategySnapshotPage'
} else if (path === '/trading/holdings') {
  branch = 'holdings'
  componentName = 'HoldingsPage'
} else if (path === '/trading/execution-plans') {
  branch = 'execution-plans'
  componentName = 'ExecutionPlanPanel'
} else if (path === '/trading/execution') {
  branch = 'execution'
  componentName = 'ExecutionPlanPanel'
} else {
  branch = 'default'
  componentName = 'TradingDashboard'
}

// 渲染分支（L118-136�?let content: React.ReactNode
if (path === '/trading/strategy-snapshots') {
  content = (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载策略快照�?..</div>}>
      <StrategySnapshotPage />
    </Suspense>
  )
} else if (path === '/trading/holdings') {
  content = (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载持仓管理�?..</div>}>
      <HoldingsPage />
    </Suspense>
  )
} else if (path === '/trading/execution-plans') {
  content = (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载执行计划�?..</div>}>
      <ExecutionPlanPanel />
    </Suspense>
  )
} else if (path === '/trading/execution') {
  content = (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载执行管理�?..</div>}>
      <ExecutionPlanPanel />
    </Suspense>
  )
} else {
  // 默认渲染交易看板
  content = (...)
}
```

### 文件 3：`tests/__tests__/regression/p1-fix-regression.test.ts` �?移除 `/trading/execution` 从已知缺�?
```diff
// KNOWN_GAPS
const KNOWN_GAPS = new Set([
  '/trading/portfolio',
- '/trading/execution',
  '/trading/risk',
  '/output/dashboard',
])

// KNOWN_MISMATCHES
const KNOWN_MISMATCHES = new Set([
  '/trading/portfolio',
- '/trading/execution',
  '/trading/risk',
  '/output/dashboard',
])
```

---

## 修复后验证步�?
```powershell
# 1. 类型检�?npx tsc --noEmit

# 2. 回归单元测试（期望：67 passed / 3 skipped�?npx vitest run tests/__tests__/regression/p1-fix-regression.test.ts --reporter=verbose

# 3. E2E 测试
npx playwright test e2e/output-cabin.spec.ts --reporter=list

# 4. 架构审计
npm run audit:deadcode
```

---

## 对比：两种修复策�?
| 策略 | 改侧边栏 path | 注册路由别名 |
|------|-------------|------------|
| 改动文件 | 1 个（PortalShell.tsx�?| 3 个（routes.ts + TradingApp.tsx + 测试�?|
| 改动行数 | 1 �?| ~10 �?|
| 兼容�?| 需确保 `/trading/execution-plans` 页面标题�?执行管理"语义一�?| 保留两个路径均可访问 |
| 推荐�?| 快速修�?| 架构更完�?|

**推荐策略**：注册路由别名（改动 3 个文件），因为：
1. 侧边栏路�?`/trading/execution` 语义更清晰（用户不关心内部叫 `execution-plans`�?2. 同时保留 `/trading/execution-plans` 避免破坏已有链接
3. 符合 AGENTS.md 路由注册规范