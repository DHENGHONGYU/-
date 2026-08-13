import * as fs from 'fs';
import * as path from 'path';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename).replace(/^\/([A-Z]:)/, '$1');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');

interface MigrationItem {
  source: string;
  destination: string;
  type: 'file' | 'directory';
}

function createMigrationMap(): MigrationItem[] {
  const items: MigrationItem[] = [];
  
  const mappings: Record<string, string> = {
    'meta/': 'reference/meta/',
    '02-design/': 'explanation/design/',
    '04-testing/': 'how-to/testing/',
    '06-project-management/': 'reference/project/',
    '07-archive/': 'archive/',
  };

  for (const [source, destination] of Object.entries(mappings)) {
    const sourcePath = path.join(DOCS_DIR, source);
    const destPath = path.join(DOCS_DIR, destination);
    
    if (fs.existsSync(sourcePath)) {
      const stat = fs.statSync(sourcePath);
      items.push({
        source: sourcePath,
        destination: destPath,
        type: stat.isDirectory() ? 'directory' : 'file',
      });
    }
  }

  return items;
}

function createDirectoryIfNotExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ 创建目录: ${dir.replace(PROJECT_ROOT + '\\', '')}`);
  }
}

function copyFileWithMetadata(source: string, destination: string): void {
  if (!fs.existsSync(source)) {
    console.log(`⚠️ 源文件不存在: ${source}`);
    return;
  }
  
  createDirectoryIfNotExists(path.dirname(destination));
  
  fs.copyFileSync(source, destination);
  
  const sourceStat = fs.statSync(source);
  fs.utimesSync(destination, sourceStat.atime, sourceStat.mtime);
  
  console.log(`✓ 复制: ${source.replace(PROJECT_ROOT + '\\', '')} → ${destination.replace(PROJECT_ROOT + '\\', '')}`);
}

function copyDirectory(source: string, destination: string): void {
  if (!fs.existsSync(source)) {
    console.log(`⚠️ 源目录不存在: ${source}`);
    return;
  }

  createDirectoryIfNotExists(destination);

  const entries = fs.readdirSync(source, { withFileTypes: true });
  
  entries.forEach(entry => {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destPath);
    } else {
      copyFileWithMetadata(sourcePath, destPath);
    }
  });
}

function createRedirectMarkdown(oldPath: string, newPath: string): void {
  const relativeOldPath = oldPath.replace(DOCS_DIR + '\\', '');
  const relativeNewPath = newPath.replace(DOCS_DIR + '\\', '');
  
  const content = `# 已迁移

> ⚠️ 此文档已迁移至新位置：[${relativeNewPath}](./${relativeNewPath})

**旧路径**: ${relativeOldPath}  
**新路径**: ${relativeNewPath}

---

此文件保留用于保持旧链接的兼容性。请更新您的引用指向新位置。
`;
  
  fs.writeFileSync(oldPath + '.md', content);
  console.log(`✓ 创建重定向: ${oldPath}.md`);
}

function updateRegistryIndex(): void {
  const registryPath = path.join(DOCS_DIR, 'meta', 'registry-index.md');
  
  if (!fs.existsSync(registryPath)) {
    console.log('⚠️ registry-index.md 不存在');
    return;
  }

  const content = fs.readFileSync(registryPath, 'utf-8');
  let updatedContent = content;
  
  const pathMappings: Record<string, string> = {
    '../meta/': '../reference/meta/',
    '../02-design/': '../explanation/design/',
    '../04-testing/': '../how-to/testing/',
    '../06-project-management/': '../reference/project/',
    '../07-archive/': '../archive/',
  };

  for (const [oldPrefix, newPrefix] of Object.entries(pathMappings)) {
    updatedContent = updatedContent.replace(new RegExp(oldPrefix, 'g'), newPrefix);
  }

  if (updatedContent !== content) {
    fs.writeFileSync(registryPath, updatedContent);
    console.log('✓ 更新 registry-index.md 路径引用');
  }
}

function main() {
  console.log('='.repeat(80));
  console.log('docs/ 分类体系统一迁移脚本');
  console.log('='.repeat(80));
  console.log('\n阶段一：创建 Diátaxis 目录结构');
  
  const diataxisDirs = [
    'reference/meta',
    'explanation/design',
    'how-to/testing',
    'reference/project',
    'archive',
  ];

  diataxisDirs.forEach(dir => {
    createDirectoryIfNotExists(path.join(DOCS_DIR, dir));
  });

  console.log('\n阶段二：复制文件到新位置');
  
  const migrations = createMigrationMap();
  
  migrations.forEach(item => {
    if (item.type === 'directory') {
      copyDirectory(item.source, item.destination);
    } else {
      copyFileWithMetadata(item.source, item.destination);
    }
  });

  console.log('\n阶段三：更新 registry-index.md');
  updateRegistryIndex();

  console.log('\n阶段四：创建重定向文件（保留旧链接兼容性）');
  
  migrations.forEach(item => {
    const relativeSource = item.source.replace(DOCS_DIR + '\\', '');
    
    if (!relativeSource.startsWith('meta')) {
      createRedirectMarkdown(
        path.join(DOCS_DIR, relativeSource),
        path.join(DOCS_DIR, item.destination.replace(DOCS_DIR + '\\', ''))
      );
    }
  });

  console.log('\n阶段五：创建 docs/README.md 统一入口');
  
  const readmeContent = `# FinSightV9 文档中心

欢迎使用 FinSightV9 智能投研系统文档中心。

## 文档导航

### 🚀 入门教程
- [快速开始](./tutorials/) - 新用户入门指南

### 📖 使用指南
- [操作指南](./how-to/) - 具体任务的操作步骤
- [测试指南](./how-to/testing/) - 测试相关文档

### 📚 参考文档
- [API 参考](./reference/) - API、配置、类型定义
- [元数据](./reference/meta/) - 项目元数据和注册信息
- [项目管理](./reference/project/) - 项目管理相关文档

### 🧠 概念解释
- [设计决策](./explanation/design/) - 架构设计和技术决策
- [原理说明](./explanation/) - 核心概念和原理

### 📊 报告
- [审计报告](./reports/audit/) - 系统审计报告
- [变更日志](./reports/changelogs/) - 版本变更记录
- [技术债务](./reports/) - 技术债务和质量报告

### 🗄️ 归档
- [历史归档](./archive/) - 旧版本文档和历史记录

---

## 关于项目

FinSightV9 是一个基于 AI 的智能投研系统，提供全面的股票分析、投资决策支持和交易执行功能。

## 贡献

欢迎为文档做出贡献！请遵循项目的贡献指南。

---

*文档中心基于 Diátaxis 文档分类体系构建*
`;
  
  const readmePath = path.join(DOCS_DIR, 'docs/explanation/README.md');
  fs.writeFileSync(readmePath, readmeContent);
  console.log('docs/explanation/README.md');

  console.log('\n' + '='.repeat(80));
  console.log('迁移完成！');
  console.log('='.repeat(80));
  console.log('\n后续步骤：');
  console.log('  1. 验证文档链接是否正常');
  console.log('  2. 更新其他文档中的内部引用');
  console.log('  3. 运行 audit:docs 检查文档完整性');
  console.log('  4. 确认无误后可删除旧编号目录（00-meta, 02-design 等）');
}

main();