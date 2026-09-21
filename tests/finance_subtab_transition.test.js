const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

assert.match(popup, /let paneTransitionTimer = null;/, 'Finance tab switching must track the pending content transition');
assert.match(popup, /currentPane\.classList\.add\('is-leaving'\)/, 'outgoing Finance pane must get a leaving state');
assert.match(popup, /targetPane\.classList\.add\('is-entering'\)/, 'incoming Finance pane must start from an entering state');
assert.match(popup, /setTimeout\(\(\) => \{[\s\S]*?activateTargetPane\(\);[\s\S]*?\}, 90\)/, 'outgoing fade should remain short and responsive');
assert.match(popup, /prefers-reduced-motion: reduce/, 'Finance switch logic must respect reduced motion');
assert.match(popup, /onSubtabChange\(target, prevSubtab\)/, 'data rendering must still start on every tab switch');

assert.match(css, /\.fpt-fin-tab-pane\.active\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?transition:[\s\S]*?opacity 180ms/, 'active pane must fade in');
assert.match(css, /\.fpt-fin-tab-pane\.active\.is-leaving\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?opacity 90ms/, 'outgoing pane must fade out');
assert.match(css, /\.fpt-fin-tab-pane\.active\.is-entering\s*\{[\s\S]*?opacity:\s*0;/, 'incoming pane must begin transparent');
assert.match(css, /translate3d\(0, 6px, 0\)/, 'incoming pane uses a subtle vertical ease');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.fpt-fin-tab-pane\.active/, 'CSS must disable visible motion for reduced-motion users');

new Function(popup);
console.log('FINANCE_SUBTAB_TRANSITION_PASS');
