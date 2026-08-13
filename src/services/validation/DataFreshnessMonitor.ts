/**
 * DataFreshnessMonitor — 数据时效性监控
 *
 * 跟踪每个 symbol 下各维度的最后采集时间，按维度定义最大允许过期时间，
 * 提供数据新鲜度检查、过期符号列表查询和统计汇总功能。
 *
 * @doc V9-DOC-QUALITY-014
 */

import { getLogger } from '@/lib/logger';

const logger = getLogger();

/** 数据维度枚举 */
export type DataDimension =
  | 'realtime_quote'
  | 'daily_quotes'
  | 'fundamental_data'
  | 'research_reports'
  | 'intelligent_scores';

/** 新鲜度状态 */
export type FreshnessStatus = 'fresh' | 'stale' | 'expired';

/** 新鲜度检查结果 */
export interface FreshnessResult {
  fresh: boolean;
  age: number; // 毫秒
  maxAge: number; // 毫秒
  status: FreshnessStatus;
}

/** 过期符号信息 */
export interface StaleSymbolInfo {
  symbol: string;
  dimension: DataDimension;
  collectedAt: number;
  age: number;
  maxAge: number;
  status: FreshnessStatus;
}

/** 新鲜度统计 */
export interface FreshnessStats {
  total: number;
  fresh: number;
  stale: number;
  expired: number;
  byDimension: Record<DataDimension, { total: number; fresh: number; stale: number; expired: number }>;
}

/**
 * 各维度最大过期时间（毫秒）
 */
export const MAX_STALE_AGE: Record<DataDimension, number> = {
  realtime_quote: 5 * 60 * 1000, // 5 分钟
  daily_quotes: 24 * 60 * 60 * 1000, // 24 小时
  fundamental_data: 7 * 24 * 60 * 60 * 1000, // 7 天
  research_reports: 30 * 24 * 60 * 60 * 1000, // 30 天
  intelligent_scores: 7 * 24 * 60 * 60 * 1000, // 7 天
};

/**
 * 内部存储：symbol -> dimension -> 最后采集时间戳（毫秒）
 */
const collectionTimestamps: Map<string, Map<DataDimension, number>> = new Map();

/**
 * 记录某个 symbol 下某个维度的最近采集时间
 *
 * @param symbol - 股票代码
 * @param dimension - 数据维度
 * @param timestamp - 采集时间戳（毫秒），默认为当前时间
 */
export function recordCollection(
  symbol: string,
  dimension: DataDimension,
  timestamp: number = Date.now(),
): void {
  if (!collectionTimestamps.has(symbol)) {
    collectionTimestamps.set(symbol, new Map());
  }
  collectionTimestamps.get(symbol)!.set(dimension, timestamp);
  logger.debug(`[${symbol}] ${dimension} collection recorded at ${new Date(timestamp).toISOString()}`);
}

/**
 * 检查某个 symbol 下某个维度的数据新鲜度
 *
 * @param symbol - 股票代码
 * @param dimension - 数据维度
 * @returns 新鲜度检查结果，若从未采集则返回 expired 状态
 */
export function checkDataFreshness(symbol: string, dimension: DataDimension): FreshnessResult {
  const maxAge = MAX_STALE_AGE[dimension];
  const symbolTimestamps = collectionTimestamps.get(symbol);

  if (!symbolTimestamps?.has(dimension)) {
    return {
      fresh: false,
      age: Infinity,
      maxAge,
      status: 'expired',
    };
  }

  const collectedAt = symbolTimestamps.get(dimension)!;
  const now = Date.now();
  const age = now - collectedAt;

  let status: FreshnessStatus;
  if (age <= maxAge) {
    status = 'fresh';
  } else if (age <= maxAge * 2) {
    status = 'stale';
  } else {
    status = 'expired';
  }

  return {
    fresh: status === 'fresh',
    age,
    maxAge,
    status,
  };
}

/**
 * 获取所有数据已过期或即将过期的 symbol 列表
 *
 * @returns 所有状态为 stale 或 expired 的条目
 */
export function getStaleSymbols(): StaleSymbolInfo[] {
  const result: StaleSymbolInfo[] = [];

  for (const [symbol, dimMap] of collectionTimestamps.entries()) {
    for (const dimension of Object.keys(MAX_STALE_AGE) as DataDimension[]) {
      const freshness = checkDataFreshness(symbol, dimension);
      if (freshness.status === 'stale' || freshness.status === 'expired') {
        const collectedAt = dimMap.get(dimension) ?? 0;
        result.push({
          symbol,
          dimension,
          collectedAt,
          age: freshness.age,
          maxAge: freshness.maxAge,
          status: freshness.status,
        });
      }
    }
  }

  logger.info(`Found ${result.length} stale/expired data entries`);
  return result;
}

/**
 * 获取数据新鲜度统计汇总
 *
 * @returns 按维度和整体汇总的新鲜度统计
 */
export function getFreshnessStats(): FreshnessStats {
  const allDimensions = Object.keys(MAX_STALE_AGE) as DataDimension[];

  const byDimension: FreshnessStats['byDimension'] = {} as FreshnessStats['byDimension'];

  for (const dim of allDimensions) {
    byDimension[dim] = { total: 0, fresh: 0, stale: 0, expired: 0 };
  }

  let total = 0;
  let fresh = 0;
  let stale = 0;
  let expired = 0;

  for (const [symbol] of collectionTimestamps.entries()) {
    for (const dim of allDimensions) {
      total++;
      const freshness = checkDataFreshness(symbol, dim);
      switch (freshness.status) {
        case 'fresh':
          fresh++;
          byDimension[dim].fresh++;
          break;
        case 'stale':
          stale++;
          byDimension[dim].stale++;
          break;
        case 'expired':
          expired++;
          byDimension[dim].expired++;
          break;
      }
      byDimension[dim].total++;
    }
  }

  logger.info(`Freshness stats: ${fresh} fresh, ${stale} stale, ${expired} expired out of ${total} total`);
  return { total, fresh, stale, expired, byDimension };
}

/**
 * 获取某个 symbol 下所有维度的新鲜度状况
 *
 * @param symbol - 股票代码
 * @returns 各维度新鲜度结果映射
 */
export function getSymbolFreshness(symbol: string): Record<DataDimension, FreshnessResult> {
  const result: Record<string, FreshnessResult> = {};
  for (const dim of Object.keys(MAX_STALE_AGE) as DataDimension[]) {
    result[dim] = checkDataFreshness(symbol, dim);
  }
  return result;
}

/**
 * 清除某个 symbol 的所有采集记录
 *
 * @param symbol - 股票代码
 */
export function clearSymbol(symbol: string): void {
  collectionTimestamps.delete(symbol);
  logger.debug(`Cleared collection records for ${symbol}`);
}

/**
 * 清除所有采集记录
 */
export function clearAll(): void {
  collectionTimestamps.clear();
  logger.info('Cleared all collection records');
}