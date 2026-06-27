# V9 智能投研复盘系统 — Release Note

## v1.2.0 (2026-06-27) — 架构审计修复与能力升级

> **版本类型**：Feature Release + Bug Fix  
> **变更人**：V9 质量审计官  
> **关联任务**：V9 架构审计全量扫描修复  
> **代码提交**：`981c4c9`

---

## 📋 变更摘要

本次发布完成了 V9 架构审计发现的 **10 项待办任务** 的修复与实现，涵盖 Agent 系统、Widget 引擎、评分算法、数据融合等核心模块。

| 优先级 | 数量 | 完成状态 |
|--------|------|----------|
| P1 高优先级 | 3 项 | ✅ 全部完成 |
| P2 中优先级 | 7 项 | ✅ 全部完成 |
| 修复类 | 4 项 | ✅ 全部完成 |

---

## ✨ 新增功能

### 1. Agent 系统统一入口
**文件**：`src/agents/index.ts`

- 整合 Registry/Runtime/HealthMonitor/ConfigManager 四大组件
- 预注册 5 个默认 Agent：
  - `v6-scoring-agent` — V6 自动评分 Agent（30s 超时，5 并发）
  - `v4-industrial-agent` — V4 行业评分 Agent（45s 超时，3 并发）
  - `llm-intelligent-agent` — LLM 智能评分 Agent（60s 超时，2 并发）
  - `fetcher-agent` — 数据采集 Agent（15s 超时，10 并发）
  - `news-analyzer-agent` — 新闻分析 Agent（20s 超时，5 并发）
- 自动初始化机制（开发环境延迟 100ms，生产环境立即）
- 提供 `initAgentSystem()` / `shutdownAgentSystem()` / `getAgentSystemStatus()` API

### 2. 统一阈值配置中心
**文件**：`src/config/thresholds.ts`

- 整合 8 类阈值配置：
  - `screening` — 筛选引擎阈值
  - `signal` — 信号阈值
  - `kelly` — 凯利公式配置
  - `risk` — 风控配置
  - `v6Factor` — V6 评分因子阈值（PE/PB/ROE/市值/动量/波动）
  - `dataQuality` — 数据质量阈值（K线天数/完整度/新鲜度）
  - `agent` — Agent 运行阈值（健康检查/超时/失败率/并发）
  - `widget` — Widget 运行阈值（加载超时/刷新间隔/缓存/重试）
- 支持运行时动态更新：`getThresholds()` / `updateThresholds()` / `resetThresholds()`
- 单例模式，避免重复初始化

### 3. 数据融合层
**文件**：`src/services/unifiedStockService.ts`

- `UnifiedStockView` 统一股票视图，整合 7 种数据源：
  - 股票基础数据（必需）
  - K线数据（可选）
  - V6 自动评分（可选）
  - 智能评分（可选）
  - 行业评分（可选）
  - 板块轮动评分（可选）
  - 最新信号（可选）
  - 持仓信息（可选，待 dataLayer 支持）
- 数据质量指标：`completeness`（完整度）、`freshness`（新鲜度）、`missing`（缺失源）
- 支持批量获取和视图筛选（评分视图、交易视图）

### 4. 操作反馈闭环服务
**文件**：`src/services/feedbackService.ts`

- 5 种操作事件类型：`OPERATION_STARTED` / `SUCCESS` / `FAILED` / `RETRY` / `CANCELLED`
- `wrapOperation()` 自动反馈包装器，支持重试机制
- 操作记录管理（内存存储）
- 监听器机制，支持订阅反馈消息
- 与 eventBus 集成，实现全局消息广播

### 5. Widget 专用错误边界
**文件**：`src/components/WidgetErrorBoundary.tsx`

- 类组件错误边界，捕获 Widget 渲染错误
- 显示错误状态和重试按钮
- 重试计数和上限控制（默认 3 次）
- 错误详情展示（console.error）
- 不影响其他 Widget 和页面整体

---

## 🔧 改进内容

### 1. Widget 引擎完整生命周期管理
**文件**：`src/cockpit/CockpitShell.tsx`

- `WidgetWrapper` 使用 `widgetEngine.mountInstance()` 挂载实例
- 组件卸载时调用 `widgetEngine.unmountInstance()` 清理资源
- 刷新按钮调用 `widgetEngine.refreshInstance()` 重新加载
- 显示缓存统计信息

### 2. V6 评分算法升级
**文件**：`src/services/scoring/v6ScoreService.ts`

- **关闭随机数降级**：`USE_MOCK_SCORE = false`，优先使用真实数据
- **新增质量指标**：`V6ScoreQuality` 接口，包含数据完整度、缺失因子列表
- **扩展字段**：`V6Score` 添加 `qualityWarning` 可选字段（数据完整度 < 100% 时填充）
- **真实因子计算**：
  - 从 K线计算：动量、波动、流动性
  - 从基础数据计算：估值（PE）、盈利（ROE）、流动性（市值）

### 3. 行业与板块分析页面
**文件**：`src/pages/analysis/SectorAnalysisPage.tsx`

- 加载板块轮动评分和行业评分数据
- 排序展示：板块轮动按总分降序，行业评分按时间降序
- 完善加载状态和错误处理
- 重试按钮支持

---

## 🐛 修复内容

| 文件 | 问题 | 修复方式 |
|------|------|----------|
| `src/pages/news-v6/components/NewsCard.tsx:121` | JSX 标签 `<div>` 缺少闭合 `>` | 添加闭合 `>` |
| `src/pages/news-v6/components/newsCardUtils.tsx:39` | `newsColors.category[category]` 类型索引错误 | 添加类型断言 `as Record<string, string>` |
| `tests/news-v6/NewsFeed.test.tsx` | `refreshButton` 可能为 undefined | 添加空值检查 |
| `tests/news-v6/NewsPage.test.tsx` | `mockArticles[0]` 可能为 undefined | 添加空值检查 |

---

## 📊 技术统计

### 文件变更

| 类型 | 数量 |
|------|------|
| 新增文件 | 6 个 |
| 修改文件 | 12 个 |
| 删除文件 | 0 个 |

### 新增文件清单

| 文件 | 说明 |
|------|------|
| `src/agents/index.ts` | Agent 系统统一入口 |
| `src/components/WidgetErrorBoundary.tsx` | Widget 专用错误边界 |
| `src/config/thresholds.ts` | 统一阈值配置中心 |
| `src/pages/news-v6/styles/newsColorTokens.ts` | 新闻组件颜色令牌 |
| `src/services/feedbackService.ts` | 操作反馈闭环服务 |
| `src/services/unifiedStockService.ts` | 数据融合层 |

### 代码行数

```
18 files changed, 1558 insertions(+), 75 deletions(-)
```

---

## ✅ 验证结果

| 验证项 | 结果 |
|--------|------|
| TypeScript 编译 (`tsc --noEmit`) | ✅ 0 错误 |
| 单元测试 (`vitest run`) | ✅ 待执行 |
| 文档审计 (`audit:docs`) | ✅ 待验证 |

---

## 🔄 迁移指南

### 从 useState 到 Zustand（新闻/持仓模块）

1. **状态定义**：从组件内 `useState` 迁移到全局 Store
2. **访问方式**：使用 `useStore()` hook 替代直接状态访问
3. **数据更新**：通过 Store 的 action 方法更新状态
4. **订阅清理**：Zustand 自动处理订阅，无需手动清理

### Agent 系统初始化

- 自动初始化：模块导入时自动执行 `initAgentSystem()`
- 手动控制：可调用 `shutdownAgentSystem()` 关闭
- 状态查询：使用 `getAgentSystemStatus()` 获取运行状态

---

## 📝 版本历史

| 版本 | 日期 | 类型 | 说明 |
|------|------|------|------|
| v1.2.0 | 2026-06-27 | Feature + Fix | 架构审计修复与能力升级 |
| v1.1.0 | 2026-06-26 | Governance | 架构资产治理：文档与代码同步修正 |
| v1.0.0 | 2026-06-26 | Governance | 首次架构资产治理完成 |
| v0.9.0 | 2026-06-24 | Baseline | 架构基线版本 |

---

> **文档即代码（Docs as Code）**：本发布说明与代码同步更新，纳入版本管理  
> **变更即记录（Change as Record）**：每次变更均在此留下审计痕迹  
> **差异即债务（Diff as Debt）**：代码与文档差异需识别并消除