/**
 * @test_id V9-TEST-UT-035
 * @covers_docs []
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { getLogger, setLogLevel } from '@/lib/logger'

describe('logger', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setLogLevel('debug')
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该记录 debug at debug level', () => {
    const logger = getLogger()
    logger.debug('debug msg')
    expect(debugSpy).toHaveBeenCalledWith('[DEBUG] debug msg', expect.any(Object))
  })

  it('应该记录 info at debug level', () => {
    const logger = getLogger()
    logger.info('info msg')
    expect(logSpy).toHaveBeenCalledWith('[INFO] info msg', expect.any(Object))
  })

  it('应该记录 warn at debug level', () => {
    const logger = getLogger()
    logger.warn('warn msg')
    expect(warnSpy).toHaveBeenCalledWith('[WARN] warn msg', expect.any(Object))
  })

  it('应该记录 error at debug level', () => {
    const logger = getLogger()
    logger.error('error msg')
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] error msg', expect.any(Object))
  })

  it('应该suppress debug when level is info', () => {
    setLogLevel('info')
    const logger = getLogger()
    logger.debug('debug msg')
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('应该suppress debug and info when level is warn', () => {
    setLogLevel('warn')
    const logger = getLogger()
    logger.debug('debug msg')
    logger.info('info msg')
    expect(debugSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('应该suppress all except error when level is error', () => {
    setLogLevel('error')
    const logger = getLogger()
    logger.debug('debug msg')
    logger.info('info msg')
    logger.warn('warn msg')
    logger.error('error msg')

    expect(debugSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('应该包含 context when provided', () => {
    const logger = getLogger()
    logger.info('msg', { key: 'value' })
    expect(logSpy).toHaveBeenCalledWith('[INFO] msg', { key: 'value' })
  })

  it('应该允许 changing log level dynamically', () => {
    const logger = getLogger()
    setLogLevel('error')
    logger.info('should not appear')
    expect(logSpy).not.toHaveBeenCalled()

    setLogLevel('info')
    logger.info('should appear')
    expect(logSpy).toHaveBeenCalledTimes(1)
  })

  it('应该返回 same logger interface each time', () => {
    const logger1 = getLogger()
    const logger2 = getLogger()
    expect(typeof logger1.debug).toBe('function')
    expect(typeof logger2.info).toBe('function')
  })
})
