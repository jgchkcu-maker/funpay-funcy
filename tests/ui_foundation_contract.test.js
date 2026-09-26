const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

function lastRuleBody(selector) {
    const pos = css.lastIndexOf(selector);
    assert.ok(pos >= 0, 'missing selector: ' + selector);
    const open = css.indexOf('{', pos);
    const close = css.indexOf('}', open);
    assert.ok(open >= 0 && close > open, 'malformed rule: ' + selector);
    return css.slice(open + 1, close);
}

assert.match(css, /FPT UI FOUNDATION v1 — TASK 00/, 'foundation marker must exist');

for (const token of [
    '--fpt-ui-radius-card: 16px',
    '--fpt-ui-radius-control: 12px',
    '--fpt-ui-control-h: 42px',
    '--fpt-ui-icon-button: 40px',
    '--fpt-ui-row-min-h: 48px'
]) {
    assert.ok(css.includes(token), 'missing shared token: ' + token);
}

const checkboxInput = lastRuleBody('.fp-tools-popup .checkbox-label-inline > input[type="checkbox"],');
assert.match(checkboxInput, /margin:\s*0\s*!important/, 'checkbox rows must neutralize legacy margin-right');
assert.match(checkboxInput, /flex:\s*0 0 16px/, 'checkbox footprint must be stable');

const checkboxText = lastRuleBody('.fp-tools-popup .checkbox-label-inline > span,');
assert.match(checkboxText, /margin:\s*0\s*!important/, 'checkbox text must neutralize the legacy margin-left');

const oneLine = lastRuleBody('.fp-tools-popup input.template-input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),');
assert.match(oneLine, /height:\s*var\(--fpt-ui-control-h\)/, 'one-line template controls must use the shared control height');
assert.match(oneLine, /min-height:\s*0\s*!important/, 'one-line controls must not inherit the legacy 60px minimum');
assert.match(oneLine, /resize:\s*none\s*!important/, 'one-line controls must never expose textarea resizing');

const textarea = lastRuleBody('.fp-tools-popup textarea.template-input,');
assert.match(textarea, /min-height:\s*88px\s*!important/, 'textareas keep a dedicated multiline minimum');
assert.match(textarea, /resize:\s*vertical\s*!important/, 'textarea resizing remains explicit');

for (const selector of [
    '.fp-tools-popup .fpt-ui-button',
    '.fp-tools-popup .fpt-ui-icon-button',
    '.fp-tools-popup .fpt-ui-setting-row',
    '.fp-tools-popup .fpt-ui-segmented',
    '.fp-tools-popup .fpt-ui-callout',
    '.fp-tools-popup .fpt-ui-state',
    '.fp-tools-popup .fpt-ui-icon-slot'
]) {
    assert.ok(css.includes(selector), 'missing shared UI primitive: ' + selector);
}

const buttonIcon = lastRuleBody('.fp-tools-popup .fpt-ui-button > .material-symbols-rounded,');
assert.match(buttonIcon, /vertical-align:\s*initial\s*!important/, 'new button icons must not use manual baseline nudges');
assert.match(buttonIcon, /line-height:\s*1/, 'new button icons need a stable glyph box');

const legacyButtonIcon = lastRuleBody('.fp-tools-popup .btn > .material-symbols-rounded,');
assert.match(legacyButtonIcon, /vertical-align:\s*initial\s*!important/, 'legacy icon+label buttons must neutralize inline negative vertical-align while pages migrate');
assert.match(legacyButtonIcon, /margin:\s*0\s*!important/, 'legacy icon margins must yield to the shared flex gap');

assert.match(css, /\.fp-tools-popup \.fpt-ui-button:focus-visible,[\s\S]*?outline:\s*2px solid/, 'shared interactive controls need keyboard focus');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.fpt-ui-button/, 'shared motion must respect reduced-motion');
assert.doesNotMatch(foundationSlice(), /\.fp-tools-nav\b/, 'TASK 00 must not restyle the reference sidebar');

function foundationSlice() {
    return css.slice(css.indexOf('/* ═══ FPT UI FOUNDATION v1 — TASK 00 ═══ */'));
}

console.log('UI_FOUNDATION_CONTRACT_PASS');
