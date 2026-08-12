/**
 * @fileoverview 输出模块服务 barrel export
 *
 * @module services/output
 * @created 2026-07-15 - 输出模块补强
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
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
