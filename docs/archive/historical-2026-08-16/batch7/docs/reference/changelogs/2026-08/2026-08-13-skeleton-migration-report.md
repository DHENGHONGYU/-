# Skeleton 组件迁移报告 — 2026-08-13

> **生成时间**：2026-08-13
> **迁移范围**：`atoms/Skeleton.tsx` → `molecules/states/Skeleton.tsx`
> **最终状态**：两套 Skeleton 并存问题已清零，全项目统一使用新版
> **关联文件**：atomRegistry.ts / molecules/index.ts / atoms/index.ts / registry-governance-guardian.cjs

---

## 0. 迁移摘要（TL;DR）

| 维度 | 数量 |
|------|------|
| 旧版文件删除 | 1 个（`atoms/Skeleton.tsx`） |
| Barrel 导出清理 | 1 处（`atoms/index.ts`） |
| 注册表条目删除 | 1 条（`SkeletonLegacy`） |
| 消费者迁移 | 2 个（`DimHealthTab.tsx`、`TaskListTab.tsx`） |
| 审计脚本更新 | 1 个（`registry-governance-guardian.cjs`） |
| TypeScript 验证 | Skeleton 相关错误 0 个 |
| 浏览器验证 | 首页 + CollectTask 4 个 Tab 全绿 |

---

## 1. 问题诊断

### 1.1 根因

项目中存在**两套 Skeleton 组件**：

| 维度 | 旧版 | 新版 |
|---|---|---|
| **文件** | `src/components/atoms/Skeleton.tsx` | `src/components/molecules/states/Skeleton.tsx` |
| **注册名** | `SkeletonLegacy` | `Skeleton` |
| **状态** | `deprecated`（2026-08-09 废弃） | `active` |
| **实现** | `bg-muted` + `animate-pulse`（硬编码颜色） | `THEME_TOKENS` 主题令牌 |
| **消费者** | 0（但被 barrel 引用） | 8 个文件 |
| **导出** | `atoms/index.ts` L38 | `molecules/index.ts` L72 |

### 1.2 具体问题

1. **Barrel 冲突**：`atoms/index.ts` 和 `molecules/index.ts` 都导出同名 `Skeleton`，开发者容易选错
2. **废弃未闭环**：旧版文件未删除、barrel 未清理导出
3. **设计令牌缺失**：旧版使用硬编码 `bg-muted`，无法响应主题切换
4. **残留消费者**：`DimHealthTab.tsx` 和 `TaskListTab.tsx` 通过 `@/components/atoms` barrel 导入旧版

---

## 2. 迁移操作

### 2.1 移除旧版导出

**文件**：[atoms/index.ts](file:///d:/FinSightV9/src/components/atoms/index.ts#L36)

```diff
- export { Skeleton } from './Skeleton'
```

### 2.2 迁移消费者

**DimHealthTab.tsx**：

```diff
- import { Card, ..., Skeleton } from '@/components/atoms'
+ import { Card, ... } from '@/components/atoms'
+ import { Skeleton } from '@/components/molecules/states/Skeleton'
```

**TaskListTab.tsx**：

```diff
- import { ..., Skeleton, ... } from '@/components/atoms'
+ import { ..., ... } from '@/components/atoms'
+ import { Skeleton } from '@/components/molecules/states/Skeleton'
```

### 2.3 删除旧文件

- `src/components/atoms/Skeleton.tsx` — 已物理删除

### 2.4 注册表清理

**atomRegistry.ts**：删除 `SkeletonLegacy` 条目（原第 21 行）

### 2.5 审计脚本更新

**registry-governance-guardian.cjs**：

- `atomSkeletons.length` 期望从 `1` 改为 `0`
- 移除 `SkeletonLegacy` 条目块存在性检查（6 段断言）
- 基线 `componentEntriesMin` 从 `159` 调整为 `158`

---

## 3. 验证结果

### 3.1 TypeScript 类型检查

```
npm run tsc:prod
```

结果：Skeleton 相关错误 **0 个**。剩余 3 个 `TurnoverVolumeEnergy` 预存错误与本次变更无关。

### 3.2 浏览器自动化验证

| # | 检查项 | 结果 |
|---|---|---|
| 1 | 首页加载 | ✅ PASS |
| 2 | CollectTask 页面路由 | ✅ PASS |
| 3 | Skeleton 骨架屏渲染 | ✅ PASS（Tab 切换时正常显示占位） |
| 4 | 4 个 Tab 切换 | ✅ PASS |
| 5 | 组件导入错误 | ✅ PASS（控制台无 Module not found） |
| 6 | 致命渲染错误 | ✅ PASS（无白屏、无 JS 中断） |

### 3.3 截图证据

- `homepage.png` — 首页全页
- `collect-tasks-tab-progress-report.png` — 进度汇报 Tab
- `collect-tasks-tab-task-list.png` — 任务列表 Tab
- `collect-tasks-tab-dim-health.png` — 维度健康 Tab
- `collect-tasks-tab-score-analysis.png` — 评分分析 Tab

---

## 4. 后续注意事项

1. **`component-audit-data.json`**：包含旧版 `atoms/Skeleton.tsx` 的审计记录，下次审计脚本运行时将自动更新
2. **v6ScoreService 中的 `TurnoverVolumeEnergy` 错误**：建议后续专项修复
3. **后端采集服务**：HTTP 500 错误因 Python 采集后端未启动导致，见本次会话后续排查

---

## 变更文件清单

| 文件 | 操作 |
|---|---|
| `src/components/atoms/index.ts` | 移除 Skeleton 导出 |
| `src/components/atoms/Skeleton.tsx` | 删除 |
| `src/components/registry/atomRegistry.ts` | 移除 SkeletonLegacy 条目 |
| `src/pages/input/CollectTask/components/DimHealthTab.tsx` | 迁移导入 |
| `src/pages/input/CollectTask/components/TaskListTab.tsx` | 迁移导入 |
| `scripts/audit/registry-governance-guardian.cjs` | 更新断言 + 基线 |