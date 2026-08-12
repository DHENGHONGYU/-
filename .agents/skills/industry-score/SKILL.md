---
name: "industry-score"
description: "行业评分技能：执行行业级别的综合评分分析，输出行业得分供个股分析模型 L-1 层使用。"
version: v1.0.1
last_updated: 2026-08-11
code_version: "2.0.0-rc.1"
change_log:
  - version: v1.0.1
    changes: "C类日期闭环(2026-08-11)：change_log最新条目日期同步至last_updated"
    date: 2026-08-11
  - version: v1.0.1
    changes: "基准日校对(2026-08-11)：补齐 YAML frontmatter（对齐 skill-registry.json 元数据）；将硬编码绝对路径（外部 .trae/skills 目录）替换为相对引用 .agents/skills/"
    date: 2026-08-11
  - version: v1.0.0
    changes: "初始版本，基于 V6 `sectorSkillData` 与 `sector-analysis-framework` 整合。"
    date: 2026-06-24
---

# 行业智能评分 Skill（V4 行业评分）

## 版本

v1.0.1 — 2026-08-11

## 适用范围

V9 智能投研系统 · V4 行业评分页面（`/analysis/industry-score`）。

本 Skill 以“第四次工业革命稀缺核心资源”为检索目标，基于 V6 项目 `sectorSkillData` 的 SKILL 量化评分（SKILL-C 四维加权 / SKILL-A 双维度量表 / SKILL-N 六维板块），结合 `.agents/skills/` 中的 `sector-analysis-framework` 与 `industry-score-mapping` 进行动态修正与可解释评分。

## 触发条件

- 用户在 V4 行业评分页面选择行业/赛道并点击“运行行业智能评分”。
- `sectorSkillData` 中的 SKILL 量化数据发生更新。
- 用户上传新的行业资料或政策/研报文本。
- 距离上次评分超过 3.5 天（每周至少更新两次）。

## 评分步骤

1. **读取行业 SKILL 数据**：加载 `sectorSkillData` 中对应赛道的 planAlignment、policySupport、usChinaParity、skillC、skillA、skillN 等量化结果。
2. **读取补充文件**：解析用户上传的 `.txt / .md / .json` 文件内容。
3. **整理行业报告**：汇总用户输入的行业分析/政策/新闻文本。
4. **大模型推理**：调用 OpenAI 兼容接口（推荐 DeepSeek / Kimi / 硅基流动等国内模型）。
5. **解析并校验**：校验 JSON schema，缺失维度置 `null`。
6. **计算综合分**：仅对有效维度等权平均，不填充默认值。
7. **保存版本记录**：通过 `DataBridge.forward()` 写入 `industry_scores` store，按 `id` 自增保留历史。

## 评分维度（V4 行业七维，每项 1-5）

| 维度 | 说明 | 主要输入与评分指引 |
|---|---|---|
| 政策契合度 | 与十五五规划、国家战略、地方政策的匹配程度 | SKILL planAlignment / policySupport；国家级战略 +3~+5，部委规章 +3，补贴/税收优惠 +1~+3，监管收紧 -2~-4 |
| 稀缺性 | 资源/技术/产能的全球稀缺程度与不可替代性 | SKILL-C structuralScarcity / SKILL-A scarcityValue；全球垄断/不可替代 → 高分 |
| 国产替代空间 | 关键环节的进口依赖度与自主可控潜力 | SKILL-C localizationBarrier；国产化率<30%且差距大 → 空间大 |
| 技术先进性 | 技术迭代速度、代际差距、范式转换机会 | SKILL-C techAdvancement / SKILL-N techMigration；技术收敛期→高分，探索期→中低分 |
| 行业景气度 | 下游需求、产能周期、订单/出货量趋势 | SKILL-N downstream / rotationSignal；终端增速、库存周期、价格传导 |
| 估值吸引力 | 相对历史与全球同行的估值水平 | SKILL-N fundValuation；板块PE历史分位<30%低估，相对溢价率<10%极端低配，PEG<0.5显著低估 |
| 情绪热度 | 资金关注度、主题热度、成交量/融资余额变化 | SKILL-N rotationSignal；成交量/60日均量<60%价值洼地，>150%热点确认 |

## 评分规则

- 已有 SKILL 量化评分作为重要参考，但不要照搬，需结合最新资料动态修正。
- **禁止杜撰数据**：资料不足的维度必须将 `score` 设为 `null`，并在 `rationale` 中说明“数据缺失，未参与评分”。
- **禁止给默认值**：不允许因数据缺失就使用中性分或随机分。
- 每项评分必须给出依据：`rationale` 引用 SKILL 分值、补充文件片段或行业报告片段。
- `evidence` 数组列出 1-3 条关键证据。
- 综合分由调用方根据有效维度等权平均计算，LLM 只返回定性总结，不返回 `overallScore`。

## 输出格式

严格返回 JSON，不要 markdown 代码块或额外解释：

```json
{
  "dimensions": [
    {
      "name": "政策契合度",
      "score": 4.5,
      "rationale": "十五五纲要明确列为战略必争领域，地方专项规划密集出台。",
      "evidence": ["SKILL: planAlignment=5.0", "报告: 北京/上海三年行动计划"]
    }
  ],
  "summary": "整体评价...",
  "basis": "本评分主要基于...",
  "missingFields": ["估值数据", "资金面数据"]
}
```

## 使用方法

```typescript
import { runIndustryScore } from '@/services/scoring/industryScoreService'

const result = await runIndustryScore({
  code: 'AI',
  files: [file1],
  reportText: '...',
  llmConfig: { baseURL, apiKey, model },
})
```

## 文件结构

```
src/data/
  sectorSkillData.ts            # V6 迁移的行业 SKILL 量化数据
src/services/scoring/
  industryScoreService.ts       # 评分编排与版本保存
  industryScorePrompt.ts        # Prompt 构建
  industryScoreSkill.ts         # Skill 文本（与本文件同步）
src/pages/analysis/
  IndustryScorePage.tsx         # V4 行业评分页面
src/data/
  types.ts                      # IndustryScore / IndustryDimensionScore 类型
```

## 变更日志

### v1.0.1 (2026-08-11)
- 基准日校对：补齐 YAML frontmatter（name/description/version/last_updated/code_version/change_log），对齐 `skill-registry.json` 元数据。
- 修复硬编码路径：将外部 `.trae/skills` 绝对路径替换为相对引用 `.agents/skills/`，提升跨用户可移植性。

### v1.0.0 (2026-06-24)
- 初始版本，基于 V6 `sectorSkillData` 与 `sector-analysis-framework` 整合。
- 支持 SKILL 快照、补充文件、行业报告三源输入。
- 支持版本化存储与纵向比对。
