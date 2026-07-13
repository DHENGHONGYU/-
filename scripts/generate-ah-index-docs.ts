import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOCS_DIR = join(__dirname, '../docs');

interface SubCategory {
  id: string;
  name: string;
  directories: string[];
  entryRules?: string[];
  description?: string;
}

interface Category {
  category: string;
  name: string;
  description: string;
  entryRules: string[];
  subCategories: SubCategory[];
}

const CATEGORIES: Category[] = [
  {
    category: 'B',
    name: '架构设计',
    description: '负责系统架构设计和技术决策，定义模块关系和接口规范',
    entryRules: ['架构决策', '模块关系', '接口定义'],
    subCategories: [
      { id: 'B1', name: '架构概览', directories: ['02-design/architecture'], description: '系统整体架构概述和设计原则' },
      { id: 'B2', name: '子系统架构', directories: ['02-design/architecture/subsystems'], description: '各子系统的详细架构设计' },
      { id: 'B3', name: '架构决策记录', directories: ['02-design/architecture/adr'], description: '架构决策的记录和追溯' },
      { id: 'B4', name: '合规审计', directories: ['02-design/architecture/compliance'], description: '架构合规性检查和审计' },
      { id: 'B5', name: '发布管理', directories: ['05-deployment'], description: '部署和发布相关文档' }
    ]
  },
  {
    category: 'C',
    name: '功能模块',
    description: '负责功能模块的规格定义和业务流程描述',
    entryRules: ['功能规格', '业务流程', 'UI映射'],
    subCategories: [
      { id: 'C1', name: '舱室规格', directories: ['02-design/cabins'], description: '各舱室的功能规格定义' },
      { id: 'C2', name: '组件体系', directories: ['02-design/components'], description: 'UI组件体系和设计规范' },
      { id: 'C3', name: '驾驶舱', directories: ['02-design/cockpit'], description: '驾驶舱和Widget相关文档' },
      { id: 'C4', name: '状态管理', directories: ['02-design/store'], description: '状态管理和数据流' },
      { id: 'C5', name: '服务契约', directories: ['02-design/services'], description: '服务接口和契约定义' },
      { id: 'C6', name: '数据层', directories: ['02-design/data-layer'], description: '数据层架构和数据字典' },
      { id: 'C7', name: '数据字典', directories: ['02-design/standards'], description: '核心数据字典和类型定义' }
    ]
  },
  {
    category: 'D',
    name: '技术规范',
    description: '负责技术规范和开发标准的定义',
    entryRules: ['分层规则', '令牌规范', '门禁标准'],
    subCategories: [
      { id: 'D1', name: '编码规范', directories: ['02-design/standards'], description: '编码风格和最佳实践' },
      { id: 'D2', name: '设计令牌', directories: ['02-design/standards/design-tokens'], description: 'UI设计令牌和样式规范' },
      { id: 'D3', name: '质量门禁', directories: ['02-design/standards/quality-gates'], description: '质量门禁和验收标准' },
      { id: 'D4', name: '文档规范', directories: ['02-design/standards'], description: '文档编写规范和模板' },
      { id: 'D5', name: '迁移规范', directories: ['03-development/migration'], description: '代码迁移和重构规范' }
    ]
  },
  {
    category: 'E',
    name: '测试策略',
    description: '负责测试策略和测试用例的定义',
    entryRules: ['测试分层', '覆盖率', '清理义务'],
    subCategories: [
      { id: 'E1', name: '测试分层', directories: ['04-testing'], description: '测试策略和分层设计' },
      { id: 'E2', name: '测试用例', directories: ['04-testing/test-cases'], description: '测试用例和测试数据' },
      { id: 'E3', name: '测试报告', directories: ['04-testing/reports'], description: '测试报告和覆盖率统计' },
      { id: 'E4', name: '测试门禁', directories: ['04-testing/gates'], description: '测试门禁和发布检查' }
    ]
  },
  {
    category: 'F',
    name: 'AI辅助工程治理',
    description: '负责AI辅助工具和工程治理的定义',
    entryRules: ['AI约束', '提示词工程', '飞轮流程'],
    subCategories: [
      { id: 'F1', name: '提示词工程', directories: ['prompts'], description: 'AI提示词模板和最佳实践' },
      { id: 'F2', name: '检查清单', directories: ['03-development/checklists'], description: '开发和运维检查清单' },
      { id: 'F3', name: '记忆层', directories: ['02-design/ai'], description: 'AI记忆层和上下文管理' }
    ]
  },
  {
    category: 'G',
    name: '过程与质量产物',
    description: '负责过程文档和质量产物的管理',
    entryRules: ['自动产物', '变更日志', '质量报告'],
    subCategories: [
      { id: 'G1', name: '审计报告', directories: ['reports/audit'], description: '代码和架构审计报告' },
      { id: 'G2', name: '变更日志', directories: ['reports/changelogs', '06-project-management/changelogs'], description: '项目变更和迭代日志' },
      { id: 'G3', name: '复盘报告', directories: ['reports/retrospectives'], description: '项目复盘和经验总结' },
      { id: 'G4', name: '草稿', directories: ['reports/drafts'], description: '临时草稿和讨论稿' },
      { id: 'G5', name: '发布管理', directories: ['reports/release-management'], description: '发布计划和版本管理' }
    ]
  },
  {
    category: 'H',
    name: '跨域补充',
    description: '负责跨领域补充文档和操作指南',
    entryRules: ['操作指南', 'How-to', 'Runbook'],
    subCategories: [
      { id: 'H1', name: '安全指南', directories: ['03-development/guides/security'], description: '安全实践和漏洞防护' },
      { id: 'H2', name: '运维文档', directories: ['05-deployment/ops'], description: '运维手册和运行指南' },
      { id: 'H3', name: '入门指南', directories: ['03-development/guides/getting-started'], description: '新成员入门和使用指南' },
      { id: 'H4', name: '无障碍', directories: ['03-development/guides/accessibility'], description: '无障碍和国际化支持' }
    ]
  }
];

function getFilesInDirectory(dirPath: string): string[] {
  const files: string[] = [];
  try {
    if (!existsSync(dirPath)) return files;
    const items = readdirSync(dirPath);
    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        files.push(...getFilesInDirectory(fullPath));
      } else if (item.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    console.log(`Error reading ${dirPath}:`, e);
  }
  return files;
}

function generateCategoryIndex(category: Category): void {
  const catDir = join(DOCS_DIR, category.category);
  const indexPath = join(catDir, 'INDEX.md');
  
  let content = `# ${category.category} - ${category.name}\n\n`;
  content += `> **分类**: ${category.category} | **名称**: ${category.name} | **版本**: v1.0.0 | **日期**: ${new Date().toISOString().split('T')[0]}\n\n`;
  content += `---\n\n`;
  content += `## 一、分类职责\n\n`;
  content += `${category.description}\n\n`;
  content += `### 核心职责\n`;
  for (const rule of category.entryRules) {
    content += `- ${rule}\n`;
  }
  content += `\n`;
  
  content += `### 准入规则\n`;
  content += `- ✅ 架构决策类文档\n`;
  content += `- ✅ 模块关系类文档\n`;
  content += `- ✅ 接口定义类文档\n`;
  content += `- ❌ 业务实现细节\n`;
  content += `- ❌ 测试用例和报告\n`;
  content += `- ❌ 临时草稿\n`;
  content += `\n---\n\n`;
  
  content += `## 二、子分类\n\n`;
  content += `| 子分类 | 名称 | 职责 | 关联物理目录 |\n`;
  content += `|--------|------|------|-------------|\n`;
  for (const sub of category.subCategories) {
    content += `| ${sub.id} | ${sub.name} | ${sub.description} | \`${sub.directories.join(', ')}\` |\n`;
  }
  content += `\n---\n\n`;
  
  content += `## 三、文档清单\n\n`;
  for (const sub of category.subCategories) {
    content += `### ${sub.id} - ${sub.name} (\`${sub.directories.join(', ')}\`)\n\n`;
    content += `| 文档 | 状态 |\n`;
    content += `|------|------|\n`;
    
    for (const dir of sub.directories) {
      const dirPath = join(DOCS_DIR, dir);
      const files = getFilesInDirectory(dirPath);
      for (const file of files) {
        const fileName = basename(file);
        content += `| ${fileName} | ✅ 维护中 |\n`;
      }
    }
    content += `\n`;
  }
  
  content += `---\n\n`;
  content += `## 四、维护责任人\n\n`;
  content += `- **分类责任人**: 架构治理团队\n`;
  content += `- **维护频率**: 按需更新\n`;
  content += `- **审批流程**: 重大变更需评审\n`;
  content += `\n---\n\n`;
  content += `## 五、逻辑与物理映射\n\n`;
  content += `> **说明**: ${category.category}类是**逻辑分类层**，文档实际存储在**物理目录层**。${category.category}类目录提供分类视角和治理入口，不存储实际文档。\n\n`;
  content += `| 逻辑分类 | 物理目录 | 路径 |\n`;
  content += `|----------|---------|------|\n`;
  for (const sub of category.subCategories) {
    for (const dir of sub.directories) {
      const relPath = relative(catDir, join(DOCS_DIR, dir)).replace(/\\/g, '/');
      content += `| ${sub.id} - ${sub.name} | ${dir} | [${relPath}](${relPath}) |\n`;
    }
  }
  
  writeFileSync(indexPath, content, 'utf-8');
  console.log(`Generated: ${category.category}/INDEX.md`);
}

function generateSubCategoryIndex(category: Category, sub: SubCategory): void {
  const subDir = join(DOCS_DIR, category.category, sub.id);
  const indexPath = join(subDir, 'INDEX.md');
  
  let content = `# ${sub.id} - ${sub.name}\n\n`;
  content += `> **父分类**: ${category.category} - ${category.name} | **版本**: v1.0.0 | **日期**: ${new Date().toISOString().split('T')[0]}\n\n`;
  content += `---\n\n`;
  content += `## 一、职责描述\n\n`;
  content += `${sub.description}\n\n`;
  
  content += `### 核心职责\n`;
  content += `- 定义${sub.name}相关的架构和设计\n`;
  content += `- 维护${sub.name}相关的文档\n`;
  content += `- 确保${sub.name}的一致性和完整性\n`;
  content += `\n---\n\n`;
  
  content += `## 二、包含文档列表\n\n`;
  content += `| 文档 | 状态 |\n`;
  content += `|------|------|\n`;
  
  for (const dir of sub.directories) {
    const dirPath = join(DOCS_DIR, dir);
    const files = getFilesInDirectory(dirPath);
    for (const file of files) {
      const fileName = basename(file);
      content += `| ${fileName} | ✅ 维护中 |\n`;
    }
  }
  
  content += `\n---\n\n`;
  content += `## 三、准入条件\n\n`;
  content += `### ✅ 允许纳入的文档类型\n`;
  content += `- ${sub.name}相关的架构文档\n`;
  content += `- ${sub.name}相关的设计规范\n`;
  content += `- ${sub.name}相关的接口定义\n`;
  content += `\n### ❌ 禁止纳入的文档类型\n`;
  content += `- 其他分类的文档\n`;
  content += `- 测试用例和报告\n`;
  content += `- 临时草稿和讨论稿\n`;
  content += `\n---\n\n`;
  content += `## 四、维护责任人\n\n`;
  content += `- **责任人**: 架构治理团队\n`;
  content += `- **维护频率**: 按需更新\n`;
  content += `- **审批流程**: 重大变更需评审\n`;
  content += `\n---\n\n`;
  content += `## 五、关联目录\n\n`;
  content += `| 物理目录 | 路径 | 说明 |\n`;
  content += `|----------|------|------|\n`;
  
  for (const dir of