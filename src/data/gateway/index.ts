/**
 * @fileoverview
 * V9 DataGateway 实现类
 * 
 * 这是数据层的门面（Facade），它组合了底层的 V6Database、事务管理器和级联执行器，
 * 为上层业务提供统一、类型安全的 API。核心设计原则是：
 * 
 * 1. 唯一写入口：所有数据写入操作都应通过此 Gateway 进行
 * 2. 事务边界清晰：复杂操作通过 runInTransaction 保证原子性
 * 3. 级联操作封装：deleteWithCascade 封装了级联删除的业务逻辑
 * 4. 工厂模式：createRepository 提供了一种更优雅的仓储创建方式
 */

import { db } from '@/data/db';
import { cascadeExecutor } from '@/core/cascadeExecutor';
import { createRepository } from '@/data/repository';
import { getLogger } from '@/lib/logger';
import { now } from '@/lib/utils';
import type { StoreName } from '@/config/dbConfig';
import type { 
  IGateway, 
  IRepository, 
  IRepositoryConfig,
  ITransactionContext,
  CascadeTargetResult 
} from './gateway.types';

// Re-export utilities for convenience
export { now };

const logger = getLogger();

/**
 * DataGateway 实现类
 */
class DataGatewayImpl implements IGateway {
  
  // ====== 生命周期管理 ======
  
  isReady(): boolean {
    return db.isReady();
  }
  
  async init(): Promise<void> {
    return db.init();
  }
  
  async ready(): Promise<void> {
    return db.ready();
  }

  // ====== 事务管理 ======
  
  async runInTransaction<T>(
    storeNames: StoreName[],
    mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => Promise<T> | T,
  ): Promise<T> {
    return db.withTransaction(storeNames, mode, callback);
  }
  
  async runInTransactionWithContext<T>(
    storeNames: StoreName[],
    mode: IDBTransactionMode,
    callback: (ctx: ITransactionContext) => Promise<T> | T,
  ): Promise<T> {
    return db.withTransaction(storeNames, mode, async (tx) => {
      const context = new TransactionContextImpl(tx);
      return callback(context);
    });
  }

  // ====== 基础 CRUD ======
  
  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    logger.debug(`[Gateway] get: store=${store}, key=${key}`);
    return db.get<T>(store, key);
  }
  
  async getAll<T>(store: StoreName): Promise<T[]> {
    logger.debug(`[Gateway] getAll: store=${store}`);
    return db.getAll<T>(store);
  }
  
  async queryByIndex<T>(
    store: StoreName,
    indexName: string,
    value: string,
  ): Promise<T[]> {
    logger.debug(`[Gateway] queryByIndex: store=${store}, index=${indexName}, value=${value}`);
    return db.getAllByIndex<T>(store, indexName, value);
  }
  
  async put<T>(store: StoreName, value: T): Promise<void> {
    logger.debug(`[Gateway] put: store=${store}`);
    return db.put(store, value);
  }
  
  async delete(store: StoreName, key: string): Promise<void> {
    logger.debug(`[Gateway] delete: store=${store}, key=${key}`);
    return db.delete(store, key);
  }
  
  async deleteByIndex(
    store: StoreName,
    indexName: string,
    value: string,
  ): Promise<number> {
    logger.debug(`[Gateway] deleteByIndex: store=${store}, index=${indexName}, value=${value}`);
    return db.deleteByIndex(store, indexName, value);
  }

  // ====== 批量操作 ======
  
  async batchPut<T>(store: StoreName, items: T[]): Promise<void> {
    logger.info(`[Gateway] batchPut: store=${store}, count=${items.length}`);
    return this.runInTransaction(
      [store],
      'readwrite',
      async () => {
        for (const item of items) {
          await db.put(store, item);
        }
      }
    );
  }
  
  async clearStore(store: StoreName): Promise<void> {
    logger.warn(`[Gateway] clearStore: store=${store}`);
    return db.clear(store);
  }

  // ====== 级联操作 ======
  
  async deleteWithCascade(
    store: StoreName,
    id: string,
  ): Promise<{ targets: CascadeTargetResult[] }> {
    logger.info(`[Gateway] deleteWithCascade: store=${store}, id=${id}`);
    
    const result = await cascadeExecutor.execute(store, id);
    const targets: CascadeTargetResult[] = result.targets.map(t => ({
      store: t.store as StoreName,
      strategy: t.strategy,
      affectedCount: t.affectedCount,
    }));
    
    return { targets };
  }

  // ====== 数据管理 ======
  
  async resetAll(): Promise<void> {
    logger.warn('[Gateway] resetAll: Clearing ALL stores!');
    return db.reset();
  }
  
  async exportData(): Promise<Record<string, unknown[]>> {
    logger.info('[Gateway] exportData');
    return db.export();
  }
  
  async importData(data: Record<string, unknown[]>): Promise<void> {
    logger.info(`[Gateway] importData: importing ${Object.keys(data).length} stores`);
    return db.import(data);
  }

  // ====== 工厂方法 ======
  
  createRepository<T, TKey = string>(
    config: IRepositoryConfig<T, TKey>,
  ): IRepository<T, TKey> {
    logger.debug(`[Gateway] createRepository: store=${config.store}`);
    return createRepository<T, TKey>(config as any) as IRepository<T, TKey>;
  }
}

/**
 * Gateway 单例
 */
export const gateway: IGateway = new DataGatewayImpl();

/**
 * 便捷方法：获取 Gateway 实例
 */
export function getDataGateway(): IGateway {
  return gateway;
}

/**
 * 事务上下文实现类
 * 在事务内提供类型安全的 CRUD 操作，避免直接操作 IDBTransaction
 */
class TransactionContextImpl implements ITransactionContext {
  readonly tx: IDBTransaction;
  
  constructor(tx: IDBTransaction) {
    this.tx = tx;
  }
  
  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const objectStore = this.tx.objectStore(store);
    return new Promise<T | undefined>((resolve, reject) => {
      const request = objectStore.get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  }
  
  async getAll<T>(store: StoreName): Promise<T[]> {
    const objectStore = this.tx.objectStore(store);
    return new Promise<T[]>((resolve, reject) => {
      const request = objectStore.getAll();
      request.onsuccess = () => resolve((request.result ?? []) as T[]);
      request.onerror = () => reject(request.error);
    });
  }
  
  async queryByIndex<T>(
    store: StoreName,
    indexName: string,
    value: string,
  ): Promise<T[]> {
    const objectStore = this.tx.objectStore(store);
    const index = objectStore.index(indexName);
    return new Promise<T[]>((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve((request.result ?? []) as T[]);
      request.onerror = () => reject(request.error);
    });
  }
  
  async put<T>(store: StoreName, value: T): Promise<void> {
    const objectStore = this.tx.objectStore(store);
    return new Promise<void>((resolve, reject) => {
      const request = objectStore.put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async delete(store: StoreName, key: string): Promise<void> {
    const objectStore = this.tx.objectStore(store);
    return new Promise<void>((resolve, reject) => {
      const request = objectStore.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export type { IGateway, IRepository, IRepositoryConfig, CascadeTargetResult, ITransactionContext };
