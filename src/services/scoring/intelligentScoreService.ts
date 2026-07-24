/**
 * @doc [V9-DOC-BACK-005, V9-DOC-PROJ-003, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-PROJ-002]
 */
import { calculateWeightedScore, getEnabledStockFactorNames } from '@/config/scoreFactors'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import { sendWriteEnvelope } from '@/core/databridgeQueries'
import type { DataLayerResult, DailyQuotes, DimensionScore, IntelligentScore, Stock } from '@/data/types'
import type { LlmConfig, LlmTransparencyConfig } from '@/config/llmConfig'
import { chat, LlmApiError } from '@/services/llm/llmGateway'
import type { LlmResponse } from '@/services/llm/llmTypes'
import { buildIntelligentScorePrompt } from './intelligentScorePrompt'
import { createV6Engine, stockToBasicData, quotesToQuoteData } from '@/services/scoring/v6-engine'
import type { CompositeScore, LayerScore } from '@/services/scoring/v6-engine/types'
import { buildFinancialData } from '@/services/scoring/v6ScoreService'
import { validateScoreBeforeSave } from '@/services/scoring/aiOutputValidator'
import { getLogger } from '@/lib/logger'
import { parseLlmJson } from '@/services/llm/jsonParser'
import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'

const logger = getLogger()

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
  | 'v6EngineCalculation'
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

function parseRawScoreOutput(content: string): RawScoreOutput {
  const parsed = parseLlmJson<RawScoreOutput>(content, undefined, logger)
  if (!parsed) {
    throw new LlmApiError('LLM 返回内容无法解析为 JSON')
  }
  return parsed
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

/** 获取 v6 层名映射中层的得分，返回 [0,5] 的分数 */
function scoreFromLayer(layer: LayerScore | undefined): number | null {
  return layer ? Math.max(0, Math.min(5, layer.score)) : null
}

/** 从多个 v6 层中取综合得分（平均各层分） */
function averageFromLayers(...layers: (LayerScore | undefined)[]): number | null {
  const scores = layers.filter((l): l is LayerScore => l !== undefined).map((l) => l.score)
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

/** 将 v6 11 层 CompositeScore 映射为 9 因子 DimensionScore[] */
function v6CompositeToDimensionScores(
  composite: CompositeScore,
  factorNames: string[],
): DimensionScore[] {
  const layers = composite.layers
  const weight = 1 / factorNames.length

  return factorNames.map((name) => {
    let score: number | null
    let rationale: string
    let evidence: string[]

    switch (name) {
      case '估值':
        score = scoreFromLayer(layers.l3v)
        rationale = layers.l3v?.summary ?? 'v6 估值层评分'
        evidence = layers.l3v?.evidence ?? []
        break
      case '成长':
        score = averageFromLayers(layers.l7, layers.l5)
        rationale = [layers.l7?.summary, layers.l5?.summary].filter(Boolean).join('; ')
        evidence = [...(layers.l7?.evidence ?? []), ...(layers.l5?.evidence ?? [])]
        break
      case '盈利':
        score = scoreFromLayer(layers.l3f)
        rationale = layers.l3f?.summary ?? 'v6 财务健康层评分'
        evidence = layers.l3f?.evidence ?? []
        break
      case '质量':
        score = averageFromLayers(layers.l1, layers.l3f)
        rationale = [layers.l1?.summary, layers.l3f?.summary].filter(Boolean).join('; ')
        evidence = [...(layers.l1?.evidence ?? []), ...(layers.l3f?.evidence ?? [])]
        break
      case '动量':
        score = scoreFromLayer(layers.l8)
        rationale = layers.l8?.summary ?? 'v6 技术筹码层评分'
        evidence = layers.l8?.evidence ?? []
        break
      case '波动':
        score = scoreFromLayer(layers.l8)
        rationale = '波动率来自 v6 L8 技术筹码层'
        evidence = layers.l8?.evidence ?? []
        break
      case '流动性':
        score = scoreFromLayer(layers.l8)
        rationale = '流动性来自 v6 L8 技术筹码层'
        evidence = layers.l8?.evidence ?? []
        break
      case '行业':
        score = averageFromLayers(layers.lMinus1, layers.l0, layers.l2)
        rationale = [layers.lMinus1?.summary, layers.l0?.summary, layers.l2?.summary]
          .filter(Boolean).join('; ')
        evidence = [
          ...(layers.lMinus1?.evidence ?? []),
          ...(layers.l0?.evidence ?? []),
          ...(layers.l2?.evidence ?? []),
        ]
        break
      case '情绪':
        score = averageFromLayers(layers.l6, layers.l4)
        rationale = [layers.l6?.summary, layers.l4?.summary].filter(Boolean).join('; ')
        evidence = [...(layers.l6?.evidence ?? []), ...(layers.l4?.evidence ?? [])]
        break
      default:
        score = null
        rationale = '未知因子'
        evidence = []
    }

    return { name, score, rationale, evidence, weight, usedLlm: false }
  })
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
    const stockResult = await dataBridge.query<Stock>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.stocks, key: symbol })
    const stock = stockResult.success ? stockResult.data : undefined
    const basicMissingFields = detectMissingBasicFields(stock)
    reportProgress(currentStep, 'done', stock ? `已读取 ${stock.name}(${stock.symbol})` : '未找到基础数据')

    currentStep = 'v6EngineCalculation'
    reportProgress(currentStep, 'running', '执行 V6 实时因子引擎 ...')
    let v6Composite: CompositeScore | null = null
    // 基础数据不完整时跳过 V6 引擎，避免以默认值生成不可信的合成评分
    if (basicMissingFields.length > 0) {
      logger.info('[runIntelligentScore] 基础数据不完整，跳过 V6 引擎', { symbol, missingFields: basicMissingFields })
      reportProgress(currentStep, 'done', `基础数据缺失 ${basicMissingFields.join(', ')}，将使用 LLM 评分`)
    } else {
      try {
        const quotesResult = await dataBridge.query<DailyQuotes>({
          action: ENVELOPE_ACTION.queryGet,
          store: STORE_NAME.dailyQuotes,
          key: symbol,
        })
        const quotesOrNull = quotesResult.success ? quotesResult.data : null

        const engine = createV6Engine()
        const inputSymbol = stock?.symbol ?? symbol
        const input = {
          symbol: inputSymbol,
          stock: stock ? stockToBasicData(stock) : stockToBasicData({ price: 0 } as Stock),
          financials: await buildFinancialData(inputSymbol),
          quotes: quotesOrNull
            ? quotesToQuoteData(quotesOrNull)
            : { latestClose: stock?.price ?? 0, history: [], volumeHistory: [] },
        }
        const composite = await engine.calculateAll(input)
        v6Composite = composite
        reportProgress(currentStep, 'done', `V6 引擎完成，综合分 ${composite.score.toFixed(2)}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.warn('[runIntelligentScore] V6 引擎不可用，将回退 LLM', { symbol, error: msg })
        reportProgress(currentStep, 'done', 'V6 引擎数据不足，将使用 LLM 评分')
      }
    }

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
    // 阶段 B：LLM 调用容错——数据驱动路径（v6 可用）不应因 LLM 不可达而整体失败
    let response: LlmResponse | null = null
    let llmError: string | null = null
    try {
      response = await chat(messages, llmConfig)
      reportProgress(currentStep, 'done', `模型 ${response.model} 返回分析结果`)
    } catch (err) {
      llmError = err instanceof Error ? err.message : String(err)
      logger.warn('[runIntelligentScore] LLM 调用失败，将按数据可用性决策', { symbol, error: llmError })
      reportProgress(currentStep, 'done', `LLM 不可达（${llmError}），按既有数据决策`)
    }

    currentStep = 'parseScore'
    reportProgress(currentStep, 'running', '解析评分结果...')

    // 核心策略：v6 真实因子优先，LLM 仅提供文本增强
    const dimensionNames = getEnabledStockFactorNames()
    let dimensions: DimensionScore[]
    let overallScore: number | null

    if (v6Composite) {
      // 数据驱动：使用 v6 真实因子分数；LLM 仅做可选文本增强（不可达则跳过）
      dimensions = v6CompositeToDimensionScores(v6Composite, dimensionNames)
      if (response) {
        try {
          const rawOutput = parseRawScoreOutput(response.content)
          for (const rawDim of (rawOutput.dimensions ?? [])) {
            if (rawDim.name && rawDim.rationale && rawDim.rationale !== '未提供评分依据') {
              const matched = dimensions.find((d) => d.name.includes(rawDim.name!) || rawDim.name!.includes(d.name))
              if (matched && matched.rationale.length < (rawDim.rationale?.length ?? 0)) {
                matched.rationale = rawDim.rationale!
              }
            }
          }
        } catch {
          // LLM 解析失败不影响 v6 分数
          logger.warn('[runIntelligentScore] LLM 文本增强解析失败，仅使用 v6 因子分数')
        }
      }
      overallScore = v6Composite.score
    } else {
      // v6 不可用：必须有 LLM 支撑，否则无法生成可信评分（禁止黑箱/崩溃）
      if (!response) {
        const msg = '无采集数据支撑（v6 引擎不可用）且 LLM 不可达，无法生成可信评分'
        logger.error('[runIntelligentScore] ' + msg, { symbol })
        return { success: false, error: msg }
      }
      const rawOutput = parseRawScoreOutput(response.content)
      const normalized = normalizeScoreOutput(rawOutput, input.transparencyConfig)
      dimensions = normalized.dimensions
      overallScore = calculateOverallScore(normalized.dimensions)
    }

    reportProgress(currentStep, 'done', overallScore !== null ? `综合分 ${overallScore.toFixed(2)}` : '综合分无法计算')

    const finalMissingFields = Array.from(
      new Set([...basicMissingFields]),
    )

    const score: IntelligentScore = {
      symbol,
      overallScore,
      dimensionScores: dimensions,
      summary: response
        ? response.content.slice(0, 500)
        : (v6Composite
            ? `V6 引擎数据驱动评分（综合分 ${v6Composite.score.toFixed(2)}），LLM 增强未启用`
            : ''),
      basis: v6Composite
        ? `V6 实时因子引擎 (v${v6Composite.engineVersion})，基于 ${Object.keys(v6Composite.layers).length} 层因子计算（数据驱动）`
        : 'LLM 生成评分（数据不足，未触发 v6 引擎，黑箱合成）',
      scoreProvenance: v6Composite ? 'data-driven' : 'llm-synthetic',
      dataProvenance: stock?.dataProvenance ?? (stock?.dataSource ? 'real' : 'unknown'),
      missingFields: finalMissingFields,
      sourceSnapshot: {
        stock,
        fileNames: files.map((file) => file.name),
        reportLength: reportText.length,
      },
      configSnapshot: {
        model: llmConfig?.model ?? '',
        baseURL: llmConfig?.baseURL ?? '',
        v6EngineVersion: v6Composite?.engineVersion,
        v6Score: v6Composite?.score,
      },
      modelResponse: response?.content ?? '',
      dataVersion: stock?.dataVersion ?? 0,
      scoredAt: Date.now(),
    }

    // V9-003: AI 输出三道校验（持久化前拦截异常数据）
    const validationReport = validateScoreBeforeSave(score, {
      v6EngineScore: v6Composite?.score,
    })
    if (validationReport.severity === 'block') {
      const msg = `评分校验未通过（${validationReport.issues.filter((i) => i.severity === 'block').length} 项阻塞），不保存`
      logger.error('[runIntelligentScore] ' + msg, { symbol, issues: validationReport.issues })
      return { success: false, error: msg }
    }
    if (validationReport.severity === 'warn') {
      logger.warn('[runIntelligentScore] 评分校验通过但有警告', {
        symbol,
        warns: validationReport.issues.filter((i) => i.severity === 'warn'),
      })
    }

    currentStep = 'saveResult'
    reportProgress(currentStep, 'running', '保存评分结果...')
    const saveResult = await sendWriteEnvelope('saveIntelligentScores', score, 'analyzer')
    if (!saveResult.success) {
      reportProgress(currentStep, 'error', saveResult.error ?? '保存失败')
      return { success: false, error: saveResult.error ?? '保存评分结果失败' }
    }
    reportProgress(currentStep, 'done', '评分结果已保存')

    // 通知编排器层：评分完成 → 触发 ScoreCalibrator → 策略分层
    eventBus.emit(EVENT_NAMES.ANALYSIS_SCORE_COMPLETED, {
      symbol: input.symbol,
      score,
    })

    return { success: true, data: score }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    reportProgress(currentStep, 'error', message)
    return { success: false, error: message }
  }
}
