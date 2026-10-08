// Автовыключение и автовосстановление лотов выполняются в service worker
// (background/lot_availability.js) и работают даже при закрытой вкладке FunPay.
// Здесь остаётся только уведомление продавцу, если вкладка открыта.

function describeLotAvailabilityChange(change) {
    const title = String(change?.title || '').trim() || `Лот #${change?.offerId || ''}`;
    return change?.active
        ? `Лот "${title}" восстановлен: товары пополнены`
        : `Лот "${title}" деактивирован: товары закончились`;
}

chrome.runtime.onMessage.addListener((request) => {
    if (request?.action === 'fpToolsLotAvailabilityChanged') {
        showNotification(describeLotAvailabilityChange(request), false);
    }
});
