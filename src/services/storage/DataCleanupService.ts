/**
 * DataCleanupService — 数据清理策略
 *
 * 提供基于保留策略的过期数据清理机制。每个存储区可配置独立的保留天数，
 * 支持查找过期记录、批量清理、存储用量估算与清理统计追踪。
 *
 * @doc V9-DOC-QUALITY-019
 * @module services/storage/DataCleanupService
 */

import { getLogger } from '@/lib/logger';

const logger = getLogger();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 存储区名称 */
export type StoreName =
  | 'dailyQuotes'
  | 'researchReports'
  | 'intelligentScores'
  | 'realtimeQuotes';

/** 保留策略定义 */
export interface RetentionPolicy {
  /** 最大保留天数 */
  maxAge: number;
  /** 时间单位 */
  unit: 'days';
}

/** 过期记录 */
export interface ExpiredRecord {
  key: string;
  /** 记录时间戳（毫秒） */
  timestamp: number;
  /** 距今已过天数 */
  ageInDays: number;
}

/** 清理结果 */
export interface CleanupResult {
  deleted: number;
  freedBytes: number;
  errors: string[];
}

/** 存储用量估算 */
export interface StorageEstimate {
  store: StoreName;
  estimatedSize: number;
  recordCount: number;
}

/** 抽象存储接口 — 支持清理操作 */
export interface CleanupStore {
  /** 返回所有 key */
  keys(): Promise<string[]>;
  /** 读取记录 */
  get(key: string): Promise<{ timestamp?: number; __size?: number; [key: string]: unknown } | undefined>;
  /** 删除记录 */
  delete(key: string): Promise<void>;
  /** 获取存储估算 */
  estimate?(): Promise<{ usage: number; quota: number }>;
  /** 记录数 */
  count?(): Promise<number>;
}

// ---------------------------------------------------------------------------
// Retention Policies
// ---------------------------------------------------------------------------

/**
 * 各存储区默认保留策略。
 *
 * | 存储区           | 保留天数 |
 * |------------------|----------|
 * | dailyQuotes      | 365      |
 * | researchReports  | 730      |
 * | intelligentScores| 90       |
 * | realtimeQuotes   | 7        |
 */
const DEFAULT_POLICIES: Record<StoreName, RetentionPolicy> = {
  dailyQuotes: { maxAge: 365, unit: 'days' },
  researchReports: { maxAge: 730, unit: 'days' },
  intelligentScores: { maxAge: 90, unit: 'days' },
  realtimeQuotes: { maxAge: 7, unit: 'days' },
};

// ---------------------------------------------------------------------------
// Cleanup Stats
// ---------------------------------------------------------------------------

interface CleanupStats {
  lastCleanupAt: string | null;
  totalDeleted: number;
  totalFreedBytes: number;
}

const cleanupStats: CleanupStats = {
  lastCleanupAt: null,
  totalDeleted: 0,
  totalFreedBytes: 0,
};

/**
 * 获取清理统计信息。
 *
 * @returns 当前清理统计快照
 */
export function getCleanupStats(): Readonly<CleanupStats> {
  return { ...cleanupStats };
}

// ---------------------------------------------------------------------------
// Policy Retrieval
// ---------------------------------------------------------------------------

/**
 * 获取指定存储区的保留策略。
 *
 * @param store - 存储区名称
 * @returns 保留策略（maxAge 与 unit）
 */
export function getRetentionPolicy(store: StoreName): RetentionPolicy {
  const policy = DEFAULT_POLICIES[store];
  if (!policy) {
    logger.warn(`Unknown store "${store}", falling back to 30-day default`);
    return { maxAge: 30, unit: 'days' };
  }
  return { ...policy };
}

// ---------------------------------------------------------------------------
// Expired Records
// ---------------------------------------------------------------------------

/** 一天对应的毫秒数 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 查找存储区中所有已过期的记录。
 *
 * 根据策略中的 `maxAge` 判断记录是否过期。记录需包含 `timestamp` 字段
 * 以确定其写入时间。
 *
 * @param store  - 支持 keys/get 的存储实例
 * @param policy - 保留策略
 * @returns 过期记录列表
 */
export async function findExpiredRecords(
  store: CleanupStore,
  policy: RetentionPolicy,
): Promise<ExpiredRecord[]> {
  const now = Date.now();
  const maxAgeMs = policy.maxAge * DAY_MS;
  const cutoff = now - maxAgeMs;

  logger.debug(
    `Finding expired records: maxAge=${policy.maxAge}${policy.unit}, cutoff=${new Date(cutoff).toISOString()}`,
  );

  const keys = await store.keys();
  const expired: ExpiredRecord[] = [];

  for (const key of keys) {
    const record = await store.get(key);
    if (!record) continue;

    const ts = record.timestamp;
    if (typeof ts !== 'number') {
      logger.debug(`Skipping key="${key}": no timestamp field`);
      continue;
    }

    if (ts < cutoff) {
      const ageInDays = Math.round((now - ts) / DAY_MS);
      expired.push({ key, timestamp: ts, ageInDays });
    }
  }

  logger.info(`Found ${expired.length} expired records out of ${keys.length}`);
  return expired;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * 清理存储区中的过期记录。
 *
 * 遍历所有记录，删除超过 `policy.maxAge` 天的记录，并统计删除数量与释放空间。
 *
 * @param store  - 支持 keys/get/delete 的存储实例
 * @param policy - 保留策略
 * @returns 清理结果，包含删除数、释放字节数与错误列表
 */
export async function cleanupExpiredRecords(
  store: CleanupStore,
  policy: RetentionPolicy,
): Promise<CleanupResult> {
  const now = Date.now();
  const maxAgeMs = policy.maxAge * DAY_MS;
  const cutoff = now - maxAgeMs;

  logger.info(`Starting cleanup: maxAge=${policy.maxAge}${policy.unit}`);

  const keys = await store.keys();
  let deleted = 0;
  let freedBytes = 0;
  const errors: string[] = [];

  for (const key of keys) {
    try {
      const record = await store.get(key);
      if (!record) continue;

      const ts = record.timestamp;
      if (typeof ts !== 'number' || ts >= cutoff) continue;

      const recordSize = typeof record.__size === 'number' ? record.__size : 0;

      await store.delete(key);
      deleted++;
      freedBytes += recordSize;
    } catch (err) {
      const msg = `Failed to delete key="${key}": ${(err as Error)?.message ?? err}`;
      errors.push(msg);
      logger.error(msg);
    }
  }

  // 更新统计
  cleanupStats.lastCleanupAt = new Date().toISOString();
  cleanupStats.totalDeleted += deleted;
  cleanupStats.totalFreedBytes += freedBytes;

  logger.info(
    `Cleanup complete: deleted=${deleted}, freedBytes=${freedBytes}, errors=${errors.length}`,
  );

  return { deleted, freedBytes, errors };
}

// ---------------------------------------------------------------------------
// Storage Estimate
// ---------------------------------------------------------------------------

/**
 * 估算各存储区的空间占用。
 *
 * 遍历所有存储区名称，查询每个存储区的记录数与估算大小。
 *
 * @param stores - 存储区名称到存储实例的映射
 * @returns 各存储区的用量估算列表
 */
export async function getStorageEstimate(
  stores: Record<StoreName, CleanupStore>,
): Promise<StorageEstimate[]> {
  const results: StorageEstimate[] = [];

  for (const [storeName, store] of Object.entries(stores) as [StoreName, CleanupStore][]) {
    try {
      let estimatedSize = 0;
      let recordCount = 0;

      if (store.estimate) {
        const est = await store.estimate();
        estimatedSize = est.usage;
      }

      if (store.count) {
        recordCount = await store.count();
      }

      results.push({
        store: storeName,
        estimatedSize,
        recordCount,
      });
    } catch (err) {
      logger.error(`Failed to estimate storage for "${storeName}": ${(err as Error)?.message ?? err}`);
      results.push({
        store: storeName,
        estimatedSize: 0,
        recordCount: 0,
      });
    }
  }

  return results;
}