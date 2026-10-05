const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
    const ctx = vm.createContext({ window: {}, console });
    for (const file of ['content/features/feature_registry.js', 'content/ui/interface_elements_page.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ctx, { filename: file });
    }
    return { page: ctx.window.FPTInterfaceElementsPage, registry: ctx.window.FPT_FEATURE_REGISTRY };
}

test('layout keeps the declared group and chat subgroup order and nests the keyboard under the font block', () => {
    const { page, registry } = load();
    const groups = page.layout(registry);
    assert.deepEqual([...groups.map(group => group.name)], ['Верхняя панель', 'Чат', 'Создание и оформление лота',
        'Копирование и импорт лотов', 'Цены и аналитика', 'Список лотов и профиль']);
    assert.deepEqual([...groups[1].sections.map(section => section.name)], ['Поле ввода', 'Шапка диалога', 'Действия в диалоге']);
    const lot = groups[2].sections[0].items;
    const font = lot.find(item => item.entry.id === 'lot_font_controls');
    assert.deepEqual([...font.children.map(child => child.id)], ['lot_keyboard_btn']);
    assert.ok(!lot.some(item => item.entry.id === 'lot_keyboard_btn'), 'child is not listed twice');
    const listed = groups.flatMap(group => group.sections.flatMap(section => section.items.flatMap(item => [item.entry, ...item.children])));
    assert.equal(listed.length, registry.length, 'every registry entry appears exactly once');
});

test('layout appends unknown groups instead of dropping them', () => {
    const { page } = load();
    const groups = page.layout([{ id: 'a', label: 'A', group: 'Новый раздел' }], { groups: [] });
    assert.deepEqual([...groups.map(group => group.name)], ['Новый раздел']);
});

test('visibility matches labels, descriptions, groups and legacy labels; a matching child keeps its parent as context', () => {
    const { page, registry } = load();
    const none = new Set();
    const legacy = page.visibility(registry, none, { query: 'Шрифты и спецсимволы в лоте' });
    assert.equal(legacy.get('lot_font_controls'), 'match');
    const keyboard = page.visibility(registry, none, { query: 'клавиатура' });
    assert.equal(keyboard.get('lot_keyboard_btn'), 'match');
    assert.equal(keyboard.get('lot_font_controls'), 'match', 'the font block description mentions the keyboard');
    const child = page.visibility(registry, new Set(['lot_keyboard_btn']), { filter: 'hidden' });
    assert.equal(child.get('lot_keyboard_btn'), 'match');
    assert.equal(child.get('lot_font_controls'), 'context');
    assert.equal(page.visibility(registry, none, { query: 'Шапка диалога' }).size, 2);
    assert.equal(page.visibility(registry, none, { query: 'ёлка-несуществующая' }).size, 0);
});

test('filters split elements into shown and hidden', () => {
    const { page, registry } = load();
    const disabled = new Set(['chat_reply', 'lot_clone_btn']);
    assert.deepEqual([...page.visibility(registry, disabled, { filter: 'hidden' }).keys()].sort(), ['chat_reply', 'lot_clone_btn']);
    assert.equal(page.visibility(registry, disabled, { filter: 'shown' }).size, registry.length - 2);
    assert.deepEqual({ ...page.summarize(registry, disabled) }, { total: registry.length, hidden: 2, shown: registry.length - 2, groups: 6 });
});

test('previews substitute the real magic icon path', () => {
    const { page, registry } = load();
    const ai = registry.find(entry => entry.id === 'chat_ai_rewrite_btn');
    assert.match(page.previewHtml(ai), /icons\/magic\.png/);
    assert.doesNotMatch(page.previewHtml(ai), /\{\{MAGIC_ICON\}\}/);
});
