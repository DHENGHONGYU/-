/**
 * 东方财富股吧数据探测
 * 测试股吧热门帖 API
 *
 * 运行: node ./node_modules/tsx/dist/cli.mjs scripts/test-guba-api.ts
 */

const SYMBOL = '600519'

const sources = [
  {
    name: '股吧热门帖列表API',
    url: `https://guba.eastmoney.com/interface/GetData.aspx?path=topiclist&param=code%3D${SYMBOL}%26type%3D1%26p%3D1%26ps%3D20`,
  },
  {
    name: '股吧个股主页API',
    url: `https://guba.eastmoney.com/list,${SYMBOL}_1.html`,
  },
  {
    name: '东财互动问答API',
    url: `https://irm.cninfo.com.cn/new/irSearch/search?code=${SYMBOL}&pageNo=1&pageSize=10&type=1`,
  },
  {
    name: '股吧热帖排序API',
    url: `https://guba.eastmoney.com/interface/GetData.aspx?path=hottopic&param=code%3D${SYMBOL}%26p%3D1%26ps%3D20`,
  },
]

async function testSource(src: typeof sources[0]) {
  console.log(`\n测试: ${src.name}`)
  console.log(`  URL: ${src.url.slice(0, 80)}...`)
  try {
    const resp = await fetch(src.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://guba.eastmoney.com/',
        'Accept': 'application/json, text/plain, */*',
      },
    })
    const text = await resp.text()
    console.log(`  状态: ${resp.status}  长度: ${text.length} 字节`)

    try {
      const json = JSON.parse(text)
      // 找数组
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
        console.log(`  前300字: ${JSON.stringify(json).slice(0, 300)}`)
      }
    } catch {
      // 可能是 HTML
      if (text.startsWith('<!') || text.startsWith('<html')) {
        const titleMatch = text.match(/<title>([^<]+)<\/title>/i)
        console.log(`  HTML 页面: ${titleMatch?.[1] ?? 'unknown'}`)
        // 尝试提取帖子列表
        const postMatches = text.match(/class="articleh"[\s\S]*?<\/li>/gi)
        if (postMatches) {
          console.log(`  找到 ${postMatches.length} 个帖子条目`)
          if (postMatches.length > 0) {
            const first = postMatches[0].replace(/\s+/g, ' ')
            console.log(`  第一个: ${first.slice(0, 200)}`)
          }
        }
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
  console.log('东方财富股吧数据源探测')
  console.log('='.repeat(60))

  for (const src of sources) {
    await testSource(src)
  }

  console.log('\n' + '='.repeat(60))
}

main()
