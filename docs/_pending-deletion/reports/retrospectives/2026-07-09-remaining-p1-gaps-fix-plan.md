---
title: 2026-07-09-remaining-p1-gaps-fix-plan
tier: T2
status: active
type: reports
domain: ai
doc_id: V9-DOC-AUTO-1B1807
code_version: 2.0.0
summary: title: 2026-07-09-remaining-p1-gaps-fix-plan
maintainer: V9 Architecture Team
phase: retrospective
---


## 缺口概览

| 缺口 | 侧边栏标签 | 现有 Store | 现有组件 | 需新建 |
|------|-----------|-----------|---------|--------|
| `/trading/portfolio` | 投资组合 | `portfolioStore.ts` + `tradingStore.ts` 已有 `portfolio` 状态 | 无 | PortfolioPage.tsx |
| `/trading/risk` | 风险控制 | `riskStore.ts` + `riskStore.derived.ts`（完整） | 无 | RiskControlPage.tsx |
| `/output/dashboard` | 仪表盘 | 无专用 Store | 无 | DashboardPage.tsx |
title: 2026-07-09-remaining-p1-gaps-fix-plan
tier: T2
status: active
type: reports
doc_id: V9-DOC-PROJ-307
domain: project
code_version: 2.0.0

---

## 缺口 1：`/trading/portfolio` — 投资组合

### 可复用资源

- `src/store/portfolioStore.ts` — 已有 `portfolio` 状态、`loadPortfolio()`、`addStock()`、`removeStock()` 等
- `src/store/tradingStore.ts` — 已有 `portfolio`、`portfolioLoading` 选择器
- TradingApp.tsx 中已导入 `portfolio` 和 `loadPortfolio`

### 文件 1：新建 `src/pages/trading/PortfolioPage.tsx`

```tsx
import { memo } from 'react'
import { useTradingStore } from '@/store/tradingStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage } from '@/components/ui/Breadcrumb'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

const PortfolioPage = memo(() => {
  const portfolio = useTradingStore((s) => s.portfolio)
  const portfolioLoading = useTradingStore((s) => s.portfolioLoading)
  const loadPortfolio = useTradingStore((s) => s.loadPortfolio)

  return (
    <ErrorBoundary>
      <div className="space-y-4 p-4">
        <Breadcrumb aria-label="breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink to="/">首页</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbItem><BreadcrumbLink to="/trading">交易舱</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbItem><BreadcrumbPage>投资组合</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <h1 className="text-2xl font-bold tracking-tight">投资组合</h1>

        <Card>
          <CardHeader>
            <CardTitle>持仓概览</CardTitle>
          </CardHeader>
          <CardContent>
            {portfolioLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : portfolio.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">暂无持仓数据</p>
                <Button variant="secondary" size="sm" onClick={() => { logger.info('[PortfolioPage] 加载投资组合'); loadPortfolio() }}>
                  加载投资组合
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {portfolio.map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <span className="font-medium">{item.symbol}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{item.name}</span>
                    </div>
                    <Badge variant="secondary">{item.shares} 股</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  )
})

PortfolioPage.displayName = 'PortfolioPage'
export default PortfolioPage
```

### 文件 2：`src/config/routes.ts` — 在 `/trading/execution` 之后新增

```typescript
// 在 L353 之后插入
{
  path: '/trading/portfolio',
  component: React.lazy(() => import('@/portal/PortalShell')),
  category: 'trading',
  description: '投资组合管理',
},
```

### 文件 3：`src/apps/trading/TradingApp.tsx` — 两处修改

**修改 A：L22 新增 import**

```typescript
const PortfolioPage = React.lazy(() => import('@/pages/trading/PortfolioPage'))
```

**修改 B：日志分支（L77-80 之间插入）**

```typescript
} else if (path === '/trading/execution') {
  branch = 'execution'
  componentName = 'ExecutionPlanPanel'
} else if (path === '/trading/portfolio') {
  branch = 'portfolio'
  componentName = 'PortfolioPage'
} else {
```

**修改 C：渲染分支（L139-145 之间插入）**

```typescript
} else if (path === '/trading/execution') {
  content = (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载执行管理中...</div>}>
      <ExecutionPlanPanel />
    </Suspense>
  )
} else if (path === '/trading/portfolio') {
  content = (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载投资组合中...</div>}>
      <PortfolioPage />
    </Suspense>
  )
} else {
```

### 文件 4：`tests/__tests__/regression/p1-fix-regression.test.ts`

```diff
const KNOWN_GAPS = new Set([
- '/trading/portfolio',
  '/trading/risk',
  '/output/dashboard',
])

const KNOWN_MISMATCHES = new Set([
- '/trading/portfolio',
  '/trading/risk',
  '/output/dashboard',
])
```

---

## 缺口 2：`/trading/risk` — 风险控制

### 可复用资源

- `src/store/riskStore.ts` — 完整 Store，含 `riskMetrics`、`alerts`、`riskScore`、`loadRiskMetrics()`、`scanRiskAlerts()` 等
- `src/store/riskStore.derived.ts` — 派生计算（风险等级、VaR 等）
- `src/store/riskStore.test.ts` — 已有单元测试

### 文件 1：新建 `src/pages/trading/RiskControlPage.tsx`

```tsx
import { memo, useEffect } from 'react'
import { useRiskStore } from '@/store/riskStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage } from '@/components/ui/Breadcrumb'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

const logger = getLogger()

const RiskControlPage = memo(() => {
  const riskMetrics = useRiskStore((s) => s.riskMetrics)
  const alerts = useRiskStore((s) => s.alerts)
  const riskScore = useRiskStore((s) => s.riskScore)
  const loadRiskMetrics = useRiskStore((s) => s.loadRiskMetrics)
  const scanRiskAlerts = useRiskStore((s) => s.scanRiskAlerts)

  useEffect(() => {
    logger.info('[RiskControlPage] 组件挂载，加载风险数据')
    loadRiskMetrics()
  }, [loadRiskMetrics])

  return (
    <ErrorBoundary>
      <div className="space-y-4 p-4">
        <Breadcrumb aria-label="breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink to="/">首页</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbItem><BreadcrumbLink to="/trading">交易舱</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbItem><BreadcrumbPage>风险控制</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <h1 className="text-2xl font-bold tracking-tight">风险控制</h1>

        {/* 风险评分 */}
        <Card>
          <CardHeader>
            <CardTitle>风险评分</CardTitle>
          </CardHeader>
          <CardContent>
            {riskScore !== null ? (
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold">{riskScore}</span>
                <Badge className={riskScore > 70 ? COLOR_TOKENS.danger.tailwind : riskScore > 40 ? COLOR_TOKENS.warning.tailwind : COLOR_TOKENS.success.tailwind}>
                  {riskScore > 70 ? '高风险' : riskScore > 40 ? '中风险' : '低风险'}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无风险评分</p>
            )}
          </CardContent>
        </Card>

        {/* 风险指标 */}
        <Card>
          <CardHeader>
            <CardTitle>风险指标</CardTitle>
          </CardHeader>
          <CardContent>
            {riskMetrics.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无风险指标数据</p>
            ) : (
              <div className="space-y-2">
                {riskMetrics.map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between rounded-md border p-3">
                    <span className="font-medium">{metric.name}</span>
                    <span className="text-sm">{metric.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 风险告警 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>风险告警</CardTitle>
            <Button variant="secondary" size="sm" onClick={() => { logger.info('[RiskControlPage] 扫描风险告警'); scanRiskAlerts() }}>
              扫描告警
            </Button>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">无活跃告警</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <span className="font-medium">{alert.title}</span>
                      <p className="text-xs text-muted-foreground">{alert.description}</p>
                    </div>
                    <Badge className={alert.severity === 'high' ? COLOR_TOKENS.danger.tailwind : COLOR_TOKENS.warning.tailwind}>
                      {alert.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  )
})

RiskControlPage.displayName = 'RiskControlPage'
export default RiskControlPage
```

### 文件 2：`src/config/routes.ts` — 在 portfolio 之后新增

```typescript
{
  path: '/trading/risk',
  component: React.lazy(() => import('@/portal/PortalShell')),
  category: 'trading',
  description: '风险控制管理',
},
```

### 文件 3：`src/apps/trading/TradingApp.tsx` — 三处修改

**修改 A：L22 新增 import**

```typescript
const RiskControlPage = React.lazy(() => import('@/pages/trading/RiskControlPage'))
```

**修改 B：日志分支**

```typescript
} else if (path === '/trading/portfolio') {
  branch = 'portfolio'
  componentName = 'PortfolioPage'
} else if (path === '/trading/risk') {
  branch = 'risk'
  componentName = 'RiskControlPage'
} else {
```

**修改 C：渲染分支**

```typescript
} else if (path === '/trading/portfolio') {
  content = (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载投资组合中...</div>}>
      <PortfolioPage />
    </Suspense>
  )
} else if (path === '/trading/risk') {
  content = (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载风险控制中...</div>}>
      <RiskControlPage />
    </Suspense>
  )
} else {
```

### 文件 4：`tests/__tests__/regression/p1-fix-regression.test.ts`

```diff
const KNOWN_GAPS = new Set([
- '/trading/risk',
  '/output/dashboard',
])

const KNOWN_MISMATCHES = new Set([
- '/trading/risk',
  '/output/dashboard',
])
```

---

## 缺口 3：`/output/dashboard` — 仪表盘

### 可复用资源

- 无可复用 Store（需新建或复用现有分析 Store）
- `src/cockpit/CockpitShell.tsx` — 驾驶舱 Dashboard 可参考布局
- `src/components/chart/` — 图表组件库

### 文件 1：新建 `src/pages/output/DashboardPage.tsx`

```tsx
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage } from '@/components/ui/Breadcrumb'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

const DashboardPage = memo(() => {
  logger.info('[DashboardPage] 渲染仪表盘页面')

  return (
    <ErrorBoundary>
      <div className="space-y-4 p-4">
        <Breadcrumb aria-label="breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink to="/">首页</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbItem><BreadcrumbLink to="/output">输出舱</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbItem><BreadcrumbPage>仪表盘</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>概览</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">仪表盘功能开发中，敬请期待。</p>
              <p className="mt-2 text-xs text-muted-foreground">
                后续将集成研究报告统计、交易复盘摘要、数据导出记录等可视化面板。
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>研报统计</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">待实现</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>导出记录</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">待实现</p></CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  )
})

DashboardPage.displayName = 'DashboardPage'
export default DashboardPage
```

### 文件 2：`src/config/routes.ts` — 在 `/output/export` 之后新增

```typescript
{
  path: '/output/dashboard',
  component: React.lazy(() => import('@/portal/PortalShell')),
  category: 'output',
  description: '输出舱 - 仪表盘',
},
```

### 文件 3：`src/apps/output/OutputApp.tsx` — 两处修改

**修改 A：新增 import**

```typescript
const DashboardPage = React.lazy(() => import('@/pages/output/DashboardPage'))
```

**修改 B：渲染分支（在 `/output/research` 分支之后插入）**

```typescript
} else if (path === '/output/research') {
  content = (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载研究报告中...</div>}>
      <ResearchReportPage />
    </Suspense>
  )
} else if (path === '/output/dashboard') {
  content = (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载仪表盘中...</div>}>
      <DashboardPage />
    </Suspense>
  )
} else if (path === '/output/review') {
```

### 文件 4：`tests/__tests__/regression/p1-fix-regression.test.ts`

```diff
const KNOWN_GAPS = new Set([
- '/output/dashboard',
])
// 所有缺口修复完毕，KNOWN_GAPS 为空

const KNOWN_MISMATCHES = new Set([
- '/output/dashboard',
])
// 所有 mismatch 修复完毕，KNOWN_MISMATCHES 为空
```

---

## 修复顺序建议

| 顺序 | 缺口 | 理由 |
|------|------|------|
| 1 | `/trading/risk` | riskStore 最完整（含 derived + test），风险控制是交易核心功能 |
| 2 | `/trading/portfolio` | portfolioStore 已有基础，tradingStore 已有状态选择器 |
| 3 | `/output/dashboard` | 最简单（占位页面），可快速消除最后一个缺口 |

---

## 修复后验证

```powershell
# 类型检查
npx tsc --noEmit

# 回归单元测试（期望：70 passed / 0 skipped）
npx vitest run tests/__tests__/regression/p1-fix-regression.test.ts --reporter=verbose

# E2E 测试
npx playwright test e2e/output-cabin.spec.ts --reporter=list

# 架构审计
npm run audit:deadcode
```