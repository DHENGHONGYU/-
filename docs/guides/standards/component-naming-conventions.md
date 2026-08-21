---
doc_id: V9-DOC-GUIDE-047
title: "组件命名规范与文档模板标准"
domain: project
status: active
last_updated: 2026-08-17
code_version: 2.0.0-rc.2
---

---
doc_id: V9-DOC-GUIDE-030
title: "组件命名规范与文档模板标准"
domain: guide
status: active
last_updated: 2026-08-15
---

# 组件命名规范与文档模板标准

> **版本**: v1.0  
> **更新日期**: 2026-08-15  
> **适用范围**: `src/components/` 下所有 Atom / Molecule / Organism / Template 组件  
> **自动化检查**: `npm run audit:naming`

---

## 1. 执行摘要

本规范定义了 FinSightV9 项目中所有组件的命名约定、文档模板标准及文件结构最佳实践。通过自动化脚本 `check-naming-conventions.ts` 可一键检测合规性。

### 1.1 当前合规指标（2026-08-15 检测）

| 指标 | 数值 | 等级 |
|------|------|------|
| 扫描文件数 | 130 | — |
| 平均合规分 | **92.8 / 100** | 🟢 良好 |
| Error 级问题 | 0 | ✅ |
| Warning 级问题 | 78 | 🟡 建议修复 |
| Info 级问题 | 54 | 🔵 可优化 |

### 1.2 各维度覆盖率

| 检查维度 | 覆盖率 | 说明 |
|----------|--------|------|
| 命名一致性 (name-match) | **96%** | 文件名与组件导出名匹配 |
| @fileoverview 覆盖 | **73%** | 含功能描述和层级标注 |
| 导出 JSDoc 覆盖 | **97%** | 主导出有注释说明 |
| Props 接口定义 | ~85% | 大部分组件有 Props 类型 |
| 层级命名规范 | **98%** | PascalCase / 后缀约定 |

---

## 2. 命名规范

### 2.1 文件与组件命名

| 层级 | 命名风格 | 示例 |
|------|----------|------|
| **Atom** | PascalCase，具描述性 | `Badge.tsx`, `Button.tsx`, `Input.tsx` |
| **Molecule** | PascalCase，复合名词 | `MetricCard.tsx`, `LoadingState.tsx` |
| **Organism** | PascalCase，业务名词 | `PoolBoard.tsx`, `ScoreHistoryPanel.tsx` |
| **Template** | PascalCase，后缀约定 | `DashboardLayout.tsx`, `PageContainer.tsx` |

### 2.2 硬性规则

```typescript
// ✅ 正确：文件名 Badge.tsx 导出 Badge
export function Badge({ ... }: BadgeProps): React.JSX.Element { ... }

// ❌ 错误：文件名 Badge.tsx 导出 BadgeItem
export function BadgeItem({ ... }: BadgeProps): React.JSX.Element { ... }
```

### 2.3 Template 层后缀约定

Template 组件建议使用以下后缀之一以明确其布局职责：

| 后缀 | 用途 | 示例 |
|------|------|------|
| `Layout` | 整体布局容器 | `DashboardLayout.tsx` |
| `Page` | 页面级组件 | `TradingSignalPage.tsx` |
| `App` | 应用根组件 | `InputApp.tsx` |
| `Container` | 通用容器 | `PageContainer.tsx` |

### 2.4 豁免场景

以下文件不适用组件命名规范：
- `*.test.tsx` / `*.spec.tsx` — 测试文件
- `*.stories.tsx` — Storybook 文件
- `index.ts` / `index.tsx` — 统一出口
- `*.config.ts` / `*.types.ts` / `*.utils.ts` — 工具/配置文件

---

## 3. 文档模板标准

### 3.1 @fileoverview 模板（必需）

每个组件文件**必须**在文件顶部包含 `@fileoverview` 注释：

```typescript
/**
 * @fileoverview Badge - 徽章组件（Atom层组件）
 * @module components/atoms/Badge
 */
```

**模板结构**：
```
/**
 * @fileoverview {组件名} - {功能描述}（{层级}层组件）
 * @module {相对路径，不含扩展名}
 */
```

### 3.2 主导出 JSDoc（推荐）

```typescript
/**
 * 徽章组件
 *
 * 支持 default / secondary / outline / destructive / success / warning 六种变体。
 * 适用于状态标注、分类标记等场景。
 */
export function Badge({ ... }: BadgeProps): React.JSX.Element { ... }
```

### 3.3 Props 接口文档（推荐）

```typescript
/** Badge 组件属性 */
export interface BadgeProps {
  /** 徽章内容 */
  children: React.ReactNode
  /** 变体样式 */
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning'
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 自定义类名 */
  className?: string
}
```

### 3.4 文件结构顺序（推荐）

```
1. import 语句
2. 类型定义 (interface / type / enum)
3. 常量 / 配置
4. 组件导出 (export const X = memo(...) / export function X())
5. 辅助函数 / hooks
6. 样式相关
```

---

## 4. 导出模式规范

### 4.1 组件导出

```typescript
// ✅ 推荐：使用 memo 包裹的 export const
export const Badge = memo(function Badge({ ... }: BadgeProps): React.JSX.Element {
  ...
})

// ✅ 可接受：简单组件使用 export function
export function Badge({ ... }: BadgeProps): React.JSX.Element {
  ...
}
```

### 4.2 Hooks 与工具

```typescript
// ✅ Hooks 使用 export function
export function useDensity(): DensityContextType { ... }

// ✅ Context Provider 使用 export function
export function DensityProvider({ children, ... }: Props): React.JSX.Element { ... }
```

### 4.3 可接受的混合导出场景

以下文件类型允许 `export function` + `export const` 混合导出：

| 场景 | 说明 | 示例 |
|------|------|------|
| **Context Provider** | 导出 Provider + hooks + 配置常量 | `DensityContext.tsx` |
| **指标计算** | 导出计算函数 + 配置常量 | `macd.ts`, `kdj.ts` |
| **注册表** | 导出注册函数 + 注册表常量 | `componentRegistry.ts` |
| **配置文件** | 导出配置对象 + 辅助函数 | `candlestickChart.config.ts` |

---

## 5. 自动化检查

### 5.1 命令

| 命令 | 用途 |
|------|------|
| `npm run audit:naming` | 人类可读模式 |
| `npm run audit:naming:json` | JSON 结构化报告 |
| `npm run fix:fileoverview` | 自动补充缺失的 @fileoverview |
| `npm run fix:unregistered` | 自动补全未注册的组件 |

### 5.2 检查维度详情

| # | 检查项 | 严重级 | 说明 |
|---|--------|--------|------|
| 1 | 文件名与导出名一致性 | Warning | 文件名必须与主导出名匹配 |
| 2 | @fileoverview 存在性 | Warning | 每个文件必须有功能描述 |
| 3 | 主导出 JSDoc | Warning | 导出组件应有注释 |
| 4 | Props 接口定义 | Info | 推荐定义 Props 接口 |
| 5 | 导出模式一致性 | Info | 智能豁免 Context/配置文件 |
| 6 | 层级命名规范 | Warning | PascalCase + 层级后缀 |
| 7 | 文件结构顺序 | Info | import → 类型 → 导出 → 辅助 |
| 8 | 空文件检测 | Info | 检测占位文件 |

### 5.3 评分规则

| 严重级 | 扣分 |
|--------|------|
| Error | -20 |
| Warning | -10 |
| Info | -3 |
| **满分** | **100** |

### 5.4 CI 集成

命名规范检查已集成到以下 CI 流水线：

- **quality-check.yml** — 作为 P1 门禁（可降级为 warn）
- **ci.yml** — 在 PR 评论中展示合规指标

---

## 6. 历史改善记录

| 日期 | 平均分数 | 问题数 | @fileoverview 覆盖 | 备注 |
|------|----------|--------|---------------------|------|
| 2026-08-14 | 85.6 | 225 | 12% | 基线测量 |
| **2026-08-15** | **92.8** | **132** | **73%** | 补充 95 个 @fileoverview，修复混合导出检测 |

### 改善项

- ✅ **95 个组件** 已自动补充标准 @fileoverview 注释
- ✅ **5 个混合导出文件** 已识别为合法模式（Context/配置/指标），检查器已增加智能豁免
- ✅ 导出 JSDoc 覆盖提升至 97%
- ✅ 所有 Error 级问题已清零

### 待改善项

| 优先级 | 项目 | 涉及文件数 | 建议 |
|--------|------|------------|------|
| 🔴 P0 | 补充 Props 接口文档 | ~20 | 为每个 Props 属性添加 JSDoc |
| 🟡 P1 | 修复文件结构顺序 | ~15 | 调整为 import → 类型 → 导出 → 辅助 |
| 🔵 P2 | Template 层后缀规范化 | ~5 | 添加 Page/Layout/App 后缀 |
| 🔵 P2 | 补充弱 @fileoverview | ~10 | 描述过短（< 5 字符） |

---

## 7. 相关资源

- [组件注册表治理](../../archive/historical-2026-08-16/batch7/docs/reference/changelogs/2026-08/registry-governance-summary.md（已归档）)
- [代码规范基础](coding-conventions.md)
- [质量门禁](quality-gates.md)
- [四层架构说明](../../architecture/layered-architecture.md（已废弃）)

---

*本文档由自动化脚本 `check-naming-conventions.ts` 生成基础数据，人工审核后发布。*
*下次检测：`npm run audit:naming`*
