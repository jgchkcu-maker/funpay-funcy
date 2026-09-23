const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_GROUP_ORDER = [
    'Верхняя панель',
    'Чат',
    'Создание и оформление лота',
    'Копирование и импорт лотов',
    'Цены и аналитика',
    'Список лотов и профиль'
];
const EXPECTED_CHAT_SUBGROUP_ORDER = [
    'Поле ввода',
    'Шапка диалога',
    'Действия в диалоге'
];

// Captured from the registry before taxonomy changes. Keep these pairs literal
// so a changed selector cannot silently redefine the compatibility contract.
const EXPECTED_ID_SELECTOR_PAIRS = [
    ['rmthub_seller_search', '#fp-rmthub-form'],
    ['chat_custom_attach', '.fpt-attach-btn'],
    ['chat_ai_rewrite_btn', '#aiModeToggleBtn'],
    ['chat_reply', '.fpt-msg-tools, .fpt-reply-bar, .fpt-reply-card'],
    ['chat_char_counter', '#fp-chat-char-count'],
    ['profanity_warning', '#fpToolsProfanityWarning'],
    ['chat_read_all_btn', '#fp-tools-read-all-btn'],
    ['chat_filter_marked_btn', '#fp-tools-filter-marked-btn'],
    ['chat_menu_buyer_history', '#fp-buyer-hist-menu-btn'],
    ['chat_menu_translate', '#fp-translate-menu-btn'],
    ['chat_menu_export', '#fp-export-chat-menu-btn'],
    ['chat_menu_blacklist', '#fp-blacklist-menu-btn'],
    ['chat_image_generator_btn', '#fpToolsGenerateImageBtn, .generate-btn-container'],
    ['lot_ai_gen_btn', '#fp-tools-ai-gen-btn-wrapper'],
    ['lot_font_controls', '.fp-tools-font-controls, .fp-tools-symbols-panel'],
    ['lot_keyboard_btn', '#fpToolsKeyboardToggleBtn'],
    ['lot_translate_btn', '#fp-tools-translate-btn'],
    ['lot_exact_price_btn', '.set-exact-price'],
    ['lot_paste_bar', '#fp-tools-paste-bar'],
    ['lot_clone_btn', '.fp-tools-clone-btn'],
    ['lot_import_btn', '.fp-tools-import-btn'],
    ['lot_category_peek', '#fpt-peek-toggle, .fpt-peek-panel'],
    ['lot_public_clone_btn', '#fp-tools-public-clone-btn'],
    ['multi_clone_foreign', '.actions .clone-lots'],
    ['lot_notes_chat_btn', '.fpt-chat-note-btn'],
    ['lot_delete_btn', '.fpt-lot-del-btn'],
    ['lot_search_bar', '#fp-lot-search-bar'],
    ['lot_select_btn', '#fp-tools-select-lots-btn'],
    ['lot_reactivate_btn', '#fp-tools-reactivate-lots-btn'],
    ['open_lot_buttons', '.fpt-open-lot'],
    ['raise_all_lots_btn', '#fpt-raise-all-btn'],
    ['buyer_price_field', '#fpt-buyer-price-group'],
    ['cost_basis_field', '#fpt-cost-basis-group'],
    ['lot_pinned_container', '#fp-tools-pinned-lots-container'],
    ['market_analytics_btn', '#fpTools-market-analytics-btn-wrapper'],
    ['sales_stats_expand', '#fpTools-stats-extra, #fpTools-stats-expand-btn'],
    ['notes_add_status_btn', '#fp-tools-add-status-btn']
];

const EXPECTED_GROUP_IDS = {
    'Верхняя панель': ['rmthub_seller_search'],
    'Чат': [
        'chat_custom_attach', 'chat_ai_rewrite_btn', 'chat_reply',
        'chat_char_counter', 'profanity_warning', 'chat_read_all_btn',
        'chat_filter_marked_btn', 'chat_menu_buyer_history', 'chat_menu_translate',
        'chat_menu_export', 'chat_menu_blacklist', 'lot_notes_chat_btn'
    ],
    'Создание и оформление лота': [
        'chat_image_generator_btn', 'lot_ai_gen_btn', 'lot_font_controls',
        'lot_keyboard_btn', 'lot_translate_btn'
    ],
    'Копирование и импорт лотов': [
        'lot_paste_bar', 'lot_clone_btn', 'lot_import_btn',
        'lot_public_clone_btn', 'multi_clone_foreign'
    ],
    'Цены и аналитика': [
        'lot_exact_price_btn', 'lot_category_peek', 'buyer_price_field',
        'cost_basis_field', 'market_analytics_btn', 'sales_stats_expand'
    ],
    'Список лотов и профиль': [
        'lot_delete_btn', 'lot_search_bar', 'lot_select_btn', 'lot_reactivate_btn',
        'open_lot_buttons', 'raise_all_lots_btn', 'lot_pinned_container', 'notes_add_status_btn'
    ]
};

const EXPECTED_GROUP_COUNTS = {
    'Верхняя панель': 1,
    'Чат': 12,
    'Создание и оформление лота': 5,
    'Копирование и импорт лотов': 5,
    'Цены и аналитика': 6,
    'Список лотов и профиль': 8
};

const EXPECTED_CHAT_SUBGROUP_IDS = {
    'Поле ввода': [
        'chat_custom_attach', 'chat_ai_rewrite_btn', 'chat_reply',
        'chat_char_counter', 'profanity_warning'
    ],
    'Шапка диалога': ['chat_read_all_btn', 'chat_filter_marked_btn'],
    'Действия в диалоге': [
        'chat_menu_buyer_history', 'chat_menu_translate', 'chat_menu_export',
        'chat_menu_blacklist', 'lot_notes_chat_btn'
    ]
};

function loadRegistrySource() {
    const source = fs.readFileSync(path.join(ROOT, 'content/features/feature_registry.js'), 'utf8');
    const result = vm.runInNewContext(
        `${source}\n({ registry: FPT_FEATURE_REGISTRY, groupOrder: typeof FPT_NEEDS_GROUP_ORDER === 'undefined' ? null : FPT_NEEDS_GROUP_ORDER, chatSubgroupOrder: typeof FPT_NEEDS_CHAT_SUBGROUP_ORDER === 'undefined' ? null : FPT_NEEDS_CHAT_SUBGROUP_ORDER })`,
        { window: {} }
    );

    return JSON.parse(JSON.stringify(result));
}

function sortIds(ids) {
    return [...ids].sort((left, right) => left.localeCompare(right));
}

test('registry preserves all 37 ID-to-selector pairs with the explicit taxonomy', () => {
    const { registry, groupOrder, chatSubgroupOrder } = loadRegistrySource();

    assert.equal(registry.length, 37, 'the registry retains exactly 37 features');

    const ids = registry.map(({ id }) => id);
    const selectors = registry.map(({ selector }) => selector);
    assert.equal(new Set(ids).size, ids.length, 'feature IDs are unique');
    assert.equal(new Set(selectors).size, selectors.length, 'feature selectors are unique');

    const actualPairs = registry
        .map(({ id, selector }) => [id, selector])
        .sort(([left], [right]) => left.localeCompare(right));
    const expectedPairs = [...EXPECTED_ID_SELECTOR_PAIRS]
        .sort(([left], [right]) => left.localeCompare(right));
    assert.deepEqual(actualPairs, expectedPairs, 'each original feature ID keeps its selector');

    assert.deepEqual(
        Object.fromEntries(EXPECTED_GROUP_ORDER.map((group) => [
            group,
            sortIds(registry.filter((entry) => entry.group === group).map(({ id }) => id))
        ])),
        Object.fromEntries(EXPECTED_GROUP_ORDER.map((group) => [group, sortIds(EXPECTED_GROUP_IDS[group])]))
    );
    assert.deepEqual(
        Object.fromEntries(EXPECTED_GROUP_ORDER.map((group) => [
            group,
            registry.filter((entry) => entry.group === group).length
        ])),
        EXPECTED_GROUP_COUNTS
    );

    assert.deepEqual(groupOrder, EXPECTED_GROUP_ORDER);
    assert.deepEqual(chatSubgroupOrder, EXPECTED_CHAT_SUBGROUP_ORDER);

    assert.deepEqual(
        sortIds([...new Set(registry.map(({ group }) => group))]),
        sortIds(EXPECTED_GROUP_ORDER),
        'entries use only the six allowed groups and none are missing a group'
    );

    const chatEntries = registry.filter(({ group }) => group === 'Чат');
    assert.deepEqual(
        Object.fromEntries(EXPECTED_CHAT_SUBGROUP_ORDER.map((subgroup) => [
            subgroup,
            sortIds(chatEntries.filter((entry) => entry.subgroup === subgroup).map(({ id }) => id))
        ])),
        Object.fromEntries(EXPECTED_CHAT_SUBGROUP_ORDER.map((subgroup) => [
            subgroup,
            sortIds(EXPECTED_CHAT_SUBGROUP_IDS[subgroup])
        ]))
    );
    assert.equal(chatEntries.filter(({ subgroup }) => !subgroup).length, 0, 'every chat feature has a subgroup');
    assert.equal(
        registry.filter((entry) => entry.group !== 'Чат' && Object.hasOwn(entry, 'subgroup')).length,
        0,
        'non-chat features do not gain chat subgroups'
    );
});

test('renamed font controls retain their prior searchable labels locally', () => {
    const { registry } = loadRegistrySource();
    const fontControls = registry.find(({ id }) => id === 'lot_font_controls');
    const keyboardButton = registry.find(({ id }) => id === 'lot_keyboard_btn');

    assert.equal(fontControls.label, 'Блок шрифта и спецсимволов');
    assert.deepEqual(fontControls.legacyLabels, ['Шрифты и спецсимволы в лоте']);
    assert.equal(keyboardButton.label, 'Кнопка „Клавиатура“');
    assert.deepEqual(keyboardButton.legacyLabels, ['Кнопка «Клавиатура» спецсимволов']);
    assert.equal(registry.filter((entry) => Object.hasOwn(entry, 'legacyLabels')).length, 2);
});
