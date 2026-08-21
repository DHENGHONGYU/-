/**
 * @module services/orchestration/researchPipelineOrchestrator
 * @description 投研全链路编排器（数据传递 + 数据跟踪）。
 *
 * 将用户定义的闭环串成单次可执行：
 *   数据采集 → 采集数据存放 → 调用评价分析(V6) →
 *   (评分过低启动校对/回溯) → 按交易策略筛选 → 策略三分类(核心/价值洼地/热门) →
 *   选股入池(研究池) + 纳入长期观察池(意向.watchlist) → 复盘跟踪 + 整合报告。
 *
 * 设计原则：网络采集(collector) 由调用方注入，其余沿用项目真实引擎
 * （runV6Score / runStrategy / poolService.transitionPoolItem），
 * 保证模块可在 Node/测试中以真实腾讯行情驱动，也可在生产以代理源驱动。
 *
 * 语义缺口①（spec「评分过低启动校对」）在此显式实现：score < 阈值时触发
 * calibrator（默认复用 feedbackOrchestrator 的 重采集→重评分 循环），
 * 并产出「回溯处理方案」（定位低分层 + 建议补足的数据维度）。
 *
 * @doc [V9-DOC-ARCH-009, V9-DOC-PROJ-108, V9-DOC-BACK-010]
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { queryGet } from '@/core/databridgeQueries'
import {
  ENVELOPE_ACTION,
  STORE_NAME,
  MODULE_ID,
  ENVELOPE_TARGET,
} from '@/config/dbConfig'
import { getDefaultStrategyRuleConfig, type StrategyRuleConfig } from '@/config/strategyRules'
import type { ThemeConfig } from '@/config/themeRegistry'
import { klinesToDailyQuotes } from '@/services/data-collector/directDataAPI'
import { importStocks } from '@/services/input/batchImportExecutor'
import {
  POOL_TYPE,
  INTENTION_STATUS,
  RESEARCH_STATUS,
} from '@/constants/pool.constants'
import type { RealtimeQuote } from '@/services/fetcher/directDataAPI'
import type { KlineBar } from '@/data/types/types.marketData'
import type { Stock, V6Score } from '@/data/types'
import type { StrategyResult, StrategyClassification } from '@/data/types'
import type { PoolTransitionTarget } from '@/types/modules/pool.types'

const logger = getLogger()

// ============================================================
// 依赖注入接口（网络采集等由调用方提供）
// ============================================================

/** 网络采集器：拉取实时行情与 K 线（真实/代理由实现决定） */
export interface PipelineCollector {
  fetchQuote(symbol: string): Promise<RealtimeQuote | null>
  fetchKline(symbol: string, count?: number): Promise<KlineBar[]>
}

/** 评分器：V6 综合评分 */
export interface PipelineScorer {
  run(symbol: string): Promise<{ success: boolean; data?: V6Score }>
}

/** 策略引擎：三分类 + 入选 */
export interface PipelineStrategy {
  run(stocks: Stock[], opts?: unknown): Promise<StrategyResult>
}

/** 池服务：入池/流转 */
export interface PipelinePool {
  transition(
    symbol: string,
    target: PoolTransitionTarget,
  ): Promise<{ success: boolean; error?: string }>
}

/**
 * 校对器（缺口①）：评分过低时触发。
 * 返回是否触发、是否重采集、是否重评分、以及回溯处理方案。
 */
export interface PipelineCalibrator {
  calibrate(symbol: string): Promise<{
    triggered: boolean
    reFetched: boolean
    reScored: boolean
    backtrackPlan: string[]
  }>
}

export interface ResearchPipelineDeps {
  collector: PipelineCollector
  scorer: PipelineScorer
  strategy: PipelineStrategy
  pool: PipelinePool
  /** 评分(V6 0-5 尺度)低于该阈值触发校对/回溯；默认 3.0 */
  scoreCalibrationThreshold?: number
  /** 校对器（默认走 feedbackOrchestrator 重采集→重评分 循环） */
  calibrator?: PipelineCalibrator
  /** 参考估值（pe/pb/marketCap），真实源未覆盖时使用 */
  referenceValue?: (symbol: string) => { pe: number; pb: number; marketCap: number }
  /** K 线根数，默认 60 */
  klineCount?: number
  /** 策略主题（核心稀缺等）；传入后阶段5启用 core-scarce 分类 */
  theme?: ThemeConfig
  /** 策略规则配置；不传则用 DEFAULT_STRATEGY_RULE_CONFIG */
  ruleConfig?: StrategyRuleConfig
  /** 外部动量快照 symbol→priceToMA20（绕过内部 K 线读取，便于测试确定性） */
  momentumMap?: Record<string, number>
  /** 板块/行业代码解析器：将 symbol 映射为 {sector, industryCode}，用于策略三分类与主题匹配 */
  sectorResolver?: (symbol: string) => { sector?: string; industryCode?: string }
}

// ============================================================
// 结果类型
// ============================================================

export interface PipelineStockInput {
  code: string
  name: string
  held: boolean
  market: string
}

export interface Stage1Record {
  code: string
  symbol: string
  name: string
  held: boolean
  market: string
  importOk: boolean
  importError?: string
}

export interface Stage2Record {
  code: string
  name: string
  held: boolean
  market: string
  quoteOk: boolean
  klineOk: boolean
  klineLen: number
  dqPersistOk: boolean
  stockUpdateOk: boolean
  price: number
  prevClose: number
  pe: number
  pb: number
  quoteError?: string
  klineError?: string
}

export interface Stage3Record {
  code: string
  name: string
  held: boolean
  market: string
  scoreOk: boolean
  score: number
  rating: string
  inRange: boolean
  layersFinite: boolean
  noNaN: boolean
  scoreError?: string
  layerDetails?: unknown
}

export interface Stage4Record {
  code: string
  name: string
  lowScore: boolean
  calibrationTriggered: boolean
  reFetched: boolean
  reScored: boolean
  backtrackPlan: string[]
  scoreBefore: number
  scoreAfter: number
}

export type PoolDestination = 'research' | 'observation'

export interface Stage6Record {
  code: string
  name: string
  classification: StrategyClassification
  selected: boolean
  destination: PoolDestination
  transitionOk: boolean
  transitionTarget: string
  transitionError?: string
}

export interface PipelineResult {
  meta: {
    generatedAt: string
    sampleSize: number
    heldCount: number
    hkCount: number
    scoreCalibrationThreshold: number
    environment: string
  }
  stage1: { perStock: Stage1Record[]; success: number; total: number }
  stage2: { perStock: Stage2Record[]; quoteOk: number; klineOk: number; dqOk: number; updateOk: number }
  stage3: { perStock: Stage3Record[]; scoreOk: number; inRange: number }
  stage4: { perStock: Stage4Record[]; triggered: number }
  stage5: {
    summary: StrategyResult['summary']
    coreScarce: string[]
    valueBargain: string[]
    hotMomentum: string[]
    excluded: string[]
    selected: string[]
  }
  stage6: { perStock: Stage6Record[]; researchCount: number; observationCount: number }
}

// ============================================================
// 低分回溯方案推导
// ============================================================

/**
 * 根据 V6 layerDetails 定位低分层，生成"回溯处理方案"建议。
 * 取评分低于该层权重加权均值 50% 的层作为建议补足维度。
 */
function deriveBacktrackPlan(score: V6Score | undefined): string[] {
  if (!score?.layerDetails) return ['无分层明细，建议补齐基础行情与财务数据']
  const layers = Object.entries(score.layerDetails) as [string, { score?: number; weight?: number }][]
  if (layers.length === 0) return ['无分层明细']
  const planned: string[] = []
  for (const [layerId, detail] of layers) {
    const ls = detail?.score ?? 0
    const lw = detail?.weight ?? 0
    // V6 分层为 0-5 尺度，低于 2.5(50%) 视为低分，建议回溯补足
    if (lw > 0 && ls < 2.5) {
      planned.push(`低分层 ${layerId}(分=${ls.toFixed(1)}): 建议重采集对应维度数据后重评分`)
    }
  }
  return planned.length ? planned : ['各分层均达标，无需回溯']
}

// ============================================================
// 主编排器
// ============================================================

/**
 * 运行投研全链路。
 * @param input 股票输入列表（含 8 持仓必含 + 随机 + 港股）
 * @param deps 注入依赖（采集器必填，其余真实引擎）
 */

/**
 * 将 K 线数据转换为 daily_quotes 并持久化，回填 s2 的执行状态。
 * 抽取为独立辅助函数以压低 Stage2 采集循环内的嵌套深度。
 */
async function persistDailyQuotesStage(
  code: string,
  s2: Pick<Stage2Record, 'klineError' | 'dqPersistOk'>,
  klines: KlineBar[],
): Promise<void> {
  if (klines.length === 0) return
  try {
    const dq = klinesToDailyQuotes(code, klines)
    await dataBridge.forward(
      EnvelopeFactory.create(
        { source: MODULE_ID.fetcher, target: ENVELOPE_TARGET.db, action: ENVELOPE_ACTION.saveDailyQuotes, traceId: `pipe-dq-${code}` },
        dq,
      ),
    )
    const back = await queryGet(STORE_NAME.dailyQuotes, code)
    s2.dqPersistOk = back != null
  } catch (e) {
    const dqErr = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error'
    s2.klineError = (s2.klineError ?? '') + ` dq:${dqErr}`
  }
}

/**
 * 对单只个股执行校准（低分触发）：若低分则回溯调参并在需要时重评。
 * 返回是否触发校准（0/1），复现原循环内 triggered 累计逻辑，且压低循环嵌套深度。
 */
async function runCalibrationForRecord(
  rec: Stage4Record,
  s3: Stage3Record,
  calibrator: ResearchPipelineDeps['calibrator'],
  scorer: ResearchPipelineDeps['scorer'],
): Promise<number> {
  if (!rec.lowScore) return 0
  rec.calibrationTriggered = true
  const sc = (s3.layerDetails as V6Score) ?? undefined
  rec.backtrackPlan = deriveBacktrackPlan(sc)
  if (calibrator) {
    const cal = await calibrator.calibrate(s3.code)
    rec.reFetched = cal.reFetched
    rec.reScored = cal.reScored
    rec.backtrackPlan = cal.backtrackPlan.length ? cal.backtrackPlan : rec.backtrackPlan
    if (cal.reScored) {
      const sr = await scorer.run(s3.code)
      rec.scoreAfter = sr.data?.score ?? s3.score
    }
  }
  return 1
}

export async function runResearchPipeline(
  input: PipelineStockInput[],
  deps: ResearchPipelineDeps,
): Promise<PipelineResult> {
  const {
    collector,
    scorer,
    strategy,
    pool,
    calibrator,
    scoreCalibrationThreshold = 3.0,
    referenceValue,
    klineCount = 60,
    theme,
    ruleConfig,
    momentumMap,
    sectorResolver,
  } = deps

  logger.info('[ResearchPipeline] 启动', { sampleSize: input.length, threshold: scoreCalibrationThreshold })

  // ── Stage1 输入舱：批量导入 ──
  const stage1PerStock: Stage1Record[] = []
  let importSuccess = 0
  for (const s of input) {
    const rec: Stage1Record = {
      code: s.code,
      symbol: s.code,
      name: s.name,
      held: s.held,
      market: s.market,
      importOk: false,
    }
    try {
      const res = await importStocks([{ code: s.code, name: s.name, symbol: s.code, status: 'valid' }])
      rec.importOk = res.success && (res.data?.success ?? 0) >= 1
      if (rec.importOk) importSuccess++
      else rec.importError = 'import 返回失败'
    } catch (e) {
      rec.importError = String(e)
    }
    stage1PerStock.push(rec)
  }

  // ── Stage2 采集 + 存放；Stage3 评分 ──
  const stage2PerStock: Stage2Record[] = []
  const stage3PerStock: Stage3Record[] = []
  const refMap = referenceValue
    ? new Map(input.map((s) => [s.code, referenceValue(s.code)]))
    : new Map<string, { pe: number; pb: number; marketCap: number }>()

  for (const s of input) {
    const code = s.code
    const ref = refMap.get(code) ?? { pe: 20, pb: 2, marketCap: 1e11 }
    const s2: Stage2Record = {
      code,
      name: s.name,
      held: s.held,
      market: s.market,
      quoteOk: false,
      klineOk: false,
      klineLen: 0,
      dqPersistOk: false,
      stockUpdateOk: false,
      price: 0,
      prevClose: 0,
      pe: ref.pe,
      pb: ref.pb,
    }
    const s3: Stage3Record = {
      code,
      name: s.name,
      held: s.held,
      market: s.market,
      scoreOk: false,
      score: 0,
      rating: '',
      inRange: false,
      layersFinite: false,
      noNaN: false,
    }

    // 采集：行情
    try {
      const q = await collector.fetchQuote(code)
      s2.quoteOk = !!q && Number.isFinite(q.price) && q.price > 0
      s2.price = q?.price ?? 0
      // RealtimeQuote 协议不含 prevClose（见 directDataAPI.ts 接口注释），下游回退值已处理，此处置 0
      s2.prevClose = 0
    } catch (e) {
      s2.quoteError = String(e)
    }

    // 采集：K线 → 持久化 daily_quotes
    let klines: KlineBar[] = []
    try {
      klines = await collector.fetchKline(code, klineCount)
      s2.klineLen = klines.length
      s2.klineOk =
        klines.length >= 20 &&
        klines.every(
          (b) =>
            b.high >= Math.max(b.open, b.close) - 1e-6 &&
            b.low <= Math.min(b.open, b.close) + 1e-6 &&
            Number.isFinite(b.close),
        )
    } catch (e) {
      s2.klineError = String(e)
    }

    await persistDailyQuotesStage(code, s2, klines)

    // stock 更新（行情价 + 参考估值回填 + 板块/行业代码回填）
    const enr = sectorResolver?.(code)
    const enrichFields: Record<string, unknown> = {}
    if (enr?.sector !== undefined) enrichFields.sector = enr.sector
    if (enr?.industryCode !== undefined) enrichFields.industryCode = enr.industryCode
    try {
      await dataBridge.forward(
        EnvelopeFactory.create(
          { source: MODULE_ID.pool, target: ENVELOPE_TARGET.db, action: ENVELOPE_ACTION.updateStock, traceId: `pipe-enrich-${code}` },
          {
            symbol: code,
            price: s2.price || 10,
            prevClose: s2.prevClose || 10,
            pe: ref.pe,
            pb: ref.pb,
            marketCap: ref.marketCap,
            updatedAt: Date.now(),
            ...enrichFields,
          },
        ),
      )
      const st = await dataBridge.query<Stock>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.stocks, key: code, source: MODULE_ID.pool })
      s2.stockUpdateOk = st.success && !!st.data && Number.isFinite(st.data.price) && (st.data.price ?? 0) > 0
    } catch (e) {
      const updErr = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error'
        s2.klineError = (s2.klineError ?? '') + ` upd:${updErr}`
    }

    // 评分：V6
    try {
      const sr = await scorer.run(code)
      const sc = sr.data
      s3.scoreOk = sr.success && !!sc
      s3.score = sc?.score ?? 0
      s3.rating = sc?.rating ?? ''
      s3.inRange = Number.isFinite(s3.score) && s3.score >= 0 && s3.score <= 100
      s3.layersFinite = !!sc && !!sc.layerDetails && Object.values(sc.layerDetails).every((l: { score?: number; weight?: number }) => Number.isFinite(l?.score) && Number.isFinite(l?.weight))
      s3.noNaN = !!sc && !/NaN/.test(JSON.stringify(sc))
      s3.layerDetails = sc?.layerDetails ?? null
    } catch (e) {
      s3.scoreError = String(e)
    }

    stage2PerStock.push(s2)
    stage3PerStock.push(s3)
  }

  // ── Stage4 评分过低 → 校对/回溯（缺口①）──
  const stage4PerStock: Stage4Record[] = []
  let triggered = 0
  for (const s3 of stage3PerStock) {
    const lowScore = s3.scoreOk && s3.score < scoreCalibrationThreshold
    const rec: Stage4Record = {
      code: s3.code,
      name: s3.name,
      lowScore,
      calibrationTriggered: false,
      reFetched: false,
      reScored: false,
      backtrackPlan: [],
      scoreBefore: s3.score,
      scoreAfter: s3.score,
    }
    triggered += await runCalibrationForRecord(rec, s3, calibrator, scorer)
    stage4PerStock.push(rec)
  }

  // ── Stage5 策略三分类（核心/价值洼地/热门）──
  const stocksResult = await dataBridge.query<Stock[]>({ action: ENVELOPE_ACTION.queryList, store: STORE_NAME.stocks, source: MODULE_ID.system })
  const stocks = stocksResult.data ?? []
  const strategyResult = await strategy.run(stocks, {
    theme,
    ruleConfig: ruleConfig ?? getDefaultStrategyRuleConfig(),
    momentumMap,
  })
  const stage5 = {
    summary: strategyResult.summary,
    coreScarce: strategyResult.coreScarce.map((c) => c.symbol),
    valueBargain: strategyResult.valueBargain.map((c) => c.symbol),
    hotMomentum: strategyResult.hotMomentum.map((c) => c.symbol),
    excluded: strategyResult.rejected.map((c) => c.symbol),
    selected: strategyResult.selected.map((c) => c.symbol),
  }

  // ── Stage6 选股入池 + 纳入长期观察池 ──
  const selectedSet = new Set(stage5.selected)
  const stage6PerStock: Stage6Record[] = []
  let researchCount = 0
  let observationCount = 0
  for (const c of strategyResult.selected) {
    const ok = await pool.transition(c.symbol, { pool: POOL_TYPE.research, status: RESEARCH_STATUS.candidate, label: '晋升研究' })
    researchCount++
    stage6PerStock.push({
      code: c.symbol,
      name: c.name,
      classification: c.classification,
      selected: true,
      destination: 'research',
      transitionOk: ok.success,
      transitionTarget: 'research.candidate',
      transitionError: ok.error,
    })
  }
  // 观察池：未入选的标的全部纳入（以输入全量为准，按 symbol 去重，
  // 避免 R2 重分类/未进 TopN 的标的在 coreScarce/valueBargain/hotMomentum/rejected
  // 中重复出现导致重复计数）。
  const classificationBySymbol = new Map<string, { classification: StrategyClassification; name: string }>()
  for (const c of [
    ...strategyResult.selected,
    ...strategyResult.coreScarce,
    ...strategyResult.valueBargain,
    ...strategyResult.hotMomentum,
    ...strategyResult.rejected,
  ]) {
    classificationBySymbol.set(c.symbol, { classification: c.classification, name: c.name })
  }
  const observed = new Set<string>()
  for (const s of input) {
    const sym = s.code
    if (selectedSet.has(sym)) continue
    if (observed.has(sym)) continue
    observed.add(sym)
    const info = classificationBySymbol.get(sym) ?? { classification: 'excluded' as StrategyClassification, name: s.name }
    const ok = await pool.transition(sym, { pool: POOL_TYPE.intention, status: INTENTION_STATUS.watchlist, label: '加入观察' })
    observationCount++
    stage6PerStock.push({
      code: sym,
      name: info.name,
      classification: info.classification,
      selected: false,
      destination: 'observation',
      transitionOk: ok.success,
      transitionTarget: 'intention.watchlist',
      transitionError: ok.error,
    })
  }

  logger.info('[ResearchPipeline] 完成', {
    importSuccess,
    triggered,
    researchCount,
    observationCount,
  })

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      sampleSize: input.length,
      heldCount: input.filter((s) => s.held).length,
      hkCount: input.filter((s) => s.market === 'HK').length,
      scoreCalibrationThreshold,
      environment: 'researchPipelineOrchestrator + 注入采集器',
    },
    stage1: { perStock: stage1PerStock, success: importSuccess, total: input.length },
    stage2: {
      perStock: stage2PerStock,
      quoteOk: stage2PerStock.filter((r) => r.quoteOk).length,
      klineOk: stage2PerStock.filter((r) => r.klineOk).length,
      dqOk: stage2PerStock.filter((r) => r.dqPersistOk).length,
      updateOk: stage2PerStock.filter((r) => r.stockUpdateOk).length,
    },
    stage3: {
      perStock: stage3PerStock,
      scoreOk: stage3PerStock.filter((r) => r.scoreOk).length,
      inRange: stage3PerStock.filter((r) => r.inRange).length,
    },
    stage4: { perStock: stage4PerStock, triggered },
    stage5,
    stage6: { perStock: stage6PerStock, researchCount, observationCount },
  }
}
