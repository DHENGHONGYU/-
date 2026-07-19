---
title: V9 性能基线
type: explanation
domain: project
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "建立�?v0.9.11 | P2-PERF 性能整改"
tags: [project, performance, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-281
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 性能基线

> 建立�?v0.9.11 | P2-PERF 性能整改

## Core Web Vitals 目标

| 指标 | 目标�?| 说明 |
|------|--------|------|
| LCP (Largest Contentful Paint) | �?.0s | 金融仪表盘要求首屏加载速度 |
| CLS (Cumulative Layout Shift) | �?.05 | 数据表格偏移会严重影响交易决�?|
| INP (Interaction to Next Paint) | �?00ms | 交互响应延迟 |
| FCP (First Contentful Paint) | �?.8s | 首屏绘制时间 |
| TTFB (Time to First Byte) | �?00ms | 首字节时�?|

### Web Vitals 监控实现

已在 `src/App.tsx` 中集�?Web Vitals 监控�?
```typescript
// P2-PERF001 - Web Vitals 集成
import { onCLS, onFID, onFCP, onLCP, onTTFB, onINP } from 'web-vitals'

export function reportWebVitals() {
  onCLS(reportWebVital)
  onFID(reportWebVital)
  onFCP(reportWebVital)
  onLCP(reportWebVital)
  onTTFB(reportWebVital)
  onINP(reportWebVital)
}
```

监控仅在生产环境 (`import.meta.env.PROD`) 启用，数据输出到控制台，可扩展至 Sentry 或自建监控服务�?
---

## Bundle 体积目标

| 指标 | 目标�?| 说明 |
|------|--------|------|
| 首屏 JS | �?00KB (gzipped) | 影响首屏加载 |
| 总包体积 | �?MB | 完整应用包大�?|
| 懒加载比�?| �?0% | 非首屏代码占�?|

### Bundle Analyzer 配置

已在 `vite.config.ts` 中配�?rollup-plugin-visualizer�?
```typescript
// P2-PERF003 - Bundle Analyzer
import { visualizer } from 'rollup-plugin-visualizer'

visualizer({
  filename: 'dist/stats.html',
  open: false,
  gzipSize: true,
  brotliSize: true,
})
```

运行 `npm run analyze` 生成包体积报告，分析入口�?`dist/stats.html`�?
### 懒加载配�?
当前 manualChunks 配置�?
```typescript
manualChunks: {
  'vendor': ['react', 'react-dom', 'react-router', 'zustand'],
  'ui': ['lucide-react', 'clsx', 'tailwind-merge'],
}
```

---

## 表格性能 - 虚拟滚动

| 场景 | 阈�?| 策略 |
|------|------|------|
| 持仓表格 | >100�?| 启用 @tanstack/react-virtual |
| 骨架屏行�?| 48px | 固定高度优化测量 |
| 预渲染行�?| 5�?| overscan 配置 |

### 虚拟滚动实现

`src/pages/trading/components/VirtualizedHoldingsTable.tsx` (P2-PERF002)�?
- 数据�?�?00 行：直接渲染
- 数据�?>100 行：启用虚拟滚动，仅渲染可见区域 + 5行缓�?
```typescript
const virtualizer = useVirtualizer({
  count: holdings.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,
  overscan: 5,
})
```

---

## 性能监控 SOP

1. **开发阶�?*：使�?`npm run dev`，监控控制台 Web Vitals 输出
2. **构建分析**：运�?`npm run analyze`，打开 `dist/stats.html`
3. **生产验证**：部署后使用 Chrome DevTools Lighthouse �?PageSpeed Insights

---

## 修订记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-06-29 | v0.9.11 | 初始建立 P2-PERF 性能基线 |
