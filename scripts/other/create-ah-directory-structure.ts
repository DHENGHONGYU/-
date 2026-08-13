import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOCS_DIR = join(__dirname, '../docs');

interface CategoryMap {
  category: string;
  name: string;
  subCategories: { id: string; name: string; directories: string[] }[];
}

const A_H_MAP: CategoryMap[] = [
  {
    category: 'A',
    name: '导航与治理',
    subCategories: [
      { id: 'A1', name: '索引与宪法', directories: ['meta'] },
      { id: 'A2', name: '需求规格', directories: ['01-requirements'] },
      { id: 'A3', name: '插件集成', directories: ['03-development/plugins'] }
    ]
  },
  {
    category: 'B',
    name: '架构设计',
    subCategories: [
      { id: 'B1', name: '架构概览', directories: ['02-design/architecture'] },
      { id: 'B2', name: '子系统架构', directories: ['02-design/architecture/subsystems'] },
      { id: 'B3', name: '架构决策记录', directories: ['02-design/architecture/adr'] },
      { id: 'B4', name: '合规审计', directories: ['02-design/architecture/compliance'] },
      { id: 'B5', name: '发布管理', directories: ['05-deployment'] }
    ]
  },
  {
    category: 'C',
    name: '功能模块',
    subCategories: [
      { id: 'C1', name: '舱室规格', directories: ['02-design/cabins'] },
      { id: 'C2', name: '组件体系', directories: ['02-design/components'] },
      { id: 'C3', name: '驾驶舱', directories: ['02-design/cockpit'] },
      { id: 'C4', name: '状态管理', directories: ['02-design/store'] },
      { id: 'C5', name: '服务契约', directories: ['02-design/services'] },
      { id: 'C6', name: '数据层', directories: ['02-design/data-layer'] },
      { id: 'C7', name: '数据字典', directories: ['02-design/standards'] }
    ]
  },
  {
    category: 'D',
    name: '技术规范',
    subCategories: [
      { id: 'D1', name: '编码规范', directories: ['02-design/standards'] },
      { id: 'D2', name: '设计令牌', directories: ['02-design/standards/design-tokens'] },
      { id: 'D3', name: '质量门禁', directories: ['02-design/standards/quality-gates'] },
      { id: 'D4', name: '文档规范', directories: ['02-design/standards'] },
      { id: 'D5', name: '迁移规范', directories: ['03-development/migration'] }
    ]
  },
  {
    category: 'E',
    name: '测试策略',
    subCategories: [
      { id: 'E1', name: '测试分层', directories: ['04-testing'] },
      { id: 'E2', name: '测试用例', directories: ['04-testing/test-cases'] },
      { id: 'E3', name: '测试报告', directories: ['04-testing/reports'] },
      { id: 'E4', name: '测试门禁', directories: ['04-testing/gates'] }
    ]
  },
  {
    category: 'F',
    name: 'AI辅助工程治理',
    subCategories: [
      { id: 'F1', name: '提示词工程', directories: ['prompts'] },
      { id: 'F2', name: '检查清单', directories: ['03-development/checklists'] },
      { id: 'F3', name: '记忆层', directories: ['02-design/ai'] }
    ]
  },
  {
    category: 'G',
    name: '过程与质量产物',
    subCategories: [
      { id: 'G1', name: '审计报告', directories: ['reports/audit'] },
      { id: 'G2', name: '变更日志', directories: ['reports/changelogs', '06-project-management/changelogs'] },
      { id: 'G3', name: '复盘报告', directories: ['reports/retrospectives'] },
      { id: 'G4', name: '草稿', directories: ['reports/drafts'] },
      { id: 'G5', name: '发布管理', directories: ['reports/release-management'] }
    ]
  },
  {
    category: 'H',
    name: '跨域补充',
    subCategories: [
      { id: 'H1', name: '安全指南', directories: ['03-development/guides/security'] },
      { id: 'H2', name: '运维文档', directories: ['05-deployment/ops'] },
      { id: 'H3', name: '入门指南', directories: ['03-development/guides/getting-started'] },
      { id: 'H4', name: '无障碍', directories: ['03-development/guides/accessibility'] }
    ]
  }
];

function createDirectoryIfNotExists(path: string): boolean {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
    return true;
  }
  return false;
}

function createIndexFile(category: CategoryMap): void {
  const indexPath = join(DOCS_DIR, category.category, 'INDEX.md');
  
  let content = `# ${category.category} - ${category.name}\n\n`;
  content += `> **分类**: ${category.category} | **名称**: ${category.name}\n\n`;
  
  for (const sub of category.subCategories) {
    content += `## ${sub.id} - ${sub.name}\n\n`;
    content += `| 目录路径 |\n|----------|\n`;
    for (const dir of sub.directories) {
      content += `| \`${dir}\` |\n`;
    }
    content += '\n';
  }
  
  writeFileSync(indexPath, content, 'utf-8');
}

function createRootIndex(): void {
  let content = `# V9 文档体系 - A-H 分类索引\n\n`;
  content += `> **版本**: v1.0.0 | **日期**: ${new Date().toISOString().split('T')[0]}\n\n`;
  
  for (const category of A_H_MAP) {
    content += `## [${category.category}] ${category.name}\n\n`;
    content += `${category.name} 相关文档分类入口\n\n`;
    content += `- [分类索引](${category.category}/INDEX.md)\n\n`;
  }
  
  content += `---\n\n`;
  content += `## 快速导航\n\n`;
  content += `- [数字编码目录结构](../README.md)\n`;
  content += `- [文档治理宪法](meta/governance.md)\n`;
  
  writeFileSync(join(DOCS_DIR, 'a-h-index.md'), content, 'utf-8');
}

function main(): void {
  console.log(`=== Creating A-H Directory Structure ===\n`);
  
  let totalCreated = 0;
  
  for (const category of A_H_MAP) {
    const catDir = join(DOCS_DIR, category.category);
    const created = createDirectoryIfNotExists(catDir);
    
    if (created) {
      console.log(`Created: ${category.category}/ (${category.name})`);
      totalCreated++;
    } else {
      console.log(`Exists: ${category.category}/ (${category.name})`);
    }
    
    for (const sub of category.subCategories) {
      const subDir = join(catDir, sub.id);
      const subCreated = createDirectoryIfNotExists(subDir);
      
      if (subCreated) {
        console.log(`  Created: ${category.category}/${sub.id}/ (${sub.name})`);
        totalCreated++;
      } else {
        console.log(`  Exists: ${category.category}/${sub.id}/ (${sub.name})`);
      }
      
      const subIndexPath = join(subDir, 'INDEX.md');
      let subContent = `# ${sub.id} - ${sub.name}\n\n`;
      subContent += `> **父分类**: ${category.category} - ${category.name}\n\n`;
      subContent += `## 关联目录\n\n`;
      for (const dir of sub.directories) {
        const relativePath = relative(subDir, join(DOCS_DIR, dir));
        subContent += `- [${dir}](${relativePath})\n`;
      }
      writeFileSync(subIndexPath, subContent, 'utf-8');
    }
    
    createIndexFile(category);
    console.log(`  Generated: ${category.category}/INDEX.md`);
    console.log();
  }
  
  createRootIndex();
  console.log(`Generated: a-h-index.md\n`);
  
  console.log(`=== Creation Complete ===`);
  console.log(`Total directories created: ${totalCreated}`);
  console.log(`Total categories: ${A_H_MAP.length}`);
  console.log(`Total subcategories: ${A_H_MAP.reduce((sum, cat) => sum + cat.subCategories.length, 0)}`);
}

if (process.argv[1] && process.argv[1].endsWith('create-ah-directory-structure.ts')) {
  main();
}