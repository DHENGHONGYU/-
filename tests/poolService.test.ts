/**
 * @test_id V9-TEST-UT-041
 * @covers_docs [V9-DOC-DATA-013, V9-DOC-PROJ-108, V9-DOC-BACK-011]
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { db } from '@/data/db'
import { DEFAULT_POOL_GROUP, RESEARCH_STATUS } from '@/constants/pool.constants'
import { STORE_NAME } from '@/config/dbConfig'
import {
  getAllPoolLanes,
  getPoolGroups,
  getPoolItemsByGroup,
  getPoolItemsByStatus,
  getPoolTransitionOptions,
  transitionPoolItem,
  updatePoolItemGroup,
} from '@/services/pool/poolService'

describe('poolService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
  })

  it('应该 transition candidate to screened', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    const result = await transitionPoolItem('000001.SZ', {
      pool: 'research',
      status: RESEARCH_STATUS.screened,
      label: '测试流转',
    })

    expect(result.success).toBe(true)

    const updated = await dataLayer.stocks.get('000001.SZ')
    expect(updated?.researchStatus).toBe(RESEARCH_STATUS.screened)
  })

  it('应该 archive from any active pool', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.deepDive,
      source: 'manual',
    })

    const result = await transitionPoolItem('000001.SZ', {
      pool: 'research',
      status: RESEARCH_STATUS.archived,
      label: '测试归档',
    })

    expect(result.success).toBe(true)

    const updated = await dataLayer.stocks.get('000001.SZ')
    expect(updated?.researchStatus).toBe(RESEARCH_STATUS.archived)
  })

  it('应该 reactivate archived to candidate', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.archived,
      source: 'manual',
    })

    const result = await transitionPoolItem('000001.SZ', {
      pool: 'research',
      status: RESEARCH_STATUS.candidate,
      label: '测试激活',
    })

    expect(result.success).toBe(true)

    const updated = await dataLayer.stocks.get('000001.SZ')
    expect(updated?.researchStatus).toBe(RESEARCH_STATUS.candidate)
  })

  it('应该 reject invalid transition', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    const result = await transitionPoolItem('000001.SZ', {
      pool: 'research',
      status: RESEARCH_STATUS.watching,
      label: '测试非法流转',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('非法流转')
  })

  it('应该 reject transition for non-existent stock', async () => {
    const result = await transitionPoolItem('NOT_EXIST', {
      pool: 'research',
      status: RESEARCH_STATUS.screened,
      label: '测试不存在标的',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('标的不存在')
  })

  it('应该 get pool items by status', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.watching,
      source: 'manual',
    })

    const result = await getPoolItemsByStatus('research', RESEARCH_STATUS.watching)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })

  it('应该返回 transition options for each status', () => {
    expect(getPoolTransitionOptions('research', RESEARCH_STATUS.candidate)).toHaveLength(2)
    expect(getPoolTransitionOptions('research', RESEARCH_STATUS.screened)).toHaveLength(2)
    expect(getPoolTransitionOptions('research', RESEARCH_STATUS.deepDive)).toHaveLength(2)
    expect(getPoolTransitionOptions('research', RESEARCH_STATUS.watching)).toHaveLength(2)
    expect(getPoolTransitionOptions('research', RESEARCH_STATUS.archived)).toHaveLength(1)
  })

  it('应该更新 pool item group', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    const result = await updatePoolItemGroup('000001.SZ', '核心持仓')

    expect(result.success).toBe(true)

    const updated = await dataLayer.stocks.get('000001.SZ')
    expect(updated?.group).toBe('核心持仓')
  })

  it('应该 reject empty group name', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    const result = await updatePoolItemGroup('000001.SZ', '   ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('分组名称不能为空')
  })

  it('应该 get pool items by group', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
      group: '核心持仓',
    })
    await dataLayer.stocks.add({
      symbol: '600519.SH',
      name: '贵州茅台',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
      group: '成长配置',
    })

    const result = await getPoolItemsByGroup('核心持仓')

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]?.symbol).toBe('000001.SZ')
  })

  it('应该 list all pool groups including default', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
      group: '核心持仓',
    })

    const result = await getPoolGroups()

    expect(result.success).toBe(true)
    expect(result.data).toContain('核心持仓')
    expect(result.data).toContain(DEFAULT_POOL_GROUP)
  })

  it('应该 fall back to default group when group is undefined', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    const stock = await dataLayer.stocks.get('000001.SZ')
    expect(stock?.group ?? DEFAULT_POOL_GROUP).toBe(DEFAULT_POOL_GROUP)

    const groups = await getPoolGroups()
    expect(groups.data).toContain(DEFAULT_POOL_GROUP)
  })

  it('应该 get all pool lanes', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
    })

    const result = await getAllPoolLanes()

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]?.status).toBe(RESEARCH_STATUS.candidate)
  })
})
