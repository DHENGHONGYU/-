import * as fs from 'fs';
import * as path from 'path';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename).replace(/^\/([A-Z]:)/, '$1');
const SCRIPTS_DIR = __dirname;

interface LinkAction {
  source: string;
  destination: string;
  category: string;
}

function createSymbolicLink(source: string, destination: string): void {
  if (fs.existsSync(destination)) {
    fs.unlinkSync(destination);
  }
  
  fs.symlinkSync(source, destination, 'file');
  console.log(`✓ 符号链接: ${path.basename(source)} → ${destination.replace(SCRIPTS_DIR + '\\', '')}`);
}

function collectRootFiles(): string[] {
  const entries = fs.readdirSync(SCRIPTS_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name);
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
  };

  for (const [pattern, category] of Object.entries(patterns)) {
    if (filename.startsWith(pattern)) {
      return category;
    }
  }

  return null;
}

function createLinks(): LinkAction[] {
  const actions: LinkAction[] = [];
  const rootFiles = collectRootFiles();
  const createdDirs = new Set<string>();

  rootFiles.forEach(file => {
    const category = determineCategory(file);
    if (!category) return;

    const source = path.join(SCRIPTS_DIR, file);
    const destDir = path.join(SCRIPTS_DIR, category);
    const destination = path.join(destDir, file);

    if (!createdDirs.has(destDir)) {
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        console.log(`✓ 创建目录: ${destDir.replace(SCRIPTS_DIR + '\\', '')}`);
      }
      createdDirs.add(destDir);
    }

    if (!fs.existsSync(destination)) {
      createSymbolicLink(source, destination);
      actions.push({ source, destination, category });
    }
  });

  return actions;
}

function updatePackageJson(): void {
  const pkgPath = path.join(SCRIPTS_DIR, '..', 'package.json');
  const content = fs.readFileSync(pkgPath, 'utf-8');
  const pkg = JSON.parse(content);
  let changed = false;

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
  };

  for (const [name, script] of Object.entries(pkg.scripts)) {
    const scriptStr = script as string;
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
  console.log('scripts/ 符号链接分类脚本');
  console.log('='.repeat(80));

  console.log('\n阶段一：创建分类目录和符号链接');
  const actions = createLinks();
  console.log(`\n创建了 ${actions.length} 个符号链接`);

  console.log('\n阶段二：更新 package.json 路径');
  updatePackageJson();

  console.log('\n' + '='.repeat(80));
  console.log('符号链接分类完成！');
  console.log('='.repeat(80));
  console.log('\n说明：');
  console.log('  - 根级别文件保持不动，避免内部相对路径引用失效');
  console.log('  - 通过符号链接实现逻辑分类');
  console.log('  - package.json 路径统一指向子目录');
  console.log('  - 如需回滚：删除符号链接，恢复 package.json');
}

main();