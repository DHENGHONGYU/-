---
title: "UI 性能最佳实践"
domain: project
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v1.0.1
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P2 正文版本声明行=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

---
title: UI性能最佳实践
type: how-to
domain: frontend
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "动画性能优化、暗色模式兼容性、响应式断点规范"
tags: [frontend, performance, animation, dark-mode, responsive, component]
version: v1.0.0
last_updated: 2026-08-15
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-FRONT-061
change_log:
  - version: v1.0.0
    changes: "初始版本：动画性能最佳实践、暗色模式兼容性检查清单、响应式断点约定"
    date: 2026-08-15
---

# UI 性能最佳实践

> **版本**: v1.0.0 | **更新**: 2026-08-15

---

## 1. 动画性能优化

### 1.1 核心原则：禁止 `transition-all`

**根因**：`transition-all` 触发浏览器对所有可动画属性（width、height、margin、padding、color、shadow、transform 等）做 Layout/Paint 重计算，导致大量不必要的重排和重绘。

**规则**：

| 场景 | 错误写法 | 正确写法 |
|------|---------|---------|
| 进度条宽度 | `transition-all` | `transition-[width]` |
| 卡片 hover | `transition-all` | `transition-shadow transition-colors` |
| 按钮 hover | `transition-all` | `transition-colors` |
| 色块/图标变色 | `transition-all` | `transition-colors` |
| 高度变化（柱状图） | `transition-all` | `transition-[height]` |
| 位移/缩放 | `transition-all` | `transition-transform` |
| 透明度变化 | `transition-all` | `transition-opacity` |
| 内边距展开 | `transition-all` | `transition-[padding]` |

### 1.2 动画属性性能分级

| 性能等级 | 属性 | 触发阶段 |
|---------|------|---------|
| 最佳 | `transform`、`opacity` | Composite only |
| 良好 | `color`、`background-color`、`border-color` | Paint only |
| 一般 | `width`、`height`、`padding`、`margin` | Layout + Paint |
| 避免 | `transition-all`（全属性） | Layout + Paint + Composite |

**优先使用 `transform` 替代 `width/height` 动画**（如 `scaleX` 替代宽度进度条）。

### 1.3 2026-08-15 修复清单

以下组件已从 `transition-all` 迁移到精确属性：

| 文件 | 变更 |
|------|------|
| `components/atoms/Button.tsx` | `transition-all` → `transition-colors` |
| `components/atoms/Progress.tsx` | `transition-all` → `transition-[width]` |
| `components/atoms/Toaster.tsx` | `transition-all` → `transition-opacity transition-transform` |
| `components/molecules/Tabs.tsx` | `transition-all` → `transition-colors` |
| `components/molecules/RankedCard.tsx` | `transition-all` → `transition-transform transition-shadow` |
| `components/molecules/LoadingState.tsx` | `transition-all` → `transition-[width]` |
| `components/molecules/ScoreGauge.tsx` | `transition-all` → `transition-[width]` |
| `components/organisms/pool/CollectionProgress.tsx` | `transition-all` → `transition-[width]` |
| `components/organisms/pool/BatchCollectionPanel.tsx` | `transition-all` → `transition-[width]` |
| `components/organisms/trading/TradingSignalPanel.tsx` | `transition-all` → `transition-[width]` / `transition-shadow transition-transform` |
| `apps/input/DataTestPanel.tsx` | `transition-all` → `transition-[width]` |
| `pages/input/CollectTask/components/ScoreTrend.tsx` | `transition-all` → `transition-[height]` |
| `pages/input/CollectTask/components/ScoreProgress.tsx` | `transition-all` → `transition-[width]` |
| `pages/command/health/components/MechanismHealthPanel.tsx` | `transition-all` → `transition-[width]` |
| `pages/input/SevenDimConfigPage.tsx` | `transition-all` → `transition-[padding]` / `transition-colors` |
| `cockpit/widgets/PnLAnalysisWidget.tsx` | `transition-all` → `transition-[height]` |
| `cockpit/widgets/PositionControlWidget.tsx` | `transition-all` → `transition-[width]` |
| `pages/input/CollectTask/components/DimHealthCard.tsx` | `transition-all` → `transition-shadow transition-colors` |
| `components/organisms/input/wizard-steps/ConfigTemplateCard.tsx` | `transition-all` → `transition-shadow transition-colors` |
| `components/organisms/input/wizard-steps/DataSourceConfigStep.tsx` | `transition-all` → `transition-shadow transition-colors` |

---

## 2. 暗色模式兼容性

### 2.1 检查清单

- [x] 所有语义色通过 CSS 变量定义（`--background`、`--foreground`、`--card`、`--muted` 等）
- [x] `.dark` 选择器覆盖所有语义色变量
- [x] 扩展语义色（`--surface-2`、`--divider`、`--success`、`--warning`、`--info`）在 `.dark` 中有对应值
- [x] 阴影系统在 `.dark` 中有独立定义（`--shadow-sm/md/lg`）
- [x] Tailwind 配置通过 `hsl(var(--xxx))` 引用 CSS 变量
- [x] 无硬编码色值（如 `#ffffff`、`text-green-500`）在组件中

### 2.2 暗色模式变量定义

```css
.dark {
  --background: 240 3% 10%;
  --foreground: 240 10% 96%;
  --card: 240 3% 14%;
  --muted: 240 3% 16%;
  --muted-foreground: 240 3% 60%;
  --border: 240 3% 24%;
  --input: 240 3% 24%;
  --surface-2: 240 3% 20%;
  --divider: 240 3% 28%;
  --success: 142 69% 48%;
  --warning: 38 92% 55%;
  --info: 217 91% 65%;
}
```

### 2.3 新增组件检查项

- 所有 `bg-*` / `text-*` / `border-*` 使用语义 Token（如 `bg-surface-2`、`text-muted-foreground`、`border-divider`），不直接使用 `bg-white`、`text-black` 等
- 图表/可视化组件使用 `COLOR_TOKENS` / `STOCK_COLOR_TOKENS` 主题令牌
- 阴影使用 `shadow-sm` / `shadow-md` / `shadow-elevation-*` 而非自定义 `boxShadow`

---

## 3. 响应式断点约定

### 3.1 断点标准

| 断点 | 宽度 | 适用场景 |
|------|------|---------|
| 默认（mobile-first） | < 640px | 单列布局 |
| `sm` | ≥ 640px | 双列布局 |
| `md` | ≥ 768px | 三列布局 |
| `lg` | ≥ 1024px | 四列布局 / 侧边栏 |
| `xl` | ≥ 1280px | 宽屏优化 |

### 3.2 Grid 响应式规则

**禁止**硬编码 `grid-cols-N` 无响应式回退：

```tsx
// ❌ 错误
<div className="grid grid-cols-4 gap-4">

// ✅ 正确
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
```

**规则**：
- 所有 `grid-cols-{N}` 必须包含至少一个 `sm:` 或 `md:` 断点前缀
- 默认断点（mobile-first）使用 `grid-cols-1` 或 `grid-cols-2`
- N ≥ 4 的列数必须确保在 `md` 或 `lg` 断点才生效

### 3.3 2026-08-15 修复清单

| 文件 | 变更 |
|------|------|
| `apps/trading/panels/ExecutionPlanPanel.tsx` | `grid-cols-3` → `grid-cols-1 sm:grid-cols-3` |
| `apps/trading/components/ExecutionPlanCard.tsx` | `grid-cols-3` → `grid-cols-1 sm:grid-cols-3` |
| `components/organisms/trading/RiskControlPanel.tsx` | `grid-cols-3` → `grid-cols-1 sm:grid-cols-3` / `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |
| `components/organisms/trading/OrderExecutionPanel.tsx` | `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |
| `cockpit/widgets/AITradeReviewWidget.tsx` | `grid-cols-4` → `grid-cols-2 sm:grid-cols-4` |
| `cockpit/widgets/PnLAnalysisWidget.tsx` | `grid-cols-3` → `grid-cols-1 sm:grid-cols-3` |
| `cockpit/widgets/RiskMonitorWidget.tsx` | `grid-cols-3` → `grid-cols-1 sm:grid-cols-3` |
| `cockpit/widgets/SignalQualityDashboardWidget.tsx` | `grid-cols-4` → `grid-cols-2 md:grid-cols-4` / `grid-cols-3` → `grid-cols-1 sm:grid-cols-3` |
| `cockpit/widgets/PortfolioOverviewWidget.tsx` | `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |
| `cockpit/widgets/PositionControlWidget.tsx` | `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |
| `cockpit/widgets/WatchlistWidget.tsx` | `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` / `grid-cols-4` → `grid-cols-2 sm:grid-cols-4` |
| `cockpit/widgets/SectorHeatmapWidget.tsx` | `grid-cols-5` → `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` |
| `cockpit/widgets/HotSectorWidget.tsx` | `grid-cols-5` → `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` |
| `cockpit/widgets/ValuePitWidget.tsx` | `grid-cols-6` → `grid-cols-2 sm:grid-cols-3 md:grid-cols-6` |
| `pages/trading/RiskControlPage.tsx` | `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |
| `pages/trading/PortfolioPage.tsx` | `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |
| `pages/output/DashboardPage.tsx` | `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |
| `components/organisms/system/migration/MigrationReportTab.tsx` | `grid-cols-4` → `grid-cols-2 sm:grid-cols-4` |
| `components/organisms/system/migration/MigrationPreviewTab.tsx` | `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |

---

## 4. 相关文档

- `../../archive/historical-2026-08-16/batch8/ui-design-system.md（已归档）` — 设计系统总览
- `docs/release-notes/RELEASE-NOTES-dark-mode-optimization.md` — 暗色模式优化 Release Notes
- `docs/reference/ui-remediation-tracker.md（已废弃）` — 界面设计优化整改追踪
- `src/index.css` — CSS 变量定义（`.dark` 选择器）
- `tailwind.config.js` — 语义色扩展配置
