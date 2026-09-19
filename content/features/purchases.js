// content/features/purchases.js
// Статистика ПОКУПОК на странице /orders/ — переиспользует весь UI статистики
// продаж (карточки, графики, диаграммы, детально, полный), но с данными из
// отдельной базы покупок (FPTPurchasesDB) и лейблами «потрачено / продавец».
//
// Как это работает: блок статистики (getStatsBlockHTML, displaySalesStats,
// initSalesModes, sales_chart) читает источник данных через window.fptOrdersDB
// и подписи/действия через window.fptStatsCfg. Здесь мы выставляем оба значения
// в «режим покупок» ДО того, как content_script вызовет initializeSalesStatistics().

(function (root) {
    'use strict';

    const PURCHASES_CONFIG = {
        updateAction: 'updatePurchases',
        resetAction: 'resetPurchasesStorage',
        collectingKey: 'fpToolsPurchasesCollecting',
        lastUpdateKey: 'fpToolsPurchasesLastUpdate',
        filterKey: 'fpToolsPurchasesFilters',
        pathMatch: '/orders/',
        title: 'Статистика покупок',
        totalMoneyLabel: 'Всего потрачено',
        uniquePartyLabel: 'Уникальных продавцов',
        topPartyLabel: '🏆 Любимый продавец:',
        topTableLabel: 'Топ продавцов',
        countLabel: 'Покупок',
        moneyByDayLabel: 'Траты по дням, ₽',
        moneyByCurLabel: 'Траты по валютам',
        partyLabel: 'Продавец',
        refundLabel: 'Возвраты',
        totalOrdersLabel: 'Всего покупок',
        topDealLabel: '💎 Самая дорогая покупка:',
        chartHeading: 'Покупки',
        loadingTitle: 'Загружаем покупки…'
    };

    // Экспорт конфигурации покупок для повторного использования в Finance Hub
    if (typeof window !== 'undefined') {
        window.FPTPurchasesConfig = PURCHASES_CONFIG;
    }
    if (root) {
        root.FPTPurchasesConfig = PURCHASES_CONFIG;
    }

    // Это именно страница списка покупок «/orders/», а не продажи «/orders/trade»
    // и не конкретный заказ «/orders/CODE/».
    function isPurchasesIndex() {
        if (typeof window === 'undefined' || !window.location) return false;
        const p = window.location.pathname.replace(/\/+$/, '/'); // нормализуем хвостовой слэш
        // /orders/ — да; /orders/trade — нет; /orders/ABC123/ — нет
        return /^\/orders\/?$/.test(window.location.pathname);
    }

    if (!isPurchasesIndex()) return;

    // Переключаем общий статистический UI в режим покупок на странице /orders/.
    const db = (typeof FPTPurchasesDB !== 'undefined') ? FPTPurchasesDB : (typeof window !== 'undefined' ? window.FPTPurchasesDB : null);
    if (typeof window !== 'undefined') {
        window.fptOrdersDB = db;
        window.fptStatsCfg = PURCHASES_CONFIG;
    }
})(typeof window !== 'undefined' ? window : this);
