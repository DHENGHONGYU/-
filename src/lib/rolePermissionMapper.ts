/**
 * @doc [V9-DOC-FRONT-037]
 */
import type { UserRole, DeveloperRole } from '@/types/role.types'
import type { McpCallerRole } from '@/types/modules/mcp.types'
import { ACL_MATRIX, MODULE_ID, DB_OPERATION, type ModuleId, type DbOperation } from '@/config/dbConfig'

/**
 * mapUserRoleToMcpRole
 * @param role
 * @returns McpCallerRole
 */
export function mapUserRoleToMcpRole(role: UserRole): McpCallerRole {
  switch (role) {
    case 'admin':
      return 'system'
    case 'trader':
      return 'agent'
    case 'analyst':
      return 'ui'
    case 'viewer':
      return 'ui'
    default:
      return 'ui'
  }
}

/**
 * mapDeveloperRoleToMcpRole
 * @param role
 * @returns McpCallerRole
 */
export function mapDeveloperRoleToMcpRole(role: DeveloperRole): McpCallerRole {
  switch (role) {
    case 'architect':
      return 'system'
    case 'fullstack':
      return 'system'
    case 'data':
      return 'system'
    case 'trading':
      return 'system'
    case 'ai-agent':
      return 'agent'
    case 'frontend':
      return 'ui'
    default:
      return 'agent'
  }
}

/**
 * getUserRoleAllowedModules
 * @param role
 * @returns ModuleId[]
 */
export function getUserRoleAllowedModules(role: UserRole): ModuleId[] {
  const moduleIds = Object.values(MODULE_ID) as ModuleId[]
  switch (role) {
    case 'admin':
      return moduleIds
    case 'trader':
      return [
        MODULE_ID.trading,
        MODULE_ID.strategy,
        MODULE_ID.analyzer,
        MODULE_ID.fetcher,
      ]
    case 'analyst':
      return [MODULE_ID.analyzer, MODULE_ID.fetcher, MODULE_ID.news]
    case 'viewer':
      return [MODULE_ID.analyzer, MODULE_ID.fetcher]
    default:
      return [MODULE_ID.analyzer, MODULE_ID.fetcher]
  }
}

/**
 * getDeveloperRoleAllowedModules
 * @param role
 * @returns ModuleId[]
 */
export function getDeveloperRoleAllowedModules(role: DeveloperRole): ModuleId[] {
  const moduleIds = Object.values(MODULE_ID) as ModuleId[]
  switch (role) {
    case 'architect':
      return moduleIds
    case 'fullstack':
      return [MODULE_ID.analyzer, MODULE_ID.trading, MODULE_ID.system, MODULE_ID.fetcher]
    case 'data':
      return [
        MODULE_ID.fetcher,
        MODULE_ID.datalayer,
        MODULE_ID.pool,
        MODULE_ID.rotation,
        MODULE_ID.sector,
        MODULE_ID.news,
        MODULE_ID.analyzer,
      ]
    case 'ai-agent':
      return [MODULE_ID.news, MODULE_ID.analyzer, MODULE_ID.fetcher, MODULE_ID.system]
    case 'trading':
      return [
        MODULE_ID.trading,
        MODULE_ID.strategy,
        MODULE_ID.orderstore,
        MODULE_ID.holdingsStore,
        MODULE_ID.executionPlans,
        MODULE_ID.executionLogs,
        MODULE_ID.portfolios,
        MODULE_ID.tradeReviews,
        MODULE_ID.tradinghub,
      ]
    case 'frontend':
      return []
    default:
      return []
  }
}

/**
 * checkUserRolePermission
 */
export function checkUserRolePermission(
  role: UserRole,
  module: ModuleId,
  operation: DbOperation,
): boolean {
  const allowedModules = getUserRoleAllowedModules(role)
  if (!allowedModules.includes(module)) {
    return false
  }
  const modulePermission = ACL_MATRIX[module]
  if (!modulePermission) {
    return false
  }
  if (!modulePermission.actions.includes(operation)) {
    return false
  }
  return true
}

/**
 * checkDeveloperRolePermission
 */
export function checkDeveloperRolePermission(
  role: DeveloperRole,
  module: ModuleId,
  operation: DbOperation,
): boolean {
  const allowedModules = getDeveloperRoleAllowedModules(role)
  if (!allowedModules.includes(module)) {
    return false
  }
  const modulePermission = ACL_MATRIX[module]
  if (!modulePermission) {
    return false
  }
  if (!modulePermission.actions.includes(operation)) {
    return false
  }
  return true
}

/**
 * checkUserRoleDbOperation
 */
export function checkUserRoleDbOperation(
  role: UserRole,
  module: ModuleId,
  action: string,
): boolean {
  let operation: DbOperation
  if (action.includes('INSERT') || action.includes('SAVE') || action.includes('INGEST')) {
    operation = DB_OPERATION.insert
  } else if (action.includes('UPDATE')) {
    operation = DB_OPERATION.update
  } else if (action.includes('DELETE') || action.includes('CLEAR')) {
    operation = DB_OPERATION.delete
  } else {
    operation = DB_OPERATION.select
  }
  return checkUserRolePermission(role, module, operation)
}

/**
 * checkDeveloperRoleDbOperation
 */
export function checkDeveloperRoleDbOperation(
  role: DeveloperRole,
  module: ModuleId,
  action: string,
): boolean {
  let operation: DbOperation
  if (action.includes('INSERT') || action.includes('SAVE') || action.includes('INGEST')) {
    operation = DB_OPERATION.insert
  } else if (action.includes('UPDATE')) {
    operation = DB_OPERATION.update
  } else if (action.includes('DELETE') || action.includes('CLEAR')) {
    operation = DB_OPERATION.delete
  } else {
    operation = DB_OPERATION.select
  }
  return checkDeveloperRolePermission(role, module, operation)
}