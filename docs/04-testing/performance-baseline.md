---
title: performance-baseline
type: reference
domain: qa
phase: testing
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 性能测试基线报告（v1.1.0）：P0/B1 优化后的构建与运行时性能指标基线�?
tags: [qa, performance, testing, audit, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-003
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 性能测试基线报告

> **Version**: v1.1.0 �?**测试日期**: 2026-07-16 �?**版本**: v2.0.0
> **测试环境**: Windows / Chrome 最新版 / Vite 生产构建
> **基准构建**: `npm run build` �?构建耗时 8.99s
> **最近更�?*: B1 性能优化批次完成（禁用大体积 chunk modulepreload�?
---

## 1. 构建性能基线

### 1.1 构建指标

| 指标 | 当前�?| 目标�?| 状�?|
| :--- | :--- | :--- | :--- |
| **构建时间** | 8.99s | < 15s | �?达标 |
| **总产物体积（未压缩）** | ~4.87 MB | < 6 MB | �?达标 |
| **总产物体积（gzip�?* | ~1.5 MB | < 2 MB | �?达标 |
| **首屏 preload JS** | 113 KB / ~39 KB (gzip) | < 500 KB / 150 KB (gzip) | �?达标 |
| **Chunk 数量** | 37 �?| �?| �?|

### 1.2 大体�?Chunk 分析�? 100KB 未压缩）

| 排名 | Chunk | 未压�?| gzip | 占比 | 首屏加载 | 建议 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | transformers | 823.89 KB | 200.18 KB | 17% | �?�?| �?已按需加载，仅 NLP/嵌入时引�?|
| 2 | index (主包) | 724.07 KB | 217.07 KB | 15% | �?否（路由 lazy�?| 进一步拆分核心模�?|
| 3 | charts (图表�? | 589.33 KB | 177.08 KB | 12.5% | �?�?| �?已禁�?preload，按页面 lazy 加载 |
| 4 | excel (导出) | 429.49 KB | 143.07 KB | 9% | �?�?| �?已按需加载，仅导出时加�?|
| 5 | pdf (生成) | 412.77 KB | 138.85 KB | 8.8% | �?�?| �?已禁�?preload，仅生成报告时加�?|
| 6 | mechanismHealthStore | 168.55 KB | 43.73 KB | 3.6% | �?�?| 分析依赖，优化体�?|
| 7 | index.es (国际�?) | 155.88 KB | 53.53 KB | 3.3% | �?�?| 按需加载语言�?|
| 8 | html2canvas | 197.62 KB | 48.04 KB | 4.2% | �?�?| �?已禁�?preload，按需加载 |
| 9 | CockpitShell | 92.32 KB | 29.35 KB | 2% | �?�?| 驾驶舱懒加载 |
| 10 | InputApp | 78.46 KB | 24.40 KB | 1.7% | �?�?| 路由级懒加载已做 |

### 1.3 体积优化建议

#### P0 级优化（已完�?B1 批次�?
1. **transformers.js 按需加载** �?已完�?   - 状态：已通过动�?import 实现按需加载
   - 实际效果：首屏不加载，首次使�?NLP/嵌入功能时加�?
2. **charts 图表库懒加载** �?已完�?   - 状态：已禁�?modulepreload + 路由�?lazy import
   - 实际效果：首屏不加载，进入含图表页面时加�?
3. **pdf 报告生成懒加�?* �?已完�?   - 状态：已禁�?modulepreload + backtestStore 动�?import
   - 实际效果：首屏不加载，点击导�?PDF 时加�?
4. **excel 导出懒加�?* �?已完�?   - 状态：已通过动�?import 实现按需加载
   - 实际效果：首屏不加载，点击导�?Excel 时加�?
5. **html2canvas 截图懒加�?* �?已完�?   - 状态：已禁�?modulepreload
   - 实际效果：首屏不加载

#### P1 级优化（下一优先级）

6. **mechanismHealthStore 体积优化**
   - 当前�?68KB，偏�?   - 方案：分析依赖树，移除不必要的依�?   - 预期收益：~50KB

7. **主包 (index) 进一步拆�?*
   - 当前�?24KB，偏�?   - 方案：将非核心模块移至独�?chunk
   - 预期收益：首�?-100~200KB

#### P2 级优化（预期收益：首�?-10%�?
8. **路由级懒加载深化**
   - 当前：部分大页面已做懒加�?   - 方案：所有非首屏页面全部 lazy import
   - 预期收益：首�?-100~200KB

---

## 2. 前端性能基线（待实测�?
### 2.1 Web Vitals 目标

| 指标 | 定义 | 优秀目标 | 当前基线 | 状�?|
| :--- | :--- | :--- | :--- | :--- |
| **LCP** | 最大内容绘�?| < 2.5s | 待实�?| �?|
| **INP** | 交互到下次绘�?| < 200ms | 待实�?| �?|
| **CLS** | 累积布局偏移 | < 0.1 | 待实�?| �?|
| **FCP** | 首次内容绘制 | < 1.8s | 待实�?| �?|
| **TTI** | 可交互时�?| < 3.8s | 待实�?| �?|
| **TBT** | 总阻塞时�?| < 200ms | 待实�?| �?|

### 2.2 性能预算

| 资源类型 | 预算（gzip�?| 当前估算 | 状�?|
| :--- | :--- | :--- | :--- |
| **首屏 JS (preload)** | �?150 KB | ~39 KB | �?达标 |
| **首屏 CSS** | �?30 KB | 待实�?| �?|
| **首屏字体** | �?50 KB | 待实�?| �?|
| **首屏图片** | �?100 KB | 待实�?| �?|
| **首屏总计** | �?330 KB | ~150-200 KB（估算） | �?达标 |

---

## 3. Lighthouse 评分基线（待实测�?
### 3.1 评分目标

| 维度 | 目标�?| 权重 | 说明 |
| :--- | :--- | :--- | :--- |
| **性能 (Performance)** | �?90 | 最�?| 加载速度、交互响�?|
| **可访问�?(Accessibility)** | �?90 | �?| WCAG 合规、无障碍 |
| **最佳实�?(Best Practices)** | �?90 | �?| 安全、HTTPS、错误处�?|
| **SEO** | �?90 | �?| 语义化、meta 标签 |
| **PWA** | �?80 | �?| 离线可用、安装�?|

### 3.2 测试页面清单

| 页面 | URL | 优先�?|
| :--- | :--- | :--- |
| 首页/驾驶�?| `/cockpit` | P0 |
| 输入�?| `/input` | P0 |
| 分析�?| `/analysis` | P0 |
| 个股评分 | `/analysis/stock-score/000001.SZ` | P0 |
| 交易�?| `/trading` | P1 |
| 持仓管理 | `/trading/holdings` | P1 |
| 输出�?| `/output` | P1 |
| 总控�?| `/command` | P2 |

---

## 4. 性能测试方法

### 4.1 本地测试

```powershell
# 构建性能分析
npm run build
# �?产物体积、chunk 分析

# Lighthouse 本地测试
# 1. 先启动预览服务器
npm run preview
# 2. �?Chrome DevTools Lighthouse 面板测试
# 或使�?CLI
npx lighthouse http://localhost:4173 --view
```

### 4.2 自动化测�?
```powershell
# Playwright 性能测试（待接入�?npx playwright test e2e/performance.spec.ts

# Web Vitals 采集
# �?app 中集�?web-vitals �?# 上报到监控系�?```

### 4.3 CI 集成

| 检查项 | 触发条件 | 阈�?|
| :--- | :--- | :--- |
| 包体积检�?| 每次 PR | 主包 gzip �?200KB |
| Lighthouse CI | 每日构建 | Performance �?85 |
| 构建时间 | 每次 PR | < 15s |

---

## 5. 性能优化路线�?
### 第一阶段：立竿见影（�?1 周）

| 任务 | 预期收益 | 难度 |
| :--- | :--- | :--- |
| transformers 按需加载 | 首屏 -200KB (gzip) | �?|
| charts 懒加�?| 首屏 -177KB (gzip) | �?|
| excel/pdf 懒加�?| 首屏 -280KB (gzip) | �?|
| html2canvas 懒加�?| 首屏 -48KB (gzip) | �?|

### 第二阶段：深度优化（�?2 周）

| 任务 | 预期收益 | 难度 |
| :--- | :--- | :--- |
| 主包进一步拆�?| 首屏 -50~100KB | �?|
| mechanismHealthStore 优化 | 首屏 -40KB | �?|
| 路由级懒加载深化 | 各页面首屏加载加�?| �?|
| 图片优化（WebP/AVIF�?| 图片体积 -30% | �?|

### 第三阶段：体验优化（�?3-4 周）

| 任务 | 预期收益 | 难度 |
| :--- | :--- | :--- |
| 长列表虚拟化 | 大股票池流畅�?| �?|
| 评分计算性能优化 | 评分速度提升 | �?|
| 记忆�?缓存优化 | 重复计算减少 | �?|
| PWA Service Worker | 二次加载加�?+ 离线可用 | �?|

---

## 6. 性能监控指标

### 6.1 前端性能监控（待接入�?
| 指标 | 采集方式 | 告警阈�?|
| :--- | :--- | :--- |
| LCP | web-vitals / PerformanceObserver | > 3s |
| INP | web-vitals / PerformanceObserver | > 300ms |
| CLS | web-vitals / PerformanceObserver | > 0.15 |
| JS 错误�?| window.onerror + unhandledrejection | > 1% |
| 资源加载失败 | Performance API | > 0.5% |

### 6.2 业务性能指标

| 指标 | 定义 | 目标 |
| :--- | :--- | :--- |
| 首屏评分时间 | 打开页面到评分结果展�?| < 3s |
| 批量评分耗时 | 100 只股票全量评�?| < 30s |
| 股票池搜索响�?| 搜索输入到结果展�?| < 200ms |
| 页面切换耗时 | 路由切换到内容可�?| < 500ms |
| 导出耗时 | 导出 100 条记�?| < 5s |

---

## 7. 当前结论

### 7.1 构建性能

- �?**构建时间**�?0.57s，达标（< 15s�?- ⚠️ **首屏体积**�?20KB (217KB gzip)，超预算
- ⚠️ **�?chunk 数量**：多�?> 400KB �?chunk 需懒加�?- 🔴 **最大优化点**：transformers + charts + excel + pdf 四大块可全部懒加�?
### 7.2 预期优化效果

完成 P0 优化后：
- 首屏 JS 体积�?20KB �?~200KB�?*减少 72%**�?- 首屏 gzip 体积�?17KB �?~60KB�?*减少 72%**�?- LCP 预期提升：从估算 3-4s �?2s 以内

### 7.3 下一步行�?
1. **立即执行**：transformers / charts / excel / pdf 懒加载改�?2. **本周�?*：建�?Lighthouse 自动化基线测�?3. **下周**：接�?web-vitals 性能监控
4. **持续**：每�?PR 检查包体积，防止性能退�?
---

## 附录 A：完�?Chunk 列表

| Chunk 名称 | 大小 (KB) | gzip (KB) | 类型 |
| :--- | :--- | :--- | :--- |
| transformers | 823.89 | 200.18 | 第三�?|
| index (主包) | 720.12 | 217.07 | 应用代码 |
| charts | 603.47 | 177.08 | 第三�?|
| excel | 429.49 | 143.07 | 第三�?|
| pdf | 422.54 | 138.80 | 第三�?|
| html2canvas | 202.36 | 48.04 | 第三�?|
| mechanismHealthStore | 172.41 | 43.73 | Store |
| index.es | 159.63 | 53.53 | 国际�?|
| CockpitShell | 94.75 | 29.35 | 应用代码 |
| InputApp | 80.40 | 24.40 | 应用代码 |
| TradingFlowPage | 68.00 | 17.58 | 页面 |
| ui | 66.30 | 16.04 | UI 组件 |
| IndustryScorePage | 53.09 | 17.56 | 页面 |
| vendor | 47.26 | 17.03 | 第三方基础 |
| ... (其余 23 �?chunk < 40KB) | �?| �?| �?|

---

*本基线报告基�?2026-07-15 v2.0.0 版本构建数据。LCP/INP/CLS 等运行时指标�?Lighthouse 实测后补充�?
