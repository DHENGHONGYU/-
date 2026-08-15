#!/usr/bin/env node
/**
 * batch-fix-broken-refs.cjs
 * 第五轮断链治理批量修复脚本
 *
 * 三大集群：
 *   1. Token脚本路径纯文本化（72条）
 *   2. 规范路径集群修正（201条）
 *   3. AGENTS.md路径修正（12条）
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

// 规范文件实际位置映射
const SPEC_LOCATIONS = {
  '06-routing-specs.md':           'docs/explanation/06-routing-specs.md',
  '03-architecture-standards.md':  'docs/explanation/03-architecture-standards.md',
  '05-engine-specs.md':            'docs/explanation/05-engine-specs.md',
  '02-functional-specs.md':        'docs/specs/02-functional-specs.md',
  '04-ui-ux-specs.md':             'docs/specs/04-ui-ux-specs.md',
  '08-implementation-plan.md':     'docs/guides/08-implementation-plan.md',
  '09-quality-gates.md':           'docs/guides/09-quality-gates.md',
  '10-glossary.md':                'docs/reference/10-glossary.md',
};

// Token脚本路径（已删除，纯文本化）
const TOKEN_PATHS = new Set([
  'scripts/generate-tokens.ts',
  'scripts/generate/generate-tokens.ts',
  'src/generated/tokens.ts',
  'src/generated/tokens.css',
]);

// 转义正则特殊字符
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 计算从source到target的正确相对路径
function calcCorrectRel(srcRelPath, targetActualPath) {
  const srcDir = path.dirname(path.join(ROOT, srcRelPath));
  const tgtFull = path.join(ROOT, targetActualPath);
  return path.relative(srcDir, tgtFull).replace(/\\/g, '/');
}

// 读取审计报告
const reportPath = path.join(ROOT, 'scripts', 'docs', 'reports', 'audit',
  'audit-doc-code-references-2026-08-15T13-45-36-928Z.json');
const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// 收集所有需要修复的引用，按source文件分组
const fixes = {};

for (const ref of data.brokenReferences) {
  const src = ref.source.replace(/\\/g, '/');
  const tgt = ref.target;

  // 1. Token脚本路径
  if (TOKEN_PATHS.has(tgt)) {
    if (!fixes[src]) fixes[src] = [];
    fixes[src].push({ line: ref.line, target: tgt, category: 'token' });
    continue;
  }

  // 2. 规范路径
  const basename = tgt.split('/').pop();
  if (SPEC_LOCATIONS[basename]) {
    const actualPath = SPEC_LOCATIONS[basename];
    const correctRel = calcCorrectRel(src, actualPath);
    // 检查correctRel是否和tgt不同（避免无效替换）
    if (correctRel !== tgt) {
      if (!fixes[src]) fixes[src] = [];
      fixes[src].push({
        line: ref.line, target: tgt, category: 'spec',
        basename, correctRel, oldTarget: tgt
      });
    }
    continue;
  }

  // 3. AGENTS.md路径修正
  if (tgt.endsWith('AGENTS.md') && tgt !== 'AGENTS.md') {
    // AGENTS.md在仓库根目录
    const correctRel = calcCorrectRel(src, 'AGENTS.md');
    if (correctRel !== tgt) {
      if (!fixes[src]) fixes[src] = [];
      fixes[src].push({
        line: ref.line, target: tgt, category: 'agents',
        correctRel, oldTarget: tgt
      });
    }
  }
}

// 执行修复
let totalFixed = 0;
let filesModified = 0;

for (const [src, refList] of Object.entries(fixes)) {
  const fullPath = path.join(ROOT, src);
  if (!fs.existsSync(fullPath)) {
    console.log('[SKIP] Not found: ' + src);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  let fixCount = 0;

  for (const fix of refList) {
    const lineIdx = fix.line - 1;
    if (lineIdx >= lines.length || lineIdx < 0) continue;
    let line = lines[lineIdx];
    let lineChanged = false;

    if (fix.category === 'token') {
      // 纯文本化：去掉反引号，去掉markdown链接
      const tokenPath = fix.target;
      const escToken = escapeRegex(tokenPath);

      // 1) [text](tokenPath) → text
      const mdLinkRe = new RegExp('\\](' + escToken + ')\\)', 'g');
      if (mdLinkRe.test(line)) {
        // This is tricky - we need to match the full [text](path) pattern
        const fullLinkRe = new RegExp('\\[([^\\]]*)\\]\\(' + escToken + '\\)', 'g');
        line = line.replace(fullLinkRe, '$1');
        lineChanged = true;
      }

      // 2) `tokenPath` → tokenPath
      const btRe = new RegExp('`' + escToken + '`', 'g');
      if (btRe.test(line)) {
        line = line.replace(btRe, tokenPath);
        lineChanged = true;
      }

      // 3) (tokenPath) → (tokenPath [已重构迁移])
      const parenRe = new RegExp('\\(' + escToken + '\\)', 'g');
      if (!lineChanged && parenRe.test(line)) {
        line = line.replace(parenRe, '(' + tokenPath + ' [已重构迁移])');
        lineChanged = true;
      }

    } else if (fix.category === 'spec' || fix.category === 'agents') {
      const oldTarget = fix.oldTarget;
      const correctRel = fix.correctRel;
      const escOld = escapeRegex(oldTarget);

      // 1) ](oldTarget) → ](correctRel)  (markdown link)
      const mdLinkRe = new RegExp('\\]\\(' + escOld + '\\)', 'g');
      if (mdLinkRe.test(line)) {
        line = line.replace(mdLinkRe, '](' + correctRel + ')');
        lineChanged = true;
      }

      // 2) `oldTarget` → `correctRel`  (backtick-wrapped)
      const btRe = new RegExp('`' + escOld + '`', 'g');
      if (btRe.test(line)) {
        line = line.replace(btRe, '`' + correctRel + '`');
        lineChanged = true;
      }

      // 3) bare oldTarget → correctRel (only if not already fixed above)
      if (!lineChanged) {
        // Use word-boundary-like matching to avoid partial replacements
        const bareRe = new RegExp('(?<![\\w/])' + escOld + '(?![\\w])', 'g');
        if (bareRe.test(line)) {
          line = line.replace(bareRe, correctRel);
          lineChanged = true;
        }
      }
    }

    if (lineChanged) {
      lines[lineIdx] = line;
      modified = true;
      fixCount++;
    }
  }

  if (modified) {
    fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
    filesModified++;
    totalFixed += fixCount;
    console.log('[FIXED] ' + src + ' (' + fixCount + ' fixes)');
  }
}

console.log('\n=== Summary ===');
console.log('Files modified: ' + filesModified);
console.log('Total fixes applied: ' + totalFixed);
