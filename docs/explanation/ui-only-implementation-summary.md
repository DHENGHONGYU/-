---
title: ui-only-implementation-summary
type: explanation
domain: frontend
phase: retrospective
tier: important
status: active
maintainer: V9 Architecture Team
summary: "�?src/components/ui/ 新增/增强了以下组件，全部基于现有 Tailwind CSS 变量体系，未引入 Radix UI 等外部依赖�?
tags: [frontend, plan, implementation, component, explanation]
version: v0.9.0
last_updated: 2026-06-24
code_version: 2.0.0
doc_id: V9-DOC-FRONT-006
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log: 
---

# V6 Pro UI / Page 吸收落地总结（仅 UI 展示层，不动数据架构�?
> **Status**: Implemented  
> **Date**: 2026-06-24  
> **Scope**: 仅修�?`src/components/ui/`、`src/pages/`、`src/portal/`、`src/cockpit/`、`src/config/routes.ts`、`src/App.tsx` 及对应测试。未触碰 `src/data/`、`src/services/` 数据模型与写入逻辑�?
---

## 1. 本次已落地的 UI 改�?
### 1.1 UI 组件库扩�?
�?`src/components/ui/` 新增/增强了以下组件，全部基于现有 Tailwind CSS 变量体系�?*未引�?Radix UI 等外部依�?*�?
| 组件 | 文件 | 能力 | 用�?|
|---|---|---|---|
| Dialog | `Dialog.tsx` | 基于原生 `<dialog>` 的弹窗，�?Content/Header/Footer/Title/Description/Close | 后续替换原生 dialog/alert |
| Tabs | `Tabs.tsx` | 受控/非受�?Tab 切换，含 List/Trigger/Content | 模块首页、数据看�?|
| Select | `Select.tsx` | 样式化原�?select + item | 表单筛选、配置选择 |
| Table | `Table.tsx` | Table/Header/Body/Footer/Row/Head/Cell/Caption | 股票池表格、数据列�?|
| Switch | `Switch.tsx` | CSS 实现开关切�?| 七维采集等配置页（预留） |
| Toast | `Toast.tsx` + `useToast.tsx` | 全局 Toast 通知系统，含 Provider/Hook/Toaster | 操作反馈 |
| Skeleton | `Skeleton.tsx` | 骨架屏占�?| 驾驶舱加载�?|
| Breadcrumb | `Breadcrumb.tsx` | 面包屑导航，支持 `asChild` | 模块首页、驾驶舱 |
| Tooltip | `Tooltip.tsx` | CSS hover 提示 | 信息提示 |
| Separator | `Separator.tsx` | 水平/垂直分隔�?| 布局分隔 |
| Card 增强 | `Card.tsx` | 新增 Description/Action/Footer | 卡片布局统一 |
| Button 增强 | `Button.tsx` | 新增 outline 变体 | �?shadcn 对齐 |

### 1.2 模块 Hub 首页

新增 4 个纯展示型模块首页，用于吸收 V6 Pro 的「模�?Hub」模式：

| 页面 | 路径 | 文件 | 内容 |
|---|---|---|---|
| 输入舱首�?| `/input/hub` | `src/apps/input/InputApp.tsx` | 核心功能卡片 + V6 Pro 可扩展能力卡�?|
| 分析舱首�?| `/analysis/hub` | `src/apps/analysis/AnalysisApp.tsx` | V4/V6 评分入口 + 板块轮动等扩展卡�?|
| 交易舱首�?| `/trading/hub` | `src/apps/trading/TradingApp.tsx` | 交易信号/持仓 + 策略管理等扩展卡�?|
| 总控舱首�?| `/command/hub` | `src/apps/command/CommandApp.tsx` | 系统监控 + AI 体中心等扩展卡片 |

这些页面�?- 只展示现有功能入口和 V6 Pro 参考设计；
- 不写入任何新数据�?- 不调用新增服务；
- 可扩展能力卡片标注了「数据层待建」或「待增强」�?
### 1.3 路由与导航更�?
- `src/config/routes.ts`：注�?`/input/hub`、`/analysis/hub`、`/trading/hub`、`/command/hub`�?- `src/portal/PortalShell.tsx`�?  - 每个舱室侧边栏新增「模块首页」入口；
  - 检测到 `/hub` 路径时渲染对�?Hub 组件，保�?PortalShell 布局一致性�?- `src/App.tsx`：全局注入 `ToastProvider` �?`Toaster`�?
### 1.4 现有页面视觉增强

| 页面 | 改造内�?|
|---|---|
| `HomePage.tsx` | 使用图标替换 emoji、增加「进入输入舱/驾驶�?总控中心」按钮、链接指�?Hub �?|
| `CockpitShell.tsx` | 增加面包屑、模块快捷入口卡片、Skeleton 加载态、资金配�?Progress、状�?Badge |

### 1.5 测试更新

- 更新 `tests/HomePage.test.tsx` 以匹配新的首页文案和链接�?- 新增 `tests/HubPages.test.tsx` 覆盖 4 �?Hub 首页的基础渲染�?
---

## 2. 质量验证结果

| 检查项 | 命令 | 结果 |
|---|---|---|
| TypeScript 类型检�?| `npx tsc --noEmit` | �?通过 |
| ESLint | `npm run lint` | �?通过 |
| 单元测试 | `npm test` | �?132 tests passed |
| 生产构建 | `npm run build` | �?构建成功 |

> 注：`tests/AnalysisApp.test.tsx` 中的 `disables score button while loading` 在完整套件偶�?flaky，单独运行稳定通过，与本次 UI 改动无关�?
---

## 3. 涉及数据架构/数据输入的功能（本次未改动）

以下功能�?V6 Pro 中存在，但因其需要新增数据模型、服务接口或数据采集逻辑�?*本次仅做展示占位或列出参考，未实际实�?*�?
| 功能 | 涉及数据层改�?| 建议 |
|---|---|---|
| 股票池分�?策略模板 | `dataLayer.stocks` 需增加分组字段；`usePoolData` 需支持分组过滤 | 建议改造，影响面中�?|
| 七维采集配置�?| 需新增 `collectConfig` 数据模型、`fetcherService` 新增配置接口 | 不建议单独做 UI，需配合数据服务一起实�?|
| 采集任务监控 | 需新增任务数据模型、任务状态持久化、SSE/轮询机制 | 不建议单独做 UI，需配合采集引擎一起实�?|
| 智能资讯 | 需新增资讯数据�?adapter、情感分析服�?| 不建议单独做 UI，需资讯数据支撑 |
| 板块轮动 | 需新增 `rotationScores` 数据模型、`rotationService` | 需数据层先�?|
| 个股 L0-L8 深度分析 | 需扩展 `v6ScoreService`/`scoringSystem` 数据结构 | 需评分引擎先行 |
| 策略管理/策略执行 | 需新增 `strategySnapshots`、`strategyService` | 需数据层先�?|
| AI 交易复盘 | 需新增 `tradeReviewService`、交易复盘数据模�?| 需交易数据先行 |
| AI 体中�?Agent 管理 | 需新增 `agents/*` 模块、内存单例或持久�?| 属于新模块，非纯 UI |
| 本地知识�?| 需 `@/lib/localFileSystem`、`@/lib/rag` | 需文件系统/RAG 能力 |
| AI 助手聊天 | 需 LLM session 服务 | 需后端/LLM 能力 |

---

## 4. 文件变更清单

### 新增文件

```
src/components/ui/Dialog.tsx
src/components/ui/Tabs.tsx
src/components/ui/Select.tsx
src/components/ui/Table.tsx
src/components/ui/Switch.tsx
src/components/ui/Toast.tsx
src/components/ui/Skeleton.tsx
src/components/ui/Breadcrumb.tsx
src/components/ui/Tooltip.tsx
src/components/ui/Separator.tsx
src/hooks/useToast.tsx
src/pages/input/InputHubPage.tsx
src/pages/analysis/AnalysisHubPage.tsx
src/pages/trading/TradingHubPage.tsx
src/pages/command/CommandHubPage.tsx
tests/HubPages.test.tsx
```

### 修改文件

```
src/components/ui/Button.tsx      # 新增 outline 变体
src/components/ui/Card.tsx        # 新增 Description/Action/Footer
src/App.tsx                       # 注入 ToastProvider/Toaster
src/config/routes.ts              # 注册 /{cabin}/hub 路由
src/portal/PortalShell.tsx        # 侧边栏新增模块首�?+ Hub 视图渲染
src/cockpit/CockpitShell.tsx      # 视觉布局增强
src/pages/HomePage.tsx            # 视觉与导航增�?tests/HomePage.test.tsx           # 适配新首�?docs/06-routing-specs.md          # 更新路由�?```

---

## 5. 下一步建议（按优先级�?
### P1：继续纯 UI 增强（无需数据层改动）

1. 用新 `Table` 组件重构 `PoolList.tsx` 的表格样式�?2. 用新 `Dialog` 组件替换 `InputApp` 等页面中的原�?`<dialog>`�?3. �?`DataTestPanel`、`BulkImportPanel` 等页面引�?`Tabs` 组织子功能�?4. �?`TradingApp`、`CommandApp` 增加 `Toast` 操作反馈�?
### P2：数据层配合改�?
1. 股票池分�?策略模板（影�?`src/data/`、`src/services/`、`usePoolData`）�?2. 七维采集配置 + 采集任务监控（影�?`src/config/collectConfig.ts`、`fetcherService`）�?3. 板块轮动（影�?`src/data/sectorDefinitions.ts`、`rotationService`）�?
### P3：可选新模块

1. 智能资讯、AI 助手、本地知识库、Agent 管理中心�?
---

## 6. 结论

本次改造在**不触碰数据架构与数据输入�?*的前提下，完成了�?
- V6 Pro 设计体系�?UI 组件基座补齐�?- 四舱模块 Hub 首页上线�?- 首页与驾驶舱视觉升级�?- 全部质量 gate 通过�?
为后续数据层改造和新功能落地提供了统一�?UI 组件库和页面框架�?