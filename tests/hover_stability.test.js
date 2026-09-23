const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');
const legacyFinance = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance.js'), 'utf8').replace(/\r\n/g, '\n');

function ruleBody(source, selector) {
    const start = source.indexOf(selector);
    assert.ok(start >= 0, `missing CSS rule: ${selector}`);
    const open = source.indexOf('{', start);
    const close = source.indexOf('}', open);
    assert.ok(open >= 0 && close > open, `malformed CSS rule: ${selector}`);
    return source.slice(open + 1, close);
}

const triggerBase = ruleBody(css, '.fp-tools-popup button.fpt-fin-select-trigger,\n.fp-tools-popup .fpt-fin-select-trigger');
const triggerHover = ruleBody(css, '.fp-tools-popup button.fpt-fin-select-trigger:hover,\n.fp-tools-popup .fpt-fin-select-trigger:hover');
const periodHover = ruleBody(css, '.fp-tools-popup select.fpt-fin-period-select:hover');
const chevronBase = ruleBody(css, '.fpt-fin-select-chevron');
const chevronOpen = ruleBody(css, '.fpt-fin-select-shell.is-open .fpt-fin-select-chevron');
const scrollbarBase = ruleBody(css, '.fpt-fin-select-scrollbar-thumb');
const scrollbarHover = ruleBody(css, '.fpt-fin-select-scrollbar-thumb:hover,\n.fpt-fin-select-scrollbar-thumb.is-dragging');
const optionActiveSelector = '.fp-tools-popup button.fpt-fin-select-option:active,\n.fp-tools-popup .fpt-fin-select-option:active';
const optionActive = css.includes(optionActiveSelector) ? ruleBody(css, optionActiveSelector) : '';
const genericButtonHover = ruleBody(css, '.fp-tools-popup button:not(.fpt-nav-group-toggle):not(:disabled):hover,\n.fp-tools-popup .btn:not(:disabled):hover');
const subtabBase = ruleBody(css, '.fp-tools-popup button.fpt-fin-subtab,\n.fp-tools-popup .fpt-fin-subtab');
const subtabHover = ruleBody(css, '.fp-tools-popup button.fpt-fin-subtab:hover,\n.fp-tools-popup .fpt-fin-subtab:hover');
const sellerHover = ruleBody(css, '.fpt-fin-seller-item:hover');
const operationChevronHover = ruleBody(css, '.fpt-fin-operation-type-row:hover .fpt-fin-operation-type-chevron');

assert.doesNotMatch(triggerBase, /transform\s*\.\d+s\s+ease/, 'select trigger must not animate geometry on hover');
assert.match(triggerHover, /transform:\s*none\s*!important/, 'custom select trigger must stay in place under the pointer');
assert.doesNotMatch(triggerHover, /translateY\(/, 'custom select trigger hover must not move vertically');
assert.match(periodHover, /transform:\s*none\s*!important/, 'legacy Finance period select must stay in place under the pointer');

assert.match(chevronBase, /margin:\s*0\s+1px\s+0\s+0/, 'select chevron must keep a stable flex footprint');
assert.doesNotMatch(chevronOpen, /margin(?:-top)?\s*:/, 'opening a select must not change chevron layout margins');
assert.match(chevronOpen, /translateY\(4px\)/, 'open chevron offset should be visual-only');

assert.doesNotMatch(scrollbarBase, /transition:[^;]*(?:width|left)/, 'scrollbar thumb geometry must not animate');
assert.doesNotMatch(scrollbarHover, /(?:^|[;\s])(left|width)\s*:/, 'scrollbar thumb hover must keep its hit area stable');
assert.doesNotMatch(optionActive, /transform\s*:/, 'select options must not jump on pointer press');

assert.doesNotMatch(genericButtonHover, /transform\s*:/, 'generic popup button hover must not move controls under the pointer');
assert.match(genericButtonHover, /box-shadow:/, 'generic popup buttons must retain their existing hover response');
assert.match(css, /\.fp-tools-popup button:not\(\.fpt-nav-group-toggle\):not\(:disabled\):hover/, 'generic button hover must exclude category toggles');
assert.doesNotMatch(subtabBase, /transform\s+\.?\d+ms/, 'Finance subtabs must not animate layout movement on hover');
assert.doesNotMatch(subtabHover, /transform\s*:/, 'Finance subtab hover must not move the tab');
assert.doesNotMatch(sellerHover, /transform\s*:/, 'Finance seller rows must not move on hover');
assert.doesNotMatch(operationChevronHover, /transform\s*:/, 'Finance operation-row chevrons must not move on hover');

assert.doesNotMatch(legacyFinance, /\.fpt-fin-trow:hover\s*\{[^}]*padding-left\s*:/, 'legacy Finance table rows must not change padding on hover');
assert.doesNotMatch(legacyFinance, /\.fpt-fin-trow\s*\{[^}]*transition:\s*padding-left/, 'legacy Finance table rows must not animate layout padding');

new Function(legacyFinance);
console.log('HOVER_STABILITY_PASS');
