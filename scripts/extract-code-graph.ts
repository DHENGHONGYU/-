#!/usr/bin/env ts-node
/**
 * 代码关系提取工具 - V9项目知识图谱生成器
 * 
 * 功能：
 * 1. 解析TypeScript/JavaScript文件
 * 2. 提取import依赖关系
 * 3. 识别跨层调用违规
 * 4. 检测硬编码元素
 * 5. 输出结构化JSON数据供可视化使用
 * 
 * 使用方法：
 * npm run extract-code-graph
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 类型定义
// ============================================================

interface FileNode {
  path: string;
  layer: 'config' | 'core' | 'data' | 'lib' | 'services' | 'store' | 'pages' | 'components' | 'portal' | 'constants' | 'unknown';
  lineCount: number;
  imports: ImportRelation[];
  exports: string[];
  hardcodedColors: HardcodedElement[];
  magicNumbers: HardcodedElement[];
  anyTypes: HardcodedElement[];
  eventListeners: EventListenerInfo[];
}

interface ImportRelation {
  from: string;
  to: string;
  importedSymbols: string[];
  isRelative: boolean;
  layer: string;
}

interface HardcodedElement {
  line: number;
  column: number;
  value: string;
  type: 'hex-color' | 'tailwind-color' | 'magic-number' | 'any-type';
}

interface EventListenerInfo {
  line: number;
  type: 'useEffect' | 'addEventListener' | 'subscribe';
  hasCleanup: boolean;
  cleanupType?: string;
}

interface CodeGraph {
  version: string;
  generatedAt: string;
  totalFiles: number;
  totalLines: number;
  files: FileNode[];
  violations: Violation[];
  statistics: GraphStatistics;
}

interface Violation {
  type: 'cross-layer-call' | 'hardcoded-color' | 'magic-number' | 'any-type' | 'missing-cleanup';
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  message: string;
  suggestion: string;
}

interface GraphStatistics {
  byLayer: Record<string, { fileCount: number; lineCount: number }>;
  violationsByType: Record<string, number>;
  topImportedFiles: Array<{ file: string; importCount: number }>;
  largestFiles: Array<{ file: string; lineCount: number }>;
}

// ============================================================
// 层级识别
// ============================================================

function detectLayer(filePath: string): FileNode['layer'] {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  if (normalizedPath.includes('/src/config/')) return 'config';
  if (normalizedPath.includes('/src/core/')) return 'core';
  if (normalizedPath.includes('/src/data/')) return 'data';
  if (normalizedPath.includes('/src/lib/')) return 'lib';
  if (normalizedPath.includes('/src/services/')) return 'services';
  if (normalizedPath.includes('/src/store/')) return 'store';
  if (normalizedPath.includes('/src/pages/')) return 'pages';
  if (normalizedPath.includes('/src/components/')) return 'components';
  if (normalizedPath.includes('/src/portal/')) return 'portal';
  if (normalizedPath.includes('/src/constants/')) return 'constants';
  
  return 'unknown';
}

// ============================================================
// 依赖方向规则
// ============================================================

const LAYER_DEPEND_RULES: Record<string, string[]> = {
  pages: ['store', 'services', 'components', 'constants', 'lib'],
  components: ['store', 'services', 'constants', 'lib', 'ui'],
  store: ['services', 'core', 'lib', 'constants'],
  services: ['core', 'data', 'lib', 'constants'],
  core: ['data', 'lib', 'constants', 'config'],
  data: ['lib', 'constants', 'config'],
  lib: ['constants', 'config'],
  config: ['constants'],
  constants: [],
  portal: ['store', 'services', 'components', 'constants', 'lib'],
};

function isValidDependency(fromLayer: string, toLayer: string): boolean {
  const allowed = LAYER_DEPEND_RULES[fromLayer];
  if (!allowed) return true; // unknown layer, allow
  return allowed.includes(toLayer);
}

// ============================================================
// AST分析器
// ============================================================

class CodeAnalyzer {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private fileContent: string;
  private lines: string[];

  constructor(filePath: string, content: string) {
    this.filePath = filePath;
    this.fileContent = content;
    this.lines = content.split('\n');
    this.sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );
  }

  analyze(): FileNode {
    const imports = this.extractImports();
    const exports = this.extractExports();
    const hardcodedColors = this.findHardcodedColors();
    const magicNumbers = this.findMagicNumbers();
    const anyTypes = this.findAnyTypes();
    const eventListeners = this.findEventListeners();

    return {
      path: this.filePath,
      layer: detectLayer(this.filePath),
      lineCount: this.lines.length,
      imports,
      exports,
      hardcodedColors,
      magicNumbers,
      anyTypes,
      eventListeners,
    };
  }

  private extractImports(): ImportRelation[] {
    const imports: ImportRelation[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier.getText().replace(/['"]/g, '');
        const importedSymbols: string[] = [];

        if (node.importClause) {
          if (node.importClause.name) {
            importedSymbols.push(node.importClause.name.getText());
          }
          if (node.importClause.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              node.importClause.namedBindings.elements.forEach(element => {
                importedSymbols.push(element.name.getText());
              });
            }
          }
        }

        const isRelative = moduleSpecifier.startsWith('.');
        let targetLayer = 'unknown';
        
        if (isRelative) {
          const resolvedPath = path.resolve(path.dirname(this.filePath), moduleSpecifier);
          targetLayer = detectLayer(resolvedPath);
        } else if (moduleSpecifier.startsWith('@/')) {
          targetLayer = detectLayer(moduleSpecifier);
        }

        imports.push({
          from: this.filePath,
          to: moduleSpecifier,
          importedSymbols,
          isRelative,
          layer: targetLayer,
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return imports;
  }

  private extractExports(): string[] {
    const exports: string[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
        exports.push(node.getText());
      }
      if (ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        exports.push(node.name?.getText() || 'anonymous');
      }
      if (ts.isClassDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        exports.push(node.name?.getText() || 'anonymous');
      }

      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return exports;
  }

  private findHardcodedColors(): HardcodedElement[] {
    const colors: HardcodedElement[] = [];
    const hexColorRegex = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b/g;
    const tailwindColorRegex = /\b(text|bg|border)-(red|blue|green|yellow|purple|pink|gray|grey|indigo|blue)-(50|100|200|300|400|500|600|700|800|900)\b/g;

    this.lines.forEach((line, index) => {
      let match;
      
      // HEX颜色
      while ((match = hexColorRegex.exec(line)) !== null) {
        colors.push({
          line: index + 1,
          column: match.index + 1,
          value: match[0],
          type: 'hex-color',
        });
      }

      // Tailwind颜色类
      while ((match = tailwindColorRegex.exec(line)) !== null) {
        colors.push({
          line: index + 1,
          column: match.index + 1,
          value: match[0],
          type: 'tailwind-color',
        });
      }
    });

    return colors;
  }

  private findMagicNumbers(): HardcodedElement[] {
    const numbers: HardcodedElement[] = [];
    const magicNumberRegex = /\b(\d{3,})\b/g;
    
    // 排除的行模式
    const excludePatterns = [
      /import\s+/,
      /export\s+/,
      /\/\/\s*/,
      /\/\*/,
      /\*\//,
      /from\s+['"]/,
      /require\(/,
      /test\(/,
      /describe\(/,
      /it\(/,
    ];

    this.lines.forEach((line, index) => {
      // 跳过排除的行
      if (excludePatterns.some(pattern => pattern.test(line))) {
        return;
      }

      let match;
      while ((match = magicNumberRegex.exec(line)) !== null) {
        const num = parseInt(match[1]);
        // 排除常见的非魔法数字
        if (num === 100 || num === 1000 || num === 10000) continue;
        if (num >= 1900 && num <= 2100) continue; // 年份
        
        numbers.push({
          line: index + 1,
          column: match.index + 1,
          value: match[1],
          type: 'magic-number',
        });
      }
    });

    return numbers;
  }

  private findAnyTypes(): HardcodedElement[] {
    const anyTypes: HardcodedElement[] = [];
    const anyRegex = /:\s*any\b/g;

    this.lines.forEach((line, index) => {
      let match;
      while ((match = anyRegex.exec(line)) !== null) {
        anyTypes.push({
          line: index + 1,
          column: match.index + 1,
          value: 'any',
          type: 'any-type',
        });
      }
    });

    return anyTypes;
  }

  private findEventListeners(): EventListenerInfo[] {
    const listeners: EventListenerInfo[] = [];

    const visit = (node: ts.Node) => {
      // useEffect调用
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        if (node.expression.text === 'useEffect') {
          const hasCleanup = this.checkUseEffectCleanup(node);
          listeners.push({
            line: this.getLineOfNode(node),
            type: 'useEffect',
            hasCleanup,
            cleanupType: hasCleanup ? 'return-function' : undefined,
          });
        }
      }

      // addEventListener调用
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        if (node.expression.name.text === 'addEventListener') {
          listeners.push({
            line: this.getLineOfNode(node),
            type: 'addEventListener',
            hasCleanup: false, // 需要进一步检查
          });
        }
      }

      // subscribe调用
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        if (node.expression.name.text === 'subscribe') {
          listeners.push({
            line: this.getLineOfNode(node),
            type: 'subscribe',
            hasCleanup: false, // 需要进一步检查
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return listeners;
  }

  private checkUseEffectCleanup(node: ts.CallExpression): boolean {
    // 简化检查：查看useEffect的回调函数是否有return语句
    const callback = node.arguments[0];
    if (!callback || !ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) {
      return false;
    }

    const body = callback.body;
    if (ts.isBlock(body)) {
      return body.statements.some(stmt => ts.isReturnStatement(stmt));
    }

    return false;
  }

  private getLineOfNode(node: ts.Node): number {
    const { line } = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return line + 1;
  }
}

// ============================================================
// 违规检测器
// ============================================================

class ViolationDetector {
  detect(files: FileNode[]): Violation[] {
    const violations: Violation[] = [];

    files.forEach(file => {
      // 跨层调用检测
      file.imports.forEach(imp => {
        if (!isValidDependency(file.layer, imp.layer)) {
          violations.push({
            type: 'cross-layer-call',
            severity: 'error',
            file: file.path,
            line: 1, // 简化：import通常在文件顶部
            message: `违规跨层调用: ${file.layer} → ${imp.layer}`,
            suggestion: `${file.layer}层只能依赖: ${LAYER_DEPEND_RULES[file.layer]?.join(', ') || '无'}`,
          });
        }
      });

      // 硬编码颜色检测
      file.hardcodedColors.forEach(color => {
        violations.push({
          type: 'hardcoded-color',
          severity: 'warning',
          file: file.path,
          line: color.line,
          message: `硬编码颜色: ${color.value}`,
          suggestion: '使用 src/constants/theme.tokens.ts 中的颜色常量',
        });
      });

      // 魔法数字检测
      file.magicNumbers.forEach(num => {
        violations.push({
          type: 'magic-number',
          severity: 'warning',
          file: file.path,
          line: num.line,
          message: `魔法数字: ${num.value}`,
          suggestion: '提取为常量或使用配置文件',
        });
      });

      // any类型检测
      file.anyTypes.forEach(any => {
        violations.push({
          type: 'any-type',
          severity: 'warning',
          file: file.path,
          line: any.line,
          message: '使用了any类型',
          suggestion: '使用具体类型或unknown + 类型收窄',
        });
      });

      // 事件监听清理检测
      file.eventListeners.forEach(listener => {
        if (!listener.hasCleanup) {
          violations.push({
            type: 'missing-cleanup',
            severity: 'warning',
            file: file.path,
            line: listener.line,
            message: `${listener.type} 缺少清理逻辑`,
            suggestion: '在useEffect的cleanup函数中移除事件监听',
          });
        }
      });
    });

    return violations;
  }
}

// ============================================================
// 统计生成器
// ============================================================

class StatisticsGenerator {
  generate(files: FileNode[], violations: Violation[]): GraphStatistics {
    const byLayer: Record<string, { fileCount: number; lineCount: number }> = {};
    const violationsByType: Record<string, number> = {};
    const importCountMap: Record<string, number> = {};

    // 按层统计
    files.forEach(file => {
      if (!byLayer[file.layer]) {
        byLayer[file.layer] = { fileCount: 0, lineCount: 0 };
      }
      byLayer[file.layer].fileCount++;
      byLayer[file.layer].lineCount += file.lineCount;

      // 统计被引用次数
      file.imports.forEach(imp => {
        const target = imp.to;
        importCountMap[target] = (importCountMap[target] || 0) + 1;
      });
    });

    // 违规类型统计
    violations.forEach(v => {
      violationsByType[v.type] = (violationsByType[v.type] || 0) + 1;
    });

    // Top imported files
    const topImportedFiles = Object.entries(importCountMap)
      .map(([file, count]) => ({ file, importCount: count }))
      .sort((a, b) => b.importCount - a.importCount)
      .slice(0, 20);

    // Largest files
    const largestFiles = files
      .map(f => ({ file: f.path, lineCount: f.lineCount }))
      .sort((a, b) => b.lineCount - a.lineCount)
      .slice(0, 20);

    return {
      byLayer,
      violationsByType,
      topImportedFiles,
      largestFiles,
    };
  }
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('🚀 开始提取代码关系图谱...\n');

  const srcDir = path.resolve(__dirname, '../src');
  const outputFile = path.resolve(__dirname, '../docs/reports/code-graph.json');
  const outputHtml = path.resolve(__dirname, '../docs/reports/code-graph-visualization.html');

  // 收集所有TypeScript文件
  const files = collectTypeScriptFiles(srcDir);
  console.log(`📁 找到 ${files.length} 个TypeScript文件\n`);

  // 分析每个文件
  const fileNodes: FileNode[] = [];
  let totalLines = 0;

  files.forEach((file, index) => {
    if ((index + 1) % 50 === 0) {
      console.log(`⏳ 进度: ${index + 1}/${files.length}`);
    }

    const content = fs.readFileSync(file, 'utf-8');
    const analyzer = new CodeAnalyzer(file, content);
    const node = analyzer.analyze();
    fileNodes.push(node);
    totalLines += node.lineCount;
  });

  console.log(`\n✅ 文件分析完成\n`);

  // 检测违规
  console.log('🔍 检测架构违规...');
  const violationDetector = new ViolationDetector();
  const violations = violationDetector.detect(fileNodes);
  console.log(`⚠️  发现 ${violations.length} 个违规\n`);

  // 生成统计
  console.log('📊 生成统计数据...');
  const statsGenerator = new StatisticsGenerator();
  const statistics = statsGenerator.generate(fileNodes, violations);

  // 构建完整图谱
  const codeGraph: CodeGraph = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    totalLines,
    files: fileNodes,
    violations,
    statistics,
  };

  // 输出JSON
  console.log(`💾 保存图谱数据到: ${outputFile}`);
  fs.writeFileSync(outputFile, JSON.stringify(codeGraph, null, 2));

  // 生成可视化HTML
  console.log(`🎨 生成可视化页面: ${outputHtml}`);
  generateVisualizationHTML(codeGraph, outputHtml);

  // 打印摘要
  printSummary(codeGraph);

  console.log('\n🎉 代码关系图谱生成完成!\n');
}

function collectTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);

  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // 跳过node_modules和测试目录
      if (item === 'node_modules' || item === '__tests__' || item === 'test') {
        return;
      }
      files.push(...collectTypeScriptFiles(fullPath));
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      // 跳过测试文件
      if (item.endsWith('.test.ts') || item.endsWith('.test.tsx') || item.endsWith('.spec.ts')) {
        return;
      }
      files.push(fullPath);
    }
  });

  return files;
}

function generateVisualizationHTML(graph: CodeGraph, outputPath: string) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>V9项目代码知识图谱</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 3px solid #007acc;
      padding-bottom: 10px;
    }
    h2 {
      color: #333;
      margin-top: 30px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .stat-card h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .stat-card .value {
      font-size: 32px;
      font-weight: bold;
    }
    .violation-list {
      margin: 20px 0;
    }
    .violation-item {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .violation-item.error {
      background: #f8d7da;
      border-left-color: #dc3545;
    }
    .violation-item.warning {
      background: #fff3cd;
      border-left-color: #ffc107;
    }
    .violation-item.info {
      background: #d1ecf1;
      border-left-color: #17a2b8;
    }
    .violation-header {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .violation-file {
      color: #666;
      font-size: 14px;
      margin-bottom: 5px;
    }
    .violation-message {
      margin: 5px 0;
    }
    .violation-suggestion {
      color: #28a745;
      font-size: 14px;
      margin-top: 5px;
    }
    .layer-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .layer-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #dee2e6;
    }
    .layer-card h4 {
      margin: 0 0 10px 0;
      color: #495057;
    }
    .layer-card .stat {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    .mermaid {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #dee2e6;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-error { background: #dc3545; color: white; }
    .badge-warning { background: #ffc107; color: #000; }
    .badge-info { background: #17a2b8; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 V9项目代码知识图谱</h1>
    <p><strong>生成时间:</strong> ${new Date(graph.generatedAt).toLocaleString('zh-CN')}</p>
    <p><strong>版本:</strong> ${graph.version}</p>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>总文件数</h3>
        <div class="value">${graph.totalFiles}</div>
      </div>
      <div class="stat-card">
        <h3>总代码行数</h3>
        <div class="value">${graph.totalLines.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <h3>架构违规</h3>
        <div class="value">${graph.violations.length}</div>
      </div>
      <div class="stat-card">
        <h3>层级数量</h3>
        <div class="value">${Object.keys(graph.statistics.byLayer).length}</div>
      </div>
    </div>

    <h2>📊 各层统计</h2>
    <div class="layer-stats">
      ${Object.entries(graph.statistics.byLayer).map(([layer, stats]) => `
        <div class="layer-card">
          <h4>${layer}</h4>
          <div class="stat">
            <span>文件数:</span>
            <strong>${stats.fileCount}</strong>
          </div>
          <div class="stat">
            <span>代码行数:</span>
            <strong>${stats.lineCount.toLocaleString()}</strong>
          </div>
        </div>
      `).join('')}
    </div>

    <h2>🔝 Top 20 被引用文件</h2>
    <table>
      <thead>
        <tr>
          <th>排名</th>
          <th>文件路径</th>
          <th>被引用次数</th>
        </tr>
      </thead>
      <tbody>
        ${graph.statistics.topImportedFiles.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td><code>${item.file}</code></td>
            <td><strong>${item.importCount}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>📏 Top 20 最大文件</h2>
    <table>
      <thead>
        <tr>
          <th>排名</th>
          <th>文件路径</th>
          <th>代码行数</th>
        </tr>
      </thead>
      <tbody>
        ${graph.statistics.largestFiles.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td><code>${item.file}</code></td>
            <td><strong>${item.lineCount.toLocaleString()}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>⚠️ 架构违规 (${graph.violations.length})</h2>
    <div class="violation-list">
      ${graph.violations.slice(0, 50).map(v => `
        <div class="violation-item ${v.severity}">
          <div class="violation-header">
            <span class="badge badge-${v.severity}">${v.severity.toUpperCase()}</span>
            ${v.type}
          </div>
          <div class="violation-file">📁 ${v.file}:${v.line}</div>
          <div class="violation-message">${v.message}</div>
          <div class="violation-suggestion">💡 ${v.suggestion}</div>
        </div>
      `).join('')}
      ${graph.violations.length > 50 ? `<p><em>... 还有 ${graph.violations.length - 50} 个违规未显示</em></p>` : ''}
    </div>

    <h2>🔗 依赖关系图 (Mermaid)</h2>
    <div class="mermaid">
graph TD
    ${generateMermaidDiagram(graph)}
    </div>
  </div>

  <script>
    mermaid.initialize({ 
      startOnLoad: true,
      theme: 'default',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true
      }
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
}

function generateMermaidDiagram(graph: CodeGraph): string {
  const lines: string[] = [];
  const layerColors: Record<string, string> = {
    config: '#ff6b6b',
    core: '#4ecdc4',
    data: '#45b7d1',
    lib: '#f7b731',
    services: '#5f27cd',
    store: '#00d2d3',
    pages: '#ff9ff3',
    components: '#54a0ff',
    portal: '#5f27cd',
    constants: '#10ac84',
  };

  // 为每个层创建一个子图
  Object.keys(graph.statistics.byLayer).forEach(layer => {
    const color = layerColors[layer] || '#95a5a6';
    lines.push(`    subgraph ${layer}["${layer} (${graph.statistics.byLayer[layer].fileCount}文件)"]`);
    lines.push(`        style ${layer} fill:${color}22,stroke:${color},stroke-width:2px`);
    
    // 添加该层的代表性文件(最多5个)
    const layerFiles = graph.files
      .filter(f => f.layer === layer)
      .sort((a, b) => b.lineCount - a.lineCount)
      .slice(0, 5);
    
    layerFiles.forEach(file => {
      const fileName = path.basename(file.path).replace(/\.(ts|tsx)$/, '');
      lines.push(`        ${fileName}[${fileName}<br/>${file.lineCount}行]`);
    });
    
    lines.push(`    end`);
  });

  // 添加依赖关系(简化版,只显示层间关系)
  const layerDeps = new Set<string>();
  graph.files.forEach(file => {
    file.imports.forEach(imp => {
      if (imp.layer !== 'unknown' && imp.layer !== file.layer) {
        const key = `${file.layer}-${imp.layer}`;
        if (!layerDeps.has(key)) {
          layerDeps.add(key);
          lines.push(`    ${file.layer} --> ${imp.layer}`);
        }
      }
    });
  });

  return lines.join('\n');
}

function printSummary(graph: CodeGraph) {
  console.log('\n📋 图谱摘要:');
  console.log('─'.repeat(60));
  console.log(`总文件数: ${graph.totalFiles}`);
  console.log(`总代码行数: ${graph.totalLines.toLocaleString()}`);
  console.log(`架构违规: ${graph.violations.length}`);
  console.log('');
  
  console.log('📊 各层统计:');
  Object.entries(graph.statistics.byLayer).forEach(([layer, stats]) => {
    console.log(`  ${layer}: ${stats.fileCount}文件, ${stats.lineCount.toLocaleString()}行`);
  });
  console.log('');
  
  console.log('⚠️  违规类型统计:');
  Object.entries(graph.statistics.violationsByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log('');
  
  console.log('🔝 Top 5 被引用文件:');
  graph.statistics.topImportedFiles.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.file} (${item.importCount}次)`);
  });
  console.log('');
  
  console.log('📏 Top 5 最大文件:');
  graph.statistics.largestFiles.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.file} (${item.lineCount}行)`);
  });
  console.log('─'.repeat(60));
}

// 执行主流程
main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
