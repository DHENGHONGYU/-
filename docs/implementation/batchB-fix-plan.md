---
title: 批次 B P2 问题修复方案
version: v1.0.0
last_updated: 2026-06-27
maintainer: Quality Auditor
status: draft
---

# 批次 B P2 问题修复方案

> **问题来源**：批次 B（输入舱）审计发现的 7 个 P2 级问题  
> **修复策略**：按优先级分批实施，避免过度工程化  
> **文档状态**：草案，待开发确认

---

## 问题汇总与优先级排序

| 编号 | 模块 | 严重度 | 问题描述 | 优先级 | 修复方式 | 预计工作量 |
|:---|:---|:---|:---|:---|:---|:---|
| B2-P2-001 | 录入看板 | P2 | 死链接 `/input/prototype` | **P0** | 删除按钮 | 5 分钟 |
| B2-P2-003 | 录入看板 | P2 | 无独立 Zustand Store | **P1** | 新建 `poolStore` | 2 小时 |
| B3-P2-004 | 批量导入 | P2 | 无独立 Zustand Store | **P1** | 使用 `poolStore` | 30 分钟 |
| B4-P2-005 | 热门板块 | P2 | 无独立 Zustand Store | **P1** | 使用 `poolStore` | 30 分钟 |
| B5-P2-006 | 本地知识库 | P2 | 无独立 Zustand Store | **P2** | 新建 `localDocStore` | 2 小时 |
| B1-P2-002 | 输入舱 Hub | P2 | 无独立 Zustand Store | **低** | 降级为建议 | - |
| B6-P2-007 | 采集测试 | P2 | 无独立 Zustand Store | **低** | 降级为建议 | - |

---

## 修复方案详情

### 一、B2-P2-001：删除死链接

**问题描述**：`InputDashboard.tsx:248` 中保留 `/input/prototype` 链接，该路由已从 `routes.ts` 删除，点击将导致 404。

**修复步骤**：

1. **修改文件**：`src/apps/input/InputDashboard.tsx`
2. **删除内容**：
   ```tsx
   // 删除第 248-250 行
   <Button size="sm" variant="ghost" onClick={() => navigate('/input/prototype')}>
     交互原型
   </Button>
   ```
3. **验证**：检查快捷操作区域是否正常显示

---

### 二、poolStore：统一股票池状态管理

**覆盖问题**：B2-P2-003、B3-P2-004、B4-P2-005

**设计思路**：将 `usePoolData` hook 的所有状态和方法迁移到 Zustand Store，实现跨组件状态共享。

**目标文件**：

| 文件 | 操作 | 说明 |
|:---|:---|:---|
| `src/store/poolStore.ts` | 新建 | Zustand Store，替代 usePoolData |
| `src/components/pool/usePoolData.ts` | 删除 | 迁移完成后删除 |
| `src/apps/input/InputDashboard.tsx` | 修改 | 替换 usePoolData → usePoolStore |
| `src/apps/input/BulkImportPanel.tsx` | 修改 | 替换 usePoolData → usePoolStore |
| `src/apps/input/HotSectorPanel.tsx` | 修改 | 替换 usePoolData → usePoolStore |

**Store 设计**：

```typescript
// src/store/poolStore.ts

export interface PoolState {
  // ===== 数据层 =====
  groups: PoolGroup[]
  allGroups: string[]
  selectedGroup: string
  loading: boolean
  error: string | null

  // ===== Actions =====
  setSelectedGroup: (group: string) => void
  refresh: () => Promise<void>
  handleTransition: (symbol: string, toStatus: ResearchStatus) => Promise<void>
  handleChangeGroup: (symbol: string, group: string) => Promise<void>
}

export const usePoolStore = create<PoolState>((set, get) => ({
  groups: [],
  allGroups: [DEFAULT_POOL_GROUP],
  selectedGroup: '',
  loading: false,
  error: null,

  setSelectedGroup: (group) => set({ selectedGroup: group }),
  
  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const [poolResult, groupsResult] = await Promise.all([
        getAllPoolGroups(),
        getPoolGroups(),
      ])
      if (poolResult.success && poolResult.data) {
        set({ groups: poolResult.data })
      } else {
        set({ error: poolResult.error ?? '加载股票池失败' })
      }
      if (groupsResult.success && groupsResult.data) {
        set({ allGroups: groupsResult.data })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      set({ loading: false })
    }
  },

  handleTransition: async (symbol, toStatus) => {
    const result = await transitionStock(symbol, toStatus)
    if (!result.success) {
      set({ error: result.error ?? '流转失败' })
    }
    await get().refresh()
  },

  handleChangeGroup: async (symbol, group) => {
    const result = await updateStockGroup(symbol, group)
    if (!result.success) {
      set({ error: result.error ?? '切换分组失败' })
    }
    await get().refresh()
  },
}))
```

**组件迁移示例**（InputDashboard.tsx）：

```typescript
// 旧代码
import { usePoolData } from '@/components/pool/usePoolData'
const { groups, allGroups, selectedGroup, setSelectedGroup, loading, error, refresh, handleTransition, handleChangeGroup } = usePoolData()

// 新代码
import { usePoolStore } from '@/store/poolStore'
const { groups, allGroups, selectedGroup, setSelectedGroup, loading, error, refresh, handleTransition, handleChangeGroup } = usePoolStore()
```

---

### 三、localDocStore：本地知识库状态管理

**覆盖问题**：B5-P2-006

**设计思路**：为本地知识库模块创建独立 Zustand Store，管理文档列表、搜索结果、加载状态等。

**目标文件**：

| 文件 | 操作 | 说明 |
|:---|:---|:---|
| `src/store/localDocStore.ts` | 新建 | Zustand Store |
| `src/pages/input/LocalKnowledgePage.tsx` | 修改 | 替换 useState → useLocalDocStore |

**Store 设计**：

```typescript
// src/store/localDocStore.ts

export interface LocalDocState {
  // ===== 数据层 =====
  docs: LocalDoc[]
  searchResults: LocalDoc[]
  symbolFilter: string
  keyword: string
  activeTab: string
  message: string | null
  loading: boolean

  // ===== Actions =====
  setDocs: (docs: LocalDoc[]) => void
  setSearchResults: (results: LocalDoc[]) => void
  setSymbolFilter: (filter: string) => void
  setKeyword: (keyword: string) => void
  setActiveTab: (tab: string) => void
  setMessage: (message: string | null) => void
  setLoading: (loading: boolean) => void
  loadDocs: () => Promise<void>
  searchDocs: () => Promise<void>
}
```

---

### 四、低优先级建议（不强制修复）

#### B1-P2-002：输入舱 Hub 无独立 Store

**评估**：输入舱 Hub 是纯导航页面，仅展示功能卡片，无业务状态需要管理。当前 `useState` 完全满足需求。

**建议**：保持现状，无需创建 Store。

#### B6-P2-007：采集测试无独立 Store

**评估**：采集测试是工具页面，状态（健康检查结果、测试结果、进度）仅在本页面使用，无需跨组件共享。

**建议**：保持现状，无需创建 Store。

---

## 修复实施计划

### 第一阶段：紧急修复（立即执行）

| 任务 | 负责人 | 预计时间 |
|:---|:---|:---|
| 删除死链接 `/input/prototype` | 前端开发 | 5 分钟 |

### 第二阶段：核心修复（1-2 天）

| 任务 | 负责人 | 预计时间 |
|:---|:---|:---|
| 新建 `poolStore.ts` | 前端开发 | 2 小时 |
| InputDashboard 迁移 | 前端开发 | 30 分钟 |
| BulkImportPanel 迁移 | 前端开发 | 30 分钟 |
| HotSectorPanel 迁移 | 前端开发 | 30 分钟 |
| 删除 `usePoolData.ts` | 前端开发 | 10 分钟 |

### 第三阶段：优化修复（按需执行）

| 任务 | 负责人 | 预计时间 |
|:---|:---|:---|
| 新建 `localDocStore.ts` | 前端开发 | 2 小时 |
| LocalKnowledgePage 迁移 | 前端开发 | 30 分钟 |

---

## 风险评估

| 风险 | 等级 | 缓解措施 |
|:---|:---|:---|
| poolStore 迁移影响范围广 | 中 | 先在单组件验证，再逐步推广 |
| DataBridge 集成遗漏 | 低 | 参考 newsStore 模式，确保 forward 调用 |
| 状态同步问题 | 低 | 使用 Zustand 的 get() 确保最新状态 |
| 类型定义冲突 | 低 | 统一使用 `@/services/stockpool/stockpoolService` 类型 |

---

## 验证标准

| 问题编号 | 验证方法 | 预期结果 |
|:---|:---|:---|
| B2-P2-001 | 访问 `/input` 页面 | 快捷操作区域无「交互原型」按钮 |
| B2-P2-003 | 切换分组/状态流转 | 状态正确更新，跨组件共享 |
| B3-P2-004 | 批量导入后返回录入看板 | 股票池数据实时更新 |
| B4-P2-005 | 热门板块加入候选池 | 股票池数据实时更新 |
| B5-P2-006 | 浏览/搜索/统计切换 | 状态正确维护，无重复加载 |