const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { context } = require('./helpers/popup_actions_harness');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const safe = require('../content/safe_values.js');

function layoutModule(document) {
    const sandbox = { document };
    vm.runInNewContext(read('content/theme_chat_layout.js'), sandbox);
    return sandbox;
}

test('modular chat CSS is empty until the switch is on and clamps every number', () => {
    const { fptThemeChatLayoutCss: css } = layoutModule({});
    assert.equal(css(null), '');
    assert.equal(css({ chatModuleGap: 20 }), '');
    assert.equal(css({ chatModular: 'true' }), '', 'only a real boolean turns the layout on');

    const on = css({ chatModular: true, chatModuleGap: 20, chatContactsWidth: 300, chatDetailWidth: 250, borderRadius: 14 });
    assert.match(on, /--fpt-chat-gap: 20px; --fpt-chat-contacts-w: 300px; --fpt-chat-detail-w: 250px;/);
    assert.match(on, /\.chat-full > \.chat-contacts, \.chat-full > \.chat, \.chat-full > \.chat-detail \{ border-radius: 14px !important; \}/);
    assert.match(on, /@media \(min-width: 768px\)/, 'the mobile one-column chat keeps the FunPay layout');
    assert.match(on, /\.chat-full > \.chat \{ flex: 1 1 0;[^}]*min-width: 360px/);
    assert.doesNotMatch(on, /(?<![-\w])gap:/, 'the empty .js-chat-top sibling would double a container gap');
    assert.doesNotMatch(on, /display: none/);

    const wild = css({ chatModular: true, chatModuleGap: '5;}body{display:none', chatContactsWidth: 9999, chatDetailWidth: -1, borderRadius: 'x' });
    assert.match(wild, /--fpt-chat-gap: 12px; --fpt-chat-contacts-w: 480px; --fpt-chat-detail-w: 200px;/);
    assert.match(wild, /border-radius: 16px !important/);
    assert.doesNotMatch(wild, /body\{/);
});

test('modular chat hides the info panel and restores seam borders only in the original look', () => {
    const { fptThemeChatLayoutCss: css } = layoutModule({});
    assert.match(css({ chatModular: true, chatHideDetail: true }), /\.chat-full > \.chat-detail \{ display: none !important; \}/);
    const original = css({ chatModular: true, baseStyle: 'original' });
    assert.match(original, /\.chat-full > \.chat-contacts \{ border-right: 1px solid #eaeaea; \}/);
    assert.match(original, /\.chat-full > \.chat-detail \{ border-left: 1px solid #eaeaea; \}/);
    assert.doesNotMatch(css({ chatModular: true, baseStyle: 'custom' }), /#eaeaea/, 'the custom theme draws its own borders');
});

test('early copy of the modular chat rules is injected, replaced and removed', () => {
    const styles = new Map();
    const document = {
        getElementById: id => styles.get(id),
        createElement: () => ({ remove() { styles.delete(this.id); } }),
        documentElement: { appendChild(el) { styles.set(el.id, el); } }
    };
    const mod = layoutModule(document);
    mod.fptInjectChatLayoutPrehide({ chatModular: true, chatContactsWidth: 320 });
    const style = styles.get('fp-tools-chat-layout-prehide');
    assert.match(style.textContent, /--fpt-chat-contacts-w: 320px/);
    mod.fptInjectChatLayoutPrehide({ chatModular: true, chatContactsWidth: 330 });
    assert.equal(styles.get('fp-tools-chat-layout-prehide'), style, 'the same element is reused');
    assert.match(style.textContent, /--fpt-chat-contacts-w: 330px/);
    mod.fptInjectChatLayoutPrehide({ chatModular: false });
    assert.equal(styles.has('fp-tools-chat-layout-prehide'), false);
    mod.fptInjectChatLayoutPrehide({ chatModular: true });
    mod.fptRemoveChatLayoutPrehide();
    assert.equal(styles.has('fp-tools-chat-layout-prehide'), false);
});

test('theme CSS carries the modular chat in both looks, after the radius rewrite', () => {
    const h = context();
    h.ctx.document.createElement = () => ({});
    h.load('content/theme_chat_layout.js');
    h.load('content/features/theme.js');
    for (const baseStyle of ['custom', 'original']) {
        const off = vm.runInContext(`getCustomThemeCss({ ...DEFAULT_THEME, baseStyle: '${baseStyle}' })`, h.ctx);
        assert.doesNotMatch(off, /--fpt-chat-gap/, `${baseStyle}: off by default`);
        const on = vm.runInContext(`getCustomThemeCss({ ...DEFAULT_THEME, baseStyle: '${baseStyle}', chatModular: true, borderRadius: 0 })`, h.ctx);
        assert.match(on, /\.chat-full > \.chat-detail \{ border-radius: 0px !important; \}/, `${baseStyle}: zero radius stays zero`);
        const rounded = vm.runInContext(`getCustomThemeCss({ ...DEFAULT_THEME, baseStyle: '${baseStyle}', chatModular: true, borderRadius: 22 })`, h.ctx);
        assert.match(rounded, /\.chat-full > \.chat-contacts, \.chat-full > \.chat, \.chat-full > \.chat-detail \{ border-radius: 22px !important; \}/);
    }
    const defaults = vm.runInContext('DEFAULT_THEME', h.ctx);
    assert.deepEqual([defaults.chatModular, defaults.chatModuleGap, defaults.chatContactsWidth, defaults.chatDetailWidth, defaults.chatHideDetail],
        [false, 12, 280, 280, false]);
});

test('theme settings clamp the chat numbers on import and the modules load in order', () => {
    const clean = safe.themeSettings({ chatModuleGap: 99, chatContactsWidth: 10, chatDetailWidth: '300' });
    assert.deepEqual([clean.chatModuleGap, clean.chatContactsWidth, clean.chatDetailWidth], [40, 220, 300]);
    assert.equal(safe.themeSettings({ chatModuleGap: '5;}body{' }).chatModuleGap, 12);

    const manifest = JSON.parse(read('manifest.json'));
    const early = manifest.content_scripts.find(entry => entry.js?.includes('content/theme_flash_fix.js')).js;
    assert.ok(early.indexOf('content/theme_chat_layout.js') > -1 && early.indexOf('content/theme_chat_layout.js') < early.indexOf('content/theme_flash_fix.js'));
    const main = manifest.content_scripts.find(entry => entry.js?.includes('content/content_script.js')).js;
    assert.ok(main.includes('content/features/chat_column_resize.js'));
    assert.match(read('content/theme_flash_fix.js'), /fptInjectChatLayoutPrehide\(\{ \.\.\.saved, baseStyle \}\)/);
});
