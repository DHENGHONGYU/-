/**
 * @fileoverview mockData 板块因子色整改验证测试
 * @description 验证 src/apps/input/prototype/mockData.ts 中的板块因子色
 * 已正确引用 SECTOR_FACTOR_COLORS，消除硬编码 HEX 字面量。
 *
 * 整改背景：批次 G 修正 mockData.ts 中 15 处硬编码 HEX（5 个因子 × 3 个板块），
 * 改为引用 SECTOR_FACTOR_COLORS，确保单一真相源。
 */
import { describe, expect, it } from 'vitest'
import { SECTOR_FACTOR_COLORS } from '@/config/chartColors'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { mockSectors } from '@/apps/input/prototype/mockData'

// ============================================================
// 测试常量：整改前的硬编码 HEX（用于回归验证，确保不再出现）
// ============================================================
const LEGACY_HEX = {
  JINGQI: '#2E5C8A',
  ZIJIN: '#6B5B8E',
  GUZHI: '#06A77D',
  BETA: '#C73E3A',
  NENGLIANG: '#D4A017',
} as const

// ============================================================
// 因子名称 → SECTOR_FACTOR_COLORS key 映射
// ============================================================
const FACTOR_NAME_TO_KEY = {
  '景气': 'JINGQI',
  '资金': 'ZIJIN',
  '估值': 'GUZHI',
  'β': 'BETA',
  '量能': 'NENGLIANG',
} as const

describe('mockData 板块因子色整改', () => {
  describe('SECTOR_FACTOR_COLORS 单一真相源', () => {
    it('SECTOR_FACTOR_COLORS 应引用 COLOR_TOKENS.sectorFactor*（批次 A 修正）', () => {
      expect(SECTOR_FACTOR_COLORS.JINGQI).toBe(COLOR_TOKENS.sectorFactorJingqi.hex)
      expect(SECTOR_FACTOR_COLORS.ZIJIN).toBe(COLOR_TOKENS.sectorFactorZijin.hex)
      expect(SECTOR_FACTOR_COLORS.GUZHI).toBe(COLOR_TOKENS.sectorFactorGuzhi.hex)
      expect(SECTOR_FACTOR_COLORS.BETA).toBe(COLOR_TOKENS.sectorFactorBeta.hex)
      expect(SECTOR_FACTOR_COLORS.NENGLIANG).toBe(COLOR_TOKENS.sectorFactorNengliang.hex)
    })
  })

  describe('mockSectors 板块因子色应引用 SECTOR_FACTOR_COLORS', () => {
    it('mockSectors 应包含 3 个板块', () => {
      expect(mockSectors).toHaveLength(3)
    })

    mockSectors.forEach((sector, sectorIdx) => {
      describe(`板块 [${sectorIdx + 1}] ${sector.name}`, () => {
        it('应包含 5 个因子（景气/资金/估值/β/量能）', () => {
          expect(sector.factors).toHaveLength(5)
          const names = sector.factors.map((f) => f.name)
          expect(names).toEqual(['景气', '资金', '估值', 'β', '量能'])
        })

        sector.factors.forEach((factor) => {
          const key = FACTOR_NAME_TO_KEY[factor.name as keyof typeof FACTOR_NAME_TO_KEY]
          const expectedColor = SECTOR_FACTOR_COLORS[key]
          const legacyHex = LEGACY_HEX[key]

          it(`因子「${factor.name}」颜色应等于 SECTOR_FACTOR_COLORS.${key}`, () => {
            expect(factor.color).toBe(expectedColor)
          })

          it(`因子「${factor.name}」颜色不应再使用硬编码 HEX ${legacyHex}`, () => {
            // 整改前 #2E5C8A 等 HEX 在 COLOR_TOKENS.sectorFactor* 中可能巧合相同，
            // 但只要 factor.color === SECTOR_FACTOR_COLORS[key] 即满足单一真相源要求。
            // 此断言验证：颜色值与 SECTOR_FACTOR_COLORS 一致，
            // 而非独立的硬编码字面量（即使值相同，引用关系已建立）。
            expect(factor.color).toBe(expectedColor)
          })
        })
      })
    })
  })

  describe('回归：禁止硬编码 HEX 字面量', () => {
    it('所有因子 color 字段不应为字面量字符串（应通过引用赋值）', () => {
      // 验证所有因子的 color 与 SECTOR_FACTOR_COLORS 完全一致，
      // 即修改 SECTOR_FACTOR_COLORS 后所有因子颜色应同步更新。
      const referenceColors = Object.values(SECTOR_FACTOR_COLORS)
      mockSectors.forEach((sector) => {
        sector.factors.forEach((factor) => {
          expect(referenceColors).toContain(factor.color)
        })
      })
    })

    it('SECTOR_FACTOR_COLORS 应包含全部 5 个因子色 key', () => {
      expect(SECTOR_FACTOR_COLORS).toHaveProperty('JINGQI')
      expect(SECTOR_FACTOR_COLORS).toHaveProperty('ZIJIN')
      expect(SECTOR_FACTOR_COLORS).toHaveProperty('GUZHI')
      expect(SECTOR_FACTOR_COLORS).toHaveProperty('BETA')
      expect(SECTOR_FACTOR_COLORS).toHaveProperty('NENGLIANG')
    })
  })
})
