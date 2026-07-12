const fs = require('fs');
const path = require('path');

const GRAPH_PATH = path.join(__dirname, '..', 'docs', 'reports', 'code-graph.json');
const raw = fs.readFileSync(GRAPH_PATH, 'utf-8');
const graph = JSON.parse(raw);

const files = graph.files || [];
const BASE = 'C:\\Users\\huawei\\Documents\\kimi\\Workspaces\\智能投研复盘系统V9\\';

// Helper: normalize path to relative
function rel(p) {
  return p.replace(BASE, '').replace(/\\/g, '/');
}

// Build adjacency list (only relative/project imports)
const adj = new Map();       // file -> [imported files]
const reverseAdj = new Map(); // file -> [files that import it]
const allFiles = new Set();

for (const f of files) {
  const fromPath = rel(f.path);
  allFiles.add(fromPath);
  if (!adj.has(fromPath)) adj.set(fromPath, []);
  if (!reverseAdj.has(fromPath)) reverseAdj.set(fromPath, []);
}

// Resolve import "to" to actual file paths
function resolveImport(fromFile, toPath) {
  // Skip non-relative (external packages)
  if (!toPath.startsWith('.') && !toPath.startsWith('@/')) return null;

  const fromDir = path.dirname(fromFile).replace(/\\/g, '/');
  let resolved;
  if (toPath.startsWith('@/')) {
    resolved = path.posix.join('src', toPath.slice(2));
  } else {
    resolved = path.posix.join(fromDir, toPath);
  }
  resolved = resolved.replace(/\\/g, '/');

  // Try extensions
  const exts = ['.ts', '.tsx', '.js', '.jsx', ''];
  for (const ext of exts) {
    const candidate = resolved + ext;
    if (allFiles.has(candidate)) return candidate;
  }
  // Try index files
  for (const ext of exts) {
    const candidate = resolved + '/index' + ext;
    if (allFiles.has(candidate)) return candidate;
  }
  return null;
}

// Build graph edges
const edges = [];
for (const f of files) {
  const fromPath = rel(f.path);
  for (const imp of (f.imports || [])) {
    const resolved = resolveImport(fromPath, imp.to);
    if (resolved && resolved !== fromPath) {
      edges.push([fromPath, resolved]);
      adj.get(fromPath).push(resolved);
      if (!reverseAdj.has(resolved)) reverseAdj.set(resolved, []);
      reverseAdj.get(resolved).push(fromPath);
    }
  }
}

console.log(`\n========================================`);
console.log(`  依赖图分析报告`);
console.log(`========================================`);
console.log(`总文件数: ${allFiles.size}`);
console.log(`总边数(项目内依赖): ${edges.length}`);
console.log(``);

// ============ 1. 循环依赖检测 (DFS) ============
console.log(`--- 1. 循环依赖检测 ---`);
const WHITE = 0, GRAY = 1, BLACK = 2;
const color = new Map();
const parent = new Map();
const cycles = [];

for (const f of allFiles) color.set(f, WHITE);

function dfsCycle(u) {
  color.set(u, GRAY);
  for (const v of (adj.get(u) || [])) {
    if (color.get(v) === GRAY) {
      // Found cycle, trace back
      const cycle = [v, u];
      let cur = u;
      while (parent.has(cur) && parent.get(cur) !== v) {
        cur = parent.get(cur);
        cycle.push(cur);
      }
      cycle.reverse();
      cycles.push(cycle);
    } else if (color.get(v) === WHITE) {
      parent.set(v, u);
      dfsCycle(v);
    }
  }
  color.set(u, BLACK);
}

for (const f of allFiles) {
  if (color.get(f) === WHITE) dfsCycle(f);
}

if (cycles.length === 0) {
  console.log(`  ✅ 未发现循环依赖`);
} else {
  console.log(`  ❌ 发现 ${cycles.length} 个循环依赖:`);
  // Deduplicate cycles (normalize by smallest element)
  const seen = new Set();
  let shown = 0;
  for (const cycle of cycles) {
    const minIdx = cycle.indexOf(cycle.slice().sort()[0]);
    const normalized = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)].join(' -> ');
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    shown++;
    if (shown <= 20) {
      console.log(`    [${shown}] ${cycle.join(' -> ')} -> ${cycle[0]}`);
    }
  }
  if (shown > 20) console.log(`    ... 共 ${seen.size} 个循环 (仅显示前20个)`);
}

// ============ 2. 过深依赖链 (BFS longest path from each node) ============
console.log(`\n--- 2. 过深依赖链 (>5层) ---`);

// For each node, find max depth via BFS/DFS in DAG (or with cycle avoidance)
function maxDepth(start) {
  const visited = new Set();
  let maxD = 0;
  const stack = [[start, 0]];
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (depth > maxD) maxD = depth;
    if (depth > 15) continue; // cap
    visited.add(node);
    for (const next of (adj.get(node) || [])) {
      if (!visited.has(next)) {
        stack.push([next, depth + 1]);
      }
    }
  }
  return maxD;
}

const deepChains = [];
for (const f of allFiles) {
  const d = maxDepth(f);
  if (d > 5) {
    deepChains.push({ file: f, depth: d });
  }
}

deepChains.sort((a, b) => b.depth - a.depth);
if (deepChains.length === 0) {
  console.log(`  ✅ 未发现超过5层的依赖链`);
} else {
  console.log(`  ⚠️ 发现 ${deepChains.length} 个文件依赖链超过5层:`);
  for (const item of deepChains.slice(0, 30)) {
    console.log(`    ${item.file} → 最大深度 ${item.depth}`);
  }
  if (deepChains.length > 30) console.log(`    ... 共 ${deepChains.length} 个 (仅显示前30个)`);
}

// ============ 3. 扇出过大 (fan-out > 10) ============
console.log(`\n--- 3. 扇出过大的文件 (依赖>10个其他文件) ---`);
const highFanOut = [];
for (const [file, deps] of adj) {
  const uniqueDeps = new Set(deps);
  if (uniqueDeps.size > 10) {
    highFanOut.push({ file, count: uniqueDeps.size });
  }
}
highFanOut.sort((a, b) => b.count - a.count);

if (highFanOut.length === 0) {
  console.log(`  ✅ 未发现扇出超过10的文件`);
} else {
  console.log(`  ⚠️ 发现 ${highFanOut.length} 个文件扇出过大:`);
  for (const item of highFanOut) {
    console.log(`    ${item.file} → 扇出 ${item.count}`);
  }
}

// ============ 4. 孤立文件 ============
console.log(`\n--- 4. 孤立文件 (无导入也无被导入) ---`);
const orphans = [];
for (const f of allFiles) {
  const outDeg = new Set(adj.get(f) || []).size;
  const inDeg = new Set(reverseAdj.get(f) || []).size;
  if (outDeg === 0 && inDeg === 0) {
    orphans.push(f);
  }
}
orphans.sort();

if (orphans.length === 0) {
  console.log(`  ✅ 未发现孤立文件`);
} else {
  console.log(`  ⚠️ 发现 ${orphans.length} 个孤立文件:`);
  for (const f of orphans) {
    console.log(`    ${f}`);
  }
}

// ============ Summary ============
console.log(`\n========================================`);
console.log(`  汇总`);
console.log(`========================================`);
console.log(`循环依赖: ${cycles.length > 0 ? '❌ ' + cycles.length + ' 个' : '✅ 无'}`);
console.log(`过深依赖链(>5): ${deepChains.length > 0 ? '⚠️ ' + deepChains.length + ' 个文件' : '✅ 无'}`);
console.log(`扇出过大(>10): ${highFanOut.length > 0 ? '⚠️ ' + highFanOut.length + ' 个文件' : '✅ 无'}`);
console.log(`孤立文件: ${orphans.length > 0 ? '⚠️ ' + orphans.length + ' 个文件' : '✅ 无'}`);
