const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(process.argv[2] || 'dist/staging');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const errors = [];
const files = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else files.push(full); } }
walk(root);
function requireFile(file, from) {
    if (/[${}*]/.test(file)) return;
    const target = path.resolve(root, file);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) errors.push(`Missing resource: ${file} (${from})`);
}
requireFile(manifest.background.service_worker, 'service worker');
requireFile(manifest.action.default_popup, 'popup');
for (const file of Object.values(manifest.icons)) requireFile(file, 'icons');
for (const entry of manifest.content_scripts) for (const file of [...(entry.js || []), ...(entry.css || [])]) requireFile(file, 'content_scripts');
for (const entry of manifest.web_accessible_resources) for (const file of entry.resources) {
    if (file.includes('*')) {
        const prefix = file.split('*')[0];
        if (!files.some(f => path.relative(root, f).replaceAll('\\', '/').startsWith(prefix))) errors.push(`Empty resource pattern: ${file}`);
    } else requireFile(file, 'web_accessible_resources');
}
const forbidden = [/fptools\.onrender\.com/i, /fptools-ai-server\.vercel\.app/i, /fpt-descs\.starobinskiy01\.workers\.dev/i, /SHARED_KEY\s*=/, /(?:sk-proj-|AIza)[A-Za-z0-9_-]{20,}/];
for (const full of files) {
    const relative = path.relative(root, full).replaceAll('\\', '/');
    if (/^(tests|docs|artifacts|tools|\.git|dist)\//.test(relative) || relative === 'config.v1.json') errors.push(`Non-runtime file: ${relative}`);
    if (!/\.(js|mjs|css|html|json)$/.test(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    if (forbidden.some(pattern => pattern.test(text))) errors.push(`Retired endpoint or credential pattern in ${relative}`);
    if (/\.(?:m?js)$/.test(full)) {
        // Parse explicitly as ESM/classic; no dependence on Node's newer .js autodetection.
        const module = relative.startsWith('background/') && /\b(?:import|export)\s/.test(text);
        const syntax = spawnSync(process.execPath, [`--input-type=${module ? 'module' : 'commonjs'}`, '--check'], { input: text, encoding: 'utf8' });
        if (syntax.status !== 0) errors.push(`Invalid JavaScript: ${relative}`);
        for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.\.?\/[^'"]+)['"]/g)) requireFile(path.relative(root, path.resolve(path.dirname(full), match[1])), relative);
        for (const match of text.matchAll(/(?:runtime\.getURL|importScripts)\(\s*['"]([^'"]+)['"]/g)) requireFile(match[1], relative);
        if (/(?:import\s*\(|importScripts\s*\()\s*['"]https?:|<script[^>]+src=['"]https?:/i.test(text)) errors.push(`Remote executable import: ${relative}`);
    }
    if (/\.html$/.test(full)) {
        if (/<script[^>]+src=['"]https?:/i.test(text)) errors.push(`Remote script in ${relative}`);
        for (const match of text.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)) {
            if (!/^(?:https?:|data:|javascript:)/i.test(match[1])) requireFile(path.relative(root, path.resolve(path.dirname(full), match[1])), relative);
        }
    }
    if (/\.css$/.test(full)) for (const match of text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) {
        if (!/^(https?:|data:|#|chrome-extension:|\/)/.test(match[1])) requireFile(path.relative(root, path.resolve(path.dirname(full), match[1])), relative);
    }
}
if (manifest.permissions.some(p => ['tabs', 'background'].includes(p))) errors.push('Unnecessary permission restored');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Staged package validated: ${files.length} files, version ${manifest.version}.`);
