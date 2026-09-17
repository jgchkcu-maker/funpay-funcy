const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const responsiveCssPath = path.join(root, 'css', 'settings_responsive_guard.css');

function responsiveCss() {
  assert.equal(fs.existsSync(responsiveCssPath), true, 'responsive settings guard stylesheet must exist');
  return fs.readFileSync(responsiveCssPath, 'utf8');
}

test('dashboard and finance grids collapse from popup width instead of browser width', () => {
  const css = responsiveCss();

  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-popup\s+\.fpt-status-hub[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-popup\s+\.fp-stats-grid3[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-popup\s+\.fp-stats-extra-grid[\s\S]*?grid-template-columns:\s*1fr/);
});

test('dense legacy settings grids get compact container-query fallbacks', () => {
  const css = responsiveCss();

  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-popup\s+\.fpt-pos-grid[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-popup\s+\.fpt-appx-grid[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-popup\s+\.auto-sender-controls[\s\S]*?grid-template-columns:\s*1fr/);
});

test('finance, templates, and accounts wrap controls instead of pushing the popup wider', () => {
  const css = responsiveCss();

  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-popup\s+\.currency-input-group[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-popup\s+\.template-settings-list\s+\.template-item-header[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*700px\)[\s\S]*?\.fp-tools-popup\s+\.fpt-acc-item[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(css, /\.fp-tools-popup\s+\.currency-rate-display\s*\{[^}]*min-width:\s*0/s);
});

test('short and very narrow popup does not reintroduce fixed nav-row height', () => {
  const css = responsiveCss();

  assert.match(css, /@container\s+fpt-popup\s*\(max-width:\s*520px\)\s+and\s+\(max-height:\s*650px\)[\s\S]*?\.fp-tools-nav\s+li\[data-page\]\s+a,[\s\S]*?height:\s*auto[^}]*min-height:\s*48px/s);
});
