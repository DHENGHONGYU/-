# RLES 复盘启动评价体系 — 代码落地交付说明

> 对应设计文档：`deliverables/strategy-consolidated-and-reviewlaunch-evaluation.md`
> 落地日期：2026-08-16 | 状态：骨架版（D1/D2/D4 可运行，D3 部分运行，预留增强接口）

## 已落地文件

| 文件 | 类型 | 作用 |
|------|------|------|
| `src/services/scoring/rles-engine/reviewLaunchEvaluator.ts` | 新建 | RLES 纯函数评分引擎（D1-D4 + 总分 + 三级分流 + 风险降级） |
| `src/store/reviewLaunchStore.ts` | 新建 | zustand store：拉 V6 评分 → 组装 RlesInput → 调引擎 → 存结果 |
| `src/pages/analysis/ReviewLaunchPage.tsx` | 新建 | 复盘启动分析页面，复用 `ScoreRadar` / `GaugeChart` / `StockSelector` |
| `src/config/routes.ts` | 修改 | `ROUTE_REGISTRY` 新增 `/analysis/review-launch` |
| `src/apps/analysis/AnalysisApp.tsx` | 修改 | `ANALYSIS_ROUTES` 新增派发条目 + `React.lazy` 导入 |

## 评分模型（与设计文档一致）

```
RLES = (0.25·D2 + 0.40·D3 + 0.35·D4) × conf(D1)
conf(D1) = D1.score / 100   // D1 为置信乘子
```

| 维度 | 权重 | 骨架期计算口径 |
|------|------|----------------|
| **D1 数据就绪度** | ×conf（乘子） | v6Score 缺失→0；有 `qualityWarning`→70；正常→95 |
| **D2 策略适配度** | 0.25 | V6 归一化(0.7) + 板块景气 f1Jingqi(0.3，未映射时中性 50) |
| **D3 时机成熟度** | 0.40 | 评级基分(0.55) + 黄金买点(+10) + 板块资金 f2Zijin(0.25) + 二波/MAS 预留(0.1+0.1 中性) |
| **D4 风险健康度** | 0.35 | 100 − 风险惩罚（V6风险×12 + 硬风险×25 + 筹码风险 high=30/med=15） |

**风险降级**：命中 `hardRisks` 或 `allRisks` 含致命词（退市/ST/违规/处罚/立案）→ 总分 ×0.73，tier 降一级，打标"风险降级"。
**三级分流**：≥80 优先深度复盘 / 60–79 常规复盘 / <60 谨慎；**D1<60 强制谨慎**。

## 运行方式

- 路由：`/analysis/review-launch`（分析舱内）
- 交互：`StockSelector` 选标的 → 自动运行评估（或点"运行评估"按钮，store 调 `runV6Score` 取最新 V6 评分）
- 展示：`GaugeChart` 总分仪表 + tier 徽章 + 风险标签 + `ScoreRadar` 四维雷达 + 维度明细卡

## 骨架期范围与预留接口

- ✅ **已落地**：D1 / D2 / D4 全量；D3 的评级基分 + 黄金买点检测（`v6Score.rating === 'strong_buy'`）
- ⏳ **预留（RlesInput 字段已开，引擎自动中性降级，不影响首版运行）**：
  - `rotationScore`：股票→板块映射接入后填 `f1Jingqi`/`f2Zijin`
  - `chip`：`evaluateChip(input)` 八级筹码风险（`PAS`/`BIAS`/`PRO` → `riskLevel`）
  - `secondWaveSignal`：主升浪二波检测器（`secondWaveDetector`，对标"分级回踩 v3.2"）
  - `marketBreadth`：MAS 市场宽度因子（`breadthFactor`）
  - `hardRisks`：三条禁令命中标签（V9 既有风险约束）

## 门禁

- 全量 `npx tsc --noEmit` 通过：新增/修改 5 文件**零类型错误**（页面组件对 `ScoreRadar`/`GaugeChart`/`StockSelector` 的 props 调用均通过类型检查）。

## 后续接入优先级

1. **P1** `secondWaveDetector`（主升浪+分级回踩）→ 接入 `secondWaveSignal`，激活 D3 的二波因子
2. **P1** `breadthFactor`（MAS 市场宽度）→ 接入 `marketBreadth`
3. **P2** 股票→板块映射 → 接入 `rotationScore`，激活 D2/D3 板块增强
4. **P2** `evaluateChip` → 接入 `chip`，激活 D4 筹码风险
5. **P2** 三条禁令 → 接入 `hardRisks`，激活风险降级硬约束
