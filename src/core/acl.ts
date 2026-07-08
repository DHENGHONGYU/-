import { getLogger } from '@/lib/logger'
import {
  ACL_MATRIX,
  DB_OPERATION,
  type DbOperation,
  type ModuleId,
  type StoreName,
} from '@/config/dbConfig'

const logger = getLogger()

export class AclError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AclError'
  }
}

interface AclCheckInput {
  module: ModuleId
  store: StoreName
  operation: DbOperation
}

export interface AclCheckResult {
  readonly allowed: boolean
  readonly reason: string
}

export function inferOperation(action: string): DbOperation {
  if (action.includes('INSERT') || action.includes('SAVE') || action.includes('INGEST')) {
    logger.debug(`[ACL] inferOperation: action="${action}" → "${DB_OPERATION.insert}"`)
    return DB_OPERATION.insert
  }
  if (action.includes('UPDATE')) {
    logger.debug(`[ACL] inferOperation: action="${action}" → "${DB_OPERATION.update}"`)
    return DB_OPERATION.update
  }
  if (action.includes('DELETE') || action.includes('CLEAR')) {
    logger.debug(`[ACL] inferOperation: action="${action}" → "${DB_OPERATION.delete}"`)
    return DB_OPERATION.delete
  }
  logger.debug(`[ACL] inferOperation: action="${action}" → "${DB_OPERATION.select}"`)
  return DB_OPERATION.select
}

export class AclEngine {
  /**
   * 检查权限（非抛出）；v6 参考对齐
   * 输出: { allowed, reason }
   */
  check({ module, store, operation }: AclCheckInput): AclCheckResult {
    const permission = ACL_MATRIX[module]

    if (!permission) {
      return { allowed: false, reason: `Module ${module} is not registered in ACL` }
    }

    if (!permission.actions.includes(operation)) {
      return { allowed: false, reason: `Module ${module} is not allowed to perform ${operation}` }
    }

    const allowedStores =
      operation === DB_OPERATION.select ? permission.read : permission.write

    if (!allowedStores.includes(store)) {
      return { allowed: false, reason: `Module ${module} cannot ${operation} on store ${store}` }
    }

    return { allowed: true, reason: 'Permission granted' }
  }

  /**
   * 断言权限（失败时抛出 AclError）
   * 内部委托 check()
   */
  assert(input: AclCheckInput): void {
    logger.debug(`[ACL] assert() called: module="${input.module}", store="${input.store}", operation="${input.operation}"`)

    const result = this.check(input)

    if (!result.allowed) {
      logger.error(`[ACL] Permission denied: ${result.reason}`)
      throw new AclError(result.reason)
    }

    logger.info(`[ACL] Permission granted: module="${input.module}", store="${input.store}", operation="${input.operation}"`)
  }

  /**
   * 包装操作（权限通过后执行）；v6 参考对齐
   * 禁止: 在操作函数执行后补校验
   */
  async wrap<T>(
    input: AclCheckInput,
    operation: () => Promise<T>,
  ): Promise<T> {
    this.assert(input)
    return operation()
  }
}

export const aclEngine = new AclEngine()
