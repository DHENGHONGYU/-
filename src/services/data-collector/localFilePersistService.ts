/**
 * @fileoverview 采集数据本地文件即时落盘服务
 *
 * 用户原则（2026-08-22）：采集来源稳定可采集、采集内容可存储、应采都采、
 * 采集及时存储当地文件。本服务在 collectionPipeline 各维度「写库成功」后
 * 立即将同一份数据落盘到本地文件夹，文件夹与命名规则由
 * src/config/collectionFileStorage.ts（文件夹接口配置）统一定义。
 *
 * 落盘内容封装为带元信息的信封：
 *   { _meta: { symbol, dimensionCode, source, collectedAt, version }, data: <原始采集数据> }
 *
 * 行为契约：
 *   - 仅在 Electron 环境（window.fileSync 存在）写真实文件系统；
 *     纯浏览器环境降级为 warn 跳过，绝不抛错、绝不阻塞采集主链路。
 *   - 落盘失败只记日志并返回 written:false，不向采集链路传播异常。
 *   - 与 collectedDataSyncService（批量导出）共用同一目录树，互为补充：
 *     本服务管「采后即存」，批量导出管「整批归档 + 汇总报告」。
 *
 * @module services/data-collector/localFilePersistService
 * @doc [V9-DOC-BACK-012, V9-DOC-DATA-047]
 */

import { getLogger } from '@/lib/logger'
import {
  COLLECTION_FILE_STORAGE,
  getDimensionFileFolderConfig,
  resolveCollectionFilePath,
} from '@/config/collectionFileStorage'
import type { ElectronFileSyncAPI } from './collectedDataSyncService'

const logger = getLogger()

declare global {
  interface Window {
    fileSync?: ElectronFileSyncAPI
  }
}

/** 即时落盘入参 */
export interface LocalFilePersistInput {
  /** 股票代码 */
  symbol: string
  /** 采集维度代码（'01'-'16'） */
  dimensionCode: string
  /** 已写库的同一份数据（对象或数组均可） */
  data: unknown
  /** 数据来源标识（如 westock / tushare / fetcher） */
  source?: string
  /** 采集时间戳（默认当前时间） */
  collectedAt?: number
}

/** 即时落盘结果（永不抛错） */
export interface LocalFilePersistResult {
  written: boolean
  /** 落盘成功时的完整路径（rootDir/relativePath） */
  path?: string
  /** 跳过/失败原因：config-disabled | dimension-disabled | dimension-unregistered | browser-env | write-failed */
  reason?: string
}

/** 落盘文件信封版本 */
const FILE_ENVELOPE_VERSION = '1.0.0' as const

/**
 * 将单条采集结果即时落盘到本地文件夹。
 *
 * 设计为「永不抛出」：任何失败路径都收敛为 { written:false, reason } + warn 日志，
 * 调用方（collectionPipeline 写库成功点）可安全 await 而不影响链路成败。
 *
 * @param input 采集结果与归属维度
 * @returns 落盘结果
 */
export async function persistCollectedDataToLocalFile(
  input: LocalFilePersistInput,
): Promise<LocalFilePersistResult> {
  const { symbol, dimensionCode, data, source, collectedAt = Date.now() } = input

  if (!COLLECTION_FILE_STORAGE.enabled) {
    return { written: false, reason: 'config-disabled' }
  }

  const dimCfg = getDimensionFileFolderConfig(dimensionCode)
  if (!dimCfg) {
    logger.warn('[localFilePersist] 维度未登记文件夹配置，跳过落盘', { symbol, dimensionCode })
    return { written: false, reason: 'dimension-unregistered' }
  }
  if (!dimCfg.enabled) {
    return { written: false, reason: 'dimension-disabled' }
  }

  const resolved = resolveCollectionFilePath(dimensionCode, symbol, collectedAt)
  if (!resolved) {
    return { written: false, reason: 'dimension-unregistered' }
  }

  if (typeof window === 'undefined' || !window.fileSync) {
    logger.warn('[localFilePersist] 非 Electron 环境（无 window.fileSync），跳过本地落盘', {
      symbol,
      dimensionCode,
      target: resolved.relativePath,
    })
    return { written: false, reason: 'browser-env' }
  }

  const envelope = {
    _meta: {
      symbol,
      dimensionCode,
      source: source ?? 'unknown',
      collectedAt,
      version: FILE_ENVELOPE_VERSION,
    },
    data,
  }

  try {
    const result = await window.fileSync.writeFiles({
      rootDir: resolved.rootDir,
      files: [{ relativePath: resolved.relativePath, content: JSON.stringify(envelope, null, 2) }],
    })
    if (!result.success) {
      logger.warn('[localFilePersist] Electron 写入返回失败', {
        symbol,
        dimensionCode,
        error: result.error,
      })
      return { written: false, reason: 'write-failed' }
    }
    const fullPath = `${result.rootDir}/${resolved.relativePath}`
    logger.info('[localFilePersist] 采集数据已即时落盘', {
      symbol,
      dimensionCode,
      path: fullPath,
    })
    return { written: true, path: fullPath }
  } catch (err) {
    logger.warn('[localFilePersist] 落盘异常（不阻塞采集链路）', {
      symbol,
      dimensionCode,
      error: err instanceof Error ? err.message : String(err),
    })
    return { written: false, reason: 'write-failed' }
  }
}
