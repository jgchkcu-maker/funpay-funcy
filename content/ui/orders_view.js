// «Заказы и выдачи» — journal tab inside «Автовыдача». Lists orders by what needs a
// decision and opens a card with stages, delivery parts, history and the actions
// the background allows for this order right now.
(function (root) {
    'use strict';

    const PAGE_ID = 'auto_delivery';
    const ui = () => root.FPTAutomationUI;
    const run = (actionId, payload) => root.fptPopupActions.run(PAGE_ID, actionId, payload);

    const FILTERS = [['attention', 'Требуют решения'], ['delivery', 'Выдача'], ['done', 'Завершены'], ['all', 'Все']];
    const DELIVERY_LABELS = {
        none: ['Не начата', ''], blocked: ['Заблокирована', 'warning'], pending: ['Ожидает', ''], sending: ['Отправляется', 'accent'],
        done: ['Выдано, доставка подтверждена', 'success'], 'sent-unconfirmed': ['Отправлено, без подтверждения', 'accent'],
        partial: ['Выдано частично', 'warning'], uncertain: ['Исход неясен', 'danger'], failed: ['Не отправлено', 'danger'],
        legacy: ['Выдано прежней версией', ''], manual: ['Выдано вручную', 'success']
    };
    const STATUS_LABELS = { paid: 'Оплачен', closed: 'Подтверждён', refunded: 'Возврат', unknown: 'Статус неизвестен' };
    const EVENT_LABELS = {
        'order.observed': 'Заказ замечен', 'order.refund_observed': 'Замечен возврат', 'delivery.blocked': 'Выдача заблокирована',
        'delivery.attempt': 'Начата выдача', 'delivery.result': 'Итог выдачи', 'delivery.manual_resend': 'Повторная отправка части',
        'reminder.cancelled': 'Напоминание отменено'
    };

    function mount(container, popup) {
        const { node, button, pill, notice, formatDateTime } = ui();
        const root$ = node('div', 'fpt-auto-orders');
        const tabs = node('div', 'fpt-auto-tabs');
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Фильтр заказов');
        const status = node('div', 'fpt-auto-status');
        status.setAttribute('aria-live', 'polite');
        const list = node('div', 'fpt-auto-cards');
        const refresh = button('Обновить', { iconName: 'refresh' });
        const head = node('div', 'fpt-auto-actions');
        head.append(tabs, refresh);
        root$.append(head, status,
            notice('Здесь видны заказы, которые обработал единый исполнитель. «Подтверждена» значит, что FunPay вернул наше сообщение; иначе исход проверяется вручную.', 'info'),
            list);
        container.appendChild(root$);

        let filter = 'attention';
        const setStatus = (text, tone = 'info') => { status.replaceChildren(); if (text) status.appendChild(notice(text, tone)); };

        const renderTabs = counts => {
            tabs.replaceChildren();
            for (const [id, label] of FILTERS) {
                const tab = node('button', 'fpt-auto-tab');
                tab.type = 'button';
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-selected', String(filter === id));
                tab.append(node('span', '', label), node('span', 'fpt-auto-tab-count', counts?.[id] ?? 0));
                tab.addEventListener('click', () => { filter = id; load(); });
                tabs.appendChild(tab);
            }
        };

        const stageLine = item => {
            const line = node('div', 'fpt-auto-actions');
            const [deliveryText, deliveryTone] = DELIVERY_LABELS[item.deliveryState] || [item.deliveryState, ''];
            line.appendChild(pill(STATUS_LABELS[item.fpStatus] || item.fpStatus, item.fpStatus === 'refunded' ? 'danger' : ''));
            line.appendChild(pill(deliveryText, deliveryTone));
            if (item.resultCoverage === 'partial') line.appendChild(pill('Товара меньше, чем заказано', 'warning'));
            if (item.holds?.length) line.appendChild(pill(`Удержание: ${item.holds.map(hold => hold.reason).join('; ')}`, 'warning'));
            if (!item.adopted) line.appendChild(pill('Только наблюдение', ''));
            return line;
        };

        async function load() {
            try {
                const result = await run('ordersList', { filter });
                renderTabs(result.counts);
                list.replaceChildren();
                if (!result.items.length) {
                    list.appendChild(node('p', 'fpt-auto-empty', filter === 'attention' ? 'Нет заказов, которые требуют решения.' : 'Заказов нет.'));
                    return;
                }
                for (const item of result.items) {
                    const card = node('article', 'fpt-auto-card');
                    if (item.attention) card.dataset.tone = 'warning';
                    const cardHead = node('div', 'fpt-auto-card-head');
                    const title = node('strong', '', `#${item.orderId} · ${item.lotName || 'Лот'}`);
                    cardHead.append(title, node('span', 'fpt-auto-card-meta', formatDateTime(item.updatedAt)));
                    const meta = node('p', 'fpt-auto-card-meta', [item.buyerName, item.quantity ? `${item.quantity} шт.` : (item.quantityRaw ? `количество «${item.quantityRaw}» не распознано` : '')].filter(Boolean).join(' · '));
                    card.append(cardHead, meta, stageLine(item));
                    if (item.blockReasons?.length) card.appendChild(node('p', 'fpt-auto-card-meta', `Почему остановлено: ${item.blockReasons.join('; ')}`));
                    const actions = node('div', 'fpt-auto-actions');
                    const open = button('Открыть карточку', { iconName: 'open_in_full' });
                    open.addEventListener('click', () => openCard(item.key));
                    actions.appendChild(open);
                    card.appendChild(actions);
                    list.appendChild(card);
                }
            } catch (error) {
                setStatus(error.message, 'error');
            }
        }

        async function openCard(orderKey) {
            const dialog = root.FPTPopupUI.createDialog(popup, 'Заказ', { wide: true });
            dialog.dialog.classList.add('fpt-auto-dialog');
            const body = dialog.body;
            const close = node('button', 'fpt-lot-dialog-button', 'Закрыть');
            close.type = 'button';
            close.addEventListener('click', () => dialog.close());
            dialog.footer.appendChild(close);

            async function render() {
                body.replaceChildren(node('p', 'fpt-auto-empty', 'Загружаем…'));
                let card;
                try { card = await run('orderCard', { orderKey }); }
                catch (error) { body.replaceChildren(notice(error.message, 'error')); return; }
                const { order } = card;
                dialog.dialog.querySelector('.fpt-lot-dialog-header h2').textContent = `Заказ #${order.orderId}`;
                body.replaceChildren();
                const facts = ui().section('Сведения');
                const kv = node('dl', 'fpt-auto-kv');
                const row = (label, value) => { kv.append(node('dt', '', label), node('dd', '', value ?? '—')); };
                row('Лот', order.lotName || '—');
                row('Привязка', order.offerId ? `лот #${order.offerId}` : (order.lotCandidate?.offerId ? `кандидат по названию: #${order.lotCandidate.offerId} — нужно подтверждение` : 'не определена'));
                row('Покупатель', order.buyerName);
                row('Количество', order.quantity ? `${order.quantity} шт.` : `не распознано${order.quantityRaw ? ` («${order.quantityRaw}»)` : ''}`);
                row('Источник товара', { funpay_secrets: 'Склад FunPay', template: 'Шаблон' }[order.source] || 'не закреплён');
                row('Выполнение подтверждено', order.verifiedFulfillmentCompletedAt ? formatDateTime(order.verifiedFulfillmentCompletedAt) : 'нет');
                row('Подтверждение покупателем', order.fpConfirmedAt ? formatDateTime(order.fpConfirmedAt) : 'нет');
                if (order.manualDelivery) row('Ручная отметка', `${order.manualDelivery.note} (${formatDateTime(order.manualDelivery.at)})`);
                const link = node('a', '', 'Открыть заказ на FunPay');
                link.href = `https://funpay.com/orders/${order.orderId}/`;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                facts.append(stageLine(order), kv, link);
                if (order.blockReasons?.length) facts.appendChild(notice(`Почему остановлено: ${order.blockReasons.join('; ')}`, 'warning'));
                body.appendChild(facts);

                if (card.parts.length) {
                    const partsSection = ui().section('Части выдачи', 'Каждое сообщение имеет свой исход. «Принято» — FunPay принял запрос, но сообщение в ответе не найдено.');
                    const labels = { confirmed: ['Доставлено', 'success'], accepted: ['Принято', 'accent'], uncertain: ['Неясно', 'danger'], rejected: ['Отклонено', 'danger'], pending: ['Не отправлено', ''], sending: ['Отправляется', 'accent'], manual: ['Вручную', 'success'] };
                    partsSection.appendChild(ui().table(['#', 'Текст', 'Исход', 'Подробности'], card.parts.map(part => [
                        String(part.index + 1), part.preview, pill(...(labels[part.state] || [part.state, ''])), part.error || (part.receipt?.messageId ? `сообщение ${part.receipt.messageId}` : '')
                    ])));
                    body.appendChild(partsSection);
                }

                const actionsSection = ui().section('Действия', 'Доступны только действия, которые имеют смысл для текущих сведений о заказе.');
                const actions = node('div', 'fpt-auto-actions');
                for (const cap of card.capabilities) {
                    const element = button(cap.label, { kind: cap.id === 'adopt' ? 'primary' : '' });
                    element.addEventListener('click', () => perform(cap, order));
                    actions.appendChild(element);
                }
                actionsSection.appendChild(actions);
                body.appendChild(actionsSection);

                const history = ui().section('История');
                const timeline = node('ol', 'fpt-auto-timeline');
                for (const event of card.events.slice().reverse()) {
                    const item = node('li');
                    const time = node('time', '', formatDateTime(event.at));
                    item.append(time, node('span', '', `${EVENT_LABELS[event.type] || event.type}${event.data?.summary ? `: ${event.data.summary}` : ''}${event.data?.reasons ? ` (${event.data.reasons.join(', ')})` : ''}`));
                    timeline.appendChild(item);
                }
                if (!card.events.length) timeline.appendChild(node('li', 'fpt-auto-empty', 'Событий нет.'));
                history.appendChild(timeline);
                body.appendChild(history);

                async function perform(cap, current) {
                    const payload = { orderKey, orderCommand: cap.id, expectedRevision: current.revision, partId: cap.partId };
                    if (cap.warning && !window.confirm(cap.warning)) return;
                    if (cap.needs?.includes('offerId')) {
                        const value = window.prompt('Номер лота (offer id), к которому относится этот заказ', current.lotCandidate?.offerId || '');
                        if (!value) return;
                        payload.offerId = value.trim();
                    }
                    if (cap.needs?.includes('note')) {
                        const value = window.prompt('Как и что выдано покупателю? Отметка сохранится как ручная.');
                        if (!value) return;
                        payload.note = value;
                    }
                    if (cap.needs?.includes('reason')) {
                        const value = window.prompt('Причина удержания');
                        if (!value) return;
                        payload.reason = value;
                    }
                    if (cap.id === 'openOrder') { window.open(`https://funpay.com/orders/${current.orderId}/`, '_blank', 'noopener'); return; }
                    try {
                        dialog.setBusy(true);
                        const result = await run('orderCommand', payload);
                        if (cap.id === 'revealDelivery') {
                            const reveal = ui().section('Выданный текст', 'Не пересылайте этот текст третьим лицам.');
                            const lines = (result.parts || []).map(part => `${part.index + 1}. ${part.text}`);
                            const pre = node('pre', 'fpt-auto-reveal', lines.join('\n'));
                            reveal.appendChild(pre);
                            body.insertBefore(reveal, actionsSection);
                            return;
                        }
                        await render();
                        await load();
                    } catch (error) {
                        body.insertBefore(notice(error.message, 'error'), body.firstChild);
                        if (error.code === 'conflict') await render();
                    } finally {
                        dialog.setBusy(false);
                    }
                }
            }
            await render();
        }

        refresh.addEventListener('click', load);
        renderTabs({});
        return { load };
    }

    root.FPTOrdersView = Object.freeze({ mount });
})(window);
