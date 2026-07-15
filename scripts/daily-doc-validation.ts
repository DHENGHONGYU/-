/**
 * @module scripts/daily-doc-validation
 * @description 每日文档验证流程（最小存根）
 */

import { createHash } from 'node:crypto'
import type {
  DimensionSummary,
  MaterialCategory,
  ValidationDimension,
  ValidationFinding,
  ValidationStatus,
} from '../src/types/modules/doc-validation.types'

export function formatTimestampSeconds(date: Date): string {
  return date.toISOString().replace(/\..+/, 'Z')
}

export function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

export function classifyFile(relativePath: string): MaterialCategory {
  const lowerPath = relativePath.toLowerCase()

  if (
    /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(relativePath) ||
    /\/__tests__\//.test(relativePath) ||
    /\/__mocks__\//.test(relativePath)
  ) {
    return 'test'
  }

  if (lowerPath.startsWith('docs/')) {
    return 'doc'
  }

  if (
    lowerPath.startsWith('scripts/') ||
    lowerPath.startsWith('.github/workflows/') ||
    /\.(sh|ps1|py|cjs|mjs)$/i.test(relativePath)
  ) {
    return 'script'
  }

  if (
    /\.config\.(js|ts|cjs|mjs|json)$/i.test(relativePath) ||
    /^tsconfig/.test(relativePath) ||
    /^eslint/.test(relativePath) ||
    /^vite\.config/.test(relativePath) ||
    /^playwright\.config/.test(relativePath) ||
    /^postcss\.config/.test(relativePath) ||
    /^cspell\.json$/.test(relativePath) ||
    /^\.env/.test(relativePath) ||
    /\.rc\.json$/i.test(relativePath)
  ) {
    return 'config'
  }

  if (/\.(ts|tsx|js|jsx|vue|py|cjs|mjs)$/i.test(relativePath)) {
    return 'code'
  }

  return 'other'
}

export function determineOverallStatus(findings: readonly ValidationFinding[]): ValidationStatus {
  if (findings.some((f) => f.status === 'failure')) return 'failure'
  if (findings.some((f) => f.status === 'warning')) return 'warning'
  return 'pass'
}

export function buildDimensionSummary(
  dimension: ValidationDimension,
  findings: readonly ValidationFinding[],
  scannedCount: number,
): DimensionSummary {
  const dimensionFindings = findings.filter((f) => f.dimension === dimension)
  return {
    dimension,
    scannedCount,
    passCount: Math.max(0, scannedCount - dimensionFindings.length),
    warningCount: dimensionFindings.filter((f) => f.status === 'warning').length,
    failureCount: dimensionFindings.filter((f) => f.status === 'failure').length,
  }
}
