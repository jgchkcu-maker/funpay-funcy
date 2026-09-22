const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('main popup close control keeps a 40px hit area with a 32px visual surface', () => {
    const css = read('css/content_styles.css');

    assert.match(css, /--fpt-close-size:\s*32px/);
    assert.match(css, /--fpt-close-hit-area:\s*40px/);
    assert.match(css, /--fpt-close-icon-size:\s*12px/);
    assert.match(css, /\.close-btn__surface\s*\{[\s\S]*?width:\s*var\(--fpt-close-size\)[\s\S]*?height:\s*var\(--fpt-close-size\)/);
    assert.match(css, /\.close-btn:active \.close-btn__surface\s*\{[\s\S]*?scale\(0\.95\)/);
    assert.match(css, /\.close-btn:focus-visible \.close-btn__surface/);
    assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
    assert.doesNotMatch(css, /\.fp-tools-popup \.close-btn::after\s*\{[\s\S]*?content:\s*['"]×['"]/);
});

test('main popup close control uses an SVG icon and preserves the existing close hook', () => {
    const popup = read('content/ui/main_popup.js');
    const misc = read('content/features/misc.js');

    const closeMarkup = popup.match(/<button type="button" class="close-btn" aria-label="Закрыть">([\s\S]*?)<\/button>/);
    assert.ok(closeMarkup, 'main close button markup should exist');
    assert.match(closeMarkup[1], /<svg class="close-btn__icon"/);
    assert.match(closeMarkup[1], /stroke-width="1\.8"/);
    assert.match(closeMarkup[1], /stroke-linecap="round"/);
    assert.doesNotMatch(closeMarkup[1], /&times;|×/);

    assert.match(misc, /const closeBtn = popup\.querySelector\(['"]\.close-btn['"]\)/);
    assert.match(misc, /closeBtn\.addEventListener\(['"]click['"][\s\S]*?popup\.classList\.remove\(['"]active['"]\)/);
});
