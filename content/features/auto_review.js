// content/features/auto_review.js

/**
 * Each page initializes from the same complete fpToolsAutoReplies object. The map is
 * populated before the first await so route entry and the settings loader can safely
 * request initialization at the same time.
 */
const autoReplyPageInitializationPromises = new Map();

function initializeAutoReplyUI(savedAutoReplies) {
    return initializeAutoReplySettingsPage('auto_reply', setupAutoReplyUI, savedAutoReplies);
}

function initializeAutoReviewUI(savedAutoReplies) {
    return initializeAutoReplySettingsPage('auto_review', setupAutoReviewUI, savedAutoReplies);
}

function initializeAutoReplySettingsPage(pageId, setupPage, savedAutoReplies) {
    const page = document.querySelector(`.fp-tools-page-content[data-page="${pageId}"]`);
    if (!page || page.dataset.initialized === 'true') return Promise.resolve();

    const pending = autoReplyPageInitializationPromises.get(page);
    if (pending) return pending;

    const initialization = Promise.resolve().then(async () => {
        let saved = savedAutoReplies;
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
            const stored = await chrome.storage.local.get('fpToolsAutoReplies');
            saved = stored?.fpToolsAutoReplies;
        }
        const settings = normalizeAutoReplySettings(saved);
        setupPage(page, settings);
        page.dataset.initialized = 'true';
    }).finally(() => {
        autoReplyPageInitializationPromises.delete(page);
    });

    autoReplyPageInitializationPromises.set(page, initialization);
    return initialization;
}

function normalizeAutoReplySettings(savedAutoReplies) {
    const saved = savedAutoReplies && typeof savedAutoReplies === 'object' && !Array.isArray(savedAutoReplies)
        ? savedAutoReplies
        : {};
    return {
        autoReviewEnabled: false,
        reviewTemplates: {},
        greetingEnabled: false,
        greetingText: 'Здравствуйте! Чем могу помочь?',
        onlyNewChats: false,
        ignoreSystemMessages: false,
        greetingCooldownDays: 0,
        keywordsEnabled: false,
        keywords: [],
        bonusForReviewEnabled: false,
        bonusMode: 'single',
        singleBonusText: '',
        randomBonuses: [],
        bonusForReviewDelaySec: 4,
        newOrderReplyEnabled: false,
        newOrderReplyText: '',
        orderConfirmReplyEnabled: false,
        orderConfirmReplyText: '',
        typingDelay: false,
        ...saved,
        reviewTemplates: { ...(saved.reviewTemplates || {}) },
        keywords: Array.isArray(saved.keywords) ? saved.keywords : [],
        randomBonuses: Array.isArray(saved.randomBonuses) ? saved.randomBonuses : []
    };
}

function setAutoReplyCheckbox(id, value) {
    const element = document.getElementById(id);
    if (element) element.checked = !!value;
}

function setAutoReplyValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? '';
}

function attachAutoReplyImageHandler(page) {
    if (page.dataset.fptAutoReplyImagesHandler === 'true') return;
    page.dataset.fptAutoReplyImagesHandler = 'true';
    page.addEventListener('click', event => {
        if (!event.target?.classList?.contains('add-image-btn')) return;
        const textarea = event.target.previousElementSibling;
        if (textarea && textarea.tagName === 'TEXTAREA') handleImageAddClick(textarea);
    });
}

function setupAutoReplyRuleDisclosure(page) {
    if (!page || page.dataset.fptRuleDisclosure === 'true') return;
    page.dataset.fptRuleDisclosure = 'true';

    const rules = [
        { toggle: 'greetingEnabled', body: 'greetingRuleBody', status: 'greetingRuleStatus' },
        { toggle: 'newOrderReplyEnabled', body: 'newOrderRuleBody', status: 'newOrderRuleStatus' },
        { toggle: 'orderConfirmReplyEnabled', body: 'orderConfirmRuleBody', status: 'orderConfirmRuleStatus' },
        { toggle: 'keywordsEnabled', body: 'keywordsRuleBody', status: 'keywordsRuleStatus' }
    ];

    const sync = rule => {
        const toggle = document.getElementById(rule.toggle);
        const body = document.getElementById(rule.body);
        const status = document.getElementById(rule.status);
        if (!toggle) return;
        const enabled = !!toggle.checked;
        if (body) body.hidden = !enabled;
        if (status) {
            status.textContent = enabled ? 'Включено' : 'Выключено';
            status.classList.toggle('is-enabled', enabled);
        }
    };

    rules.forEach(rule => {
        const toggle = document.getElementById(rule.toggle);
        if (!toggle) return;
        toggle.addEventListener('change', () => sync(rule));
        sync(rule);
    });
}

function setupAutoReplyUI(page, settings) {
    setAutoReplyCheckbox('greetingEnabled', settings.greetingEnabled);
    setAutoReplyValue('greetingText', settings.greetingText || 'Здравствуйте! Чем могу помочь?');
    setAutoReplyCheckbox('onlyNewChats', settings.onlyNewChats);
    setAutoReplyCheckbox('ignoreSystemMessages', settings.ignoreSystemMessages);
    setAutoReplyValue('greetingCooldownDays', settings.greetingCooldownDays ?? 0);
    setAutoReplyCheckbox('newOrderReplyEnabled', settings.newOrderReplyEnabled);
    setAutoReplyValue('newOrderReplyText', settings.newOrderReplyText);
    setAutoReplyCheckbox('orderConfirmReplyEnabled', settings.orderConfirmReplyEnabled);
    setAutoReplyValue('orderConfirmReplyText', settings.orderConfirmReplyText);
    setAutoReplyCheckbox('keywordsEnabled', settings.keywordsEnabled);
    setAutoReplyCheckbox('typingDelay', settings.typingDelay);
    renderKeywordsList(settings.keywords);
    attachAutoReplyImageHandler(page);
    setupAutoReplyRuleDisclosure(page);

    let editingKeywordIndex = -1;
    let editingKeywordOriginal = null;
    const addKeywordBtn = document.getElementById('addKeywordBtn');
    const kwInput = document.getElementById('newKeyword');
    const kwResponse = document.getElementById('newKeywordResponse');

    const resetKeywordForm = () => {
        editingKeywordIndex = -1;
        editingKeywordOriginal = null;
        kwInput.value = '';
        kwResponse.value = '';
        const exactRadio = document.querySelector('input[name="newKeywordMatchMode"][value="exact"]');
        if (exactRadio) exactRadio.checked = true;
        addKeywordBtn.textContent = 'Добавить правило';
        addKeywordBtn.classList.remove('fpt-editing-rule');
        if (typeof __fptAttachments !== 'undefined') __fptAttachments.delete(kwResponse);
        delete kwResponse.dataset.fptImages;
        delete kwResponse.dataset.fptSendOrder;
        if (typeof fptRenderAttachments === 'function') fptRenderAttachments(kwResponse);
    };

    const refreshListFromStorage = async (field, renderer) => {
        const { fpToolsAutoReplies = {} } = await chrome.storage.local.get('fpToolsAutoReplies');
        const value = fpToolsAutoReplies[field];
        renderer(Array.isArray(value) ? value : []);
        return value;
    };

    const saveListChange = async (patch, field, renderer) => {
        try {
            const saved = await window.fptPatchAutoReplies(patch);
            const value = Array.isArray(saved[field]) ? saved[field] : [];
            renderer(value);
            return value;
        } catch (error) {
            if (error.code === 'STALE_AUTO_REPLY_EDIT') {
                await refreshListFromStorage(field, renderer);
                if (field === 'keywords' && editingKeywordIndex >= 0) {
                    editingKeywordIndex = -1;
                    editingKeywordOriginal = null;
                    addKeywordBtn.textContent = 'Добавить правило';
                    addKeywordBtn.classList.remove('fpt-editing-rule');
                }
                showNotification('Список изменился. Актуальные данные загружены, повторите действие.', true);
            } else {
                showNotification(`Ошибка сохранения: ${error.message}`, true);
            }
            return null;
        }
    };

    addKeywordBtn.addEventListener('click', async () => {
        const keyword = kwInput.value.trim().toLowerCase();
        const response = kwResponse.value.trim();
        const matchModeEl = document.querySelector('input[name="newKeywordMatchMode"]:checked');
        const matchMode = matchModeEl ? matchModeEl.value : 'exact';
        let images = [];
        if (kwResponse.dataset.fptImages) {
            try { images = JSON.parse(kwResponse.dataset.fptImages); } catch (_) {}
        }
        const sendOrder = kwResponse.dataset.fptSendOrder === 'image_first' ? 'image_first' : 'text_first';

        if (!keyword || (!response && !images.length)) {
            showNotification('Заполните ключевое слово и ответ (текст или картинку).', true);
            return;
        }

        const rule = { keyword, response, matchMode };
        if (images.length) rule.images = images;
        if (images.length) rule.sendOrder = sendOrder;
        const editing = editingKeywordIndex >= 0;
        const operation = editing
            ? { op: 'upsert', index: editingKeywordIndex, expected: editingKeywordOriginal, value: rule }
            : { op: 'append', value: rule };
        const keywords = await saveListChange({ arrayOps: { keywords: [operation] } }, 'keywords', renderKeywordsList);
        if (!keywords) return;
        if (editing) showNotification('Правило обновлено!');
        resetKeywordForm();
    });

    const keywordsList = document.getElementById('keywords-list-container');
    keywordsList.addEventListener('click', async event => {
        const editBtn = event.target.closest('.fpt-edit-keyword-btn');
        if (editBtn) {
            const index = parseInt(editBtn.dataset.index, 10);
            let rule;
            try { rule = JSON.parse(editBtn.closest('.keyword-item')?.dataset.rule || 'null'); }
            catch (_) { return; }
            if (!rule || typeof rule !== 'object') return;

            editingKeywordIndex = index;
            editingKeywordOriginal = JSON.parse(JSON.stringify(rule));
            kwInput.value = rule.keyword || '';
            kwResponse.value = rule.response || '';
            const modeRadio = document.querySelector(`input[name="newKeywordMatchMode"][value="${rule.matchMode || 'exact'}"]`);
            if (modeRadio) modeRadio.checked = true;
            if (typeof __fptAttachments !== 'undefined') __fptAttachments.delete(kwResponse);
            delete kwResponse.dataset.fptImages;
            delete kwResponse.dataset.fptSendOrder;
            if (Array.isArray(rule.images) && rule.images.length) {
                const attachments = rule.images.map(dataUrl => ({ id: Math.random().toString(36).slice(2, 8), dataUrl }));
                if (typeof __fptAttachments !== 'undefined') __fptAttachments.set(kwResponse, attachments);
                kwResponse.dataset.fptImages = JSON.stringify(rule.images);
                if (rule.sendOrder) kwResponse.dataset.fptSendOrder = rule.sendOrder;
            }
            if (typeof fptRenderAttachments === 'function') fptRenderAttachments(kwResponse);
            addKeywordBtn.textContent = 'Сохранить изменения';
            addKeywordBtn.classList.add('fpt-editing-rule');
            document.querySelectorAll('.keyword-item.fpt-editing').forEach(element => element.classList.remove('fpt-editing'));
            editBtn.closest('.keyword-item')?.classList.add('fpt-editing');
            kwInput.focus();
            kwInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        const deleteButton = event.target.closest('.delete-keyword-btn');
        if (!deleteButton) return;
        const index = parseInt(deleteButton.dataset.index, 10);
        let expected;
        try { expected = JSON.parse(deleteButton.closest('.keyword-item')?.dataset.rule || 'null'); }
        catch (_) { return; }
        if (!expected || typeof expected !== 'object') return;

        const keywords = await saveListChange({
            arrayOps: { keywords: [{ op: 'remove', index, expected }] }
        }, 'keywords', renderKeywordsList);
        if (!keywords) return;
        if (editingKeywordIndex === index) resetKeywordForm();
        else if (editingKeywordIndex > index) editingKeywordIndex--;
    });
}

function autoReviewTemplateConfigured(textarea) {
    if (!textarea) return false;
    if (String(textarea.value || '').trim()) return true;
    if (!textarea.dataset?.fptImages) return false;
    try {
        const images = JSON.parse(textarea.dataset.fptImages);
        return Array.isArray(images) && images.length > 0;
    } catch (_) {
        return false;
    }
}

function updateAutoReviewTemplateStatuses() {
    for (let rating = 1; rating <= 5; rating++) {
        const textarea = document.getElementById(`fpt-review-${rating}`);
        const status = document.getElementById(`fpt-review-status-${rating}`);
        if (!status) continue;
        const configured = autoReviewTemplateConfigured(textarea);
        status.textContent = configured ? 'Настроен' : 'Не настроен';
        status.classList.toggle('is-configured', configured);
    }
}

function setupAutoReviewPresentation(page) {
    if (!page || page.dataset.fptReviewPresentation === 'true') {
        updateAutoReviewTemplateStatuses();
        return;
    }
    page.dataset.fptReviewPresentation = 'true';

    const reviewEnabled = document.getElementById('autoReviewEnabled');
    const reviewState = document.getElementById('autoReviewState');
    const bonusEnabled = document.getElementById('bonusForReviewEnabled');
    const bonusState = document.getElementById('bonusForReviewState');
    const bonusBody = document.getElementById('bonusForReviewBody');

    const syncReviewMaster = () => {
        const enabled = !!reviewEnabled?.checked;
        if (reviewState) {
            reviewState.textContent = enabled ? 'Включено' : 'Выключено';
            reviewState.classList.toggle('is-enabled', enabled);
        }
    };

    const syncBonusMaster = () => {
        const enabled = !!bonusEnabled?.checked;
        if (bonusBody) bonusBody.hidden = !enabled;
        if (bonusState) {
            bonusState.textContent = enabled ? 'Включено' : 'Выключено';
            bonusState.classList.toggle('is-enabled', enabled);
        }
    };

    reviewEnabled?.addEventListener('change', syncReviewMaster);
    bonusEnabled?.addEventListener('change', syncBonusMaster);

    for (let rating = 1; rating <= 5; rating++) {
        const textarea = document.getElementById(`fpt-review-${rating}`);
        textarea?.addEventListener('input', updateAutoReviewTemplateStatuses);
        if (textarea && typeof MutationObserver === 'function') {
            const observer = new MutationObserver(updateAutoReviewTemplateStatuses);
            observer.observe(textarea, { attributes: true, attributeFilter: ['data-fpt-images'] });
        }
    }

    syncReviewMaster();
    syncBonusMaster();
    updateAutoReviewTemplateStatuses();
}

function setupAutoReviewUI(page, settings) {
    setAutoReplyCheckbox('autoReviewEnabled', settings.autoReviewEnabled);
    for (let rating = 1; rating <= 5; rating++) {
        setAutoReplyValue(`fpt-review-${rating}`, settings.reviewTemplates[rating]);
    }
    attachAutoReplyImageHandler(page);

    setAutoReplyCheckbox('bonusForReviewEnabled', settings.bonusForReviewEnabled);
    const bonusModeRadio = document.querySelector(`input[name="bonusMode"][value="${settings.bonusMode}"]`);
    if (bonusModeRadio) bonusModeRadio.checked = true;
    setAutoReplyValue('singleBonusText', settings.singleBonusText);
    setAutoReplyValue('bonusForReviewDelaySec', settings.bonusForReviewDelaySec);
    setupAutoReviewPresentation(page);

    const singleBonusContainer = document.getElementById('singleBonusContainer');
    const randomBonusContainer = document.getElementById('randomBonusContainer');
    const toggleBonusContainers = () => {
        const selectedMode = document.querySelector('input[name="bonusMode"]:checked')?.value || 'single';
        if (singleBonusContainer) singleBonusContainer.hidden = selectedMode !== 'single';
        if (randomBonusContainer) randomBonusContainer.hidden = selectedMode !== 'random';
    };
    document.querySelectorAll('input[name="bonusMode"]').forEach(radio => {
        radio.addEventListener('change', toggleBonusContainers);
    });
    toggleBonusContainers();
    renderBonusesList(settings.randomBonuses);

    const addBonusButton = document.getElementById('addBonusBtn');
    addBonusButton.addEventListener('click', async () => {
        const bonusText = document.getElementById('newBonusText').value.trim();
        if (!bonusText) {
            showNotification('Текст бонуса не может быть пустым.', true);
            return;
        }
        const bonuses = await saveAutoReplyListChange(
            { arrayOps: { randomBonuses: [{ op: 'append', value: bonusText }] } },
            'randomBonuses',
            renderBonusesList
        );
        if (bonuses) document.getElementById('newBonusText').value = '';
    });

    document.getElementById('bonus-list-container').addEventListener('click', async event => {
        if (!event.target.classList.contains('delete-bonus-btn')) return;
        const index = parseInt(event.target.dataset.index, 10);
        const expected = event.target.dataset.value;
        await saveAutoReplyListChange({
            arrayOps: { randomBonuses: [{ op: 'remove', index, expected }] }
        }, 'randomBonuses', renderBonusesList);
    });
}

async function refreshAutoReplyListFromStorage(field, renderer) {
    const { fpToolsAutoReplies = {} } = await chrome.storage.local.get('fpToolsAutoReplies');
    const value = fpToolsAutoReplies[field];
    renderer(Array.isArray(value) ? value : []);
    return value;
}

async function saveAutoReplyListChange(patch, field, renderer) {
    try {
        const saved = await window.fptPatchAutoReplies(patch);
        const value = Array.isArray(saved[field]) ? saved[field] : [];
        renderer(value);
        return value;
    } catch (error) {
        if (error.code === 'STALE_AUTO_REPLY_EDIT') {
            await refreshAutoReplyListFromStorage(field, renderer);
            showNotification('Список изменился. Актуальные данные загружены, повторите действие.', true);
        } else {
            showNotification(`Ошибка сохранения: ${error.message}`, true);
        }
        return null;
    }
}

function renderKeywordsList(keywords) {
    const listContainer = document.getElementById('keywords-list-container');
    if (!listContainer) return;
    if (!keywords.length) {
        listContainer.innerHTML =
            '<div class="fpt-ui-state fp-ar-keywords-empty">' +
                '<p class="fpt-ui-state-title">Правил пока нет</p>' +
                '<p class="fpt-ui-state-text">Добавьте ключевую фразу и ответ ниже.</p>' +
            '</div>';
        return;
    }

    const esc = value => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    listContainer.innerHTML = keywords.map((item, index) => {
        const modeLabel = item.matchMode === 'contains' ? 'содержит' : 'точно';
        const imageBadge = Array.isArray(item.images) && item.images.length
            ? '<span class="fp-ar-keyword-image-badge">есть изображение</span>'
            : '';
        return `
        <div class="keyword-item fp-ar-keyword-item" data-index="${index}" data-rule="${esc(JSON.stringify(item))}">
            <div class="keyword-pair fp-ar-keyword-pair">
                <div class="fp-ar-keyword-main">
                    <span class="keyword-key">${esc(item.keyword)}</span>
                    <span class="fp-ar-keyword-mode">${modeLabel}</span>
                    ${imageBadge}
                </div>
                <span class="keyword-value fp-ar-keyword-response">${esc(item.response || 'Только изображение')}</span>
            </div>
            <div class="fpt-kw-actions fp-ar-keyword-actions">
                <button type="button" class="fpt-ui-button fpt-ui-button--tertiary fpt-ui-icon-button fpt-edit-keyword-btn" data-index="${index}" title="Редактировать" aria-label="Редактировать правило">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="m14.7 5.3 4 4M5 19l3.4-.8 10.1-10.1a1.4 1.4 0 0 0 0-2l-.6-.6a1.4 1.4 0 0 0-2 0L5.8 15.6 5 19Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button type="button" class="fpt-ui-button fpt-ui-button--tertiary fp-ar-keyword-delete delete-keyword-btn" data-index="${index}">Удалить</button>
            </div>
        </div>`;
    }).join('');
}

function renderBonusesList(bonuses) {
    const listContainer = document.getElementById('bonus-list-container');
    if (!listContainer) return;
    if (!bonuses || bonuses.length === 0) {
        listContainer.innerHTML =
            '<div class="fpt-ui-state fp-review-bonus-empty">' +
                '<p class="fpt-ui-state-title">Список бонусов пуст</p>' +
                '<p class="fpt-ui-state-text">Добавьте хотя бы один вариант, чтобы случайный режим мог выбрать сообщение.</p>' +
            '</div>';
        return;
    }

    const esc = value => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    listContainer.innerHTML = bonuses.map((text, index) => `
        <div class="bonus-item fp-review-bonus-item">
            <span class="bonus-text fp-review-bonus-text">${esc(text)}</span>
            <button type="button" class="fpt-ui-button fpt-ui-button--tertiary fp-review-bonus-delete delete-bonus-btn" data-index="${index}" data-value="${esc(text)}">Удалить</button>
        </div>
    `).join('');
}

async function initializeAutoReview() {
    // This function is no longer needed as all logic is in background.js
}
