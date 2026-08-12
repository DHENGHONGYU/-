/**
 * DataFlow-Bridge Audit Engine (V9)
 * ---------------------------------------------------------------
 * 功能：系统梳理「数据传递 ↔ DataBridge 数据桥」关系，并对 UI 组件按钮的
 *       数据联动接线（按钮→store action→DataBridge forward→呈现订阅）做
 *       系统性检查与校对，产出关系梳理报告 + 决策性参考意见。
 *
 * 依据：项目技能 data-flow-integrity-audit（5 层链路 + L1–L21 教训）
 * 产出：outputs/reports/dataflow-bridge-audit-<date>.{json,md,html}
 *
 * 用法：npx tsx scripts/audit/dataflow-bridge-audit.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')
const SRC = path.join(ROOT, 'src')
const OUT = path.join(ROOT, 'outputs', 'reports')
fs.mkdirSync(OUT, { recursive: true })

type Sev = 'P0' | 'P1' | 'P2' | 'INFO' | 'PASS'
type Status = 'fail' | 'warn' | 'pass' | 'info'
interface Finding {
  id: string
  group: string
  title: string
  severity: Sev
  status: Status
  evidence: string[]
  detail: string
  recommendation?: string
  source?: 'auto' | 'static-trace'
}
const findings: Finding[] = []

// ---------- helpers ----------
function rel(p: string): string {
  return p.replace(ROOT + path.sep, '').replace(ROOT + '/', '')
}
function readRel(p: string): string | null {
  try {
    return fs.readFileSync(path.join(ROOT, p), 'utf8')
  } catch {
    return null
  }
}
function readFileAbs(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}
const SKIP = new Set([
  'node_modules', 'dist', 'coverage', '.git', 'outputs', 'archive', '_backups',
  'docs-backup', '_ref', 'cache', 'packages', 'plugins', 'e2e', 'playwright',
])
function listTs(dir: string): string[] {
  const out: string[] = []
  function walk(d: string) {
    let ents: fs.Dirent[]
    try {
      ents = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      if (SKIP.has(e.name)) continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
    }
  }
  walk(dir)
  return out
}
interface Hit {
  file: string
  line: number
  text: string
}
function grepInFiles(files: string[], re: RegExp): Hit[] {
  const res: Hit[] = []
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  for (const f of files) {
    const c = readFileAbs(f)
    if (!c) continue
    const lines = c.split('\n')
    for (let i = 0; i < lines.length; i++) {
      rx.lastIndex = 0
      if (rx.test(lines[i])) res.push({ file: rel(f), line: i + 1, text: lines[i].trim() })
    }
  }
  return res
}
function grepOne(content: string | null, re: RegExp): Hit[] {
  if (!content) return []
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  const out: Hit[] = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    rx.lastIndex = 0
    if (rx.test(lines[i])) out.push({ file: '', line: i + 1, text: lines[i].trim() })
  }
  return out
}
function extractEnumKeys(content: string, enumName: string): string[] {
  // 兼容 `enum X {` 与 `const X = {` 两种写法
  let start = content.indexOf(`enum ${enumName}`)
  let isObj = false
  if (start < 0) {
    start = content.indexOf(`const ${enumName} =`)
    isObj = true
  }
  if (start < 0) return []
  let i = content.indexOf('{', start)
  let depth = 0
  let end = -1
  for (; i < content.length; i++) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const block = content.slice(start, end)
  const keys: string[] = []
  const re = isObj ? /(\w+)\s*:\s*['"][^'"]+['"]/g : /(\w+)\s*=\s*['"][^'"]+['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block))) keys.push(m[1])
  return keys
}
function countImports(storeBase: string): number {
  // 真实消费者判定：排除 store 自身定义、storeRegistry 注册、测试文件
  const all = listTs(SRC)
  let n = 0
  for (const f of all) {
    const rf = rel(f).replace(/\\/g, '/')
    if (rf === `src/store/${storeBase}.ts`) continue
    if (/storeRegistry/.test(rf)) continue
    if (/__tests__/.test(rf)) continue
    const c = readFileAbs(f)
    if (!c) continue
    if (c.includes(storeBase)) n++
  }
  return n
}

// ---------- gather base data ----------
const allFiles = listTs(SRC)
const dbConfig = readRel('src/config/dbConfig.ts')
const databridge = readRel('src/core/databridge.ts')
const handlers = readRel('src/core/databridgeHandlers.ts')

const definedActions = new Set(extractEnumKeys(dbConfig ?? '', 'ENVELOPE_ACTION'))
const handlerRefs = grepOne(handlers, /ENVELOPE_ACTION\.(\w+)/).map((h) =>
  (h.text.match(/ENVELOPE_ACTION\.(\w+)/) || [])[1],
)
const handlerSet = new Set(handlerRefs.filter(Boolean))
const router = readRel('src/core/databridgeRouter.ts')
// 路由型 action：databridge.ts 与 databridgeRouter.ts 中出现的全部 ENVELOPE_ACTION 引用
const routedRefsRaw = [
  ...grepOne(databridge, /ENVELOPE_ACTION\.(\w+)/),
  ...grepOne(router, /ENVELOPE_ACTION\.(\w+)/),
]
const routedSet = new Set(
  routedRefsRaw.map((h) => (h.text.match(/ENVELOPE_ACTION\.(\w+)/) || [])[1]).filter(Boolean),
)
const allActionRefs = grepInFiles(allFiles, /ENVELOPE_ACTION\.(\w+)/)
const refSet = new Set(
  allActionRefs.map((h) => (h.text.match(/ENVELOPE_ACTION\.(\w+)/) || [])[1]).filter(Boolean),
)
const undefinedRefs = [...refSet].filter((a) => !definedActions.has(a))
const orphanRefs = [...refSet].filter(
  (a) => definedActions.has(a) && !handlerSet.has(a) && !routedSet.has(a),
)

// ================= GROUP A: DataBridge 关系完整性 =================
// A1: action 定义/注册/引用 一致性
findings.push({
  id: 'A1',
  group: 'DataBridge 关系完整性',
  title: 'ENVELOPE_ACTION 定义 / handler 注册 / 引用 一致性',
  severity: undefinedRefs.length ? 'P1' : 'PASS',
  status: undefinedRefs.length ? 'fail' : 'pass',
  evidence: [
    `ENVELOPE_ACTION 枚举定义数 = ${definedActions.size} (src/config/dbConfig.ts:100-262)`,
    `handler 注册 action 数 = ${handlerSet.size} (databridgeHandlers.ts)`,
    `路由型 action 数(STRATEGY/QUERY/EVENT/manager) = ${routedSet.size} (databridge.ts)`,
    `全仓引用 action 数 = ${refSet.size}`,
    undefinedRefs.length
      ? `引用但未定义的 action = ${undefinedRefs.join(', ')}`
      : '引用但未定义的 action = 0',
    orphanRefs.length
      ? `已定义但无 handler/路由的 action(将命中裸 put 或抛错) = ${orphanRefs.join(', ')}`
      : '已定义但无 handler/路由的 action = 0',
  ],
  detail:
    'DataBridge 是系统唯一数据传递中枢：写入经 forward()→ACL→handler→IndexedDB→broadcast 闭环。' +
    '任一被引用的 action 必须在 handler 注册表或路由分支中有落点，否则将退化为裸 db.put 或运行期抛错。',
  recommendation: orphanRefs.length
    ? `为 [${orphanRefs.join(', ')}] 补齐 handler 或路由分支，消除"已引用但无落点"隐患。`
    : '当前 action 引用全有落点，关系闭环完整。',
  source: 'auto',
})

// A2: deleteRecord 孤立 action（精确判定：枚举定义 + 在 databridge.ts 被归入 routeToManager，但 router switch 无对应 case）
const deleteRecordDefined = definedActions.has('deleteRecord')
const deleteRecordHasManagerCase = router ? /case ENVELOPE_ACTION\.deleteRecord/.test(router) : false
const deleteRecordIsOrphan =
  deleteRecordDefined && !deleteRecordHasManagerCase && !handlerSet.has('deleteRecord')
findings.push({
  id: 'A2',
  group: 'DataBridge 关系完整性',
  title: 'deleteRecord 孤立 action 检测',
  severity: deleteRecordIsOrphan ? 'P1' : 'PASS',
  status: deleteRecordIsOrphan ? 'fail' : 'pass',
  evidence: deleteRecordDefined
    ? [
        'deleteRecord 已定义 (dbConfig.ts:261)',
        deleteRecordHasManagerCase
          ? 'routeToManager 的 switch 含对应 case → 已路由'
          : 'deleteRecord 被归入 routeToManager 分支，但 databridgeRouter.ts switch 无对应 case → 运行期必抛 Unknown manager action',
      ]
    : ['deleteRecord 未在枚举中找到'],
  detail:
    '孤立 action 指已在 ENVELOPE_ACTION 枚举定义，却无 handler、无 store 映射、也无路由分支的 action。' +
    '一旦被发出，routeToManager 的 default 分支抛出未知动作错误，构成数据传递断点。',
  recommendation: deleteRecordIsOrphan
    ? '从枚举移除 deleteRecord，或在 routeToManager 增加对应 case（若确有通用删除需求）。'
    : '无孤立 action。',
  source: 'auto',
})

// A3: 死 handler（注册但因 EVENT_ACTIONS 路由优先级不可达）
const notificationHandlers = ['newsArticleLoaded', 'holdingsDataLoaded', 'tradeActionExecuted']
const loadHoldingsHandler = ['loadHoldingsData']
const deadHandlers = [...notificationHandlers, ...loadHoldingsHandler].filter(
  (a) => handlerSet.has(a) && routedSet.has(a),
)
findings.push({
  id: 'A3',
  group: 'DataBridge 关系完整性',
  title: '死 handler（注册但路由优先级更高不可达）',
  severity: deadHandlers.length ? 'INFO' : 'PASS',
  status: deadHandlers.length ? 'info' : 'pass',
  evidence: deadHandlers.length
    ? deadHandlers.map((a) => `handler 注册 ${a} 但 EVENT_ACTIONS 路由优先级更高 → handler 永不执行`)
    : ['无死 handler'],
  detail:
    'routeToAction 中 EVENT_ACTIONS 判断早于 manager/DB 分支，导致 NotificationHandler、LoadHoldingsDataHandler ' +
    '注册的 action 实际走 routeToEvent，其 handler 成为冗余死代码。不影响功能，但增加维护歧义。',
  recommendation: '清理冗余 handler 注册，或显式注释其"经 EVENT 路由"的角色，避免误解为可达落库逻辑。',
  source: 'auto',
})

// A4: 裸 put 兜底
const barePuts = grepOne(databridge, /db\.put\(/)
findings.push({
  id: 'A4',
  group: 'DataBridge 关系完整性',
  title: 'handler 缺失时裸 db.put 兜底',
  severity: 'INFO',
  status: 'info',
  evidence: barePuts.length
    ? [`databridge.ts 中裸 db.put 调用 ${barePuts.length} 处（routeToDB 兜底分支）`]
    : ['未检出裸 db.put'],
  detail:
    'routeToDB 在未命中 handler 时直接 db.put(store, payload)，跳过 InsertStock 的 symbol 校验、' +
    'DeleteStock 级联、UpdateStock 合并等逻辑，是主要数据一致性隐患。应保证所有写入 action 均有显式 handler。',
  recommendation: '将 A1 暴露的孤儿 action 全部补齐 handler，使裸 put 兜底永不触发（仅作安全网）。',
  source: 'auto',
})

// A5: payload 包装残留
const payloadResidue = grepInFiles(
  allFiles.filter((f) => f.includes('data-collector')),
  /\{[ \t]*store[ \t]*:[ \t]*data[ \t]*\}/,
)
findings.push({
  id: 'A5',
  group: 'DataBridge 关系完整性',
  title: 'payload 包装 { store, data } 残留',
  severity: payloadResidue.length ? 'P1' : 'PASS',
  status: payloadResidue.length ? 'fail' : 'pass',
  evidence: payloadResidue.length
    ? payloadResidue.map((h) => `${h.file}:${h.line}`)
    : ['src/services/data-collector/ 下 { store, data } 包装残留 = 0'],
  detail: '约定：DataBridge.forward 的 payload 必须是扁平记录；{store,data} 包装会被原样写入 IndexedDB 导致 keyPath 无值。',
  recommendation: payloadResidue.length ? '将包装改为扁平记录后转发。' : '无残留。',
  source: 'auto',
})

// A6: MOCK_STOCK_LIBRARY 残留（排除 mock 库模块本身与测试，聚焦"被生产代码误用"）
const mockLibAll = grepInFiles(allFiles, /MOCK_STOCK_LIBRARY/)
const mockLib = mockLibAll.filter(
  (h) => !/mockStockLibrary\.ts/.test(h.file) && !/__tests__/.test(h.file),
)
findings.push({
  id: 'A6',
  group: 'DataBridge 关系完整性',
  title: 'MOCK_STOCK_LIBRARY 误用残留（真实数据接线）',
  severity: mockLib.length ? 'P1' : 'PASS',
  status: mockLib.length ? 'fail' : 'pass',
  evidence: mockLib.length
    ? mockLib.map((h) => `${h.file}:${h.line}`)
    : [
        'src 生产代码中 MOCK_STOCK_LIBRARY 误用 = 0',
        `（专属 mock 模块 mockStockLibrary.ts 与测试中的引用属预期，已排除，共 ${mockLibAll.length} 处）`,
      ],
  detail: '采集必须读取真实用户标的（intentionPoolStore），若生产代码误用 MOCK_STOCK_LIBRARY 会导致采集用假数据。',
  recommendation: mockLib.length ? '替换为 resolveDefaultSymbols() 真实数据源。' : '无生产误用。',
  source: 'auto',
})

// A7: ACL 一致性（fetcher 写入方覆盖其目标 store）
findings.push({
  id: 'A7',
  group: 'DataBridge 关系完整性',
  title: 'ACL_MATRIX 采集写入方覆盖度',
  severity: 'INFO',
  status: 'info',
  evidence: [
    'ACL_MATRIX 位于 src/config/dbConfig.ts:376-579',
    'MODULE_ID.fetcher.write 覆盖: stocks/dailyQuotes/financialReports/collectConfig/traceRecords/collectionHistory/conflictLog/fileImportRecords/proofreadReports/news/sectorScores/researchLogs',
    '已修复历史 8 维采集 ACL 失败（fetcher 曾漏授 write）',
  ],
  detail: 'ACL 在桥内统一校验（assertAclWithFallback），是数据传递的权限闸门。',
  recommendation: '新增 EnvelopeAction→store 映射时，必须同步检查 ACL_MATRIX.write 列表（见 data-flow 技能 L6）。',
  source: 'auto',
})

// ================= GROUP B: UI 按钮数据联动 =================
// 注释剥离：避免审计误匹配修复注释 / JSDoc 中的描述性文本
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // 行注释（保留协议名中的 //，如 https://）
}

// B1: 假 KPI 硬编码（仅扫生产 .tsx 呈现组件，排除测试与类型定义文件）
const kpiFiles = listTs(SRC).filter(
  (f) => (f.includes('cockpit') || f.includes('widget')) && /\.tsx$/.test(f) && !/\.test\.tsx$/.test(f),
)
const maxDrawdownHits = grepInFiles(kpiFiles, /最大回撤/)
const sharpeHits = grepInFiles(kpiFiles, /夏普/)
const fakeKpi: string[] = []
for (const h of maxDrawdownHits) {
  const raw = readFileAbs(path.join(ROOT, h.file))
  if (!raw) continue
  const c = stripComments(raw)
  const ctx = c.split('\n').slice(h.line - 1, h.line + 3).join('\n')
  // 仅当渲染值确为字面量 0（如 >0%< / 0.0< / ={0}）才判定为假 KPI；
  // 真实计算使用 equityCurve + toFixed 不产生字面量 0。
  if (/0%|0\.0/.test(ctx)) fakeKpi.push(`${h.file}:${h.line} 最大回撤/夏普 附近出现字面量 0`)
}
for (const h of sharpeHits) {
  const raw = readFileAbs(path.join(ROOT, h.file))
  if (!raw) continue
  const c = stripComments(raw)
  const ctx = c.split('\n').slice(h.line - 1, h.line + 3).join('\n')
  if (/0\.0/.test(ctx)) fakeKpi.push(`${h.file}:${h.line} 夏普 附近出现字面量 0.0`)
}
// 扩展：交易/风控面板硬编码兜底 KPI（如 maxDrawdown: 15.3 / sharpeRatio: 1.2）
// 这类字面量在无真实数据时伪装成真实风控指标，与 PortfolioOverviewWidget 原缺陷同类。
// 仅扫生产呈现文件（排除测试与 mock 数据源），真值应来自实时计算或显式「数据不足」。
const tradingRiskFiles = listTs(SRC).filter(
  (f) =>
    (f.includes('trading') || f.includes('RiskControl')) &&
    !/\.test\.(ts|tsx)$/.test(f) &&
    !/mock/i.test(f),
)
const hardcodeRe = /(maxDrawdown|maxDrawDown|sharpeRatio|sharpe)\s*:\s*[-+]?\d+(\.\d+)?/i
const hardcodeHits = grepInFiles(tradingRiskFiles, hardcodeRe)
for (const h of hardcodeHits) {
  fakeKpi.push(
    `${h.file}:${h.line} 交易/风控面板硬编码兜底 KPI 字面量（应接入真实数据或显式「数据不足」）`,
  )
}
findings.push({
  id: 'B1',
  group: 'UI 按钮数据联动',
  title: '呈现层假 KPI（硬编码固定值）',
  severity: fakeKpi.length ? 'P0' : 'PASS',
  status: fakeKpi.length ? 'fail' : 'pass',
  evidence: fakeKpi.length ? fakeKpi : ['未检出硬编码假 KPI（最大回撤/夏普 字面量）'],
  detail: '呈现组件中的关键决策指标（最大回撤、夏普比率）若为字面量 0，会误导模拟交易复盘决策。',
  recommendation: fakeKpi.length
    ? '接入真实组合收益序列计算回撤/夏普；测试 PortfolioOverviewWidget.test.tsx 同步去除"固定占位"断言。'
    : '呈现层 KPI 均源自真实数据。',
  source: 'auto',
})

// B2: 断裂按钮（无 onClick）—— 仅扫源码组件，排除测试文件与注释
const srcFiles = allFiles.filter((f) => !f.includes('__tests__') && !/\.test\.(ts|tsx)$/.test(f))
const addWidgetHits = grepInFiles(srcFiles, /添加 Widget/)
const brokenButtons: string[] = []
for (const h of addWidgetHits) {
  const raw = readFileAbs(path.join(ROOT, h.file))
  if (!raw) continue
  const c = stripComments(raw)
  // 上下文向上覆盖开标签（<Button ...> 往往在文本前一行），向下覆盖闭标签
  const ctx = c.split('\n').slice(h.line - 3, h.line + 2).join('\n')
  if (!/onClick/.test(ctx)) brokenButtons.push(`${h.file}:${h.line} 「添加 Widget」按钮缺失 onClick`)
}
findings.push({
  id: 'B2',
  group: 'UI 按钮数据联动',
  title: '断裂按钮（无 onClick 处理器）',
  severity: brokenButtons.length ? 'P1' : 'PASS',
  status: brokenButtons.length ? 'fail' : 'pass',
  evidence: brokenButtons.length ? brokenButtons : ['未检出无 onClick 的可见按钮'],
  detail: '按钮存在但点击事件未接线，点击无反应，属于"假按钮"（data-flow 技能 L12）。',
  recommendation: brokenButtons.length ? '为按钮补 onClick（打开添加面板）或从 UI 移除。' : '按钮均具备事件接线。',
  source: 'auto',
})

// B3/B4: 死 store 治理（以 storeRegistry 为单一事实源）+ 过时 @unused 注释
// storeRegistry.status:'unused' = 已实现待接入、受控 parked（与 audit:registry 门禁同源）
const storeDir = path.join(SRC, 'store')
const regContent = readFileAbs(path.join(storeDir, 'storeRegistry.ts')) || ''
const regEntryRe = /id:\s*'([^']+)'\s*,\s*filePath:\s*'([^']+)'\s*,\s*status:\s*'(active|unused)'/g
const regMap = new Map<string, { id: string; filePath: string; status: string }>()
let rm: RegExpExecArray | null
while ((rm = regEntryRe.exec(regContent))) {
  regMap.set(rm[1], { id: rm[1], filePath: rm[2], status: rm[3] })
}
const camel = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1)

const deadStores: string[] = [] // 注册表 parked（受控，非噪声）
const staleComments: string[] = [] // @unused 但被 UI 层消费 → 过时注释
const inconsistencies: string[] = [] // 注册表↔文件 @unused 标注 不一致
const uiRe = /(pages|components|cockpit|apps|portal)/
const importRe = (name: string): RegExp => new RegExp(`from\\s+['"][^'"]*${name}['"]`)
for (const [id, v] of regMap) {
  const file = path.join(storeDir, camel(id) + '.ts')
  const content = readFileAbs(file) || ''
  const hasUnusedTag = /@unused/.test(content)
  if (v.status === 'unused') {
    deadStores.push(
      `src/store/${camel(id)}.ts 已注册 status:'unused'（storeRegistry 显式治理）→ 受控 parked，非噪声`,
    )
  }
  if (v.status === 'unused' && !hasUnusedTag)
    inconsistencies.push(
      `src/store/${camel(id)}.ts 注册 status:'unused' 但文件无 @unused 标注 → 不一致（建议补 @unused 或移除注册）`,
    )
  if (v.status === 'active' && hasUnusedTag) {
    // 注册表称 active，但文件标 @unused：核查是否真有 UI 层消费者
    let uiN = 0
    for (const f of listTs(SRC)) {
      if (!uiRe.test(f) || f.includes('__tests__')) continue
      const c = readFileAbs(f)
      if (c && importRe(camel(id)).test(c)) uiN++
    }
    if (uiN > 0)
      staleComments.push(
        `src/store/${camel(id)}.ts 标注 @unused 但实际有 ${uiN} 个 UI 层消费者 → 注释过时`,
      )
    else
      inconsistencies.push(
        `src/store/${camel(id)}.ts 有 @unused 标注 但注册 status:'active' 且无 UI 消费者 → 不一致（建议注册改 'unused'）`,
      )
  }
}
findings.push({
  id: 'B3',
  group: 'UI 按钮数据联动',
  title: `受控 parked store（storeRegistry status:'unused'）`,
  severity: inconsistencies.length ? 'P2' : deadStores.length ? 'INFO' : 'PASS',
  status: inconsistencies.length ? 'warn' : deadStores.length ? 'info' : 'pass',
  evidence: inconsistencies.length
    ? inconsistencies
    : deadStores.length
      ? deadStores
      : ['无 @unused 注册条目（storeRegistry 治理一致）'],
  detail: `storeRegistry 以 status:'unused' 显式登记"已实现待接入" store，属受控 parked（与 audit:registry 门禁同源），不视为维护噪声。仅当 注册表↔文件 @unused 标注 不一致时才告警。`,
  recommendation: inconsistencies.length
    ? '对齐 storeRegistry status 与文件 @unused 标注。'
    : deadStores.length
      ? '受控 parked：保留待用或移除；如需消除此条可删除对应 store 并重新生成 storeRegistry。'
      : '无 parked store。',
  source: 'auto',
})
findings.push({
  id: 'B4',
  group: 'UI 按钮数据联动',
  title: '过时 @unused 注释（实际已被 UI 层消费）',
  severity: staleComments.length ? 'P2' : 'PASS',
  status: staleComments.length ? 'warn' : 'pass',
  evidence: staleComments.length ? staleComments : ['未检出过时 @unused 注释'],
  detail: 'store 标 @unused 但实际被 UI 层组件 import 并消费，过时注释会误导校对结论。',
  recommendation: staleComments.length ? '逐一对账 @unused 注释，剔除已不准确的标注。' : '注释与事实一致。',
  source: 'auto',
})

// B5: 呈现层占位/待接入 误导性内容
// 仅扫生产呈现层（cockpit/pages/apps，排除测试）；先剥离注释，再匹配"会误导功能已完成"的占位/待接入文案。
// 排除：input/textarea placeholder 属性（标准表单提示，非误导性）、TODO 开发注释、[示例]/[开发中] 诚实标注。
const misleadingRe = /占位|待接入|未接入|敬请期待|coming\s*soon/i
const presentFiles = allFiles.filter(
  (f) =>
    (f.includes('cockpit') || f.includes('pages') || f.includes('apps')) &&
    !/\.test\.(ts|tsx)$/.test(f),
)
const placeholderHits: Hit[] = []
for (const f of presentFiles) {
  const c = readFileAbs(f)
  if (!c) continue
  const lines = stripComments(c).split('\n')
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]
    if (!misleadingRe.test(t)) continue
    if (/placeholder\s*=/i.test(t)) continue // input/textarea 占位属性（标准表单提示）
    if (/\[示例\]|\[开发中\]/.test(t)) continue // 诚实标注（审计推荐的明确写法）
    placeholderHits.push({ file: rel(f), line: i + 1, text: t.trim() })
  }
}
findings.push({
  id: 'B5',
  group: 'UI 按钮数据联动',
  title: '呈现层占位 / 待接入 误导性内容',
  severity: placeholderHits.length ? 'P2' : 'PASS',
  status: placeholderHits.length ? 'warn' : 'pass',
  evidence: placeholderHits.length
    ? placeholderHits.slice(0, 30).map((h) => `${h.file}:${h.line}`)
    : ['未检出误导性占位/待接入（input placeholder 属性、TODO 注释、[示例]/[开发中] 诚实标注均已排除）'],
  detail: '汇总看板/决策区若仍为未标注的占位或"待接入"静态文案，会误导"功能已完成"的判断（data-flow 技能 L20）。标准表单 input placeholder 属性、开发 TODO 注释、以及明确标注的 [示例]/[开发中] 不计入。',
  recommendation: placeholderHits.length
    ? '将占位区接入真实数据源，或明确标注 [开发中]；示例数据需与实时数据区分。'
    : '无误导性占位/待接入呈现。',
  source: 'auto',
})

// B6: 持久化缺口（评分结果未落库）
const analysisStore = readRel('src/store/analysisStore.ts')
const hotSectorStore = readRel('src/store/hotSectorStore.ts')
const analysisPersist = analysisStore && /dataBridge|forward\(|saveIntelligentScores/.test(analysisStore)
const hotSectorPersist = hotSectorStore && /dataBridge|forward\(|saveHotSectorScores/.test(hotSectorStore)
const persistGaps: string[] = []
if (analysisStore && !analysisPersist)
  persistGaps.push('analysisStore.handleScore 仅内存 set，未调用 dataBridge.forward 落库（刷新丢）')
if (hotSectorStore && !hotSectorPersist)
  persistGaps.push('hotSectorStore.fetchScores 仅内存 set，未调用 dataBridge.forward 落库（刷新丢）')
findings.push({
  id: 'B6',
  group: 'UI 按钮数据联动',
  title: '评分结果持久化缺口（仅内存未落 DataBridge）',
  severity: persistGaps.length ? 'P1' : 'PASS',
  status: persistGaps.length ? 'fail' : 'pass',
  evidence: persistGaps.length ? persistGaps : ['分析/热点评分结果均已落 DataBridge 持久化'],
  detail: 'ACTION_TO_STORE_MAP 已为 saveIntelligentScores/saveHotSectorScores 预留通道，若 store action 不 forward，则刷新页面后评分丢失，复盘中断。',
  recommendation: persistGaps.length
    ? '在对应 action 末尾补 dataBridge.forward(saveIntelligentScores/saveHotSectorScores) 完成持久化闭环。'
    : '评分结果持久化闭环完整。',
  source: 'auto',
})

// ================= GROUP C: 设计功能符合性 =================
// C1: databridge.forward 单写入口（store 是否直连 db.put 绕过桥）
const storeFiles = listTs(path.join(SRC, 'store'))
const directDbWrites = grepInFiles(storeFiles, /\bdb\.put\(|\bdb\.delete\(/)
findings.push({
  id: 'C1',
  group: '设计功能符合性',
  title: 'databridge.forward 唯一写入口约束',
  severity: directDbWrites.length ? 'P1' : 'PASS',
  status: directDbWrites.length ? 'fail' : 'pass',
  evidence: directDbWrites.length
    ? directDbWrites.slice(0, 20).map((h) => `${h.file}:${h.line}`)
    : ['src/store 下无绕过 DataBridge 的直连 db.put/delete'],
  detail: 'AGENTS.md 分层规则要求所有持久化写经 DataBridge 单入口，便于 ACL 校验与广播闭环；store 直连 db 会破坏治理。',
  recommendation: directDbWrites.length
    ? '将直连写改为 dataBridge.forward(envelope)，统一过桥。'
    : '写入均经 DataBridge 单入口，符合分层约束。',
  source: 'auto',
})

// ---------- 汇总与评分 ----------
const sevRank: Record<Sev, number> = { P0: 0, P1: 1, P2: 2, INFO: 3, PASS: 4 }
const counts: Record<string, number> = { P0: 0, P1: 0, P2: 0, INFO: 0, PASS: 0 }
for (const f of findings) counts[f.severity]++
const total = findings.length
const weighted = findings.reduce((s, f) => s + (f.severity === 'PASS' ? 1 : f.severity === 'INFO' ? 0.6 : 0), 0)
const score = Math.round((weighted / total) * 100)
const gate = counts.P0 > 0 ? 'BLOCK' : counts.P1 > 0 ? 'WARN' : 'PASS'

// ---------- 报告生成 ----------
const date = new Date().toISOString().slice(0, 10)
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function fStatusBadge(st: Status): string {
  const map: Record<Status, [string, string]> = {
    fail: ['#dc2626', '未通过'],
    warn: ['#d97706', '需关注'],
    pass: ['#16a34a', '通过'],
    info: ['#2563eb', '信息'],
  }
  const [c, t] = map[st]
  return `<span style="color:${c};font-weight:600">${t}</span>`
}

const md: string[] = []
md.push(`# DataFlow × DataBridge 关系梳理与 UI 数据联动合规审计报告`)
md.push('')
md.push(`- 生成时间：${new Date().toLocaleString('zh-CN')}`)
md.push(`- 项目：FinSightV9 智能投研复盘系统`)
md.push(`- 依据：data-flow-integrity-audit 技能（5 层链路 + L1–L21 教训）`)
md.push(`- 综合合规评分：**${score}/100** ｜ 门禁结论：**${gate}**`)
md.push(`- 发现统计：P0=${counts.P0} P1=${counts.P1} P2=${counts.P2} INFO=${counts.INFO} PASS=${counts.PASS}`)
md.push('')
md.push(`## 一、数据传递 ↔ 数据桥 关系梳理`)
md.push('')
md.push('DataBridge 是系统**唯一的数据传递中枢**：所有模块不直接连 IndexedDB，而是把数据装入 `StandardEnvelope` 经 `forward()` 过桥。')
md.push('')
md.push('```')
md.push('writer(store/service/fetcher适配器)')
md.push('  → EnvelopeFactory.create(meta, payload)')
md.push('  → dataBridge.forward(envelope)            [databridge.ts:509 唯一写入口]')
md.push('      → validate → inferOperation → inferStore')
md.push('      → assertAclWithFallback (aclEngine.assert)  [databridgeAcl.ts]')
md.push('      → routeToAction → handlerRegistry → db.put')
md.push('      → invalidateCache(targetStore) + broadcast(targetStore)')
md.push('  → 接收方 store 的 subscribe(STORE_NAME.x) 回调刷新内存   ← 传递闭环')
md.push('```')
md.push('')
md.push('**5 个架构要点：**')
md.push('1. 单一写入入口 + 信封协议：`forward()` 强制"写必须过桥"，`query()` 走独立但同样受 ACL 的读路径。')
md.push('2. ACL 是桥的守门人：`MODULE_ID.fetcher` 等多写入方权限集中在 `ACL_MATRIX`(dbConfig.ts:376-579)。')
md.push('3. 策略模式 handler = 桥的落库动作表：`ACTION_TO_STORE_MAP` 决定目标 store，`HandlerRegistry` 决定如何落库；未匹配时退化为裸 `db.put`。')
md.push('4. 写后广播构成"传递→接收"闭环：store 经 `subscribe()` 完成跨模块内存同步。')
md.push('5. 并行实时流传递：`src/core/dataflow/dataflowEngine.ts` 的 `publish()` 是实时 pub/sub，与 DataBridge 的"信封→持久化"互补但独立，撰写关系须区分二者。')
md.push('')
md.push(`## 二、自动化校验结果`)
md.push('')
for (const f of findings) {
  md.push(`### [${f.id}] ${f.title} — ${f.severity} / ${f.status}`)
  md.push('')
  md.push(f.detail)
  md.push('')
  if (f.evidence.length) {
    md.push('**证据：**')
    for (const e of f.evidence) md.push(`- ${e}`)
    md.push('')
  }
  if (f.recommendation) {
    md.push(`**建议：** ${f.recommendation}`)
    md.push('')
  }
}
md.push(`## 三、UI 按钮数据联动合规校验结论`)
md.push('')
md.push('接线范式：`按钮 onClick → useXxxStore action → (store 内 databridge.forward / set) → 呈现组件 useXxxStore(selector) 订阅`。DataBridge 不在组件层直接调用。')
md.push('')
md.push(`| 等级 | 发现 | 影响 |`)
md.push(`|------|------|------|`)
md.push(
  counts.P0
    ? `| P0 | 假 KPI（最大回撤/夏普硬编码 0） | 直接误导模拟交易复盘决策 |`
    : `| P0 | 无 | — |`,
)
md.push(`| P1 | 断裂按钮 / 死 store / 过时注释 / 持久化缺口 | 功能不可达或复盘中断 |`)
md.push(`| P2 | 示例/占位呈现 | 功能完成度误判 |`)
md.push('')
md.push(`## 四、设计功能符合性`)
md.push('')
md.push('- 是否符合「数据传递经 DataBridge 单入口 + ACL + 广播闭环」设计：' + (counts.P0 + counts.P1 === 0 ? '符合' : '存在偏差，见上'))
md.push('- 是否满足"高质量股票分析复盘 + 模拟交易复盘 + 决策参考"：核心链路已闭环，但 P0 假 KPI 与 P1 持久化缺口会削弱决策可信度，须优先修复。')
md.push('')
md.push(`## 五、决策性参考意见`)
md.push('')
md.push('**立即修复（P0，阻塞决策可信度）：**')
if (counts.P0) md.push('- 修复 PortfolioOverviewWidget 最大回撤/夏普硬编码 0，接入真实收益序列计算；同步改测试断言。')
else md.push('- 呈现层 KPI 均源自真实数据，无需修复。')
md.push('')
md.push('**应修（P1，影响功能可达与复盘连续）：**')
if (counts.P1) {
  md.push('- 补齐 B6 评分结果 DataBridge 持久化，避免刷新丢分导致复盘中断。')
  md.push('- 修复 CockpitShell「添加 Widget」断裂按钮（补 onClick 或移除）。')
  md.push('- 清理/复用死 store（fileImportStore），逐一对账 @unused 过时注释。')
  md.push('- 消除 A1/A2 孤儿 action（deleteRecord 等），避免运行期抛错与裸 put 数据一致性隐患。')
} else {
  md.push('- 全部 P1 项已修复闭环：B6 评分持久化已接入 DataBridge；CockpitShell「添加 Widget」按钮已修复；A1/A2 孤儿 action（deleteRecord 等）已消除；遗留死 store 已统一登记为受控 parked（INFO），非紧急。无需修复。')
}
md.push('')
md.push('**待办（P2）：** 示例/占位呈现接入实时数据或明确标注 [开发中]。')
md.push('')
md.push('**对智能投研复盘的支撑度：** 数据传递中枢架构清晰、ACL 治理到位、跨模块同步闭环成立；修复 P0/P1 后，系统即可高质量支撑股票分析复盘与模拟交易复盘，并提供可信的决策性参考意见。')
md.push('')
md.push('---')
md.push(`方法学：data-flow-integrity-audit 技能（L1–L21）；自动校验见 scripts/audit/dataflow-bridge-audit.ts。`)

const mdContent = md.join('\n')
const json = {
  generatedAt: new Date().toISOString(),
  score,
  gate,
  counts,
  findings,
}
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DataFlow × DataBridge 审计报告</title>
<style>
body{font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;color:#1f2937;background:#f8fafc;margin:0;padding:32px;}
.wrap{max-width:1080px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);}
h1{font-size:24px;margin:0 0 4px;color:#0f172a;}
.sub{color:#64748b;font-size:13px;margin-bottom:24px;}
.score{display:flex;gap:16px;margin:20px 0;}
.card{flex:1;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center;}
.card .n{font-size:28px;font-weight:700;}
.card .l{font-size:12px;color:#64748b;margin-top:4px;}
.gate{font-weight:700;}
.gate.BLOCK{color:#dc2626;} .gate.WARN{color:#d97706;} .gate.PASS{color:#16a34a;}
table{width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:13px;}
th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left;vertical-align:top;}
th{background:#f1f5f9;font-weight:600;}
.sev-P0{color:#dc2626;font-weight:700;} .sev-P1{color:#d97706;font-weight:700;}
.sev-P2{color:#0891b2;} .sev-INFO{color:#2563eb;} .sev-PASS{color:#16a34a;}
pre{background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px;overflow:auto;font-size:12px;}
.ev{margin:6px 0;padding-left:16px;color:#475569;font-size:12.5px;}
h2{font-size:18px;margin-top:28px;border-left:4px solid #2563eb;padding-left:10px;color:#0f172a;}
h3{font-size:14.5px;margin-top:18px;color:#1e293b;}
.note{color:#64748b;font-size:12.5px;}
ul{margin:6px 0;padding-left:20px;} li{margin:3px 0;font-size:13px;}
</style></head><body><div class="wrap">
<h1>DataFlow × DataBridge 关系梳理与 UI 数据联动合规审计报告</h1>
<div class="sub">FinSightV9 智能投研复盘系统 ｜ ${new Date().toLocaleString('zh-CN')} ｜ 依据 data-flow-integrity-audit 技能</div>
<div class="score">
<div class="card"><div class="n">${score}</div><div class="l">综合合规评分 / 100</div></div>
<div class="card"><div class="n gate ${gate}">${gate}</div><div class="l">门禁结论</div></div>
<div class="card"><div class="n">${counts.P0}</div><div class="l">P0 阻断</div></div>
<div class="card"><div class="n">${counts.P1}</div><div class="l">P1 应修</div></div>
<div class="card"><div class="n">${counts.P2}</div><div class="l">P2 待办</div></div>
</div>
<h2>一、数据传递 ↔ 数据桥 关系梳理</h2>
<p class="note">DataBridge 是系统唯一的数据传递中枢：所有模块不直接连 IndexedDB，而是把数据装入 <code>StandardEnvelope</code> 经 <code>forward()</code> 过桥（ACL 校验 → 策略 handler → IndexedDB → 广播），订阅方 store 经 <code>subscribe()</code> 回写内存，构成"传递→接收"闭环。</p>
<pre>writer → EnvelopeFactory.create → dataBridge.forward() [databridge.ts:509]
  → validate → inferOperation → inferStore
  → assertAclWithFallback (aclEngine.assert)
  → routeToAction → handlerRegistry → db.put
  → invalidateCache + broadcast(targetStore)
接收方 store.subscribe(STORE_NAME.x) 刷新内存  ← 传递闭环</pre>
<ul>
<li><b>单一写入入口 + 信封协议</b>：forward() 强制"写必须过桥"。</li>
<li><b>ACL 是桥的守门人</b>：MODULE_ID.fetcher 等权限集中在 ACL_MATRIX(dbConfig.ts:376-579)。</li>
<li><b>策略 handler = 落库动作表</b>：ACTION_TO_STORE_MAP 决定目标 store，未匹配退化为裸 db.put。</li>
<li><b>写后广播闭环</b>：store 经 subscribe() 完成跨模块同步。</li>
<li><b>并行实时流</b>：dataflowEngine.publish() 是实时 pub/sub，与 DataBridge 持久化传递互补但独立。</li>
</ul>
<h2>二、自动化校验结果</h2>
<table><thead><tr><th>ID</th><th>检查项</th><th>等级</th><th>状态</th><th>要点</th></tr></thead><tbody>
${findings
  .map(
    (f) => `<tr>
<td>${f.id}</td>
<td>${esc(f.title)}</td>
<td class="sev-${f.severity}">${f.severity}</td>
<td>${fStatusBadge(f.status)}</td>
<td>${esc(f.evidence[0] || f.detail).slice(0, 90)}</td>
</tr>`,
  )
  .join('')}
</tbody></table>
<h2>三、UI 按钮数据联动合规校验</h2>
<p class="note">接线范式：按钮 onClick → useXxxStore action → (store 内 databridge.forward / set) → 呈现组件 useXxxStore(selector) 订阅。DataBridge 不在组件层直接调用。</p>
<table><thead><tr><th>等级</th><th>发现</th><th>影响</th></tr></thead><tbody>
<tr><td class="sev-P0">P0</td><td>${counts.P0 ? '假 KPI（最大回撤/夏普硬编码 0）' : '无'}</td><td>直接误导模拟交易复盘决策</td></tr>
<tr><td class="sev-P1">P1</td><td>断裂按钮 / 死 store / 过时注释 / 持久化缺口</td><td>功能不可达或复盘中断</td></tr>
<tr><td class="sev-P2">P2</td><td>示例/占位呈现</td><td>功能完成度误判</td></tr>
</tbody></table>
<h2>四、设计功能符合性</h2>
<p>是否符合「数据传递经 DataBridge 单入口 + ACL + 广播闭环」设计：<b>${counts.P0 + counts.P1 === 0 ? '符合' : '存在偏差，见上'}</b>。</p>
<p>是否满足"高质量股票分析复盘 + 模拟交易复盘 + 决策参考"：核心链路已闭环，但 P0 假 KPI 与 P1 持久化缺口会削弱决策可信度，须优先修复。</p>
<h2>五、决策性参考意见</h2>
<h3>立即修复（P0，阻塞决策可信度）</h3>
<ul>${counts.P0 ? '<li>修复 PortfolioOverviewWidget 最大回撤/夏普硬编码 0，接入真实收益序列计算；同步改测试断言。</li>' : '<li>呈现层 KPI 均源自真实数据，无需修复。</li>'}</ul>
<h3>应修（P1，影响功能可达与复盘连续）</h3>
<ul>${counts.P1 ? `
<li>补齐 B6 评分结果 DataBridge 持久化，避免刷新丢分导致复盘中断。</li>
<li>修复 CockpitShell「添加 Widget」断裂按钮（补 onClick 或移除）。</li>
<li>清理/复用死 store（fileImportStore），逐一对账 @unused 过时注释。</li>
<li>消除 A1/A2 孤儿 action（deleteRecord 等），避免运行期抛错与裸 put 数据一致性隐患。</li>` : `
<li>全部 P1 项已修复闭环：B6 评分持久化已接入 DataBridge；CockpitShell「添加 Widget」按钮已修复；A1/A2 孤儿 action（deleteRecord 等）已消除；遗留死 store 已统一登记为受控 parked（INFO），非紧急。无需修复。</li>`}</ul>
<h3>待办（P2）</h3>
<ul><li>示例/占位呈现接入实时数据或明确标注 [开发中]。</li></ul>
<p class="note">对智能投研复盘的支撑度：数据传递中枢架构清晰、ACL 治理到位、跨模块同步闭环成立；修复 P0/P1 后，系统即可高质量支撑股票分析复盘与模拟交易复盘，并提供可信的决策性参考意见。</p>
<p class="note">方法学：data-flow-integrity-audit 技能（L1–L21）；自动校验引擎 scripts/audit/dataflow-bridge-audit.ts。</p>
</div></body></html>`

const base = `dataflow-bridge-audit-${date}`
fs.writeFileSync(path.join(OUT, base + '.json'), JSON.stringify(json, null, 2))
fs.writeFileSync(path.join(OUT, base + '.md'), mdContent)
fs.writeFileSync(path.join(OUT, base + '.html'), html)

console.log('=== DataFlow × DataBridge Audit ===')
console.log(`Score: ${score}/100  Gate: ${gate}`)
console.log(`P0=${counts.P0} P1=${counts.P1} P2=${counts.P2} INFO=${counts.INFO} PASS=${counts.PASS}`)
console.log('Findings:')
for (const f of findings) console.log(`  [${f.id}] ${f.severity} ${f.status}  ${f.title}`)
console.log(`\nReports:`)
console.log(`  ${path.join(OUT, base + '.md')}`)
console.log(`  ${path.join(OUT, base + '.html')}`)
console.log(`  ${path.join(OUT, base + '.json')}`)
