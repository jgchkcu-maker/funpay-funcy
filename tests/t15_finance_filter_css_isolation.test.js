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
assert.match(financeSelectBody, /width:\s*100%\s*!important/i, 'Finance selects fill their assigned filter-grid column');
assert.match(financeSelectBody, /margin:\s*0\s*!important/i, 'Finance selects remove the legacy bottom margin');
assert.match(financeSelectBody, /min-width:\s*0\s*!important/i, 'Finance selects may shrink with their grid column');
assert.match(financeSelectBody, /max-width:\s*none\s*!important/i, 'Finance selects must not impose a competing maximum width');
assert.match(financeSelectBody, /box-sizing:\s*border-box\s*!important/i, 'Finance selects use border-box sizing');
assert.match(financeSelectBody, /flex:\s*none\s*!important/i, 'Finance selects are sized by the filter grid rather than flex wrapping');
assert.doesNotMatch(financeSelectBody, /width:\s*auto\s*!important/i, 'Finance selects must not override their grid-column width');

const categorySelectRule = css.match(
    /\.fp-tools-popup #fptFinCategorySelect\s*\{([\s\S]*?)\}/
);
assert.ok(categorySelectRule, 'Finance category select has a dedicated grid-compatible rule');
assert.match(categorySelectRule[1], /max-width:\s*none\s*!important/i, 'Category select may fill its grid column');

console.log('T15_FINANCE_FILTER_CSS_ISOLATION_PASS');
