/**
 * audit-secrets.ts — 密钥/敏感信息扫描（SAST-lite，零依赖）
 * 用途：封装前门禁扫描源码与配置中的硬编码密钥/凭证，防止密钥泄露。
 * 运行：tsx scripts/audit/audit-secrets.ts
 * 退出码：0 = 未发现疑似密钥；1 = 发现疑似密钥（应阻断提交/推送）
 *
 * 注意：本脚本为"零依赖"实现，覆盖常见密钥形态；如需更强的语义/熵分析，
 * 后续可替换为 gitleaks（需 npm 安装）。当前作 WARN 接线，首次本地校验无误后
 * 再升级为 BLOCK（见 .husky/pre-commit、.husky/pre-push 注释）。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();

// 仅扫描源码与配置目录，排除噪声/生成物/依赖/备份/文档/测试夹具
const SCAN_DIRS = ['src', 'scripts', 'config', 'constants', 'core'];
const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', 'coverage', 'archive', 'backups', 'docs',
  'outputs', '_ref', 'cache', '.git', 'e2e', 'tests', 'packages',
  'deliverables', 'dev', 'llm-key-security-report', 'doc-governance-convergence-report',
]);
const EXCLUDE_EXT = new Set([
  '.md', '.json', '.lock', '.map', '.png', '.jpg', '.jpeg', '.svg',
  '.ttf', '.html', '.csv', '.log', '.css', '.pyc', '.snap',
]);

// 常见密钥/凭证形态
const PATTERNS: Array<[string, RegExp]> = [
  ['AWS Access Key ID', /AKIA[0-9A-Z]{16}/],
  ['AWS Secret Access Key', /aws_?secret_?access_?key\s*[:=]\s*['"]?[A-Za-z0-9/+]{40}/i],
  ['Private Key Block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['Google API Key', /AIza[0-9A-Za-z\-_]{35}/],
  ['Slack Token', /xox[baprs]-[0-9A-Za-z\-]{10,}/],
  ['GitHub Token', /\bgh[pousr]_[0-9A-Za-z]{36,}\b/],
  ['Generic Secret Assignment', /(password|passwd|secret|api[_-]?key|access[_-]?key|private[_-]?key|token)\s*[:=]\s*['"][A-Za-z0-9/+_]{24,}['"]/i],
];

// 明显占位符/示例行跳过，降低误报
const PLACEHOLDER_RE = /(example|placeholder|sample|your[-_ ]?|replace[-_ ]?me?|xxxx|dummy|fake|test[-_ ]?only|changeme|todo)/i;

interface Hit { file: string; line: number; rule: string; snippet: string; }

function walk(dir: string, hits: Hit[]): void {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(name)) continue;
      walk(full, hits);
    } else {
      const ext = extname(name).toLowerCase();
      if (EXCLUDE_EXT.has(ext) || name.endsWith('.d.ts')) continue;
      scanFile(full, hits);
    }
  }
}

function scanFile(file: string, hits: Hit[]): void {
  let content: string;
  try { content = readFileSync(file, 'utf8'); } catch { return; }
  const lines = content.split('\n');
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.length === 0 || PLACEHOLDER_RE.test(line)) return;
    for (const [rule, re] of PATTERNS) {
      if (re.test(line)) {
        hits.push({ file: relative(ROOT, file), line: i + 1, rule, snippet: raw.trim().slice(0, 120) });
        break;
      }
    }
  });
}

const hits: Hit[] = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), hits);

if (hits.length === 0) {
  console.log('✅ 密钥扫描通过：未发现疑似硬编码密钥/凭证。');
  process.exit(0);
} else {
  console.log(`\n🔑 密钥扫描发现 ${hits.length} 处疑似敏感信息：\n`);
  for (const h of hits) {
    console.log(`  ❌ [${h.rule}] ${h.file}:${h.line}`);
    console.log(`     ${h.snippet}`);
  }
  console.log('\n请确认是否为真实密钥；若为示例/占位符请加 example/placeholder 字样，或移出源码。');
  process.exit(1);
}
