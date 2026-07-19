// 重新生成top-d2d.csv (UTF-8直写文件)
const fs = require('fs');
const path = require('path');

const latestReport = fs.readdirSync('scripts/docs/reports/audit')
  .filter(f => /^audit-doc-code-references-\d{4}-\d{2}-\d{2}T/.test(f))
  .sort().reverse()[0];
const data = JSON.parse(fs.readFileSync('scripts/docs/reports/audit/' + latestReport, 'utf-8'));
const br = data.brokenReferences.filter(b => b.type === 'doc-to-doc');
const counts = new Map();
br.forEach(b => {
  counts.set(b.target, (counts.get(b.target) || 0) + 1);
});
const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

const lines = ['count,target'];
sorted.forEach(([t, c]) => {
  const escaped = t.replace(/"/g, '""');
  lines.push(`${c},"${escaped}"`);
});

fs.writeFileSync('scripts/docs/reports/audit/top50-d2d.csv', lines.join('\n'), 'utf-8');
console.log('Wrote', lines.length - 1, 'rows to top50-d2d.csv');
