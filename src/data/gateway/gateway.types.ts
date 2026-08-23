/**
 * @fileoverview
 * Gateway 接口定义：V9 数据访问层的唯一门面
 * 
 * 设计原则：
 * 1. 业务无关：仅提供原子性的数据操作，不包含业务规则
 * 2. 类型安全：所有方法均为泛型，保证调用方获得严格的类型检查
 * 3. 事务边界：通过 runInTransaction 明确标识原子操作范围
 */

import type { StoreName } from '@/config/dbConfig';
import type { CascadeStrategy } from '@/types/modules/cascade.types';
import type { DataLayerResult } from '../types';

/** 事务范围回调类型（传递原始 IDBTransaction，需要自行操作 objectStore） */
export type TransactionCallback<T> = (tx: IDBTransaction) => Promise<T> | T;

/** 事务上下文接口：在事务内提供类型安全的 CRUD 方法 */
export interface ITransactionContext {
  /** 当前事务 */
  readonly tx: IDBTransaction;
  
  /** 按主键获取单条记录（事务内） */
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  
  /** 获取指定 store 的所有记录（事务内） */
  getAll<T>(store: StoreName): Promise<T[]>;
  
  /** 按索引查询（事务内） */
  queryByIndex<T>(
    store: StoreName,
    indexName: string,
    value: string,
  ): Promise<T[]>;
  
  /** 写入单条记录（事务内） */
  put<T>(store: StoreName, value: T): Promise<void>;
  
  /** 按主键删除（事务内） */
  delete(store: StoreName, key: string): Promise<void>;
}

/** 使用 ITransactionContext 的事务回调类型 */
export type GatewayTransactionCallback<T> = (ctx: ITransactionContext) => Promise<T> | T;

/** 仓储配置（用于 createRepository 工厂） */
export interface IRepositoryConfig<T, TKey = string> {
  readonly store: StoreName;
  readonly writeAction: string;
  readonly deleteAction: string;
  /** delete 载荷的键名，缺省 'key'；按目标 Handler 的载荷形状指定（如 stocks 用 'symbol'） */
  readonly deleteKeyField?: string;
  readonly keyOf: (entity: T) => TKey;
}

/** 通用仓储接口（对齐现有 Repository 接口，便于兼容） */
export interface IRepository<T, TKey = string> {
  readonly store: StoreName;
  get(key: TKey): Promise<T | undefined>;
  getAll(): Promise<T[]>;
  queryByIndex(indexName: string, value: unknown): Promise<T[]>;
  put(entity: T, key: TKey): Promise<DataLayerResult<void>>;
  delete(key: TKey): Promise<DataLayerResult<void>>;
}

/** 级联操作目标结果 */
export interface CascadeTargetResult {
  store: StoreName;
  strategy: CascadeStrategy;
  affectedCount: number;
}

/** Gateway 核心接口 */
export interface IGateway {
  // ====== 生命周期管理 ======
  
  /** 检查数据库是否已初始化 */
  isReady(): boolean;
  
  /** 初始化数据库连接（幂等） */
  init(): Promise<void>;
  
  /** 等待数据库就绪（带超时保护） */
  ready(): Promise<void>;

  // ====== 事务管理 ======
  
  /** 在一个或多个 store 的事务中执行回调，保证原子性（传递原始 IDBTransaction） */
  runInTransaction<T>(
    storeNames: StoreName[],
    mode: IDBTransactionMode,
    callback: TransactionCallback<T>,
  ): Promise<T>;
  
  /** 在事务中执行回调，通过 ITransactionContext 提供类型安全的 CRUD 操作 */
  runInTransactionWithContext<T>(
    storeNames: StoreName[],
    mode: IDBTransactionMode,
    callback: GatewayTransactionCallback<T>,
  ): Promise<T>;

  // ====== 基础 CRUD ======
  
  /** 按主键获取单条记录 */
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  
  /** 获取指定 store 的所有记录 */
  getAll<T>(store: StoreName): Promise<T[]>;
  
  /** 按索引查询 */
  queryByIndex<T>(
    store: StoreName,
    indexName: string,
    value: string,
  ): Promise<T[]>;
  
  /** 写入单条记录（新增或更新） */
  put<T>(store: StoreName, value: T): Promise<void>;
  
  /** 按主键删除 */
  delete(store: StoreName, key: string): Promise<void>;
  
  /** 按索引批量删除 */
  deleteByIndex(
    store: StoreName,
    indexName: string,
    value: string,
  ): Promise<number>;

  // ====== 批量操作 ======
  
  /** 批量写入 */
  batchPut<T>(store: StoreName, items: T[]): Promise<void>;
  
  /** 清空指定 store */
  clearStore(store: StoreName): Promise<void>;

  // ====== 级联操作 ======
  
  /** 带级联策略的删除（封装 cascadeExecutor 逻辑） */
  deleteWithCascade(
    store: StoreName,
    id: string,
  ): Promise<{ targets: CascadeTargetResult[] }>;

  // ====== 数据管理 ======
  
  /** 重置所有数据 */
  resetAll(): Promise<void>;
  
  /** 导出所有数据 */
  exportData(): Promise<Record<string, unknown[]>>;
  
  /** 导入数据 */
  importData(data: Record<string, unknown[]>): Promise<void>;

  // ====== 工厂方法 ======
  
  /** 创建一个绑定到具体 store 的 Repository 实例 */
  createRepository<T, TKey = string>(
    config: IRepositoryConfig<T, TKey>,
  ): IRepository<T, TKey>;
}

/** Gateway 单例导出类型 */
export type DataGateway = IGateway;
