function fpAdCreateElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
}

function fpAdCreateStateIcon(kind) {
    const wrapper = document.createElement('span');
    wrapper.className = 'fp-ad-state-icon-slot';
    const paths = {
        loading: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7" opacity=".25"/><path d="M20.5 12A8.5 8.5 0 0 0 12 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
        empty: '<path d="M5 7.5h14M7.5 4.5h9A1.5 1.5 0 0 1 18 6v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18V6a1.5 1.5 0 0 1 1.5-1.5ZM9 11h6M9 14.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
        error: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.8v5.1M12 16.4h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
    };
    wrapper.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">${paths[kind] || paths.empty}</svg>`;
    return wrapper;
}

function renderDeliveryState(container, kind, title, message) {
    container.replaceChildren();
    container.dataset.state = kind;
    container.setAttribute('aria-busy', kind === 'loading' ? 'true' : 'false');

    const state = fpAdCreateElement('div', `fpt-ui-state fp-ad-list-state fp-ad-list-state--${kind}`);
    state.dataset.state = kind;
    state.appendChild(fpAdCreateStateIcon(kind));
    state.appendChild(fpAdCreateElement('p', 'fpt-ui-state-title', title));
    state.appendChild(fpAdCreateElement('p', 'fpt-ui-state-text', message));
    container.appendChild(state);
}

function setAutoDeliveryLoadState(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.setAttribute('aria-busy', loading ? 'true' : 'false');
    button.classList.toggle('is-loading', loading);
    const label = button.querySelector('.fp-ad-load-label');
    if (label) label.textContent = loading ? 'Загружаем…' : 'Загрузить лоты';
}

function initAutoDeliveryUI() {
    const page = document.querySelector('.fp-tools-page-content[data-page="auto_delivery"]');
    if (!page || page.dataset.initialized) return;
    page.dataset.initialized = 'true';

    const loadBtn = document.getElementById('fp-load-delivery-lots-btn');
    const listEl = document.getElementById('fp-delivery-lots-list');
    if (!loadBtn || !listEl) return;

    loadBtn.addEventListener('click', async () => {
        setAutoDeliveryLoadState(loadBtn, true);
        renderDeliveryState(listEl, 'loading', 'Загружаем лоты', 'Получаем список ваших лотов и сохранённые настройки автовыдачи.');

        try {
            const appData = JSON.parse(document.body.dataset.appData || '{}');
            const d = Array.isArray(appData) ? appData[0] : appData;
            const userId = d.userId;
            if (!userId) throw new Error('Не удалось определить пользователя FunPay');

            const lots = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ action: 'getUserLotsList', userId }, res => {
                    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                    else resolve(res || []);
                });
            });

            if (!lots.length) {
                renderDeliveryState(listEl, 'empty', 'Лоты не найдены', 'На аккаунте нет доступных лотов для настройки автовыдачи.');
                return;
            }

            const { fpToolsAutoDeliveryLots = {} } = await chrome.storage.local.get('fpToolsAutoDeliveryLots');
            renderDeliveryLots(lots, fpToolsAutoDeliveryLots, listEl);
        } catch (error) {
            renderDeliveryState(listEl, 'error', 'Не удалось загрузить лоты', error.message || 'Попробуйте повторить загрузку.');
            if (typeof showNotification === 'function') showNotification(`Ошибка: ${error.message}`, true);
        } finally {
            setAutoDeliveryLoadState(loadBtn, false);
        }
    });
}

function createDeliveryCheckbox(className, lotId, checked, labelText) {
    const label = fpAdCreateElement('label', `fpt-ui-checkbox-row fp-ad-inline-option ${className}-row`);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = className;
    input.dataset.lotId = lotId;
    input.checked = !!checked;
    label.appendChild(input);
    label.appendChild(fpAdCreateElement('span', '', labelText));
    return { label, input };
}

function createDeliveryRadio(name, value, checked, labelText) {
    const label = fpAdCreateElement('label', 'fp-tools-radio-option fp-ad-mode-option');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.checked = !!checked;
    label.appendChild(input);
    label.appendChild(fpAdCreateElement('span', '', labelText));
    return label;
}

function createDeliveryLotCard(lot, lotConfig) {
    const lotId = String(lot.id);
    const item = fpAdCreateElement('article', 'fp-ad-lot-card');
    item.dataset.lotId = lotId;

    const summary = fpAdCreateElement('div', 'fp-ad-lot-summary');
    const titleWrap = fpAdCreateElement('div', 'fp-ad-lot-title-wrap');
    const title = fpAdCreateElement('div', 'fp-ad-lot-title', lot.title || `Лот #${lotId}`);
    title.title = lot.title || `Лот #${lotId}`;

    const meta = fpAdCreateElement('div', 'fp-ad-lot-meta');
    const count = lotConfig.productCount;
    const countBadge = fpAdCreateElement('span', 'fp-ad-product-count');
    countBadge.dataset.lotId = lotId;
    if (count === undefined) {
        countBadge.classList.add('is-unknown');
        countBadge.textContent = 'Остаток не отслеживается';
    } else if (count === 0) {
        countBadge.classList.add('is-empty');
        countBadge.textContent = 'Склад пуст';
    } else {
        countBadge.classList.add('is-stocked');
        countBadge.textContent = `На складе: ${count} шт.`;
    }
    meta.appendChild(countBadge);
    titleWrap.append(title, meta);

    const enabled = createDeliveryCheckbox('fp-ad-enabled', lotId, lotConfig.enabled, 'Автовыдача');
    enabled.label.classList.add('fp-ad-enabled-control');
    summary.append(titleWrap, enabled.label);
    item.appendChild(summary);

    const settings = fpAdCreateElement('div', 'fp-ad-settings');
    settings.dataset.lotId = lotId;
    settings.hidden = !lotConfig.enabled;

    const modeBlock = fpAdCreateElement('div', 'fp-ad-mode-block');
    const modeLabel = fpAdCreateElement('div', 'fp-ad-field-label', 'Источник выдачи');
    const modeGroup = fpAdCreateElement('div', 'fp-tools-radio-group fp-ad-mode-group');
    const modeName = `fp-ad-mode-${lotId}`;
    const currentMode = lotConfig.mode || 'secrets';
    modeGroup.append(
        createDeliveryRadio(modeName, 'secrets', currentMode === 'secrets', 'Секреты лота'),
        createDeliveryRadio(modeName, 'template', currentMode === 'template', 'Свой шаблон')
    );
    modeBlock.append(modeLabel, modeGroup);
    settings.appendChild(modeBlock);

    const templateArea = fpAdCreateElement('div', 'fp-ad-template-area');
    templateArea.dataset.lotId = lotId;
    templateArea.hidden = currentMode !== 'template';
    const templateLabel = fpAdCreateElement('label', 'fp-ad-field-label', 'Шаблон выдачи');
    templateLabel.htmlFor = `fp-ad-template-${lotId}`;
    const textarea = fpAdCreateElement('textarea', 'template-input fp-ad-template-text');
    textarea.id = `fp-ad-template-${lotId}`;
    textarea.dataset.lotId = lotId;
    textarea.placeholder = 'Текст выдачи. Переменные доступны в подсказке над списком.';
    textarea.value = lotConfig.text || '';
    templateArea.append(templateLabel, textarea);
    settings.appendChild(templateArea);

    const automation = fpAdCreateElement('div', 'fp-ad-lot-automation');
    automation.append(
        createDeliveryCheckbox('fp-ad-auto-restore', lotId, lotConfig.autoRestoreEnabled !== false, 'Автовосстановление').label,
        createDeliveryCheckbox('fp-ad-auto-disable', lotId, lotConfig.autoDisableEnabled !== false, 'Деактивация при пустом складе').label
    );
    settings.appendChild(automation);

    const actions = fpAdCreateElement('div', 'fp-ad-lot-actions');
    const save = fpAdCreateElement('button', 'fpt-ui-button fpt-ui-button--secondary fp-ad-save-btn', 'Сохранить');
    save.type = 'button';
    save.dataset.lotId = lotId;
    actions.appendChild(save);
    settings.appendChild(actions);

    item.appendChild(settings);
    return item;
}

function renderDeliveryLots(lots, config, container) {
    container.replaceChildren();
    container.dataset.state = 'loaded';
    container.setAttribute('aria-busy', 'false');

    const byCategory = new Map();
    lots.forEach(lot => {
        const categoryName = lot.categoryName || 'Без категории';
        if (!byCategory.has(categoryName)) byCategory.set(categoryName, []);
        byCategory.get(categoryName).push(lot);
    });

    for (const [categoryName, categoryLots] of byCategory.entries()) {
        const category = fpAdCreateElement('section', 'fp-ad-category');
        const heading = fpAdCreateElement('div', 'fp-ad-category-header');
        heading.append(
            fpAdCreateElement('h5', 'fp-ad-category-title', categoryName),
            fpAdCreateElement('span', 'fp-ad-category-count', `${categoryLots.length} ${categoryLots.length === 1 ? 'лот' : 'лотов'}`)
        );
        category.appendChild(heading);

        const cards = fpAdCreateElement('div', 'fp-ad-category-list');
        categoryLots.forEach(lot => {
            cards.appendChild(createDeliveryLotCard(lot, config[String(lot.id)] || {}));
        });
        category.appendChild(cards);
        container.appendChild(category);
    }

    container.querySelectorAll('.fp-ad-enabled').forEach(cb => {
        cb.addEventListener('change', () => {
            const lotId = cb.dataset.lotId;
            const settingsArea = container.querySelector(`.fp-ad-settings[data-lot-id="${lotId}"]`);
            if (settingsArea) settingsArea.hidden = !cb.checked;
            autoSaveDeliveryLot(lotId, container);
        });
    });

    container.querySelectorAll('input[name^="fp-ad-mode-"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const lotId = radio.name.replace('fp-ad-mode-', '');
            const templateArea = container.querySelector(`.fp-ad-template-area[data-lot-id="${lotId}"]`);
            if (templateArea) templateArea.hidden = radio.value !== 'template';
        });
    });

    container.querySelectorAll('.fp-ad-save-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const lotId = button.dataset.lotId;
            button.disabled = true;
            button.textContent = 'Сохраняем…';
            try {
                await autoSaveDeliveryLot(lotId, container);
                button.textContent = 'Сохранено';
                button.classList.add('is-saved');
                setTimeout(() => {
                    button.textContent = 'Сохранить';
                    button.classList.remove('is-saved');
                    button.disabled = false;
                }, 1200);
            } catch (error) {
                button.textContent = 'Ошибка сохранения';
                button.classList.add('is-error');
                button.disabled = false;
                if (typeof showNotification === 'function') showNotification(`Ошибка: ${error.message}`, true);
            }
        });
    });
}

async function autoSaveDeliveryLot(lotId, container) {
    const { fpToolsAutoDeliveryLots = {} } = await chrome.storage.local.get('fpToolsAutoDeliveryLots');

    const enabledEl = container.querySelector(`.fp-ad-enabled[data-lot-id="${lotId}"]`);
    const modeEl = container.querySelector(`input[name="fp-ad-mode-${lotId}"]:checked`);
    const textEl = container.querySelector(`.fp-ad-template-text[data-lot-id="${lotId}"]`);
    const restoreEl = container.querySelector(`.fp-ad-auto-restore[data-lot-id="${lotId}"]`);
    const disableEl = container.querySelector(`.fp-ad-auto-disable[data-lot-id="${lotId}"]`);

    fpToolsAutoDeliveryLots[String(lotId)] = {
        enabled: enabledEl?.checked ?? false,
        mode: modeEl?.value || 'secrets',
        text: textEl?.value || '',
        autoRestoreEnabled: restoreEl?.checked !== false,
        autoDisableEnabled: disableEl?.checked !== false,
        productCount: fpToolsAutoDeliveryLots[String(lotId)]?.productCount ?? 0,
        updatedAt: Date.now()
    };

    await chrome.storage.local.set({ fpToolsAutoDeliveryLots });
}

async function initStockCounterDisplay() {
    if (!window.location.pathname.match(/\/users\/\d+\/?/)) return;

    const { fpToolsAutoDeliveryLots = {} } = await chrome.storage.local.get('fpToolsAutoDeliveryLots');
    if (!Object.keys(fpToolsAutoDeliveryLots).length) return;

    document.querySelectorAll('a.tc-item:not(.fp-stock-init)').forEach(row => {
        row.classList.add('fp-stock-init');
        const offerMatch = row.getAttribute('href')?.match(/id=(\d+)/);
        if (!offerMatch) return;
        const lotId = offerMatch[1];
        const config = fpToolsAutoDeliveryLots[String(lotId)];
        if (!config?.enabled) return;

        const priceEl = row.querySelector('.tc-price');
        if (!priceEl) return;

        const count = config.productCount ?? 0;
        const badge = document.createElement('span');
        badge.style.cssText = `
            font-size:10px;font-weight:700;border-radius:3px;padding:1px 4px;margin-left:4px;
            background:${count > 3 ? 'rgba(76,175,130,0.15)' : count > 0 ? 'rgba(255,152,0,0.15)' : 'rgba(224,82,82,0.15)'};
            color:${count > 3 ? '#4caf82' : count > 0 ? '#ff9800' : '#e05252'};
            border:1px solid ${count > 3 ? 'rgba(76,175,130,0.3)' : count > 0 ? 'rgba(255,152,0,0.3)' : 'rgba(224,82,82,0.3)'};
            vertical-align:middle;
        `;
        badge.textContent = count > 0 ? `📦 ${count}` : '📭 0';
        badge.title = count > 0 ? `${count} товаров в авто-выдаче` : 'Товары закончились!';
        priceEl.appendChild(badge);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStockCounterDisplay);
} else {
    initStockCounterDisplay();
}

new MutationObserver(() => initStockCounterDisplay())
    .observe(document.body, { childList: true, subtree: true });
