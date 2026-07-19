/**
 * @doc [V9-DOC-BACK-005, V9-DOC-PROJ-003, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-PROJ-002]
 */
import { calculateWeightedScore, getEnabledIndustryFactorNames } from '@/config/scoreFactors'
import { sendWriteEnvelope } from '@/core/databridgeQueries'
import type { IndustryDimensionScore, IndustryScore } from '@/data/types'
import { getSectorSkillMap } from '@/data/sectorSkillData'
import type { LlmConfig } from '@/config/llmConfig'
import { chat, LlmApiError, LlmConfigError } from '@/services/llm/llmGateway'
import { buildIndustryScorePrompt } from './industryScorePrompt'

const DIMENSION_NAMES = getEnabledIndustryFactorNames()

export interface RunIndustryScoreInput {
  code: string
  files: File[]
  reportText: string
  llmConfig?: Partial<LlmConfig>
}

export type IndustryScoreStep =
  | 'fetchSectorData'
  | 'readSupplementaryFiles'
  | 'prepareReportText'
  | 'llmAnalysis'
  | 'parseScore'
  | 'saveResult'

export interface IndustryScoreStepStatus {
  step: IndustryScoreStep
  status: 'pending' | 'running' | 'done' | 'error'
  message?: string
}

export type IndustryScoreProgressCallback = (status: IndustryScoreStepStatus) => void

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

function normalizeDimensionScore(raw: RawDimension, fallbackName: string): IndustryDimensionScore {
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
  }
}

function normalizeScoreOutput(raw: RawScoreOutput): {
  dimensions: IndustryDimensionScore[]
  summary: string
  basis: string
  missingFields: string[]
} {
  const rawDimensions = Array.isArray(raw.dimensions) ? raw.dimensions : []
  const dimensions = DIMENSION_NAMES.map((expectedName) => {
    const found = rawDimensions.find(
      (d) => typeof d.name === 'string' && d.name.includes(expectedName),
    )
    return found
      ? normalizeDimensionScore(found, expectedName)
      : normalizeDimensionScore({ name: expectedName, score: null, rationale: '数据缺失，未参与评分' }, expectedName)
  })

  const summary = typeof raw.summary === 'string' ? raw.summary : '未生成总结'
  const basis = typeof raw.basis === 'string' ? raw.basis : '未生成评分依据'
  const missingFields = Array.isArray(raw.missingFields)
    ? raw.missingFields.filter((item): item is string => typeof item === 'string')
    : []

  return { dimensions, summary, basis, missingFields }
}

function calculateOverallScore(dimensions: IndustryDimensionScore[]): number | null {
  return calculateWeightedScore(
    dimensions.map((d) => ({ name: d.name, score: d.score })),
    getEnabledIndustryFactorNames().map((name) => ({ name, weight: 1, enabled: true } as const)),
  )
}

/**
 * runIndustryScore
 */
export async function runIndustryScore(
  input: RunIndustryScoreInput,
  onProgress?: IndustryScoreProgressCallback,
): Promise<{ success: boolean; data?: IndustryScore; error?: string }> {
  const { code, files, reportText, llmConfig } = input

  let currentStep: IndustryScoreStep = 'fetchSectorData'

  const reportProgress = (step: IndustryScoreStep, status: IndustryScoreStepStatus['status'], message?: string): void => {
    onProgress?.({ step, status, message })
  }

  try {
    currentStep = 'fetchSectorData'
    reportProgress(currentStep, 'running', '读取行业 SKILL 数据...')
    const sectorMap = getSectorSkillMap()
    const sector = sectorMap[code]
    if (!sector) {
      throw new LlmConfigError(`未找到行业/赛道: ${code}`)
    }
    reportProgress(currentStep, 'done', `已读取 ${sector.name}`)

    currentStep = 'readSupplementaryFiles'
    reportProgress(currentStep, 'running', `读取 ${files.length} 个补充文件...`)
    const supplementaryTexts = await readSupplementaryFiles(files)
    reportProgress(currentStep, 'done', `已读取 ${files.length} 个文件`)

    currentStep = 'prepareReportText'
    reportProgress(currentStep, 'running', '整理行业报告资料...')
    reportProgress(currentStep, 'done', reportText ? '已整理报告资料' : '未提供报告资料')

    currentStep = 'llmAnalysis'
    reportProgress(currentStep, 'running', '调用大模型进行行业评分分析...')
    const messages = buildIndustryScorePrompt({ sector, supplementaryTexts, reportText })
    const response = await chat(messages, llmConfig)
    reportProgress(currentStep, 'done', `模型 ${response.model} 返回分析结果`)

    currentStep = 'parseScore'
    reportProgress(currentStep, 'running', '解析评分结果...')
    const rawOutput = parseRawScoreOutput(response.content)
    const normalized = normalizeScoreOutput(rawOutput)
    const overallScore = calculateOverallScore(normalized.dimensions)
    reportProgress(currentStep, 'done', overallScore !== null ? `综合分 ${overallScore}` : '综合分无法计算')

    const score: IndustryScore = {
      code,
      name: sector.name,
      overallScore,
      dimensionScores: normalized.dimensions,
      summary: normalized.summary,
      basis: normalized.basis,
      missingFields: normalized.missingFields,
      sectorSnapshot: {
        composite: sector.composite,
        recommendation: sector.recommendation,
        positionPct: sector.positionPct,
        subTracks: sector.subTracks.map((track) => track.name),
      },
      configSnapshot: {
        model: llmConfig?.model ?? '',
        baseURL: llmConfig?.baseURL ?? '',
      },
      modelResponse: response.content,
      scoredAt: Date.now(),
    }

    currentStep = 'saveResult'
    reportProgress(currentStep, 'running', '保存评分结果...')
    const saveResult = await sendWriteEnvelope('saveIndustryScores', score, 'analyzer')
    if (!saveResult.success) {
      reportProgress(currentStep, 'error', saveResult.error ?? '保存失败')
      return { success: false, error: saveResult.error ?? '保存评分结果失败' }
    }
    reportProgress(currentStep, 'done', '评分结果已保存')

    return { success: true, data: score }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof LlmConfigError || error instanceof LlmApiError) {
      reportProgress(currentStep, 'error', message)
    } else {
      reportProgress(currentStep, 'error', message)
    }
    return { success: false, error: message }
  }
}
