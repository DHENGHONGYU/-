import { getLogger } from '@/lib/logger'
import { vi } from 'vitest'

const logger = getLogger()

export interface TestLogger {
  suiteStart(suiteName: string): void
  suiteEnd(suiteName: string): void
  testStart(testName: string): void
  testEnd(testName: string): void
  step(message: string): void
  info(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
  assertStart(assertionName: string): void
  assertEnd(assertionName: string, passed: boolean): void
  wrapAssert<T>(assertionName: string, fn: () => T): T
  wrapAsyncAssert<T>(assertionName: string, fn: () => Promise<T>): Promise<T>
  measure<T>(label: string, fn: () => T): T
  measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T>
  snapshot(name: string, data: unknown): void
  section(title: string): void
}

export function createTestLogger(moduleName: string): TestLogger {
  return {
    suiteStart(suiteName: string) {
      logger.info(`[${moduleName}] ┌─────────────────────────────────────────────`)
      logger.info(`[${moduleName}] │ 测试套件 "${suiteName}" 开始`)
      logger.info(`[${moduleName}] └─────────────────────────────────────────────`)
    },
    suiteEnd(suiteName: string) {
      logger.info(`[${moduleName}] ┌─────────────────────────────────────────────`)
      logger.info(`[${moduleName}] │ 测试套件 "${suiteName}" 结束`)
      logger.info(`[${moduleName}] └─────────────────────────────────────────────`)
    },
    testStart(testName: string) {
      logger.info(`[${moduleName}] • 测试用例: ${testName}`)
    },
    testEnd(testName: string) {
      logger.info(`[${moduleName}] ✓ 测试用例 "${testName}" 完成`)
    },
    step(message: string) {
      logger.info(`[${moduleName}]   → ${message}`)
    },
    info(message: string, data?: unknown) {
      logger.info(`[${moduleName}]   ${message}`, data)
    },
    error(message: string, data?: unknown) {
      logger.error(`[${moduleName}] ✗ ${message}`, data)
    },
    assertStart(assertionName: string) {
      logger.info(`[${moduleName}]     ◇ 断言 "${assertionName}" 开始...`)
    },
    assertEnd(assertionName: string, passed: boolean) {
      if (passed) {
        logger.info(`[${moduleName}]     ✓ 断言 "${assertionName}" 通过`)
      } else {
        logger.error(`[${moduleName}]     ✗ 断言 "${assertionName}" 失败`)
      }
    },
    wrapAssert<T>(assertionName: string, fn: () => T): T {
      this.assertStart(assertionName)
      try {
        const result = fn()
        this.assertEnd(assertionName, true)
        return result
      } catch (error) {
        this.assertEnd(assertionName, false)
        logger.error(`[${moduleName}]     ✗ 断言 "${assertionName}" 详细错误:`, error)
        throw error
      }
    },
    async wrapAsyncAssert<T>(assertionName: string, fn: () => Promise<T>): Promise<T> {
      this.assertStart(assertionName)
      try {
        const result = await fn()
        this.assertEnd(assertionName, true)
        return result
      } catch (error) {
        this.assertEnd(assertionName, false)
        logger.error(`[${moduleName}]     ✗ 断言 "${assertionName}" 详细错误:`, error)
        throw error
      }
    },
    measure<T>(label: string, fn: () => T): T {
      const startTime = performance.now()
      logger.info(`[${moduleName}]   ⏱ 开始测量: ${label}`)
      try {
        const result = fn()
        const duration = (performance.now() - startTime).toFixed(2)
        logger.info(`[${moduleName}]   ⏱ 测量完成: ${label} (${duration}ms)`)
        return result
      } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2)
        logger.error(`[${moduleName}]   ⏱ 测量失败: ${label} (${duration}ms)`, error)
        throw error
      }
    },
    async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
      const startTime = performance.now()
      logger.info(`[${moduleName}]   ⏱ 开始测量: ${label}`)
      try {
        const result = await fn()
        const duration = (performance.now() - startTime).toFixed(2)
        logger.info(`[${moduleName}]   ⏱ 测量完成: ${label} (${duration}ms)`)
        return result
      } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2)
        logger.error(`[${moduleName}]   ⏱ 测量失败: ${label} (${duration}ms)`, error)
        throw error
      }
    },
    snapshot(name: string, data: unknown) {
      logger.info(`[${moduleName}]   📸 数据快照 "${name}":`, data)
    },
    section(title: string) {
      logger.info(`[${moduleName}] ── ${title} ──`)
    },
  }
}

export function logBeforeEach(moduleName: string): void {
  logger.info(`[${moduleName}] ┌─────────────────────────────────────────────`)
  logger.info(`[${moduleName}] │ beforeEach 清理开始`)
  logger.info(`[${moduleName}] ├─ vi.clearAllMocks()`)
  vi.clearAllMocks()
  logger.info(`[${moduleName}] ├─ vi.resetModules()`)
  vi.resetModules()
  logger.info(`[${moduleName}] └─────────────────────────────────────────────`)
}

export function logAfterEach(moduleName: string): void {
  logger.info(`[${moduleName}] ┌─────────────────────────────────────────────`)
  logger.info(`[${moduleName}] │ afterEach 清理开始`)
  logger.info(`[${moduleName}] ├─ vi.restoreAllMocks()`)
  vi.restoreAllMocks()
  logger.info(`[${moduleName}] └─────────────────────────────────────────────`)
}

export function logSetupStep(moduleName: string, stepName: string): void {
  logger.info(`[${moduleName}]   ◆ 设置: ${stepName}`)
}

export function logScanExecution(moduleName: string, scanFnName: string): void {
  logger.info(`[${moduleName}]   ▶ 执行 ${scanFnName}()...`)
}

export function logScanComplete(moduleName: string, scanFnName: string, resultCount?: number): void {
  if (resultCount !== undefined) {
    logger.info(`[${moduleName}]   ◀ ${scanFnName}() 执行完成，发现 ${resultCount} 条结果`)
  } else {
    logger.info(`[${moduleName}]   ◀ ${scanFnName}() 执行完成`)
  }
}
