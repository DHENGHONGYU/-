import { describe, expect, it, beforeEach } from 'vitest'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { db } from '@/data/db'
import { DEFAULT_POOL_GROUP, RESEARCH_STATUS } from '@/constants/stockpool.constants'
import { STORE_NAME } from '@/config/dbConfig'
import {
  getPoolGroups,
  getPoolTransitionOptions,
  getStocksByGroup,
  getStocksByStatus,
  transitionStock,
  updateStockGroup,
} from '@/services/stockpool/stockpoolService'

describe('stockpoolService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
  })

  it('应该transition candidate to screened', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    const result = await transitionStock('000001.SZ', RESEARCH_STATUS.screened)

    expect(result.success).toBe(true)

    const updated = await dataLayer.stocks.get('000001.SZ')
    expect(updated?.researchStatus).toBe(RESEARCH_STATUS.screened)
  })

  it('应该archive from any active pool', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: RESEARCH_STATUS.deepDive,
      source: 'manual',
    })

    const result = await transitionStock('000001.SZ', RESEARCH_STATUS.archived)

    expect(result.success).toBe(true)

    const updated = await dataLayer.stocks.get('000001.SZ')
    expect(updated?.researchStatus).toBe(RESEARCH_STATUS.archived)
  })

  it('应该reactivate archived to candidate', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: RESEARCH_STATUS.archived,
      source: 'manual',
    })

    const result = await transitionStock('000001.SZ', RESEARCH_STATUS.candidate)

    expect(result.success).toBe(true)

    const updated = await dataLayer.stocks.get('000001.SZ')
    expect(updated?.researchStatus).toBe(RESEARCH_STATUS.candidate)
  })

  it('应该reject invalid transition', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    const result = await transitionStock('000001.SZ', RESEARCH_STATUS.watching)

    expect(result.success).toBe(false)
    expect(result.error).toContain('非法流转')
  })

  it('应该reject transition for non-existent stock', async () => {
    const result = await transitionStock('NOT_EXIST', RESEARCH_STATUS.screened)
    expect(result.success).toBe(false)
    expect(result.error).toContain('股票不存在')
  })

  it('应该get stocks by status', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: RESEARCH_STATUS.watching,
      source: 'manual',
    })

    const result = await getStocksByStatus(RESEARCH_STATUS.watching)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })

  it('应该返回 transition options for each status', () => {
    expect(getPoolTransitionOptions(RESEARCH_STATUS.candidate)).toHaveLength(2)
    expect(getPoolTransitionOptions(RESEARCH_STATUS.screened)).toHaveLength(2)
    expect(getPoolTransitionOptions(RESEARCH_STATUS.deepDive)).toHaveLength(2)
    expect(getPoolTransitionOptions(RESEARCH_STATUS.watching)).toHaveLength(1)
    expect(getPoolTransitionOptions(RESEARCH_STATUS.archived)).toHaveLength(1)
  })

  it('应该更新 stock group', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    const result = await updateStockGroup('000001.SZ', '核心持仓')

    expect(result.success).toBe(true)

    const updated = await dataLayer.stocks.get('000001.SZ')
    expect(updated?.group).toBe('核心持仓')
  })

  it('应该reject empty group name', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    const result = await updateStockGroup('000001.SZ', '   ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('分组名称不能为空')
  })

  it('应该get stocks by group', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
      group: '核心持仓',
    })
    await dataLayer.stocks.add({
      symbol: '600519.SH',
      name: '贵州茅台',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
      group: '成长配置',
    })

    const result = await getStocksByGroup('核心持仓')

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]?.symbol).toBe('000001.SZ')
  })

  it('应该list all pool groups including default', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
      group: '核心持仓',
    })

    const result = await getPoolGroups()

    expect(result.success).toBe(true)
    expect(result.data).toContain('核心持仓')
    expect(result.data).toContain(DEFAULT_POOL_GROUP)
  })

  it('应该fall back to default group when group is undefined', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    const stock = await dataLayer.stocks.get('000001.SZ')
    expect(stock?.group ?? DEFAULT_POOL_GROUP).toBe(DEFAULT_POOL_GROUP)

    const groups = await getPoolGroups()
    expect(groups.data).toContain(DEFAULT_POOL_GROUP)
  })
})
