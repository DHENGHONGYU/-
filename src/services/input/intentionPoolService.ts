/**
 * @module intentionPoolService
 * @description 意向候选池数据服务（输入舱对外只读契约）。
 *
 * 作为「输入舱 → 分析舱」数据桥接的防腐层：
 * - 通过 DataBridge 信封协议读取 `stocks` store（pool='intention'）的意向候选池
 * - join `v6Scores` store 补充已有评分，返回分析舱可消费的 AnalysisCandidate[]
 * - 支持来源（hot-sector/manual）与分组过滤
 *
 * 消费方：
 * - @/store/analysisStore.ts —— 分析舱 loadStocks('intention') 走此服务
 *
 * 注：intentionPoolStore.refresh() 保留自身优化查询（PoolItem 形态 + 详细日志），
 * 不强制重构，避免为意向池 UI 热路径引入多余 v6Scores 查询（见设计文档 §M1 取舍）。
 *
 * @see @/types/modules/analysis.types.ts - 契约类型
 * @see @/core/databridge.ts - 信封协议
 */
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { POOL_TYPE } from '@/constants/pool.constants'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult, Stock, V6Score } from '@/data/types'
import type {
  AnalysisCandidate,
  AnalysisCandidateQuery,
} from '@/types/modules/analysis.types'

const logger = getLogger()

/**
 * 将 Stock 映射为 AnalysisCandidate（契约类型）。
 * 缺失字段由消费方降级处理。
 */
function toAnalysisCandidate(stock: Stock, v6Score?: number): AnalysisCandidate {
  return {
    symbol: stock.symbol,
    name: stock.name,
    screenSource: stock.screenSource,
    group: stock.group,
    dataQuality: stock.dataQuality,
    price: stock.price,
    pe: stock.pe,
    pb: stock.pb,
    v6Score,
    ingestedAt: stock.ingestedAt,
  }
}

/**
 * 读取 v6Scores store 构建 symbol → score 索引（去重保留首条）。
 */
async function loadV6ScoreMap(): Promise<Map<string, number>> {
  const scoreMap = new Map<string, number>()
  try {
    const result = await dataBridge.query<V6Score[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.v6Scores,
      source: MODULE_ID.pool,
    })
    if (!result.success) return scoreMap
    for (const score of result.data ?? []) {
      if (!scoreMap.has(score.symbol)) {
        scoreMap.set(score.symbol, score.score)
      }
    }
  } catch (err) {
    // 评分缺失不阻塞候选列表，降级为无评分展示
    logger.warn('[intentionPoolService] 读取 v6Scores 失败，降级无评分', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return scoreMap
}

/**
 * 列出意向候选池中待分析的标的（分析舱消费输入舱数据的只读契约）。
 *
 * @param query 拉取参数（scope/screenSource/group）
 */
export async function listIntentionCandidates(
  query: AnalysisCandidateQuery = { scope: 'intention' },
): Promise<DataLayerResult<AnalysisCandidate[]>> {
  try {
    // 1. 按 by-pool 索引读取意向候选池
    const stockResult = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.stocks,
      indexName: 'by-pool',
      indexValue: POOL_TYPE.intention,
      source: MODULE_ID.pool,
    })
    if (!stockResult.success) {
      return { success: false, error: stockResult.error }
    }

    let stocks = (stockResult.data ?? []).filter((s) => s.pool === POOL_TYPE.intention)

    // 2. 来源 / 分组过滤
    if (query.screenSource !== undefined) {
      stocks = stocks.filter((s) => s.screenSource === query.screenSource)
    }
    if (query.group !== undefined) {
      stocks = stocks.filter((s) => s.group === query.group)
    }

    // 3. join 已有 V6 评分（缺失不阻塞）
    const scoreMap = await loadV6ScoreMap()

    // 4. 映射 + 按入库时间倒序（最新在前）
    const candidates = stocks
      .sort((a, b) => (b.ingestedAt ?? 0) - (a.ingestedAt ?? 0))
      .map((s) => toAnalysisCandidate(s, scoreMap.get(s.symbol)))

    return { success: true, data: candidates }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
