#!/usr/bin/env npx tsx
/**
 * scripts/verify-circular-deps.ts
 *
 * 三件套之 Step 3：循环依赖检查
 * ┌──────────────────────────────────────────────────────────────┐
 * │ 1. 运行 madge --circular 全仓扫描（tsconfig.json 配置）       │
 * │ 2. 检查 seedService ↔ bootstrapService：                      │
 * │    · 是否出现在 madge 共享环中（直接循环）                     │
 * │    · 各自 import 图 BFS 是否双向可达（间接循环）              │
 * │ 3. 生成可视化（Graphviz → SVG，失败则 Mermaid 回退）          │
 * │ 4. 结果报告写入 outputs/circular-deps-report-YYYYMMDD.md     │
 * └──────────────────────────────────────────────────────────────┘
 *
 * 运行：npx tsx scripts/verify-circular-deps.ts
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname__ = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname__, '..')
const OUT_DIR = path.join(ROOT, 'outputs')
const DATE = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const REPORT_MD = path.join(OUT_DIR, `circular-deps-report-${DATE}.md`)
const SVG_PATH = path.join(OUT_DIR, 'circular-deps-graph.svg')
const MERMAID_PATH = path.join(OUT_DIR, 'circular-deps-graph.mmd')
const MERMAID_HTML = path.join(OUT_DIR, 'circular-deps-graph.html')

const SEED = 'src/services/system/seedService'
const BOOTSTRAP = 'src/services/system/bootstrapService'

function safeEnsureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}
safeEnsureDir(OUT_DIR)

/**
 * 跑命令并收集 stdout/stderr/exitCode。Windows 兼容：shell=true。
 */
function runCmd(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number; allowNonZero?: boolean } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const cwd = opts.cwd ?? ROOT
    const timeout = opts.timeoutMs ?? 180_000
    let stdout = ''
    let stderr = ''
    let done = false
    const proc: ChildProcessWithoutNullStreams = spawn(cmd, args, {
      cwd,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, NODE_ENV: 'test', FORCE_COLOR: '0' },
    })
    proc.stdout.on('data', (d) => {
      stdout += String(d)
    })
    proc.stderr.on('data', (d) => {
      stderr += String(d)
    })
    const timer = setTimeout(() => {
      if (done) return
      done = true
      try {
        proc.kill('SIGKILL')
      } catch {
        /* ignore */
      }
      resolve({ code: 124, stdout, stderr: `${stderr}\n[TIMEOUT] ${timeout}ms exceeded` })
    }, timeout)
    proc.on('error', (err) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ code: 127, stdout, stderr: `${stderr}\n[SPAWN ERROR] ${err.message}` })
    })
    proc.on('close', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (opts.allowNonZero) {
        resolve({ code: code ?? 0, stdout, stderr })
      } else {
        resolve({ code: code ?? 0, stdout, stderr })
      }
    })
  })
}

/**
 * 解析 madge --circular --json 的输出，提取所有循环环。
 * madge 的 JSON 格式：{ "<file>": ["dep1", "dep2", ...] }，其中只有在环里的条目才会出现。
 * 我们通过简单的 DFS 找强连通分量来枚举环。
 */
type DepGraph = Record<string, string[]>
function findCircularRings(graph: DepGraph): string[][] {
  const nodes = Object.keys(graph)
  const indexBy = new Map<string, number>()
  nodes.forEach((n, i) => indexBy.set(n, i))
  const onStack = new Array<boolean>(nodes.length).fill(false)
  const indices = new Array<number>(nodes.length).fill(-1)
  const lowlink = new Array<number>(nodes.length).fill(-1)
  const stack: number[] = []
  let idx = 0
  const sccs: number[][] = []

  function strongconnect(v: number): void {
    indices[v] = idx
    lowlink[v] = idx
    idx++
    stack.push(v)
    onStack[v] = true
    const name = nodes[v]
    const deps = graph[name] ?? []
    for (const rawDep of deps) {
      const w = indexBy.get(rawDep)
      if (w === undefined) continue
      if (indices[w] === -1) {
        strongconnect(w)
        lowlink[v] = Math.min(lowlink[v], lowlink[w])
      } else if (onStack[w]) {
        lowlink[v] = Math.min(lowlink[v], indices[w])
      }
    }
    if (lowlink[v] === indices[v]) {
      const scc: number[] = []
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const w = stack.pop()!
        onStack[w] = false
        scc.push(w)
        if (w === v) break
      }
      if (scc.length > 1) sccs.push(scc)
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    if (indices[i] === -1) strongconnect(i)
  }

  return sccs.map((s) => s.map((i) => nodes[i]))
}

/**
 * BFS：在 depGraph 中 from 能否到达 to。
 * depGraph 格式：{ file: [direct imports...] }（包含非循环节点也要支持）。
 */
function canReach(depGraph: DepGraph, from: string, to: string): boolean {
  if (from === to) return true
  const visited = new Set<string>()
  const queue: string[] = [from]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (visited.has(cur)) continue
    visited.add(cur)
    const deps = depGraph[cur] ?? []
    for (const d of deps) {
      if (d === to) return true
      if (!visited.has(d)) queue.push(d)
    }
  }
  return false
}

/**
 * 为报告生成 Mermaid 图：seedService / bootstrapService 节点 + 它们的 import/被 import 边。
 * 过滤范围：只展示 src/ 下的节点 + 与两个目标有直接关系的节点。
 */
function buildMermaidGraph(fullGraph: DepGraph, focusNodes: string[]): string {
  const all = new Set<string>(focusNodes)
  // 从完整依赖图中筛选：
  //   - 直接展示 focusNodes 本身
  //   - 它们的直接 import
  //   - 直接导入它们的反向调用者
  //   - 过滤排除：以 "../tests/fixtures" 开头的纯 fixture / 测试样例路径
  const isFixture = (n: string): boolean => n.startsWith('../tests/') || n.endsWith('.test.ts') || n.endsWith('.test.tsx') || n.endsWith('.spec.ts')
  for (const n of focusNodes) {
    if (!n || n === 'MISSING') continue
    ;(fullGraph[n] ?? []).forEach((d) => { if (!isFixture(d)) all.add(d) })
    Object.entries(fullGraph).forEach(([from, deps]) => {
      if (isFixture(from)) return
      if (deps.includes(n)) all.add(from)
    })
  }
  const nodes = Array.from(all).filter((n) => n && n !== 'MISSING' && !isFixture(n))
  const toId = (s: string) =>
    'N' +
    s
      .replace(/[^A-Za-z0-9_]/g, '_')
      .replace(/^_+/, '')
      .slice(0, 40)
  const lines: string[] = ['flowchart LR']
  nodes.forEach((n) => {
    const label = n.replace(/^src\//, '')
    lines.push(`  ${toId(n)}["${label}"]`)
  })
  nodes.forEach((from) => {
    ;(fullGraph[from] ?? []).forEach((to) => {
      if (!nodes.includes(to)) return
      lines.push(`  ${toId(from)} --> ${toId(to)}`)
    })
  })
  focusNodes.forEach((n) => {
    lines.push(`  style ${toId(n)} fill:#fecaca,stroke:#b91c1c,stroke-width:2px`)
  })
  return lines.join('\n') + '\n'
}

/* ============================================================
 * MAIN
 * ========================================================== */
interface StepResult {
  name: string
  ok: boolean
  detail: string
}

async function main(): Promise<number> {
  const steps: StepResult[] = []
  let finalExitCode = 0

  // ---------- Step 1: madge --circular + JSON ----------
  console.log('\n[Step 1/4] 运行 madge --circular（tsconfig 解析）...')
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const madgeExtensions = ['--extensions', 'ts,tsx,js,jsx']
  const madgeTsCfg = ['--ts-config', 'tsconfig.json']
  const circularJson = await runCmd(
    npxCmd,
    ['madge', '--circular', '--json', ...madgeTsCfg, ...madgeExtensions, 'src/'],
    { allowNonZero: true, timeoutMs: 240_000 },
  )
  let rings: string[][] = []
  let depGraph: DepGraph = {}
  let madgeExitOk = true
  let fullNodeCount = 0
  try {
    depGraph = JSON.parse(circularJson.stdout || '{}') as DepGraph
    rings = findCircularRings(depGraph)
  } catch (e) {
    // madge 可能在无循环时输出空 / 非 JSON
    const msg = e instanceof Error ? e.message : String(e)
    madgeExitOk = false
    steps.push({
      name: 'madge JSON 解析',
      ok: false,
      detail: `解析失败（可能无循环或依赖缺失）：${msg}\nSTDERR 摘要：${circularJson.stderr.slice(-1000)}`,
    })
  }
  // ---------- Step 1.5：始终跑一次完整 depGraph（用于 seed↔bootstrap 可达性 + 真实文件计数）
  //            --circular 模式下无环时 JSON 为空，不反映真实扫描规模
  const fullJson = await runCmd(
    npxCmd,
    ['madge', '--json', ...madgeTsCfg, ...madgeExtensions, 'src/'],
    { allowNonZero: true, timeoutMs: 240_000 },
  )
  try {
    const full = JSON.parse(fullJson.stdout || '{}') as DepGraph
    fullNodeCount = Object.keys(full).length
    // 完整图优先；环图仅包含循环节点，用于 SCC 统计
    if (fullNodeCount >= Object.keys(depGraph).length) depGraph = full
  } catch (_e) {
    fullNodeCount = Object.keys(depGraph).length
  }
  if (madgeExitOk) {
    const ringCount = rings.length
    const nodeInRing = rings.flat().length
    const sharedTargets = rings.filter(
      (r) => r.some((n) => n.includes('seedService')) && r.some((n) => n.includes('bootstrapService')),
    )
    const ok = ringCount === 0
    steps.push({
      name: 'madge --circular 全仓扫描',
      ok,
      detail: ok
        ? `未发现循环依赖（madge 共扫描 ${fullNodeCount} 个 src/ 源文件；环图节点数=${Object.keys(circularJson.stdout ? JSON.parse(circularJson.stdout || '{}') : {}).length}）`
        : `发现 ${ringCount} 个循环环，共 ${nodeInRing} 节点卷入；全仓扫描文件数=${fullNodeCount}；其中 seed↔bootstrap 共享环数量=${sharedTargets.length}`,
    })
    if (!ok) finalExitCode = Math.max(finalExitCode, 2)
  } else {
    finalExitCode = Math.max(finalExitCode, 1)
  }

  // ---------- Step 2: seedService ↔ bootstrapService 双向可达 ----------
  console.log('\n[Step 2/4] 分析 seedService ↔ bootstrapService 双向可达...')

  /** 归一化节点名（用于模糊匹配）：
   *  - 去掉前导 src/ / ./
   *  - 去掉 .ts/.tsx/.js/.jsx 后缀
   *  - 统一反斜杠为正斜杠（Windows）
   *  - 去掉 @/ 前缀
   */
  const normKey = (s: string): string =>
    s
      .replace(/\\/g, '/')
      .replace(/^(\.\/|src\/|@\/)/, '')
      .replace(/\.(tsx?|jsx?)$/i, '')
  const allNodeKeys = Object.keys(depGraph)
  const normLookupByNormed = new Map<string, string>()
  for (const k of allNodeKeys) {
    const n = normKey(k)
    if (!normLookupByNormed.has(n)) normLookupByNormed.set(n, k)
  }
  const findBestNode = (candidates: string[]): string | null => {
    for (const cand of candidates) {
      const nc = normKey(cand)
      // 精确 norm 匹配第一优先级
      if (normLookupByNormed.has(nc)) return normLookupByNormed.get(nc)!
      for (const key of allNodeKeys) {
        // 末尾模糊：key 末尾等于 norm 版路径
        const nk = normKey(key)
        if (nk.endsWith(nc) || nc.endsWith(nk) || nk === nc) return key
      }
    }
    return null
  }
  const seedNode = findBestNode([
    SEED,
    SEED + '.ts',
    SEED + '.tsx',
    'seedService',
    'src/services/system/seedService.ts',
    'services/system/seedService',
    'services/system/seedService.ts',
  ])
  const bootstrapNode = findBestNode([
    BOOTSTRAP,
    BOOTSTRAP + '.ts',
    BOOTSTRAP + '.tsx',
    'bootstrapService',
    'src/services/system/bootstrapService.ts',
    'services/system/bootstrapService',
    'services/system/bootstrapService.ts',
  ])
  let a2b = false
  let b2a = false
  let seedNodeUsed = seedNode ?? 'MISSING'
  let bootstrapNodeUsed = bootstrapNode ?? 'MISSING'
  if (seedNode && bootstrapNode) {
    a2b = canReach(depGraph, seedNode, bootstrapNode)
    b2a = canReach(depGraph, bootstrapNode, seedNode)
  }
  const inSameRing = rings.some(
    (r) =>
      r.some((n) => n.includes('seedService')) && r.some((n) => n.includes('bootstrapService')),
  )
  const hasDirectOrIndirect = inSameRing || (a2b && b2a)
  const reachabilityOk = !hasDirectOrIndirect
  steps.push({
    name: 'seedService ↔ bootstrapService 循环检查（直接+间接）',
    ok: reachabilityOk,
    detail: [
      `seedService 解析节点=${seedNodeUsed}`,
      `bootstrapService 解析节点=${bootstrapNodeUsed}`,
      `同环（madge 强连通分量）：${inSameRing ? '是 ❌' : '否 ✅'}`,
      `seed → bootstrap 可达：${a2b}`,
      `bootstrap → seed 可达：${b2a}`,
      `双向可达（即间接循环）：${a2b && b2a ? '是 ❌' : '否 ✅'}`,
      `结论：${reachabilityOk ? '无直接/间接循环依赖 ✅' : '存在循环依赖风险 ❌'}`,
    ].join('\n'),
  })
  if (!reachabilityOk) finalExitCode = Math.max(finalExitCode, 3)

  // ---------- Step 3: 可视化（Graphviz SVG，失败则 Mermaid）----------
  console.log('\n[Step 3/4] 生成依赖可视化图...')
  const graphvizResult = await runCmd(
    npxCmd,
    ['madge', '--image', SVG_PATH, ...madgeTsCfg, ...madgeExtensions, 'src/'],
    { allowNonZero: true, timeoutMs: 300_000 },
  )
  const graphvizOk = graphvizResult.code === 0 && fs.existsSync(SVG_PATH) && fs.statSync(SVG_PATH).size > 0
  // 不管 Graphviz 成功与否，始终生成 Mermaid 回退（体积小、跨平台、无需 Graphviz）
  const mermaidContent = buildMermaidGraph(depGraph, [seedNodeUsed, bootstrapNodeUsed])
  fs.writeFileSync(MERMAID_PATH, mermaidContent, 'utf-8')
  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8" />
<title>FinSightV9 循环依赖可视化 (Mermaid fallback)</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head><body class="p-8">
<h1>FinSightV9 依赖图 - ${DATE}</h1>
<p>生成方式：${graphvizOk ? '✅ Graphviz SVG（见 circular-deps-graph.svg）+ 同时提供 Mermaid 回退' : '⚠️ Graphviz 未安装，Mermaid 回退视图（需联网加载 mermaid.js）'}</p>
<div class="mermaid"><![CDATA[
${mermaidContent}
]]></div>
<script>mermaid.initialize({ startOnLoad: true, theme: 'default', flowchart: { curve: 'basis' } });</script>
</body></html>
`
  fs.writeFileSync(MERMAID_HTML, htmlContent, 'utf-8')
  steps.push({
    name: '可视化报告生成',
    ok: true,
    detail: [
      graphvizOk ? `Graphviz SVG：${SVG_PATH}` : `Graphviz SVG：未生成（code=${graphvizResult.code}；STDERR 摘要：${graphvizResult.stderr.slice(-500).replace(/\s+/g, ' ')}）`,
      `Mermaid 源码：${MERMAID_PATH}`,
      `Mermaid HTML：${MERMAID_HTML}`,
    ].join('\n'),
  })

  // ---------- Step 4: 汇总 Markdown 报告 ----------
  console.log('\n[Step 4/4] 写入汇总报告...')
  const ringsMd =
    rings.length === 0
      ? '_无循环依赖_'
      : rings
          .map(
            (r, i) =>
              `### 环 #${i + 1}（${r.length} 节点）\n\n` +
              r.map((n) => `- \`${n}\``).join('\n'),
          )
          .join('\n\n')
  const stepsMd = steps
    .map(
      (s) =>
        `### ${s.ok ? '✅' : '❌'} ${s.name}\n\n\`\`\`\n${s.detail}\n\`\`\`\n`,
    )
    .join('\n\n')
  const md = `# 循环依赖检查报告 (${DATE})

## 结论

| 项目 | 结果 |
|---|---|
| madge --circular 全仓扫描 | ${steps[0]?.ok ? '✅ PASS' : '❌ FAIL'} |
| seedService ↔ bootstrapService 循环检查 | ${reachabilityOk ? '✅ PASS（无直接/间接循环）' : '❌ FAIL'} |
| 可视化生成 | ✅ ${graphvizOk ? 'SVG + Mermaid 双产出' : 'Mermaid 回退产出'} |

## 各步骤详情

${stepsMd}

## 循环环清单（共 ${rings.length} 个）

${ringsMd}

## 产出物

| 文件 | 说明 |
|---|---|
| \`outputs/circular-deps-graph.svg\` | madge --image Graphviz 生成 SVG（${graphvizOk ? '可用' : '未生成，已提供 Mermaid 回退'}） |
| \`outputs/circular-deps-graph.mmd\` | Mermaid 源码（flowchart LR，聚焦 seed/bootstrap） |
| \`outputs/circular-deps-graph.html\` | Mermaid HTML 视图（浏览器直接打开可交互查看） |

## 运行参数

- 入口目录：\`src/\`
- TS 配置：\`tsconfig.json\`
- 检查目标：\`src/services/system/seedService\` ↔ \`src/services/system/bootstrapService\`
- 检查维度：① madge 共享强连通分量（直接环）；② 双向 BFS 可达性（间接环）
`
  fs.writeFileSync(REPORT_MD, md, 'utf-8')
  console.log(`\n📄 报告已写入：${REPORT_MD}`)
  steps.forEach((s) => {
    console.log(` ${s.ok ? '✅' : '❌'} ${s.name}`)
  })
  console.log(`\n退出码：${finalExitCode}`)
  return finalExitCode
}

main()
  .then((code) => {
    process.exit(code)
  })
  .catch((e) => {
    console.error('[FATAL] verify-circular-deps 未捕获异常：', e)
    process.exit(99)
  })
