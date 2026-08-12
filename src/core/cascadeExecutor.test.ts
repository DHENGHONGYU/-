import { describe, it, expect } from 'vitest'
import { cascadeExecutor } from './cascadeExecutor'
import { STORE_NAME } from '@/config/dbConfig'

describe('cascadeExecutor', () => {
  describe('execute()', () => {
    it('返回包含 targets 数组的结果', async () => {
      const result = await cascadeExecutor.execute(STORE_NAME.stocks, 'test-123')
      expect(result).toBeDefined()
      expect(Array.isArray(result.targets)).toBe(true)
    })

    it('当前实现返回空 targets（NONE 策略）', async () => {
      const result = await cascadeExecutor.execute(STORE_NAME.orders, 'order-001')
      expect(result.targets).toHaveLength(0)
    })

    it('不同 store 都返回空 targets', async () => {
      const r1 = await cascadeExecutor.execute(STORE_NAME.stocks, 'id1')
      const r2 = await cascadeExecutor.execute(STORE_NAME.dailyQuotes, 'id2')
      const r3 = await cascadeExecutor.execute(STORE_NAME.v6Scores, 'id3')
      expect(r1.targets).toHaveLength(0)
      expect(r2.targets).toHaveLength(0)
      expect(r3.targets).toHaveLength(0)
    })

    it('不同 id 都返回空 targets', async () => {
      const r1 = await cascadeExecutor.execute(STORE_NAME.stocks, '600519.SH')
      const r2 = await cascadeExecutor.execute(STORE_NAME.stocks, '000001.SZ')
      expect(r1.targets).toHaveLength(0)
      expect(r2.targets).toHaveLength(0)
    })
  })
})
