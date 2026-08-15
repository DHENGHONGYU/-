import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getLogger, setLogLevel, setLogFormat, getLogFormat } from './logger'

describe('logger', () => {
  beforeEach(() => {
    setLogLevel('debug')
    setLogFormat('pretty')
    vi.clearAllMocks()
  })

  describe('getLogger()', () => {
    it('返回包含 4 个级别的 logger 对象', () => {
      const logger = getLogger()
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    })

    it('debug 级别输出所有日志', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      setLogLevel('debug')
      const logger = getLogger()
      logger.debug('d')
      logger.info('i')
      logger.warn('w')
      logger.error('e')

      expect(debugSpy).toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()

      debugSpy.mockRestore()
      logSpy.mockRestore()
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it('info 级别不输出 debug', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      setLogLevel('info')
      const logger = getLogger()
      logger.debug('d')
      logger.info('i')

      expect(debugSpy).not.toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalled()

      debugSpy.mockRestore()
      logSpy.mockRestore()
    })

    it('warn 级别只输出 warn 和 error', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      setLogLevel('warn')
      const logger = getLogger()
      logger.debug('d')
      logger.info('i')
      logger.warn('w')
      logger.error('e')

      expect(debugSpy).not.toHaveBeenCalled()
      expect(logSpy).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()

      debugSpy.mockRestore()
      logSpy.mockRestore()
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it('error 级别只输出 error', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      setLogLevel('error')
      const logger = getLogger()
      logger.debug('d')
      logger.info('i')
      logger.warn('w')
      logger.error('e')

      expect(debugSpy).not.toHaveBeenCalled()
      expect(logSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()

      debugSpy.mockRestore()
      logSpy.mockRestore()
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it('日志包含上下文对象', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      setLogLevel('info')
      const logger = getLogger()
      logger.info('test msg', { key: 'value', count: 42 })
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('test msg'),
        expect.objectContaining({ key: 'value', count: 42 })
      )
      logSpy.mockRestore()
    })

    it('不传上下文时默认传空对象', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      setLogLevel('info')
      const logger = getLogger()
      logger.info('no context')
      expect(logSpy).toHaveBeenCalledWith(
        expect.any(String),
        {}
      )
      logSpy.mockRestore()
    })
  })

  describe('setLogLevel()', () => {
    it('切换日志级别', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      setLogLevel('debug')
      const logger = getLogger()
      logger.debug('should show')
      expect(debugSpy).toHaveBeenCalledTimes(1)

      setLogLevel('info')
      logger.debug('should not show')
      expect(debugSpy).toHaveBeenCalledTimes(1)

      debugSpy.mockRestore()
    })
  })

  describe('setLogFormat() / getLogFormat()', () => {
    it('默认格式为 pretty', () => {
      expect(getLogFormat()).toBe('pretty')
    })

    it('可切换到 json 格式', () => {
      setLogFormat('json')
      expect(getLogFormat()).toBe('json')
    })

    it('json 格式输出结构化 JSON 字符串', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      setLogFormat('json')
      setLogLevel('info')
      const logger = getLogger()
      logger.info('test event', { userId: 123, action: 'login' })

      expect(logSpy).toHaveBeenCalledTimes(1)
      const output = logSpy.mock.calls[0]![0] as string
      const parsed = JSON.parse(output)
      expect(parsed.level).toBe('INFO')
      expect(parsed.message).toBe('test event')
      expect(parsed.userId).toBe(123)
      expect(parsed.action).toBe('login')
      expect(parsed.timestamp).toBeDefined()

      logSpy.mockRestore()
    })

    it('json 格式无上下文时仍输出有效 JSON', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      setLogFormat('json')
      setLogLevel('info')
      const logger = getLogger()
      logger.info('no context')

      expect(logSpy).toHaveBeenCalledTimes(1)
      const output = logSpy.mock.calls[0]![0] as string
      const parsed = JSON.parse(output)
      expect(parsed.level).toBe('INFO')
      expect(parsed.message).toBe('no context')

      logSpy.mockRestore()
    })

    it('pretty 格式包含时间戳和符号', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      setLogFormat('pretty')
      setLogLevel('info')
      const logger = getLogger()
      logger.info('pretty test')

      expect(logSpy).toHaveBeenCalledTimes(1)
      const output = logSpy.mock.calls[0]![0] as string
      expect(output).toContain('[INFO]')
      expect(output).toContain('pretty test')

      logSpy.mockRestore()
    })

    it('支持 debug/warn/error 级别的 json 格式', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      setLogFormat('json')
      setLogLevel('debug')
      const logger = getLogger()

      logger.debug('d msg', { k: 'd' })
      logger.warn('w msg', { k: 'w' })
      logger.error('e msg', { k: 'e' })

      const d = JSON.parse(debugSpy.mock.calls[0]![0] as string)
      expect(d.level).toBe('DEBUG')

      const w = JSON.parse(warnSpy.mock.calls[0]![0] as string)
      expect(w.level).toBe('WARN')

      const e = JSON.parse(errorSpy.mock.calls[0]![0] as string)
      expect(e.level).toBe('ERROR')

      debugSpy.mockRestore()
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })
})
