const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

assert.match(popup, /id="fptFinSubtabsIndicator"/, 'Finance tabs need a shared sliding indicator');
assert.match(popup, /function positionSubtabIndicator\(activeButton, animate\)/, 'Finance UI must position the shared indicator');
assert.match(popup, /--fpt-fin-pill-x/, 'indicator x position must be updated from the active tab');
assert.match(popup, /--fpt-fin-pill-w/, 'indicator width must follow the active tab');
assert.match(popup, /ResizeObserver/, 'indicator must stay aligned when the popup resizes');
assert.match(popup, /ArrowLeft[\s\S]*ArrowRight/, 'Finance tabs must support keyboard arrow navigation');

assert.match(css, /\.fpt-fin-subtabs\s*\{[\s\S]*?border-radius:\s*999px/, 'tab track must be a rounded glass capsule');
assert.match(css, /backdrop-filter:\s*blur\(18px\)/, 'tab track should use a glass blur');
assert.match(css, /\.fpt-fin-subtabs-indicator\s*\{[\s\S]*?transition:[\s\S]*?cubic-bezier/, 'active pill must animate with a spring-like curve');
assert.match(css, /\.fpt-fin-subtabs-indicator\.is-moving[\s\S]*?scaleX\(1\.035\)/, 'pill should briefly stretch while sliding');
assert.match(css, /button\.fpt-fin-subtab\.active[\s\S]*?background:\s*transparent\s*!important/, 'active button itself must stay transparent so the shared pill is visible');
assert.match(css, /prefers-reduced-motion:\s*reduce/, 'motion must respect reduced-motion preferences');

new Function(popup);
console.log('FINANCE_IOS_SUBTABS_PASS');
