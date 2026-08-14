import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { collectDesignTokens, verifyDesignTokens, verifyDesignTokensOnReady } from './designTokenVerifier'

const VALID_LIGHT_TOKENS: Record<string, string> = {
  '--primary': '210 100% 50%',
  '--background': '240 24% 96%',
  '--card': '0 0% 100%',
  '--foreground': '240 3% 12%',
  '--stock-up': '0 84% 60%',
  '--stock-down': '142 56% 49%',
  '--stock-neutral': '240 2% 57%',
  '--radius': '1rem',
  '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
  '--shadow-md': '0 2px 6px -1px rgba(0, 0, 0, 0.05)',
  '--shadow-lg': '0 8px 24px -8px rgba(0, 0, 0, 0.08)',
  '--fs-display': '1.75rem',
  '--fs-h1': '1.5rem',
  '--fs-body': '0.875rem',
  '--tracking-cjk-heading': '0em',
}

const VALID_DARK_TOKENS: Record<string, string> = {
  ...VALID_LIGHT_TOKENS,
  '--primary': '210 100% 60%',
  '--background': '240 3% 10%',
  '--card': '240 3% 14%',
}

function mockElement(tokens: Record<string, string>, isDark = false): HTMLElement {
  const el = document.createElement('div')
  if (isDark) el.classList.add('dark')
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: (key: string) => tokens[key] ?? '',
  } as unknown as CSSStyleDeclaration)
  return el
}

describe('designTokenVerifier', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true)
    vi.spyOn(window, 'getComputedStyle').mockRestore?.()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  describe('collectDesignTokens', () => {
    it('light 模式下所有令牌正确时 passed=true', () => {
      const el = mockElement(VALID_LIGHT_TOKENS)
      const result = collectDesignTokens(el)

      expect(result.theme).toBe('light')
      expect(result.tokens['--primary']).toBe('210 100% 50%')
      expect(result.missing).toEqual([])
      expect(result.mismatched).toEqual([])
      expect(result.legacyFound).toEqual([])
      expect(result.passed).toBe(true)
    })

    it('dark 模式下正确识别主题并使用 dark 期望值', () => {
      const el = mockElement(VALID_DARK_TOKENS, true)
      const result = collectDesignTokens(el)

      expect(result.theme).toBe('dark')
      expect(result.expected['--primary']).toBe('210 100% 60%')
      expect(result.expected['--background']).toBe('240 3% 10%')
      expect(result.passed).toBe(true)
    })

    it('缺失令牌时 missing 数组包含缺失的 key', () => {
      const incompleteTokens = { ...VALID_LIGHT_TOKENS, '--radius': '', '--fs-h1': '' }
      const el = mockElement(incompleteTokens)
      const result = collectDesignTokens(el)

      expect(result.missing).toContain('--radius')
      expect(result.missing).toContain('--fs-h1')
      expect(result.missing).toHaveLength(2)
      expect(result.passed).toBe(false)
    })

    it('核心令牌不匹配期望值时 mismatched 包含对应 key', () => {
      const mismatchedTokens = { ...VALID_LIGHT_TOKENS, '--primary': '200 50% 50%' }
      const el = mockElement(mismatchedTokens)
      const result = collectDesignTokens(el)

      expect(result.mismatched).toContain('--primary')
      expect(result.mismatched).toHaveLength(1)
      expect(result.passed).toBe(false)
    })

    it('旧版令牌存在时 legacyFound 包含对应 key', () => {
      const tokensWithLegacy = {
        ...VALID_LIGHT_TOKENS,
        '--color-primary': '#007AFF',
        '--spacing-1': '4px',
      }
      const el = mockElement(tokensWithLegacy)
      const result = collectDesignTokens(el)

      expect(result.legacyFound).toContain('--color-primary')
      expect(result.legacyFound).toContain('--spacing-1')
      expect(result.legacyFound).toHaveLength(2)
      expect(result.passed).toBe(false)
    })

    it('旧版令牌全部为空时 legacyFound 为空数组', () => {
      const el = mockElement(VALID_LIGHT_TOKENS)
      const result = collectDesignTokens(el)

      expect(result.legacyTokens['--color-primary']).toBe('')
      expect(result.legacyTokens['--fontSize-body']).toBe('')
      expect(result.legacyFound).toEqual([])
    })

    it('多种异常同时存在时 passed=false', () => {
      const multiErrorTokens = {
        ...VALID_LIGHT_TOKENS,
        '--primary': 'wrong',
        '--shadow-lg': '',
        '--color-secondary': '#500',
      }
      const el = mockElement(multiErrorTokens)
      const result = collectDesignTokens(el)

      expect(result.mismatched).toContain('--primary')
      expect(result.missing).toContain('--shadow-lg')
      expect(result.legacyFound).toContain('--color-secondary')
      expect(result.passed).toBe(false)
    })

    it('默认使用 document.documentElement', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        getPropertyValue: (key: string) => VALID_LIGHT_TOKENS[key] ?? '',
      } as unknown as CSSStyleDeclaration)

      const result = collectDesignTokens()
      expect(result.theme).toBe('light')
      expect(result.passed).toBe(true)
    })

    it('采集全部 15 个 V5 令牌', () => {
      const el = mockElement(VALID_LIGHT_TOKENS)
      const result = collectDesignTokens(el)

      expect(Object.keys(result.tokens)).toHaveLength(15)
      expect(result.tokens['--stock-up']).toBe('0 84% 60%')
      expect(result.tokens['--fs-display']).toBe('1.75rem')
      expect(result.tokens['--tracking-cjk-heading']).toBe('0em')
    })

    it('采集全部 4 个旧版令牌', () => {
      const el = mockElement(VALID_LIGHT_TOKENS)
      const result = collectDesignTokens(el)

      expect(Object.keys(result.legacyTokens)).toHaveLength(4)
      expect(result.legacyTokens).toHaveProperty('--color-primary')
      expect(result.legacyTokens).toHaveProperty('--color-secondary')
      expect(result.legacyTokens).toHaveProperty('--spacing-1')
      expect(result.legacyTokens).toHaveProperty('--fontSize-body')
    })
  })

  describe('verifyDesignTokens', () => {
    it('DEV=false 时直接返回空结果，不输出日志', () => {
      vi.stubEnv('DEV', false)
      const loggerSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = verifyDesignTokens()

      expect(result.passed).toBe(true)
      expect(result.tokens).toEqual({})
      expect(loggerSpy).not.toHaveBeenCalled()
    })

    it('DEV=true 且验证通过时输出 info 日志', () => {
      mockElement(VALID_LIGHT_TOKENS)
      const infoSpy = vi.fn()
      const warnSpy = vi.fn()
      vi.doMock('@/lib/logger', () => ({
        getLogger: () => ({ info: infoSpy, warn: warnSpy, debug: vi.fn(), error: vi.fn() }),
      }))

      // 由于 doMock 需要重新导入，这里直接 spy console
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const warnSpy2 = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = verifyDesignTokens()

      expect(result.passed).toBe(true)
      // verifyDesignTokens 内部通过 getLogger 输出，logger 默认走 console.log
      expect(logSpy.mock.calls.length).toBeGreaterThan(0)

      logSpy.mockRestore()
      warnSpy2.mockRestore()
    })

    it('DEV=true 且验证失败时输出 warn 日志', () => {
      mockElement({ ...VALID_LIGHT_TOKENS, '--primary': 'wrong' })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = verifyDesignTokens()

      expect(result.passed).toBe(false)
      expect(result.mismatched).toContain('--primary')
      expect(warnSpy.mock.calls.length).toBeGreaterThan(0)

      warnSpy.mockRestore()
    })

    it('返回与 collectDesignTokens 一致的结果', () => {
      mockElement(VALID_LIGHT_TOKENS)
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = verifyDesignTokens()
      const direct = collectDesignTokens()

      expect(result.theme).toBe(direct.theme)
      expect(result.tokens).toEqual(direct.tokens)
      expect(result.passed).toBe(direct.passed)
    })
  })

  describe('verifyDesignTokensOnReady', () => {
    it('DEV=false 时不执行任何操作', () => {
      vi.stubEnv('DEV', false)
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      verifyDesignTokensOnReady()

      expect(addEventListenerSpy).not.toHaveBeenCalled()
    })

    it('DOM loading 时注册 DOMContentLoaded 事件', () => {
      vi.stubEnv('DEV', true)
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: () => 'loading',
      })
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      verifyDesignTokensOnReady()

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function),
        { once: true },
      )

      addEventListenerSpy.mockRestore()
    })

    it('DOM complete 时直接执行验证', () => {
      vi.stubEnv('DEV', true)
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: () => 'complete',
      })
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      mockElement(VALID_LIGHT_TOKENS)

      verifyDesignTokensOnReady()

      expect(addEventListenerSpy).not.toHaveBeenCalled()
      expect(logSpy.mock.calls.length).toBeGreaterThan(0)

      addEventListenerSpy.mockRestore()
      logSpy.mockRestore()
    })
  })
})
