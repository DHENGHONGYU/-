import { exec } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = dirname(__filename).replace(/[\\/]scripts$/, '')

const command = 'npx tsx scripts/llm-doc-generator.ts --scan-all'

let allOutput = ''

const child = exec(command, { cwd: ROOT, maxBuffer: 1024 * 1024 * 5 })

child.stdout?.on('data', (data) => {
  console.log(data)
  allOutput += data
})

child.stderr?.on('data', (data) => {
  console.error(data)
  allOutput += data
})

child.on('close', (code) => {
  const logPath = join(ROOT, 'docs', 'drafts', `script-output-${Date.now()}.log`)
  writeFileSync(logPath, allOutput, 'utf-8')
  console.log(`\n脚本执行完成，退出码: ${code}`)
  console.log(`完整输出已保存到: ${logPath}`)
  
  const timeLines = allOutput.split('\n').filter(line => line.includes('[LLMDocGenerator]'))
  console.log('\n=== 性能日志摘要 ===')
  timeLines.forEach(line => console.log(line))
})
