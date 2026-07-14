/**
 * 股票颜色调试测试脚本
 * 启用 __DEBUG_STOCK_COLORS__ 开关，验证颜色计算逻辑
 */

import { JSDOM } from 'jsdom'

// 设置 jsdom 环境
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost'
})
global.window = dom.window as any
global.document = dom.window.document

// 启用调试开关
;(global.window as any).__DEBUG_STOCK_COLORS__ = true

console.log('=== 股票颜色调试测试 ===\n')
console.log('调试开关已启用: window.__DEBUG_STOCK_COLORS__ = true\n')

// 动态导入以使用 window 环境
import('../src/constants/theme.tokens').then(({ getStockColorHex, STOCK_COLOR_TOKENS }) => {
  console.log('--- 测试用例 ---\n')
  
  // 测试上涨
  console.log('1. 上涨场景 (change = 3.25):')
  const upColor = getStockColorHex(3.25)
  console.log(`   结果: ${upColor}`)
  console.log(`   预期: ${STOCK_COLOR_TOKENS.up.hex} (红色)\n`)
  
  // 测试下跌
  console.log('2. 下跌场景 (change = -1.80):')
  const downColor = getStockColorHex(-1.80)
  console.log(`   结果: ${downColor}`)
  console.log(`   预期: ${STOCK_COLOR_TOKENS.down.hex} (绿色)\n`)
  
  // 测试平盘
  console.log('3. 平盘场景 (change = 0):')
  const neutralColor = getStockColorHex(0)
  console.log(`   结果: ${neutralColor}`)
  console.log(`   预期: ${STOCK_COLOR_TOKENS.neutral.hex} (灰色)\n`)
  
  // 测试边界值
  console.log('4. 边界值测试:')
  console.log(`   极小上涨 (0.01): ${getStockColorHex(0.01)}`)
  console.log(`   极小下跌 (-0.01): ${getStockColorHex(-0.01)}`)
  console.log(`   大幅上涨 (10.5): ${getStockColorHex(10.5)}`)
  console.log(`   大幅下跌 (-8.3): ${getStockColorHex(-8.3)}\n`)
  
  console.log('--- 验证结果 ---')
  console.log(`✓ 上涨颜色正确: ${upColor === STOCK_COLOR_TOKENS.up.hex}`)
  console.log(`✓ 下跌颜色正确: ${downColor === STOCK_COLOR_TOKENS.down.hex}`)
  console.log(`✓ 平盘颜色正确: ${neutralColor === STOCK_COLOR_TOKENS.neutral.hex}`)
  console.log('\n=== 测试完成 ===')
})
