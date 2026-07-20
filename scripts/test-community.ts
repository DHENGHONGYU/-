/**
 * 维度 09 社区精选测试
 * 测试股吧爬虫 + 验证解析逻辑
 *
 * 运行: node ./node_modules/tsx/dist/cli.mjs scripts/test-community.ts
 */

function extractSixDigitCode(code: string): string {
  return code.replace(/\.(SH|SZ|BJ)$/i, '')
}

async function fetchEastMoneyGuba(symbol: string): Promise<any[]> {
  const code = extractSixDigitCode(symbol)
  const url = `https://guba.eastmoney.com/list,${code},f.html`

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://guba.eastmoney.com/',
      },
    })
    if (!resp.ok) return []
    const text = await resp.text()

    const items: any[] = []

    // 提取所有 listitem 行
    const rowPattern = /class="listitem"[^>]*>([\s\S]*?)<\/li>/gi
    let match: RegExpExecArray | null

    while ((match = rowPattern.exec(text)) !== null && items.length < 15) {
      const row = match[1]

      // 提取标题和链接
      const titleMatch = row.match(/<a[^>]*href="(\/news,[^"]+)"[^>]*>([^<]+)<\/a>/)
      if (!titleMatch) continue

      const title = titleMatch[2].trim()
      const urlPath = titleMatch[1]
      if (!title || title.length < 5) continue

      // 提取作者
      const authorMatch = row.match(/<a[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/a>/i)
        || row.match(/<span[^>]*class="[^"]*l4[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
      const author = authorMatch ? authorMatch[1].trim() : '匿名'

      // 提取时间
      const dateMatch = row.match(/(\d{2}-\d{2}\s\d{2}:\d{2})/)
      const dateStr = dateMatch ? dateMatch[1] : ''

      items.push({
        title,
        author: author.replace(/<[^>]+>/g, '').trim() || '匿名',
        date: dateStr ? `2026-${dateStr.slice(0, 2)}-${dateStr.slice(3, 5)}` : new Date().toISOString().slice(0, 10),
        url: `https://guba.eastmoney.com${urlPath}`,
      })
    }

    return items
  } catch (err) {
    console.error('  错误:', err instanceof Error ? err.message : String(err))
    return []
  }
}

async function main() {
  console.log('='.repeat(70))
  console.log('维度 09 社区精选 - 股吧爬虫测试')
  console.log('='.repeat(70))

  const stocks = [
    { code: '600519.SH', name: '贵州茅台' },
    { code: '300750.SZ', name: '宁德时代' },
    { code: '601318.SH', name: '中国平安' },
  ]

  let allPass = true

  for (const stock of stocks) {
    console.log(`\n[${stock.name}] (${stock.code})`)
    const items = await fetchEastMoneyGuba(stock.code)
    const ok = items.length > 0
    if (!ok) allPass = false
    console.log(`  ${ok ? '✅' : '❌'} 解析到 ${items.length} 条帖子`)
    if (items.length > 0) {
      items.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i + 1}. [${item.date}] ${item.title.slice(0, 50)}${item.title.length > 50 ? '...' : ''}`)
        console.log(`     作者: ${item.author}`)
      })
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log(allPass ? '✅ 股吧爬虫全部工作正常' : '❌ 部分股票解析失败')
  console.log('='.repeat(70))
  process.exit(allPass ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
