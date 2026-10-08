const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '../background/lot_schedule_rules.js')).href);

test('rules are validated: zone, time format, equal bounds are not all day', async () => {
    const r = await load();
    assert.deepEqual(r.validateScheduleRule({ timezone: 'Asia/Krasnoyarsk', windows: [{ day: 'mon', start: '09:00', end: '18:00' }] }), []);
    assert.equal(r.validateScheduleRule({ timezone: 'Mars/Base', windows: [] }).length, 1);
    assert.match(r.validateScheduleRule({ timezone: 'UTC', windows: [{ day: 'mon', start: '10:00', end: '10:00' }] })[0], /круглых суток/);
    assert.equal(r.validateScheduleRule({ timezone: 'UTC', windows: [{ day: 'mon', start: '25:00', end: '26:00' }] }).length, 1);
    assert.deepEqual(r.validateScheduleRule({ timezone: 'UTC', windows: [{ day: 'mon', start: '00:00', end: '24:00' }] }), []);
});

test('overnight windows split at midnight, Sunday wraps to Monday, overlaps merge', async () => {
    const r = await load();
    assert.deepEqual(r.normalizeWindows([{ day: 'fri', start: '22:00', end: '02:00' }]), [[4 * 1440 + 1320, 5 * 1440], [5 * 1440, 5 * 1440 + 120]].reduce((acc, seg) => {
        const last = acc[acc.length - 1];
        if (last && seg[0] <= last[1]) last[1] = seg[1]; else acc.push(seg);
        return acc;
    }, []));
    assert.deepEqual(r.normalizeWindows([{ day: 'sun', start: '23:00', end: '01:00' }]), [[0, 60], [6 * 1440 + 1380, 7 * 1440]]);
    assert.deepEqual(r.normalizeWindows([{ day: 'mon', start: '09:00', end: '12:00' }, { day: 'mon', start: '11:00', end: '14:00' }]), [[540, 840]]);
    assert.deepEqual(r.normalizeWindows([]), [], 'no windows means always closed');
});

test('membership uses the saved zone, not the computer clock', async () => {
    const r = await load();
    const rule = { timezone: 'Asia/Krasnoyarsk', windows: [{ day: 'fri', start: '22:00', end: '02:00' }] };
    // 2026-10-09 is a Friday. Krasnoyarsk is UTC+7: 22:30 local = 15:30Z.
    assert.equal(r.isScheduleOpen(rule, Date.UTC(2026, 9, 9, 15, 30)), true);
    assert.equal(r.isScheduleOpen(rule, Date.UTC(2026, 9, 9, 18, 59)), true, 'Saturday 01:59 local is still open');
    assert.equal(r.isScheduleOpen(rule, Date.UTC(2026, 9, 9, 19, 0)), false, 'the end is exclusive');
    assert.equal(r.isScheduleOpen(rule, Date.UTC(2026, 9, 9, 14, 59)), false, 'the start is inclusive');
    const transitions = r.scheduleTransitions(rule, Date.UTC(2026, 9, 9, 12, 0));
    assert.deepEqual(transitions.map(t => [new Date(t.at).toISOString(), t.open, t.local.offset]), [
        ['2026-10-09T15:00:00.000Z', true, 'UTC+7'],
        ['2026-10-09T19:00:00.000Z', false, 'UTC+7']
    ]);
});

test('DST gap and fold follow wall-clock semantics', async () => {
    const r = await load();
    // New York 2026-03-08: 02:00–02:59 does not exist. Window 02:00–03:30 opens at 03:00 EDT (07:00Z).
    const gap = { timezone: 'America/New_York', windows: [{ day: 'sun', start: '02:00', end: '03:30' }] };
    const [opened] = r.scheduleTransitions(gap, Date.UTC(2026, 2, 8, 5, 0), { limit: 1 });
    assert.equal(new Date(opened.at).toISOString(), '2026-03-08T07:00:00.000Z');
    assert.equal(opened.local.time, '03:00');
    // 2026-11-01: 01:00–01:59 happens twice. Window 01:30–02:00 opens twice.
    const fold = { timezone: 'America/New_York', windows: [{ day: 'sun', start: '01:30', end: '02:00' }] };
    const transitions = r.scheduleTransitions(fold, Date.UTC(2026, 10, 1, 4, 0), { limit: 4 });
    assert.deepEqual(transitions.map(t => [t.open, t.local.time, t.local.offset]), [
        [true, '01:30', 'UTC-4'], [false, '01:00', 'UTC-5'], [true, '01:30', 'UTC-5'], [false, '02:00', 'UTC-5']
    ]);
});

test('the next check is the nearest change within a day, else a control check in 24 hours', async () => {
    const r = await load();
    const from = Date.UTC(2026, 9, 5, 0, 0);
    const daily = { timezone: 'UTC', windows: ['mon', 'tue'].map(day => ({ day, start: '10:00', end: '11:00' })) };
    assert.equal(r.nextScheduleCheck([daily], from), Date.UTC(2026, 9, 5, 10, 0));
    const weekly = { timezone: 'UTC', windows: [{ day: 'sun', start: '10:00', end: '11:00' }] };
    assert.equal(r.nextScheduleCheck([weekly], from), from + 24 * 3600 * 1000);
    assert.equal(r.describeWindow({ day: 'fri', start: '22:00', end: '02:00' }), 'Пт 22:00–02:00');
});
