import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOCS_ROOT = join(__dirname, '..', 'docs');
const CATEGORY_INDEX_PATH = join(DOCS_ROOT, 'meta', 'ai-index', '.ai-index', 'category-index.json');

interface DocumentInfo {
  path: string;
  name: string;
  category: string;
  subCategory: string;
  lastModified: string;
  size: number;
  status: 'active' | 'stale' | 'deprecated';
}

interface CategoryMap {
  [key: string]: DocumentInfo[];
}

const normalizePath = (path: string): string => path.replace(/\\/g, '/');

const CATEGORY_RULES: Record<string, { pattern: RegExp; subCategory: string }[]> = {
  'A': [
    { pattern: /^meta\//, subCategory: 'A1-index-constitution' },
    { pattern: /^01-requirements\/(01-vision|02-functional|03-architecture)/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/V9数据宪法/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/v9-system-blueprint/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/action-list/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/completeness-profile/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/overview/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/README/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/RM剩余任务/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/v9-input-cabin-strategy/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/fourth-industrial-revolution/, subCategory: 'A2-requirements' },
    { pattern: /^01-requirements\/FILE-MANAGEMENT-GUIDE/, subCategory: 'A2-requirements' },
    { pattern: /^03-development\/plugins\//, subCategory: 'A3-plugins' },
  ],
  'B': [
    { pattern: /^02-design\/architecture\/(overview|cabins-overview|services-catalog)/, subCategory: 'B1-overview' },
    { pattern: /^02-design\/architecture\/subsystems\//, subCategory: 'B2-subsystems' },
    { pattern: /^02-design\/architecture\/adr\//, subCategory: 'B3-adr' },
    { pattern: /^02-design\/architecture\/compliance\//, subCategory: 'B4-compliance' },
    { pattern: /^05-deployment\/RELEASE_NOTES/, subCategory: 'B5-release' },
    { pattern: /^05-deployment\/PR_DESCRIPTION/, subCategory: 'B5-release' },
    { pattern: /^02-design\/architecture\/v9-strategy-architecture/, subCategory: 'B1-overview' },
    { pattern: /^02-design\/architecture\/architecture-version-comparison/, subCategory: 'B1-overview' },
    { pattern: /^02-design\/architecture\/v10-architecture-alignment/, subCategory: 'B1-overview' },
    { pattern: /^02-design\/architecture\/2026-06-20-pure-frontend-architecture/, subCategory: 'B1-overview' },
  ],
  'C': [
    { pattern: /^02-design\/cabins\//, subCategory: 'C1-cabins' },
    { pattern: /^02-design\/components\//, subCategory: 'C2-components' },
    { pattern: /^02-design\/cockpit\//, subCategory: 'C3-cockpit' },
    { pattern: /^02-design\/store\//, subCategory: 'C4-store' },
    { pattern: /^02-design\/services\//, subCategory: 'C5-services' },
    { pattern: /^02-design\/data-layer\//, subCategory: 'C6-data-layer' },
  ],
  'D': [
    { pattern: /^02-design\/standards\/coding-conventions/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/design-tokens\//, subCategory: 'D2-design-tokens' },
    { pattern: /^02-design\/standards\/quality-gates\//, subCategory: 'D3-quality-gates' },
    { pattern: /^02-design\/standards\/07-operation-strategy/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/08-implementation-plan/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/implementation-governance/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/HOOKS_GUIDE/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/complexity-governance/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/development-workflow-sop/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/CODE-REVIEW/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/code-review-guide/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/jsdoc-convention/, subCategory: 'D4-documentation' },
    { pattern: /^02-design\/standards\/overview/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/chart-integration/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/gateway-write-permission-spec/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/RBAC整合/, subCategory: 'D1-coding' },
    { pattern: /^02-design\/standards\/AI_CENTER_VUE3_EXAMPLES/, subCategory: 'D1-coding' },
    { pattern: /^03-development\/migration\//, subCategory: 'D5-migration' },
    { pattern: /^02-design\/standards\/DATA_DEFINITION/, subCategory: 'D4-documentation' },
    { pattern: /^02-design\/standards\/DATA_DICTIONARY_INDEX/, subCategory: 'D4-documentation' },
  ],
  'E': [
    { pattern: /^04-testing\/testing-strategy/, subCategory: 'E1-test-layers' },
    { pattern: /^04-testing\/automation-test/, subCategory: 'E1-test-layers' },
    { pattern: /^04-testing\/test-cases\//, subCategory: 'E2-test-cases' },
    { pattern: /^04-testing\/gates\//, subCategory: 'E4-gates' },
    { pattern: /^04-testing\/2026-07-04-ui-testing-optimization/, subCategory: 'E1-test-layers' },
    { pattern: /^04-testing\/automation-test-evaluation/, subCategory: 'E1-test-layers' },
    { pattern: /^04-testing\/automation-test-plan/, subCategory: 'E1-test-layers' },
  ],
  'F': [
    { pattern: /^prompts\//, subCategory: 'F1-prompts' },
    { pattern: /^03-development\/checklists\//, subCategory: 'F2-checklists' },
    { pattern: /^02-design\/ai\//, subCategory: 'F3-memory' },
  ],
  'G': [
    { pattern: /^reports\/audit\//, subCategory: 'G1-audit-reports' },
    { pattern: /^reports\/changelogs\//, subCategory: 'G2-changelogs' },
    { pattern: /^reports\/retrospectives\//, subCategory: 'G3-retrospectives' },
    { pattern: /^reports\/drafts\//, subCategory: 'G4-drafts' },
    { pattern: /^reports\/release-management\//, subCategory: 'G5-release-management' },
  ],
  'H': [
    { pattern: /^03-development\/guides\/security\//, subCategory: 'H1-security' },
    { pattern: /^05-deployment\/ops\//, subCategory: 'H2-ops' },
    { pattern: /^03-development\/guides\/getting-started\//, subCategory: 'H3-getting-started' },
    { pattern: /^03-development\/guides\/accessibility\//, subCategory: 'H4-accessibility' },
  ],
};

function scanDocs(dir: string, relativePath: string = '', documents: DocumentInfo[] = []): DocumentInfo[] {
  if (!existsSync(dir)) return documents;
  
  const items = readdirSync(dir);
  for (const item of items) {
    if (item.startsWith('.') || item === 'deprecated-docs') continue;
    
    const fullPath = join(dir, item);
    const itemRelativePath = relativePath ? `${relativePath}/${item}` : item;
    const stats = statSync(fullPath);
    
    if (stats.isDirectory()) {
      scanDocs(fullPath, itemRelativePath, documents);
    } else if (item.endsWith('.md')) {
      const { category, subCategory } = classifyDocument(itemRelativePath);
      const status = determineStatus(stats.mtime.getTime());
      
      documents.push({
        path: itemRelativePath,
        name: item,
        category,
        subCategory,
        lastModified: stats.mtime.toISOString(),
        size: stats.size,
        status,
      });
    }
  }
  return documents;
}

function classifyDocument(relativePath: string): { category: string; subCategory: string } {
  const normalizedPath = normalizePath(relativePath);
  for (const [category, rules] of Object.entries(CATEGORY_RULES)) {
    for (const rule of rules) {
      if (rule.pattern.test(normalizedPath)) {
        return { category, subCategory: rule.subCategory };
      }
    }
  }
  return { category: 'U', subCategory: 'unclassified' };
}

function determineStatus(mtime: number): 'active' | 'stale' | 'deprecated' {
  const now = Date.now();
  const days = (now - mtime) / (1000 * 60 * 60 * 24);
  if (days > 90) return 'deprecated';
  if (days > 30) return 'stale';
  return 'active';
}

function buildCategoryIndex(documents: DocumentInfo[]): CategoryMap {
  const index: CategoryMap = {};
  for (const doc of