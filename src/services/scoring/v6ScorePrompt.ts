/**
 * V6 九维评分 LLM Prompt 构建器
 *
 * 当规则引擎无法覆盖所有维度时，将基础数据+K线统计+已计算的因子发给 LLM 补全。
 * LLM 仅补充规则引擎无法计算的维度（成长/质量/行业/情绪），不覆盖已有计算结果。
 */

import type { LlmMessage } from '@/services/llm/llmTypes'
import type { Stock } from '@/data/types'

export interface V6ScorePromptInput {
  symbol: string
  stock: Stock | undefined
  /** 规则引擎已计算的因子（可能不完整） */
  ruleFactors: Record<string, number>
  /** K线统计摘要 */
  quoteStats: {
    hasHistory: boolean
    historyDays: number
    latestClose: number | undefined
    return20d: number | undefined
    volatility20d: number | undefined
    avgTurnover20d: number | undefined
  }
  /** 缺失的因子列表 */
  missingFactors: string[]
}

export function buildV6ScorePrompt(input: V6ScorePromptInput): LlmMessage[] {
  const { symbol, stock, ruleFactors, quoteStats, missingFactors } = input

  const systemPrompt = `你是一个专业的A股量化评分分析师。请根据提供的股票基础数据、K线统计和已有评分结果，为缺失的维度补充评分。

评分规则：
- 每个维度评分范围 1-5 分，保留1位小数
- 仅对缺失维度进行评分，已有评分保持不变
- 评分必须基于提供的数据，禁止杜撰
- 数据不足时将 score 设为 null，并在 rationale 中说明原因
- 返回严格 JSON，不要 markdown 代码块或额外解释

输出格式：
{
  "supplements": [
    { "name": "维度名", "score": 4.2, "rationale": "评分依据" }
  ]
}`

  const stockInfo = stock
    ? `名称: ${stock.name}
代码: ${stock.symbol}
行业: ${stock.sector ?? '未知'}
价格: ${stock.price ?? '未知'}
PE: ${stock.pe ?? '未知'}
PB: ${stock.pb ?? '未知'}
ROE: ${stock.roe ?? '未知'}
总市值: ${stock.marketCap != null ? `${(stock.marketCap / 1e8).toFixed(0)}亿` : '未知'}`
    : '暂无基础数据'

  const factorsInfo = Object.entries(ruleFactors)
    .map(([name, value]) => `  ${name}: ${value.toFixed(1)}`)
    .join('\n')

  const quoteInfo = quoteStats.hasHistory
    ? `  K线天数: ${quoteStats.historyDays}
  最新收盘: ${quoteStats.latestClose ?? '未知'}
  20日收益率: ${quoteStats.return20d != null ? `${(quoteStats.return20d * 100).toFixed(1)}%` : '未知'}
  20日波动率: ${quoteStats.volatility20d != null ? `${(quoteStats.volatility20d * 100).toFixed(1)}%` : '未知'}
  20日均换手率: ${quoteStats.avgTurnover20d != null ? `${(quoteStats.avgTurnover20d * 100).toFixed(1)}%` : '未知'}`
    : '  无K线数据'

  const userPrompt = `请为 ${symbol} 的缺失维度补充评分。

## 基础数据
${stockInfo}

## 已有因子评分
${factorsInfo || '无'}

## K线统计
${quoteInfo}

## 缺失维度
${missingFactors.join('、')}

请仅对上述缺失维度返回评分，格式：
{
  "supplements": [
    { "name": "维度名", "score": 4.2, "rationale": "评分依据" }
  ]
}`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}
