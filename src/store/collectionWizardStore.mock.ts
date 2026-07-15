/**
 * @module collectionWizardStore.mock
 * @description 数据采集向导 MOCK 配置数据
 *
 * 仅在开发阶段 / IndexedDB 不可用时使用，作为初始数据源。
 * 一旦 IndexedDB 中存在真实数据，应优先使用持久化数据。
 */

import { MOCK_WIZARD_API_BASE_URL } from '@/config/dataSourceUrls'
import type { PersistedWizardConfig } from '@/types/modules/collection.types'

/**
 * Mock 配置模板数据
 *
 * @remarks
 * 使用 mock 数据的场景：
 * 1. 首次启动，IndexedDB 为空
 * 2. IndexedDB 查询失败时的回退
 * 3. 开发调试
 */
export const MOCK_CONFIGS: PersistedWizardConfig[] = [
  {
    id: 'wizard_config_1_mock',
    name: '高频行情监控',
    selectedDimensions: ['quote', 'financial'],
    apiConfigs: {
      quote: { baseUrl: `${MOCK_WIZARD_API_BASE_URL}/quote/realtime`, timeoutMs: 5000, rateLimitPerMinute: 60 },
      financial: { baseUrl: `${MOCK_WIZARD_API_BASE_URL}/financial/quarterly`, timeoutMs: 10000 },
    },
    frequency: 'realtime',
    cronExpression: '* * * * *',
    priority: 'high',
    cacheTTL: 60,
    cacheStrategy: 'network-first',
    saveAsTemplate: true,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'wizard_config_2_mock',
    name: '每日舆情分析',
    selectedDimensions: ['news', 'sector'],
    apiConfigs: {
      news: { baseUrl: `${MOCK_WIZARD_API_BASE_URL}/news/sentiment`, timeoutMs: 8000 },
      sector: { baseUrl: `${MOCK_WIZARD_API_BASE_URL}/sector/rotation`, timeoutMs: 8000 },
    },
    frequency: 'hourly',
    cronExpression: '0 * * * *',
    priority: 'medium',
    cacheTTL: 1800,
    cacheStrategy: 'stale-while-revalidate',
    saveAsTemplate: true,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'wizard_config_3_mock',
    name: '基础行情采集',
    selectedDimensions: ['quote'],
    apiConfigs: {
      quote: { baseUrl: `${MOCK_WIZARD_API_BASE_URL}/quote/daily`, timeoutMs: 15000 },
    },
    frequency: 'daily',
    cronExpression: '0 0 * * *',
    priority: 'low',
    cacheTTL: 86400,
    cacheStrategy: 'cache-first',
    saveAsTemplate: true,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 3,
  },
]
