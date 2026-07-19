/**
 * @module data/audit
 * @description D-04：审计字段与数据留存策略
 *
 * 设计目标（对应整改方案 D-04）：
 * 1) 关键实体统一携带审计字段（创建/更新时间、版本、操作人）
 * 2) 写入链路可自动填充审计字段（纯函数、不可变）
 * 3) 可配置的留存窗口与冷热分层策略
 * 4) 审计查询接口，供线上问题快速定位责任人/时间
 *
 * 分层合规：data/ 仅依赖 lib 基础设施（logger），与 D-02 的 repository/queryBuilder 同模式，
 * 符合 AGENTS.md §一 分层白名单。
  * @doc []
*/

import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 一天毫秒数（避免魔法数字） */
const DAY_MS = 24 * 60 * 60 * 1000

/** 审计元数据：关键实体统一携带 */
export interface AuditMeta {
  /** 创建时间戳 (ms) */
  createdAt: number
  /** 更新时间戳 (ms) */
  updatedAt: number
  /** 版本号，每次更新自增 */
  version: number
  /** 操作人（来源模块 / 用户标识） */
  operator: string
}

/** 携带审计字段的记录 */
export type Auditable<T> = T & { audit: AuditMeta }

export interface StampOptions {
  /** 操作人标识（来源模块 / 用户） */
  operator: string
  /** 注入时间（便于测试与回放），缺省取 Date.now() */
  now?: number
  /** 既有审计字段：传入则按「更新」处理（保留 createdAt、version+1） */
  previous?: AuditMeta | undefined
}

/**
 * 为记录填充审计字段（不可变：返回新对象，不修改入参）。
 * - 创建（无 previous）：createdAt=updatedAt=now，version=1
 * - 更新（有 previous）：保留 createdAt、version 自增，updatedAt=now
 */
export function stampAuditFields<T extends Record<string, unknown>>(
  record: T,
  opts: StampOptions,
): Auditable<T> {
  const now = opts.now ?? Date.now()
  const isUpdate = opts.previous !== undefined

  const audit: AuditMeta = isUpdate
    ? {
        createdAt: opts.previous!.createdAt,
        updatedAt: now,
        version: opts.previous!.version + 1,
        operator: opts.operator,
      }
    : {
        createdAt: now,
        updatedAt: now,
        version: 1,
        operator: opts.operator,
      }

  logger.debug(`[audit] stampAuditFields: ${isUpdate ? 'update' : 'create'} v${audit.version} operator=${opts.operator}`)
  return { ...record, audit }
}

/** 可配置留存策略 */
export interface RetentionPolicy {
  /** 热数据留存窗口（ms），超过转入冷层 */
  hotTtlMs: number
  /** 冷数据留存窗口（ms），超过则过期待归档/清理 */
  coldTtlMs: number
  /** 是否启用冷层（false 时冷层数据直接视为过期） */
  enableColdTier: boolean
}

/** 默认留存策略：热 30 天，冷 365 天，启用冷热分层 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  hotTtlMs: 30 * DAY_MS,
  coldTtlMs: 365 * DAY_MS,
  enableColdTier: true,
}

export interface RetentionResult<T> {
  /** 热层：仍在活跃留存窗口 */
  hot: T[]
  /** 冷层：已超出热窗口但未超冷窗口（待归档） */
  cold: T[]
  /** 过期：超出冷窗口，待清理 */
  expired: T[]
}

/**
 * 按留存策略对审计记录做冷热分层与过期判定（纯函数）。
 * 以 `audit.updatedAt` 为基准：
 * - age < hotTtlMs：热层
 * - hotTtlMs ≤ age < coldTtlMs：冷层（enableColdTier 时；否则直接过期）
 * - age ≥ coldTtlMs：过期
 * 缺审计字段的记录保守归入冷层待人工核查。
 */
export function applyRetention<T extends { audit?: AuditMeta }>(
  records: readonly T[],
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
  now: number = Date.now(),
): RetentionResult<T> {
  const hot: T[] = []
  const cold: T[] = []
  const expired: T[] = []

  for (const r of records) {
    const updatedAt = r.audit?.updatedAt
    if (updatedAt === undefined) {
      cold.push(r)
      continue
    }
    const age = now - updatedAt
    if (age < policy.hotTtlMs) {
      hot.push(r)
    } else if (policy.enableColdTier && age < policy.coldTtlMs) {
      cold.push(r)
    } else {
      expired.push(r)
    }
  }

  logger.debug(`[audit] applyRetention: hot=${hot.length} cold=${cold.length} expired=${expired.length}`)
  return { hot, cold, expired }
}

export interface AuditQueryFilter {
  /** 按操作人过滤 */
  operator?: string
  /** 按更新时间下限过滤（含） */
  from?: number
  /** 按更新时间上限过滤（含） */
  to?: number
  /** 按最小版本过滤 */
  minVersion?: number
}

/**
 * 审计查询接口：按操作人 / 时间范围 / 最小版本过滤审计记录（纯函数）。
 * 供线上问题快速定位责任人 / 时间。
 */
export function queryAuditTrail<T extends { audit?: AuditMeta }>(
  records: readonly T[],
  filter: AuditQueryFilter = {},
): T[] {
  return records.filter((r) => {
    const a = r.audit
    if (!a) return false
    if (filter.operator !== undefined && a.operator !== filter.operator) return false
    if (filter.from !== undefined && a.updatedAt < filter.from) return false
    if (filter.to !== undefined && a.updatedAt > filter.to) return false
    if (filter.minVersion !== undefined && a.version < filter.minVersion) return false
    return true
  })
}
