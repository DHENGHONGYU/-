/**
 * 股吧 HTML 结构深度分析
 * 运行: node ./node_modules/tsx/dist/cli.mjs scripts/analyze-guba2.ts
 */

const SYMBOL = '600519'

async function main() {
  const url = `https://guba.eastmoney.com/list,${SYMBOL},f.html`
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://guba.eastmoney.com/',
    },
  })
  const text = await resp.text()
  console.log(`长度: ${text.length}`)

  // 找所有包含链接的帖子结构
  // 尝试多种模式
  const patterns = [
    { name: 'listitem li', pat: /<li[^>]*class="[^"]*listitem[^"]*"[^>]*>([\s\S]*?)<\/li>/gi, count: 0 },
    { name: 'articleh li', pat: /<li[^>]*class="[^"]*articleh[^"]*"[^>]*>([\s\S]*?)<\/li>/gi, count: 0 },
    { name: 'articleh div', pat: /<div[^>]*class="[^"]*articleh[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, count: 0 },
    { name: 'l3 class', pat: /class="l3"[^>]*>([\s\S]*?)<\/span>/gi, count: 0 },
    { name: 'title a标签', pat: /<a[^>]*href="(\/news,\d+,[^"]+)"[^>]*>([^<]{5,})<\/a>/gi, count: 0 },
  ]

  for (const p of patterns) {
    const matches = text.match(p.pat)
    p.count = matches?.length ?? 0
    console.log(`  ${p.name}: ${p.count} 个`)
  }

  // 详细分析 title a标签
  const titlePat = /<a[^>]*href="(\/news,\d+,[^"]+)"[^>]*>([^<]{5,})<\/a>/gi
  let m
  const items: Array<{ url: string; title: string }> = []
  while ((m = titlePat.exec(text)) !== null && items.length < 20) {
    items.push({ url: m[1], title: m[2].trim() })
  }
  console.log(`\n前10条帖子标题:`)
  items.slice(0, 10).forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.title.slice(0, 50)}`)
    console.log(`     ${item.url}`)
  })

  // 尝试找帖子行的完整结构
  // 东财股吧列表通常是: 阅读数 | 评论数 | 标题 | 作者 | 最后更新
  const rowPat = /<span[^>]*class="[^"]*l1[^"]*"[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*class="[^"]*l2[^"]*"[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*class="[^"]*l3[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*l4[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*l5[^"]*"[^>]*>([^<]+)<\/span>/gi
  let row
  const rows: any[] = []
  while ((row = rowPat.exec(text)) !== null && rows.length < 10) {
    const titleMatch = row[3].match(/<a[^>]*>([^<]+)<\/a>/)
    const authorMatch = row[4].match(/<a[^>]*>([^<]+)<\/a>/)
    rows.push({
      read: row[1].trim(),
      comment: row[2].trim(),
      title: titleMatch ? titleMatch[1].trim() : row[3].replace(/<[^>]+>/g, '').trim(),
      author: authorMatch ? authorMatch[1].trim() : row[4].replace(/<[^>]+>/g, '').trim(),
      date: row[5].trim(),
    })
  }
  console.log(`\n结构化行匹配: ${rows.length} 条`)
  if (rows.length > 0) {
    console.log(`  ${"阅读".padEnd(8)} ${"评论".padEnd(6)} ${"标题".padEnd(30)} ${"作者".padEnd(10)} ${"时间".padEnd(12)}`)
    rows.slice(0, 5).forEach(r => {
      console.log(`  ${r.read.padEnd(8)} ${r.comment.padEnd(6)} ${r.title.padEnd(30)} ${r.author.padEnd(10)} ${r.date.padEnd(12)}`)
    })
  }
}

main()
