import { describe, it, expect, vi, beforeEach } from 'vitest'
import { refreshCoordinator } from './refreshCoordinator'

describe('refreshCoordinator', () => {
  beforeEach(() => {
    // 清除所有 pending 状态
    refreshCoordinator.clearPending('testStore1')
    refreshCoordinator.clearPending('testStore2')
    refreshCoordinator.clearPending('orderStore')
    refreshCoordinator.clearPending('positionStore')
  })

  describe('coordinateRefresh()', () => {
    it('首次调用执行 refreshFn', async () => {
      const refreshFn = vi.fn(async () => {})
      await refreshCoordinator.coordinateRefresh('testStore1', refreshFn)
      expect(refreshFn).toHaveBeenCalledTimes(1)
    })

    it('刷新完成后清除 pending', async () => {
      const refreshFn = vi.fn(async () => {})
      await refreshCoordinator.coordinateRefresh('testStore1', refreshFn)
      expect(refreshCoordinator.getPendingPromise('testStore1')).toBeNull()
    })

    it('并发调用时第二个调用 await 第一个', async () => {
      let resolveFirst: () => void
      const firstPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve
      })

      const firstFn = vi.fn(() => firstPromise)
      const secondFn = vi.fn(async () => {})

      const firstCall = refreshCoordinator.coordinateRefresh('orderStore', firstFn)
      // 立即发起第二个调用（此时第一个还没完成）
      const secondCall = refreshCoordinator.coordinateRefresh('orderStore', secondFn)

      // 第一个完成前，第二个不应开始执行
      expect(firstFn).toHaveBeenCalledTimes(1)
      expect(secondFn).not.toHaveBeenCalled()

      resolveFirst!()
      await firstCall
      await secondCall

      // 两个都完成后，第二个应该也执行了
      expect(secondFn).toHaveBeenCalledTimes(1)
    })

    it('刷新失败时也清除 pending 并重新抛出', async () => {
      const failingFn = vi.fn(async () => {
        throw new Error('refresh failed')
      })

      await expect(
        refreshCoordinator.coordinateRefresh('testStore1', failingFn)
      ).rejects.toThrow('refresh failed')

      expect(refreshCoordinator.getPendingPromise('testStore1')).toBeNull()
    })

    it('前一次失败后，下一次能正常执行', async () => {
      const failingFn = vi.fn(async () => { throw new Error('fail') })
      const successFn = vi.fn(async () => {})

      await expect(
        refreshCoordinator.coordinateRefresh('testStore2', failingFn)
      ).rejects.toThrow()

      await refreshCoordinator.coordinateRefresh('testStore2', successFn)
      expect(successFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('register() & done()', () => {
    it('register 后 waitFor 会等待', async () => {
      let resolveRefresh: () => void
      const promise = new Promise<void>((resolve) => {
        resolveRefresh = resolve
      })

      refreshCoordinator.register('orderStore', promise)

      let waitCompleted = false
      const waitPromise = refreshCoordinator.waitFor('orderStore').then(() => {
        waitCompleted = true
      })

      expect(waitCompleted).toBe(false)
      resolveRefresh!()
      await waitPromise
      expect(waitCompleted).toBe(true)
    })

    it('done() 手动清除注册', async () => {
      const promise = new Promise<void>(() => {}) // 永不 resolve
      refreshCoordinator.register('positionStore', promise)
      expect(refreshCoordinator.getPendingPromise('positionStore')).not.toBeNull()

      refreshCoordinator.done('positionStore')
      expect(refreshCoordinator.getPendingPromise('positionStore')).toBeNull()
    })
  })

  describe('waitFor()', () => {
    it('无 pending 时立即 resolve', async () => {
      await expect(refreshCoordinator.waitFor('nonexistent')).resolves.toBeUndefined()
    })

    it('目标刷新失败也不阻塞调用方', async () => {
      const failingPromise = Promise.reject(new Error('failed'))
      refreshCoordinator.register('orderStore', failingPromise)

      await expect(refreshCoordinator.waitFor('orderStore')).resolves.toBeUndefined()
    })
  })

  describe('waitForAll()', () => {
    it('等待多个 store 全部完成', async () => {
      let resolve1: () => void
      let resolve2: () => void
      const p1 = new Promise<void>((r) => { resolve1 = r })
      const p2 = new Promise<void>((r) => { resolve2 = r })

      refreshCoordinator.register('s1', p1)
      refreshCoordinator.register('s2', p2)

      let allDone = false
      const allPromise = refreshCoordinator.waitForAll(['s1', 's2']).then(() => {
        allDone = true
      })

      expect(allDone).toBe(false)
      resolve1!()
      // 还剩 s2
      await new Promise(r => setTimeout(r, 10))
      expect(allDone).toBe(false)
      resolve2!()
      await allPromise
      expect(allDone).toBe(true)

      refreshCoordinator.clearPending('s1')
      refreshCoordinator.clearPending('s2')
    })

    it('空数组立即 resolve', async () => {
      await expect(refreshCoordinator.waitForAll([])).resolves.toBeUndefined()
    })

    it('部分失败也全部 settle 后返回', async () => {
      const p1 = Promise.resolve()
      const p2 = Promise.reject(new Error('fail'))
      refreshCoordinator.register('okStore', p1)
      refreshCoordinator.register('failStore', p2)

      await expect(refreshCoordinator.waitForAll(['okStore', 'failStore'])).resolves.toBeUndefined()

      refreshCoordinator.clearPending('okStore')
      refreshCoordinator.clearPending('failStore')
    })
  })

  describe('getPendingPromise()', () => {
    it('返回当前 pending promise 或 null', () => {
      expect(refreshCoordinator.getPendingPromise('newStore')).toBeNull()
    })
  })

  describe('clearPending()', () => {
    it('清除指定 store 的 pending', () => {
      const promise = Promise.resolve()
      refreshCoordinator.register('toClear', promise)
      expect(refreshCoordinator.getPendingPromise('toClear')).not.toBeNull()
      refreshCoordinator.clearPending('toClear')
      expect(refreshCoordinator.getPendingPromise('toClear')).toBeNull()
    })

    it('清除不存在的 store 不报错', () => {
      expect(() => refreshCoordinator.clearPending('nonexistent')).not.toThrow()
    })
  })
})
