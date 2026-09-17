const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const cssPath = path.join(repoRoot, 'css', 'settings_sidebar_material3.css');
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

test('manifest loads the sidebar override last and installs viewport guard after popup code', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const funpayScript = manifest.content_scripts.find(entry =>
    Array.isArray(entry.matches) && entry.matches.includes('https://funpay.com/*') &&
    Array.isArray(entry.js) && entry.js.includes('content/ui/main_popup.js')
  );
  assert.ok(funpayScript, 'main FunPay content script entry must exist');

  const cssIndex = funpayScript.css.indexOf('css/settings_sidebar_material3.css');
  const iconThemeIndex = funpayScript.css.indexOf('css/fpt_icons_theme.css');
  assert.ok(cssIndex > iconThemeIndex, 'sidebar override must load after the legacy icon theme');

  const guardIndex = funpayScript.js.indexOf('content/ui/popup_viewport_guard.js');
  const popupIndex = funpayScript.js.indexOf('content/ui/main_popup.js');
  assert.ok(guardIndex > popupIndex, 'viewport guard must load after main_popup.js');
});
