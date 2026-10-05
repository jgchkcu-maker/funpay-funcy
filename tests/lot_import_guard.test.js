const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const background = fs.readFileSync(path.join(root, 'background/background.js'), 'utf8');
const start = background.indexOf("if (request.action === 'startLotImport') {");
const end = background.indexOf("if (request.action === 'resumeLotImport')", start);
assert.ok(start >= 0 && end > start, 'startLotImport listener branch must exist');
const startHandlerSource = background.slice(start, end);

test('startLotImport rejects duplicate concurrent and already-active imports', async () => {
    const stored = {};
    let persistedStarts = 0;
    let processRuns = 0;
    const sandbox = {
        IMPORT_PROCESS_KEY: 'fpToolsLotImportProcess',
        _lotImportStartInFlight: false,
        Date,
        processNextLotImport() { processRuns++; },
        chrome: {
            storage: { local: {
                async get(key) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    return { [key]: stored[key] };
                },
                async set(patch) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                    Object.assign(stored, patch);
                    persistedStarts++;
                }
            } }
        }
    };
    const handler = vm.runInNewContext(`(request, sendResponse) => { ${startHandlerSource} return false; }`, sandbox);
    const dispatch = fileName => new Promise(resolve => {
        const request = { action: 'startLotImport', fileName, lots: [{ title: fileName }] };
        handler(request, resolve);
    });

    const [first, second] = await Promise.all([dispatch('first.json'), dispatch('second.json')]);
    assert.equal(first.success, true);
    assert.equal(second.success, false);
    assert.match(second.error, /уже/iu);
    assert.equal(persistedStarts, 1);
    assert.equal(processRuns, 1);
    assert.equal(stored.fpToolsLotImportProcess.name, 'first.json');

    const alreadyActive = await dispatch('third.json');
    assert.equal(alreadyActive.success, false);
    assert.match(alreadyActive.error, /уже/iu);
    assert.equal(persistedStarts, 1);
});
