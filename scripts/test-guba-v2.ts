/**
 * 优化股吧解析 - 基于链接上下文提取
 * 运行: node ./node_modules/tsx/dist/cli.mjs scripts/test-guba-v2.ts
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

  // 方式：找到每个帖子链接，然后向前找阅读数和评论数
  const linkPattern = /<a[^>]*href="(\/news,\d+,[^"]+)"[^>]*>([^<]{5,})<\/a>/gi
  let m
  const posts: Array<{ title: string; url: string; context: string }> = []
  
  while ((m = linkPattern.exec(text)) !== null && posts.length < 20) {
    const linkPos = m.index
    // 向前找 200 字符内的数字（阅读/评论数）
    const beforeContext = text.slice(Math.max(0, linkPos - 300), linkPos)
    posts.push({
      title: m[2].trim(),
      url: m[1],
      context: beforeContext.replace(/\s+/g, ' ').slice(-150),
    })
  }

  console.log(`找到 ${posts.length} 条帖子\n`)
  
  // 分析第一条的上下文
  console.log('第一条帖子上下文:')
  console.log(posts[0]?.context)
  console.log()
  
  // 找作者
  // 尝试找作者：链接后面的结构
  const authorPattern = /<a[^>]*href="(\/news,\d+,[^"]+)"[^>]*>([^<]{5,})<\/a>[\s\S]{0,200}?<a[^>]*class="[^"]*"[^>]*>([^<]+)<\/a>/gi
  let am
  let authorCount = 0
  while ((am = authorPattern.exec(text)) !== null && authorCount < 5) {
    console.log(`标题: ${am[2].slice(0, 30)} | 作者: ${am[3]}`)
    authorCount++
  }

  // 另一种方式：找所有 .listitem 中的内容
  // 可能是 div 而不是 li
  const divPattern = /<div[^>]*class="[^"]*item[^"]*"[^>]*>([\s\S]{0,500}?)<\/div>/gi
  let dm
  let divCount = 0
  console.log(`\nitem div 搜索:`)
  while ((dm = divPattern.exec(text)) !== null && divCount < 3) {
    const content = dm[1].replace(/\s+/g, ' ').slice(0, 200)
    console.log(`  ${content}`)
    divCount++
  }

  // 直接搜索 阅读量/评论数 模式
  const readPattern = /(\d+\.?\d*万?)\s*<[^>]*>\s*<[^>]*>\s*(\d+\.?\d*万?)\s*<[^>]*>\s*<[^>]*>\s*<a[^>]*href="(\/news,\d+,[^"]+)"[^>]*>([^<]+)<\/a>/gi
  let rm
  let readCount = 0
  console.log(`\n阅读+评论+标题 模式:`)
  while ((rm = readPattern.exec(text)) !== null && readCount < 5) {
    console.log(`  阅读:${rm[1]} 评论:${rm[2]} 标题:${rm[4].slice(0, 30)}`)
    readCount++
  }

  // 看看帖子列表区域的 class 名
  const classMatches = text.match(/class="[^"]*list[^"]*"/gi)
  const uniqueClasses = new Set(classMatches?.slice(0, 20))
  console.log(`\n包含 list 的 class:`, Array.from(uniqueClasses).slice(0, 10).join(', '))
}

main()
