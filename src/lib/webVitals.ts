import { onCLS, onFCP, onLCP, onTTFB, onINP, type Metric } from 'web-vitals'
import { getLogger } from './logger'

const logger = getLogger()

function reportWebVital({ name, delta, id }: Metric) {
  logger.info(`[WebVitals] ${name}: ${delta.toFixed(2)} (id=${id})`)
}

/**
 * reportWebVitals
 */
export function reportWebVitals() {
  onCLS(reportWebVital)
  onFCP(reportWebVital)
  onLCP(reportWebVital)
  onTTFB(reportWebVital)
  onINP(reportWebVital)
}
