// Popup actions accept explicit values; no legacy view is mounted.
let fptStockLots = {}, fptStockLotsVersion = 0, fptStockLotsRead = null;
function loadStockLotsOnce() {
    if (!fptStockLotsRead) {
        const version = fptStockLotsVersion;
        fptStockLotsRead = chrome.storage.local.get('fpToolsAutoDeliveryLots').then(data => {
            if (version === fptStockLotsVersion) fptStockLots = data.fpToolsAutoDeliveryLots || {};
        }).catch(error => { fptStockLotsRead = null; console.error('FunPay Funcy [stock]', error); });
    }
    return fptStockLotsRead;
}
async function initStockCounterDisplay() {
    if (!window.location.pathname.match(/\/users\/\d+\/?/)) return;

    await loadStockLotsOnce();
    const fpToolsAutoDeliveryLots = fptStockLots;
    if (!Object.keys(fpToolsAutoDeliveryLots).length) return;

    document.querySelectorAll('a.tc-item:not(.fp-stock-init)').forEach(row => {
        row.classList.add('fp-stock-init');
        const offerMatch = row.getAttribute('href')?.match(/id=(\d+)/);
        if (!offerMatch) return;
        const lotId = offerMatch[1];
        const config = fpToolsAutoDeliveryLots[String(lotId)];
        if (config?.enabled === false) return;

        const priceEl = row.querySelector('.tc-price');
        if (!priceEl) return;

        const count = Number.isInteger(config.productCount) && config.productCount >= 0
            ? config.productCount
            : null;
        const hasStock = count !== null;
        const badge = document.createElement('span');
        badge.style.cssText = `
            font-size:10px;font-weight:700;border-radius:3px;padding:1px 4px;margin-left:4px;
            background:${!hasStock ? 'rgba(130,130,145,0.12)' : count > 3 ? 'rgba(76,175,130,0.15)' : count > 0 ? 'rgba(255,152,0,0.15)' : 'rgba(224,82,82,0.15)'};
            color:${!hasStock ? '#8a8a96' : count > 3 ? '#4caf82' : count > 0 ? '#ff9800' : '#e05252'};
            border:1px solid ${!hasStock ? 'rgba(130,130,145,0.25)' : count > 3 ? 'rgba(76,175,130,0.3)' : count > 0 ? 'rgba(255,152,0,0.3)' : 'rgba(224,82,82,0.3)'};
            vertical-align:middle;
        `;
        badge.textContent = hasStock ? String(count) : '—';
        badge.title = !hasStock ? 'Остаток не отслеживается' : count > 0 ? `${count} товаров в авто-выдаче` : 'Товары закончились!';
        priceEl.appendChild(badge);
    });
}

const scheduleStockCounters = window.fptCoalesce?.(initStockCounterDisplay, { name: 'stock' }) || initStockCounterDisplay;
let stockCounterObserver = null;
function bootStockCounters() {
    if (!/\/users\/\d+\/?/.test(window.location.pathname)) return;
    initStockCounterDisplay();
    if (stockCounterObserver) return;
    stockCounterObserver = new MutationObserver(scheduleStockCounters);
    stockCounterObserver.observe(document.body, { childList: true, subtree: true });
}
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.fpToolsAutoDeliveryLots) return;
    fptStockLotsVersion++;
    fptStockLots = changes.fpToolsAutoDeliveryLots.newValue || {};
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootStockCounters);
else bootStockCounters();
window.fptOnUrlChange?.(bootStockCounters);

if (typeof window !== 'undefined' && window.fptPopupActions) {
    window.fptPopupActions.register('auto_delivery', 'fp-load-delivery-lots-btn', async p => {
        const app = JSON.parse(document.body?.dataset.appData || '{}');
        const userId = p.userId || (Array.isArray(app) ? app[0] : app).userId;
        if (!userId) throw new Error('Не удалось определить пользователя FunPay');
        const lots = await chrome.runtime.sendMessage({ action: 'getUserLotsList', userId });
        if (lots?.success === false) throw new Error(lots.error || 'Не удалось загрузить список лотов.');
        if (!Array.isArray(lots)) throw new Error('FunPay не вернул список лотов. Попробуйте загрузить ещё раз.');
        p.onProgress?.({ stage: 'stock', current: 0, total: lots.length });
        const stockResult = lots.length
            ? await chrome.runtime.sendMessage({ action: 'syncAutoDeliveryStockCounts', lots })
            : { success: true, counts: {}, errors: [] };
        if (stockResult?.success === false) throw new Error(stockResult.error || 'Не удалось обновить остатки.');
        const { fpToolsAutoDeliveryLots = {} } = await chrome.storage.local.get('fpToolsAutoDeliveryLots');
        p.onProgress?.({ stage: 'done', current: lots.length, total: lots.length });
        return {
            lots,
            config: fpToolsAutoDeliveryLots,
            stockCounts: stockResult?.counts || {},
            stockErrors: stockResult?.errors || []
        };
    });
    window.fptPopupActions.register('auto_delivery', 'autoSaveDeliveryLot', async p => {
        if (!p.lotId || !p.settings) throw new Error('Укажите лот и настройки.');
        const result = await chrome.runtime.sendMessage({
            action: 'saveAutoDeliveryLot',
            lotId: String(p.lotId),
            settings: p.settings
        });
        if (result?.success === false) throw new Error(result.error || 'Не удалось сохранить настройки лота.');
        return result?.data;
    });
}
