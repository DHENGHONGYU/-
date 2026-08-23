/**
 * @fileoverview pipelineWriters
 * @description collectionPipeline 拆分（2026-08-23 遗留问题整改 P3）：
 * 采集数据经 DataBridge.forward() 写入 IndexedDB 的统一写入入口
 * （行情 / K 线 / 非行情维度；含 schema 字段补齐、auditRecord 断言、本地文件即时落盘）。
 *
 * @module services/data-collector/pipeline/pipelineWriters
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, ENVELOPE_TARGET } from '@/config/dbConfig'
import type { EnvelopeAction } from '@/config/dbConfig'
import {
  quoteToStock,
  klinesToDailyQuotes,
  type RealtimeQuote,
} from '../../fetcher/directDataAPI'
import type { KlineBar } from '@/data/types/types.marketData'
import { persistCollectedDataToLocalFile } from '../localFilePersistService'
import { auditRecord, reportQuoteCompleteness, reportKlineCompleteness } from './pipelineAudit'

const logger = getLogger()

/** 非行情维度（03–08, 10–16）的统一写入入口（真实数据 + KIMI AI 增强产物均经此写入） */
export async function writeDimensionData(
  symbol: string,
  dimensionCode: string,
  data: Record<string, unknown>,
  action: EnvelopeAction,
): Promise<void> {
  // local_docs keyPath=id：MCP/爬虫返回的维度数据常无 id 字段，缺 id 时合成，
  // 防 PutHandler db.put() 抛错（2026-08-21 接线修复，同时补齐 15/16 隐患）
  if (data.id == null || (typeof data.id === 'string' && data.id.trim() === '')) {
    data.id = `dim-${dimensionCode}-${symbol}-${new Date().toISOString().slice(0, 10)}`
  }

  // WAP Audit：校验 mock 数据关键字段
  const storeForDim: Record<string, string> = {
    '03': 'news', '04': 'news', '05': 'news',
    '06': 'sectorScores', '07': 'sectorScores',
    '08': 'researchLogs',
    '10': 'sectorCollectData',
    '11': 'dimensionCollectData', '12': 'dimensionCollectData',
    '13': 'dimensionCollectData', '14': 'dimensionCollectData',
    '15': 'localDocs', '16': 'localDocs',
  }
  const targetStore = storeForDim[dimensionCode] ?? ''

  // local_docs schema 字段补齐：symbol（by-symbol 索引可查）/ category / addedAt
  if (targetStore === 'localDocs') {
    data.symbol = data.symbol ?? symbol
    data.category = data.category ?? `collection_dim_${dimensionCode}`
    data.addedAt = data.addedAt ?? Date.now()
    data.name = data.name ?? `维度${dimensionCode}·${symbol}`
  }

  // sector_collect_data schema 字段补齐（v36）：symbol / dimensionCode / collectedAt / source
  if (targetStore === 'sectorCollectData') {
    data.symbol = data.symbol ?? symbol
    data.dimensionCode = data.dimensionCode ?? dimensionCode
    data.collectedAt = data.collectedAt ?? Date.now()
    data.source = data.source ?? (typeof data._source === 'string' ? data._source : undefined)
  }

  // dimension_collect_data schema 字段补齐（v38，遗留问题整改 P2）：symbol / dimensionCode / collectedAt / source
  if (targetStore === 'dimensionCollectData') {
    data.symbol = data.symbol ?? symbol
    data.dimensionCode = data.dimensionCode ?? dimensionCode
    data.collectedAt = data.collectedAt ?? Date.now()
    data.source = data.source ?? (typeof data._source === 'string' ? data._source : undefined)
  }

  if (targetStore !== '') auditRecord(targetStore, data)

  await dataBridge.forward({
    meta: {
      source: MODULE_ID.fetcher,
      target: ENVELOPE_TARGET.db,
      action,
      traceId: `pipeline-${dimensionCode}-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
    },
    payload: data,
  })

  // 本地文件即时落盘（用户原则：应采都采、及时存储；落盘失败不阻塞主链路）
  await persistCollectedDataToLocalFile({
    symbol,
    dimensionCode,
    data,
    source: typeof data._source === 'string' ? data._source : undefined,
  })
}

/** 行情写入 stocks（updateStock 优先，新股票回退 insertStock） */
export async function writeQuoteToStock(symbol: string, quote: RealtimeQuote, source?: string): Promise<void> {
  // 防御：上游已归一化 symbol，此处强制执行覆盖，防止 API 返回字段缺失导致 DB 写入被拒
  const stock = quoteToStock(quote, source)
  stock.symbol = symbol
  auditRecord('stocks', stock)
  reportQuoteCompleteness(quote)

  // 优先使用 updateStock（合并现有字段，不覆盖用户手动修改的 researchStatus/group 等）
  try {
    await dataBridge.forward({
      meta: {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.updateStock,
        traceId: `pipeline-stock-${symbol}-${Date.now()}`,
        timestamp: Date.now(),
      },
      payload: stock,
    })
    // 本地文件即时落盘（维度 01；失败不阻塞主链路）
    await persistCollectedDataToLocalFile({ symbol, dimensionCode: '01', data: stock, source })
    return
  } catch (err) {
    // 股票尚不存在时，updateStock 会因 UpdateStockHandler 找不到现有记录而抛错
    // 此时回退到 insertStock 做全量写入（新股票首次入库）
    if (err instanceof Error && err.message.includes('not found')) {
      logger.info(`[collectionPipeline] ${symbol} 为新股票，使用 insertStock 首次入库`)
    } else {
      logger.warn(`[collectionPipeline] ${symbol} updateStock 失败，回退 insertStock`, { error: err })
    }
  }

  await dataBridge.forward({
    meta: {
      source: MODULE_ID.fetcher,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.insertStock,
      traceId: `pipeline-stock-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
    },
    payload: stock,
  })
  // 本地文件即时落盘（维度 01 首次入库；失败不阻塞主链路）
  await persistCollectedDataToLocalFile({ symbol, dimensionCode: '01', data: stock, source })
}

/** K 线写入 daily_quotes */
export async function writeKlineToDailyQuotes(symbol: string, klines: KlineBar[], source?: string): Promise<void> {
  const dailyQuotes = klinesToDailyQuotes(symbol, klines, source)
  if (Array.isArray(dailyQuotes) && dailyQuotes.length > 0) {
    auditRecord('dailyQuotes', dailyQuotes[0])
  }
  reportKlineCompleteness(klines)
  await dataBridge.forward({
    meta: {
      source: MODULE_ID.fetcher,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.saveDailyQuotes,
      traceId: `pipeline-kline-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
    },
    payload: dailyQuotes,
  })
  // 本地文件即时落盘（维度 02；失败不阻塞主链路）
  await persistCollectedDataToLocalFile({ symbol, dimensionCode: '02', data: dailyQuotes, source })
}
