/**
 * SnapshotManager — 数据快照与回滚
 *
 * 提供 IndexedDB 全量快照的创建、列表、回滚、删除、比对、导出与导入功能。
 * 最多保留 5 个快照，超出时自动删除最早快照。
 *
 * @doc V9-DOC-QUALITY-020
 * @module services/storage/SnapshotManager
 */

import { getLogger } from '@/lib/logger';

const logger = getLogger();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 快照元数据 */
export interface SnapshotMeta {
  id: string;
  label: string;
  timestamp: number;
  /** 快照 JSON 的近似大小（字节） */
  size: number;
  /** 快照包含的存储区数量 */
  storeCount: number;
}

/** 快照对比结果 */
export interface SnapshotDiff {
  added: number;
  removed: number;
  modified: number;
  details: string[];
}

/** 单条记录（泛型） */
export interface SnapshotRecord {
  key: string;
  value: unknown;
}

/** 单存储区快照数据 */
export interface StoreSnapshot {
  name: string;
  records: SnapshotRecord[];
}

/** 完整快照 */
export interface Snapshot {
  id: string;
  label: string;
  timestamp: number;
  stores: StoreSnapshot[];
}

/** 存储后端抽象 */
export interface SnapshotStore {
  /** 获取所有 key */
  keys(): Promise<string[]>;
  /** 读取记录 */
  get(key: string): Promise<unknown>;
  /** 写入记录 */
  put(key: string, value: unknown): Promise<void>;
  /** 删除记录 */
  delete(key: string): Promise<void>;
  /** 清空存储区 */
  clear(): Promise<void>;
}

/** 已注册的存储区映射 */
export interface StoreRegistry {
  [storeName: string]: SnapshotStore;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 快照存储键前缀 */
const SNAPSHOT_PREFIX = 'v9_snapshot_';

/** 快照列表存储键 */
const SNAPSHOT_LIST_KEY = 'v9_snapshot_list';

/** 最大快照保留数 */
const MAX_SNAPSHOTS = 5;

// ---------------------------------------------------------------------------
// Internal State
// ---------------------------------------------------------------------------

/** 已注册的存储区 */
let registry: StoreRegistry = {};

/** 快照元数据存储后端 */
let metaStore: Pick<SnapshotStore, 'get' | 'put' | 'delete'> | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 生成唯一快照 ID。
 */
function generateId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 获取快照列表。
 */
async function getSnapshotList(): Promise<SnapshotMeta[]> {
  if (!metaStore) return [];
  const raw = await metaStore.get(SNAPSHOT_LIST_KEY);
  if (Array.isArray(raw)) return raw as SnapshotMeta[];
  return [];
}

/**
 * 保存快照列表。
 */
async function saveSnapshotList(list: SnapshotMeta[]): Promise<void> {
  if (!metaStore) return;
  await metaStore.put(SNAPSHOT_LIST_KEY, list);
}

/**
 * 估算 JSON 字符串的字节大小（UTF-8）。
 */
function estimateBytes(json: string): number {
  // 简单估算：每个字符约 1-3 字节，用 Blob 方式更准确但在 Node 环境不可用
  return new TextEncoder().encode(json).length;
}

/**
 * 序列化整个注册表为 JSON 字符串。
 */
async function serializeAllStores(): Promise<{ json: string; storeCount: number }> {
  const stores: StoreSnapshot[] = [];

  for (const [name, store] of Object.entries(registry)) {
    const keys = await store.keys();
    const records: SnapshotRecord[] = [];

    for (const key of keys) {
      const value = await store.get(key);
      if (value !== undefined) {
        records.push({ key, value });
      }
    }

    stores.push({ name, records });
  }

  const json = JSON.stringify(stores);
  return { json, storeCount: stores.length };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 初始化快照管理器，注册存储区与元数据存储后端。
 *
 * @param stores    - 存储区名称到存储实例的映射
 * @param metadata  - 用于存储快照元数据的后端（通常为 localStorage 或 IndexedDB 的一个独立 store）
 */
export function initSnapshotManager(
  stores: StoreRegistry,
  metadata: Pick<SnapshotStore, 'get' | 'put' | 'delete'>,
): void {
  registry = stores;
  metaStore = metadata;
  logger.info(`SnapshotManager initialized with ${Object.keys(stores).length} stores`);
}

/**
 * 创建全量快照。
 *
 * 序列化所有已注册存储区的全部数据为 JSON，生成快照并持久化。
 * 最多保留 5 个快照，超出时自动删除最早的快照。
 *
 * @param label - 快照标签（便于识别）
 * @returns 快照元数据
 */
export async function createSnapshot(label: string): Promise<SnapshotMeta> {
  logger.info(`Creating snapshot: label="${label}"`);

  const { json, storeCount } = await serializeAllStores();
  const size = estimateBytes(json);
  const id = generateId();
  const timestamp = Date.now();

  const meta: SnapshotMeta = { id, label, timestamp, size, storeCount };

  // 保存快照数据
  if (metaStore) {
    await metaStore.put(`${SNAPSHOT_PREFIX}${id}`, json);
  }

  // 更新快照列表
  const list = await getSnapshotList();
  list.push(meta);

  // 超出最大保留数时删除最早快照
  while (list.length > MAX_SNAPSHOTS) {
    const oldest = list.shift()!;
    logger.info(`Auto-deleting oldest snapshot: id="${oldest.id}" label="${oldest.label}"`);
    if (metaStore) {
      await metaStore.delete(`${SNAPSHOT_PREFIX}${oldest.id}`);
    }
  }

  await saveSnapshotList(list);

  logger.info(`Snapshot created: id="${id}" size=${size} stores=${storeCount}`);
  return meta;
}

/**
 * 列出所有快照。
 *
 * @returns 快照元数据数组，按时间倒序排列
 */
export async function listSnapshots(): Promise<SnapshotMeta[]> {
  const list = await getSnapshotList();
  return list.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * 从快照恢复所有存储区数据。
 *
 * 先清空所有存储区，再将快照中的数据逐条写入。
 *
 * @param snapshotId - 快照 ID
 * @throws 若快照不存在或存储未初始化
 */
export async function restoreSnapshot(snapshotId: string): Promise<void> {
  logger.info(`Restoring snapshot: id="${snapshotId}"`);

  if (!metaStore) {
    throw new Error('SnapshotManager not initialized. Call initSnapshotManager() first.');
  }

  const json = await metaStore.get(`${SNAPSHOT_PREFIX}${snapshotId}`);
  if (typeof json !== 'string') {
    throw new Error(`Snapshot not found: id="${snapshotId}"`);
  }

  const stores: StoreSnapshot[] = JSON.parse(json);

  // 清空所有已注册存储区
  for (const store of Object.values(registry)) {
    await store.clear();
  }

  // 恢复数据
  let restoredRecords = 0;
  for (const { name, records } of stores) {
    const store = registry[name];
    if (!store) {
      logger.warn(`Store "${name}" not found in registry, skipping`);
      continue;
    }

    for (const { key, value } of records) {
      await store.put(key, value);
      restoredRecords++;
    }
  }

  logger.info(`Snapshot restored: id="${snapshotId}" records=${restoredRecords}`);
}

/**
 * 删除指定快照。
 *
 * @param snapshotId - 快照 ID
 */
export async function deleteSnapshot(snapshotId: string): Promise<void> {
  logger.info(`Deleting snapshot: id="${snapshotId}"`);

  if (metaStore) {
    await metaStore.delete(`${SNAPSHOT_PREFIX}${snapshotId}`);
  }

  const list = await getSnapshotList();
  const filtered = list.filter((m) => m.id !== snapshotId);
  await saveSnapshotList(filtered);

  logger.info(`Snapshot deleted: id="${snapshotId}"`);
}

/**
 * 对比两个快照的差异。
 *
 * 逐存储区、逐 key 比较，统计新增、删除、修改的记录数，并生成差异详情。
 *
 * @param id1 - 第一个快照 ID
 * @param id2 - 第二个快照 ID
 * @returns 差异对比结果
 * @throws 若任一快照不存在
 */
export async function compareSnapshots(id1: string, id2: string): Promise<SnapshotDiff> {
  logger.info(`Comparing snapshots: id1="${id1}" id2="${id2}"`);

  if (!metaStore) {
    throw new Error('SnapshotManager not initialized. Call initSnapshotManager() first.');
  }

  const [json1, json2] = await Promise.all([
    metaStore.get(`${SNAPSHOT_PREFIX}${id1}`),
    metaStore.get(`${SNAPSHOT_PREFIX}${id2}`),
  ]);

  if (typeof json1 !== 'string') throw new Error(`Snapshot not found: id="${id1}"`);
  if (typeof json2 !== 'string') throw new Error(`Snapshot not found: id="${id2}"`);

  const stores1: StoreSnapshot[] = JSON.parse(json1);
  const stores2: StoreSnapshot[] = JSON.parse(json2);

  const diff: SnapshotDiff = { added: 0, removed: 0, modified: 0, details: [] };

  // 构建 key -> value 映射
  function buildMap(stores: StoreSnapshot[]): Map<string, unknown> {
    const map = new Map<string, unknown>();
    for (const { name, records } of stores) {
      for (const { key, value } of records) {
        map.set(`${name}::${key}`, value);
      }
    }
    return map;
  }

  const map1 = buildMap(stores1);
  const map2 = buildMap(stores2);

  const allKeys = new Set([...map1.keys(), ...map2.keys()]);

  for (const key of allKeys) {
    const in1 = map1.has(key);
    const in2 = map2.has(key);

    if (!in1 && in2) {
      diff.added++;
      diff.details.push(`+ ${key}`);
    } else if (in1 && !in2) {
      diff.removed++;
      diff.details.push(`- ${key}`);
    } else if (in1 && in2) {
      const v1 = JSON.stringify(map1.get(key));
      const v2 = JSON.stringify(map2.get(key));
      if (v1 !== v2) {
        diff.modified++;
        diff.details.push(`~ ${key}`);
      }
    }
  }

  logger.info(
    `Snapshot comparison complete: added=${diff.added} removed=${diff.removed} modified=${diff.modified}`,
  );

  return diff;
}

/**
 * 导出快照为 JSON 文件并触发浏览器下载。
 *
 * @param snapshotId - 快照 ID
 * @throws 若快照不存在
 */
export async function exportSnapshot(snapshotId: string): Promise<void> {
  logger.info(`Exporting snapshot: id="${snapshotId}"`);

  if (!metaStore) {
    throw new Error('SnapshotManager not initialized. Call initSnapshotManager() first.');
  }

  const json = await metaStore.get(`${SNAPSHOT_PREFIX}${snapshotId}`);
  if (typeof json !== 'string') {
    throw new Error(`Snapshot not found: id="${snapshotId}"`);
  }

  const list = await getSnapshotList();
  const meta = list.find((m) => m.id === snapshotId);
  const label = meta?.label ?? snapshotId;

  // 构建完整快照对象
  const stores: StoreSnapshot[] = JSON.parse(json);
  const snapshot: Snapshot = {
    id: snapshotId,
    label: meta?.label ?? '',
    timestamp: meta?.timestamp ?? 0,
    stores,
  };

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  try {
    // 触发浏览器下载
    const safeLabel = label.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
    const filename = `v9-snapshot-${safeLabel}-${new Date().toISOString().slice(0, 10)}.json`;

    // 在浏览器环境中触发下载
    if (typeof document !== 'undefined') {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }

    logger.info(`Snapshot exported: id="${snapshotId}" filename="${filename}"`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 从 JSON 文件导入快照并恢复数据。
 *
 * 读取文件内容，解析为 Snapshot 对象，写入元数据存储并执行恢复。
 *
 * @param file - 浏览器 File 对象或包含 JSON 字符串的对象
 * @throws 若文件格式无效
 */
export async function importSnapshot(file: File | { json: string }): Promise<SnapshotMeta> {
  logger.info('Importing snapshot from file');

  if (!metaStore) {
    throw new Error('SnapshotManager not initialized. Call initSnapshotManager() first.');
  }

  let json: string;

  if ('json' in file) {
    json = file.json;
  } else {
    json = await file.text();
  }

  let snapshot: Snapshot;

  try {
    snapshot = JSON.parse(json);
  } catch {
    throw new Error('Invalid snapshot file: not valid JSON');
  }

  if (!snapshot.id || !snapshot.stores || !Array.isArray(snapshot.stores)) {
    throw new Error('Invalid snapshot file: missing required fields (id, stores)');
  }

  const id = snapshot.id;
  const label = snapshot.label || `imported_${Date.now()}`;
  const timestamp = snapshot.timestamp || Date.now();
  const storeCount = snapshot.stores.length;
  const size = estimateBytes(json);

  // 保存快照数据
  await metaStore.put(`${SNAPSHOT_PREFIX}${id}`, JSON.stringify(snapshot.stores));

  // 更新快照列表
  const list = await getSnapshotList();
  // 避免重复
  const existing = list.findIndex((m) => m.id === id);
  if (existing >= 0) {
    list.splice(existing, 1);
  }

  const meta: SnapshotMeta = { id, label, timestamp, size, storeCount };
  list.push(meta);

  while (list.length > MAX_SNAPSHOTS) {
    const oldest = list.shift()!;
    await metaStore.delete(`${SNAPSHOT_PREFIX}${oldest.id}`);
  }

  await saveSnapshotList(list);

  logger.info(`Snapshot imported: id="${id}" label="${label}" stores=${storeCount}`);
  return meta;
}