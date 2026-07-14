const fs = require('fs');
const path = require('path');

// 读取 code-graph.json
const graphPath = path.join(__dirname, '..', 'docs', 'reports', 'code-graph.json');
const data = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

// 违规信息存储
const violations = {
  layer: [],      // 跨层调用
  circular: [],   // 循环依赖
  color: [],      // 硬编码颜色
  magic: [],      // 魔法数字
  any: []         // any 类型
};

// 辅助函数：提取文件所在层
function getLayer(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const match = normalized.match(/src\/(\w+)\//);
  return match ? match[1] : 'unknown';
}

// 1. 提取硬编码颜色、魔法数字、any 类型
data.files.forEach(file => {
  const filePath = file.path.replace(/\\/g, '/');
  
  // 硬编码颜色
  if (file.hardcodedColors && file.hardcodedColors.length > 0) {
    file.hardcodedColors.forEach(c => {
      violations.color.push({
        file: filePath,
        line: c.line,
        code: c.code,
        context: c.context
      });
    });
  }
  
  // 魔法数字
  if (file.magicNumbers && file.magicNumbers.length > 0) {
    file.magicNumbers.forEach(n => {
      violations.magic.push({
        file: filePath,
        line: n.line,
        value: n.value,
        context: n.context
      });
    });
  }
  
  // any 类型
  if (file.anyTypes && file.anyTypes.length > 0) {
    file.anyTypes.forEach(a => {
      violations.any.push({
        file: filePath,
        line: a.line,
        column: a.column,
        context: a.context
      });
    });
  }
});

// 2. 检测跨层调用违规
data.files.forEach(file => {
  const fromPath = file.path.replace(/\\/g, '/');
  const fromLayer = getLayer(fromPath);
  
  if (!file.imports) return;
  
  file.imports.forEach(imp => {
    const toPath = imp.to.replace(/\\/g, '/');
    const toLayer = getLayer(toPath);
    
    // 规则：pages/components -> 只能依赖 store 和 services，禁止直接调用 dataLayer 或 db
    if ((fromLayer === 'pages' || fromLayer === 'components') && 
        (toLayer === 'data' || toLayer === 'core')) {
      if (toPath.includes('dataLayer') || toPath.includes('db')) {
        violations.layer.push({
          from: fromPath,
          to: toPath,
          fromLayer,
          toLayer,
          type: '跨层调用: pages/components 直接调用 data/db'
        });
      }
    }
    
    // 规则：store -> 只能依赖 services 和 core
    if (fromLayer === 'store' && (toLayer === 'pages' || toLayer === 'components')) {
      violations.layer.push({
        from: fromPath,
        to: toPath,
        fromLayer,
        toLayer,
        type: '跨层调用: store 调用 pages/components'
      });
    }
    
    // 规则：core -> 禁止依赖 pages、components、apps
    if (fromLayer === 'core' && (toLayer === 'pages' || toLayer === 'components' || toLayer === 'apps')) {
      violations.layer.push({
        from: fromPath,
        to: toPath,
        fromLayer,
        toLayer,
        type: '跨层调用: core 调用 pages/components/apps'
      });
    }
    
    // 规则：config -> 禁止依赖 services、pages、components
    if (fromLayer === 'config' && (toLayer === 'services' || toLayer === 'pages' || toLayer === 'components')) {
      violations.layer.push({
        from: fromPath,
        to: toPath,
        fromLayer,
        toLayer,
        type: '跨层调用: config 调用 services/pages/components'
      });
    }
    
    // 规则：services -> 只能依赖 core 和 data，禁止直接写 db
    if (fromLayer === 'services' && (toLayer === 'pages' || toLayer === 'components')) {
      violations.layer.push({
        from: fromPath,
        to: toPath,
        fromLayer,
        toLayer,
        type: '跨层调用: services 调用 pages/components'
      });
    }
  });
});

// 3. 提取循环依赖
if (data.circularDependencies && data.circularDependencies.length > 0) {
  data.circularDependencies.forEach(c => {
    violations.circular.push(c);
  });
}

// 输出统计
console.log('\n=== 架构违规统计 ===');
console.log(`跨层调用违规: ${violations.layer.length}`);
console.log(`循环依赖: ${violations.circular.length}`);
console.log(`硬编码颜色: ${violations.color.length}`);
console.log(`魔法数字: ${violations.magic.length}`);
console.log(`any 类型使用: ${violations.any.length}`);
console.log(`总计: ${violations.layer.length + violations.circular.length + violations.color.length + violations.magic.length + violations.any.length}`);

// 保存详细结果
const outputPath = path.join(__dirname, '..', 'docs', 'reports', 'architecture-violations.json');
fs.writeFileSync(outputPath, JSON.stringify(violations, null, 2));
console.log(`\n详细结果已保存到: ${outputPath}`);

// 按严重程度分类输出
console.log('\n=== 按严重程度分类 ===');

console.log('\n【P0 - 严重】跨层调用违规 (违反分层架构原则)');
if (violations.layer.length === 0) {
  console.log('  无违规');
} else {
  violations.layer.slice(0, 10).forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.type}`);
    console.log(`     从: ${v.from}`);
    console.log(`     到: ${v.to}`);
  });
  if (violations.layer.length > 10) {
    console.log(`  ... 还有 ${violations.layer.length - 10} 条违规`);
  }
}

console.log('\n【P0 - 严重】循环依赖 (可能导致运行时错误)');
if (violations.circular.length === 0) {
  console.log('  无循环依赖');
} else {
  violations.circular.slice(0, 10).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.cycle ? c.cycle.join(' -> ') : c}`);
  });
  if (violations.circular.length > 10) {
    console.log(`  ... 还有 ${violations.circular.length - 10} 条循环依赖`);
  }
}

console.log('\n【P1 - 重要】硬编码颜色 (违反零硬编码原则)');
if (violations.color.length === 0) {
  console.log('  无硬编码颜色');
} else {
  violations.color.slice(0, 10).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.file}:${c.line}`);
    console.log(`     颜色: ${c.code}`);
    console.log(`     上下文: ${c.context}`);
  });
  if (violations.color.length > 10) {
    console.log(`  ... 还有 ${violations.color.length - 10} 条硬编码颜色`);
  }
}

console.log('\n【P1 - 重要】魔法数字 (违反零硬编码原则)');
if (violations.magic.length === 0) {
  console.log('  无魔法数字');
} else {
  violations.magic.slice(0, 10).forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.file}:${m.line}`);
    console.log(`     值: ${m.value}`);
    console.log(`     上下文: ${m.context}`);
  });
  if (violations.magic.length > 10) {
    console.log(`  ... 还有 ${violations.magic.length - 10} 条魔法数字`);
  }
}

console.log('\n【P2 - 优化】any 类型使用 (违反类型安全原则)');
if (violations.any.length === 0) {
  console.log('  无 any 类型使用');
} else {
  violations.any.slice(0, 10).forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.file}:${a.line}:${a.column}`);
    console.log(`     上下文: ${a.context}`);
  });
  if (violations.any.length > 10) {
    console.log(`  ... 还有 ${violations.any.length - 10} 条 any 类型使用`);
  }
}
