/**
 * @fileoverview DataBridge 策略路由器
 *
 * 从 databridge.ts 拆分而来，职责：
 * - 定义 STRATEGY_CHANNEL 频道常量与 StrategyChannel 类型
 * - 处理策略类 action（hotSectorRefresh / valuePitRefresh / rotationSignalDetect）
 *   的输入校验、逐板块评分/检测、汇总、广播与 EventBus 事件触发
 *
 * 设计原则：通过 StrategyRouterContext 注入 subscribers 与 broadcast 回调，
 * 使策略路由逻辑与 DataBridge 主类解耦，可独立单元测试。
 */
import { ENVELOPE_ACTION } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { analyze as analyzeHotSector, type HotSectorAnalyzerInput } from '@/services/scoring/hotSectorAnalyzer'
import { detect as detectRotation, type RotationSignalInput } from '@/services/scoring/rotationSignalDetector'
import { analyze as analyzeValuePit, type ValuePitAnalyzerInput } from '@/services/scoring/valuePitAnalyzer'
import { EnvelopeError, type StandardEnvelope } from './envelope'

const logger = getLogger()

/**
 * 信封回调类型（与 DataBridge 内部保持一致）
 */
type EnvelopeCallback = (envelope: StandardEnvelope) => void

/**
 * 策略数据流订阅频道名称常量。
 * 外部组件通过 `dataBridge.subscribe(STRATEGY_CHANNEL.hotSector, cb)` 订阅。
 */
export const STRATEGY_CHANNEL = {
  hotSector: 'strategy:hotSector',
  valuePit: 'strategy:valuePit',
  rotationSignal: 'strategy:rotationSignal',
} as const

export type StrategyChannel = (typeof STRATEGY_CHANNEL)[keyof typeof STRATEGY_CHANNEL]

/**
 * 策略路由上下文
 * 通过依赖注入提供 subscribers 与 broadcast，使路由逻辑可独立测试。
 */
export interface StrategyRouterContext {
  /** 订阅者映射，用于日志统计订阅者数量 */
  subscribers: Map<string, Set<EnvelopeCallback>>
  /** 广播回调，用于将策略结果推送到频道订阅者 */
  broadcast: (channel: string, envelope: StandardEnvelope) => void
}

/**
 * 策略路由主入口
 *
 * 根据 envelope.meta.action 分发到对应的策略处理器：
 * - strategyHotSectorRefresh → 热门板块五维度评分
 * - strategyValuePitRefresh → 价值洼地五维度评分
 * - strategyRotationSignalDetect → 轮动信号检测
 *
 * @param envelope 标准信封
 * @param context 路由上下文（subscribers + broadcast）
 * @throws {EnvelopeError} 未知 action 或 payload 校验失败时抛出
/**
 * routeToStrategy
 */
export function routeToStrategy(
  envelope: StandardEnvelope,
  context: StrategyRouterContext,
): void {
  const startTs = Date.now()
  const { meta, payload } = envelope
  logger.info(`[DataBridge] routeToStrategy() called: action="${meta.action}"`)

  try {
    switch (meta.action) {
      case ENVELOPE_ACTION.strategyHotSectorRefresh: {
        handleHotSectorRefresh(envelope, payload, context)
        break
      }

      case ENVELOPE_ACTION.strategyValuePitRefresh: {
        handleValuePitRefresh(envelope, payload, context)
        break
      }

      case ENVELOPE_ACTION.strategyRotationSignalDetect: {
        handleRotationSignalDetect(envelope, payload, context)
        break
      }

      default: {
        logger.error(`[DataBridge] routeToStrategy() failed: Unknown action "${meta.action}"`)
        throw new EnvelopeError(`Unknown strategy action: ${meta.action}`)
      }
    }

    const duration = Date.now() - startTs
    logger.info(`[DataBridge] routeToStrategy() completed: action="${meta.action}", duration=${duration}ms`)
  } catch (err) {
    logger.error(`[DataBridge] routeToStrategy() failed: action="${meta.action}"`, { error: err })
    throw err
  }
}

/**
 * 热门板块刷新处理器
 * 逐板块执行五维度评分（动量/情绪/技术/估值/大盘），汇总后广播到 STRATEGY_CHANNEL.hotSector
 */
function handleHotSectorRefresh(
  envelope: StandardEnvelope,
  payload: unknown,
  context: StrategyRouterContext,
): void {
  const { meta } = envelope
  try {
    // ===== 1. 输入校验 =====
    const inputs = payload as HotSectorAnalyzerInput[]
    if (!Array.isArray(inputs)) {
      const err = new EnvelopeError('HotSector: payload 必须是数组')
      logger.error(`[DataBridge] HotSector refresh: payload 校验失败`, { error: err })
      throw err
    }
    logger.info(`[DataBridge] HotSector refresh: 输入数量=${inputs.length}, 板块列表=[${inputs.map((i) => i.symbol).join(', ')}]`)

    // ===== 2. 逐板块评分 =====
    const scores = inputs.map((input) => {
      const score = analyzeHotSector(input)
      logger.info(
        `[DataBridge] HotSector: ${input.symbol} ` +
        `momentum=${score.dimensions.momentum.toFixed(2)} ` +
        `sentiment=${score.dimensions.sentiment.toFixed(2)} ` +
        `technical=${score.dimensions.technical.toFixed(2)} ` +
        `valuation=${score.dimensions.valuation.toFixed(2)} ` +
        `marketEnv=${(score.dimensions.marketEnv ?? 0).toFixed(2)} ` +
        `→ score=${score.score.toFixed(2)} action=${score.action}`,
      )
      return score
    })

    // ===== 3. 评分汇总 =====
    const avgScore = scores.reduce((s, c) => s + c.score, 0) / scores.length
    const maxScore = Math.max(...scores.map((s) => s.score))
    const minScore = Math.min(...scores.map((s) => s.score))
    const immediateCount = scores.filter((s) => s.action === 'immediate').length
    const probeCount = scores.filter((s) => s.action === 'probe').length
    const ignoreCount = scores.filter((s) => s.action === 'ignore').length
    logger.info(
      `[DataBridge] HotSector 评分汇总: ` +
      `avg=${avgScore.toFixed(2)} max=${maxScore.toFixed(2)} min=${minScore.toFixed(2)} ` +
      `immediate=${immediateCount} probe=${probeCount} ignore=${ignoreCount}`,
    )

    // ===== 4. 广播到策略频道 =====
    const subscriberCount = context.subscribers.get(STRATEGY_CHANNEL.hotSector)?.size ?? 0
    logger.info(`[DataBridge] HotSector: 准备广播到 channel="${STRATEGY_CHANNEL.hotSector}", 订阅者数=${subscriberCount}`)

    const channelEnvelope: StandardEnvelope = {
      ...envelope,
      payload: scores,
      meta: { ...meta, target: STRATEGY_CHANNEL.hotSector },
    }
    context.broadcast(STRATEGY_CHANNEL.hotSector, channelEnvelope)
    logger.info(`[DataBridge] HotSector: channel="${STRATEGY_CHANNEL.hotSector}" 广播完成`)

    // ===== 5. EventBus 事件 =====
    eventBus.emit(EVENT_NAMES.HOT_SECTOR_CHANGED, scores)
    logger.info(`[DataBridge] HotSector: EventBus emit "${EVENT_NAMES.HOT_SECTOR_CHANGED}" 完成, payload.length=${scores.length}`)
  } catch (err) {
    logger.error(`[DataBridge] HotSector refresh 失败`, { error: err })
    throw err
  }
}

/**
 * 价值洼地刷新处理器
 * 逐板块执行五维度评分（催化剂/估值/筹码/轮动/流动性），汇总后广播到 STRATEGY_CHANNEL.valuePit
 */
function handleValuePitRefresh(
  envelope: StandardEnvelope,
  payload: unknown,
  context: StrategyRouterContext,
): void {
  const { meta } = envelope
  try {
    // ===== 1. 输入校验 =====
    const inputs = payload as ValuePitAnalyzerInput[]
    if (!Array.isArray(inputs)) {
      const err = new EnvelopeError('ValuePit: payload 必须是数组')
      logger.error(`[DataBridge] ValuePit refresh: payload 校验失败`, { error: err })
      throw err
    }
    logger.info(`[DataBridge] ValuePit refresh: 输入数量=${inputs.length}, 板块列表=[${inputs.map((i) => i.symbol).join(', ')}]`)

    // ===== 2. 逐板块评分 =====
    const scores = inputs.map((input) => {
      const score = analyzeValuePit(input)
      logger.info(
        `[DataBridge] ValuePit: ${input.symbol} ` +
        `catalyst=${score.dimensions.catalyst.toFixed(2)} ` +
        `valuation=${score.dimensions.valuation.toFixed(2)} ` +
        `chip=${score.dimensions.chip.toFixed(2)} ` +
        `rotation=${score.dimensions.rotation.toFixed(2)} ` +
        `liquidity=${score.dimensions.liquidity.toFixed(2)} ` +
        `→ score=${score.score.toFixed(2)} action=${score.action}`,
      )
      return score
    })

    // ===== 3. 评分汇总 =====
    const avgScore = scores.reduce((s, c) => s + c.score, 0) / scores.length
    const maxScore = Math.max(...scores.map((s) => s.score))
    const minScore = Math.min(...scores.map((s) => s.score))
    const immediateCount = scores.filter((s) => s.action === 'immediate').length
    const probeCount = scores.filter((s) => s.action === 'probe').length
    const waitCount = scores.filter((s) => s.action === 'wait').length
    const ignoreCount = scores.filter((s) => s.action === 'ignore').length
    logger.info(
      `[DataBridge] ValuePit 评分汇总: ` +
      `avg=${avgScore.toFixed(2)} max=${maxScore.toFixed(2)} min=${minScore.toFixed(2)} ` +
      `immediate=${immediateCount} probe=${probeCount} wait=${waitCount} ignore=${ignoreCount}`,
    )

    // ===== 4. 广播到策略频道 =====
    const subscriberCount = context.subscribers.get(STRATEGY_CHANNEL.valuePit)?.size ?? 0
    logger.info(`[DataBridge] ValuePit: 准备广播到 channel="${STRATEGY_CHANNEL.valuePit}", 订阅者数=${subscriberCount}`)

    const channelEnvelope: StandardEnvelope = {
      ...envelope,
      payload: scores,
      meta: { ...meta, target: STRATEGY_CHANNEL.valuePit },
    }
    context.broadcast(STRATEGY_CHANNEL.valuePit, channelEnvelope)
    logger.info(`[DataBridge] ValuePit: channel="${STRATEGY_CHANNEL.valuePit}" 广播完成`)

    // ===== 5. EventBus 事件 =====
    eventBus.emit(EVENT_NAMES.VALUE_PIT_CHANGED, scores)
    logger.info(`[DataBridge] ValuePit: EventBus emit "${EVENT_NAMES.VALUE_PIT_CHANGED}" 完成, payload.length=${scores.length}`)
  } catch (err) {
    logger.error(`[DataBridge] ValuePit refresh 失败`, { error: err })
    throw err
  }
}

/**
 * 轮动信号检测处理器
 * 逐板块检测轮动信号（成交量突破/资金流入/金叉），汇总后广播到 STRATEGY_CHANNEL.rotationSignal
 */
function handleRotationSignalDetect(
  envelope: StandardEnvelope,
  payload: unknown,
  context: StrategyRouterContext,
): void {
  const { meta } = envelope
  try {
    // ===== 1. 输入校验 =====
    const inputs = payload as RotationSignalInput[]
    if (!Array.isArray(inputs)) {
      const err = new EnvelopeError('RotationSignal: payload 必须是数组')
      logger.error(`[DataBridge] RotationSignal detect: payload 校验失败`, { error: err })
      throw err
    }
    logger.info(
      `[DataBridge] RotationSignal detect: 输入数量=${inputs.length}, ` +
      `板块列表=[${inputs.map((i) => i.sectorId).join(', ')}], ` +
      `成交量数据量=[${inputs.map((i) => i.volume.history.length).join(', ')}], ` +
      `资金流数据量=[${inputs.map((i) => i.capitalFlow.dailyNetFlow.length).join(', ')}], ` +
      `收盘价数据量=[${inputs.map((i) => i.goldenCross.closes.length).join(', ')}]`,
    )

    // ===== 2. 逐板块检测 =====
    const signals = inputs.map((input) => {
      const signal = detectRotation(input)
      logger.info(
        `[DataBridge] RotationSignal: ${input.sectorId} ` +
        `volumeBreakthrough=${signal.conditions.volumeBreakthrough} ` +
        `capitalInflow=${signal.conditions.capitalInflow} ` +
        `goldenCross=${signal.conditions.goldenCross} ` +
        `→ triggered=${signal.triggered} strength=${signal.strength}`,
      )
      return signal
    })

    // ===== 3. 检测汇总 =====
    const triggeredCount = signals.filter((s) => s.triggered).length
    const notTriggeredCount = signals.length - triggeredCount
    const strongCount = signals.filter((s) => s.strength === 'strong').length
    const mediumCount = signals.filter((s) => s.strength === 'medium').length
    const weakCount = signals.filter((s) => s.strength === 'weak').length
    const triggeredList = signals.filter((s) => s.triggered).map((s) => s.sectorId)
    logger.info(
      `[DataBridge] RotationSignal 检测汇总: ` +
      `总=${signals.length} 触发=${triggeredCount} 未触发=${notTriggeredCount} ` +
      `strong=${strongCount} medium=${mediumCount} weak=${weakCount} ` +
      `触发板块=[${triggeredList.join(', ') || '无'}]`,
    )

    // ===== 4. 广播到策略频道 =====
    const subscriberCount = context.subscribers.get(STRATEGY_CHANNEL.rotationSignal)?.size ?? 0
    logger.info(`[DataBridge] RotationSignal: 准备广播到 channel="${STRATEGY_CHANNEL.rotationSignal}", 订阅者数=${subscriberCount}`)

    const channelEnvelope: StandardEnvelope = {
      ...envelope,
      payload: signals,
      meta: { ...meta, target: STRATEGY_CHANNEL.rotationSignal },
    }
    context.broadcast(STRATEGY_CHANNEL.rotationSignal, channelEnvelope)
    logger.info(`[DataBridge] RotationSignal: channel="${STRATEGY_CHANNEL.rotationSignal}" 广播完成`)

    // ===== 5. EventBus 事件 =====
    eventBus.emit(EVENT_NAMES.ROTATION_SIGNAL_TRIGGERED, signals)
    logger.info(`[DataBridge] RotationSignal: EventBus emit "${EVENT_NAMES.ROTATION_SIGNAL_TRIGGERED}" 完成, payload.length=${signals.length}`)
  } catch (err) {
    logger.error(`[DataBridge] RotationSignal detect 失败`, { error: err })
    throw err
  }
}
