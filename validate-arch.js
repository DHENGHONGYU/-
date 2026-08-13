const fs = require('fs');
const path = require('path');
const base = 'd:/FinSightV9/finsight-v9-ui-review';
const design = JSON.parse(fs.readFileSync(path.join(base, 'finsight-v9-ui-review.design'), 'utf8'));

let errors = [];
let warnings = [];

const pageIds = new Set(design.data.map(p => p.id));
design.data.forEach(page => {
  const htmlPath = path.join(base, page.devMetadata.htmlSrc);
  if (!fs.existsSync(htmlPath)) {
    errors.push('Missing HTML: ' + page.devMetadata.htmlSrc);
  } else {
    const html = fs.readFileSync(htmlPath, 'utf8');
    (page.devMetadata.interactions || []).forEach(int => {
      if (!int.domId) {
        warnings.push('Missing domId in ' + page.id);
      } else {
        const attr = 'data-dom-id="' + int.domId + '"';
        if (!html.includes(attr)) {
          errors.push('Missing domId ' + int.domId + ' in ' + page.devMetadata.htmlSrc);
        }
      }
      if (!int.targetPageId || !pageIds.has(int.targetPageId)) {
        errors.push('Invalid targetPageId ' + int.targetPageId + ' in ' + page.id);
      }
    });
  }
});

console.log('=== Validation Results ===');
console.log('Pages:', design.data.length);
console.log('Errors:', errors.length);
errors.forEach(e => console.log('  ERROR:', e));
console.log('Warnings:', warnings.length);
warnings.forEach(w => console.log('  WARN:', w));
if (errors.length === 0) console.log('PASS: All checks passed');
