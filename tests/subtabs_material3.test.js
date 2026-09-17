const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cssPath = path.join(root, 'css', 'subtabs_material3.css');
const motionPath = path.join(root, 'content', 'ui', 'subtabs_motion.js');

test('shared subtabs use Material 3 surface and a sliding active indicator', () => {
  assert.ok(fs.existsSync(cssPath), 'subtabs Material stylesheet must exist');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /\.fpt-subtabs-bar\s*\{[^}]*border-radius:\s*16px/s);
  assert.match(css, /\.fpt-subtabs-bar::before\s*\{[^}]*--fpt-subtab-indicator-width/s);
  assert.match(css, /\.fpt-subtab\.is-active\s*\{[^}]*background:\s*transparent/s);
  assert.match(css, /transition:[^;]*(transform|translate)[^;]*cubic-bezier/s);
});

test('subtabs remain single-line and horizontally usable in narrow windows', () => {
  assert.ok(fs.existsSync(cssPath), 'subtabs Material stylesheet must exist');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /\.fpt-subtabs-bar\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.fpt-subtab\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.fpt-subtab\s*\{[^}]*flex:\s*0\s+0\s+auto/s);
});

test('motion enhancer tracks the active tab and keeps accessibility state synchronized', () => {
  assert.ok(fs.existsSync(motionPath), 'subtabs motion enhancer must exist');
  const js = fs.readFileSync(motionPath, 'utf8');
  assert.match(js, /--fpt-subtab-indicator-x/);
  assert.match(js, /--fpt-subtab-indicator-width/);
  assert.match(js, /\.fp-tools-page-content\.active/);
  assert.match(js, /aria-selected/);
  assert.match(js, /MutationObserver/);
});

test('tab switch is intercepted before legacy display none/block', () => {
  const js = fs.readFileSync(motionPath, 'utf8');
  assert.match(js, /addEventListener\(['"]click['"],[\s\S]*?true\s*\)/);
  assert.match(js, /stopImmediatePropagation\(\)/);
  assert.match(js, /WeakSet/);
});

test('content transition stays local to popup and never uses document View Transitions', () => {
  const js = fs.readFileSync(motionPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.doesNotMatch(js, /startViewTransition|viewTransitionName|VIEW_TRANSITION_/,
    'document-level View Transitions escape popup clipping and create ghost content');
  assert.doesNotMatch(css, /::view-transition-/,
    'subtab animation must not render top-layer view-transition snapshots');
  assert.match(js, /newPage\.animate\(/,
    'the real active page should be animated locally');
});

test('settings content clips animated paint only while a subtab transition is running', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  const js = fs.readFileSync(motionPath, 'utf8');

  assert.match(css, /\.fp-tools-popup\s+\.fp-tools-content\s*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.fp-tools-popup\s+\.fp-tools-content\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.fp-tools-popup\s+\.fp-tools-content\.fpt-subtab-transitioning\s*\{[^}]*contain:\s*paint/s);
  assert.match(js, /classList\.add\(TRANSITIONING_CLASS\)/);
  assert.match(js, /classList\.remove\(TRANSITIONING_CLASS\)/);
});

test('local reveal keeps the outgoing page visible underneath the incoming page', () => {
  const js = fs.readFileSync(motionPath, 'utf8');
  const local = js.match(/function runLocalTransition[\s\S]*?\n    \}/)?.[0] || '';

  assert.ok(local, 'local transition must exist');
  assert.match(local, /const\s+oldPage\s*=\s*popup\.querySelector\(ACTIVE_PAGE_SELECTOR\)/,
    'the outgoing page must be captured before the legacy switch');
  assert.match(local, /oldPage\.style\.display\s*=\s*['"]block['"]/,
    'the outgoing page should remain visible during the reveal');
  assert.match(local, /oldPage\.style\.position\s*=\s*['"]absolute['"]/,
    'the outgoing page must be removed from layout while acting as an underlay');
  assert.match(local, /oldPage\.style\.pointerEvents\s*=\s*['"]none['"]/,
    'the underlay must not receive clicks');
});

test('incoming page uses directional clip-path reveal only, with no whole-page fade or movement', () => {
  const js = fs.readFileSync(motionPath, 'utf8');
  const local = js.match(/function runLocalTransition[\s\S]*?\n    \}/)?.[0] || '';

  assert.ok(local, 'local transition must exist');
  assert.match(local, /clipPath/,
    'incoming page should reveal with clip-path');
  assert.match(local, /inset\(0\s+0\s+0\s+100%/,
    'forward navigation should reveal from the right edge');
  assert.match(local, /inset\(0\s+100%\s+0\s+0/,
    'backward navigation should reveal from the left edge');
  assert.doesNotMatch(local, /opacity\s*:/,
    'whole-page opacity causes visible flashing');
  assert.doesNotMatch(local, /transform\s*:/,
    'whole-page transforms cause visible shake');
  assert.doesNotMatch(local, /translate(?:3d|X|Y)?\s*\(|scale\s*\(/,
    'settings content must not move or scale while switching tabs');
});

test('reveal cleanup restores temporary styles and hides the outgoing page', () => {
  const js = fs.readFileSync(motionPath, 'utf8');
  const local = js.match(/function runLocalTransition[\s\S]*?\n    \}/)?.[0] || '';

  assert.ok(local, 'local transition must exist');
  assert.match(local, /oldPage\.style\.display\s*=\s*['"]none['"]/,
    'outgoing page must be hidden after the reveal completes');
  assert.match(local, /newPage\.style\.clipPath\s*=\s*newPageInline\.clipPath/,
    'incoming clip-path must be restored');
  assert.match(local, /newPage\.style\.willChange\s*=\s*newPageInline\.willChange/,
    'temporary compositor hint must be removed');
});

test('settings content reserves scrollbar space so tab height changes cannot shift layout', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /\.fp-tools-popup\s+\.fp-tools-content\s*\{[^}]*scrollbar-gutter:\s*stable/s);
});

test('rapid repeated switches cancel the previous local animation', () => {
  const js = fs.readFileSync(motionPath, 'utf8');
  assert.match(js, /fallbackAnimations\.forEach/);
  assert.match(js, /animation\.cancel\(\)/);
  assert.match(js, /switchSerial/);
});

test('reduced-motion bypasses content animation', () => {
  const js = fs.readFileSync(motionPath, 'utf8');
  assert.match(js, /prefersReducedMotion\(\)/);
  assert.match(js, /if\s*\(prefersReducedMotion\(\)\)\s*\{[\s\S]*?dispatchLegacyClick\(tab\)/);
});

test('manifest loads the shared subtabs layers after the legacy popup styles', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const entry = manifest.content_scripts.find(item =>
    Array.isArray(item.matches) && item.matches.includes('https://funpay.com/*') &&
    Array.isArray(item.js) && item.js.includes('content/ui/main_popup.js')
  );
  assert.ok(entry, 'main FunPay content script must exist');

  const motionIndex = entry.js.indexOf('content/ui/subtabs_motion.js');
  const popupIndex = entry.js.indexOf('content/ui/main_popup.js');
  assert.ok(motionIndex > popupIndex, 'subtabs motion enhancer must load after main_popup.js');

  const subtabsCssIndex = entry.css.indexOf('css/subtabs_material3.css');
  const sidebarCssIndex = entry.css.indexOf('css/settings_sidebar_material3.css');
  assert.ok(subtabsCssIndex > sidebarCssIndex, 'subtabs Material stylesheet must load last');
});
