const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const runtimeFiles = [
    'manifest.json',
    'content/content_script.js',
    'content/ui/main_popup.js',
    'background/ai.js'
];

const banned = [
    'initializeAILotAudit',
    'ai_lot_audit',
    'ai_audit',
    'lot_audit',
    'fp-audit',
    'Аудит магазина',
    'ИИ-аудит'
];

for (const relativePath of runtimeFiles) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    for (const token of banned) {
        assert.ok(
            !source.includes(token),
            relativePath + ' must not reference removed store-audit token: ' + token
        );
    }
}

assert.ok(
    !fs.existsSync(path.join(ROOT, 'content', 'features', 'ai_lot_audit.js')),
    'removed store-audit module must stay deleted'
);

console.log('STORE_AUDIT_REMOVAL_RUNTIME_PASS');
