/**
 * D-04 审计字段与数据留存策略 — 单元测试
 * 覆盖 stampAuditFields（创建/更新/不可变）、applyRetention（冷热分层/过期）、queryAuditTrail（过滤）。
 */

import { describe, expect, it } from 'vitest'
import {
  applyRetention,
  DEFAULT_RETENTION_POLICY,
  queryAuditTrail,
  stampAuditFields,
  type AuditMeta,
} from '@/data/audit'

const NOW = 1_700_000_000_000
const DAY_MS = 24 * 60 * 60 * 1000

describe('stampAuditFields', () => {
  it('创建时填充 createdAt=updatedAt=now、version=1、operator', () => {
    const rec = { symbol: '600000' }
    const stamped = stampAuditFields(rec, { operator: 'engineStore', now: NOW })

    expect(stamped.symbol).toBe('600000')
    expect(stamped.audit).toEqual({
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      operator: 'engineStore',
    })
  })

  it('更新时保留 createdAt、version 自增、刷新 updatedAt', () => {
    const rec = { symbol: '600000', audit: { createdAt: NOW - 5000, updatedAt: NOW - 5000, version: 3, operator: 'a' } as AuditMeta }
    const stamped = stampAuditFields(rec, { operator: 'engineStore', now: NOW, previous: rec.audit })

    expect(stamped.audit.createdAt).toBe(NOW - 5000)
    expect(stamped.audit.updatedAt).toBe(NOW)
    expect(stamped.audit.version).toBe(4)
    expect(stamped.audit.operator).toBe('engineStore')
  })

  it('不可变：不修改入参原对象', () => {
    const rec = { symbol: '600000' } as Record<string, unknown>
    stampAuditFields(rec, { operator: 'x', now: NOW })
    expect(rec).not.toHaveProperty('audit')
  })

  it('无 previous 与有 previous 的 createdAt 行为不同', () => {
    const created = stampAuditFields({ a: 1 }, { operator: 'o', now: NOW })
    const updated = stampAuditFields({ a: 1 }, { operator: 'o', now: NOW, previous: { createdAt: 1, updatedAt: 2, version: 5, operator: 'p' } })
    expect(created.audit.createdAt).toBe(NOW)
    expect(updated.audit.createdAt).toBe(1)
  })
})

describe('applyRetention', () => {
  const make = (updatedAt: number, version = 1): { id: string; audit: AuditMeta } => ({
    id: String(updatedAt),
    audit: { createdAt: updatedAt, updatedAt, version, operator: 'o' },
  })

  it('按 updatedAt 做冷热分层（热 < 30d，冷 30~365d，过期 ≥ 365d）', () => {
    const records = [
      make(NOW - 10 * DAY_MS), // 热
      make(NOW - 100 * DAY_MS), // 冷
      make(NOW - 400 * DAY_MS), // 过期
    ]
    const { hot, cold, expired } = applyRetention(records, DEFAULT_RETENTION_POLICY, NOW)

    expect(hot).toHaveLength(1)
    expect(cold).toHaveLength(1)
    expect(expired).toHaveLength(1)
    expect(hot[0]?.id).toBe(String(NOW - 10 * DAY_MS))
  })

  it('enableColdTier=false 时冷层数据直接判为过期', () => {
    const records = [make(NOW - 100 * DAY_MS)]
    const { hot, cold, expired } = applyRetention(records, { ...DEFAULT_RETENTION_POLICY, enableColdTier: false }, NOW)

    expect(hot).toHaveLength(0)
    expect(cold).toHaveLength(0)
    expect(expired).toHaveLength(1)
  })

  it('缺审计字段的记录保守归入冷层', () => {
    const records = [{ id: 'x' } as { id: string; audit?: AuditMeta }]
    const { cold } = applyRetention(records, DEFAULT_RETENTION_POLICY, NOW)
    expect(cold).toHaveLength(1)
  })

  it('支持自定义留存窗口（5d 介于 hot=1d 与 cold=10d 之间 → 冷层）', () => {
    const records = [make(NOW - 5 * DAY_MS)]
    const { hot, cold, expired } = applyRetention(records, { hotTtlMs: DAY_MS, coldTtlMs: 10 * DAY_MS, enableColdTier: true }, NOW)
    expect(hot).toHaveLength(0)
    expect(cold).toHaveLength(1)
    expect(expired).toHaveLength(0)
  })
})

describe('queryAuditTrail', () => {
  const records = [
    { id: 'a', audit: { createdAt: 1, updatedAt: 100, version: 1, operator: 'alice' } as AuditMeta },
    { id: 'b', audit: { createdAt: 1, updatedAt: 200, version: 2, operator: 'bob' } as AuditMeta },
    { id: 'c', audit: { createdAt: 1, updatedAt: 300, version: 3, operator: 'alice' } as AuditMeta },
  ]

  it('按操作人过滤', () => {
    const res = queryAuditTrail(records, { operator: 'alice' })
    expect(res.map((r) => r.id).sort()).toEqual(['a', 'c'])
  })

  it('按时间范围 [from,to] 过滤', () => {
    const res = queryAuditTrail(records, { from: 150, to: 250 })
    expect(res.map((r) => r.id)).toEqual(['b'])
  })

  it('按最小版本过滤', () => {
    const res = queryAuditTrail(records, { minVersion: 2 })
    expect(res.map((r) => r.id).sort()).toEqual(['b', 'c'])
  })

  it('组合过滤：操作人 + 时间范围', () => {
    const res = queryAuditTrail(records, { operator: 'alice', from: 250 })
    expect(res.map((r) => r.id)).toEqual(['c'])
  })

  it('无审计字段的记录被排除', () => {
    const mixed = [...records, { id: 'noaudit' } as { id: string; audit?: AuditMeta }]
    const res = queryAuditTrail(mixed)
    expect(res).toHaveLength(3)
  })
})
