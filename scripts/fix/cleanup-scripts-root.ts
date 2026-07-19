import * as fs from 'fs';
import * as path from 'path';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename).replace(/^\/([A-Z]:)/, '$1');
const SCRIPTS_DIR = __dirname;

interface FileAction {
  action: 'delete' | 'keep' | 'move';
  source: string;
  destination?: string;
  reason: string;
}

function collectRootFiles(): string[] {
  const entries = fs.readdirSync(SCRIPTS_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
    .map(entry => entry.name);
}

function findDuplicates(rootFiles: string[]): FileAction[] {
  const actions: FileAction[] = [];
  const subdirs = ['audit', 'verify', 'generate', 'fix', 'build', 'monitor', 'security', 'quality', 'test-tool', 'docs-tool', 'migrate'];

  rootFiles.forEach(file => {
    let found = false;
    
    for (const subdir of subdirs) {
      const subdirPath = path.join(SCRIPTS_DIR, subdir, file);
      if (fs.existsSync(subdirPath)) {
        actions.push({
          action: 'delete',
          source: path.join(SCRIPTS_DIR, file),
          reason: `重复文件，已存在于 ${subdir}/`,
        });
        found = true;
        break;
      }
    }

    if (!found) {
      const category = determineCategory(file);
      if (category) {
        actions.push({
          action: 'move',
          source: path.join(SCRIPTS_DIR, file),
          destination: path.join(SCRIPTS_DIR, category, file),
          reason: `移动到 ${category}/ 目录`,
        });
      } else {
        actions.push({
          action: 'keep',
          source: path.join(SCRIPTS_DIR, file),
          reason: '无合适分类，保留在根目录',
        });
      }
    }
  });

  return actions;
}

function determineCategory(filename: string): string | null {
  const patterns: Record<string, string> = {
    'audit-': 'audit',
    'verify-': 'verify',
    'generate-': 'generate',
    'fix-': 'fix',
    'build-': 'build',
    'migrate-': 'migrate',
    'monitor-': 'monitor',
    'security-': 'security',
    'quality-': 'quality',
    'test-': 'test-tool',
    'assess-': 'audit',
    'diagnose-': 'audit',
    'cleanup-': 'fix',
    'update-': 'fix',
    'organize-': 'fix',
  };

  for (const [pattern, category] of Object.entries(patterns)) {
    if (filename.startsWith(pattern)) {
      return category;
    }
  }

  return null;
}

function executeActions(actions: FileAction[]): void {
  let deleted = 0;
  let moved = 0;
  let kept = 0;

  actions.forEach(action => {
    const relativePath = action.source.replace(SCRIPTS_DIR + '\\', '');
    
    switch (action.action) {
      case 'delete':
        fs.unlinkSync(action.source);
        console.log(`✓ 删除重复: ${relativePath}`);
        deleted++;
        break;
      
      case 'move':
        if (action.destination) {
          const destDir = path.dirname(action.destination);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.renameSync(action.source, action.destination);
          console.log(`✓ 移动: ${relativePath} → ${action.destination.replace(SCRIPTS_DIR + '\\', '')}`);
          moved++;
        }
        break;
      
      case 'keep':
        console.log(`  保留: ${relativePath}`);
        kept++;
        break;
    }
  });

  console.log(`\n统计: 删除 ${deleted} 个, 移动 ${moved} 个, 保留 ${kept} 个`);
}

function updatePackageJson(): void {
  const pkgPath = path.join(SCRIPTS_DIR, '..', '..', 'package.json');
  const content = fs.readFileSync(pkgPath, 'utf-8');
  const pkg = JSON.parse(content);
  let changed = false;

  for (const [name, script] of Object.entries(pkg.scripts)) {
    const scriptStr = script as string;
    const patterns: Record<string, string> = {
      'scripts/audit-': 'scripts/audit/audit-',
      'scripts/verify-': 'scripts/verify/verify-',
      'scripts/generate-': 'scripts/generate/generate-',
      'scripts/fix-': 'scripts/fix/fix-',
      'scripts/build-': 'scripts/build/build-',
      'scripts/migrate-': 'scripts/migrate/migrate-',
      'scripts/monitor-': 'scripts/monitor/monitor-',
      'scripts/security-': 'scripts/security/security-',
      'scripts/quality-': 'scripts/quality/quality-',
      'scripts/test-': 'scripts/test-tool/test-',
      'scripts/assess-': 'scripts/audit/assess-',
      'scripts/diagnose-': 'scripts/audit/diagnose-',
      'scripts/cleanup-': 'scripts/fix/cleanup-',
      'scripts/update-': 'scripts/fix/update-',
      'scripts/organize-': 'scripts/fix/organize-',
    };

    let updatedScript = scriptStr;
    for (const [oldPrefix, newPrefix] of Object.entries(patterns)) {
      if (updatedScript.includes(oldPrefix) && !updatedScript.includes(newPrefix)) {
        updatedScript = updatedScript.replace(oldPrefix, newPrefix);
        changed = true;
      }
    }

    if (updatedScript !== scriptStr) {
      pkg.scripts[name] = updatedScript;
    }
  }

  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('\n✓ 更新 package.json 脚本路径');
  }
}

function main() {
  console.log('='.repeat(80));
  console.log('scripts/ 根级别文件清理脚本');
  console.log('='.repeat(80));

  console.log('\n阶段一：收集根级别文件');
  const rootFiles = collectRootFiles();
  console.log(`发现 ${rootFiles.length} 个根级别 .ts 文件`);

  console.log('\n阶段二：分析重复和分类');
  const actions = findDuplicates(rootFiles);

  console.log('\n阶段三：执行清理操作');
  executeActions(actions);

  console.log('\n阶段四：更新 package.json 路径');
  updatePackageJson();

  console.log('\n' + '='.repeat(80));
  console.log('清理完成！');
  console.log('='.repeat(80));
}

main();