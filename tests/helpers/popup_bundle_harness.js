const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
// UI fixtures deliberately preload the lazy package. Actual first-click
// injection is covered separately by popup_lazy_load_browser.test.js.
function withPopupBundle(manifest) {
    const value = structuredClone(manifest);
    const content = value.content_scripts.find(script => script.js?.includes('content/content_script.js'));
    const bundle = JSON.parse(fs.readFileSync(path.join(root, 'background/popup_bundle.json'), 'utf8'));
    content.js = [...new Set([...content.js, ...bundle.js])];
    content.css = [...new Set([...content.css, ...bundle.css])];
    return value;
}
module.exports = { withPopupBundle };
