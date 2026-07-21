import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { readTextAdaptive, writeTextUtf8 } from '../lib/encoding'
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOCS_DIR = join(__dirname, '../docs');
const MIGRATION_LOG_PATH = join(DOCS_DIR, '00-meta/deprecated-docs/temporary/migration-log.json');

interface MigrationEntry {
  source: string;
  target: string;
  status: string;
  reason?: string;
}

function loadMigrationLog(): MigrationEntry[] {
  const content = readTextAdaptive(MIGRATION_LOG_PATH);
  return JSON.parse(content);
}

function buildPathMapping(log: MigrationEntry[]): Map<string, string> {
  const mapping = new Map<string, string>();
  for (const entry of log) {
    if (entry.status === 'migrated') {
      const sourcePath = entry.source.replace(/\\/g, '/');
      const sourceDir = dirname(sourcePath);
      const fileName = basename(sourcePath);
      const targetPath = join(entry.target, fileName).replace(/\\/g, '/');
      mapping.set(sourcePath, targetPath);
    }
  }
  return mapping;
}

function findAllMarkdownFiles(dir: string, files: string[] = []): string[] {
  try {
    if (!existsSync(dir)) return files;
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        if (!item.startsWith('.') && item !== 'deprecated-docs' && item !== 'ai-index') {
          findAllMarkdownFiles(fullPath, files);
        }
      } else if (item.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    console.log(`Error reading ${dir}:`, e);
  }
  return files;
}

function fixReferences(filePath: string, mapping: Map<string, string>): { fixed: number; changed: boolean } {
  let content = readTextAdaptive(filePath);
  let fixed = 0;
  const fileDir = dirname(filePath).replace(/\\/g, '/');
  
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const linkText = match[1];
    const linkUrl = match[2];
    
    if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://') || linkUrl.startsWith('#')) {
      continue;
    }
    
    let resolvedPath: string;
    if (linkUrl.startsWith('/')) {
      resolvedPath = linkUrl.substring(1);
    } else {
      resolvedPath = join(fileDir, linkUrl).replace(/\\/g, '/');
      const relativePath = relative(DOCS_DIR, resolvedPath);
      if (relativePath.startsWith('..')) {
        continue;
      }
      resolvedPath = relativePath;
    }
    
    const normalizedPath = resolvedPath.replace(/\\/g, '/');
    
    if (mapping.has(normalizedPath)) {
      const newPath = mapping.get(normalizedPath)!;
      const newRelativePath = relative(fileDir, join(DOCS_DIR, newPath)).replace(/\\/g, '/');
      
      const oldLink = `[${linkText}](${linkUrl})`;
      const newLink = `[${linkText}](${newRelativePath})`;
      
      content = content.replace(oldLink, newLink);
      fixed++;
    }
  }
  
  writeTextUtf8(filePath, content);
  return { fixed, changed: fixed > 0 };
}

function main(): void {
  const log = loadMigrationLog();
  const mapping = buildPathMapping(log);
  
  console.log(`=== Fixing Cross References ===`);
  console.log(`Total migrated entries: ${mapping.size}`);
  
  const mdFiles = findAllMarkdownFiles(DOCS_DIR);
  console.log(`Total markdown files to scan: ${mdFiles.length}`);
  
  let totalFixed = 0;
  let filesChanged = 0;
  
  for (const file of mdFiles) {
    const result = fixReferences(file, mapping);
    if (result.changed) {
      filesChanged++;
      totalFixed += result.fixed;
      console.log(`Fixed ${result.fixed} references in: ${relative(DOCS_DIR, file)}`);
    }
  }
  
  console.log(`=== Fix Complete ===`);
  console.log(`Files modified: ${filesChanged}`);
  console.log(`References fixed: ${totalFixed}`);
  
  const summary = {
    migratedEntries: mapping.size,
    filesScanned: mdFiles.length,
    filesModified: filesChanged,
    referencesFixed: totalFixed,
    timestamp: new Date().toISOString()
  };
  
  const summaryPath = join(DOCS_DIR, '00-meta/deprecated-docs/temporary/reference-fix-summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`Summary written to: ${summaryPath}`);
}

if (process.argv[1] && process.argv[1].endsWith('fix-cross-references.ts')) {
  main();
}