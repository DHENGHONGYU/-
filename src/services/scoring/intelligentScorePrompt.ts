import type { Stock } from '@/data/types'
import type { LlmMessage } from '@/services/llm/llmTypes'
import { INTELLIGENT_SCORE_SKILL } from './intelligentScoreSkill'

export interface ScorePromptInput {
  symbol: string
  stock: Stock | undefined
  supplementaryTexts: string[]
  reportText: string
}

export function buildIntelligentScorePrompt(input: ScorePromptInput): LlmMessage[] {
  const { symbol, stock, supplementaryTexts, reportText } = input

  const basicFields = stock
    ? {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price ?? '数据缺失',
        pe: stock.pe ?? '数据缺失',
        pb: stock.pb ?? '数据缺失',
        roe: stock.roe ?? '数据缺失',
        marketCap: stock.marketCap ?? '数据缺失',
      }
    : '未找到该标的基础数据'

  const userContent = [
    `标的代码: ${symbol}`,
    `基础数据:\n${JSON.stringify(basicFields, null, 2)}`,
    `补充文件资料 (${supplementaryTexts.length} 份):`,
    ...supplementaryTexts.map((text, idx) => `[文件${idx + 1}]\n${text}`),
    `行业分析报告/资料:\n${reportText || '未提供'}`,
    '请严格按照 system 指令中的 JSON 格式返回九维评分结果。',
  ].join('\n\n')

  return [
    { role: 'system', content: INTELLIGENT_SCORE_SKILL },
    { role: 'user', content: userContent },
  ]
}
