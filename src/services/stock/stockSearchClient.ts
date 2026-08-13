/**
 * 腾讯 Smartbox 搜索 API 客户端
 *
 * @description
 * 封装腾讯 Smartbox 股票搜索建议 API 的调用。
 * 作为 FullMarketStockService 的在线回退层（Layer 2），
 * 当本地字典匹配结果不足时，通过 Smartbox API 在线补充。
 *
 * 端点：https://smartbox.gtimg.cn/s3/?v=2&q={keyword}&t=all
 * CORS：经 Vite proxy `/api/proxy/smartbox` 转发
 *
 * @module services/stock/stockSearchClient
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { API_PROXY_SMARTBOX } from '@/config/apiPaths'

const logger = getLogger()

/** Smartbox API 代理路径（Vite proxy 配置） */
const SMARTBOX_PROXY = API_PROXY_SMARTBOX

/** Smartbox 返回的单条股票信息 */
interface SmartboxItem {
  /** 交易所缩写：sh / sz / hk */
  market: string
  /** 股票代码（不含交易所前缀） */
  code: string
  /** 股票名称 */
  name: string
  /** 拼音缩写 */
  pinyin: string
  /** 类型：GP-A（A股）/ GP（港股/普通股）/ ZS（指数）/ QZ（权证）*/
  type: string
}

/**
 * 解析 Smartbox pipe 分隔的原始响应
 * 格式：v_hint="sh~600519~贵州茅台~gzmt~GP-A^sz~000001~平安银行~payh~GP-A"
 */
function parseSmartboxResponse(raw: string): SmartboxItem[] {
  // 提取 v_hint="..." 中的内容
  const match = raw.match(/v_hint="([^"]+)"/)
  if (!match?.[1]) return []

  const items: SmartboxItem[] = []
  const segments = match[1].split('^')

  for (const seg of segments) {
    const parts = seg.split('~')
    if (parts.length >= 5) {
      // 只保留 GP-A（A股）和 GP（港股/普通股）
      const type = parts[4]!
      if (type === 'GP-A' || type === 'GP') {
        items.push({
          market: parts[0]!,
          code: parts[1]!,
          name: parts[2]!,
          pinyin: parts[3]!,
          type,
        })
      }
    }
  }

  return items
}

/**
 * 通过腾讯 Smartbox API 搜索股票
 *
 * @param keyword 搜索关键词（代码或名称）
 * @param maxResults 最大返回条数，默认 20
 * @returns 匹配的股票列表
 */
export async function searchViaSmartbox(
  keyword: string,
  maxResults = 20,
): Promise<Array<{ symbol: string; name: string; market: string }>> {
  const trimmed = keyword.trim()
  if (!trimmed) return []

  try {
    const url = `${SMARTBOX_PROXY}?v=2&q=${encodeURIComponent(trimmed)}&t=all`
    const response = await fetch(url)
    if (!response.ok) {
      logger.warn('[stockSearchClient] Smartbox API 请求失败', {
        status: response.status,
        keyword: trimmed,
      })
      return []
    }

    const text = await response.text()
    const items = parseSmartboxResponse(text)

    logger.info('[stockSearchClient] Smartbox API 返回', {
      keyword: trimmed,
      rawCount: items.length,
    })

    return items.slice(0, maxResults).map((item) => {
      // market: sh → SH, sz → SZ, hk → HK
      const market = item.market.toUpperCase()
      return {
        symbol: item.code,
        name: item.name,
        market,
      }
    })
  } catch (err) {
    logger.warn('[stockSearchClient] Smartbox API 异常', {
      error: err instanceof Error ? err.message : String(err),
      keyword: trimmed,
    })
    return []
  }
}
