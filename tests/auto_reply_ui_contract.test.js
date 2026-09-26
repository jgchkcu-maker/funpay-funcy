const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const feature = fs.readFileSync(path.join(ROOT, 'content', 'features', 'auto_review.js'), 'utf8').replace(/\r\n/g, '\n');
const misc = fs.readFileSync(path.join(ROOT, 'content', 'features', 'misc.js'), 'utf8').replace(/\r\n/g, '\n');
const runtime = fs.readFileSync(path.join(ROOT, 'background', 'autoresponder.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

const start = popup.indexOf('<div class="fp-tools-page-content" data-page="auto_reply">');
const end = popup.indexOf('<div class="fp-tools-page-content active" data-page="lot_io">', start);
assert.ok(start >= 0 && end > start, 'auto_reply page must exist');
const page = popup.slice(start, end);

assert.match(page, /class="fpt-ui-page-header fp-ar-page-header"/, 'auto_reply uses TASK 00 page header');
assert.equal((page.match(/class="fpt-ui-surface fp-ar-rule"/g) || []).length, 4, 'auto_reply is four rule cards');
for (const id of ['greetingEnabled','newOrderReplyEnabled','orderConfirmReplyEnabled','keywordsEnabled']) {
    assert.match(page, new RegExp('id="' + id + '" class="fp-ar-rule-toggle"'), id + ' stays a stable rule toggle');
}
for (const id of ['greetingRuleBody','newOrderRuleBody','orderConfirmRuleBody','keywordsRuleBody']) {
    assert.match(page, new RegExp('id="' + id + '" class="fp-ar-rule-body" hidden'), id + ' starts collapsed before settings restore');
}
assert.match(page, /<details class="fp-ar-variables">/, 'variables live in one shared disclosure');
assert.doesNotMatch(page, /Переменные:\s*<code>/, 'per-rule variable paragraphs are removed');
assert.match(page, /id="greetingCooldownDays"[\s\S]*?class="fpt-ui-control fp-ar-number-input"/, 'cooldown uses a dedicated one-line control');
assert.doesNotMatch(page, /id="greetingCooldownDays"[^>]*class="template-input"/, 'cooldown no longer inherits textarea minimum height');
assert.doesNotMatch(page, /style="margin-top:20px;"|style="margin-top:10px;"/, 'legacy spacing hacks are removed from auto_reply page');
assert.match(page, /data-editor-actions-for="greetingText"/);
assert.match(page, /data-editor-actions-for="newOrderReplyText"/);
assert.match(page, /data-editor-actions-for="orderConfirmReplyText"/);
assert.match(page, /data-editor-actions-for="newKeywordResponse"/);

assert.match(feature, /function setupAutoReplyRuleDisclosure\(page\)/, 'rule visibility has one setup function');
assert.match(feature, /body\.hidden = !enabled/, 'disabled rules collapse their bodies');
assert.match(feature, /status\.textContent = enabled \? 'Включено' : 'Выключено'/, 'rule state is visible in the header');
assert.match(feature, /toggle\.addEventListener\('change', \(\) => sync\(rule\)\)/, 'rule body reacts immediately to enable changes');
assert.match(feature, /setupAutoReplyRuleDisclosure\(page\)/, 'disclosure is initialized after saved values are restored');
assert.match(feature, /class="fpt-ui-state fp-ar-keywords-empty"/, 'empty keyword state is intentional');
assert.match(feature, /fpt-ui-icon-button fpt-edit-keyword-btn/, 'keyword edit action uses shared icon geometry');
assert.match(feature, /fp-ar-keyword-delete delete-keyword-btn/, 'keyword delete hook is preserved');

const attachmentBlock = popup.slice(popup.indexOf('function attachAutoReplyImageButtons('), popup.indexOf('\nfunction setupAccentPicker', popup.indexOf('function attachAutoReplyImageButtons(')));
assert.match(attachmentBlock, /fpt-ui-button fpt-ui-button--secondary fpt-ui-icon-button fp-ar-image-btn/, 'auto_reply attachment button uses shared button geometry');
assert.match(attachmentBlock, /setAttribute\('aria-label', 'Добавить изображение'\)/, 'attachment icon has an accessible name');
assert.match(attachmentBlock, /data-editor-actions-for="/, 'attachment control is inserted into the editor action host');
assert.doesNotMatch(attachmentBlock, /autoReplyPage[\s\S]*?material-symbols-rounded">image<\/span>/, 'auto_reply image control does not depend on Material ligature text');

for (const key of [
    'greetingEnabled','greetingText','onlyNewChats','ignoreSystemMessages','greetingCooldownDays',
    'newOrderReplyEnabled','newOrderReplyText','orderConfirmReplyEnabled','orderConfirmReplyText','keywordsEnabled'
]) {
    assert.ok(feature.includes(key) || misc.includes(key), 'saved field remains supported: ' + key);
}
assert.match(runtime, /settings\.greetingEnabled/);
assert.match(runtime, /settings\.newOrderReplyEnabled/);
assert.match(runtime, /settings\.orderConfirmReplyEnabled/);
assert.match(runtime, /settings\.keywordsEnabled/);

assert.match(css, /AUTO REPLY UI — TASK 04/, 'TASK 04 scoped CSS exists');
assert.match(css, /\.fp-ar-rule-body\[hidden\] \{ display:none !important; \}/, 'collapsed rules reserve no layout space');
assert.match(css, /\.fp-ar-number-input[\s\S]*?height:38px;[\s\S]*?min-height:0 !important;/, 'cooldown has compact fixed height');
assert.match(css, /\.fp-ar-image-btn[\s\S]*?width:40px;[\s\S]*?height:40px;/, 'attachment action has a stable hit area');

new Function(feature);
console.log('AUTO_REPLY_UI_CONTRACT_PASS');
