/**
 * @module services/useCase/fetcherOrchestrator.useCase
 * @description 数据采集编排执行用例
 *
 * 封装对 fetcher 域的跨域调用，使 input 域可通过 UseCase 合法获取
 * 股票基础数据和 K 线数据，避免 Service 之间的直接耦合。
  * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
*/

import { getLogger } from '@/lib/logger'
import { fetchStockBasic, fetchStockKline, type FetchKlineOptions } from '@/services/fetcher/fetcherService'
import type { DataLayerResult, Stock } from '@/data/types'

const logger = getLogger()

export interface FetchBasicDataInput {
  symbol: string
}

export interface FetchKlineDataInput {
  symbol: string
  options?: FetchKlineOptions
}

/**
 * 获取股票基础数据执行用例
 *
 * @param input 包含股票代码
 * @returns 更新后的股票数据或错误信息
 */
export async function fetchBasicDataUseCase(
  input: FetchBasicDataInput,
): Promise<DataLayerResult<Stock>> {
  logger.info('[fetcherOrchestratorUseCase] fetchBasicData 开始', { symbol: input.symbol })

  try {
    const result = await fetchStockBasic(input.symbol)

    if (result.success) {
      logger.info('[fetcherOrchestratorUseCase] fetchBasicData 成功', {
        symbol: input.symbol,
        dataVersion: result.data?.dataVersion,
      })
    } else {
      logger.warn('[fetcherOrchestratorUseCase] fetchBasicData 失败', {
        symbol: input.symbol,
        error: result.error,
      })
    }

    return result
  } catch (err) {
    logger.error('[fetcherOrchestratorUseCase] fetchBasicData 异常', {
      symbol: input.symbol,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 获取股票 K 线数据执行用例
 *
 * @param input 包含股票代码和可选的 K 线配置
 * @returns 更新后的股票数据或错误信息
 */
export async function fetchKlineDataUseCase(
  input: FetchKlineDataInput,
): Promise<DataLayerResult<Stock>> {
  logger.info('[fetcherOrchestratorUseCase] fetchKlineData 开始', {
    symbol: input.symbol,
    period: input.options?.period ?? 'daily',
  })

  try {
    const result = await fetchStockKline(input.symbol, input.options)

    if (result.success) {
      logger.info('[fetcherOrchestratorUseCase] fetchKlineData 成功', {
        symbol: input.symbol,
        dataVersion: result.data?.dataVersion,
      })
    } else {
      logger.warn('[fetcherOrchestratorUseCase] fetchKlineData 失败', {
        symbol: input.symbol,
        error: result.error,
      })
    }

    return result
  } catch (err) {
    logger.error('[fetcherOrchestratorUseCase] fetchKlineData 异常', {
      symbol: input.symbol,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
