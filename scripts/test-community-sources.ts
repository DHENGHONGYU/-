/**
 * 社区数据源探测 - 第二轮
 * 测试雪球、同花顺、知乎等社区
 *
 * 运行: node ./node_modules/tsx/dist/cli.mjs scripts/test-community-sources.ts
 */

const SYMBOL = '600519'
const STOCK_NAME = '贵州茅台'

const sources = [
  {
    name: '雪球个股热门讨论',
    url: `https://xueqiu.com/query/v1/symbol/search/status.json?symbol=SH${SYMBOL}&count=10&comment=0&hl=0&source=all&sort=alpha`,
    headers: { 'Referer': 'https://xueqiu.com/', 'Cookie': 'xq_a_token=test' },
  },
  {
    name: '雪球搜索API',
    url: `https://xueqiu.com/statuses/search.json?count=10&comment=0&symbol=SH${SYMBOL}&hl=0&source=user&sort=time&page=1`,
    headers: { 'Referer': 'https://xueqiu.com/' },
  },
  {
    name: '同花顺个股评论',
    url: `https://comment.10jqka.com.cn/thscmt/api/comment/list?code=${SYMBOL}&page=1&pagesize=10&type=stock`,
    headers: { 'Referer': 'https://stock.10jqka.com.cn/' },
  },
  {
    name: '东方财富资讯搜索（社区类）',
    url: `https://search-api-web.eastmoney.com/search/jsonp?cb=jQuery&param=%7B%22uid%22%3A%22%22%2C%22keyword%22%3A%22${encodeURIComponent(STOCK_NAME)}%22%2C%22type%22%3A%5B%22gubaArticleWeb%22%5D%2C%22client%22%3A%22web%22%2C%22clientType%22%3A%22web%22%2C%22clientVersion%22%3A%22curr%22%2C%22param%22%3A%7B%22gubaArticleWeb%22%3A%7B%22pageIndex%22%3A1%2C%22pageSize%22%3A10%2C%22preTag%22%3A%22%22%2C%22postTag%22%3A%22%22%7D%7D%7D`,
    headers: { 'Referer': 'https://so.eastmoney.com/' },
  },
  {
    name: '东财股吧热帖（按热度排序HTML）',
    url: `https://guba.eastmoney.com/list,${SYMBOL},f.html`,
    note: 'HTML页面，需要解析',
  },
  {
    name: '新浪财经股吧',
    url: `https://guba.sina.com.cn/?s=bar&name=${SYMBOL}`,
    headers: { 'Referer': 'https://finance.sina.com.cn/' },
  },
]

async function testSource(src: typeof sources[0]) {
  console.log(`\n测试: ${src.name}`)
  if (src.note) console.log(`  说明: ${src.note}`)
  try {
    const resp = await fetch(src.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...src.headers,
      },
    })
    const text = await resp.text()
    console.log(`  状态: ${resp.status}  长度: ${text.length} 字节`)

    // 尝试 JSON
    try {
      const json = JSON.parse(text)
      const findArrays = (obj: any, depth = 0, path = ''): Array<{ path: string; count: number; sample: string }> => {
        if (depth > 5 || !obj || typeof obj !== 'object') return []
        const results: Array<{ path: string; count: number; sample: string }> = []
        for (const [k, v] of Object.entries(obj)) {
          const newPath = path ? `${path}.${k}` : k
          if (Array.isArray(v) && v.length > 0) {
            results.push({ path: newPath, count: v.length, sample: JSON.stringify(v[0]).slice(0, 200) })
          }
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            results.push(...findArrays(v, depth + 1, newPath))
          }
        }
        return results
      }
      const arrs = findArrays(json)
      if (arrs.length > 0) {
        console.log(`  ✅ 找到 ${arrs.length} 个数组:`)
        for (const a of arrs.slice(0, 3)) {
          console.log(`     - ${a.path} (${a.count} items)`)
          console.log(`       样例: ${a.sample}`)
        }
      } else {
        console.log(`  未找到数据数组`)
        console.log(`  前200字: ${JSON.stringify(json).slice(0, 200)}`)
      }
    } catch {
      // JSONP 尝试
      if (text.startsWith('jQuery') || text.startsWith('callback')) {
        const inner = text.replace(/^[^(]+\(/, '').replace(/\)\s*;?\s*$/, '')
        try {
          const json = JSON.parse(inner)
          console.log(`  JSONP 解析成功`)
          console.log(`  keys: ${Object.keys(json).slice(0, 5).join(', ')}`)
          if (json.result) {
            console.log(`  result keys: ${Object.keys(json.result).join(', ')}`)
            for (const [k, v] of Object.entries(json.result)) {
              if (Array.isArray(v) && v.length > 0) {
                console.log(`  ✅ ${k}: ${v.length} items`)
                console.log(`     样例: ${JSON.stringify(v[0]).slice(0, 200)}`)
              }
            }
          }
        } catch {
          console.log(`  JSONP 也解析失败`)
          console.log(`  前200字: ${text.slice(0, 200)}`)
        }
        return
      }
      // HTML
      if (text.startsWith('<!') || text.startsWith('<html')) {
        const titleMatch = text.match(/<title>([^<]+)<\/title>/i)
        console.log(`  HTML: ${titleMatch?.[1] ?? 'unknown'}`)
        // 统计链接数
        const links = text.match(/<a[^>]*href="[^"]*"[^>]*>[^<]{5,}<\/a>/gi)
        console.log(`  链接数: ${links?.length ?? 0}`)
      } else {
        console.log(`  前200字: ${text.slice(0, 200)}`)
      }
    }
    return resp.ok
  } catch (err) {
    console.log(`  ❌ 失败: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('社区数据源探测 - 第二轮')
  console.log('='.repeat(60))

  for (const src of sources) {
    await testSource(src)
  }

  console.log('\n' + '='.repeat(60))
}

main()
