#!/usr/bin/env node
/**
 * no-unsafe 系列规则自动化修复脚本（GOV-P1-02 实现）
 *
 * 严格遵循 V9-DOC-GUIDE-012：
 *   - 输入：`npx eslint src --ext .ts,.tsx --format json -o <report.json>`
 *   - 不直接写源码，输出 JSON Patch（.patch.json）+ dryrun summary（.md）
 *   - 覆盖模式 01/02/03/05/07/08/09/10/11/12（10 种，覆盖实际样本约 70%）
 *   - 模式 13/14 只输出候选报告（🛑 人工裁定，不生成补丁）
 *   - 模式 04/06 走报告（⚠️ 半自动，需要人判断目标类型 / 缺哪个 env key）
 *
 * 用法：
 *   node scripts/audit/apply-no-unsafe-fix-patterns.cjs <eslint-report.json> [--apply]
 *
 * 默认仅 dry-run；指定 --apply 才实际修改源码（应用前仍建议 git commit 存档）
 *
 * @doc [V9-DOC-GUIDE-012, V9-DOC-TECH-027, V9-DOC-GOV-003]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ──────────────────────────────────────────────────────────────────
// 0. 基础工具
// ──────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..', '..');
const toRel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/** 按顺序读文件每一行（不依赖外部包）*/
function readLines(full) {
  return fs.readFileSync(full, 'utf8').split(/\r?\n/);
}

/** 输出安全 JSON 摘要 */
function hash(str) {
  return crypto.createHash('sha1').update(str).digest('hex').slice(0, 10);
}

// ──────────────────────────────────────────────────────────────────
// 1. 输入校验
// ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');
const reportPath = args.find((a) => a && a[0] !== '-');

if (!reportPath) {
  console.error('用法：node apply-no-unsafe-fix-patterns.cjs <eslint-report.json> [--apply]');
  process.exit(2);
}

const reportFull = path.isAbsolute(reportPath) ? reportPath : path.resolve(process.cwd(), reportPath);
if (!fs.existsSync(reportFull)) {
  console.error(`找不到 eslint 报告：${reportFull}`);
  process.exit(2);
}

let eslintReport;
try {
  eslintReport = JSON.parse(
    fs.readFileSync(reportFull, 'utf8').replace(/^\uFEFF/, ''),
  );
} catch (err) {
  console.error('ESLint 报告 JSON 解析失败：', String(err && err.message || err));
  process.exit(2);
}

// ──────────────────────────────────────────────────────────────────
// 2. 按文件聚合 no-unsafe 条目
// ──────────────────────────────────────────────────────────────────
const RULE_PREFIX = '@typescript-eslint/no-unsafe-';

const fileEntries = [];
for (const f of eslintReport) {
  const messages = Array.isArray(f.messages) ? f.messages.filter(
    (m) => typeof m.ruleId === 'string' && m.ruleId.startsWith(RULE_PREFIX),
  ) : [];
  if (messages.length === 0) continue;
  const abs = path.resolve(f.filePath);
  if (!/^[A-Za-z]:/.test(abs) && !abs.startsWith('/')) continue;
  const isTest = /\.test\.(ts|tsx)$/.test(abs);
  fileEntries.push({ abs, rel: toRel(abs), isTest, messages });
}

fileEntries.sort((a, b) => b.messages.length - a.messages.length);
console.log(`[audit] 共 ${fileEntries.length} 个文件，` +
            `${fileEntries.reduce((s, x) => s + x.messages.length, 0)} 条 no-unsafe 违规`);

// ──────────────────────────────────────────────────────────────────
// 3. 模式匹配引擎（每类模式输出 0~N 条补丁）
//
// 补丁结构：
//   { op:'replace'|'insert'|'remove', line, startCol, endCol, text, patternId, reason }
// ──────────────────────────────────────────────────────────────────

/**
 * 生成补丁（统一接口）
 * 所有补丁均为 1 行内局部替换，避免跨行解析脆弱性
 */
const patterns = [];

// ─── 模式 03：new Array(n).fill(x) 泛型缺失 ──────────────────────
patterns.push({
  id: 'PAT-03',
  kind: 'auto',
  detect: (lineText) => {
    const matches = [];
    const re = /\b(new\s+Array\s*\(([^)]*)\)\s*\.\s*fill\s*\([^)]*\))/g;
    let m;
    while ((m = re.exec(lineText)) !== null) matches.push(m);
    return matches.map((m) => {
      const startCol = lineText.indexOf(m[1]);
      const endCol = startCol + m[1].length;
      // 已含泛型？如 new Array<number>(...) → 跳过
      const head = lineText.slice(0, startCol);
      if (/new\s+Array<[^>]+>\s*\($/.test(head + 'new Array(') && /<[^>]+>/.test(lineText.slice(Math.max(0, startCol - 20), startCol))) {
        return null;
      }
      const inner = m[2] || '';
      // 元素类型简单推断：看 .fill(字面量)
      let elemType = 'unknown';
      const fillMatch = m[1].match(/\.fill\(\s*(.+?)\s*\)$/);
      if (fillMatch) {
        const v = fillMatch[1].trim();
        if (/^-?\d+(\.\d+)?$/.test(v)) elemType = 'number';
        else if (/^['"`]/.test(v)) elemType = 'string';
        else if (/^(true|false|null)$/.test(v)) elemType = 'boolean | null';
      }
      const original = m[1];
      const replacement = original.replace(
        /new\s+Array\s*\(/,
        `new Array<${elemType}>(`,
      );
      return {
        line: -1, startCol, endCol,
        original, replacement,
        reason: `PAT-03 new Array 泛型化（推断元素类型=${elemType}）`,
      };
    }).filter(Boolean);
  },
});

// ─── 模式 02：`resp.json() / await response.json()` ─────────────
patterns.push({
  id: 'PAT-02',
  kind: 'semi',  // 半自动：当左侧显式接口类型 → 全自动；其他 → 报告
  detect: (lineText) => {
    // 模式 A：const T: Type = (await resp.json())
    const mA = lineText.match(
      /^(\s*const\s+\w+\s*:\s*([A-Za-z_][\w<>[\],\s|]*?)\s*=\s*)(await\s+[\w.]+\.json\s*\([^)]*\))(.*)$/,
    );
    if (mA) {
      const startCol = mA[1].length;
      const endCol = startCol + mA[3].length;
      return [{
        line: -1, startCol, endCol,
        original: mA[3],
        replacement: `(${mA[3]}) as ${mA[2].trim()}`,
        reason: `PAT-02-A resp.json 断言（左侧已显式类型：${mA[2].trim()}）`,
      }];
    }
    // 模式 B：裸赋值 const raw = await response.json()  后面接 wrapData(dataType, raw)
    // 此处改为 unknown 标注
    const mB = lineText.match(
      /^(\s*const\s+)(\w+)\s*(=\s*await\s+[\w.]+\.json\s*\([^)]*\))(.*)$/,
    );
    if (mB && !/:/.test(mB[0].slice(mB[0].indexOf(mB[2]), mB[0].indexOf(mB[2]) + mB[2].length + 2))) {
      const startCol = mB[1].length;
      const endCol = startCol + mB[2].length;
      return [{
        line: -1, startCol, endCol,
        original: mB[2],
        replacement: `${mB[2]}: unknown`,
        reason: 'PAT-02-B resp.json 加 : unknown 标注（后续由类型守卫消费）',
      }];
    }
    return [];
  },
});

// ─── 模式 01：`JSON.parse(x)` ─────────────────────────────────────
patterns.push({
  id: 'PAT-01',
  kind: 'semi',
  detect: (lineText) => {
    // A：const X: Type = JSON.parse(Y)  → 断言型
    const mA = lineText.match(
      /^(\s*const\s+\w+\s*:\s*([A-Za-z_][\w<>[\],\s|]*?)\s*=\s*)JSON\.parse\s*\(([^)]*)\)(.*)$/,
    );
    if (mA) {
      const startCol = mA[1].length;
      const orig = `JSON.parse(${mA[3]})`;
      return [{
        line: -1, startCol,
        endCol: startCol + orig.length,
        original: orig,
        replacement: `JSON.parse(${mA[3]}) as ${mA[2].trim()}`,
        reason: `PAT-01-A JSON.parse 断言左侧类型：${mA[2].trim()}`,
      }];
    }
    // B：fn(JSON.parse(x)) 作为参数直接传（只标注 unknown，避免断言过度）
    const mB = lineText.match(/JSON\.parse\s*\(([^)]*)\)/);
    if (mB && /return\s+Array\.isArray\(direct\)/.test(lineText)) return []; // 已修
    if (mB && !/as\s+[A-Za-z]/.test(lineText.slice(mB.index + mB[0].length))) {
      // 只在没有 : unknown 的行加 : unknown —— 将 `const var = JSON.parse(...)` 改写
      const mAsgn = lineText.match(
        /^(\s*const\s+)(\w+)\s*(=\s*JSON\.parse\s*\([^)]*\))/
      );
      if (mAsgn) {
        const startCol = mAsgn[1].length;
        const endCol = startCol + mAsgn[2].length;
        return [{
          line: -1, startCol, endCol,
          original: mAsgn[2],
          replacement: `${mAsgn[2]}: unknown`,
          reason: 'PAT-01-B JSON.parse 返回值加 : unknown 标注',
        }];
      }
    }
    return [];
  },
});

// ─── 模式 05：.catch(err) 中 err.message ─────────────────────────
patterns.push({
  id: 'PAT-05',
  kind: 'auto',
  detect: (lineText) => {
    const patches = [];
    // .catch((err) => { ... err.message ... })
    // 只替换 `err.message`，前提是没加 : unknown/Error
    const re = /\.catch\s*\(\s*\(\s*(\w+)\s*(?::\s*[^\)]*)?\)\s*=>\s*\{?/;
    const mm = lineText.match(re);
    if (!mm) return [];
    const varName = mm[1];
    const msgRe = new RegExp(`\\b${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.message\\b`, 'g');
    let mm2;
    while ((mm2 = msgRe.exec(lineText)) !== null) {
      const orig = mm2[0];
      patches.push({
        line: -1,
        startCol: mm2.index,
        endCol: mm2.index + orig.length,
        original: orig,
        replacement: `${varName} instanceof Error ? ${varName}.message : String(${varName})`,
        reason: 'PAT-05 catch err.message 用 instanceof Error 守卫',
      });
    }
    return patches;
  },
});

// ─── 模式 07：replace/map 回调参数类型 ─────────────────────────────
patterns.push({
  id: 'PAT-07',
  kind: 'auto',
  detect: (lineText) => {
    const patches = [];
    // .replace(/.../g, (_, c) => c.toUpperCase())
    // .replace(/.../g, (_m, body) => `"${body}"`)
    const cbRe = /\.replace\s*\(\s*\/[^\/]*\/\w*\s*,\s*\(\s*([^)]+?)\s*\)\s*=>/g;
    let m;
    while ((m = cbRe.exec(lineText)) !== null) {
      const params = m[1].split(',').map((s) => s.trim());
      const typed = params.map((p, i) => {
        if (/:/.test(p)) return p; // 已有类型
        if (p.startsWith('_')) return `${p}: string`;
        // 从 regex 捕获组位置默认 string，未知位 string 最通用
        return `${p}: string`;
      }).join(', ');
      const startCol = m.index + m[0].indexOf('(' + m[1]);
      const endCol = startCol + m[1].length;
      patches.push({
        line: -1, startCol, endCol,
        original: m[1], replacement: typed,
        reason: 'PAT-07 String.replace 回调参数类型补全',
      });
    }
    // .map((item) => ...) 无类型 → (item: unknown)
    const mapRe = /\.map\s*\(\s*\(\s*(\w+)\s*\)\s*=>/g;
    while ((m = mapRe.exec(lineText)) !== null) {
      const p = m[1];
      const startCol = m.index + m[0].indexOf('(' + p);
      const endCol = startCol + p.length;
      patches.push({
        line: -1, startCol, endCol,
        original: p, replacement: `${p}: unknown`,
        reason: 'PAT-07 .map 回调参数补 : unknown',
      });
    }
    return patches;
  },
});

// ─── 模式 08：XLSX.write(..., { type: 'array' }) ───────────────
patterns.push({
  id: 'PAT-08',
  kind: 'auto',
  detect: (lineText) => {
    const patches = [];
    const re = /XLSX\.write\s*\([^)]*type\s*:\s*['"](array|binary|buffer|string)['"][^)]*\)(?!\s+as )/g;
    let m;
    while ((m = re.exec(lineText)) !== null) {
      const mm = m[0].match(/type\s*:\s*['"](array|binary|buffer|string)['"]/);
      const typeStr = mm ? mm[1] : 'array';
      const cast = typeStr === 'array'  ? 'ArrayBuffer'
                 : typeStr === 'binary' ? 'string'
                 : typeStr === 'buffer' ? 'Buffer'
                 : 'string';
      patches.push({
        line: -1, startCol: m.index + m[0].length, endCol: m.index + m[0].length,
        original: '', replacement: ` as ${cast}`,
        reason: `PAT-08 XLSX.write type=${typeStr} 补 as ${cast}`,
      });
    }
    return patches;
  },
});

// ─── 模式 09：localStorage.getItem + JSON.parse(xxx) as Type ────
patterns.push({
  id: 'PAT-09',
  kind: 'semi',
  detect: (lineText) => {
    // `return stored ? JSON.parse(stored) : {}`
    const m = lineText.match(/^(\s*(?:return|const\s+\w+\s*=)\s*.*?\?\s*)JSON\.parse\s*\((\w+)\)(\s*:\s*[^?]+)/);
    if (m && /\{[^}]*\}$|\[\]$|0$|''$/.test(m[3])) {
      // 简单情况：从左值推断类型不现实，退而加 as ReturnType 容易错
      // 这里做标记（仅输出半自动候选）
      return [{
        line: -1, startCol: 0, endCol: 0,
        original: '', replacement: '',
        reason: 'PAT-09-SEMI localStorage.getItem+JSON.parse 候选：需人工看返回类型补断言',
        onlyReport: true,
      }];
    }
    return [];
  },
});

// ─── 模式 10：payload[0] / firstItem 显式 unknown ────────────────
patterns.push({
  id: 'PAT-10',
  kind: 'auto',
  detect: (lineText) => {
    const m = lineText.match(/^(\s*const\s+)(\w+)\s*(=\s*[A-Za-z_][\w.]*\[[\d'"]+\])$/);
    if (m) {
      // 没显式类型就加 : unknown
      return [{
        line: -1,
        startCol: m[1].length,
        endCol: m[1].length + m[2].length,
        original: m[2],
        replacement: `${m[2]}: unknown`,
        reason: 'PAT-10 索引裸取加 : unknown（避免 any 泄漏）',
      }];
    }
    return [];
  },
});

// ─── 模式 11：toSafeArray 返回值 as T[] ─────────────────────────
patterns.push({
  id: 'PAT-11',
  kind: 'auto',
  detect: (lineText) => {
    if (!/export\s+function\s+toSafeArray\s*<T>\s*\(/.test(lineText)) return [];
    // 不在声明行处理，在返回行处理
    return [];
  },
  // 返回行处理单独实现
});

// ─── 模式 12：process.env.XXX || default ─────────────────────────
patterns.push({
  id: 'PAT-12',
  kind: 'semi',
  detect: (lineText) => {
    const m = lineText.match(/^(.*\|\|)(\s*path\.join\(|.+)$/);
    if (!m || !/process\.env\.[A-Z_]+/.test(lineText)) return [];
    // 仅输出报告，避免把 `?? null` / `?? ''` 搞混
    return [{
      line: -1, startCol: 0, endCol: 0,
      original: '', replacement: '',
      reason: 'PAT-12-SEMI process.env + || 候选：根据返回签名裁定 ?? null 或 ?? + 显式空判断',
      onlyReport: true,
    }];
  },
});

// ─── 返回行模式：toSafeArray<T> return value ? value : [] ─────────
const returnLinePats = [];
returnLinePats.push({
  id: 'PAT-11-RET',
  kind: 'auto',
  detect: (lineText, ctx) => {
    if (!ctx || !ctx.isGenericArrayUtil) return [];
    const m = lineText.match(/^(\s*return\s+Array\.isArray\s*\(\s*(\w+)\s*\)\s*\?\s*(\w+)\s*:\s*\[\])/);
    if (!m) return [];
    const startCol = m[1].indexOf(m[3], m[1].indexOf('?') + 1);
    if (startCol < 0) return [];
    const endCol = startCol + m[3].length;
    return [{
      line: -1, startCol, endCol,
      original: m[3],
      replacement: `(${m[3]} as T[])`,
      reason: 'PAT-11 toSafeArray 返回值补 as T[]',
    }];
  },
});

// ──────────────────────────────────────────────────────────────────
// 4. 逐文件执行
// ──────────────────────────────────────────────────────────────────
const allPatchesByFile = {};
const reports = { auto: 0, semi: 0, manual: 0 };
const manualCandidates = [];

for (const ent of fileEntries) {
  const lines = readLines(ent.abs);
  const ctx = {
    isGenericArrayUtil: /export\s+function\s+toSafeArray\s*<T>\s*\(/.test(lines.join('\n')),
  };
  const patches = [];
  const patternTriggers = new Set();

  // 遍历模式
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    for (const pat of patterns) {
      const pList = (pat.detect(line) || []).filter(Boolean);
      for (const p of pList) {
        p.line = lineIdx + 1;
        p.patternId = pat.id;
        p.kind = pat.kind;
        if (p.onlyReport) {
          reports.semi++;
          manualCandidates.push({ rel: ent.rel, line: lineIdx + 1, reason: p.reason, patternId: pat.id });
          continue;
        }
        patches.push(p);
        patternTriggers.add(pat.id);
      }
    }
    for (const pat of returnLinePats) {
      const pList = (pat.detect(line, ctx) || []).filter(Boolean);
      for (const p of pList) {
        p.line = lineIdx + 1;
        p.patternId = pat.id;
        p.kind = pat.kind;
        patches.push(p);
        patternTriggers.add(pat.id);
      }
    }

    // 模式 13 候选：JSON.parse 接收外部变量 + 非 as Type 场景
    if (/JSON\.parse\s*\(\s*(?:filePath|data|text|json|raw|event\.data|args\.data|snapshotId|snapshot)/.test(line)) {
      if (!/as\s+[A-Z]/.test(line) && !/: unknown/.test(line)) {
        reports.manual++;
        manualCandidates.push({ rel: ent.rel, line: lineIdx + 1, reason: 'PAT-13-CANDIDATE JSON.parse 外部输入结构化校验候选', patternId: 'PAT-13' });
      }
    }
  }

  if (patches.length === 0 && patternTriggers.size === 0) continue;
  // 同位置补丁去重（同一列只保留第一个，避免冲突）
  const seen = new Set();
  const uniquePatches = [];
  for (const p of patches) {
    const key = `${p.line}:${p.startCol}:${p.endCol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniquePatches.push(p);
    if (p.kind === 'auto') reports.auto++; else reports.semi++;
  }
  allPatchesByFile[ent.abs] = {
    rel: ent.rel,
    isTest: ent.isTest,
    violationCount: ent.messages.length,
    patternTriggers: Array.from(patternTriggers),
    patches: uniquePatches.sort((a, b) => b.endCol - a.endCol), // 从右向左应用，避免列号失效
  };
}

// 模式 06：vite-env.d.ts 引用差集（单独处理）
// 先扫描 import.meta.env.VITE_ 全部引用，再对比 vite-env.d.ts
const envRefs = new Set();
for (const f of eslintReport) {
  const abs = path.resolve(f.filePath);
  try {
    const content = fs.readFileSync(abs, 'utf8');
    const re = /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g;
    let m;
    while ((m = re.exec(content)) !== null) envRefs.add(m[1]);
  } catch (_) { /* ignore */ }
}
const viteEnvPath = path.resolve(ROOT, 'src', 'vite-env.d.ts');
const envDecls = new Set();
if (fs.existsSync(viteEnvPath)) {
  const txt = fs.readFileSync(viteEnvPath, 'utf8').replace(/^\uFEFF/, '');
  const re = /VITE_[A-Z0-9_]+(?=\s*\??\s*:)/g;
  let m;
  while ((m = re.exec(txt)) !== null) envDecls.add(m[0]);
}
const missingEnvs = [];
for (const k of envRefs) {
  if (!envDecls.has(k)) missingEnvs.push(k);
}
if (missingEnvs.length) {
  reports.semi += missingEnvs.length;
  for (const k of missingEnvs) {
    manualCandidates.push({
      rel: 'src/vite-env.d.ts',
      patternId: 'PAT-06',
      reason: `PAT-06-MISSING 缺少环境变量类型声明 readonly ${k}?: string`,
    });
  }
}

// 模式 14：同文件 2+ JSON.parse 候选
for (const ent of fileEntries) {
  const content = fs.readFileSync(ent.abs, 'utf8');
  const count = (content.match(/JSON\.parse\s*\(/g) || []).length;
  if (count >= 2) {
    reports.manual++;
    manualCandidates.push({
      rel: ent.rel,
      patternId: 'PAT-14',
      reason: `PAT-14-DRY 同文件 ${count} 处 JSON.parse，建议抽取 parseXXX 辅助函数`,
    });
  }
}

// ──────────────────────────────────────────────────────────────────
// 5. 应用补丁到副本 / 或写 patch.json
// ──────────────────────────────────────────────────────────────────
const timestamp = new Date().toISOString().slice(0, 10);
const outDir = path.resolve(ROOT, 'scripts', 'audit', 'artifacts');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const patchFile = path.join(outDir, `nounsafe-patches-${timestamp}.json`);
const summaryFile = path.join(outDir, `nounsafe-dryrun-summary-${timestamp}.md`);

const patchBundle = [];
for (const abs of Object.keys(allPatchesByFile)) {
  const entry = allPatchesByFile[abs];
  const lines = readLines(abs);
  const applied = [];
  for (const p of entry.patches) {
    const lIdx = p.line - 1;
    const orig = lines[lIdx];
    const next = orig.slice(0, p.startCol) + p.replacement + orig.slice(p.endCol);
    lines[lIdx] = next;
    applied.push({ patternId: p.patternId, line: p.line, before: p.original, after: p.replacement, reason: p.reason });
  }
  patchBundle.push({
    file: entry.rel,
    hash_before: hash(fs.readFileSync(abs, 'utf8')),
    hash_after:  hash(lines.join('\n') + (fs.readFileSync(abs, 'utf8').endsWith('\n') ? '\n' : '')),
    content_after: lines.join('\n') + (fs.readFileSync(abs, 'utf8').endsWith('\n') ? '\n' : ''),
    applied,
  });
  if (!dryRun) {
    fs.writeFileSync(abs, lines.join('\n') + (fs.readFileSync(abs, 'utf8').endsWith('\n') ? '\n' : ''), 'utf8');
  }
}
fs.writeFileSync(patchFile, JSON.stringify(patchBundle, null, 2), 'utf8');

// ──────────────────────────────────────────────────────────────────
// 6. 写 Summary
// ──────────────────────────────────────────────────────────────────
const totalAuto = Object.values(allPatchesByFile).reduce((s, e) => s + e.patches.filter(p => p.kind === 'auto').length, 0);
const totalSemi = Object.values(allPatchesByFile).reduce((s, e) => s + e.patches.filter(p => p.kind === 'semi').length, 0);
const md = [];
md.push(`# no-unsafe 自动化修复 Dry-Run 汇总 (${timestamp})`);
md.push('');
md.push(`| 分类 | 数量 |`);
md.push(`|------|------|`);
md.push(`| ✅ 自动补丁（模式 02/03/05/07/08/10） | ${reports.auto} |`);
md.push(`| ⚠️ 半自动候选（模式 01/02B/09/12） | ${reports.semi} |`);
md.push(`| 🛑 人工裁定（模式 13/14） | ${reports.manual} |`);
md.push('');
md.push(`补丁文件：\`${toRel(patchFile)}\``);
md.push('');
md.push('## 一、自动补丁覆盖明细（可直接 --apply）');
md.push('');
for (const e of patchBundle.slice().sort((a, b) => b.applied.length - a.applied.length)) {
  if (e.applied.length === 0) continue;
  md.push(`### ${e.file}（${e.applied.length} 处）`);
  for (const p of e.applied) md.push(`- L${p.line} \`${p.patternId}\` ${p.reason}`);
  md.push('');
}
md.push('## 二、半自动 / 人工候选项');
md.push('');
for (const c of manualCandidates) md.push(`- \`${c.rel}\` L${c.line || '?'}  **${c.patternId}**  ${c.reason}`);
md.push('');
md.push('## 三、后续指令');
md.push('');
md.push('- 确认补丁：`node scripts/audit/apply-no-unsafe-fix-patterns.cjs <report.json> --apply`');
md.push('- 应用后务必 `npx tsc:prod` + 受影响域测试');
md.push('- 每类 PAT-13/14 都需人工在 PR review 时二次裁定');
fs.writeFileSync(summaryFile, md.join('\n'), 'utf8');

// ──────────────────────────────────────────────────────────────────
// 7. 终端输出摘要
// ──────────────────────────────────────────────────────────────────
console.log('');
console.log(`📝 补丁清单写入     → ${toRel(patchFile)}`);
console.log(`📊 Dry-run 汇总写入 → ${toRel(summaryFile)}`);
console.log('');
console.log(`✅ 自动生成 patch:      ${reports.auto} 条`);
console.log(`⚠️  半自动待人工裁定:   ${reports.semi} 条`);
console.log(`🛑  人工重构(结构化/DRY): ${reports.manual} 条`);
console.log('');
if (dryRun) {
  console.log('当前为 DRY-RUN，未写入任何源码文件。确认后执行：');
  console.log(`  node ${toRel(__filename)} ${reportPath} --apply`);
} else {
  console.log('⚠️  已实际写入源码文件。请立即执行：');
  console.log('  npm run tsc:prod');
  console.log('  npx eslint <修复的文件> --rule @typescript-eslint/no-unsafe-assignment:error');
}
