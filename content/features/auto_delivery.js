// content/features/auto_delivery.js

async function initializeAutoDeliveryManager() {
    if (document.getElementById('ad-manager-placeholder')) return;

    const autoDeliveryBox = document.querySelector('.auto-delivery-box');
    const secretsTextarea = autoDeliveryBox?.querySelector('textarea.textarea-lot-secrets');
    const amountInput = document.querySelector('input[name="amount"]');
    if (!autoDeliveryBox || !secretsTextarea || !amountInput) return;

    const ITEM_CHAR_LIMIT = 140;

    // --- 1. Создаем основной контейнер на странице ---
    const placeholder = createElement('div', { id: 'ad-manager-placeholder' });
    placeholder.innerHTML = `
        <div class="ad-controls-wrapper">
            <button type="button" id="ad-open-manager-btn" class="btn btn-primary">Управлять товарами</button>
            <label id="ad-legacy-mode-toggle" class="fp-tools-chat-toggle fp-tooltip-host" data-fp-tooltip="Включить стандартный режим автовыдачи">
                <input type="checkbox" id="ad-legacy-mode-checkbox">
                <span class="fp-tools-chat-toggle-slider">
                    <span class="material-icons">edit_document</span>
                </span>
            </label>
        </div>
        <span id="ad-item-count-display"></span>
        <div id="ad-reload-notice" style="display: none;">Перезагрузите страницу, чтобы снова включить улучшенный менеджер.</div>
    `;
    
    const originalHelpBlock = secretsTextarea.nextElementSibling;
    if(originalHelpBlock) originalHelpBlock.style.display = 'none';
    autoDeliveryBox.appendChild(placeholder);

    // --- 2. Получаем ссылки на все элементы ---
    const openBtn = document.getElementById('ad-open-manager-btn');
    const toggle = document.getElementById('ad-legacy-mode-checkbox');
    const reloadNotice = document.getElementById('ad-reload-notice');
    const countDisplay = document.getElementById('ad-item-count-display');

    // --- 3. Привязываем обработчик к переключателю ---
    toggle.addEventListener('change', async (e) => {
        const isLegacy = e.target.checked;
        await chrome.storage.local.set({ fpToolsLegacyADModeEnabled: isLegacy });

        if (isLegacy) {
            openBtn.style.display = 'none';
            countDisplay.style.display = 'none';
            secretsTextarea.style.display = 'block';
            reloadNotice.style.display = 'none';
        } else {
            // Если выключили стандартный режим, показываем уведомление
            openBtn.style.display = 'none'; // Кнопка все равно не будет работать до перезагрузки
            countDisplay.style.display = 'none';
            secretsTextarea.style.display = 'none';
            reloadNotice.style.display = 'block';
        }
    });
    
    // --- 4. Проверяем сохраненный режим и настраиваем UI ---
    const { fpToolsLegacyADModeEnabled } = await chrome.storage.local.get('fpToolsLegacyADModeEnabled');

    if (fpToolsLegacyADModeEnabled) {
        // РЕЖИМ СТАНДАРТНОЙ АВТОВЫДАЧИ
        secretsTextarea.style.display = 'block';
        openBtn.style.display = 'none';
        countDisplay.style.display = 'none';
        toggle.checked = true;
    } else {
        // РЕЖИМ УЛУЧШЕННОГО МЕНЕДЖЕРА
        secretsTextarea.style.display = 'none';
        openBtn.style.display = 'block';
        countDisplay.style.display = 'block';
        toggle.checked = false;
        
        // --- 5. Создаем модальное окно и всю его логику ТОЛЬКО если активен улучшенный режим ---
        const managerPopup = createAdvancedManagerModal();

        openBtn.addEventListener('click', () => {
            // окно открываем до заполнения: высоту многострочных товаров можно измерить только у видимого поля.
            // Крестик, Esc и клик по фону сохраняют товары (как прежний крестик); сбрасывает только «Отмена».
            fptWindow.open(managerPopup, { onClose: () => { if (!quietClose) applyItems(); } });
            populatePopupFromOriginal();
        });

        const popupItemList = managerPopup.querySelector('#ad-items-list-popup');
        const popupItemCount = managerPopup.querySelector('#ad-item-count');
        const popupEmpty = managerPopup.querySelector('#ad-items-empty');

        const updateItemCount = () => {
            const count = popupItemList.children.length;
            popupItemCount.textContent = `Товаров: ${count}`;
            popupEmpty.hidden = count > 0;
        };

        const createItemRow = (content = '') => {
            const row = createElement('div', { class: 'ad-item-row' });
            const input = createElement('textarea', { class: 'fpt-win-input ad-item-input', rows: '1', 'aria-label': 'Товар' });
            input.value = content;
            const autoResize = () => { input.style.height = 'auto'; input.style.height = `${input.scrollHeight + 2}px`; };
            input.addEventListener('input', () => { autoResize(); updateCharCounter(input, counter); });
            const controls = createElement('div', { class: 'ad-item-controls' });
            const counter = createElement('div', { class: 'ad-char-counter' });
            const removeBtn = fptWindow.button('', { kind: 'quiet', size: 'sm', iconName: 'close', title: 'Удалить' });
            removeBtn.classList.add('fpt-win-btn--icon', 'ad-remove-item-btn');
            removeBtn.setAttribute('aria-label', 'Удалить товар');
            removeBtn.addEventListener('click', () => { row.remove(); updateItemCount(); });
            controls.append(removeBtn, counter);
            row.append(input, controls);
            popupItemList.appendChild(row);
            autoResize();
            updateCharCounter(input, counter);
        };

        const updateCharCounter = (inputEl, counterEl) => {
            const len = inputEl.value.replace(/\n/g, '\\n').length;
            counterEl.textContent = `${len}/${ITEM_CHAR_LIMIT}`;
            counterEl.classList.toggle('limit-exceeded', len > ITEM_CHAR_LIMIT);
        };

        const populatePopupFromOriginal = () => {
            popupItemList.innerHTML = '';
            const rawValue = secretsTextarea.value.trim();
            if (rawValue) {
                const items = rawValue.split('\n').filter(line => line.trim() !== '');
                items.forEach(item => createItemRow(item.replace(/\\n/g, '\n')));
            }
            updateItemCount();
        };

        let quietClose = false;
        const closeWithoutSaving = () => {
            quietClose = true;
            fptWindow.close(managerPopup);
            quietClose = false;
        };

        const applyItems = () => {
            const itemInputs = popupItemList.querySelectorAll('.ad-item-input');
            const values = Array.from(itemInputs).map(input => input.value.replace(/\n/g, '\\n'));
            secretsTextarea.value = values.join('\n');
            amountInput.value = values.length;
            countDisplay.textContent = `Загружено товаров: ${values.length}`;
            secretsTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            showNotification('Товары обновлены. Не забудьте сохранить сам лот.', false);
        };

        const saveAndCloseManager = () => {
            applyItems();
            closeWithoutSaving();
        };

        // --- ИСПРАВЛЕНИЕ: ВОТ ЭТА СТРОКА БЫЛА ПРОПУЩЕНА ---
        managerPopup.querySelector('#ad-add-item-btn').addEventListener('click', () => { createItemRow(); updateItemCount(); });
        // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
        
        managerPopup.querySelector('#ad-manager-save-btn').addEventListener('click', saveAndCloseManager);
        managerPopup.querySelector('#ad-manager-cancel-btn').addEventListener('click', closeWithoutSaving);
        
        managerPopup.querySelector('#ad-clear-all-btn').addEventListener('click', () => { if (confirm('Удалить все товары?')) { popupItemList.innerHTML = ''; updateItemCount(); }});
        
        const massAddPopup = document.getElementById('ad-mass-add-popup');
        const duplicatePopup = document.getElementById('ad-duplicate-popup');
        const showPopup = (popupEl) => fptWindow.open(popupEl, { focus: popupEl.querySelector('textarea') });
        const hidePopup = (popupEl) => fptWindow.close(popupEl);

        managerPopup.querySelector('#ad-mass-add-btn').addEventListener('click', () => showPopup(massAddPopup));
        document.getElementById('ad-mass-add-cancel').addEventListener('click', () => hidePopup(massAddPopup));
        document.getElementById('ad-mass-add-confirm').addEventListener('click', () => {
            const textarea = document.getElementById('ad-mass-add-textarea');
            textarea.value.trim().split('\n').filter(Boolean).forEach(createItemRow);
            updateItemCount();
            textarea.value = '';
            hidePopup(massAddPopup);
        });

        managerPopup.querySelector('#ad-duplicate-btn').addEventListener('click', () => showPopup(duplicatePopup));
        document.getElementById('ad-duplicate-cancel').addEventListener('click', () => hidePopup(duplicatePopup));
        document.getElementById('ad-duplicate-confirm').addEventListener('click', () => {
            const textarea = document.getElementById('ad-duplicate-textarea');
            const amount = parseInt(document.getElementById('ad-duplicate-amount').value, 10);
            if (textarea.value && amount > 0) { for (let i = 0; i < amount; i++) createItemRow(textarea.value); updateItemCount(); }
            textarea.value = '';
            hidePopup(duplicatePopup);
        });
    }

    // --- 6. Обновляем счетчик на странице в любом случае ---
    const updateInitialCount = () => {
        const lines = secretsTextarea.value.trim().split('\n').filter(Boolean);
        countDisplay.textContent = `Загружено товаров: ${lines.length}`;
    };
    updateInitialCount();
    secretsTextarea.addEventListener('input', updateInitialCount); // Обновляем счетчик при ручном вводе в стандартном режиме
}

// Вспомогательная функция, вынесена наружу
function createAdvancedManagerModal() {
    // Создаем окна, только если их еще нет
    if (!document.getElementById('fp-tools-ad-manager-popup')) {
        const manager = fptWindow.create({
            id: 'fp-tools-ad-manager-popup',
            closeId: 'ad-manager-close-btn',
            title: 'Менеджер товаров',
            subtitle: 'Каждый товар выдаётся покупателю отдельно. До 140 символов на товар.',
            icon: 'inventory_2',
            size: 'lg',
            tall: true
        });
        manager.body.innerHTML = `
            <div class="ad-manager-toolbar">
                <button type="button" id="ad-add-item-btn" class="fpt-win-btn fpt-win-btn--sm"><span class="material-symbols-rounded" aria-hidden="true">add</span>Добавить товар</button>
                <button type="button" id="ad-mass-add-btn" class="fpt-win-btn fpt-win-btn--sm"><span class="material-symbols-rounded" aria-hidden="true">playlist_add</span>Массовое добавление</button>
                <button type="button" id="ad-duplicate-btn" class="fpt-win-btn fpt-win-btn--sm"><span class="material-symbols-rounded" aria-hidden="true">control_point_duplicate</span>Дублировать</button>
                <button type="button" id="ad-clear-all-btn" class="fpt-win-btn fpt-win-btn--sm fpt-win-btn--danger"><span class="material-symbols-rounded" aria-hidden="true">delete_sweep</span>Очистить всё</button>
                <span id="ad-item-count" class="fpt-win-badge fpt-win-badge--accent">Товаров: 0</span>
            </div>
            <div class="ad-items-list" id="ad-items-list-popup"></div>
            <div class="fpt-win-empty" id="ad-items-empty"><span class="material-symbols-rounded" aria-hidden="true">inventory_2</span>Товаров пока нет. Добавьте первый или вставьте список.</div>`;
        manager.foot.innerHTML = `
            <div class="fpt-win-actions">
                <button type="button" id="ad-manager-cancel-btn" class="fpt-win-btn fpt-win-btn--quiet">Отмена</button>
                <button type="button" id="ad-manager-save-btn" class="fpt-win-btn fpt-win-btn--primary">Сохранить и закрыть</button>
            </div>`;
        document.body.appendChild(manager.scrim);

        const massAdd = fptWindow.create({
            id: 'ad-mass-add-popup',
            title: 'Массовое добавление',
            subtitle: 'Вставьте список товаров, каждый с новой строки.',
            icon: 'playlist_add',
            size: 'sm'
        });
        massAdd.body.innerHTML = `<textarea id="ad-mass-add-textarea" class="fpt-win-input" rows="8" placeholder="Товар 1\nТовар 2\nТовар 3..." aria-label="Список товаров"></textarea>`;
        massAdd.foot.innerHTML = `<div class="fpt-win-actions"><button type="button" id="ad-mass-add-cancel" class="fpt-win-btn fpt-win-btn--quiet">Отмена</button><button type="button" id="ad-mass-add-confirm" class="fpt-win-btn fpt-win-btn--primary">Добавить</button></div>`;
        document.body.appendChild(massAdd.scrim);

        const duplicate = fptWindow.create({
            id: 'ad-duplicate-popup',
            title: 'Дублирование товара',
            subtitle: 'Один и тот же товар (можно многострочный) добавится нужное число раз.',
            icon: 'control_point_duplicate',
            size: 'sm'
        });
        duplicate.body.innerHTML = `
            <div class="fpt-win-field-group">
                <label class="fpt-win-label" for="ad-duplicate-textarea">Текст товара</label>
                <textarea id="ad-duplicate-textarea" class="fpt-win-input" rows="4" placeholder="Текст товара..."></textarea>
            </div>
            <div class="fpt-win-field-group">
                <label class="fpt-win-label" for="ad-duplicate-amount">Количество копий</label>
                <input type="number" id="ad-duplicate-amount" class="fpt-win-input" placeholder="Количество" min="1" value="10" style="max-width:160px;">
            </div>`;
        duplicate.foot.innerHTML = `<div class="fpt-win-actions"><button type="button" id="ad-duplicate-cancel" class="fpt-win-btn fpt-win-btn--quiet">Отмена</button><button type="button" id="ad-duplicate-confirm" class="fpt-win-btn fpt-win-btn--primary">Создать</button></div>`;
        document.body.appendChild(duplicate.scrim);
    }
    return document.getElementById('fp-tools-ad-manager-popup');
}
