/**
 * 架构健康度仪表盘服务。
 *
 * 从 `public/health-report.json` 获取由 `scripts/build-health-report.ts`
 * 生成的最新健康报告。
 */

import type { HealthMetric, HealthReport } from '@/types/modules/health.types'

export type { HealthMetric, HealthReport }

const REPORT_URL = '/health-report.json'

/**
 * 从 `public/health-report.json` 获取最新架构健康报告。
 *
 * @returns 解析后的健康报告对象
 * @throws 当 fetch 失败或返回非 200 时抛出错误
 */
export async function fetchHealthReport(): Promise<HealthReport> {
  const response = await fetch(REPORT_URL, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`获取健康报告失败: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as HealthReport
}
