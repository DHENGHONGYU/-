/**
 * @module DataLayersLogger
 * @description 数据层质量日志（P1 修复 R08：ACL 权限过滤审计日志）
 *
 * 记录 dataBridge.query() 和 dataBridge.forward() 的权限过滤行为：
 * 1. 记录每次查询的 ACL 过滤维度
 * 2. 对比预期数据量 vs 实际返回数据量
 * 3. 检测权限过度过滤
 *
 * @doc V9-DOC-QUALITY-008
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ── 类型定义 ──

/** ACL 过滤日志条目 */
export interface AclFilterLog {
  store: string
  action: 'query' | 'forward'
  requestedDimension: string
  appliedFilters: string[]
  expectedCount?: number
  actualCount: number
  filteredCount: number
  filterRate: number
  timestamp: number
  suspicious: boolean
}

/** ACL 审计统计 */
export interface AclAuditStats {
  totalQueries: number
  filteredQueries: number
  /** 过滤率 > 50% 的查询数 */
  suspiciousQueries: number
  recentLogs: AclFilterLog[]
}

// ── 全局状态 ──

let stats: AclAuditStats = {
  totalQueries: 0,
  filteredQueries: 0,
  suspiciousQueries: 0,
  recentLogs: [],
}

const MAX_LOG_ENTRIES = 200

// ── 核心 API ──

/**
 * 记录 ACL 过滤行为
 */
export function logAclFilter(log: Omit<AclFilterLog, 'filterRate' | 'timestamp' | 'suspicious'>): void {
  const filterRate = log.expectedCount && log.expectedCount > 0
    ? log.filteredCount / log.expectedCount
    : 0

  const suspicious = filterRate > 0.5

  const entry: AclFilterLog = {
    ...log,
    filterRate: parseFloat(filterRate.toFixed(4)),
    timestamp: Date.now(),
    suspicious,
  }

  stats.totalQueries++
  if (log.filteredCount > 0) {
    stats.filteredQueries++
  }
  if (suspicious) {
    stats.suspiciousQueries++
    logger.warn(
      `[ACL] 可疑过滤: ${log.store}/${log.action} 过滤率 ${(filterRate * 100).toFixed(0)}%`,
      {
        requestedDimension: log.requestedDimension,
        appliedFilters: log.appliedFilters,
        expectedCount: log.expectedCount,
        actualCount: log.actualCount,
      },
    )
  }

  stats.recentLogs.unshift(entry)
  if (stats.recentLogs.length > MAX_LOG_ENTRIES) {
    stats.recentLogs = stats.recentLogs.slice(0, MAX_LOG_ENTRIES)
  }
}

/**
 * 获取 ACL 审计统计
 */
export function getAclAuditStats(): Readonly<AclAuditStats> {
  return { ...stats }
}

/**
 * 获取可疑过滤记录
 */
export function getSuspiciousFilters(): AclFilterLog[] {
  return stats.recentLogs.filter((l) => l.suspicious)
}

/**
 * 重置统计
 */
export function resetAclStats(): void {
  stats = {
    totalQueries: 0,
    filteredQueries: 0,
    suspiciousQueries: 0,
    recentLogs: [],
  }
}

/**
 * 生成 ACL 审计报告
 */
export function generateAclReport(): string {
  const parts: string[] = [
    `查询总数: ${stats.totalQueries}`,
    `有过滤: ${stats.filteredQueries} (${stats.totalQueries > 0 ? ((stats.filteredQueries / stats.totalQueries) * 100).toFixed(1) : '0'}%)`,
    `可疑过滤(>50%): ${stats.suspiciousQueries}`,
  ]
  return parts.join(' | ')
}