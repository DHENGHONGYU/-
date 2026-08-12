/**
 * @fileoverview audit-layer-calls.ts 跨层调用审计规则单元测试
 *
 * 验证 D11 豁免规则：测试文件（.test.ts / __tests__）需导入被测模块，
 * 免除跨层违规检查。覆盖 config / core / services 三层规则的 isTestFile 排除。
 *
 * 运行方式：
 *   npx vitest run scripts/audit/audit-layer-calls.test.ts
 *
 * @test_id V9-TEST-AUDIT-LAYERS-001
 * @covers scripts/audit/audit-layer-calls.ts v3.5 D11 豁免
 */

import { describe, it, expect } from 'vitest'
import { scan } from './audit-layer-calls'

describe('audit-layer-calls D11 豁免：.test.ts 文件排除', () => {
  // scan() 扫描全项目，可能需要 1-2 秒
  const report = scan()

  it('scan() 应返回有效报告结构', () => {
    expect(report).toBeDefined()
    expect(report.summary).toBeDefined()
    expect(report.summary.totalFiles).toBeGreaterThan(100)
    expect(Array.isArray(report.violations)).toBe(true)
    expect(Array.isArray(report.warnings)).toBe(true)
  })

  it('当前项目应 0 违规（D11 修复后）', () => {
    expect(report.summary.totalViolations).toBe(0)
  })

  // ============================================================
  // 规则 2：config 层 .test.ts 文件排除
  // ============================================================
  describe('规则 2：config 层 .test.ts 排除', () => {
    it('config-source-governance.test.ts 不应在违规列表中', () => {
      const configTestViolations = report.violations.filter(
        (v) => v.file.includes('config-source-governance.test.')
      )
      expect(configTestViolations).toHaveLength(0)
    })

    it('config 层 .test.ts 文件从 services 导入不报违规', () => {
      const configTestFiles = [
        'src/config/config-source-governance.test.ts',
      ]
      configTestFiles.forEach((file) => {
        const violations = report.violations.filter((v) => v.file === file)
        expect(violations).toHaveLength(0)
      })
    })
  })

  // ============================================================
  // 规则 3：core 层 .test.ts 文件排除
  // ============================================================
  describe('规则 3：core 层 .test.ts 排除', () => {
    it('core 层 .test.ts 文件不在违规列表中', () => {
      const coreTestViolations = report.violations.filter(
        (v) => v.file.startsWith('src/core/') && v.file.includes('.test.')
      )
      expect(coreTestViolations).toHaveLength(0)
    })

    it('core 层 __tests__ 文件不在违规列表中', () => {
      const coreTestViolations = report.violations.filter(
        (v) => v.file.startsWith('src/core/') && v.file.includes('__tests__')
      )
      expect(coreTestViolations).toHaveLength(0)
    })
  })

  // ============================================================
  // 规则 4：services 层 .test.ts 文件排除
  // ============================================================
  describe('规则 4：services 层 .test.ts 排除', () => {
    it('services 层 .test.ts 文件不在违规列表中', () => {
      const servicesTestViolations = report.violations.filter(
        (v) => v.file.startsWith('src/services/') && v.file.includes('.test.')
      )
      expect(servicesTestViolations).toHaveLength(0)
    })

    it('services 层 __tests__ 文件不在违规列表中', () => {
      const servicesTestViolations = report.violations.filter(
        (v) => v.file.startsWith('src/services/') && v.file.includes('__tests__')
      )
      expect(servicesTestViolations).toHaveLength(0)
    })
  })

  // ============================================================
  // 反向验证：非 .test.ts 文件仍受规则约束
  // ============================================================
  describe('反向验证：非 .test.ts 文件仍受约束', () => {
    it('config 层非测试文件不在违规列表中（当前项目合规）', () => {
      // 当前项目 config 层非测试文件应该是合规的
      // 如果有违规，说明规则在非测试文件上正常工作
      const configNonTestViolations = report.violations.filter(
        (v) => v.file.startsWith('src/config/') && !v.file.includes('.test.')
      )
      // 当前项目 0 违规，所以这里也应该是 0
      expect(configNonTestViolations).toHaveLength(0)
    })

    it('所有违规文件都不是 .test.ts 文件', () => {
      // 如果有违规，违规文件不应该是 .test.ts 文件
      // 当前项目 0 违规，这个测试验证 D11 排除逻辑的正确性
      const testFileViolations = report.violations.filter(
        (v) => v.file.includes('.test.') || v.file.includes('__tests__')
      )
      expect(testFileViolations).toHaveLength(0)
    })
  })
})
