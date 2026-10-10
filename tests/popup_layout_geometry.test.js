const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const mainPopup = fs.readFileSync(path.join(root, 'content/ui/menu_theme.js'), 'utf8') + fs.readFileSync(path.join(root, 'content/ui/main_popup.js'), 'utf8');
const contentStyles = fs.readFileSync(path.join(root, 'css/content_styles.css'), 'utf8');
const settingsLoader = fs.readFileSync(path.join(root, 'content/ui/settings_loader.js'), 'utf8');

function getPopupLimits(innerWidth, innerHeight = 900) {
    const context = vm.createContext({ window: { innerWidth, innerHeight } });
    vm.runInContext(settingsLoader, context, { filename: 'content/ui/settings_loader.js' });
    return {
        limits: context.window.getPopupViewportLimits(),
        applyResponsivePopupGeometry: popup => context.window.applyResponsivePopupGeometry(popup)
    };
}

test('expanded sidebar gains room while the collapsed rail remains compact', () => {
    assert.equal((mainPopup.match(/width:280px; flex:0 0 280px/g) || []).length, 2);
    assert.match(mainPopup, /\.fp-tools-nav\.is-nav-collapsed\{ width:104px; flex:0 0 104px;/);
});

test('popup dimensions adapt to the viewport and ignore saved geometry', () => {
    assert.match(contentStyles, /width:\s*min\(1320px, 94vw\)/);
    assert.match(contentStyles, /max-width:\s*1320px/);
    const wide = getPopupLimits(2000);
    const medium = getPopupLimits(1000, 700);
    const narrow = getPopupLimits(700, 500);
    assert.equal(wide.limits.maxWidth, 1320);
    assert.equal(wide.limits.defaultWidth, 1320);
    assert.equal(wide.limits.defaultHeight, 780);
    assert.equal(medium.limits.defaultWidth, 940);
    assert.equal(medium.limits.defaultHeight, 630);
    assert.equal(narrow.limits.defaultWidth, 658);
    assert.equal(narrow.limits.defaultHeight, 450);

    const popup = { style: { width: '500px', height: '400px', left: '70px', top: '40px' }, classList: { remove() {} } };
    wide.applyResponsivePopupGeometry(popup);
    assert.equal(popup.style.width, '1320px');
    assert.equal(popup.style.height, '780px');
    assert.equal(popup.style.left, '');
    assert.equal(popup.style.top, '');
});

test('page surface clears the close control and shares the softer panel radius', () => {
    assert.match(mainPopup, /\.fp-tools-popup\.fptm-themed \.fp-tools-nav\{\s*width:280px; flex:0 0 280px;[\s\S]*?border-radius:24px;/);
    assert.match(mainPopup, /\.fp-tools-popup\.fptm-themed \.fp-tools-nav\{\s*box-sizing:border-box; width:280px; flex:0 0 280px;[\s\S]*?border-radius:24px;/);
    assert.match(mainPopup, /\.fp-tools-popup\.fptm-themed \.fp-tools-content \.fp-tools-page-content\{[\s\S]*?border-radius:24px;/);
    assert.match(mainPopup, /min-height:calc\(100% - 32px\); margin:16px;/);
});

test('narrow viewport automatically compacts the sidebar at the agreed breakpoint', () => {
    assert.match(mainPopup, /FPT_NAV_AUTO_COLLAPSE_MAX_WIDTH\s*=\s*740/);
    assert.match(mainPopup, /setNavCollapsed\([^,]+,\s*false\)/);
});
