---
title: analysis-screening-module-dev-plan
type: explanation
domain: backend
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "新增或改动模块必须按以下顺序执行，每步完成后需自检并输出检查点�?
tags: [backend, screening, analysis, plan, architecture, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-BACK-004
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 数据分析与筛选模块开发任务规划与 Agent 分配

> 角色：V9 数据分析与筛选模块开发负责人  
> **Date**�?026-07-01  
> 适用范围：DA-001 ~ DA-009 �?9 项任务，4 �?Agent 并行推进  
> 约束来源：《V9 目标功能清单》《V9 核心数据字典与类型定义（整合版）》《功能模块数据契约�?
---

## 一、模块总览

| 功能�?| 路由/位置 | 优先�?| 当前状�?| 核心缺口 |
|--------|-----------|--------|----------|----------|
| 分析�?Hub | `/analysis/hub` | 🔴 �?| �?已完�?| 缺分析模板快捷入�?|
| V4 行业评分 | `/analysis/industry-score` | 🔴 �?| �?Store 化完�?| 缺多周期趋势对比 |
| V6 个股评分 | `/analysis/stock-score` | 🔴 �?| �?Store 化完�?| 缺评分历史回�?|
| V6 智能评分 | `/analysis/intelligent-score` | 🔴 �?| �?Store 化完�?| 缺评分解释可视化 |
| 行业分析 | `/analysis/sector` | 🟡 �?| useState 管理 | 缺板块轮动热力图 |
| 策略回测 | `/analysis/backtest` | 🔴 �?| �?Phase 6 完成 | 缺回测报告导�?|
| 评分文档 | `/analysis/score-docs` | 🟢 �?| �?已完�?| �?|
| 智能资讯 | `/analysis/news` | 🟡 �?| useState 管理 | 缺资讯情感趋�?|
| 多因子筛选器 | �?| 🟡 �?| �?未开�?| 无多因子组合筛�?|

---

## 二、任务清单与依赖

| 任务 ID | 任务名称 | 功能描述 | 预计工时 | 依赖 |
|---------|----------|----------|----------|------|
| DA-001 | 多周期评分趋势对�?| 行业评分/V6 评分支持�?�?季度多周期切换与趋势�?| 6h | `analysisStore` |
| DA-002 | 评分历史回溯面板 | 个股评分历史版本列表，支持版本差异对比（diff�?| 8h | `scoreDocService` |
| DA-003 | 智能评分解释可视�?| LLM 评分依据的思维链可视化展示（雷达图+关键因子高亮�?| 10h | `intelligentScoreService` |
| DA-004 | 板块轮动热力�?| 行业板块涨跌幅热力图（类�?SectorHeatmapWidget 风格�?| 6h | `sectorScoreService` |
| DA-005 | 分析模板快捷入口 | 分析�?Hub 新增预设分析模板（快速评�?行业对比/回测向导�?| 4h | �?|
| DA-006 | 回测报告导出 | 支持 PDF/Excel 格式导出回测结果 | 8h | `backtestStore` |
| DA-007 | 多因子筛选器增强 | 支持 PE/PB/ROE/市值等多因子组合筛选，保存筛选模�?| 10h | `screeningEngine` |
| DA-008 | 资讯情感趋势 | 智能资讯页新增情感趋势图（正�?中�?负面占比变化�?| 6h | `newsStore` |
| DA-009 | 评分因子贡献分析 | 展示各因子对综合评分的贡献度（瀑布图） | 6h | `analysisStore` |

---

## 三、Agent 集群分配

| Agent | 负责任务 | 并行策略 | 关键约束 |
|-------|----------|----------|----------|
| **Agent-A（评�?UI�?* | DA-001 + DA-002 + DA-003 | �?Agent-B 并行 | 必须复用 `analysisStore`/`scoreDocService`/`intelligentScoreService`，禁止跨层调�?LLM 客户�?|
| **Agent-B（分�?UI�?* | DA-004 + DA-005 + DA-007 | �?Agent-A 并行 | `DA-007` 为新增模块，必须严格遵循四步集成合约；`DA-004` 参�?`SectorHeatmapWidget` 风格 |
| **Agent-C（回�?资讯�?* | DA-006 + DA-008 | 独立并行 | 导出功能优先走前端生成（PDF/Excel），回测数据�?`backtestStore` 获取；情感趋势从 `newsStore` 获取 |
| **Agent-D（因子分析）** | DA-009 | 独立并行 | 瀑布图计算必须来�?V6ScoreEngine �?`audit` 输出，禁止硬编码权重 |

---

## 四、全局开发规范（所�?Agent 必须遵守�?
### 4.1 四步集成合约

新增或改动模块必须按以下顺序执行，每步完成后需自检并输出检查点�?
1. **类型定义** �?src/types/modules/[module].types.ts + 数据字典 Markdown 更新
2. **Store �?* �?src/store/[module]Store.ts（Zustand�?3. **Builder �?* �?src/services/[module]/[module]Service.ts / [module]Engine.ts
4. **核心集成** �?页面/组件/路由/Widget 注册，补�?loading/error/empty 三�?
### 4.2 禁止事项

- 严禁直接�?`/views` 目录下新�?`.vue` �?`.tsx` 文件并孤立运行�?- 严禁 UI 层直接读�?`dataLayer`，必须通过 Store �?DataBridge�?- 严禁在组件中硬编码数字、字符串、颜色值，必须引用 `constants/` �?`config/`�?- 严禁 L4 应用层直接调�?L6 LLM 客户端，必须路由通过 L3 services�?- 严禁未清理的事件监听器（所�?`useEffect` 必须返回 cleanup 函数）�?- 严禁缺失 `isLoading` / `isError` / `isEmpty` 三态处理�?
### 4.3 必须事项

- 所有数据接口必须先定义 TypeScript Interface，再写实现�?- 所�?Page 组件必须处理 `isLoading` 状态，防止界面无响应�?- 所有核心分支必须打�?`logger.info('[模块名] 具体分支描述')`�?- 所�?LLM 增强因子必须暴露用户开关，并在结果中标注“LLM 增强/自动计算”�?- 所�?LLM API Key 必须使用 `localStorageManager.setEncrypted/getEncrypted` 存储�?- 所�?LLM 输出渲染前必须经�?`sanitizeLlmOutput` 处理�?- 引擎计算所有阈值、权重、公式参数必须从 `config/` 注入，零硬编码�?- 引擎必须支持 `Backtestable` 接口�?`OfflineMode`，并支持 `AuditTrail` 全链路审计�?
### 4.4 质量门禁

每个 Agent 提交前必须通过�?
| 门禁 | 检查命�?| 目标 |
|------|----------|------|
| TypeScript 类型检�?| `npx tsc --noEmit` | 0 errors |
| ESLint 规范 | `npx eslint src/` | 0 warnings |
| 生产构建 | `npx vite build` | 成功 |
| 单元测试 | `npx vitest run` | 相关测试通过 |
| 硬编码审�?| `npx tsx scripts/audit-hardcode.ts` | 0 P0 |

---

## 五、分 Agent 启动指令

以下指令可直接复制给对应 Agent 执行�?
---

### Agent-A（评�?UI）启动指�?
【角色】V9 数据分析与筛选模块开发负责人

【任务】根�?DA-001 ~ DA-009 任务清单，启�?**DA-001、DA-002、DA-003** 的开�?
【任务信息�?
#### DA-001 多周期评分趋势对�?- 任务 ID：DA-001
- 任务名称：多周期评分趋势对比
- 功能描述：为 `/analysis/industry-score`（V4 行业评分）和 `/analysis/stock-score`（V6 个股评分）增加周/�?季度多周期切换能力，并在评分页展示趋势图（折线图/面积图）。趋势数据需�?`analysisStore` 按周期聚合，支持不同周期间的评分波动高亮�?
#### DA-002 评分历史回溯面板
- 任务 ID：DA-002
- 任务名称：评分历史回溯面�?- 功能描述：在 `/analysis/stock-score` 增加“历史版本”抽�?面板，列出个股评分的历史快照（按时间倒序），支持选择两个版本进行 diff 对比，展示评分总分、各因子分、评级的变化�?
#### DA-003 智能评分解释可视�?- 任务 ID：DA-003
- 任务名称：智能评分解释可视化
- 功能描述：在 `/analysis/intelligent-score` 展示 LLM 评分依据的思维链。使用雷达图展示各维度得分，关键贡献因子高亮，并提供“展开思维链”按钮查�?LLM 推理过程（需�?`sanitizeLlmOutput` 处理）�?
【数据依赖�?- 参考《V9 核心数据字典与类型定义（整合版）》P0-3 核心评分实体
- 参考《功能模块数据契约》第 1-3 节（评分模块�?- 参�?`src/store/analysisStore.ts`、`src/store/scoreDocStore.ts`（如存在�?- 参�?`src/services/scoring/intelligentScoreService.ts`
- 参�?`src/cockpit/widgets/SectorHeatmapWidget.tsx` 作为可视化风格参�?
【输出�?1. 完整代码实现（类�?�?Store 改动 �?Service/Engine 改动 �?UI 组件 �?路由/Widget 注册�?2. 单元测试（至少覆盖周期聚合逻辑、diff 计算、雷达图数据映射�?3. 更新后的数据字典（Markdown�?
【执行顺序�?1. DA-001（影响面最小，先验证多周期数据流）
2. DA-002（依赖评分快照数据结构）
3. DA-003（依�?LLM 解释数据，最后做�?
---

### Agent-B（分�?UI）启动指�?
【角色】V9 数据分析与筛选模块开发负责人

【任务】根�?DA-001 ~ DA-009 任务清单，启�?**DA-004、DA-005、DA-007** 的开�?
【任务信息�?
#### DA-004 板块轮动热力�?- 任务 ID：DA-004
- 任务名称：板块轮动热力图
- 功能描述：在 `/analysis/sector` 增加行业板块涨跌幅热力图，参�?`SectorHeatmapWidget` 的视觉风格。支持按�?�?月切换时间窗口，支持按涨跌幅/成交�?资金流向着色，支持点击板块下钻到行业评分页�?
#### DA-005 分析模板快捷入口
- 任务 ID：DA-005
- 任务名称：分析模板快捷入�?- 功能描述：在 `/analysis/hub` 新增预设分析模板卡片区域，至少包含：快速评分、行业对比、回测向导。点击后跳转对应页面并预填默认参数�?
#### DA-007 多因子筛选器增强
- 任务 ID：DA-007
- 任务名称：多因子筛选器增强
- 功能描述：从零搭建多因子组合筛选器（可通过独立路由 `/screening/multi-factor` 或分析舱子页面承载）。支�?PE/PB/ROE/市�?营收增�?净利润增速等因子组合，支持“且/或”条件组，支持保�?加载筛选模板，支持结果导出 CSV�?
【数据依赖�?- 参考《V9 核心数据字典与类型定义（整合版）》P0-3 核心评分实体
- 参考《功能模块数据契约》第 1-3 节（评分模块�?- 参考《功能模块数据契约》第 9 节（DualStrategyStore�?- 参�?`src/services/scoring/industryScoreService.ts`
- 参�?`src/cockpit/widgets/SectorHeatmapWidget.tsx`
- 参�?`src/store/multiFactorScreeningStore.ts`（如存在）或新建 `src/store/multiFactorScreeningStore.ts`

【输出�?1. 完整代码实现（DA-007 必须严格按四步集成合约：类型 �?Store �?Builder �?UI�?2. 单元测试（热力图数据映射、模板序列化/反序列化、筛选引擎逻辑�?3. 更新后的数据字典

【执行顺序�?1. DA-005（Hub 页改动最小，先交付）
2. DA-004（热力图需�?`sectorScoreService` 集成�?3. DA-007（新模块，最后按四步合约完整搭建�?
---

### Agent-C（回�?资讯）启动指�?
【角色】V9 数据分析与筛选模块开发负责人

【任务】根�?DA-001 ~ DA-009 任务清单，启�?**DA-006、DA-008** 的开�?
【任务信息�?
#### DA-006 回测报告导出
- 任务 ID：DA-006
- 任务名称：回测报告导�?- 功能描述：在 `/analysis/backtest` 增加导出按钮，支持将回测结果导出�?PDF（摘要页+收益曲线+交易明细）和 Excel（多 Sheet：摘要、持仓、交易记录、净值序列）。导出数据完全来�?`backtestStore`，禁止在导出逻辑中重复计算回测结果�?
#### DA-008 资讯情感趋势
- 任务 ID：DA-008
- 任务名称：资讯情感趋�?- 功能描述：在 `/analysis/news` 新增情感趋势图，展示正面/中�?负面资讯占比随时间变化（堆叠面积图或柱状图）。数据来�?`newsStore`，支持按股票/行业/全局维度切换�?
【数据依赖�?- 参考《V9 核心数据字典与类型定义（整合版）》P0-3 核心评分实体
- 参考《功能模块数据契约》第 1-3 节（评分模块�?- 参�?`src/store/backtestStore.ts`
- 参�?`src/store/analysisNewsStore.ts`
- 参�?`src/store/backtestStore.ts`

【输出�?1. 完整代码实现（导出服务可放在 `src/services/export/` 下；情感趋势组件放在 `src/components/organisms/news/`�?2. 单元测试（导出数据结构转换、情感聚合逻辑、文件生成校验）
3. 更新后的数据字典

【执行顺序�?1. DA-008（数据流简单，先验证）
2. DA-006（依赖导出库，最后做�?
---

### Agent-D（因子分析）启动指令

【角色】V9 数据分析与筛选模块开发负责人

【任务】根�?DA-001 ~ DA-009 任务清单，启�?**DA-009** 的开�?
【任务信息�?
#### DA-009 评分因子贡献分析
- 任务 ID：DA-009
- 任务名称：评分因子贡献分�?- 功能描述：在 `/analysis/stock-score` �?`/analysis/intelligent-score` 新增“因子贡献”标签页，使用瀑布图展示各评分因子对综合评分的正向/负向贡献。贡献值必须由 `V6ScoreEngine` �?`audit` 输出计算，禁止硬编码任何权重或阈值�?
【数据依赖�?- 参考《V9 核心数据字典与类型定义（整合版）》P0-3 核心评分实体
- 参考《功能模块数据契约》第 1-3 节（评分模块�?- 参�?`src/services/scoring/v6-engine/engine.ts` �?`src/services/scoring/v6-engine/engine.ts`
- 参�?`src/services/scoring/v6-engine/config.ts` �?`src/services/scoring/v6-engine/config.ts`

【输出�?1. 完整代码实现（优先扩�?`V6ScoreEngine.audit()` 输出贡献明细；新增瀑布图组件）
2. 单元测试（贡献度计算、边界值处理、零权重因子处理�?3. 更新后的数据字典

---

## 六、并行执行与验收节奏

```
Phase 1: Agent-A / Agent-B / Agent-C / Agent-D 同步启动（本指令下发即启动）
Phase 2: �?Agent 按内部执行顺序完成代码、测试、数据字�?Phase 3: �?Agent 自检通过质量门禁（tsc / eslint / build / vitest / audit-hardcode�?Phase 4: 汇总交付物，进入五层逆向质量审计（UI �?Store �?DataBridge �?Logic �?Integration�?Phase 5: 按批次修�?P0/P1/P2 问题
```

### 6.1 同步�?
| 同步�?| 触发条件 | 协调内容 |
|--------|----------|----------|
| S1 | Agent-A DA-001 完成�?| 确认 `analysisStore` 多周期数据结构是否影�?Agent-D 的因子贡献计�?|
| S2 | Agent-B DA-007 类型定义完成�?| 确认多因子筛选器类型是否与评分模块类型兼�?|
| S3 | Agent-D 完成�?| 确认瀑布图组件可�?Agent-A 的智能评分页复用 |
| S4 | 全部 Agent 完成�?| 统一运行全量质量门禁与五层审�?|

### 6.2 验收清单

每个 Agent 交付时必须勾选：

- [ ] 所有新�?修改文件已提�?- [ ] `npx tsc --noEmit` 通过
- [ ] `npx eslint src/` 通过
- [ ] `npx vite build` 成功
- [ ] 新增/修改单元测试通过
- [ ] 数据字典已同步更�?- [ ] �?P0 级硬编码、跨层调用、内存泄漏风�?- [ ] 页面三态（loading/error/empty）已处理

---

## 七、预期交付物清单

| 交付�?| 责任�?| 位置/命名建议 |
|--------|--------|---------------|
| 多周期趋势组�?| Agent-A | `src/components/organisms/analysis/score/MultiPeriodTrendChart.tsx` |
| 评分历史回溯面板 | Agent-A | `src/components/organisms/analysis/score/ScoreHistoryPanel.tsx` |
| 智能评分解释面板 | Agent-A | `src/components/organisms/analysis/score/IntelligentScoreExplanation.tsx` |
| 板块轮动热力�?| Agent-B | `src/components/organisms/analysis/sector/SectorRotationHeatmap.tsx` |
| 分析模板快捷入口 | Agent-B | `src/components/organisms/analysis/hub/AnalysisTemplateCards.tsx` |
| 多因子筛选器 | Agent-B | `src/types/modules/screening.types.ts` / `src/store/multiFactorScreeningStore.ts` / `src/services/analysis/screeningEngine.ts` / `src/pages/analysis/MultiFactorFilterPage.tsx` |
| 回测导出服务 | Agent-C | `src/services/export/backtestExportService.ts` |
| 情感趋势�?| Agent-C | `src/components/organisms/analysis/news/NewsSentimentTrend.tsx` |
| 因子贡献瀑布�?| Agent-D | `src/services/scoring/v6-engine/factorContributions.ts` |
| 更新后数据字�?| 全部 Agent | `../../reference/data-dictionary-index.md` 及相关模块字�?|

---

## 八、风险提�?
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Agent-A �?Agent-D 同时修改评分相关 Store | 合并冲突 | S1 同步点确认数据结构；优先�?Agent-A 扩展 Store，Agent-D 只读消费 |
| DA-007 新模块范围大，可能超�?| 10h 预估偏紧 | 拆分为“类�?Store+引擎”和“UI+路由+测试”两个子批次 |
| 导出功能依赖第三方库（如 jsPDF/xlsx�?| 构建体积增大 | 使用动态导�?`import()`，仅在导出时加载 |
| LLM 解释可视化涉�?XSS 风险 | 安全漏洞 | 必须�?`sanitizeLlmOutput` 处理后再渲染 |
| 多周�?历史版本数据量大 | 性能下降 | 前端分页 + LRU 缓存（DataBridge memoryCache 10s TTL / 200 entries�?|

---

*本规划遵�?V9 四步集成合约与五层追溯标准，所�?Agent 必须在代码、测试、文档三个维度同步交付�?
