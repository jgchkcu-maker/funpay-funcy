const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../content/ui/main_popup.js'), 'utf8');
test('central navigation keeps active aliases and excludes retired financial pages', () => {
assert.match(source, /registerPopupRouteAlias\('slash_commands'/);
assert.doesNotMatch(source, /registerPopupRouteAlias\(['"]currency_calc['"]/);
assert.doesNotMatch(source, /data-page=["'](?:piggy_banks|calculator)["']/);
assert.doesNotMatch(source, /(?:piggy_banks|calculator):\s*\[/);
for (const api of ['fptOpenPopupPage', 'fptSetPopupPageMode', 'fptRegisterPopupRouteAlias', 'fptRegisterPopupPageModeHandler']) assert.ok(source.includes(api));
assert.doesNotMatch(source, /initializeAutoReplyUI|setupQuickRepliesUI|setupFinanceHubUI/);
});
