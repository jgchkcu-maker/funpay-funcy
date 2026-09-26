const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const loader = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'settings_loader.js'), 'utf8').replace(/\r\n/g, '\n');
const templates = fs.readFileSync(path.join(ROOT, 'content', 'features', 'templates.js'), 'utf8').replace(/\r\n/g, '\n');
const slash = fs.readFileSync(path.join(ROOT, 'content', 'features', 'slash_telegram_ui.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

const start = popup.indexOf('<div class="fp-tools-page-content" data-page="templates">');
const end = popup.indexOf('<div class="fp-tools-page-content" data-page="auto_review">', start);
assert.ok(start >= 0 && end > start, 'quick replies page must exist');
const page = popup.slice(start, end);

assert.match(page, /class="fpt-ui-page-header fp-qr-page-header"/, 'page uses TASK 00 page header');
assert.match(page, /class="fpt-ui-segmented fpt-quick-replies-tabs"/, 'templates and commands use shared segmented tabs');
assert.match(page, /data-quick-replies-mode="templates"/);
assert.match(page, /data-quick-replies-mode="commands"/);
assert.match(page, /data-quick-replies-pane="templates"/);
assert.match(page, /data-quick-replies-pane="commands"/);
assert.match(page, /id="fpt-popover-hint" style="display:none;"/, 'popover hint remains compatible with existing style.display synchronisation');
assert.match(page, /id="fpt-appearance-preview" class="chat-buttons-container fp-qr-live-preview"/, 'there is one live preview');
assert.equal((page.match(/id="fpt-appearance-preview"/g) || []).length, 1, 'only one live preview is rendered');
for (const opt of ['shape','size','fill','align','sidebarDensity','sidebarLayout']) {
    assert.match(page, new RegExp('data-fpt-opt="' + opt + '"'), 'appearance option preserved: ' + opt);
}
for (const toggle of ['fullWidth','compact','uppercase','showPreview']) {
    assert.match(page, new RegExp('data-fpt-toggle="' + toggle + '"'), 'appearance toggle preserved: ' + toggle);
}
for (const id of ['templatesEnabled','sendTemplatesImmediately','template-settings-container','addCustomTemplateBtn','fptSlashEnabled','fptSlashAutocomplete','fptSlashAddBtn','fptSlashList']) {
    assert.match(page, new RegExp('id="' + id + '"'), 'functional id preserved: ' + id);
}
assert.doesNotMatch(page, /support-promo[\s\S]*?lightbulb/, 'commands no longer use legacy promo/lightbulb callout');
assert.doesNotMatch(page, /vertical-align:\s*-3px/, 'quick replies removes manual icon baseline hack');
assert.doesNotMatch(page, /style="margin-top:10px|style="display:flex;align-items:center;justify-content:space-between/, 'major page layout is no longer driven by inline style hacks');

assert.match(loader, /fpt-ui-button fpt-ui-button--secondary fpt-ui-icon-button add-image-btn/, 'dynamic template image action uses shared geometry');
assert.match(loader, /delete-custom-template-btn fp-qr-template-delete/, 'custom template delete hook remains');
assert.match(loader, /escapeHtml\(config\.label\)/, 'template labels are escaped before dynamic markup');
assert.match(loader, /escapeHtml\(config\.text\)/, 'template text is escaped before dynamic markup');
assert.match(loader, /class="template-toggle fp-qr-template-toggle"/, 'template toggle hook remains');

assert.match(slash, /class="fpt-ui-state fp-qr-slash-empty"/, 'commands have an intentional empty state');
assert.match(slash, /class="fpt-ui-button fpt-ui-button--primary fpt-slash-empty-add"/, 'empty state contains its own primary action');
assert.match(slash, /async function fptSlashAddCommand\(\)/, 'toolbar and empty state share one add-command path');
assert.match(slash, /fpt-slash-empty-add/, 'empty state action is delegated');
assert.match(slash, /fpt-ui-icon-button fpt-slash-del fp-qr-slash-delete/, 'delete control uses shared icon geometry');
assert.doesNotMatch(slash.slice(slash.indexOf('function fptSlashRenderList()'), slash.indexOf('function fptSlashEsc')), /style="/, 'slash rows have no inline layout styles');
assert.doesNotMatch(slash.slice(slash.indexOf('function fptSlashRenderList()'), slash.indexOf('function fptSlashEsc')), /🗑️/, 'slash delete control does not use emoji');
assert.match(slash, /configEl\.hidden = \(_fptSlashCfg\.enabled === false\)/, 'disabled slash config uses hidden state');
assert.match(slash, /configEl\.hidden = !enabledEl\.checked/, 'slash config responds to the master toggle');

assert.match(templates, /fpToolsTemplateSettings/, 'template storage key remains unchanged');
assert.match(slash, /const FPT_SLASH_KEY = 'fpToolsSlashCommands'/, 'slash command storage key remains unchanged');
assert.match(css, /QUICK REPLIES UI — TASK 06/, 'TASK 06 CSS exists');
assert.match(css, /\.fp-qr-position-grid[\s\S]*?grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/, 'position choices use a compact desktop grid');
assert.match(css, /\.fp-qr-appearance-layout[\s\S]*?grid-template-columns:minmax\(0,1\.25fr\) minmax\(230px,\.75fr\)/, 'controls and preview share a deliberate layout');
assert.match(css, /\.fp-qr-slash-delete[\s\S]*?width:40px;[\s\S]*?height:40px;/, 'slash delete has a stable hit area');

new Function(loader);
new Function(slash);
console.log('QUICK_REPLIES_UI_CONTRACT_PASS');
