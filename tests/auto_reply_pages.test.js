const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
const mainPopup = read('content/ui/main_popup.js');
const autoReplyFeature = read('content/features/auto_review.js');
const misc = read('content/features/misc.js');
const settingsLoader = read('content/ui/settings_loader.js');
const navigationTest = read('tests/t18_navigation_ia.test.js');
const backgroundAutoresponder = read('background/autoresponder.js');

const popupMarkupMatch = mainPopup.match(/toolsPopup\.innerHTML\s*=\s*`([\s\S]*?)`;\s*/);
assert.ok(popupMarkupMatch, 'popup template markup must be available for page-level contract checks');
const popupMarkup = popupMarkupMatch[1];

function pageMarkup(pageId) {
    const marker = `<div class="fp-tools-page-content" data-page="${pageId}"`;
    const pageStart = popupMarkup.indexOf(marker);
    if (pageStart < 0) return '';
    const nextPage = popupMarkup.indexOf('<div class="fp-tools-page-content" data-page="', pageStart + marker.length);
    return popupMarkup.slice(pageStart, nextPage < 0 ? popupMarkup.length : nextPage);
}

function testSeparateNavigationAndPageOwnership() {
    const navPageIds = [...popupMarkup.matchAll(/<li\b[^>]*data-page="([^"]+)"/g)].map(match => match[1]);
    const pageIds = [...popupMarkup.matchAll(/<div class="fp-tools-page-content" data-page="([^"]+)"/g)].map(match => match[1]);

    assert.ok(navPageIds.includes('auto_reply'), 'auto_reply needs a navigation row');
    assert.ok(pageIds.includes('auto_reply'), 'auto_reply needs its own settings page');
    assert.ok(navPageIds.includes('auto_review'), 'the legacy auto_review route must remain navigable');
    assert.ok(pageIds.includes('auto_review'), 'review settings stay on the auto_review page');
    assert.equal(navPageIds.filter(id => id === 'auto_reply').length, 1, 'auto_reply must have one navigation row');
    assert.equal(pageIds.filter(id => id === 'auto_reply').length, 1, 'auto_reply must have one page node');

    const allIds = [...popupMarkup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(allIds).size, allIds.length, 'splitting the pages must not duplicate any DOM ID');

    const review = pageMarkup('auto_review');
    const reply = pageMarkup('auto_reply');
    for (const id of [
        'autoReviewEnabled', 'fpt-review-1', 'fpt-review-2', 'fpt-review-3', 'fpt-review-4', 'fpt-review-5',
        'bonusForReviewEnabled', 'bonusModeSelector', 'singleBonusText', 'bonus-list-container', 'newBonusText',
        'addBonusBtn', 'bonusForReviewDelaySec'
    ]) {
        assert.match(review, new RegExp(`id="${id}"`), `${id} belongs on auto_review`);
        assert.doesNotMatch(reply, new RegExp(`id="${id}"`), `${id} must not be on auto_reply`);
    }
    for (const id of [
        'greetingEnabled', 'greetingText', 'onlyNewChats', 'ignoreSystemMessages', 'greetingCooldownDays',
        'newOrderReplyEnabled', 'newOrderReplyText', 'orderConfirmReplyEnabled', 'orderConfirmReplyText',
        'keywordsEnabled', 'keywords-list-container', 'newKeyword', 'newKeywordResponse', 'addKeywordBtn'
    ]) {
        assert.match(reply, new RegExp(`id="${id}"`), `${id} belongs on auto_reply`);
        assert.doesNotMatch(review, new RegExp(`id="${id}"`), `${id} must not be on auto_review`);
    }
}

function testBothPagesInitializeFromSavedStateBeforeAutosave() {
    const routeStart = mainPopup.indexOf('async function openPopupPage(');
    const routeEnd = mainPopup.indexOf('function setupPopupNavigation()', routeStart);
    const routeBody = mainPopup.slice(routeStart, routeEnd);
    assert.match(routeBody, /targetPageId === 'auto_reply'\) initialize\('initializeAutoReplyUI'\)/,
        'the central router initializes auto_reply on entry');
    assert.match(routeBody, /targetPageId === 'auto_review'\) initialize\('initializeAutoReviewUI'\)/,
        'the central router keeps auto_review initialization');

    assert.match(settingsLoader, /await initializeAutoReplyUI\(settings\.fpToolsAutoReplies\s*\|\|\s*\{\}\)/,
        'settings loader passes the saved auto-reply object to auto_reply and waits');
    assert.match(settingsLoader, /await initializeAutoReviewUI\(settings\.fpToolsAutoReplies\s*\|\|\s*\{\}\)/,
        'settings loader passes the same saved object to auto_review and waits');
    assert.ok(settingsLoader.indexOf('await initializeAutoReplyUI(') < settingsLoader.indexOf('window.__fptAutoReplySettingsReady = true'),
        'autosave readiness follows both page initializers');
    assert.ok(settingsLoader.indexOf('await initializeAutoReviewUI(') < settingsLoader.indexOf('window.__fptAutoReplySettingsReady = true'),
        'review settings load before autosave becomes active');
    assert.match(settingsLoader, /'fpToolsAutoReplies'/, 'legacy auto-reply storage is loaded as a complete object');

    assert.match(misc, /if \(window\.__fptAutoReplySettingsReady !== true\) return;/,
        'autosave ignores input while the saved object is still loading');
    assert.match(misc, /if \(window\.__fptAutoReplySettingsReady !== true\) \{/,
        'manual saves also wait for the complete saved settings');
    assert.match(misc, /await window\.fptPatchAutoReplies\(autoReplyPatch\)/,
        'all page autosaves continue to use the awaited A3 patch API');
    assert.match(autoReplyFeature, /function initializeAutoReplyUI\(/,
        'auto_reply has its own page initializer');
    assert.match(autoReplyFeature, /function initializeAutoReviewUI\(/,
        'auto_review retains its page initializer');
}

function testQuickInputWaitsForSavedSettings() {
    const autosaveStart = misc.indexOf("const popupRoot = document.querySelector('.fp-tools-popup');");
    const autosaveEnd = misc.indexOf('\n    const bgInfoToggle', autosaveStart);
    assert.ok(autosaveStart >= 0 && autosaveEnd > autosaveStart, 'global autosave listener block exists');
    const autosaveBlock = misc.slice(autosaveStart, autosaveEnd);
    const popup = { dataset: {}, listeners: Object.create(null), addEventListener(type, listener) {
        (this.listeners[type] ||= []).push(listener);
    } };
    const scheduled = [];
    const savedBatches = [];
    const window = { __fptAutoReplySettingsReady: false };
    const context = vm.createContext({
        document: { querySelector: selector => selector === '.fp-tools-popup' ? popup : null },
        window,
        fptExtAlive: () => true,
        saveAllPopupSettings: (silent, changedTargets) => savedBatches.push({ silent, changedTargets }),
        setTimeout: callback => { const handle = { callback }; scheduled.push(handle); return handle; },
        clearTimeout() {},
        Map, Array
    });
    vm.runInContext(autosaveBlock, context);
    const input = { id: 'greetingText' };
    popup.listeners.input[0]({ target: input });
    assert.equal(scheduled.length, 0, 'fast input before the saved object loads is not autosaved');
    assert.equal(savedBatches.length, 0);

    window.__fptAutoReplySettingsReady = true;
    popup.listeners.input[0]({ target: input });
    assert.equal(scheduled.length, 1, 'input after initialization is queued normally');
    scheduled[0].callback();
    assert.equal(savedBatches.length, 1);
    assert.equal(savedBatches[0].silent, true);
    assert.equal(savedBatches[0].changedTargets[0].id, 'greetingText');
}

function testExistingStorageKeysImagesAndSendOrderingRemain() {
    const patchBuilder = misc.slice(misc.indexOf('function fptBuildAutoReplyPatch('), misc.indexOf('\nfunction initializeToolsPopup('));
    for (const key of [
        'greetingEnabled', 'greetingText', 'onlyNewChats', 'ignoreSystemMessages', 'greetingCooldownDays',
        'newOrderReplyEnabled', 'newOrderReplyText', 'orderConfirmReplyEnabled', 'orderConfirmReplyText',
        'keywordsEnabled', 'keywords', 'autoReviewEnabled', 'reviewTemplates', 'reviewTemplateImages',
        'bonusForReviewEnabled', 'bonusMode', 'singleBonusText', 'randomBonuses', 'bonusForReviewDelaySec'
    ]) assert.ok(autoReplyFeature.includes(key) || patchBuilder.includes(key), `saved field ${key} remains supported`);

    for (const id of ['greetingText', 'newOrderReplyText', 'orderConfirmReplyText', 'newKeywordResponse', 'fpt-review-5']) {
        assert.ok(mainPopup.includes(`'${id}'`), `image reply attachment support remains for ${id}`);
    }
    assert.match(settingsLoader, /restoreImgs\('fpt-review-5',\s*ar\.reviewTemplateImages\['5'\]\)/,
        'saved 5-star review images are restored from the existing storage map');

    const reviewHandlerStart = backgroundAutoresponder.indexOf('async function handleReview(');
    const reviewHandlerEnd = backgroundAutoresponder.indexOf('\nasync function ', reviewHandlerStart + 1);
    const reviewHandler = backgroundAutoresponder.slice(reviewHandlerStart, reviewHandlerEnd);
    const replyIndex = reviewHandler.indexOf('await sendReviewReply(');
    const imageIndex = reviewHandler.indexOf('await sendChatImage(');
    const bonusDelayIndex = reviewHandler.indexOf('await new Promise(r => setTimeout(r, delayMs))');
    const bonusSendIndex = reviewHandler.indexOf('await sendReplyContent(');
    assert.ok(replyIndex >= 0 && imageIndex > replyIndex && bonusDelayIndex > imageIndex && bonusSendIndex > bonusDelayIndex,
        'review reply, its images, and the delayed bonus keep their existing fixed send order');
}

function testSeparateInitializersAreIdempotentAndRestoreTheirFields() {
    class FakeElement {
        constructor(id = '') {
            this.id = id;
            this.value = '';
            this.checked = false;
            this.dataset = {};
            this.style = {};
            this.listeners = Object.create(null);
            this.classList = { add() {}, remove() {}, contains() { return false; }, toggle() {} };
        }
        addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
        focus() {}
        scrollIntoView() {}
    }

    const ids = [
        'autoReviewEnabled', ...[1, 2, 3, 4, 5].map(n => `fpt-review-${n}`), 'bonusForReviewEnabled',
        'singleBonusText', 'bonusForReviewDelaySec', 'singleBonusContainer', 'randomBonusContainer',
        'bonus-list-container', 'newBonusText', 'addBonusBtn', 'keywords-list-container', 'addKeywordBtn',
        'newKeyword', 'newKeywordResponse', 'greetingEnabled', 'greetingText', 'onlyNewChats',
        'ignoreSystemMessages', 'greetingCooldownDays', 'keywordsEnabled', 'newOrderReplyEnabled',
        'newOrderReplyText', 'orderConfirmReplyEnabled', 'orderConfirmReplyText'
    ];
    const elements = new Map(ids.map(id => [id, new FakeElement(id)]));
    const reviewPage = new FakeElement();
    reviewPage.dataset.page = 'auto_review';
    const replyPage = new FakeElement();
    replyPage.dataset.page = 'auto_reply';
    const bonusRadios = ['single', 'random'].map(value => {
        const radio = new FakeElement();
        radio.value = value;
        radio.checked = value === 'random';
        return radio;
    });
    const keywordModes = ['exact', 'contains'].map(value => {
        const radio = new FakeElement();
        radio.value = value;
        radio.checked = value === 'contains';
        return radio;
    });
    const document = {
        querySelector(selector) {
            if (selector === '.fp-tools-page-content[data-page="auto_review"]') return reviewPage;
            if (selector === '.fp-tools-page-content[data-page="auto_reply"]') return replyPage;
            if (selector === 'input[name="bonusMode"]:checked') return bonusRadios.find(radio => radio.checked) || null;
            if (selector === 'input[name="newKeywordMatchMode"]:checked') return keywordModes.find(radio => radio.checked) || null;
            if (selector.startsWith('input[name="bonusMode"][value="')) return bonusRadios.find(radio => radio.value === selector.match(/value="([^"]+)/)?.[1]) || null;
            if (selector.startsWith('input[name="newKeywordMatchMode"][value="')) return keywordModes.find(radio => radio.value === selector.match(/value="([^"]+)/)?.[1]) || null;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === 'input[name="bonusMode"]') return bonusRadios;
            if (selector === '.keyword-item.fpt-editing') return [];
            return [];
        },
        getElementById(id) { return elements.get(id) || null; }
    };
    const saved = {
        greetingEnabled: true,
        greetingText: 'saved greeting',
        onlyNewChats: true,
        ignoreSystemMessages: true,
        greetingCooldownDays: 9,
        newOrderReplyEnabled: true,
        newOrderReplyText: 'paid order',
        orderConfirmReplyEnabled: true,
        orderConfirmReplyText: 'confirmed order',
        keywordsEnabled: true,
        keywords: [{ keyword: 'code', response: 'reply', matchMode: 'contains' }],
        autoReviewEnabled: true,
        reviewTemplates: { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' },
        reviewTemplateImages: { 5: ['data:image/png;base64,old-image'] },
        bonusForReviewEnabled: true,
        bonusMode: 'random',
        randomBonuses: ['bonus'],
        bonusForReviewDelaySec: 6
    };
    const storage = { fpToolsAutoReplies: saved };
    const storageReads = [];
    const chrome = { storage: { local: { get() { return new Promise(resolve => storageReads.push(resolve)); } } } };
    const attachmentSetOrder = [];
    const context = vm.createContext({
        document, chrome,
        window: { fptPatchAutoReplies: async patch => patch },
        __fptAttachments: { set() {}, delete() {} },
        fptSetSendOrder: (_element, order) => attachmentSetOrder.push(order),
        fptRenderAttachments() {},
        handleImageAddClick() {},
        showNotification() {},
        console: { log() {}, warn() {}, error() {} },
        Promise, Object, Array, Set, Map, Math, String, Number, JSON, RegExp, Error
    });
    vm.runInContext(autoReplyFeature, context, { filename: 'content/features/auto_review.js' });

    const lotIoPage = new FakeElement();
    lotIoPage.dataset.page = 'lot_io';
    const navItems = [replyPage, reviewPage, lotIoPage].map(page => {
        const item = new FakeElement();
        item.dataset.page = page.dataset.page;
        return item;
    });
    const routeStorage = {};
    const routePopup = new FakeElement();
    routePopup.dataset = {};
    routePopup.querySelectorAll = selector => {
        if (selector === '.fp-tools-page-content') return [replyPage, reviewPage, lotIoPage];
        if (selector === '.fp-tools-nav [data-page], .fp-tools-header-tab[data-page]') return navItems;
        return [];
    };
    const routeContext = vm.createContext({
        document: {
            querySelector: selector => selector === '.fp-tools-popup' ? routePopup : null,
            getElementById: () => null
        },
        chrome: { storage: { local: {
            async get(keys) {
                if (typeof keys === 'string') return Object.hasOwn(routeStorage, keys) ? { [keys]: routeStorage[keys] } : {};
                return Object.fromEntries((keys || []).filter(key => Object.hasOwn(routeStorage, key)).map(key => [key, routeStorage[key]]));
            },
            async set(values) { Object.assign(routeStorage, values); }
        } } },
        window: {
            initializeAutoReplyUI: () => context.initializeAutoReplyUI(),
            initializeAutoReviewUI: () => context.initializeAutoReviewUI(),
            addEventListener() {}
        },
        console: { log() {}, warn() {}, error() {} },
        Promise, Object, Array, Set, Map, Math, String, Number, Boolean, RegExp, Error
    });
    vm.runInContext(mainPopup, routeContext, { filename: 'content/ui/main_popup.js' });

    return routeContext.openPopupPage('auto_reply').then(async firstRouteOpened => {
        assert.equal(firstRouteOpened, true);
        assert.equal(storageReads.length, 1, 'first page entry begins loading the complete saved object');
        const secondRouteOpened = await routeContext.openPopupPage('auto_review');
        assert.equal(secondRouteOpened, true);
        assert.equal(storageReads.length, 2, 'an immediate page switch starts the other page load without waiting on the first');
        const loaderReplyInitialization = context.initializeAutoReplyUI(saved);
        const loaderReviewInitialization = context.initializeAutoReviewUI(saved);
        storageReads.forEach(resolve => resolve(storage));
        return Promise.all([loaderReplyInitialization, loaderReviewInitialization]);
    }).then(async () => {
        const input = id => elements.get(id);
        assert.equal(input('greetingText').value, 'saved greeting');
        assert.equal(input('onlyNewChats').checked, true);
        assert.equal(input('greetingCooldownDays').value, 9);
        assert.equal(input('newOrderReplyText').value, 'paid order');
        assert.equal(input('orderConfirmReplyText').value, 'confirmed order');
        assert.equal(input('fpt-review-5').value, 'five');
        assert.equal(input('bonusForReviewDelaySec').value, 6);
        assert.equal(reviewPage.dataset.initialized, 'true');
        assert.equal(replyPage.dataset.initialized, 'true');

        input('greetingText').value = 'updated greeting';
        input('fpt-review-5').value = 'updated five-star reply';
        const patchSource = misc.slice(misc.indexOf('function fptBuildAutoReplyPatch('), misc.indexOf('\nfunction initializeToolsPopup('));
        assert.ok(patchSource.length > 0, 'autosave patch builder exists');
        const patchContext = vm.createContext({
            document: {
                getElementById(id) { return elements.get(id) || null; },
                querySelector(selector) {
                    if (selector === 'input[name="bonusMode"]:checked') return bonusRadios.find(radio => radio.checked) || null;
                    return null;
                }
            },
            fptReadAutoReplyImages: id => id === 'fpt-review-5' ? ['data:image/png;base64,new-image'] : [],
            fptReadAutoReplySendOrder: () => 'text_first',
            Object, Array, Set, Map, Math, String, Number
        });
        vm.runInContext(`${patchSource}; this.buildPatch = fptBuildAutoReplyPatch;`, patchContext);
        const patch = patchContext.buildPatch([{ id: 'greetingText' }, { id: 'fpt-review-5' }]);
        assert.equal(patch.set.greetingText, 'updated greeting');
        assert.equal(patch.merge.reviewTemplates['5'], 'updated five-star reply');
        assert.deepEqual(JSON.parse(JSON.stringify(patch.merge.reviewTemplateImages['5'])), ['data:image/png;base64,new-image']);
        storage.fpToolsAutoReplies = {
            ...saved,
            greetingText: patch.set.greetingText,
            reviewTemplates: { ...saved.reviewTemplates, ...patch.merge.reviewTemplates },
            reviewTemplateImages: { ...saved.reviewTemplateImages, ...patch.merge.reviewTemplateImages }
        };

        const replyListeners = replyPage.listeners.click?.length || 0;
        const reviewListeners = reviewPage.listeners.click?.length || 0;
        await context.initializeAutoReplyUI(saved);
        await context.initializeAutoReviewUI(saved);
        assert.equal(replyPage.listeners.click?.length || 0, replyListeners, 'auto_reply re-entry does not bind handlers again');
        assert.equal(reviewPage.listeners.click?.length || 0, reviewListeners, 'auto_review re-entry does not bind handlers again');

        const restartedElements = new Map(ids.map(id => [id, new FakeElement(id)]));
        const restartedReview = new FakeElement();
        restartedReview.dataset.page = 'auto_review';
        const restartedReply = new FakeElement();
        restartedReply.dataset.page = 'auto_reply';
        const restartContext = vm.createContext({
            document: {
                querySelector: selector => selector.includes('data-page="auto_review"') ? restartedReview
                    : selector.includes('data-page="auto_reply"') ? restartedReply
                        : selector === 'input[name="bonusMode"]:checked' ? bonusRadios[1]
                            : selector === 'input[name="newKeywordMatchMode"]:checked' ? keywordModes[1] : null,
                querySelectorAll: selector => selector === 'input[name="bonusMode"]' ? bonusRadios : [],
                getElementById: id => restartedElements.get(id) || null
            },
            chrome, window: { fptPatchAutoReplies: async patch => patch },
            __fptAttachments: { set() {}, delete() {} }, fptSetSendOrder() {}, fptRenderAttachments() {},
            handleImageAddClick() {}, showNotification() {}, console: { log() {}, warn() {}, error() {} },
            Promise, Object, Array, Set, Map, Math, String, Number, JSON, RegExp, Error
        });
        vm.runInContext(autoReplyFeature, restartContext, { filename: 'content/features/auto_review.js' });
        await restartContext.initializeAutoReplyUI(storage.fpToolsAutoReplies);
        await restartContext.initializeAutoReviewUI(storage.fpToolsAutoReplies);
        assert.equal(restartedElements.get('greetingText').value, 'updated greeting');
        assert.equal(restartedElements.get('fpt-review-5').value, 'updated five-star reply');
        assert.deepEqual(storage.fpToolsAutoReplies.reviewTemplateImages['5'], ['data:image/png;base64,new-image'],
            'the persisted 5-star image remains alongside the text after restart');
    });
}

async function run() {
    testSeparateNavigationAndPageOwnership();
    testBothPagesInitializeFromSavedStateBeforeAutosave();
    testQuickInputWaitsForSavedSettings();
    testExistingStorageKeysImagesAndSendOrderingRemain();
    await testSeparateInitializersAreIdempotentAndRestoreTheirFields();
    assert.match(navigationTest, /auto_reply/, 'T18 navigation assertions cover the canonical autoresponder page');
    console.log('AUTO_REPLY_PAGES_PASS');
}

run().catch(error => {
    console.error('AUTO_REPLY_PAGES_FAIL:', error);
    process.exit(1);
});
