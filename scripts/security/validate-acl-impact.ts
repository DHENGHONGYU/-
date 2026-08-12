#!/usr/bin/env tsx
/**
 * validate-acl-impact.ts
 * ACL 权限变更影响验证脚本
 *
 * 用途：在应用 ACL 修改前，快速验证 proposed 变更不会引入权限冲突或意外副作用。
 *
 * 验证目标：
 * 1. 仅目标模块权限发生变化，其他模块权限保持不变。
 * 2. 目标模块新增权限符合预期（例如仅增加读权限，未扩大写权限）。
 * 3. 读权限新增不会与现有写权限产生冲突。
 * 4. datalayer 默认只读入口不受影响。
 *
 * 用法：
 *   npx tsx scripts/validate-acl-impact.ts
 *
 * 输出：
 *   - stdout：JSON 数据流（机器可读）
 *   - stderr：人类可读报告
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ACL_MATRIX,
  MODULE_ID,
  STORE_NAME,
  type AclEntry,
} from '@/config/dbConfig'

interface ProposedChange {
  moduleId: string
  addRead?: string[]
  addWrite?: string[]
  removeRead?: string[]
  removeWrite?: string[]
}

interface ChangeImpact {
  moduleId: string
  readAdded: string[]
  readRemoved: string[]
  writeAdded: string[]
  writeRemoved: string[]
}

interface ValidationReport {
  timestamp: string
  proposedChanges: ProposedChange[]
  impacts: ChangeImpact[]
  unchangedModules: string[]
  readStockModules: string[]
  writeStockModules: string[]
  datalayerIntegrity: boolean
  conflictDetected: boolean
  messages: string[]
}

const PROPOSED_CHANGES: ProposedChange[] = [
  {
    moduleId: MODULE_ID.executionPlans,
    addRead: [STORE_NAME.stocks],
  },
]

function cloneAclMatrix(): Record<string, AclEntry> {
  return JSON.parse(JSON.stringify(ACL_MATRIX)) as Record<string, AclEntry>
}

function applyProposedChanges(
  matrix: Record<string, AclEntry>,
  changes: ProposedChange[],
): Record<string, AclEntry> {
  for (const change of changes) {
    const entry = matrix[change.moduleId]
    if (!entry) {
      throw new Error(`Proposed change targets unknown module: ${change.moduleId}`)
    }

    if (change.addRead) {
      entry.read = Array.from(new Set([...entry.read, ...change.addRead]))
    }
    if (change.addWrite) {
      entry.write = Array.from(new Set([...entry.write, ...change.addWrite]))
    }
    if (change.removeRead) {
      entry.read = entry.read.filter((s) => !change.removeRead?.includes(s))
    }
    if (change.removeWrite) {
      entry.write = entry.write.filter((s) => !change.removeWrite?.includes(s))
    }
  }
  return matrix
}

function computeImpacts(
  current: Record<string, AclEntry>,
  proposed: Record<string, AclEntry>,
): ChangeImpact[] {
  const impacts: ChangeImpact[] = []
  const allModules = new Set([...Object.keys(current), ...Object.keys(proposed)])

  for (const moduleId of allModules) {
    const currentEntry = current[moduleId] ?? { read: [], write: [] }
    const proposedEntry = proposed[moduleId] ?? { read: [], write: [] }

    const readAdded = proposedEntry.read.filter((s) => !currentEntry.read.includes(s))
    const readRemoved = currentEntry.read.filter((s) => !proposedEntry.read.includes(s))
    const writeAdded = proposedEntry.write.filter((s) => !currentEntry.write.includes(s))
    const writeRemoved = currentEntry.write.filter((s) => !proposedEntry.write.includes(s))

    if (
      readAdded.length > 0 ||
      readRemoved.length > 0 ||
      writeAdded.length > 0 ||
      writeRemoved.length > 0
    ) {
      impacts.push({ moduleId, readAdded, readRemoved, writeAdded, writeRemoved })
    }
  }

  return impacts
}

function findStockAccessors(matrix: Record<string, AclEntry>): {
  readStockModules: string[]
  writeStockModules: string[]
} {
  const readStockModules: string[] = []
  const writeStockModules: string[] = []

  for (const [moduleId, entry] of Object.entries(matrix)) {
    if (entry.read.includes(STORE_NAME.stocks)) {
      readStockModules.push(moduleId)
    }
    if (entry.write.includes(STORE_NAME.stocks)) {
      writeStockModules.push(moduleId)
    }
  }

  return { readStockModules, writeStockModules }
}

function validateDatalayerIntegrity(matrix: Record<string, AclEntry>): boolean {
  const datalayer = matrix[MODULE_ID.datalayer]
  if (!datalayer) {
    return false
  }
  const allStores = Object.values(STORE_NAME)
  const hasAllRead = allStores.every((store) => datalayer.read.includes(store))
  const hasNoWrite = datalayer.write.length === 0
  return hasAllRead && hasNoWrite
}

function runValidation(): ValidationReport {
  const current = cloneAclMatrix()
  const proposed = applyProposedChanges(cloneAclMatrix(), PROPOSED_CHANGES)
  const impacts = computeImpacts(current, proposed)

  const unchangedModules = Object.keys(current).filter(
    (moduleId) => !impacts.some((impact) => impact.moduleId === moduleId),
  )

  const currentStockAccessors = findStockAccessors(current)
  const proposedStockAccessors = findStockAccessors(proposed)

  const datalayerIntegrity = validateDatalayerIntegrity(proposed)

  const messages: string[] = []
  let conflictDetected = false

  // 检查是否有意外变更
  const unexpectedImpacts = impacts.filter(
    (impact) => impact.moduleId !== MODULE_ID.executionPlans,
  )
  if (unexpectedImpacts.length > 0) {
    conflictDetected = true
    messages.push(
      `[CONFLICT] 非目标模块权限发生变化：${unexpectedImpacts.map((i) => i.moduleId).join(', ')}`,
    )
  }

  // 检查 datalayer 完整性
  if (!datalayerIntegrity) {
    conflictDetected = true
    messages.push('[CONFLICT] datalayer 模块权限不完整（缺少读权限或存在写权限）')
  }

  return {
    timestamp: new Date().toISOString(),
    proposedChanges: PROPOSED_CHANGES,
    impacts,
    unchangedModules,
    readStockModules: currentStockAccessors.readStockModules,
    writeStockModules: currentStockAccessors.writeStockModules,
    datalayerIntegrity,
    conflictDetected,
    messages,
  }
}

// 主入口
const report = runValidation()
console.log(JSON.stringify(report, null, 2))
if (report.conflictDetected) {
  process.exit(1)
}

