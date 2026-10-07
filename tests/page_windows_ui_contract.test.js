// Windows the extension opens on FunPay pages share one shell (content/ui/page_windows.js) and one
// stylesheet (css/page_windows.css) with the extension menu's palette instead of colours read from the page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const WINDOWS = {
    'content/features/lot_cloning.js': ['fp-clone-wizard-overlay', 'fp-import-wizard-overlay', 'fp-clone-menu', 'fp-category-clone'],
    'content/features/lot_management.js': ['fp-reactivate-popup-overlay', 'fp-price-editor-overlay'],
    'content/features/ai_lot_creator.js': ['fp-tools-ai-gen-modal'],
    'content/features/image_generator.js': ['fpToolsImageGeneratorModal'],
    'content/features/templates.js': ['fp-tools-empty-template'],
    'content/features/user_notes.js': ['fp-tools-label-manager'],
    'content/features/auto_delivery.js': ['fp-tools-ad-manager-popup', 'ad-mass-add-popup', 'ad-duplicate-popup'],
    'content/features/ui_enhancements.js': ['fpt-stats-accuracy-overlay'],
    'content/features/finance.js': ['fpt-fin-ov'],
    'content/features/stats_drilldown.js': ['fpt-dd-overlay'],
    'content/features/chat_image_attach.js': ['fpt-tg-window', 'fpt-ed-window'],
    'content/features/magicstick.js': ['ms-my-styles-modal', 'ms-selector-modal']
};

test('page windows: the shell and its stylesheet load with the content scripts', () => {
    const manifest = JSON.parse(read('manifest.json'));
    const content = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js'));
    const shell = content.js.indexOf('content/ui/page_windows.js');
    assert.ok(shell > content.js.indexOf('content/utils.js'), 'the shell loads after utils.js');
    for (const file of Object.keys(WINDOWS)) {
        assert.ok(shell < content.js.indexOf(file), `${file} loads after the shell`);
    }
    assert.equal(content.css[content.css.length - 1], 'css/page_windows.css', 'window styles load last and win over legacy rules');
});

test('page windows: every window is built with fptWindow.create and keeps its id', () => {
    for (const [file, ids] of Object.entries(WINDOWS)) {
        const source = read(file);
        assert.match(source, /fptWindow\.create\(/, `${file} builds its window with the shared shell`);
        for (const id of ids) assert.ok(source.includes(`id: '${id}'`), `${file} keeps the #${id} window`);
    }
});

test('page windows: no window reads its colours from the page any more', () => {
    const clone = read('content/features/lot_cloning.js');
    assert.doesNotMatch(clone, /applyWizardTheme|cloneSurfaceColors|--cw-/, 'the clone and import wizards use the menu palette');
    for (const file of ['css/content_styles.css', 'css/ai_creator.css', 'css/image_generator.css']) {
        const css = read(file);
        assert.doesNotMatch(css, /--cw-|--ig-|fp-wizard-container|#fp-clone-wizard\b|\.fp-tools-ai-gen-modal|#fpToolsImageGeneratorModal|\.fp-tools-label-modal|\.fp-tools-empty-template-modal|#fp-price-editor-popup|\.fp-reactivate-popup|#fp-tools-ad-manager-popup|\.fpt-tg-modal|\.fpt-ed-overlay/,
            `${file} has no styles left from the old windows`);
    }
    const attach = read('content/features/chat_image_attach.js');
    assert.doesNotMatch(attach, /fptSolidSurface/, 'the send window no longer copies the chat surface');
});

test('page windows: the stylesheet uses the menu tokens and the violet accent', () => {
    const css = read('css/page_windows.css');
    assert.match(css, /--fptm-accent: #7663f6;/, 'fallback accent is the menu accent');
    assert.doesNotMatch(css, /#1b75bb/i, 'the FunPay blue never appears in windows');
    for (const selector of ['.fpt-win {', '.fpt-win-head {', '.fpt-win-foot {', '.fpt-win-scrim .fpt-win-btn {', '.fpt-win-scrim .fpt-win-input {']) {
        const at = css.indexOf(selector);
        assert.ok(at >= 0, `${selector} exists`);
        const body = css.slice(at, css.indexOf('}', at));
        assert.match(body, /var\(--fptm-/, `${selector} reads menu tokens`);
    }
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /@media \(max-width: 560px\)/, 'windows become bottom sheets on narrow screens');
});

test('page windows: site theme rules and the popup outside-click leave windows alone', () => {
    assert.ok(read('content/features/theme.js').includes(":not(:where(.fp-tools-popup, .fp-tools-popup *, .fpt-win-scrim, .fpt-win-scrim *))"));
    assert.match(read('content/features/misc.js'), /closest\?\.\('#fpToolsButton, \.fpt-win-scrim'\)/);
    assert.match(read('content/features/page_selects.js'), /select\.closest\('\.fpt-win-scrim'\)/, 'select menus inside windows take the window palette');
});

test('page windows: the shell closes on Escape, keeps Tab inside and restores focus', () => {
    const shell = read('content/ui/page_windows.js');
    assert.match(shell, /event\.key === 'Escape'/);
    assert.match(shell, /event\.key !== 'Tab'/);
    assert.match(shell, /previous\.focus/);
    assert.match(shell, /fptApplyMenuTheme/, 'the shell paints windows with the menu palette');
});
