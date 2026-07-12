# 智能投研评分 Skill（V6 个股智能评分）

## 版本

v1.0.0 — 2026-06-24

## 适用范围

V9 智能投研系统 · V6 个股智能评分页面（`/analysis/intelligent-score`）。

本 Skill 对应 V6 项目中的 `v6-stock-analysis-model`（v4.3）分层递进式个股分析模型，在原有 L-1~L8 量化因子基础上，引入大模型对多源资料（基础数据 + 本地补充文件 + 行业分析报告）进行可解释评分。同时参考 F:\投资赛道分析\.trae\skills 中的 `v6-stock-analysis-model` 与 `industry-score-mapping` 进行整合。

## 触发条件

- 用户在 V6 个股智能评分页面选择/输入标的并点击“开始智能评分”。
- 已录入 `stocks` 表的基础数据发生变化。
- 用户上传新的补充资料或行业分析报告。
- 距离上次评分超过 3.5 天（每周至少更新两次）。

## 评分步骤

1. **读取基础数据**：从 `dataLayer.stocks.get(symbol)` 获取 price、pe、pb、roe、marketCap 等字段，标记缺失项。
2. **读取补充文件**：解析用户上传的 `.txt / .md / .json` 文件内容。
3. **整理行业报告**：汇总用户输入的行业分析/研报文本。
4. **大模型推理**：调用 OpenAI 兼容接口（推荐 DeepSeek / Kimi / 硅基流动等国内模型）。
5. **解析并校验**：校验 JSON schema，缺失维度置 `null`。
6. **计算综合分**：仅对有效维度等权平均，不填充默认值。
7. **保存版本记录**：通过 `DataBridge.forward()` 写入 `intelligent_scores` store，按 `id` 自增保留历史。

## V6 模型映射

| V6 层 | 映射到本 Skill 维度 | 说明 |
|---|---|---|
| L-1 行业评分估值 | 行业 | 从 `sectorSkillData` / `industry-score-mapping` 提取 |
| L0 STEEP 宏观扫描 | 行业 / 情绪 | 社会/技术/经济/环境/政策趋势 |
| L1 护城河 | 盈利 / 质量 | 技术独占性、客户锁定、规模/网络效应、资源独占 |
| L2 竞品格局 | 成长 / 行业 | 技术代差、市场份额、客户认证 |
| L3 财务/估值 | 估值 / 盈利 / 质量 | 营收、盈利、现金流、订单、PE/PEG |
| L4 情景推演 | 情绪 / 估值 | 乐观/基准/悲观概率与目标价 |
| L5 技术成熟度 | 成长 / 行业 | T-M 矩阵定位 |
| L6 Hype Cycle | 情绪 | 主题热度与市场情绪位置 |
| L7 第二曲线 | 成长 | 新业务驱动 |
| L8 技术筹码 | 动量 / 波动 / 流动性 | 量价、资金、融资、筹码变化度 |

## 评分维度（V6 九维，每项 1-5）

| 维度 | 说明 | 主要输入与评分指引 |
|---|---|---|
| 估值 | PE、PB、PS、PEG 相对估值水平 | 基础数据 pe / pb；PEG<0.5显著低估，0.5-0.75低估，0.75-1.25合理，>1.5高估 |
| 成长 | 营收/利润增速、ROE 持续性、行业空间、第二曲线 | 基础数据 + 报告 |
| 盈利 | ROE、毛利率、净利率、现金流质量 | 基础数据 roe；经营现金流/净利>120%健康，<50%失血 |
| 质量 | 资产负债表健康度、治理结构、盈利可持续性 | 基础数据 + 报告；关注应收账款增速>营收50%、存货恶化 |
| 动量 | 近期价格趋势、相对强度、突破形态、筹码强度 | 基础数据 price + 报告 |
| 波动 | 价格波动率、回撤控制、融资余额变化、筹码稳定性 | 基础数据 + 报告 |
| 流动性 | 成交量、市值、换手率 | 基础数据 marketCap；成交量/60日均量<60%洼地，>150%热点 |
| 行业 | 行业景气度、政策支持、竞争格局、国产替代空间 | 行业分析报告 |
| 情绪 | 市场关注度、资金流向、事件催化、Hype 位置 | 补充资料 + 报告 |

## 评分规则

- **禁止杜撰数据**：资料不足的维度必须将 `score` 设为 `null`，并在 `rationale` 中说明“数据缺失，未参与评分”。
- **禁止给默认值**：不允许因为数据缺失就使用中性分或随机分。
- **每项评分必须给出依据**：`rationale` 需引用数据来源（基础数据字段、补充文件片段、行业报告片段）。
- **证据链**：`evidence` 数组列出 1-3 条支持该评分的关键原文或数据点。
- **综合分计算**：由调用方根据有效维度等权平均；LLM 只返回各维度分和总结，不返回 `overallScore`。

## 输出格式

必须返回严格的 JSON，不要包含 markdown 代码块或额外解释：

```json
{
  "dimensions": [
    {
      "name": "估值",
      "score": 4.2,
      "rationale": "PE 为 12.5，低于行业中枢，估值分较高。",
      "evidence": ["基础数据: pe=12.5", "行业报告: 行业平均 PE 18"]
    }
  ],
  "summary": "整体评价...",
  "basis": "本评分主要基于...",
  "missingFields": ["roe", "marketCap"]
}
```

## 使用方法

```typescript
import { runIntelligentScore } from '@/services/scoring/intelligentScoreService'

const result = await runIntelligentScore({
  symbol: '600519.SH',
  files: [file1, file2],
  reportText: '...',
  llmConfig: { baseURL, apiKey, model },
})
```

## 文件结构

```
src/services/scoring/
  intelligentScoreService.ts    # 评分编排与版本保存
  intelligentScorePrompt.ts     # Prompt 构建
  intelligentScoreSkill.ts      # Skill 文本（与本文件同步）
src/pages/analysis/
  IntelligentScorePage.tsx      # V6 个股智能评分页面
src/data/
  types.ts                      # IntelligentScore / DimensionScore 类型
```

## 变更日志

### v1.0.0 (2026-06-24)
- 初始版本，对应 V6 `v6-stock-analysis-model` v4.3 九维评分体系。
- 支持基础数据、补充文件、行业报告三源输入。
- 支持版本化存储与纵向比对。
