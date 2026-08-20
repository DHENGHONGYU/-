/**
 * lib/utils/score — 单元测试
 *
 * 只增不删策略（TD-022 覆盖率增量 Round 2）：新增独立测试文件，不编辑/不删除已有测试。
 *
 * 覆盖率目标：
 *   - getScoreLevel()：5 段分支（EXCELLENT/GOOD/AVERAGE/POOR/BAD），每段边界 min-1/min/min+1 三组
 *   - getScoreColorClass()：5 段 bgClass 映射 + 每个边界各 1 次
 *   - getScoreColor5()：5 段 color hex，阈值 = 原 SCORE_LEVELS.*.min / 20
 *   - getActionLabel()：3 分支（命中 labelMap / 缺省 fallback / 自定义 fallback）
 *   - HOT_SECTOR_ACTION_MAP / VALUE_PIT_ACTION_MAP：逐键验证 label + variant 结构
 *
 * 阈值参考 SCORE_LEVELS（cockpit.constants.ts L117-L123）：
 *   EXCELLENT min=80, GOOD min=60, AVERAGE min=40, POOR min=20, BAD min=0
 */
import { describe, it, expect } from 'vitest'
import {
  getScoreLevel,
  getScoreColorClass,
  getScoreColor5,
  getActionLabel,
  HOT_SECTOR_ACTION_MAP,
  VALUE_PIT_ACTION_MAP,
  ActionLabelResult,
  BadgeVariant,
} from './score'
import { SCORE_LEVELS } from '@/constants/cockpit.constants'

describe('lib/utils/score', () => {
  describe('getScoreLevel(score: number)', () => {
    it('score=100 → EXCELLENT（满分边界）', () => {
      expect(getScoreLevel(100)).toBe(SCORE_LEVELS.EXCELLENT)
    })
    it('score=80 → EXCELLENT（min 边界）', () => {
      expect(getScoreLevel(80)).toBe(SCORE_LEVELS.EXCELLENT)
    })
    it('score=79 → GOOD（EXCELLENT 下边界 -1）', () => {
      expect(getScoreLevel(79)).toBe(SCORE_LEVELS.GOOD)
    })
    it('score=60 → GOOD（min 边界）', () => {
      expect(getScoreLevel(60)).toBe(SCORE_LEVELS.GOOD)
    })
    it('score=59 → AVERAGE（GOOD 下边界 -1）', () => {
      expect(getScoreLevel(59)).toBe(SCORE_LEVELS.AVERAGE)
    })
    it('score=40 → AVERAGE（min 边界）', () => {
      expect(getScoreLevel(40)).toBe(SCORE_LEVELS.AVERAGE)
    })
    it('score=39 → POOR（AVERAGE 下边界 -1）', () => {
      expect(getScoreLevel(39)).toBe(SCORE_LEVELS.POOR)
    })
    it('score=20 → POOR（min 边界）', () => {
      expect(getScoreLevel(20)).toBe(SCORE_LEVELS.POOR)
    })
    it('score=19 → BAD（POOR 下边界 -1）', () => {
      expect(getScoreLevel(19)).toBe(SCORE_LEVELS.BAD)
    })
    it('score=0 → BAD（最低分，min 边界）', () => {
      expect(getScoreLevel(0)).toBe(SCORE_LEVELS.BAD)
    })
    it('score < 0 （负数）→ 落入 BAD 兜底分支', () => {
      // 兜底 return SCORE_LEVELS.BAD 这一行的分支
      expect(getScoreLevel(-5)).toBe(SCORE_LEVELS.BAD)
    })
    it('score > 100 （溢出分）→ 仍按 EXCELLENT min=80 判定', () => {
      expect(getScoreLevel(1000)).toBe(SCORE_LEVELS.EXCELLENT)
    })
    it('中间值抽样：85→优秀, 70→良好, 50→一般, 30→较弱, 10→差', () => {
      expect(getScoreLevel(85).label).toBe('优秀')
      expect(getScoreLevel(70).label).toBe('良好')
      expect(getScoreLevel(50).label).toBe('一般')
      expect(getScoreLevel(30).label).toBe('较弱')
      expect(getScoreLevel(10).label).toBe('差')
    })
  })

  describe('getScoreColorClass(score: number)', () => {
    it('EXCELLENT 档 → bg-green-500', () => {
      expect(getScoreColorClass(80)).toBe('bg-green-500')
    })
    it('GOOD 档 → bg-blue-500', () => {
      expect(getScoreColorClass(79)).toBe('bg-blue-500')
      expect(getScoreColorClass(60)).toBe('bg-blue-500')
    })
    it('AVERAGE 档 → bg-amber-500', () => {
      expect(getScoreColorClass(59)).toBe('bg-amber-500')
      expect(getScoreColorClass(40)).toBe('bg-amber-500')
    })
    it('POOR 档 → bg-orange-500（原 scoringStrategy 缺失的 20-40 橙档补全）', () => {
      expect(getScoreColorClass(39)).toBe('bg-orange-500')
      expect(getScoreColorClass(20)).toBe('bg-orange-500')
    })
    it('BAD 档 → bg-red-500', () => {
      expect(getScoreColorClass(19)).toBe('bg-red-500')
      expect(getScoreColorClass(0)).toBe('bg-red-500')
    })
  })

  describe('getScoreColor5(score: number) — 5 分制（阈值 = 原 min / 20）', () => {
    // 5分制阈值：EXCELLENT≥4, GOOD≥3, AVERAGE≥2, POOR≥1, BAD<1
    it('score=5 → EXCELLENT color #22c55e', () => {
      expect(getScoreColor5(5)).toBe('#22c55e')
    })
    it('score=4 → EXCELLENT（min 边界 80/20=4）', () => {
      expect(getScoreColor5(4)).toBe('#22c55e')
    })
    it('score=3.99 → GOOD color #3b82f6（GOOD min=3，60/20=3）', () => {
      // 严格比较：3.99 < 4 → 不命中 EXCELLENT，命中 GOOD
      expect(getScoreColor5(3.99)).toBe('#3b82f6')
    })
    it('score=3 → GOOD（min 边界）', () => {
      expect(getScoreColor5(3)).toBe('#3b82f6')
    })
    it('score=2.99 → AVERAGE color #f59e0b', () => {
      expect(getScoreColor5(2.99)).toBe('#f59e0b')
    })
    it('score=2 → AVERAGE（min 边界 40/20=2）', () => {
      expect(getScoreColor5(2)).toBe('#f59e0b')
    })
    it('score=1.99 → POOR color #f97316', () => {
      expect(getScoreColor5(1.99)).toBe('#f97316')
    })
    it('score=1 → POOR（min 边界 20/20=1）', () => {
      expect(getScoreColor5(1)).toBe('#f97316')
    })
    it('score=0.99 → BAD color #ef4444', () => {
      expect(getScoreColor5(0.99)).toBe('#ef4444')
    })
    it('score=0 → BAD（min 边界）', () => {
      expect(getScoreColor5(0)).toBe('#ef4444')
    })
    it('score < 0 → BAD 兜底', () => {
      expect(getScoreColor5(-1)).toBe('#ef4444')
    })
    it('score 超大分（>5）→ EXCELLENT 首分支命中', () => {
      expect(getScoreColor5(99)).toBe('#22c55e')
    })
  })

  describe('getActionLabel(action, labelMap, fallback?)', () => {
    it('命中 labelMap 的键 → 返回对应 { label, variant }', () => {
      const r = getActionLabel('immediate', HOT_SECTOR_ACTION_MAP)
      expect(r).toEqual({ label: '立即跟进', variant: 'default' })
    })
    it('未命中键 → 返回默认 fallback = { label:"—", variant:"outline" }', () => {
      const r = getActionLabel('unknown-action', HOT_SECTOR_ACTION_MAP)
      expect(r).toEqual({ label: '—', variant: 'outline' })
    })
    it('传入自定义 fallback → 未命中时返回自定义值', () => {
      const custom: ActionLabelResult = { label: '待观察', variant: 'secondary' as BadgeVariant }
      const r = getActionLabel('not-in-map', HOT_SECTOR_ACTION_MAP, custom)
      expect(r).toEqual(custom)
    })
    it('labelMap 为 undefined 的键 → 等价于未命中（?? 运算符分支）', () => {
      // 取一个存在于一个 map 但不存在于另一个的键
      const r = getActionLabel('wait', HOT_SECTOR_ACTION_MAP) // HOT 没有 wait，VALUE_PIT 有
      expect(r).toEqual({ label: '—', variant: 'outline' })
    })
  })

  describe('HOT_SECTOR_ACTION_MAP（热门板块预定义标签）', () => {
    it('HOT_SECTOR_ACTION_MAP 共 3 键，结构完整', () => {
      expect(Object.keys(HOT_SECTOR_ACTION_MAP)).toEqual(['immediate', 'probe', 'ignore'])
      expect(HOT_SECTOR_ACTION_MAP.immediate).toEqual({ label: '立即跟进', variant: 'default' })
      expect(HOT_SECTOR_ACTION_MAP.probe).toEqual({ label: '试探', variant: 'secondary' })
      expect(HOT_SECTOR_ACTION_MAP.ignore).toEqual({ label: '不追', variant: 'outline' })
    })
  })

  describe('VALUE_PIT_ACTION_MAP（价值洼地预定义标签）', () => {
    it('VALUE_PIT_ACTION_MAP 共 4 键，结构完整（含 destructive ignore）', () => {
      expect(Object.keys(VALUE_PIT_ACTION_MAP)).toEqual(['immediate', 'probe', 'wait', 'ignore'])
      expect(VALUE_PIT_ACTION_MAP.immediate).toEqual({ label: '立即建仓', variant: 'default' })
      expect(VALUE_PIT_ACTION_MAP.probe).toEqual({ label: '试探', variant: 'secondary' })
      expect(VALUE_PIT_ACTION_MAP.wait).toEqual({ label: '等轮动', variant: 'outline' })
      expect(VALUE_PIT_ACTION_MAP.ignore).toEqual({ label: '不建', variant: 'destructive' })
    })
  })
})
