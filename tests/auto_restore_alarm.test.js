const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const backgroundSource = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf8');
const alarmModuleUrl = pathToFileURL(path.join(__dirname, '../background/auto_restore_alarm.js')).href;

test('warehouse rules start the shared five-minute alarm and both off rules clear it', async () => {
    const { AUTO_RESTORE_ALARM_NAME, syncAutoRestoreAlarm } = await import(alarmModuleUrl);
    const calls = [];
    const alarms = {
        create(...args) { calls.push(['create', ...args]); },
        clear(...args) { calls.push(['clear', ...args]); }
    };

    assert.equal(syncAutoRestoreAlarm(alarms, true, false), true);
    assert.equal(syncAutoRestoreAlarm(alarms, false, true), true);
    assert.equal(syncAutoRestoreAlarm(alarms, false, false), false);
    assert.deepEqual(calls, [
        ['create', AUTO_RESTORE_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 5 }],
        ['create', AUTO_RESTORE_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 5 }],
        ['clear', AUTO_RESTORE_ALARM_NAME]
    ]);
});

test('startup and live settings changes both resynchronize the warehouse alarm', () => {
    assert.match(backgroundSource, /'fpToolsAutoRestoreEnabled',\s*'fpToolsAutoDisableEnabled'/);
    assert.match(backgroundSource, /if \(changes\.fpToolsAutoRestoreEnabled \|\| changes\.fpToolsAutoDisableEnabled\)/);
    assert.equal((backgroundSource.match(/syncAutoRestoreAlarm\(chrome\.alarms,/g) || []).length, 2);
});
