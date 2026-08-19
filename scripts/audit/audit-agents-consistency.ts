/**
 * @module audit-agents-consistency
 * @description AGENTS.md 契约 ↔ 代码真相源 交叉一致性审计（零依赖）
 *
 * 背景：AGENTS.md 中大量「X 条」「当前 Y 项」「DB_VERSION = N」这类硬编码数字断言，
 * 当代码事实变更后极易漂移，形成「契约写 53、真相源实际 54」的假绿灯问题。
 * 本脚本自动对比下列七组一致性，P0 漂移 → exit 1 阻断提交。
 *
 * 校验项：
 *   A1 (P0) DB_VERSION         →  dbConfig.ts vs AGENTS.md 宣称数字
 *   A2 (P0) STORE_NAME 总数    →  dbConfig.ts 真实 key 数 vs AGENTS.md 宣称"共 X 项"/"X Store"
 *   A3 (P0) MCP Registry 矩阵  →  mcpServerRegistry.ts 总条目/启用数/禁用数 vs AGENTS.md 宣称
 *   A4 (P0) USER_SCENES 场景数 →  cockpit.constants.ts 实际项 vs AGENTS.md 文档映射
 *   A5 (P1) AGENTS frontmatter →  version / status / last_updated 三字段齐全且格式合法
 *   A6 (P1) last_updated 未来  →  防手滑写错日期（仅警告）
 *   A7 (P1) tsc 双配置存在性  →  tsconfig.prod.json + tsconfig.test.json 两文件均存在
 *
 * 退出码：
 *   0 = 全部通过（P0 零违规；P1 可能有警告）
 *   1 = 存在 P0 违规（必须阻断提交 / CI）
 *
 * CLI 参数：
 *   --strict   将 P1 也视为退出码 1（用于 CI 夜间/发布门禁）
 *   --json     以 JSON 形式输出结果对象（便于聚合）
 *   --changed  仅在"暂存区包含 AGENTS.md 或任一真相源"时才真正运行，否则直接 exit 0
 *              （用于 husky 预提交，避免无关提交被反复拖慢）
 *
 * @example
 *   npm run audit:agents-consistency           # 日常/CI 全量
 *   npm run audit:agents-consistency -- --changed  # husky 条件触发
 *   npm run audit:agents-consistency -- --strict   # 发布门禁 P1 也拦截
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, normalize, relative, sep } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();

// ─────────────────────────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────────────────────────
type Level = 'P0' | 'P1';
interface Violation {
  id: string;
  level: Level;
  item: string;
  message: string;
  expected?: string;
  actual?: string;
}
interface Truth {
  dbVersion: number;
  storeNameKeys: number;
  mcpTotal: number;
  mcpEnabled: number;
  mcpDisabled: number;
  userScenes: number;
  userSceneIds: string[];
}
interface Claimed {
  dbVersion?: number;
  storeCount?: number;
  mcpTotal?: number;
  mcpEnabled?: number;
  mcpDisabled?: number;
  userSceneCount?: number;
  userSceneIds: string[];
}
interface Frontmatter {
  version?: string;
  status?: string;
  lastUpdated?: string;
}
interface Result {
  ok: boolean;
  strictOk: boolean;
  passed: string[];
  violations: Violation[];
  truth: Truth;
  claimed: Claimed;
  frontmatter: Frontmatter;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI 参数解析（极简，避免依赖 minimist）
// ─────────────────────────────────────────────────────────────────────────────
const ARGV = new Set(process.argv.slice(2));
const STRICT = ARGV.has('--strict');
const JSON_OUT = ARGV.has('--json');
const CHANGED_ONLY = ARGV.has('--changed');

// ─────────────────────────────────────────────────────────────────────────────
// 真相源文件集合（用于 --changed 快路径过滤）
// ─────────────────────────────────────────────────────────────────────────────
const TRUTH_SOURCE_FILES = [
  'AGENTS.md',
  'src/config/dbConfig.ts',
  'src/config/mcpServerRegistry.ts',
  'src/constants/cockpit.constants.ts',
  'tsconfig.prod.json',
  'tsconfig.test.json',
];

// ─────────────────────────────────────────────────────────────────────────────
// 工具：读取文件（绝对路径），不存在抛错或返回默认
// ─────────────────────────────────────────────────────────────────────────────
function safeRead(p: string): string {
  const abs = normalize(join(ROOT, p));
  if (!existsSync(abs)) return '';
  return readFileSync(abs, 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// --changed 模式：检查暂存区是否有任一真相源文件
// ─────────────────────────────────────────────────────────────────────────────
function stagedTouchesTruth(): boolean {
  try {
    const out = execSync('git diff --cached --name-only', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return false;
    const staged = new Set(
      out.split(/\r?\n/).map((s) => s.replace(/\//g, sep).toLowerCase())
    );
    return TRUTH_SOURCE_FILES.some((f) =>
      staged.has(f.replace(/\//g, sep).toLowerCase())
    );
  } catch {
    // 非 git 环境 / git 命令失败 → 保守地继续完整审计
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 从 TS 常量对象 { key: 'val', ... } 中提取 key 列表（匹配 audit-db-references.ts 算法）
// ─────────────────────────────────────────────────────────────────────────────
function parseObjectKeys(
  content: string,
  objectName: string
): { keys: string[]; start: number; end: number } {
  const re = new RegExp(
    `export\\s+(?:const|let)\\s+${objectName}\\s*=\\s*\\{`,
    's'
  );
  const startMatch = content.match(re);
  if (!startMatch || startMatch.index === undefined) {
    return { keys: [], start: -1, end: -1 };
  }
  const start = startMatch.index + startMatch[0].length;
  // 花括号平衡扫描
  let depth = 1;
  let i = start;
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  const block = content.slice(start, i);
  // 取每个 keyName: 或 keyName = 的首词
  const keyRe = /^\s*([A-Za-z_$][\w$]*)\s*[:=]/gm;
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(block)) !== null) {
    // 排除内嵌对象字面量内部的嵌套键（常见错误：把注释里的词算进去；但本项目 STORE_NAME 为单层）
    keys.push(m[1]);
  }
  return { keys, start, end: i };
}

// ─────────────────────────────────────────────────────────────────────────────
// 提取 DB_VERSION = 数字
// ─────────────────────────────────────────────────────────────────────────────
function parseDbVersion(src: string): number | undefined {
  const m = src.match(/export\s+const\s+DB_VERSION\s*=\s*(\d+)\s*(?:as\s+const)?/);
  if (!m) return undefined;
  return parseInt(m[1], 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// 提取 MCP_SERVER_REGISTRY 条目
// ─────────────────────────────────────────────────────────────────────────────
function parseMcpRegistry(
  src: string
): { total: number; enabled: number; disabled: number } {
  // 匹配 { name: 'xx', ... , enabled: true/false } 的条目对象组
  const entriesRe = /name:\s*['"]([^'"]+)['"][\s\S]*?enabled:\s*(true|false)/g;
  let total = 0;
  let enabled = 0;
  let disabled = 0;
  let m: RegExpExecArray | null;
  while ((m = entriesRe.exec(src)) !== null) {
    total++;
    if (m[2] === 'true') enabled++;
    else disabled++;
  }
  return { total, enabled, disabled };
}

// ─────────────────────────────────────────────────────────────────────────────
// 提取 USER_SCENES = [ ... ] 中的 { id: 'xxx' }
// ─────────────────────────────────────────────────────────────────────────────
function parseUserScenes(src: string): { count: number; ids: string[] } {
  const re = /(?:export\s+const\s+USER_SCENES\s*[:=][\s\S]*?)(?=\n\s*export|$)/;
  const chunkMatch = src.match(re);
  const ids: string[] = [];
  if (chunkMatch) {
    // 在这一整块里寻找 id: 'xxx' （label/icon 相同模式，但只取紧跟 USER_SCENES 的那块）
    const idRe = /id:\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = idRe.exec(chunkMatch[0])) !== null) {
      ids.push(m[1]);
    }
  }
  return { count: ids.length, ids };
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENTS.md 宣称数字提取
// ─────────────────────────────────────────────────────────────────────────────
function parseClaimed(agents: string): Claimed {
  // DB_VERSION = N / DB_VERSION=N
  const dbRe = /DB_VERSION\s*=\s*(\d+)/g;
  let dbVersion: number | undefined;
  {
    const all = [...agents.matchAll(dbRe)].map((m) => parseInt(m[1], 10));
    // 取众数/最后一致值；不一致则留 undefined 交由断言报含糊警告
    if (all.length > 0 && all.every((v) => v === all[0])) dbVersion = all[0];
  }

  // 对 STORE 总数：优先匹配「共 53 项」「合计 53 项 Store」「53 Store」「53 = 29 + 24」
  let storeCount: number | undefined;
  {
    const patterns = [
      /(\d+)\s*项[，,。\s]*(?:合计|共)?[^。\n]*?(?:Store|store|STORE_NAME)/g,
      /(?:Object\.keys\(STORE_NAME\)\.length\s*===\s*==|Object\.keys\(STORE_NAME\)\.length\s*===\s*)(\d+)/g,
      /基线\s*(\d+)\s*[+＋]\s*增量\s*(\d+)\s*[=＝]\s*(\d+)\s*个?\s*(?:Store|store)/g,
      /基线\s*(\d+)\s*[+＋]\s*增量\s*(\d+)\s*[=＝]\s*(\d+)/g,
      /(\d+)\s*Store/g,
    ];
    const hits: number[] = [];
    for (const p of patterns) {
      for (const m of agents.matchAll(p)) {
        if (m[3] !== undefined) hits.push(parseInt(m[3], 10));
        else if (m[1] !== undefined) hits.push(parseInt(m[1], 10));
      }
    }
    if (hits.length > 0 && hits.every((v) => v === hits[0])) storeCount = hits[0];
    else if (hits.length > 0) {
      // 若出现基线 29 + 增量 24 = 53 的模式，优先信任加法结果
      const sumPattern = /(\d+)\s*[+＋]\s*(\d+)\s*[=＝]\s*(\d+)/g;
      for (const m of agents.matchAll(sumPattern)) {
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        const c = parseInt(m[3], 10);
        if (a + b === c) {
          storeCount = c;
          break;
        }
      }
      if (storeCount === undefined) storeCount = hits[hits.length - 1];
    }
  }

  // MCP：「15 条目」「10 enabled」「5 disabled」「共 X 个 MCP」「X 条目：Y enabled + Z disabled」
  let mcpTotal: number | undefined;
  let mcpEnabled: number | undefined;
  let mcpDisabled: number | undefined;
  {
    const mRe = /(\d+)\s*条目[^。\n]{0,40}?(\d+)\s*enabled[^。\n]{0,20}?(\d+)\s*disabled/g;
    const a = [...agents.matchAll(mRe)];
    if (a.length > 0) {
      mcpTotal = parseInt(a[0][1], 10);
      mcpEnabled = parseInt(a[0][2], 10);
      mcpDisabled = parseInt(a[0][3], 10);
    } else {
      // 分别抓
      const t = agents.match(/(\d+)\s*条\s*目[^。\n]{0,6}?\(/);
      if (t) mcpTotal = parseInt(t[1], 10);
      const e = agents.match(/(\d+)\s*enabled/);
      if (e) mcpEnabled = parseInt(e[1], 10);
      const d = agents.match(/(\d+)\s*disabled/);
      if (d) mcpDisabled = parseInt(d[1], 10);
    }
  }

  // USER_SCENES 场景：文档中列的场景 ID 与数量
  let userSceneCount: number | undefined;
  const userSceneIds: string[] = [];
  {
    // 匹配 | `today_snapshot` | ... | 形式（AGENTS 的表格）
    const tableRe = /\|\s*`(today_snapshot|portfolio_status|market_scan|deep_dive)`\s*\|/g;
    for (const m of agents.matchAll(tableRe)) userSceneIds.push(m[1]);
    // 若命中 4 项固定 ID 则计数=4；否则回退抓数量
    if (userSceneIds.length > 0) userSceneCount = userSceneIds.length;
    else {
      const c = agents.match(/USER_SCENES[^。\n]{0,40}(\d+)\s*(?:项|个|场景)/);
      if (c) userSceneCount = parseInt(c[1], 10);
    }
  }

  return { dbVersion, storeCount, mcpTotal, mcpEnabled, mcpDisabled, userSceneCount, userSceneIds };
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENTS.md frontmatter 提取（--- 包裹段）
// ─────────────────────────────────────────────────────────────────────────────
function parseFrontmatter(src: string): Frontmatter {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const block = m[1];
  const version = block.match(/^\s*version:\s*v?(\S+)\s*$/m)?.[1];
  const status = block.match(/^\s*status:\s*(\S+)\s*$/m)?.[1];
  const lastUpdated = block.match(/^\s*last_updated:\s*(\S+)\s*$/m)?.[1];
  return { version, status, lastUpdated };
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────
function main(): Result {
  if (CHANGED_ONLY && !stagedTouchesTruth()) {
    // 快路径：本次提交不涉及契约/真相源，返回空结果
    return {
      ok: true,
      strictOk: true,
      passed: ['[changed-only] 本次暂存未触碰契约真相源，跳过审计'],
      violations: [],
      truth: {
        dbVersion: -1, storeNameKeys: -1,
        mcpTotal: -1, mcpEnabled: -1, mcpDisabled: -1,
        userScenes: -1, userSceneIds: [],
      },
      claimed: { userSceneIds: [] },
      frontmatter: {},
    };
  }

  const agents = safeRead('AGENTS.md');
  const dbConfig = safeRead('src/config/dbConfig.ts');
  const mcpConfig = safeRead('src/config/mcpServerRegistry.ts');
  const cockpit = safeRead('src/constants/cockpit.constants.ts');

  // ── 真相提取 ────────────────────────────────────────────────────────────────
  const dbVersion = parseDbVersion(dbConfig) ?? -1;
  const storeNameKeys = parseObjectKeys(dbConfig, 'STORE_NAME').keys.length;
  const mcp = parseMcpRegistry(mcpConfig);
  const scenes = parseUserScenes(cockpit);
  const truth: Truth = {
    dbVersion,
    storeNameKeys,
    mcpTotal: mcp.total,
    mcpEnabled: mcp.enabled,
    mcpDisabled: mcp.disabled,
    userScenes: scenes.count,
    userSceneIds: scenes.ids,
  };

  // ── 契约宣称提取 ────────────────────────────────────────────────────────────
  const claimed = parseClaimed(agents);
  const frontmatter = parseFrontmatter(agents);

  const violations: Violation[] = [];
  const passed: string[] = [];

  // ── A1: DB_VERSION ──────────────────────────────────────────────────────────
  if (dbVersion < 0) {
    violations.push({
      id: 'A1', level: 'P0', item: 'DB_VERSION 真相源读取失败',
      message: '无法从 src/config/dbConfig.ts 解析 DB_VERSION 常量，请确认导出格式未变更。',
    });
  } else if (claimed.dbVersion === undefined) {
    violations.push({
      id: 'A1', level: 'P1', item: 'DB_VERSION 契约未宣称',
      message: 'AGENTS.md 中未找到"DB_VERSION = N"断言，建议补齐以便后续版本比对。',
    });
  } else if (claimed.dbVersion !== dbVersion) {
    violations.push({
      id: 'A1', level: 'P0', item: 'DB_VERSION 不一致',
      message: `AGENTS.md 宣称 DB_VERSION=${claimed.dbVersion}，但 dbConfig.ts 真相源实际 DB_VERSION=${dbVersion}。请同步修改契约。`,
      expected: String(claimed.dbVersion),
      actual: String(dbVersion),
    });
  } else {
    passed.push(`A1 DB_VERSION=${dbVersion} 契约与真相源一致`);
  }

  // ── A2: STORE_NAME 总数 ─────────────────────────────────────────────────────
  if (storeNameKeys <= 0) {
    violations.push({
      id: 'A2', level: 'P0', item: 'STORE_NAME keys 解析失败',
      message: '无法从 dbConfig.ts 解析 STORE_NAME keys，确认导出格式未被重构。',
    });
  } else if (claimed.storeCount === undefined) {
    violations.push({
      id: 'A2', level: 'P1', item: 'STORE_NAME 总数契约未宣称',
      message: 'AGENTS.md 未找到 Object.keys(STORE_NAME).length === N 或「基线 N + 增量 M = X」断言，建议补齐。',
    });
  } else if (claimed.storeCount !== storeNameKeys) {
    violations.push({
      id: 'A2', level: 'P0', item: 'STORE_NAME 总数漂移',
      message: `AGENTS.md 宣称共 ${claimed.storeCount} 项 Store，但 dbConfig.ts STORE_NAME 实际有 ${storeNameKeys} 个 key。新增/删除 Store 请同步更新契约中的「基线 X + 增量 Y = Z」清单。`,
      expected: String(claimed.storeCount),
      actual: String(storeNameKeys),
    });
  } else {
    passed.push(`A2 STORE_NAME 共 ${storeNameKeys} 项，契约宣称一致`);
  }

  // ── A3: MCP Registry ────────────────────────────────────────────────────────
  if (mcp.total <= 0) {
    violations.push({
      id: 'A3', level: 'P0', item: 'MCP_SERVER_REGISTRY 解析失败',
      message: 'mcpServerRegistry.ts 中没有找到任何 {name,enabled} 条目，请确认导出格式。',
    });
  } else if (
    claimed.mcpTotal === undefined &&
    claimed.mcpEnabled === undefined &&
    claimed.mcpDisabled === undefined
  ) {
    violations.push({
      id: 'A3', level: 'P1', item: 'MCP Registry 契约未宣称',
      message: 'AGENTS.md 未找到「X 条目（Y enabled + Z disabled）」断言。当前真相源为总',
    });
  } else {
    const totalOk = claimed.mcpTotal === undefined || claimed.mcpTotal === mcp.total;
    const enOk = claimed.mcpEnabled === undefined || claimed.mcpEnabled === mcp.enabled;
    const disOk = claimed.mcpDisabled === undefined || claimed.mcpDisabled === mcp.disabled;
    if (totalOk && enOk && disOk) {
      passed.push(
        `A3 MCP_SERVER_REGISTRY 总=${mcp.total}(enabled=${mcp.enabled},disabled=${mcp.disabled}) 契约一致`
      );
    } else {
      violations.push({
        id: 'A3', level: 'P0', item: 'MCP Registry 条目数漂移',
        message:
          `AGENTS 宣称：总=${claimed.mcpTotal ?? '?'}(enabled=${claimed.mcpEnabled ?? '?'},disabled=${claimed.mcpDisabled ?? '?'})；` +
          `真相源实际：总=${mcp.total}(enabled=${mcp.enabled},disabled=${mcp.disabled})。新增/禁用/清理僵尸 Server 请同步更新契约 §14.3。`,
        expected: `总=${claimed.mcpTotal} en=${claimed.mcpEnabled} dis=${claimed.mcpDisabled}`,
        actual: `总=${mcp.total} en=${mcp.enabled} dis=${mcp.disabled}`,
      });
    }
  }

  // ── A4: USER_SCENES ─────────────────────────────────────────────────────────
  if (scenes.count <= 0) {
    violations.push({
      id: 'A4', level: 'P0', item: 'USER_SCENES 解析失败',
      message: 'cockpit.constants.ts 中未解析到 USER_SCENES 条目，请确认导出格式。',
    });
  } else if (
    claimed.userSceneCount === undefined ||
    claimed.userSceneIds.length === 0
  ) {
    violations.push({
      id: 'A4', level: 'P1', item: 'USER_SCENES 契约未宣称',
      message: 'AGENTS.md 未列出 USER_SCENES 四场景表格，请补齐 §7.2 段。',
    });
  } else {
    const missingFromClaim = scenes.ids.filter((i) => !claimed.userSceneIds.includes(i));
    const extraInClaim = claimed.userSceneIds.filter((i) => !scenes.ids.includes(i));
    if (missingFromClaim.length === 0 && extraInClaim.length === 0) {
      passed.push(
        `A4 USER_SCENES 场景数=${scenes.count}，ID 集合 [${scenes.ids.join(', ')}] 契约一致`
      );
    } else {
      violations.push({
        id: 'A4', level: 'P0', item: 'USER_SCENES 场景集合漂移',
        message:
          (missingFromClaim.length > 0
            ? `真相源新增/缺失的 ID 未在契约列出：[${missingFromClaim.join(', ')}]。`
            : '') +
          (extraInClaim.length > 0
            ? `契约中列出了真相源不存在的 ID：[${extraInClaim.join(', ')}]。`
            : ''),
        expected: claimed.userSceneIds.join(','),
        actual: scenes.ids.join(','),
      });
    }
  }

  // ── A5: frontmatter 字段 ────────────────────────────────────────────────────
  const fmMissing: string[] = [];
  if (!frontmatter.version) fmMissing.push('version');
  if (!frontmatter.status) fmMissing.push('status');
  if (!frontmatter.lastUpdated) fmMissing.push('last_updated');
  if (fmMissing.length > 0) {
    violations.push({
      id: 'A5', level: 'P1', item: 'AGENTS frontmatter 字段缺失',
      message: `缺少字段：${fmMissing.join(', ')}。AGENTS.md 文件头部 --- 段请补齐 version / status / last_updated 三项。`,
    });
  } else if (frontmatter.status !== 'active') {
    violations.push({
      id: 'A5', level: 'P1', item: 'AGENTS frontmatter status 非 active',
      message: `当前 status=${frontmatter.status}；契约生效中应为 status: active。`,
    });
  } else {
    passed.push(
      `A5 frontmatter 合法：version=${frontmatter.version} status=active last_updated=${frontmatter.lastUpdated}`
    );
  }

  // ── A6: last_updated 未来日期检查 ───────────────────────────────────────────
  if (frontmatter.lastUpdated) {
    const d = new Date(frontmatter.lastUpdated + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d.getTime() > today.getTime()) {
        violations.push({
          id: 'A6', level: 'P1', item: 'AGENTS last_updated 为未来日期',
          message: `last_updated=${frontmatter.lastUpdated}，当前系统日期 ${today
            .toISOString()
            .slice(0, 10)}。请确认未手滑填错。`,
        });
      } else {
        passed.push(`A6 last_updated=${frontmatter.lastUpdated} 非未来日期`);
      }
    }
  }

  // ── A7: tsconfig 双配置存在性 ───────────────────────────────────────────────
  const hasProd = existsSync(join(ROOT, 'tsconfig.prod.json'));
  const hasTest = existsSync(join(ROOT, 'tsconfig.test.json'));
  if (!hasProd || !hasTest) {
    violations.push({
      id: 'A7', level: 'P1', item: 'tsconfig 双文件缺失',
      message:
        `tsconfig.prod.json 存在=${hasProd}；tsconfig.test.json 存在=${hasTest}。` +
        `AGENTS.md §16.3 已固化双 tsconfig 作用域，请恢复文件。`,
    });
  } else {
    passed.push('A7 tsconfig.prod.json + tsconfig.test.json 均存在');
  }

  // ── 结果合成 ────────────────────────────────────────────────────────────────
  const hasP0 = violations.some((v) => v.level === 'P0');
  const ok = !hasP0;
  const strictOk = ok && violations.length === 0;

  return { ok, strictOk, passed, violations, truth, claimed, frontmatter };
}

// ─────────────────────────────────────────────────────────────────────────────
// 输出
// ─────────────────────────────────────────────────────────────────────────────
const result = main();

if (JSON_OUT) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  const header = '🗂️  AGENTS.md 契约 ↔ 代码真相源 一致性审计';
  console.log(`\n${header}\n${'─'.repeat(header.length)}`);
  if (result.passed.length) {
    console.log('\n✅ 通过项：');
    for (const p of result.passed) console.log(`   · ${p}`);
  }
  if (result.violations.length === 0) {
    console.log('\n🎉 全部断言通过，契约与真相源完全对齐。');
  } else {
    const p0n = result.violations.filter((v) => v.level === 'P0').length;
    const p1n = result.violations.length - p0n;
    console.log(
      `\n⚠️  发现 ${result.violations.length} 项违规：P0=${p0n} P1=${p1n}`
    );
    for (const v of result.violations) {
      const prefix = v.level === 'P0' ? '❌ [P0 BLOCK]' : '⚠️  [P1 WARN ]';
      console.log(`\n ${prefix} ${v.id} · ${v.item}`);
      console.log(`    ${v.message}`);
      if (v.expected !== undefined || v.actual !== undefined) {
        console.log(
          `    期望(契约) = ${v.expected ?? '—'}    实际(真相源) = ${v.actual ?? '—'}`
        );
      }
    }
    if (p0n > 0) {
      console.log(
        '\n🔧 修复指引：定位违规行后，① 修改对应真相源代码时同步更新 AGENTS.md §相关段落；② 或反方向修正 AGENTS.md 中过时的数字；③ 运行本脚本直到 P0=0。'
      );
    }
  }
  console.log('');
}

process.exit(STRICT ? (result.strictOk ? 0 : 1) : result.ok ? 0 : 1);
