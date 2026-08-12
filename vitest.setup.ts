/**
 * vitest.setup.ts
 * 
 * 全局 Vitest 测试 Setup 文件
 * 用于统一 Mock 全局依赖，避免测试套件中的 Mock 隔离问题
 * 
 * 使用方式：在 vitest.config.ts 中配置
 * test: {
 *   setupFiles: ['./vitest.setup.ts'],
 * }
 */

import { vi } from 'vitest'
import React from 'react'

// ============================================================
// 全局 Mock: MarketDataProvider
// 注意：vi.hoisted 变量不能导出，需通过工具函数间接访问
// ============================================================

/**
 * 全局唯一的 useMarketData mock 函数（内部变量，不导出）
 */
const mockUseMarketData = vi.hoisted(() => vi.fn())

/**
 * 全局唯一的 useOptionalMarketData mock 函数（内部变量，不导出）
 */
const mockUseOptionalMarketData = vi.hoisted(() => vi.fn())

/**
 * Mock useMarketData 返回值的类型定义
 */
export interface MockMarketDataContextValue {
  data: Record<string, unknown>
  loadingMap: Record<string, boolean>
  errorMap: Record<string, string | null>
  refreshWidget: ReturnType<typeof vi.fn>
  getTaskStats: ReturnType<typeof vi.fn>
  sendChatMessage: ReturnType<typeof vi.fn>
}

/**
 * 重置 useMarketData 到默认初始状态
 * 在每个测试用例的 beforeEach 中调用
 */
export function resetMarketDataMock(): void {
  vi.mocked(mockUseMarketData).mockImplementation(() => ({
    data: {},
    loadingMap: {},
    errorMap: {},
    refreshWidget: vi.fn(),
    getTaskStats: vi.fn(),
    sendChatMessage: vi.fn(),
  }))
}

/**
 * 设置 useMarketData 的具体返回值
 * 
 * @param options - 配置选项
 * @param options.instanceId - Widget 实例 ID
 * @param options.data - 模拟的数据
 * @param options.loading - 是否加载中
 * @param options.error - 错误信息
 */
export function setupMarketDataMock(options: {
  instanceId: string
  data?: Record<string, unknown>
  loading?: boolean
  error?: string | null
}): void {
  const { instanceId, data = {}, loading = false, error = null } = options
  
  vi.mocked(mockUseMarketData).mockReturnValue({
    data,
    loadingMap: { [instanceId]: loading },
    errorMap: { [instanceId]: error },
    refreshWidget: vi.fn(),
    getTaskStats: vi.fn(),
    sendChatMessage: vi.fn(),
  })
}

/**
 * 获取 useMarketData 的 mock 引用（供高级用例使用）
 * 通过此函数获取的引用可用于 .mockReturnValueOnce() 等调用
 */
export function getMarketDataMock() {
  return vi.mocked(mockUseMarketData)
}

// ============================================================
// useOptionalMarketData 工具函数（ValuePitWidget 等可选消费者使用）
// ============================================================

/**
 * 重置 useOptionalMarketData 到默认初始状态（返回 undefined）
 * ValuePitWidget 等组件在 data prop 注入时，会忽略 Context，因此默认返回 undefined
 */
export function resetOptionalMarketDataMock(): void {
  vi.mocked(mockUseOptionalMarketData).mockReturnValue(undefined)
}

/**
 * 设置 useOptionalMarketData 的具体返回值
 *
 * @param options - 配置选项（与 setupMarketDataMock 一致）
 */
export function setupOptionalMarketDataMock(options: {
  instanceId: string
  data?: Record<string, unknown>
  loading?: boolean
  error?: string | null
}): void {
  const { instanceId, data = {}, loading = false, error = null } = options

  vi.mocked(mockUseOptionalMarketData).mockReturnValue({
    data,
    loadingMap: { [instanceId]: loading },
    errorMap: { [instanceId]: error },
    refreshWidget: vi.fn(),
    getTaskStats: vi.fn(),
    sendChatMessage: vi.fn(),
  })
}

/**
 * 获取 useOptionalMarketData 的 mock 引用（供高级用例使用）
 */
export function getOptionalMarketDataMock() {
  return vi.mocked(mockUseOptionalMarketData)
}

// ============================================================
// Mock 组件实现（避免在 vi.hoisted 中使用 JSX）
// ============================================================

/**
 * MockMarketDataProvider - 简单的子组件传递器
 */
const MockMarketDataProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement('div', null, children)
}

// ============================================================
// vi.mock 声明（全局唯一）
// ============================================================

vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  useMarketData: mockUseMarketData,
  useOptionalMarketData: mockUseOptionalMarketData,
  MarketDataProvider: MockMarketDataProvider,
}))
