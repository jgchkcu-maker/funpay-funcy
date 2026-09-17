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

test('tab switch is intercepted before legacy display none/block to prevent flicker', () => {
  const js = fs.readFileSync(motionPath, 'utf8');
  assert.match(js, /startViewTransition/);
  assert.match(js, /addEventListener\(['"]click['"],[\s\S]*?true\s*\)/);
  assert.match(js, /stopImmediatePropagation\(\)/);
  assert.match(js, /WeakSet/);
});

test('fallback switches immediately and gently settles the new page', () => {
  const js = fs.readFileSync(motionPath, 'utf8');
  const fallback = js.match(/function runFallbackTransition[\s\S]*?\n    \}/)?.[0] || '';
  assert.ok(fallback, 'fallback transition must exist');
  assert.match(fallback, /dispatchLegacyClick\(tab\)[\s\S]*?newPage\.animate/);
  assert.match(fallback, /opacity:\s*0\.9/);
  assert.match(fallback, /opacity:\s*1/);
  assert.match(fallback, /translate3d\(0,\s*4px/);
  assert.doesNotMatch(fallback, /opacity:\s*0(?:\D|$)/, 'fallback must not render a fully transparent frame');
});

test('interrupted view transitions synchronously clean their temporary state', () => {
  const js = fs.readFileSync(motionPath, 'utf8');
  assert.match(js, /let\s+activeViewCleanup\s*=\s*null/);
  assert.match(js, /activeViewCleanup\(\)/);
  assert.match(js, /classList\.remove\(VIEW_TRANSITION_ROOT_CLASS\)/);
});

test('view transition styles animate only the settings page snapshot', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /::view-transition-old\(root\)[\s\S]*animation:\s*none/);
  assert.match(css, /::view-transition-old\(fpt-settings-page\)/);
  assert.match(css, /::view-transition-new\(fpt-settings-page\)/);
  assert.match(css, /animation-duration:\s*1\d{2}ms/);
});

test('subtab transition never exposes the page background between old and new content', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  const js = fs.readFileSync(motionPath, 'utf8');
  const outSection = css.split('@keyframes fptSettingsPageOut')[1]?.split('@keyframes fptSettingsPageIn')[0] || '';
  const fallback = js.match(/function runFallbackTransition[\s\S]*?\n    \}/)?.[0] || '';

  assert.ok(outSection, 'outgoing View Transition keyframes must exist');
  assert.doesNotMatch(outSection, /opacity:\s*0(?:\D|$)/, 'outgoing snapshot must not fade to transparent');
  assert.match(outSection, /from\s*\{[\s\S]*?opacity:\s*1[\s\S]*?to\s*\{[\s\S]*?opacity:\s*1/, 'outgoing snapshot should stay opaque for the full transition');

  assert.ok(fallback, 'fallback transition must exist');
  assert.doesNotMatch(fallback, /\{\s*opacity:\s*0,/, 'fallback must not create a transparent keyframe');
  assert.match(fallback, /dispatchLegacyClick\(tab\)[\s\S]*?newPage\.animate/, 'fallback should switch immediately and animate the new page over a non-blank frame');
});

test('reduced-motion disables tab and page animations', () => {
  assert.ok(fs.existsSync(cssPath), 'subtabs Material stylesheet must exist');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /transition:\s*none\s*!important/);
  assert.match(css, /animation:\s*none\s*!important/);
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
