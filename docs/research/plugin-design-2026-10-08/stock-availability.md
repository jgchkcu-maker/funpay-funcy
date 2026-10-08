# Остатки и доступность — результат отдельного агента

Дата: 2026-10-08. Восстановлено по сохранённому отчёту /root/stock_availability после обновления рабочей копии. Runtime не изменялся.

## Разные источники товара

LocalPool — принадлежащие продавцу коды/аккаунты с стоимостью партии; FunPayStockSnapshot — удалённый склад/secrets FunPay; SupplierSnapshot — наблюдаемое наличие у поставщика, не наш актив; LotPolicy — решение о публикации. Сегодня productCount из auto_delivery_store syncLots — только снимок FunPay, не local stock. Ошибка sync сохраняет старое значение без fetchedAt/TTL. Нельзя строить запуск продаж на таком положительном кеше.

Текущий stock store ops_db существует как основа, но reserve API отсутствует. Local reserve выбирает все quantity×unitsPerSale FIFO в одной multi-store транзакции с reservation и pending attempt; недостаток откатывает всё, сеть только после commit. Повтор того же order fingerprint получает те же items. Supplier source резервирует бюджет, не несуществующий localpool. Один dispatcher закрепляет ровно один source на заказ.

Unknown/partial/crash/refund не возвращают коды в free. Раскрытые коды quarantine/used; освобождение только по доказательству невыдачи/решению с evidence. Общий BOT_MARKER не доказывает конкретную доставку, отсутствие в загруженной истории не доказывает неотправку. Нужны partId/hash/receipts и ручная сверка. Cost партии распределяется allocations ровно по units, общие pools не считать дважды для нескольких лотов. Suppliercatalog не входит в стоимость активов.

## Одно решение активности

LotPolicy: accountId,offerId,revision,manageActive,manualIntent:auto/on/off,sourceBinding,scheduleId. Resolver объединяет stock/schedule/price/budget/config holds; manualoff постоянен, manualon не обходит safety holds. Выключенный при подключении лот не является выключенным нами; включение только после opt-in+ownership evidence. По boolean нельзя увидеть off-в-команду ужеoff, поэтому явный «Не включать автоматически». Наблюдаемое внешнее расхождение останавливает управление до принятия.

Snapshot kind finite/unbounded/unknown/unsupported + observedAt,validUntil,error. Stale не разрешает autoactivate. Нет qty в API — не infinity; возможен явно выбранный check-on-purchase с конечным опубликованным лимитом и понятным риском. Default supplier policy при утрате достоверности — pause new sales; уже оплаченные обязательства отдельно. Providerpoll общей очередью по providerAccount/SKU с quota/backoff/jitter/RetryAfter, persisted nextPollAt; outstanding orders имеют приоритет. Snapshot не резервирует внешний товар.

Сегодня lot_availability.js:22 активирует произвольный inactive при count>0; candidates не фильтруют config.enabled; sweep читает fresh form, но quantity берёт старый config. auto_delivery_store.js syncLots сохраняет stalecount без TTL. Один writer queue должен обслуживать все изменения полной формы; expect не серверный CAS. Scope accountId+epoch; старые записи без доказанного аккаунта quarantine.

## UI, этапы, проверки

В существующей «Автовыдаче» — source selector, age, free/reserved/quarantine, причины pause и opt-in управления. Local pools/партии/резервы — вкладки/карточки этой страницы, отдельная «Склад» в nav не нужна. Remote FunPay editor подписать как склад FunPay; supplier stock показывать как внешнее наличие. Журнал заказов — отдельная вкладка рядом, проблемы лотов и проблемы выдачи различать. В Finance — owned local assets и фактические allocations, не стоимость каталога поставщика.

Этапы: строгий order/account/transaction/resolver preview → localpool+manualrecovery → строгая отправка с partreceipts+actualcost → suppliersnapshots/budget. Для одного providerSKU может быть несколько offer; reserve budget по общему providerwallet.

Первый агент выполнил 18/18 existing tests auto_delivery_stock/lot_writer/ops_journal/auto_restore_alarm. Новые обязательные проверки: два заказа на последний item, резерв N единиц/allrollback, duplicateorder, crash послеcommit/послеsend, partial/uncertain неrelease, ручноеoff и adoptioninactive, stale0/positive/unknown, смена аккаунта, два modulehold, конкурентное price/active, точная batch allocation. Текущие тесты не доказывают этих новых гарантий.
