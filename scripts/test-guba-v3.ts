/**
 * 股吧解析 v3 - 基于表格行
 * 运行: node ./node_modules/tsx/dist/cli.mjs scripts/test-guba-v3.ts
 */

const SYMBOL = '600519'

async function fetchGubaPosts(code: string): Promise<any[]> {
  const url = `https://guba.eastmoney.com/list,${code},f.html`
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://guba.eastmoney.com/',
    },
  })
  if (!resp.ok) return []
  const text = await resp.text()

  const items: any[] = []

  // 表格行: <tr class="listitem"><td><div class="read">129</div></td><td><div class="reply">1</div></td><td><div class="title"><a href="...">标题</a></div></td><td><div class="author"><a>作者</a></div></td><td><div class="update">07-19 09:47</div></td></tr>
  const rowPattern = /<tr[^>]*class="[^"]*listitem[^"]*"[^>]*>[\s\S]*?<div class="read">([^<]+)<\/div>[\s\S]*?<div class="reply">([^<]+)<\/div>[\s\S]*?<div class="title">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<\/div>[\s\S]*?<div class="author">[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/div>[\s\S]*?<div class="update">([^<]+)<\/div>[\s\S]*?<\/tr>/gi

  let m
  while ((m = rowPattern.exec(text)) !== null && items.length < 15) {
    const title = m[4].trim()
    if (!title || title.length < 5) continue

    const dateStr = m[6].trim()
    // 格式: 07-19 09:47 或 07-19
    let fullDate = ''
    if (dateStr.includes('-')) {
      fullDate = `2026-${dateStr.slice(0, 5)}`
    }

    items.push({
      title,
      url: `https://guba.eastmoney.com${m[3]}`,
      author: m[5].trim(),
      views: m[1].trim(),
      comments: m[2].trim(),
      date: fullDate || new Date().toISOString().slice(0, 10),
      updateTime: dateStr,
    })
  }

  return items
}

async function main() {
  const stocks = [
    { code: '600519', name: '贵州茅台' },
    { code: '300750', name: '宁德时代' },
    { code: '601318', name: '中国平安' },
    { code: '000001', name: '平安银行' },
    { code: '000858', name: '五粮液' },
  ]

  console.log('='.repeat(80))
  console.log('东财股吧解析测试 v3')
  console.log('='.repeat(80))

  let allPass = true
  for (const stock of stocks) {
    const items = await fetchGubaPosts(stock.code)
    const ok = items.length >= 5
    if (!ok) allPass = false
    console.log(`\n[${stock.name}] ${ok ? '✅' : '❌'} ${items.length} 条`)
    if (items.length > 0) {
      console.log(`  ${"阅读".padEnd(8)} ${"评论".padEnd(6)} ${"作者".padEnd(10)} ${"更新".padEnd(12)} 标题`)
      items.slice(0, 3).forEach(item => {
        console.log(`  ${item.views.padEnd(8)} ${item.comments.padEnd(6)} ${item.author.padEnd(10)} ${item.updateTime.padEnd(12)} ${item.title.slice(0, 40)}`)
      })
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log(allPass ? '✅ 全部股票解析成功' : '⚠️ 部分股票解析不足')
  console.log('='.repeat(80))
}

main()
