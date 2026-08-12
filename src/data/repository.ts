/**
 * repository.ts — D-02 统一数据访问层（Repository 规范化）
 *
 * 目标：为分散在 24 个 store 中的异构数据访问提供**统一的契约**，
 * 让上层（services / pages / 组件）通过一致的 `get / getAll / queryByIndex /
 * put / delete` 接口读写数据，而不必关心底层 envelope action 与 store 差异。
 *
 * 设计原则（遵循 AGENTS.md 分层约束）：
 * - 仅依赖 core/（dataBridge, envelope）、config/（dbConfig）、lib/（logger）、types/
 * - 不引入新的 envelope action；写入复用各 store 既有的 action 名
 * - D-03（消除直连 IndexedDB 旁路）将把 13 个旁路组件迁移到本契约
 *
 * @compliance AGENTS.md §一：data/ 仅依赖 core/、config/、lib/、types/
  * @doc []
*/

import {
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  type ModuleId,
  type StoreName,
} from '@/config/dbConfig'
import { dataBridge, type QueryRequest } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult } from './types'

import { nanoid } from 'nanoid'
const logger = getLogger()

/** 统一仓储契约：所有数据访问对象应实现此接口 */
export interface Repository<T, TKey = string> {
  /** 所属存储名（用于日志/审计） */
  readonly store: StoreName
  /** 按主键读取单条 */
  get(key: TKey): Promise<T | undefined>
  /** 读取全部 */
  getAll(): Promise<T[]>
  /** 按索引读取 */
  queryByIndex(indexName: string, value: unknown): Promise<T[]>
  /** 写入（insert/update 复用同一 action） */
  put(entity: T, key: TKey): Promise<DataLayerResult<void>>
  /** 删除 */
  delete(key: TKey): Promise<DataLayerResult<void>>
}

/** 创建 Repository 所需的配置 */
export interface RepositoryConfig<T, TKey> {
  /** 目标存储 */
  store: StoreName
  /** 写入（insert/update）对应的 envelope action */
  writeAction: keyof typeof ENVELOPE_ACTION
  /** 删除对应的 envelope action */
  deleteAction: keyof typeof ENVELOPE_ACTION
  /** 来源模块，缺省 system（拥有全部读写权限） */
  source?: ModuleId
  /** 从实体解析主键，用于日志与 key 透传 */
  keyOf: (entity: T) => TKey
}

function createTraceId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`
}

/**
 * 构建一个统一仓储实例。
 *
 * 读取直接委托给 dataBridge.query（与 dataLayer 同源）；
 * 写入委托给 dataBridge.forward，复用各 store 既有的 envelope action，
 * 不新增任何 action，保证与既有 dataBridge 路由完全兼容。
 */
export function createRepository<T, TKey = string>(
  config: RepositoryConfig<T, TKey>,
): Repository<T, TKey> {
  const source: ModuleId = config.source ?? 'system'
  const sourceId = MODULE_ID[source]

  const safeQuery = async <R,>(
    request: QueryRequest,
    op: string,
    onFail: () => R,
  ): Promise<R> => {
    const res = await dataBridge.query<R>(request)
    if (!res.success) {
      logger.error(`[Repository] ${config.store} ${op} 失败`, { error: res.error })
      return onFail()
    }
    return res.data as R
  }

  const forward = async (
    action: keyof typeof ENVELOPE_ACTION,
    payload: unknown,
  ): Promise<DataLayerResult<void>> => {
    try {
      const envelope = EnvelopeFactory.create(
        {
          source: sourceId,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION[action],
          traceId: createTraceId('repo'),
        },
        payload,
      )
      await dataBridge.forward(envelope)
      return { success: true }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error(`[Repository] ${config.store} ${action} 写入失败`, { error: message })
      return { success: false, error: message }
    }
  }

  return {
    store: config.store,

    async get(key: TKey): Promise<T | undefined> {
      return safeQuery<T | undefined>(
        {
          action: ENVELOPE_ACTION.queryGet,
          store: config.store,
          key: key as string,
          source: sourceId,
        },
        `get: key=${String(key)}`,
        () => undefined,
      )
    },

    async getAll(): Promise<T[]> {
      return safeQuery<T[]>(
        {
          action: ENVELOPE_ACTION.queryList,
          store: config.store,
          source: sourceId,
        },
        'getAll',
        () => [],
      )
    },

    async queryByIndex(indexName: string, value: unknown): Promise<T[]> {
      return safeQuery<T[]>(
        {
          action: ENVELOPE_ACTION.queryByIndex,
          store: config.store,
          indexName,
          indexValue: value,
          source: sourceId,
        },
        `queryByIndex: index=${indexName}`,
        () => [],
      )
    },

    async put(entity: T, key: TKey): Promise<DataLayerResult<void>> {
      logger.info(`[Repository] ${config.store} put: key=${String(key)}`)
      return forward(config.writeAction, entity)
    },

    async delete(key: TKey): Promise<DataLayerResult<void>> {
      logger.info(`[Repository] ${config.store} delete: key=${String(key)}`)
      return forward(config.deleteAction, { key: key as string })
    },
  }
}
