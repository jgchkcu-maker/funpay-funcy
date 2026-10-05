const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../content/ui/quick_replies_page.js'), 'utf8'), context);
const api = context.window.FPTQuickRepliesPage;
const plain = value => JSON.parse(JSON.stringify(value));

test('templates normalize to the chat runtime defaults without inventing custom entries', () => {
    const settings = api.normalizeTemplates(undefined);
    assert.equal(settings.enabled, true);
    assert.equal(settings.sendTemplatesImmediately, true);
    assert.deepEqual(plain(settings.items.map(item => item.key)), ['greeting', 'completed', 'review', 'thanks']);
    assert.ok(settings.items.every(item => !item.custom && item.enabled && !item.modified && item.sendOrder === 'text_first'));
});

test('stored templates override defaults, keep custom order and drop malformed entries', () => {
    const settings = api.normalizeTemplates({
        enabled: false, sendTemplatesImmediately: false,
        standard: { greeting: { enabled: false, text: 'Привет, {buyername}!' }, thanks: { images: ['data:a', 7, ''] } },
        custom: [{ id: 12, label: 'Инструкция', text: 'Шаг 1', sendOrder: 'image_first' }, null, { label: 'без id' }, { id: '13' }]
    });
    assert.equal(settings.enabled, false);
    assert.equal(settings.sendTemplatesImmediately, false);
    const [greeting, , , thanks, first, second] = settings.items;
    assert.equal(greeting.enabled, false);
    assert.equal(greeting.label, 'Приветствие');
    assert.equal(greeting.modified, true);
    assert.deepEqual(plain(thanks.images), ['data:a']);
    assert.equal(thanks.modified, true);
    assert.equal(settings.items.length, 6);
    assert.deepEqual(plain(first), { key: '12', custom: true, enabled: true, label: 'Инструкция', text: 'Шаг 1', images: [], sendOrder: 'image_first', modified: false });
    assert.equal(second.label, 'Без названия');
});

test('commands normalize options and keep legacy entries without ids', () => {
    assert.deepEqual(plain(api.normalizeCommands(null)), { enabled: true, autocomplete: true, expandKey: 'both', commands: [] });
    const settings = api.normalizeCommands({ enabled: false, autocomplete: false, expandKey: 'space',
        commands: [{ id: 5, trigger: '/hi', response: 'Привет' }, { trigger: '/old' }, 'broken'] });
    assert.equal(settings.enabled, false);
    assert.equal(settings.autocomplete, false);
    assert.equal(settings.expandKey, 'both');
    assert.deepEqual(plain(settings.commands), [{ id: '5', trigger: '/hi', response: 'Привет' }, { id: '', trigger: '/old', response: '' }]);
    assert.equal(api.normalizeCommands({ expandKey: 'tab' }).expandKey, 'tab');
});

test('preview fills template variables, picks the first variant and marks AI prompts', () => {
    const preview = api.previewText('{welcome}, {buyername}! {lotname} {bal} {activesells} {date} {да|конечно} {ai:поблагодари} <b>');
    assert.doesNotMatch(preview, /\{(welcome|buyername|lotname|bal|activesells|date)\}/);
    assert.match(preview, / да /);
    assert.match(preview, /\[ИИ: поблагодари\]/);
    assert.ok(preview.endsWith('<b>'), 'markup stays plain text');
});

test('command preview only substitutes variables the slash runtime supports', () => {
    const preview = api.previewText('{BuyerName} {username} {date} {time} {welcome} {a|b}', 'command');
    assert.doesNotMatch(preview, /\{(buyername|username|date|time)\}/i);
    assert.match(preview, /\{welcome\}/);
    assert.ok(preview.endsWith(' a'));
});

test('command validation adds the slash and rejects blanks, spaces, inner slashes and duplicates', () => {
    const commands = [{ id: '1', trigger: '/Привет', response: '' }, { id: '2', trigger: '/bye', response: '' }];
    assert.deepEqual(plain(api.validateCommand('спасибо', commands)), { trigger: '/спасибо', error: '' });
    assert.deepEqual(plain(api.validateCommand('  /info ', commands)), { trigger: '/info', error: '' });
    assert.ok(api.validateCommand('', commands).error);
    assert.ok(api.validateCommand('/', commands).error);
    assert.ok(api.validateCommand('два слова', commands).error);
    assert.ok(api.validateCommand('a/b', commands).error);
    assert.match(api.validateCommand('привет', commands).error, /уже есть/);
    assert.equal(api.validateCommand('/привет', commands, '1').error, '', 'editing a command keeps its own trigger');
    assert.ok(api.validateCommand('/BYE', commands, '1').error, 'duplicates are case-insensitive');
});
