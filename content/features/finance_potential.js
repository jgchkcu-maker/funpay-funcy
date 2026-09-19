/**
 * FunPay Tools — Finance Potential Inventory Source & Normalization (T06A)
 *
 * Слой сбора и нормализации данных инвентаря лотов продавца:
 * - Каноническая модель строки:
 *   { offerId, nodeId, title, category, active, stock, stockKind, sellerPrice, buyerPrice, currency, costBasis }
 * - Строгая классификация остатков:
 *   - finite: конечное число >= 0 (включая 0, запрещены fallback на 1)
 *   - unknown: неизвестный остаток (stock = null)
 *   - unlimited: бесконечный остаток (stock = null)
 * - Себестоимость: из FPTCostBasis (если отсутствует — строго null, запрещены fallback на 0)
 * - Статус активности: active = true/false (деактивированные лоты на FunPay имеют класс .warning)
 *
 * Инварианты:
 * - Никаких расчетов денежного потенциала (potentialProfit, inventoryCost, ROI, margin) до T06B;
 * - Никакого UI вкладки «Потенциал» до T06C;
 * - Никаких эвристических подстановок (unknown cost != 0, unknown stock != 1, unlimited stock != 1).
 */
(function (root) {
    'use strict';

    /**
     * Парсинг остатка лота с классификацией типа (finite/unknown/unlimited).
     * @param {*} val
     * @returns {{ stock: number|null, stockKind: 'finite'|'unknown'|'unlimited' }}
     */
    function parseStock(val) {
        if (val === null || val === undefined) {
            return { stock: null, stockKind: 'unknown' };
        }
        if (typeof val === 'number') {
            if (!Number.isFinite(val) || isNaN(val) || val < 0) {
                return { stock: null, stockKind: 'unknown' };
            }
            return { stock: val, stockKind: 'finite' };
        }
        if (typeof val === 'string') {
            const s = val.trim();
            if (!s) {
                return { stock: null, stockKind: 'unknown' };
            }
            // Бесконечный остаток: ∞, "много", "unlimited", "неограничено"
            if (s === '∞' || /^(?:много|unlimited|неограничен|неограничено)$/i.test(s)) {
                return { stock: null, stockKind: 'unlimited' };
            }
            // Числовые строки: "5", "5 шт.", "0", "0 шт.", "1 000"
            const cleaned = s.replace(/\s/g, '').replace(/[^\d.,]/g, '').replace(',', '.');
            if (cleaned.length > 0) {
                const n = parseFloat(cleaned);
                if (Number.isFinite(n) && !isNaN(n) && n >= 0) {
                    return { stock: n, stockKind: 'finite' };
                }
            }
            return { stock: null, stockKind: 'unknown' };
        }
        return { stock: null, stockKind: 'unknown' };
    }

    /**
     * Парсинг денежного значения (цена продавца / покупателя).
     * @param {*} val
     * @returns {number|null}
     */
    function parsePrice(val) {
        if (typeof val === 'number') {
            return (Number.isFinite(val) && !isNaN(val) && val >= 0)
                ? Math.round(val * 100) / 100
                : null;
        }
        if (typeof val === 'string') {
            const cleaned = val.replace(/\s/g, '').replace(/[^\d.,]/g, '').replace(',', '.');
            if (!cleaned) return null;
            const n = parseFloat(cleaned);
            return (Number.isFinite(n) && !isNaN(n) && n >= 0)
                ? Math.round(n * 100) / 100
                : null;
        }
        return null;
    }

    /**
     * Определение валюты (RUB, USD, EUR).
     * @param {string} rawStr
     * @param {string} [defaultCurrency='RUB']
     * @returns {string}
     */
    function detectCurrency(rawStr, defaultCurrency = 'RUB') {
        if (typeof rawStr !== 'string') return defaultCurrency;
        const s = rawStr.trim();
        if (s.includes('$')) return 'USD';
        if (s.includes('€')) return 'EUR';
        if (s.includes('₽') || /руб/i.test(s)) return 'RUB';

        const upper = s.toUpperCase();
        if (upper.includes('USD')) return 'USD';
        if (upper.includes('EUR')) return 'EUR';
        if (upper.includes('RUB')) return 'RUB';

        return defaultCurrency;
    }

    /**
     * Нормализация сырой строки лота в каноническую модель инвентаря.
     * @param {Object} raw
     * @param {number|null} [costBasis=null]
     * @returns {Object|null}
     */
    function normalizeLotRow(raw, costBasis = null) {
        if (!raw || typeof raw !== 'object') return null;

        const offerId = raw.offerId ? String(raw.offerId).trim() : (raw.id ? String(raw.id).trim() : null);
        if (!offerId) return null;

        const nodeId = raw.nodeId ? String(raw.nodeId).trim() : null;
        const title = (raw.title || raw.summary || '').trim();
        const category = (raw.category || raw.categoryName || '').trim();
        const active = raw.active === false ? false : true;

        // Определение остатка и его типа
        let stock = null;
        let stockKind = 'unknown';

        if (raw.stockKind && (raw.stockKind === 'finite' || raw.stockKind === 'unknown' || raw.stockKind === 'unlimited')) {
            stockKind = raw.stockKind;
            if (stockKind === 'finite') {
                stock = (typeof raw.stock === 'number' && Number.isFinite(raw.stock) && raw.stock >= 0)
                    ? raw.stock
                    : (raw.stock === 0 ? 0 : null);
                if (stock === null) stockKind = 'unknown';
            } else {
                stock = null;
            }
        } else {
            const parsedStock = parseStock(raw.stock !== undefined ? raw.stock : raw.amount);
            stock = parsedStock.stock;
            stockKind = parsedStock.stockKind;
        }

        // Цена продавца и валюта
        const rawPrice = raw.sellerPrice !== undefined ? raw.sellerPrice : raw.price;
        const sellerPrice = parsePrice(rawPrice);
        const currency = raw.currency
            ? raw.currency.trim().toUpperCase()
            : detectCurrency(String(rawPrice || ''));

        // Цена покупателя
        const rawBuyerPrice = raw.buyerPrice;
        const buyerPrice = parsePrice(rawBuyerPrice);

        // Себестоимость: строго число > 0 либо null
        let resolvedCost = null;
        const inputCost = costBasis !== null ? costBasis : raw.costBasis;
        if (typeof inputCost === 'number' && Number.isFinite(inputCost) && inputCost > 0) {
            resolvedCost = Math.round(inputCost * 100) / 100;
        }

        return {
            offerId,
            nodeId,
            title,
            category,
            active,
            stock,
            stockKind,
            sellerPrice,
            buyerPrice,
            currency,
            costBasis: resolvedCost
        };
    }

    /**
     * Извлечение и нормализация лотов из DOM контейнера или документа.
     * @param {Document|Element} [rootEl]
     * @param {Object} [costMap={}] Карта себестоимости { [offerId]: { amount: number } }
     * @returns {Array<Object>}
     */
    function parseLotsFromDOM(rootEl, costMap = {}) {
        const doc = rootEl || (typeof document !== 'undefined' ? document : null);
        if (!doc) return [];

        const items = doc.querySelectorAll('a.tc-item');
        const results = [];

        items.forEach(row => {
            const offerId = row.getAttribute('data-offer') ||
                row.getAttribute('href')?.match(/(?:offer=|id=)(\d+)/)?.[1] ||
                null;
            if (!offerId) return;

            const offerBlock = row.closest ? row.closest('.offer') : null;
            const categoryLink = offerBlock ? offerBlock.querySelector('.offer-list-title a') : null;
            const category = categoryLink?.textContent?.trim() ||
                offerBlock?.querySelector('.offer-list-title h3')?.textContent?.trim() ||
                '';

            const nodeIdMatch = categoryLink?.getAttribute('href')?.match(/\/(?:lots|chips)\/(\d+)/);
            const nodeId = nodeIdMatch ? nodeIdMatch[1] : null;

            const title = row.querySelector('.tc-desc-text')?.textContent?.trim() ||
                row.querySelector('.tc-desc')?.textContent?.trim() ||
                '';

            // На FunPay деактивированные лоты имеют класс .warning
            const isInactive = row.classList ? row.classList.contains('warning') : false;
            const active = !isInactive;

            // Остаток из .tc-amount
            const amountEl = row.querySelector('.tc-amount');
            const rawAmount = amountEl ? amountEl.textContent.trim() : null;
            const { stock, stockKind } = parseStock(rawAmount);

            // Цена продавца и валюта из .tc-price
            const priceEl = row.querySelector('.tc-price');
            const rawPriceText = priceEl ? priceEl.textContent.trim() : '';
            const sellerPrice = parsePrice(rawPriceText);
            const currency = detectCurrency(rawPriceText);

            // Себестоимость из costMap
            const costRecord = costMap[offerId];
            const costBasis = (costRecord && typeof costRecord.amount === 'number' && costRecord.amount > 0)
                ? costRecord.amount
                : null;

            const normalized = normalizeLotRow({
                offerId,
                nodeId,
                title,
                category,
                active,
                stock,
                stockKind,
                sellerPrice,
                buyerPrice: null,
                currency,
                costBasis
            });

            if (normalized) {
                results.push(normalized);
            }
        });

        return results;
    }

    /**
     * Парсинг лотов из HTML строки (например, страницы профиля).
     * @param {string} html
     * @param {Object} [costMap={}]
     * @returns {Array<Object>}
     */
    function parseLotsFromHtml(html, costMap = {}) {
        if (!html || typeof html !== 'string') return [];

        if (typeof DOMParser !== 'undefined') {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                return parseLotsFromDOM(doc, costMap);
            } catch (e) {
                console.warn('[FPTPotential] DOMParser error:', e);
            }
        }

        return [];
    }

    /**
     * Получить ID текущего пользователя из DOM страницы.
     * @returns {string|null}
     */
    function getMyUserId() {
        if (typeof document === 'undefined') return null;
        try {
            const raw = document.body?.dataset?.appData;
            if (raw) {
                const d = JSON.parse(raw);
                const id = (Array.isArray(d) ? d[0] : d)?.userId;
                if (id) return String(id);
            }
        } catch (_) {}

        const a = document.querySelector('.user-link-dropdown[href*="/users/"]');
        const m = a && a.getAttribute('href') && a.getAttribute('href').match(/\/users\/(\d+)/);
        if (m) return m[1];

        return null;
    }

    /**
     * Получение полного нормализованного инвентаря лотов текущего продавца.
     * @param {{ includeInactive?: boolean, forceRefresh?: boolean }} [options]
     * @returns {Promise<Array<Object>>}
     */
    async function getInventory(options = {}) {
        const includeInactive = options.includeInactive !== false; // по умолчанию true

        // Загрузка карты себестоимости из FPTCostBasis
        let costMap = {};
        if (typeof window !== 'undefined' && window.FPTCostBasis && typeof window.FPTCostBasis.getAll === 'function') {
            try {
                costMap = await window.FPTCostBasis.getAll();
            } catch (e) {
                console.warn('[FPTPotential] Error loading cost basis map:', e);
            }
        }

        let lots = [];

        // 1. Проверяем, открыта ли страница профиля прямо сейчас
        const onUsersPage = typeof window !== 'undefined' && window.location && window.location.pathname.includes('/users/');
        const profileContainer = typeof document !== 'undefined' ? document.querySelector('.profile-data-container, .offer') : null;

        if (onUsersPage && profileContainer) {
            lots = parseLotsFromDOM(document, costMap);
        }

        // 2. Если на другой странице либо лоты в DOM отсутствуют — запрашиваем профиль через fetch
        if (!lots.length) {
            const myUserId = getMyUserId();
            if (myUserId && typeof fetch !== 'undefined') {
                try {
                    const resp = await fetch(`https://funpay.com/users/${myUserId}/`, {
                        credentials: 'include',
                        cache: options.forceRefresh ? 'no-store' : 'default'
                    });
                    if (resp.ok) {
                        const html = await resp.text();
                        lots = parseLotsFromHtml(html, costMap);
                    }
                } catch (e) {
                    console.warn('[FPTPotential] Error fetching user profile inventory:', e);
                }
            }
        }

        if (options.enrichPotential) {
            lots = lots.map(lot => calculateRowPotential(lot));
        }

        if (!includeInactive) {
            return lots.filter(lot => lot.active === true);
        }

        return lots;
    }

    /**
     * Чистый расчет показателей потенциала для отдельной строки лота (T06B).
     * @param {Object} lot Нормализованная строка лота
     * @returns {Object|null} Обогащенная строка с метриками потенциала
     */
    function calculateRowPotential(lot) {
        if (!lot || typeof lot !== 'object') return null;

        const normalized = (lot.stockKind && lot.offerId) ? lot : normalizeLotRow(lot);
        if (!normalized) return null;

        const isFinite = normalized.stockKind === 'finite' && typeof normalized.stock === 'number';
        const hasSellerPrice = typeof normalized.sellerPrice === 'number';
        const hasBuyerPrice = typeof normalized.buyerPrice === 'number';
        const hasCostBasis = typeof normalized.costBasis === 'number';

        let sellerRevenue = null;
        let buyerGmv = null;
        let inventoryCost = null;
        let potentialProfit = null;
        let margin = null;
        let roi = null;

        if (isFinite) {
            if (hasSellerPrice) {
                sellerRevenue = Math.round(normalized.sellerPrice * normalized.stock * 100) / 100;
            }
            if (hasBuyerPrice) {
                buyerGmv = Math.round(normalized.buyerPrice * normalized.stock * 100) / 100;
            }
            if (hasCostBasis) {
                inventoryCost = Math.round(normalized.costBasis * normalized.stock * 100) / 100;
            }
            if (hasSellerPrice && hasCostBasis) {
                // Отрицательная прибыль допустима и не должна обнуляться
                potentialProfit = Math.round((normalized.sellerPrice - normalized.costBasis) * normalized.stock * 100) / 100;
            }
            if (potentialProfit !== null && sellerRevenue !== null && sellerRevenue > 0) {
                margin = Math.round((potentialProfit / sellerRevenue) * 10000) / 100;
            }
            if (potentialProfit !== null && inventoryCost !== null && inventoryCost > 0) {
                roi = Math.round((potentialProfit / inventoryCost) * 10000) / 100;
            }
        }

        return {
            ...normalized,
            sellerRevenue,
            buyerGmv,
            inventoryCost,
            potentialProfit,
            margin,
            roi,
            missingCost: normalized.costBasis === null,
            hasFiniteStock: isFinite
        };
    }

    /**
     * Расчет агрегированных показателей потенциала для заданной валюты (T06B).
     * Неактивные лоты (active === false) строго исключаются из итогов.
     * @param {Array<Object>} lots Массив лотов
     * @param {string} targetCurrency Валюта ('RUB', 'USD', 'EUR')
     * @returns {Object} Агрегаты
     */
    function calculateCurrencyTotals(lots, targetCurrency) {
        if (!Array.isArray(lots)) {
            return {
                currency: targetCurrency,
                sellerRevenue: 0,
                buyerGmv: 0,
                knownInventoryCost: 0,
                knownPotentialProfit: 0,
                unknownStockOffers: 0,
                unknownStockCount: 0,
                unlimitedStockOffers: 0,
                unlimitedStockCount: 0,
                totalActiveOffers: 0,
                finiteOffers: 0,
                knownCostOffers: 0,
                missingCostOffers: 0,
                knownCostSellerRevenue: 0,
                missingCostSellerRevenue: 0,
                costCoveragePercent: 0,
                costCoverage: 0,
                knownMargin: null,
                knownRoi: null,
                overallMargin: null
            };
        }

        const activeLots = lots
            .filter(l => l && l.active === true && (l.currency || 'RUB').toUpperCase() === targetCurrency.toUpperCase())
            .map(l => (l.sellerRevenue !== undefined ? l : calculateRowPotential(l)));

        let sellerRevenue = 0;
        let buyerGmv = 0;
        let knownInventoryCost = 0;
        let knownPotentialProfit = 0;
        let unknownStockOffers = 0;
        let unlimitedStockOffers = 0;
        let finiteOffers = 0;
        let knownCostOffers = 0;
        let missingCostOffers = 0;
        let knownCostSellerRevenue = 0;
        let missingCostSellerRevenue = 0;

        for (const lot of activeLots) {
            if (lot.stockKind === 'unknown') {
                unknownStockOffers++;
                continue;
            }
            if (lot.stockKind === 'unlimited') {
                unlimitedStockOffers++;
                continue;
            }
            if (lot.stockKind === 'finite' && typeof lot.stock === 'number') {
                finiteOffers++;

                if (lot.sellerRevenue !== null) {
                    sellerRevenue += lot.sellerRevenue;
                }
                if (lot.buyerGmv !== null) {
                    buyerGmv += lot.buyerGmv;
                }

                if (lot.costBasis !== null) {
                    knownCostOffers++;
                    if (lot.inventoryCost !== null) {
                        knownInventoryCost += lot.inventoryCost;
                    }
                    if (lot.potentialProfit !== null) {
                        knownPotentialProfit += lot.potentialProfit;
                    }
                    if (lot.sellerRevenue !== null) {
                        knownCostSellerRevenue += lot.sellerRevenue;
                    }
                } else {
                    missingCostOffers++;
                    if (lot.sellerRevenue !== null) {
                        missingCostSellerRevenue += lot.sellerRevenue;
                    }
                }
            }
        }

        sellerRevenue = Math.round(sellerRevenue * 100) / 100;
        buyerGmv = Math.round(buyerGmv * 100) / 100;
        knownInventoryCost = Math.round(knownInventoryCost * 100) / 100;
        knownPotentialProfit = Math.round(knownPotentialProfit * 100) / 100;
        knownCostSellerRevenue = Math.round(knownCostSellerRevenue * 100) / 100;
        missingCostSellerRevenue = Math.round(missingCostSellerRevenue * 100) / 100;

        let costCoveragePercent = 0;
        if (sellerRevenue > 0) {
            costCoveragePercent = Math.round((knownCostSellerRevenue / sellerRevenue) * 10000) / 100;
        } else if (finiteOffers === 0) {
            costCoveragePercent = 100;
        }

        const knownMargin = knownCostSellerRevenue > 0
            ? Math.round((knownPotentialProfit / knownCostSellerRevenue) * 10000) / 100
            : null;

        const knownRoi = knownInventoryCost > 0
            ? Math.round((knownPotentialProfit / knownInventoryCost) * 10000) / 100
            : null;

        const overallMargin = sellerRevenue > 0
            ? Math.round((knownPotentialProfit / sellerRevenue) * 10000) / 100
            : null;

        return {
            currency: targetCurrency,
            sellerRevenue,
            buyerGmv,
            knownInventoryCost,
            knownPotentialProfit,
            unknownStockOffers,
            unknownStockCount: unknownStockOffers,
            unlimitedStockOffers,
            unlimitedStockCount: unlimitedStockOffers,
            totalActiveOffers: activeLots.length,
            finiteOffers,
            knownCostOffers,
            missingCostOffers,
            knownCostSellerRevenue,
            missingCostSellerRevenue,
            costCoveragePercent,
            costCoverage: costCoveragePercent,
            knownMargin,
            knownRoi,
            overallMargin
        };
    }

    /**
     * Расчет агрегированных показателей потенциала по всем имеющимся валютам (T06B).
     * @param {Array<Object>} lots Массив лотов
     * @returns {Object<string, Object>} Карта агрегатов по валютам { RUB: {...}, USD: {...}, EUR: {...} }
     */
    function calculatePotentialAggregates(lots) {
        if (!Array.isArray(lots) || lots.length === 0) {
            return {
                RUB: calculateCurrencyTotals([], 'RUB')
            };
        }

        const currencies = new Set();
        for (const lot of lots) {
            if (lot && lot.currency) {
                currencies.add(lot.currency.toUpperCase());
            }
        }
        if (currencies.size === 0) {
            currencies.add('RUB');
        }

        const result = {};
        for (const cur of currencies) {
            result[cur] = calculateCurrencyTotals(lots, cur);
        }
        return result;
    }

    const api = {
        parseStock,
        parsePrice,
        detectCurrency,
        normalizeLotRow,
        parseLotsFromDOM,
        parseLotsFromHtml,
        getMyUserId,
        getInventory,
        calculateRowPotential,
        calculateCurrencyTotals,
        calculatePotentialAggregates
    };

    root.FPTPotential = api;
    if (typeof window !== 'undefined') {
        window.FPTPotential = api;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.FPTPotential = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
