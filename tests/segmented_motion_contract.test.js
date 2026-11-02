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
        [windows, '.fpt-win-seg-btn'],
        [imageGenerator, '.fp-tools-ig-tab'],
        [salesModes, '.fp-sm-ctab'],
    ]) {
        // Size variants (for example the filter tabs) may restate dimensions without motion;
        // one of the selector's own rules has to carry the transition.
        const rules = [...source.matchAll(new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\{([^}]+)\\}`, 'g'))];
        assert.ok(rules.length, `${selector} has a base rule`);
        assert.ok(rules.some(rule => /transition\s*:/.test(rule[1])), `${selector} transitions its visual state`);
    }
    // Auto-delivery summary chips are rendered as finance tabs and share their motion.
    assert.match(read('content/ui/auto_delivery_page.js'), /'fpt-fin-tab fpt-ad-summary-chip'/);
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
