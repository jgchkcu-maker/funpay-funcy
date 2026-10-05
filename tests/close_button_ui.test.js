const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('main popup disables manual resizing and has a reduced-motion-aware exit state', () => {
    const css = read('css/content_styles.css');

    assert.match(css, /\.fp-tools-popup\s*\{[\s\S]*?resize:\s*none/);
    assert.match(css, /\.fp-tools-popup\.is-closing\s*\{[\s\S]*?opacity:\s*0[\s\S]*?visibility:\s*visible/);
    assert.ok(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.fp-tools-popup,\s*\.fp-tools-popup\.active\s*\{[\s\S]*?transition-duration:\s*0\.01ms/.test(css));
    assert.doesNotMatch(css, /\.fp-tools-popup\s+\.fp-tools-nav h2\s*\{[^}]*cursor:\s*move/);
});

test('main popup omits the close button and closes only for outside clicks', () => {
    const popup = read('content/ui/main_popup.js');
    const misc = read('content/features/misc.js');
    const contentScript = read('content/content_script.js');

    assert.doesNotMatch(popup, /class="close-btn" aria-label="Закрыть"/);
    assert.doesNotMatch(popup, /function makePopupInteractive\(/);
    assert.ok(/const closeOnOutsideClick\s*=\s*\(event\)\s*=>[\s\S]*?popup\.contains\(event\.target\)[\s\S]*?popup\._fptClose/.test(misc));
    assert.ok(/document\.addEventListener\(['"]click['"],\s*closeOnOutsideClick,\s*true\)/.test(misc));
    assert.ok(/popup\.classList\.contains\(['"]active['"]\)[\s\S]*?popup\._fptClose/.test(contentScript));
});

test('legacy popup geometry is no longer read or written', () => {
    const popup = read('content/ui/main_popup.js');
    const loader = read('content/ui/settings_loader.js');

    assert.doesNotMatch(popup, /fpToolsPopup(?:Size|Position|Dragged)/);
    assert.doesNotMatch(loader, /fpToolsPopup(?:Size|Position|Dragged)/);
    assert.doesNotMatch(popup, /addEventListener\(['"](?:mousedown|mousemove|mouseup)['"]/);
});
