// background/background.js - FunPay Funcy 2.8

import './sales_db.js'; // FunPay Funcy: IndexedDB-хранилище заказов (self.FPTSalesDB)
import './purchases_db.js'; // FunPay Funcy: IndexedDB-хранилище покупок (self.FPTPurchasesDB)
import './finance_db.js'; // FunPay Funcy: IndexedDB-хранилище финансов (self.FPTFinanceDB)
import { fetchAIResponse, fetchAILotGeneration, fetchAITranslation, fetchAIImageGeneration } from './ai.js';
import { cleanupRetiredFinancialToolData } from './retired_financial_tools.mjs';
import { BUMP_ALARM_NAME, startAutoBump, stopAutoBump, runScheduledBump } from './autobump.js';
import {
    runAutoResponderCycle, resetAutoResponderState, configureOrderAutomation, runOrderReconcile,
    getStrictChatSender, applyVariables, isBlacklisted
} from './autoresponder.js';
import { createAccountGuard, sha256Short, ACCOUNT_EPOCH_KEY } from './account_guard.js';
import { createOrderDetailsLoader } from './order_details.js';
import { orderRole } from './order_facts.js';
import { createFulfillmentDispatcher } from './fulfillment_dispatcher.js';
import { createOrderReconcile } from './order_reconcile.js';
import { createOrderCommands } from './order_commands.js';
import { createReviewReminders, REMINDER_ALARM } from './review_reminders.js';
import { createOpsJournal, createIndexedDbBackend } from './ops_db.js';
import { createLotWriter, createLotWriteQueue } from './lot_writer.js';
import { createLotActivityService } from './lot_availability.js';
import { createLotScheduleService, LOT_SCHEDULES_ALARM, LOT_SCHEDULES_KEY } from './lot_schedule_service.js';
import { createPricingService, PRICING_ALARM, PRICING_KEY } from './pricing_service.js';
import { createLotPolicyStore, releaseStockManagedLots } from './lot_policy.js';
import { createJobScheduler } from './job_scheduler.js';
import { patchAutoReplies, importAutoReplies } from './auto_reply_store.js';
import {
    configureAutoDeliveryStore, saveAutoDeliveryLot, syncAutoDeliveryStockCounts,
    refreshAutoDeliveryLotStock, isAutoDeliveryLotEnabled
} from './auto_delivery_store.js';
import { startEngine, stopEngine, onHeartbeat, onKeepalivePing, ENGINE_HEARTBEAT_ALARM } from './fpt_engine.js';
import './retired_integrations.js';

const retiredIntegrationCleanup = globalThis.FPTRetiredIntegrations.cleanup(chrome.storage.local, chrome.alarms)
    .catch(error => console.error('FunPay Funcy: retired integrations cleanup failed:', error));

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2.8.1 - НАДЁЖНАЯ ОТПРАВКА КУКОВ.
// Браузер ИГНОРИРУЕТ заголовок Cookie, выставленный вручную в fetch() (forbidden
// header). Раньше многие запросы к funpay.com слали только ручной cookie и
// работали лишь у пользователей, чьи куки случайно подхватывались браузером -
// отсюда «у меня картинки/автоответы работают, а у людей нет».
// Оборачиваем глобальный fetch так, чтобы для ВСЕХ запросов к funpay.com по
// умолчанию подставлялись реальные куки активной сессии (credentials:'include').
// Прочие домены (*.workers.dev, CDN и т.д.) не затрагиваются.
// Совместимо с подменой golden_key в fptSnapshotForKey (она и так грузит главную
// с credentials:'include' из cookie-jar).
(function () {
    const _origFetch = self.fetch.bind(self);
    self.fetch = function (input, init) {
        try {
            const url = (typeof input === 'string') ? input
                      : (input && input.url) ? input.url : '';
            if (/^https:\/\/(?:[a-z0-9-]+\.)?funpay\.com\//i.test(url)) {
                init = init ? { ...init } : {};
                if (!init.credentials) init.credentials = 'include';
            }
        } catch (_) {}
        return _origFetch(input, init);
    };
})();

const OFFSCREEN_DOCUMENT_PATH = 'offscreen/offscreen.html';

const _imgSendInFlight = new Map();
const _imgSendDone = new Map();
const AUTO_RESPONDER_ALARM_NAME = 'fpToolsAutoResponder';
const IMPORT_PROCESS_KEY = 'fpToolsLotImportProcess';
let _lotImportStartInFlight = false;
const RETRY_LIMIT = 5;
const RETRY_DELAY = 5000; // 5 секунд

// Защита от ПАРАЛЛЕЛЬНЫХ циклов сбора. Если открыть пару вкладок /orders/ или
// перезагрузить страницу, каждый запуск дёргал свой цикл — два цикла разом удваивают
// нагрузку. Эти флаги не дают запуститься второму циклу.
let _salesCycleRunning = false;
let _purchasesCycleRunning = false;
let _financeCycleRunning = false;

// fetch с мягким ретраем на серверные ошибки FunPay (502/503/504/429). Когда у FunPay
// «лежит» бэкенд (а это бывает — в чате жалуются, что сайт падает), один и тот же
// запрос через секунду часто проходит. Это НЕ замедляет обычную работу: ретрай
// включается только при ошибке сервера.
async function fptFetchResilient(url, options, { retries = 3, baseDelay = 700 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, options);
            if (res.status === 429 || res.status >= 500) {
                lastErr = new Error(`HTTP ${res.status}`);
            } else {
                return res;
            }
        } catch (e) {
            lastErr = e; // network error / Failed to fetch
        }
        if (attempt < retries) {
            await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt) + Math.random() * 300));
        }
    }
    throw lastErr || new Error('fptFetchResilient: исчерпаны попытки');
}

// --- СБОР СТАТИСТИКИ ПРОДАЖ (IndexedDB) ---
// Данные хранятся в IndexedDB (self.FPTSalesDB), а не в chrome.storage.local,
// поэтому квота ~10 МБ больше не упирается на ~18800 заказах. Между страницами —
// небольшая вежливая пауза, чтобы FunPay не банил IP за флуд.
async function runSalesUpdateCycle() {
    if (_salesCycleRunning) {
        throw new Error("Обновление продаж уже выполняется.");
    }
    _salesCycleRunning = true;
    console.log("FunPay Funcy: Запуск полного цикла сбора статистики продаж...");
    try {
        await chrome.storage.local.set({ fpToolsSalesCollecting: true });
        // Однократно переносим старые данные из storage.local в IndexedDB
        // (и освобождаем квоту). Безопасно вызывать каждый раз — отработает один раз.
        await FPTSalesDB.migrateFromLocalStorage();

        const auth = await getAuthDetailsForBackground();
        if (!auth.golden_key) throw new Error("Не удалось получить golden_key для сбора статистики.");

        // Гарантируем свежую golden_seal ОДИН раз перед циклом: без неё FunPay отдаёт 428.
        try { await ensureGoldenSeal(); } catch (_) {}

        let firstOrderId = await FPTSalesDB.getMeta('firstOrderId');
        let lastOrderId = await FPTSalesDB.getMeta('lastOrderId');

        const fetchAndParseSales = async (continueToken = null) => {
            const url = 'https://funpay.com/orders/trade';
            const body = continueToken ? new URLSearchParams({ 'continue': continueToken }) : null;
            const options = {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: body
            };
            // 428-aware: если FunPay всё же вернул 428 (устаревшая seal) — обновляем её и повторяем.
            let response;
            for (let attempt = 0; attempt < 5; attempt++) {
                response = await fetch(url, options);
                if (response.status === 428) {
                    try { await refreshGoldenSealOnce(); } catch (_) {}
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                if (response.status === 429 || response.status >= 500) {
                    await new Promise(r => setTimeout(r, 1500 * (attempt + 1) + Math.random() * 500));
                    continue;
                }
                break;
            }
            if (!response || !response.ok) {
                throw new Error(`Ошибка сети: ${response ? response.status : 'нет ответа'}`);
            }
            const html = await response.text();
            const parsed = await parseHtmlViaOffscreen(html, 'parseSalesPage');
            if (parsed && parsed.error) {
                throw new Error(`Ошибка парсинга продаж: ${parsed.error}`);
            }
            if (!parsed || !Array.isArray(parsed.orders)) {
                throw new Error('Ошибка парсинга продаж: некорректный результат страницы');
            }
            return parsed;
        };

        // Курсоры можно сохранять инкрементально, но freshness меняется только
        // после полного успешного цикла.
        const commitCursorMeta = async (firstId, lastId) => {
            if (firstId !== undefined) await FPTSalesDB.setMeta('firstOrderId', firstId);
            if (lastId !== undefined) await FPTSalesDB.setMeta('lastOrderId', lastId);
        };

        // --- Догрузка НОВЫХ заказов сверху (инкрементально) ---
        if (firstOrderId) {
            let continueToken = null;
            let newOrdersFoundInCycle = true;
            while (newOrdersFoundInCycle) {
                const { nextOrderId, orders } = await fetchAndParseSales(continueToken);
                if (!orders || orders.length === 0) break;

                const knownOrderIndex = orders.findIndex(o => o.orderId === firstOrderId);
                const newOrders = (knownOrderIndex !== -1) ? orders.slice(0, knownOrderIndex) : orders;

                if (newOrders.length > 0) {
                    await FPTSalesDB.putOrders(newOrders);
                    firstOrderId = newOrders[0].orderId;
                    await commitCursorMeta(firstOrderId, undefined);
                    console.log(`FunPay Funcy: Добавлено ${newOrders.length} новых заказов сверху.`);
                } else {
                    newOrdersFoundInCycle = false;
                }

                if (knownOrderIndex !== -1 || !nextOrderId) break;
                continueToken = nextOrderId;
            }
        }

        // --- Догрузка СТАРЫХ заказов вниз / первичная инициализация ---
        let continueToken = lastOrderId;
        let _emptyPages = 0;
        const MAX_EMPTY_PAGES = 5;
        const _seenTokens = new Set();
        if (lastOrderId) _seenTokens.add(lastOrderId);

        if (!firstOrderId) {
            const { nextOrderId, orders } = await fetchAndParseSales(null);
            if (orders && orders.length > 0) {
                await FPTSalesDB.putOrders(orders);
                firstOrderId = orders[0].orderId;
                lastOrderId = orders[orders.length - 1].orderId;
                await commitCursorMeta(firstOrderId, lastOrderId);
                console.log(`FunPay Funcy: Инициализация статистики с ${orders.length} заказами.`);
                continueToken = nextOrderId;
            } else {
                continueToken = null;
            }
        }

        // Множество уже известных orderId грузим ОДИН раз в память (а не с диска
        // на каждой странице) — иначе на 65к заказов проверки тормозили бы.
        const _knownIds = new Set(Object.keys(await FPTSalesDB.getAllAsMap()));

        while (continueToken) {
            const { nextOrderId, orders } = await fetchAndParseSales(continueToken);
            if (!orders || orders.length === 0) {
                console.log("FunPay Funcy: Достигнут конец истории заказов.");
                break;
            }

            // Какие из заказов на странице — новые для базы.
            let newOrdersOnPageCount = 0;
            const toPut = [];
            for (const order of orders) {
                if (!_knownIds.has(order.orderId)) { toPut.push(order); _knownIds.add(order.orderId); newOrdersOnPageCount++; }
            }

            if (newOrdersOnPageCount > 0) {
                await FPTSalesDB.putOrders(toPut);
                lastOrderId = orders[orders.length - 1].orderId;
                await commitCursorMeta(undefined, lastOrderId);
                const total = await FPTSalesDB.count();
                console.log(`FunPay Funcy: Добавлено ${newOrdersOnPageCount} старых заказов. Всего: ${total}.`);
                _emptyPages = 0;
            } else {
                _emptyPages++;
                lastOrderId = orders[orders.length - 1].orderId;
                await commitCursorMeta(undefined, lastOrderId);
                console.log(`FunPay Funcy: Страница без новых заказов (${_emptyPages}/${MAX_EMPTY_PAGES}).`);
                if (_emptyPages >= MAX_EMPTY_PAGES) {
                    console.log("FunPay Funcy: Несколько страниц подряд без новых заказов - остановка.");
                    break;
                }
            }

            if (!nextOrderId || nextOrderId === continueToken || _seenTokens.has(nextOrderId)) {
                console.log("FunPay Funcy: continue-токен не меняется/повторяется - конец пагинации.");
                break;
            }
            _seenTokens.add(nextOrderId);
            if (_seenTokens.size > 5000) _seenTokens.clear();

            continueToken = nextOrderId;
        }

        const count = await FPTSalesDB.count();
        const updatedAt = Date.now();
        await FPTSalesDB.setMeta('lastUpdate', updatedAt);
        await chrome.storage.local.set({ fpToolsSalesLastUpdate: updatedAt });

        console.log(`FunPay Funcy: Сбор статистики продаж завершен, заказов: ${count}.`);
        return { updatedAt, count };
    } catch (e) {
        console.error(`FunPay Funcy: Ошибка в цикле сбора статистики продаж: ${e.message}`);
        throw e;
    } finally {
        _salesCycleRunning = false;
        try {
            await chrome.storage.local.set({ fpToolsSalesCollecting: false });
        } catch (cleanupError) {
            console.error(`FunPay Funcy: Не удалось сбросить флаг сбора продаж: ${cleanupError.message}`);
        }
    }
}

async function runFinanceUpdateCycle() {
    if (_financeCycleRunning) {
        throw new Error("Обновление финансов уже выполняется.");
    }
    _financeCycleRunning = true;
    console.log("FunPay Funcy: Запуск сбора статистики финансов...");
    try {
        await chrome.storage.local.set({ fpToolsFinanceCollecting: true });
        const auth = await getAuthDetailsForBackground();
        if (!auth.golden_key) throw new Error("Не удалось получить golden_key для сбора финансов.");
        const userId = auth.userId;
        try { await ensureGoldenSeal(); } catch (_) {}

        const fetchPage = async (continueToken) => {
            const url = 'https://funpay.com/users/transactions';
            const params = new URLSearchParams();
            if (userId) params.set('user_id', String(userId));
            params.set('filter', ''); // все операции
            if (continueToken) params.set('continue', continueToken);
            const options = {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: params
            };
            let response;
            for (let attempt = 0; attempt < 5; attempt++) {
                response = await fetch(url, options);
                if (response.status === 428) {
                    try { await refreshGoldenSealOnce(); } catch (_) {}
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                if (response.status === 429 || response.status >= 500) {
                    await new Promise(r => setTimeout(r, 1500 * (attempt + 1) + Math.random() * 500));
                    continue;
                }
                break;
            }
            if (!response || !response.ok) {
                throw new Error(`Ошибка сети (финансы): ${response ? response.status : 'нет ответа'}`);
            }
            const html = await response.text();
            return await parseHtmlViaOffscreen(html, 'parseFinancePage');
        };

        // T01: сначала полностью собираем и валидируем историю в памяти.
        // IndexedDB и зеркала в chrome.storage не трогаем до полного успеха.
        let continueToken = null;
        const collectedById = new Map();
        const seenTokens = new Set();
        let lastFirstId = null;
        let collectionComplete = false;
        const MAX_PAGES = 600;

        for (let page = 0; page < MAX_PAGES; page++) {
            if (continueToken && seenTokens.has(String(continueToken))) {
                console.warn('FunPay Funcy: финансовая пагинация вернула ранее использованный continue-токен; считаем историю завершённой.');
                collectionComplete = true;
                break;
            }
            if (continueToken) seenTokens.add(String(continueToken));

            const parsed = await fetchPage(continueToken);
            if (parsed && parsed.error) {
                throw new Error(`Ошибка парсинга финансов: ${parsed.error}`);
            }
            if (!parsed || !Array.isArray(parsed.txns)) {
                throw new Error('Ошибка парсинга финансов: некорректный результат страницы');
            }

            const txns = parsed.txns;
            const nextId = parsed.nextId == null || String(parsed.nextId).trim() === ''
                ? null
                : parsed.nextId;

            if (txns.length === 0) {
                collectionComplete = true;
                break;
            }

            let newOnPage = 0;
            for (const txn of txns) {
                if (!txn || txn.id == null || String(txn.id).trim() === '') {
                    throw new Error('Ошибка парсинга финансов: операция без id');
                }
                const idKey = String(txn.id);
                if (!collectedById.has(idKey)) {
                    collectedById.set(idKey, txn);
                    newOnPage++;
                }
            }

            const firstId = String(txns[0].id);

            const dts = txns.map(t => t.date).filter(Boolean);
            if (dts.length) {
                const newest = new Date(Math.max(...dts)).toISOString().slice(0, 10);
                const oldest = new Date(Math.min(...dts)).toISOString().slice(0, 10);
                console.log(`FunPay Funcy: финансы стр.${page + 1} — ${txns.length} операц. (новых ${newOnPage}), ${newest}…${oldest}, собрано уникальных ${collectedById.size}`);
            }

            // Пустой continue — штатный конец истории. FunPay может вернуть на
            // последней странице только уже встречавшиеся операции из-за
            // перекрывающейся cursor-пагинации, поэтому это не ошибка.
            if (!nextId) {
                collectionComplete = true;
                break;
            }

            // FunPay может вернуть текущий или ранее использованный cursor после
            // перекрывающейся страницы. Данные уже собраны и дедуплицированы,
            // поэтому завершаем цикл без повторного запроса и сохраняем результат.
            if (String(nextId) === String(continueToken) || seenTokens.has(String(nextId))) {
                console.warn('FunPay Funcy: финансовая пагинация вернула повторный continue-токен; считаем историю завершённой.');
                collectionComplete = true;
                break;
            }

            // Страница без новых уникальных операций допустима, если FunPay выдал
            // новый continue-токен: продолжаем идти по курсору, а не объявляем
            // частичное обновление.
            if (page > 0 && newOnPage === 0) {
                console.warn('FunPay Funcy: финансы — страница содержит только уже известные операции; continue-токен изменился, продолжаем пагинацию.');
            }

            // Одинаковый firstId сам по себе не означает цикл: страницы FunPay
            // могут перекрываться. За цикл отвечают seenTokens / неизменившийся token.
            lastFirstId = firstId;
            continueToken = nextId;
        }

        if (!collectionComplete) {
            throw new Error(`Ошибка пагинации финансов: превышен лимит ${MAX_PAGES} страниц`);
        }

        const collected = Array.from(collectedById.values());
        const now = Date.now();

        // Единственная точка мутации durable-хранилища. clear + put + metadata
        // выполняются одной IndexedDB-транзакцией и откатываются целиком при ошибке.
        await FPTFinanceDB.replaceAll(collected, { lastUpdate: now });

        // Зеркала UI меняем только после успешного durable commit.
        await chrome.storage.local.set({
            fpToolsFinanceCount: collected.length,
            fpToolsFinanceLastUpdate: now
        });

        console.log(`FunPay Funcy: Финансы собраны, операций: ${collected.length}.`);
        return { updatedAt: now, count: collected.length };
    } catch (e) {
        console.error(`FunPay Funcy: Ошибка в цикле сбора финансов: ${e.message}`);
        throw e;
    } finally {
        _financeCycleRunning = false;
        try {
            await chrome.storage.local.set({ fpToolsFinanceCollecting: false });
        } catch (cleanupError) {
            console.error(`FunPay Funcy: Не удалось сбросить флаг сбора финансов: ${cleanupError.message}`);
        }
    }
}

async function runPurchasesUpdateCycle() {
    if (_purchasesCycleRunning) {
        throw new Error("Обновление покупок уже выполняется.");
    }
    _purchasesCycleRunning = true;
    console.log("FunPay Funcy: Запуск полного цикла сбора статистики покупок...");
    try {
        await chrome.storage.local.set({ fpToolsPurchasesCollecting: true });
        // Однократно переносим старые данные из storage.local в IndexedDB
        // (и освобождаем квоту). Безопасно вызывать каждый раз — отработает один раз.
        await FPTPurchasesDB.migrateFromLocalStorage();

        const auth = await getAuthDetailsForBackground();
        if (!auth.golden_key) throw new Error("Не удалось получить golden_key для сбора статистики.");

        try { await ensureGoldenSeal(); } catch (_) {}

        let firstOrderId = await FPTPurchasesDB.getMeta('firstOrderId');
        let lastOrderId = await FPTPurchasesDB.getMeta('lastOrderId');

        const fetchAndParseSales = async (continueToken = null) => {
            const url = 'https://funpay.com/orders/';
            const body = continueToken ? new URLSearchParams({ 'continue': continueToken }) : null;
            const options = {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: body
            };
            let response;
            for (let attempt = 0; attempt < 5; attempt++) {
                response = await fetch(url, options);
                if (response.status === 428) {
                    try { await refreshGoldenSealOnce(); } catch (_) {}
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                if (response.status === 429 || response.status >= 500) {
                    await new Promise(r => setTimeout(r, 1500 * (attempt + 1) + Math.random() * 500));
                    continue;
                }
                break;
            }
            if (!response || !response.ok) {
                throw new Error(`Ошибка сети: ${response ? response.status : 'нет ответа'}`);
            }
            const html = await response.text();
            const parsed = await parseHtmlViaOffscreen(html, 'parseSalesPage');
            if (parsed && parsed.error) {
                throw new Error(`Ошибка парсинга покупок: ${parsed.error}`);
            }
            if (!parsed || !Array.isArray(parsed.orders)) {
                throw new Error('Ошибка парсинга покупок: некорректный результат страницы');
            }
            return parsed;
        };

        // Курсоры можно сохранять инкрементально, но freshness меняется только
        // после полного успешного цикла.
        const commitCursorMeta = async (firstId, lastId) => {
            if (firstId !== undefined) await FPTPurchasesDB.setMeta('firstOrderId', firstId);
            if (lastId !== undefined) await FPTPurchasesDB.setMeta('lastOrderId', lastId);
        };

        // --- Догрузка НОВЫХ покупок сверху (инкрементально) ---
        if (firstOrderId) {
            let continueToken = null;
            let newOrdersFoundInCycle = true;
            while (newOrdersFoundInCycle) {
                const { nextOrderId, orders } = await fetchAndParseSales(continueToken);
                if (!orders || orders.length === 0) break;

                const knownOrderIndex = orders.findIndex(o => o.orderId === firstOrderId);
                const newOrders = (knownOrderIndex !== -1) ? orders.slice(0, knownOrderIndex) : orders;

                if (newOrders.length > 0) {
                    await FPTPurchasesDB.putOrders(newOrders);
                    firstOrderId = newOrders[0].orderId;
                    await commitCursorMeta(firstOrderId, undefined);
                    console.log(`FunPay Funcy: Добавлено ${newOrders.length} новых покупок сверху.`);
                } else {
                    newOrdersFoundInCycle = false;
                }

                if (knownOrderIndex !== -1 || !nextOrderId) break;
                continueToken = nextOrderId;
            }
        }

        // --- Догрузка СТАРЫХ заказов вниз / первичная инициализация ---
        let continueToken = lastOrderId;
        let _emptyPages = 0;
        const MAX_EMPTY_PAGES = 5;
        const _seenTokens = new Set();
        if (lastOrderId) _seenTokens.add(lastOrderId);

        if (!firstOrderId) {
            const { nextOrderId, orders } = await fetchAndParseSales(null);
            if (orders && orders.length > 0) {
                await FPTPurchasesDB.putOrders(orders);
                firstOrderId = orders[0].orderId;
                lastOrderId = orders[orders.length - 1].orderId;
                await commitCursorMeta(firstOrderId, lastOrderId);
                console.log(`FunPay Funcy: Инициализация статистики с ${orders.length} заказами.`);
                continueToken = nextOrderId;
            } else {
                continueToken = null;
            }
        }

        // Множество уже известных orderId грузим ОДИН раз в память (а не с диска
        // на каждой странице) — иначе на 65к заказов проверки тормозили бы.
        const _knownIds = new Set(Object.keys(await FPTPurchasesDB.getAllAsMap()));

        while (continueToken) {
            const { nextOrderId, orders } = await fetchAndParseSales(continueToken);
            if (!orders || orders.length === 0) {
                console.log("FunPay Funcy: Достигнут конец истории заказов.");
                break;
            }

            // Какие из заказов на странице — новые для базы.
            let newOrdersOnPageCount = 0;
            const toPut = [];
            for (const order of orders) {
                if (!_knownIds.has(order.orderId)) { toPut.push(order); _knownIds.add(order.orderId); newOrdersOnPageCount++; }
            }

            if (newOrdersOnPageCount > 0) {
                await FPTPurchasesDB.putOrders(toPut);
                lastOrderId = orders[orders.length - 1].orderId;
                await commitCursorMeta(undefined, lastOrderId);
                const total = await FPTPurchasesDB.count();
                console.log(`FunPay Funcy: Добавлено ${newOrdersOnPageCount} старых покупок. Всего: ${total}.`);
                _emptyPages = 0;
            } else {
                _emptyPages++;
                lastOrderId = orders[orders.length - 1].orderId;
                await commitCursorMeta(undefined, lastOrderId);
                console.log(`FunPay Funcy: Страница без новых покупок (${_emptyPages}/${MAX_EMPTY_PAGES}).`);
                if (_emptyPages >= MAX_EMPTY_PAGES) {
                    console.log("FunPay Funcy: Несколько страниц подряд без новых покупок - остановка.");
                    break;
                }
            }

            if (!nextOrderId || nextOrderId === continueToken || _seenTokens.has(nextOrderId)) {
                console.log("FunPay Funcy: continue-токен не меняется/повторяется - конец пагинации.");
                break;
            }
            _seenTokens.add(nextOrderId);
            if (_seenTokens.size > 5000) _seenTokens.clear();

            continueToken = nextOrderId;
        }

        const count = await FPTPurchasesDB.count();
        const updatedAt = Date.now();
        await FPTPurchasesDB.setMeta('lastUpdate', updatedAt);
        await chrome.storage.local.set({ fpToolsPurchasesLastUpdate: updatedAt });

        console.log(`FunPay Funcy: Сбор статистики покупок завершен, покупок: ${count}.`);
        return { updatedAt, count };
    } catch (e) {
        console.error(`FunPay Funcy: Ошибка в цикле сбора статистики покупок: ${e.message}`);
        throw e;
    } finally {
        _purchasesCycleRunning = false;
        try {
            await chrome.storage.local.set({ fpToolsPurchasesCollecting: false });
        } catch (cleanupError) {
            console.error(`FunPay Funcy: Не удалось сбросить флаг сбора покупок: ${cleanupError.message}`);
        }
    }
}



// --- НИЖЕ ИДЕТ ОСТАЛЬНОЙ КОД ФАЙЛА, ОН ОСТАЕТСЯ БЕЗ ИЗМЕНЕНИЙ ---

// --- НАДЁЖНАЯ ФУНКЦИЯ АУТЕНТИФИКАЦИИ ---
// 3.0: Upload an image to FunPay and send it to a chat via the runner - all in background.
// Ported from FunPay Funcy (Account.upload_image + Account.send_image).
async function fetchFreshCsrf() {
    const response = await fetch('https://funpay.com/', { credentials: 'include' });
    if (!response.ok) throw new Error(`csrf fetch: HTTP ${response.status}`);
    const text = await response.text();
    const m = text.match(/<body[^>]*data-app-data="([^"]+)"/);
    if (!m) throw new Error('csrf: data-app-data not found');
    const appData = JSON.parse(m[1].replace(/&quot;/g, '"'));
    const u = Array.isArray(appData) ? appData[0] : appData;
    if (!u || !u['csrf-token']) throw new Error('csrf: token missing');
    return { csrf_token: u['csrf-token'], userId: u.userId, username: u.userName };
}

const GOLDEN_SEAL_ERROR = 'Сессия FunPay устарела (golden_seal). Обновите страницу funpay.com или перезайдите в аккаунт и повторите.';

async function checkGoldenSeal() {
    const seal = await chrome.cookies.get({ url: 'https://funpay.com', name: 'golden_seal' });
    if (!seal || !seal.value) return { present: false };
    const parts = seal.value.split('.');
    const exp = parts.length >= 4 ? parseInt(parts[3], 10) : 0;
    const valid = exp > Math.floor(Date.now() / 1000);
    return { present: true, expiresAt: exp, valid, value: seal.value };
}

let _sealRefreshInFlight = null;
async function refreshGoldenSealOnce() {
    if (_sealRefreshInFlight) return _sealRefreshInFlight;
    _sealRefreshInFlight = (async () => {
        try {
            await fetch('https://funpay.com/', { credentials: 'include', cache: 'no-store' });
        } catch (e) {
            console.warn('FunPay Funcy: не удалось обновить golden_seal фоновым запросом:', e && e.message);
        } finally {
            await new Promise(r => setTimeout(r, 150));
        }
    })();
    try { await _sealRefreshInFlight; }
    finally { _sealRefreshInFlight = null; }
}

async function ensureGoldenSeal() {
    let seal = await checkGoldenSeal();
    if (!seal.present || !seal.valid) {
        await refreshGoldenSealOnce();
        seal = await checkGoldenSeal();
    }
    return seal;
}

async function fptFetchWithSeal(url, options = {}) {
    const seal = await ensureGoldenSeal();

    const opts = { ...options, credentials: 'include' };
    if (opts.headers) {
        const h = { ...opts.headers };
        for (const k of Object.keys(h)) {
            if (k.toLowerCase() === 'cookie') delete h[k];
        }
        opts.headers = h;
    }

    let response = await fetch(url, opts);

    if (!response.ok && !seal.valid) {
        await refreshGoldenSealOnce();
        response = await fetch(url, opts);
    }

    return { response, seal };
}

async function sendChatImageInBackground(chatId, dataUrl, chatName) {
    const blob = await (await fetch(dataUrl)).blob();

    await ensureOffscreenDocument();

    async function attempt(force) {
        const auth = await getAuthDetailsForBackground(force);
        if (!auth.golden_key || !auth.csrf_token) {
            throw new Error('Нет авторизации для отправки изображения.');
        }

        // golden_seal (если она есть) браузер приложит сам через credentials:'include'.
        // Никаких блокирующих проверок/до-запросов ПЕРЕД загрузкой не делаем — это и
        // ломало отправку. При повторе (force) один раз best-effort обновим seal ниже.
        if (force) {
            try { await refreshGoldenSealOnce(); } catch (_) {}
        }

        const fd = new FormData();
        fd.append('file', new File([blob], 'image.png', { type: blob.type || 'image/png' }));
        fd.append('file_id', '0');
        // ВАЖНО: без keepalive. keepalive:true отклоняет запросы с телом > 64 КБ,
        // а картинка всегда больше — из-за этого загрузка падала с "Failed to fetch".
        const upRes = await fetchWithTimeout('https://funpay.com/file/addChatImage', {
            method: 'POST',
            credentials: 'include',
            headers: { 'x-requested-with': 'XMLHttpRequest' },
            body: fd
        }, 25000);
        if (upRes.status === 400) return { retry: true, where: 'upload' };
        if (!upRes.ok) throw new Error(`Загрузка изображения: HTTP ${upRes.status}`);
        const upJson = await upRes.json().catch(() => ({}));
        const fileId = upJson.fileId;
        if (!fileId) throw new Error('FunPay не вернул fileId: ' + (upJson.msg || 'неизвестная ошибка'));

        const request = { action: 'chat_message', data: { node: chatId, last_message: -1, content: '', image_id: fileId } };
        const payload = {
            objects: JSON.stringify([{ type: 'chat_node', id: chatId, tag: '00000000', data: { node: chatId, last_message: -1, content: '' } }]),
            request: JSON.stringify(request),
            csrf_token: auth.csrf_token
        };
        const sendRes = await fetchWithTimeout('https://funpay.com/runner/', {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest' },
            body: new URLSearchParams(payload)
        }, 25000);
        if (sendRes.status === 400) return { retry: true, where: 'runner' };
        if (!sendRes.ok) throw new Error(`Отправка изображения: HTTP ${sendRes.status}`);
        const sendJson = await sendRes.json().catch(() => null);
        const errMsg = sendJson?.error || sendJson?.response?.error;
        if (errMsg) {
            if (/csrf|обнов|refresh/i.test(String(errMsg))) return { retry: true, where: 'runner-err' };
            throw new Error(`FunPay runner: ${errMsg}`);
        }
        return { ok: true, fileId };
    }

    async function attemptSafe(force) {
        try {
            return await attempt(force);
        } catch (e) {
            const msg = String(e && e.message || e);
            if (e && (e.name === 'AbortError' || /aborted|timed out|Failed to fetch|network/i.test(msg))) {
                return { retry: true, where: 'network', networkErr: msg };
            }
            throw e;
        }
    }

    let res = await attemptSafe(false);
    if (res && res.retry) {
        console.warn(`FunPay Funcy: повтор загрузки (причина: "${res.where}"${res.networkErr ? ' / ' + res.networkErr : ''}).`);
        await ensureOffscreenDocument();
        res = await attemptSafe(true);
        if (res && res.retry) {
            throw new Error(res.where === 'network'
                ? 'Не удалось отправить изображение: сеть или сессия FunPay. Обновите страницу и попробуйте снова.'
                : 'FunPay вернул 400 даже после обновления csrf.');
        }
    }
    return { fileId: res.fileId };
}

async function getAuthDetailsForBackground(force) {
    const goldenKeyCookie = await chrome.cookies.get({ url: 'https://funpay.com', name: 'golden_key' });
    if (!goldenKeyCookie || !goldenKeyCookie.value) {
        console.error("FunPay Funcy: golden_key не найден.");
        return {};
    }
    const golden_key = goldenKeyCookie.value;
    const phpSessIdCookie = await chrome.cookies.get({ url: 'https://funpay.com', name: 'PHPSESSID' });
    const phpsessid = phpSessIdCookie?.value || '';

    if (!force) {
        const tabs = await chrome.tabs.query({ url: "https://funpay.com/*" });
        for (const tab of tabs) {
            try {
                if (tab.discarded) continue;
                const response = await chrome.tabs.sendMessage(tab.id, { action: "getAppData" });
                if (response && response.success) {
                    const appData = Array.isArray(response.data) ? response.data[0] : response.data;
                    if (appData && appData['csrf-token'] && appData.userId) {
                        return {
                            golden_key: golden_key,
                            phpsessid: phpsessid,
                            csrf_token: appData['csrf-token'],
                            userId: appData.userId,
                            username: appData.userName,
                        };
                    }
                }
            } catch (e) {
                console.warn(`FunPay Funcy: appData из вкладки ${tab.id} недоступна.`);
            }
        }
    }

    try {
        const fresh = await fetchFreshCsrf();
        return { golden_key, phpsessid, ...fresh };
    } catch (e) {
        console.error("FunPay Funcy: свежий csrf недоступен.", e.message);
        return { golden_key, phpsessid };
    }
}

// Функция для парсинга HTML через offscreen документ
async function parseHtmlViaOffscreen(html, action, extra = {}) {
    await ensureOffscreenDocument();

    return await chrome.runtime.sendMessage({
        target: 'offscreen',
        action: action,
        html: html,
        ...extra
    });
}

async function readAutoDeliveryLotForm(lot) {
    const offerId = String(lot?.id || '');
    const nodeId = String(lot?.nodeId || '');
    if (!/^\d+$/.test(offerId) || !/^\d+$/.test(nodeId)) throw new Error('Некорректные данные лота.');

    const params = new URLSearchParams({ node: nodeId, offer: offerId });
    const { response, seal } = await fptFetchWithSeal(`https://funpay.com/lots/offerEdit?${params}`, {});
    if (!response.ok) {
        if (seal.present && !seal.valid) throw new Error(GOLDEN_SEAL_ERROR);
        throw new Error(`Ошибка загрузки лота: ${response.status}`);
    }
    const html = await response.text();
    if (/account\/login|name="login"/i.test(html) && !/form-offer-editor/i.test(html)) {
        throw new Error(GOLDEN_SEAL_ERROR);
    }
    const data = await parseHtmlViaOffscreen(html, 'parseLotEditPage');
    if (!data) throw new Error('Не удалось разобрать форму лота.');
    return data;
}

configureAutoDeliveryStore(chrome.storage.local, readAutoDeliveryLotForm);

// Сохранение формы лота через lots/offerSave. Бросает ошибку с текстом FunPay,
// если лот не сохранён.
async function postOfferSave(payload, csrfToken) {
    const token = csrfToken || (await getAuthDetailsForBackground()).csrf_token;
    if (!token) throw new Error('Нет CSRF токена');
    const formData = new URLSearchParams(payload);
    formData.set('csrf_token', token);

    const { response, seal } = await fptFetchWithSeal('https://funpay.com/lots/offerSave', {
        method: 'POST',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: formData
    });

    if (!response.ok) {
        if (seal.present && !seal.valid) throw new Error(GOLDEN_SEAL_ERROR);
        throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();

    // FunPay returns { error: 0 } on success, or { error: 1, errors: {...} }
    // / { msg: "..." } on failure. The old check treated any non-true error as
    // success in some cases; now we explicitly require error to be falsy AND
    // surface field-level errors so the bulk editor can show why nothing changed.
    const hasError = result && (result.error === 1 || result.error === true ||
        (result.errors && (Array.isArray(result.errors) ? result.errors.length : Object.keys(result.errors).length)));

    if (result && !hasError && (result.error === 0 || result.error === false || result.error === undefined)) {
        return result;
    }
    let msg = result?.msg || 'Неизвестная ошибка API';
    if (result?.errors) {
        const parts = Array.isArray(result.errors)
            ? result.errors.map(e => Array.isArray(e) ? e[1] : e)
            : Object.values(result.errors);
        if (parts.length) msg = parts.join('; ');
    }
    throw new Error(msg);
}

// ─── Этап 0: журнал операций, фоновое изменение лотов, задания ─────────────────
const ORDER_RECONCILE_ALARM = 'fpToolsOrderReconcile';
const ORDER_RECONCILE_PERIOD_MIN = 5;
const OPS_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

let opsJournal = null;
try {
    opsJournal = createOpsJournal({ backend: createIndexedDbBackend(self.indexedDB) });
} catch (error) {
    console.error('FunPay Funcy: журнал операций недоступен:', error);
}

// Текущий аккаунт и эпоха сессии. Ключ golden_key сравнивается по хэшу; при его
// смене аккаунт определяется заново свежим запросом.
async function readSessionForGuard() {
    const cookie = await chrome.cookies.get({ url: 'https://funpay.com', name: 'golden_key' });
    if (!cookie?.value) return {};
    const { [ACCOUNT_EPOCH_KEY]: record } = await chrome.storage.local.get(ACCOUNT_EPOCH_KEY);
    if (record?.accountId && record.keyHash === await sha256Short(cookie.value)) {
        return { goldenKey: cookie.value, userId: record.accountId, username: record.username };
    }
    const auth = await getAuthDetailsForBackground(true);
    return { goldenKey: cookie.value, userId: auth.userId, username: auth.username };
}

const accountGuard = createAccountGuard({ storage: chrome.storage.local, readSession: readSessionForGuard });

async function fetchOrderFactsForBackground(orderId) {
    const { response } = await fptFetchWithSeal(`https://funpay.com/orders/${orderId}/`, {});
    if (!response.ok) return null;
    return parseHtmlViaOffscreen(await response.text(), 'parseOrderFacts');
}

const orderLoader = createOrderDetailsLoader({
    fetchOrderFacts: fetchOrderFactsForBackground,
    listOwnLots: () => listOwnLotsForBackground()
});

accountGuard.onChange(() => orderLoader.invalidate());
chrome.cookies.onChanged.addListener(({ cookie }) => {
    if (cookie?.name !== 'golden_key' || !/funpay\.com$/.test(cookie.domain || '')) return;
    accountGuard.invalidate();
    orderLoader.invalidate();
});

async function fetchSalesPageForReconcile(continueToken) {
    const options = { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } };
    if (continueToken) options.body = new URLSearchParams({ continue: continueToken });
    const response = await fptFetchResilient('https://funpay.com/orders/trade', options, { retries: 2, baseDelay: 800 });
    if (!response.ok) throw new Error(`Сверка заказов: HTTP ${response.status}`);
    const parsed = await parseHtmlViaOffscreen(await response.text(), 'parseSalesPage');
    if (!parsed || parsed.error || !Array.isArray(parsed.orders)) throw new Error(`Сверка заказов: ${parsed?.error || 'страница продаж не разобрана'}`);
    return parsed;
}

let fulfillmentDispatcher = null;
let reviewReminders = null;
let orderReconcile = null;
if (opsJournal) {
    fulfillmentDispatcher = createFulfillmentDispatcher({
        journal: opsJournal,
        guard: accountGuard,
        loadFacts: (orderId, scope) => orderLoader.load(orderId, scope),
        sender: getStrictChatSender(),
        getAuth: () => getAuthDetailsForBackground(),
        getAutoReplies: async () => (await chrome.storage.local.get('fpToolsAutoReplies')).fpToolsAutoReplies || {},
        getDeliveryConfigs: async () => (await chrome.storage.local.get('fpToolsAutoDeliveryLots')).fpToolsAutoDeliveryLots || {},
        isLotEnabled: isAutoDeliveryLotEnabled,
        isBlacklisted,
        render: applyVariables,
        onDelivered: async ({ offerId, nodeId, source }) => {
            if (source === 'funpay_secrets' && offerId && nodeId) await refreshAutoDeliveryLotStock(offerId, nodeId);
        },
        // Каждое чтение заказа обновляет задачу напоминания (планирует или отменяет).
        onObserved: async ({ order }) => { if (reviewReminders) await reviewReminders.observeOrder({ order }); }
    });
    orderReconcile = createOrderReconcile({
        journal: opsJournal,
        guard: accountGuard,
        fetchSalesPage: fetchSalesPageForReconcile,
        dispatcher: fulfillmentDispatcher
    });
}

let orderCommands = null;
if (opsJournal && fulfillmentDispatcher) {
    orderCommands = createOrderCommands({ journal: opsJournal, guard: accountGuard, dispatcher: fulfillmentDispatcher });
}

configureOrderAutomation({
    dispatcher: fulfillmentDispatcher,
    reconcile: orderReconcile,
    roleOf: async orderId => {
        const account = await accountGuard.current();
        if (!account.accountId) return 'unknown';
        const facts = await orderLoader.load(orderId, { accountId: account.accountId, epoch: account.epoch });
        return orderRole(facts, account.accountId);
    }
});

const lotWriter = createLotWriter({
    readForm: readAutoDeliveryLotForm,
    saveForm: payload => postOfferSave(payload)
});

// Удаление существующего лота: один POST deleted=1 с проверкой ответа FunPay.
async function deleteOfferOnFunPay(offerId) {
    const auth = await getAuthDetailsForBackground();
    if (!auth.csrf_token) throw new Error('Нет CSRF-токена.');
    const body = new URLSearchParams({ offer_id: String(offerId), deleted: '1', csrf_token: auth.csrf_token });
    const { response, seal } = await fptFetchWithSeal('https://funpay.com/lots/offerSave', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body
    });
    if (!response.ok) {
        if (seal.present && !seal.valid) throw new Error(GOLDEN_SEAL_ERROR);
        throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json().catch(() => null);
    if (result && (result.error === 1 || result.error === true || typeof result.error === 'string')) {
        throw new Error(result.msg || (typeof result.error === 'string' ? result.error : 'FunPay не удалил лот.'));
    }
}

// Все изменения существующих лотов (UI, массовый редактор, автоматизация) идут
// через одну очередь по аккаунту и лоту со свежей формой внутри очереди.
const lotWriteQueue = createLotWriteQueue({
    writer: lotWriter,
    deleteOffer: deleteOfferOnFunPay,
    guard: accountGuard,
    storage: chrome.storage.local
});

function lotWriteStatusMessage(result) {
    if (result?.status === 'conflict') {
        return `Лот изменился на FunPay после загрузки (${result.conflicts.map(c => c.field).join(', ')}). Обновите данные и повторите.`;
    }
    if (result?.status === 'unverified') return `FunPay не применил изменения: ${result.notApplied.join(', ')}.`;
    if (result?.status === 'deleted') return 'Лот уже удалён — изменения не применены.';
    if (result?.status === 'skipped') return 'Изменение не требуется.';
    return 'Лот не сохранён.';
}

// Отличия formData от исходной формы — только их и применяем.
function intendedLotFields(data, original) {
    const fields = {};
    const expect = {};
    for (const [field, value] of Object.entries(data || {})) {
        if (['offer_id', 'node_id', 'csrf_token', 'location', 'deleted'].includes(field)) continue;
        const before = original ? original[field] : undefined;
        if (original && String(before ?? '') === String(value ?? '')) continue;
        fields[field] = value;
        if (original && field !== 'active') expect[field] = before ?? '';
    }
    if (original && Object.hasOwn(original, 'active') !== Object.hasOwn(data || {}, 'active')) {
        fields.active = Object.hasOwn(data || {}, 'active') ? data.active : '';
        expect.active = Boolean(original.active && original.active !== '0');
    }
    return { fields, expect };
}

async function listOwnLotsForBackground() {
    const auth = await getAuthDetailsForBackground();
    if (!auth.userId) return [];
    const { response } = await fptFetchWithSeal(`https://funpay.com/users/${auth.userId}/`, {});
    if (!response.ok) return [];
    const lots = await parseHtmlViaOffscreen(await response.text(), 'parseUserLotsList');
    return Array.isArray(lots) ? lots : [];
}

const lotPolicies = createLotPolicyStore({ storage: chrome.storage.local });
const lotActivity = createLotActivityService({ queue: lotWriteQueue, policies: lotPolicies });

const jobScheduler = createJobScheduler({ alarms: chrome.alarms, storage: chrome.storage.local });

const lotSchedules = createLotScheduleService({
    storage: chrome.storage.local,
    guard: accountGuard,
    policies: lotPolicies,
    activity: lotActivity,
    scheduler: jobScheduler
});
jobScheduler.register(LOT_SCHEDULES_ALARM, () => lotSchedules.evaluate());

if (opsJournal) {
    reviewReminders = createReviewReminders({
        journal: opsJournal,
        guard: accountGuard,
        loadFacts: (orderId, scope) => orderLoader.load(orderId, scope),
        sender: getStrictChatSender(),
        getAuth: () => getAuthDetailsForBackground(),
        getSettings: async () => (await chrome.storage.local.get('fpToolsAutoReplies')).fpToolsAutoReplies || {},
        isBlacklisted,
        fetchSalesPage: fetchSalesPageForReconcile,
        scheduler: jobScheduler
    });
    jobScheduler.register(REMINDER_ALARM, () => reviewReminders.run());
    jobScheduler.registerRecovery('reminders', () => reviewReminders.recover());
}

const pricingService = createPricingService({
    storage: chrome.storage.local,
    guard: accountGuard,
    readForm: readAutoDeliveryLotForm,
    queue: lotWriteQueue,
    policies: lotPolicies,
    activity: lotActivity,
    scheduler: jobScheduler
});
jobScheduler.register(PRICING_ALARM, () => pricingService.runAuto());
releaseStockManagedLots({ storage: chrome.storage.local, policies: lotPolicies, bindingKeys: [LOT_SCHEDULES_KEY, PRICING_KEY] })
    .catch(error => console.warn('FunPay Funcy: пометки управления складом не сняты:', error?.message || error));
jobScheduler.register(ORDER_RECONCILE_ALARM, () => runOrderReconcile());
if (opsJournal) {
    jobScheduler.registerRecovery('ops', () => opsJournal.recoverInterruptedOps());
}

function syncOrderReconcileAlarm(enabled) {
    const sync = enabled && opsJournal
        ? jobScheduler.ensurePeriodic(ORDER_RECONCILE_ALARM, ORDER_RECONCILE_PERIOD_MIN, { delayInMinutes: 1 })
        : jobScheduler.clear(ORDER_RECONCILE_ALARM);
    Promise.resolve(sync).catch(error => console.warn('FunPay Funcy: alarm сверки заказов не настроен:', error?.message || error));
}

async function ensureOffscreenDocument() {
    try {
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
        });
        if (existingContexts.length) return true;
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: ['DOM_PARSER'],
            justification: 'Keepalive + parsing FunPay page HTML',
        });
        return true;
    } catch (e) {
        if (String(e && e.message || '').includes('Only a single offscreen')) return true;
        console.warn('FunPay Funcy: не удалось создать offscreen-документ:', e && e.message);
        return false;
    }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function cloneBuildFieldsInternal(auth, nodeId, attributes, attributePairs) {
    if (!nodeId) throw new Error('Неизвестна подкатегория (node) лота.');
    
    const editUrl = `https://funpay.com/lots/offerEdit?node=${nodeId}&setlocale=en`;
    const { response: resp, seal } = await fptFetchWithSeal(editUrl, {});
    if (!resp.ok) {
        if (seal.present && !seal.valid) throw new Error(GOLDEN_SEAL_ERROR);
        throw new Error(`Не удалось открыть форму категории: ${resp.status}`);
    }
    const html = await resp.text();
    if (/account\/login|name="login"/i.test(html) && !/form-offer-editor/i.test(html)) {
        throw new Error(GOLDEN_SEAL_ERROR);
    }
    
    // ВОЗВРАЩАЕМ русский язык вашему аккаунту
    await fetch(`https://funpay.com/?setlocale=ru`, { credentials: 'include' });
    
    const fields = await parseHtmlViaOffscreen(html, 'solveCloneForm', { attributes: attributes || [], attributePairs: attributePairs || [] });
    if (!fields) throw new Error('Не удалось разобрать форму категории.');
    fields.node_id = String(nodeId);
    fields.offer_id = '0';
    return fields;
}

// 3.0: «чистая» цена продавца с учётом комиссии - повторяет Account.calc()+commission_coefficient.
// calc(price=100) возвращает методы оплаты с ценой ПОКУПАТЕЛЯ в разных валютах. Коэффициент =
// (минимальная цена покупателя в нужной валюте) / 100. Чистая цена = желаемая цена / коэффициент.
// Валюта берётся из списка лотов продавца (rub/usd/eur), как в get_coefficient(account_currency).
async function cloneCalcNetPrice(auth, nodeId, buyerPrice, currencyCode) {
    if (!buyerPrice || buyerPrice <= 0) return null;
    const headers = {
        'accept': '*/*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        'Cookie': `golden_key=${auth.golden_key}`
    };
    const base = 100; // как в плагине
    const body = new URLSearchParams({ nodeId: String(nodeId), price: String(base) });
    const r = await fptFetchResilient('https://funpay.com/lots/calc', { method: 'POST', headers, body });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || j.error) return null;

    const want = (currencyCode || '').toLowerCase(); // 'rub' | 'usd' | 'eur' | ''
    const symFor = (c) => c === 'rub' ? '₽' : c === 'usd' ? '$' : c === 'eur' ? '€' : '';

    // Собираем цены методов с их валютой (по unit или data-cy).
    let buyerForBase = Infinity;
    if (Array.isArray(j.methods)) {
        for (const m of j.methods) {
            const p = parseFloat(String(m.price).replace(/\s/g, '').replace(',', '.'));
            if (Number.isNaN(p)) continue;
            const unit = String(m.unit || '');
            let mcur = '';
            if (unit.includes('₽')) mcur = 'rub';
            else if (unit.includes('$')) mcur = 'usd';
            else if (unit.includes('€')) mcur = 'eur';
            // если знаем нужную валюту - берём только методы в ней; иначе минимум по всем
            if (want && mcur && mcur !== want) continue;
            buyerForBase = Math.min(buyerForBase, p);
        }
    }
    // если по нужной валюте ничего не нашли - пробуем minPrice
    if (!Number.isFinite(buyerForBase) && typeof j.minPrice === 'string') {
        const mp = parseFloat(j.minPrice.replace(/\s/g, '').replace(',', '.'));
        if (!Number.isNaN(mp)) buyerForBase = mp;
    }
    if (!Number.isFinite(buyerForBase) || buyerForBase <= 0) return null;

    const coeff = buyerForBase / base;     // commission_coefficient в нужной валюте
    if (coeff <= 0) return null;
    const net = buyerPrice / coeff;
    return Math.round(net * 100) / 100;
}

// --- ИЗМЕНЕННЫЙ БЛОК: ЭКСПОРТ И ИМПОРТ ЛОТОВ ---

async function sendImportProgressUpdate(progressData) {
    const tabs = await chrome.tabs.query({ url: "*://funpay.com/*" });
    tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
            action: 'lotImportProgressUpdate',
            data: progressData
        }).catch(e => {});
    });
}

async function processNextLotImport() {
    const { [IMPORT_PROCESS_KEY]: process } = await chrome.storage.local.get(IMPORT_PROCESS_KEY);
    
    // Если процесса нет, или он отложен, или закончен - выходим.
    if (!process || process.state === 'postponed' || process.currentIndex >= process.lots.length) {
        if (process && process.currentIndex >= process.lots.length) {
            await chrome.storage.local.remove(IMPORT_PROCESS_KEY);
            sendImportProgressUpdate({ finished: true, lots: process.lots || [] });
        }
        return;
    }

    const currentLot = process.lots[process.currentIndex];

    // Предыдущий запуск остановился во время создания этого лота: исход неизвестен.
    if (currentLot.status === 'sending') {
        currentLot.status = 'uncertain';
        currentLot.error = 'Создание лота было прервано. Проверьте список лотов, затем пропустите или повторите его.';
        process.state = 'postponed';
        await chrome.storage.local.set({ [IMPORT_PROCESS_KEY]: process });
        sendImportProgressUpdate(process);
        return;
    }
    
    // Если лот уже успешно создан или пропущен, переходим к следующему
    if (currentLot.status === 'success' || currentLot.status === 'skipped') {
        process.currentIndex++;
        await chrome.storage.local.set({ [IMPORT_PROCESS_KEY]: process });
        processNextLotImport(); // Сразу переходим к следующему
        return;
    }
    
    // Если попытки исчерпаны, останавливаемся
    if (currentLot.retries >= RETRY_LIMIT) {
        currentLot.status = 'error';
        currentLot.error = `Превышен лимит попыток (${RETRY_LIMIT}). Процесс остановлен.`;
        await chrome.storage.local.set({ [IMPORT_PROCESS_KEY]: process });
        sendImportProgressUpdate(process);
        return;
    }

    try {
        const auth = await getAuthDetailsForBackground();
        if (!auth.csrf_token) throw new Error("Не удалось получить CSRF-токен.");

        const formData = new URLSearchParams(currentLot.data);
        formData.set('csrf_token', auth.csrf_token);
        formData.set('offer_id', '0'); // Всегда создаем новый лот
        formData.set('active', 'on'); // Активируем по умолчанию

        // Перед POST лот помечается как «отправляется»: если worker остановится или
        // ответ потеряется, повторно создавать лот вслепую нельзя.
        currentLot.status = 'sending';
        await chrome.storage.local.set({ [IMPORT_PROCESS_KEY]: process });
        let response, seal;
        try {
            ({ response, seal } = await fptFetchWithSeal("https://funpay.com/lots/offerSave", {
                method: "POST",
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                body: formData
            }));
        } catch (networkError) {
            throw Object.assign(new Error('FunPay не ответил. Лот мог создаться — проверьте список лотов, затем пропустите или повторите его.'), { uncertain: true });
        }

        if (!response.ok) {
            if (seal.present && !seal.valid) throw new Error(GOLDEN_SEAL_ERROR);
            if (response.status >= 500) throw Object.assign(new Error(`FunPay ответил HTTP ${response.status}. Лот мог создаться — проверьте список лотов, затем пропустите или повторите его.`), { uncertain: true });
            throw new Error(`Ошибка сети: ${response.statusText}`);
        }

        let result;
        try {
            result = await response.json();
        } catch (_) {
            throw Object.assign(new Error('FunPay вернул нечитаемый ответ. Лот мог создаться — проверьте список лотов, затем пропустите или повторите его.'), { uncertain: true });
        }
        
        if (result && (result.error === 0 || result.error === false)) {
            currentLot.status = 'success';
            process.currentIndex++;
            await chrome.storage.local.set({ [IMPORT_PROCESS_KEY]: process });
            sendImportProgressUpdate(process);
            setTimeout(processNextLotImport, 500); // Небольшая задержка перед следующим
        } else {
            throw new Error(result.msg || `Неизвестная ошибка API: ${JSON.stringify(result)}`);
        }

    } catch (error) {
        if (error.uncertain) {
            // Неясный исход создания: импорт останавливается до решения продавца
            // (пропустить лот или повторить вручную после проверки списка).
            currentLot.status = 'uncertain';
            currentLot.error = error.message;
            process.state = 'postponed';
            await chrome.storage.local.set({ [IMPORT_PROCESS_KEY]: process });
            sendImportProgressUpdate(process);
            return;
        }
        currentLot.retries++;
        currentLot.status = 'pending';
        currentLot.error = error.message;
        await chrome.storage.local.set({ [IMPORT_PROCESS_KEY]: process });
        sendImportProgressUpdate(process);
        
        // Если это была не последняя попытка, делаем таймаут
        if (currentLot.retries < RETRY_LIMIT) {
            setTimeout(processNextLotImport, RETRY_DELAY);
        }
    }
}

// --- КОНЕЦ ИЗМЕНЕННОГО БЛОКА ---

// =====================================================================
// Снимок аккаунта (аватар/баланс/непрочитанные) для вкладки мультиаккаунтов.
//
// ВАЖНО: браузер игнорирует заголовок Cookie, выставленный вручную в fetch()
// (это forbidden header). Поэтому единственный надёжный способ получить главную
// страницу ПОД КОНКРЕТНЫМ аккаунтом - временно подменить cookie golden_key,
// сделать запрос с credentials:'include', затем вернуть исходную cookie.
//
// Все вызовы сериализуются (очередь), чтобы параллельные снимки не затирали
// cookie друг друга и не разлогинивали активную сессию.
// =====================================================================
// Работает ли что-то, что действует от имени текущего аккаунта без участия продавца.
async function isAutomationActive() {
    const settings = await chrome.storage.local.get([
        'fpToolsAutoReplies', 'autoBumpEnabled', 'fpToolsLotSchedulesEnabled'
    ]);
    const replies = settings.fpToolsAutoReplies || {};
    return Boolean(replies.greetingEnabled || replies.keywordsEnabled || replies.autoReviewEnabled || replies.bonusForReviewEnabled
        || replies.newOrderReplyEnabled || replies.orderConfirmReplyEnabled || replies.autoDeliveryEnabled || replies.reviewReminderEnabled
        || settings.autoBumpEnabled || settings.fpToolsLotSchedulesEnabled);
}

let _fptSnapChain = Promise.resolve();

function fptSnapshotForKey(key) {
    const run = async () => {
        // 1) Запоминаем текущую golden_key, чтобы вернуть её после запроса.
        let original = null;
        try { original = await chrome.cookies.get({ url: 'https://funpay.com', name: 'golden_key' }); } catch (_) {}

        // Главная даёт имя, аватар и баланс; оплаченные, но не подтверждённые заказы — деньги «в ожидании».
        const loadSnapshot = async () => {
            const resp = await fetch('https://funpay.com/', { credentials: 'include', cache: 'no-store' });
            const snap = await parseHtmlViaOffscreen(await resp.text(), 'parseAccountSnapshot');
            if (snap && snap.loggedIn) {
                try {
                    const orders = await fetch('https://funpay.com/orders/trade?status=paid', { credentials: 'include', cache: 'no-store' });
                    const pending = await parseHtmlViaOffscreen(await orders.text(), 'parseUnconfirmedBalance');
                    if (pending && pending.totals) snap.pending = { totals: pending.totals, count: pending.count || 0 };
                } catch (_) {}
                // The spendable balance is only on lot pages: take any lot, preferably the seller's own.
                try {
                    const pages = [snap.userId ? `https://funpay.com/users/${snap.userId}/` : '', 'https://funpay.com/'].filter(Boolean);
                    let offerId = '';
                    for (const url of pages) {
                        const page = await fetch(url, { credentials: 'include', cache: 'no-store' });
                        offerId = (await parseHtmlViaOffscreen(await page.text(), 'parseFirstOfferId'))?.id || '';
                        if (offerId) break;
                    }
                    if (offerId) {
                        const offer = await fetch(`https://funpay.com/lots/offer?id=${offerId}`, { credentials: 'include', cache: 'no-store' });
                        const available = await parseHtmlViaOffscreen(await offer.text(), 'parseOfferBalance');
                        if (available) snap.funds = available;
                    }
                } catch (_) {}
            }
            return snap;
        };

        // Если ключ совпадает с активным - просто грузим как есть.
        if (original && original.value === key) {
            try { return await loadSnapshot(); } catch (e) { return null; }
        }

        const setKey = async (value) => {
            return chrome.cookies.set({
                url: 'https://funpay.com',
                name: 'golden_key',
                value,
                domain: '.funpay.com',
                path: '/',
                secure: true,
                sameSite: 'lax',
                expirationDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
            });
        };

        try {
            // 2) Ставим cookie целевого аккаунта.
            await setKey(key);
            // 3) Грузим главную и заказы в ожидании под этим аккаунтом.
            return await loadSnapshot();
        } catch (e) {
            return null;
        } finally {
            // 4) ВСЕГДА возвращаем исходную golden_key (или удаляем, если её не было).
            try {
                if (original && original.value) await setKey(original.value);
                else await chrome.cookies.remove({ url: 'https://funpay.com', name: 'golden_key' });
            } catch (_) {}
        }
    };
    // сериализация
    const next = _fptSnapChain.then(run, run);
    _fptSnapChain = next.catch(() => {});
    return next;
}


// --- Главный обработчик сообщений ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.action === 'fptPatchAutoReplies') {
        patchAutoReplies(request.patch)
            .then(autoReplies => sendResponse({ ok: true, autoReplies }))
            .catch(error => sendResponse({
                ok: false,
                error: error?.message || 'Auto-reply settings could not be saved.',
                code: error?.code
            }));
        return true;
    }
    if (request?.action === 'fptImportAutoReplies') {
        importAutoReplies(request.settings)
            .then(autoReplies => sendResponse({ ok: true, autoReplies }))
            .catch(error => sendResponse({
                ok: false,
                error: error?.message || 'Auto-reply settings could not be imported.',
                code: error?.code
            }));
        return true;
    }

    // Поднять все лоты по кнопке с профиля
    if (request && request.action === 'fptRaiseAllNow') {
        runBumpCycle()
            .then(res => sendResponse({ ok: true, summary: res || {} }))
            .catch(e => sendResponse({ ok: false, error: e && e.message }));
        return true;
    }
    // 3.0: offscreen keepalive ping - receiving it resets the worker idle timer.
    if (request && request.target === 'background' && request.action === 'fptEngineKeepalive') {
        onKeepalivePing();
        sendResponse({ ok: true });
        return true;
    }
    // Relay parse requests from content scripts to the offscreen document
    if (request.target === 'offscreen') {
        parseHtmlViaOffscreen(request.html, request.action)
            .then(result => sendResponse(result))
            .catch(() => sendResponse(null));
        return true;
    }

    // 3.0: Background image send (ported from FunPay Funcy upload_image + send_image).
    // Uploads the image to FunPay, then sends it via the runner with image_id - entirely
    // in the background, so it never touches the visible chat input.
    //
    if (request.action === 'fptSendImage') {
        (async () => {
            const sendId = request.sendId || (request.chatId + ':' + (request.dataUrl || '').slice(0, 64));
            try {
                if (_imgSendInFlight.has(sendId)) {
                    const result = await _imgSendInFlight.get(sendId);
                    sendResponse({ ok: true, result, deduped: true });
                    return;
                }
                const doneAt = _imgSendDone.get(sendId);
                if (doneAt && Date.now() - doneAt.ts < 60000) {
                    sendResponse({ ok: true, result: doneAt.result, deduped: true });
                    return;
                }
                const p = sendChatImageInBackground(request.chatId, request.dataUrl, request.chatName);
                _imgSendInFlight.set(sendId, p);
                let result;
                try { result = await p; }
                finally { _imgSendInFlight.delete(sendId); }
                _imgSendDone.set(sendId, { ts: Date.now(), result });
                if (_imgSendDone.size > 200) {
                    const cutoff = Date.now() - 60000;
                    for (const [k, v] of _imgSendDone) if (v.ts < cutoff) _imgSendDone.delete(k);
                }
                sendResponse({ ok: true, result });
            } catch (e) {
                _imgSendInFlight.delete(sendId);
                sendResponse({ ok: false, error: e.message });
            }
        })();
        return true;
    }

    // 3.0: send plain text to a chat in the background (used for ordered template parts).
    if (request.action === 'fptSendChatText') {
        (async () => {
            try {
                const auth = await getAuthDetailsForBackground();
                if (!auth.golden_key || !auth.csrf_token) throw new Error('Нет авторизации.');
                const cookieStr = auth.phpsessid
                    ? `golden_key=${auth.golden_key}; PHPSESSID=${auth.phpsessid}`
                    : `golden_key=${auth.golden_key}`;
                const payload = {
                    objects: JSON.stringify([{ type: 'chat_node', id: request.chatId, tag: '00000000', data: { node: request.chatId, last_message: -1, content: '' } }]),
                    request: JSON.stringify({ action: 'chat_message', data: { node: request.chatId, last_message: -1, content: request.text } }),
                    csrf_token: auth.csrf_token
                };
                const res = await fetch('https://funpay.com/runner/', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest', 'cookie': cookieStr },
                    body: new URLSearchParams(payload)
                });
                const json = await res.json().catch(() => null);
                if (json?.error) throw new Error(json.error);
                sendResponse({ ok: res.ok });
            } catch (e) {
                sendResponse({ ok: false, error: e.message });
            }
        })();
        return true;
    }

    // RMTHUB PROXY (bypasses CORS - content scripts can't fetch cross-origin)
    if (request.action === 'rmthubFetch') {
        (async () => {
            const API = 'https://fptools-ai-server.vercel.app/api';
            try {
                const res = await fetch(`${API}/rmthub?username=${encodeURIComponent(request.username)}`);
                if (res.status === 404) { sendResponse({ ok: false, notFound: true }); return; }
                if (!res.ok) { sendResponse({ ok: false, status: res.status }); return; }
                const json = await res.json();
                if (json.error) { sendResponse({ ok: false, notFound: true }); return; }
                // Fetch avatar
                let avatar = 'https://funpay.com/img/layout/avatar.png';
                const uid = String(json.user?.id || '');
                if (uid) {
                    try {
                        const ar = await fetch(`${API}/avatar?user_id=${uid}`);
                        const aj = await ar.json();
                        if (aj.avatar && aj.avatar !== avatar) avatar = aj.avatar;
                    } catch (_) {}
                }
                sendResponse({ ok: true, data: json, avatar });
            } catch (e) {
                sendResponse({ ok: false, error: String(e) });
            }
        })();
        return true;
    }

    // AI HANDLERS
    if (request.action === "getAIProcessedText") {
        fetchAIResponse(request.text, request.context, request.myUsername, request.type).then(sendResponse);
        return true;
    }
    if (request.action === "generateAILot") {
        fetchAILotGeneration(request.data).then(sendResponse);
        return true;
    }
    if (request.action === "translateLotText") {
        fetchAITranslation(request.data).then(sendResponse);
        return true;
    }
    if (request.action === "getAIImageSettings") {
        fetchAIImageGeneration(request.prompt).then(sendResponse);
        return true;
    }

    // AUTOBUMP HANDLERS
    if (request.action === 'startAutoBump') {
        startAutoBump().then(() => sendResponse({ success: true }));
        return true;
    }
    if (request.action === 'stopAutoBump') {
        stopAutoBump().then(() => sendResponse({ success: true }));
        return true;
    }
    if (request.action === 'getAutoBumpStatus') {
        chrome.alarms.get(BUMP_ALARM_NAME)
            .then(alarm => sendResponse({ success: true, nextRunAt: alarm ? alarm.scheduledTime : null }))
            .catch(e => sendResponse({ success: false, error: e && e.message }));
        return true;
    }
    if (request.action === 'getUserCategories') {
        (async () => {
            try {
                const auth = await getAuthDetailsForBackground();
                if (!auth.userId) throw new Error("Не удалось получить ID пользователя.");
                const userUrl = `https://funpay.com/users/${auth.userId}/`;
                const userPageResponse = await fetch(userUrl, { headers: { 'Cookie': `golden_key=${auth.golden_key}` } });
                if (!userPageResponse.ok) throw new Error(`Ошибка сети: ${userPageResponse.status}`);
                const userPageHtml = await userPageResponse.text();
                const categories = await parseHtmlViaOffscreen(userPageHtml, 'parseUserCategories');
                sendResponse({success: true, data: categories});
            } catch (e) {
                console.error("Error in getUserCategories:", e);
                sendResponse({success: false, error: e.message}); 
            }
        })();
        return true;
    }
    
    // --- ИЗМЕНЕННЫЙ БЛОК: LOT IO HANDLERS ---
    if (request.action === 'getLotForExport') {
        (async () => {
            try {
                const auth = await getAuthDetailsForBackground();
                const editUrl = `https://funpay.com/lots/offerEdit?node=${request.nodeId}&offer=${request.offerId}`;
                const { response, seal } = await fptFetchWithSeal(editUrl, {});
                if (!response.ok) {
                    if (seal.present && !seal.valid) throw new Error(GOLDEN_SEAL_ERROR);
                    throw new Error(`Network Error: ${response.status}`);
                }
                const html = await response.text();
                if (/account\/login|name="login"/i.test(html) && !/form-offer-editor/i.test(html)) {
                    throw new Error(GOLDEN_SEAL_ERROR);
                }
                const data = await parseHtmlViaOffscreen(html, 'parseLotEditPage');
                sendResponse({ success: true, data: data });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    // FIX 2.9.1: импорт СВОИХ лотов. Раньше превью своих лотов шло через cloneGetSource,
    // который читает ПУБЛИЧНУЮ страницу (без payment_msg/secrets) и переключает локаль.
    // Здесь читаем форму offerEdit владельца НАПРЯМУЮ (одна загрузка, без смены локали) -
    // там есть ВСЁ: цена, сообщение покупателю (ru/en), товары автовыдачи, галка автовыдачи.
    if (request.action === 'getOwnLotFull') {
        (async () => {
            try {
                const auth = await getAuthDetailsForBackground();
                if (!auth.golden_key) throw new Error('Не авторизован (нет golden_key).');
                const offerId = request.offerId;
                if (!offerId) throw new Error('Не передан ID лота.');

                // node не обязателен: offerEdit?offer=ID сам отдаёт нужную форму
                const editUrl = request.nodeId
                    ? `https://funpay.com/lots/offerEdit?node=${request.nodeId}&offer=${offerId}`
                    : `https://funpay.com/lots/offerEdit?offer=${offerId}`;
                const { response: resp, seal } = await fptFetchWithSeal(editUrl, {});
                if (!resp.ok) {
                    if (seal.present && !seal.valid) throw new Error(GOLDEN_SEAL_ERROR);
                    throw new Error(`Ошибка загрузки лота: ${resp.status}`);
                }
                const html = await resp.text();
                if (/account\/login|name="login"/i.test(html) && !/form-offer-editor/i.test(html)) {
                    throw new Error(GOLDEN_SEAL_ERROR);
                }
                const data = await parseHtmlViaOffscreen(html, 'parseLotEditPage');
                if (!data) throw new Error('Не удалось разобрать форму лота.');

                // Формируем source для превью импорта из полного набора полей формы.
                const g = (k) => (data[k] != null ? data[k] : '');
                const source = {
                    isOwn: true,
                    offerId: String(offerId),
                    nodeId: data.node_id || request.nodeId || '',
                    summary_ru: g('fields[summary][ru]'),
                    summary_en: g('fields[summary][en]'),
                    desc_ru: g('fields[desc][ru]'),
                    desc_en: g('fields[desc][en]'),
                    payment_msg_ru: g('fields[payment_msg][ru]'),
                    payment_msg_en: g('fields[payment_msg][en]'),
                    rawPrice: g('price'),
                    amount: g('amount'),
                    secrets: g('secrets'),
                    autoDelivery: !!data.auto_delivery,
                    fullData: data    // полный набор для вставки/импорта без потерь
                };
                sendResponse({ success: true, source });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    // =====================================================================================
    // 3.0 SERVER-SIDE LOT CLONING - фоновые обработчики
    // -------------------------------------------------------------------------------------
    // cloneGetSource:  читает публичную страницу чужого лота и (если найден node) сразу
    //                  строит черновик полей на основе НАШЕЙ пустой формы offerEdit?node=...
    // cloneBuildFields: то же построение полей отдельно (если node меняется в UI).
    // cloneCreateLot:  собирает финальный payload и постит lots/offerSave (offer_id=0).
    // =====================================================================================
    if (request.action === 'cloneGetSource') {
        (async () => {
            try {
                const auth = await getAuthDetailsForBackground();
                if (!auth.golden_key) throw new Error('Не авторизован (нет golden_key).');

                const offerId = request.offerId;
                if (!offerId) throw new Error('Не передан ID лота.');

                const ck = { 'Cookie': `golden_key=${auth.golden_key}` };

                // 1) ФОРСИРУЕМ РУССКИЙ язык для сбора названий и описаний
                let ruResp;
                try {
                    ruResp = await fptFetchResilient(`https://funpay.com/lots/offer?id=${offerId}&setlocale=ru`, { headers: ck });
                } catch (_) {
                    throw new Error('FunPay не отвечает (похоже, временные неполадки сайта — 502/таймаут). Попробуйте ещё раз через минуту.');
                }
                if (ruResp.status >= 500) throw new Error(`FunPay вернул ошибку сервера (${ruResp.status}) — это со стороны FunPay. Повторите позже.`);
                if (!ruResp.ok) throw new Error(`Ошибка загрузки лота: ${ruResp.status}`);
                const ruHtml = await ruResp.text();
                const ru = await parseHtmlViaOffscreen(ruHtml, 'parsePublicLotForClone');
                if (!ru) throw new Error('Не удалось разобрать страницу лота.');
                if (ru.notFound) throw new Error('Предложение не найдено.');

                let en = null;
                try {
                    // ФОРСИРУЕМ АНГЛИЙСКИЙ язык для сбора атрибутов для формы
                    const enResp = await fetch(`https://funpay.com/lots/offer?id=${offerId}&setlocale=en`, { headers: ck });
                    if (enResp.ok) {
                        const enHtml = await enResp.text();
                        en = await parseHtmlViaOffscreen(enHtml, 'parsePublicLotForClone');
                        if (en && en.notFound) en = null;
                    }
                } catch (_) { /* en необязателен */ }

                // ВОЗВРАЩАЕМ РУССКИЙ ЯЗЫК НА АККАУНТ, чтобы не сломать юзеру сайт
                await fetch(`https://funpay.com/?setlocale=ru`, { headers: ck });

                // Цена.
                // 1) ЛУЧШИЙ источник: data-factors на странице покупки (цена продавца нетто).
                //    parsePublicLotForClone уже положил её в ru.price + ru.priceIsSellerNet.
                let rawPrice = '';
                let priceCurrency = '';
                let priceAlreadyNet = false;
                if (ru.price && ru.priceIsSellerNet) {
                    rawPrice = String(ru.price);
                    priceCurrency = ru.priceCurrencyHint || 'rub';
                    priceAlreadyNet = true;
                }

                // 2) Иначе — цена из списка лотов продавца (это цена ПОКУПАТЕЛЯ, нужен пересчёт).
                if (!rawPrice && ru.sellerId) {
                    try {
                        const upResp = await fetch(`https://funpay.com/users/${ru.sellerId}/`, { headers: ck });
                        if (upResp.ok) {
                            const upHtml = await upResp.text();
                            const pr = await parseHtmlViaOffscreen(upHtml, 'parseSellerLotPrice', { offerId });
                            if (pr && pr.price) { rawPrice = pr.price; priceCurrency = pr.currency || ''; }
                        }
                    } catch (_) {}
                }

                // 3) FALLBACK для СВОИХ лотов: цена из формы offerEdit (input[name=price]) —
                //    это тоже цена продавца нетто. И заодно точный node_id формы.
                if (!rawPrice || true) { // всегда пробуем offerEdit ради точного node_id
                    try {
                        const edResp = await fptFetchResilient(
                            `https://funpay.com/lots/offerEdit?offer=${offerId}&location=offer&setlocale=ru`,
                            { headers: ck });
                        if (edResp.ok) {
                            const edHtml = await edResp.text();
                            const pr = await parseHtmlViaOffscreen(edHtml, 'parseOfferEditPrice');
                            if (pr) {
                                if (!rawPrice && pr.price) { rawPrice = pr.price; priceCurrency = pr.currency || priceCurrency; priceAlreadyNet = true; }
                                if (pr.nodeId && /^\d+$/.test(pr.nodeId)) ru.nodeId = pr.nodeId;
                            }
                        }
                    } catch (_) {}
                }

                const source = {
                    ...ru,
                    summary_ru: ru.summary || '',
                    desc_ru: ru.description || '',
                    summary_en: (en && en.summary) || '',
                    desc_en: (en && en.description) || '',
                    enDiffers: !!((en && en.summary && en.summary !== ru.summary) || (en && en.description && en.description !== ru.description)),
                    rawPrice,
                    priceCurrency,
                    matchAttributes: Array.from(new Set([
                        ...((en && en.attributes) || []),
                        ...(ru.attributes || [])
                    ].map(a => String(a).toLowerCase()))),
                    // пары заголовок→значение для заполнения свободных текстовых полей
                    // (RU-пары приоритетнее: на RU-форме заголовки полей по-русски)
                    matchPairs: [
                        ...((ru && ru.attributePairs) || []),
                        ...((en && en.attributePairs) || [])
                    ]
                };

                let fields = null;
                let formError = null;
                if (source.nodeId && !source.isChips) {
                    try {
                        fields = await cloneBuildFieldsInternal(auth, source.nodeId, source.matchAttributes, source.matchPairs);

                        if (rawPrice) {
                            const rawNum = parseFloat(String(rawPrice).replace(',', '.'));
                            if (priceAlreadyNet) {
                                // цена уже нетто (продавца) — берём как есть
                                source.finalPrice = (!Number.isNaN(rawNum) && rawNum > 0) ? rawNum : null;
                            } else {
                                try {
                                    const net = await cloneCalcNetPrice(auth, source.nodeId, rawNum, priceCurrency);
                                    // если пересчёт дал мусор (<=0 или NaN) — используем исходную цену
                                    source.finalPrice = (net != null && !Number.isNaN(net) && net > 0) ? net : ((!Number.isNaN(rawNum) && rawNum > 0) ? rawNum : null);
                                } catch (_) {
                                    source.finalPrice = (!Number.isNaN(rawNum) && rawNum > 0) ? rawNum : null;
                                }
                            }
                        }
                    } catch (e) {
                        formError = e.message;
                    }
                }

                sendResponse({ success: true, source, fields, formError, csrf: auth.csrf_token });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (request.action === 'cloneBuildFields') {
        (async () => {
            try {
                const auth = await getAuthDetailsForBackground();
                if (!auth.golden_key) throw new Error('Не авторизован.');
                const fields = await cloneBuildFieldsInternal(auth, request.nodeId, request.attributes || []);
                sendResponse({ success: true, fields });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    // FunPay Funcy: построить форму создания лота из данных страницы КУПЛЕННОГО заказа.
    // На странице заказа нет offerId исходного лота, но есть nodeId (категория) и
    // тексты/автовыдача. Строим ту же форму категории, что и обычное клонирование,
    // и возвращаем { source, fields, csrf } в формате визарда openCloneWizard.
    if (request.action === 'orderBuildClone') {
        (async () => {
            try {
                const auth = await getAuthDetailsForBackground();
                if (!auth.golden_key) throw new Error('Не авторизован (golden_key).');
                const d = request.data || {};
                const nodeId = String(d.nodeId || '').trim();
                if (!nodeId || !/^\d+$/.test(nodeId)) throw new Error('Не удалось определить категорию (node) лота.');

                // строим пустую форму категории (с CSRF, обяз. полями и т.д.)
                const fields = await cloneBuildFieldsInternal(auth, nodeId, [], []);

                // секреты автовыдачи: кладём в форму + включаем авто-выдачу
                if (d.secrets) {
                    fields['secrets'] = d.secrets;
                    fields['auto_delivery'] = 'on';
                }

                const source = {
                    nodeId,
                    isChips: false,
                    summary_ru: d.summary_ru || '',
                    desc_ru: d.desc_ru || '',
                    summary_en: d.summary_en || '',
                    desc_en: d.desc_en || '',
                    enDiffers: !!((d.summary_en && d.summary_en !== d.summary_ru) || (d.desc_en && d.desc_en !== d.desc_ru)),
                    categoryName: d.categoryName || '',
                    sellerName: d.sellerName || '',
                    sellerId: d.sellerId || '',
                    images: [],
                    secrets: d.secrets || '',
                    rawPrice: d.rawPrice || null,
                    priceCurrency: d.priceCurrency || '',
                    finalPrice: null,
                    attributePairs: d.attributePairs || []
                };

                // цена: на странице заказа это цена ПОКУПАТЕЛЯ — пересчитаем в нетто продавца
                if (d.rawPrice) {
                    const rawNum = parseFloat(String(d.rawPrice).replace(',', '.'));
                    if (!Number.isNaN(rawNum) && rawNum > 0) {
                        try {
                            const net = await cloneCalcNetPrice(auth, nodeId, rawNum, d.priceCurrency);
                            source.finalPrice = (net != null && net > 0) ? net : rawNum;
                        } catch (_) { source.finalPrice = rawNum; }
                    }
                }

                sendResponse({ success: true, source, fields, csrf: auth.csrf_token });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (request.action === 'cloneUploadImages') {
        (async () => {
            try {
                const auth = await getAuthDetailsForBackground();
                if (!auth.golden_key) throw new Error('Не авторизован.');
                const urls = Array.isArray(request.urls) ? request.urls : [];
                if (!urls.length) { sendResponse({ success: true, ids: [] }); return; }

                const ids = [];
                const errors = [];
                for (const url of urls) {
                    try {
                        // 1) скачиваем картинку (публичный sfunpay.com)
                        const imgResp = await fetch(url, { headers: { 'Cookie': `golden_key=${auth.golden_key}` } });
                        if (!imgResp.ok) throw new Error(`download ${imgResp.status}`);
                        const blob = await imgResp.blob();

                        // 2) перезаливаем на FunPay как изображение лота - file/addOfferImage,
                        //    поля file + file_id=0, как в Account.upload_image(type_="offer").
                        const fd = new FormData();
                        const ext = (blob.type && blob.type.includes('png')) ? 'png' : 'jpg';
                        fd.append('file', blob, `image.${ext}`);
                        fd.append('file_id', '0');

                        const upResp = await fetch('https://funpay.com/file/addOfferImage', {
                            method: 'POST',
                            headers: {
                                'Accept': '*/*',
                                'X-Requested-With': 'XMLHttpRequest',
                                'Cookie': `golden_key=${auth.golden_key}`
                            },
                            body: fd
                        });
                        if (!upResp.ok) {
                            let m = `upload ${upResp.status}`;
                            try { const j = await upResp.json(); if (j.msg) m = j.msg; } catch (_) {}
                            throw new Error(m);
                        }
                        const j = await upResp.json();
                        const fileId = j && j.fileId;
                        if (!fileId) throw new Error('нет fileId в ответе');
                        ids.push(parseInt(fileId, 10));
                    } catch (e) {
                        errors.push(`${url}: ${e.message}`);
                    }
                }
                sendResponse({ success: true, ids, errors });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (request.action === 'cloneCreateLot') {
        (async () => {
            try {
                const auth = await getAuthDetailsForBackground();
                if (!auth.csrf_token) throw new Error('Нет CSRF-токена.');

                const payload = { ...(request.fields || {}) };
                payload.offer_id = '0';
                payload.csrf_token = auth.csrf_token;
                if (request.location) payload.location = request.location;

                const body = new URLSearchParams(payload);
                // POST в EN-локали - ровно как в плагине: method("post", "lots/offerSave", ..., locale="en")
                // Создание лота — внешний эффект: один POST без автоматических повторов.
                // После таймаута или 5xx лот мог создаться — повтор только вручную после проверки.
                let response;
                try {
                    response = await fetchWithTimeout('https://funpay.com/en/lots/offerSave', {
                        method: 'POST',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'Accept': 'application/json, text/javascript, */*; q=0.01',
                            'Cookie': `golden_key=${auth.golden_key}`
                        },
                        body
                    });
                } catch (netErr) {
                    throw Object.assign(new Error('FunPay не ответил вовремя. Лот мог создаться — проверьте список лотов перед повторной попыткой.'), { uncertain: true });
                }
                if (response.status >= 500) {
                    throw Object.assign(new Error(`FunPay вернул ошибку сервера (${response.status}). Лот мог создаться — проверьте список лотов перед повтором.`), { uncertain: true });
                }
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const rawText = await response.text();
                let result;
                try { result = JSON.parse(rawText); }
                catch { throw Object.assign(new Error('FunPay вернул нечитаемый ответ. Лот мог создаться — проверьте список лотов перед повтором.'), { uncertain: true }); }

                const hasError = result && (result.error === 1 || result.error === true ||
                    (result.errors && (Array.isArray(result.errors) ? result.errors.length : Object.keys(result.errors).length)));

                if (result && !hasError) {
                    // пробуем вытащить ID нового лота
                    let newId = null;
                    const txt = JSON.stringify(result);
                    let m = txt.match(/"offer_id"\s*:\s*"?(\d+)"?/) || txt.match(/id=(\d+)/);
                    if (m) newId = m[1];
                    if (!newId && result.url) {
                        const um = String(result.url).match(/id=(\d+)/);
                        if (um) newId = um[1];
                    }
                    sendResponse({ success: true, newId });
                } else {
                    let msg = result.msg || 'Ошибка сохранения лота';
                    if (result.errors) {
                        const parts = Array.isArray(result.errors)
                            ? result.errors.map(e => Array.isArray(e) ? e[1] : e)
                            : Object.values(result.errors);
                        if (parts.length) msg = parts.join('; ');
                    }
                    throw new Error(msg);
                }
            } catch (e) {
                sendResponse({ success: false, error: e.message, uncertain: e.uncertain === true || undefined });
            }
        })();
        return true;
    }

    if (request.action === 'cloneDeleteLot') {
        (async () => {
            try {
                if (!request.offerId) throw new Error('Не передан ID лота.');
                await lotWriteQueue.enqueue({ offerId: request.offerId, op: { type: 'delete' }, expectedAccountId: request.expectedAccountId, source: 'delete' });
                sendResponse({ success: true });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    // Расписания лотов: правила, привязки, предпросмотр и применение.
    if (request.action === 'fptLotSchedules') {
        const commands = {
            list: () => lotSchedules.list(),
            saveRule: () => lotSchedules.saveRule({ rule: request.rule, expectedRevision: request.expectedRevision ?? null }),
            setRuleEnabled: () => lotSchedules.setRuleEnabled({ ruleId: request.ruleId, enabled: request.enabled, expectedRevision: request.expectedRevision ?? null }),
            deleteRule: () => lotSchedules.deleteRule({ ruleId: request.ruleId }),
            bindLots: () => lotSchedules.bindLots({ ruleId: request.ruleId || null, lots: request.lots }),
            preview: () => lotSchedules.preview({ rule: request.rule || null, ruleId: request.ruleId || null }),
            evaluate: () => lotSchedules.evaluate()
        };
        const run = commands[request.command];
        if (!run) { sendResponse({ success: false, error: 'Неизвестная команда расписания.' }); return false; }
        run().then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error?.message || 'Ошибка расписания.', code: error?.code }));
        return true;
    }

    // Правила цен: предпросмотр от свежих форм, применение строк предпросмотра, автопересчёт.
    if (request.action === 'fptPricing') {
        const commands = {
            list: () => pricingService.list(),
            saveRule: () => pricingService.saveRule({ rule: request.rule, expectedRevision: request.expectedRevision ?? null }),
            deleteRule: () => pricingService.deleteRule({ ruleId: request.ruleId }),
            bindLots: () => pricingService.bindLots({ ruleId: request.ruleId || null, lots: request.lots }),
            preview: () => pricingService.preview({ ruleId: request.ruleId || null, rule: request.rule || null, lots: request.lots }),
            apply: () => pricingService.apply({ previewId: request.previewId, offerIds: request.offerIds }),
            setAuto: () => pricingService.setAuto({ ruleId: request.ruleId, auto: request.auto, expectedRevision: request.expectedRevision ?? null }),
            resumeAuto: () => pricingService.resumeAuto({ offerId: request.offerId })
        };
        const run = commands[request.command];
        if (!run) { sendResponse({ success: false, error: 'Неизвестная команда цен.' }); return false; }
        run().then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error?.message || 'Ошибка расчёта цен.', code: error?.code }));
        return true;
    }

    // Журнал «Заказы и выдачи»: список, карточка и команды с проверкой ревизии.
    if (request.action === 'fptOrders') {
        if (!orderCommands) { sendResponse({ success: false, error: 'Журнал заказов недоступен (IndexedDB).' }); return false; }
        const run = request.command === 'list' ? orderCommands.list({ filter: request.filter })
            : request.command === 'card' ? orderCommands.card({ orderKey: request.orderKey })
                : orderCommands.command({ ...request, command: request.orderCommand || request.command });
        run.then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error?.message || 'Ошибка журнала заказов.', code: error?.code }));
        return true;
    }

    // Напоминания об отзыве: список задач, отмена, ручной запуск проверки,
    // завершённые заказы без отзыва и разовое напоминание по выбранным.
    if (request.action === 'fptReviewReminders') {
        if (!reviewReminders) { sendResponse({ success: false, error: 'Журнал заказов недоступен (IndexedDB).' }); return false; }
        const commands = {
            list: () => reviewReminders.list(),
            cancel: () => reviewReminders.cancel({ key: request.key }),
            run: () => reviewReminders.run(),
            candidates: () => reviewReminders.candidates({ refresh: request.refresh === true }),
            sendManual: () => reviewReminders.sendManual({ orderIds: Array.isArray(request.orderIds) ? request.orderIds.map(String) : [] })
        };
        const run = commands[request.command];
        if (!run) { sendResponse({ success: false, error: 'Неизвестная команда напоминаний.' }); return false; }
        run().then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error?.message || 'Ошибка напоминаний.' }));
        return true;
    }

    // Единая точка изменения существующих лотов из страниц FunPay и popup.
    // op: { type: 'setActive'|'setPrice'|'adjustPrice'|'setFields'|'delete', ... }
    if (request.action === 'fptLotWrite') {
        (async () => {
            try {
                const result = await lotWriteQueue.enqueue({
                    offerId: request.offerId, nodeId: request.nodeId, op: request.op || {},
                    expectedAccountId: request.expectedAccountId, source: request.source || 'ui'
                });
                const ok = ['saved', 'unchanged', 'deleted-now'].includes(result.status);
                sendResponse({ success: ok, ...result, before: undefined, after: undefined,
                    error: ok ? undefined : lotWriteStatusMessage(result) });
            } catch (e) {
                sendResponse({ success: false, status: 'error', error: e.message, code: e.code });
            }
        })();
        return true;
    }

    // 2.9: Save/update a single lot (used by bulk editor and the order page price field).
    // Применяются только намеренные поля: либо частичный набор (без полей формы fields[...]),
    // либо отличия полной формы от присланной исходной (original). Полная форма без
    // исходной не принимается — она могла устареть и откатить чужие изменения.
    if (request.action === 'saveSingleLot') {
        (async () => {
            try {
                const data = { ...(request.data || {}) };
                const offerId = String(data.offer_id || request.offerId || '');
                const nodeId = String(request.nodeId || data.node_id || '');
                const looksPartial = !Object.keys(data).some(k => k.startsWith('fields['));
                if (!looksPartial && !request.original) throw new Error('Нужна исходная форма лота, чтобы применить только изменения.');
                const { fields, expect } = intendedLotFields(data, looksPartial ? null : request.original);
                if (!Object.keys(fields).length) { sendResponse({ success: true, status: 'unchanged' }); return; }
                const result = await lotWriteQueue.enqueue({
                    offerId, nodeId, expectedAccountId: request.expectedAccountId, source: 'saveSingleLot',
                    op: { type: 'setFields', fields, expect: Object.keys(expect).length ? expect : null }
                });
                if (!['saved', 'unchanged'].includes(result.status)) throw new Error(lotWriteStatusMessage(result));
                sendResponse({ success: true, status: result.status });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    // 2.9: Get unconfirmed (pending) balance
    if (request.action === 'getUnconfirmedBalance') {
        (async () => {
            try {
                const auth = await getAuthDetailsForBackground();
                const res = await fetch('https://funpay.com/orders/trade?status=paid', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Cookie': `golden_key=${auth.golden_key}`
                    }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const html = await res.text();
                const data = await parseHtmlViaOffscreen(html, 'parseUnconfirmedBalance');
                sendResponse({ success: true, data });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (request.action === 'startLotImport') {
        if (_lotImportStartInFlight) {
            sendResponse({ success: false, error: 'Импорт уже запускается.' });
            return false;
        }
        _lotImportStartInFlight = true;
        (async () => {
            try {
                const { [IMPORT_PROCESS_KEY]: currentProcess } = await chrome.storage.local.get(IMPORT_PROCESS_KEY);
                if (currentProcess) {
                    sendResponse({ success: false, error: 'Импорт уже выполняется. Сначала завершите текущую задачу.' });
                    return;
                }
                if (!Array.isArray(request.lots) || !request.lots.length) throw new Error('В файле не найдены лоты.');
                const importProcess = {
                    name: request.fileName || `Импорт от ${new Date().toLocaleString()}`,
                    state: 'running', // 'running', 'postponed'
                    lots: request.lots.map(lot => ({ ...lot, status: 'pending', retries: 0, error: null })),
                    currentIndex: 0
                };
                await chrome.storage.local.set({ [IMPORT_PROCESS_KEY]: importProcess });
                sendResponse({ success: true });
                processNextLotImport();
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Не удалось запустить импорт.' });
            } finally {
                _lotImportStartInFlight = false;
            }
        })();
        return true;
    }

    if (request.action === 'resumeLotImport') {
        (async () => {
             const { [IMPORT_PROCESS_KEY]: process } = await chrome.storage.local.get(IMPORT_PROCESS_KEY);
             if (process) {
                process.state = 'running'; // Меняем статус на "в процессе"
                // Сбрасываем счетчик попыток для всех лотов с ошибками
                process.lots.forEach(lot => {
                    if (lot.status === 'error') {
                        lot.retries = 0;
                        lot.status = 'pending';
                    }
                });
                await chrome.storage.local.set({ [IMPORT_PROCESS_KEY]: process });
                sendResponse({ success: true });
                processNextLotImport(); // Запускаем процесс
             } else {
                sendResponse({ success: false, error: 'Процесс импорта не найден.' });
             }
        })();
        return true;
    }

    if (request.action === 'cancelLotImport') {
        chrome.storage.local.remove(IMPORT_PROCESS_KEY).then(() => sendResponse({success: true}));
        return true;
    }

    if (request.action === 'postponeLotImport') {
        (async () => {
            const { [IMPORT_PROCESS_KEY]: process } = await chrome.storage.local.get(IMPORT_PROCESS_KEY);
            if (process) {
                process.state = 'postponed';
                await chrome.storage.local.set({ [IMPORT_PROCESS_KEY]: process });
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'Процесс для откладывания не найден.' });
            }
        })();
        return true;
    }

    if (request.action === 'skipLotImportItem') {
        (async () => {
            const { [IMPORT_PROCESS_KEY]: process } = await chrome.storage.local.get(IMPORT_PROCESS_KEY);
            if (process && process.lots[request.index]) {
                const lot = process.lots[request.index];
                lot.status = 'skipped';
                lot.error = 'Пропущено пользователем';
                await chrome.storage.local.set({ [IMPORT_PROCESS_KEY]: process });
                sendImportProgressUpdate(process);
                
                // Если пропущенный лот был текущим, немедленно запускаем следующий
                if (process.currentIndex === request.index) {
                    processNextLotImport();
                }

                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'Лот для пропуска не найден.' });
            }
        })();
        return true;
    }
    // --- КОНЕЦ ИЗМЕНЕННОГО БЛОКА ---

    // ACCOUNT & COOKIE HANDLERS
    if (request.action === 'getGoldenKey') {
        (async () => {
            const cookie = await chrome.cookies.get({ url: "https://funpay.com", name: "golden_key" });
            sendResponse({ success: !!cookie, key: cookie ? cookie.value : null });
        })();
        return true;
    }
    if (request.action === 'setGoldenKey') {
        (async () => {
            try {
                if (!request.key) throw new Error('Пустой ключ аккаунта.');

                // --- Логика входа повторяет то, что делает cookie-editor ---
                // Кук-эдитор просто МЕНЯЕТ значение golden_key и НЕ трогает PHPSESSID —
                // FunPay сам перепривязывает сессию к новому ключу на следующем запросе.
                // Прошлые версии УДАЛЯЛИ PHPSESSID и так роняли в пустую сессию.
                //
                // Важные детали, без которых вход не срабатывал:
                //  1. FunPay ставит golden_key как httpOnly на домен ".funpay.com".
                //     chrome.cookies.set НЕ может пометить куку httpOnly, поэтому если
                //     просто записать новую — она будет ОТДЕЛЬНОЙ (non-httpOnly), а сервер
                //     продолжит видеть старую httpOnly → пустая/старая сессия.
                //     Поэтому СНАЧАЛА удаляем все существующие golden_key (remove умеет
                //     убирать и httpOnly-куки), и только потом ставим новую.
                //  2. domain ставим как у FunPay — с ведущей точкой ".funpay.com".

                // 1) Снимаем все варианты golden_key (host-only и доменные, вкл. httpOnly).
                try {
                    const existing = await chrome.cookies.getAll({ name: 'golden_key', domain: 'funpay.com' });
                    for (const c of existing) {
                        const proto = c.secure ? 'https' : 'http';
                        const host = c.domain.replace(/^\./, '');
                        try {
                            await chrome.cookies.remove({
                                url: `${proto}://${host}${c.path || '/'}`,
                                name: 'golden_key',
                                storeId: c.storeId
                            });
                        } catch (_) {}
                    }
                } catch (_) {}

                // 2) Ставим новый golden_key так же, как FunPay: domain ".funpay.com",
                //    secure, path "/", долгий срок. PHPSESSID НЕ трогаем — пусть FunPay
                //    перепривяжет сессию сам (как при смене ключа в cookie-editor).
                let setResult = await chrome.cookies.set({
                    url: 'https://funpay.com/',
                    name: 'golden_key',
                    value: request.key,
                    domain: '.funpay.com',
                    path: '/',
                    secure: true,
                    sameSite: 'lax',
                    expirationDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
                });

                // Подстраховка: некоторые сборки Chrome капризничают с domain+url.
                // Пробуем host-only вариант, если доменный не записался.
                if (!setResult) {
                    setResult = await chrome.cookies.set({
                        url: 'https://funpay.com/',
                        name: 'golden_key',
                        value: request.key,
                        path: '/',
                        secure: true,
                        sameSite: 'lax',
                        expirationDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
                    });
                }

                if (!setResult) {
                    throw new Error('Не удалось записать куку аккаунта (cookies.set вернул null).');
                }

                // 3) Перезагружаем вкладку — FunPay выдаст/перепривяжет сессию под новый ключ.
                const tabId = sender.tab && sender.tab.id;
                if (tabId != null) chrome.tabs.reload(tabId);
                sendResponse({ success: true });
            } catch (e) {
                console.error('FunPay Funcy: setGoldenKey error:', e);
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }
    // ACCOUNT SNAPSHOT (avatar / balance / unread) для вкладки мультиаккаунтов
    if (request.action === 'getAccountSnapshot') {
        (async () => {
            try {
                const key = request.key;
                if (!key) { sendResponse({ ok: false, error: 'no key' }); return; }
                // Пока работает автоматизация, чужой аккаунт не подставляется в общую
                // cookie даже на миг: показывается сохранённый снимок.
                const active = await chrome.cookies.get({ url: 'https://funpay.com', name: 'golden_key' });
                if (active?.value !== key && await isAutomationActive()) {
                    sendResponse({ ok: false, automationLocked: true, error: 'Пока работает автоматизация, данные других аккаунтов не обновляются вживую.' });
                    return;
                }
                const snap = await fptSnapshotForKey(key);
                sendResponse({ ok: true, snapshot: snap || {} });
            } catch (e) {
                sendResponse({ ok: false, error: e.message });
            }
        })();
        return true;
    }

    if (request.action === 'deleteCookiesAndReload') {
        (async () => {
            const allCookies = await chrome.cookies.getAll({ url: "https://funpay.com" });
            for (const cookie of allCookies) {
                await chrome.cookies.remove({ url: "https://funpay.com", name: cookie.name, storeId: cookie.storeId });
            }
            chrome.tabs.reload(sender.tab.id);
        })();
        return true;
    }
    
    // SALES STATS HANDLERS
    if (request.action === 'getSalesOrders') {
        (async () => {
            try {
                await FPTSalesDB.migrateFromLocalStorage(); // на случай первого запуска
                const orders = await FPTSalesDB.getAllAsArray();
                sendResponse({ success: true, orders });
            } catch (e) {
                sendResponse({ success: false, error: e.message, orders: [] });
            }
        })();
        return true;
    }
    if (request.action === 'getSalesCount') {
        (async () => {
            try {
                await FPTSalesDB.migrateFromLocalStorage();
                const c = await FPTSalesDB.count();
                sendResponse({ success: true, count: c });
            } catch (e) {
                sendResponse({ success: false, error: e.message, count: 0 });
            }
        })();
        return true;
    }
    if (request.action === 'putSalesOrders') {
        (async () => {
            try {
                await FPTSalesDB.putOrders(request.orders);
                sendResponse({ success: true });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }
    if (request.action === 'updateSales') {
        runSalesUpdateCycle()
            .then(result => sendResponse({ success: true, updatedAt: result.updatedAt, count: result.count }))
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }
    if (request.action === 'resetSalesStorage') {
        (async () => {
            try {
                await FPTSalesDB.clearAll();
                await FPTSalesDB.setMeta('migratedFromLocal', true); // не тянуть старьё обратно
                await chrome.storage.local.remove([
                    'fpToolsSalesData', 'fpToolsFirstOrderId', 'fpToolsLastOrderId', 'fpToolsSalesLastUpdate'
                ]);
                sendResponse({ success: true });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    // PURCHASES STATS HANDLERS (зеркало продаж, отдельная база покупок)
    if (request.action === 'getPurchaseOrders') {
        (async () => {
            try {
                const orders = await FPTPurchasesDB.getAllAsArray();
                sendResponse({ success: true, orders });
            } catch (e) {
                sendResponse({ success: false, error: e.message, orders: [] });
            }
        })();
        return true;
    }
    if (request.action === 'getPurchaseCount') {
        (async () => {
            try {
                const c = await FPTPurchasesDB.count();
                sendResponse({ success: true, count: c });
            } catch (e) {
                sendResponse({ success: false, error: e.message, count: 0 });
            }
        })();
        return true;
    }
    if (request.action === 'updatePurchases') {
        runPurchasesUpdateCycle()
            .then(result => sendResponse({ success: true, updatedAt: result.updatedAt, count: result.count }))
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }
    if (request.action === 'resetPurchasesStorage') {
        (async () => {
            try {
                await FPTPurchasesDB.clearAll();
                await chrome.storage.local.remove(['fpToolsPurchasesLastUpdate']);
                sendResponse({ success: true });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    // FINANCE STATS HANDLERS (отдельная база финансов)
    if (request.action === 'getFinanceTxns') {
        (async () => {
            try {
                const txns = await FPTFinanceDB.getAllAsArray();
                sendResponse({ success: true, txns });
            } catch (e) {
                sendResponse({ success: false, error: e.message, txns: [] });
            }
        })();
        return true;
    }
    if (request.action === 'getFinanceCount') {
        (async () => {
            try {
                const c = await FPTFinanceDB.count();
                sendResponse({ success: true, count: c });
            } catch (e) {
                sendResponse({ success: false, error: e.message, count: 0 });
            }
        })();
        return true;
    }
    if (request.action === 'updateFinance') {
        runFinanceUpdateCycle()
            .then(result => sendResponse({ success: true, updatedAt: result.updatedAt, count: result.count }))
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }
    if (request.action === 'resetFinanceStorage') {
        (async () => {
            try {
                await FPTFinanceDB.clearAll();
                await chrome.storage.local.remove(['fpToolsFinanceLastUpdate', 'fpToolsFinanceCount']);
                sendResponse({ success: true });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }



    // IMPORT & GLOBAL SEARCH HANDLERS
    if (request.action === 'saveAutoDeliveryLot') {
        (async () => {
            try {
                const data = await saveAutoDeliveryLot(request.lotId, request.settings);
                sendResponse({ success: true, data });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Не удалось сохранить настройки лота.' });
            }
        })();
        return true;
    }
    if (request.action === 'syncAutoDeliveryStockCounts') {
        (async () => {
            try {
                const result = await syncAutoDeliveryStockCounts(request.lots);
                sendResponse({ success: true, ...result });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Не удалось обновить остатки.' });
            }
        })();
        return true;
    }
    if (request.action === 'getUserLotsList') {
        (async () => {
            try {
                const { response, seal } = await fptFetchWithSeal(`https://funpay.com/users/${request.userId}/`, {});
                if (!response.ok) {
                    if (seal.present && !seal.valid) throw new Error(GOLDEN_SEAL_ERROR);
                    throw new Error(`Ошибка загрузки списка лотов: HTTP ${response.status}`);
                }
                const html = await response.text();
                if (/account\/login|name="login"/i.test(html) && !/tc-item|data-app-data/i.test(html)) {
                    throw new Error(GOLDEN_SEAL_ERROR);
                }
                const lots = await parseHtmlViaOffscreen(html, 'parseUserLotsList');
                if (!Array.isArray(lots)) throw new Error('Не удалось разобрать список лотов.');
                sendResponse(lots);
            } catch (e) {
                sendResponse({ success: false, error: e.message || 'Не удалось загрузить список лотов.' });
            }
        })();
        return true;
    }
    if (request.action === 'searchGames') {
        (async () => {
            try {
                const response = await fetch('https://funpay.com/games/promoFilter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
                    body: new URLSearchParams({ query: request.query })
                });
                const data = await response.json();
                const games = await parseHtmlViaOffscreen(data.html, 'parseGameSearchResults');
                sendResponse(games);
            } catch (e) {
                console.error("Error in searchGames:", e);
                sendResponse([]);
            }
        })();
        return true;
    }
    if (request.action === 'getCategoryList' || request.action === 'getLotList') {
        (async () => {
            try {
                const response = await fetch(request.url);
                const html = await response.text();
                const action = request.action === 'getCategoryList' ? 'parseCategoryPage' : 'parseLotListPage';
                const items = await parseHtmlViaOffscreen(html, action);
                sendResponse(items);
            } catch (e) {
                console.error(`Error in ${request.action}:`, e);
                sendResponse([]);
            }
        })();
        return true;
    }

    // ── Support / Tickets handlers ────────────────────────────────────────────
    if (request.action === 'supportGetTickets' || request.action === 'supportGetCategories' ||
        request.action === 'supportGetFields' || request.action === 'supportCreateTicket' ||
        request.action === 'getUnconfirmedOrders' || request.action === 'supportGetTicketDetails' ||
        request.action === 'supportAddComment' || request.action === 'supportCloseTicket') {
        (async () => {
            try {
                const gkCookie = await chrome.cookies.get({ url: 'https://funpay.com', name: 'golden_key' });
                const phpCookie = await chrome.cookies.get({ url: 'https://funpay.com', name: 'PHPSESSID' });
                if (!gkCookie) { sendResponse({ success: false, error: 'Не авторизован на FunPay' }); return; }
                const baseCookie = `golden_key=${gkCookie.value}${phpCookie ? '; PHPSESSID=' + phpCookie.value : ''}`;
                const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
                const supportBase = 'https://support.funpay.com';

                async function sfetch(url, opts = {}) {
                    // SSO: first go through funpay.com/support/sso to get support session cookies
                    const resp = await fetch(url, {
                        ...opts,
                        headers: { ...(opts.headers || {}), 'Cookie': baseCookie, 'User-Agent': ua }
                    });
                    return resp;
                }

                async function sfetchSupport(url, opts = {}) {
                    // For support.funpay.com we need to do SSO first to get the session
                    const ssoResp = await fetch('https://funpay.com/support/sso?return_to=' + encodeURIComponent(url.replace(supportBase, '')), {
                        redirect: 'follow',
                        headers: { 'Cookie': baseCookie, 'User-Agent': ua }
                    });
                    // The SSO sets a cookie on support.funpay.com - but we can't read cross-domain cookies
                    // Instead use the direct URL with the same golden_key (funpay SSO shares session)
                    const finalResp = await fetch(url, {
                        ...opts,
                        headers: { ...(opts.headers || {}), 'Cookie': baseCookie, 'User-Agent': ua }
                    });
                    return finalResp;
                }

                if (request.action === 'getUnconfirmedOrders') {
                    const r = await sfetch('https://funpay.com/orders/trade?state=paid');
                    const html = await r.text();
                    const parsed = await parseHtmlViaOffscreen(html, 'parseOrdersPage');
                    const now = Date.now();
                    const minAgeHours = Math.max(0, Number(request.ageHours) || 0);
                    const orders = (parsed || []).map(order => typeof order === 'string' ? { id: order, time: null } : order)
                        .filter(order => order && order.id)
                        .map(order => ({ id: order.id, ageHours: Number.isFinite(order.time) ? Math.max(0, now - order.time) / 3600000 : null }));
                    // Orders younger than the chosen age still have time to be confirmed by the buyer.
                    // An unreadable date is kept: the user sees every order in the preview before sending.
                    const due = orders.filter(order => order.ageHours === null || order.ageHours >= minAgeHours);
                    due.sort((a, b) => (b.ageHours ?? -1) - (a.ageHours ?? -1));
                    const picked = due.slice(0, request.maxOrders || 5);
                    sendResponse({ success: true, orderIds: picked.map(order => order.id), orders: picked, youngerCount: orders.length - due.length });
                    return;
                }

                if (request.action === 'supportGetTickets') {
                    // FIX 2.9.1: грузим заявки ДВУМЯ наборами - status=all И status=active,
                    // постранично, затем объединяем по id. Причина: в выдаче status=all
                    // FunPay может показывать открытые заявки не на первой странице
                    // (порядок last_answered), и при ранней остановке пагинации активная
                    // заявка терялась - фильтр "Актуальные" оказывался пустым. Отдельная
                    // загрузка status=active гарантирует, что все открытые заявки в кэше.
                    const all = [];
                    const seen = new Set();
                    const MAX_PAGES = 30;

                    const loadStatus = async (status) => {
                        for (let page = 1; page <= MAX_PAGES; page++) {
                            let pageTickets = null;
                            try {
                                const r = await sfetchSupport(`${supportBase}/tickets?status=${status}&order=last_answered&page=${page}`);
                                const html = await r.text();
                                pageTickets = await parseHtmlViaOffscreen(html, 'parseSupportTickets');
                            } catch (pageErr) {
                                if (page === 1 && status === 'all') throw pageErr;
                                break;
                            }
                            if (!pageTickets || !pageTickets.length) break;
                            let added = 0;
                            for (const t of pageTickets) {
                                if (t && t.id != null && !seen.has(t.id)) {
                                    seen.add(t.id);
                                    all.push(t);
                                    added++;
                                }
                            }
                            if (added === 0) break;
                        }
                    };

                    await loadStatus('all');
                    // активные догружаем отдельно (их обычно немного - 1-2 страницы)
                    try { await loadStatus('active'); } catch (_) {}

                    sendResponse({ success: true, tickets: all });
                    return;
                }

                if (request.action === 'supportGetCategories') {
                    const r = await sfetchSupport(`${supportBase}/tickets/new`);
                    const html = await r.text();
                    const categories = await parseHtmlViaOffscreen(html, 'parseSupportCategories');
                    sendResponse({ success: true, categories: categories || [] });
                    return;
                }

                if (request.action === 'supportGetFields') {
                    const r = await sfetchSupport(`${supportBase}/tickets/new/${request.categoryId}`);
                    const html = await r.text();
                    const fields = await parseHtmlViaOffscreen(html, 'parseSupportFields');
                    sendResponse({ success: true, fields: fields || [] });
                    return;
                }

                if (request.action === 'supportCreateTicket') {
                    const { categoryId, fieldValues, message } = request;
                    const formResp = await sfetchSupport(`${supportBase}/tickets/new/${categoryId}`);
                    const formHtml = await formResp.text();
                    const token = await parseHtmlViaOffscreen(formHtml, 'parseSupportFormToken');
                    if (!token) { sendResponse({ success: false, error: 'Не удалось получить токен формы (возможно, не авторизован в ТП)' }); return; }
                    const params = new URLSearchParams();
                    Object.entries(fieldValues || {}).forEach(([k, v]) => { if (v) params.set(k, v); });
                    if (message) params.set('ticket[comment][body_html]', supportMessageHtml(message));
                    params.set('ticket[comment][attachments]', '');
                    params.set('ticket[_token]', token);
                    const createResp = await fetch(`${supportBase}/tickets/create/${categoryId}`, {
                        method: 'POST',
                        headers: { 'Cookie': baseCookie, 'User-Agent': ua, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': `${supportBase}/tickets/new/${categoryId}` },
                        body: params.toString()
                    });
                    const body = await createResp.text();
                    let ticketId = null;
                    try { ticketId = JSON.parse(body)?.action?.url?.split('/').pop(); } catch (_) {}
                    if (!createResp.ok && createResp.status >= 400) {
                        let errMsg = `Ошибка ${createResp.status}`;
                        try { errMsg = JSON.parse(body)?.error || errMsg; } catch (_) {}
                        sendResponse({ success: false, error: errMsg }); return;
                    }
                    sendResponse({ success: true, ticketId });
                    return;
                }


                if (request.action === 'supportGetTicketDetails') {
                    const r = await fetch(`${supportBase}/tickets/${request.ticketId}`, {
                        headers: { 'Cookie': baseCookie, 'User-Agent': ua }
                    });
                    const html = await r.text();
                    const details = await parseHtmlViaOffscreen(html, 'parseTicketDetails');
                    sendResponse({ success: true, ...details });
                    return;
                }

                if (request.action === 'supportAddComment') {
                    const { ticketId, message, token } = request;
                    const params = new URLSearchParams();
                    params.set('add_comment[comment][body_html]', supportMessageHtml(message));
                    params.set('add_comment[comment][attachments]', '');
                    params.set('add_comment[_token]', token);
                    const r = await fetch(`${supportBase}/tickets/${ticketId}/comments/create`, {
                        method: 'POST',
                        headers: { 'Cookie': baseCookie, 'User-Agent': ua, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': `${supportBase}/tickets/${ticketId}` },
                        body: params.toString()
                    });
                    if (!r.ok) {
                        let err = `Ошибка ${r.status}`;
                        try { const b = await r.text(); err = JSON.parse(b)?.error || err; } catch(_) {}
                        sendResponse({ success: false, error: err }); return;
                    }
                    sendResponse({ success: true });
                    return;
                }

                if (request.action === 'supportCloseTicket') {
                    const { ticketId } = request;
                    // Get token from ticket page
                    const pageResp = await fetch(`${supportBase}/tickets/${ticketId}`, {
                        headers: { 'Cookie': baseCookie, 'User-Agent': ua }
                    });
                    const pageHtml = await pageResp.text();
                    // Parse token: try close_ticket[_token] input, fallback to data-app-config csrfToken
                    let token = null;
                    const tokenMatch = pageHtml.match(/name="close_ticket\[_token\]"[^>]*value="([^"]+)"/);
                    if (tokenMatch) token = tokenMatch[1];
                    if (!token) {
                        const cfgMatch = pageHtml.match(/data-app-config="([^"]+)"/);
                        if (cfgMatch) {
                            try { token = JSON.parse(cfgMatch[1].replace(/&quot;/g, '"'))?.csrfToken || null; } catch(_) {}
                        }
                    }
                    if (!token) { sendResponse({ success: false, error: 'Не удалось получить токен' }); return; }
                    const closeResp = await fetch(`${supportBase}/tickets/${ticketId}/close`, {
                        method: 'POST',
                        headers: { 'Cookie': baseCookie, 'User-Agent': ua, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
                        body: new URLSearchParams({ csrf_token: token }).toString()
                    });
                    sendResponse(closeResp.ok ? { success: true } : { success: false, error: `Поддержка не закрыла заявку (ошибка ${closeResp.status}).` });
                    return;
                }

                sendResponse({ success: false, error: 'Unknown action' });
            } catch (e) {
                console.error('[FPTools Support]', e);
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }
    return false;
});

// --- Обработчики будильников ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (await jobScheduler.handleAlarm(alarm)) return;
    if (alarm.name === BUMP_ALARM_NAME) {
        await runScheduledBump();
    }
    // <-- НОВЫЙ ОБРАБОТЧИК -->
    if (alarm.name === AUTO_RESPONDER_ALARM_NAME) {
        await runAutoResponderCycle();
    }
    // 3.0: engine heartbeat - resurrects the active polling loop after the worker is killed
    if (alarm.name === ENGINE_HEARTBEAT_ALARM) {
        await onHeartbeat();
        await jobScheduler.runRecovery();
    }
});

// Plain text typed in the popup becomes the HTML body that support.funpay.com expects.
function supportMessageHtml(message) {
    const escape = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return String(message || '').trim().split(/\n{2,}/)
        .map(paragraph => `<p>${escape(paragraph).replace(/\n/g, '<br>')}</p>`)
        .join('');
}

function setupInitialAlarms() {
    chrome.storage.local.get([
        'autoBumpEnabled', 'fpToolsAutoReplies'
    ], (settings) => {
        if (settings.autoBumpEnabled) {
            runScheduledBump();
        }

        // <-- НОВЫЙ БЛОК ДЛЯ АВТООТВЕТЧИКА -->
        const autoReplies = settings.fpToolsAutoReplies || {};
        const arAnyEnabled = autoReplies.greetingEnabled || autoReplies.keywordsEnabled ||
            autoReplies.autoReviewEnabled || autoReplies.bonusForReviewEnabled ||
            autoReplies.newOrderReplyEnabled || autoReplies.orderConfirmReplyEnabled ||
            autoReplies.autoDeliveryEnabled || autoReplies.reviewReminderEnabled;
        if (arAnyEnabled) {
            // 3.0: start the MV3-safe active loop instead of the broken 0.25-min alarm.
            startEngine();
        }
        syncOrderReconcileAlarm(Boolean(arAnyEnabled));
    });
    jobScheduler.runRecovery({ force: true });
    opsJournal?.prune(OPS_RETENTION_MS).catch(error => console.warn('FunPay Funcy: очистка журнала не удалась:', error?.message || error));
}

chrome.runtime.onStartup.addListener(setupInitialAlarms);

chrome.runtime.onInstalled.addListener(async (details) => {
    await retiredIntegrationCleanup;
    try {
        await globalThis.FPTRetiredIntegrations.cleanup(chrome.storage.local, chrome.alarms);
    } catch (error) {
        console.error('FunPay Funcy: retired integrations cleanup failed:', error);
    }
    try {
        await cleanupRetiredFinancialToolData(details.reason, chrome.storage.local);
    } catch (error) {
        console.error('FunPay Funcy: retired financial data cleanup failed:', error);
    }
    if (details.reason === 'install') {
        chrome.storage.local.set({ 
            autoBumpEnabled: false, 
            autoBumpCooldown: 245,
            showSalesStats: true,
            hideBalance: false,
            viewSellersPromo: true,
            enableCustomTheme: false,
            fpToolsDisabledFeatures: []
        });
    }
    
    setupInitialAlarms();
});


chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    // <-- НОВЫЙ БЛОК ДЛЯ УПРАВЛЕНИЯ БУДИЛЬНИКОМ АВТООТВЕТЧИКА -->
    if (changes.fpToolsAutoReplies) {
        const before = changes.fpToolsAutoReplies.oldValue || {};
        const after = changes.fpToolsAutoReplies.newValue || {};
        if (Boolean(before.reviewReminderEnabled) !== Boolean(after.reviewReminderEnabled)) {
            reviewReminders?.onSettingsChanged().catch(error => console.warn('FunPay Funcy: напоминания не перенастроены:', error?.message || error));
        }
        const newSettings = changes.fpToolsAutoReplies.newValue || {};
        const isEnabled = newSettings.greetingEnabled || newSettings.keywordsEnabled || newSettings.autoReviewEnabled || newSettings.bonusForReviewEnabled ||
            newSettings.newOrderReplyEnabled || newSettings.orderConfirmReplyEnabled || newSettings.autoDeliveryEnabled || newSettings.reviewReminderEnabled;

        // 3.0: drive the engine instead of the broken alarm
        syncOrderReconcileAlarm(Boolean(isEnabled));
        if (isEnabled) {
            startEngine();
        } else {
            stopEngine();
            chrome.alarms.clear(AUTO_RESPONDER_ALARM_NAME);
            resetAutoResponderState();
        }
    }
    if (changes.autoBumpEnabled) {
        if (changes.autoBumpEnabled.newValue) {
            runScheduledBump();
        } else {
            chrome.alarms.clear(BUMP_ALARM_NAME);
        }
    }
});

chrome.runtime.onUpdateAvailable.addListener(function(details) {
    console.log("FunPay Funcy: доступно обновление до версии " + details.version + ". применение...");
    chrome.runtime.reload();
});

// Каждый запуск service worker (а не только старт браузера): незавершённые
// отправки становятся uncertain, просроченные сроки заданий проверяются один раз,
// будущие alarms восстанавливаются. Не зависит от включённости автоответчика.
Promise.resolve()
    .then(() => jobScheduler.runRecovery({ force: true }))
    .then(() => jobScheduler.recoverDeadlines())
    .catch(error => console.warn('FunPay Funcy: восстановление заданий при запуске не удалось:', error?.message || error));
