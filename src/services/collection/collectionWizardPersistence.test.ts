/**
 * @fileoverview collectionWizardPersistence 单元测试
 *
 * 测试数据采集向导配置持久化服务的 CRUD 功能：
 * - 创建配置模板（saveWizardConfig）
 * - 读取单个配置（loadWizardConfig）
 * - 读取所有配置（loadAllWizardConfigs）
 * - 更新配置（updateWizardConfig）
 * - 删除配置（deleteWizardConfig）
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  saveWizardConfig,
  loadWizardConfig,
  loadAllWizardConfigs,
  updateWizardConfig,
  deleteWizardConfig,
} from './collectionWizardPersistence'
import { dataBridge } from '@/core/databridge'
import type { PersistedWizardConfig } from '@/types/modules/collection.types'

// Mock dataBridge
vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: vi.fn(),
    query: vi.fn(),
  },
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('collectionWizardPersistence - 多数据源配置 CRUD', () => {
  const mockDataBridge = vi.mocked(dataBridge)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('saveWizardConfig - 创建配置模板', () => {
    it('应该成功保存配置模板并返回完整配置', async () => {
      const configInput = {
        name: '测试配置模板',
        selectedDimensions: ['quote', 'kline'],
        apiConfigs: {
          quote: { baseUrl: 'https://api.example.com/quote', timeoutMs: 5000 },
          kline: { baseUrl: 'https://api.example.com/kline', timeoutMs: 5000 },
        },
        frequency: 'daily' as const,
        cronExpression: '0 0 * * *',
        priority: 'medium' as const,
        cacheTTL: 3600,
        cacheStrategy: 'stale-while-revalidate' as const,
        saveAsTemplate: true,
      }

      mockDataBridge.forward.mockResolvedValueOnce(undefined)

      const result = await saveWizardConfig(configInput)

      expect(result).toMatchObject({
        name: configInput.name,
        selectedDimensions: configInput.selectedDimensions,
        frequency: configInput.frequency,
        priority: configInput.priority,
        saveAsTemplate: true,
      })

      expect(result.id).toMatch(/^wizard_config_\d+_/)
      expect(result.createdAt).toBeGreaterThan(0)
      expect(result.updatedAt).toBeGreaterThan(0)
      expect(mockDataBridge.forward).toHaveBeenCalledTimes(1)
    })

    it('应该在保存失败时抛出错误', async () => {
      const configInput = {
        name: '失败配置',
        selectedDimensions: ['quote'],
        apiConfigs: {
          quote: { baseUrl: 'https://api.example.com', timeoutMs: 5000 },
        },
        frequency: 'daily' as const,
        cronExpression: '0 0 * * *',
        priority: 'low' as const,
        cacheTTL: 3600,
        cacheStrategy: 'cache-first' as const,
        saveAsTemplate: true,
      }

      mockDataBridge.forward.mockRejectedValueOnce(new Error('DB Error'))

      await expect(saveWizardConfig(configInput)).rejects.toThrow('DB Error')
    })
  })

  describe('loadWizardConfig - 读取单个配置', () => {
    it('应该成功加载指定的配置模板', async () => {
      const configId = 'wizard_config_123456_abc'
      const mockConfig: PersistedWizardConfig = {
        id: configId,
        name: '测试配置',
        selectedDimensions: ['quote', 'financial'],
        apiConfigs: {},
        frequency: 'daily',
        cronExpression: '0 0 * * *',
        priority: 'medium',
        cacheTTL: 3600,
        cacheStrategy: 'stale-while-revalidate',
        saveAsTemplate: true,
        createdAt: Date.now() - 1000,
        updatedAt: Date.now(),
      }

      mockDataBridge.query.mockResolvedValueOnce({
        success: true,
        data: mockConfig,
      })

      const result = await loadWizardConfig(configId)

      expect(result).toEqual(mockConfig)
      expect(mockDataBridge.query).toHaveBeenCalledWith({
        action: 'QUERY_GET',
        store: 'collect_config',
        key: configId,
        source: 'fetcher',
      })
    })

    it('应该在配置不存在时返回 null', async () => {
      const configId = 'wizard_config_not_exist'

      mockDataBridge.query.mockResolvedValueOnce({
        success: false,
        data: null,
        error: 'Not found',
      })

      const result = await loadWizardConfig(configId)

      expect(result).toBeNull()
    })

    it('应该在查询失败时返回 null', async () => {
      const configId = 'wizard_config_123'

      mockDataBridge.query.mockRejectedValueOnce(new Error('Query failed'))

      const result = await loadWizardConfig(configId)

      expect(result).toBeNull()
    })
  })

  describe('loadAllWizardConfigs - 读取所有配置', () => {
    it('应该成功加载所有配置模板并按 updatedAt 降序排序', async () => {
      const now = Date.now()
      const mockConfigs: PersistedWizardConfig[] = [
        {
          id: 'wizard_config_1',
          name: '配置1',
          selectedDimensions: ['quote'],
          apiConfigs: {},
          frequency: 'daily',
          cronExpression: '0 0 * * *',
          priority: 'low',
          cacheTTL: 3600,
          cacheStrategy: 'cache-first',
          saveAsTemplate: true,
          createdAt: now - 2000,
          updatedAt: now - 2000,
        },
        {
          id: 'wizard_config_2',
          name: '配置2',
          selectedDimensions: ['quote', 'kline'],
          apiConfigs: {},
          frequency: 'hourly',
          cronExpression: '0 * * * *',
          priority: 'high',
          cacheTTL: 1800,
          cacheStrategy: 'stale-while-revalidate',
          saveAsTemplate: true,
          createdAt: now - 1000,
          updatedAt: now - 1000,
        },
        {
          id: 'wizard_config_3',
          name: '配置3',
          selectedDimensions: ['financial'],
          apiConfigs: {},
          frequency: 'custom',
          cronExpression: '0 0 * * 0',
          priority: 'medium',
          cacheTTL: 86400,
          cacheStrategy: 'cache-first',
          saveAsTemplate: true,
          createdAt: now,
          updatedAt: now,
        },
      ]

      mockDataBridge.query.mockResolvedValueOnce({
        success: true,
        data: mockConfigs,
      })

      const result = await loadAllWizardConfigs()

      expect(result).toHaveLength(3)
      // 验证按 updatedAt 降序排序
      expect(result[0]?.id).toBe('wizard_config_3')
      expect(result[1]?.id).toBe('wizard_config_2')
      expect(result[2]?.id).toBe('wizard_config_1')
    })

    it('应该过滤掉非向导配置模板', async () => {
      const now = Date.now()
      const mockData = [
        {
          id: 'wizard_config_1',
          name: '向导配置',
          selectedDimensions: ['quote'],
          apiConfigs: {},
          frequency: 'daily' as const,
          cronExpression: '0 0 * * *',
          priority: 'medium' as const,
          cacheTTL: 3600,
          cacheStrategy: 'cache-first' as const,
          saveAsTemplate: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'other_config_1',
          name: '其他配置',
          createdAt: now,
          updatedAt: now,
        },
      ]

      mockDataBridge.query.mockResolvedValueOnce({
        success: true,
        data: mockData,
      })

      const result = await loadAllWizardConfigs()

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('wizard_config_1')
    })

    it('应该在查询失败时返回空数组', async () => {
      mockDataBridge.query.mockRejectedValueOnce(new Error('Query failed'))

      const result = await loadAllWizardConfigs()

      expect(result).toEqual([])
    })

    it('应该在查询结果为空时返回空数组', async () => {
      mockDataBridge.query.mockResolvedValueOnce({
        success: false,
        data: null,
        error: 'No data',
      })

      const result = await loadAllWizardConfigs()

      expect(result).toEqual([])
    })
  })

  describe('updateWizardConfig - 更新配置', () => {
    it('应该成功更新配置模板', async () => {
      const configId = 'wizard_config_123'
      const existingConfig: PersistedWizardConfig = {
        id: configId,
        name: '原配置',
        selectedDimensions: ['quote'],
        apiConfigs: {},
        frequency: 'daily',
        cronExpression: '0 0 * * *',
        priority: 'low',
        cacheTTL: 3600,
        cacheStrategy: 'cache-first',
        saveAsTemplate: true,
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
      }

      const updates = {
        name: '更新后的配置',
        frequency: 'hourly' as const,
        priority: 'high' as const,
      }

      // Mock loadWizardConfig
      mockDataBridge.query.mockResolvedValueOnce({
        success: true,
        data: existingConfig,
      })

      // Mock save (forward)
      mockDataBridge.forward.mockResolvedValueOnce(undefined)

      const result = await updateWizardConfig(configId, updates)

      expect(result).not.toBeNull()
      expect(result?.name).toBe('更新后的配置')
      expect(result?.frequency).toBe('hourly')
      expect(result?.priority).toBe('high')
      expect(result?.id).toBe(configId)
      expect(result?.createdAt).toBe(existingConfig.createdAt)
      expect(result?.updatedAt).toBeGreaterThan(existingConfig.updatedAt)
    })

    it('应该在配置不存在时返回 null', async () => {
      const configId = 'wizard_config_not_exist'
      const updates = { name: '新名称' }

      mockDataBridge.query.mockResolvedValueOnce({
        success: false,
        data: null,
      })

      const result = await updateWizardConfig(configId, updates)

      expect(result).toBeNull()
      expect(mockDataBridge.forward).not.toHaveBeenCalled()
    })

    it('应该在更新失败时抛出错误', async () => {
      const configId = 'wizard_config_123'
      const existingConfig: PersistedWizardConfig = {
        id: configId,
        name: '原配置',
        selectedDimensions: ['quote'],
        apiConfigs: {},
        frequency: 'daily',
        cronExpression: '0 0 * * *',
        priority: 'low',
        cacheTTL: 3600,
        cacheStrategy: 'cache-first',
        saveAsTemplate: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      mockDataBridge.query.mockResolvedValueOnce({
        success: true,
        data: existingConfig,
      })

      mockDataBridge.forward.mockRejectedValueOnce(new Error('Update failed'))

      await expect(
        updateWizardConfig(configId, { name: '新名称' })
      ).rejects.toThrow('Update failed')
    })
  })

  describe('deleteWizardConfig - 删除配置', () => {
    it('应该成功删除配置模板', async () => {
      const configId = 'wizard_config_123'

      mockDataBridge.forward.mockResolvedValueOnce(undefined)

      const result = await deleteWizardConfig(configId)

      expect(result).toBe(true)
      expect(mockDataBridge.forward).toHaveBeenCalledTimes(1)
    })

    it('应该在删除失败时返回 false', async () => {
      const configId = 'wizard_config_123'

      mockDataBridge.forward.mockRejectedValueOnce(new Error('Delete failed'))

      const result = await deleteWizardConfig(configId)

      expect(result).toBe(false)
    })
  })

  describe('多数据源配置场景测试', () => {
    it('应该支持多数据源配置的完整生命周期', async () => {
      // 1. 创建第一个配置
      const config1Input = {
        name: 'A股行情采集',
        selectedDimensions: ['quote', 'kline'],
        apiConfigs: {
          quote: { baseUrl: 'https://api.example.com/quote', timeoutMs: 5000 },
          kline: { baseUrl: 'https://api.example.com/kline', timeoutMs: 5000 },
        },
        frequency: 'daily' as const,
        cronExpression: '0 0 * * *',
        priority: 'high' as const,
        cacheTTL: 3600,
        cacheStrategy: 'stale-while-revalidate' as const,
        saveAsTemplate: true,
      }

      mockDataBridge.forward.mockResolvedValueOnce(undefined)
      const config1 = await saveWizardConfig(config1Input)
      expect(config1.id).toMatch(/^wizard_config_/)

      // 2. 创建第二个配置
      const config2Input = {
        name: '财务数据采集',
        selectedDimensions: ['financial'],
        apiConfigs: {
          financial: { baseUrl: 'https://api.example.com/financial', timeoutMs: 5000 },
        },
        frequency: 'custom' as const,
        cronExpression: '0 0 * * 0',
        priority: 'medium' as const,
        cacheTTL: 86400,
        cacheStrategy: 'cache-first' as const,
        saveAsTemplate: true,
      }

      mockDataBridge.forward.mockResolvedValueOnce(undefined)
      const config2 = await saveWizardConfig(config2Input)
      expect(config2.id).toMatch(/^wizard_config_/)

      // 3. 查询所有配置
      mockDataBridge.query.mockResolvedValueOnce({
        success: true,
        data: [config1, config2],
      })
      const allConfigs = await loadAllWizardConfigs()
      expect(allConfigs).toHaveLength(2)

      // 4. 更新第一个配置
      mockDataBridge.query.mockResolvedValueOnce({
        success: true,
        data: config1,
      })
      mockDataBridge.forward.mockResolvedValueOnce(undefined)
      const updatedConfig1 = await updateWizardConfig(config1.id, {
        name: 'A股行情采集-优化版',
        priority: 'low' as const,
      })
      expect(updatedConfig1?.name).toBe('A股行情采集-优化版')
      expect(updatedConfig1?.priority).toBe('low')

      // 5. 删除第二个配置
      mockDataBridge.forward.mockResolvedValueOnce(undefined)
      const deleteResult = await deleteWizardConfig(config2.id)
      expect(deleteResult).toBe(true)

      // 6. 验证删除后只剩一个配置
      mockDataBridge.query.mockResolvedValueOnce({
        success: true,
        data: [updatedConfig1!],
      })
      const remainingConfigs = await loadAllWizardConfigs()
      expect(remainingConfigs).toHaveLength(1)
      expect(remainingConfigs[0]?.id).toBe(config1.id)
    })

    it('应该支持不同数据维度组合的配置', async () => {
      const dimensionCombinations = [
        ['quote'],
        ['kline'],
        ['quote', 'kline'],
        ['financial'],
        ['quote', 'financial'],
        ['kline', 'financial'],
        ['quote', 'kline', 'financial'],
      ]

      const configs: PersistedWizardConfig[] = []

      // 创建多个不同维度组合的配置
      for (const dimensions of dimensionCombinations) {
        mockDataBridge.forward.mockResolvedValueOnce(undefined)
        const config = await saveWizardConfig({
          name: `配置-${dimensions.join('+')}`,
          selectedDimensions: dimensions,
          apiConfigs: {},
          frequency: 'daily',
          cronExpression: '0 0 * * *',
          priority: 'medium',
          cacheTTL: 3600,
          cacheStrategy: 'cache-first',
          saveAsTemplate: true,
        })
        configs.push(config)
      }

      expect(configs).toHaveLength(7)

      // 查询所有配置
      mockDataBridge.query.mockResolvedValueOnce({
        success: true,
        data: configs,
      })
      const allConfigs = await loadAllWizardConfigs()
      expect(allConfigs).toHaveLength(7)

      // 验证每个配置的维度组合（loadAllWizardConfigs 按 updatedAt 降序排序，不强制顺序）
      const actualCombinations = allConfigs.map((config) => config.selectedDimensions)
      expect(actualCombinations).toHaveLength(dimensionCombinations.length)
      dimensionCombinations.forEach((combo) => {
        expect(actualCombinations).toContainEqual(combo)
      })
    })
  })
})
