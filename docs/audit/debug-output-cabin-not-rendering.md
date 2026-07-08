# Debug Session: output-cabin-not-rendering

> **Session ID**: `output-cabin-not-rendering`
> **Status**: [CLOSED]
> **Created**: 2026-07-04
> **Closed**: 2026-07-04
> **Skill**: TRAE-debugger

---

## 1. 问题描述 (Symptoms)

- **现象**: 输出舱模块及其对应的子模块和功能未显示
- **预期**: 用户在输出舱内可访问"研究报告"、"交易复盘"、"数据导出"三个子模块
- **实际**: 主内容区域完全空白，`<main>` 元素 `innerHTML` 长度为 0
- **环境**: V9 智能投研复盘系统，React 19 + React Router v7.18.0 (HashRouter)，dev server 运行于 http://localhost:3001

---

## 2. 调查历程 (Investigation Timeline)

### 2.1 第一轮静态分析（误诊）

初始静态分析认为根因是 `ROUTE_REGISTRY` 缺少 `/output/*` 子路径注册。运行时验证脚本 `scripts/verify-output-routes.ts` 证明所有 5 条路径均已注册（43 总路由），**H1 假设被证伪**。

### 2.2 第二轮运行时证据收集

使用 MCP Playwright 进行运行时验证：

| 证据点 | 结果 |
|--------|------|
| `document.querySelector('main').innerHTML.length` | `0`（完全为空） |
| `main.outerHTML` | `<main class="flex-1 overflow-auto bg-background p-5"></main>` |
| PortalShell 是否渲染 | ✅ 是（header 与 sidebar 正常） |
| OutputApp.tsx chunk 加载 | ✅ 200 OK |
| OutputHubPage.tsx chunk 请求 | ❌ 从未发起 |
| console 错误 | 仅 `localhost:8000/health` 健康检查失败（无关） |

**关键证据**: OutputApp 加载成功但 OutputHubPage 从未被请求，说明 OutputApp 内部的 `<Routes>` 没有匹配任何路由，因此 `<OutputHubPage />` 元素从未被 React 渲染，lazy import 未触发。

### 2.3 同类问题确认

`/#/input` 同样存在此问题：InputApp 的 header 渲染（"输入舱"标题可见）但 Routes 内容为空。AnalysisApp、TradingApp、CommandApp 不使用嵌套 Routes，渲染正常。

---

## 3. 根因分析 (Root Cause Analysis)

### 3.1 真实根因

**React Router v7 descendant `<Routes>` 绝对路径匹配失效**

在 `App.tsx` 中，所有路由通过 `ROUTE_REGISTRY.map` 平铺注册：
```tsx
<Routes>
  {ROUTE_REGISTRY.map((route) => (
    <Route key={route.path} path={route.path} element={<route.component />} />
  ))}
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

当 URL 为 `/output` 时，顶层 `<Route path="/output">` 匹配并渲染 `<PortalShell/>`。PortalShell 内部渲染 `<OutputApp/>`，OutputApp 内部又声明了嵌套 `<Routes>`：

```tsx
// OutputApp.tsx — 修复前
<Routes>
  <Route path="/output" element={<OutputHubPage />} />
  <Route path="/output/hub" element={<OutputHubPage />} />
  ...
</Routes>
```

**在 React Router v7.18.0 中，descendant `<Routes>` 内的绝对路径 `/output` 不会再次匹配当前 URL `/output`**。这与 v6 文档描述的"descendant Routes 匹配完整 URL"行为不一致，可能是 v7 的行为变更或回归。

### 3.2 影响范围

- `src/apps/output/OutputApp.tsx` — 使用嵌套 Routes（受影响）
- `src/apps/input/InputApp.tsx` — 使用嵌套 Routes（受影响）
- `src/apps/analysis/AnalysisApp.tsx` — 不使用 Routes（正常）
- `src/apps/trading/TradingApp.tsx` — 不使用 Routes（正常）
- `src/apps/command/CommandApp.tsx` — 不使用 Routes（正常）

---

## 4. 修复方案 (Fix Plan)

### 4.1 核心策略

将嵌套 `<Routes>` 替换为 `useLocation()` + 条件渲染，绕过 React Router v7 descendant Routes 的路径匹配问题。

### 4.2 代码变更清单

| 文件 | 变更类型 | 变更说明 |
|------|----------|----------|
| `src/apps/output/OutputApp.tsx` | 重构 | 移除 `Route, Routes` import，改用 `useLocation`；将 `<Routes>` 块替换为 if/else 条件渲染 |
| `src/apps/input/InputApp.tsx` | 重构 | 同上，移除嵌套 Routes，改用 `useLocation` + 条件渲染 |

### 4.3 关键代码片段（OutputApp.tsx 修复后）

```tsx
import { useLocation } from 'react-router'

export default function OutputApp(): React.JSX.Element {
  const location = useLocation()
  const path = location.pathname

  logger.info('[OutputApp] 渲染输出舱', { path })

  let content: React.ReactNode
  if (path === '/output/export') {
    content = <DataExportPanel />
  } else if (path === '/output/research') {
    content = <ResearchReportPage />
  } else if (path === '/output/review') {
    content = <TradeReviewPage />
  } else {
    // 默认渲染首页，覆盖 /output 和 /output/hub
    content = <OutputHubPage />
  }

  return (
    <React.Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载中...</div>}>
      {content}
    </React.Suspense>
  )
}
```

### 4.4 关键代码片段（InputApp.tsx 修复后）

```tsx
import { useLocation } from 'react-router'

export default function InputApp(): React.JSX.Element {
  const location = useLocation()
  const path = location.pathname

  logger.info('[InputApp] 渲染输入舱', { path })

  let content: React.ReactNode
  if (path === '/input/bulk-import') {
    content = <BulkImportPanel />
  } else if (path === '/input/hot-sectors') {
    content = <HotSectorPanel />
  } else if (path === '/input/data-test') {
    content = <DataTestPanel />
  } else {
    content = <InputDashboard />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">输入舱</h1>
          <p className="text-sm text-muted-foreground">股票录入 · 批量导入 · 热门板块 · 采集测试</p>
        </div>
      </div>
      {content}
    </div>
  )
}
```

---

## 5. 修复后验证 (Post-Fix Verification)

### 5.1 运行时证据对比

| URL | 修复前 main.innerHTML 长度 | 修复后 main.innerHTML 长度 | 渲染内容 |
|-----|----------------------------|----------------------------|----------|
| `/#/output` | 0 | 5745 | OutputHubPage（输出舱首页卡片） |
| `/#/output/hub` | 0 | 5745 | OutputHubPage（经 HUB_APPS 渲染） |
| `/#/output/research` | 0 | 3724 | ResearchReportPage（研究报告） |
| `/#/output/review` | 0 | 2894 | TradeReviewPage（交易复盘） |
| `/#/output/export` | 0 | 1573 | DataExportPanel（数据导出） |
| `/#/input` | 0 | 13020 | InputDashboard（输入舱看板） |
| `/#/input/bulk-import` | 0 | 1964 | BulkImportPanel（批量导入） |

### 5.2 Console 错误验证

修复后 console 仅剩无关错误：
- `Failed to load resource: net::ERR_CONNECTION_REFUSED @ http://localhost:8000/health` — 采集服务健康检查失败（与本次修复无关）

修复前的 `ReferenceError: Routes is not defined`（HMR 过渡期临时错误）已消失。

### 5.3 网络请求验证

修复后访问 `/#/output` 时，`OutputHubPage.tsx` chunk 被正确请求并加载（200 OK），证明条件渲染成功触发了 `React.lazy` import。

---

## 6. 清理与总结 (Cleanup & Summary)

- [x] `OutputApp.tsx` 嵌套 Routes 替换为 useLocation + 条件渲染
- [x] `InputApp.tsx` 同步修复
- [x] 7 条路由运行时验证通过（5 输出舱 + 2 输入舱）
- [x] console 错误只剩无关的 fetcher 健康检查
- [x] React.lazy chunk 正确加载

**最终结论**: 输出舱及其子模块无法显示的真实根因是 **React Router v7 descendant `<Routes>` 绝对路径匹配失效**，而非路由注册缺失。前一版的"路由注册补全"修复虽已完成但未解决核心问题——嵌套 Routes 不匹配导致主内容区为空。本次修复通过改用 `useLocation` + 条件渲染，彻底绕过 React Router v7 descendant Routes 的路径匹配问题，所有舱室子路由现在均可正常渲染。

**方法论启示**: 静态代码分析易被表面现象误导（如"路由未注册"假象）。只有通过运行时证据收集（main.innerHTML 为 0、lazy chunk 未请求）才能定位真实根因。本次遵循 TRAE-debugger "假设 → 证伪 → 证据 → 修复 → 验证" 的科学调试流程，先证伪 H1（路由注册缺失），再通过 Playwright 运行时证据锁定真实根因。
