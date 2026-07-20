/**
 * 东方财富股吧 HTML 结构分析
 * 运行: node ./node_modules/tsx/dist/cli.mjs scripts/analyze-guba-html.ts
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
  console.log(`状态: ${resp.status}, 长度: ${text.length}`)

  // 找列表容器
  const listPatterns = ['articleh', 'normal_post', 'post_item', 'listitem', 'article-item']
  for (const p of listPatterns) {
    const count = (text.match(new RegExp(p, 'gi')) || []).length
    if (count > 0) console.log(`  ${p}: ${count} 次`)
  }

  // 提取第一个 articleh 块
  const articleMatch = text.match(/class="articleh"([\s\S]*?)<\/li>/i)
  if (articleMatch) {
    console.log('\n第一个 articleh 块:')
    console.log(articleMatch[1].replace(/\s+/g, ' ').slice(0, 500))
  }

  // 尝试提取所有帖子标题
  const titlePattern = /class="title"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
  let match
  const titles: Array<{ url: string; title: string }> = []
  while ((match = titlePattern.exec(text)) !== null && titles.length < 10) {
    titles.push({ url: match[1], title: match[2].trim() })
  }
  console.log(`\n标题匹配: ${titles.length} 条`)
  titles.slice(0, 5).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.title.slice(0, 50)}`)
    console.log(`     ${t.url}`)
  })

  // 另一种模式：带阅读/评论/点赞数的结构
  const itemPattern = /<span class="([^"]*count[^"]*)"[^>]*>([^<]+)<\/span>/gi
  let m2
  const counts: Record<string, string[]> = {}
  while ((m2 = itemPattern.exec(text)) !== null) {
    const cls = m2[1]
    const val = m2[2].trim()
    if (!counts[cls]) counts[cls] = []
    if (counts[cls].length < 5) counts[cls].push(val)
  }
  console.log(`\n计数字段:`)
  for (const [cls, vals] of Object.entries(counts)) {
    console.log(`  ${cls}: ${vals.join(', ')}`)
  }

  // 找包含阅读量+评论+标题的完整行结构
  // 东财股吧常见结构: 阅读 评论 标题 作者 最后更新
  const rowPattern = /<span[^>]*>(\d+\.?\d*万?)<\/span>\s*<span[^>]*>(\d+\.?\d*万?)<\/span>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?(\d{2}-\d{2}\s\d{2}:\d{2})/gi
  let m3
  const rows: Array<{ read: string; comment: string; url: string; title: string; author: string; date: string }> = []
  while ((m3 = rowPattern.exec(text)) !== null && rows.length < 10) {
    rows.push({
      read: m3[1], comment: m3[2], url: m3[3],
      title: m3[4].trim(), author: m3[5].trim(), date: m3[6]
    })
  }
  console.log(`\n完整行匹配: ${rows.length} 条`)
  if (rows.length > 0) {
    console.log(`  ${"阅读".padEnd(8)} ${"评论".padEnd(6)} ${"标题".padEnd(30)} ${"作者".padEnd(10)} ${"时间".padEnd(12)}`)
    rows.slice(0, 5).forEach(r => {
      console.log(`  ${r.read.padEnd(8)} ${r.comment.padEnd(6)} ${r.title.padEnd(30)} ${r.author.padEnd(10)} ${r.date.padEnd(12)}`)
    })
  }
}

main()
