const test = require('node:test');
const assert = require('node:assert/strict');
const safe = require('../content/safe_values.js');

test('URLs and fonts cannot introduce executable schemes or CSS', () => {
    for (const url of ['javascript:alert(1)', 'http://funpay.com/', 'https://funpay.com.evil/', 'https://evil@funpay.com/', 'https://funpay.com:444/']) assert.equal(safe.funpayUrl(url), '');
    assert.equal(safe.funpayUrl('https://funpay.com/lots/offer?id=123'), 'https://funpay.com/lots/offer?id=123');
    assert.equal(safe.fontName("x');}"), '');
    assert.equal(safe.fontName('Шрифт 123'), 'Шрифт 123');
    assert.equal(safe.cssNumber('1px}body{display:none', 12, 24, 14), 14);
    assert.equal(safe.cssNumber(100, 12, 24, 14), 24);
    assert.equal(safe.cssNumber(null, 12, 24, 14), 14);
});

test('image URLs remain quoted and declarations reject escapes and rule breaks', () => {
    assert.equal(safe.cssImageUrl('data:image/png;base64,AAAA'), 'url("data:image/png;base64,AAAA")');
    for (const input of ['javascript:alert(1)', 'data:image/svg+xml,<svg>', 'https://a/<style>', 'https://a/\n']) assert.equal(safe.cssImageUrl(input), '');
    assert.equal(safe.cssImageUrl('https://a/x")body{color:red}'), 'url("https://a/x\\")body{color:red}")');
    assert.equal(safe.cssDeclarations({ 'body{': { color: 'red' }, body: { color: 'red;}body{display:none', background: 'u\\rl(x)', width: 'expression(1)', height: 'url (x)' } }), '');
    assert.equal(safe.cssDeclarations({ '.safe': { color: 'red', padding: '2px', background: 'url(x)' } }), '.safe {\n  color: red !important;\n  padding: 2px !important;\n}\n');
});

test('CSV neutralizes formulas, including arithmetic, while keeping signed amounts', () => {
    assert.equal(safe.csvCell('=1+1'), "'=1+1");
    assert.equal(safe.csvCell('+1+1'), "'+1+1");
    assert.equal(safe.csvCell('-1+1'), "'-1+1");
    assert.equal(safe.csvCell(' @SUM(A1)'), "' @SUM(A1)");
    assert.equal(safe.csvCell('\t=1'), "'\t=1");
    assert.equal(safe.csvCell('-150,00'), '"-150,00"');
    assert.equal(safe.csvCell(-150), '-150');
    assert.equal(safe.csvCell('hello "world"'), '"hello ""world"""');
});

test('theme numbers and colors cannot introduce CSS rules through sibling fields', () => {
    const clean = safe.themeSettings({ borderRadius: '0px;}body{display:none', bgBlur: '0);}', scrollbarWidth: '1;}html{',
        scrollbarThumbColor: 'red;}body{display:none', textColor: 'url(https://evil)', containerBgOpacity: -5,
        bgColor1: 'abc', font: 'Roboto', bgImage: 'https://example.com/wallpaper.jpg' });
    assert.equal(clean.borderRadius, 8); assert.equal(clean.bgBlur, 0); assert.equal(clean.scrollbarWidth, 8);
    assert.equal(clean.scrollbarThumbColor, '#555555'); assert.equal(clean.textColor, '#f0f0f0');
    assert.equal(clean.containerBgOpacity, 0); assert.equal(clean.bgColor1, '#abc'); assert.equal(clean.font, 'Roboto');
});

test('live CSS supports HTTPS images and shorthands while rejecting URL parser escapes', () => {
    assert.equal(safe.cssDeclarations({ '.image': { background: 'url(https://example.com/bg.png) center / cover no-repeat',
        'background-image': "URL('https://example.com/a.png'), url(\"https://example.com/b.png\")" } }),
        '.image {\n  background: url("https://example.com/bg.png") center / cover no-repeat !important;\n  background-image: url("https://example.com/a.png"), url("https://example.com/b.png") !important;\n}\n');
    for (const value of ['url(javascript:alert(1))', 'url(http://example.com/x)', 'url(data:image/png;base64,AAAA)',
        'url(https://example.com/x); color:red', 'url("https://example.com/x") } body { display:none',
        'url("https://example.com/x\\") } body { display:none', 'u\\rl(https://example.com/x)',
        'url("https://example.com/a"), url(http://example.com/b)', 'url(https://example.com/a) @import "x"',
        'url /*comment*/ (https://example.com/a)', 'url("https://example.com/a\n")']) {
        assert.equal(safe.cssDeclarations({ body: { background: value } }), '', value);
    }
    assert.ok(safe.cssDeclarations({ body: { background: 'url("https://example.com/a;{}")' } }).includes('url("https://example.com/a;{}")'));
    for (const content of [`"url('https://example.test/a; } body { color:red; /*')"`,
        `'url("https://example.test/a; } body { color:red; /*")'`]) {
        assert.equal(safe.cssDeclarations({ '.target': { content } }), '');
    }
    assert.equal(safe.cssDeclarations({ '.target': { content: '"ordinary text"' } }), '.target {\n  content: "ordinary text" !important;\n}\n');
});
