/**
 * 验证 CJS require 导出有效性（之前 P2 问题：exports require 指向不存在的 index.cjs）
 * 使用 --input-type=commonjs 直接 require 验证
 */
const { safeFormatNumber, safeFormatPercent, safeFormatCurrency } = require('@finsightv9/safe-format')

// 验证 3 个导出函数
console.log('[CJS] safeFormatNumber(null, 2)     =', JSON.stringify(safeFormatNumber(null, 2)))
console.log('[CJS] safeFormatNumber(3.14159, 2) =', JSON.stringify(safeFormatNumber(3.14159, 2)))
console.log('[CJS] safeFormatPercent(1.5, 2)     =', JSON.stringify(safeFormatPercent(1.5, 2)))
console.log('[CJS] safeFormatPercent(-1.5, 2)    =', JSON.stringify(safeFormatPercent(-1.5, 2)))
console.log('[CJS] safeFormatPercent(Infinity)  =', JSON.stringify(safeFormatPercent(Infinity)))
console.log('[CJS] safeFormatCurrency(1234567.89) =', JSON.stringify(safeFormatCurrency(1234567.89, 2)))
console.log('[CJS] safeFormatCurrency(undefined, 2, "$0.00") =', JSON.stringify(safeFormatCurrency(undefined, 2, '$0.00')))
console.log('\n[CJS] ALL CHECKS PASSED — index.cjs 正常导出')
