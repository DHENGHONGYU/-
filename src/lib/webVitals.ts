import { onCLS, onFCP, onLCP, onTTFB, onINP, type Metric } from 'web-vitals'

function reportWebVital({ name, delta, id }: Metric) {
  console.info(`[WebVitals] ${name}: ${delta.toFixed(2)} (id=${id})`)
}

export function reportWebVitals() {
  onCLS(reportWebVital)
  onFCP(reportWebVital)
  onLCP(reportWebVital)
  onTTFB(reportWebVital)
  onINP(reportWebVital)
}
