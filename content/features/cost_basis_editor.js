/**
 * FunPay Tools — Cost Basis Editor for Existing & New Offers (T05A + T05B)
 *
 * Поле себестоимости и предпросмотр прибыли продавца на странице
 * редактирования или создания лота (/lots/offerEdit).
 *
 * Инварианты и правила:
 * - Поддержка как существующих лотов (offer_id !== '0'), так и создания новых (offer_id = '0');
 * - При создании нового лота сохраняет tab-scoped черновик в sessionStorage;
 * - После редиректа на edit-page привязывает черновик к фактическому offerId (bindDraftToOffer);
 * - Привязка выполняется строго при совпадении nodeId и в пределах TTL (2 часа);
 * - Две вкладки изолированы и не разделяют глобальный черновик (гарантия sessionStorage);
 * - Черновик удаляется только после успешного bind к offerId;
 * - Поле себестоимости создаётся строго БЕЗ атрибута name (не попадает в payload FunPay);
 * - Текст подсказки: «Видно только вам. На FunPay не отправляется.»;
 * - Live preview: sellerPrice - cost (база прибыли — строго цена продавца);
 * - Отрицательная прибыль разрешена и не обрезается;
 * - При значении 0 или очистке — удаление записи или черновика.
 */
(function () {
    'use strict';

    let initializedTargetKey = null;
    let saveTimer = null;

    /**
     * Проверка, находимся ли мы на странице формы лота (создание или редактирование).
     * @returns {boolean}
     */
    function isEditPage() {
        if (typeof document === 'undefined') return false;
        const header = document.querySelector('h1.page-header');
        if (header && (header.textContent.includes('Редактирование предложения') || header.textContent.includes('Добавление предложения'))) {
            return true;
        }
        if (typeof location !== 'undefined' && (location.pathname.includes('/lots/offerEdit') || location.search.includes('offerEdit'))) {
            return true;
        }
        return false;
    }

    /**
     * Достоверное получение offerId существующего лота.
     * Возвращает ID только если лот уже существует (offer_id !== '0').
     * @returns {string|null}
     */
    function getExistingOfferId() {
        if (typeof document === 'undefined') return null;
        const inp = document.querySelector('form.form-offer-editor input[name="offer_id"], input[name="offer_id"]');
        const val = inp && inp.value ? String(inp.value).trim() : null;
        if (val && /^\d+$/.test(val) && val !== '0') {
            return val;
        }

        if (typeof window !== 'undefined' && window.location) {
            const urlOffer = new URLSearchParams(window.location.search).get('offer');
            if (urlOffer && /^\d+$/.test(urlOffer) && urlOffer !== '0') {
                return urlOffer;
            }
        }

        return null;
    }

    /**
     * Получение nodeId раздела.
     * @returns {string|null}
     */
    function getNodeId() {
        if (typeof document === 'undefined') return null;
        const inp = document.querySelector('input[name="node_id"]');
        if (inp && inp.value && /^\d+$/.test(inp.value.trim())) {
            return inp.value.trim();
        }

        if (typeof window !== 'undefined' && window.location) {
            const urlNode = new URLSearchParams(window.location.search).get('node');
            if (urlNode && /^\d+$/.test(urlNode.trim())) {
                return urlNode.trim();
            }

            const pathMatch = window.location.pathname.match(/\/lots\/(\d+)\//);
            if (pathMatch) {
                return pathMatch[1];
            }
        }

        return null;
    }

    /**
     * Определение валюты лота (RUB, USD, EUR).
     * @param {HTMLInputElement} priceInput
     * @returns {{ code: string, symbol: string }}
     */
    function detectCurrency(priceInput) {
        if (priceInput && priceInput.parentElement) {
            const feedback = priceInput.parentElement.querySelector('.form-control-feedback');
            if (feedback && feedback.textContent) {
                const s = feedback.textContent.trim();
                if (s === '$') return { code: 'USD', symbol: '$' };
                if (s === '€') return { code: 'EUR', symbol: '€' };
                if (s === '₽' || /руб/i.test(s)) return { code: 'RUB', symbol: '₽' };
            }
        }

        const calcBody = document.querySelector('.js-calc-table-body');
        if (calcBody) {
            const text = calcBody.textContent;
            if (text.includes('$')) return { code: 'USD', symbol: '$' };
            if (text.includes('€')) return { code: 'EUR', symbol: '€' };
            if (text.includes('₽') || /руб/i.test(text)) return { code: 'RUB', symbol: '₽' };
        }

        return { code: 'RUB', symbol: '₽' };
    }

    /**
     * Парсинг денежного числа из строки.
     * @param {*} val
     * @returns {number}
     */
    function parseMoney(val) {
        if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
        if (typeof val !== 'string') return NaN;
        const cleaned = val.replace(/\s/g, '').replace(/[^\d.,-]/g, '').replace(',', '.');
        return parseFloat(cleaned);
    }

    /**
     * Форматирование денежного значения.
     * @param {number} num
     * @returns {string}
     */
    function formatMoney(num) {
        return (Math.round(num * 100) / 100).toFixed(2).replace('.', ',');
    }

    /**
     * Построение DOM-элементов редактора себестоимости.
     * @param {HTMLInputElement} priceInput
     * @param {string} currencySymbol
     * @returns {{ group: HTMLElement, input: HTMLInputElement, previewBox: HTMLElement } | null}
     */
    function buildEditorDOM(priceInput, currencySymbol) {
        if (document.getElementById('fpt-cost-basis-group')) {
            return null;
        }

        const group = document.createElement('div');
        group.id = 'fpt-cost-basis-group';
        group.className = 'form-group has-feedback w-200px fpt-cost-basis-group';

        const label = document.createElement('label');
        label.className = 'control-label';
        label.textContent = 'Себестоимость';

        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'fpt-cost-input-wrapper';
        if (inputWrapper.style) {
            inputWrapper.style.position = 'relative';
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control';
        input.id = 'fpt-cost-basis-input';
        input.placeholder = '—';
        input.inputMode = 'decimal';
        input.autocomplete = 'off';
        // ВАЖНО: никакого атрибута name!
        input.removeAttribute('name');

        const feedback = document.createElement('span');
        feedback.className = 'form-control-feedback';
        feedback.textContent = currencySymbol;

        inputWrapper.appendChild(input);
        inputWrapper.appendChild(feedback);

        const previewBox = document.createElement('div');
        previewBox.id = 'fpt-cost-profit-preview';
        previewBox.className = 'fpt-cost-profit-preview';

        const hint = document.createElement('p');
        hint.className = 'help-block fpt-cost-hint';
        hint.textContent = 'Видно только вам. На FunPay не отправляется.';

        group.appendChild(label);
        group.appendChild(inputWrapper);
        group.appendChild(previewBox);
        group.appendChild(hint);

        // Вставляем после группы цены покупателя или после нативной цены продавца
        const buyerPriceGroup = document.getElementById('fpt-buyer-price-group');
        if (buyerPriceGroup && buyerPriceGroup.parentElement) {
            buyerPriceGroup.parentElement.insertBefore(group, buyerPriceGroup.nextSibling);
        } else {
            const priceGroup = priceInput.closest('.form-group') || priceInput.parentElement;
            if (priceGroup && priceGroup.parentElement) {
                priceGroup.parentElement.insertBefore(group, priceGroup.nextSibling);
            }
        }

        return { group, input, previewBox };
    }

    /**
     * Обновление блока live preview чистой прибыли продавца.
     * @param {HTMLInputElement} priceInput
     * @param {HTMLInputElement} costInput
     * @param {HTMLElement} previewBox
     * @param {string} currencySymbol
     */
    function updateProfitPreview(priceInput, costInput, previewBox, currencySymbol) {
        if (!priceInput || !costInput || !previewBox) return;

        const sellerPrice = parseMoney(priceInput.value);
        const cost = parseMoney(costInput.value);

        if (!Number.isFinite(cost) || cost <= 0) {
            previewBox.innerHTML = '<span class="fpt-cost-profit-neutral text-muted">Укажите себестоимость</span>';
            return;
        }

        if (!Number.isFinite(sellerPrice) || sellerPrice <= 0) {
            previewBox.innerHTML = '<span class="fpt-cost-profit-neutral text-muted">Укажите цену продажи</span>';
            return;
        }

        // Чистая прибыль продавца = sellerPrice - cost (отрицательная прибыль разрешена!)
        const profit = sellerPrice - cost;
        const margin = sellerPrice > 0 ? (profit / sellerPrice * 100) : null;
        const sign = profit > 0 ? '+' : '';
        const formattedProfit = `${sign}${formatMoney(profit)} ${currencySymbol}`;
        const marginText = margin !== null ? ` (${sign}${margin.toFixed(1)}% маржа)` : '';

        // Опциональная справочная информация о цене покупателя (если поле активно)
        const buyerInput = document.getElementById('fpt-buyer-price-input');
        const buyerPrice = buyerInput ? parseMoney(buyerInput.value) : null;
        let buyerInfo = '';
        if (Number.isFinite(buyerPrice) && buyerPrice > 0) {
            buyerInfo = `<div class="fpt-cost-buyer-note text-muted" style="font-size:11px;margin-top:2px;">(покупатель платит: ${formatMoney(buyerPrice)} ${currencySymbol})</div>`;
        }

        if (profit > 0) {
            previewBox.innerHTML = `<div class="fpt-cost-profit-positive text-success">Прибыль: <strong>${formattedProfit}</strong>${marginText}</div>${buyerInfo}`;
        } else if (profit < 0) {
            previewBox.innerHTML = `<div class="fpt-cost-profit-negative text-danger">Прибыль: <strong>${formattedProfit}</strong>${marginText}</div>${buyerInfo}`;
        } else {
            previewBox.innerHTML = `<div class="fpt-cost-profit-neutral text-muted">Прибыль: <strong>0,00 ${currencySymbol}</strong> (0.0% маржа)</div>${buyerInfo}`;
        }
    }

    /**
     * Основная инициализация редактора себестоимости.
     */
    async function initCostEditor() {
        if (!isEditPage()) return;

        const offerId = getExistingOfferId();
        const nodeId = getNodeId();
        const isNewOffer = !offerId;

        // Если это создание нового лота, но nodeId не найден — не можем определить контекст
        if (isNewOffer && !nodeId) return;

        const priceInput = document.querySelector('input[name="price"]');
        if (!priceInput) return;

        const targetKey = isNewOffer ? `new_${nodeId}` : `offer_${offerId}`;
        if (initializedTargetKey === targetKey && document.getElementById('fpt-cost-basis-group')) {
            return;
        }

        const { code: currencyCode, symbol: currencySymbol } = detectCurrency(priceInput);

        const dom = buildEditorDOM(priceInput, currencySymbol);
        if (!dom) return;

        const { input: costInput, previewBox } = dom;
        initializedTargetKey = targetKey;

        // Загрузка начальных данных
        if (window.FPTCostBasis) {
            try {
                if (isNewOffer) {
                    // Режим создания нового лота: читаем черновик из sessionStorage
                    if (typeof window.FPTCostBasis.getDraft === 'function') {
                        const draft = window.FPTCostBasis.getDraft(nodeId);
                        if (draft && typeof draft.amount === 'number' && draft.amount > 0) {
                            costInput.value = formatMoney(draft.amount);
                            updateProfitPreview(priceInput, costInput, previewBox, currencySymbol);
                        }
                    }
                } else {
                    // Режим существующего лота: сначала проверяем постоянное хранилище
                    let record = null;
                    if (typeof window.FPTCostBasis.get === 'function') {
                        record = await window.FPTCostBasis.get(offerId);
                    }

                    // Если постоянной записи нет, проверяем, есть ли готовый черновик после редиректа
                    if (!record && nodeId && typeof window.FPTCostBasis.getDraft === 'function') {
                        const draft = window.FPTCostBasis.getDraft(nodeId);
                        // Проверяем соответствие nodeId и наличие суммы
                        if (draft && draft.nodeId === nodeId && typeof draft.amount === 'number' && draft.amount > 0) {
                            if (typeof window.FPTCostBasis.bindDraftToOffer === 'function') {
                                record = await window.FPTCostBasis.bindDraftToOffer(nodeId, offerId);
                            }
                        }
                    }

                    if (record && typeof record.amount === 'number' && record.amount > 0) {
                        costInput.value = formatMoney(record.amount);
                        updateProfitPreview(priceInput, costInput, previewBox, currencySymbol);
                    }
                }
            } catch (err) {
                console.warn('[FPTCostEditor] Error loading/binding cost basis:', err);
            }
        }

        // Первичный расчет preview
        updateProfitPreview(priceInput, costInput, previewBox, currencySymbol);

        /**
         * Сохранение значения в FPTCostBasis (постоянное или черновик) с debounce.
         */
        function scheduleSave() {
            updateProfitPreview(priceInput, costInput, previewBox, currencySymbol);
            clearTimeout(saveTimer);
            saveTimer = setTimeout(async () => {
                if (!window.FPTCostBasis) return;
                const cost = parseMoney(costInput.value);
                try {
                    if (isNewOffer) {
                        // Сохранение/очистка черновика
                        if (!Number.isFinite(cost) || cost <= 0) {
                            if (typeof window.FPTCostBasis.clearDraft === 'function') {
                                window.FPTCostBasis.clearDraft(nodeId);
                            }
                        } else {
                            if (typeof window.FPTCostBasis.saveDraft === 'function') {
                                window.FPTCostBasis.saveDraft(nodeId, {
                                    amount: cost,
                                    currency: currencyCode,
                                    nodeId: nodeId
                                });
                            }
                        }
                    } else {
                        // Сохранение/удаление постоянной записи
                        if (!Number.isFinite(cost) || cost <= 0) {
                            if (typeof window.FPTCostBasis.remove === 'function') {
                                await window.FPTCostBasis.remove(offerId);
                            }
                        } else {
                            if (typeof window.FPTCostBasis.set === 'function') {
                                await window.FPTCostBasis.set(offerId, {
                                    amount: cost,
                                    currency: currencyCode,
                                    nodeId: nodeId,
                                    source: 'manual'
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[FPTCostEditor] Error saving cost basis/draft:', e);
                }
            }, 250);
        }

        // Слушатели на поле себестоимости
        costInput.addEventListener('input', scheduleSave);
        costInput.addEventListener('change', scheduleSave);

        // Слушатели на поле цены продавца
        priceInput.addEventListener('input', () => {
            updateProfitPreview(priceInput, costInput, previewBox, currencySymbol);
        });
        priceInput.addEventListener('change', () => {
            updateProfitPreview(priceInput, costInput, previewBox, currencySymbol);
        });

        // Слушатель на поле цены покупателя (если оно меняется)
        document.addEventListener('input', (e) => {
            if (e.target && e.target.id === 'fpt-buyer-price-input') {
                updateProfitPreview(priceInput, costInput, previewBox, currencySymbol);
            }
        });

        // Защитный хук: гарантируем отсутствие атрибута name перед нативной отправкой формы
        const form = priceInput.closest('form');
        if (form) {
            form.addEventListener('submit', () => {
                costInput.removeAttribute('name');
            });
        }
    }

    // Запуск при готовности DOM
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCostEditor);
        } else {
            initCostEditor();
        }

        // Наблюдатель на случай динамической подгрузки / перерисовки формы
        const observer = new MutationObserver(() => {
            if (isEditPage() && document.querySelector('input[name="price"]') && !document.getElementById('fpt-cost-basis-group')) {
                initCostEditor();
            }
        });

        try {
            observer.observe(document.documentElement, { childList: true, subtree: true });
        } catch (_) {}
    }

    // Экспорт для тестов
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            isEditPage,
            getExistingOfferId,
            getNodeId,
            detectCurrency,
            parseMoney,
            formatMoney,
            buildEditorDOM,
            updateProfitPreview,
            initCostEditor
        };
    }
})();
