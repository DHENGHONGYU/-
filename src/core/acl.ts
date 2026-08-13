/**
 * @doc [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
 */
import { getLogger } from '@/lib/logger'
import {
  ACL_MATRIX,
  DB_OPERATION,
  type DbOperation,
  type ModuleId,
  type StoreName,
} from '@/config/dbConfig'

const logger = getLogger()

/**
 * AclError
 */
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
  /** @since v1.0 envelope schema version 控制，旧模块 ("1.0") 可能应用更严格的规则 */
  apiVersion?: string
}

export interface AclCheckResult {
  readonly allowed: boolean
  readonly reason: string
}

/**
 * 模块权限等级（版本控制用）。
 * - full: 完整读写（新模块默认）
 * - readonly: 仅可 SELECT（旧模块迁移期）
 * - deny: 完全拒绝
 */
export type ModulePermissionLevel = 'full' | 'readonly' | 'deny'

/**
 * 版本控制权限覆盖条目。
 * key 格式为 "ModuleId:apiVersion"，如 "system:1.0" 表示 system 模块 apiVersion="1.0" 时应用此覆盖。
 */
export interface VersionedPermissionOverride {
  moduleId: ModuleId
  apiVersion: string
  level: ModulePermissionLevel
  storeOverrides?: {
    /** 版本控制的允许读 store（覆盖 ACL_MATRIX 的 read） */
    read?: readonly StoreName[]
    /** 版本控制的允许写 store（覆盖 ACL_MATRIX 的 write，为空数组即只读） */
    write?: readonly StoreName[]
  }
}

/**
 * inferOperation
 * @param action
 * @returns DbOperation
 */
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

/**
 * AclEngine
 */
export class AclEngine {
  /** 版本控制权限覆盖表 */
  private versionedOverrides = new Map<string, VersionedPermissionOverride>()

  /**
   * 注册一组版本控制权限覆盖。
   * 当模块以指定 apiVersion 请求时，应用此覆盖规则（比 ACL_MATRIX 更严格）。
   */
  registerVersionedOverride(override: VersionedPermissionOverride): void {
    const key = `${override.moduleId}:${override.apiVersion}`
    this.versionedOverrides.set(key, override)
  }

  /**
   * 批量注册版本控制覆盖（用于旧模块写权回收）。
   */
  registerVersionedOverrides(overrides: VersionedPermissionOverride[]): void {
    for (const ov of overrides) this.registerVersionedOverride(ov)
  }

  /**
   * 移除某模块某版本的覆盖。
   */
  unregisterVersionedOverride(moduleId: ModuleId, apiVersion: string): void {
    const key = `${moduleId}:${apiVersion}`
    this.versionedOverrides.delete(key)
  }

  /**
   * 检查权限（非抛出）；v6 参考对齐
   * 输出: { allowed, reason }
   * 防御性保证（fail-closed）：ACL_MATRIX 访问异常、actions/read/write 为 undefined 时
   * 一律返回 allowed=false，绝不因数据异常放行写操作。
   */
  check({ module, store, operation, apiVersion }: AclCheckInput): AclCheckResult {
    try {
      const permission = ACL_MATRIX[module]

      if (!permission) {
        return { allowed: false, reason: `Module ${module} is not registered in ACL` }
      }

      // ── 版本控制覆盖 ──
      if (apiVersion) {
        const overrideKey = `${module}:${apiVersion}`
        const override = this.versionedOverrides.get(overrideKey)
        if (override) {
          if (override.level === 'deny') {
            return { allowed: false, reason: `Module ${module} v${apiVersion} is denied by versioned override` }
          }
          if (override.level === 'readonly' && operation !== DB_OPERATION.select) {
            return { allowed: false, reason: `Module ${module} v${apiVersion} is read-only (operation ${operation} denied)` }
          }
          // 如果有 storeOverrides，用 override 中的 store 列表替代 ACL_MATRIX
          if (override.storeOverrides) {
            const allowedStores =
              operation === DB_OPERATION.select ? override.storeOverrides.read : override.storeOverrides.write
            if (!allowedStores?.includes(store)) {
              return { allowed: false, reason: `Module ${module} v${apiVersion} cannot ${operation} on store ${store} (versioned override)` }
            }
            return { allowed: true, reason: 'Permission granted (versioned override)' }
          }
        }
      }

      if (!(permission.actions ?? []).includes(operation)) {
        return { allowed: false, reason: `Module ${module} is not allowed to perform ${operation}` }
      }

      const allowedStores =
        operation === DB_OPERATION.select ? permission.read : permission.write

      if (!(allowedStores ?? []).includes(store)) {
        return { allowed: false, reason: `Module ${module} cannot ${operation} on store ${store}` }
      }

      return { allowed: true, reason: 'Permission granted' }
    } catch (err) {
      logger.error(`[ACL] check error (fail-closed): ${err instanceof Error ? err.message : String(err)}`)
      return {
        allowed: false,
        reason: `ACL check error: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  /**
   * 断言权限（失败时抛出 AclError）
   * 内部委托 check()
   */
  assert(input: AclCheckInput): void {
    logger.debug(`[ACL] assert() called: module="${input.module}", store="${input.store}", operation="${input.operation}", apiVersion="${input.apiVersion ?? 'unspecified'}"`)

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

/**
 * aclEngine
 */
export const aclEngine = new AclEngine()

// ──────────────────────────────────────────
// 预置版本控制覆盖（旧模块写权回收）
// ──────────────────────────────────────────

/**
 * 注册内置版本控制覆盖。
 * 旧模块（apiVersion="1.0"）在并存期逐步收紧权限：
 * - 阶段 A（并存开始）：降为 readonly（仅可 SELECT）
 * - 阶段 B（影子期）：部分 store 完全 deny
 * - 阶段 C（切换完成）：移除（ModuleManifest.status=removed）
 */
export function registerBuiltinVersionedOverrides(): void {
  aclEngine.registerVersionedOverrides([
    // V6 engine → 只读（已有 V9 intelligentScore 接管写入）
    {
      moduleId: 'system',
      apiVersion: '1.0',
      level: 'readonly',
    },
    // dualStrategy / unifiedStock / tradeReviewAI / portfolioService / executionPlanService
    // 这些 @deprecated facade 的 source 走 system，统一降至 readonly
  ])

  // 可按 ModuleId 细分更多 override
}
