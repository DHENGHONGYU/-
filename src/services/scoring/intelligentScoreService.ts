import { calculateWeightedScore, getEnabledStockFactorNames } from '@/config/scoreFactors'
import { dataLayer } from '@/data/dataLayer'
import type { DataLayerResult, DimensionScore, IntelligentScore, Stock } from '@/data/types'
import type { LlmConfig, LlmTransparencyConfig } from '@/config/llmConfig'
import { chat, LlmApiError } from '@/services/llm/llmGateway'
import { buildIntelligentScorePrompt } from './intelligentScorePrompt'

const DIMENSION_NAMES = getEnabledStockFactorNames()

export interface RunIntelligentScoreInput {
  symbol: string
  files: File[]
  reportText: string
  llmConfig?: Partial<LlmConfig>
  /** LLM 透明度配置（包含 enableLlm 和 factorOverrides） */
  transparencyConfig?: LlmTransparencyConfig
}

export interface ScoreStepStatus {
  step: ScoreStep
  status: 'pending' | 'running' | 'done' | 'error'
  message?: string
}

export type ScoreStep =
  | 'fetchBasicData'
  | 'readSupplementaryFiles'
  | 'prepareReportText'
  | 'llmAnalysis'
  | 'parseScore'
  | 'saveResult'

export type ScoreProgressCallback = (status: ScoreStepStatus) => void

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => {
      reject(new Error(`读取文件 ${file.name} 失败`))
    }
    reader.readAsText(file)
  })
}

async function readSupplementaryFiles(files: File[]): Promise<string[]> {
  const results = await Promise.all(
    files.map(async (file) => {
      const text = await readFileAsText(file)
      return `文件名: ${file.name}\n内容:\n${text}`
    }),
  )
  return results
}

function detectMissingBasicFields(stock: Stock | undefined): string[] {
  if (!stock) return ['stock']
  const missing: string[] = []
  if (stock.price === undefined || stock.price === null) missing.push('price')
  if (stock.pe === undefined || stock.pe === null) missing.push('pe')
  if (stock.pb === undefined || stock.pb === null) missing.push('pb')
  if (stock.roe === undefined || stock.roe === null) missing.push('roe')
  if (stock.marketCap === undefined || stock.marketCap === null) missing.push('marketCap')
  return missing
}

interface RawDimension {
  name?: string
  score?: number | null
  rationale?: string
  evidence?: string[]
}

interface RawScoreOutput {
  dimensions?: RawDimension[]
  summary?: string
  basis?: string
  missingFields?: string[]
}

function extractJsonFromMarkdown(content: string): string {
  const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (match?.[1]) {
    return match[1].trim()
  }
  return content.trim()
}

function parseRawScoreOutput(content: string): RawScoreOutput {
  const jsonText = extractJsonFromMarkdown(content)
  try {
    const parsed = JSON.parse(jsonText) as RawScoreOutput
    return parsed
  } catch {
    throw new LlmApiError('LLM 返回内容不是合法 JSON')
  }
}

function normalizeDimensionScore(
  raw: RawDimension,
  fallbackName: string,
  usedLlm: boolean = false
): DimensionScore {
  const name = typeof raw.name === 'string' && raw.name.length > 0
    ? raw.name
    : fallbackName
  const score = typeof raw.score === 'number' ? Math.max(1, Math.min(5, raw.score)) : null
  const rationale = typeof raw.rationale === 'string' ? raw.rationale : '未提供评分依据'
  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence.filter((item): item is string => typeof item === 'string')
    : []

  return {
    name,
    score,
    rationale,
    evidence,
    weight: 1 / DIMENSION_NAMES.length,
    usedLlm,
  }
}

function normalizeScoreOutput(
  raw: RawScoreOutput,
  transparencyConfig?: LlmTransparencyConfig
): {
  dimensions: DimensionScore[]
  summary: string
  basis: string
  missingFields: string[]
} {
  const rawDimensions = Array.isArray(raw.dimensions) ? raw.dimensions : []
  const dimensions = DIMENSION_NAMES.map((expectedName) => {
    const found = rawDimensions.find(
      (d) => typeof d.name === 'string' && d.name.includes(expectedName),
    )

    // 判断该因子是否使用 LLM
    const factorOverride = transparencyConfig?.factorOverrides?.find(
      (o) => o.factorId === expectedName
    )
    const usedLlm = transparencyConfig?.enableLlm
      ? (factorOverride?.useLlm ?? false)
      : false

    return found
      ? normalizeDimensionScore(found, expectedName, usedLlm)
      : normalizeDimensionScore({ name: expectedName, score: null, rationale: '数据缺失，未参与评分' }, expectedName, usedLlm)
  })

  const summary = typeof raw.summary === 'string' ? raw.summary : '未生成总结'
  const basis = typeof raw.basis === 'string' ? raw.basis : '未生成评分依据'
  const missingFields = Array.isArray(raw.missingFields)
    ? raw.missingFields.filter((item): item is string => typeof item === 'string')
    : []

  return { dimensions, summary, basis, missingFields }
}

function calculateOverallScore(dimensions: DimensionScore[]): number | null {
  return calculateWeightedScore(
    dimensions.map((d) => ({ name: d.name, score: d.score })),
    getEnabledStockFactorNames().map((name) => ({ name, weight: 1, enabled: true } as const)),
  )
}

/**
 * runIntelligentScore
 */
export async function runIntelligentScore(
  input: RunIntelligentScoreInput,
  onProgress?: ScoreProgressCallback,
): Promise<DataLayerResult<IntelligentScore>> {
  const { symbol, files, reportText, llmConfig } = input

  const reportProgress = (step: ScoreStep, status: ScoreStepStatus['status'], message?: string): void => {
    onProgress?.({ step, status, message })
  }

  let currentStep: ScoreStep = 'fetchBasicData'

  try {
    currentStep = 'fetchBasicData'
    reportProgress(currentStep, 'running', '读取基础数据...')
    const stock = await dataLayer.stocks.get(symbol)
    const basicMissingFields = detectMissingBasicFields(stock)
    reportProgress(currentStep, 'done', stock ? `已读取 ${stock.name}(${stock.symbol})` : '未找到基础数据')

    currentStep = 'readSupplementaryFiles'
    reportProgress(currentStep, 'running', `读取 ${files.length} 个补充文件...`)
    const supplementaryTexts = await readSupplementaryFiles(files)
    reportProgress(currentStep, 'done', `已读取 ${files.length} 个文件`)

    currentStep = 'prepareReportText'
    reportProgress(currentStep, 'running', '整理行业报告资料...')
    reportProgress(currentStep, 'done', reportText ? '已整理报告资料' : '未提供报告资料')

    currentStep = 'llmAnalysis'
    reportProgress(currentStep, 'running', '调用大模型进行评分分析...')
    const messages = buildIntelligentScorePrompt({ symbol, stock, supplementaryTexts, reportText })
    const response = await chat(messages, llmConfig)
    reportProgress(currentStep, 'done', `模型 ${response.model} 返回分析结果`)

    currentStep = 'parseScore'
    reportProgress(currentStep, 'running', '解析评分结果...')
    const rawOutput = parseRawScoreOutput(response.content)
    const normalized = normalizeScoreOutput(rawOutput, input.transparencyConfig)
    const overallScore = calculateOverallScore(normalized.dimensions)
    reportProgress(currentStep, 'done', overallScore !== null ? `综合分 ${overallScore}` : '综合分无法计算')

    const finalMissingFields = Array.from(
      new Set([...basicMissingFields, ...normalized.missingFields]),
    )

    const score: IntelligentScore = {
      symbol,
      overallScore,
      dimensionScores: normalized.dimensions,
      summary: normalized.summary,
      basis: normalized.basis,
      missingFields: finalMissingFields,
      sourceSnapshot: {
        stock,
        fileNames: files.map((file) => file.name),
        reportLength: reportText.length,
      },
      configSnapshot: {
        model: llmConfig?.model ?? '',
        baseURL: llmConfig?.baseURL ?? '',
      },
      modelResponse: response.content,
      dataVersion: stock?.dataVersion ?? 0,
      scoredAt: Date.now(),
    }

    currentStep = 'saveResult'
    reportProgress(currentStep, 'running', '保存评分结果...')
    const saveResult = await dataLayer.intelligentScores.save(score)
    if (!saveResult.success) {
      reportProgress(currentStep, 'error', saveResult.error ?? '保存失败')
      return { success: false, error: saveResult.error ?? '保存评分结果失败' }
    }
    reportProgress(currentStep, 'done', '评分结果已保存')

    return { success: true, data: score }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    reportProgress(currentStep, 'error', message)
    return { success: false, error: message }
  }
}
