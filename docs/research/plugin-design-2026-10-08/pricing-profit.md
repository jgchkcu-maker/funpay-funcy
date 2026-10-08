# Автоцены и прибыль — результат отдельного агента

Дата: 2026-10-08. Восстановлено по сохранённому отчёту /root/pricing_profit после обновления рабочей копии. Runtime не изменялся. Координатор отдельно перечитал lot_writer, exact_price и profit_engine, подтверждая основные замечания.

## Страницы и правило

Не создавать pricing_page. Правило конкретного лота и preview в content/ui/lot_io_page.js openBulkEditor:635/renderBulkDialog:651/renderPreview:990; переиспользовать cost_basis_editor.js:215 для детализации. Finance Hub renderPotential:918 — состояние/ссылка, renderProfit:803 — происхождение фактических затрат. Правило: источник себестоимости, наценка ИЛИ маржа, минимальная прибыль, шаг, потолок, allowRaise, период, freshness. Изменение правила само не пишет лот.

Preview: исходная форма/цена, quote/FX/mapping/policy revisions, целевая цена, срок и причины skip. При принятии фиксируются approved revision+task; внутри writer актуальное чтение. Изменившиеся условия требуют нового preview. Цена одного лота имеет одного policy owner; manual edit приостанавливает auto до нового принятия.

## Деньги и финансовые факты

По [официальной справке FunPay](https://funpay.freshdesk.com/support/solutions/articles/103000273187-%D0%BA%D0%BE%D0%BC%D0%B8%D1%81%D1%81%D0%B8%D0%B8) продавцу поступает указанная им сумма; покупатель платит больше. Не вычитать buyer commission повторно из sellerProceeds. Withdrawal fee — отдельный расход/явная оценка. Buyer total зависит от метода/валюты. section_commission.js и buyer_price_field.js строят коэффициент на пробных100000; exact_price.js предполагает линейность и путает подпись «получить» с суммой покупателя. Для buyer total использовать /lots/calc на конкретных inputs, не одну константу и не fallback к другой валюте.

Decimal strings+currency+purpose-specific quantum: цена единицы лота и итог платежа имеют разные precision. Не округлять всё до копеек. Неизвестный cost/FX не ноль; подтверждённый zero cost допустим. Supplier quote для полного количества учитывает units, tiers, fees, settlement currency. Local TTL не фиксирует provider price. Строгий maximum charge требует provider-enforced cap/locked quote, свежий GET не гарантирует его.

cost_basis_store.js:175 округляет до2знаков и теряет zero; createSnapshot:258 копирует cost лота без quantity. background/sales_db.js:185 закрепляет первый snapshot навсегда; profit_engine.js:127 считает его полной cost заказа. Обновление fpToolsCostBasis после закупки не чинит историю. Нужен immutable actualCost ledger с allocations и correcting events; legacy snapshot хранится как estimate. finance_data.js aggregateProfit:1545 соединяет по accountId+orderId, не по названию. Сумма allocations партии равна её стоимости с детерминированным остатком округления. Исторический FX не меняется сегодняшним курсом.

profit_engine сейчас полностью исключает refunded orders. Для внешней закупки это скрывает невозмещённые расходы: учитывать отдельно refund revenue, provider refund, retained cost и потерю, без двойного учёта. Финансовые «Операции» не превращать в журнал технических попыток.

## Floor и применение

Для подтверждённых затрат C, seller price S и явных переменных расходов E(S): N=S−C−E(S). Floor удовлетворяет minProfit и N/S≥minMargin. При E=0: max(C+minProfit, C/(1−minMargin)). Наценка25% даёт маржу20%, не25%. После округления вверх по шагу проверять итоговые ограничения повторно. Потолок ниже floor — нет безопасной цены, publication blocker; уже оплаченный заказ не закрывать/возвращать автоматически. Возможный новый расход сверх разрешения — решение продавца.

Конкурентный демпинг позднее: вручную подтверждённая эквивалентность региона/номинала/срока/активации/quantity/комплекта, исключить свои аккаунты, buyer totals сравнивать при одном методе/валюте. Ниже floor не идти. Без allowRaise не повышать; если floor вырос, останавливать новые продажи с причиной.

background/lot_writer.js нормализует price через toFixed(2): 0.003 и0.004 равны, changes/conflicts теряются. Нет общей очереди; expect не CAS. Все writers существующих offer должны идти через accountId+offerId queue, свежая полная форма и post-read. inline_price_editor.js:190 пишет напрямую, bulk_lot_editor.js:152 вызывает saveSingleLot; background.js:1909 допускает partial save при ошибке чтения, этот fallback убрать перед auto. Миграция не требует глобальной переделки unrelated UI.

Этапы: реальные money/quantity/settlement fixtures + decimal contracts → actualCost readonly join → общий writer/ownership → manual preview → bounded autoprice → competitors. В первом проходе 7/7 существующих lot_writer/finance_currency/t21_potential_stock_semantics tests прошли; отдельный вызов подтвердил дробный дефект. Новые проверки: tinyprice/conflict, multiunit+batch allocations, zero/unknown/currency mismatch, margin vs markup, expiredrevision, concurrentprice/active, crash afterapproval, unknownPOST, refunded paidprocurement. Проверка действующего FunPay HTML и каждого SKU ещё нужна.

## Поправка после независимого финального ревью

Предложение соединять actualCost «в aggregateProfit» было недостаточно точным. Сейчас finance_data.aggregateProfit:1545 — синхронный фасад для переданного массива, не слой чтения ledger. Безопасную проекцию actualCost следует загрузить и присоединить до этого вызова либо дать отдельный явный async API. Незаметная замена возвращаемого значения на Promise сломает существующие страницы. Перед первым effect нужен соответствующий минимум foundation; pricing preview не зависит от завершения всей supplier/fulfillment архитектуры.
