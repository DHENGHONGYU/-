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

  it('should log debug at debug level', () => {
    const logger = getLogger()
    logger.debug('debug msg')
    expect(debugSpy).toHaveBeenCalledWith('[DEBUG] debug msg', '')
  })

  it('should log info at debug level', () => {
    const logger = getLogger()
    logger.info('info msg')
    expect(logSpy).toHaveBeenCalledWith('[INFO] info msg', '')
  })

  it('should log warn at debug level', () => {
    const logger = getLogger()
    logger.warn('warn msg')
    expect(warnSpy).toHaveBeenCalledWith('[WARN] warn msg', '')
  })

  it('should log error at debug level', () => {
    const logger = getLogger()
    logger.error('error msg')
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] error msg', '')
  })

  it('should suppress debug when level is info', () => {
    setLogLevel('info')
    const logger = getLogger()
    logger.debug('debug msg')
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('should suppress debug and info when level is warn', () => {
    setLogLevel('warn')
    const logger = getLogger()
    logger.debug('debug msg')
    logger.info('info msg')
    expect(debugSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('should suppress all except error when level is error', () => {
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

  it('should include context when provided', () => {
    const logger = getLogger()
    logger.info('msg', { key: 'value' })
    expect(logSpy).toHaveBeenCalledWith('[INFO] msg', { key: 'value' })
  })

  it('should allow changing log level dynamically', () => {
    const logger = getLogger()
    setLogLevel('error')
    logger.info('should not appear')
    expect(logSpy).not.toHaveBeenCalled()

    setLogLevel('info')
    logger.info('should appear')
    expect(logSpy).toHaveBeenCalledTimes(1)
  })

  it('should return same logger interface each time', () => {
    const logger1 = getLogger()
    const logger2 = getLogger()
    expect(typeof logger1.debug).toBe('function')
    expect(typeof logger2.info).toBe('function')
  })
})
