import { describe, expect, it } from 'vitest'
import {
  DB_NAME,
  DB_VERSION,
  ACL_MATRIX,
  STORE_NAME,
  DB_OPERATION,
  MODULE_ID,
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  DATA_SOURCE,
  ORDER_DIRECTION,
  ORDER_STATUS,
  ACCOUNT_TYPE,
} from './dbConfig'
import { RESEARCH_STATUS } from '@/constants/stockpool.constants'

// ------------------------------------------------------------------
// 测试套件
// ------------------------------------------------------------------

describe('dbConfig', () => {
  // ================================================================
  // 1. DB_NAME 和 DB_VERSION 基础验证
  // ================================================================
  it('DB_NAME 为非空字符串，DB_VERSION 为正整数', () => {
    expect(typeof DB_NAME).toBe('string')
    expect(DB_NAME.length).toBeGreaterThan(0)
    expect(typeof DB_VERSION).toBe('number')
    expect(DB_VERSION).toBeGreaterThanOrEqual(1)
  })

  // ================================================================
  // 2. ACL_MATRIX 权限覆盖所有 MODULE_ID
  // ================================================================
  it('ACL_MATRIX 包含所有 MODULE_ID 模块的权限配置', () => {
    const moduleIds = Object.keys(MODULE_ID) as Array<keyof typeof MODULE_ID>
    const aclKeys = Object.keys(ACL_MATRIX) as Array<keyof typeof ACL_MATRIX>

    for (const moduleId of moduleIds) {
      expect(aclKeys).toContain(moduleId)
      const acl = ACL_MATRIX[moduleId]
      // 每个权限配置应有 read、write、actions 字段
      expect(acl).toHaveProperty('read')
      expect(acl).toHaveProperty('write')
      expect(acl).toHaveProperty('actions')
      expect(Array.isArray(acl.read)).toBe(true)
      expect(Array.isArray(acl.write)).toBe(true)
      expect(Array.isArray(acl.actions)).toBe(true)
    }
  })

  // ================================================================
  // 3. ACL_MATRIX 权限值合法性：read/write 只能包含有效的 STORE_NAME
  // ================================================================
  it('ACL_MATRIX 的 read/write 权限引用的 store 名均存在于 STORE_NAME', () => {
    const validStoreNames = new Set(Object.values(STORE_NAME))
    const moduleIds = Object.keys(MODULE_ID) as Array<keyof typeof MODULE_ID>

    for (const moduleId of moduleIds) {
      const acl = ACL_MATRIX[moduleId]
      for (const store of acl.read) {
        expect(validStoreNames.has(store as typeof STORE_NAME[keyof typeof STORE_NAME])).toBe(true)
      }
      for (const store of acl.write) {
        expect(validStoreNames.has(store as typeof STORE_NAME[keyof typeof STORE_NAME])).toBe(true)
      }
    }
  })

  // ================================================================
  // 4. ACL_MATRIX 权限值合法性：actions 只能包含有效的 DB_OPERATION
  // ================================================================
  it('ACL_MATRIX 的 actions 只包含合法的 DB_OPERATION', () => {
    const validOps = new Set(Object.values(DB_OPERATION))
    const moduleIds = Object.keys(MODULE_ID) as Array<keyof typeof ACL_MATRIX>

    for (const moduleId of moduleIds) {
      const acl = ACL_MATRIX[moduleId]
      for (const op of acl.actions) {
        expect(validOps.has(op as typeof DB_OPERATION[keyof typeof DB_OPERATION])).toBe(true)
      }
    }
  })

  // ================================================================
  // 5. 枚举类型完整性：各枚举值覆盖一致
  // ================================================================
  it('枚举常量类型与导出类型对应，无遗漏', () => {
    // RESEARCH_STATUS
    expect(Object.keys(RESEARCH_STATUS)).toHaveLength(5)

    // DATA_SOURCE
    expect(Object.keys(DATA_SOURCE)).toHaveLength(3)

    // ORDER_DIRECTION
    expect(Object.keys(ORDER_DIRECTION)).toHaveLength(2)

    // ORDER_STATUS
    expect(Object.keys(ORDER_STATUS)).toHaveLength(3)

    // ACCOUNT_TYPE
    expect(Object.keys(ACCOUNT_TYPE)).toHaveLength(2)

    // ENVELOPE_ACTION 包含关键策略 action
    expect(ENVELOPE_ACTION).toHaveProperty('strategyHotSectorRefresh')
    expect(ENVELOPE_ACTION).toHaveProperty('strategyValuePitRefresh')
    expect(ENVELOPE_ACTION).toHaveProperty('strategyRotationSignalDetect')

    // ENVELOPE_TARGET 包含策略 target
    expect(ENVELOPE_TARGET).toHaveProperty('strategy:hotSector')
    expect(ENVELOPE_TARGET).toHaveProperty('strategy:valuePit')
    expect(ENVELOPE_TARGET).toHaveProperty('strategy:rotationSignal')
  })
})
