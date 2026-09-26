const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const feature = fs.readFileSync(path.join(ROOT, 'content', 'features', 'auto_review.js'), 'utf8').replace(/\r\n/g, '\n');
const loader = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'settings_loader.js'), 'utf8').replace(/\r\n/g, '\n');
const misc = fs.readFileSync(path.join(ROOT, 'content', 'features', 'misc.js'), 'utf8').replace(/\r\n/g, '\n');
const runtime = fs.readFileSync(path.join(ROOT, 'background', 'autoresponder.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

const start = popup.indexOf('<div class="fp-tools-page-content" data-page="auto_review">');
const end = popup.indexOf('<div class="fp-tools-page-content" data-page="auto_reply">', start);
assert.ok(start >= 0 && end > start, 'auto_review page must exist');
const page = popup.slice(start, end);

assert.match(page, /class="fpt-ui-page-header fp-review-page-header"/, 'page uses TASK 00 page header');
assert.equal((page.match(/<details class="fp-review-template" data-rating="/g) || []).length, 5, 'five rating templates are compact disclosure rows');
for (let rating = 1; rating <= 5; rating++) {
    assert.match(page, new RegExp('id="fpt-review-' + rating + '" class="template-input fp-review-textarea"'), 'rating ' + rating + ' textarea id stays stable');
    assert.match(page, new RegExp('id="fpt-review-status-' + rating + '" class="fp-review-template-status">Не настроен</span>'), 'rating ' + rating + ' exposes configured status');
    assert.match(page, new RegExp('data-editor-actions-for="fpt-review-' + rating + '"'), 'rating ' + rating + ' has a shared attachment action host');
}
assert.doesNotMatch(page, /class="review-templates-grid"/, 'five large legacy cards are removed');
assert.doesNotMatch(page, /material-symbols-rounded">star/, 'rating and bonus stars do not depend on icon-font baseline');
assert.doesNotMatch(page, /vertical-align:\s*-2px/, 'bonus star baseline hack is removed');
assert.match(page, /id="bonusForReviewBody" class="fp-review-bonus-body" hidden/, 'bonus configuration is compact while disabled');
assert.match(page, /id="bonusModeSelector"/, 'existing bonus mode id stays stable');
assert.match(page, /id="singleBonusText" class="template-input fp-review-textarea"/, 'single bonus editor remains supported');
assert.match(page, /id="randomBonusContainer" class="fp-review-bonus-mode" hidden/, 'random list is progressively disclosed');
assert.match(page, /id="bonusForReviewDelaySec" class="fpt-ui-control fp-review-delay-input"/, 'delay uses a dedicated one-line field');
assert.doesNotMatch(page, /id="bonusForReviewDelaySec"[^>]*class="template-input"/, 'delay no longer inherits textarea height');

assert.match(feature, /function updateAutoReviewTemplateStatuses\(\)/, 'configured badges have a single updater');
assert.match(feature, /status\.textContent = configured \? 'Настроен' : 'Не настроен'/, 'rating status reflects actual content');
assert.match(feature, /body\.hidden = !enabled|bonusBody\.hidden = !enabled/, 'bonus body follows enable state');
assert.match(feature, /singleBonusContainer\.hidden = selectedMode !== 'single'/, 'single bonus mode uses hidden state');
assert.match(feature, /randomBonusContainer\.hidden = selectedMode !== 'random'/, 'random bonus mode uses hidden state');
assert.match(feature, /class="fpt-ui-state fp-review-bonus-empty"/, 'random bonus empty state is intentional');
assert.match(feature, /fpt-ui-button fpt-ui-button--tertiary fp-review-bonus-delete delete-bonus-btn/, 'delete hook remains while using shared button geometry');

assert.match(loader, /updateAutoReviewTemplateStatuses\(\)/, 'restored review images refresh configured status');
for (const rating of ['5','4','3','2','1']) {
    assert.match(loader, new RegExp("restoreImgs\\('fpt-review-" + rating + "'"), 'saved review image restore remains for rating ' + rating);
}

const attachmentStart = popup.indexOf('function attachAutoReplyImageButtons(');
const attachmentEnd = popup.indexOf('\nfunction setupAccentPicker', attachmentStart);
const attachmentBlock = popup.slice(attachmentStart, attachmentEnd);
assert.match(attachmentBlock, /fp-review-image-btn fpt-autoreply-img-btn/, 'review attachment actions use dedicated shared geometry');
assert.match(attachmentBlock, /autoReviewPage\.querySelector\('\[data-editor-actions-for="/, 'review attachment actions are placed beside their editors');
const reviewBranchStart = attachmentBlock.indexOf('} else if (autoReviewPage) {');
const reviewBranchEnd = attachmentBlock.indexOf('} else {', reviewBranchStart);
assert.ok(reviewBranchStart >= 0 && reviewBranchEnd > reviewBranchStart, 'review attachment branch is explicit');
const reviewBranch = attachmentBlock.slice(reviewBranchStart, reviewBranchEnd);
assert.match(reviewBranch, /<svg viewBox="0 0 24 24"/, 'review attachment uses inline SVG');
assert.doesNotMatch(reviewBranch, /material-symbols-rounded/, 'review attachment does not rely on Material ligature');

for (const key of ['autoReviewEnabled','bonusForReviewEnabled','bonusMode','singleBonusText','randomBonuses','bonusForReviewDelaySec']) {
    assert.ok(feature.includes(key) || misc.includes(key), 'saved field remains supported: ' + key);
}
assert.match(runtime, /settings\.autoReviewEnabled/);
assert.match(runtime, /settings\.bonusForReviewEnabled/);

assert.match(css, /AUTO REVIEW UI — TASK 05/, 'TASK 05 CSS exists');
assert.match(css, /\.fp-review-stars[\s\S]*?line-height:1;/, 'stars have a fixed glyph line-height');
assert.match(css, /\.fp-review-image-btn[\s\S]*?width:40px;[\s\S]*?height:40px;/, 'review attachment hit area matches other auto reply editors');
assert.match(css, /\.fp-review-delay-input[\s\S]*?height:40px;[\s\S]*?min-height:0 !important;/, 'delay control stays one-line and compact');
assert.match(css, /\.fp-review-bonus-body\[hidden\],[\s\S]*?display:none !important;/, 'hidden bonus configuration reserves no space');

new Function(feature);
console.log('AUTO_REVIEW_UI_CONTRACT_PASS');
