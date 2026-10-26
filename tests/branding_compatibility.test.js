const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('manifest exposes Funcy without changing extension wiring', () => {
    const manifest = JSON.parse(read('manifest.json'));

    assert.equal(manifest.name, 'Funcy');
    assert.equal(manifest.action.default_title, 'Funcy');
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.action.default_popup, 'popup/popup.html');
    assert.equal(manifest.background.service_worker, 'background/background.js');
    assert.ok(manifest.permissions.includes('storage'));
    assert.ok(!manifest.host_permissions.includes('https://fptools.onrender.com/*'));
    assert.ok(!manifest.host_permissions.includes('https://fptools-ai-server.vercel.app/*'));
});

test('primary visible surfaces use the canonical brand and omit old public links', () => {
    const popup = read('popup/popup.html');
    const popupScript = read('popup/popup.js');
    const mainPopup = read('content/ui/main_popup.js');
    const contentScript = read('content/content_script.js');
    const converter = read('background/remake.html');


    assert.match(popup, /<h1>Funcy<\/h1>/);
    assert.doesNotMatch(popup, /\b(?:FP Tools|FunPay Tools)\b/);
    assert.doesNotMatch(popup, /fp-tools-button-location\.png/);
    assert.doesNotMatch(popupScript, /t\.me\/FPTools/);

    assert.match(contentScript, /id="fpToolsButton"[^>]*aria-label="Открыть Funcy"/);
    assert.match(contentScript, /icons\/icon128\.png/);
    assert.match(contentScript, /class="fpt-logo-btn"/);
    assert.doesNotMatch(contentScript, />FP Tools</);

    assert.match(mainPopup, /Funcy/);
    assert.doesNotMatch(mainPopup, /\b(?:FP Tools|FunPay Tools)\b/);
    assert.doesNotMatch(mainPopup, /(?:funpay\.tools|t\.me\/FP|discord\.gg\/)/i);

    assert.match(converter, /Конвертер лотов → Funcy/);
    assert.doesNotMatch(converter, /\b(?:FP Tools|FunPay Tools)\b/);


});

test('public identifier is excluded while the automation compatibility marker is retained', () => {
    const manifest = JSON.parse(read('manifest.json'));
    assert.ok(!manifest.content_scripts.flatMap(entry => entry.js).includes('content/features/fpt_identifier.js'));
    assert.ok(!read('content/content_script.js').includes('initializeFPTIdentifier'));
    assert.match(read('background/autoresponder.js'), /const BOT_MARKER = '\\u2061'/);
});

test('legacy settings, config protocols, and resource dependencies remain intact', () => {
    const settingsIO = read('content/features/settings_io.js');
    const headerStyler = read('content/ui/header_button_styler.js');
    const config = JSON.parse(read('config.v1.json'));
    const background = read('background/background.js');
    const autoResponder = read('background/autoresponder.js');
    const readme = read('README.md');

    assert.match(settingsIO, /const FP_CONFIG_MAGIC\s*=\s*['"]FPTCONFIG['"]/);
    assert.match(settingsIO, /Funcy/);
    assert.doesNotMatch(settingsIO, /\b(?:FP Tools|FunPay Tools)\b/);
    assert.match(autoResponder, /fpToolsAutoReplies/);
    assert.match(headerStyler, /const STORAGE_KEY\s*=\s*['"]fpToolsHeaderButtonStyles['"]/);
    assert.equal(config.profileDesc.verifyTitle, 'FPT Verify');
    assert.equal(config.themeGallery.baseUrl, 'https://raw.githubusercontent.com/XaviersDev/fpt-themes/main/');
    assert.doesNotMatch(background, /fptools-ai-server\.vercel\.app/);
    assert.match(readme, /Funcy/);
    assert.doesNotMatch(readme, /\b(?:FP Tools|FunPay Tools)\b/);
    assert.doesNotMatch(readme, /t\.me\/FPTools|github\.com\/XaviersDev\/FunPay-Tools/);
});
