const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('manifest exposes FunPay Funcy without changing extension wiring', () => {
    const manifest = JSON.parse(read('manifest.json'));

    assert.equal(manifest.name, 'FunPay Funcy');
    assert.equal(manifest.action.default_title, 'FunPay Funcy');
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.action.default_popup, 'popup/popup.html');
    assert.equal(manifest.background.service_worker, 'background/background.js');
    assert.ok(manifest.permissions.includes('storage'));
    assert.ok(manifest.host_permissions.includes('https://fptools.onrender.com/*'));
    assert.ok(manifest.host_permissions.includes('https://fptools-ai-server.vercel.app/*'));
});

test('primary visible surfaces use the canonical brand and omit old public links', () => {
    const popup = read('popup/popup.html');
    const popupScript = read('popup/popup.js');
    const mainPopup = read('content/ui/main_popup.js');
    const contentScript = read('content/content_script.js');
    const identifier = read('content/features/fpt_identifier.js');
    const converter = read('background/remake.html');
    const tour = read('content/features/overview_tour.js');

    assert.match(popup, /<h1>FunPay Funcy<\/h1>/);
    assert.doesNotMatch(popup, /\b(?:FP Tools|FunPay Tools)\b/);
    assert.doesNotMatch(popup, /fp-tools-button-location\.png/);
    assert.doesNotMatch(popupScript, /t\.me\/FPTools/);

    assert.match(contentScript, /id="fpToolsButton">FunPay Funcy<span><\/span>/);
    assert.doesNotMatch(contentScript, />FP Tools</);

    assert.match(mainPopup, /FunPay Funcy/);
    assert.doesNotMatch(mainPopup, /\b(?:FP Tools|FunPay Tools)\b/);
    assert.doesNotMatch(mainPopup, /(?:funpay\.tools|t\.me\/FP|discord\.gg\/)/i);

    assert.match(identifier, /lbl\.textContent\s*=\s*['"]· FunPay Funcy['"]/);
    assert.match(converter, /Конвертер лотов → FunPay Funcy/);
    assert.doesNotMatch(converter, /\b(?:FP Tools|FunPay Tools)\b/);
    assert.match(tour, /FunPay Funcy/);
    assert.doesNotMatch(tour, /t\.me\/FPTools/);
});

test('identifier keeps the invisible protocol signature while changing only its label', () => {
    const identifier = read('content/features/fpt_identifier.js');

    assert.match(identifier, /const FPT_SIGNATURE\s*=\s*['"]\\u200B\\u200D\\u200C['"]/);
    assert.match(identifier, /const FPT_LABEL_CLASS\s*=\s*['"]fpt-status-label['"]/);
    assert.match(identifier, /chrome\.storage\.local\.get\(['"]fpToolsIdentifierEnabled['"]\)/);
    assert.match(identifier, /function initializeFPTIdentifier\(\)/);
});

test('legacy settings, config protocols, and resource dependencies remain intact', () => {
    const settingsIO = read('content/features/settings_io.js');
    const headerStyler = read('content/ui/header_button_styler.js');
    const config = JSON.parse(read('config.v1.json'));
    const background = read('background/background.js');
    const autoResponder = read('background/autoresponder.js');
    const readme = read('README.md');

    assert.match(settingsIO, /const FP_CONFIG_MAGIC\s*=\s*['"]FPTCONFIG['"]/);
    assert.match(settingsIO, /FunPay Funcy/);
    assert.doesNotMatch(settingsIO, /\b(?:FP Tools|FunPay Tools)\b/);
    assert.match(autoResponder, /fpToolsAutoReplies/);
    assert.match(headerStyler, /const STORAGE_KEY\s*=\s*['"]fpToolsHeaderButtonStyles['"]/);
    assert.equal(config.profileDesc.verifyTitle, 'FPT Verify');
    assert.equal(config.themeGallery.baseUrl, 'https://raw.githubusercontent.com/XaviersDev/fpt-themes/main/');
    assert.match(background, /https:\/\/fptools-ai-server\.vercel\.app\/api/);
    assert.match(background, /https:\/\/raw\.githubusercontent\.com\/XaviersDev\/FunPay-Tools\/main\/donaters\.json/);
    assert.match(readme, /FunPay Funcy/);
    assert.doesNotMatch(readme, /\b(?:FP Tools|FunPay Tools)\b/);
    assert.doesNotMatch(readme, /t\.me\/FPTools|github\.com\/XaviersDev\/FunPay-Tools/);
});
