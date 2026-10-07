const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('tab-like controls use consistent hover and selected-state motion across popup sections', () => {
    const categories = read('css/popup_categories.css');
    const imageGenerator = read('css/image_generator.css');
    const windows = read('css/page_windows.css');
    const salesModes = read('content/features/sales_modes.js');

    for (const [source, selector] of [
        [categories, '.fpt-fin-tab'],
        [categories, '.fpt-fin-seg-btn'],
        [categories, '.fpt-ad-summary-chip'],
        [windows, '.fpt-win-seg-btn'],
        [imageGenerator, '.fp-tools-ig-tab'],
        [salesModes, '.fp-sm-ctab'],
    ]) {
        const rule = source.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\{([^}]+)\\}`));
        assert.ok(rule, `${selector} has a base rule`);
        assert.match(rule[1], /transition\s*:/, `${selector} transitions its visual state`);
    }
});

test('finance header separates title from tabs and segmented updates animate replacement content', () => {
    const categories = read('css/popup_categories.css');
    assert.match(categories, /\.fpt-finance\s*\{[^}]*margin-top:\s*(?!0(?:px)?\s*;)[^;]+;/s,
        'finance content has a small gap after its category title');
    assert.match(categories, /\.fpt-fin-tab-pane\s*\.fpt-fin-card\s*\{[^}]*animation:/s,
        're-rendered cards animate when a metric or filter changes');
    assert.match(categories, /prefers-reduced-motion:\s*reduce/,
        'motion follows the reduced-motion preference');
});
