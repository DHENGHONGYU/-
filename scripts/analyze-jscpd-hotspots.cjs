/**
 * jscpd 热点分析脚本
 * 分析重复代码最严重的文件/目录，输出 Top N 热点
 */
const r = require('../outputs/jscpd-report.json')

// 1. 按文件统计重复行数
const fileMap = {}
const dirMap = {}

for (const dup of r.duplicates) {
  const lines = dup.lines
  const files = [dup.firstFile, dup.secondFile].filter(Boolean)
  for (const src of files) {
    const f = src.name.replace(/\\/g, '/')
    fileMap[f] = (fileMap[f] || 0) + lines
    // 取前3级目录
    const parts = f.split('/')
    const dir = parts.length >= 3 ? parts.slice(0, 3).join('/') : parts.slice(0, 2).join('/')
    dirMap[dir] = (dirMap[dir] || 0) + lines
  }
}

// 2. 按文件排序 Top 30
console.log('=== Top 30 重复代码文件热点 ===')
const sortedFiles = Object.entries(fileMap).sort((a, b) => b[1] - a[1]).slice(0, 30)
for (const [f, v] of sortedFiles) {
  console.log(`  ${String(v).padStart(6)} 行  ${f}`)
}

// 3. 按目录排序 Top 20
console.log('\n=== Top 20 重复代码目录热点 ===')
const sortedDirs = Object.entries(dirMap).sort((a, b) => b[1] - a[1]).slice(0, 20)
for (const [d, v] of sortedDirs) {
  console.log(`  ${String(v).padStart(6)} 行  ${d}`)
}

// 4. 分析 src/ 内部的重复对（两个文件之间的重复）
console.log('\n=== 跨文件重复 Top 20（文件对之间） ===')
const pairMap = {}
for (const dup of r.duplicates) {
  const a = dup.firstFile.name.replace(/\\/g, '/')
  const b = dup.secondFile.name.replace(/\\/g, '/')
  if (a !== b) {
    const key = [a, b].sort().join(' <-> ')
    pairMap[key] = (pairMap[key] || 0) + dup.lines
  }
}
const sortedPairs = Object.entries(pairMap).sort((a, b) => b[1] - a[1]).slice(0, 20)
for (const [pair, v] of sortedPairs) {
  console.log(`  ${String(v).padStart(6)} 行  ${pair}`)
}

// 5. 分类统计
console.log('\n=== 按顶层目录分类统计 ===')
const topDirMap = {}
for (const [f, v] of Object.entries(fileMap)) {
  const top = f.split('/')[0]
  topDirMap[top] = (topDirMap[top] || 0) + v
}
const sortedTop = Object.entries(topDirMap).sort((a, b) => b[1] - a[1])
for (const [d, v] of sortedTop) {
  console.log(`  ${String(v).padStart(6)} 行  ${d}`)
}
