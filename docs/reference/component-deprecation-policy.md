---
title: component-deprecation-policy
tier: important
code_version: 2.0.0
---

---
tier: important
code_version: 2.0.0
---

# V9 组件弃用政策

> 版本：v0.9.14 P6-DATA
> 状态：生效中
> 最后更新：2026-06-30

## 1. 弃用原则

组件弃用遵循"安全优先、渐进式清理"原则，确保不会破坏现有功能。

### 1.1 弃用判定标准

组件符合以下任一条件时，可启动弃用流程：

| 条件 | 说明 | 弃用等级 |
|------|------|---------|
| 完全未使用 | 全局搜索无任何引用 | 立即弃用 |
| 仅内部使用 | 只在同模块内部被引用，未对外暴露 | 观察后弃用 |
| 单次使用 | 仅被一个页面/组件使用，且功能可被替代 | 评估后弃用 |
| 功能重复 | 与其他组件功能重叠，存在更优替代方案 | 计划弃用 |
| 技术债务 | 实现方式过时，维护成本高于收益 | 计划弃用 |

### 1.2 不轻易弃用的情况

- 新添加的组件（版本 < 1 个迭代周期）
- 计划中的功能所需组件
- 基础 UI 组件库的组成部分（即使当前使用少）
- 测试/原型用途的组件

## 2. 弃用流程

### 2.1 五阶段弃用流程

```
阶段1: 标记 → 阶段2: 通知 → 阶段3: 迁移 → 阶段4: 归档 → 阶段5: 删除
  (v0.9.x)    (v0.9.x)    (v0.10.x)   (v0.11.x)   (v1.0.0)
```

### 2.2 各阶段操作细则

#### 阶段 1：标记 @deprecated

**操作**：
- 在组件文件顶部添加 JSDoc `@deprecated` 标记
- 说明弃用原因和替代方案
- 在本文件中添加弃用版本号
- 不修改组件功能和导出

**标记格式**：
```typescript
/**
 * 组件描述...
 *
 * @deprecated v0.9.14 弃用原因说明
 * @替代方案 使用 Xxx 组件替代，具体用法参见...
 */
export function DeprecatedComponent() {
  // ...
}
```

#### 阶段 2：全局通知

**操作**：
- 在 CHANGELOG 中记录弃用项
- 在相关文档中添加弃用提示
- 确认所有使用方已收到通知

#### 阶段 3：迁移替代

**操作**：
- 提供迁移指南和代码示例
- 协助使用方完成替代方案迁移
- 迁移完成后验证功能一致性

#### 阶段 4：归档到 deprecated/

**操作**：
- 全局搜索确认零引用
- 将组件文件移动到 `src/components/deprecated/` 目录
- 更新相关的导出入口
- 保留 git 历史（通过移动而非删除）

#### 阶段 5：正式删除

**操作**：
- 在下一个大版本（如 v1.0.0）中删除
- 确保 CHANGELOG 中有 Breaking Change 记录
- 保留 git 历史以便回溯

### 2.3 时间线要求

| 阶段 | 最短持续时间 | 说明 |
|------|-------------|------|
| 标记 → 归档 | 至少 1 个版本周期 | 给使用方留迁移时间 |
| 归档 → 删除 | 至少 1 个大版本 | 确保充分过渡期 |

## 3. 当前弃用组件清单

### 3.1 已标记弃用组件

| 组件 | 弃用版本 | 弃用原因 | 替代方案 | 当前阶段 | 状态 |
|------|---------|---------|---------|---------|------|
| PoolCard | v0.9.14 | Pool 模块内部组件，仅被 PoolColumn 引用，未对外暴露 | Card + 自定义内容组合 | 阶段1: 标记 | @deprecated |
| PoolColumn | v0.9.14 | Pool 模块内部组件，仅被 PoolBoard 引用，未对外暴露 | 表格/列表布局组件 | 阶段1: 标记 | @deprecated |
| PoolList | v0.9.14 | Pool 模块内部组件，仅被 PoolBoard 引用，未对外暴露 | Table 组件 + 自定义渲染 | 阶段1: 标记 | @deprecated |
| FocusTrap | v0.9.14 | 全局无引用，功能未被使用 | Dialog/Sheet 内置焦点管理 | 阶段1: 标记 | @deprecated |
| WidgetErrorBoundary | v0.9.14 | 全局无引用，功能未被接入 | ErrorBoundary + 错误状态组件 | 阶段1: 标记 | @deprecated |

### 3.2 观察中组件（单次使用）

以下组件仅被使用一次，暂不弃用，持续观察是否有复用需求：

| 组件 | 使用方 | 行数 | 观察结论 |
|------|--------|------|---------|
| LLMConfigWidget | IntelligentScorePage | 195 | 功能专用，暂保留 |
| IndustryHistoryCard | IndustryScorePage | 55 | 行业评分专用，暂保留 |
| IndustrySkillSnapshotCard | IndustryScorePage | 41 | 行业评分专用，暂保留 |
| IntelligentScoreBasisCard | IntelligentScorePage | 82 | 智评分专用，暂保留 |
| StockSearch | InputDashboard | 188 | 输入舱专用，暂保留 |
| LocalDocCard | LocalKnowledgePage | 43 | 本地知识专用，暂保留 |
| NewsCard | NewsPage | 66 | 资讯页专用，暂保留 |
| NewsFilterPanel | NewsPage | 89 | 资讯页专用，暂保留 |
| PoolBoard | InputDashboard | 92 | 输入舱专用，暂保留 |
| ScoreDocVersionTable | ScoreDocPage | 119 | 评分文档专用，暂保留 |
| ChangeLogPanel | StrategySnapshotPage | 82 | 策略快照专用，暂保留 |
| StrategyGroupCard | StrategySnapshotPage | 63 | 策略快照专用，暂保留 |
| MigrationPanel | CommandApp | 263 | 迁移功能专用，暂保留 |

### 3.3 确认保留组件

| 组件 | 保留原因 |
|------|---------|
| DataState | 新添加的三态组合组件，架构推荐使用 |
| Breadcrumb | UI 基础组件，多页面使用 |
| Toast (Toaster) | 全局通知组件，App 根节点使用 |
| Table | UI 基础组件，统一导出入口 |
| Separator | UI 基础组件，统一导出入口 |
| Switch | UI 基础组件，统一导出入口 |
| ScoreItem | 评分展示基础组件 |
| Dialog | UI 基础组件，多场景使用 |
| Sheet | UI 基础组件，多场景使用 |
| Slider | UI 基础组件 |
| Toggle | UI 基础组件 |
| Label | UI 基础组件 |
| ErrorBoundary | 全局错误边界 |
| PageSkeleton | 页面骨架屏 |

## 4. 组件审计工具

### 4.1 审计脚本

使用 `scripts/audit/audit-component-usage.ts` 进行组件使用情况审计：

```bash
npx tsx scripts/audit-component-usage.ts
```

### 4.2 审计结果解读

- **可复用组件（≥2次）**：健康状态，复用性良好
- **单次使用组件（1次）**：观察状态，评估是否需要合并或提升
- **未使用组件（0次）**：警告状态，启动弃用评估流程

### 4.3 审计频率

- 每个迭代周期结束时执行一次
- 大版本发布前执行一次
- 重构完成后执行一次

## 5. 相关文档

- [组件开发指南](../how-to/widget-development-guide.md)
- [代码质量审计报告](v9-code-quality-audit-report-20260629.md)
- [代码质量看板](../explanation/design/v9-code-quality-kanban-20260629.md)
- [数据流规范](../explanation/design/data-flow-spec.md)
