import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname, relative, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOCS_DIR = join(__dirname, '../docs');
const CATEGORY_INDEX_PATH = join(DOCS_DIR, '00-meta/ai-index/.ai-index/category-index.json');
const SUB_CATEGORY_MAP: Record<string, string> = {
  'A/A1-index-constitution': '00-meta',
  'A/A2-requirements': '01-requirements',
  'A/A3-plugins': '03-development/plugins',
  'B/B1-overview': '02-design/architecture',
  'B/B2-subsystems': '02-design/architecture/subsystems',
  'B/B3-adr': '02-design/architecture/adr',
  'B/B4-compliance': '02-design/architecture/compliance',
  'B/B5-release': '05-deployment',
  'C/C1-cabins': '02-design/cabins',
  'C/C2-components': '02-design/components',
  'C/C3-cockpit': '02-design/cockpit',
  'C/C4-store': '02-design/store',
  'C/C5-services': '02-design/services',
  'C/C6-data-layer': '02-design/data-layer',
  'C/C7-data-dictionary': '02-design/standards',
  'D/D1-coding': '02-design/standards',
  'D/D2-design-tokens': '02-design/standards/design-tokens',
  'D/D3-quality-gates': '02-design/standards/quality-gates',
  'D/D4-documentation': '02-design/standards',
  'D/D5-migration': '03-development/migration',
  'E/E1-test-layers': '04-testing',
  'E/E2-test-cases': '04-testing/test-cases',
  'E/E3-reports': '04-testing/reports',
  'E/E4-gates': '04-testing/gates',
  'F/F1-prompts': 'prompts',
  'F/F2-checklists': '03-development/checklists',
  'F/F3-memory': '02-design/ai',
  'G/G1-audit-reports': 'reports/audit',
  'G/G2-changelogs': 'reports/changelogs',
  'G/G3-retrospectives': 'reports/retrospectives',
  'G/G4-drafts': 'reports/drafts',
  'G/G5-release-management': 'reports/release-management',
  'H/H1-security': '03-development/guides/security',
  'H/H2-ops': '05-deployment/ops',
  'H/H3-getting-started': '03-development/guides/getting-started',
  'H/H4-accessibility': '03-development/guides/accessibility',
};

function loadCategoryIndex(): any {
  const content = readFileSync(CATEGORY_INDEX_PATH, 'utf-8');
  return JSON.parse(content);
}

function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function shouldMigrate(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  const skipPatterns = [
    /^00-meta\/ai-index\//,
    /^assets\//,
    /^07-archive\//,
  ];
  return !skipPatterns.some(pattern => pattern.test(normalized));
}

function main(): void {
  const index = loadCategoryIndex();
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  const migrationLog: { source: string; target: string; status: string; reason?: string }[] = [];

  console.log(`=== Starting Migration ===`);
  console.log(`Total categories: ${Object.keys(index.categories).length}`);

  for (const [categoryKey, documents] of Object.entries(index.categories)) {
    console.log(`Processing category: ${categoryKey} (${documents.length} docs)`);
    const targetDir = SUB_CATEGORY_MAP[categoryKey];
    if (!targetDir) {
      console.log(`⚠️  No mapping for category: ${categoryKey}`);
      continue;
    }

    const targetPath = join(DOCS_DIR, targetDir);
    ensureDirectory(targetPath);

    for (const doc of documents) {
      const sourcePath = join(DOCS_DIR, doc.path);
      
      if (!shouldMigrate(doc.path)) {
        skipped++;
        migrationLog.push({ source: doc.path, target: targetDir, status: 'skipped', reason: 'excluded' });
        continue;
      }

      if (!existsSync(sourcePath)) {
        errors++;
        migrationLog.push({ source: doc.path, target: targetDir, status: 'error', reason: 'source not found' });
        continue;
      }

      const fileName = basename(doc.path);
      const targetFilePath = join(targetPath, fileName);

      if (normalizePath(sourcePath) === normalizePath(targetFilePath)) {
        skipped++;
        migrationLog.push({ source: doc.path, target: targetDir, status: 'skipped', reason: 'already in target' });
        continue;
      }

      if (existsSync(targetFilePath)) {
        const sourceMtime = new Date(doc.lastModified).getTime();
        const targetMtime = statSync(targetFilePath).mtime.getTime();
        
        if (sourceMtime > targetMtime) {
          const backupPath = join(targetPath, `${fileName}.backup.${Date.now()}`);
          renameSync(targetFilePath, backupPath);
          renameSync(sourcePath, targetFilePath);
          migrated++;
          migrationLog.push({ source: doc.path, target: targetDir, status: 'migrated', reason: 'replaced newer' });
        } else {
          skipped++;
          migrationLog.push({ source: doc.path, target: targetDir, status: 'skipped', reason: 'target is newer' });
        }
      } else {
        renameSync(sourcePath, targetFilePath);
        migrated++;
        migrationLog.push({ source: doc.path, target: targetDir, status: 'migrated' });
      }
    }
  }

  console.log(`=== Migration Results ===`);
  console.log(`Total documents: ${index.totalDocuments}`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  const logPath = join(DOCS_DIR, '00-meta/migration-log.json');
  writeFileSync(logPath, JSON.stringify(migrationLog, null, 2), 'utf-8');
  console.log(`Migration log written to: ${logPath}`);
}

if (process.argv[1] && process.argv[1].endsWith('migrate-doc-categories.ts')) {
  main();
}