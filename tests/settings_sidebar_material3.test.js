const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const cssPath = path.join(repoRoot, 'css', 'settings_sidebar_material3.css');
const responsiveCssPath = path.join(repoRoot, 'css', 'settings_responsive_guard.css');
const guardPath = path.join(repoRoot, 'content', 'ui', 'popup_viewport_guard.js');
const manifestPath = path.join(repoRoot, 'manifest.json');

test('settings navigation uses a single vertical Material-style sidebar', () => {
  assert.equal(fs.existsSync(cssPath), true, 'settings sidebar override stylesheet must exist');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(css, /\.fp-tools-nav\s+ul\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s);
  assert.match(css, /\.fp-tools-nav\s+li\[data-page\]\s+a,\s*\.fp-tools-nav\s+li\[data-page\]\.fpt-nav-wide\s+a\s*\{[^}]*flex-direction:\s*row/s);
  assert.match(css, /\.fp-tools-nav\s+li\[data-page\]\s+a\s*>\s*span:last-child\s*\{[^}]*white-space:\s*nowrap/s);
  assert.doesNotMatch(css, /\.fp-tools-nav\s+ul\s*\{[^}]*grid-template-columns/s);
});

test('popup defaults to a wider desktop layout and search starts as an icon', () => {
  assert.equal(fs.existsSync(cssPath), true, 'settings sidebar override stylesheet must exist');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(css, /--fpt-popup-preferred-width:\s*1180px/);
  assert.match(css, /--fpt-popup-preferred-height:\s*780px/);
  assert.match(css, /\.fpt-nav-search-input\s*\{[^}]*width:\s*42px/s);
  assert.match(css, /\.fpt-nav-search:focus-within\s+\.fpt-nav-search-input\s*\{[^}]*width:\s*100%/s);
  assert.match(css, /\.fpt-nav-search::before\s*\{[^}]*content:\s*['"]search['"]/s);
});

test('settings responsiveness is driven by popup container width, not only browser viewport', () => {
  assert.equal(fs.existsSync(responsiveCssPath), true, 'responsive settings guard stylesheet must exist');
  const css = fs.readFileSync(responsiveCssPath, 'utf8');

  assert.match(css, /\.fp-tools-popup\s*\{[^}]*container-type:\s*size[^}]*container-name:\s*fpt-popup/s);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*900px\)/);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)/);
  assert.match(css, /@container\s+fpt-popup\s*\(max-height:\s*650px\)/);
});

test('compact popup keeps navigation labels and search usable while freeing content width', () => {
  const css = fs.readFileSync(responsiveCssPath, 'utf8');

  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-nav\s*\{[^}]*flex-basis:\s*164px[^}]*width:\s*164px/s);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-nav\s+li\[data-page\]\s+a\s*>\s*span:last-child\s*\{[^}]*display:\s*block/s);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fpt-nav-search:focus-within\s+\.fpt-nav-search-input\s*\{[^}]*width:\s*100%/s);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-content\s*\{[^}]*padding:/s);
});

test('theme preview is bounded and dense settings grids collapse in compact popup', () => {
  const css = fs.readFileSync(responsiveCssPath, 'utf8');

  assert.match(css, /#fp-wallpaper-carousel\s*\{[^}]*height:\s*clamp\(/s);
  assert.match(css, /#fp-wallpaper-carousel\s*\{[^}]*max-height:\s*420px/s);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*900px\)[\s\S]*?\.color-input-grid[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.color-input-grid[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.theme-actions-grid[^}]*grid-template-columns:\s*1fr/s);
});

test('shared settings rows are allowed to shrink and wrap instead of overflowing', () => {
  const css = fs.readFileSync(responsiveCssPath, 'utf8');

  assert.match(css, /\.fp-tools-content\s*>\s*\*\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.fp-tools-popup\s+\.setting-group[^}]*min-width:\s*0/s);
  assert.match(css, /\.fp-tools-popup\s+\.template-container[^}]*min-width:\s*0/s);
  assert.match(css, /\.fp-tools-popup\s+img[^}]*max-width:\s*100%/s);
  assert.match(css, /\.fp-tools-popup\s+\.fp-tools-page-content\s+\[style\*=['"]display:flex['"]\]\s*>\s*\*\s*\{[^}]*min-width:\s*0/s);
});

test('search results and detached settings modals stay inside their own visible area', () => {
  const css = fs.readFileSync(responsiveCssPath, 'utf8');

  assert.match(css, /\.fpt-nav-search-results\s*\{[^}]*width:\s*min\(430px,\s*calc\(100cqw\s*-\s*24px\)\)/s);
  assert.match(css, /\.fp-tools-modal-overlay\s*\{[^}]*padding:\s*12px/s);
  assert.match(css, /\.fp-tools-modal-content\s*\{[^}]*max-width:\s*calc\(100vw\s*-\s*24px\)[^}]*max-height:\s*calc\(100vh\s*-\s*24px\)/s);
  assert.match(css, /\.fp-tools-modal-body\s*\{[^}]*overflow:\s*auto/s);
});

test('viewport guard clamps old saved sizes and positions without overflowing', () => {
  assert.equal(fs.existsSync(guardPath), true, 'popup viewport guard must exist');
  const { clampPopupRect } = require(guardPath);

  const valid = clampPopupRect(
    { left: 100, top: 50, width: 900, height: 600 },
    { width: 1366, height: 768 }
  );
  assert.deepEqual(valid, { left: 100, top: 50, width: 900, height: 600 });

  const tinyLegacy = clampPopupRect(
    { left: 0, top: 0, width: 230, height: 650 },
    { width: 1366, height: 768 }
  );
  assert.equal(tinyLegacy.width, 760);
  assert.equal(tinyLegacy.height, 650);
  assert.ok(tinyLegacy.left >= 12);
  assert.ok(tinyLegacy.top >= 12);

  const offscreen = clampPopupRect(
    { left: 1200, top: 700, width: 900, height: 600 },
    { width: 1366, height: 768 }
  );
  assert.equal(offscreen.left, 454);
  assert.equal(offscreen.top, 156);

  const smallViewport = clampPopupRect(
    { left: 0, top: 0, width: 1180, height: 780 },
    { width: 700, height: 500 }
  );
  assert.deepEqual(smallViewport, { left: 12, top: 12, width: 676, height: 476 });
});

test('viewport guard normalizes restored geometry and preserves safe margins', () => {
  const { clampPopupRect } = require(guardPath);

  const restored = clampPopupRect(
    { left: -900, top: -300, width: 1900, height: 1200 },
    { width: 1440, height: 900 }
  );
  assert.deepEqual(restored, { left: 12, top: 12, width: 1416, height: 876 });

  const afterMonitorChange = clampPopupRect(
    { left: 1500, top: 900, width: 1180, height: 780 },
    { width: 1024, height: 640 }
  );
  assert.deepEqual(afterMonitorChange, { left: 12, top: 12, width: 1000, height: 616 });
});

test('viewport guard degrades margins safely even for an extremely small viewport', () => {
  const { clampPopupRect } = require(guardPath);
  const tinyViewport = clampPopupRect(
    { left: -20, top: -20, width: 500, height: 500 },
    { width: 20, height: 18 }
  );

  assert.deepEqual(tinyViewport, { left: 10, top: 9, width: 0, height: 0 });
});

test('legacy tiny saved popup sizes are detected for one-time widening', () => {
  assert.equal(fs.existsSync(guardPath), true, 'popup viewport guard must exist');
  const { shouldResetLegacySize } = require(guardPath);

  assert.equal(shouldResetLegacySize({ width: '230px', height: '650px' }), true);
  assert.equal(shouldResetLegacySize({ width: '759px', height: '700px' }), true);
  assert.equal(shouldResetLegacySize({ width: '900px', height: '500px' }), true);
  assert.equal(shouldResetLegacySize({ width: '760px', height: '520px' }), false);
  assert.equal(shouldResetLegacySize({ width: '1024px', height: '700px' }), false);
  assert.equal(shouldResetLegacySize(null), false);
});

test('manifest loads responsive guard after all legacy settings styles', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const funpayScript = manifest.content_scripts.find(entry =>
    Array.isArray(entry.matches) && entry.matches.includes('https://funpay.com/*') &&
    Array.isArray(entry.js) && entry.js.includes('content/ui/main_popup.js')
  );
  assert.ok(funpayScript, 'main FunPay content script entry must exist');

  const sidebarIndex = funpayScript.css.indexOf('css/settings_sidebar_material3.css');
  const subtabsIndex = funpayScript.css.indexOf('css/subtabs_material3.css');
  const responsiveIndex = funpayScript.css.indexOf('css/settings_responsive_guard.css');
  assert.ok(responsiveIndex > sidebarIndex, 'responsive guard must load after sidebar styles');
  assert.ok(responsiveIndex > subtabsIndex, 'responsive guard must load after subtab styles');

  const guardIndex = funpayScript.js.indexOf('content/ui/popup_viewport_guard.js');
  const popupIndex = funpayScript.js.indexOf('content/ui/main_popup.js');
  assert.ok(guardIndex > popupIndex, 'viewport guard must load after main_popup.js');
});
