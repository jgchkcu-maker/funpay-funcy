/*
 * FunPay Funcy — автодемпер: предложение, выдача раздела и строгий отбор конкурентов.
 *
 * Предложение идентифицируется { accountId, kind: 'lots'|'chips', nodeId, offerId };
 * составной ID валюты (<продавец>-<игра>-<раздел>-<сервер>[-<сторона>]) хранится целиком.
 *
 * Отбор работает только с тем, что FunPay опубликовал: схема раздела
 * .lot-fields[data-fields] с условиями и значения data-f-* строк выдачи. Поля,
 * скрытые условиями, не участвуют; у конкурента нет значения применимого поля —
 * он исключается. Регион, способ активации и прочее, чего нет в схеме, не
 * считается совпавшим «по умолчанию»: такие различия видны только в тексте, и
 * сузить выборку можно словами-условиями или выбором конкретных предложений.
 *
 * Каждое решение по кандидату хранит причину — пользователь видит, почему
 * предложение попало или не попало в сравнение.
 */

import { parseDecimal, formatDecimal, compareDecimal } from './money.js';

export const KINDS = Object.freeze(['lots', 'chips']);

// Значения полей сравниваются по ключу с нормализацией регистра и пробелов.
export function normValue(value) {
    return String(value ?? '').replace(/[\s  ]+/g, ' ').trim().toLocaleLowerCase('ru-RU');
}

// Для текстовых условий дополнительно приводим «стилизованные» буквы (𝐏𝐑𝐄𝐌𝐈𝐔𝐌) и ё.
export function normText(value) {
    return normValue(String(value ?? '').normalize('NFKC')).replace(/ё/g, 'е');
}

export function parseOfferRef(input) {
    const accountId = String(input?.accountId ?? '').trim();
    const kind = String(input?.kind ?? '').trim();
    const offerId = String(input?.offerId ?? '').trim();
    let nodeId = String(input?.nodeId ?? '').trim();
    if (!/^\d+$/.test(accountId) || !KINDS.includes(kind)) return null;
    if (kind === 'lots') {
        if (!/^\d+$/.test(offerId) || offerId === '0' || !/^\d+$/.test(nodeId)) return null;
        return { accountId, kind, nodeId, offerId };
    }
    const parts = offerId.split('-');
    if (parts.length < 4 || !parts.every(part => /^\d+$/.test(part))) return null;
    // Раздел валюты — часть ID; переданный отдельно nodeId обязан с ней совпадать.
    if (nodeId && nodeId !== parts[2]) return null;
    nodeId = parts[2];
    if (parts[0] !== accountId) return null;
    return { accountId, kind, nodeId, offerId, gameId: parts[1], server: parts[3], side: parts[4] ?? null };
}

export function offerKey(ref) {
    return `${ref.accountId}:${ref.kind}:${ref.nodeId}:${ref.offerId}`;
}

const CURRENCY_BY_UNIT = Object.freeze({ '₽': 'RUB', 'руб.': 'RUB', 'руб': 'RUB', '$': 'USD', '€': 'EUR' });

export function currencyFromUnit(unit) {
    return CURRENCY_BY_UNIT[String(unit ?? '').trim().toLowerCase()] || null;
}

function positiveDecimal(value) {
    const parsed = parseDecimal(value);
    if (!parsed) return null;
    const text = formatDecimal(parsed);
    return compareDecimal(text, '0') > 0 ? text : null;
}

// В /lots/ числовая цена выдачи — data-s (текст округлён до копеек).
// В /chips/ data-s — значение сортировки (в проверенной разметке "0"), цена — только текст.
export function rowBuyerPrice(row, kind) {
    if (kind === 'lots') return positiveDecimal(row.priceData) || positiveDecimal(row.priceText);
    return positiveDecimal(row.priceText);
}

// Нормализует ответ parseDumperMarket. Повторяющиеся строки (продвижение показывает
// предложение дважды) схлопываются. Выдача полная, только если строк столько же,
// сколько в счётчике раздела.
export function normalizeMarket(raw, { kind, nodeId }) {
    if (!raw?.ok) {
        const error = raw?.error || { code: 'parse', message: 'Выдача раздела не разобрана.' };
        throw Object.assign(new Error(error.message), { code: error.code || 'parse' });
    }
    if (raw.kind && raw.kind !== kind) throw Object.assign(new Error('Тип раздела не совпадает с типом предложения.'), { code: 'kind' });
    if (raw.nodeId && String(raw.nodeId) !== String(nodeId)) {
        throw Object.assign(new Error(`FunPay открыл другой раздел (${raw.nodeId}).`), { code: 'node' });
    }
    if (raw.lang && raw.lang !== 'ru') {
        throw Object.assign(new Error('Страница FunPay открылась не на русском языке — сравнение остановлено.'), { code: 'locale' });
    }
    const seen = new Map();
    for (const row of raw.rows || []) {
        if (!row?.offerId || seen.has(row.offerId)) continue;
        const price = rowBuyerPrice(row, kind);
        seen.set(row.offerId, { ...row, price, currency: currencyFromUnit(row.priceUnit) });
    }
    const rows = [...seen.values()];
    const counter = Number.isFinite(raw.counter) ? raw.counter : null;
    const complete = counter !== null ? rows.length >= counter : false;
    if (!rows.length && !raw.emptyShown && counter !== 0) {
        throw Object.assign(new Error('Выдача пуста, но FunPay не подтвердил отсутствие предложений.'), { code: 'parse' });
    }
    return {
        kind, nodeId: String(nodeId), lang: raw.lang || null, userId: raw.userId || null,
        counter, complete, rows,
        schema: raw.schema?.present ? { present: true, invalid: Boolean(raw.schema.invalid), fields: raw.schema.fields || [] } : { present: false, fields: [] },
        priceHeader: raw.priceHeader || null
    };
}

export function schemaFingerprint(schema) {
    if (!schema?.present) return 'none';
    return JSON.stringify((schema.fields || []).map(field => [field.id, (field.conditions || []).map(c => [c.id, (c.list || []).map(normValue).sort()])]));
}

// Значение поля своего лота может прийти как value или как подпись варианта.
function ownValues(own, fieldId) {
    const entry = own.fields?.[fieldId];
    if (!entry) return [];
    return [entry.value, entry.label].map(normValue).filter(Boolean);
}

function conditionHolds(condition, valueOf) {
    const values = valueOf(condition.id);
    if (!values.length) return false;
    const allowed = new Set((condition.list || []).map(normValue));
    return values.some(value => allowed.has(value));
}

// Применимые поля схемы для набора значений: поле участвует, если выполнены все
// его условия. Порядок схемы сохраняется.
export function applicableFields(schema, valueOf) {
    return (schema?.fields || []).filter(field => (field.conditions || []).every(condition => conditionHolds(condition, valueOf)));
}

function fieldName(field) {
    return field.label ? `«${field.label}»` : `«${field.id}»`;
}

// Отпечаток проверяемых характеристик чужого предложения — для выбранных вручную:
// название и опубликованные в выдаче параметры (data-f-*, сервер, сторона).
export function competitorFingerprint(row) {
    const fields = Object.entries(row.fields || {}).map(([k, v]) => [k, normValue(v)]).sort();
    return JSON.stringify({ t: normText(row.title), f: fields, s: row.server || null, d: row.side || null });
}

export function ownFingerprint(own) {
    const fields = Object.entries(own.fields || {}).map(([k, v]) => [k, normValue(v?.value), normValue(v?.label)]).sort();
    return JSON.stringify({ n: own.nodeId, f: fields, s: own.server || null, d: own.side || null });
}

export function wordList(value) {
    const list = Array.isArray(value) ? value : String(value ?? '').split(/[\n,;]+/);
    return [...new Set(list.map(normText).filter(Boolean))].slice(0, 50);
}

export function needsCard(competitors) {
    return wordList(competitors?.excludedWords).length > 0 || wordList(competitors?.requiredWords).length > 0;
}

/*
 * Отбор конкурентов.
 *   own     — { kind, nodeId, offerId, fields, server, side } (fields только для lots)
 *   market  — normalizeMarket
 *   rule    — { competitors: { mode, ignoreFields, selected, requiredWords, excludedWords,
 *               minRating, onlineOnly, autoOnly, excludedSellers, onlySellers, sellers } }
 *   cards   — Map offerId → карточка (или { error }) для текстовых условий и выбранных
 * Возвращает { blockers, fields, included, excluded, pendingCards }.
 * blockers — правило нельзя применять вовсе (не «пустой рынок»).
 */
export function selectCompetitors({ own, market, rule, accountId, cards = new Map() }) {
    const competitors = rule?.competitors || {};
    const mode = competitors.mode === 'selected' ? 'selected' : 'schema';
    const blockers = [];
    const ignored = new Set((competitors.ignoreFields || []).map(String));
    const required = wordList(competitors.requiredWords);
    const excludedWords = wordList(competitors.excludedWords);
    const excludedSellers = new Set((competitors.excludedSellers || []).map(s => String(s?.id ?? s)));
    const onlySellers = Boolean(competitors.onlySellers);
    const allowedSellers = new Set((competitors.sellers || []).map(s => String(s?.id ?? s)));
    const minRating = Number(competitors.minRating) || 0;
    const selected = new Map((competitors.selected || []).map(item => [String(item.offerId), item]));
    const textNeeded = required.length > 0 || excludedWords.length > 0;

    let fields = [];
    if (own.kind === 'lots') {
        if (market.schema.invalid) blockers.push('Схема параметров раздела не разобрана — сравнение по параметрам невозможно.');
        if (!market.schema.present || !market.schema.fields.length) {
            if (mode === 'schema') blockers.push('В разделе нет товарной схемы: автоматический отбор запрещён, выберите конкретные предложения на вкладке «Конкуренты».');
        } else {
            fields = applicableFields(market.schema, id => ownValues(own, id));
            for (const field of fields) {
                if (!ownValues(own, field.id).length) blockers.push(`У вашего лота не заполнено поле ${fieldName(field)} — сравнение остановлено.`);
            }
        }
    }
    if (mode === 'selected' && !selected.size) blockers.push('Не выбрано ни одного предложения для сравнения.');
    if (onlySellers && !allowedSellers.size) blockers.push('Включён режим «только выбранные продавцы», но продавцы не выбраны.');

    const included = [];
    const excluded = [];
    const pendingCards = [];
    const found = new Set();

    for (const row of market.rows) {
        const reasons = [];
        const isOwn = row.offerId === own.offerId || (row.sellerId && row.sellerId === String(accountId));
        if (isOwn) { excluded.push({ row, reasons: ['Собственное предложение'] }); continue; }
        if (mode === 'selected' && !selected.has(row.offerId)) continue; // вне выбора — не участвует и не шумит в списке
        if (selected.has(row.offerId)) found.add(row.offerId);

        if (own.kind === 'chips') {
            if (String(row.server ?? '') !== String(own.server ?? '')) reasons.push(`Другой сервер${row.serverName ? `: ${row.serverName}` : ''}`);
            if (own.side !== null && own.side !== undefined && String(row.side ?? '') !== String(own.side)) reasons.push(`Другая сторона${row.sideName ? `: ${row.sideName}` : ''}`);
        } else if (mode === 'schema' || fields.length) {
            for (const field of fields) {
                if (ignored.has(field.id)) continue;
                const theirs = normValue(row.fields?.[field.id]);
                if (!theirs) { reasons.push(`Нет обязательного поля ${fieldName(field)}`); continue; }
                if (!ownValues(own, field.id).includes(theirs)) reasons.push(`Другое значение ${fieldName(field)}: ${row.fields[field.id]}`);
            }
        }
        if (!row.price) reasons.push('Цена не распознана');
        if (row.sellerId && excludedSellers.has(row.sellerId)) reasons.push('Продавец исключён');
        if (onlySellers && (!row.sellerId || !allowedSellers.has(row.sellerId))) reasons.push('Продавец не из выбранных');
        if (!row.sellerId && (onlySellers || excludedSellers.size)) reasons.push('Продавец не определён');
        if (minRating > 0 && (row.rating === null || row.rating === undefined || row.rating < minRating)) reasons.push(`Рейтинг ниже ${minRating}`);
        if (competitors.onlineOnly && !row.online) reasons.push('Продавец не в сети');
        if (competitors.autoOnly && !row.auto) reasons.push('Без автовыдачи');

        const pick = selected.get(row.offerId);
        const card = cards.get(row.offerId);
        if (!reasons.length && (textNeeded || pick)) {
            if (!card) { pendingCards.push(row); excluded.push({ row, reasons: ['Карточка не проверена'], pending: true }); continue; }
            if (card.error) { excluded.push({ row, reasons: [`Карточка не прочитана: ${card.error}`] }); continue; }
            if (card.nodeId && card.nodeId !== String(market.nodeId)) reasons.push('Карточка относится к другому разделу');
            if (!card.nodeId) reasons.push('Раздел карточки не подтверждён');
            if (card.sellerId && row.sellerId && card.sellerId !== row.sellerId) reasons.push('Продавец в карточке не совпадает с выдачей');
            const haystack = normText([row.title, card.summary, card.description, ...(card.params || []).map(p => `${p.label} ${p.value}`)].filter(Boolean).join('\n'));
            for (const word of required) if (!haystack.includes(word)) reasons.push(`Нет слова «${word}»`);
            for (const word of excludedWords) if (haystack.includes(word)) reasons.push(`Содержит «${word}»`);
            if (pick && pick.fingerprint && pick.fingerprint !== competitorFingerprint(row)) {
                reasons.push('Название или характеристики изменились — подтвердите предложение заново');
            }
        }
        if (reasons.length) excluded.push({ row, reasons });
        else included.push({ row, reasons: mode === 'selected' ? ['Выбрано вручную'] : fields.length ? ['Совпали все параметры схемы'] : ['Подходит по условиям'] });
    }

    for (const [offerId, item] of selected) {
        if (!found.has(offerId)) excluded.push({ row: { offerId, title: item.title || null, sellerName: item.sellerName || null }, reasons: ['Выбранное предложение не найдено в выдаче раздела'] });
    }
    included.sort((a, b) => compareDecimal(a.row.price, b.row.price));
    return { mode, blockers, fields: fields.map(f => ({ id: f.id, label: f.label, ignored: ignored.has(f.id), values: own.fields?.[f.id] || null })), included, excluded, pendingCards };
}
