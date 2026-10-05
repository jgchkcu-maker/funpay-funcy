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

const close = ruleBody(css, '.fp-tools-popup > .fp-tools-header .close-btn:hover');
assert.doesNotMatch(close, /translateY\(/, 'Close hover never shifts the hit target');
assert.doesNotMatch(legacyFinance, /\.fpt-fin-trow:hover\s*\{[^}]*padding-left\s*:/, 'legacy Finance table rows must not change padding on hover');
assert.doesNotMatch(legacyFinance, /\.fpt-fin-trow\s*\{[^}]*transition:\s*padding-left/, 'legacy Finance table rows must not animate layout padding');

new Function(legacyFinance);
console.log('HOVER_STABILITY_PASS');
