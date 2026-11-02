const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('heartbeat handles a failed automation pass and still runs recovery', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf8').replace(/\r\n/g, '\n');
    const start = source.indexOf('chrome.alarms.onAlarm.addListener(async (alarm) => {');
    const end = source.indexOf('\n\n// Plain text typed', start);
    assert.ok(start >= 0 && end > start, 'alarm listener is present');
    let listener;
    let passes = 0;
    let recoveries = 0;
    const warnings = [];
    const context = {
        chrome: { alarms: { onAlarm: { addListener: fn => { listener = fn; } } } },
        jobScheduler: { handleAlarm: async () => false, runRecovery: async () => { recoveries++; } },
        BUMP_ALARM_NAME: 'bump', AUTO_RESPONDER_ALARM_NAME: 'autoresponder',
        ENGINE_HEARTBEAT_ALARM: 'heartbeat', ENGINE_CONTINUE_ALARM: 'continue',
        onHeartbeat: async () => { passes++; if (passes === 1) throw new Error('HTTP 502'); },
        runScheduledBump: async () => {}, runAutomationPass: async () => {},
        console: { warn: (...args) => warnings.push(args) }
    };
    vm.runInNewContext(source.slice(start, end), context);
    await listener({ name: 'heartbeat' });
    assert.equal(recoveries, 1);
    assert.match(warnings[0].join(' '), /HTTP 502/);
    await listener({ name: 'heartbeat' });
    assert.equal(passes, 2);
    assert.equal(recoveries, 2);
});
