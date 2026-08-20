---
doc_id: V9-DOC-IMPL-002
title: density-table-integration-plan-2026-08-20
status: active
last_updated: 2026-08-21
maintainer: FinSightV9 Team
---

# 表格组件自动消费 DensityConfig 实施方案

**日期**: 2026-08-20  
**版本**: v1.0  
**状态**: 待实施

---

## 一、设计原则

1. **渐进式改造** — 不强制所有表格立即支持密度切换，按优先级分批推进
2. **向后兼容** — 未消费密度配置的表格保持原有样式不变
3. **零侵入** — 表格组件不关心密度状态，仅通过 Tailwind class 响应
4. **语义化优先** — 使用 `useDensityConfig()` 返回的 Tailwind class，避免硬编码像素值

---

## 二、DensityConfig API

```typescript
// src/components/cockpit/DensityContext.tsx
export interface DensityConfig {
  level: 'compact' | 'normal' | 'expanded'
  rowHeight: number      // 36 | 44 | 56
  fontSize: string       // 'text-xs' | 'text-sm' | 'text-base'
  spacing: string        // 'gap-1' | 'gap-2' | 'gap-3'
  padding: string        // 'p-2' | 'p-3' | 'p-4'
}

// 三个消费 Hook：
useDensity()        // 返回完整 ContextType（density + config + setDensity + toggleDensity）
useDensityConfig()  // 仅返回 DensityConfig
useDensityClass()   // 返回 `density-${level}` CSS class
```

---

## 三、改造目标组件清单

| # | 组件 | 文件 | 当前结构 | 改造复杂度 |
|---|------|------|----------|------------|
| 1 | **InputDashboardPoolTable** | `src/apps/input/components/InputDashboardPoolTable.tsx` | 原生 table + tr/td | ⭐⭐ 低 |
| 2 | **PortfolioPage 持仓网格** | `src/pages/trading/PortfolioPage.tsx` | div grid 布局 | ⭐⭐ 低 |
| 3 | **IndustryDashboardPage 排序表** | `src/pages/analysis/IndustryDashboardPage.tsx` | div 列表 | ⭐⭐ 低 |
| 4 | **MultiFactorFilterPage 筛选表** | `src/pages/analysis/MultiFactorFilterPage.tsx` | 表格 | ⭐⭐ 低 |
| 5 | **V6ScoreCard 评分卡片网格** | `src/apps/analysis/AnalysisApp.tsx` | grid 卡片 | ⭐ 极低 |

---

## 四、实施方案（按复杂度从低到高）

### 方案 A：网格卡片组件（推荐首选）

**适用场景**: V6ScoreCard、CapitalAllocationPanel 等使用 Tailwind grid 的组件

**改造模式**:

```typescript
// Before
function V6ScoreCard() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* 卡片内容 */}
    </div>
  )
}

// After
import { useDensityConfig } from '@/components/cockpit/DensityContext'

function V6ScoreCard() {
  const { spacing } = useDensityConfig()

  return (
    <div className={`grid ${spacing} sm:grid-cols-2 lg:grid-cols-3`}>
      {/* 卡片内容 */}
    </div>
  )
}
```

**改动量**: 每个组件 ~3 行（import + useDensityConfig + class 替换）

---

### 方案 B：原生 table 组件

**适用场景**: InputDashboardPoolTable、MultiFactorFilterPage 等使用 HTML `<table>` 的组件

**改造模式**:

```typescript
// Before
function InputDashboardPoolTable() {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b">
          <th className="px-4 py-3 text-left text-sm">代码</th>
          {/* ... */}
        </tr>
      </thead>
      <tbody>
        <tr className="border-b">
          <td className="px-4 py-3">600519</td>
          {/* ... */}
        </tr>
      </tbody>
    </table>
  )
}

// After
import { useDensityConfig } from '@/components/cockpit/DensityContext'

function InputDashboardPoolTable() {
  const { rowHeight, fontSize, padding } = useDensityConfig()

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b" style={{ height: rowHeight }}>
          <th className={`${padding} text-left ${fontSize}`}>代码</th>
          {/* ... */}
        </tr>
      </thead>
      <tbody>
        <tr className="border-b" style={{ height: rowHeight }}>
          <td className={`${padding} ${fontSize}`}>600519</td>
          {/* ... */}
        </tr>
      </tbody>
    </table>
  )
}
```

**改动量**: 每个组件 ~8-12 行（import + useDensityConfig + 替换 px/py class + 添加 style.height）

---

### 方案 C：div 列表组件

**适用场景**: IndustryDashboardPage 排序表、分析舱候选卡片列表等

**改造模式**:

```typescript
// Before
function IndustrySortedList() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 flex-col">
            <span className="font-mono text-sm">801081.SI</span>
            <p className="mt-1 text-sm text-muted-foreground">半导体设备</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// After
import { useDensityConfig } from '@/components/cockpit/DensityContext'
import { cn } from '@/lib/utils'

function IndustrySortedList() {
  const { fontSize, spacing, padding } = useDensityConfig()

  return (
    <div className={cn('space-y-4', spacing)}>
      <div className={cn('rounded-lg border', padding)}>
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 flex-col">
            <span className={cn('font-mono', fontSize)}>801081.SI</span>
            <p className={cn('mt-1 text-muted-foreground', fontSize)}>半导体设备</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**改动量**: 每个组件 ~6-10 行

---

## 五、实施优先级

### Phase 1（建议立即实施）

| 组件 | 理由 | 预估时间 |
|------|------|----------|
| **InputDashboardPoolTable** | 已添加 DensityToggle，表格消费配置自然延伸 | 30 分钟 |
| **PortfolioPage 持仓网格** | 已添加 DensityToggle，用户可直接感知效果 | 20 分钟 |

### Phase 2（建议近期实施）

| 组件 | 理由 | 预估时间 |
|------|------|----------|
| **IndustryDashboardPage 排序表** | 数据密集、多行展示 | 30 分钟 |
| **MultiFactorFilterPage 筛选表** | 多列数据、对比需求强 | 30 分钟 |

### Phase 3（可选）

| 组件 | 理由 | 预估时间 |
|------|------|----------|
| **V6ScoreCard 评分卡片网格** | 间距调整感知度中等 | 15 分钟 |
| **其他小型列表组件** | 按需添加 | 视情况而定 |

---

## 六、技术注意事项

### 6.1 避免在循环中调用 Hook

```typescript
// ❌ 错误 — 在 map 循环中调用 Hook 违反 Rules of Hooks
{items.map((item) => {
  const { padding } = useDensityConfig()  // VIOLATION
  return <td className={padding}>{item.name}</td>
})}

// ✅ 正确 — 在组件顶层调用一次
const { padding } = useDensityConfig()
{items.map((item) => (
  <td className={padding}>{item.name}</td>
))}
```

### 6.2 Tailwind JIT 编译

确保动态拼接的 class 能被 Tailwind JIT 识别：

```typescript
//  可能被 JIT 遗漏
const padding = useDensityConfig().padding  // 'p-2'
<td className={padding}>  // JIT 可能无法静态分析

// ✅ 使用 cn() 或全量 class 确保 JIT 识别
const { padding } = useDensityConfig()
<td className={cn('px-4', padding)}>  // cn() 保证 class 被扫描到
```

### 6.3 表格行高 vs 内边距

原生 `<table>` 的 `height` style 与 `padding` 可能有冲突，建议：

- **行高控制**: 使用 `style={{ height: rowHeight }}` 在 `<tr>` 上
- **内边距控制**: 使用 `padding` class 在 `<td>`/`<th>` 上
- 两者配合使用，`height` 决定行最小高度，`padding` 决定内容间距

---

## 七、验收标准

| 验证项 | 标准 |
|--------|------|
| **视觉一致性** | 切换密度后，表格间距、字号、行高均匀变化 |
| **持久化** | 刷新页面后密度选择自动恢复 |
| **性能** | 密度切换无卡顿（Context 更新应为 O(1)） |
| **无障碍** | 紧凑模式下文字不重叠、可点击区域 ≥ 36px |
| **移动端** | 三种密度在移动端均正常显示 |

---

## 八、后续扩展方向

1. **密度预设扩展** — 新增 `ultra-compact`（32px）或 `accessible`（64px）档位
2. **列密度独立控制** — 允许表格列密度与行密度独立调整
3. **密度联动** — 驾驶舱的 DensityToggle 与页面级 DensityToggle 联动同步
4. **CSS 变量方案** — 将 density 配置注入 CSS custom properties，支持非 Tailwind 组件消费

---

**文档生成时间**: 2026-08-20  
**作者**: AI Agent
