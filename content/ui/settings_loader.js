// content/ui/settings_loader.js

let fpToolsAccounts = [];
let aiModeActive = false;

function getTemplateSettingsPanel() {
    const page = document.querySelector('.fp-tools-page-content[data-page="templates"]');
    return page?.querySelector('[data-quick-replies-pane="templates"]') || page;
}

async function renderTemplateSettings(targetPanel = getTemplateSettingsPanel()) {
    const container = targetPanel?.querySelector('#template-settings-container')
        || document.getElementById('template-settings-container');
    if (!container) return;
    container.innerHTML = '';

    const createItem = (key, config, isCustom = false) => {
        const item = createElement('div', { class: 'template-item' });
        if (!config.enabled) item.classList.add('disabled-in-settings');
        
        const escapeHtml = value => String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const colorPickerHtml = `<input type="color" class="template-color-picker" value="${escapeHtml(config.color || '#1b75bb')}" data-key="${escapeHtml(key)}" data-custom="${isCustom}" aria-label="Цвет шаблона">`;
        const deleteBtnHtml = isCustom ? `
            <button type="button" class="fpt-ui-button fpt-ui-button--tertiary fpt-ui-icon-button delete-custom-template-btn fp-qr-template-delete" data-id="${escapeHtml(config.id)}" title="Удалить шаблон" aria-label="Удалить шаблон">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 7h8m-7 0 .5 11h5L15 7m-5-2h4l.5 2h-5L10 5Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>` : '';

        item.innerHTML = `
            <div class="template-item-header">
                <input type="checkbox" class="template-toggle fp-qr-template-toggle" data-key="${escapeHtml(key)}" data-custom="${isCustom}" ${config.enabled ? 'checked' : ''}>
                ${colorPickerHtml}
                <span class="template-label" contenteditable="true" role="textbox" aria-label="Название шаблона" data-key="${escapeHtml(key)}" data-custom="${isCustom}">${escapeHtml(config.label)}</span>
                ${deleteBtnHtml}
            </div>
            <div class="textarea-with-controls">
                <textarea class="template-input template-text" data-key="${escapeHtml(key)}" data-custom="${isCustom}" placeholder="Текст шаблона...">${escapeHtml(config.text)}</textarea>
                <button type="button" class="fpt-ui-button fpt-ui-button--secondary fpt-ui-icon-button add-image-btn fpt-img-btn fp-qr-template-image" title="Добавить изображение" aria-label="Добавить изображение">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><path d="m6.5 17 4.2-4.2 2.8 2.8 1.7-1.7L19 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
        `;
        container.appendChild(item);

        // restore previously-attached images as chips (separate from text)
        const ta = item.querySelector('textarea.template-text');
        if (ta) {
            // restore send order BEFORE rendering chips so the mini-preview is correct
            if (typeof fptSetSendOrder === 'function') {
                fptSetSendOrder(ta, config.sendOrder === 'image_first' ? 'image_first' : 'text_first');
            }
            if (Array.isArray(config.images) && config.images.length) {
                const arr = config.images.map(d => ({ id: Math.random().toString(36).slice(2, 8), dataUrl: d }));
                __fptAttachments.set(ta, arr);
                ta.dataset.fptImages = JSON.stringify(config.images);
                if (typeof fptRenderAttachments === 'function') fptRenderAttachments(ta);
            }
        }
    };

    for (const key in templateSettings.standard) {
        createItem(key, templateSettings.standard[key], false);
    }
    
    templateSettings.custom.forEach(config => {
        createItem(config.id, config, true);
    });
}

async function setupTemplateSettingsHandlers() {
    await loadTemplateSettings();
    const templatesPage = document.querySelector('.fp-tools-page-content[data-page="templates"]');
    const templatesPanel = getTemplateSettingsPanel();
    await renderTemplateSettings(templatesPanel);

    const getTemplateControl = id => templatesPanel?.querySelector(`#${id}`) || document.getElementById(id);
    const container = getTemplateControl('template-settings-container');
    if (!container || !templatesPage || !templatesPanel) return;
    
    const posRadio = templatesPanel.querySelector(`input[name="templatePos"][value="${templateSettings.buttonPosition}"]`);
    if(posRadio) posRadio.checked = true;

    // Popover hint visible only when the «popover» layout is selected.
    const popoverHint = getTemplateControl('fpt-popover-hint');
    const isSidebarPos = () => templateSettings.buttonPosition === 'sidebar_top' || templateSettings.buttonPosition === 'sidebar_bottom';
    const syncPopoverHint = () => {
        if (popoverHint) popoverHint.style.display = (templateSettings.buttonPosition === 'popover') ? 'block' : 'none';
    };
    // Sidebar-only settings block appears (not just dims) when a sidebar position is chosen.
    const sidebarExtra = getTemplateControl('fpt-sidebar-extra');
    const syncSidebarExtra = () => {
        if (sidebarExtra) sidebarExtra.style.display = isSidebarPos() ? '' : 'none';
    };
    syncPopoverHint();
    syncSidebarExtra();

    // Master enable toggle - hides the whole config block when off.
    const enabledChk = getTemplateControl('templatesEnabled');
    const configBlock = getTemplateControl('fpt-templates-config');
    const syncEnabled = () => {
        if (configBlock) configBlock.style.display = (templateSettings.enabled === false) ? 'none' : '';
    };
    if (enabledChk) {
        enabledChk.checked = templateSettings.enabled !== false;
        enabledChk.onchange = async (e) => {
            templateSettings.enabled = e.target.checked;
            syncEnabled();
            await saveTemplateSettings();
            await addChatTemplateButtons();
        };
    }
    syncEnabled();

    getTemplateControl('sendTemplatesImmediately').checked = templateSettings.sendTemplatesImmediately;

    // 3.0: debounce to stop per-keystroke lag. Previously every character typed triggered a
    // full settings save AND a full rebuild of all chat template buttons in the DOM, which made
    // editing names/colors extremely laggy. Now we update the in-memory model instantly, but
    // defer the expensive save + button rebuild until typing pauses.
    let saveDebounce = null;
    const scheduleSave = () => {
        if (saveDebounce) clearTimeout(saveDebounce);
        saveDebounce = setTimeout(async () => {
            await saveTemplateSettings();
            await addChatTemplateButtons();
        }, 400);
    };

    const handleInput = async (e) => {
        const target = e.target;
        const isCustom = target.dataset.custom === 'true';
        const key = target.dataset.key;

        if (isCustom) {
            const template = templateSettings.custom.find(t => t.id === key);
            if (!template) return;
            if (target.classList.contains('template-toggle')) template.enabled = target.checked;
            if (target.classList.contains('template-color-picker')) template.color = target.value;
            if (target.classList.contains('template-label')) template.label = target.textContent;
            if (target.classList.contains('template-text')) {
                template.text = target.value;
                if (target.dataset.fptImages) { try { template.images = JSON.parse(target.dataset.fptImages); } catch(_){} }
            }
            // send order travels on the textarea dataset (set by the chip picker)
            const ta = target.classList.contains('template-text') ? target
                     : target.closest('.template-item')?.querySelector('textarea.template-text');
            if (ta && ta.dataset.fptSendOrder) template.sendOrder = ta.dataset.fptSendOrder;
        } else {
            const template = templateSettings.standard[key];
            if (!template) return;
            if (target.classList.contains('template-toggle')) template.enabled = target.checked;
            if (target.classList.contains('template-color-picker')) template.color = target.value;
            if (target.classList.contains('template-label')) template.label = target.textContent;
            if (target.classList.contains('template-text')) {
                template.text = target.value;
                if (target.dataset.fptImages) { try { template.images = JSON.parse(target.dataset.fptImages); } catch(_){} }
            }
            const ta = target.classList.contains('template-text') ? target
                     : target.closest('.template-item')?.querySelector('textarea.template-text');
            if (ta && ta.dataset.fptSendOrder) template.sendOrder = ta.dataset.fptSendOrder;
        }

        if (target.classList.contains('template-toggle')) {
            target.closest('.template-item').classList.toggle('disabled-in-settings', !target.checked);
            // toggles are cheap & discrete - save immediately
            await saveTemplateSettings();
            await addChatTemplateButtons();
            return;
        }

        scheduleSave();
    };

    // Guard against attaching listeners twice (this function is called repeatedly).
    if (!container.dataset.fptHandlersAttached) {
        container.dataset.fptHandlersAttached = '1';
        container.addEventListener('input', handleInput);
        container.addEventListener('change', handleInput);
        container.addEventListener('fpt-attachment-changed', handleInput);
        container.addEventListener('focusout', (e) => {
            if (e.target.classList.contains('template-label')) handleInput(e);
        });

        container.addEventListener('click', async (e) => {
            const delBtn = e.target.closest('.delete-custom-template-btn');
            if (delBtn) {
                const id = delBtn.dataset.id;
                templateSettings.custom = templateSettings.custom.filter(t => t.id !== id);
                await saveTemplateSettings();
                await renderTemplateSettings();
                await addChatTemplateButtons();
                return;
            }
            const imgBtn = e.target.closest('.add-image-btn');
            if (imgBtn) {
                // find the textarea in the same template row (robust to icon-span markup)
                const row = imgBtn.closest('.template-item') || imgBtn.parentElement;
                const textarea = row && row.querySelector('textarea.template-text, textarea');
                if (textarea) handleImageAddClick(textarea);
            }
        });
    } // end attach-once guard

    getTemplateControl('addCustomTemplateBtn').onclick = async () => {
        templateSettings.custom.push({
            id: Date.now().toString(),
            label: 'Новый шаблон',
            text: '',
            color: '#A21CAF',
            enabled: true
        });
        await saveTemplateSettings();
        await renderTemplateSettings(); // Re-render to add the new item (delegation handles events)
    };

    templatesPanel.querySelectorAll('input[name="templatePos"]').forEach(radio => {
        radio.onchange = async (e) => {
            templateSettings.buttonPosition = e.target.value;
            syncPopoverHint();
            syncSidebarExtra();
            await saveTemplateSettings();
            await addChatTemplateButtons();
        };
    });

    getTemplateControl('sendTemplatesImmediately').onchange = async (e) => {
        templateSettings.sendTemplatesImmediately = e.target.checked;
        await saveTemplateSettings();
    };

    // ── Button appearance ─────────────────────────────────────────────────────
    const appx = templatesPanel.querySelector('.fpt-appx');
    const dispRef = () => (templateSettings.display = templateSettings.display || { ...DEFAULT_TEMPLATE_DISPLAY });

    const writePreviewAttrs = () => {
        const preview = getTemplateControl('fpt-appearance-preview');
        if (!preview) return;
        const disp = dispRef();
        preview.setAttribute('data-fpt-shape', disp.shape);
        preview.setAttribute('data-fpt-size', disp.size);
        preview.setAttribute('data-fpt-fill', disp.fill);
        preview.setAttribute('data-fpt-align', disp.align);
        preview.setAttribute('data-fpt-fullwidth', disp.fullWidth ? '1' : '0');
        preview.setAttribute('data-fpt-uppercase', disp.uppercase ? '1' : '0');
        preview.setAttribute('data-fpt-compact', disp.compact ? '1' : '0');
    };

    const syncAppxUI = () => {
        if (!appx) return;
        const disp = dispRef();
        appx.querySelectorAll('.fpt-seg').forEach(seg => {
            const opt = seg.dataset.fptOpt;
            seg.querySelectorAll('button').forEach(b =>
                b.classList.toggle('active', b.dataset.val === String(disp[opt])));
        });
        appx.querySelectorAll('.fpt-chip-toggle').forEach(chip =>
            chip.classList.toggle('active', !!disp[chip.dataset.fptToggle]));
        // Alignment only matters when buttons span the full width - otherwise they're
        // content-sized and alignment is invisible. Hide the control unless fullWidth.
        const alignBlock = getTemplateControl('fpt-align-block');
        if (alignBlock) alignBlock.classList.toggle('fpt-disabled', !disp.fullWidth);
        writePreviewAttrs();
    };

    if (appx && !appx.dataset.fptBound) {
        appx.dataset.fptBound = '1';
        const persist = async () => {
            await saveTemplateSettings();
            await addChatTemplateButtons();
        };
        appx.querySelectorAll('.fpt-seg').forEach(seg => {
            const opt = seg.dataset.fptOpt;
            seg.addEventListener('click', async (e) => {
                const btn = e.target.closest('button[data-val]');
                if (!btn) return;
                dispRef()[opt] = btn.dataset.val;
                syncAppxUI();
                await persist();
            });
        });
        appx.querySelectorAll('.fpt-chip-toggle').forEach(chip => {
            chip.addEventListener('click', async () => {
                const key = chip.dataset.fptToggle;
                dispRef()[key] = !dispRef()[key];
                syncAppxUI();
                await persist();
            });
        });
    }
    syncAppxUI();
}


// ── POPUP GEOMETRY & VIEWPORT NORMALIZATION ────────────────────────────────
function getPopupViewportLimits() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const maxWidth = Math.max(320, Math.min(1160, Math.floor(winW * 0.94)));
    const maxHeight = Math.max(300, Math.floor(winH * 0.90));

    const desiredMinWidth = 760;
    const desiredMinHeight = 560;

    const minWidth = Math.min(desiredMinWidth, maxWidth);
    const minHeight = Math.min(desiredMinHeight, maxHeight);

    const defaultWidth = Math.min(Math.max(1160, minWidth), maxWidth);
    const defaultHeight = Math.min(Math.max(780, minHeight), maxHeight);

    return {
        winW,
        winH,
        maxWidth,
        maxHeight,
        minWidth,
        minHeight,
        defaultWidth,
        defaultHeight
    };
}

function parsePopupDimension(val) {
    if (typeof val === 'number') {
        return Number.isFinite(val) && val > 0 ? val : null;
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        const parsed = parseFloat(trimmed);
        if (Number.isFinite(parsed) && parsed > 0) {
            if (trimmed.endsWith('vw')) return (parsed / 100) * window.innerWidth;
            if (trimmed.endsWith('vh')) return (parsed / 100) * window.innerHeight;
            return parsed;
        }
    }
    return null;
}

function normalizePopupSize(savedSize) {
    const limits = getPopupViewportLimits();
    if (!savedSize || typeof savedSize !== 'object') {
        return { width: limits.defaultWidth, height: limits.defaultHeight };
    }

    const rawW = parsePopupDimension(savedSize.width);
    const rawH = parsePopupDimension(savedSize.height);

    if (rawW === null || rawH === null) {
        return { width: limits.defaultWidth, height: limits.defaultHeight };
    }

    // Auto-migrate exact old default 900x720 to new default
    if (Math.round(rawW) === 900 && Math.round(rawH) === 720) {
        return { width: limits.defaultWidth, height: limits.defaultHeight };
    }

    // Otherwise preserve custom user preferences, safely clamped within limits
    const width = Math.min(Math.max(rawW, limits.minWidth), limits.maxWidth);
    const height = Math.min(Math.max(rawH, limits.minHeight), limits.maxHeight);

    return {
        width: Math.round(width),
        height: Math.round(height)
    };
}

function clampPopupPosition(left, top, popupWidth, popupHeight) {
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const maxLeft = Math.max(0, winW - popupWidth);
    const maxTop = Math.max(0, winH - popupHeight);

    return {
        left: Math.max(0, Math.min(Math.round(left), maxLeft)),
        top: Math.max(0, Math.min(Math.round(top), maxTop))
    };
}

function applySavedPopupGeometry(toolsPopup, settings) {
    if (!toolsPopup) return;

    // 1 & 2 & 3: Normalize and apply safe dimensions
    const size = normalizePopupSize(settings?.fpToolsPopupSize);
    toolsPopup.style.width = `${size.width}px`;
    toolsPopup.style.height = `${size.height}px`;

    // 4 & 5 & 6 & 7: Physical size and position clamp
    if (settings?.fpToolsPopupDragged && settings?.fpToolsPopupPosition) {
        const rawLeft = parsePopupDimension(settings.fpToolsPopupPosition.left);
        const rawTop = parsePopupDimension(settings.fpToolsPopupPosition.top);

        if (rawLeft !== null && rawTop !== null) {
            const currentW = toolsPopup.offsetWidth || size.width;
            const currentH = toolsPopup.offsetHeight || size.height;

            const clamped = clampPopupPosition(rawLeft, rawTop, currentW, currentH);
            toolsPopup.style.left = `${clamped.left}px`;
            toolsPopup.style.top = `${clamped.top}px`;
            toolsPopup.classList.add('no-transform');
            return;
        }
    }

    // Default: centered via CSS translate(-50%, -50%)
    toolsPopup.classList.remove('no-transform');
    toolsPopup.style.left = '';
    toolsPopup.style.top = '';
}

function ensurePopupInsideViewport(toolsPopup) {
    if (!toolsPopup) return;

    const limits = getPopupViewportLimits();
    let currentW = toolsPopup.offsetWidth;
    let currentH = toolsPopup.offsetHeight;

    if (!currentW || !currentH) {
        currentW = parsePopupDimension(toolsPopup.style.width) || limits.defaultWidth;
        currentH = parsePopupDimension(toolsPopup.style.height) || limits.defaultHeight;
    }

    let needsSizeUpdate = false;
    let newW = currentW;
    let newH = currentH;

    if (currentW > limits.maxWidth) {
        newW = limits.maxWidth;
        needsSizeUpdate = true;
    } else if (currentW < limits.minWidth) {
        newW = limits.minWidth;
        needsSizeUpdate = true;
    }

    if (currentH > limits.maxHeight) {
        newH = limits.maxHeight;
        needsSizeUpdate = true;
    } else if (currentH < limits.minHeight) {
        newH = limits.minHeight;
        needsSizeUpdate = true;
    }

    if (needsSizeUpdate) {
        toolsPopup.style.width = `${Math.round(newW)}px`;
        toolsPopup.style.height = `${Math.round(newH)}px`;
        currentW = Math.round(newW);
        currentH = Math.round(newH);
    }

    // Clamp position if dragged / no-transform
    if (toolsPopup.classList.contains('no-transform')) {
        let curLeft = parsePopupDimension(toolsPopup.style.left);
        let curTop = parsePopupDimension(toolsPopup.style.top);
        if (curLeft === null) curLeft = toolsPopup.offsetLeft;
        if (curTop === null) curTop = toolsPopup.offsetTop;

        const clamped = clampPopupPosition(curLeft, curTop, currentW, currentH);
        if (toolsPopup.style.left !== `${clamped.left}px` || toolsPopup.style.top !== `${clamped.top}px`) {
            toolsPopup.style.left = `${clamped.left}px`;
            toolsPopup.style.top = `${clamped.top}px`;
        }
    }
}

// Expose globally for main_popup.js and content_script.js
window.getPopupViewportLimits = getPopupViewportLimits;
window.parsePopupDimension = parsePopupDimension;
window.normalizePopupSize = normalizePopupSize;
window.clampPopupPosition = clampPopupPosition;
window.applySavedPopupGeometry = applySavedPopupGeometry;
window.ensurePopupInsideViewport = ensurePopupInsideViewport;


async function loadSavedSettings() {
    window.__fptAutoReplySettingsReady = false;
    const settings = await chrome.storage.local.get([
        'fpToolsTemplateSettings', 'enableCustomTheme', 'fpToolsTheme', 'aiModeActive',
        'autoBumpEnabled', 'fpToolsCursorFx', 'fpToolsCustomCursor',
        'fpToolsPopupPosition', 'fpToolsPopupSize', 'fpToolsPopupDragged', 'fpToolsAccentColor',
        'fpToolsAccounts', 'showSalesStats', 'showFinanceStats', 'hideBalance', 'viewSellersPromo', 'notificationSound', 'notificationVolume',
        'fpToolsDiscord',
        'fpToolsSelectiveBumpEnabled', 'fpToolsSelectedBumpCategories', 'fpToolsBumpOnlyAutoDelivery',
        'autoReviewEnabled', 'reviewTemplates', 'greetingEnabled', 'greetingText', 'keywordsEnabled', 'keywords',
        'fpToolsIdentifierEnabled',
        'fptShowCommission',
        'fptShowRealPrices',
        'fpToolsBuyerHistory',
        'fpToolsShowUnconfirmed',
        'fpToolsAutoRestoreEnabled',
        'fpToolsAutoDisableEnabled',
        'fpToolsReviewRequestTemplate',
        'fpToolsAutoReplies'
    ]);
    
    fpToolsAccounts = settings.fpToolsAccounts || [];
    renderAccountsList();

    if (settings.fpToolsAccentColor) window.__fptUserAccent = settings.fpToolsAccentColor;

    const logoutLink = document.querySelector('.menu-item-logout');
    if(logoutLink && !document.querySelector('.fp-tools-logout-clean')) {
        const cleanLogoutItem = document.createElement('li');
        cleanLogoutItem.innerHTML = `<a href="#" class="fp-tools-logout-clean" style="color: #ff6b6b !important;">Выйти (очистить куки)</a>`;
        logoutLink.parentElement.insertAdjacentElement('afterend', cleanLogoutItem);
        cleanLogoutItem.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.sendMessage({ action: 'deleteCookiesAndReload' });
        });
    }

    if (typeof initializePiggyBank === 'function') {
        initializePiggyBank();
    }
    
    const toolsPopup = document.querySelector('.fp-tools-popup');
    if (toolsPopup) {
        applySavedPopupGeometry(toolsPopup, settings);
    }

    const discordSettings = settings.fpToolsDiscord || { enabled: false, webhookUrl: '', pingEveryone: false, pingHere: false };
    const discordLogEnabledEl = document.getElementById('discordLogEnabled');
    const discordWebhookUrlEl = document.getElementById('discordWebhookUrl');
    const discordPingEveryoneEl = document.getElementById('discordPingEveryone');
    const discordPingHereEl = document.getElementById('discordPingHere');
    const discordSettingsContainer = document.getElementById('discordSettingsContainer');

    if (discordLogEnabledEl) discordLogEnabledEl.checked = discordSettings.enabled;
    if (discordWebhookUrlEl) discordWebhookUrlEl.value = discordSettings.webhookUrl;
    if (discordPingEveryoneEl) discordPingEveryoneEl.checked = discordSettings.pingEveryone;
    if (discordPingHereEl) discordPingHereEl.checked = discordSettings.pingHere;

    const toggleDiscordControls = () => {
        if (!discordLogEnabledEl) return;
        const enabled = discordLogEnabledEl.checked;
        if (discordSettingsContainer) discordSettingsContainer.style.display = enabled ? 'block' : 'none';
        if (discordPingEveryoneEl) discordPingEveryoneEl.disabled = !enabled;
        if (discordPingHereEl) discordPingHereEl.disabled = !enabled;
    };

    if (discordLogEnabledEl) {
        discordLogEnabledEl.addEventListener('change', toggleDiscordControls);
        toggleDiscordControls();
    }
    
    if (typeof initializeAutoReplyUI === 'function') {
        await initializeAutoReplyUI(settings.fpToolsAutoReplies || {});
    }
    if (typeof initializeAutoReviewUI === 'function') {
        await initializeAutoReviewUI(settings.fpToolsAutoReplies || {});
    }

    await setupTemplateSettingsHandlers();

    aiModeActive = settings.aiModeActive === true;
    const aiButton = document.getElementById('aiModeToggleBtn');
    if(aiButton) {
        aiButton.classList.toggle('active', aiModeActive);
        aiButton.title = aiModeActive ? 'AI Режим АКТИВЕН (Enter для генерации/отправки)' : 'AI Режим (Enter для генерации/отправки)';
    }

    const enableCustomThemeCheckboxEl = document.getElementById('enableCustomThemeCheckbox');
    const isThemeEnabled = settings.enableCustomTheme === true;
    if(enableCustomThemeCheckboxEl) {
        enableCustomThemeCheckboxEl.checked = isThemeEnabled;
        toggleThemeControls(!isThemeEnabled);
    }
    updateThemePreview();

    document.getElementById('autoBumpEnabled').checked = settings.autoBumpEnabled === true;
    document.getElementById('selectiveBumpEnabled').checked = settings.fpToolsSelectiveBumpEnabled === true;
    document.getElementById('bumpOnlyAutoDelivery').checked = settings.fpToolsBumpOnlyAutoDelivery === true;

    const cursorFxSettings = settings.fpToolsCursorFx || {};
    const cursorFxDefaults = { enabled: false, type: 'sparkle', color1: '#FF6B6B', color2: '#1b75bb', rgb: false, count: 50 };
    const finalCursorFxSettings = { ...cursorFxDefaults, ...cursorFxSettings };

    document.getElementById('cursorFxEnabled').checked = finalCursorFxSettings.enabled;
    document.getElementById('cursorFxType').value = finalCursorFxSettings.type;
    document.getElementById('cursorFxColor1').value = finalCursorFxSettings.color1;
    document.getElementById('cursorFxColor2').value = finalCursorFxSettings.color2;
    document.getElementById('cursorFxRgb').checked = finalCursorFxSettings.rgb;
    document.getElementById('cursorFxCount').value = finalCursorFxSettings.count;
    document.getElementById('cursorFxCountValue').textContent = `${finalCursorFxSettings.count}%`;
    cursorFx.updateConfig(finalCursorFxSettings);
    
    const customCursorSettings = settings.fpToolsCustomCursor || {};
    const customCursorDefaults = { enabled: false, image: null, size: 32, opacity: 100, hideSystem: true };
    const finalCustomCursorSettings = { ...customCursorDefaults, ...customCursorSettings };

    document.getElementById('customCursorEnabled').checked = finalCustomCursorSettings.enabled;
    const controlsDiv = document.getElementById('customCursorControls');
    if (controlsDiv) controlsDiv.style.display = finalCustomCursorSettings.enabled ? 'block' : 'none';
    
    document.getElementById('hideSystemCursor').checked = finalCustomCursorSettings.hideSystem;
    
    document.getElementById('customCursorSize').value = finalCustomCursorSettings.size;
    document.getElementById('customCursorSizeValue').textContent = `${finalCustomCursorSettings.size}px`;
    document.getElementById('customCursorOpacity').value = finalCustomCursorSettings.opacity;
    document.getElementById('customCursorOpacityValue').textContent = `${finalCustomCursorSettings.opacity}%`;
    
    const preview = document.getElementById('cursor-image-preview');
    if (finalCustomCursorSettings.image) {
        preview.style.backgroundImage = `url(${finalCustomCursorSettings.image})`;
        preview.textContent = '';
    } else {
        preview.style.backgroundImage = 'none';
        preview.textContent = 'Нет';
    }
    cursorFx.updateCustomCursor(finalCustomCursorSettings);

    document.getElementById('showSalesStatsCheckbox').checked = settings.showSalesStats !== false;
    { const _fs=document.getElementById('showFinanceStatsCheckbox'); if(_fs) _fs.checked = settings.showFinanceStats !== false; }
    document.getElementById('hideBalanceCheckbox').checked = settings.hideBalance === true;
    document.getElementById('viewSellersPromoCheckbox').checked = settings.viewSellersPromo !== false;

    // FPT: комиссия разделов и реальные цены — по умолчанию ВЫКЛ
    (function () {
        const commEl = document.getElementById('fptShowCommissionCheckbox');
        const realEl = document.getElementById('fptShowRealPricesCheckbox');
        if (commEl) {
            commEl.checked = settings.fptShowCommission === true;
            if (!commEl.dataset.bound) {
                commEl.dataset.bound = '1';
                commEl.addEventListener('change', () => {
                    chrome.storage.local.set({ fptShowCommission: commEl.checked });
                });
            }
        }
        if (realEl) {
            realEl.checked = settings.fptShowRealPrices === true;
            if (!realEl.dataset.bound) {
                realEl.dataset.bound = '1';
                realEl.addEventListener('change', () => {
                    chrome.storage.local.set({ fptShowRealPrices: realEl.checked });
                });
            }
        }
    })();
    // 2.8: FPT identifier toggle (default: enabled)
    const identifierEl = document.getElementById('fptIdentifierEnabled');
    if (identifierEl) {
        identifierEl.checked = settings.fpToolsIdentifierEnabled !== false;
    }

    // 2.9: New settings toggles

    const buyerHistoryEl = document.getElementById('fpToolsBuyerHistory');
    if (buyerHistoryEl) buyerHistoryEl.checked = settings.fpToolsBuyerHistory !== false;

    const unconfirmedEl = document.getElementById('fpToolsShowUnconfirmed');
    if (unconfirmedEl) unconfirmedEl.checked = settings.fpToolsShowUnconfirmed !== false;

    // 3.0: Auto-restore/disable
    const autoRestoreEl = document.getElementById('fpAutoRestoreEnabled');
    if (autoRestoreEl) autoRestoreEl.checked = settings.fpToolsAutoRestoreEnabled === true;

    const autoDisableEl = document.getElementById('fpAutoDisableEnabled');
    if (autoDisableEl) autoDisableEl.checked = settings.fpToolsAutoDisableEnabled === true;

    const reviewTplEl = document.getElementById('reviewRequestTemplate');
    if (reviewTplEl) reviewTplEl.value = settings.fpToolsReviewRequestTemplate || '';

    // 3.0: Extended autoresponder fields come from the same initial settings snapshot.
    {
        const ar = settings.fpToolsAutoReplies || {};
        const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
        const setVal   = (id, val) => { const el = document.getElementById(id); if (el) el.value  = val || ''; };
        setCheck('newOrderReplyEnabled',     ar.newOrderReplyEnabled);
        setCheck('orderConfirmReplyEnabled', ar.orderConfirmReplyEnabled);
        setCheck('typingDelay',              ar.typingDelay);
        setCheck('onlyNewChats',             ar.onlyNewChats);
        setCheck('ignoreSystemMessages',     ar.ignoreSystemMessages);
        setVal('newOrderReplyText',          ar.newOrderReplyText);
        setVal('orderConfirmReplyText',      ar.orderConfirmReplyText);
        setVal('greetingCooldownDays',       ar.greetingCooldownDays ?? 0);

        // restore image attachment chips (separate from text)
        const restoreImgs = (id, arr, order) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (order && typeof fptSetSendOrder === 'function') fptSetSendOrder(el, order);
            if (!Array.isArray(arr) || !arr.length) return;
            const list = arr.map(d => ({ id: Math.random().toString(36).slice(2, 8), dataUrl: d }));
            if (typeof __fptAttachments !== 'undefined') __fptAttachments.set(el, list);
            el.dataset.fptImages = JSON.stringify(arr);
            if (typeof fptRenderAttachments === 'function') fptRenderAttachments(el);
        };
        restoreImgs('greetingText', ar.greetingImages, ar.greetingSendOrder);
        restoreImgs('newOrderReplyText', ar.newOrderReplyImages, ar.newOrderReplySendOrder);
        restoreImgs('orderConfirmReplyText', ar.orderConfirmReplyImages, ar.orderConfirmReplySendOrder);
        if (ar.reviewTemplateImages) {
            restoreImgs('fpt-review-5', ar.reviewTemplateImages['5']);
            restoreImgs('fpt-review-4', ar.reviewTemplateImages['4']);
            restoreImgs('fpt-review-3', ar.reviewTemplateImages['3']);
            restoreImgs('fpt-review-2', ar.reviewTemplateImages['2']);
            restoreImgs('fpt-review-1', ar.reviewTemplateImages['1']);
        }
        if (typeof updateAutoReviewTemplateStatuses === 'function') {
            updateAutoReviewTemplateStatuses();
        }
    }

    // Review request template
    const rrTemplateEl = document.getElementById('fp-review-request-template');
    if (rrTemplateEl && settings.fpToolsAutoReplies?.reviewRequestTemplate !== undefined) {
        rrTemplateEl.value = settings.fpToolsAutoReplies.reviewRequestTemplate;
    }

    const savedSound = settings.notificationSound || 'default';
    const soundRadio = document.querySelector(`input[name="notificationSound"][value="${savedSound}"]`);
    if (soundRadio) {
        soundRadio.checked = true;
    }

    // 3.0: notification volume slider + preview
    const volSlider = document.getElementById('notificationVolume');
    const volValue = document.getElementById('notificationVolumeValue');
    if (volSlider) {
        const vol = (typeof settings.notificationVolume === 'number') ? settings.notificationVolume : 1;
        volSlider.value = Math.round(vol * 100);
        if (volValue) volValue.textContent = `${Math.round(vol * 100)}%`;
        if (!volSlider.dataset.fptBound) {
            volSlider.dataset.fptBound = '1';
            volSlider.addEventListener('input', () => {
                if (volValue) volValue.textContent = `${volSlider.value}%`;
            });
        }
    }
    const previewBtn = document.getElementById('previewNotificationBtn');
    if (previewBtn && !previewBtn.dataset.fptBound) {
        previewBtn.dataset.fptBound = '1';
        previewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const sel = document.querySelector('input[name="notificationSound"]:checked');
            const vol = volSlider ? (parseInt(volSlider.value, 10) / 100) : 1;
            if (typeof previewNotificationSound === 'function') {
                previewNotificationSound(sel ? sel.value : 'default', vol);
            }
        });
    }

    window.__fptAutoReplySettingsReady = true;
}
