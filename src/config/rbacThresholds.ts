/**
 * RBAC 权限管理阈值配置
 *
 * 零硬编码锚点：所有 RBAC 相关阈值集中于此，禁止在 services/store/pages 中硬编码
 *
 * 变更记录：
 * - v1.0.0 (2026-07-08): 初始版本，参考 7 Privilege Management Mistakes 与 OWASP BAC 最佳实践
 *
 * 依据：
 * - 7 Privilege Management Mistakes: 默认授予过宽权限是 #1 错误（Dropbox Sign 案例）
 * - OWASP Broken Access Control: 最小权限原则是缓解 BAC 的首要控制
 * - 访问控制 5 大致命问题: 32% 离职员工账号未及时禁用 → 僵尸账号检测间隔应 <= 7 天
/**
 * RBAC 阈值配置接口
  * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
*/
export interface RbacThresholds {
  /** 权限默认有效期（ms），默认 90 天，防止"一授终身" */
  readonly defaultPermissionTtlMs: number
  /** 权限最大有效期（ms），默认 365 天，硬上限 */
  readonly maxPermissionTtlMs: number
  /** 僵尸账号检测阈值（天），超过此天数未活跃则标记为 inactive */
  readonly inactivityThresholdDays: number
  /** 僵尸账号检测任务执行间隔（ms），默认 24 小时 */
  readonly zombieDetectionIntervalMs: number
  /** 权限过期回收任务执行间隔（ms），默认 1 小时 */
  readonly expiryRevocationIntervalMs: number
  /** 过期权限宽限期（ms），过期后宽限期内仍可用，用于避免边界误判，默认 0（立即失效） */
  readonly expiryGracePeriodMs: number
  /** 角色继承最大深度，防止权限蔓延 */
  readonly maxRoleInheritanceDepth: number
  /** 僵尸权限检测阈值（天），超过此天数未使用的权限标记为候选回收 */
  readonly zombiePermissionThresholdDays: number
  /** 单次回收任务最大处理记录数，防止长时间阻塞 */
  readonly revocationBatchSize: number
  /** 权限检查缓存 TTL（ms） */
  readonly permissionCheckCacheTtlMs: number
  /** 权限检查缓存最大条目数 */
  readonly permissionCheckCacheMaxEntries: number
  /** 审计日志归档保留天数（超过此天数的日志将被归档导出），默认 90 天 */
  readonly auditLogRetentionDays: number
  /** 审计日志归档任务执行间隔（ms），默认 7 天 */
  readonly auditLogArchiveIntervalMs: number
  /** 审计日志删除失败告警阈值配置 */
  readonly deleteAlertThresholds: DeleteAlertThresholds
}

/**
 * 审计日志删除失败告警阈值
 *
 * 针对 SOP 中定义的 5 类错误分别配置阈值。
 * 当某类错误率超过阈值时，自动触发 EventBus 告警事件 + Webhook 通知。
 *
 * 错误类型说明（对应 SOP §4）：
 * - EnvelopeError: ACL 权限拒绝或信封校验失败（配置问题，需立即关注）
 * - DataError: 记录不存在或数据损坏（通常为并发删除，可容忍较高阈值）
 * - QuotaExceededError: 存储配额超限（严重问题，即使 1% 也需告警）
 * - InvalidStateError: 数据库连接异常（基础设施问题，需关注）
 * - UnknownError: 未分类异常（需人工排查）
 */
export interface DeleteAlertThresholds {
  /** 整体错误率阈值（百分比，0-100），超过则触发告警，默认 10% */
  readonly overallErrorRatePct: number
  /** 各错误类型的独立阈值（百分比，0-100） */
  readonly byErrorType: {
    /** EnvelopeError 阈值，默认 5%（ACL/信封问题需低阈值早告警） */
    readonly EnvelopeError: number
    /** DataError 阈值，默认 15%（并发删除导致 not found 可容忍） */
    readonly DataError: number
    /** QuotaExceededError 阈值，默认 1%（配额问题即使少量也需立即告警） */
    readonly QuotaExceededError: number
    /** InvalidStateError 阈值，默认 5%（数据库连接异常需关注） */
    readonly InvalidStateError: number
    /** UnknownError 阈值，默认 10%（未知错误需人工排查） */
    readonly UnknownError: number
  }
  /** 告警冷却时间（ms），同一错误类型在冷却期内不重复触发，默认 1 小时 */
  readonly cooldownMs: number
  /**
   * 告警 Webhook URL（为空则仅发布 EventBus 事件，不发送网络请求）
   * 配置后，告警会通过 fetch POST 发送 JSON payload 到此 URL，
   * 由后端服务负责发送邮件通知。
   */
  readonly webhookUrl: string | null
}

/**
 * 默认 RBAC 阈值配置
 *
 * 设计依据：
 * - defaultPermissionTtlMs = 90 天：参考特斯拉案例（新员工一周内拷贝 26000 文件），
 *   90 天足够覆盖项目周期，过期需重新审批
 * - inactivityThresholdDays = 30 天：参考"32% 离职员工账号未及时禁用"数据，
 *   30 天可覆盖正常休假，同时避免长期僵尸账号
 * - zombieDetectionIntervalMs = 24 小时：每日检测一次，平衡新鲜度与性能
 * - expiryRevocationIntervalMs = 1 小时：过期回收需及时但不必过频
 * - maxRoleInheritanceDepth = 3：参考 WorkOS"限制继承避免权限蔓延"建议
 */
export const DEFAULT_RBAC_THRESHOLDS: RbacThresholds = {
  defaultPermissionTtlMs: 90 * 24 * 60 * 60 * 1000, // 90 天
  maxPermissionTtlMs: 365 * 24 * 60 * 60 * 1000, // 365 天
  inactivityThresholdDays: 30,
  zombieDetectionIntervalMs: 24 * 60 * 60 * 1000, // 24 小时
  expiryRevocationIntervalMs: 60 * 60 * 1000, // 1 小时
  expiryGracePeriodMs: 0, // 立即失效
  maxRoleInheritanceDepth: 3,
  zombiePermissionThresholdDays: 90,
  revocationBatchSize: 100,
  permissionCheckCacheTtlMs: 10 * 1000, // 10 秒（与 MemoryCache TTL 对齐）
  permissionCheckCacheMaxEntries: 200,
  auditLogRetentionDays: 90, // 90 天后归档
  auditLogArchiveIntervalMs: 7 * 24 * 60 * 60 * 1000, // 7 天执行一次归档
  deleteAlertThresholds: {
    overallErrorRatePct: 10, // 整体错误率 > 10% 触发告警
    byErrorType: {
      EnvelopeError: 5, // ACL 问题 > 5% 即告警
      DataError: 15, // 并发删除可容忍较高阈值
      QuotaExceededError: 1, // 配额问题即使 1% 也需立即告警
      InvalidStateError: 5, // 连接异常 > 5% 即告警
      UnknownError: 10, // 未知错误 > 10% 需人工排查
    },
    cooldownMs: 60 * 60 * 1000, // 1 小时冷却
    webhookUrl: null, // 默认不发 Webhook，需在运行时配置
  },
} as const

/**
 * RBAC 系统角色常量（内置角色，不可删除）
 * 参考 WorkOS"基于职位功能创建角色"最佳实践
 */
export const BUILT_IN_ROLES = {
  /** 系统管理员（受限，不应等同于"超级用户"） */
  ADMIN: 'admin',
  /** 分析师（可读取/分析，不可交易） */
  ANALYST: 'analyst',
  /** 交易员（可读取/分析 + 下单/撤单） */
  TRADER: 'trader',
  /** 观察者（只读） */
  VIEWER: 'viewer',
} as const

/**
 * RBAC 权限命名常量
 * 格式：resource:action
 */
export const PERMISSION_NAMESPACE = {
  SEPARATOR: ':',
  WILDCARD: '*',
} as const

/**
 * 获取当前生效的 RBAC 阈值配置
 * 未来可扩展为从 localStorage 读取用户自定义配置
 */
export function getRbacThresholds(): RbacThresholds {
  return DEFAULT_RBAC_THRESHOLDS
}
