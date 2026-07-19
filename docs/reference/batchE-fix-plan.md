---
title: batche-fix-plan
type: reference
domain: project
phase: planning
tier: important
status: draft
maintainer: Quality Auditor
summary: "Batch E 修复计划：区分系统监控与配置管理两个混淆入口�?
tags: [project, fix, batch, plan, governance, documentation, strategy, reference]
version: v1.0.0
last_updated: 2026-06-27
code_version: 2.0.0
doc_id: V9-DOC-PROJ-082
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-06-27
---

# V9 批次 E（输出舱 + 总控舱）P2 问题修复方案

> **审计范围**：输出舱 + 总控舱（4 模块�? 
> **问题总数**�? �?P2 级问�? 
> **修复优先�?*：按影响范围和修复成本排�?
---

## 一、问题汇�?
| 编号 | 模块 | 问题描述 | 当前状�?| 影响范围 |
|:---|:---|:---|:---|:---|
| E1-P2-001 | 输出�?| 使用 useState 管理状态，无独�?Zustand Store | useState (2�? | 跨组件共�?|
| E1-P2-002 | 输出�?| 输出功能单一，缺少报告生成、PDF 导出等功�?| �?JSON 导出 | 功能扩展 |
| E2-P2-003 | 总控�?Hub | "系统监控"�?配置管理"链接均指�?`/command` | 导航重复 | 导航体验 |
| E2-P2-004 | 总控�?Hub | 4 个可扩展能力模块标记�?数据层待�? | 规划�?| 后续开�?|
| E3-P2-005 | 总控�?| 使用 useState 管理状态，无独�?Zustand Store | useState (3�? | 跨组件共�?|
| E4-P2-006 | Mock 测试�?| 本地 Zustand Store 无法跨组件共�?| 本地 Store | 测试页面 |

---

## 二、修复优先级排序

| 优先�?| 问题 | 修复成本 | 收益 | 说明 |
|:---|:---|:---|:---|:---|
| **紧�?* | E2-P2-003 | 低（5 分钟�?| �?| 修复导航路径，提升用户体�?|
| **�?* | E1-P2-001 | 中（1 小时�?| �?| 输出舱核心模块，需要跨组件共享状�?|
| **�?* | E3-P2-005 | 中（1 小时�?| �?| 总控舱核心模块，需要跨组件共享状�?|
| **�?* | E1-P2-002 | 高（规划中） | �?| 报告生成功能需要后续迭代开�?|
| **�?* | E2-P2-004 | 高（规划中） | �?| 4 个可扩展能力模块需要后续迭代开�?|
| **不修�?* | E4-P2-006 | 0 | �?| 测试页面，本�?Store 设计合理 |

---

## 三、详细修复方�?
### 3.1 E2-P2-003：修复导航路径不明确

**问题描述**：`CommandHubPage.tsx` �?系统监控"�?配置管理"链接均指�?`/command`，用户无法区分两个功能入口�?
**修复方案**�?- 修改 `COMMAND_MODULES` 数组中的 path 字段
- "系统监控" �?`/command`（主入口，保持不变）
- "配置管理" �?`/command/settings`（需要新增路由或作为子功能）

**方案一：统一入口（推荐）**

保持 `/command` 为唯一入口，在 `CommandApp.tsx` 中增�?配置管理"标签页或功能区域�?
**修改文件**：无（保持现有设计）

**方案二：分拆路由**

创建 `/command/settings` 路由，分离配置管理功能�?
**修改文件**：`src/apps/command/CommandApp.tsx`

```typescript
const COMMAND_MODULES: HubModule[] = [
  {
    title: '系统监控',
    description: '刷新统计、重置数据、采集服务状�?,
    path: '/command',
    icon: Activity,
  },
  {
    title: '配置管理',
    description: '系统配置与状态管�?,
    path: '/command/settings',  // 修复：新增配置管理路�?    icon: Settings,
  },
]
```

**同时需�?*�?- 新增路由配置：`src/config/routes.ts` 添加 `/command/settings`
- 新建配置管理页面：`src/apps/command/ConfigApp.tsx`

**修复成本**：方案一 0 分钟 / 方案�?30 分钟  
**建议**：采用方案一，保持统一入口，避免路由膨胀

---

### 3.2 E1-P2-001：输出舱创建 Zustand Store

**问题描述**：`OutputApp.tsx` 使用 2 �?useState，状态管理分散，不利于跨组件共享�?
**当前状态变�?*�?```typescript
const [exportData, setExportData] = useState('')
const [message, setMessage] = useState('')
```

**修复方案**：创�?`outputStore.ts` Zustand Store

**新建文件**：`src/store/outputStore.ts`

```typescript
import { create } from 'zustand'

interface OutputState {
  exportData: string
  message: string
  setExportData: (data: string) => void
  setMessage: (message: string) => void
  clearMessage: () => void
}

export const useOutputStore = create<OutputState>((set) => ({
  exportData: '',
  message: '',
  setExportData: (data) => set({ exportData: data }),
  setMessage: (message) => set({ message }),
  clearMessage: () => set({ message: '' }),
}))
```

**修改文件**：`src/apps/output/OutputApp.tsx`
- 删除 useState 声明
- 使用 `useOutputStore` 替代

**修复成本**�? 小时  
**验证方式**：输出舱数据导出功能正常，状态变更能正确反映�?UI

---

### 3.3 E3-P2-005：总控舱创�?Zustand Store

**问题描述**：`CommandApp.tsx` 使用 3 �?useState，状态管理分散，不利于跨组件共享�?
**当前状态变�?*�?```typescript
const [stats, setStats] = useState<Record<string, number> | null>(null)
const [message, setMessage] = useState('')
const [migrationOpen, setMigrationOpen] = useState(false)
```

**修复方案**：创�?`commandStore.ts` Zustand Store

**新建文件**：`src/store/commandStore.ts`

```typescript
import { create } from 'zustand'

interface SystemStats {
  stocks: number
  orders: number
  scores: number
}

interface CommandState {
  stats: SystemStats | null
  message: string
  migrationOpen: boolean
  setStats: (stats: SystemStats) => void
  setMessage: (message: string) => void
  clearMessage: () => void
  setMigrationOpen: (open: boolean) => void
}

export const useCommandStore = create<CommandState>((set) => ({
  stats: null,
  message: '',
  migrationOpen: false,
  setStats: (stats) => set({ stats }),
  setMessage: (message) => set({ message }),
  clearMessage: () => set({ message: '' }),
  setMigrationOpen: (open) => set({ migrationOpen: open }),
}))
```

**修改文件**：`src/apps/command/CommandApp.tsx`
- 删除 useState 声明
- 使用 `useCommandStore` 替代

**修复成本**�? 小时  
**验证方式**：总控舱系统监控功能正常，统计数据加载、数据重置、V6迁移功能正常

---

### 3.4 E1-P2-002：输出舱功能扩展（规划中�?
**问题描述**：输出舱仅支�?JSON 数据导出，缺少报告生成、PDF 导出等功能�?
**规划方案**�?1. Markdown 报告生成（调用总控�?报告导出"模块�?2. PDF 报告导出（使�?`jspdf` �?`pdfmake` 库）
3. 数据导出格式选择（JSON/CSV/Excel�?4. 定时报告生成（结�?Agent 调度�?
**依赖模块**�?- `src/services/output/index.ts`（待建）
- `src/pages/output/OutputHubPage.tsx`（待建）

**修复成本**：后续迭代（规划中）  
**状�?*：�?规划�?
---

### 3.5 E2-P2-004：总控�?Hub 可扩展能力模块（规划中）

**问题描述**�? 个可扩展能力模块（AI体中心、风控网关、报告导出、信号质量复盘）标记�?数据层待�?�?
**规划模块**�?
| 模块 | 功能描述 | 依赖数据�?|
|:---|:---|:---|
| AI体中�?| Agent 注册、生命周期、健康、协调、任务调�?| `agentStore.ts`（已有）+ Agent 数据�?|
| 风控网关 | 回路状态、裁决记录、风控三态展�?| `riskControlStore.ts`（待建）+ 风控数据�?|
| 报告导出 | Markdown/PDF 报告生成 | `reportStore.ts`（待建）+ 报告服务 |
| 信号质量复盘 | 准确率、择时得分、最大回撤、Sharpe | `signalReviewStore.ts`（待建）+ 信号质量数据 |

**修复成本**：后续迭代（规划中）  
**状�?*：�?规划�?
---

### 3.6 E4-P2-006：Mock 测试页（不修复）

**问题描述**：`MockTestPage.tsx` �?`useMockEngineStore` 定义在组件内部，无法跨组件共享�?
**评估**：Mock 测试页为纯测试环境，组件内部�?Store 设计符合测试场景需求，无需跨组件共享�?
**建议**：不修复，保持现有设计�?
**修复成本**�?（不修复�? 
**优先�?*：低

---

## 四、修复工作量估算

| 问题 | 修复方式 | 工作�?| 优先�?|
|:---|:---|:---|:---|
| E2-P2-003 | 保持统一入口（方案一�?| 0 分钟 | 紧�?|
| E1-P2-001 | 新建 outputStore.ts | 1 小时 | �?|
| E3-P2-005 | 新建 commandStore.ts | 1 小时 | �?|
| E1-P2-002 | 功能扩展 | 后续迭代 | 📋 规划 |
| E2-P2-004 | 可扩展能力模�?| 后续迭代 | 📋 规划 |
| E4-P2-006 | 不修�?| 0 | �?|
| **总计** | | **2 小时** | |

---

## 五、修复后预期效果

| 指标 | 修复�?| 修复�?|
|:---|:---|:---|
| 输出舱状态管�?| useState�?个） | Zustand Store |
| 总控舱状态管�?| useState�?个） | Zustand Store |
| 总控�?Hub 导航清晰�?| �?| 中（保持统一入口�?|
| L2 状态层完成�?| 62% | 68% |
| 跨组件状态共�?| 部分支持 | 扩展支持 |

---

## 六、可立即应用的修复（代码变更�?
如果授权突破"仅做审计分析，不修改代码"的约束，以下修复方案可立即应用：

### 6.1 E1-P2-001：输出舱 Store

**新建文件**：`src/store/outputStore.ts`

**修改文件**：`src/apps/output/OutputApp.tsx`

变更内容：删�?useState，导�?useOutputStore

### 6.2 E3-P2-005：总控�?Store

**新建文件**：`src/store/commandStore.ts`

**修改文件**：`src/apps/command/CommandApp.tsx`

变更内容：删�?useState，导�?useCommandStore

---

**是否授权直接应用修复方案到组件文件？**