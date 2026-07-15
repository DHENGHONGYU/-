import * as fs from 'fs';
import * as path from 'path';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename).replace(/^\/([A-Z]:)/, '$1');
const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');

interface ScriptUpdate {
  oldPath: string;
  newPath: string;
}

function updatePackageJson(): { updated: ScriptUpdate[]; unchanged: string[] } {
  const content = fs.readFileSync(PACKAGE_JSON, 'utf-8');
  const pkg = JSON.parse(content);
  
  const updated: ScriptUpdate[] = [];
  const unchanged: string[] = [];
  
  const categoryMap: Record<string, string> = {
    'scripts/audit-': 'scripts/audit/audit-',
    'scripts/verify-': 'scripts/verify/verify-',
    'scripts/generate-': 'scripts/generate/generate-',
    'scripts/fix-': 'scripts/fix/fix-',
    'scripts/build-': 'scripts/build/build-',
  };

  for (const [name, script] of Object.entries(pkg.scripts)) {
    let updatedScript = script as string;
    let changed = false;

    for (const [oldPrefix, newPrefix] of Object.entries(categoryMap)) {
      if (updatedScript.includes(oldPrefix) && !updatedScript.includes(newPrefix)) {
        updatedScript = updatedScript.replace(oldPrefix, newPrefix);
        changed = true;
      }
    }

    if (changed) {
      pkg.scripts[name] = updatedScript;
      updated.push({ oldPath: script as string, newPath: updatedScript });
    } else {
      unchanged.push(name);
    }
  }

  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2));

  return { updated, unchanged };
}

function main() {
  console.log('='.repeat(80));
  console.log('更新 package.json 脚本路径');
  console.log('='.repeat(80));

  const { updated, unchanged } = updatePackageJson();

  console.log(`\n已更新脚本: ${updated.length}`);
  updated.forEach(u => console.log(`  ✓ ${u.oldPath}`));
  updated.forEach(u => console.log(`    → ${u.newPath}`));

  console.log(`\n未变更脚本: ${unchanged.length}`);
  unchanged.slice(0, 10).forEach(n => console.log(`  - ${n}`));
  if (unchanged.length > 10) {
    console.log(`  ... 还有 ${unchanged.length - 10} 个未变更脚本`);
  }

  console.log('\n更新完成！');
}

main();