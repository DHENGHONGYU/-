import { describe, it, expect } from 'vitest'
import {
  getScoreLevel,
  getScoreColorClass,
  getScoreColor5,
  getActionLabel,
  HOT_SECTOR_ACTION_MAP,
  VALUE_PIT_ACTION_MAP,
} from './score'
import { SCORE_LEVELS } from '@/constants/cockpit.constants'

describe('utils/score', () => {
  // ══════════════════════════════════════════════════════════════
  // 1. getScoreLevel
  // ══════════════════════════════════════════════════════════════
  describe('getScoreLevel()', () => {
    it('score=100 → EXCELLENT', () => {
      expect(getScoreLevel(100)).toBe(SCORE_LEVELS.EXCELLENT)
    })

    it('score=80 → EXCELLENT（边界值）', () => {
      expect(getScoreLevel(80)).toBe(SCORE_LEVELS.EXCELLENT)
    })

    it('score=79 → GOOD', () => {
      expect(getScoreLevel(79)).toBe(SCORE_LEVELS.GOOD)
    })

    it('score=60 → GOOD（边界值）', () => {
      expect(getScoreLevel(60)).toBe(SCORE_LEVELS.GOOD)
    })

    it('score=59 → AVERAGE', () => {
      expect(getScoreLevel(59)).toBe(SCORE_LEVELS.AVERAGE)
    })

    it('score=40 → AVERAGE（边界值）', () => {
      expect(getScoreLevel(40)).toBe(SCORE_LEVELS.AVERAGE)
    })

    it('score=39 → POOR', () => {
      expect(getScoreLevel(39)).toBe(SCORE_LEVELS.POOR)
    })

    it('score=20 → POOR（边界值）', () => {
      expect(getScoreLevel(20)).toBe(SCORE_LEVELS.POOR)
    })

    it('score=19 → BAD', () => {
      expect(getScoreLevel(19)).toBe(SCORE_LEVELS.BAD)
    })

    it('score=0 → BAD', () => {
      expect(getScoreLevel(0)).toBe(SCORE_LEVELS.BAD)
    })

    it('score=-1 → BAD', () => {
      expect(getScoreLevel(-1)).toBe(SCORE_LEVELS.BAD)
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 2. getScoreColorClass
  // ══════════════════════════════════════════════════════════════
  describe('getScoreColorClass()', () => {
    it('score=90 → bg-green-500（EXCELLENT）', () => {
      expect(getScoreColorClass(90)).toBe('bg-green-500')
    })

    it('score=70 → bg-blue-500（GOOD）', () => {
      expect(getScoreColorClass(70)).toBe('bg-blue-500')
    })

    it('score=50 → bg-amber-500（AVERAGE）', () => {
      expect(getScoreColorClass(50)).toBe('bg-amber-500')
    })

    it('score=30 → bg-orange-500（POOR）', () => {
      expect(getScoreColorClass(30)).toBe('bg-orange-500')
    })

    it('score=10 → bg-red-500（BAD）', () => {
      expect(getScoreColorClass(10)).toBe('bg-red-500')
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 3. getScoreColor5（5 分制：score / 20 映射）
  // ══════════════════════════════════════════════════════════════
  describe('getScoreColor5()', () => {
    it('5 分制 score=5 → EXCELLENT color（5 >= 80/20=4）', () => {
      expect(getScoreColor5(5)).toBe(SCORE_LEVELS.EXCELLENT.color)
    })

    it('5 分制 score=4 → EXCELLENT color（边界值 4=80/20）', () => {
      expect(getScoreColor5(4)).toBe(SCORE_LEVELS.EXCELLENT.color)
    })

    it('5 分制 score=3 → GOOD color（3 >= 60/20=3，边界值）', () => {
      expect(getScoreColor5(3)).toBe(SCORE_LEVELS.GOOD.color)
    })

    it('5 分制 score=2 → AVERAGE color（2 >= 40/20=2，边界值）', () => {
      expect(getScoreColor5(2)).toBe(SCORE_LEVELS.AVERAGE.color)
    })

    it('5 分制 score=1 → POOR color（1 >= 20/20=1，边界值）', () => {
      expect(getScoreColor5(1)).toBe(SCORE_LEVELS.POOR.color)
    })

    it('5 分制 score=0 → BAD color', () => {
      expect(getScoreColor5(0)).toBe(SCORE_LEVELS.BAD.color)
    })

    it('5 分制 score=2.5 → GOOD color（2.5 < 3 且 >= 2→AVERAGE，但 2.5 >= 3? 否; 2.5 >= 2→AVERAGE）', () => {
      // 2.5 >= 4? No; 2.5 >= 3? No; 2.5 >= 2? Yes → AVERAGE
      expect(getScoreColor5(2.5)).toBe(SCORE_LEVELS.AVERAGE.color)
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 4. getActionLabel
  // ══════════════════════════════════════════════════════════════
  describe('getActionLabel()', () => {
    it('匹配 action → 返回对应 label + variant', () => {
      const result = getActionLabel('immediate', HOT_SECTOR_ACTION_MAP)
      expect(result.label).toBe('立即跟进')
      expect(result.variant).toBe('default')
    })

    it('未匹配 action → 返回默认 fallback { label: "\u2014", variant: "outline" }', () => {
      const result = getActionLabel('unknown', HOT_SECTOR_ACTION_MAP)
      expect(result.label).toBe('\u2014')
      expect(result.variant).toBe('outline')
    })

    it('自定义 fallback', () => {
      const result = getActionLabel('unknown', HOT_SECTOR_ACTION_MAP, {
        label: '未知',
        variant: 'secondary',
      })
      expect(result.label).toBe('未知')
      expect(result.variant).toBe('secondary')
    })

    it('空 labelMap → 任何 action 都返回 fallback', () => {
      const result = getActionLabel('anything', {})
      expect(result.label).toBe('\u2014')
      expect(result.variant).toBe('outline')
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 5. 预定义映射常量
  // ══════════════════════════════════════════════════════════════
  describe('预定义 ActionLabelMap', () => {
    it('HOT_SECTOR_ACTION_MAP 包含 immediate/probe/ignore', () => {
      expect(HOT_SECTOR_ACTION_MAP.immediate).toBeDefined()
      expect(HOT_SECTOR_ACTION_MAP.probe).toBeDefined()
      expect(HOT_SECTOR_ACTION_MAP.ignore).toBeDefined()
    })

    it('VALUE_PIT_ACTION_MAP 包含 immediate/probe/wait/ignore', () => {
      expect(VALUE_PIT_ACTION_MAP.immediate).toBeDefined()
      expect(VALUE_PIT_ACTION_MAP.probe).toBeDefined()
      expect(VALUE_PIT_ACTION_MAP.wait).toBeDefined()
      expect(VALUE_PIT_ACTION_MAP.ignore).toBeDefined()
    })

    it('VALUE_PIT_ACTION_MAP.ignore variant 为 destructive', () => {
      expect(VALUE_PIT_ACTION_MAP.ignore!.variant).toBe('destructive')
    })
  })
})