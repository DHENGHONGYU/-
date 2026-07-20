/**
 * 维度 07 关联指数真实数据测试脚本
 *
 * 验证腾讯 K 线 + 本地 Pearson 计算是否能产出真实相关性数据。
 * 测试标的：600519.SH（贵州茅台）
 *
 * 运行方式: node ./node_modules/tsx/dist/cli.mjs scripts/test-index-correlation.ts
 */

import { tencentKline } from '../src/services/data-collector/directDataAPI'
import { fetchIndexCorrelation } from '../src/services/data-collector/multiSourceFetcher'

async function testTencentKline() {
  console.log('\n=== 测试1: 腾讯 K 线获取（标的 600519.SH）===')
  const klines = await tencentKline('600519.SH', 60)
  console.log(`获取到 ${klines.length} 条 K 线`)
  if (klines.length > 0) {
    console.log(`最新日期: ${klines[klines.length - 1].date}`)
    console.log(`最新收盘价: ${klines[klines.length - 1].close}`)
    console.log(`最早日期: ${klines[0].date}`)
  }
  return klines.length
}

async function testIndexKline() {
  console.log('\n=== 测试2: 指数 K 线获取 ===')
  const indices = [
    { code: '000300.SH', name: '沪深300' },
    { code: '000905.SH', name: '中证500' },
    { code: '399006.SZ', name: '创业板指' },
  ]
  for (const idx of indices) {
    const klines = await tencentKline(idx.code, 60)
    console.log(`${idx.name} (${idx.code}): ${klines.length} 条`)
    if (klines.length > 0) {
      console.log(`  最新: ${klines[klines.length - 1].date} 收 ${klines[klines.length - 1].close}`)
    }
  }
}

async function testCorrelation() {
  console.log('\n=== 测试3: 完整 fetchIndexCorrelation（600519.SH）===')
  const result = await fetchIndexCorrelation('600519.SH')
  console.log(`返回 ${result.length} 个指数`)
  for (const r of result) {
    console.log(`  ${r.indexName} (${r.indexCode}):`)
    console.log(`    相关系数: ${r.correlation}`)
    console.log(`    Beta: ${r.beta ?? 'N/A'}`)
    console.log(`    数据源: ${(r as any)._source ?? 'unknown'}`)
  }

  // 验证
  const hasNonZero = result.some(r => r.correlation !== 0)
  console.log(`\n  验证结果: ${hasNonZero ? '✅ PASS - 存在非零相关性' : '❌ FAIL - 全部为0'}`)

  // 茅台与沪深300应有较高相关性（>0.5）
  const hs300 = result.find(r => r.indexCode === '000300.SH')
  if (hs300 && hs300.correlation > 0.3) {
    console.log('  ✅ PASS - 茅台与沪深300相关性符合预期 (>0.3)')
  } else if (hs300) {
    console.log(`  ⚠️  茅台与沪深300相关性: ${hs300.correlation}（可能因近期行情波动）`)
  }
}

async function testMultipleStocks() {
  console.log('\n=== 测试4: 多股票验证 ===')
  const stocks = [
    { code: '600519.SH', name: '贵州茅台' },
    { code: '000858.SZ', name: '五粮液' },
    { code: '300750.SZ', name: '宁德时代' },
    { code: '601318.SH', name: '中国平安' },
  ]

  for (const stock of stocks) {
    const result = await fetchIndexCorrelation(stock.code)
    const hs300 = result.find(r => r.indexCode === '000300.SH')
    const cyb = result.find(r => r.indexCode === '399006.SZ')
    console.log(`  ${stock.name}(${stock.code}): 沪深300=${hs300?.correlation ?? 'N/A'}, 创业板=${cyb?.correlation ?? 'N/A'}, source=${(hs300 as any)?._source ?? 'unknown'}`)
  }
}

async function main() {
  console.log('维度 07 关联指数真实数据测试')
  console.log('='.repeat(50))

  const klineCount = await testTencentKline()
  if (klineCount === 0) {
    console.log('❌ 腾讯 K 线获取失败，终止测试')
    process.exit(1)
  }

  await testIndexKline()
  await testCorrelation()
  await testMultipleStocks()

  console.log('\n' + '='.repeat(50))
  console.log('测试完成')
}

main().catch(console.error)
