import { getLogger } from '@/lib/logger'

const V5_TOKEN_KEYS = [
  '--primary', '--background', '--card', '--foreground',
  '--stock-up', '--stock-down', '--stock-neutral',
  '--radius', '--shadow-sm', '--shadow-md', '--shadow-lg',
  '--fs-display', '--fs-h1', '--fs-body', '--tracking-cjk-heading',
] as const

const LEGACY_TOKEN_KEYS = [
  '--color-primary', '--color-secondary', '--spacing-1', '--fontSize-body',
] as const

const EXPECTED_LIGHT: Record<string, string> = {
  '--primary': '210 100% 50%',
  '--background': '240 24% 96%',
  '--card': '0 0% 100%',
}
const EXPECTED_DARK: Record<string, string> = {
  '--primary': '210 100% 60%',
  '--background': '240 3% 10%',
  '--card': '240 3% 14%',
}

const COMPARE_KEYS = ['--primary', '--background', '--card'] as const

const TOKEN_PAD_SHORT = 14
const TOKEN_PAD_MEDIUM = 18
const TOKEN_PAD_LONG = 24
const MISSING_MARKER = '❌ MISSING'

export interface TokenVerificationResult {
  theme: 'light' | 'dark'
  tokens: Record<string, string>
  legacyTokens: Record<string, string>
  expected: Record<string, string>
  missing: string[]
  mismatched: string[]
  legacyFound: string[]
  passed: boolean
}

export function collectDesignTokens(el: Element = document.documentElement): TokenVerificationResult {
  const styles = getComputedStyle(el)
  const isDark = el.classList.contains('dark')
  const expected = isDark ? EXPECTED_DARK : EXPECTED_LIGHT

  const tokens: Record<string, string> = {}
  for (const key of V5_TOKEN_KEYS) {
    tokens[key] = styles.getPropertyValue(key).trim()
  }

  const legacyTokens: Record<string, string> = {}
  for (const key of LEGACY_TOKEN_KEYS) {
    legacyTokens[key] = styles.getPropertyValue(key).trim()
  }

  const missing = V5_TOKEN_KEYS.filter((k) => tokens[k] === '')
  const mismatched = COMPARE_KEYS.filter((k) => tokens[k] !== '' && tokens[k] !== expected[k])
  const legacyFound = LEGACY_TOKEN_KEYS.filter((k) => legacyTokens[k] !== '')

  return {
    theme: isDark ? 'dark' : 'light',
    tokens,
    legacyTokens,
    expected,
    missing: [...missing],
    mismatched: [...mismatched],
    legacyFound: [...legacyFound],
    passed: missing.length === 0 && mismatched.length === 0 && legacyFound.length === 0,
  }
}

export function verifyDesignTokens(el?: Element): TokenVerificationResult {
  if (!import.meta.env.DEV) {
    return { theme: 'light', tokens: {}, legacyTokens: {}, expected: {}, missing: [], mismatched: [], legacyFound: [], passed: true }
  }

  const result = collectDesignTokens(el)
  const logger = getLogger()

  logger.info(`[TokenVerify] ═══ V5 Apple Business Design Tokens 加载验证 ═══`)
  logger.info(`[TokenVerify] 主题模式: ${result.theme}`)

  logger.info(`[TokenVerify] ── 核心色彩令牌 ──`)
  const labels: Record<string, string> = { '--primary': 'Apple Blue', '--background': '背景色', '--card': '卡片色' }
  for (const key of COMPARE_KEYS) {
    const actual = result.tokens[key]
    const expect = result.expected[key]
    const match = actual === expect
    logger.info(`[TokenVerify]   ${key.padEnd(14)} ${(labels[key] ?? '').padEnd(10)} 实际="${actual}" 期望="${expect}" ${match ? '✅' : '⚠ 不匹配'}`)
  }

  logger.info(`[TokenVerify] ── A 股涨跌色（红涨绿跌，豁免主题） ──`)
  for (const key of ['--stock-up', '--stock-down', '--stock-neutral']) {
    logger.info(`[TokenVerify]   ${key.padEnd(TOKEN_PAD_MEDIUM)} "${result.tokens[key] !== '' ? result.tokens[key] : MISSING_MARKER}"`)
  }

  logger.info(`[TokenVerify] ── 圆角与层级阴影 ──`)
  for (const key of ['--radius', '--shadow-sm', '--shadow-md', '--shadow-lg']) {
    logger.info(`[TokenVerify]   ${key.padEnd(TOKEN_PAD_SHORT)} "${result.tokens[key] !== '' ? result.tokens[key] : MISSING_MARKER}"`)
  }

  logger.info(`[TokenVerify] ── 排版字号 / 字距 ──`)
  for (const key of ['--fs-display', '--fs-h1', '--fs-body', '--tracking-cjk-heading']) {
    logger.info(`[TokenVerify]   ${key.padEnd(TOKEN_PAD_LONG)} "${result.tokens[key] !== '' ? result.tokens[key] : MISSING_MARKER}"`)
  }

  logger.info(`[TokenVerify] ── 旧版令牌残留检测（应全部为空） ──`)
  if (result.legacyFound.length === 0) {
    logger.info(`[TokenVerify]   ✅ 全部 ${LEGACY_TOKEN_KEYS.length} 个旧版令牌均为空，清理彻底`)
  } else {
    for (const key of result.legacyFound) {
      logger.warn(`[TokenVerify]   ⚠ ${key}="${result.legacyTokens[key]}" 旧版令牌仍存在！`)
    }
  }

  if (result.passed) {
    logger.info(`[TokenVerify] ═══ ✅ V5 令牌加载验证全部通过（${V5_TOKEN_KEYS.length} 项） ═══`)
  } else {
    logger.warn(`[TokenVerify] ═══ ⚠ 验证存在异常：缺失 ${result.missing.length} 项 / 不匹配 ${result.mismatched.length} 项 / 旧版残留 ${result.legacyFound.length} 项 ═══`)
  }

  return result
}

export function verifyDesignTokensOnReady(): void {
  if (!import.meta.env.DEV) return
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => verifyDesignTokens(), { once: true })
  } else {
    verifyDesignTokens()
  }
}
