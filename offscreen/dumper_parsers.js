// offscreen/dumper_parsers.js
//
// Разбор страниц FunPay для автодемпера. Здесь только извлечение того, что
// опубликовано в разметке: решения об отборе и цене принимает background
// (dumper_market.js, dumper_price.js). Ничего не угадываем: нет значения —
// поле отсутствует, а не пустая строка или ноль.
//
// Проверенная разметка (2026-11-04):
//   выдача /lots/<node>/  — .lot-fields[data-fields] (JSON схемы с conditions),
//                           a.tc-item[data-f-<id>], .tc-price[data-s] = числовая цена;
//   выдача /chips/<node>/ — a.tc-item[data-server][data-side], .tc-price[data-s] —
//                           значение сортировки (бывает "0"), цена только в тексте;
//   счётчик активного раздела .counter-item.active .counter-value — сколько
//   предложений опубликовано; строк в HTML может быть меньше (выдача обрезается).

(function (root) {
    'use strict';

    function text(el) {
        return (el?.textContent || '').replace(/[\s  ]+/g, ' ').trim();
    }

    function appData(doc) {
        const raw = doc.querySelector('body')?.getAttribute('data-app-data');
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return (Array.isArray(parsed) ? parsed[0] : parsed) || {};
        } catch (_) {
            return {};
        }
    }

    function pageProblem(doc, html) {
        const title = text(doc.querySelector('title'));
        if (doc.querySelector('#challenge-form, #challenge-running, script[src*="/cdn-cgi/challenge-platform/"]')
            || /^(just a moment|один момент|checking your browser)/i.test(title)) {
            return { code: 'guard', message: 'FunPay показал проверку браузера вместо страницы.' };
        }
        if (doc.querySelector('form[action*="/account/login"]') && !doc.querySelector('.tc-item, .param-list')) {
            return { code: 'auth', message: 'FunPay вернул страницу входа.' };
        }
        if (/captcha/i.test(String(html || '').slice(0, 20000)) && !doc.querySelector('.tc, .param-list, form.form-offer-editor')) {
            return { code: 'guard', message: 'FunPay запросил капчу.' };
        }
        return null;
    }

    // "162.25 ₽" → { amount: '162.25', unit: '₽' }. Разделители тысяч — пробелы.
    function priceFromBlock(el) {
        if (!el) return { amount: null, unit: null };
        const unitEl = el.querySelector('.unit');
        const unit = text(unitEl) || null;
        const holder = el.querySelector(':scope > div') || el;
        let raw = text(holder);
        if (unit && raw.endsWith(unit)) raw = raw.slice(0, -unit.length);
        raw = raw.replace(/[\s  ]/g, '').replace(',', '.');
        return { amount: /^\d+(?:\.\d+)?$/.test(raw) ? raw : null, unit };
    }

    function rowOfferId(href, kind) {
        const match = kind === 'chips'
            ? href.match(/\/chips\/offer\?(?:[^#]*&)?id=(\d+(?:-\d+)+)(?![\w-])/)
            : href.match(/\/lots\/offer\?(?:[^#]*&)?id=(\d+)(?![\w-])/);
        return match ? match[1] : null;
    }

    function sellerIdOf(row) {
        const direct = row.getAttribute('data-user');
        if (direct && /^\d+$/.test(direct)) return direct;
        const href = row.querySelector('[data-href*="/users/"]')?.getAttribute('data-href')
            || row.querySelector('a[href*="/users/"]')?.getAttribute('href') || '';
        const match = href.match(/\/users\/(\d+)\//);
        return match ? match[1] : null;
    }

    function ratingOf(row) {
        const stars = row.querySelector('.rating-stars');
        const match = (stars?.className || '').match(/\brating-(\d)\b/);
        return match ? Number(match[1]) : null;
    }

    function parseSchema(doc) {
        const holder = doc.querySelector('.lot-fields[data-fields]');
        if (!holder) return { present: false, fields: [] };
        let fields = [];
        try {
            const parsed = JSON.parse(holder.getAttribute('data-fields') || '[]');
            fields = Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return { present: true, invalid: true, fields: [] };
        }
        const normalized = fields
            .filter(field => field && typeof field.id === 'string' && field.id)
            .map(field => {
                const group = holder.querySelector(`.lot-field[data-id="${CSS.escape(field.id)}"]`);
                const select = group?.querySelector('select');
                const placeholder = select ? text(select.querySelector('option[value=""]')) : '';
                const options = select
                    ? Array.from(select.querySelectorAll('option')).filter(o => o.value !== '').map(o => text(o))
                    : Array.from(group?.querySelectorAll('button[value]') || []).filter(b => b.value !== '').map(b => text(b));
                return {
                    id: field.id,
                    type: field.type ?? null,
                    label: placeholder || null,
                    options,
                    conditions: Array.isArray(field.conditions)
                        ? field.conditions.filter(c => c && typeof c.id === 'string').map(c => ({ id: c.id, list: Array.isArray(c.list) ? c.list.map(String) : [] }))
                        : []
                };
            });
        return { present: true, fields: normalized };
    }

    function parseDumperMarket(html, kind) {
        try {
            const doc = root.__fptParseHTML(html);
            const problem = pageProblem(doc, html);
            if (problem) return { ok: false, error: problem };
            const app = appData(doc);
            const table = doc.querySelector('.tc.showcase-table, .showcase-table');
            if (!table) return { ok: false, error: { code: 'parse', message: 'На странице раздела нет таблицы предложений.' } };
            const sectionKind = table.getAttribute('data-section-type') === 'chip' ? 'chips' : 'lots';
            if (kind && sectionKind !== kind) {
                return { ok: false, error: { code: 'kind', message: 'Тип раздела не совпадает с типом предложения.' } };
            }
            const active = doc.querySelector('.counter-list .counter-item.active');
            const activeMatch = (active?.getAttribute('href') || '').match(/\/(lots|chips)\/(\d+)\/?(?:[?#]|$)/);
            const sectionAttr = (doc.querySelector('.showcase[data-section]')?.getAttribute('data-section') || '').match(/(\d+)$/);
            const counterText = text(active?.querySelector('.counter-value')).replace(/\D/g, '');
            const priceHeader = text(table.querySelector('.tc-header .tc-price')) || null;

            const rows = [];
            table.querySelectorAll('a.tc-item').forEach(row => {
                const href = row.getAttribute('href') || '';
                const offerId = rowOfferId(href, sectionKind);
                if (!offerId) return;
                const fields = {};
                for (const attr of Array.from(row.attributes)) {
                    if (attr.name.startsWith('data-f-')) fields[attr.name.slice(7)] = attr.value;
                }
                const priceEl = row.querySelector('.tc-price');
                const shown = priceFromBlock(priceEl);
                const amountEl = row.querySelector('.tc-amount');
                rows.push({
                    offerId,
                    promo: row.classList.contains('offer-promo'),
                    sellerId: sellerIdOf(row),
                    sellerName: text(row.querySelector('.media-user-name')) || null,
                    online: row.getAttribute('data-online') === '1',
                    auto: row.getAttribute('data-auto') === '1' || Boolean(row.querySelector('.auto-dlv-icon')),
                    rating: ratingOf(row),
                    reviews: Number(text(row.querySelector('.rating-mini-count')).replace(/\D/g, '')) || 0,
                    fields,
                    title: text(row.querySelector('.tc-desc-text')) || null,
                    server: row.getAttribute('data-server'),
                    side: row.getAttribute('data-side'),
                    serverName: text(row.querySelector(':scope > .tc-server')) || null,
                    sideName: text(row.querySelector(':scope > .tc-side')) || null,
                    amount: amountEl?.getAttribute('data-s') ?? null,
                    amountUnit: text(amountEl?.querySelector('.unit')) || null,
                    priceData: priceEl?.getAttribute('data-s') ?? null,
                    priceText: shown.amount,
                    priceUnit: shown.unit
                });
            });
            const empty = doc.querySelector('.showcase-empty');
            return {
                ok: true,
                kind: sectionKind,
                lang: doc.documentElement?.getAttribute('lang') || app.locale || null,
                userId: /^\d+$/.test(String(app.userId ?? '')) ? String(app.userId) : null,
                nodeId: activeMatch ? activeMatch[2] : sectionAttr ? sectionAttr[1] : null,
                counter: counterText ? Number(counterText) : null,
                schema: sectionKind === 'lots' ? parseSchema(doc) : { present: false, fields: [] },
                priceHeader,
                emptyShown: Boolean(empty && !empty.classList.contains('hidden')),
                rows
            };
        } catch (error) {
            return { ok: false, error: { code: 'parse', message: 'Не удалось разобрать выдачу раздела.' } };
        }
    }

    const CARD_SUMMARY = /^(краткое описание|short description)$/i;
    const CARD_DESC = /^(подробное описание|detailed description)$/i;

    function parseDumperCard(html, kind) {
        try {
            const doc = root.__fptParseHTML(html);
            const problem = pageProblem(doc, html);
            if (problem) return { ok: false, error: problem };
            const heading = text(doc.querySelector('h1'));
            if (/Предложение не найдено|Offer not found/i.test(heading)) return { ok: false, error: { code: 'not_found', message: 'Предложение снято с продажи.' } };
            const nodes = new Set();
            doc.querySelectorAll(`a[href*="/${kind === 'chips' ? 'chips' : 'lots'}/"]`).forEach(a => {
                const match = (a.getAttribute('href') || '').match(/\/(lots|chips)\/(\d+)\/?(?:[?#]|$)/);
                if (match) nodes.add(match[2]);
            });
            const params = [];
            let summary = null;
            let description = null;
            doc.querySelectorAll('.param-list .param-item').forEach(item => {
                // Тем же классом размечены блок оплаты (форма покупки) и рейтинг продавца.
                if (item.closest('form, .js-order-prices, .review-list, .offer-calc-box')) return;
                const label = text(item.querySelector('h5'));
                const valueEl = item.querySelector(':scope > div');
                if (!label || !valueEl) return;
                if (CARD_SUMMARY.test(label)) summary = text(valueEl);
                else if (CARD_DESC.test(label)) description = (valueEl.innerText ?? valueEl.textContent ?? '').replace(/ /g, ' ').trim();
                else params.push({ label, value: text(valueEl) });
            });
            const seller = doc.querySelector('.chat[data-seller]')?.getAttribute('data-seller')
                || ((doc.querySelector('.chat-header a[href*="/users/"]')?.getAttribute('href') || '').match(/\/users\/(\d+)\//) || [])[1]
                || null;
            return {
                ok: true,
                nodeId: nodes.size === 1 ? [...nodes][0] : null,
                nodeCandidates: [...nodes],
                sellerId: seller,
                summary,
                description,
                params,
                auto: Boolean(doc.querySelector('.offer-header-auto-dlv-label, .auto-dlv-icon'))
            };
        } catch (error) {
            return { ok: false, error: { code: 'parse', message: 'Не удалось разобрать карточку предложения.' } };
        }
    }

    const OWN_SKIPPED_FIELDS = new Set(['summary', 'desc', 'payment_msg', 'images', 'secrets']);

    // Собственный лот из формы offerEdit: настоящий node_id и значения товарных полей.
    // Для select/radio сохраняется и подпись выбранного варианта — в выдаче FunPay
    // публикует значение в своей записи (data-f-type="individual" при варианте "Individual").
    function parseDumperOwnLot(html) {
        try {
            const doc = root.__fptParseHTML(html);
            const form = doc.querySelector('form.form-offer-editor');
            if (!form) {
                const problem = pageProblem(doc, html);
                return { ok: false, error: problem || { code: 'form_missing', message: 'FunPay вернул страницу без формы лота.' } };
            }
            const value = name => form.querySelector(`[name="${name}"]`)?.value ?? null;
            const fields = {};
            form.querySelectorAll('[name^="fields["]').forEach(el => {
                const match = el.getAttribute('name').match(/^fields\[([^\]]+)\]$/);
                if (!match || OWN_SKIPPED_FIELDS.has(match[1])) return;
                const id = match[1];
                const type = (el.getAttribute('type') || '').toLowerCase();
                if (type === 'radio' || type === 'checkbox') {
                    if (!el.checked) { if (!fields[id]) fields[id] = { value: '', label: null }; return; }
                    const label = text(el.closest('label')) || null;
                    fields[id] = { value: el.value || 'on', label };
                    return;
                }
                if (el.tagName === 'SELECT') {
                    const option = el.selectedOptions?.[0] || null;
                    fields[id] = { value: el.value ?? '', label: option && option.value !== '' ? text(option) : null };
                    return;
                }
                fields[id] = { value: el.value ?? '', label: null };
            });
            const schemaHolder = form.querySelector('.lot-fields[data-fields]');
            let schema = null;
            if (schemaHolder) {
                try { schema = JSON.parse(schemaHolder.getAttribute('data-fields') || '[]'); } catch (_) { schema = null; }
            }
            return {
                ok: true,
                nodeId: value('node_id'),
                offerId: value('offer_id'),
                price: value('price'),
                amount: value('amount'),
                active: Boolean(form.querySelector('[name="active"]')?.checked),
                title: value('fields[summary][ru]'),
                fields,
                schema: Array.isArray(schema) ? schema.filter(f => f && typeof f.id === 'string').map(f => ({ id: f.id, conditions: Array.isArray(f.conditions) ? f.conditions : [] })) : null
            };
        } catch (error) {
            return { ok: false, error: { code: 'parse', message: 'Не удалось разобрать форму лота.' } };
        }
    }

    root.FPTDumperParsers = Object.freeze({ parseDumperMarket, parseDumperCard, parseDumperOwnLot });
})(typeof window !== 'undefined' ? window : globalThis);
