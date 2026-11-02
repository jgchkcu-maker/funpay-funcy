// content/features/exact_price.js
// Резервный инструмент: точный расчёт цены продавца по таблице FunPay,
// активен, когда живое поле «Цена покупателю» недоступно или отключено.

function initializeExactPrice() {
    // Убедимся, что мы на странице редактирования или создания лота
    const header = document.querySelector('h1.page-header');
    if (!header || !(header.textContent.includes('Редактирование предложения') || header.textContent.includes('Добавление предложения'))) {
        return;
    }

    // Проверяем, не была ли кнопка добавлена ранее
    if (document.querySelector('.set-exact-price')) {
        return;
    }

    const inputPrice = document.querySelector('input[name="price"]');
    if (!inputPrice) {
        return;
    }

    const exactPriceButton = createElement('div', { class: 'set-exact-price' }, {}, 'Рассчитать, чтобы получить эту сумму');
    inputPrice.parentNode.insertBefore(exactPriceButton, inputPrice.nextSibling);

    // Согласование с живым полем «Цена покупателю»:
    // Если живое поле активно и работает, кнопка скрывается.
    function updateVisibility() {
        const buyerGroup = document.getElementById('fpt-buyer-price-group');
        const isBuyerActive = window.FPTBuyerPriceActive === true && buyerGroup && buyerGroup.style.display !== 'none' && !buyerGroup.hidden;
        exactPriceButton.style.display = isBuyerActive ? 'none' : '';
    }

    window.addEventListener('fptBuyerPriceStateChange', (e) => {
        const active = e.detail?.active;
        exactPriceButton.style.display = active ? 'none' : '';
    });
    updateVisibility();

    // Читает «сколько заплатит покупатель» из живой таблицы расчёта FunPay.
    // Берём ТОЛЬКО рублёвые строки (₽) с минимальным значением.
    const readBuyerPriceRub = () => {
        const body = document.querySelector('.js-calc-table-body');
        if (!body) return null;
        const vals = [];
        body.querySelectorAll('tr').forEach(tr => {
            const cell = tr.querySelector('td:last-child');
            if (!cell) return;
            const txt = cell.textContent;
            if (!/[₽]|руб/i.test(txt)) return;
            const n = parseFloat(txt.replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(',', '.'));
            if (!isNaN(n) && n > 0) vals.push(n);
        });
        if (!vals.length) return null;
        return Math.min(...vals);
    };

    const setPrice = (v) => {
        inputPrice.value = (Math.round(v * 100) / 100).toString();
        inputPrice.dispatchEvent(new Event('input', { bubbles: true }));
        inputPrice.dispatchEvent(new Event('keyup', { bubbles: true }));
    };

    // Ждёт пересчёта таблицы FunPay
    const waitRecalc = (prevBuyer) => new Promise(resolve => {
        let tries = 0;
        const tick = () => {
            const b = readBuyerPriceRub();
            if ((b !== null && b !== prevBuyer) || tries > 25) { resolve(b); return; }
            tries++;
            setTimeout(tick, 40);
        };
        tick();
    });

    exactPriceButton.addEventListener('click', async () => {
        const desiredAmount = parseFloat((inputPrice.value || '').replace(',', '.'));
        if (isNaN(desiredAmount) || desiredAmount <= 0) {
            showNotification('Введите в поле сумму, которую хотите получить.', true);
            return;
        }

        exactPriceButton.textContent = 'Считаю…';
        try {
            const prevBuyer = readBuyerPriceRub();
            setPrice(desiredAmount);
            let buyerForProbe = await waitRecalc(prevBuyer);
            const sellerProbe = desiredAmount;

            if (buyerForProbe === null || buyerForProbe <= 0) {
                showNotification('Не найдена рублёвая строка в таблице расчёта. Впишите цену, дождитесь таблицы и повторите.', true);
                exactPriceButton.textContent = 'Рассчитать, чтобы получить эту сумму';
                return;
            }

            const k = buyerForProbe / sellerProbe;
            if (!isFinite(k) || k <= 0) {
                showNotification('Не удалось определить комиссию. Повторите.', true);
                exactPriceButton.textContent = 'Рассчитать, чтобы получить эту сумму';
                return;
            }

            const sellerPrice = desiredAmount / k;
            setPrice(sellerPrice);

            const buyerNow = await waitRecalc(buyerForProbe);
            if (buyerNow && Math.abs(buyerNow - desiredAmount) > 0.02) {
                const k2 = buyerNow / sellerPrice;
                if (isFinite(k2) && k2 > 0) setPrice(desiredAmount / k2);
            }

            const finalSeller = parseFloat(inputPrice.value);
            showNotification(`Цена продавца: ${finalSeller} ₽ — покупатель заплатит ≈ ${desiredAmount} ₽ (по самому дешёвому способу)`, false);
        } catch (e) {
            showNotification('Ошибка расчёта: ' + e.message, true);
        } finally {
            exactPriceButton.textContent = 'Рассчитать, чтобы получить эту сумму';
        }
    });
}
