const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'manifest.json');
const cssPath = path.join(repoRoot, 'css', 'pixel_expressive.css');

function readCss() {
  assert.equal(fs.existsSync(cssPath), true, 'Pixel expressive stylesheet must exist');
  return fs.readFileSync(cssPath, 'utf8');
}

test('manifest loads Pixel expressive design after responsive guard', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const funpayScript = manifest.content_scripts.find(entry =>
    Array.isArray(entry.matches) && entry.matches.includes('https://funpay.com/*') &&
    Array.isArray(entry.js) && entry.js.includes('content/ui/main_popup.js')
  );

  assert.ok(funpayScript, 'main FunPay content script entry must exist');
  const responsiveIndex = funpayScript.css.indexOf('css/settings_responsive_guard.css');
  const expressiveIndex = funpayScript.css.indexOf('css/pixel_expressive.css');

  assert.ok(expressiveIndex >= 0, 'Pixel expressive stylesheet must be registered');
  assert.ok(expressiveIndex > responsiveIndex, 'Pixel expressive stylesheet must load last');
});

test('Pixel expressive shell defaults to the approved wider desktop geometry', () => {
  const css = readCss();
  assert.match(css, /--fpt-popup-preferred-width:\s*1360px/);
  assert.match(css, /--fpt-popup-preferred-height:\s*900px/);
  assert.match(css, /\.fp-tools-popup\s*\{[^}]*border-radius:\s*24px/s);
  assert.match(css, /\.fp-tools-content\s*\{[^}]*overflow-x:\s*hidden/s);
});

test('sidebar search stays expanded and navigation uses expressive selected states', () => {
  const css = readCss();
  assert.match(css, /\.fpt-nav-search-input\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/s);
  assert.match(css, /\.fpt-nav-search::before\s*\{[^}]*left:/s);
  assert.match(css, /\.fp-tools-nav\s+li\[data-page\]\.active\s+a\s*\{[^}]*border-radius:/s);
  assert.match(css, /\.fp-tools-nav::after\s*\{[^}]*content:/s);
});

test('common legacy and modern settings surfaces share one card system', () => {
  const css = readCss();
  assert.match(css, /\.fp-tools-popup\s+:is\(\.fpt-setting-card,\s*\.setting-group,\s*\.template-container,\s*\.fpt-subpanel,\s*\.support-promo\)\s*\{/s);
  assert.match(css, /\.fp-tools-popup\s+:is\(input\[type=['"]text['"]\],\s*input\[type=['"]number['"]\],\s*textarea,\s*select\)\s*\{/s);
  assert.match(css, /\.fp-tools-popup\s+:is\(\.btn,\s*button\)\s*\{/s);
  assert.match(css, /\.fp-tools-popup\s+\.fpt-needs-list/);
  assert.match(css, /\.fp-tools-modal-content/);
});

test('appearance previews are bounded and dense controls use responsive grids', () => {
  const css = readCss();
  assert.match(css, /#fp-wallpaper-carousel\s*\{[^}]*height:\s*clamp\([^}]*max-height:\s*300px/s);
  assert.match(css, /#circlePreview\s*\{[^}]*width:\s*96px[^}]*height:\s*96px/s);
  assert.match(css, /\.color-input-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,/s);
  assert.match(css, /\.theme-actions-grid\s*\{[^}]*grid-template-columns:/s);
});

test('expressive layer protects compact layouts and supports dark and reduced-motion modes', () => {
  const css = readCss();
  assert.match(css, /\.fp-tools-popup\s+\.fp-tools-page-content\s*>\s*\*\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*900px\)/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /\.fp-tools-popup\.fptm-dark/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
