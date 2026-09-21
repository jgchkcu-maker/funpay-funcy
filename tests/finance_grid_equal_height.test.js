const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

assert.match(
    css,
    /\.fpt-fin-grid > \.fpt-fin-col-8[\s\S]*?display:\s*flex;[\s\S]*?align-self:\s*stretch;/,
    'Finance grid cells must stretch as flex containers'
);

assert.match(
    css,
    /\.fpt-fin-grid > \.fpt-fin-col-8 > \.fpt-fin-card[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;/,
    'Finance cards must fill the height of their stretched grid cell'
);

assert.match(
    css,
    /@container \(max-width: 480px\)[\s\S]*?\.fpt-fin-grid > \.fpt-fin-col-8 > \.fpt-fin-card[\s\S]*?height:\s*auto;/,
    'Stacked mobile cards must return to intrinsic height'
);

console.log('FINANCE_GRID_EQUAL_HEIGHT_PASS');
