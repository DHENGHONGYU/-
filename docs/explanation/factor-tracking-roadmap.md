---
title: 因子提炼、扩容与追踪路径分析
type: explanation
domain: backend
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 智能评分系统的核心竞争力在于自提炼的评分因子与维度，而非直接照搬 V6/F 技能。V6/F 技能仅作为参考输入与校验基准，最终因子体系、权重、评分口径由 V9 业务自行定义并持续迭代。"
tags: [backend, factor, plan, explanation, service, api, strategy]
version: v0.9.0
last_updated: 2026-06-24
code_version: 2.0.0
doc_id: V9-DOC-BACK-007
change_log: 
---

# 因子提炼、扩容与追踪路径分析

> **Status**: Current  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24

## 核心定位

V9 智能评分系统的核心竞争力在于**自提炼的评分因子与维度**，而非直接照搬 V6/F 技能。V6/F 技能仅作为参考输入与校验基准，最终因子体系、权重、评分口径由 V9 业务自行定义并持续迭代。

当前因子配置集中管理在：
- `src/config/scoreFactors.ts`
  - `STOCK_SCORE_FACTORS`：V6 个股智能评分九维因子
  - `INDUSTRY_SCORE_FACTORS`：V4 行业评分七维因子

## 当前因子体系（v1.0.0）

### V6 个股九维
| 因子 | 权重 | 关键取数 |
|---|---|---|
| 估值 | 1 | pe / pb / PEG |
| 成长 | 1 | 营收增速 / 第二曲线 |
| 盈利 | 1 | roe / 经营现金流 |
| 质量 | 1 | 资产负债表 / 治理 |
| 动量 | 1 | 价格趋势 / 相对强度 |
| 波动 | 1 | 回撤 / 融资余额 |
| 流动性 | 1 | 市值 / 成交量 |
| 行业 | 1 | 行业景气度 / 政策 |
| 情绪 | 1 | 资金流向 / Hype |

### V4 行业七维
| 因子 | 权重 | 关键取数 |
|---|---|---|
| 政策契合度 | 1 | SKILL planAlignment |
| 稀缺性 | 1 | SKILL-C structuralScarcity |
| 国产替代空间 | 1 | SKILL-C localizationBarrier |
| 技术先进性 | 1 | SKILL-C techAdvancement |
| 行业景气度 | 1 | SKILL-N downstream |
| 估值吸引力 | 1 | SKILL-N fundValuation |
| 情绪热度 | 1 | SKILL-N rotationSignal |

## 因子精准度优化路径

### Phase 1：因子可配置化（已完成）
- 将因子名称、权重、定义、数据来源集中到 `scoreFactors.ts`。
- 评分服务从配置读取维度，避免代码硬编码。
- 支持通过 `enabled` 开关快速启用/禁用实验因子。

### Phase 2：权重调优实验
- **目标**：不同因子对最终收益的贡献度不同，需通过历史回测确定最优权重。
- **实现**：
  1. 在 `scoreFactors.ts` 中新增 `weight` 字段，当前均为 1（等权）。
  2. 新增 `src/services/scoring/v6-engine/engine.ts`：
     - 读取历史评分记录 `intelligent_scores` / `industry_scores`。
     - 与后续真实价格/行业指数走势做回归或 IC 分析。
     - 输出推荐权重矩阵。
  3. 页面提供“权重实验”模式，可对比等权 vs 优化权重的综合分差异。

### Phase 3：因子版本与 A/B 测试
- **目标**：避免因子调整导致评分体系不可追溯。
- **实现**：
  1. `ScoreFactorSet.version` 每次因子/权重调整时递增。
  2. 每次评分记录同时保存 `factorVersion` 与 `factorWeights` 快照。
  3. 支持按版本筛选历史记录，进行跨版本评分可比性分析。
  4. 新增 A/B 实验：对同一标的用两套因子版本同时评分，观察差异。

### Phase 4：因子漂移监控
- **目标**：发现因子失效或市场环境变化导致的评分失真。
- **实现**：
  1. 在 `src/services/scoring/rotationSignalDetector.ts` 中计算：
     - 单个因子得分分布的滚动均值/方差。
     - 因子间相关性矩阵变化。
     - 综合分与未来收益 IC 值的滚动衰减。
  2. 当某因子 IC 连续 4 周为负或方差显著放大时，标红提醒并建议复评。
  3. 页面“核心观察值”区展示因子漂移警报。

### Phase 5：人机协同反馈闭环
- **目标**：将研究员的主观判断量化反馈到因子权重。
- **实现**：
  1. 页面提供“因子反馈”按钮：研究员可对单次评分的某一维度打分“高估/低估”。
  2. 反馈数据存入 `factor_feedback` store。
  3. 定期（每周）汇总反馈，通过贝叶斯更新或简单加权调整因子权重。
  4. 更新后的权重生成新的 `ScoreFactorSet.version`。

## 因子扩容路径

### 新增因子步骤
1. **定义因子**：在 `scoreFactors.ts` 对应 `ScoreFactorSet` 中新增一条记录，填写 `key`、`name`、`weight`、`description`、`dataSources`、`skillMapping`。
2. **补充取数**：
   - 若因子依赖新的基础数据字段，扩展 `Stock` / `SectorSkillAnalysis` 类型并在录入/采集环节补全。
   - 若依赖外部 API，新增 `src/services/data-collector/MarketDataAdapter.ts`。
3. **更新 Prompt**：在对应 Skill TS 文件中说明新因子的评分口径，确保 LLM 输出包含该维度。
4. **更新测试**：在 `tests/intelligentScore.test.ts` 或 `tests/industryScore.test.ts` 中补充新因子的解析与权重计算用例。
5. **灰度启用**：先将 `enabled` 设为 `false`，通过 A/B 实验验证后再开启。

### 建议后续扩容方向
- **个股**：加入 ESG、机构持仓变化、筹码变化度（V6 L8 v4.1）、业绩兑现临界点（OCR/MCE/TIMS）。
- **行业**：加入全球产业链地位、地缘政治风险、技术路线收敛度、龙头集中度 CR5。

## 版本化与追踪机制

- 每条评分记录保存：
  - `factorVersion`：因子配置版本。
  - `factorWeights`：本次评分实际使用的权重快照。
  - `dimensionScores`：各因子得分与依据。
- 版本日志表展示：
  - 综合分 Δ、最大变化因子、因子版本变化。
- 未来可接入 `factorOptimizationService` 自动生成权重调整建议。

## 下一步建议

1. 尽快落地 Phase 2 的 `factorOptimizationService` 最小原型：用已有历史评分 + 手动输入的未来收益率做 IC 回测。
2. 在 V6/V4 评分页增加“因子版本”与“权重快照”展示。
3. 收集 2-4 周评分数据后启动 Phase 3 A/B 实验。
