// Shared helpers and popup actions for the automation modules (schedules, prices,
// orders, reminders). Every runtime command goes through a named popup
// action that forwards one whitelisted background request — the UI never sends an
// arbitrary state transition.
(function (root) {
    'use strict';

    function node(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined && text !== null) element.textContent = String(text);
        return element;
    }

    function icon(name) {
        const element = node('span', 'material-symbols-rounded', name);
        element.setAttribute('aria-hidden', 'true');
        return element;
    }

    function button(label, { kind = '', iconName = '', title = '' } = {}) {
        const element = node('button', `fpt-lot-dialog-button${kind ? ` fpt-lot-dialog-button--${kind}` : ''}`);
        element.type = 'button';
        if (iconName) element.appendChild(icon(iconName));
        element.appendChild(node('span', '', label));
        if (title) element.title = title;
        return element;
    }

    function pill(text, tone = '') {
        const element = node('span', 'fpt-auto-pill', text);
        if (tone) element.dataset.tone = tone;
        return element;
    }

    function field(labelText, control, hint = '') {
        const wrap = node('label', 'fpt-auto-field');
        wrap.appendChild(node('span', 'fpt-auto-field-label', labelText));
        wrap.appendChild(control);
        if (hint) wrap.appendChild(node('span', 'fpt-auto-field-hint', hint));
        return wrap;
    }

    function input(type = 'text', value = '', attrs = {}) {
        const element = node('input', 'fpt-auto-input');
        element.type = type;
        if (value !== undefined && value !== null) element.value = String(value);
        Object.entries(attrs).forEach(([key, val]) => element.setAttribute(key, val));
        return element;
    }

    function select(options, value) {
        const element = node('select', 'fpt-auto-input');
        for (const [optionValue, label] of options) {
            const option = node('option', '', label);
            option.value = optionValue;
            option.selected = String(optionValue) === String(value);
            element.appendChild(option);
        }
        return element;
    }

    function section(title, description = '') {
        const element = node('section', 'fpt-auto-section');
        const head = node('div', 'fpt-auto-section-head');
        head.appendChild(node('h3', '', title));
        if (description) head.appendChild(node('p', '', description));
        element.appendChild(head);
        return element;
    }

    function notice(text, tone = 'info') {
        const element = node('p', 'fpt-auto-notice', text);
        element.dataset.tone = tone;
        element.setAttribute('role', tone === 'error' ? 'alert' : 'note');
        return element;
    }

    function formatDateTime(timestamp) {
        if (!Number.isFinite(timestamp)) return '—';
        const date = new Date(timestamp);
        const pad = value => String(value).padStart(2, '0');
        return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function formatMoney(amount, currency = '') {
        if (amount === null || amount === undefined || amount === '') return '—';
        const sign = { RUB: '₽', USD: '$', EUR: '€', USDT: 'USDT' }[currency] || currency;
        return `${String(amount).replace('.', ',')}${sign ? ` ${sign}` : ''}`;
    }

    function pageUserId() {
        return typeof root.fptPageUserId === 'function' ? root.fptPageUserId() : null;
    }

    // One background request; { success:false } becomes an exception with the server text.
    async function request(message) {
        const response = await chrome.runtime.sendMessage({ ...message, expectedAccountId: message.expectedAccountId ?? pageUserId() });
        if (!response || response.success === false) {
            const error = new Error(response?.error || 'Расширение не ответило. Обновите страницу.');
            if (response?.code) error.code = response.code;
            throw error;
        }
        return response.data !== undefined ? response.data : response;
    }

    // Lots of the current account: public profile list plus lots the automation already
    // knows about (inactive lots are not shown on the profile).
    async function listLots(known = []) {
        const app = (() => { try { const data = JSON.parse(document.body?.dataset.appData || '{}'); return Array.isArray(data) ? data[0] : data; } catch (_) { return {}; } })();
        const lots = app?.userId ? await chrome.runtime.sendMessage({ action: 'getUserLotsList', userId: app.userId }) : [];
        const list = Array.isArray(lots) ? lots.map(lot => ({ offerId: String(lot.id), nodeId: lot.nodeId ? String(lot.nodeId) : null, title: lot.title || `Лот #${lot.id}`, categoryName: lot.categoryName || '', visible: true })) : [];
        const seen = new Set(list.map(lot => lot.offerId));
        for (const lot of known) {
            if (!lot?.offerId || seen.has(String(lot.offerId))) continue;
            seen.add(String(lot.offerId));
            list.push({ offerId: String(lot.offerId), nodeId: lot.nodeId || null, title: lot.title || `Лот #${lot.offerId}`, categoryName: '', visible: false });
        }
        return list;
    }

    function lotPicker(lots, { selected = new Set(), describe = null } = {}) {
        const wrap = node('div', 'fpt-auto-lot-picker');
        const search = input('search', '', { placeholder: 'Поиск по лотам', 'aria-label': 'Поиск по лотам' });
        const list = node('div', 'fpt-auto-lot-list');
        list.setAttribute('role', 'group');
        list.setAttribute('aria-label', 'Лоты');
        const rows = [];
        for (const lot of lots) {
            const row = node('label', 'fpt-bulk-lot-row fpt-auto-lot-row');
            const check = node('input');
            check.type = 'checkbox';
            check.value = lot.offerId;
            check.checked = selected.has(lot.offerId);
            const name = node('span', 'fpt-bulk-lot-name', lot.title);
            const meta = node('span', 'fpt-bulk-lot-category', [lot.visible === false ? 'не на витрине' : '', describe ? describe(lot) : lot.categoryName].filter(Boolean).join(' · '));
            row.append(check, name, meta);
            row.dataset.search = `${lot.title} ${lot.categoryName} ${lot.offerId}`.toLocaleLowerCase('ru');
            list.appendChild(row);
            rows.push({ row, check, lot });
        }
        if (!lots.length) list.appendChild(node('p', 'fpt-auto-empty', 'Лоты не найдены.'));
        search.addEventListener('input', () => {
            const query = search.value.trim().toLocaleLowerCase('ru');
            rows.forEach(({ row }) => { row.hidden = Boolean(query) && !row.dataset.search.includes(query); });
        });
        wrap.append(search, list);
        return {
            element: wrap,
            selected: () => rows.filter(item => item.check.checked).map(item => item.lot),
            setSelected: ids => rows.forEach(item => { item.check.checked = ids.has(item.lot.offerId); })
        };
    }

    function table(columns, rows) {
        const wrap = node('div', 'fpt-auto-table-wrap');
        const element = node('table', 'fpt-auto-table');
        const head = node('thead');
        const headRow = node('tr');
        columns.forEach(column => headRow.appendChild(node('th', '', column)));
        head.appendChild(headRow);
        const body = node('tbody');
        rows.forEach(cells => {
            const tr = node('tr');
            cells.forEach(cell => {
                const td = node('td');
                if (cell instanceof Node) td.appendChild(cell);
                else td.textContent = cell === null || cell === undefined ? '—' : String(cell);
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });
        element.append(head, body);
        wrap.appendChild(element);
        return wrap;
    }

    root.FPTAutomationUI = Object.freeze({
        node, icon, button, pill, field, input, select, section, notice, table,
        formatDateTime, formatMoney, request, listLots, lotPicker
    });

    // --- Popup actions -------------------------------------------------------------
    const forward = (action, extra = {}) => payload => request({ ...(payload || {}), ...extra, action });
    if (root.fptPopupActions) {
        const actions = root.fptPopupActions;
        actions.register('lot_io', 'lotSchedules', forward('fptLotSchedules'));
        actions.register('lot_io', 'lotPricing', forward('fptPricing'));
        actions.register('auto_delivery', 'ordersList', forward('fptOrders', { command: 'list' }));
        actions.register('auto_delivery', 'orderCard', forward('fptOrders', { command: 'card' }));
        actions.register('auto_delivery', 'orderCommand', forward('fptOrders'));
        actions.register('auto_review', 'reminders', forward('fptReviewReminders'));
    }
})(window);
