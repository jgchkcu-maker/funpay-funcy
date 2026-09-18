let templateSettings = {
    enabled: true,
    buttonPosition: "bottom",
    sendTemplatesImmediately: true,
    // Minimalist look/feel of the chat template buttons. Mirrors what competitor
    // extensions expose so users switching over don't feel anything is missing.
    display: {
        shape: 'rounded',   // rounded | pill | square
        size: 'm',          // s | m | l
        fill: 'solid',      // solid | soft | outline | ghost
        align: 'center',    // left | center | right
        fullWidth: false,   // stretch each button to full row width
        showPreview: true,  // show the text preview tooltip on hover
        uppercase: false,   // UPPERCASE labels
        compact: false,     // tighter gaps between buttons
        sidebarDensity: 'normal', // cozy | normal | dense  (only for sidebar)
        sidebarLayout: 'flow'     // flow (auto-grid) | list (only for sidebar)
    },
    standard: {},
    custom: []
};

const DEFAULT_TEMPLATE_DISPLAY = {
    shape: 'rounded', size: 'm', fill: 'solid', align: 'center',
    fullWidth: false, showPreview: true, uppercase: false, compact: false,
    sidebarDensity: 'normal', sidebarLayout: 'flow'
};

const DEFAULT_STANDARD_TEMPLATES = {
    greeting: { enabled: true, label: 'Приветствие', color: '#1b75bb', category: 'greeting', text: '{welcome}, {buyername}! Чем могу помочь?' },
    completed: { enabled: true, label: 'Заказ выполнен', color: '#10b981', category: 'deal', text: 'Заказ выполнен. Пожалуйста, зайдите в раздел «Покупки», выберите его в списке и нажмите кнопку «Подтвердить выполнение заказа».' },
    review: { enabled: true, label: 'Попросить отзыв', color: '#f59e0b', category: 'review', text: 'Спасибо за покупку! Буду очень благодарен, если вы оставите отзыв о сделке.' },
    thanks: { enabled: true, label: 'Спасибо за заказ', color: '#8b5cf6', category: 'deal', text: 'Спасибо за заказ, {buyername}! Обращайтесь еще. {date}' }
};

async function loadTemplateSettings() {
    const data = await chrome.storage.local.get(['fpToolsTemplateSettings']);
    const saved = data.fpToolsTemplateSettings || {};
    
    templateSettings.enabled = saved.enabled !== false;
    templateSettings.buttonPosition = 'popover'; // Always use the modern lightning popover
    templateSettings.sendTemplatesImmediately = saved.sendTemplatesImmediately !== false;
    templateSettings.custom = saved.custom || [];
    templateSettings.display = { ...DEFAULT_TEMPLATE_DISPLAY, ...(saved.display || {}) };
    
    templateSettings.standard = {};
    for (const key in DEFAULT_STANDARD_TEMPLATES) {
        templateSettings.standard[key] = {
            ...DEFAULT_STANDARD_TEMPLATES[key],
            ...(saved.standard ? saved.standard[key] : {})
        };
    }
}

async function saveTemplateSettings() {
    if (!chrome.runtime?.id) return;
    await chrome.storage.local.set({ fpToolsTemplateSettings: templateSettings });
}

function getWelcomeMessage() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Доброе утро!";
    if (hour >= 12 && hour < 18) return "Добрый день!";
    return "Добрый вечер!";
}

async function replaceTemplateVariables(template) {
    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const buyerNameElement = document.querySelector('.media-user-name a');
    const balElement = document.querySelector('.badge-balance');
    const activeSellsElement = document.querySelector('.badge-trade');
    let result = template;
    result = result.replace(/{welcome}/g, getWelcomeMessage());
    result = result.replace(/{date}/g, dateStr);
    result = result.replace(/{buyername}/g, buyerNameElement ? buyerNameElement.textContent.trim() : 'покупатель');
    result = result.replace(/{bal}/g, balElement ? balElement.textContent.trim() : 'N/A');
    result = result.replace(/{activesells}/g, activeSellsElement ? activeSellsElement.textContent.trim() : 'N/A');

    let lotName = 'лот';
    const lotNameInChat = document.querySelector('.deal-desc-lot a');
    if(lotNameInChat) lotName = lotNameInChat.textContent.trim();
    result = result.replace(/{lotname}/g, lotName);

    result = result.replace(/\{([^{}|]*\|[^{}]*)\}/g, (full, inner) => {
        if (/^ai:/i.test(inner)) return full;
        const options = inner.split('|');
        const pick = options[Math.floor(Math.random() * options.length)];
        return pick;
    });

    // NOTE: {orderlink}/{orderid} are intentionally NOT supported in chat templates.
    // A chat can contain many orders, so there is no single reliable "current order" to
    // link to - the old behaviour grabbed an arbitrary /orders/ link. These variables
    // remain available only in the autoresponder (new-order / order-confirm), where a
    // concrete order id exists.

    const aiRegex = /\{ai:([^}]+)\}/g;
    let match;
    const aiPromises = [];
    const aiPlaceholders = [];

    let tempResult = result;
    let placeholderIndex = 0;
    while ((match = aiRegex.exec(result)) !== null) {
        const aiPrompt = match[1];
        const placeholder = `__AI_PLACEHOLDER_${placeholderIndex++}__`;
        aiPlaceholders.push({ placeholder: placeholder, originalMatch: match[0] });
        aiPromises.push(getAIProcessedText(aiPrompt, "generate"));
        tempResult = tempResult.replace(match[0], placeholder);
    }

    result = tempResult;

    if (aiPromises.length > 0) {
        const chatInputForLoading = document.querySelector('.chat-form-input .form-control');
        if (chatInputForLoading) {
             chatInputForLoading.classList.add('ai-loading-textarea');
             chatInputForLoading.disabled = true;
        }
        try {
            const aiResults = await Promise.all(aiPromises);
            aiPlaceholders.forEach((ph, index) => {
                result = result.replace(ph.placeholder, aiResults[index] || "");
            });
        } catch (error) {
            console.error("Error processing one or more AI variables:", error);
            showNotification("Ошибка при обработке одной или нескольких AI переменных.", true);
            aiPlaceholders.forEach(ph => {
                result = result.replace(ph.placeholder, ph.originalMatch);
            });
        } finally {
             if (chatInputForLoading) {
                chatInputForLoading.classList.remove('ai-loading-textarea');
                chatInputForLoading.disabled = false;
             }
        }
    }
    return result;
}

async function applyTemplateToInput(chatInput, templateContent, images, sendOrder) {
    if (!chatInput || templateContent === undefined) return { handledInBackground: false };

    let processedText = await replaceTemplateVariables(templateContent);
    const imgs = Array.isArray(images) ? images.filter(Boolean) : [];
    const order = (sendOrder === 'image_first') ? 'image_first' : 'text_first';

    // If there are attached images, send everything in the background in the chosen
    // order (text→image OR image→text) so nothing is dumped into the visible input
    // and FunPay's submit isn't triggered.
    if (imgs.length > 0) {
        const nodeInput = document.querySelector('input[name="node"]');
        let chatId = nodeInput && nodeInput.value ? nodeInput.value : null;
        if (!chatId) { const dn = document.querySelector('[data-node]'); if (dn) chatId = dn.getAttribute('data-node'); }
        if (!chatId) { const mm = window.location.href.match(/[?&]node=([^&#\s]+)/); if (mm) chatId = decodeURIComponent(mm[1]); }
        if (!chatId) { const fc = document.querySelector('.chat[data-id]'); if (fc) chatId = fc.getAttribute('data-id'); }
        const chatNameEl = document.querySelector('.chat-header .media-user-name, .chat-full-header .media-user-name');
        const chatName = chatNameEl ? chatNameEl.textContent.trim() : '';

        if (!chatId) {
            showNotification('Не удалось определить чат для отправки изображения.', true);
            return { handledInBackground: false };
        }

        const sendText = async () => {
            if (processedText && processedText.trim()) {
                await chrome.runtime.sendMessage({ action: 'fptSendChatText', chatId, text: processedText.trim() });
                await new Promise(r => setTimeout(r, 300));
            }
        };
        const sendImages = async () => {
            for (const dataUrl of imgs) {
                const sendId = 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                const resp = await chrome.runtime.sendMessage({ action: 'fptSendImage', chatId, dataUrl, chatName, sendId });
                if (!resp || !resp.ok) showNotification('Не удалось отправить изображение: ' + (resp && resp.error || 'ошибка'), true);
                await new Promise(r => setTimeout(r, 300));
            }
        };

        try {
            if (order === 'image_first') {
                await sendImages();
                await sendText();
            } else {
                await sendText();
                await sendImages();
            }
        } catch (e) {
            console.error('FP Tools: ошибка отправки шаблона с картинкой', e);
        }
        chatInput.value = '';
        return { handledInBackground: true };
    }

    // no images → normal text flow
    // Flag this as a programmatic edit so the draft-saver (chat_enhancements.js)
    // doesn't persist a template paste as a "draft" that reappears later.
    window.__fptProgrammaticInput = true;
    chatInput.value = processedText.trim();
    chatInput.focus();
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    chatInput.selectionStart = chatInput.selectionEnd = chatInput.value.length;
    window.__fptProgrammaticInput = false;
    return { handledInBackground: false };
}


function showEmptyTemplateModal(templateKey, isCustom) {
    const existingOverlay = document.querySelector('.fp-tools-empty-template-overlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = createElement('div', { class: 'fp-tools-empty-template-overlay' });
    const modal = createElement('div', { class: 'fp-tools-empty-template-modal' });
    
    modal.innerHTML = `
        <h4>Шаблон пуст</h4>
        <p>Хотите добавить текст для этой кнопки прямо сейчас?</p>
        <div class="textarea-with-controls">
            <textarea class="template-input" placeholder="Введите текст шаблона..."></textarea>
            <button class="btn add-image-btn fpt-img-btn" title="Добавить изображение"><span class="material-symbols-rounded">image</span></button>
        </div>
        <div class="modal-actions">
            <button class="btn" id="empty-template-save">Сохранить</button>
            <button class="btn btn-default" id="empty-template-close">Закрыть</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const textarea = modal.querySelector('textarea');
    modal.querySelector('.add-image-btn').addEventListener('click', () => handleImageAddClick(textarea));

    const closeModal = () => overlay.remove();
    
    overlay.querySelector('#empty-template-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    overlay.querySelector('#empty-template-save').addEventListener('click', async () => {
        const newText = textarea.value;
        if (newText.trim()) {
            if (isCustom) {
                const template = templateSettings.custom.find(t => t.id === templateKey);
                if (template) template.text = newText;
            } else {
                if (templateSettings.standard[templateKey]) {
                    templateSettings.standard[templateKey].text = newText;
                }
            }
            await saveTemplateSettings();
            await addChatTemplateButtons();
            showNotification('Шаблон обновлен!', false);
            closeModal();
        } else {
            showNotification('Текст не может быть пустым', true);
        }
    });
}

async function useTemplate(templateConfig) {
    const imgs = Array.isArray(templateConfig.images) ? templateConfig.images : [];
    if ((!templateConfig.text || templateConfig.text.trim() === '') && imgs.length === 0) {
        showEmptyTemplateModal(templateConfig.isCustom ? templateConfig.id : templateConfig.key, templateConfig.isCustom);
        return;
    }
    
    const data = await chrome.storage.local.get('fpToolsTemplateSettings');
    const sendTemplatesImmediately = data.fpToolsTemplateSettings?.sendTemplatesImmediately !== false;

    const chatInput = document.querySelector('.chat-form-input .form-control');
    if (!chatInput) return;

    const applyResult = await applyTemplateToInput(chatInput, templateConfig.text, imgs, templateConfig.sendOrder);

    if (!sendTemplatesImmediately) return;
    if (applyResult && applyResult.handledInBackground) return;

    const hasContent = chatInput.value.trim() !== '';
    if (!hasContent) return;

    const chatForm = chatInput.closest('form');
    if (!chatForm) return;
    const submitButton = chatForm.querySelector('button[type="submit"]');
    if (!submitButton) return;

    await waitForElementToBeEnabled(submitButton);

    if (!submitButton.disabled) {
        submitButton.click();
    }
}

function createTemplateButton(config) {
    const pos = templateSettings.buttonPosition;
    const isSidebar = pos === 'sidebar_top' || pos === 'sidebar_bottom';
    const d = { ...DEFAULT_TEMPLATE_DISPLAY, ...(templateSettings.display || {}) };
    const btn = createElement('button', {
        type: 'button',
        class: isSidebar ? 'sidebar-template-btn' : (config.isCustom ? 'custom-chat-template-btn' : 'chat-template-btn')
    });

    btn.style.setProperty('--btn-color', config.color);
    if (isSidebar) {
        btn.style.setProperty('--template-color', config.color);
    } else {
        btn.style.backgroundColor = config.color;
    }

    const labelEl = createElement('span', { class: 'fpt-btn-label' });
    labelEl.textContent = config.label;
    btn.appendChild(labelEl);

    btn.addEventListener('click', () => useTemplate(config));

    // Preview tooltip on hover - can be turned off entirely in display settings.
    if (d.showPreview !== false) {
        const cleanText = (config.text || '')
            .replace(/\[image:data:image\/[^;]+;base64,[^\]]+\]/g, '[фото]')
            .replace(/\{img:[a-z0-9]+\}/gi, '[фото]')
            .trim() || '(Пусто)';

        // Both the sidebar (inside the scrollable .chat-detail-list) and the in-chat
        // strip (inside .chat-buttons-container / the composer) sit in containers that
        // clip an absolutely-positioned tooltip - that's what cut off the preview's
        // rounded background. So for EVERY layout we render the preview as a FIXED
        // element on <body> on hover: it escapes all clipping and always sits on top.
        // Render the preview as a free-floating fixed box. We set the critical
        // styles INLINE so no site/theme CSS can clip the background or skew the
        // text, append to <html> (never has a transform that would trap `fixed`),
        // and measure AFTER layout so the box wraps the full text before we place it.
        let tip = null;
        const show = () => {
            tip = document.createElement('div');
            tip.className = 'fp-tools-template-preview fpt-preview-fixed';
            tip.textContent = cleanText;
            tip.style.cssText = [
                'position:fixed', 'left:0', 'top:0', 'margin:0',
                'z-index:2147483647', 'box-sizing:border-box',
                'display:block', 'width:max-content', 'max-width:300px',
                'height:auto', 'max-height:none', 'min-height:0',
                'padding:10px 12px', 'border:1px solid #2a2d44', 'border-radius:8px',
                'background:#0c0c10', 'color:#fff',
                'font-size:12.5px', 'line-height:1.45', 'text-align:left',
                'white-space:pre-wrap', 'word-break:break-word', 'overflow:visible',
                'box-shadow:0 10px 30px rgba(0,0,0,.5)', 'pointer-events:none',
                'opacity:0', 'transition:opacity .12s ease'
            ].join(';') + ';';
            document.documentElement.appendChild(tip);

            // Measure on the NEXT frame, once the box has laid out and wrapped text.
            requestAnimationFrame(() => {
                if (!tip) return;
                const r = btn.getBoundingClientRect();
                const tr = tip.getBoundingClientRect();
                let left = Math.max(8, Math.min(r.left, window.innerWidth - tr.width - 8));
                let top;
                if (pos === 'sidebar_bottom') {
                    top = r.bottom + 8;
                    if (top + tr.height > window.innerHeight - 8) top = r.top - tr.height - 8;
                } else {
                    top = r.top - tr.height - 8;
                    if (top < 8) top = r.bottom + 8;
                }
                tip.style.left = `${Math.round(left)}px`;
                tip.style.top = `${Math.round(top)}px`;
                tip.style.opacity = '1';
            });
        };
        const hide = () => { if (tip) { tip.remove(); tip = null; } };
        btn.addEventListener('mouseenter', show);
        btn.addEventListener('mouseleave', hide);
        btn.addEventListener('click', hide);
    }

    return btn;
}

function applyTemplateDisplayAttrs(container) {
    const d = { ...DEFAULT_TEMPLATE_DISPLAY, ...(templateSettings.display || {}) };
    container.setAttribute('data-fpt-shape', d.shape);
    container.setAttribute('data-fpt-size', d.size);
    container.setAttribute('data-fpt-fill', d.fill);
    container.setAttribute('data-fpt-fullwidth', d.fullWidth ? '1' : '0');
    container.setAttribute('data-fpt-uppercase', d.uppercase ? '1' : '0');
    container.setAttribute('data-fpt-compact', d.compact ? '1' : '0');
    const isSidebar = container.classList.contains('fp-tools-template-sidebar');
    if (isSidebar) {
        container.setAttribute('data-fpt-density', d.sidebarDensity || 'normal');
        container.setAttribute('data-fpt-layout', d.sidebarLayout || 'flow');
    }
    // Alignment only has a visible effect on full-width buttons (otherwise buttons are
    // content-sized). The sidebar "list" layout is full-width so it always gets it.
    if (d.fullWidth || (isSidebar && (d.sidebarLayout || 'flow') === 'list')) {
        container.setAttribute('data-fpt-align', d.align);
    } else {
        container.removeAttribute('data-fpt-align');
    }
}

function fillTemplateContainer(container) {
    for (const key in templateSettings.standard) {
        const config = templateSettings.standard[key];
        if (config.enabled) {
            container.appendChild(createTemplateButton({ ...config, key, isCustom: false }));
        }
    }
    templateSettings.custom.forEach(config => {
        if (config.enabled) {
            container.appendChild(createTemplateButton({ ...config, isCustom: true }));
        }
    });
}

async function addChatTemplateButtons() {
    await loadTemplateSettings();
    const chatInput = document.querySelector('.chat-form-input .form-control');
    if (!chatInput) return;
    // Don't show buttons when no conversation is selected (placeholder state)
    if (document.querySelector('.chat-not-selected') ||
        document.querySelector('.chat-empty-message') ||
        !document.querySelector('.chat-header, .chat-full-header, .chat-message-list')) return;

    document.querySelectorAll('.chat-buttons-container, .fp-tools-template-sidebar').forEach(el => el.remove());
    // Remove any orphaned fixed preview tooltips left over from a previous render.
    document.querySelectorAll('.fp-tools-template-preview.fpt-preview-fixed').forEach(el => el.remove());
    // Clean up any popover trigger/panel/cell from a previous render or position.
    document.querySelectorAll('.fpt-tpl-popover-cell').forEach(el => el.remove());
    document.getElementById('fpt-tpl-popover-btn')?.remove();
    document.getElementById('fpt-tpl-popover')?.remove();
    // Reset any bottom-pin padding we previously added to the right panel.
    document.querySelectorAll('.chat-detail-list.fpt-has-bottom-binds').forEach(el => {
        el.classList.remove('fpt-has-bottom-binds');
        el.style.paddingBottom = '';
    });

    // Master switch: templates fully off → leave the chat untouched.
    if (templateSettings.enabled === false) return;

    setupTemplatePopover();
}

function setupTemplatePopover() {
    document.querySelectorAll('.fpt-tpl-popover-cell').forEach(el => el.remove());
    document.getElementById('fpt-tpl-popover-btn')?.remove();
    document.getElementById('fpt-tpl-popover')?.remove();

    if (templateSettings.enabled === false) return;

    const attachBtn = document.querySelector('.chat-btn-image:not(.fpt-tpl-popover-btn)');
    const attachWrap = attachBtn ? (attachBtn.closest('.chat-form-attach') || attachBtn.parentElement) : null;
    if (!attachWrap || !attachBtn) return;

    const trigger = createElement('button', {
        type: 'button',
        id: 'fpt-tpl-popover-btn',
        class: 'btn btn-default chat-btn-image fpt-tpl-popover-btn',
        title: 'Быстрые ответы (⚡)'
    });
    trigger.innerHTML = '<span class="material-symbols-rounded">bolt</span>';

    // Place the trigger to the LEFT of the paperclip.
    if (attachBtn.closest('.chat-form-attach') === attachWrap && attachWrap.parentNode) {
        const cell = createElement('div', { class: 'chat-form-attach fpt-tpl-popover-cell' });
        cell.appendChild(trigger);
        attachWrap.parentNode.insertBefore(cell, attachWrap);
    } else {
        attachWrap.insertBefore(trigger, attachBtn);
    }

    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTemplatePopover(trigger);
    });
}

function toggleTemplatePopover(trigger) {
    const existing = document.getElementById('fpt-tpl-popover');
    if (existing) {
        existing.classList.remove('open');
        setTimeout(() => existing.remove(), 160);
        return;
    }

    const pop = createElement('div', { id: 'fpt-tpl-popover', class: 'fpt-tpl-popover' });

    // ── 1. Шапка ──
    const header = createElement('div', { class: 'fpt-tpl-popover-head' });

    const titleBox = createElement('div', { class: 'fpt-tpl-popover-title' });
    const boltIcon = createElement('span', { class: 'material-symbols-rounded fpt-bolt-icon' });
    boltIcon.textContent = 'bolt';
    const titleText = createElement('span', { class: 'fpt-tpl-head-text' });
    titleText.textContent = 'Быстрые ответы';
    titleBox.appendChild(boltIcon);
    titleBox.appendChild(titleText);

    const headActions = createElement('div', { class: 'fpt-tpl-popover-head-actions' });
    const addBtn = createElement('button', {
        type: 'button',
        class: 'fpt-tpl-btn-add',
        title: 'Создать новый шаблон'
    });
    addBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:15px;margin-right:2px;vertical-align:-2px;">add</span><span>Добавить</span>';

    const gear = createElement('button', {
        type: 'button',
        class: 'fpt-tpl-popover-gear',
        title: 'Настройки шаблонов'
    });
    gear.innerHTML = '<span class="material-symbols-rounded">settings</span>';
    gear.addEventListener('click', (e) => {
        e.stopPropagation();
        closePopover();
        openTemplateSettings();
    });

    headActions.appendChild(addBtn);
    headActions.appendChild(gear);
    header.appendChild(titleBox);
    header.appendChild(headActions);
    pop.appendChild(header);

    // ── 2. Поиск ──
    const searchWrap = createElement('div', { class: 'fpt-tpl-search-wrap' });
    searchWrap.innerHTML = `
        <span class="material-symbols-rounded fpt-search-ico">search</span>
        <input type="text" class="fpt-tpl-search-input" placeholder="Поиск по шаблонам..." autocomplete="off">
        <button type="button" class="fpt-tpl-search-clear" style="display:none;" title="Очистить">✕</button>
    `;
    pop.appendChild(searchWrap);
    const searchInput = searchWrap.querySelector('.fpt-tpl-search-input');
    const searchClear = searchWrap.querySelector('.fpt-tpl-search-clear');

    // ── 3. Категории ──
    const catsBar = createElement('div', { class: 'fpt-tpl-cats' });
    const categories = [
        { id: 'all', label: 'Все' },
        { id: 'greeting', label: 'Приветствие' },
        { id: 'deal', label: 'Сделка' },
        { id: 'review', label: 'Отзывы' },
        { id: 'custom', label: 'Свои' }
    ];
    let activeCategory = 'all';

    categories.forEach(cat => {
        const catBtn = createElement('button', {
            type: 'button',
            class: `fpt-tpl-cat ${cat.id === activeCategory ? 'active' : ''}`,
            'data-cat': cat.id
        });
        catBtn.textContent = cat.label;
        catBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            activeCategory = cat.id;
            catsBar.querySelectorAll('.fpt-tpl-cat').forEach(b => b.classList.toggle('active', b.dataset.cat === activeCategory));
            activeIndex = 0;
            renderList();
        });
        catsBar.appendChild(catBtn);
    });
    pop.appendChild(catsBar);

    // ── 4. Форма быстрого добавления (в 1 клик) ──
    const quickAddBox = createElement('div', { class: 'fpt-tpl-quick-add', style: 'display: none;' });
    quickAddBox.innerHTML = `
        <div class="fpt-tpl-add-row">
            <input type="text" class="fpt-tpl-add-name" placeholder="Название (напр. Реквизиты)">
            <select class="fpt-tpl-add-cat">
                <option value="custom" selected>Свои</option>
                <option value="deal">Сделка</option>
                <option value="greeting">Приветствие</option>
                <option value="review">Отзывы</option>
            </select>
        </div>
        <textarea class="fpt-tpl-add-text" placeholder="Текст шаблона..."></textarea>
        <div class="fpt-tpl-add-footer">
            <span class="fpt-tpl-add-hint">{buyername}, {welcome}</span>
            <div class="fpt-tpl-add-btns">
                <button type="button" class="fpt-tpl-btn-cancel">Отмена</button>
                <button type="button" class="fpt-tpl-btn-save">Сохранить</button>
            </div>
        </div>
    `;
    pop.appendChild(quickAddBox);

    const addNameInput = quickAddBox.querySelector('.fpt-tpl-add-name');
    const addCatSelect = quickAddBox.querySelector('.fpt-tpl-add-cat');
    const addTextInput = quickAddBox.querySelector('.fpt-tpl-add-text');
    const addCancelBtn = quickAddBox.querySelector('.fpt-tpl-btn-cancel');
    const addSaveBtn = quickAddBox.querySelector('.fpt-tpl-btn-save');

    const toggleQuickAdd = (show) => {
        const isVisible = quickAddBox.style.display !== 'none';
        const willShow = show !== undefined ? show : !isVisible;
        quickAddBox.style.display = willShow ? 'flex' : 'none';
        addBtn.classList.toggle('active', willShow);
        if (willShow) {
            const chatInput = document.querySelector('.chat-form-input .form-control');
            if (chatInput && chatInput.value && chatInput.value.trim() && !addTextInput.value) {
                addTextInput.value = chatInput.value.trim();
            }
            addNameInput.focus();
        } else {
            searchInput.focus();
        }
    };

    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleQuickAdd();
    });

    addCancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleQuickAdd(false);
    });

    addSaveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const label = addNameInput.value.trim();
        const text = addTextInput.value.trim();
        const cat = addCatSelect.value;
        if (!label) {
            addNameInput.focus();
            return;
        }
        const colorsByCat = {
            greeting: '#1b75bb',
            deal: '#10b981',
            review: '#f59e0b',
            custom: '#8b5cf6'
        };
        const newTemplate = {
            id: Date.now().toString(),
            label: label,
            text: text,
            category: cat,
            color: colorsByCat[cat] || '#8b5cf6',
            enabled: true
        };
        templateSettings.custom.push(newTemplate);
        await saveTemplateSettings();
        addNameInput.value = '';
        addTextInput.value = '';
        toggleQuickAdd(false);
        renderList();
    });

    // ── 5. Список шаблонов ──
    const list = createElement('div', { class: 'fpt-tpl-popover-list custom-scroll' });
    pop.appendChild(list);

    let activeIndex = 0;

    const getItems = () => {
        const query = searchInput.value.trim().toLowerCase();
        const allItems = [];

        for (const key in templateSettings.standard) {
            const c = templateSettings.standard[key];
            if (c.enabled) {
                const cat = c.category || (key === 'greeting' ? 'greeting' : key === 'review' ? 'review' : 'deal');
                allItems.push({ ...c, key, isCustom: false, category: cat });
            }
        }
        templateSettings.custom.forEach(c => {
            if (c.enabled) {
                allItems.push({ ...c, isCustom: true, category: c.category || 'custom' });
            }
        });

        return allItems.filter(item => {
            if (activeCategory !== 'all') {
                if (activeCategory === 'custom' && !item.isCustom && item.category !== 'custom') return false;
                if (activeCategory !== 'custom' && item.category !== activeCategory) return false;
            }
            if (query) {
                const matchLabel = item.label.toLowerCase().includes(query);
                const matchText = (item.text || '').toLowerCase().includes(query);
                return matchLabel || matchText;
            }
            return true;
        });
    };

    const closePopover = () => {
        pop.classList.remove('open');
        setTimeout(() => pop.remove(), 160);
        document.removeEventListener('mousedown', onDoc);
        document.removeEventListener('keydown', onKey);
    };

    const renderList = () => {
        list.innerHTML = '';
        const items = getItems();

        if (items.length === 0) {
            const empty = createElement('div', { class: 'fpt-tpl-popover-empty' });
            empty.textContent = searchInput.value.trim() ? 'Ничего не найдено' : 'Нет активных шаблонов';
            list.appendChild(empty);
            return;
        }

        if (activeIndex >= items.length) activeIndex = 0;

        items.forEach((item, idx) => {
            const row = createElement('button', {
                type: 'button',
                class: `fpt-tpl-popover-item ${idx === activeIndex ? 'fpt-active' : ''}`
            });

            // Цветной индикатор
            const dot = createElement('span', { class: 'fpt-tpl-popover-dot' });
            dot.style.backgroundColor = item.color || '#1b75bb';
            row.appendChild(dot);

            // ТОЛЬКО название шаблона (без подстрочника описания)
            const lbl = createElement('span', { class: 'fpt-tpl-popover-label' });
            lbl.textContent = item.label;
            row.appendChild(lbl);

            // Быстрое удаление своих шаблонов
            if (item.isCustom) {
                const delBtn = createElement('span', {
                    class: 'fpt-tpl-item-del',
                    title: 'Удалить шаблон'
                });
                delBtn.innerHTML = '<span class="material-symbols-rounded">close</span>';
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    templateSettings.custom = templateSettings.custom.filter(t => t.id !== item.id);
                    await saveTemplateSettings();
                    renderList();
                });
                row.appendChild(delBtn);
            }

            row.addEventListener('click', () => {
                closePopover();
                useTemplate(item);
            });

            row.addEventListener('mouseenter', () => {
                list.querySelectorAll('.fpt-tpl-popover-item').forEach(el => el.classList.remove('fpt-active'));
                row.classList.add('fpt-active');
                activeIndex = idx;
            });

            list.appendChild(row);
        });
    };

    // Поиск
    searchInput.addEventListener('input', () => {
        searchClear.style.display = searchInput.value ? 'block' : 'none';
        activeIndex = 0;
        renderList();
    });

    searchClear.addEventListener('click', (e) => {
        e.stopPropagation();
        searchInput.value = '';
        searchClear.style.display = 'none';
        searchInput.focus();
        renderList();
    });

    // Клавиатурная навигация
    const onKey = (ev) => {
        if (ev.key === 'Escape') {
            closePopover();
            return;
        }

        const visibleItems = list.querySelectorAll('.fpt-tpl-popover-item');
        if (!visibleItems.length) return;

        if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            activeIndex = (activeIndex + 1) % visibleItems.length;
            visibleItems.forEach((el, i) => el.classList.toggle('fpt-active', i === activeIndex));
            visibleItems[activeIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            activeIndex = (activeIndex - 1 + visibleItems.length) % visibleItems.length;
            visibleItems.forEach((el, i) => el.classList.toggle('fpt-active', i === activeIndex));
            visibleItems[activeIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (ev.key === 'Enter') {
            if (quickAddBox.style.display !== 'none' && (document.activeElement === addNameInput || document.activeElement === addTextInput)) {
                return;
            }
            ev.preventDefault();
            const selected = getItems()[activeIndex];
            if (selected) {
                closePopover();
                useTemplate(selected);
            }
        }
    };

    const onDoc = (ev) => {
        if (!pop.contains(ev.target) && ev.target !== trigger && !trigger.contains(ev.target)) {
            closePopover();
        }
    };

    document.body.appendChild(pop);
    renderList();

    // Позиционирование
    const r = trigger.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let left = r.left + r.width / 2 - popRect.width / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - popRect.width - 10));
    let top = r.top - popRect.height - 10;
    if (top < 10) top = r.bottom + 10;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;

    requestAnimationFrame(() => {
        pop.classList.add('open');
        searchInput.focus();
    });

    setTimeout(() => {
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
    }, 0);
}

// Opens the FP Tools popup straight on the Templates page.
async function openTemplateSettings() {
    try {
        if (typeof window.__fpEnsurePopup === 'function') await window.__fpEnsurePopup();
    } catch (_) {}
    const popup = document.querySelector('.fp-tools-popup');
    if (!popup) return;
    popup.classList.add('active');
    const navItem = popup.querySelector('.fp-tools-nav li[data-page="templates"]');
    if (navItem) navItem.click();
}
