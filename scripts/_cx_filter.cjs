const fs = require('fs')
const path = require('path')

const raw = fs.readFileSync(process.argv[2], 'utf8')
const d = JSON.parse(raw)

const targets = [
  'engine.ts', 'types.ts', 'databridge.ts', 'db.ts', 'analyzer.ts', 'client.ts',
  'mcpAclMonitor.ts', 'register.ts', 'CollectTaskPage.tsx', 'ConfigApp.tsx',
  'data-collector/directDataAPI.ts', 'fetcher/dataSourceRegistry.ts',
  'fetcher/directDataAPI.ts', 'fetcherInterceptor.ts', 'phaseOrchestrator.ts',
  'batchImportExecutor.ts', 'batchImportParsers.ts', 'input/inputService.ts',
  'news/newsService.ts', 'news/stockLinker.ts'
]

const out = d.violations.filter(
  (v) => v.type === 'deep-nesting' && targets.some((f) => v.file.includes(f)),
)
out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
out.forEach((v) => console.log(`${v.file} @${v.func} L${v.line} depth=${v.metric}`))
console.log(`\nTOTAL remaining deep-nesting: ${out.length}`)
