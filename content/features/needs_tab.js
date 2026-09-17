// content/features/needs_tab.js
// =============================================================================
// Вкладка «Что тебе нужно».
//  • Быстрые пресеты в 1 клик (По умолчанию, Я покупатель, Продавец, Минимализм).
//  • Информационный бар: активные / всего + кнопки «Включить все» / «Отключить все».
//  • Фильтры-таблетки по разделам и фильтр только по отключённым элементам.
//  • Свободный ввод → ИИ сопоставляет с реестром элементов → карточки с галочками.
//  • Полный список элементов с галочками (вкл/выкл) и встроенным предпросмотром.
//  • Чекбоксы → АВТОСОХРАНЕНИЕ в fpToolsDisabledFeatures при каждом изменении (скрытие живое).
// Заблокированные (locked) элементы выключать нельзя.
// =============================================================================

let __fptNeedsInited = false;
let __fptActivePillGroup = 'all';

function fptNeedsRegistry() {
    return (typeof FPT_FEATURE_REGISTRY !== 'undefined' && FPT_FEATURE_REGISTRY) ||
           (typeof window !== 'undefined' && window.FPT_FEATURE_REGISTRY) || [];
}

function fptEscapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Inline preview markup - a faithful mini visual copy of the real element.
function fptNeedsPreviewHtml(entry) {
    const p = entry.preview;
    if (p && p.kind === 'html') {
        let html = p.html;
        if (html.indexOf('{{MAGIC_ICON}}') !== -1) {
            let url = 'icons/magic.png';
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
                    url = chrome.runtime.getURL('icons/magic.png');
                }
            } catch (_) {}
            html = html.split('{{MAGIC_ICON}}').join(url);
        }
        return `<div class="fpt-pv-stage">${html}</div>`;
    }
    return `<div class="fpt-pv-stage fpt-pv-none">Нет предпросмотра</div>`;
}

// Check if entry belongs to the selected pill group
function fptMatchesPillGroup(entry, pillGroup, disabledSet) {
    if (!pillGroup || pillGroup === 'all') return true;
    if (pillGroup === 'disabled') return disabledSet.has(entry.id);
    const g = (entry.group || '').toLowerCase();
    if (pillGroup === 'chat') {
        return g.includes('чат') || g.includes('заметки');
    }
    if (pillGroup === 'editor') {
        return g.includes('редактор');
    }
    if (pillGroup === 'lots') {
        return g.includes('лот') || g.includes('профил');
    }
    if (pillGroup === 'orders') {
        return g.includes('заказ');
    }
    return true;
}

// Update counts in header and badges
function fptUpdateHeaderStatus(disabledCount, totalCount) {
    const activeEl = document.getElementById('fptNeedsActiveCount');
    const totalEl = document.getElementById('fptNeedsTotalCount');
    const badgeEl = document.getElementById('fptPillDisabledCount');
    const counterBadge = document.getElementById('fptNeedsCounterBadge');

    const active = Math.max(0, totalCount - disabledCount);
    if (activeEl) activeEl.textContent = String(active);
    if (totalEl) totalEl.textContent = String(totalCount);
    if (badgeEl) badgeEl.textContent = String(disabledCount);

    if (counterBadge) {
        if (disabledCount === 0) {
            counterBadge.style.borderColor = 'rgba(46, 204, 113, 0.4)';
        } else {
            counterBadge.style.borderColor = '';
        }
    }
}

// Render the full feature list grouped by `group` with filtering
async function fptRenderNeedsList(filterText) {
    const list = document.getElementById('fptNeedsList');
    if (!list) return;
    const reg = fptNeedsRegistry();
    const { fpToolsDisabledFeatures = [] } = await chrome.storage.local.get('fpToolsDisabledFeatures');
    const disabled = new Set(Array.isArray(fpToolsDisabledFeatures) ? fpToolsDisabledFeatures : []);

    fptUpdateHeaderStatus(disabled.size, reg.length);

    const q = (filterText !== undefined ? filterText : (document.getElementById('fptNeedsFilter')?.value || '')).trim().toLowerCase();
    const groups = {};
    reg.forEach(entry => {
        if (!fptMatchesPillGroup(entry, __fptActivePillGroup, disabled)) return;
        if (q && !(`${entry.label} ${entry.desc}`.toLowerCase().includes(q))) return;
        (groups[entry.group] = groups[entry.group] || []).push(entry);
    });

    const groupNames = Object.keys(groups);
    if (!groupNames.length) {
        list.innerHTML = `<p class="template-info" style="text-align:center;padding:24px 0;">Ничего не найдено по текущим фильтрам.</p>`;
        return;
    }

    list.innerHTML = groupNames.map(g => {
        const items = groups[g].map(entry => {
            const on = !disabled.has(entry.id);
            const locked = !!entry.locked;
            const control = locked
                ? `<span class="fpt-needs-lock" title="Эту функцию нельзя отключить - иначе пропадёт доступ к расширению"><span class="material-symbols-rounded">lock</span></span>`
                : `<input type="checkbox" class="fpt-needs-cb" data-id="${entry.id}" ${on ? 'checked' : ''}>`;
            return `
            <div class="fpt-needs-item${locked ? ' fpt-needs-locked' : ''}" data-id="${entry.id}">
                <label class="fpt-needs-check">
                    ${control}
                    <span class="fpt-needs-item-text">
                        <span class="fpt-needs-item-label">${fptEscapeHtml(entry.label)}</span>
                        <span class="fpt-needs-item-desc">${fptEscapeHtml(entry.desc)}</span>
                    </span>
                </label>
                <button type="button" class="fpt-needs-preview-btn" data-id="${entry.id}" title="Показать предпросмотр"><span class="material-symbols-rounded">visibility</span></button>
            </div>
            <div class="fpt-needs-preview-row" data-id="${entry.id}" style="display:none;">
                <span class="fpt-needs-preview-caption">Так выглядит элемент:</span>
                ${fptNeedsPreviewHtml(entry)}
            </div>`;
        }).join('');
        return `
            <div class="fpt-needs-group">
                <div class="fpt-needs-group-title">${fptEscapeHtml(g)}</div>
                ${items}
            </div>`;
    }).join('');
}

// Save the current checkbox state immediately (autosave).
async function fptApplyNeedsSelection() {
    const list = document.getElementById('fptNeedsList');
    const status = document.getElementById('fptNeedsStatus');
    if (!list) return;
    const reg = fptNeedsRegistry();
    const lockedIds = new Set(reg.filter(e => e.locked).map(e => e.id));
    const knownIds = new Set(reg.map(e => e.id));

    let prev = [];
    try {
        const data = await chrome.storage.local.get('fpToolsDisabledFeatures');
        prev = Array.isArray(data.fpToolsDisabledFeatures) ? data.fpToolsDisabledFeatures : [];
    } catch (_) { prev = []; }
    const disabledSet = new Set(prev.filter(id => knownIds.has(id) && !lockedIds.has(id)));

    list.querySelectorAll('.fpt-needs-cb').forEach(cb => {
        if (lockedIds.has(cb.dataset.id) || !knownIds.has(cb.dataset.id)) return;
        if (cb.checked) disabledSet.delete(cb.dataset.id);
        else disabledSet.add(cb.dataset.id);
    });

    const disabled = Array.from(disabledSet);

    try {
        await chrome.storage.local.set({ fpToolsDisabledFeatures: disabled });
        if (typeof window !== 'undefined' && typeof window.fptApplyDisabledFeatures === 'function') {
            await window.fptApplyDisabledFeatures(disabled);
        }
        fptUpdateHeaderStatus(disabled.length, reg.length);
        if (status) {
            status.textContent = disabled.length
                ? `Сохранено · отключено: ${disabled.length}`
                : 'Сохранено · все элементы включены';
            status.classList.remove('fpt-needs-status-err');
            status.classList.add('fpt-needs-status-ok');
            clearTimeout(fptApplyNeedsSelection._t);
            fptApplyNeedsSelection._t = setTimeout(() => {
                if (status) status.classList.remove('fpt-needs-status-ok');
            }, 1400);
        }
    } catch (e) {
        console.error('FP Tools: ошибка автосохранения needs', e);
        if (status) {
            status.textContent = 'Ошибка сохранения: ' + (e && e.message ? e.message : 'неизвестно');
            status.classList.remove('fpt-needs-status-ok');
            status.classList.add('fpt-needs-status-err');
        }
        if (typeof showNotification === 'function') showNotification('Не удалось сохранить настройки.', true);
    }
}

// Preset definitions
const FPT_PRESETS = {
    default: {
        name: 'По умолчанию',
        getDisabledIds: () => []
    },
    buyer: {
        name: 'Я покупатель',
        getDisabledIds: (reg) => {
            return reg
                .filter(e => !e.locked)
                .filter(e => {
                    const g = (e.group || '').toLowerCase();
                    if (e.id === 'rmthub_seller_search' || e.id === 'order_copy_chip') return false;
                    if (g.includes('чат')) return false;
                    if (g.includes('редактор') || g.includes('чужие лоты') ||
                        e.id === 'order_copy_lot_btn' || e.id === 'market_analytics_btn' ||
                        e.id === 'raise_all_lots_btn' || e.id === 'sales_stats_expand' ||
                        e.id === 'lot_select_btn' || e.id === 'lot_reactivate_btn' ||
                        e.id === 'lot_pinned_container') {
                        return true;
                    }
                    return false;
                })
                .map(e => e.id);
        }
    },
    seller: {
        name: 'Продавец',
        getDisabledIds: () => [
            'rmthub_seller_search',
            'profanity_warning',
            'chat_char_counter'
        ]
    },
    minimal: {
        name: 'Минимализм',
        getDisabledIds: (reg) => reg.filter(e => !e.locked).map(e => e.id)
    }
};

// Apply a preset directly
async function fptApplyPreset(presetKey) {
    const preset = FPT_PRESETS[presetKey];
    if (!preset) return;
    const reg = fptNeedsRegistry();
    const lockedIds = new Set(reg.filter(e => e.locked).map(e => e.id));
    const toDisable = preset.getDisabledIds(reg).filter(id => !lockedIds.has(id));

    try {
        await chrome.storage.local.set({ fpToolsDisabledFeatures: toDisable });
        if (typeof window !== 'undefined' && typeof window.fptApplyDisabledFeatures === 'function') {
            await window.fptApplyDisabledFeatures(toDisable);
        }
        await fptRenderNeedsList();
        const status = document.getElementById('fptNeedsStatus');
        if (status) {
            status.textContent = `Применён пресет «${preset.name}» · отключено: ${toDisable.length}`;
            status.classList.remove('fpt-needs-status-err');
            status.classList.add('fpt-needs-status-ok');
            clearTimeout(fptApplyNeedsSelection._t);
            fptApplyNeedsSelection._t = setTimeout(() => {
                if (status) status.classList.remove('fpt-needs-status-ok');
            }, 1800);
        }
        if (typeof showNotification === 'function') {
            showNotification(`Применён профиль «${preset.name}»`);
        }
    } catch (e) {
        console.error('Ошибка применения пресета:', e);
    }
}

// Bulk enable all
async function fptEnableAll() {
    const reg = fptNeedsRegistry();
    try {
        await chrome.storage.local.set({ fpToolsDisabledFeatures: [] });
        if (typeof window !== 'undefined' && typeof window.fptApplyDisabledFeatures === 'function') {
            await window.fptApplyDisabledFeatures([]);
        }
        await fptRenderNeedsList();
        const status = document.getElementById('fptNeedsStatus');
        if (status) {
            status.textContent = 'Сохранено · все элементы включены';
            status.classList.remove('fpt-needs-status-err');
            status.classList.add('fpt-needs-status-ok');
            clearTimeout(fptApplyNeedsSelection._t);
            fptApplyNeedsSelection._t = setTimeout(() => {
                if (status) status.classList.remove('fpt-needs-status-ok');
            }, 1400);
        }
        if (typeof showNotification === 'function') showNotification('Все элементы интерфейса включены');
    } catch (e) {
        console.error(e);
    }
}

// Bulk disable all non-locked
async function fptDisableAll() {
    const reg = fptNeedsRegistry();
    const toDisable = reg.filter(e => !e.locked).map(e => e.id);
    try {
        await chrome.storage.local.set({ fpToolsDisabledFeatures: toDisable });
        if (typeof window !== 'undefined' && typeof window.fptApplyDisabledFeatures === 'function') {
            await window.fptApplyDisabledFeatures(toDisable);
        }
        await fptRenderNeedsList();
        const status = document.getElementById('fptNeedsStatus');
        if (status) {
            status.textContent = `Сохранено · отключено: ${toDisable.length}`;
            status.classList.remove('fpt-needs-status-err');
            status.classList.add('fpt-needs-status-ok');
            clearTimeout(fptApplyNeedsSelection._t);
            fptApplyNeedsSelection._t = setTimeout(() => {
                if (status) status.classList.remove('fpt-needs-status-ok');
            }, 1400);
        }
        if (typeof showNotification === 'function') showNotification('Все отключаемые элементы скрыты');
    } catch (e) {
        console.error(e);
    }
}

// Ask the AI which features the user wants to disable, then show confirm cards.
async function fptNeedsAskAI() {
    const input = document.getElementById('fptNeedsInput');
    const resultBox = document.getElementById('fptNeedsAiResult');
    const askBtn = document.getElementById('fptNeedsAskBtn');
    if (!input || !resultBox) return;

    const text = input.value.trim();
    if (!text) {
        if (typeof showNotification === 'function') showNotification('Напишите, что вы хотите отключить.', true);
        return;
    }

    const reg = fptNeedsRegistry();
    const offerable = reg.filter(e => !e.locked);
    const compact = JSON.stringify(offerable.map(e => ({ id: e.id, label: e.label, desc: e.desc })));

    askBtn.disabled = true;
    askBtn.classList.add('fpt-needs-loading');
    resultBox.style.display = 'block';
    resultBox.innerHTML = `<div class="fpt-needs-ai-loading"><span class="material-symbols-rounded fpt-spin">progress_activity</span> ИИ анализирует ваш запрос…</div>`;

    let matches = [];
    try {
        const resp = await chrome.runtime.sendMessage({
            action: 'getAIProcessedText',
            text: text,
            context: compact,
            myUsername: '',
            type: 'feature_match'
        });
        if (resp && resp.success) {
            let raw = (resp.data || '').trim();
            raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
            matches = JSON.parse(raw);
            if (!Array.isArray(matches)) matches = [];
        } else {
            throw new Error(resp ? resp.error : 'нет ответа');
        }
    } catch (e) {
        console.error('FP Tools needs AI error:', e);
        resultBox.innerHTML = `<div class="fpt-needs-ai-error"><span class="material-symbols-rounded">error</span> Не удалось разобрать ответ ИИ. Переформулируйте запрос или отметьте элементы вручную ниже.</div>`;
        askBtn.disabled = false;
        askBtn.classList.remove('fpt-needs-loading');
        return;
    }

    const byId = {};
    offerable.forEach(e => { byId[e.id] = e; });
    matches = matches.filter(m => m && byId[m.id]);

    if (!matches.length) {
        resultBox.innerHTML = `<div class="fpt-needs-ai-empty"><span class="material-symbols-rounded">info</span> ИИ не нашёл подходящих элементов. Опишите иначе или отметьте вручную ниже.</div>`;
        askBtn.disabled = false;
        askBtn.classList.remove('fpt-needs-loading');
        return;
    }

    resultBox.innerHTML = `
        <div class="fpt-needs-ai-head">
            <span class="material-symbols-rounded">auto_awesome</span>
            ИИ предлагает отключить это. Отметьте, что действительно выключить:
        </div>
        <div class="fpt-needs-ai-cards">
            ${matches.map(m => {
                const e = byId[m.id];
                const conf = Math.round((m.confidence || 0) * 100);
                return `
                <div class="fpt-needs-ai-card">
                    <label class="fpt-needs-ai-card-main">
                        <input type="checkbox" class="fpt-needs-ai-pick" data-id="${e.id}" checked>
                        <span>
                            <span class="fpt-needs-ai-card-label">${fptEscapeHtml(e.label)}</span>
                            <span class="fpt-needs-ai-card-reason">${fptEscapeHtml(m.reason || e.desc)}</span>
                        </span>
                    </label>
                    <span class="fpt-needs-ai-conf" title="Уверенность ИИ">${conf}%</span>
                </div>`;
            }).join('')}
        </div>
        <button id="fptNeedsAiConfirm" class="btn">Отключить выбранное</button>`;

    askBtn.disabled = false;
    askBtn.classList.remove('fpt-needs-loading');
}

// Wire all event handlers (idempotent).
function initializeNeedsTab() {
    fptRenderNeedsList();

    if (__fptNeedsInited) return;
    __fptNeedsInited = true;

    const page = document.querySelector('.fp-tools-page-content[data-page="needs"]');
    if (!page) return;

    // AI Ask
    const askBtn = document.getElementById('fptNeedsAskBtn');
    if (askBtn) askBtn.addEventListener('click', fptNeedsAskAI);

    // Search filter & clear button
    const filter = document.getElementById('fptNeedsFilter');
    const clearBtn = document.getElementById('fptNeedsFilterClear');
    if (filter) {
        filter.addEventListener('input', () => {
            const val = filter.value;
            if (clearBtn) clearBtn.style.display = val ? 'inline-block' : 'none';
            fptRenderNeedsList(val);
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (filter) {
                filter.value = '';
                clearBtn.style.display = 'none';
                fptRenderNeedsList('');
            }
        });
    }

    // Category pills filter
    const pillsContainer = document.getElementById('fptNeedsPills');
    if (pillsContainer) {
        pillsContainer.addEventListener('click', (e) => {
            const pill = e.target.closest('.fpt-pill-btn');
            if (!pill) return;
            pillsContainer.querySelectorAll('.fpt-pill-btn').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            __fptActivePillGroup = pill.dataset.group || 'all';
            fptRenderNeedsList();
        });
    }

    // Presets and bulk buttons
    page.addEventListener('click', (e) => {
        const presetBtn = e.target.closest('.fpt-preset-btn');
        if (presetBtn && presetBtn.dataset.preset) {
            e.preventDefault();
            fptApplyPreset(presetBtn.dataset.preset);
            return;
        }

        const enableAll = e.target.closest('#fptNeedsEnableAllBtn');
        if (enableAll) {
            e.preventDefault();
            fptEnableAll();
            return;
        }

        const disableAll = e.target.closest('#fptNeedsDisableAllBtn');
        if (disableAll) {
            e.preventDefault();
            fptDisableAll();
            return;
        }
    });

    // AUTOSAVE: every checkbox toggle in the list saves instantly
    page.addEventListener('change', (e) => {
        if (e.target.classList && e.target.classList.contains('fpt-needs-cb')) {
            fptApplyNeedsSelection();
        }
    });

    // Delegated clicks: toggle inline preview + AI confirm
    page.addEventListener('click', async (e) => {
        const previewBtn = e.target.closest('.fpt-needs-preview-btn');
        if (previewBtn) {
            e.preventDefault();
            const id = previewBtn.dataset.id;
            const row = page.querySelector(`.fpt-needs-preview-row[data-id="${CSS.escape(id)}"]`);
            if (row) {
                const showing = row.style.display !== 'none';
                row.style.display = showing ? 'none' : 'flex';
                previewBtn.classList.toggle('fpt-needs-preview-open', !showing);
            }
            return;
        }
        if (e.target.closest('#fptNeedsAiConfirm')) {
            const resultBox = document.getElementById('fptNeedsAiResult');
            const picks = resultBox.querySelectorAll('.fpt-needs-ai-pick');
            const toDisable = new Set();
            picks.forEach(cb => { if (cb.checked) toDisable.add(cb.dataset.id); });

            document.querySelectorAll('.fpt-needs-cb').forEach(cb => {
                if (toDisable.has(cb.dataset.id)) cb.checked = false;
            });
            await fptApplyNeedsSelection();
            const confirmBtn = resultBox.querySelector('#fptNeedsAiConfirm');
            if (confirmBtn) confirmBtn.textContent = 'Отключено ✓';
        }
    });
}

if (typeof window !== 'undefined') {
    window.initializeNeedsTab = initializeNeedsTab;
}
