#!/usr/bin/env node
/**
 * audit-path-match.ts — 文档目录-内容匹配门禁（P2-4）
 *
 * 检查新增 .md 文件的目录与内容是否匹配（关键词匹配）。
 * 用于 Husky pre-commit 拦截目录错位文档。
 *
 * 规则：
 * - 01-requirements/ 下不应出现 architecture/design/audit 等关键词
 * - 02-design/ 下不应出现 audit/test/plan 等过程产物关键词
 * - 05-deployment/ 下应出现 deploy/host/build 等关键词
 * - 07-archive/ 下必须含 DEPRECATED 前缀
 *
 * 使用：tsx scripts/audit-path-match.ts [path]
 * 无参数时扫描 docs/ 全部 .md 文件
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';

interface Violation {
  file: string;
  directory: string;
  forbiddenKeywords: string[];
  suggestion: string;
}

const RULES: Record<string, { name: string; allowed: string[]; forbidden: string[]; suggestion: string }> = {
  '01-requirements': {
    name: '需求规格',
    allowed: ['需求', 'vision', 'functional', 'requirement', 'spec', 'goal', 'strategy', 'input'],
    forbidden: ['architecture', '设计', 'audit', '审计', '测试', 'test', 'deploy', '部署', 'deprecated', '回滚', 'release'],
    suggestion: '架构/设计/审计文档应归入 02-design/ 或 architecture/；测试文档应归入 04-testing/',
  },
  '02-design': {
    name: '设计文档',
    allowed: ['设计', 'design', 'spec', 'architecture', 'engine', 'routing', 'token', 'UI', 'UX', 'component', 'widget', 'dataflow', 'schema', 'migration', 'glossary'],
    forbidden: ['audit', '审计', 'test', '测试', 'quality-audit', 'review-report', 'performance-report', 'compliance-report', 'remediation-report', 'clean-up', 'release-note', 'pr-description', 'release-plan'],
    suggestion: '审计/测试/过程产物应归入 audit/、04-testing/ 或 reports/；发布文档应归入 05-deployment/',
  },
  '03-development': {
    name: '开发实施',
    allowed: ['开发', 'implementation', 'code', 'integration', 'migration', 'refactor', 'fix', 'chart', 'feature'],
    forbidden: ['design', '架构', 'audit', '审计', 'review'],
    suggestion: '设计/架构文档应归入 02-design/；审计文档应归入 audit/',
  },
  '04-testing': {
    name: '测试策略',
    allowed: ['测试', 'test', 'e2e', 'coverage', 'regression', 'visual', 'quality', 'strategy', 'plan'],
    forbidden: ['design', 'architecture', 'requirement', 'vision', 'deploy', 'release'],
    suggestion: '设计/架构/需求文档应归入对应目录',
  },
  '05-deployment': {
    name: '部署运维',
    allowed: ['部署', 'deploy', 'host', 'build', 'CI', 'CD', 'release', 'rollback', 'plan', 'runbook', 'operation', 'monitor'],
    forbidden: ['design', 'architecture', 'test', 'audit', 'requirement'],
    suggestion: '设计/架构/测试/需求文档应归入对应目录',
  },
  '07-archive': {
    name: '归档',
    allowed: [],
    forbidden: [],
    suggestion: '归档目录仅允许 DEPRECATED_*.md 文件',
  },
  'reports': {
    name: '过程产物',
    allowed: ['报告', 'report', 'audit', 'analysis', 'finding', 'review', 'compliance', 'inventory', 'summary', 'plan'],
    forbidden: ['design', 'architecture', 'spec', 'requirement', 'vision', 'goal'],
    suggestion: '设计/架构/需求文档应归入对应目录',
  },
  'audit': {
    name: '审计',
    allowed: ['审计', 'audit', 'report', 'review', 'compliance', 'finding', 'quality', 'security', 'gap', 'analysis'],
    forbidden: ['design', 'architecture', 'spec', 'requirement', 'vision', 'goal'],
    suggestion: '设计/架构/需求文档应归入对应目录',
  },
  'architecture': {
    name: '架构',
    allowed: ['架构', 'architecture', 'overview', 'cabin', 'service', 'security', 'model', 'ADR', 'catalog', 'blueprint', 'dataflow', 'component'],
    forbidden: ['test', 'audit', 'requirement', 'vision', 'goal', 'design-token', 'UI', 'UX'],
    suggestion: '测试/审计/需求文档应归入对应目录；UI/设计令牌文档应归入 02-design/',
  },
};

const DEPRECATED_PREFIX = 'DEPRECATED_';
const MIN_FORBIDDEN_MATCHES = 2; // 至少匹配 2 个 forbidden 关键词才报违规

function walkDir(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && !fullPath.includes('node_modules') && !fullPath.includes('.git')) {
      walkDir(fullPath, files);
    } else if (stat.isFile() && extname(entry) === '.md') {
      files.push(fullPath);
    }
  }
  return files;
}

function getDirKey(filePath: string): string | null {
  const parts = filePath.split(/[/\\]/);
  // 从 docs/ 开始找目录 key
  const docsIdx = parts.indexOf('docs');
  if (docsIdx >= 0 && parts[docsIdx + 1]) {
    const dir = parts[docsIdx + 1];
    if (dir in RULES) return dir;
  }
  return null;
}

function checkFile(filePath: string): Violation | null {
  const dirKey = getDirKey(filePath);
  if (!dirKey) return null;

  const rule = RULES[dirKey];
  const content = readFileSync(filePath, 'utf-8').toLowerCase();
  const filename = basename(filePath).toLowerCase();

  // 07-archive 特殊规则：必须 DEPRECATED_ 前缀
  if (dirKey === '07-archive') {
    if (!basename(filePath).startsWith(DEPRECATED_PREFIX)) {
      return {
        file: filePath,
        directory: dirKey,
        forbiddenKeywords: ['非 DEPRECATED 前缀'],
        suggestion: '归档目录仅允许 DEPRECATED_*.md 文件',
      };
    }
    return null;
  }

  // 统计 forbidden 关键词命中数
  const hits: string[] = [];
  for (const kw of rule.forbidden) {
    const lowerKw = kw.toLowerCase();
    if (content.includes(lowerKw) || filename.includes(lowerKw)) {
      hits.push(kw);
    }
  }

  if (hits.length >= MIN_FORBIDDEN_MATCHES) {
    return {
      file: filePath,
      directory: dirKey,
      forbiddenKeywords: hits,
      suggestion: rule.suggestion,
    };
  }

  return null;
}

function main() {
  const args = process.argv.slice(2);
  let files: string[];

  if (args.length > 0) {
    files = args.filter((p) => extname(p) === '.md');
  } else {
    files = walkDir('docs');
  }

  const violations: Violation[] = [];
  for (const file of files) {
    const v = checkFile(file);
    if (v) violations.push(v);
  }

  console.log(`🔍 扫描完成：${files.length} 个 .md 文件`);
  console.log(`❌ 违规：${violations.length} 个`);
  console.log('');

  if (violations.length > 0) {
    for (const v of violations) {
      console.log(`[${v.directory}] ${v.file}`);
      console.log(`  命中关键词: ${v.forbiddenKeywords.join(', ')}`);
      console.log(`  建议: ${v.suggestion}`);
      console.log('');
    }
    console.log('📋 修复后重新运行：npx tsx scripts/audit-path-match.ts');
    process.exit(1);
  } else {
    console.log('✅ 全部通过：目录与内容匹配');
    process.exit(0);
  }
}

main();
