import * as fs from 'fs';
import * as path from 'path';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename).replace(/^\/([A-Z]:)/, '$1');
const SCRIPTS_DIR = __dirname;

interface FileMove {
  from: string;
  to: string;
}

function organizeScripts(): { moved: FileMove[]; skipped: string[]; errors: string[] } {
  const moved: FileMove[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const entries = fs.readdirSync(SCRIPTS_DIR, { withFileTypes: true });

  const categoryMap: Record<string, string> = {
    'audit-': 'audit',
    'verify-': 'verify',
    'generate-': 'generate',
    'fix-': 'fix',
    'build-': 'build',
  };

  entries.forEach(entry => {
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      const fileName = entry.name;
      const fromPath = path.join(SCRIPTS_DIR, fileName);

      let targetDir: string | null = null;
      for (const [prefix, dir] of Object.entries(categoryMap)) {
        if (fileName.startsWith(prefix)) {
          targetDir = dir;
          break;
        }
      }

      if (targetDir) {
        const targetPath = path.join(SCRIPTS_DIR, targetDir, fileName);

        if (!fs.existsSync(path.join(SCRIPTS_DIR, targetDir))) {
          fs.mkdirSync(path.join(SCRIPTS_DIR, targetDir), { recursive: true });
        }

        if (fs.existsSync(targetPath)) {
          skipped.push(`${fileName} -> ${targetDir}/ (文件已存在)`);
          return;
        }

        try {
          fs.renameSync(fromPath, targetPath);
          moved.push({ from: fileName, to: `${targetDir}/${fileName}` });
        } catch (err) {
          errors.push(`${fileName}: ${(err as Error).message}`);
        }
      } else {
        skipped.push(`${fileName} (未匹配分类前缀)`);
      }
    }
  });

  return { moved, skipped, errors };
}

function main() {
  console.log('='.repeat(80));
  console.log('scripts/ 目录整理脚本');
  console.log('='.repeat(80));

  const { moved, skipped, errors } = organizeScripts();

  console.log(`\n已移动文件: ${moved.length}`);
  moved.forEach(m => console.log(`  ✓ ${m.from} -> ${m.to}`));

  console.log(`\n跳过文件: ${skipped.length}`);
  skipped.slice(0, 10).forEach(s => console.log(`  - ${s}`));
  if (skipped.length > 10) {
    console.log(`  ... 还有 ${skipped.length - 10} 个跳过的文件`);
  }

  if (errors.length > 0) {
    console.log(`\n错误: ${errors.length}`);
    errors.forEach(e => console.log(`  ✗ ${e}`));
  }

  console.log('\n整理完成！');
  console.log('\n更新 package.json 脚本路径：');
  moved.forEach(m => {
    console.log(`  "${m.from}" -> "${m.to}"`);
  });
}

main();