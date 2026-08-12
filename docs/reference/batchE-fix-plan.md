---
title: batche-fix-plan
code_version: "2.0.0-rc.1"
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# V9 批次 E（输出舱 + 总控舱）P2 问题修复方案

> **审计范围**：输出舱 + 总控舱（4 模块）  
> **问题总数**：6 个 P2 级问题  
> **修复优先级**：按影响范围和修复成本排序

---

## 一、问题汇总

| 编号 | 模块 | 问题描述 | 当前状态 | 影响范围 |
|:---|:---|:---|:---|:---|
| E1-P2-001 | 输出舱 | 使用 useState 管理状态，无独立 Zustand Store | useState (2个) | 跨组件共享 |
| E1-P2-002 | 输出舱 | 输出功能单一，缺少报告生成、PDF 导出等功能 | 仅 JSON 导出 | 功能扩展 |
| E2-P2-003 | 总控舱 Hub | "系统监控"和"配置管理"链接均指向 `/command` | 导航重复 | 导航体验 |
| E2-P2-004 | 总控舱 Hub | 4 个可扩展能力模块标记为"数据层待建" | 规划中 | 后续开发 |
| E3-P2-005 | 总控舱 | 使用 useState 管理状态，无独立 Zustand Store | useState (3个) | 跨组件共享 |
| E4-P2-006 | Mock 测试页 | 本地 Zustand Store 无法跨组件共享 | 本地 Store | 测试页面 |

---

## 二、修复优先级排序

| 优先级 | 问题 | 修复成本 | 收益 | 说明 |
|:---|:---|:---|:---|:---|
| **紧急** | E2-P2-003 | 低（5 分钟） | 高 | 修复导航路径，提升用户体验 |
| **高** | E1-P2-001 | 中（1 小时） | 中 | 输出舱核心模块，需要跨组件共享状态 |
| **高** | E3-P2-005 | 中（1 小时） | 中 | 总控舱核心模块，需要跨组件共享状态 |
| **低** | E1-P2-002 | 高（规划中） | 高 | 报告生成功能需要后续迭代开发 |
| **低** | E2-P2-004 | 高（规划中） | 高 | 4 个可扩展能力模块需要后续迭代开发 |
| **不修复** | E4-P2-006 | 0 | 无 | 测试页面，本地 Store 设计合理 |

---

## 三、详细修复方案

### 3.1 E2-P2-003：修复导航路径不明确

**问题描述**：`CommandHubPage.tsx` 中"系统监控"和"配置管理"链接均指向 `/command`，用户无法区分两个功能入口。

**修复方案**：
- 修改 `COMMAND_MODULES` 数组中的 path 字段
- "系统监控" → `/command`（主入口，保持不变）
- "配置管理" → `/command/settings`（需要新增路由或作为子功能）

**方案一：统一入口（推荐）**

保持 `/command` 为唯一入口，在 `CommandApp.tsx` 中增加"配置管理"标签页或功能区域。

**修改文件**：无（保持现有设计）

**方案二：分拆路由**

创建 `/command/settings` 路由，分离配置管理功能。

**修改文件**：`src/pages/command/CommandHubPage.tsx:32-44`

```typescript
const COMMAND_MODULES: HubModule[] = [
  {
    title: '系统监控',
    description: '刷新统计、重置数据、采集服务状态',
    path: '/command',
    icon: Activity,
  },
  {
    title: '配置管理',
    description: '系统配置与状态管理',
    path: '/command/settings',  // 修复：新增配置管理路由
    icon: Settings,
  },
]
```

**同时需要**：
- 新增路由配置：`src/config/routes.ts` 添加 `/command/settings`
- 新建配置管理页面：`src/pages/command/SettingsPage.tsx`

**修复成本**：方案一 0 分钟 / 方案二 30 分钟  
**建议**：采用方案一，保持统一入口，避免路由膨胀

---

### 3.2 E1-P2-001：输出舱创建 Zustand Store

**问题描述**：`OutputApp.tsx` 使用 2 个 useState，状态管理分散，不利于跨组件共享。

**当前状态变量**：
```typescript
const [exportData, setExportData] = useState('')
const [message, setMessage] = useState('')
```

**修复方案**：创建 `outputStore.ts` Zustand Store

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

**修复成本**：1 小时  
**验证方式**：输出舱数据导出功能正常，状态变更能正确反映到 UI

---

### 3.3 E3-P2-005：总控舱创建 Zustand Store

**问题描述**：`CommandApp.tsx` 使用 3 个 useState，状态管理分散，不利于跨组件共享。

**当前状态变量**：
```typescript
const [stats, setStats] = useState<Record<string, number> | null>(null)
const [message, setMessage] = useState('')
const [migrationOpen, setMigrationOpen] = useState(false)
```

**修复方案**：创建 `commandStore.ts` Zustand Store

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

**修复成本**：1 小时  
**验证方式**：总控舱系统监控功能正常，统计数据加载、数据重置、V6迁移功能正常

---

### 3.4 E1-P2-002：输出舱功能扩展（规划中）

**问题描述**：输出舱仅支持 JSON 数据导出，缺少报告生成、PDF 导出等功能。

**规划方案**：
1. Markdown 报告生成（调用总控舱"报告导出"模块）
2. PDF 报告导出（使用 `jspdf` 或 `pdfmake` 库）
3. 数据导出格式选择（JSON/CSV/Excel）
4. 定时报告生成（结合 Agent 调度）

**依赖模块**：
- `src/services/report/reportService.ts`（待建）
- `src/pages/command/ReportExportPage.tsx`（待建）

**修复成本**：后续迭代（规划中）  
**状态**：📋 规划中

---

### 3.5 E2-P2-004：总控舱 Hub 可扩展能力模块（规划中）

**问题描述**：4 个可扩展能力模块（AI体中心、风控网关、报告导出、信号质量复盘）标记为"数据层待建"。

**规划模块**：

| 模块 | 功能描述 | 依赖数据层 |
|:---|:---|:---|
| AI体中心 | Agent 注册、生命周期、健康、协调、任务调度 | `agentStore.ts`（已有）+ Agent 数据层 |
| 风控网关 | 回路状态、裁决记录、风控三态展示 | `riskControlStore.ts`（待建）+ 风控数据层 |
| 报告导出 | Markdown/PDF 报告生成 | `reportStore.ts`（待建）+ 报告服务 |
| 信号质量复盘 | 准确率、择时得分、最大回撤、Sharpe | `signalReviewStore.ts`（待建）+ 信号质量数据 |

**修复成本**：后续迭代（规划中）  
**状态**：📋 规划中

---

### 3.6 E4-P2-006：Mock 测试页（不修复）

**问题描述**：`MockTestPage.tsx` 中 `useMockEngineStore` 定义在组件内部，无法跨组件共享。

**评估**：Mock 测试页为纯测试环境，组件内部的 Store 设计符合测试场景需求，无需跨组件共享。

**建议**：不修复，保持现有设计。

**修复成本**：0（不修复）  
**优先级**：低

---

## 四、修复工作量估算

| 问题 | 修复方式 | 工作量 | 优先级 |
|:---|:---|:---|:---|
| E2-P2-003 | 保持统一入口（方案一） | 0 分钟 | 紧急 |
| E1-P2-001 | 新建 outputStore.ts | 1 小时 | 高 |
| E3-P2-005 | 新建 commandStore.ts | 1 小时 | 高 |
| E1-P2-002 | 功能扩展 | 后续迭代 | 📋 规划 |
| E2-P2-004 | 可扩展能力模块 | 后续迭代 | 📋 规划 |
| E4-P2-006 | 不修复 | 0 | 低 |
| **总计** | | **2 小时** | |

---

## 五、修复后预期效果

| 指标 | 修复前 | 修复后 |
|:---|:---|:---|
| 输出舱状态管理 | useState（2个） | Zustand Store |
| 总控舱状态管理 | useState（3个） | Zustand Store |
| 总控舱 Hub 导航清晰度 | 中 | 中（保持统一入口） |
| L2 状态层完成率 | 62% | 68% |
| 跨组件状态共享 | 部分支持 | 扩展支持 |

---

## 六、可立即应用的修复（代码变更）

如果授权突破"仅做审计分析，不修改代码"的约束，以下修复方案可立即应用：

### 6.1 E1-P2-001：输出舱 Store

**新建文件**：`src/store/outputStore.ts`

**修改文件**：`src/apps/output/OutputApp.tsx`

变更内容：删除 useState，导入 useOutputStore

### 6.2 E3-P2-005：总控舱 Store

**新建文件**：`src/store/commandStore.ts`

**修改文件**：`src/apps/command/CommandApp.tsx`

变更内容：删除 useState，导入 useCommandStore

---

**是否授权直接应用修复方案到组件文件？**