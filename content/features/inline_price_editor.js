// content/features/inline_price_editor.js
// Inline price editing directly on the /trade page

(function () {
    'use strict';

    function getAppData() {
        try {
            const raw = document.body.dataset.appData;
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed[0] : parsed;
        } catch (_) { return {}; }
    }

    function getCurrentUserId() {
        try {
            const raw = document.body?.dataset?.appData;
            if (!raw) return null;
            const d = JSON.parse(raw);
            return String((Array.isArray(d) ? d[0] : d)?.userId || '');
        } catch (_) { return null; }
    }

    // ── Popup anchored to body to escape <a> click bubbling ──────────────────

    let _activePopup = null;

    function closeActivePopup() {
        if (_activePopup) { _activePopup.remove(); _activePopup = null; }
    }

    function getTradeNodeId() {
        const m = location.pathname.match(/\/lots\/(\d+)\//);
        return m ? m[1] : null;
    }

    function createPopup(anchorEl, currentPrice, onSave) {
        closeActivePopup();

        const popup = document.createElement('div');
        popup.className = 'fp-ipe-popup';
        popup.innerHTML = `
            <span class="fp-ipe-label">Новая цена</span>
            <input type="number" class="fp-ipe-input" value="${currentPrice.toFixed(2)}" step="0.01" min="0.01">
            <button class="fp-ipe-save" title="Сохранить">✓</button>
            <button class="fp-ipe-cancel" title="Отмена">✕</button>
            <div class="fp-ipe-buyer" title="Сколько заплатит покупатель по самому дешёвому способу"></div>
        `;

        const input = popup.querySelector('.fp-ipe-input');
        const buyerHint = popup.querySelector('.fp-ipe-buyer');

        const nodeId = getTradeNodeId();
        let buyerReqId = 0;
        async function updateBuyerHint() {
            if (!buyerHint) return;
            const sp = parseFloat(input.value);
            if (!nodeId || !window.FPTCommission || !Number.isFinite(sp) || sp <= 0) {
                buyerHint.textContent = '';
                return;
            }
            const myReq = ++buyerReqId;
            buyerHint.textContent = 'Покупатель заплатит ≈ …';
            try {
                const bp = await window.FPTCommission.buyerPrice(nodeId, sp);
                if (myReq !== buyerReqId) return;
                buyerHint.textContent = (bp != null)
                    ? `Покупатель заплатит ≈ ${bp.toFixed(2).replace('.', ',')} ₽`
                    : '';
            } catch (_) {
                if (myReq === buyerReqId) buyerHint.textContent = '';
            }
        }
        input.addEventListener('input', updateBuyerHint);
        updateBuyerHint();

        // Position under the anchor element
        function reposition() {
            const rect = anchorEl.getBoundingClientRect();
            popup.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
            popup.style.left = Math.max(8, rect.left + window.scrollX - 10) + 'px';
        }

        document.body.appendChild(popup);
        reposition();
        _activePopup = popup;

        input.focus();
        input.select();

        popup.querySelector('.fp-ipe-cancel').addEventListener('click', (e) => {
            e.stopPropagation();
            closeActivePopup();
        });

        const doSave = async () => {
            const newPrice = parseFloat(input.value);
            if (isNaN(newPrice) || newPrice <= 0) {
                input.classList.add('fp-ipe-error');
                input.focus(); return;
            }
            const saveBtn = popup.querySelector('.fp-ipe-save');
            saveBtn.textContent = '…'; saveBtn.disabled = true;
            input.disabled = true;
            const ok = await onSave(newPrice);
            if (!ok) {
                saveBtn.textContent = '✓'; saveBtn.disabled = false;
                input.disabled = false; input.focus();
            } else {
                closeActivePopup();
            }
        };

        popup.querySelector('.fp-ipe-save').addEventListener('click', (e) => {
            e.stopPropagation();
            doSave();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')  { e.preventDefault(); doSave(); }
            if (e.key === 'Escape') { e.preventDefault(); closeActivePopup(); }
        });

        // Prevent popup clicks from bubbling to document
        popup.addEventListener('click', e => e.stopPropagation());
        popup.addEventListener('mousedown', e => e.stopPropagation());

        return popup;
    }

    // ── Chip attachment ───────────────────────────────────────────────────────

    function createPriceChip(lotLink) {
        if (lotLink.dataset.fpInlinePrice) return;
        const offerId = lotLink.getAttribute('data-offer') ||
            (lotLink.getAttribute('href') || '').match(/offer=(\d+)/)?.[1];
        if (!offerId) return;

        const priceEl = lotLink.querySelector('.tc-price');
        if (!priceEl) return;
        const priceDiv = priceEl.querySelector('div');
        if (!priceDiv) return;

        const priceMatch = priceDiv.textContent.replace(/\s+/g, ' ').trim().match(/([\d.,]+)/);
        if (!priceMatch) return;

        lotLink.dataset.fpInlinePrice = '1';

        // Make price cell look interactive
        priceEl.classList.add('fp-ipe-trigger');
        priceEl.title = 'Нажмите для редактирования цены';

        priceEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const currentText = priceDiv.textContent.replace(/\s+/g, ' ').trim();
            const match = currentText.match(/([\d.,]+)/);
            const currentPrice = match ? parseFloat(match[1].replace(',', '.')) : 0;

            createPopup(priceEl, currentPrice, async (newPrice) => {
                return await saveLotPrice(offerId, newPrice, priceEl);
            });
        });
    }

    // ── Save ──────────────────────────────────────────────────────────────────

    async function saveLotPrice(offerId, newPrice, priceEl) {
        try {
            // Цена — намерение для фоновой очереди лота: свежая форма читается там,
            // поэтому параллельные изменения активности или описания не откатываются.
            const nodeId = window.location.pathname.match(/\/(?:lots|chips)\/(\d+)/)?.[1] || '';
            await fptLotWrite({ offerId, nodeId, op: { type: 'setPrice', price: newPrice.toFixed(2) }, source: 'inline-price' });

            // Update displayed price
            const priceDiv = priceEl.querySelector('div');
            if (priceDiv) {
                const unitSpan = priceDiv.querySelector('.unit');
                const unitHtml = unitSpan ? unitSpan.outerHTML : '<span class="unit">₽</span>';
                priceDiv.innerHTML = `${newPrice.toFixed(2)} ${unitHtml}`;
            }

            showNotification(`Цена обновлена: ${newPrice.toFixed(2)} ₽`);
            return true;
        } catch (err) {
            showNotification(`Ошибка: ${err.message}`, true);
            return false;
        }
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    function attachChipsToPage() {
        document.querySelectorAll('a.tc-item[data-offer]').forEach(createPriceChip);
    }

    function initInlinePriceEditor() {
        if (!window.location.pathname.includes('/trade')) return;

        attachChipsToPage();

        const root = document.getElementById('content') || document.body;
        new MutationObserver(window.fptCoalesce?.(attachChipsToPage) || attachChipsToPage)
            .observe(root, { childList: true, subtree: true });

        // Close popup on outside click
        document.addEventListener('click', (e) => {
            if (_activePopup && !_activePopup.contains(e.target)) {
                closeActivePopup();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initInlinePriceEditor);
    } else {
        initInlinePriceEditor();
    }
})();
