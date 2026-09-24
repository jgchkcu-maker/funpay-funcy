const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('theme contrast utilities exist and maintain readability standards', () => {
    const themeJs = read('content/features/theme.js');
    const flashFixJs = read('content/theme_flash_fix.js');
    const galleryJs = read('content/features/theme_gallery.js');

    // Both runtime theme injector and document_start flash fix have contrast functions
    assert.match(themeJs, /function fptEnsureReadableColor/);
    assert.match(themeJs, /function fptEnsureButtonColor/);
    assert.match(themeJs, /function fptSanitizeThemeColors/);

    assert.match(flashFixJs, /function fptEnsureReadableColor/);
    assert.match(flashFixJs, /function fptEnsureButtonColor/);

    // Gallery sanitizes theme colors before storing
    assert.match(galleryJs, /fptSanitizeThemeColors/);

    // CSS contains improved game title shadows and glowing hover effects
    assert.match(themeJs, /\.game-title a \{ color: #ACCENT_COLOR#; text-decoration: none; font-weight: 600;/);
    assert.match(themeJs, /text-shadow: 0 1px 3px rgba\(0, 0, 0, 0\.85\)/);
    assert.match(themeJs, /\.game-title a:hover \{ color: #ACCENT_HOVER#; text-decoration: none; text-shadow: 0 0 14px #ACCENT_GLOW#/);

    // Alphabet index has clear contrast
    assert.match(themeJs, /\.nav-abc \.nav>li>a \{ color: rgba\(255, 255, 255, 0\.65\) !important;/);
    assert.match(themeJs, /\.list-inline>li>a \{ color: #LINK_COLOR#;/);
});

test('contrast calculation algorithm lifts problematic theme colors above WCAG AA standard', () => {
    // Extract functions from theme.js
    const themeJs = read('content/features/theme.js');
    const fnCode = themeJs.slice(
        themeJs.indexOf('function fptHexToRgb'),
        themeJs.indexOf('function getCustomThemeCss')
    );

    const sandbox = {};
    const runner = new Function(fnCode + '; return { fptEnsureReadableColor, fptEnsureButtonColor, fptContrastRatio, fptRelLuminance, fptHexToRgb };');
    const { fptEnsureReadableColor, fptEnsureButtonColor, fptContrastRatio, fptRelLuminance, fptHexToRgb } = runner();

    const bgLum = 0.012; // FunPay content container background luminance

    // Case 1: Ender World (theme-3) - Accent was #3c3c8b (contrast 1.8:1), link was #202040 (contrast 1.1:1)
    const fixedEnderAccent = fptEnsureReadableColor('#3c3c8b', { minContrast: 5.0, targetLightness: 76 });
    const fixedEnderLink = fptEnsureReadableColor('#202040', { minContrast: 4.5, targetLightness: 68 });

    const enderAccentCr = fptContrastRatio(fptRelLuminance(fptHexToRgb(fixedEnderAccent)), bgLum);
    const enderLinkCr = fptContrastRatio(fptRelLuminance(fptHexToRgb(fixedEnderLink)), bgLum);

    assert.ok(enderAccentCr >= 5.0, `Ender accent CR should be >= 5.0, got ${enderAccentCr.toFixed(2)}`);
    assert.ok(enderLinkCr >= 4.5, `Ender link CR should be >= 4.5, got ${enderLinkCr.toFixed(2)}`);

    // Case 2: Breakcore - pitch black accent #010100 (contrast 1.0:1)
    const fixedBreakcoreAccent = fptEnsureReadableColor('#010100', { minContrast: 5.0, targetLightness: 76 });
    const breakcoreCr = fptContrastRatio(fptRelLuminance(fptHexToRgb(fixedBreakcoreAccent)), bgLum);
    assert.ok(breakcoreCr >= 5.0, `Breakcore accent CR should be >= 5.0, got ${breakcoreCr.toFixed(2)}`);

    // Case 3: Already contrasting color (e.g. #ffffff) should remain intact
    const untouched = fptEnsureReadableColor('#ffffff', { minContrast: 4.5, targetLightness: 68 });
    assert.equal(untouched, '#ffffff');
});
