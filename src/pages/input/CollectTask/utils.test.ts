/**
 * @fileoverview CollectTask utils 单元测试
 *
 * 覆盖 CollectTaskPage 拆分后暴露的工具函数：
 * - normalizeStatus: 运行时状态 → 显示状态映射
 * - computeAvgIntervalHours: 评分历史平均间隔
 * - STATUS_BADGE: 状态徽章配置
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeStatus,
  computeAvgIntervalHours,
  STATUS_BADGE,
} from './utils'

describe('CollectTask/utils', () => {
  describe('normalizeStatus', () => {
    it('running → running', () => {
      expect(normalizeStatus('running')).toBe('running')
    })

    it('completed → success', () => {
      expect(normalizeStatus('completed')).toBe('success')
    })

    it('error → failed', () => {
      expect(normalizeStatus('error')).toBe('failed')
    })

    it('paused → failed', () => {
      expect(normalizeStatus('paused')).toBe('failed')
    })

    it('pending → pending', () => {
      expect(normalizeStatus('pending')).toBe('pending')
    })
  })

  describe('STATUS_BADGE', () => {
    it('应包含 4 种显示状态配置', () => {
      expect(STATUS_BADGE).toHaveProperty('running')
      expect(STATUS_BADGE).toHaveProperty('success')
      expect(STATUS_BADGE).toHaveProperty('failed')
      expect(STATUS_BADGE).toHaveProperty('pending')
    })

    it('每种状态应包含 label 和 variant 字段', () => {
      for (const key of Object.keys(STATUS_BADGE) as Array<keyof typeof STATUS_BADGE>) {
        const cfg = STATUS_BADGE[key]
        expect(cfg).toHaveProperty('label')
        expect(cfg).toHaveProperty('variant')
        expect(typeof cfg.label).toBe('string')
        expect(['default', 'success', 'destructive', 'outline']).toContain(cfg.variant)
      }
    })

    it('success 状态应使用 success variant', () => {
      expect(STATUS_BADGE.success.variant).toBe('success')
    })

    it('failed 状态应使用 destructive variant', () => {
      expect(STATUS_BADGE.failed.variant).toBe('destructive')
    })
  })

  describe('computeAvgIntervalHours', () => {
    it('空数组应返回 0', () => {
      expect(computeAvgIntervalHours([])).toBe(0)
    })

    it('单条记录应返回 0', () => {
      expect(computeAvgIntervalHours([{ scoredAt: Date.now() }])).toBe(0)
    })

    it('两条记录间隔 1 小时应返回 1', () => {
      const now = Date.now()
      const oneHourAgo = now - 3600 * 1000
      expect(computeAvgIntervalHours([
        { scoredAt: now },
        { scoredAt: oneHourAgo },
      ])).toBeCloseTo(1, 1)
    })

    it('三条记录间隔 1h/2h 应返回 1.5', () => {
      const t0 = Date.now()
      const t1 = t0 - 3600 * 1000
      const t2 = t1 - 7200 * 1000
      expect(computeAvgIntervalHours([
        { scoredAt: t0 },
        { scoredAt: t1 },
        { scoredAt: t2 },
      ])).toBeCloseTo(1.5, 1)
    })

    it('应支持字符串时间戳', () => {
      const now = new Date().toISOString()
      const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString()
      expect(computeAvgIntervalHours([
        { scoredAt: now },
        { scoredAt: oneHourAgo },
      ])).toBeCloseTo(1, 1)
    })

    it('无序记录应自动按时间排序', () => {
      const t0 = Date.now()
      const t1 = t0 - 3600 * 1000
      const t2 = t1 - 7200 * 1000
      // 故意打乱顺序
      expect(computeAvgIntervalHours([
        { scoredAt: t1 },
        { scoredAt: t0 },
        { scoredAt: t2 },
      ])).toBeCloseTo(1.5, 1)
    })
  })
})
