const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

assert.match(
    css,
    /\.fpt-fin-grid > \.fpt-fin-col-8[\s\S]*?align-self:\s*stretch;[\s\S]*?width:\s*100%;/,
    'Finance grid cells must stretch to the full grid track width'
);

assert.doesNotMatch(
    css,
    /\.fpt-fin-grid > \.fpt-fin-col-12[^\{]*\{[^}]*display:\s*flex;/,
    'Full-width grid cells must not become flex rows because some contain toolbar + card'
);

assert.match(
    css,
    /\.fpt-fin-grid > \.fpt-fin-col-8 > \.fpt-fin-card:only-child[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/,
    'A sole card must fill its stretched grid cell for equal-height rows'
);

assert.match(
    css,
    /\.fpt-fin-grid > \.fpt-fin-col-12 > \.fpt-fin-card:not\(:only-child\)[\s\S]*?width:\s*100%;[\s\S]*?height:\s*auto;/,
    'A card sharing a full-width cell with filters/toolbars must stay full-width and stack vertically'
);

assert.match(
    css,
    /@container \(max-width: 480px\)[\s\S]*?\.fpt-fin-grid > \.fpt-fin-col-8 > \.fpt-fin-card:only-child[\s\S]*?height:\s*auto;/,
    'Stacked mobile cards must return to intrinsic height'
);

console.log('FINANCE_GRID_EQUAL_HEIGHT_PASS');
