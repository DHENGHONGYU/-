/**
 * @fileoverview 契约验证器核心
 * @description 提供契约注册、运行时验证、违反记录与报告功能
 *
 * 职责：
 * 1. 注册 Zod schema 作为运行时契约
 * 2. 在测试中通过 assertContract() 验证数据是否符合契约
 * 3. 收集并报告所有契约违反记录
 */

import type { ZodSchema } from 'zod'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 已注册的契约 */
interface RegisteredContract {
  /** 契约名称 */
  name: string
  /** Zod schema 验证器 */
  schema: ZodSchema
  /** 契约描述（可选） */
  description?: string
}

/** 契约违反记录 */
interface ContractViolation {
  /** 契约名称 */
  contract: string
  /** 违反的测试用例名称 */
  test: string
  /** 违反的数据快照 */
  data: unknown
  /** Zod 错误详情 */
  errors: string[]
  /** 违反时间戳 */
  timestamp: number
}

// ============================================================
// 全局状态
// ============================================================

/** 契约注册表 */
const registry: Map<string, RegisteredContract> = new Map()

/** 契约违反记录 */
const violations: ContractViolation[] = []

/** 验证统计 */
const stats = {
  totalValidations: 0,
  passedValidations: 0,
  failedValidations: 0,
}

// ============================================================
// 契约注册
// ============================================================

/**
 * 注册契约到全局验证器
 * @param name 契约名称（必须唯一）
 * @param schema Zod schema 验证器
 * @param description 契约描述（可选）
 */
export function registerContract(
  name: string,
  schema: ZodSchema,
  description?: string,
): void {
  logger.debug(`[ContractValidator] registerContract() 开始: name="${name}", description="${description || '(无)'}"` )

  if (registry.has(name)) {
    logger.warn(`[ContractValidator] 契约 "${name}" 已存在，将被覆盖`)
  }

  registry.set(name, { name, schema, description })
  logger.info(
    `[ContractValidator] registerContract() 完成: ` +
    `name="${name}", 当前注册表大小=${registry.size}` +
    (description ? `, description="${description}"` : '')
  )
}

/**
 * 批量注册契约
 * @param contracts 契约列表
 */
export function registerContracts(
  contracts: Array<{ name: string; schema: ZodSchema; description?: string }>,
): void {
  contracts.forEach(({ name, schema, description }) => {
    registerContract(name, schema, description)
  })
}

/**
 * 获取所有已注册的契约名称
 */
export function getRegisteredContracts(): string[] {
  return Array.from(registry.keys())
}

// ============================================================
// 契约验证
// ============================================================

/**
 * 验证数据是否符合已注册契约
 * @param contractName 契约名称
 * @param data 待验证数据
 * @param testName 测试用例名称（用于报告）
 * @param sourceInfo 来源信息（可选，用于追踪数据来源）
 * @throws 如果数据不符合契约
 */
export function assertContract(
  contractName: string,
  data: unknown,
  testName: string,
  sourceInfo?: { module?: string; method?: string; traceId?: string },
): void {
  const contract = registry.get(contractName)
  if (!contract) {
    const availableContracts = getRegisteredContracts()
    logger.error(
      `[ContractValidator] 契约未找到: "${contractName}"\n` +
      `  来源: ${sourceInfo?.module || 'unknown'}::${sourceInfo?.method || 'unknown'}\n` +
      `  已注册契约数: ${availableContracts.length}\n` +
      `  已注册契约: ${availableContracts.slice(0, 10).join(', ')}${availableContracts.length > 10 ? '...' : ''}`
    )
    throw new Error(
      `[ContractValidator] 未注册的契约: "${contractName}"\n` +
      `  已注册的契约: ${availableContracts.join(', ') || '(无)'}`
    )
  }

  stats.totalValidations++

  logger.info(
    `[ContractValidator] 开始验证: contract="${contractName}", test="${testName}"\n` +
    `  来源: ${sourceInfo?.module || 'unknown'}::${sourceInfo?.method || 'unknown'}\n` +
    `  traceId: ${sourceInfo?.traceId || 'N/A'}\n` +
    `  数据类型: ${typeof data}\n` +
    `  数据大小: ${JSON.stringify(data).length} chars`
  )

  if (data !== null && typeof data === 'object') {
    const keys = Object.keys(data)
    logger.debug(
      `[ContractValidator] 数据字段: ${keys.join(', ')}\n` +
      `  字段数: ${keys.length}`
    )
  }

  const result = contract.schema.safeParse(data)

  if (result.success) {
    stats.passedValidations++
    logger.info(
      `[ContractValidator] ✅ 验证通过: contract="${contractName}", test="${testName}"\n` +
      `  来源: ${sourceInfo?.module || 'unknown'}::${sourceInfo?.method || 'unknown'}`
    )
    return
  }

  stats.failedValidations++

  const errors = result.error.issues.map(
    (issue) => {
      const pathStr = issue.path.join('.')
      const detail = `字段 "${pathStr}" 验证失败: ${issue.message}`
      logger.error(`[ContractValidator] ❌ ${detail}`)
      return detail
    }
  )

  const violation: ContractViolation = {
    contract: contractName,
    test: testName,
    data,
    errors,
    timestamp: Date.now(),
  }

  violations.push(violation)

  const dataPreview = typeof data === 'object' && data !== null
    ? JSON.stringify(data, null, 2).slice(0, 500)
    : String(data)

  logger.error(
    `[ContractValidator] ❌ 契约违反: contract="${contractName}", test="${testName}"\n` +
    `  来源: ${sourceInfo?.module || 'unknown'}::${sourceInfo?.method || 'unknown'}\n` +
    `  traceId: ${sourceInfo?.traceId || 'N/A'}\n` +
    `  错误数量: ${errors.length}\n` +
    `  错误详情:\n${errors.map((e, i) => `    ${i + 1}. ${e}`).join('\n')}\n` +
    `  数据快照: ${dataPreview}\n` +
    `  契约描述: ${contract.description || '(无)'}`
  )

  throw new Error(
    `[ContractValidator] 契约违反: ${contractName}\n` +
    `  测试: ${testName}\n` +
    `  来源: ${sourceInfo?.module || 'unknown'}::${sourceInfo?.method || 'unknown'}\n` +
    `  错误:\n${errors.map((e, i) => `    ${i + 1}. ${e}`).join('\n')}`
  )
}

/**
 * 安全验证（不抛出异常，返回结果）
 * @param contractName 契约名称
 * @param data 待验证数据
 * @returns 验证结果
 */
export function checkContract(
  contractName: string,
  data: unknown,
): { valid: boolean; errors?: string[] } {
  const contract = registry.get(contractName)
  if (!contract) {
    return { valid: false, errors: [`未注册的契约: "${contractName}"`] }
  }

  const result = contract.schema.safeParse(data)

  if (result.success) {
    return { valid: true }
  }

  return {
    valid: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    ),
  }
}

// ============================================================
// 违反记录管理
// ============================================================

/**
 * 获取所有契约违反记录
 */
export function getViolations(): ContractViolation[] {
  return [...violations]
}

/**
 * 清空所有违反记录
 */
export function clearViolations(): void {
  violations.length = 0
}

/**
 * 获取验证统计
 */
export function getStats(): {
  totalValidations: number
  passedValidations: number
  failedValidations: number
  registeredContracts: number
} {
  return {
    ...stats,
    registeredContracts: registry.size,
  }
}

/**
 * 重置验证统计
 */
export function resetStats(): void {
  stats.totalValidations = 0
  stats.passedValidations = 0
  stats.failedValidations = 0
}

// ============================================================
// 报告生成
// ============================================================

/**
 * 生成契约验证报告
 */
export function generateReport(): string {
  const report: string[] = []

  report.push('═══════════════════════════════════════════════════')
  report.push('  契约验证报告')
  report.push('═══════════════════════════════════════════════════')
  report.push('')

  // 统计
  report.push(`已注册契约: ${registry.size}`)
  report.push(`总验证次数: ${stats.totalValidations}`)
  report.push(`通过: ${stats.passedValidations}`)
  report.push(`失败: ${stats.failedValidations}`)
  report.push('')

  // 已注册契约列表
  report.push('─── 已注册契约 ───')
  for (const [name, contract] of registry) {
    report.push(`  ✅ ${name}${contract.description ? ` — ${contract.description}` : ''}`)
  }
  report.push('')

  // 违反记录
  if (violations.length > 0) {
    report.push('─── 违反记录 ───')
    violations.forEach((v, i) => {
      report.push(`  ${i + 1}. [${v.contract}] in "${v.test}"`)
      v.errors.forEach((e) => {
        report.push(`     - ${e}`)
      })
    })
  } else {
    report.push('─── 无违反记录 ✅ ───')
  }

  report.push('')
  report.push('═══════════════════════════════════════════════════')

  return report.join('\n')
}
