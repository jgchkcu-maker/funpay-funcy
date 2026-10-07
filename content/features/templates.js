let templateSettings = {
    enabled: true,
    sendTemplatesImmediately: true,
    standard: {},
    custom: []
};

const DEFAULT_STANDARD_TEMPLATES = {
    greeting: { enabled: true, label: 'Приветствие', text: '{welcome}, {buyername}! Чем могу помочь?' },
    completed: { enabled: true, label: 'Заказ выполнен', text: 'Заказ выполнен. Пожалуйста, зайдите в раздел «Покупки», выберите его в списке и нажмите кнопку «Подтвердить выполнение заказа».' },
    review: { enabled: true, label: 'Попросить отзыв', text: 'Спасибо за покупку! Буду очень благодарен, если вы оставите отзыв о сделке.' },
    thanks: { enabled: true, label: 'Спасибо за заказ', text: 'Спасибо за заказ, {buyername}! Обращайтесь еще. {date}' }
};

function withoutTemplateColor(config) {
    const normalized = { ...(config || {}) };
    delete normalized.color;
    return normalized;
}

async function loadTemplateSettings() {
    const data = await chrome.storage.local.get(['fpToolsTemplateSettings']);
    const saved = data.fpToolsTemplateSettings || {};
    
    templateSettings.enabled = saved.enabled !== false;
    templateSettings.sendTemplatesImmediately = saved.sendTemplatesImmediately !== false;
    templateSettings.custom = Array.isArray(saved.custom) ? saved.custom.map(withoutTemplateColor) : [];
    
    templateSettings.standard = {};
    for (const key in DEFAULT_STANDARD_TEMPLATES) {
        const savedTemplate = saved.standard && saved.standard[key];
        templateSettings.standard[key] = {
            ...DEFAULT_STANDARD_TEMPLATES[key],
            ...withoutTemplateColor(savedTemplate)
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
            console.error('FunPay Funcy: ошибка отправки шаблона с картинкой', e);
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
    document.getElementById('fp-tools-empty-template')?.remove();

    const win = fptWindow.create({
        id: 'fp-tools-empty-template',
        title: 'Шаблон пуст',
        subtitle: 'Добавьте текст для этой кнопки прямо сейчас.',
        icon: 'edit_note',
        size: 'sm',
        removeOnClose: true
    });
    const modal = win.dialog;
    win.body.innerHTML = `
        <label class="fpt-win-label" for="fp-tools-empty-template-text">Текст шаблона</label>
        <textarea class="fpt-win-input template-input" id="fp-tools-empty-template-text" rows="5" placeholder="Введите текст шаблона..."></textarea>
        <button type="button" class="fpt-win-btn fpt-win-btn--sm fp-tpl-add-image" style="margin-top:10px;">
            <span class="material-symbols-rounded" aria-hidden="true">image</span>Добавить изображение
        </button>
    `;
    win.foot.innerHTML = `
        <div class="fpt-win-actions">
            <button type="button" class="fpt-win-btn fpt-win-btn--quiet" id="empty-template-close">Закрыть</button>
            <button type="button" class="fpt-win-btn fpt-win-btn--primary" id="empty-template-save">Сохранить</button>
        </div>
    `;
    const overlay = win.scrim;
    document.body.appendChild(overlay);
    fptWindow.open(overlay, { focus: win.body.querySelector('textarea') });

    const textarea = modal.querySelector('textarea');
    modal.querySelector('.fp-tpl-add-image').addEventListener('click', () => handleImageAddClick(textarea));

    const closeModal = () => win.close();

    overlay.querySelector('#empty-template-close').addEventListener('click', closeModal);

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

async function addChatTemplateButtons() {
    await loadTemplateSettings();
    const chatInput = document.querySelector('.chat-form-input .form-control');
    const hasChat = chatInput &&
        !document.querySelector('.chat-not-selected, .chat-empty-message') &&
        document.querySelector('.chat-header, .chat-full-header, .chat-message-list');

    if (!hasChat || templateSettings.enabled === false) {
        removeTemplatePopover();
        return;
    }

    setupTemplatePopover();
}

function removeTemplatePopover() {
    document.querySelectorAll('.fpt-tpl-popover-cell').forEach(el => el.remove());
    document.getElementById('fpt-tpl-popover-btn')?.remove();
    document.getElementById('fpt-tpl-popover')?.remove();
}

function setupTemplatePopover() {
    removeTemplatePopover();

    const attachBtn = document.querySelector('.chat-btn-image:not(.fpt-tpl-popover-btn)');
    const attachWrap = attachBtn ? (attachBtn.closest('.chat-form-attach') || attachBtn.parentElement) : null;
    if (!attachWrap || !attachBtn) return;

    const trigger = createElement('button', {
        type: 'button',
        id: 'fpt-tpl-popover-btn',
        class: 'btn btn-default chat-btn-image fpt-tpl-popover-btn',
        title: 'Шаблоны ответов'
    });
    trigger.innerHTML = '<span class="material-symbols-rounded">description</span>';

    // Place the trigger to the LEFT of the paperclip. If the attach button sits in its
    // own .chat-form-attach cell, insert our trigger as a sibling right before that cell
    // so it visually appears to the left; otherwise insert before the attach button.
    if (attachBtn.closest('.chat-form-attach') === attachWrap && attachWrap.parentNode) {
        // make a tiny wrapper cell so flex layout keeps it inline to the left
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
    if (existing) { existing.remove(); return; }

    const pop = createElement('div', { id: 'fpt-tpl-popover', class: 'fpt-tpl-popover' });

    const header = createElement('div', { class: 'fpt-tpl-popover-head' });
    const title = createElement('span', {});
    title.textContent = 'Шаблоны';
    const gear = createElement('button', { type: 'button', class: 'fpt-tpl-popover-gear', title: 'Настройки шаблонов' });
    gear.innerHTML = '<span class="material-symbols-rounded">settings</span>';
    gear.addEventListener('click', (e) => {
        e.stopPropagation();
        pop.remove();
        openTemplateSettings();
    });
    header.appendChild(title);
    header.appendChild(gear);
    pop.appendChild(header);

    const list = createElement('div', { class: 'fpt-tpl-popover-list custom-scroll' });
    const addItem = (config) => {
        const item = createElement('button', { type: 'button', class: 'fpt-tpl-popover-item' });
        const lbl = createElement('span', { class: 'fpt-tpl-popover-label' });
        lbl.textContent = config.label;
        item.appendChild(lbl);
        item.addEventListener('click', () => {
            pop.remove();
            useTemplate(config);
        });
        list.appendChild(item);
    };

    let any = false;
    for (const key in templateSettings.standard) {
        const c = templateSettings.standard[key];
        if (c.enabled) { addItem({ ...c, key, isCustom: false }); any = true; }
    }
    templateSettings.custom.forEach(c => {
        if (c.enabled) { addItem({ ...c, isCustom: true }); any = true; }
    });
    if (!any) {
        const empty = createElement('div', { class: 'fpt-tpl-popover-empty' });
        empty.textContent = 'Нет активных шаблонов';
        list.appendChild(empty);
    }
    pop.appendChild(list);

    document.body.appendChild(pop);

    // Position the popover anchored to the trigger, opening upward.
    const r = trigger.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let left = r.left + r.width / 2 - popRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));
    let top = r.top - popRect.height - 10;
    if (top < 8) top = r.bottom + 10; // not enough room above → open below
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.classList.add('open');

    // Close on outside click / escape
    const onDoc = (ev) => {
        if (!pop.contains(ev.target) && ev.target !== trigger && !trigger.contains(ev.target)) {
            pop.remove();
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        }
    };
    const onKey = (ev) => { if (ev.key === 'Escape') { pop.remove(); document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); } };
    setTimeout(() => {
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
    }, 0);
}

// Opens the FunPay Funcy popup straight on the Templates page.
async function openTemplateSettings() {
    try {
        if (typeof window.__fpEnsurePopup === 'function') await window.__fpEnsurePopup();
    } catch (_) {}
    const popup = document.querySelector('.fp-tools-popup');
    if (!popup) return;
    if (typeof window.fptOpenPopupPage !== 'function') return;
    await window.fptOpenPopupPage('templates', { mode: 'templates' });
    popup.classList.add('active');
}

if (typeof window !== 'undefined' && window.fptPopupActions) {
    window.fptPopupActions.register('templates', 'addCustomTemplateBtn', async p => {
        let template;
        await window.fptPopupActions.updateSettings('fpToolsTemplateSettings', current => {
        const config = current.fpToolsTemplateSettings || {};
        config.custom = Array.isArray(config.custom) ? config.custom.map(withoutTemplateColor) : [];
        let id = Date.now(); while (config.custom.some(item => item.id === String(id))) id++;
        template = { id: String(id), enabled: true, label: p.label || 'Новый шаблон',
            text: p.text || '', images: p.images || [], sendOrder: p.sendOrder || 'text_first' };
        config.custom.push(template);
        return { fpToolsTemplateSettings: config };
        }, loadTemplateSettings);
        return template;
    });
    window.fptPopupActions.register('templates', 'saveTemplate', async p => {
        const result = await window.fptPopupActions.updateSettings('fpToolsTemplateSettings', current => {
        const config = current.fpToolsTemplateSettings || {};
        if (p.custom) {
            config.custom = Array.isArray(config.custom) ? config.custom.map(withoutTemplateColor) : [];
            const index = config.custom.findIndex(template => template.id === p.key);
            if (index < 0) throw new Error('Шаблон не найден.');
            if (p.remove) config.custom.splice(index, 1);
            else config.custom[index] = { ...config.custom[index], ...withoutTemplateColor(p.settings) };
        } else {
            if (!Object.hasOwn(DEFAULT_STANDARD_TEMPLATES, p.key)) throw new Error('Шаблон не найден.');
            config.standard = { ...(config.standard || {}) };
            config.standard[p.key] = { ...withoutTemplateColor(config.standard[p.key]), ...withoutTemplateColor(p.settings) };
        }
        return { fpToolsTemplateSettings: config };
        }, loadTemplateSettings);
        return result.fpToolsTemplateSettings;
    });
}
