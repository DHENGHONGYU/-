---
doc_id: V9-DOC-IMPL-001
title: 行业分析图表组件接入技术文档
date: 2026-08-20
status: active
type: implementation
tier: important
domain: analysis
related_docs:
  - V9-DOC-DATA-016
  - V9-DOC-RT-003
covers_code:
  - src/pages/analysis/IndustryDashboardPage.tsx
  - src/pages/analysis/IndustryScorePage.tsx
  - src/components/chart/industry/IndustryV4Radar.tsx
  - src/components/chart/industry/SubIndicatorBar.tsx
  - src/components/chart/industry/IndustryHeatmap.tsx
  - src/components/registry/organismRegistry.ts
tags:
  - industry
  - chart
  - integration
  - orphan-component-revival
---

# 行业分析图表组件接入技术文档

> **创建日期**: 2026-08-20
> **版本**: v1.0.0
> **作者**: AI Agent
> **状态**: ✅ 已完成

---

## 一、改动背景

### 1.1 问题识别

通过 `audit:deadcode` 脚本发现以下 **2 个孤儿组件**：

| 组件名 | 文件路径 | 代码行数 | 原 consumers |
|--------|----------|----------|--------------|
| `IndustryV4Radar` | `src/components/chart/industry/IndustryV4Radar.tsx` | ~280 行 | `['TBD - pending integration']` |
| `SubIndicatorBar` | `src/components/chart/industry/SubIndicatorBar.tsx` | ~200 行 | `['TBD - pending integration']` |

**根因**：这两个组件设计完成后从未接入生产页面，属于"半成品未集成"模式。

### 1.2 决策

**策略**：从"删除"改为"接入消费"

**理由**：
1. 组件代码质量高（memo、forwardRef、usePerfTrace）
2. 数据结构与行业评分体系（`IndustryV4AnalysisEnhanced`）一致
3. 与现有 `IndustryHeatmap` 形成互补的可视化维度
4. 避免功能浪费，提升用户对行业分析的深度洞察能力

---

## 二、接入方案设计

### 2.1 接入页面

| 页面 | 路由 | 接入方式 |
|------|------|----------|
| `IndustryDashboardPage` | `/analysis/industry-dashboard` | 新增"行业详情面板" |
| `IndustryScorePage` | `/analysis/industry-score` | 新增"评分可视化区块" |

### 2.2 交互设计

#### IndustryDashboardPage — 行业全景仪表盘增强

```
[热力图单元格点击选中]  ←→  [排序表行点击选中]
          ↓
+-------------------------------------------------------------+
| 行业分析详情：半导体设备（801081.SI）                       |
|-------------------+-----------------------------------------|
|                   |   综合评分  4.20   成分股数  47         |
|  V4 四维雷达图    |   景气度   4.10   完整度   96%          |
|  (vs 行业均值)    |   [四维度 rationale 总结]                |
|                   +-----------------------------------------+
|                   |   [景气度] [竞争格局] [政策] [技术]  Tab  |
+-------------------+----------各维度子指标柱状图--------------+
```

**交互流程**：
1. 页面加载 → 自动选中 TOP1 行业（按综合评分排序）
2. 热力图单元格点击 → 高亮选中 + 更新详情面板
3. 排序表行点击 → 高亮选中行 + 更新详情面板
4. 子指标 Tab 切换 → 切换景气度/竞争/政策/技术四个维度
5. 雷达图叠加行业均值基准线 → 直观对比

#### IndustryScorePage — 行业评分可视化补充

```
+-------------------------------------------------------------+
|  评分结果 · 医药商业 （综合分 3.87，较上次 +0.15）         |
|-------------------+-----------------------------------------|
|  7 维评分雷达图    |    各维度得分排序（垂直柱状图）          |
|  本次 vs 上次对比  |    政策契合度 4.2  稀缺性 3.9  ...      |
+-------------------+-----------------------------------------+
|  ↓ Progress 清单（含 rationale 文字说明）                    |
|  ↓ AI 总结                                                     |
|  ↓ ScoreFactorDeltaPanel                                     |
+-------------------------------------------------------------+
```

**交互流程**：
1. 评分完成后 → 自动渲染可视化区块
2. 雷达图对比本次 vs 上次评分 → 展示评分变化趋势
3. 柱状图各维度得分排序 → 快速识别强弱项

---

## 三、代码实现

### 3.1 文件变更清单

| # | 文件 | 改动类型 | 说明 |
|---|------|----------|------|
| 1 | `src/pages/analysis/IndustryDashboardPage.tsx` | **核心改动** | 新增行业详情面板（雷达图+子指标柱状图） |
| 2 | `src/pages/analysis/IndustryScorePage.tsx` | **核心改动** | 新增评分可视化区块 |
| 3 | `src/components/chart/industry/IndustryHeatmap.tsx` | **功能增强** | 新增 `highlightCode` prop（选中高亮） |
| 4 | `src/components/registry/organismRegistry.ts` | **注册同步** | consumers 更新为实际消费方 |
| 5 | `src/components/registry/registryContract.test.ts` | **契约更新** | RESERVED_INTERNAL 白名单清空 |

### 3.2 关键实现细节

#### IndustryDashboardPage 数据流

```typescript
// 状态管理
const [selectedIndustryCode, setSelectedIndustryCode] = useState<string | null>(null)
const [subDimTab, setSubDimTab] = useState<SubDimensionTab>('prosperity')

// 数据派生
const selectedAnalysis = useMemo(...)  // 当前选中行业分析结果
const avgScores = useMemo(...)         // 全行业各维度均值
const radarData = useMemo(...)         // 雷达图数据
const subIndicatorData = useMemo(...)  // 子指标柱状图数据
```

#### 数据转换函数

| 函数 | 用途 | 输入 → 输出 |
|------|------|-------------|
| `toRadarData()` | 行业分析 → 雷达图数据 | `IndustryV4AnalysisEnhanced` → `IndustryV4RadarDataItem[]` |
| `toRadarSeries()` | 生成雷达图系列配置 | `IndustryV4AnalysisEnhanced` → `IndustryV4RadarSeries[]` |
| `toSubIndicatorData()` | 行业分析 → 子指标柱状图 | `IndustryV4AnalysisEnhanced` + 维度 → `SubIndicatorBarDataItem[]` |

#### IndustryScorePage 数据转换

| 函数 | 用途 | 输入 → 输出 |
|------|------|-------------|
| `industryScoreToRadarData()` | 评分结果 → 雷达图数据（含上次对比） | `IndustryScore` + previous → `IndustryV4RadarDataItem[]` |
| `radarSeriesFromScore()` | 生成双系列配置（本次 vs 上次） | `IndustryScore` → `IndustryV4RadarSeries[]` |
| `industryScoreToSubIndicator()` | 各维度得分 → 柱状图数据 | `IndustryScore` → `SubIndicatorBarDataItem[]` |

### 3.3 新增 Props

#### IndustryHeatmap 新增 prop

```typescript
export interface IndustryHeatmapProps {
  // ... 原有 props
  highlightCode?: string  // 新增：高亮指定行业代码
}
```

**实现效果**：选中行业单元格增加 `box-shadow` 外发光效果

### 3.4 注册表同步

```typescript
// organismRegistry.ts
{
  name: 'IndustryV4Radar',
  consumers: ['IndustryDashboardPage', 'IndustryScorePage']  // 原：['TBD - pending integration']
},
{
  name: 'SubIndicatorBar',
  consumers: ['IndustryDashboardPage', 'IndustryScorePage']  // 原：['TBD - pending integration']
}
```

---

## 四、数据结构映射

### 4.1 IndustryV4AnalysisEnhanced → 雷达图

| 源字段 | 雷达图字段 | 说明 |
|--------|-----------|------|
| `dimensions.prosperity.score` | `score` (景气度) | 0-5 分 |
| `dimensions.competition.score` | `score` (竞争格局) | 0-5 分 |
| `dimensions.policy.score` | `score` (政策环境) | 0-5 分 |
| `dimensions.technology.score` | `score` (技术成熟度) | 0-5 分 |
| `v4Composite` | `score` (综合评分) | 0-5 分 |

### 4.2 IndustryScore → 雷达图

| 源字段 | 雷达图字段 | 说明 |
|--------|-----------|------|
| `dimensionScores[].name` | `dimension` / `label` | 7 维行业因子名 |
| `dimensionScores[].score` | `score` | 0-5 分 |
| `previous.dimensionScores[].score` | `prev`（叠加系列） | 上次评分对比 |
| `overallScore` | `score` (综合评分) | 0-5 分 |

### 4.3 子指标数据映射

**景气度维度子指标**：
- revenueGrowth（营收增速）
- profitGrowth（净利增速）
- grossMargin（毛利率）
- roe（ROE）
- capacityUtilization（产能利用）
- inventoryTurnoverDays（库存周转）
- 等 9 个子指标

**竞争格局维度子指标**：
- cr5（CR5 集中度）
- cr10（CR10 集中度）
- marginDispersion（毛利分化度）
- 等 6 个子指标

---

## 五、验证清单

### 5.1 自动化验证

| 验证项 | 命令 | 预期结果 | 实际结果 |
|--------|------|----------|----------|
| TypeScript 类型检查 | `npm run tsc:prod` | 0 错误 | ✅ 0 错误 |
| 死代码审计（增量） | `npm run audit:deadcode -- --staged` | 0 增量零引用 | ✅ 0 个 |
| 原子分层合规 | `npm run audit:atomic` | 0 阻断性违规 | ✅ 0 阻断 |
| 单元测试 | `npx vitest run` | 全部通过 | ✅ 7/7 通过 |

### 5.2 人工校验

| 校验项 | 方法 | 结果 |
|--------|------|------|
| 组件消费方检查 | Grep `import.*IndustryV4Radar` | ✅ IndustryDashboardPage + IndustryScorePage |
| 无 any 类型 | Grep `: any\b` in modified files | ✅ 0 处 |
| 路由注册验证 | 检查 routes.ts | ✅ `/analysis/industry-dashboard` + `/analysis/industry-score` |
| 侧边栏导航验证 | 检查 sidebarConfig.ts | ✅ 已注册导航项 |
| MCP 架构兼容 | 检查 analysisServer.ts | ✅ 已支持行业分析服务 |

### 5.3 视觉验证（需人工）

- [ ] 行业热力图单元格点击高亮效果
- [ ] 雷达图正确渲染（五维度）
- [ ] 子指标柱状图 Tab 切换流畅
- [ ] 排序表行点击选中高亮
- [ ] 雷达图均值基准线对比效果
- [ ] IndustryScorePage 双系列雷达图（本次 vs 上次）

---

## 六、影响范围

### 6.1 文件改动统计

| 类别 | 文件数 | 新增代码行数（估算） |
|------|--------|----------------------|
| 核心页面改动 | 2 | ~350 行 |
| 组件增强 | 1 | ~15 行 |
| 注册/契约同步 | 2 | ~5 行 |
| **合计** | **5** | **~370 行** |

### 6.2 无破坏性影响

- ✅ 未修改已有组件的 API
- ✅ 未移除任何功能
- ✅ 未修改数据模型
- ✅ 未影响现有路由
- ✅ MCP 架构无改动（仅消费已有服务）

### 6.3 测试覆盖

| 测试类型 | 覆盖情况 |
|----------|----------|
| 单元测试 | IndustryHeatmap ✅ (7 tests) |
| 集成测试 | 待补充（IndustryDashboardPage / IndustryScorePage） |
| E2E 测试 | 待补充 |

---

## 七、后续行动项

### 7.1 高优先级

- [ ] 补充 IndustryDashboardPage 集成测试
- [ ] 补充 IndustryScorePage 集成测试
- [ ] 验证真实数据环境下的图表渲染

### 7.2 中优先级

- [ ] 考虑为雷达图添加动画效果
- [ ] 考虑为子指标柱状图添加导出功能
- [ ] 监听用户反馈优化交互细节

### 7.3 低优先级

- [ ] 评估是否需要添加更多行业维度的子指标
- [ ] 考虑添加行业对比功能（跨行业雷达图对比）

---

## 八、相关资源

- [行业 V4 分析类型定义](file:///d:/FinSightV9/src/data/types/types.sector.ts)
- [组件注册表](file:///d:/FinSightV9/src/components/registry/organismRegistry.ts)
- [路由配置](file:///d:/FinSightV9/src/config/routes.ts)
- [侧边栏配置](file:///d:/FinSightV9/src/config/sidebarConfig.ts)
- [MCP 分析服务](file:///d:/FinSightV9/src/mcp/servers/analysis/analysisServer.ts)

---

## 九、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-08-20 | 初始版本：完成 IndustryV4Radar 和 SubIndicatorBar 接入 |
