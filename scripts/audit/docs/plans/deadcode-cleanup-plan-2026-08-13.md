# Dead Code 清理计划

> 生成时间: 2026-08-13T15:50:26.697Z
> 扫描文件: 1440
> 发现问题: 60 条

## 统计概览

| 分类 | 数量 | 严重度 |
|------|------|--------|
| 合法空状态 | 6 | ✅ 安全 |
| 合法 fallback | 2 | ✅ 安全 |
| 路由注册 | 10 | 🔍 需审查 |
| Cabin 组件（可能已废弃） | 8 | 🗑️ 建议删除 |
| 图表组件（可能动态加载） | 8 | 🔍 需审查 |
| Cockpit 组件（可能已废弃） | 4 | 🗑️ 建议删除 |
| 通用组件（可能桶导出） | 8 | ✅ 安全 |
| Organism 组件（可能条件渲染） | 4 | 🔍 需审查 |
| 错误边界（全局注册） | 2 | ✅ 安全 |
| 布局组件（动态引用） | 6 | ✅ 安全 |
| 命名冲突 | 2 | 🔍 需审查 |

## 合法空状态

| 文件 | 原因 | 建议操作 |
|------|------|----------|
| src/components/chart/industry/ValuationDistribution.test.tsx | React 组件返回 null 是合法的条件渲染模式 | 在组件/测试中添加注释说明这是预期的空状态 |
| src/components/chart/industry/ValuationDistribution.test.tsx | React 组件返回 null 是合法的条件渲染模式 | 在组件/测试中添加注释说明这是预期的空状态 |
| src/components/common/MockDataBadge.tsx | React 组件返回 null 是合法的条件渲染模式 | 在组件/测试中添加注释说明这是预期的空状态 |
| src/components/chart/industry/ValuationDistribution.test.tsx | React 组件返回 null 是合法的条件渲染模式 | 在组件/测试中添加注释说明这是预期的空状态 |
| src/components/chart/industry/ValuationDistribution.test.tsx | React 组件返回 null 是合法的条件渲染模式 | 在组件/测试中添加注释说明这是预期的空状态 |
| src/components/common/MockDataBadge.tsx | React 组件返回 null 是合法的条件渲染模式 | 在组件/测试中添加注释说明这是预期的空状态 |

## 合法 fallback

| 文件 | 原因 | 建议操作 |
|------|------|----------|
| src/hooks/useMediaQuery.ts | noop 是事件订阅/定时器等场景的安全默认值 | 添加 JSDoc 注释说明 fallback 用途 |
| src/hooks/useMediaQuery.ts | noop 是事件订阅/定时器等场景的安全默认值 | 添加 JSDoc 注释说明 fallback 用途 |

## 路由注册

| 文件 | 原因 | 建议操作 |
|------|------|----------|
| src/pages/analysis/SectorAnalysisPage.tsx | 页面文件未在路由表或 App 分发器中注册 | ① 确认页面是否为架构预留；② 若已实现则注册到对应 App；③ 若废弃则删除文件 |
| src/pages/output/FactorDashboardPage.tsx | 页面文件未在路由表或 App 分发器中注册 | ① 确认页面是否为架构预留；② 若已实现则注册到对应 App；③ 若废弃则删除文件 |
| src/pages/output/PredictionPage.tsx | 页面文件未在路由表或 App 分发器中注册 | ① 确认页面是否为架构预留；② 若已实现则注册到对应 App；③ 若废弃则删除文件 |
| src/pages/output/RetrospectivePage.tsx | 页面文件未在路由表或 App 分发器中注册 | ① 确认页面是否为架构预留；② 若已实现则注册到对应 App；③ 若废弃则删除文件 |
| src/pages/trading/tradingFlow.types.tsx | 页面文件未在路由表或 App 分发器中注册 | ① 确认页面是否为架构预留；② 若已实现则注册到对应 App；③ 若废弃则删除文件 |
| src/pages/analysis/SectorAnalysisPage.tsx | 页面文件未在路由表或 App 分发器中注册 | ① 确认页面是否为架构预留；② 若已实现则注册到对应 App；③ 若废弃则删除文件 |
| src/pages/output/FactorDashboardPage.tsx | 页面文件未在路由表或 App 分发器中注册 | ① 确认页面是否为架构预留；② 若已实现则注册到对应 App；③ 若废弃则删除文件 |
| src/pages/output/PredictionPage.tsx | 页面文件未在路由表或 App 分发器中注册 | ① 确认页面是否为架构预留；② 若已实现则注册到对应 App；③ 若废弃则删除文件 |
| src/pages/output/RetrospectivePage.tsx | 页面文件未在路由表或 App 分发器中注册 | ① 确认页面是否为架构预留；② 若已实现则注册到对应 App；③ 若废弃则删除文件 |
| src/pages/trading/tradingFlow.types.tsx | 页面文件未在路由表或 App 分发器中注册 | ① 确认页面是否为架构预留；② 若已实现则注册到对应 App；③ 若废弃则删除文件 |

## Cabin 组件（可能已废弃）

| 文件 | 原因 | 建议操作 |
|------|------|----------|
| src/components/cabin/ScoreHistoryTable.tsx | Cabin 子系统已迁移到 Cockpit，Score* 组件可能为僵尸 | ① 确认无引用后删除 ScoreHistoryTable.tsx 等 4 个文件；② 或迁移到 Cockpit 体系 |
| src/components/cabin/ScoreItem.tsx | Cabin 子系统已迁移到 Cockpit，Score* 组件可能为僵尸 | ① 确认无引用后删除 ScoreHistoryTable.tsx 等 4 个文件；② 或迁移到 Cockpit 体系 |
| src/components/cabin/ScoreSnapshot.tsx | Cabin 子系统已迁移到 Cockpit，Score* 组件可能为僵尸 | ① 确认无引用后删除 ScoreHistoryTable.tsx 等 4 个文件；② 或迁移到 Cockpit 体系 |
| src/components/cabin/ScoreSummary.tsx | Cabin 子系统已迁移到 Cockpit，Score* 组件可能为僵尸 | ① 确认无引用后删除 ScoreHistoryTable.tsx 等 4 个文件；② 或迁移到 Cockpit 体系 |
| src/components/cabin/ScoreHistoryTable.tsx | Cabin 子系统已迁移到 Cockpit，Score* 组件可能为僵尸 | ① 确认无引用后删除 ScoreHistoryTable.tsx 等 4 个文件；② 或迁移到 Cockpit 体系 |
| src/components/cabin/ScoreItem.tsx | Cabin 子系统已迁移到 Cockpit，Score* 组件可能为僵尸 | ① 确认无引用后删除 ScoreHistoryTable.tsx 等 4 个文件；② 或迁移到 Cockpit 体系 |
| src/components/cabin/ScoreSnapshot.tsx | Cabin 子系统已迁移到 Cockpit，Score* 组件可能为僵尸 | ① 确认无引用后删除 ScoreHistoryTable.tsx 等 4 个文件；② 或迁移到 Cockpit 体系 |
| src/components/cabin/ScoreSummary.tsx | Cabin 子系统已迁移到 Cockpit，Score* 组件可能为僵尸 | ① 确认无引用后删除 ScoreHistoryTable.tsx 等 4 个文件；② 或迁移到 Cockpit 体系 |

## 图表组件（可能动态加载）

| 文件 | 原因 | 建议操作 |
|------|------|----------|
| src/components/chart/industry/IndustryV4Panel.tsx | 图表组件可能通过 React.lazy 或动态 import 加载 | ① 搜索 React.lazy/dynamic import；② 若无引用则列入待删除清单 |
| src/components/chart/industry/TrendLineChart.tsx | 图表组件可能通过 React.lazy 或动态 import 加载 | ① 搜索 React.lazy/dynamic import；② 若无引用则列入待删除清单 |
| src/components/chart/industry/ValuationDistribution.tsx | 图表组件可能通过 React.lazy 或动态 import 加载 | ① 搜索 React.lazy/dynamic import；② 若无引用则列入待删除清单 |
| src/components/chart/MultiPaneChart.tsx | 图表组件可能通过 React.lazy 或动态 import 加载 | ① 搜索 React.lazy/dynamic import；② 若无引用则列入待删除清单 |
| src/components/chart/industry/IndustryV4Panel.tsx | 图表组件可能通过 React.lazy 或动态 import 加载 | ① 搜索 React.lazy/dynamic import；② 若无引用则列入待删除清单 |
| src/components/chart/industry/TrendLineChart.tsx | 图表组件可能通过 React.lazy 或动态 import 加载 | ① 搜索 React.lazy/dynamic import；② 若无引用则列入待删除清单 |
| src/components/chart/industry/ValuationDistribution.tsx | 图表组件可能通过 React.lazy 或动态 import 加载 | ① 搜索 React.lazy/dynamic import；② 若无引用则列入待删除清单 |
| src/components/chart/MultiPaneChart.tsx | 图表组件可能通过 React.lazy 或动态 import 加载 | ① 搜索 React.lazy/dynamic import；② 若无引用则列入待删除清单 |

## Cockpit 组件（可能已废弃）

| 文件 | 原因 | 建议操作 |
|------|------|----------|
| src/components/cockpit/DensityToggle.tsx | DensityToggle/SecurityStatus 可能为旧版 UI 组件 | 确认 CockpitShell.tsx 中是否引用；若无则删除 |
| src/components/cockpit/SecurityStatus.tsx | DensityToggle/SecurityStatus 可能为旧版 UI 组件 | 确认 CockpitShell.tsx 中是否引用；若无则删除 |
| src/components/cockpit/DensityToggle.tsx | DensityToggle/SecurityStatus 可能为旧版 UI 组件 | 确认 CockpitShell.tsx 中是否引用；若无则删除 |
| src/components/cockpit/SecurityStatus.tsx | DensityToggle/SecurityStatus 可能为旧版 UI 组件 | 确认 CockpitShell.tsx 中是否引用；若无则删除 |

## 通用组件（可能桶导出）

| 文件 | 原因 | 建议操作 |
|------|------|----------|
| src/components/common/MockDataBadge.tsx | MockDataBadge 通过 barrel export 或条件渲染使用 | 添加注释说明用途，审计误报 |
| src/components/molecules/FilterChip.tsx | FilterChip/FormField/SearchBar 可能通过 barrel export 使用 | ① 搜索 components/molecules/index.ts 导出；② 全局搜索组件名使用 |
| src/components/molecules/FormField.tsx | FilterChip/FormField/SearchBar 可能通过 barrel export 使用 | ① 搜索 components/molecules/index.ts 导出；② 全局搜索组件名使用 |
| src/components/molecules/SearchBar.tsx | FilterChip/FormField/SearchBar 可能通过 barrel export 使用 | ① 搜索 components/molecules/index.ts 导出；② 全局搜索组件名使用 |
| src/components/common/MockDataBadge.tsx | MockDataBadge 通过 barrel export 或条件渲染使用 | 添加注释说明用途，审计误报 |
| src/components/molecules/FilterChip.tsx | FilterChip/FormField/SearchBar 可能通过 barrel export 使用 | ① 搜索 components/molecules/index.ts 导出；② 全局搜索组件名使用 |
| src/components/molecules/FormField.tsx | FilterChip/FormField/SearchBar 可能通过 barrel export 使用 | ① 搜索 components/molecules/index.ts 导出；② 全局搜索组件名使用 |
| src/components/molecules/SearchBar.tsx | FilterChip/FormField/SearchBar 可能通过 barrel export 使用 | ① 搜索 components/molecules/index.ts 导出；② 全局搜索组件名使用 |

## Organism 组件（可能条件渲染）

| 文件 | 原因 | 建议操作 |
|------|------|----------|
| src/components/organisms/analysis/score/ScoreHistoryPanel.tsx | ScoreHistoryPanel/CycleRetrospectiveView 可能通过条件渲染使用 | ① 搜索组件名使用；② 若无引用则删除 |
| src/components/organisms/output/CycleRetrospectiveView.tsx | ScoreHistoryPanel/CycleRetrospectiveView 可能通过条件渲染使用 | ① 搜索组件名使用；② 若无引用则删除 |
| src/components/organisms/analysis/score/ScoreHistoryPanel.tsx | ScoreHistoryPanel/CycleRetrospectiveView 可能通过条件渲染使用 | ① 搜索组件名使用；② 若无引用则删除 |
| src/components/organisms/output/CycleRetrospectiveView.tsx | ScoreHistoryPanel/CycleRetrospectiveView 可能通过条件渲染使用 | ① 搜索组件名使用；② 若无引用则删除 |

## 错误边界（全局注册）

| 文件 | 原因 | 建议操作 |
|------|------|----------|
| src/components/organisms/shared/RouteErrorBoundary.tsx | ErrorBoundary 通常在根组件注册一次 | 验证 App.tsx 中的引用 |
| src/components/organisms/shared/RouteErrorBoundary.tsx | ErrorBoundary 通常在根组件注册一次 | 验证 App.tsx 中的引用 |

## 布局组件（动态引用）

| 文件 | 原因 | 建议操作 |
|------|------|----------|
| src/components/templates/CockpitLayout.tsx | 布局组件通过 App 入口或动态 import 引用 | 验证 App.tsx / 路由表中是否引用 |
| src/components/templates/DashboardLayout.tsx | 布局组件通过 App 入口或动态 import 引用 | 验证 App.tsx / 路由表中是否引用 |
| src/components/templates/SidebarLayout.tsx | 布局组件通过 App 入口或动态 import 引用 | 验证 App.tsx / 路由表中是否引用 |
| src/components/templates/CockpitLayout.tsx | 布局组件通过 App 入口或动态 import 引用 | 验证 App.tsx / 路由表中是否引用 |
| src/components/templates/DashboardLayout.tsx | 布局组件通过 App 入口或动态 import 引用 | 验证 App.tsx / 路由表中是否引用 |
| src/components/templates/SidebarLayout.tsx | 布局组件通过 App 入口或动态 import 引用 | 验证 App.tsx / 路由表中是否引用 |

## 命名冲突

| 文件 | 原因 | 建议操作 |
|------|------|----------|
| src/components/molecules/ErrorState.tsx | 组件名 "ErrorState" 与 src/components/molecules/ErrorState.tsx, src/components/molecules/states/Error.tsx 冲突 | ① 重命名其中一个为 AppErrorState / DefaultErrorState；② 或合并到单一文件统一导出 |
| src/components/molecules/ErrorState.tsx | 组件名 "ErrorState" 与 src/components/molecules/ErrorState.tsx, src/components/molecules/states/Error.tsx 冲突 | ① 重命名其中一个为 AppErrorState / DefaultErrorState；② 或合并到单一文件统一导出 |

## 执行 Checklist

- [ ] 验证 safe 类组件确实在使用（添加注释说明）
- [ ] 审查 needs-review 类组件的动态引用情况
- [ ] 确认 delete 类组件无引用后删除
- [ ] 修复 1 处命名冲突（ErrorState）
- [ ] 注册 5 处未注册页面（或确认废弃）
- [ ] 重新运行 audit-dead-code 确认清零
