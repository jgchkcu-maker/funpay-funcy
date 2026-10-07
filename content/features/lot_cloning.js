// content/features/lot_cloning.js

const COPIED_LOT_STORAGE_KEY = 'fpToolsCopiedLotData';
let __fpCloneState = null;

async function handlePublicLotCopy() {
    const offerId = new URLSearchParams(window.location.search).get('id');
    if (!offerId) {
        showNotification('Не удалось найти ID лота на странице.', true);
        return;
    }
    openCloneWizard(offerId);
}

// Окно «Копирование лота» - общий каркас окон расширения (content/ui/page_windows.js):
// та же палитра, фиолетовый акцент и элементы, что и в меню FunPay Funcy.
function ensureCloneWizardModal() {
    const existing = document.getElementById('fp-clone-wizard-overlay');
    if (existing) return existing;

    const win = fptWindow.create({
        id: 'fp-clone-wizard-overlay',
        dialogId: 'fp-clone-wizard',
        bodyId: 'fp-cw-body',
        footId: 'fp-cw-foot',
        closeId: 'fp-cw-close',
        title: 'Копирование лота',
        icon: 'content_copy',
        size: 'xl',
        onClose: () => { __fpCloneState = null; }
    });
    document.body.appendChild(win.scrim);
    return win.scrim;
}

function closeCloneWizard() {
    const overlay = document.getElementById('fp-clone-wizard-overlay');
    if (overlay) fptWindow.close(overlay);
    __fpCloneState = null;
}

function setCloneWizardSubtitle(text) {
    const sub = document.querySelector('#fp-clone-wizard .fpt-win-sub');
    if (!sub) return;
    sub.textContent = text || '';
    sub.hidden = !text;
}

// Состояние загрузки: спиннер и пояснение в теле, подвал пустой.
function showCloneWizardLoading(text) {
    setCloneWizardSubtitle('');
    const body = document.getElementById('fp-cw-body');
    const foot = document.getElementById('fp-cw-foot');
    if (foot) foot.innerHTML = '';
    body.innerHTML = `<div class="fpt-win-empty"><div class="fpt-win-spinner"></div>${escapeHtmlClone(text)}</div>`;
}

function showCloneWizardError(message, retry) {
    const body = document.getElementById('fp-cw-body');
    const foot = document.getElementById('fp-cw-foot');
    if (foot) foot.innerHTML = '';
    body.innerHTML = `
        <div class="fpt-win-empty fpt-win-empty--error" role="alert">
            <span class="material-symbols-rounded" aria-hidden="true">error</span>
            <p class="fpt-win-empty-title">Не удалось подготовить копию</p>
            ${escapeHtmlClone(message)}
            ${retry ? '<div style="margin-top:16px;"><button type="button" class="fpt-win-btn fpt-win-btn--sm" id="fp-cw-retry"><span class="material-symbols-rounded" aria-hidden="true">refresh</span>Повторить</button></div>' : ''}
        </div>`;
    if (retry) document.getElementById('fp-cw-retry')?.addEventListener('click', retry);
}

// FunPay Funcy: запуск ТОГО ЖЕ визарда создания лота, но из данных страницы
// купленного заказа (без offerId). Форму категории строит background по nodeId.
async function openCloneWizardFromOrder(data) {
    const overlay = ensureCloneWizardModal();
    fptWindow.open(overlay);
    showCloneWizardLoading('Готовлю форму категории и перевод EN…');

    try {
        const resp = await chrome.runtime.sendMessage({ action: 'orderBuildClone', data });
        if (!resp || !resp.success) throw new Error(resp?.error || 'Не удалось подготовить форму лота.');

        __fpCloneState = {
            offerId: null,
            source: resp.source,
            fields: resp.fields || null,
            formError: resp.formError || null,
            csrf: resp.csrf,
            createdIds: []
        };
        renderCloneReview();
    } catch (e) {
        showCloneWizardError(e.message, null);
    }
}

async function openCloneWizard(offerId) {
    const overlay = ensureCloneWizardModal();
    fptWindow.open(overlay);
    showCloneWizardLoading('Читаю лот с сервера (RU + EN + цена)…');

    try {
        const resp = await chrome.runtime.sendMessage({ action: 'cloneGetSource', offerId });
        if (!resp || !resp.success) throw new Error(resp?.error || 'Не удалось получить данные лота.');

        __fpCloneState = {
            offerId,
            source: resp.source,
            fields: resp.fields || null,
            formError: resp.formError || null,
            csrf: resp.csrf,
            createdIds: []
        };
        renderCloneReview();
    } catch (e) {
        showCloneWizardError(e.message, () => openCloneWizard(offerId));
    }
}

function escapeHtmlClone(str) {
    return String(str ?? '').replace(/[&<>"']/g, s => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]
    ));
}

function cloneNoteHtml(kind, iconName, html) {
    return `<div class="fpt-win-note" data-kind="${kind}"><span class="material-symbols-rounded" aria-hidden="true">${iconName}</span><div class="fpt-win-note-copy">${html}</div></div>`;
}

function renderCloneReview() {
    const st = __fpCloneState;
    if (!st) return;
    const body = document.getElementById('fp-cw-body');
    const foot = document.getElementById('fp-cw-foot');
    const src = st.source;

    const metaParts = [];
    if (src.categoryName) metaParts.push(src.categoryName);
    const seller = src.sellerName || (src.sellerId ? '#' + src.sellerId : '');
    if (seller) metaParts.push('продавец ' + seller);
    setCloneWizardSubtitle(metaParts.join(' · '));

    const attrRows = (src.attributePairs || []).length
        ? `<dl class="fpt-win-kv">${src.attributePairs.map(p => `
            <div class="fpt-win-kv-row">
                <dt class="fpt-win-kv-key">${escapeHtmlClone(p.label)}</dt>
                <dd class="fpt-win-kv-value" style="margin:0;">${escapeHtmlClone(p.value)}</dd>
            </div>`).join('')}</dl>`
        : '<p class="fpt-win-hint" style="margin:0;">Параметров категории не обнаружено.</p>';

    let formWarn = '';
    if (st.source.isChips) {
        formWarn = cloneNoteHtml('warning', 'info', 'Лот из раздела валюты/чипов - другая форма, серверное создание не поддерживается. Доступно копирование текстов.');
    } else if (!st.source.nodeId) {
        formWarn = cloneNoteHtml('warning', 'info', 'Не удалось определить категорию (node). Создание на сервере недоступно.');
    } else if (!st.fields) {
        formWarn = cloneNoteHtml('warning', 'info', `Не удалось построить форму категории${st.formError ? ': ' + escapeHtmlClone(st.formError) : ''}.`);
    }
    if (!st.source.enDiffers && (st.source.summary_ru || st.source.desc_ru)) {
        formWarn += cloneNoteHtml('warning', 'translate', 'У лота нет отдельного английского текста - вкладка EN заполнена русским. Если категория требует валидный английский, FunPay может отклонить - отредактируйте EN или оставьте пустым.<br><button type="button" class="fpt-win-btn fpt-win-btn--sm" id="fp-cw-translate-en"><span class="material-symbols-rounded" aria-hidden="true">translate</span>Перевести</button>');
    }

    const canCreate = !!st.fields && !st.source.isChips && !!st.source.nodeId;
    const images = src.images || [];

    body.innerHTML = `
        <div class="fpt-win-grid fp-cw-grid">
            <section class="fpt-win-card fp-cw-texts">
                <div class="fpt-win-card-head">
                    <span class="fpt-win-card-icon"><span class="material-symbols-rounded" aria-hidden="true">description</span></span>
                    <h3 class="fpt-win-card-title">Содержимое лота</h3>
                    <div class="fpt-win-seg" role="tablist" aria-label="Язык текста">
                        <button type="button" class="fpt-win-seg-btn is-active" data-tab="ru" aria-selected="true">RU</button>
                        <button type="button" class="fpt-win-seg-btn" data-tab="en" aria-selected="false">EN</button>
                    </div>
                </div>
                ${formWarn}
                <div class="fpt-win-pane" data-pane="ru">
                    <div class="fpt-win-field-group">
                        <label class="fpt-win-label" for="fp-cw-summary-ru">Название</label>
                        <textarea class="fpt-win-input" id="fp-cw-summary-ru" rows="2">${escapeHtmlClone(src.summary_ru || '')}</textarea>
                    </div>
                    <div class="fpt-win-field-group">
                        <label class="fpt-win-label" for="fp-cw-desc-ru">Описание</label>
                        <textarea class="fpt-win-input" id="fp-cw-desc-ru" rows="11">${escapeHtmlClone(src.desc_ru || '')}</textarea>
                    </div>
                </div>
                <div class="fpt-win-pane" data-pane="en" hidden>
                    <div class="fpt-win-field-group">
                        <label class="fpt-win-label" for="fp-cw-summary-en">Title</label>
                        <textarea class="fpt-win-input" id="fp-cw-summary-en" rows="2">${escapeHtmlClone(src.summary_en || '')}</textarea>
                    </div>
                    <div class="fpt-win-field-group">
                        <label class="fpt-win-label" for="fp-cw-desc-en">Description</label>
                        <textarea class="fpt-win-input" id="fp-cw-desc-en" rows="11">${escapeHtmlClone(src.desc_en || '')}</textarea>
                    </div>
                </div>
            </section>

            <div class="fpt-win-stack">
                <section class="fpt-win-card">
                    <div class="fpt-win-card-head">
                        <span class="fpt-win-card-icon"><span class="material-symbols-rounded" aria-hidden="true">tune</span></span>
                        <h3 class="fpt-win-card-title">Параметры категории</h3>
                    </div>
                    ${attrRows}
                </section>

                <section class="fpt-win-card">
                    <div class="fpt-win-card-head">
                        <span class="fpt-win-card-icon"><span class="material-symbols-rounded" aria-hidden="true">image</span></span>
                        <h3 class="fpt-win-card-title">Картинки</h3>
                        ${images.length ? `<span class="fpt-win-badge">${images.length}</span>` : ''}
                    </div>
                    ${images.length ? `
                        ${fptWindow.checkboxHtml(`Перенести картинки лота (${images.length})`, { id: 'fp-cw-opt-images', checked: true })}
                        <div class="fp-cw-thumbs">
                            ${images.map(u => `<span class="fp-cw-thumb" style="background-image:url('${escapeHtmlClone(u)}')"></span>`).join('')}
                        </div>` : '<p class="fpt-win-hint" style="margin:0;">У лота нет картинок.</p>'}
                </section>

                <section class="fpt-win-card">
                    <div class="fpt-win-card-head">
                        <span class="fpt-win-card-icon"><span class="material-symbols-rounded" aria-hidden="true">find_replace</span></span>
                        <h3 class="fpt-win-card-title">Замена текста</h3>
                    </div>
                    <div class="fpt-win-row">
                        <input type="text" class="fpt-win-input" id="fp-cw-find" placeholder="Найти…" aria-label="Найти">
                        <span class="material-symbols-rounded fpt-win-faint" aria-hidden="true" style="flex:0 0 auto;font-size:18px;">arrow_forward</span>
                        <input type="text" class="fpt-win-input" id="fp-cw-replace" placeholder="Заменить на…" aria-label="Заменить на">
                    </div>
                    <button type="button" class="fpt-win-btn fpt-win-btn--block" id="fp-cw-apply-replace" style="margin-top:10px;">Применить к текстам</button>
                    <p class="fpt-win-hint">Меняет текст во всех полях RU и EN.</p>
                </section>
            </div>
        </div>
    `;

    foot.innerHTML = `
        <div class="fpt-win-status" id="fp-cw-status" role="status" aria-live="polite"></div>
        <div class="fpt-win-actions" id="fp-cw-actions">
            <button type="button" class="fpt-win-btn" id="fp-cw-copy-text">Только тексты</button>
            <button type="button" class="fpt-win-btn fpt-win-btn--primary" id="fp-cw-create" ${canCreate ? '' : 'disabled'}>
                <span class="material-symbols-rounded" aria-hidden="true">add_circle</span>Создать лот
            </button>
        </div>
    `;

    const tabs = fptWindow.wireTabs(body.querySelector('.fp-cw-texts'));

    document.getElementById('fp-cw-apply-replace').addEventListener('click', () => {
        const find = document.getElementById('fp-cw-find').value;
        if (!find) { showNotification('Введите текст для поиска.', true); return; }
        const repl = document.getElementById('fp-cw-replace').value || '';
        ['fp-cw-summary-ru', 'fp-cw-summary-en', 'fp-cw-desc-ru', 'fp-cw-desc-en'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = el.value.split(find).join(repl);
        });
        showNotification('Замена применена.', false);
    });

    document.getElementById('fp-cw-copy-text').addEventListener('click', async () => {
        const data = {
            summary: document.getElementById('fp-cw-summary-ru').value,
            description: document.getElementById('fp-cw-desc-ru').value,
            timestamp: Date.now()
        };
        await chrome.storage.local.set({ [COPIED_LOT_STORAGE_KEY]: data });
        showNotification('Тексты сохранены. Откройте форму создания лота - появится кнопка вставки.', false);
        closeCloneWizard();
    });

    // Кнопка «Перевести» под предупреждением о EN — то же, что родная кнопка
    // перевода в форме редактирования лота: RU → EN через background (translateLotText).
    const translateBtn = document.getElementById('fp-cw-translate-en');
    if (translateBtn) {
        translateBtn.addEventListener('click', async () => {
            const ruTitle = document.getElementById('fp-cw-summary-ru')?.value || '';
            const ruDesc = document.getElementById('fp-cw-desc-ru')?.value || '';
            if (!ruTitle.trim() && !ruDesc.trim()) {
                showNotification('Нечего переводить — русские поля пусты.', true);
                return;
            }
            const label = translateBtn.lastChild;
            const origLabel = label.textContent;
            label.textContent = 'Перевожу...';
            translateBtn.disabled = true;
            try {
                const result = await chrome.runtime.sendMessage({
                    action: 'translateLotText',
                    data: { title: ruTitle, description: ruDesc, buyerMessage: '' }
                });
                if (result && result.success) {
                    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
                    setVal('fp-cw-summary-en', result.data.title);
                    setVal('fp-cw-desc-en', result.data.description);
                    // переключаемся на вкладку EN, чтобы перевод сразу было видно
                    tabs?.select('en');
                    showNotification('Текст переведён на английский.', false);
                } else {
                    throw new Error((result && result.error) || 'Неизвестная ошибка перевода.');
                }
            } catch (e) {
                showNotification(`Ошибка перевода: ${e.message}`, true);
            } finally {
                label.textContent = origLabel;
                translateBtn.disabled = false;
            }
        });
    }

    const createBtn = document.getElementById('fp-cw-create');
    if (createBtn && canCreate) createBtn.addEventListener('click', executeCloneCreate);
}

async function executeCloneCreate() {
    const st = __fpCloneState;
    if (!st || !st.fields) return;

    const createBtn = document.getElementById('fp-cw-create');
    const statusEl = document.getElementById('fp-cw-status');
    createBtn.disabled = true;

    const summaryRu = document.getElementById('fp-cw-summary-ru').value;
    const descRu = document.getElementById('fp-cw-desc-ru').value;
    const summaryEnRaw = (document.getElementById('fp-cw-summary-en')?.value || '').trim();
    const descEnRaw = (document.getElementById('fp-cw-desc-en')?.value || '').trim();
    const enReal = st.source.enDiffers;
    const summaryEn = enReal ? summaryEnRaw : (summaryEnRaw && summaryEnRaw !== summaryRu ? summaryEnRaw : '');
    const descEn = enReal ? descEnRaw : (descEnRaw && descEnRaw !== descRu ? descEnRaw : '');

    const optImages = document.getElementById('fp-cw-opt-images');
    const wantImages = optImages ? optImages.checked : false;

    let imageIds = [];
    if (wantImages && st.source.images && st.source.images.length) {
        statusEl.innerHTML = `<span class="fpt-win-spinner fpt-win-spinner--inline"></span>Переношу картинки (${st.source.images.length})…`;
        try {
            const imgResp = await chrome.runtime.sendMessage({ action: 'cloneUploadImages', urls: st.source.images });
            if (imgResp && imgResp.success) {
                imageIds = imgResp.ids || [];
                if (imgResp.errors && imgResp.errors.length) {
                    showNotification(`Часть картинок не перенеслась (${imgResp.errors.length}).`, true);
                }
            } else {
                showNotification('Картинки не перенеслись: ' + (imgResp?.error || ''), true);
            }
        } catch (e) {
            showNotification('Не удалось перенести картинки: ' + e.message, true);
        }
    }

    const fields = { ...st.fields };
    fields['offer_id'] = '0';
    fields['fields[summary][ru]'] = summaryRu;
    fields['fields[summary][en]'] = summaryEn;
    fields['fields[desc][ru]'] = descRu;
    fields['fields[desc][en]'] = descEn;
    
    // Цена: округляем до 2 знаков (длинные дроби → «Invalid price»), минимум 1.
    const fmtPrice = (v) => {
        let n = parseFloat(String(v).replace(',', '.'));
        if (Number.isNaN(n) || n <= 0) return '';
        if (n < 1) n = 1;
        return (Math.round(n * 100) / 100).toString();
    };
    let priceStr = '';
    if (st.source.finalPrice != null) priceStr = fmtPrice(st.source.finalPrice);
    if (!priceStr && st.source.rawPrice) priceStr = fmtPrice(st.source.rawPrice);
    if (priceStr) fields['price'] = priceStr;
    fields['amount'] = (st.source.amount && /^\d+$/.test(st.source.amount)) ? st.source.amount : (fields['amount'] || '1');
    fields['active'] = 'on';
    fields['secrets'] = fields['secrets'] || '';
    fields['fields[images]'] = imageIds.length ? imageIds.join(',') : (fields['fields[images]'] || '');

    statusEl.innerHTML = '<span class="fpt-win-spinner fpt-win-spinner--inline"></span>Создаю лот на сервере…';

    try {
        const resp = await chrome.runtime.sendMessage({ action: 'cloneCreateLot', fields, location: 'trade' });
        if (!resp || !resp.success) throw new Error(resp?.error || 'Ошибка создания.');

        if (resp.newId) st.createdIds.push(resp.newId);
        const link = resp.newId
            ? `<a href="https://funpay.com/lots/offerEdit?offer=${resp.newId}" target="_blank">Открыть лот →</a>`
            : '';
        statusEl.innerHTML = `<span class="fpt-win-ok">✓ Лот создан.</span> ${link}`;
        showNotification('Лот успешно создан на сервере!', false);

        const actions = document.getElementById('fp-cw-actions');
        if (resp.newId && actions && !document.getElementById('fp-cw-undo')) {
            const undo = fptWindow.button('Удалить созданный', { kind: 'danger', id: 'fp-cw-undo', iconName: 'delete' });
            actions.prepend(undo);
            undo.addEventListener('click', async () => {
                undo.disabled = true;
                const del = await chrome.runtime.sendMessage({ action: 'cloneDeleteLot', offerId: resp.newId });
                if (del && del.success) {
                    showNotification('Созданный лот удалён.', false);
                    undo.remove();
                    statusEl.textContent = 'Лот удалён.';
                } else {
                    undo.disabled = false;
                    showNotification('Не удалось удалить лот: ' + (del?.error || ''), true);
                }
            });
        }
        createBtn.disabled = false;
        createBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">add_circle</span>Создать ещё копию';
    } catch (e) {
        statusEl.innerHTML = `<span class="fpt-win-err">✗ ${escapeHtmlClone(e.message)}</span>`;
        showNotification('Ошибка: ' + e.message, true);
        createBtn.disabled = false;
    }
}

async function checkForCopiedLotData() {
    const isEditPage = window.location.pathname.includes('/lots/offerEdit');
    const isAddPage = window.location.pathname.includes('/lots/offer/add');

    if (!isEditPage && !isAddPage) {
        return;
    }

    const result = await chrome.storage.local.get(COPIED_LOT_STORAGE_KEY);
    const copiedData = result[COPIED_LOT_STORAGE_KEY];

    if (!copiedData || (Date.now() - copiedData.timestamp > 10 * 60 * 1000)) {
        await chrome.storage.local.remove(COPIED_LOT_STORAGE_KEY);
        return;
    }

    const pasteBar = createElement('div', { id: 'fp-tools-paste-bar' });
    const _hasAuto = !!copiedData.secrets;
    pasteBar.innerHTML = `
        <span class="paste-bar-icon">📋</span>
        <span class="paste-bar-text">Найдены скопированные данные лота${_hasAuto ? ' (с автовыдачей)' : ''}. Вставить их в форму?</span>
        <div class="paste-bar-actions">
            <button id="paste-lot-data-btn" class="btn btn-sm btn-primary">Вставить</button>
            <button id="decline-paste-btn" class="btn btn-sm btn-default">&times;</button>
        </div>
    `;
    
    const header = document.querySelector('h1.page-header');
    if (header) {
        header.insertAdjacentElement('afterend', pasteBar);
    }

    document.getElementById('paste-lot-data-btn').addEventListener('click', () => {
        // summary/description: подставляем RU и (если есть) EN-перевод
        setFormField('summary', copiedData.summary, copiedData.summaryEn || '');
        setFormField('desc', copiedData.description, copiedData.descriptionEn || '');

        // автовыдача (приходит со страницы заказа): включаем галку и заполняем
        // поле secrets выданными товарами.
        let autoMsg = '';
        if (copiedData.secrets) {
            const autoChk = document.querySelector('input[name="auto_delivery"]');
            if (autoChk && !autoChk.checked) {
                autoChk.checked = true;
                autoChk.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const secretsTa = document.querySelector('textarea[name="secrets"]');
            if (secretsTa) {
                secretsTa.value = copiedData.secrets;
                secretsTa.dispatchEvent(new Event('input', { bubbles: true }));
                autoMsg = ' + автовыдача';
            }
        }

        showNotification('Данные вставлены!' + autoMsg, false);
        chrome.storage.local.remove(COPIED_LOT_STORAGE_KEY);
        pasteBar.remove();
    });

    document.getElementById('decline-paste-btn').addEventListener('click', () => {
        chrome.storage.local.remove(COPIED_LOT_STORAGE_KEY);
        pasteBar.remove();
    });
}

function setFormField(baseName, valueRu, valueEn) {
    const _n = (v) => typeof v === 'string'
        ? v.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
        : v;
    valueRu = _n(valueRu); valueEn = _n(valueEn);

    const ru = document.querySelector(`[name="fields[${baseName}][ru]"]`);
    const en = document.querySelector(`[name="fields[${baseName}][en]"]`);
    const base = document.querySelector(`[name="fields[${baseName}]"]`);

    if (ru) { 
        ru.value = valueRu || ''; 
        ru.dispatchEvent(new Event('input', { bubbles: true })); 
    } else if (base) { 
        base.value = valueRu || ''; 
        base.dispatchEvent(new Event('input', { bubbles: true })); 
    }

    if (en && valueEn) { 
        en.value = valueEn; 
        en.dispatchEvent(new Event('input', { bubbles: true })); 
    }
}

// =====================================================================================
// НОВЫЙ ГЛОБАЛЬНЫЙ ИМПОРТ ЛОТА
// =====================================================================================

function ensureImportWizardModal() {
    const existing = document.getElementById('fp-import-wizard-overlay');
    if (existing) return existing;

    const win = fptWindow.create({
        id: 'fp-import-wizard-overlay',
        dialogId: 'fp-import-wizard',
        closeId: 'fp-iw-close',
        title: 'Импорт данных лота',
        subtitle: 'Перенесите тексты, цену и автовыдачу из другого лота в эту форму.',
        icon: 'move_to_inbox',
        size: 'xl',
        tall: true,
        flushBody: true
    });
    win.body.innerHTML = `
        <div class="fp-iw-layout">
            <aside class="fp-iw-side">
                <div class="fp-iw-side-tools">
                    <div class="fpt-win-seg fpt-win-seg--fill" role="tablist" aria-label="Источник">
                        <button type="button" class="fpt-win-seg-btn is-active" id="fp-iw-tab-my" aria-selected="true">Мои лоты</button>
                        <button type="button" class="fpt-win-seg-btn" id="fp-iw-tab-global" aria-selected="false">Поиск</button>
                    </div>
                    <button type="button" id="fp-iw-back-btn" class="fpt-win-btn fpt-win-btn--quiet fpt-win-btn--sm" hidden>
                        <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Назад
                    </button>
                    <input type="search" class="fpt-win-input" id="fp-iw-search" placeholder="Поиск по моим лотам..." aria-label="Поиск" autocomplete="off">
                    <button type="button" id="fp-iw-current-cat-btn" class="fpt-win-btn fpt-win-btn--sm fpt-win-btn--block" hidden>Искать в текущей категории</button>
                </div>
                <div id="fp-iw-list" class="fpt-win-list fp-iw-list"></div>
            </aside>
            <div id="fp-iw-preview" class="fp-iw-preview">
                ${importEmptyHtml('touch_app', 'Выберите лот из списка слева')}
            </div>
        </div>`;
    win.foot.innerHTML = `
        <div class="fpt-win-status" id="fp-iw-status"></div>
        <div class="fpt-win-actions">
            <button type="button" class="fpt-win-btn fpt-win-btn--primary" id="fp-iw-paste-btn" disabled>
                <span class="material-symbols-rounded" aria-hidden="true">input</span>Вставить в текущий лот
            </button>
        </div>`;
    document.body.appendChild(win.scrim);

    setupImportWizardLogic(win.scrim);

    return win.scrim;
}

function importEmptyHtml(iconName, text, kind = '') {
    return `<div class="fpt-win-empty${kind ? ` fpt-win-empty--${kind}` : ''}"><span class="material-symbols-rounded" aria-hidden="true">${iconName}</span>${text}</div>`;
}

function importLoaderHtml(text = '') {
    return `<div class="fpt-win-empty"><div class="fpt-win-spinner"></div>${text}</div>`;
}

// Пока справа нет разобранного лота, вставлять нечего.
function resetImportPaste() {
    const pasteBtn = document.getElementById('fp-iw-paste-btn');
    if (pasteBtn) { pasteBtn.disabled = true; pasteBtn.onclick = null; }
}

function openImportWizard() {
    const overlay = ensureImportWizardModal();
    fptWindow.open(overlay);
    document.getElementById('fp-iw-tab-my')?.click();
}

function closeImportWizard() {
    const overlay = document.getElementById('fp-import-wizard-overlay');
    if (overlay) fptWindow.close(overlay);
}

function setupImportWizardLogic(overlay) {
    const tabMy = overlay.querySelector('#fp-iw-tab-my');
    const tabGlobal = overlay.querySelector('#fp-iw-tab-global');
    const searchInput = overlay.querySelector('#fp-iw-search');
    const backBtn = overlay.querySelector('#fp-iw-back-btn');
    const currentCatBtn = overlay.querySelector('#fp-iw-current-cat-btn');
    const listEl = overlay.querySelector('#fp-iw-list');
    const previewEl = overlay.querySelector('#fp-iw-preview');
    const pickHint = importEmptyHtml('touch_app', 'Выберите лот из списка слева');

    let currentTab = 'my';
    let globalStep = 'game'; // game -> category -> lot
    let globalGameUrl = null;
    let globalCategoryUrl = null;
    let searchDebounceTimer = null;
    let myLotsCache = [];

    const selectTab = (tab) => {
        [tabMy, tabGlobal].forEach(t => {
            const on = t === tab;
            t.classList.toggle('is-active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    };
    const showPick = () => { previewEl.innerHTML = pickHint; resetImportPaste(); };

    // Извлечение текущей категории для кнопки "Искать в этой категории"
    let currentNodeId = null;
    const backLink = document.querySelector('a.js-back-link');
    if (backLink) {
        const m = backLink.href.match(/\/(?:lots|chips)\/(\d+)/);
        if (m) currentNodeId = m[1];
    }
    if (!currentNodeId) {
        const m = window.location.pathname.match(/\/(?:lots|chips)\/(\d+)/);
        if (m) currentNodeId = m[1];
    }
    if (!currentNodeId) {
        const nodeInput = document.querySelector('input[name="node_id"]');
        if (nodeInput) currentNodeId = nodeInput.value;
    }

    tabMy.addEventListener('click', async () => {
        currentTab = 'my';
        selectTab(tabMy);
        searchInput.placeholder = 'Поиск по моим лотам...';
        searchInput.value = '';
        searchInput.hidden = false;
        backBtn.hidden = true;
        currentCatBtn.hidden = true;

        listEl.innerHTML = importLoaderHtml();
        showPick();

        try {
            const appData = JSON.parse(document.body.dataset.appData || '{}');
            const userId = (Array.isArray(appData) ? appData[0] : appData).userId;
            const lots = await chrome.runtime.sendMessage({ action: 'getUserLotsList', userId: userId });

            myLotsCache = lots || [];
            renderMyLots();
        } catch (e) {
            listEl.innerHTML = importEmptyHtml('error', `Ошибка загрузки: ${escapeHtmlClone(e.message)}`, 'error');
        }
    });

    tabGlobal.addEventListener('click', () => {
        currentTab = 'global';
        selectTab(tabGlobal);
        globalStep = 'game';
        searchInput.placeholder = 'Название игры или ID категории...';
        searchInput.value = '';
        searchInput.hidden = false;
        backBtn.hidden = true;

        if (currentNodeId) {
            currentCatBtn.hidden = false;
            currentCatBtn.textContent = `Искать в текущей категории (#${currentNodeId})`;
        } else {
            currentCatBtn.hidden = true;
        }

        listEl.innerHTML = importEmptyHtml('search', 'Введите название игры или ID категории');
        showPick();
    });

    currentCatBtn.addEventListener('click', async () => {
        if (!currentNodeId) return;
        globalCategoryUrl = `https://funpay.com/lots/${currentNodeId}/`;
        globalStep = 'lot';
        searchInput.hidden = true;
        currentCatBtn.hidden = true;
        backBtn.hidden = false;

        listEl.innerHTML = importLoaderHtml();
        try {
            const lots = await chrome.runtime.sendMessage({ action: 'getLotList', url: globalCategoryUrl });
            renderGlobalItems(lots, 'lot');
        } catch (err) { listEl.innerHTML = importEmptyHtml('error', `Ошибка: ${escapeHtmlClone(err.message)}`, 'error'); }
    });

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        clearTimeout(searchDebounceTimer);

        if (currentTab === 'my') {
            renderMyLots(query);
        } else {
            if (globalStep === 'game') {
                if (query.match(/^\d+$/)) {
                    renderGlobalItems([{ name: 'Категория #' + query, url: 'https://funpay.com/lots/' + query + '/', count: 'Перейти' }], 'category');
                    return;
                }

                if (query.length < 2) {
                    listEl.innerHTML = importEmptyHtml('search', 'Введите название игры или ID категории');
                    return;
                }

                searchDebounceTimer = setTimeout(async () => {
                    listEl.innerHTML = importLoaderHtml();
                    try {
                        const games = await chrome.runtime.sendMessage({ action: 'searchGames', query: query });
                        renderGlobalItems(games, 'game');
                    } catch (e) {
                        listEl.innerHTML = importEmptyHtml('error', `Ошибка: ${escapeHtmlClone(e.message)}`, 'error');
                    }
                }, 400);
            }
        }
    });

    backBtn.addEventListener('click', async () => {
        listEl.innerHTML = importLoaderHtml();
        showPick();
        try {
            if (globalStep === 'lot') {
                globalStep = 'category';
                // Если мы перешли по "Текущая категория" или поиску ID, у нас нет globalGameUrl
                if (!globalGameUrl) {
                    globalStep = 'game';
                    searchInput.hidden = false;
                    backBtn.hidden = true;
                    if (currentNodeId) currentCatBtn.hidden = false;
                    searchInput.dispatchEvent(new Event('input'));
                    return;
                }
                const categories = await chrome.runtime.sendMessage({ action: 'getCategoryList', url: globalGameUrl });
                renderGlobalItems(categories, 'category');
            } else if (globalStep === 'category') {
                globalStep = 'game';
                searchInput.hidden = false;
                backBtn.hidden = true;
                if (currentNodeId) currentCatBtn.hidden = false;
                searchInput.dispatchEvent(new Event('input'));
            }
        } catch (e) {
            listEl.innerHTML = importEmptyHtml('error', `Ошибка: ${escapeHtmlClone(e.message)}`, 'error');
        }
    });

    listEl.addEventListener('click', async (e) => {
        const item = e.target.closest('.fp-iw-list-item');
        if (!item) return;

        listEl.querySelectorAll('.fp-iw-list-item').forEach(el => el.classList.remove('is-active'));
        item.classList.add('is-active');

        if (currentTab === 'my') {
            loadLotPreviewForImport(item.dataset.offerId, previewEl, true);
        } else {
            if (globalStep === 'game') {
                globalGameUrl = item.dataset.url;
                globalStep = 'category';
                searchInput.hidden = true;
                currentCatBtn.hidden = true;
                backBtn.hidden = false;
                listEl.innerHTML = importLoaderHtml();
                try {
                    const categories = await chrome.runtime.sendMessage({ action: 'getCategoryList', url: globalGameUrl });
                    renderGlobalItems(categories, 'category');
                } catch (err) { listEl.innerHTML = importEmptyHtml('error', `Ошибка: ${escapeHtmlClone(err.message)}`, 'error'); }
            } else if (globalStep === 'category') {
                globalCategoryUrl = item.dataset.url;
                globalStep = 'lot';
                listEl.innerHTML = importLoaderHtml();
                try {
                    const lots = await chrome.runtime.sendMessage({ action: 'getLotList', url: globalCategoryUrl });
                    renderGlobalItems(lots, 'lot');
                } catch (err) { listEl.innerHTML = importEmptyHtml('error', `Ошибка: ${escapeHtmlClone(err.message)}`, 'error'); }
            } else if (globalStep === 'lot') {
                loadLotPreviewForImport(item.dataset.offerId, previewEl, false);
            }
        }
    });

    function renderMyLots(filter = '') {
        if (!myLotsCache || myLotsCache.length === 0) {
            listEl.innerHTML = importEmptyHtml('inventory_2', 'Нет лотов.');
            return;
        }
        let html = '';
        myLotsCache.forEach(lot => {
            if (!filter || lot.title.toLowerCase().includes(filter)) {
                html += `
                <button type="button" class="fpt-win-item fp-iw-list-item" data-offer-id="${escapeHtmlClone(lot.id)}">
                    <span class="fpt-win-item-title">${escapeHtmlClone(lot.title)}</span>
                    <span class="fpt-win-item-meta">
                        <span>${escapeHtmlClone(lot.categoryName)}</span>
                        <span>#${escapeHtmlClone(lot.id)}</span>
                    </span>
                </button>`;
            }
        });
        listEl.innerHTML = html || importEmptyHtml('search_off', 'Ничего не найдено.');
    }

    function renderGlobalItems(items, type) {
        if (!items || items.length === 0) {
            listEl.innerHTML = importEmptyHtml('search_off', 'Ничего не найдено.');
            return;
        }
        let html = '';
        if (type === 'game') {
            items.forEach(g => {
                html += `<button type="button" class="fpt-win-item fp-iw-list-item fp-iw-game" data-url="${escapeHtmlClone(g.url)}">
                    <img src="${escapeHtmlClone(g.img)}" alt="" onerror="this.style.display='none'">
                    <span class="fpt-win-item-title">${escapeHtmlClone(g.name)}</span>
                </button>`;
            });
        } else if (type === 'category') {
            items.forEach(c => {
                html += `<button type="button" class="fpt-win-item fp-iw-list-item fp-iw-category" data-url="${escapeHtmlClone(c.url)}">
                    <span class="fpt-win-item-title">${escapeHtmlClone(c.name)}</span>
                    <span class="fpt-win-badge">${escapeHtmlClone(c.count)}</span>
                </button>`;
            });
        } else if (type === 'lot') {
            items.forEach(l => {
                html += `<button type="button" class="fpt-win-item fp-iw-list-item" data-offer-id="${escapeHtmlClone(l.offerId)}">
                    <span class="fpt-win-item-title">${escapeHtmlClone(l.description)}</span>
                    <span class="fpt-win-item-meta">
                        <span>Продавец: ${escapeHtmlClone(l.seller)}</span>
                        <span class="fp-iw-price">${escapeHtmlClone(l.price)}</span>
                    </span>
                </button>`;
            });
        }
        listEl.innerHTML = html;
    }
}

async function loadLotPreviewForImport(offerId, previewEl, isOwn = true) {
    if (!offerId) return;
    resetImportPaste();

    // FIX 2.9.3: чипс-лоты (валюта/платина и т.п.) - другой тип предложения. У них
    // НЕТ формы offerEdit с описанием/сообщением покупателю/автовыдачей: только
    // наличие и цена за единицу, привязанные к серверу/платформе. Импортировать там
    // по сути нечего. Чипс легко узнать по составному id (с дефисами), напр.
    // "15858540-35-37-10046-0". Показываем дружелюбное пояснение вместо ошибки.
    if (/-/.test(String(offerId))) {
        previewEl.innerHTML = `
            <div class="fpt-win-empty" style="max-width:360px;">
                <span class="material-symbols-rounded" aria-hidden="true">currency_exchange</span>
                <p class="fpt-win-empty-title">Это лот валюты (chips)</p>
                Такие предложения (платина, валюта, голда и т.п.) устроены иначе:
                в них нет описания, сообщения покупателю или автовыдачи - только
                наличие и цена за единицу для конкретного сервера. Импортировать здесь нечего.
            </div>`;
        return;
    }

    previewEl.innerHTML = importLoaderHtml('Анализирую лот...');
    try {
        let source;
        if (isOwn) {
            // FIX 2.9.1: СВОИ лоты читаем через getOwnLotFull (форма offerEdit владельца) -
            // там есть сообщение покупателю, товары автовыдачи и цена, и не меняется локаль.
            const resp = await chrome.runtime.sendMessage({ action: 'getOwnLotFull', offerId });
            if (!resp || !resp.success) {
                // мягкий фолбэк: если форму разобрать не удалось (нестандартный лот) -
                // не пугаем красной ошибкой, а поясняем по-человечески.
                previewEl.innerHTML = `
                    <div class="fpt-win-empty" style="max-width:360px;">
                        <span class="material-symbols-rounded" aria-hidden="true">help</span>
                        <p class="fpt-win-empty-title">Не удалось прочитать этот лот</p>
                        Похоже, у него нестандартная форма (например, валюта или особая категория),
                        и импортировать из него нечего. Попробуйте другой лот.
                    </div>`;
                return;
            }
            source = resp.source;
        } else {
            // FIX 2.9.2: ЧУЖИЕ лоты - как было в 2.8: через cloneGetSource (публичная
            // страница лота). offerEdit для чужого лота недоступен, поэтому getOwnLotFull
            // тут НЕЛЬЗЯ. У чужих лотов нет payment_msg/secrets - это нормально.
            const resp = await chrome.runtime.sendMessage({ action: 'cloneGetSource', offerId });
            if (!resp || !resp.success) throw new Error(resp?.error || 'Не удалось получить данные лота.');
            source = resp.source;
        }
        renderImportPreviewPanel(source, previewEl);
    } catch (e) {
        previewEl.innerHTML = importEmptyHtml('error', `Ошибка: ${escapeHtmlClone(e.message)}`, 'error');
    }
}

function renderImportPreviewPanel(src, previewEl) {
    const check = (label, id, checked) => fptWindow.checkboxHtml(label, { id, checked });
    const secretsCount = src.secrets ? String(src.secrets).split('\n').filter(Boolean).length : 0;

    previewEl.innerHTML = `
        <div class="fpt-win-stack">
            <section class="fpt-win-card">
                <div class="fpt-win-card-head">
                    <span class="fpt-win-card-icon"><span class="material-symbols-rounded" aria-hidden="true">checklist</span></span>
                    <h3 class="fpt-win-card-title">Что импортировать</h3>
                    <span class="fpt-win-card-note">Цена: <span class="fpt-win-strong">${escapeHtmlClone(src.rawPrice || '-')}</span></span>
                </div>
                <div class="fpt-win-checks">
                    ${check('Название', 'fp-iw-opt-title', true)}
                    ${check('Описание', 'fp-iw-opt-desc', true)}
                    ${check('Цена', 'fp-iw-opt-price', true)}
                    ${src.isOwn ? check('Сообщение покупателю', 'fp-iw-opt-paymsg', true) : ''}
                    ${src.isOwn ? check('Автовыдача', 'fp-iw-opt-secrets', !!src.autoDelivery) : ''}
                </div>
            </section>

            <section class="fpt-win-card fp-iw-texts">
                <div class="fpt-win-card-head">
                    <span class="fpt-win-card-icon"><span class="material-symbols-rounded" aria-hidden="true">description</span></span>
                    <h3 class="fpt-win-card-title">Тексты лота</h3>
                    <div class="fpt-win-seg" role="tablist" aria-label="Язык текста">
                        <button type="button" class="fpt-win-seg-btn is-active" data-tab="ru" aria-selected="true">RU</button>
                        <button type="button" class="fpt-win-seg-btn" data-tab="en" aria-selected="false">EN</button>
                    </div>
                </div>
                <div class="fpt-win-pane" data-pane="ru">
                    <div class="fpt-win-field-group">
                        <label class="fpt-win-label" for="fp-iw-val-title-ru">Краткое описание</label>
                        <textarea class="fpt-win-input" id="fp-iw-val-title-ru" rows="2" readonly>${escapeHtmlClone(src.summary_ru)}</textarea>
                    </div>
                    <div class="fpt-win-field-group">
                        <label class="fpt-win-label" for="fp-iw-val-desc-ru">Подробное описание</label>
                        <textarea class="fpt-win-input" id="fp-iw-val-desc-ru" rows="6" readonly>${escapeHtmlClone(src.desc_ru)}</textarea>
                    </div>
                    ${src.isOwn ? `<div class="fpt-win-field-group">
                        <label class="fpt-win-label" for="fp-iw-val-paymsg-ru">Сообщение покупателю после оплаты</label>
                        <textarea class="fpt-win-input" id="fp-iw-val-paymsg-ru" rows="4" readonly>${escapeHtmlClone(src.payment_msg_ru || '')}</textarea>
                    </div>` : ''}
                </div>
                <div class="fpt-win-pane" data-pane="en" hidden>
                    <div class="fpt-win-field-group">
                        <label class="fpt-win-label" for="fp-iw-val-title-en">Short description</label>
                        <textarea class="fpt-win-input" id="fp-iw-val-title-en" rows="2" readonly>${escapeHtmlClone(src.summary_en)}</textarea>
                    </div>
                    <div class="fpt-win-field-group">
                        <label class="fpt-win-label" for="fp-iw-val-desc-en">Detailed description</label>
                        <textarea class="fpt-win-input" id="fp-iw-val-desc-en" rows="6" readonly>${escapeHtmlClone(src.desc_en)}</textarea>
                    </div>
                    ${src.isOwn ? `<div class="fpt-win-field-group">
                        <label class="fpt-win-label" for="fp-iw-val-paymsg-en">Message to the buyer after payment</label>
                        <textarea class="fpt-win-input" id="fp-iw-val-paymsg-en" rows="4" readonly>${escapeHtmlClone(src.payment_msg_en || '')}</textarea>
                    </div>` : ''}
                </div>
            </section>

            ${src.secrets ? `
            <section class="fpt-win-card">
                <div class="fpt-win-card-head">
                    <span class="fpt-win-card-icon"><span class="material-symbols-rounded" aria-hidden="true">bolt</span></span>
                    <h3 class="fpt-win-card-title">Товары автовыдачи</h3>
                    <span class="fpt-win-badge">${secretsCount} шт.</span>
                </div>
                <textarea class="fpt-win-input" id="fp-iw-val-secrets" rows="4" readonly aria-label="Товары автовыдачи">${escapeHtmlClone(src.secrets)}</textarea>
            </section>` : ''}
        </div>
    `;

    fptWindow.wireTabs(previewEl.querySelector('.fp-iw-texts'));

    const pasteBtn = document.getElementById('fp-iw-paste-btn');
    if (!pasteBtn) return;
    pasteBtn.disabled = false;
    pasteBtn.onclick = () => {
        const doTitle = previewEl.querySelector('#fp-iw-opt-title').checked;
        const doDesc = previewEl.querySelector('#fp-iw-opt-desc').checked;
        const doPrice = previewEl.querySelector('#fp-iw-opt-price').checked;
        const doPayMsg = previewEl.querySelector('#fp-iw-opt-paymsg')?.checked;
        const doSecrets = previewEl.querySelector('#fp-iw-opt-secrets')?.checked;

        if (doTitle) setFormField('summary', src.summary_ru, src.summary_en);
        if (doDesc) setFormField('desc', src.desc_ru, src.desc_en);
        if (doPayMsg) setFormField('payment_msg', src.payment_msg_ru || '', src.payment_msg_en || '');
        if (doPrice && src.rawPrice) {
            const priceInp = document.querySelector('input[name="price"]');
            if (priceInp) { priceInp.value = src.rawPrice; priceInp.dispatchEvent(new Event('input', { bubbles: true })); }
        }
        if (doSecrets && src.secrets) {
            // включаем галку автовыдачи и подставляем товары
            const autoChk = document.querySelector('input[name="auto_delivery"]');
            if (autoChk && !autoChk.checked) { autoChk.checked = true; autoChk.dispatchEvent(new Event('change', { bubbles: true })); }
            const secretsTa = document.querySelector('textarea[name="secrets"]');
            if (secretsTa) { secretsTa.value = src.secrets; secretsTa.dispatchEvent(new Event('input', { bubbles: true })); }
        }

        // Себестоимость: собственный лот может наследовать при наличии offerId, чужой лот никогда не наследует
        if (src && src.isOwn && src.offerId && window.FPTCostBasis && typeof window.FPTCostBasis.get === 'function') {
            window.FPTCostBasis.get(src.offerId).then((costRec) => {
                const costInp = document.getElementById('fpt-cost-basis-input');
                if (costInp && costRec && costRec.amount > 0) {
                    costInp.value = (Math.round(costRec.amount * 100) / 100).toString().replace('.', ',');
                    costInp.dispatchEvent(new Event('input', { bubbles: true }));
                    costInp.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }).catch(() => {});
        } else if (src && !src.isOwn) {
            // foreign clone никогда не наследует себестоимость
            const costInp = document.getElementById('fpt-cost-basis-input');
            if (costInp && costInp.value) {
                costInp.value = '';
                costInp.dispatchEvent(new Event('input', { bubbles: true }));
                costInp.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        showNotification('Данные успешно импортированы в форму!', false);
        closeImportWizard();
    };
}

async function submitForm(formData) {
    const nodeId = new URLSearchParams(window.location.search).get('node');
    formData.set('node_id', nodeId); formData.set('offer_id', '0');
    try {
        const response = await fetch('https://funpay.com/lots/offerSave', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: new URLSearchParams(formData)
        });
        if (response.ok && !/\/account\/login/.test(response.url)) {
            showNotification('Лот успешно продублирован!');
        } else if (/\/account\/login/.test(response.url)) {
            console.error('Ошибка при копировании лота: редирект на логин', response);
            showNotification('Сессия FunPay устарела. Обновите страницу funpay.com и повторите.', true);
        } else {
            console.error('Ошибка при копировании лота', response);
            showNotification('Ошибка при копировании лота', true);
        }
    } catch (error) { console.error('Ошибка при выполнении запроса', error); showNotification('Ошибка при выполнении запроса', true); }
}

// Окно «Клонирование лота» на странице редактирования: полная копия или копии в других
// значениях параметров категории.
function openLotCloneMenu() {
    let scrim = document.getElementById('fp-clone-menu');
    if (!scrim) {
        const win = fptWindow.create({
            id: 'fp-clone-menu',
            title: 'Клонирование лота',
            subtitle: 'Создаёт копию этого лота на FunPay из текущей формы.',
            icon: 'content_copy',
            size: 'sm',
            footer: false
        });
        win.body.innerHTML = `
            <div class="fpt-win-options">
                <button type="button" class="fpt-win-option" id="fullClone">
                    <span class="fpt-win-card-icon"><span class="material-symbols-rounded" aria-hidden="true">content_copy</span></span>
                    <span class="fpt-win-option-copy">
                        <span class="fpt-win-option-title">Скопировать полностью</span>
                        <span class="fpt-win-option-desc">Новый лот с той же категорией, текстами и ценой.</span>
                    </span>
                    <span class="material-symbols-rounded fpt-win-option-arrow" aria-hidden="true">chevron_right</span>
                </button>
                <button type="button" class="fpt-win-option" id="changeCategoryClone">
                    <span class="fpt-win-card-icon"><span class="material-symbols-rounded" aria-hidden="true">call_split</span></span>
                    <span class="fpt-win-option-copy">
                        <span class="fpt-win-option-title">Поменять категорию и скопировать</span>
                        <span class="fpt-win-option-desc">Отметьте другие значения параметров - для каждой комбинации появится своя копия.</span>
                    </span>
                    <span class="material-symbols-rounded fpt-win-option-arrow" aria-hidden="true">chevron_right</span>
                </button>
            </div>`;
        document.body.appendChild(win.scrim);
        scrim = win.scrim;

        scrim.querySelector('#fullClone').addEventListener('click', () => {
            fptWindow.close(scrim);
            const form = document.querySelector('form.form-offer-editor');
            if (!form) { showNotification('Форма редактирования лота не найдена!', true); return; }
            submitForm(new FormData(form));
        });
        scrim.querySelector('#changeCategoryClone').addEventListener('click', () => {
            fptWindow.close(scrim, { immediate: true });
            openCategoryCloneWindow();
        });
    }
    fptWindow.open(scrim);
}

function openCategoryCloneWindow() {
    const selects = document.querySelectorAll('select.form-control.lot-field-input, select.form-control[name="server_id"]');
    const categoryData = {};
    selects.forEach(select => {
        const labelElement = select.closest('.form-group')?.querySelector('label');
        const label = labelElement ? labelElement.textContent.trim().replace('*', '') : (select.name === 'server_id' ? 'Сервер' : 'Категория');
        if (!categoryData[label]) categoryData[label] = { name: select.name, options: [] };
        select.querySelectorAll('option').forEach(option => { if (option.value) categoryData[label].options.push({ value: option.value, text: option.textContent.trim() }); });
    });

    document.getElementById('fp-category-clone')?.remove();
    const win = fptWindow.create({
        id: 'fp-category-clone',
        title: 'Копии в других категориях',
        subtitle: 'Отметьте значения параметров. Копия создаётся для каждой комбинации.',
        icon: 'call_split',
        size: 'md',
        removeOnClose: true
    });
    const groups = Object.entries(categoryData).filter(([, data]) => data.options.length);
    win.body.innerHTML = groups.length ? `<div class="fpt-win-stack">${groups.map(([label, data]) => `
        <section class="fpt-win-card fp-cc-group" data-name="${escapeHtmlClone(data.name)}">
            <div class="fpt-win-card-head">
                <h3 class="fpt-win-card-title">${escapeHtmlClone(label)}</h3>
                ${fptWindow.checkboxHtml('Выбрать все', { extra: 'class="fp-cc-all"' })}
            </div>
            <div class="fp-cc-options">
                ${data.options.map(option => fptWindow.checkboxHtml(option.text, { extra: `class="fp-cc-option" value="${escapeHtmlClone(option.value)}"` })).join('')}
            </div>
        </section>`).join('')}</div>`
        : importEmptyHtml('category', 'На этой странице нет параметров категории, которые можно поменять.');
    win.foot.innerHTML = `
        <div class="fpt-win-status" id="cloneWarning" role="status"></div>
        <div class="fpt-win-actions">
            <button type="button" class="fpt-win-btn fpt-win-btn--quiet" id="closeCategoryMenu">Закрыть</button>
            <button type="button" class="fpt-win-btn fpt-win-btn--primary" id="copyWithCategory" disabled>Копировать</button>
        </div>`;
    document.body.appendChild(win.scrim);
    fptWindow.open(win.scrim);

    const warningDiv = win.foot.querySelector('#cloneWarning');
    const copyBtn = win.foot.querySelector('#copyWithCategory');

    // Комбинации: декартово произведение отмеченных значений по каждому параметру.
    const selectedCombos = () => {
        let combinations = [{}];
        let hasSelections = false;
        win.body.querySelectorAll('.fp-cc-group').forEach(group => {
            const values = Array.from(group.querySelectorAll('.fp-cc-option:checked')).map(input => input.value);
            if (!values.length) return;
            hasSelections = true;
            const next = [];
            combinations.forEach(combo => values.forEach(value => next.push({ ...combo, [group.dataset.name]: value })));
            combinations = next;
        });
        return hasSelections ? combinations : [];
    };

    const updateState = () => {
        win.body.querySelectorAll('.fp-cc-group').forEach(group => {
            const options = group.querySelectorAll('.fp-cc-option');
            const checked = group.querySelectorAll('.fp-cc-option:checked').length;
            const all = group.querySelector('.fp-cc-all');
            all.checked = checked > 0 && checked === options.length;
            all.indeterminate = checked > 0 && checked < options.length;
        });
        const count = selectedCombos().length;
        copyBtn.disabled = count === 0;
        copyBtn.textContent = count ? `Копировать (${count})` : 'Копировать';
        warningDiv.textContent = count
            ? `Будет создано копий: ${count}.`
            : 'Выберите хотя бы одно значение.';
    };

    win.body.addEventListener('change', event => {
        if (event.target.matches('.fp-cc-all')) {
            const group = event.target.closest('.fp-cc-group');
            group.querySelectorAll('.fp-cc-option').forEach(input => { input.checked = event.target.checked; });
        }
        updateState();
    });
    updateState();

    win.foot.querySelector('#closeCategoryMenu').addEventListener('click', () => win.close());
    copyBtn.addEventListener('click', async () => {
        const form = document.querySelector('form.form-offer-editor');
        if (!form) { showNotification('Форма редактирования лота не найдена!', true); return; }
        const combinations = selectedCombos();
        if (!combinations.length) { showNotification('Не выбрано ни одной категории для копирования.', true); return; }
        const baseFormData = new FormData(form);
        win.close();
        showNotification(`Начинается копирование ${combinations.length} лотов...`, false);
        let count = 0;
        for (const combo of combinations) {
            count++;
            const clonedFormData = new FormData();
            for (const [key, value] of baseFormData.entries()) clonedFormData.append(key, value);
            for (const fieldName in combo) clonedFormData.set(fieldName, combo[fieldName]);
            await submitForm(clonedFormData);
            if (count < combinations.length) await new Promise(resolve => setTimeout(resolve, 1200));
        }
        showNotification(`Копирование ${combinations.length} лотов завершено!`, false);
    });
}

function initializeLotCloning() {
    checkForCopiedLotData();

    const header = Array.from(document.querySelectorAll('h1.page-header.page-header-no-hr')).find(h1 => h1.textContent.includes('Редактирование предложения') || h1.textContent.includes('Добавление предложения'));
    if (!header) return;

    let actionsContainer = document.querySelector('.fp-tools-lot-edit-actions-container');
    if (!actionsContainer) {
        actionsContainer = createElement('div', { class: 'fp-tools-lot-edit-actions-container' });
        header.parentNode.insertBefore(actionsContainer, header.nextSibling);
    }
    
    if (!document.querySelector('.fp-tools-clone-btn')) {
        const cloneButton = createElement('button', { class: 'btn btn-default fp-tools-clone-btn' }, {}, 'Копировать');
        actionsContainer.appendChild(cloneButton);
        cloneButton.addEventListener('click', (event) => {
            event.preventDefault();
            openLotCloneMenu();
        });
    }

    if (!document.querySelector('.fp-tools-import-btn')) {
        const importButton = createElement('button', { class: 'btn btn-default fp-tools-import-btn' }, {}, 'Импорт');
        actionsContainer.appendChild(importButton);

        importButton.addEventListener('click', async () => {
            openImportWizard();
        });
    }
}