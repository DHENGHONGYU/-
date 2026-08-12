const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const OUTPUT_FILE = path.join(__dirname, '..', 'docs', 'implementation', 'docs/reference/audit-b4-1-code-quality.md');

const results = {
  totalFiles: 0,
  totalLines: 0,
  dimensions: {
    typeSafety: {
      anyUsage: [],
      typeAssertions: [],
      nonNullAssertions: [],
    },
    errorHandling: {
      asyncFunctions: [],
      asyncWithoutTryCatch: [],
    },
    memoryCleanup: {
      useEffectWithSubscriptions: [],
      useEffectWithoutCleanup: [],
      eventBusSubscriptions: [],
      eventBusWithoutUnsubscribe: [],
    },
    loadingState: {
      pageComponents: [],
      pagesWithoutLoading: [],
    },
    routeParams: {
      pagesWithUseParams: [],
      pagesWithoutResetOnParamChange: [],
    },
  },
};

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      scanDir(fullPath);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      auditFile(fullPath);
    }
  }
}

function auditFile(filePath) {
  const relPath = path.relative(SRC_DIR, filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  results.totalFiles++;
  results.totalLines += lines.length;

  auditTypeSafety(relPath, content, lines);
  auditErrorHandling(relPath, content, lines);
  auditMemoryCleanup(relPath, content, lines);
  auditLoadingState(relPath, content, lines);
  auditRouteParams(relPath, content, lines);
}

function auditTypeSafety(relPath, content, lines) {
  const dim = results.dimensions.typeSafety;
  
  const anyRegex = /:\s*any(\[\])?(\s*[=,)\]])/g;
  let match;
  while ((match = anyRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    dim.anyUsage.push({ file: relPath, line: lineNum, code: lines[lineNum - 1].trim() });
  }
  
  const assertionRegex = /\bas\s+[A-Za-z_]/g;
  while ((match = assertionRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    const lineContent = lines[lineNum - 1].trim();
    if (!lineContent.includes('import') && !lineContent.includes('//')) {
      dim.typeAssertions.push({ file: relPath, line: lineNum, code: lineContent });
    }
  }
  
  const nonNullRegex = /!\./g;
  while ((match = nonNullRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    const lineContent = lines[lineNum - 1].trim();
    if (!lineContent.includes('//')) {
      dim.nonNullAssertions.push({ file: relPath, line: lineNum, code: lineContent });
    }
  }
}

function auditErrorHandling(relPath, content, lines) {
  const dim = results.dimensions.errorHandling;
  
  const asyncFuncRegex = /async\s+(function\s+(\w+)?\s*\(|(\w+)\s*[=:]\s*async\s*\(|=>\s*async\s*\()/g;
  const asyncArrowRegex = /(const|let|var)\s+(\w+)\s*=\s*async\s*\(/g;
  const asyncMethodRegex = /(public|private|protected)?\s*(\w+)\s*[\(].*[\)]\s*:\s*Promise<.*>\s*\{/g;
  
  const asyncFunctions = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\basync\b/.test(line) && /(function|\(|=>)/.test(line)) {
      let funcName = 'anonymous';
      const nameMatch = line.match(/(?:function|const|let|var)\s+(\w+)/);
      if (nameMatch) funcName = nameMatch[1];
      asyncFunctions.push({ name: funcName, line: i + 1, startLine: i });
    }
  }
  
  dim.asyncFunctions.push(...asyncFunctions.map(f => ({ file: relPath, ...f })));
  
  for (const func of asyncFunctions) {
    let hasTryCatch = false;
    const startLine = func.startLine;
    let braceCount = 0;
    let started = false;
    
    for (let i = startLine; i < Math.min(startLine + 50, lines.length); i++) {
      const line = lines[i];
      
      if (line.includes('{')) {
        braceCount += (line.match(/\{/g) || []).length;
        started = true;
      }
      if (line.includes('}')) {
        braceCount -= (line.match(/\}/g) || []).length;
      }
      
      if (/\btry\b/.test(line) && line.includes('{')) {
        hasTryCatch = true;
        break;
      }
      
      if (started && braceCount <= 0 && i > startLine) {
        break;
      }
    }
    
    if (!hasTryCatch) {
      dim.asyncWithoutTryCatch.push({ 
        file: relPath, 
        line: func.line, 
        function: func.name,
        code: lines[func.line - 1].trim().substring(0, 100)
      });
    }
  }
}

function auditMemoryCleanup(relPath, content, lines) {
  const dim = results.dimensions.memoryCleanup;
  
  const useEffectRegex = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{/g;
  let match;
  
  while ((match = useEffectRegex.exec(content)) !== null) {
    const startIdx = match.index;
    const lineNum = content.substring(0, startIdx).split('\n').length;
    
    let hasSubscription = false;
    let hasCleanup = false;
    let braceCount = 0;
    let started = false;
    let endIdx = startIdx;
    
    for (let i = startIdx; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        started = true;
      }
      if (content[i] === '}') {
        braceCount--;
      }
      
      if (started && braceCount === 0) {
        endIdx = i;
        break;
      }
    }
    
    const effectBody = content.substring(startIdx, endIdx + 1);
    
    if (/eventBus\.(on|subscribe|addListener)/.test(effectBody) ||
        /\.subscribe\s*\(/.test(effectBody) ||
        /addEventListener/.test(effectBody) ||
        /setInterval|setTimeout/.test(effectBody)) {
      hasSubscription = true;
    }
    
    if (/return\s+\(?\s*\)\s*=>/.test(effectBody) ||
        /eventBus\.(off|unsubscribe|removeListener)/.test(effectBody) ||
        /\.unsubscribe\s*\(/.test(effectBody) ||
        /removeEventListener/.test(effectBody) ||
        /clearInterval|clearTimeout/.test(effectBody)) {
      hasCleanup = true;
    }
    
    if (hasSubscription) {
      dim.useEffectWithSubscriptions.push({ file: relPath, line: lineNum, code: lines[lineNum - 1].trim() });
      if (!hasCleanup) {
        dim.useEffectWithoutCleanup.push({ file: relPath, line: lineNum, code: lines[lineNum - 1].trim() });
      }
    }
  }
  
  const eventBusOnRegex = /eventBus\.(on|subscribe)\s*\(/g;
  while ((match = eventBusOnRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    dim.eventBusSubscriptions.push({ file: relPath, line: lineNum, code: lines[lineNum - 1].trim() });
  }
}

function auditLoadingState(relPath, content, lines) {
  const dim = results.dimensions.loadingState;
  
  const isPageComponent = /pages[\\/]/.test(relPath) || /Page\.tsx$/.test(relPath);
  
  if (isPageComponent) {
    dim.pageComponents.push(relPath);
    
    const hasLoading = /(isLoading|loading|pending|isPending)\b/.test(content) ||
                       /LoadingState|Skeleton|PageSkeleton/.test(content);
    
    if (!hasLoading) {
      dim.pagesWithoutLoading.push(relPath);
    }
  }
}

function auditRouteParams(relPath, content, lines) {
  const dim = results.dimensions.routeParams;
  
  const isPageComponent = /pages[\\/]/.test(relPath) || /Page\.tsx$/.test(relPath);
  
  if (isPageComponent) {
    const usesParams = /useParams|useSearchParams|useLocation/.test(content);
    
    if (usesParams) {
      dim.pagesWithUseParams.push(relPath);
      
      const hasResetOnChange = /resetState|resetData|clear.*state|refetch|fetchData/.test(content);
      
      if (!hasResetOnChange) {
        dim.pagesWithoutResetOnParamChange.push(relPath);
      }
    }
  }
}

function generateReport() {
  const dim = results.dimensions;
  
  const typeSafetyScore = Math.max(0, 100 - 
    (dim.typeSafety.anyUsage.length * 2 + 
     dim.typeSafety.typeAssertions.length * 1.5 + 
     dim.typeSafety.nonNullAssertions.length * 1) / Math.max(1, results.totalFiles / 10));
  
  const errorHandlingScore = Math.max(0, 100 - 
    (dim.errorHandling.asyncWithoutTryCatch.length * 5) / Math.max(1, results.totalFiles / 10));
  
  const memoryCleanupScore = Math.max(0, 100 - 
    (dim.memoryCleanup.useEffectWithoutCleanup.length * 8) / Math.max(1, results.totalFiles / 10));
  
  const loadingScore = Math.max(0, 100 - 
    (dim.loadingState.pagesWithoutLoading.length * 15) / Math.max(1, dim.loadingState.pageComponents.length));
  
  const routeScore = Math.max(0, 100 - 
    (dim.routeParams.pagesWithoutResetOnParamChange.length * 20) / Math.max(1, dim.routeParams.pagesWithUseParams.length));
  
  const overallScore = (typeSafetyScore * 0.25 + errorHandlingScore * 0.25 + 
                       memoryCleanupScore * 0.2 + loadingScore * 0.15 + routeScore * 0.15);
  
  function getRiskLevel(score) {
    if (score >= 80) return '🟢 低风险';
    if (score >= 60) return '🟡 中风险';
    if (score >= 40) return '🟠 高风险';
    return '🔴 严重风险';
  }
  
  function getTopViolations(arr, count = 10) {
    return arr.slice(0, count).map(v => 
      `- **${v.file}** (行 ${v.line}): \`${v.code?.substring(0, 80) || v.function || ''}\``
    ).join('\n');
  }
  
  const report = `# V9 前端应用代码编写质量审计报告 (B4-1)

> 审计日期：2026-06-29  
> 审计范围：src/ 目录下所有 .ts 和 .tsx 文件（不含测试文件和 .d.ts 声明文件）  
> 审计维度：TypeScript 类型完整性、错误处理、内存清理、Loading 状态、路由参数变化处理

---

## 一、审计概览

| 指标 | 数值 |
|------|------|
| 审计文件总数 | ${results.totalFiles} |
| 总代码行数 | ${results.totalLines.toLocaleString()} |
| 整体质量评分 | ${overallScore.toFixed(1)} / 100 |
| 整体风险等级 | ${getRiskLevel(overallScore)} |

### 各维度评分

| 维度 | 得分 | 权重 | 风险等级 |
|------|------|------|----------|
| 1. TypeScript 类型完整性 | ${typeSafetyScore.toFixed(1)} | 25% | ${getRiskLevel(typeSafetyScore)} |
| 2. 错误处理（async try-catch） | ${errorHandlingScore.toFixed(1)} | 25% | ${getRiskLevel(errorHandlingScore)} |
| 3. 内存清理（useEffect cleanup） | ${memoryCleanupScore.toFixed(1)} | 20% | ${getRiskLevel(memoryCleanupScore)} |
| 4. Loading 状态管理 | ${loadingScore.toFixed(1)} | 15% | ${getRiskLevel(loadingScore)} |
| 5. 路由参数变化处理 | ${routeScore.toFixed(1)} | 15% | ${getRiskLevel(routeScore)} |

---

## 二、维度一：TypeScript 类型完整性

### 2.1 统计数据

| 违规类型 | 数量 |
|----------|------|
| \`any\` 类型使用 | ${dim.typeSafety.anyUsage.length} |
| 类型断言 (\`as\`) | ${dim.typeSafety.typeAssertions.length} |
| 非空断言 (\`!\`) | ${dim.typeSafety.nonNullAssertions.length} |
| **合计** | **${dim.typeSafety.anyUsage.length + dim.typeSafety.typeAssertions.length + dim.typeSafety.nonNullAssertions.length}** |

### 2.2 典型违规 - any 类型使用

${dim.typeSafety.anyUsage.length > 0 ? getTopViolations(dim.typeSafety.anyUsage, 10) : '无违规记录'}

### 2.3 典型违规 - 类型断言

${dim.typeSafety.typeAssertions.length > 0 ? getTopViolations(dim.typeSafety.typeAssertions, 10) : '无违规记录'}

### 2.4 风险分析

${dim.typeSafety.anyUsage.length > 20 ? '- **高风险**：大量 any 类型使用导致类型系统失效，运行时错误风险增加' : 
  dim.typeSafety.anyUsage.length > 10 ? '- **中风险**：存在一定数量的 any 类型，部分模块类型保护不足' :
  '- **低风险**：any 使用控制在合理范围内'}

**改进建议**：
- 优先为核心业务逻辑（store、service 层）移除 any
- 使用泛型和条件类型替代类型断言
- 开启 \`noImplicitAny\` 和 \`strictNullChecks\` 严格模式

---

## 三、维度二：错误处理（async 函数 try-catch 覆盖）

### 3.1 统计数据

| 指标 | 数量 |
|------|------|
| async 函数总数 | ${dim.errorHandling.asyncFunctions.length} |
| 缺少 try-catch 的 async 函数 | ${dim.errorHandling.asyncWithoutTryCatch.length} |
| 覆盖率 | ${dim.errorHandling.asyncFunctions.length > 0 ? 
    ((1 - dim.errorHandling.asyncWithoutTryCatch.length / dim.errorHandling.asyncFunctions.length) * 100).toFixed(1) : 'N/A'}% |

### 3.2 典型违规 - 缺少错误处理的 async 函数

${dim.errorHandling.asyncWithoutTryCatch.length > 0 ? getTopViolations(dim.errorHandling.asyncWithoutTryCatch, 15) : '无违规记录'}

### 3.3 风险分析

${dim.errorHandling.asyncWithoutTryCatch.length > 15 ? '- **高风险**：大量异步操作缺乏错误捕获，未处理 Promise rejection 可能导致应用崩溃' :
  dim.errorHandling.asyncWithoutTryCatch.length > 5 ? '- **中风险**：部分异步函数缺少错误处理，用户体验受损' :
  '- **低风险**：大部分异步操作有错误保护'}

**改进建议**：
- 所有调用外部 API/数据库的 async 函数必须包含 try-catch
- 统一错误边界（ErrorBoundary）处理渲染阶段错误
- 建立全局错误上报机制

---

## 四、维度三：内存清理（useEffect cleanup）

### 4.1 统计数据

| 指标 | 数量 |
|------|------|
| 含订阅的 useEffect 总数 | ${dim.memoryCleanup.useEffectWithSubscriptions.length} |
| 缺少 cleanup 的 useEffect | ${dim.memoryCleanup.useEffectWithoutCleanup.length} |
| eventBus 订阅总数 | ${dim.memoryCleanup.eventBusSubscriptions.length} |
| 清理率 | ${dim.memoryCleanup.useEffectWithSubscriptions.length > 0 ?
    ((1 - dim.memoryCleanup.useEffectWithoutCleanup.length / dim.memoryCleanup.useEffectWithSubscriptions.length) * 100).toFixed(1) : 'N/A'}% |

### 4.2 典型违规 - 缺少 cleanup 的 useEffect

${dim.memoryCleanup.useEffectWithoutCleanup.length > 0 ? getTopViolations(dim.memoryCleanup.useEffectWithoutCleanup, 10) : '无违规记录'}

### 4.3 风险分析

${dim.memoryCleanup.useEffectWithoutCleanup.length > 10 ? '- **高风险**：内存泄漏风险严重，长期运行可能导致应用卡顿或崩溃' :
  dim.memoryCleanup.useEffectWithoutCleanup.length > 3 ? '- **中风险**：部分组件存在内存泄漏隐患' :
  '- **低风险**：副作用清理较为规范'}

**改进建议**：
- 所有 useEffect 中的订阅（eventBus、store.subscribe、addEventListener）必须在 cleanup 函数中移除
- setInterval/setTimeout 必须在 cleanup 中 clear
- 使用 AbortController 取消未完成的 fetch 请求

---

## 五、维度四：Loading 状态管理

### 5.1 统计数据

| 指标 | 数量 |
|------|------|
| 页面级组件总数 | ${dim.loadingState.pageComponents.length} |
| 缺少 Loading 状态的页面 | ${dim.loadingState.pagesWithoutLoading.length} |
| 覆盖率 | ${dim.loadingState.pageComponents.length > 0 ?
    ((1 - dim.loadingState.pagesWithoutLoading.length / dim.loadingState.pageComponents.length) * 100).toFixed(1) : 'N/A'}% |

### 5.2 缺少 Loading 状态的页面列表

${dim.loadingState.pagesWithoutLoading.length > 0 ? 
  dim.loadingState.pagesWithoutLoading.map(p => `- \`${p}\``).join('\n') : 
  '所有页面均有 Loading 状态'}

### 5.3 风险分析

${dim.loadingState.pagesWithoutLoading.length > 5 ? '- **高风险**：大量页面缺少加载状态，用户体验差，可能引发重复点击' :
  dim.loadingState.pagesWithoutLoading.length > 2 ? '- **中风险**：部分页面加载状态缺失' :
  '- **低风险**：页面 Loading 状态较为完善'}

**改进建议**：
- 所有数据驱动的页面必须实现 isLoading 状态和骨架屏
- 统一使用 \`<LoadingState />\` 或 \`<PageSkeleton />\` 组件
- 按钮等交互元素在加载时禁用，防止重复提交

---

## 六、维度五：路由参数变化处理

### 6.1 统计数据

| 指标 | 数量 |
|------|------|
| 使用路由参数的页面数 | ${dim.routeParams.pagesWithUseParams.length} |
| 缺少参数变化重置逻辑的页面 | ${dim.routeParams.pagesWithoutResetOnParamChange.length} |
| 合规率 | ${dim.routeParams.pagesWithUseParams.length > 0 ?
    ((1 - dim.routeParams.pagesWithoutResetOnParamChange.length / dim.routeParams.pagesWithUseParams.length) * 100).toFixed(1) : 'N/A'}% |

### 6.2 存在风险的页面列表

${dim.routeParams.pagesWithoutResetOnParamChange.length > 0 ? 
  dim.routeParams.pagesWithoutResetOnParamChange.map(p => `- \`${p}\``).join('\n') : 
  '所有使用路由参数的页面均有正确的重置逻辑'}

### 6.3 风险分析

${dim.routeParams.pagesWithoutResetOnParamChange.length > 3 ? '- **高风险**：路由参数变化时状态未重置，可能展示错误数据或残留上一个页面的状态' :
  dim.routeParams.pagesWithoutResetOnParamChange.length > 0 ? '- **中风险**：部分页面路由参数处理不当' :
  '- **低风险**：路由参数处理规范'}

**改进建议**：
- 使用 useEffect 监听路由参数变化，触发 resetState + refetch
- 考虑使用 React Query 的 queryKey 自动管理缓存和重取
- 参数变化时重置表单、分页、筛选等状态

---

## 七、文件违规 TOP 10

按违规总数排序的问题最多的文件：

（需结合具体扫描结果填充）

---

## 八、总结与建议

### 8.1 总体评价

整体代码质量评分：**${overallScore.toFixed(1)} / 100**，等级：**${getRiskLevel(overallScore)}**

${overallScore >= 80 ? '代码质量整体良好，类型安全和错误处理较为规范，建议持续保持并优化细节。' :
  overallScore >= 60 ? '代码质量中等，存在一些需要改进的地方，特别是错误处理和内存清理方面。' :
  '代码质量存在较大改进空间，建议优先修复高风险问题。'}

### 8.2 优先级改进建议

#### P0（立即修复）
${dim.memoryCleanup.useEffectWithoutCleanup.length > 5 ? '- 修复关键页面的 useEffect 内存泄漏问题' : ''}
${dim.errorHandling.asyncWithoutTryCatch.length > 10 ? '- 为核心业务 async 函数添加错误处理' : ''}
${dim.typeSafety.anyUsage.length > 20 ? '- 移除 store/service 层的 any 类型' : ''}
${dim.loadingState.pagesWithoutLoading.length > 3 ? '- 为主要页面添加 Loading 状态' : ''}
${dim.routeParams.pagesWithoutResetOnParamChange.length > 2 ? '- 修复路由参数变化时的状态重置问题' : ''}

#### P1（近期改进）
- 建立代码规范文档和 ESLint 规则集
- 配置 husky + lint-staged 提交前检查
- 补充单元测试覆盖核心模块

#### P2（长期优化）
- 引入 React Query / SWR 统一数据获取和缓存
- 逐步迁移至 TypeScript 严格模式
- 建立自动化代码质量门禁

### 8.3 审计方法说明

本报告通过静态代码分析工具自动扫描生成，扫描规则包括：
- 正则匹配 \`any\` 类型、类型断言、非空断言
- 检测 async 函数体内是否包含 try-catch
- 分析 useEffect 中的订阅模式和 cleanup 返回函数
- 检测页面组件中的 Loading 相关变量和组件
- 检查使用路由参数的页面是否有状态重置逻辑

**注**：自动化扫描可能存在误报和漏报，关键问题建议人工复核。

---

*报告生成时间：2026-06-29*
`;

  return report;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

console.log('开始代码质量审计...');
console.log(`扫描目录: ${SRC_DIR}`);

scanDir(SRC_DIR);

console.log(`扫描完成，共审计 ${results.totalFiles} 个文件，${results.totalLines} 行代码`);
console.log('');
console.log('=== 审计结果摘要 ===');
console.log(`1. TypeScript 类型问题: ${results.dimensions.typeSafety.anyUsage.length + results.dimensions.typeSafety.typeAssertions.length + results.dimensions.typeSafety.nonNullAssertions.length} 处`);
console.log(`   - any 使用: ${results.dimensions.typeSafety.anyUsage.length}`);
console.log(`   - 类型断言: ${results.dimensions.typeSafety.typeAssertions.length}`);
console.log(`   - 非空断言: ${results.dimensions.typeSafety.nonNullAssertions.length}`);
console.log(`2. 错误处理问题: ${results.dimensions.errorHandling.asyncWithoutTryCatch.length} / ${results.dimensions.errorHandling.asyncFunctions.length} 个 async 函数缺少 try-catch`);
console.log(`3. 内存清理问题: ${results.dimensions.memoryCleanup.useEffectWithoutCleanup.length} / ${results.dimensions.memoryCleanup.useEffectWithSubscriptions.length} 个 useEffect 缺少 cleanup`);
console.log(`4. Loading 状态: ${results.dimensions.loadingState.pagesWithoutLoading.length} / ${results.dimensions.loadingState.pageComponents.length} 个页面缺少 Loading`);
console.log(`5. 路由参数处理: ${results.dimensions.routeParams.pagesWithoutResetOnParamChange.length} / ${results.dimensions.routeParams.pagesWithUseParams.length} 个页面缺少参数变化重置`);

const report = generateReport();
const outputDir = path.dirname(OUTPUT_FILE);
ensureDir(outputDir);
fs.writeFileSync(OUTPUT_FILE, report, 'utf-8');

console.log('');
console.log(`审计报告已生成: ${OUTPUT_FILE}`);
