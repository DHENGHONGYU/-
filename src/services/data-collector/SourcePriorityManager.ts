/**
 * SourcePriorityManager — 数据源优先级策略
 *
 * 按维度定义数据源优先级顺序，提供最优数据源选择、降级回退、
 * 多源冲突检测以及各数据源的健康度追踪功能。
 *
 * @doc V9-DOC-QUALITY-015
 */

import { getLogger } from '@/lib/logger';

const logger = getLogger();

/** 数据维度 */
export type DataDimension =
  | 'realtime_quote'
  | 'daily_quotes'
  | 'fundamental'
  | 'news'
  | 'research';

/** 数据源标识 */
export type DataSource = string;

/** 冲突检测结果 */
export interface SourceConflict {
  dimension: DataDimension;
  field: string;
  sourceResults: Array<{ source: DataSource; value: unknown }>;
  detectedAt: number;
}

/** 数据源健康信息 */
export interface SourceHealth {
  source: DataSource;
  successRate: number;
  lastSuccess: number;
  lastFailure: number;
}

/** 数据源统计记录 */
interface SourceRecord {
  successCount: number;
  failureCount: number;
  lastSuccess: number;
  lastFailure: number;
}

/**
 * 各维度的数据源优先级顺序（从高到低）
 */
export const SOURCE_PRIORITY: Record<DataDimension, DataSource[]> = {
  realtime_quote: ['tencent', 'sina'],
  daily_quotes: ['tushare', 'tencent', 'sina'],
  fundamental: ['tushare', 'crawler'],
  news: ['crawler', 'llm'],
  research: ['tushare', 'llm'],
};

/**
 * 内部数据源统计
 */
const sourceRecords: Map<DataSource, SourceRecord> = new Map();

/**
 * 获取或创建数据源统计记录
 */
function getOrCreateRecord(source: DataSource): SourceRecord {
  if (!sourceRecords.has(source)) {
    sourceRecords.set(source, {
      successCount: 0,
      failureCount: 0,
      lastSuccess: 0,
      lastFailure: 0,
    });
  }
  return sourceRecords.get(source)!;
}

/**
 * 记录数据源调用成功
 */
function recordSuccess(source: DataSource): void {
  const record = getOrCreateRecord(source);
  record.successCount++;
  record.lastSuccess = Date.now();
}

/**
 * 记录数据源调用失败
 */
function recordFailure(source: DataSource): void {
  const record = getOrCreateRecord(source);
  record.failureCount++;
  record.lastFailure = Date.now();
}

/**
 * 根据维度和当前可用数据源，选择优先级最高的数据源
 *
 * @param dimension - 数据维度
 * @param availableSources - 当前可用的数据源列表
 * @returns 优先级最高的可用数据源，若无可用的则返回 null
 */
export function selectDataSource(
  dimension: DataDimension,
  availableSources: DataSource[],
): DataSource | null {
  const priorityList = SOURCE_PRIORITY[dimension];

  if (!priorityList || priorityList.length === 0) {
    logger.warn(`No priority list defined for dimension: ${dimension}`);
    return null;
  }

  const availableSet = new Set(availableSources.map((s) => s.toLowerCase()));

  for (const preferred of priorityList) {
    if (availableSet.has(preferred.toLowerCase())) {
      logger.debug(`Selected source "${preferred}" for dimension "${dimension}"`);
      return preferred;
    }
  }

  logger.warn(`No available source found for dimension "${dimension}". Available: ${availableSources.join(', ')}`);
  return null;
}

/**
 * 在某个数据源失败后，获取下一个可用的降级数据源
 *
 * @param dimension - 数据维度
 * @param failedSource - 已失败的数据源
 * @returns 下一个可用的数据源标识，若无则返回 null
 */
export function fallbackDataSource(
  dimension: DataDimension,
  failedSource: DataSource,
): DataSource | null {
  const priorityList = SOURCE_PRIORITY[dimension];

  if (!priorityList || priorityList.length === 0) {
    logger.warn(`No priority list defined for dimension: ${dimension}`);
    return null;
  }

  recordFailure(failedSource);

  const failedIndex = priorityList.findIndex(
    (s) => s.toLowerCase() === failedSource.toLowerCase(),
  );

  if (failedIndex === -1) {
    logger.warn(`Failed source "${failedSource}" not found in priority list for "${dimension}"`);
    return priorityList[0] ?? null;
  }

  // 从失败源的下一个开始依次尝试
  for (let i = failedIndex + 1; i < priorityList.length; i++) {
    const candidate = priorityList[i];
    if (!candidate) continue;
    // 检查该候选源是否处于健康状态（最近没有连续失败）
    const record = sourceRecords.get(candidate);
    if (record) {
      // 如果最近失败率过高（> 80%），跳过
      const total = record.successCount + record.failureCount;
      if (total > 0) {
        const failureRate = record.failureCount / total;
        if (failureRate > 0.8 && record.lastFailure > record.lastSuccess) {
          logger.debug(`Skipping unhealthy source "${candidate}" for "${dimension}"`);
          continue;
        }
      }
    }
    logger.info(`Falling back to source "${candidate}" for "${dimension}" after "${failedSource}" failed`);
    return candidate;
  }

  logger.error(`No fallback source available for "${dimension}" after "${failedSource}"`);
  return null;
}

/**
 * 检测多个数据源对同一字段返回不同数据时的冲突
 *
 * @param dimension - 数据维度
 * @param sourceResults - 各数据源的结果数组，每项包含 source 和 data
 * @returns 冲突记录数组
 */
export function detectSourceConflict(
  dimension: DataDimension,
  sourceResults: Array<{ source: DataSource; data: Record<string, unknown> }>,
): SourceConflict[] {
  const conflicts: SourceConflict[] = [];

  if (sourceResults.length < 2) {
    return conflicts;
  }

  // 收集所有字段名
  const allFields = new Set<string>();
  for (const result of sourceResults) {
    for (const key of Object.keys(result.data)) {
      allFields.add(key);
    }
  }

  for (const field of allFields) {
    const valuesMap = new Map<DataSource, unknown>();

    for (const result of sourceResults) {
      if (field in result.data) {
        valuesMap.set(result.source, result.data[field]);
      }
    }

    if (valuesMap.size < 2) {
      continue;
    }

    // 检查所有值是否一致
    const values = Array.from(valuesMap.values());
    const uniqueValues = new Set(values.map((v) => JSON.stringify(v)));

    if (uniqueValues.size > 1) {
      const conflict: SourceConflict = {
        dimension,
        field,
        sourceResults: Array.from(valuesMap.entries()).map(([source, value]) => ({
          source,
          value,
        })),
        detectedAt: Date.now(),
      };
      conflicts.push(conflict);
      logger.warn(
        `Source conflict detected for "${dimension}.${field}": ${conflict.sourceResults
          .map((r) => `${r.source}=${JSON.stringify(r.value)}`)
          .join(', ')}`,
      );
    }
  }

  return conflicts;
}

/**
 * 获取所有数据源的健康状态
 *
 * @returns 各数据源的健康信息数组
 */
export function getSourceHealth(): SourceHealth[] {
  const healthList: SourceHealth[] = [];

  for (const [source, record] of sourceRecords.entries()) {
    const total = record.successCount + record.failureCount;
    healthList.push({
      source,
      successRate: total > 0 ? record.successCount / total : 1,
      lastSuccess: record.lastSuccess,
      lastFailure: record.lastFailure,
    });
  }

  // 按成功率降序排列
  healthList.sort((a, b) => b.successRate - a.successRate);

  // 补充所有已定义但尚未有记录的数据源
  const recordedSources = new Set(healthList.map((h) => h.source));
  const allDefinedSources = new Set<DataSource>();
  for (const sources of Object.values(SOURCE_PRIORITY)) {
    for (const s of sources) {
      allDefinedSources.add(s);
    }
  }
  for (const s of allDefinedSources) {
    if (!recordedSources.has(s)) {
      healthList.push({
        source: s,
        successRate: 1,
        lastSuccess: 0,
        lastFailure: 0,
      });
    }
  }

  logger.info(`Source health report: ${healthList.length} sources tracked`);
  return healthList;
}

/**
 * 手动标记数据源调用成功
 *
 * @param source - 数据源标识
 */
export function markSourceSuccess(source: DataSource): void {
  recordSuccess(source);
}

/**
 * 手动标记数据源调用失败
 *
 * @param source - 数据源标识
 */
export function markSourceFailure(source: DataSource): void {
  recordFailure(source);
}

/**
 * 重置所有数据源统计
 */
export function resetSourceStats(): void {
  sourceRecords.clear();
  logger.info('All source stats have been reset');
}