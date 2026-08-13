/**
 * 数据去重服务
 *
 * 提供跨数据存储的统一去重逻辑，支持按不同 store 类型定义去重键，
 * 追踪去重统计信息，并在批量导入记录时自动过滤重复数据。
 *
 * @doc V9-DOC-QUALITY-016
 */

import { getLogger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 支持的数据存储类型 */
export type DedupStore = 'stocks' | 'dailyQuotes' | 'researchReports' | 'intelligentScores';

/** 去重键，通常是字符串组合 */
export type DedupKey = string;

/** 单条记录（泛型），具体结构由调用方决定 */
export type DedupRecord = Record<string, unknown>;

/** 去重结果 */
export interface DedupResult<T extends DedupRecord = DedupRecord> {
  /** 去重后保留的唯一记录 */
  unique: T[];
  /** 被过滤掉的重复记录 */
  duplicates: T[];
  /** 去重率 = duplicates / (unique + duplicates)，无记录时为 0 */
  dedupRate: number;
}

/** 去重统计信息 */
export interface DedupStats {
  /** 累计处理的记录总数 */
  total: number;
  /** 累计检测到的重复记录数 */
  duplicates: number;
  /** 最近一次去重操作的时间戳（ISO 字符串），从未执行过则为 null */
  lastDedupAt: string | null;
}

// ---------------------------------------------------------------------------
// 内部状态
// ---------------------------------------------------------------------------

const logger = getLogger();

/**
 * 每个 store 维护一个独立的已见键集合，用于 O(1) 查重。
 */
const seenKeys = new Map<DedupStore, Set<string>>();

/**
 * 每个 store 的去重统计。
 */
const storeStats = new Map<DedupStore, DedupStats>();

/**
 * 每个 store 的去重键生成器。
 */
const keyGenerators = new Map<DedupStore, (record: DedupRecord) => DedupKey>();

// ---------------------------------------------------------------------------
// 初始化 —— 注册默认去重键生成规则
// ---------------------------------------------------------------------------

function initDefaultKeyGenerators(): void {
  // stocks: 以 symbol 为唯一标识
  keyGenerators.set('stocks', (record: DedupRecord) => {
    const sym = record.symbol
    return typeof sym === 'string' ? sym : ''
  });

  // dailyQuotes: symbol + date 组合唯一
  keyGenerators.set('dailyQuotes', (record: DedupRecord) => {
    const sym = typeof record.symbol === 'string' ? record.symbol : ''
    const dt = typeof record.date === 'string' ? record.date : ''
    return `${sym}::${dt}`;
  });

  // researchReports: 以 reportId 为唯一标识
  keyGenerators.set('researchReports', (record: DedupRecord) => {
    const rid = record.reportId
    return typeof rid === 'string' ? rid : ''
  });

  // intelligentScores: symbol + scoredAt 组合唯一
  keyGenerators.set('intelligentScores', (record: DedupRecord) => {
    const sym = typeof record.symbol === 'string' ? record.symbol : ''
    const sa = typeof record.scoredAt === 'string' ? record.scoredAt : ''
    return `${sym}::${sa}`;
  });
}

// ---------------------------------------------------------------------------
// 内部辅助
// ---------------------------------------------------------------------------

function ensureSeenSet(store: DedupStore): Set<string> {
  let set = seenKeys.get(store);
  if (!set) {
    set = new Set<string>();
    seenKeys.set(store, set);
  }
  return set;
}

function ensureStats(store: DedupStore): DedupStats {
  let stats = storeStats.get(store);
  if (!stats) {
    stats = { total: 0, duplicates: 0, lastDedupAt: null };
    storeStats.set(store, stats);
  }
  return stats;
}

function getKeyGenerator(store: DedupStore): (record: DedupRecord) => DedupKey {
  const gen = keyGenerators.get(store);
  if (!gen) {
    throw new Error(`[DeduplicationService] No key generator registered for store: ${store}`);
  }
  return gen;
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

/**
 * 检查单条记录是否已存在于指定 store 中。
 *
 * @param store  - 数据存储类型
 * @param key    - 去重键（通常由调用方通过 `dedupRecords` 生成，也可直接传入）
 * @returns 如果该键已存在则返回 true
 */
export function isDuplicate(store: DedupStore, key: DedupKey): boolean {
  const set = ensureSeenSet(store);
  return set.has(key);
}

/**
 * 对一组记录进行去重，返回去重结果。
 *
 * 内部会根据 store 类型自动生成去重键，并将新出现的键记录到已见集合中，
 * 同时更新统计信息。
 *
 * @param store   - 数据存储类型
 * @param records - 待去重的记录数组
 * @returns 包含 unique（唯一记录）、duplicates（重复记录）和 dedupRate 的结果对象
 */
export function dedupRecords<T extends DedupRecord = DedupRecord>(
  store: DedupStore,
  records: T[],
): DedupResult<T> {
  const set = ensureSeenSet(store);
  const stats = ensureStats(store);
  const genKey = getKeyGenerator(store);

  const unique: T[] = [];
  const duplicates: T[] = [];

  for (const record of records) {
    const key = genKey(record);

    if (set.has(key)) {
      duplicates.push(record);
    } else {
      set.add(key);
      unique.push(record);
    }
  }

  const total = unique.length + duplicates.length;
  const dedupRate = total > 0 ? duplicates.length / total : 0;

  stats.total += total;
  stats.duplicates += duplicates.length;
  stats.lastDedupAt = new Date().toISOString();

  logger.debug(
    `[dedup] store=${store} unique=${unique.length} duplicates=${duplicates.length} dedupRate=${(dedupRate * 100).toFixed(1)}%`,
  );

  return { unique, duplicates, dedupRate };
}

/**
 * 获取指定 store 的去重统计信息。
 *
 * @param store - 数据存储类型
 * @returns 该 store 的累计去重统计
 */
export function getDedupStats(store: DedupStore): DedupStats {
  return ensureStats(store);
}

/**
 * 重置指定 store 的所有去重状态（已见键集合和统计信息）。
 *
 * 调用后该 store 的去重计数器将归零，已见键集合也会被清空。
 *
 * @param store - 数据存储类型，传入 `'all'` 可重置所有 store
 */
export function resetDedupStats(store: DedupStore | 'all' = 'all'): void {
  if (store === 'all') {
    seenKeys.clear();
    storeStats.clear();
    logger.info('[dedup] All dedup stores reset');
    return;
  }

  seenKeys.delete(store);
  storeStats.delete(store);
  logger.info(`[dedup] Store "${store}" reset`);
}

// 模块加载时初始化默认去重键生成规则
initDefaultKeyGenerators();