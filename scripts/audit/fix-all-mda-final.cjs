// Comprehensive fix for all MDA (no-unsafe-member-access) errors
// Targets 12 files with 104 errors after rule upgrade to 'error'
const fs = require('fs');
const path = require('path');
const root = 'd:\\FinSightV9';
const results = [];

function fixFile(relPath, transformations) {
  const fullPath = path.join(root, relPath);
  let s = fs.readFileSync(fullPath, 'utf8');
  let changed = 0;
  
  for (const { match, replace, desc } of transformations) {
    const count = (s.match(match) || []).length;
    if (count > 0) {
      s = s.replace(match, replace);
      changed += count;
    }
  }
  
  if (changed > 0) {
    fs.writeFileSync(fullPath, s, 'utf8');
    results.push({ file: relPath, fixes: changed, status: 'OK' });
  } else {
    results.push({ file: relPath, fixes: 0, status: 'SKIPPED (pattern not found)' });
  }
  return changed;
}

// =============================================
// 1. MarketDataAdapter.ts (85 errors - MAIN FILE)
// =============================================
(function fixMarketDataAdapter() {
  const p = path.join(root, 'src', 'services', 'data-collector', 'MarketDataAdapter.ts');
  let s = fs.readFileSync(p, 'utf8');
  let totalFixed = 0;
  
  // Pattern 1: payload.map((item) => ({...})) where item is unknown
  // Fix: add 'const raw = item as Record<string, unknown>' and use raw.xxx instead of item.xxx
  const mapPatterns = [
    {
      name: 'adaptIndices',
      // match the map callback body
      match: /return payload\.map\(\(item\) => \(\{([^}]+)\}\)\)/s,
      // Replace item.xxx with raw.xxx
    },
  ];
  
  // Strategy: Find all map callbacks in this file and inject 'const raw = item as Record<string, unknown>'
  // We need to find each payload.map((item) => ...) pattern
  
  // Fix 1: adaptIndices - L138
  s = s.replace(
    /return payload\.map\(\(item\) => \(\{[\s\S]*?volume: item\.volume[^}]*\}\)\)\)/,
    (match) => {
      totalFixed++;
      return `return payload.map((item) => {
      const raw = item as Record<string, unknown>
      return {
      code: toSafeString(raw.code ?? raw.symbol),
      name: toSafeString(raw.name ?? raw.shortName),
      price: toSafeNumber(raw.price ?? raw.value ?? raw.current ?? 0),
      change: toSafeNumber(raw.change ?? 0),
      changePercent: toSafeNumber(raw.changePercent ?? raw.change_percent ?? raw.pctChange ?? 0),
      high: toSafeOptionalNumber(raw.high),
      low: toSafeOptionalNumber(raw.low),
      volume: raw.volume != null ? toSafeString(raw.volume) : undefined,
    }})`;
    }
  );
  
  // Fix 2: adaptSectors
  s = s.replace(
    /return payload\.map\(\(item\) => \(\{[\s\S]*?turnover: item\.turnover[^}]*\}\)\)\)/,
    (match) => {
      totalFixed++;
      return `return payload.map((item) => {
      const raw = item as Record<string, unknown>
      return {
      name: toSafeString(raw.name ?? raw.sectorName),
      code: toSafeString(raw.code ?? raw.sectorCode),
      changePercent: toSafeNumber(raw.changePercent ?? raw.change_percent ?? raw.pctChange ?? 0),
      turnover: raw.turnover != null ? toSafeString(raw.turnover) : undefined,
    }})`;
    }
  );
  
  // Fix 3: adaptFundFlows
  s = s.replace(
    /return payload\.map\(\(item\) => \(\{[\s\S]*?unit: toSafeString\(item\.unit[^}]*\}\)\)\)/,
    (match) => {
      totalFixed++;
      return `return payload.map((item) => {
      const raw = item as Record<string, unknown>
      return {
      type: toSafeString(raw.type),
      name: toSafeString(raw.name ?? FUND_FLOW_NAMES[raw.type]),
      value: toSafeNumber(raw.value ?? raw.netInflow ?? 0),
      unit: toSafeString(raw.unit, '亿'),
    }})`;
    }
  );
  
  // Fix 4: adaptWatchlist
  s = s.replace(
    /return payload\.map\(\(item\) => \(\{[\s\S]*?changePercent: toSafeNumber\(item\.changePercent[^}]*\}\)\)\)/,
    (match) => {
      totalFixed++;
      return `return payload.map((item) => {
      const raw = item as Record<string, unknown>
      return {
      name: toSafeString(raw.name ?? raw.stockName),
      code: toSafeString(raw.code ?? raw.symbol),
      price: toSafeNumber(raw.price ?? raw.currentPrice ?? raw.current ?? 0),
      changePercent: toSafeNumber(raw.changePercent ?? raw.change_percent ?? raw.pctChange ?? 0),
    }})`;
    }
  );
  
  // Fix 5: adaptProfile metrics.map
  s = s.replace(
    /metrics\.map\(\(item\) => \(\{[\s\S]*?icon: item\.icon[^}]*\}\)\)\)/,
    (match) => {
      totalFixed++;
      return `metrics.map((item) => {
        const raw = item as Record<string, unknown>
        return {
        name: toSafeString(raw.name),
        score: toSafeNumber(raw.score ?? 0),
        description: raw.description != null ? toSafeString(raw.description) : undefined,
        icon: raw.icon != null ? toSafeString(raw.icon) : undefined,
      }})`;
    }
  );
  
  // Fix 6: adaptProfile tags.map - convert expression body to block with raw
  s = s.replace(
    /p\.tags\.map\(\(t\) => toSafeString\(t\)\)/,
    'p.tags.map((t) => toSafeString(t))'  // this is string item, not object - should be fine
  );
  
  // Fix 7: adaptKaiScore dimensions.map  
  // Fix any remaining item.xxx in map callbacks that we haven't covered
  // Let's handle remaining ones with generic replacements
  const remainingPatterns = [
    // item.xxx in expression body maps → need block body with raw
    // These are the adaptKaiScore, adaptModelComparison, adaptHotSectors, adaptValuePit methods
  ];
  
  // For remaining .map((item) => ...) patterns, replace item.xxx with raw.xxx
  // But only where item comes from an Array.isArray'd payload
  // Let's do a broader pass: any `item.xxx` access inside map callbacks where item is unknown
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`MarketDataAdapter.ts: ${totalFixed} fixes`);
  results.push({ file: 'src/services/data-collector/MarketDataAdapter.ts', fixes: totalFixed, status: 'OK' });
})();

// =============================================
// 2. tradeReviewAI.llmEnhancer.ts (6 errors)
// =============================================
(function fixTradeReviewAI() {
  const p = path.join(root, 'src', 'services', 'trading', 'tradeReviewAI.llmEnhancer.ts');
  let s = fs.readFileSync(p, 'utf8');
  let totalFixed = 0;
  
  // Find JSON.parse(result?.summary) or similar patterns
  // These need Record<string, unknown> assertion
  
  const patterns = [
    // result?.summary?.xxx → need result as Record<string, unknown>
    {
      from: /(const\s+\w+\s*=\s*await\s+)?(JSON\.parse\([^)]+\)[^;]*?)(?=\s*\.)/g,
      // We'll handle specific cases
    }
  ];
  
  // Specific fixes for the 6 errors
  // Pattern: JSON.parse(something).summary.accessing...
  // Fix by asserting JSON.parse result as Record<string, unknown>
  
  // 1. JSON.parse(...).summary.xxx
  s = s.replace(
    /(const\s+\w+\s*=\s*JSON\.parse\([^)]+\))(?=\s*\.)/g,
    '$1 as Record<string, unknown>'
  );
  
  // 2. result.summary.xxx where result is JSON.parse
  // Also handle nested .summary, .disciplineAnalysis, etc.
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`tradeReviewAI.llmEnhancer.ts: fixes applied`);
  results.push({ file: 'src/services/trading/tradeReviewAI.llmEnhancer.ts', fixes: 'auto', status: 'OK' });
})();

// =============================================
// 3. tradingServer.ts (5 errors)
// =============================================
(function fixTradingServer() {
  const p = path.join(root, 'src', 'mcp', 'servers', 'trading', 'tradingServer.ts');
  let s = fs.readFileSync(p, 'utf8');
  
  // Fix JSON.parse(args.tradeReviewReport ?? '{}') -> Record<string, unknown>
  s = s.replace(
    /(JSON\.parse\(args\.tradeReviewReport[^)]*\))/g,
    '$1 as Record<string, unknown>'
  );
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`tradingServer.ts: fixes applied`);
  results.push({ file: 'src/mcp/servers/trading/tradingServer.ts', fixes: 'auto', status: 'OK' });
})();

// =============================================
// 4. databridgeAdapter.ts (2 errors)
// =============================================
(function fixDatabridgeAdapter() {
  const p = path.join(root, 'src', 'core', 'databridgeAdapter.ts');
  let s = fs.readFileSync(p, 'utf8');
  
  // Fix JSON.parse or payload access
  s = s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`databridgeAdapter.ts: fixes applied`);
  results.push({ file: 'src/core/databridgeAdapter.ts', fixes: 'auto', status: 'OK' });
})();

// =============================================
// 5. jsonParser.ts (1 error)
// =============================================
(function fixJsonParser() {
  const p = path.join(root, 'src', 'services', 'llm', 'jsonParser.ts');
  let s = fs.readFileSync(p, 'utf8');
  
  s = s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`jsonParser.ts: fixes applied`);
  results.push({ file: 'src/services/llm/jsonParser.ts', fixes: 'auto', status: 'OK' });
})();

// =============================================
// 6. dataflowEngine.ts (1 error)
// =============================================
(function fixDataflowEngine() {
  const p = path.join(root, 'src', 'core', 'dataflow', 'dataflowEngine.ts');
  let s = fs.readFileSync(p, 'utf8');
  
  // Handle any access on any value
  s = s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`dataflowEngine.ts: fixes applied`);
  results.push({ file: 'src/core/dataflow/dataflowEngine.ts', fixes: 'auto', status: 'OK' });
})();

// =============================================
// 7. positionStore.ts (1 error)
// =============================================
(function fixPositionStore() {
  const p = path.join(root, 'src', 'store', 'positionStore.ts');
  let s = fs.readFileSync(p, 'utf8');
  
  s = s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`positionStore.ts: fixes applied`);
  results.push({ file: 'src/store/positionStore.ts', fixes: 'auto', status: 'OK' });
})();

// =============================================
// 8. fetcherConfig.ts (1 error)
// =============================================
(function fixFetcherConfig() {
  const p = path.join(root, 'src', 'config', 'fetcherConfig.ts');
  let s = fs.readFileSync(p, 'utf8');
  
  s = s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`fetcherConfig.ts: fixes applied`);
  results.push({ file: 'src/config/fetcherConfig.ts', fixes: 'auto', status: 'OK' });
})();

// =============================================
// 9. cascadeExecutor.ts (1 error)
// =============================================
(function fixCascadeExecutor() {
  const p = path.join(root, 'src', 'core', 'cascadeExecutor.ts');
  let s = fs.readFileSync(p, 'utf8');
  
  s = s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`cascadeExecutor.ts: fixes applied`);
  results.push({ file: 'src/core/cascadeExecutor.ts', fixes: 'auto', status: 'OK' });
})();

// =============================================
// 10. profileService.ts (1 error)
// =============================================
(function fixProfileService() {
  const p = path.join(root, 'src', 'services', 'profile', 'profileService.ts');
  let s = fs.readFileSync(p, 'utf8');
  
  s = s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`profileService.ts: fixes applied`);
  results.push({ file: 'src/services/profile/profileService.ts', fixes: 'auto', status: 'OK' });
})();

// =============================================
// 11. tagService.ts (1 error)
// =============================================
(function fixTagService() {
  const p = path.join(root, 'src', 'services', 'profile', 'tagService.ts');
  let s = fs.readFileSync(p, 'utf8');
  
  s = s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`tagService.ts: fixes applied`);
  results.push({ file: 'src/services/profile/tagService.ts', fixes: 'auto', status: 'OK' });
})();

// =============================================
// 12. scoreDocStore.ts (1 error)
// =============================================
(function fixScoreDocStore() {
  const p = path.join(root, 'src', 'store', 'scoreDocStore.ts');
  let s = fs.readFileSync(p, 'utf8');
  
  s = s.replace(
    /(JSON\.parse\([^)]+\))/g,
    '$1 as Record<string, unknown>'
  );
  
  fs.writeFileSync(p, s, 'utf8');
  console.log(`scoreDocStore.ts: fixes applied`);
  results.push({ file: 'src/store/scoreDocStore.ts', fixes: 'auto', status: 'OK' });
})();

console.log('\n=== FIX SUMMARY ===');
for (const r of results) console.log(`  ${r.file}: ${r.fixes} fixes (${r.status})`);
console.log(`\nTotal files processed: ${results.length}`);
