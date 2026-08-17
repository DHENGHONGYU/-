---
doc_id: V9-DOC-EXP-932
title: "V6 Pro UI 模块新旧比对与 V9 吸收报告"
domain: exp
status: active
last_updated: 2026-08-15
---

# V6 Pro UI 模块新旧比对与 V9 吸收报告

> **Status: Future Reference / Deferred**  
> 本文档为外部参考蓝图，仅用于与 V9 当前 UI 体系对齐参考，禁止直接作为当前 V9 代码依据。任何落地须先经过 ADR 评审并更新 `docs/01~10` 规格。

> 将 `C:\Users\huawei\Desktop\智能股票系统测试测试\ui_module_comparison.md` 的界面功能模块比对结论与 V9 当前 UI 体系校对，明确哪些模式/组件应纳入 V9，哪些应保持现状或暂缓。

---

## 1. 可直接吸收的 UI 模式

### 1.1 舱室边界感知

| V6 Pro 模式 | V9 现状 | 吸收建议 |
|-------------|---------|----------|
| 三舱硬隔离 + 色调区分（研究冷色/交易暖色/系统深色） | 五舱深色经典布局 | 保留五舱结构，但为交易舱增加暖色视觉提示，为系统舱保持深色 |
| 回路横幅 + 舱室锁定机制 | 无 | P2 在总控舱/PortalShell 顶部增加系统状态横幅（采集/评分/回路状态） |
| 3px 实色分割线隔离研究/交易 | 当前使用统一背景 | P1 在交易舱与分析舱之间切换时，通过过渡动画/边框色强化边界 |

### 1.2 输入/采集侧

| V6 Pro 模式 | V9 现状 | 吸收建议 |
|-------------|---------|----------|
| 简洁采集卡片（代码 + 时间范围 + 完整性进度条） | `DataTestPanel` 已有健康检查与接口测试 | 在 `/input/data-test` 中增加「完整性进度条」与「清洗检查结果」 |
| 原始数据极简表格（6 字段） | `InputDashboard` 股票池卡片展示较多字段 | 在采集结果展示时使用精简表格，分析展示再用卡片 |
| 数据完整性 98% 阈值提示 | 无 | 在 `QualityIndicator` 中增加「完整性百分比」与阈值提示 |

### 1.3 分析展示侧

| V6 Pro 模式 | V9 现状 | 吸收建议 |
|-------------|---------|----------|
| 三维度独立展示（基本面/技术面/情绪面） | `StockAnalysisPage` 九维评分雷达图 | 保留九维评分，但在个股详情页增加「基本面/技术面/情绪面」分组标签 |
| 多空辩论区（Bull/Bear/共识/分歧） | 无 | P2 在分析舱新增 `DebaterPanel`，强制展示正反理由 |
| 评分卡片跨舱展示（研究舱 + 交易舱顶部） | 评分主要在分析舱 | P1 在 `TradingApp` 顶部展示当前选中/观察股票的 V6 评分摘要 |
| 技术面状态标签（中性/偏多/偏空） | 无 | 由 `signalGenerator` 输出状态标签，在分析/交易舱展示 |

### 1.4 交易操作侧

| V6 Pro 模式 | V9 现状 | 吸收建议 |
|-------------|---------|----------|
| 买卖观望三态按钮 | `TradingApp` 已有买入/卖出/扫描 | P1 改为「买入 / 卖出 / 观望」三态，观望时只生成信号不创建订单 |
| 强制引用评分维度的下单理由 | 无 | P1 在交易舱下单时要求理由必须引用评分维度 |
| 风控三态按钮（通过/否决/转人工） | `riskEngine` 返回阻塞/提示 | P1 在 `TradingApp` 底部增加 `RiskBanner` 三态展示 |
| 最终确认关卡（风控通过后执行按钮可用） | 当前直接下单 | P1 增加 `FinalConfirm` 组件，风控未通过时按钮置灰 |

### 1.5 系统/复盘侧

| V6 Pro 模式 | V9 现状 | 吸收建议 |
|-------------|---------|----------|
| 网关面板（Agent 状态网格 + 回路预算 + 裁决记录） | 无 | P2 在 `/command` 总控舱增加 `GatewayPanel` |
| 信号质量复盘（准确率/择时得分/最大回撤/Sharpe） | 交易复盘笔记待建 | P2 在输出舱/总控舱增加 `ReviewDrawer` |
| Markdown/PDF 报告生成 | 无 | P2 在 `/output` 增加 `ReportGenerator` |

---

## 2. 应保持现状的 UI 模式

| V6 Pro 变更 | V9 现状 | 保持理由 |
|-------------|---------|----------|
| 取消 Widget 驾驶舱 | V9 保留 `CockpitShell` | 驾驶舱作为系统级入口和快捷面板，符合 V9 用户需求 |
| 移除 K 线图/股票图表 | V9 分析舱保留图表 | 研究投资者需要图表进行技术和基本面分析 |
| 自然语言入口替代所有搜索/筛选 | V9 保留表单/搜索 | NL 入口学习成本高，当前用户更熟悉显式操作 |
| 三舱硬隔离取代五舱 | V9 五舱架构 | 五舱已拆分输入/分析/交易/输出/总控，更细致 |
| 取消股票池/选股器 Widget | V9 `PoolBoard` 已落地 | 股票池是 V9 核心工作流，不能由 NL 入口完全替代 |

---

## 3. 暂缓采纳的 UI 模式

| V6 Pro 模式 | 暂缓原因 |
|-------------|----------|
| 字体缩放控制 80%-140% | 无障碍增强，P3 再考虑 |
| 交易舱与系统舱的 3px 红色隔离线 | V9 当前为五舱统一主题，可在 P2 通过色调区分 |
| 强制 NLInputBox 作为唯一入口 | 当前表单/搜索已满足 P0/P1 需求 |
| Portfolio 模块完全独立 | V9 当前 `TradingApp` 已展示持仓/订单，P2 再拆分 |

---

## 4. V9 UI 组件新增清单（按优先级）

| 组件 | 路径 | 优先级 | 来源 |
|------|------|--------|------|
| `QualityIndicator` | `src/components/organisms/input/QualityIndicator.tsx` | P0 | 采集完整性进度条 |
| `RiskBanner` | `src/components/trading/RiskBanner.tsx` | P1 | V6 Pro 风控三态 |
| `FinalConfirm` | `src/components/trading/FinalConfirm.tsx` | P1 | V6 Pro 最终确认关卡 |
| `DebaterPanel` | `src/components/analysis/DebaterPanel.tsx` | P2 | V6 Pro 多空辩论 |
| `GatewayPanel` | `src/components/command/GatewayPanel.tsx` | P2 | V6 Pro 系统网关面板 |
| `ReviewDrawer` | `src/components/output/ReviewDrawer.tsx` | P2 | V6 Pro 信号质量复盘 |
| `ReportGenerator` | `src/services/hybrid-proofread/reportGenerator.ts` | P2 | V6 Pro 报告生成 |
| `LoopBanner` | `src/components/organisms/shared/LoopBanner.tsx` | P2 | V6 Pro 回路状态提示 |

---

## 5. 对 V9 文档的更新建议

1. **`../../../specs/04-ui-ux-specs.md`**：
   - 增加「舱室边界感知」章节，说明未来色调/锁定/回路横幅规划。
   - 增加「V6 Pro 可吸收组件清单」小节。

2. **`../../../guides/08-implementation-plan.md`**：
   - 将上述 UI 组件按 P0/P1/P2 拆分到对应 Phase 任务。

3. **`../../../specs/02-functional-specs.md`**：
   - 补充「多空辩论」、「报告生成」、「系统网关面板」用户故事。

---

## 6. 版本比对

| 版本 | 时间 | 变化 |
|------|------|------|
| v0.9.0-docs-base | 2026-06-24 前 | 未参考 V6 Pro UI 模块比对 |
| v0.9.0-docs-review | 2026-06-24 | 新增本文档，将 V6 Pro UI 模式分类为「直接吸收 / 保持现状 / 暂缓采纳」，并给出组件新增清单与文档更新建议 |
