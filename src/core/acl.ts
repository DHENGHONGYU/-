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
  assert({ module, store, operation }: AclCheckInput): void {
    logger.debug(`[ACL] assert() called: module="${module}", store="${store}", operation="${operation}"`)

    const permission = ACL_MATRIX[module]

    if (!permission) {
      logger.error(`[ACL] Permission denied: Module "${module}" is not registered in ACL`)
      throw new AclError(`Module ${module} is not registered in ACL`)
    }

    logger.debug(`[ACL] Found permissions for module "${module}": actions=${JSON.stringify(permission.actions)}`)

    if (!permission.actions.includes(operation)) {
      logger.error(`[ACL] Permission denied: Module "${module}" is not allowed to perform "${operation}"`)
      throw new AclError(
        `Module ${module} is not allowed to perform ${operation}`,
      )
    }

    const allowedStores =
      operation === DB_OPERATION.select ? permission.read : permission.write

    logger.debug(`[ACL] Checking store access: operation="${operation}", allowedStores=${JSON.stringify(allowedStores)}`)

    if (!allowedStores.includes(store)) {
      logger.error(`[ACL] Permission denied: Module "${module}" cannot "${operation}" on store "${store}"`)
      throw new AclError(
        `Module ${module} cannot ${operation} on store ${store}`,
      )
    }

    logger.info(`[ACL] Permission granted: module="${module}", store="${store}", operation="${operation}"`)
  }
}

export const aclEngine = new AclEngine()
