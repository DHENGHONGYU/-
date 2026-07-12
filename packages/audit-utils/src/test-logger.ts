import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      timestampKey: false,
      messageKey: 'msg',
    },
  },
})

export interface TestLogger {
  suiteStart(suiteName: string): void
  suiteEnd(suiteName: string): void
  testStart(testName: string): void
  testEnd(testName: string): void
  step(message: string): void
  assertStart(assertionName: string): void
  assertEnd(assertionName: string, passed: boolean): void
  wrapAssert<T>(assertionName: string, fn: () => T): T
  wrapAsyncAssert<T>(assertionName: string, fn: () => Promise<T>): Promise<T>
  measure<T>(label: string, fn: () => T): T
  logBeforeEach(moduleName: string): void
  logAfterEach(moduleName: string): void
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
      const start = Date.now()
      logger.info(`[${moduleName}]   ⏱️  ${label} 开始...`)
      try {
        const result = fn()
        const duration = Date.now() - start
        logger.info(`[${moduleName}]   ⏱️  ${label} 完成，耗时 ${duration}ms`)
        return result
      } catch (error) {
        const duration = Date.now() - start
        logger.error(`[${moduleName}]   ⏱️  ${label} 失败，耗时 ${duration}ms`, error)
        throw error
      }
    },

    logBeforeEach(moduleName: string) {
      logger.info(`[${moduleName}]   ===== beforeEach 清理开始 =====`)
      logger.info(`[${moduleName}]   → vi.clearAllMocks()`)
      logger.info(`[${moduleName}]   → vi.resetModules()`)
      logger.info(`[${moduleName}]   ===== beforeEach 清理结束 =====`)
    },

    logAfterEach(moduleName: string) {
      logger.info(`[${moduleName}]   ===== afterEach 清理开始 =====`)
      logger.info(`[${moduleName}]   → vi.restoreAllMocks()`)
      logger.info(`[${moduleName}]   ===== afterEach 清理结束 =====`)
    },
  }
}

export function logBeforeEach(suiteName: string): void {
  logger.info(`[${suiteName}] ┌─────────────────────────────────────────────`)
  logger.info(`[${suiteName}] │ beforeEach 清理开始`)
  logger.info(`[${suiteName}] ├─ vi.clearAllMocks()`)
  logger.info(`[${suiteName}] ├─ vi.resetModules()`)
  logger.info(`[${suiteName}] └─────────────────────────────────────────────`)
}

export function logAfterEach(suiteName: string): void {
  logger.info(`[${suiteName}] ┌─────────────────────────────────────────────`)
  logger.info(`[${suiteName}] │ afterEach 清理开始`)
  logger.info(`[${suiteName}] ├─ vi.restoreAllMocks()`)
  logger.info(`[${suiteName}] └─────────────────────────────────────────────`)
}