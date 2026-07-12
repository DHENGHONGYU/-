const r = require('./complexity-plan.json')
const norm = (s) => s.replace(/\\/g, '/')
const want = [
  'src/lib/localStorageManager.ts',
  'src/services/data-collector/dataSourceOrchestrator.ts',
  'src/core/pipelineScheduler.ts',
  'src/data/db.ts',
  'src/services/hybrid-proofread/localCollector.ts',
  'src/services/input/batchImportParsers.ts',
  'src/services/input/inputService.ts',
  'src/services/news/newsService.ts',
  'src/services/news/sentimentAnalyzer.ts',
  'src/services/system/localDocService.ts',
  'src/services/system/migration/migrationTransformers.ts',
  'src/services/trading/tradeErrorDetectors.ts',
  'src/store/signalQualityStore.derived.ts',
  'src/services/llm/llmClient.ts',
  'src/components/organisms/input/StockSearch.tsx',
  'src/components/organisms/system/MigrationPanel.tsx',
]
for (const f of want) {
  const items = r.violations.filter((v) => norm(v.file) === f)
  if (items.length) {
    console.log('### ' + f + ' (' + items.length + ')')
    items.forEach((i) => console.log('   ' + i.type + ' D/C' + i.metric + ' :: ' + i.func + ' L' + i.line))
  }
}
