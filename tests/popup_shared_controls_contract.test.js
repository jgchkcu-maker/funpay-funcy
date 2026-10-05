const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const components = fs.readFileSync(path.join(root, 'content/ui/popup_components.js'), 'utf8');
const contentScript = fs.readFileSync(path.join(root, 'content/content_script.js'), 'utf8');
const themeStyles = fs.readFileSync(path.join(root, 'css/fpt_icons_theme.css'), 'utf8');
const categoryStyles = fs.readFileSync(path.join(root, 'css/popup_categories.css'), 'utf8');

function expectPattern(source, pattern, message) {
    assert.ok(pattern.test(source), message);
}

test('popup controls are normalized at the shared popup boundary', () => {
    expectPattern(components, /function createCheckboxControl\(/, 'shared checkbox component is available');
    expectPattern(components, /function ensureCategoryHeader\(/, 'existing page headers can be reused by the shell');
    expectPattern(components, /function observePopupControls\(/, 'popup controls get normalized dynamically');
    expectPattern(components, /ensureCategoryHeader,\s*createCheckboxControl,\s*observePopupControls/, 'helpers are exported internally');
    expectPattern(contentScript, /FPTPopupUI\.observePopupControls\(toolsPopup\)/, 'normalization starts for the whole popup');
});

test('shared control styles and normalization stay inside the extension popup', () => {
    const controlRules = [...themeStyles.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .map(([, selector]) => selector.trim())
        .filter(selector => /\.fpt-control-field|\.fpt-checkbox-(?:control|indicator)/.test(selector));
    assert.ok(controlRules.length > 0, 'shared control rules are present');
    controlRules.forEach(selector => {
        assert.match(selector, /\.fp-tools-popup/, `control rule escaped popup scope: ${selector}`);
    });
    expectPattern(components, /const container = popup\.closest\?\.\('\.fp-tools-popup'\) \|\| popup;[\s\S]*?observer\.observe\(container/, 'dynamic normalization observes the popup only');
});

test('checkbox marks are centered beside their native accessible inputs', () => {
    expectPattern(themeStyles, /\.fpt-checkbox-control input\[type="checkbox"\]:checked\s*\+\s*\.fpt-checkbox-indicator/, 'checked input controls the adjacent mark');
    expectPattern(themeStyles, /\.fpt-checkbox-indicator::after/, 'mark is drawn by the indicator');
    assert.ok(!/input\[type="checkbox"\]::after/.test(themeStyles), 'the checkbox input has no floating pseudo-mark');
    expectPattern(themeStyles, /\.fpt-checkbox-control[\s\S]*?width:\s*19px[\s\S]*?height:\s*19px/, 'checkbox square has fixed geometry');
    expectPattern(themeStyles, /\.fpt-checkbox-label[\s\S]*?gap:\s*8px/, 'label and checkbox share a fixed gap');
});

test('popup fields share fixed geometry and price fields use the same control class', () => {
    expectPattern(themeStyles, /\.fpt-control-field[\s\S]*?height:\s*40px/, 'standard fields are 40px tall');
    expectPattern(themeStyles, /\.fpt-control-field[\s\S]*?border-radius:\s*10px/, 'standard fields share their corner radius');
    expectPattern(themeStyles, /\.fpt-control-field\[data-control-kind="textarea"\][\s\S]*?height:\s*76px[\s\S]*?resize:\s*none/, 'text areas have fixed size');
    expectPattern(components, /field\.dataset\.controlKind = kind/, 'normalization marks each field kind');
    expectPattern(components, /\? 'textarea'/, 'text areas receive their fixed-height variant');
});

test('popup fields and buttons use one focus indicator without stacked outlines and shadows', () => {
    const fieldFocus = themeStyles.match(/\.fp-tools-popup\.fptm-themed \.fpt-control-field:focus-visible\s*\{([^}]+)\}/)?.[1] || '';
    assert.match(fieldFocus, /border-color:\s*var\(--fptm-accent/);
    assert.match(fieldFocus, /outline:\s*none/);
    assert.match(fieldFocus, /box-shadow:\s*none/);
    assert.doesNotMatch(categoryStyles, /\.fpt-lot-dialog (?:input|select|textarea):focus-visible/,
        'dialog fields should not receive an extra focus outline');
    const buttonFocus = themeStyles.match(/\.fp-tools-popup\.fptm-themed :is\(\.fp-tools-content, \[role="dialog"\], \[aria-modal="true"\]\) :is\(button, input\[type="button"\], input\[type="submit"\]\):focus-visible\s*\{([^}]+)\}/)?.[1] || '';
    assert.match(buttonFocus, /outline:\s*2px solid/);
    assert.match(buttonFocus, /box-shadow:\s*none/);
});

test('popup buttons and selectable rows have clear press states with reduced motion support', () => {
    expectPattern(themeStyles, /\.fp-tools-content[\s\S]*?:active/, 'category buttons get press feedback');
    expectPattern(themeStyles, /prefers-reduced-motion:\s*reduce/, 'motion is reduced when requested');
});
