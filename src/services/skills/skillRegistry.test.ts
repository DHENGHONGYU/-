/**
 * @test_id V9-TEST-ST-114
 * @module services/skills/skillRegistry.test
 * @description SkillRegistry 单元测试
  * @covers_docs []
*/

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { SkillRegistry } from './skillRegistry'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'

describe('SkillRegistry', () => {
  const echoSkill: SkillDefinition<{ value: number; doubled: number }> = {
    name: 'echo',
    title: 'Echo',
    description: ' doubles input value',
    inputSchema: z.object({ symbol: z.string(), params: z.record(z.string(), z.unknown()).optional() }),
    outputSchema: z.object({ value: z.number(), doubled: z.number() }),
    executor: async (ctx: SkillContext) => {
      const value = (ctx.params?.value as number) ?? 0
      return {
        skillId: 'echo',
        status: 'success',
        data: { value, doubled: value * 2 },
        evidence: ['rule-calc'],
        meta: { startedAt: Date.now(), durationMs: 0 },
      }
    },
    requiresLlm: false,
    version: '1.0.0',
  }

  const failingSkill: SkillDefinition<{ ok: boolean }> = {
    name: 'failing',
    title: 'Failing',
    description: 'always throws',
    inputSchema: z.object({ symbol: z.string() }),
    outputSchema: z.object({ ok: z.boolean() }),
    executor: async () => {
      throw new Error('boom')
    },
    requiresLlm: false,
    version: '1.0.0',
  }

  it('应成功注册并列出 SKILL', () => {
    const registry = new SkillRegistry()
    registry.register(echoSkill)
    expect(registry.list()).toContain('echo')
    expect(registry.get('echo')).toBeDefined()
  })

  it('应执行 SKILL 并校验输出 Schema', async () => {
    const registry = new SkillRegistry()
    registry.register(echoSkill)

    const result = await registry.execute('echo', { symbol: '000001.SZ', params: { value: 21 } })

    expect(result.status).toBe('success')
    expect(result.data).toEqual({ value: 21, doubled: 42 })
    expect(result.evidence).toContain('rule-calc')
  })

  it('输入 Schema 校验失败时应返回 failed', async () => {
    const registry = new SkillRegistry()
    registry.register(echoSkill)

    const result = await registry.execute('echo', { symbol: 123 as unknown as string })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('输入 Schema 校验失败')
  })

  it('输出 Schema 校验失败时应返回 failed', async () => {
    const registry = new SkillRegistry()
    registry.register({
      ...echoSkill,
      executor: async () => ({
        skillId: 'echo',
        status: 'success',
        data: { value: 'not-a-number', doubled: 42 },
        evidence: [],
        meta: { startedAt: Date.now(), durationMs: 0 },
      } as unknown as SkillResult<{ value: number; doubled: number }>),
    })

    const result = await registry.execute('echo', { symbol: '000001.SZ', params: { value: 21 } })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('输出 Schema 校验失败')
  })

  it('执行器异常时应返回 failed 并不抛错', async () => {
    const registry = new SkillRegistry()
    registry.register(failingSkill)

    const result = await registry.execute('failing', { symbol: '000001.SZ' })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('boom')
  })

  it('未注册的 SKILL 应返回 failed', async () => {
    const registry = new SkillRegistry()
    const result = await registry.execute('not-exist', { symbol: '000001.SZ' })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('未注册')
  })

  it('原始返回值不是 SkillResult 时应自动封装', async () => {
    const rawSkill: SkillDefinition<{ sum: number }> = {
      name: 'raw',
      title: 'Raw',
      description: 'returns raw object',
      inputSchema: z.object({ symbol: z.string() }),
      outputSchema: z.object({ sum: z.number() }),
      executor: async (ctx: SkillContext) => ({ sum: (ctx.params?.a as number) + (ctx.params?.b as number) }) as unknown as SkillResult<{ sum: number }>,
      requiresLlm: false,
      version: '1.0.0',
    }

    const registry = new SkillRegistry()
    registry.register(rawSkill)

    const result = await registry.execute('raw', { symbol: '000001.SZ', params: { a: 1, b: 2 } })

    expect(result.status).toBe('success')
    expect(result.data).toEqual({ sum: 3 })
  })
})
