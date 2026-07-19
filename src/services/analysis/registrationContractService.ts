/**
 * 注册与契约状态查询服务
 *
 * 从本地持久化数据源（IndexedDB via DataBridge）查询注册记录与契约履行状态，
 * 并计算异常检测与健康评分。
 *
 * @module services/registrationContractService
 * @since 2026-07-18
  * @doc [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
*/

import type {
  StatusQueryInput,
  StatusQueryResult,
  RegistrationRecord,
  ContractRecord,
  StatusSummary,
} from '@/types/modules/registration-contract.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ── 模拟数据源（后续接 DataBridge / indexedDBProvider） ──────

const MOCK_REGISTRATIONS: Record<string, RegistrationRecord> = {
  'user-001': {
    userId: 'user-001',
    phase: 'active',
    registeredAt: '2026-01-15T08:30:00Z',
    activatedAt: '2026-01-15T08:35:00Z',
    channel: 'web',
    verified: true,
    anomalies: [],
  },
  'user-002': {
    userId: 'user-002',
    phase: 'pending',
    registeredAt: '2026-06-01T10:00:00Z',
    activatedAt: null,
    channel: 'app',
    verified: false,
    anomalies: ['not_activated', 'missing_verification'],
  },
  'user-003': {
    userId: 'user-003',
    phase: 'expired',
    registeredAt: '2025-03-20T14:00:00Z',
    activatedAt: '2025-03-21T09:00:00Z',
    channel: 'import',
    verified: true,
    anomalies: ['expired_session'],
  },
}

const MOCK_CONTRACTS: ContractRecord[] = [
  {
    contractId: 'ctr-001',
    name: '数据服务协议',
    signedAt: '2026-01-20T00:00:00Z',
    effectiveAt: '2026-02-01T00:00:00Z',
    expiresAt: '2027-02-01T00:00:00Z',
    phase: 'active',
    progress: 65,
    milestones: [
      { key: 'm1', label: '初期部署', plannedDate: '2026-03-01', completedDate: '2026-03-05', overdue: true },
      { key: 'm2', label: '中期验收', plannedDate: '2026-07-01', completedDate: null, overdue: true },
      { key: 'm3', label: '终验交付', plannedDate: '2026-12-01', completedDate: null, overdue: false },
    ],
    breachRecords: [],
    anomalies: ['milestone_overdue'],
  },
  {
    contractId: 'ctr-002',
    name: '系统运维 SLA',
    signedAt: '2026-03-10T00:00:00Z',
    effectiveAt: '2026-04-01T00:00:00Z',
    expiresAt: '2028-04-01T00:00:00Z',
    phase: 'active',
    progress: 40,
    milestones: [
      { key: 'm1', label: 'SLA 基线确立', plannedDate: '2026-05-01', completedDate: '2026-04-28', overdue: false },
      { key: 'm2', label: '季度审查', plannedDate: '2026-10-01', completedDate: null, overdue: false },
    ],
    breachRecords: [],
    anomalies: [],
  },
  {
    contractId: 'ctr-003',
    name: '数据合规承诺书',
    signedAt: null,
    effectiveAt: null,
    expiresAt: null,
    phase: 'unsigned',
    progress: 0,
    milestones: [],
    breachRecords: [
      { date: '2026-05-12', type: 'data_breach', description: '未授权数据导出', severity: 4, resolved: false },
    ],
    anomalies: ['not_signed', 'has_breaches'],
  },
]

// ── 查询服务 ───────────────────────────────────────────────

function computeSummary(
  reg: RegistrationRecord,
  contracts: ContractRecord[],
): StatusSummary {
  const regAnomalies = reg.anomalies.length
  const contractAnomalies = contracts.reduce((sum, c) => sum + c.anomalies.length, 0)
  const activeContracts = contracts.filter((c) => c.phase === 'active').length
  const breachedContracts = contracts.filter((c) => c.phase === 'breached' || c.breachRecords.length > 0).length

  // 健康评分：注册 40% + 契约 60%
  const regScore = reg.phase === 'active' && reg.verified ? 40 : reg.phase === 'pending' ? 20 : 10
  const contractScore = contracts.length > 0
    ? Math.round((contracts.filter((c) => c.anomalies.length === 0).length / contracts.length) * 60)
    : 60
  const healthScore = Math.max(0, Math.min(100, regScore + contractScore - (regAnomalies + contractAnomalies) * 5))

  return {
    totalAnomalies: regAnomalies + contractAnomalies,
    registrationAnomalies: regAnomalies,
    contractAnomalies,
    activeContracts,
    breachedContracts,
    healthScore,
  }
}

/**
 * 查询用户注册状态及关联契约履行情况。
 *
 * @param input — 查询入参（userId 必填）
 * @returns 结构化查询结果，含异常检测和健康评分
 */
export async function queryStatusService(
  input: StatusQueryInput,
): Promise<StatusQueryResult> {
  logger.info('[queryStatusService] 查询开始', { userId: input.userId })

  // 1. 查询注册记录
  const registration = MOCK_REGISTRATIONS[input.userId]
  if (!registration) {
    throw new Error(`用户 ${input.userId} 的注册记录未找到`)
  }

  // 2. 查询关联契约
  let contracts = MOCK_CONTRACTS
  if (input.contractIds && input.contractIds.length > 0) {
    contracts = contracts.filter((c) => input.contractIds!.includes(c.contractId))
  }

  // 3. 异常检测
  const now = new Date()
  const updatedContracts = contracts.map((c) => {
    const anomalies = [...c.anomalies]

    // 检测逾期里程碑
    const overdueMs = c.milestones.filter(
      (m) => !m.completedDate && new Date(m.plannedDate) < now,
    )
    if (overdueMs.length > 0 && !anomalies.includes('milestone_overdue')) {
      anomalies.push('milestone_overdue')
    }

    // 检测临近到期（30 天内）
    if (c.expiresAt && c.phase === 'active') {
      const daysLeft = Math.ceil(
        (new Date(c.expiresAt).getTime() - now.getTime()) / 86400000,
      )
      if (daysLeft <= 30 && daysLeft > 0 && !anomalies.includes('approaching_expiry')) {
        anomalies.push('approaching_expiry')
      }
    }

    return { ...c, anomalies }
  })

  // 4. 计算汇总
  const summary = computeSummary(registration, updatedContracts)

  logger.info('[queryStatusService] 查询完成', {
    healthScore: summary.healthScore,
    totalAnomalies: summary.totalAnomalies,
  })

  return {
    queriedAt: new Date().toISOString(),
    registration,
    contracts: updatedContracts,
    summary,
  }
}
