/**
 * @fileoverview 网易历史 K 线 Provider
 *
 * 从 directDataAPI.ts 拆分：
 * - neteaseHistory: 历史 K 线 CSV 获取
 * - parseNeteaseCsv: CSV 解析
 */

import {
  NETEASE_API_BASE,
} from '@/config/marketDataEndpoints'
import {
  type KlineItem,
  DirectDataAPIError,
  getNeteaseCode,
  safeNumber,
  fetchWithTimeout,
  isAbortError,
  logger,
} from './directDataAPIError'

/**
 * 网易历史 K 线（CSV 格式）
 * URL: https://quotes.163.com/service/chddata.html?code=0600519&start=20240101&end=20240601
 *
 * CSV 列顺序（按请求 fields 顺序）：
 *  [0]日期 [1]股票代码 [2]名称 [3]收盘价 [4]最高价 [5]最低价
 *  [6]开盘价 [7]成交量 [8]成交金额
 */
export async function neteaseHistory(code: string, start: string, end: string): Promise<KlineItem[]> {
  const startTs = Date.now()

  try {
    const neteaseCode = getNeteaseCode(code)
    const url = `${NETEASE_API_BASE}/service/chddata.html?code=${neteaseCode}&start=${start}&end=${end}&fields=TCLOSE;HIGH;LOW;TOPEN;VOTURNOVER;VATURNOVER`
    logger.info('[directDataAPI] neteaseHistory start', { code, start, end, url })
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new DirectDataAPIError(`HTTP ${response.status}`, 'netease')
    }
    const text = await response.text()
    const latency = Date.now() - startTs
    logger.info('[directDataAPI] neteaseHistory parsed', { code, latency })

    return parseNeteaseCsv(text, code)
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] neteaseHistory failed', {
      code, latency, aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err instanceof DirectDataAPIError
      ? err
      : new DirectDataAPIError(aborted ? '网易历史请求超时' : '网易历史请求失败', 'netease', err)
  }
}

export function parseNeteaseCsv(text: string, code: string): KlineItem[] {
  try {
    const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    if (lines.length < 2) {
      logger.warn('[directDataAPI] parseNeteaseCsv: no data rows', { code, lineCount: lines.length })
      return []
    }
    logger.info('[directDataAPI] parseNeteaseCsv header', { code, header: lines[0] })

    const items: KlineItem[] = []
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i]!.split(',')
      const dateCell = row[0] ?? ''
      if (!dateCell || dateCell.trim() === '') continue
      items.push({
        date: dateCell.trim(),
        close: safeNumber(row[3]),
        high: safeNumber(row[4]),
        low: safeNumber(row[5]),
        open: safeNumber(row[6]),
        volume: safeNumber(row[7]),
        amount: safeNumber(row[8]),
        source: 'netease',
      })
    }
    logger.info('[directDataAPI] parseNeteaseCsv done', { code, count: items.length })
    return items
  } catch (err) {
    logger.warn('[directDataAPI] parseNeteaseCsv exception', {
      code, error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
