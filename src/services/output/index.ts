/**
 * @fileoverview 输出模块服务 barrel export
 *
 * @module services/output
 * @created 2026-07-15 - 输出模块补强
 */

export {
  identifyMarketCycle,
  generatePrediction,
  verifyPrediction,
  computeFactorICs,
} from './predictionVerifier'

export {
  generateRetrospectiveReport,
  formatReportAsMarkdown,
} from './cycleRetrospective'

export { buildDashboardData } from './factorDashboard'
