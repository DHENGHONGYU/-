// Fix all remaining MDA errors - direct targeted fixes
const fs = require('fs');
const path = require('path');
const root = 'd:\\FinSightV9';
let totalFixed = 0;

function fixFile(filePath, fn) {
  const full = path.join(root, filePath);
  const orig = fs.readFileSync(full, 'utf8');
  const fixed = fn(orig);
  if (fixed !== orig) {
    fs.writeFileSync(full, fixed, 'utf8');
    console.log(`✓ Fixed: ${filePath}`);
    return true;
  }
  console.log(`- No change: ${filePath}`);
  return false;
}

// Fix 1: jsonParser.ts
fixFile('src/services/llm/jsonParser.ts', (s) => {
  // Find JSON.parse and assert result
  return s.replace(
    /(JSON\.parse\([^)]+\))\s+as\s+T/g,
    '($1 as Record<string, unknown>) as T'
  );
});

// Fix 2: positionStore.ts  
fixFile('src/store/positionStore.ts', (s) => {
  // Find JSON.parse
  return s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
});

// Fix 3: profileService.ts
fixFile('src/services/profile/profileService.ts', (s) => {
  return s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
});

// Fix 4: tagService.ts
fixFile('src/services/profile/tagService.ts', (s) => {
  return s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
});

// Fix 5: scoreDocStore.ts
fixFile('src/store/scoreDocStore.ts', (s) => {
  return s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
});

// Fix 6: tradeReviewAI.llmEnhancer.ts
const enhPath = path.join(root, 'src', 'services', 'trading', 'tradeReviewAI.llmEnhancer.ts');
if (fs.existsSync(enhPath)) {
  fixFile('src/services/trading/tradeReviewAI.llmEnhancer.ts', (s) => {
    // Find JSON.parse(...).something - assert at parse
    return s.replace(
      /(JSON\.parse\([^)]+\))(?=\s*\.)/g,
      '$1 as Record<string, unknown>'
    );
  });
}

// Fix 7: dataflowEngine.ts - .length on any
fixFile('src/core/dataflow/dataflowEngine.ts', (s) => {
  // L150: .length on data which is event.data
  // Make it safer by checking typeof
  return s.replace(
    /logger\.debug\(`\[DataFlowEngine\] SSE message received, length=\$\{Array\.isArray\(data\) \|\| typeof data === 'string' \? data\.length : 0\}\)/,
    `logger.debug(\`[DataFlowEngine] SSE message received, length=\${typeof data === 'string' || Array.isArray(data) ? data.length : 0}\`)`
  );
});

// Fix 8: analysisServer.ts - .length on any
fixFile('src/mcp/servers/analysis/analysisServer.ts', (s) => {
  return s.replace(
    /stocks\.length/g,
    '(Array.isArray(stocks) ? stocks.length : 0)'
  );
});

console.log('\nAll targeted fixes applied. Run lint to verify.');
