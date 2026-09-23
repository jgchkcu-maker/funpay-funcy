// content/features/auto_review.js

/**
 * Инициализирует UI для всех функций авто-ответов в настройках FunPay Funcy
 */
let autoReviewInitializationPromise = null;

function initializeAutoReviewUI(savedAutoReplies = {}) {
    const page = document.querySelector('.fp-tools-page-content[data-page="auto_review"]');
    if (!page || page.dataset.initialized === 'true') return Promise.resolve();
    if (autoReviewInitializationPromise) return autoReviewInitializationPromise;

    const initialization = Promise.resolve().then(() => setupAutoReviewUI(page, savedAutoReplies));
    autoReviewInitializationPromise = initialization.finally(() => {
        autoReviewInitializationPromise = null;
    });
    return autoReviewInitializationPromise;
}

function setupAutoReviewUI(page, savedAutoReplies) {
    const fpToolsAutoReplies = savedAutoReplies && typeof savedAutoReplies === 'object' ? savedAutoReplies : {};
    const settings = {
        ...{
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
            typingDelay: false
        },
        ...fpToolsAutoReplies,
        reviewTemplates: { ...(fpToolsAutoReplies.reviewTemplates || {}) },
        keywords: Array.isArray(fpToolsAutoReplies.keywords) ? fpToolsAutoReplies.keywords : [],
        randomBonuses: Array.isArray(fpToolsAutoReplies.randomBonuses) ? fpToolsAutoReplies.randomBonuses : []
    };

    document.getElementById('bonusForReviewEnabled').checked = settings.bonusForReviewEnabled;
    const bonusModeRadio = document.querySelector(`input[name="bonusMode"][value="${settings.bonusMode}"]`);
    if (bonusModeRadio) bonusModeRadio.checked = true;
    document.getElementById('singleBonusText').value = settings.singleBonusText;
    { const _d = document.getElementById('bonusForReviewDelaySec'); if (_d) _d.value = settings.bonusForReviewDelaySec; }
    
    const singleBonusContainer = document.getElementById('singleBonusContainer');
    const randomBonusContainer = document.getElementById('randomBonusContainer');
    
    const toggleBonusContainers = () => {
        const mode = document.querySelector('input[name="bonusMode"]:checked').value;
        singleBonusContainer.style.display = mode === 'single' ? 'block' : 'none';
        randomBonusContainer.style.display = mode === 'random' ? 'block' : 'none';
    };
    
    document.querySelectorAll('input[name="bonusMode"]').forEach(radio => {
        radio.addEventListener('change', toggleBonusContainers);
    });
    
    toggleBonusContainers();
    renderBonusesList(settings.randomBonuses);

    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    const setVal   = (id, val) => { const el = document.getElementById(id); if (el) el.value  = val || ''; };

    setCheck('autoReviewEnabled', settings.autoReviewEnabled);
    for (let i = 1; i <= 5; i++) setVal(`fpt-review-${i}`, settings.reviewTemplates?.[i]);
    setCheck('greetingEnabled',       settings.greetingEnabled);
    setVal('greetingText',            settings.greetingText || 'Здравствуйте! Чем могу помочь?');
    setCheck('onlyNewChats',          settings.onlyNewChats);
    setCheck('ignoreSystemMessages',  settings.ignoreSystemMessages);
    setVal('greetingCooldownDays',    settings.greetingCooldownDays ?? 0);
    setCheck('keywordsEnabled',       settings.keywordsEnabled);
    // 3.0: New fields
    setCheck('newOrderReplyEnabled',     settings.newOrderReplyEnabled);
    setVal('newOrderReplyText',          settings.newOrderReplyText);
    setCheck('orderConfirmReplyEnabled', settings.orderConfirmReplyEnabled);
    setVal('orderConfirmReplyText',      settings.orderConfirmReplyText);
    setCheck('typingDelay',              settings.typingDelay);
    
    renderKeywordsList(settings.keywords);

    // === НОВАЯ ЛОГИКА ДЛЯ КНОПОК ИЗОБРАЖЕНИЙ ===
    page.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-image-btn')) {
            const textarea = e.target.previousElementSibling;
            if (textarea && textarea.tagName === 'TEXTAREA') {
                handleImageAddClick(textarea);
            }
        }
    });
    // === КОНЕЦ НОВОЙ ЛОГИКИ ===

    // Edit state: which existing rule (if any) the add-form is currently editing.
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
        // clear any attached image from the response field
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

        // read any image attached to the response field
        let images = [];
        if (kwResponse.dataset.fptImages) { try { images = JSON.parse(kwResponse.dataset.fptImages); } catch(_){} }
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
    
    document.getElementById('addBonusBtn').addEventListener('click', async () => {
        const bonusText = document.getElementById('newBonusText').value.trim();
        if (!bonusText) {
            showNotification('Текст бонуса не может быть пустым.', true);
            return;
        }
        
        const bonuses = await saveListChange({
            arrayOps: { randomBonuses: [{ op: 'append', value: bonusText }] }
        }, 'randomBonuses', renderBonusesList);
        if (bonuses) document.getElementById('newBonusText').value = '';
    });

    document.getElementById('bonus-list-container').addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-bonus-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            const expected = e.target.dataset.value;
            await saveListChange({
                arrayOps: { randomBonuses: [{ op: 'remove', index, expected }] }
            }, 'randomBonuses', renderBonusesList);
        }
    });

    document.getElementById('keywords-list-container').addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.fpt-edit-keyword-btn');
        if (editBtn) {
            const index = parseInt(editBtn.dataset.index, 10);
            let rule;
            try { rule = JSON.parse(editBtn.closest('.keyword-item')?.dataset.rule || 'null'); }
            catch (_) { return; }
            if (!rule || typeof rule !== 'object') return;

            // load the rule into the add-form for editing
            editingKeywordIndex = index;
            editingKeywordOriginal = JSON.parse(JSON.stringify(rule));
            kwInput.value = rule.keyword || '';
            kwResponse.value = rule.response || '';
            const modeRadio = document.querySelector(`input[name="newKeywordMatchMode"][value="${rule.matchMode || 'exact'}"]`);
            if (modeRadio) modeRadio.checked = true;

            // restore attached image (if any) onto the response field
            if (typeof __fptAttachments !== 'undefined') __fptAttachments.delete(kwResponse);
            delete kwResponse.dataset.fptImages;
            delete kwResponse.dataset.fptSendOrder;
            if (Array.isArray(rule.images) && rule.images.length) {
                const arr = rule.images.map(d => ({ id: Math.random().toString(36).slice(2, 8), dataUrl: d }));
                if (typeof __fptAttachments !== 'undefined') __fptAttachments.set(kwResponse, arr);
                kwResponse.dataset.fptImages = JSON.stringify(rule.images);
                if (rule.sendOrder) kwResponse.dataset.fptSendOrder = rule.sendOrder;
            }
            if (typeof fptRenderAttachments === 'function') fptRenderAttachments(kwResponse);

            addKeywordBtn.textContent = 'Сохранить изменения';
            addKeywordBtn.classList.add('fpt-editing-rule');
            // highlight the row being edited
            document.querySelectorAll('.keyword-item.fpt-editing').forEach(el => el.classList.remove('fpt-editing'));
            editBtn.closest('.keyword-item')?.classList.add('fpt-editing');
            kwInput.focus();
            kwInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        const delBtn = e.target.closest('.delete-keyword-btn');
        if (delBtn) {
            const index = parseInt(delBtn.dataset.index, 10);
            let expected;
            try { expected = JSON.parse(delBtn.closest('.keyword-item')?.dataset.rule || 'null'); }
            catch (_) { return; }
            if (!expected || typeof expected !== 'object') return;

            const keywords = await saveListChange({
                arrayOps: { keywords: [{ op: 'remove', index, expected }] }
            }, 'keywords', renderKeywordsList);
            if (!keywords) return;
            if (editingKeywordIndex === index) resetKeywordForm();
            else if (editingKeywordIndex > index) editingKeywordIndex--;
        }
    });

    page.dataset.initialized = 'true';
}

function renderKeywordsList(keywords) {
    const listContainer = document.getElementById('keywords-list-container');
    if (!listContainer) return;
    
    if (keywords.length === 0) {
        listContainer.innerHTML = '<p class="template-info" style="text-align:center;">Нет правил для ключевых слов.</p>';
        return;
    }

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    listContainer.innerHTML = keywords.map((item, index) => {
        const modeBadge = item.matchMode === 'contains'
            ? '<span style="font-size:10px;background:var(--fpt-bg, #ffffff);padding:1px 5px;border-radius:3px;color:#7a7f9a;margin-left:4px;">содержит</span>'
            : '<span style="font-size:10px;background:var(--fpt-bg, #ffffff);padding:1px 5px;border-radius:3px;color:#7a7f9a;margin-left:4px;">точно</span>';
        // show a small icon if the rule has an attached image
        const imgMarker = (Array.isArray(item.images) && item.images.length)
            ? '<span class="material-symbols-rounded fpt-kw-img-marker" title="К правилу прикреплено изображение">image</span>'
            : '';
        return `
        <div class="keyword-item" data-index="${index}" data-rule="${esc(JSON.stringify(item))}">
            <div class="keyword-pair">
                <span class="keyword-key">${esc(item.keyword)}</span>${modeBadge}
                <span class="keyword-arrow">→</span>
                <span class="keyword-value">${esc(item.response)}</span>${imgMarker}
            </div>
            <div class="fpt-kw-actions">
                <button class="fpt-edit-keyword-btn" data-index="${index}" title="Редактировать"><span class="material-symbols-rounded">edit</span></button>
                <button class="btn btn-default delete-keyword-btn" data-index="${index}">Удалить</button>
            </div>
        </div>`;
    }).join('');
}

function renderBonusesList(bonuses) {
    const listContainer = document.getElementById('bonus-list-container');
    if (!listContainer) return;
    
    if (!bonuses || bonuses.length === 0) {
        listContainer.innerHTML = '<p class="template-info" style="text-align:center;">Добавьте хотя бы один бонус.</p>';
        return;
    }

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    listContainer.innerHTML = bonuses.map((text, index) => `
        <div class="bonus-item">
            <span class="bonus-text">${esc(text)}</span>
            <button class="btn btn-default delete-bonus-btn" data-index="${index}" data-value="${esc(text)}">Удалить</button>
        </div>
    `).join('');
}

async function initializeAutoReview() {
    // This function is no longer needed as all logic is in background.js
}
