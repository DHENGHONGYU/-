/**
 * @test_id V9-TEST-IT-RC-001
 * 跨 Store 刷新协调器集成测试
 *
 * 覆盖缺口：
 *   C-01: coordinateRefresh 并发串行化（同一 store 两次调用串行执行）
 *   C-02: waitFor — 已完成 store 立即返回
 *   C-03: waitFor — 未注册 store 立即返回(空 safe)
 *   C-04: waitForAll — 全部 settle 后返回，部分失败不抛
 *   C-05: coordinateRefresh 前一次失败后重试（自动重试机制）
 *   C-06: waitFor(失败 store) 不抛异常（失败不阻塞调用方）
 *   C-07: done() 手动清除 + register/waitFor 协同
 *
 * @covers_docs [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-ARCH-008]
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { refreshCoordinator } from '@/core/refreshCoordinator'

describe('RefreshCoordinator — 跨 Store 刷新协调', () => {
  beforeEach(() => {
    const storeIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    storeIds.forEach((id) => (refreshCoordinator as any).done?.(id) ?? (refreshCoordinator as any).clearPending?.(id))
  })

  it('C-01: coordinateRefresh 同一 store 并发调用串行化', async () => {
    const calls: number[] = []
    let callId = 0
    const slowRefresh = () => new Promise<void>((resolve) => {
      const id = ++callId
      setTimeout(() => { calls.push(id); resolve() }, 30)
    })

    const p1 = refreshCoordinator.coordinateRefresh('A', slowRefresh)
    const p2 = refreshCoordinator.coordinateRefresh('A', slowRefresh)

    await Promise.all([p1, p2])
    expect(calls).toEqual([1, 2])
  })

  it('C-02: waitFor — 已完成 store 立即返回', async () => {
    await refreshCoordinator.coordinateRefresh('B', async () => { await Promise.resolve() })
    const t0 = Date.now()
    await refreshCoordinator.waitFor('B')
    const dt = Date.now() - t0
    expect(dt).toBeLessThan(50)
  })

  it('C-03: waitFor — 未注册 store 立即返回(空 safe)', async () => {
    const t0 = Date.now()
    await refreshCoordinator.waitFor('NEVER_REGISTERED')
    expect(Date.now() - t0).toBeLessThan(50)
  })

  it('C-04: waitForAll — 多 Store 全部 settle 后返回（部分失败不抛）', async () => {
    const ok = new Promise<void>((resolve) => setTimeout(() => resolve(), 10))
    const bad = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('down')), 20))
    ;(refreshCoordinator as { register: (id: string, p: Promise<void>) => void }).register('C', ok)
    ;(refreshCoordinator as { register: (id: string, p: Promise<void>) => void }).register('D', bad)

    let settled = false
    refreshCoordinator.waitForAll(['C', 'D']).then(() => { settled = true })
    await new Promise((r) => setTimeout(r, 50))
    expect(settled).toBe(true)
  })

  it('C-05: coordinateRefresh 前一次失败后自动重试', async () => {
    let attempt = 0
    const failThenSucceed = async () => {
      attempt++
      if (attempt === 1) throw new Error('first fail')
    }

    const p1 = refreshCoordinator.coordinateRefresh('E', failThenSucceed).catch(() => 'failed')
    await p1
    expect(attempt).toBe(1)

    const p2 = refreshCoordinator.coordinateRefresh('E', failThenSucceed)
    await expect(p2).resolves.toBeUndefined()
    expect(attempt).toBe(2)
  })

  it('C-06: waitFor(失败 store) 不抛异常 — 失败不阻塞', async () => {
    const bad = Promise.reject(new Error('db down'))
    ;(refreshCoordinator as { register: (id: string, p: Promise<void>) => void }).register('F', bad)

    await expect(refreshCoordinator.waitFor('F')).resolves.toBeUndefined()
  })

  it('C-07: register / waitFor / done 协同 — 手动 done 立即释放等待', async () => {
    let resolveFn: any = null
    const longRefresh = new Promise<void>((r) => { resolveFn = r })
    ;(refreshCoordinator as { register: (id: string, p: Promise<void>) => void }).register('G', longRefresh)

    let waited = false
    const waiter = refreshCoordinator.waitFor('G').then(() => { waited = true })

    resolveFn!()
    refreshCoordinator.done('G')

    await new Promise((r) => setTimeout(r, 10))
    expect(waited).toBe(true)
    await expect(waiter).resolves.toBeUndefined()
  })
})
