/* Finance Hub filters module. */
(function (root) {
    'use strict';
    const modules = root.FPTFinanceHubModules || (root.FPTFinanceHubModules = {});
    modules.createFilters = function createFilters(context) {
        const state = context.state;
        const esc = (...args) => context.esc(...args);
        const periodKey = (...args) => context.periodKey(...args);
        const onCustomRangeApply = (...args) => context.onCustomRangeApply(...args);
        const onCustomRangeReset = (...args) => context.onCustomRangeReset(...args);
        const onPeriodChange = (...args) => context.onPeriodChange(...args);
        const onCurrencyChange = (...args) => context.onCurrencyChange(...args);
        const onStatusChange = (...args) => context.onStatusChange(...args);
        const onCategoryChange = (...args) => context.onCategoryChange(...args);
        const openExportModal = (...args) => context.openExportModal(...args);
        const refresh = (...args) => context.refresh(...args);
        const DEFAULT_PERIOD = context.DEFAULT_PERIOD;
            function updateCategorySelectOptions(categories) {
                if (!state.container) return;
                const select = state.container.querySelector('#fptFinCategorySelect');
                if (!select) return;

                if (!state.knownCategories) {
                    state.knownCategories = new Set();
                }

                if (Array.isArray(categories)) {
                    categories.forEach(c => {
                        if (c && typeof c === 'string' && c.trim() && c.trim() !== 'Без категории') {
                            state.knownCategories.add(c.trim());
                        }
                    });
                }

                const sortedCats = Array.from(state.knownCategories).sort((a, b) => a.localeCompare(b, 'ru'));
                const currentOptions = Array.from(select.options || []).map(o => o.value);
                const newOptions = ['all', ...sortedCats];

                if (currentOptions.length === newOptions.length && currentOptions.every((v, i) => v === newOptions[i])) {
                    select.value = state.category;
                    syncFinanceCustomSelect(select, false);
                    return;
                }

                select.innerHTML = '<option value="all">Все категории</option>' +
                    sortedCats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

                if (state.category && state.knownCategories.has(state.category)) {
                    select.value = state.category;
                } else {
                    select.value = 'all';
                    state.category = 'all';
                }
                syncFinanceCustomSelect(select, true);
            }

            function getCustomRangeControls() {
                if (!state.container) return null;
                return {
                    wrap: state.container.querySelector('#fptFinCustomRange'),
                    from: state.container.querySelector('#fptFinCustomFrom'),
                    to: state.container.querySelector('#fptFinCustomTo'),
                    error: state.container.querySelector('#fptFinCustomRangeError'),
                    period: state.container.querySelector('#fptFinPeriodSelect')
                };
            }

            function getFinanceControlVisualHost(el) {
                if (!el) return el;
                const parent = el.parentElement || el.parentNode;
                if (
                    parent &&
                    parent.classList &&
                    typeof parent.classList.contains === 'function' &&
                    parent.classList.contains('fpt-fin-select-shell')
                ) {
                    return parent;
                }
                return el;
            }

            function setFinanceControlVisible(el, visible, visibleDisplay) {
                if (!el) return;
                const target = getFinanceControlVisualHost(el);
                const isVisible = Boolean(visible);
                if (target.classList && typeof target.classList.toggle === 'function') {
                    target.classList.toggle('fpt-fin-control-hidden', !isVisible);
                } else if (target.classList) {
                    if (isVisible && typeof target.classList.remove === 'function') {
                        target.classList.remove('fpt-fin-control-hidden');
                    } else if (!isVisible && typeof target.classList.add === 'function') {
                        target.classList.add('fpt-fin-control-hidden');
                    }
                }
                if (typeof target.setAttribute === 'function') {
                    target.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
                }

                // Keep the old inline fallback in one place for lightweight DOMs and
                // browsers that do not apply the Finance utility stylesheet yet.
                if (target.style) {
                    if (!isVisible && typeof target.style.setProperty === 'function') {
                        target.style.setProperty('display', 'none', 'important');
                    } else if (isVisible && visibleDisplay && typeof target.style.setProperty === 'function') {
                        target.style.setProperty('display', visibleDisplay);
                    } else if (isVisible && typeof target.style.removeProperty === 'function') {
                        target.style.removeProperty('display');
                    } else {
                        target.style.display = isVisible ? (visibleDisplay || '') : 'none';
                    }
                }
            }

            function financeCustomSelectParts(select) {
                if (!select) return null;
                const shell = getFinanceControlVisualHost(select);
                if (!shell || shell === select || !shell.querySelector) return null;
                return {
                    shell,
                    trigger: shell.querySelector('.fpt-fin-select-trigger'),
                    label: shell.querySelector('.fpt-fin-select-label'),
                    dropdown: shell.querySelector('.fpt-fin-select-dropdown'),
                    list: shell.querySelector('.fpt-fin-select-list'),
                    scrollbar: shell.querySelector('.fpt-fin-select-scrollbar'),
                    thumb: shell.querySelector('.fpt-fin-select-scrollbar-thumb')
                };
            }

            function syncFinanceCustomSelectScrollbar(select) {
                const parts = financeCustomSelectParts(select);
                if (!parts || !parts.list || !parts.scrollbar || !parts.thumb) return;

                const scrollRange = Math.max(0, parts.list.scrollHeight - parts.list.clientHeight);
                const hasOverflow = scrollRange > 1;
                parts.scrollbar.hidden = !hasOverflow;
                parts.shell.classList.toggle('has-scroll', hasOverflow);
                if (!hasOverflow) {
                    parts.thumb.style.removeProperty('height');
                    parts.thumb.style.removeProperty('transform');
                    return;
                }

                const trackHeight = Math.max(0, parts.scrollbar.clientHeight);
                const thumbHeight = Math.min(40, Math.max(32, trackHeight - 8));
                const travel = Math.max(0, trackHeight - thumbHeight);
                const ratio = scrollRange > 0 ? parts.list.scrollTop / scrollRange : 0;
                const top = Math.max(0, Math.min(travel, travel * ratio));

                parts.thumb.style.height = `${thumbHeight}px`;
                parts.thumb.style.transform = `translate3d(0, ${top}px, 0)`;
            }

            function syncFinanceCustomSelect(select, rebuildOptions) {
                const parts = financeCustomSelectParts(select);
                if (!parts || !parts.trigger || !parts.label || !parts.list) return;

                if (rebuildOptions) {
                    parts.list.innerHTML = '';
                    Array.from(select.options || []).forEach((option, index) => {
                        const item = document.createElement('button');
                        item.type = 'button';
                        item.className = 'fpt-fin-select-option';
                        item.setAttribute('role', 'option');
                        item.setAttribute('data-value', option.value);
                        item.setAttribute('data-index', String(index));
                        item.textContent = option.textContent || option.label || option.value;
                        parts.list.appendChild(item);
                    });
                }

                const selectedOption = select.options && select.selectedIndex >= 0
                    ? select.options[select.selectedIndex]
                    : null;
                parts.label.textContent = selectedOption
                    ? (selectedOption.textContent || selectedOption.label || selectedOption.value)
                    : '';

                const accessibleName = select.getAttribute && select.getAttribute('aria-label');
                if (accessibleName) {
                    parts.trigger.setAttribute('aria-label', accessibleName);
                } else if (typeof parts.trigger.removeAttribute === 'function') {
                    parts.trigger.removeAttribute('aria-label');
                }

                parts.trigger.disabled = Boolean(select.disabled);
                parts.trigger.setAttribute('aria-disabled', select.disabled ? 'true' : 'false');

                parts.list.querySelectorAll('.fpt-fin-select-option').forEach(item => {
                    const selected = item.getAttribute('data-value') === String(select.value);
                    item.classList.toggle('is-selected', selected);
                    item.setAttribute('aria-selected', selected ? 'true' : 'false');
                    item.tabIndex = selected ? 0 : -1;
                });

                const raf = typeof requestAnimationFrame === 'function'
                    ? requestAnimationFrame
                    : (callback) => setTimeout(callback, 0);
                raf(() => syncFinanceCustomSelectScrollbar(select));
            }

            function closeFinanceCustomSelect(select, restoreFocus) {
                const parts = financeCustomSelectParts(select);
                if (!parts || !parts.dropdown) return;
                parts.shell.classList.remove('is-open', 'opens-up');
                parts.trigger.setAttribute('aria-expanded', 'false');
                parts.dropdown.hidden = true;
                if (restoreFocus && typeof parts.trigger.focus === 'function') {
                    try { parts.trigger.focus({ preventScroll: true }); } catch (_) { parts.trigger.focus(); }
                }
            }

            function closeOtherFinanceCustomSelects(currentSelect) {
                if (!state.container || typeof state.container.querySelectorAll !== 'function') return;
                state.container.querySelectorAll('.fpt-fin-native-select').forEach(select => {
                    if (select !== currentSelect) closeFinanceCustomSelect(select, false);
                });
            }

            function openFinanceCustomSelect(select, focusSelected) {
                const parts = financeCustomSelectParts(select);
                if (!parts || !parts.dropdown || select.disabled) return;
                closeOtherFinanceCustomSelects(select);
                syncFinanceCustomSelect(select, false);

                parts.dropdown.hidden = false;
                parts.shell.classList.add('is-open');
                parts.trigger.setAttribute('aria-expanded', 'true');
                parts.dropdown.style.setProperty('--fpt-fin-dropdown-shift', '0px');

                // Open upward if the popup would be clipped at the bottom edge.
                parts.shell.classList.remove('opens-up');
                if (typeof window !== 'undefined' && parts.trigger.getBoundingClientRect) {
                    const triggerRect = parts.trigger.getBoundingClientRect();
                    const listHeight = Math.min(parts.list.scrollHeight || 240, 240);
                    const popupHeight = listHeight + 16;
                    const spaceBelow = window.innerHeight - triggerRect.bottom;
                    const spaceAbove = triggerRect.top;
                    if (spaceBelow < popupHeight + 12 && spaceAbove > spaceBelow) {
                        parts.shell.classList.add('opens-up');
                    }
                }

                const raf = typeof requestAnimationFrame === 'function'
                    ? requestAnimationFrame
                    : (callback) => setTimeout(callback, 0);

                raf(() => {
                    // Keep the rounded popup fully inside the viewport even for the
                    // first/last filter column and narrow popup widths.
                    if (typeof window !== 'undefined' && parts.dropdown.getBoundingClientRect) {
                        const pad = 12;
                        const rect = parts.dropdown.getBoundingClientRect();
                        let shift = 0;
                        if (rect.right > window.innerWidth - pad) {
                            shift -= rect.right - (window.innerWidth - pad);
                        }
                        if (rect.left + shift < pad) {
                            shift += pad - (rect.left + shift);
                        }
                        parts.dropdown.style.setProperty('--fpt-fin-dropdown-shift', `${Math.round(shift)}px`);
                    }

                    if (focusSelected) {
                        const selected = parts.list.querySelector('.fpt-fin-select-option.is-selected')
                            || parts.list.querySelector('.fpt-fin-select-option');
                        if (selected && typeof selected.focus === 'function') {
                            try { selected.focus({ preventScroll: true }); } catch (_) { selected.focus(); }
                            if (typeof selected.scrollIntoView === 'function') {
                                try { selected.scrollIntoView({ block: 'nearest' }); } catch (_) {}
                            }
                        }
                    }

                    syncFinanceCustomSelectScrollbar(select);
                    raf(() => syncFinanceCustomSelectScrollbar(select));
                });
            }

            function enhanceFinanceCustomSelect(select) {
                if (
                    !select ||
                    select.dataset && select.dataset.fptCustomSelectBound === '1' ||
                    typeof document === 'undefined' ||
                    typeof document.createElement !== 'function' ||
                    !select.parentNode ||
                    typeof select.parentNode.insertBefore !== 'function'
                ) {
                    return;
                }

                if (select.dataset) select.dataset.fptCustomSelectBound = '1';

                const shell = document.createElement('div');
                shell.className = 'fpt-fin-select-shell';
                shell.setAttribute('data-fin-select-for', select.id || '');

                const trigger = document.createElement('button');
                trigger.type = 'button';
                trigger.className = 'fpt-fin-select-trigger';
                trigger.setAttribute('aria-haspopup', 'listbox');
                trigger.setAttribute('aria-expanded', 'false');
                if (select.getAttribute) {
                    const label = select.getAttribute('aria-label');
                    if (label) trigger.setAttribute('aria-label', label);
                }

                const label = document.createElement('span');
                label.className = 'fpt-fin-select-label';

                const chevron = document.createElement('span');
                chevron.className = 'fpt-fin-select-chevron';
                chevron.setAttribute('aria-hidden', 'true');

                const dropdown = document.createElement('div');
                dropdown.className = 'fpt-fin-select-dropdown';
                dropdown.hidden = true;

                const list = document.createElement('div');
                list.className = 'fpt-fin-select-list';
                list.setAttribute('role', 'listbox');
                if (select.id) {
                    list.id = `${select.id}CustomListbox`;
                    trigger.setAttribute('aria-controls', list.id);
                }

                const scrollbar = document.createElement('div');
                scrollbar.className = 'fpt-fin-select-scrollbar';
                scrollbar.setAttribute('aria-hidden', 'true');
                scrollbar.hidden = true;

                const scrollbarThumb = document.createElement('div');
                scrollbarThumb.className = 'fpt-fin-select-scrollbar-thumb';
                scrollbar.appendChild(scrollbarThumb);

                trigger.appendChild(label);
                trigger.appendChild(chevron);
                dropdown.appendChild(list);
                dropdown.appendChild(scrollbar);

                select.parentNode.insertBefore(shell, select);
                shell.appendChild(select);
                shell.appendChild(trigger);
                shell.appendChild(dropdown);

                select.classList.add('fpt-fin-native-select');
                select.tabIndex = -1;
                select.setAttribute('aria-hidden', 'true');

                syncFinanceCustomSelect(select, true);

                trigger.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const parts = financeCustomSelectParts(select);
                    if (parts && parts.shell.classList.contains('is-open')) {
                        closeFinanceCustomSelect(select, false);
                    } else {
                        openFinanceCustomSelect(select, false);
                    }
                });

                trigger.addEventListener('keydown', event => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        openFinanceCustomSelect(select, true);
                    } else if (event.key === 'Escape') {
                        closeFinanceCustomSelect(select, false);
                    }
                });

                list.addEventListener('click', event => {
                    const item = event.target && event.target.closest
                        ? event.target.closest('.fpt-fin-select-option')
                        : null;
                    if (!item || !list.contains(item)) return;
                    const value = item.getAttribute('data-value');
                    select.value = value;
                    let changeEvent = null;
                    try {
                        changeEvent = new Event('change', { bubbles: true });
                    } catch (_) {
                        if (document.createEvent) {
                            changeEvent = document.createEvent('Event');
                            changeEvent.initEvent('change', true, false);
                        }
                    }
                    if (changeEvent && typeof select.dispatchEvent === 'function') {
                        select.dispatchEvent(changeEvent);
                    } else if (typeof select.onchange === 'function') {
                        select.onchange({ target: select });
                    }
                    syncFinanceCustomSelect(select, false);
                    closeFinanceCustomSelect(select, true);
                });

                list.addEventListener('keydown', event => {
                    const items = Array.from(list.querySelectorAll('.fpt-fin-select-option'));
                    const current = event.target && event.target.closest
                        ? event.target.closest('.fpt-fin-select-option')
                        : null;
                    if (!current || !items.length) return;
                    const currentIndex = Math.max(0, items.indexOf(current));
                    let nextIndex = currentIndex;

                    if (event.key === 'ArrowDown') nextIndex = Math.min(items.length - 1, currentIndex + 1);
                    else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
                    else if (event.key === 'Home') nextIndex = 0;
                    else if (event.key === 'End') nextIndex = items.length - 1;
                    else if (event.key === 'Escape') {
                        event.preventDefault();
                        closeFinanceCustomSelect(select, true);
                        return;
                    } else if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        current.click();
                        return;
                    } else {
                        return;
                    }

                    event.preventDefault();
                    const next = items[nextIndex];
                    if (next && typeof next.focus === 'function') next.focus({ preventScroll: true });
                    if (next && typeof next.scrollIntoView === 'function') {
                        try { next.scrollIntoView({ block: 'nearest' }); } catch (_) {}
                    }
                });

                list.addEventListener('scroll', () => syncFinanceCustomSelectScrollbar(select), { passive: true });

                scrollbar.addEventListener('pointerdown', event => {
                    if (event.target === scrollbarThumb) return;
                    event.preventDefault();
                    event.stopPropagation();

                    const trackRect = scrollbar.getBoundingClientRect();
                    const thumbHeight = scrollbarThumb.offsetHeight || 36;
                    const travel = Math.max(1, trackRect.height - thumbHeight);
                    const pointerTop = Math.max(0, Math.min(travel, event.clientY - trackRect.top - thumbHeight / 2));
                    const scrollRange = Math.max(0, list.scrollHeight - list.clientHeight);
                    list.scrollTop = scrollRange * (pointerTop / travel);
                    syncFinanceCustomSelectScrollbar(select);
                });

                scrollbarThumb.addEventListener('pointerdown', event => {
                    event.preventDefault();
                    event.stopPropagation();

                    const startY = event.clientY;
                    const startScrollTop = list.scrollTop;
                    const trackHeight = scrollbar.clientHeight;
                    const thumbHeight = scrollbarThumb.offsetHeight || 36;
                    const travel = Math.max(1, trackHeight - thumbHeight);
                    const scrollRange = Math.max(0, list.scrollHeight - list.clientHeight);

                    scrollbarThumb.classList.add('is-dragging');
                    if (typeof scrollbarThumb.setPointerCapture === 'function') {
                        try { scrollbarThumb.setPointerCapture(event.pointerId); } catch (_) {}
                    }

                    const onMove = moveEvent => {
                        const delta = moveEvent.clientY - startY;
                        list.scrollTop = startScrollTop + (delta / travel) * scrollRange;
                        syncFinanceCustomSelectScrollbar(select);
                    };

                    const onUp = upEvent => {
                        scrollbarThumb.classList.remove('is-dragging');
                        document.removeEventListener('pointermove', onMove, true);
                        document.removeEventListener('pointerup', onUp, true);
                        document.removeEventListener('pointercancel', onUp, true);
                        if (typeof scrollbarThumb.releasePointerCapture === 'function') {
                            try { scrollbarThumb.releasePointerCapture(upEvent.pointerId); } catch (_) {}
                        }
                    };

                    document.addEventListener('pointermove', onMove, true);
                    document.addEventListener('pointerup', onUp, true);
                    document.addEventListener('pointercancel', onUp, true);
                });

                select.addEventListener('change', () => syncFinanceCustomSelect(select, false));

                const outsideHandler = event => {
                    if (!shell.contains(event.target)) closeFinanceCustomSelect(select, false);
                };
                document.addEventListener('pointerdown', outsideHandler, true);
                shell.__fptFinanceSelectOutsideHandler = outsideHandler;

                if (typeof MutationObserver !== 'undefined') {
                    const observer = new MutationObserver(() => syncFinanceCustomSelect(select, true));
                    observer.observe(select, { childList: true, subtree: true });
                    shell.__fptFinanceSelectObserver = observer;
                }
            }

            function setCustomRangeError(message) {
                const controls = getCustomRangeControls();
                if (!controls || !controls.error) return;
                controls.error.textContent = message || '';
                controls.error.style.display = message ? '' : 'none';
            }

            function syncCustomRangeControls(visible) {
                const controls = getCustomRangeControls();
                if (!controls) return;
                if (controls.wrap) {
                    setFinanceControlVisible(
                        controls.wrap,
                        visible && state.activeSubtab !== 'potential',
                        'flex'
                    );
                }
                if (controls.from && state.customRange && !controls.from.value) {
                    controls.from.value = state.customRange.from;
                }
                if (controls.to && state.customRange && !controls.to.value) {
                    controls.to.value = state.customRange.to;
                }
                setCustomRangeError('');
            }

            function updateStatusSelectOptions(subtab) {
                if (!state.container) return;
                const statusSelect = state.container.querySelector('#fptFinStatusSelect');
                if (!statusSelect) return;
                const statusLabel = state.container.querySelector('#fptFinStatusLabel');

                if (subtab === 'operations') {
                    statusSelect.setAttribute('aria-label', 'Статус операций');
                    if (statusLabel) statusLabel.textContent = 'Статус операции';
                    statusSelect.innerHTML = `
                        <option value="all">Все статусы</option>
                        <option value="complete">Завершено</option>
                        <option value="cancel">Отменено</option>
                        <option value="waiting">Ожидание</option>
                    `;
                    statusSelect.value = state.operationStatus || 'all';
                    state.status = state.operationStatus || 'all';
                } else {
                    statusSelect.setAttribute('aria-label', 'Статус заказов');
                    if (statusLabel) statusLabel.textContent = 'Статус заказа';
                    statusSelect.innerHTML = `
                        <option value="all">Все статусы</option>
                        <option value="closed">Закрытые</option>
                        <option value="paid">Оплаченные</option>
                        <option value="refunded">Возвраты</option>
                    `;
                    statusSelect.value = state.orderStatus || 'all';
                    state.status = state.orderStatus || 'all';
                }
                syncFinanceCustomSelect(statusSelect, true);
            }

            function setupHeaderFilters(container) {
                if (!container) return;
                const periodWrap = container.querySelector('.fpt-fin-period-wrap');
                if (!periodWrap) return;

                // 0. Potential Snapshot Badge (T05)
                let snapshotBadge = container.querySelector('#fptFinPeriodSnapshotBadge');
                if (!snapshotBadge) {
                    snapshotBadge = document.createElement('div');
                    snapshotBadge.id = 'fptFinPeriodSnapshotBadge';
                    snapshotBadge.className = 'fpt-fin-snapshot-badge';
                    snapshotBadge.setAttribute('role', 'status');
                    snapshotBadge.setAttribute('aria-label', 'Текущий снимок инвентаря');
                    snapshotBadge.innerHTML = '<span class="material-symbols-rounded" style="font-size:16px;color:var(--fpt-text-muted,#676a73);vertical-align:middle;margin-right:4px;">inventory_2</span><span>Текущий снимок</span>';
                    setFinanceControlVisible(snapshotBadge, false);
                    const periodControl = container.querySelector('[data-fin-control="period"]');
                    const periodSelect = container.querySelector('#fptFinPeriodSelect');
                    const insertAfter = periodControl || periodSelect;
                    if (insertAfter && insertAfter.parentNode) {
                        insertAfter.parentNode.insertBefore(snapshotBadge, insertAfter.nextSibling);
                    } else {
                        periodWrap.appendChild(snapshotBadge);
                    }
                }

                // 1. Period Select
                const periodSelect = container.querySelector('#fptFinPeriodSelect');
                if (periodSelect) {
                    periodSelect.value = periodKey(state.period) || DEFAULT_PERIOD;
                    periodSelect.onchange = (e) => onPeriodChange(e.target.value);
                }

                // 2. Custom date range controls
                const customApplyBtn = container.querySelector('#fptFinCustomApplyBtn');
                if (customApplyBtn) {
                    customApplyBtn.onclick = (e) => {
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        return onCustomRangeApply();
                    };
                }
                const customResetBtn = container.querySelector('#fptFinCustomResetBtn');
                if (customResetBtn) {
                    customResetBtn.onclick = (e) => {
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        return onCustomRangeReset();
                    };
                }
                syncCustomRangeControls(state.pendingCustomRange || periodKey(state.period) === 'custom');

                // 3. Currency Select
                let curSelect = container.querySelector('#fptFinCurrencySelect');
                if (!curSelect) {
                    curSelect = document.createElement('select');
                    curSelect.id = 'fptFinCurrencySelect';
                    curSelect.className = 'fpt-fin-period-select';
                    curSelect.setAttribute('aria-label', 'Валюта статистики');
                    curSelect.innerHTML = `
                        <option value="all">Все валюты</option>
                        <option value="RUB">₽ RUB</option>
                        <option value="USD">$ USD</option>
                        <option value="EUR">€ EUR</option>
                    `;
                    const currencyControl = container.querySelector('[data-fin-control="currency"]') || periodWrap;
                    currencyControl.appendChild(curSelect);
                }
                curSelect.value = state.currency || 'all';
                curSelect.onchange = (e) => onCurrencyChange(e.target.value);

                // 4. Status Select (options dynamically configured by updateStatusSelectOptions)
                let statusSelect = container.querySelector('#fptFinStatusSelect');
                if (!statusSelect) {
                    statusSelect = document.createElement('select');
                    statusSelect.id = 'fptFinStatusSelect';
                    statusSelect.className = 'fpt-fin-period-select';
                    const statusControl = container.querySelector('[data-fin-control="status"]') || periodWrap;
                    statusControl.appendChild(statusSelect);
                }
                statusSelect.onchange = (e) => onStatusChange(e.target.value);

                // 5. Category Select
                let catSelect = container.querySelector('#fptFinCategorySelect');
                if (!catSelect) {
                    catSelect = document.createElement('select');
                    catSelect.id = 'fptFinCategorySelect';
                    catSelect.className = 'fpt-fin-period-select';
                    catSelect.setAttribute('aria-label', 'Категория товаров');
                    catSelect.innerHTML = `<option value="all">Все категории</option>`;
                    const categoryControl = container.querySelector('[data-fin-control="category"]') || periodWrap;
                    categoryControl.appendChild(catSelect);
                }
                catSelect.value = state.category || 'all';
                catSelect.onchange = (e) => onCategoryChange(e.target.value);

                // 6. Refresh button activation
                const refreshBtn = container.querySelector('#fptFinRefreshBtn');
                if (refreshBtn) {
                    refreshBtn.onclick = (e) => {
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        return refresh();
                    };
                }

                // 7. Export button activation
                const exportBtn = container.querySelector('#fptFinExportBtn');
                if (exportBtn) {
                    exportBtn.disabled = false;
                    exportBtn.removeAttribute('disabled');
                    exportBtn.title = 'Экспорт финансовых данных (CSV, JSON)';
                    exportBtn.setAttribute('aria-label', 'Экспорт финансовых данных');
                    exportBtn.onclick = () => openExportModal();
                }

                // Replace native browser dropdown popups with Finance-styled listboxes,
                // while keeping the original selects as the single source of truth.
                [periodSelect, curSelect, statusSelect, catSelect]
                    .filter(Boolean)
                    .forEach(enhanceFinanceCustomSelect);

                updateHeaderFiltersVisibility(state.activeSubtab);
            }

            function updateHeaderFiltersVisibility(subtab) {
                if (!state.container) return;
                const periodSelect = state.container.querySelector('#fptFinPeriodSelect');
                const snapshotBadge = state.container.querySelector('#fptFinPeriodSnapshotBadge');
                const currencySelect = state.container.querySelector('#fptFinCurrencySelect');
                const statusSelect = state.container.querySelector('#fptFinStatusSelect');
                const catSelect = state.container.querySelector('#fptFinCategorySelect');
                const periodControl = state.container.querySelector('[data-fin-control="period"]') || periodSelect;
                const currencyControl = state.container.querySelector('[data-fin-control="currency"]') || currencySelect;
                const statusControl = state.container.querySelector('[data-fin-control="status"]') || statusSelect;
                const categoryControl = state.container.querySelector('[data-fin-control="category"]') || catSelect;
                const customRangeWrap = state.container.querySelector('#fptFinCustomRange');
                const isPotential = subtab === 'potential';

                // T05: Potential is a live snapshot, not a historical date range.
                setFinanceControlVisible(periodControl, !isPotential);
                setFinanceControlVisible(snapshotBadge, isPotential, 'inline-flex');
                setFinanceControlVisible(currencyControl, true);
                setFinanceControlVisible(statusControl, !isPotential);
                setFinanceControlVisible(categoryControl, subtab !== 'operations');
                setFinanceControlVisible(
                    customRangeWrap,
                    !isPotential && (state.pendingCustomRange || periodKey(state.period) === 'custom'),
                    'flex'
                );

                if (!isPotential && periodSelect) {
                    // Restore user's previous period selection.
                    if (state.period) {
                        if (typeof state.period === 'string') {
                            periodSelect.value = state.period;
                        } else {
                            periodSelect.value = periodKey(state.period);
                        }
                    }
                }
                updateStatusSelectOptions(subtab);
                syncFinanceCustomSelect(periodSelect, false);
                syncFinanceCustomSelect(currencySelect, false);
                syncFinanceCustomSelect(statusSelect, false);
                syncFinanceCustomSelect(catSelect, false);
            }
        return { updateCategorySelectOptions, getCustomRangeControls, getFinanceControlVisualHost, setFinanceControlVisible, financeCustomSelectParts, syncFinanceCustomSelectScrollbar, syncFinanceCustomSelect, closeFinanceCustomSelect, closeOtherFinanceCustomSelects, openFinanceCustomSelect, enhanceFinanceCustomSelect, setCustomRangeError, syncCustomRangeControls, updateStatusSelectOptions, setupHeaderFilters, updateHeaderFiltersVisibility };
    };
})(typeof window !== 'undefined' ? window : globalThis);
