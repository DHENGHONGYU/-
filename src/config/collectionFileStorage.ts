/**
 * @fileoverview 采集数据本地文件存储配置（文件夹接口配置层）
 *
 * 用户原则（2026-08-22）：采集来源稳定可采集、采集内容可存储、应采都采、
 * 采集及时存储当地文件，且当地文件夹必须有对应的配置接口。
 *
 * 本模块即「文件夹接口配置」的单一真相源（config 层零硬编码锚点）：
 *   - rootDir：本地落盘根目录（Electron 环境经 window.fileSync IPC 写入真实文件系统）
 *   - dimensions：16 个采集维度 → 子文件夹 + 文件命名模板 + 维度级开关
 *   - 目录约定与 collectedDataSyncService 批量导出保持一致（{symbol}/{维度文件夹}/ 结构），
 *     及时落盘与批量导出写入同一套目录树，避免双口径。
 *
 * 文件命名模板占位符：
 *   {symbol}    股票代码（如 600519）
 *   {date}      采集日期 YYYY-MM-DD（按日留存历史快照，应采都采不覆盖）
 *   {dimension} 维度代码（如 '10'）
 *
 * @module config/collectionFileStorage
 * @doc [V9-DOC-DATA-047, V9-DOC-BACK-012]
 */

/** 单维度本地文件落盘配置 */
export interface DimensionFileFolderConfig {
  /** 子文件夹名（相对 rootDir/{symbol}/ 之下） */
  folder: string
  /** 文件命名模板，支持 {symbol} / {date} / {dimension} 占位符 */
  filePattern: string
  /** 该维度是否启用本地文件持久化 */
  enabled: boolean
}

/** 采集数据本地文件存储全局配置 */
export interface CollectionFileStorageConfig {
  /** 总开关：false 时所有维度跳过本地落盘 */
  enabled: boolean
  /** 本地落盘根目录（相对应用工作目录，Electron fileSync 安全根内） */
  rootDir: string
  /** 写入模式：immediate = 采集写库成功后立即落盘 */
  writeMode: 'immediate'
  /** 维度代码（'01'-'16'）→ 文件夹配置 */
  dimensions: Readonly<Record<string, DimensionFileFolderConfig>>
}

/**
 * 默认配置：16 维全量启用，文件夹命名与 collectedDataSyncService 批量导出对齐。
 * 修改文件夹/命名/开关只需改此表，业务代码零硬编码。
 */
export const COLLECTION_FILE_STORAGE: CollectionFileStorageConfig = {
  enabled: true,
  rootDir: 'outputs/collected-data',
  writeMode: 'immediate',
  dimensions: {
    '01': { folder: '01_基本信息', filePattern: '{symbol}_{date}.json', enabled: true },
    '02': { folder: '02_K线数据', filePattern: '{symbol}_{date}.json', enabled: true },
    '03': { folder: '03_筹码分布', filePattern: '{symbol}_{date}.json', enabled: true },
    '04': { folder: '04_重大事项', filePattern: '{symbol}_{date}.json', enabled: true },
    '05': { folder: '05_热点新闻', filePattern: '{symbol}_{date}.json', enabled: true },
    '06': { folder: '06_行业竞品', filePattern: '{symbol}_{date}.json', enabled: true },
    '07': { folder: '07_关联指数', filePattern: '{symbol}_{date}.json', enabled: true },
    '08': { folder: '08_研报中心', filePattern: '{symbol}_{date}.json', enabled: true },
    '09': { folder: '09_财务数据', filePattern: '{symbol}_{date}.json', enabled: true },
    '10': { folder: '10_热门板块', filePattern: '{symbol}_{date}.json', enabled: true },
    '11': { folder: '11_技术指标', filePattern: '{symbol}_{date}.json', enabled: true },
    '12': { folder: '12_资金流向', filePattern: '{symbol}_{date}.json', enabled: true },
    '13': { folder: '13_机构持仓', filePattern: '{symbol}_{date}.json', enabled: true },
    '14': { folder: '14_估值分析', filePattern: '{symbol}_{date}.json', enabled: true },
    '15': { folder: '15_分红股本', filePattern: '{symbol}_{date}.json', enabled: true },
    '16': { folder: '16_一致预期', filePattern: '{symbol}_{date}.json', enabled: true },
  },
}

/**
 * 查询维度文件夹配置。
 * @returns 配置项；维度未登记时返回 null（调用方应 skip 并 warn，禁止兜底硬编码路径）
 */
export function getDimensionFileFolderConfig(dimensionCode: string): DimensionFileFolderConfig | null {
  return COLLECTION_FILE_STORAGE.dimensions[dimensionCode] ?? null
}

/**
 * 解析采集数据本地落盘路径。
 *
 * @param dimensionCode 维度代码（'01'-'16'）
 * @param symbol 股票代码
 * @param at 采集时间戳（默认当前时间），用于生成 {date} 占位符
 * @returns rootDir 与相对路径（{symbol}/{folder}/{file}）；维度未登记返回 null
 */
export function resolveCollectionFilePath(
  dimensionCode: string,
  symbol: string,
  at: number = Date.now(),
): { rootDir: string; relativePath: string } | null {
  const dimCfg = getDimensionFileFolderConfig(dimensionCode)
  if (!dimCfg) return null
  const date = new Date(at).toISOString().slice(0, 10)
  const fileName = dimCfg.filePattern
    .replace('{symbol}', symbol)
    .replace('{date}', date)
    .replace('{dimension}', dimensionCode)
  return {
    rootDir: COLLECTION_FILE_STORAGE.rootDir,
    relativePath: `${symbol}/${dimCfg.folder}/${fileName}`,
  }
}
