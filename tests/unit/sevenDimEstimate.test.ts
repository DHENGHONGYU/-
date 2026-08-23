/**
 * @test_id V9-TEST-UT-084
 * @fileoverview 七维采集额度预估计算逻辑测试
  * @covers_docs []
*/

import { describe, it, expect } from 'vitest'
import type { DimensionConfig, DataSourceType } from '@/types/modules/collection.types'
import {
  estimateMonthlyCalls,
  estimateTotalMonthlyCalls,
  DEFAULT_DIMENSIONS,
  FREQUENCY_MINUTES,
} from '@/config/collectConfig'

describe('七维采集额度预估计算', () => {
  describe('estimateMonthlyCalls - 单维度月调用计算', () => {
    it('应该正确计算 daily 频率的月调用次数', () => {
      const dimension = {
        code: '02',
        name: 'K线数据',
        enabled: true,
        frequency: 'daily' as const,
        batchSize: 100,
        sources: ['akshare'] as DataSourceType[],
        cacheTtl: 1440,
        storageType: 'full' as const,
        fields: ['open', 'close'],
        importance: 'medium' as const,
      }
      const symbolCount = 100
      // daily = 1440分钟，一个月43200分钟
      // 每个标的每月调用次数 = ceil(43200 / 1440) = 30
      // 批次 = ceil(100 / 100) = 1
      // 总调用 = 30 * 1 = 30
      const result = estimateMonthlyCalls(dimension, symbolCount)
      expect(result).toBe(30)
    })

    it('应该正确计算 weekly 频率的月调用次数', () => {
      const dimension = {
        code: '06',
        name: '行业竞品',
        enabled: true,
        frequency: 'weekly' as const,
        batchSize: 20,
        sources: ['akshare'] as DataSourceType[],
        cacheTtl: 10080,
        storageType: 'lightweight' as const,
        fields: ['industryRank'],
        importance: 'medium' as const,
      }
      const symbolCount = 100
      // weekly = 10080分钟
      // 每个标的每月调用次数 = ceil(43200 / 10080) = 5
      // 批次 = ceil(100 / 20) = 5
      // 总调用 = 5 * 5 = 25
      const result = estimateMonthlyCalls(dimension, symbolCount)
      expect(result).toBe(25)
    })

    it('应该正确处理禁用维度', () => {
      const dimension = {
        ...DEFAULT_DIMENSIONS[0],
        enabled: false,
      } as DimensionConfig
      const result = estimateMonthlyCalls(dimension, 100)
      expect(result).toBe(0)
    })

    it('应该正确处理 manual 频率', () => {
      const dimension = {
        ...DEFAULT_DIMENSIONS[0],
        frequency: 'manual' as const,
      } as DimensionConfig
      const result = estimateMonthlyCalls(dimension, 100)
      expect(result).toBe(0)
    })

    it('应该正确计算 realtime 频率的月调用次数', () => {
      const dimension = {
        ...DEFAULT_DIMENSIONS[1],
        frequency: 'realtime' as const,
        batchSize: 50,
      } as DimensionConfig
      const symbolCount = 100
      // realtime = 5分钟
      // 每个标的每月调用次数 = ceil(43200 / 5) = 8640
      // 批次 = ceil(100 / 50) = 2
      // 总调用 = 8640 * 2 = 17280
      const result = estimateMonthlyCalls(dimension, symbolCount)
      expect(result).toBe(17280)
    })

    it('应该正确处理 batchSize 大于 symbolCount 的情况', () => {
      const dimension = {
        ...DEFAULT_DIMENSIONS[0],
        batchSize: 200,
      } as DimensionConfig
      const symbolCount = 100
      // 批次 = ceil(100 / 200) = 1
      const result = estimateMonthlyCalls(dimension, symbolCount)
      // monthly = 43200分钟，batchSize=200时，批次为1
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('estimateTotalMonthlyCalls - 多维度总调用计算', () => {
    it('应该正确计算所有启用维度的总调用次数', () => {
      const dimensions = DEFAULT_DIMENSIONS.filter(d => d.enabled)
      const symbolCount = 40 // 默认标的数
      
      const result = estimateTotalMonthlyCalls(dimensions, symbolCount)
      
      // 验证结果大于0
      expect(result).toBeGreaterThan(0)
      
      // 手动计算验证
      let expected = 0
      for (const dim of dimensions) {
        expected += estimateMonthlyCalls(dim, symbolCount)
      }
      expect(result).toBe(expected)
    })

    it('应该正确处理空维度数组', () => {
      const result = estimateTotalMonthlyCalls([], 100)
      expect(result).toBe(0)
    })

    it('应该正确处理所有维度都禁用的情况', () => {
      const dimensions = DEFAULT_DIMENSIONS.map(d => ({ ...d, enabled: false }))
      const result = estimateTotalMonthlyCalls(dimensions, 100)
      expect(result).toBe(0)
    })

    it('应该随标的数增加而增加', () => {
      const dimensions = DEFAULT_DIMENSIONS.filter(d => d.enabled)
      const result1 = estimateTotalMonthlyCalls(dimensions, 40)
      const result2 = estimateTotalMonthlyCalls(dimensions, 80)
      
      expect(result2).toBeGreaterThan(result1)
    })
  })

  describe('FREQUENCY_MINUTES 常量验证', () => {
    it('应该包含所有频率类型', () => {
      const frequencies = [
        'realtime', '1h', '3h', 'daily', '3d', 
        'weekly', 'biweekly', 'monthly', 'quarterly', 'manual'
      ]
      
      for (const freq of frequencies) {
        expect(FREQUENCY_MINUTES).toHaveProperty(freq)
      }
    })

    it('manual 频率应该为 0', () => {
      expect(FREQUENCY_MINUTES.manual).toBe(0)
    })

    it('频率值应该递增', () => {
      expect(FREQUENCY_MINUTES['1h']).toBeGreaterThan(FREQUENCY_MINUTES.realtime)
      expect(FREQUENCY_MINUTES['3h']).toBeGreaterThan(FREQUENCY_MINUTES['1h'])
      expect(FREQUENCY_MINUTES.daily).toBeGreaterThan(FREQUENCY_MINUTES['3h'])
      expect(FREQUENCY_MINUTES.weekly).toBeGreaterThan(FREQUENCY_MINUTES.daily)
      expect(FREQUENCY_MINUTES.monthly).toBeGreaterThan(FREQUENCY_MINUTES.weekly)
    })
  })

  describe('DEFAULT_DIMENSIONS 配置验证', () => {
    it('应该包含 16 个维度', () => {
      // 2026-08-22：维度已扩至 16（01-09 + 10-16），此断言为维度数护栏，
      // 新增/删除维度时必须同步更新此处与 collectionPipeline.DIMENSION_TO_MODE
      expect(DEFAULT_DIMENSIONS).toHaveLength(16)
    })

    it('每个维度应该包含必要字段', () => {
      for (const dim of DEFAULT_DIMENSIONS) {
        expect(dim).toHaveProperty('code')
        expect(dim).toHaveProperty('name')
        expect(dim).toHaveProperty('enabled')
        expect(dim).toHaveProperty('frequency')
        expect(dim).toHaveProperty('batchSize')
        expect(dim).toHaveProperty('sources')
      }
    })

    it('维度代码应该唯一', () => {
      const codes = DEFAULT_DIMENSIONS.map(d => d.code)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })
  })

  describe('额度预估准确性验证', () => {
    it('默认配置下的额度预估应该合理', () => {
      // 默认配置：40个标的，10个维度全部启用
      const dimensions = DEFAULT_DIMENSIONS.filter(d => d.enabled)
      const symbolCount = 40
      const monthlyCalls = estimateTotalMonthlyCalls(dimensions, symbolCount)
      
      // 验证结果在合理范围内（不应该过大或过小）
      expect(monthlyCalls).toBeGreaterThan(100)
      expect(monthlyCalls).toBeLessThan(100000)
      
      // 输出实际值供人工验证
      // eslint-disable-next-line no-console
      console.log('默认配置月调用总量:', monthlyCalls)
      // eslint-disable-next-line no-console
      console.log('日上限:', 2000)
      // eslint-disable-next-line no-console
      console.log('月使用率:', ((monthlyCalls / (2000 * 30)) * 100).toFixed(2) + '%')
    })

    it('全维度策略的额度预估应该最高', () => {
      const fullStrategy = DEFAULT_DIMENSIONS // 全部10个维度
      const valueStrategy = DEFAULT_DIMENSIONS.filter(d => 
        ['01', '02', '03', '04'].includes(d.code)
      )
      
      const symbolCount = 40
      const fullCalls = estimateTotalMonthlyCalls(fullStrategy, symbolCount)
      const valueCalls = estimateTotalMonthlyCalls(valueStrategy, symbolCount)
      
      expect(fullCalls).toBeGreaterThan(valueCalls)
    })
  })
})
