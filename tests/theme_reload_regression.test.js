const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('early theme loading preserves original, empty and legacy custom themes', async () => {
    for (const [saved, custom] of [[{ baseStyle: 'original' }, false], [{}, false], [{ bgColor1: '#123456' }, true]]) {
        const styles = new Map();
        const classes = new Set();
        const document = {
            documentElement: { classList: { toggle(key, on) { on ? classes.add(key) : classes.delete(key); } },
                appendChild(el) { styles.set(el.id, el); } },
            head: { appendChild(el) { styles.set(el.id, el); } },
            getElementById: id => styles.get(id),
            createElement: () => ({ remove() { styles.delete(this.id); } })
        };
        await vm.runInNewContext(fs.readFileSync(require.resolve('../content/theme_flash_fix.js'), 'utf8'), {
            document, console, requestAnimationFrame: fn => fn(),
            chrome: { storage: { local: { get: async () => ({ enableCustomTheme: true, fpToolsTheme: saved }) } } }
        });
        assert.equal(styles.has('fp-tools-custom-theme'), custom, JSON.stringify(saved));
        assert.equal(classes.has('fpt-custom-theme-on'), custom);
    }
});
