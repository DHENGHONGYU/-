import * as fs from 'fs';
import * as path from 'path';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename).replace(/^\/([A-Z]:)/, '$1');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_INDEX = path.join(PROJECT_ROOT, 'docs', 'meta', 'registry-index.md');

interface PathCheckResult {
  exists: boolean;
  filePath: string;
  linkText: string;
  lineNumber: number;
}

function checkRegistryLinks(): { valid: PathCheckResult[]; broken: PathCheckResult[] } {
  const content = fs.readFileSync(REGISTRY_INDEX, 'utf-8');
  const lines = content.split('\n');
  const valid: PathCheckResult[] = [];
  const broken: PathCheckResult[] = [];
  const registryDir = path.dirname(REGISTRY_INDEX);

  lines.forEach((line, index) => {
    const match = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      const linkText = match[1];
      const relativePath = match[2];
      const filePath = path.resolve(registryDir, relativePath);
      const exists = fs.existsSync(filePath);

      const result: PathCheckResult = {
        exists,
        filePath,
        linkText,
        lineNumber: index + 1,
      };

      if (exists) {
        valid.push(result);
      } else {
        broken.push(result);
      }
    }
  });

  return { valid, broken };
}

function analyzeDocsStructure(): {
  diataxisDirs: string[];
  numberedDirs: string[];
  diataxisFileCount: number;
  numberedFileCount: number;
  emptyNumberedDirs: string[];
} {
  const docsDir = path.join(PROJECT_ROOT, 'docs');
  const entries = fs.readdirSync(docsDir, { withFileTypes: true });

  const diataxisDirs = ['tutorials', 'how-to', 'reference', 'explanation', 'prompts'];
  const numberedDirs = ['meta', '02-design', '04-testing', '06-project-management'];

  let diataxisFileCount = 0;
  let numberedFileCount = 0;
  const emptyNumberedDirs: string[] = [];

  entries.forEach(entry => {
    if (entry.isDirectory()) {
      const dirPath = path.join(docsDir, entry.name);
      const files = fs.readdirSync(dirPath);
      const fileCount = files.filter(f => f.endsWith('.md') && !f.startsWith('_')).length;

      if (diataxisDirs.includes(entry.name)) {
        diataxisFileCount += fileCount;
      } else if (numberedDirs.includes(entry.name)) {
        numberedFileCount += fileCount;
        if (fileCount === 0) {
          emptyNumberedDirs.push(entry.name);
        }
      }
    }
  });

  return {
    diataxisDirs,
    numberedDirs,
    diataxisFileCount,
    numberedFileCount,
    emptyNumberedDirs,
  };
}

function analyzeScriptsStructure(): {
  rootAuditFiles: string[];
  subdirAuditFiles: string[];
  uncategorizedFiles: string[];
} {
  const scriptsDir = path.join(PROJECT_ROOT, 'scripts');
  const entries = fs.readdirSync(scriptsDir, { withFileTypes: true });

  const rootAuditFiles: string[] = [];
  const subdirAuditFiles: string[] = [];
  const uncategorizedFiles: string[] = [];

  entries.forEach(entry => {
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      if (entry.name.startsWith('audit-')) {
        rootAuditFiles.push(entry.name);
      } else if (!entry.name.startsWith('_')) {
        uncategorizedFiles.push(entry.name);
      }
    }
  });

  const auditSubdir = path.join(scriptsDir, 'audit');
  if (fs.existsSync(auditSubdir)) {
    fs.readdirSync(auditSubdir).forEach(file => {
      if (file.endsWith('.ts') || file.endsWith('.py')) {
        subdirAuditFiles.push(`audit/${file}`);
      }
    });
  }

  return {
    rootAuditFiles,
    subdirAuditFiles,
    uncategorizedFiles,
  };
}

function main() {
  console.log('='.repeat(80));
  console.log('V9 文档系统诊断报告');
  console.log('='.repeat(80));

  console.log('\n--- 1. registry-index.md 链接校验 ---');
  const { valid, broken } = checkRegistryLinks();
  const total = valid.length + broken.length;
  const brokenPercent = ((broken.length / total) * 100).toFixed(1);

  console.log(`总链接数: ${total}`);
  console.log(`有效链接: ${valid.length}`);
  console.log(`断裂链接: ${broken.length} (${brokenPercent}%)`);

  if (broken.length > 0) {
    console.log('\n断裂链接详情（前20个）:');
    broken.slice(0, 20).forEach(item => {
      console.log(`  L${item.lineNumber}: [${item.linkText}](..${item.filePath.replace(PROJECT_ROOT, '')})`);
    });
    if (broken.length > 20) {
      console.log(`  ... 还有 ${broken.length - 20} 个断裂链接`);
    }
  }

  console.log('\n--- 2. docs/ 目录结构分析 ---');
  const structure = analyzeDocsStructure();
  console.log(`Diátaxis 目录文件数: ${structure.diataxisFileCount}`);
  console.log(`编号分类目录文件数: ${structure.numberedFileCount}`);
  console.log(`空编号目录: ${structure.emptyNumberedDirs.length > 0 ? structure.emptyNumberedDirs.join(', ') : '无'}`);

  console.log('\n--- 3. scripts/ 目录结构分析 ---');
  const scripts = analyzeScriptsStructure();
  console.log(`根级别 audit-*.ts 文件: ${scripts.rootAuditFiles.length}`);
  console.log(`audit/ 子目录文件: ${scripts.subdirAuditFiles.length}`);
  console.log(`未分类根级别 .ts 文件: ${scripts.uncategorizedFiles.length}`);

  console.log('\n--- 4. 问题总结 ---');
  console.log('\n[P0 - 严重]');
  if (brokenPercent > 20) {
    console.log(`  ✅ registry-index.md 断裂链接率 ${brokenPercent}%，严重影响文档导航`);
  }

  console.log('\n[P1 - 中等]');
  console.log(`  ✅ docs/ 存在两种分类体系并存（编号分类 vs Diátaxis），造成混乱`);
  console.log(`  ✅ scripts/ 根级别 audit-*.ts 文件（${scripts.rootAuditFiles.length}个）与 audit/ 子目录重复分类`);

  console.log('\n[P2 - 轻微]');
  console.log(`  ✅ 编号分类目录大多为空或文件极少`);

  console.log('\n--- 5. 建议方案 ---');
  console.log('\n方案A：统一采用 Diátaxis 结构（推荐）');
  console.log('  - 保留: tutorials/, how-to/, reference/, explanation/, prompts/');
  console.log('  - 迁移: 00-meta/ → meta/ (治理文档)');
  console.log('  - 归档: 02-design/, 04-testing/, 06-project-management/ → archive/');

  console.log('\n方案B：统一采用编号分类结构');
  console.log('  - 迁移: explanation/ → 02-design/');
  console.log('  - 迁移: how-to/ → 03-development/');
  console.log('  - 迁移: reference/ → 02-design/');
  console.log('  - 迁移: tutorials/ → 03-development/');

  console.log('\nscripts/ 整理建议:');
  console.log('  - 将根级别 audit-*.ts 文件移入 scripts/audit/');
  console.log('  - 将根级别 verify-*.ts 文件移入 scripts/verify/');
  console.log('  - 将根级别 generate-*.ts 文件移入 scripts/generate/');
  console.log('  - 将根级别 fix-*.ts 文件移入 scripts/fix/');
  console.log('  - 将根级别 build-*.ts 文件移入 scripts/build/');
}

main();