const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8');

const genericSelectRule = css.match(
    /\.fp-tools-popup input\[type="text"\][\s\S]*?\.fp-tools-popup select,[\s\S]*?\}/
);
assert.ok(genericSelectRule, 'legacy popup select rule still exists');
assert.match(genericSelectRule[0], /width:\s*100%/i, 'legacy popup select rule keeps full-width behavior');
assert.match(genericSelectRule[0], /margin-bottom:\s*15px/i, 'legacy popup select rule keeps its spacing contract');

const financeSelectRule = css.match(
    /\.fp-tools-popup select\.fpt-fin-period-select,\s*\.fp-tools-popup \.fpt-fin-period-select\s*\{([\s\S]*?)\}/
);
assert.ok(financeSelectRule, 'Finance-specific select rule exists');

const financeSelectBody = financeSelectRule[1];
assert.match(financeSelectBody, /width:\s*auto\s*!important/i, 'Finance selects opt out of legacy full width');
assert.match(financeSelectBody, /margin:\s*0\s*!important/i, 'Finance selects remove the legacy bottom margin');
assert.match(financeSelectBody, /min-width:\s*[^;]+!important/i, 'Finance selects have a usable minimum width');
assert.match(financeSelectBody, /max-width:\s*[^;]+!important/i, 'Finance selects have a bounded maximum width');
assert.match(financeSelectBody, /box-sizing:\s*border-box\s*!important/i, 'Finance selects use border-box sizing');
assert.match(financeSelectBody, /flex:\s*0\s+1\s+auto\s*!important/i, 'Finance selects can wrap and shrink within the filter row');
assert.doesNotMatch(financeSelectBody, /width:\s*100%/i, 'Finance selects must not revert to width:100%');

const categorySelectRule = css.match(
    /\.fp-tools-popup #fptFinCategorySelect\s*\{([\s\S]*?)\}/
);
assert.ok(categorySelectRule, 'Finance category select has a dedicated width bound');
assert.match(categorySelectRule[1], /max-width:\s*[^;]+!important/i, 'Category select can be slightly wider than other filters');

console.log('T15_FINANCE_FILTER_CSS_ISOLATION_PASS');
