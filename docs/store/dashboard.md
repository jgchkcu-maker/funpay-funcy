# Ответы для кабинета Chrome Web Store (Funcy 0.9.12)

Сверено с официальной документацией Chrome Web Store 2 ноября 2026 года. Английские тексты обоснований можно копировать в соответствующие поля. Собственные контактные данные, публичный URL политики и доступ для проверки заполняет владелец.

## Порядок заполнения

1. Откройте https://chrome.google.com/webstore/devconsole и выберите издателя.
2. В «Продукты / Items» нажмите «Новый элемент / Add new item» и загрузите `dist/funcy-0.9.12.zip`. Если карточка Funcy уже создана, откройте её и используйте «Package → Upload new package», сохранив тот же ID расширения. Для обновления уже опубликованной версии требуется более высокий номер версии.
3. Заполните Store listing, Privacy practices, Distribution и Test instructions по разделам ниже, сохраните черновик.
4. После живой проверки и решения вопросов с правами на ресурсы нажмите «Submit for review». При желании снимите «Publish automatically», чтобы после одобрения самостоятельно выбрать момент публикации.

## Вкладка «Privacy practices»

### Single purpose (единственное назначение)

> Funcy helps sellers manage their FunPay store directly in the browser. Its lot, order, chat, delivery and sales reporting tools support this single workflow on FunPay, with site appearance settings for the same workspace.

### Permission justification

| Поле | Текст |
| --- | --- |
| storage | Stores the user's settings, templates, delivery journal, sales statistics and saved FunPay accounts locally in the browser. |
| cookies | Reads FunPay session cookies (golden_key, PHPSESSID) for authenticated FunPay requests and locally saved accounts. Changes session cookies when the user switches accounts or manually checks a saved account. Session credentials are never sent to the developer, Google Translate or the theme catalogue. |
| alarms | Schedules background checks and saved deadlines for user-enabled auto-replies, delivery, lot bumping and lot schedules while Chrome is running. |
| offscreen | Parses FunPay HTML pages with DOMParser in an offscreen document, because the service worker has no DOM. |
| Host permission: funpay.com, *.funpay.com, sfunpay.com, *.sfunpay.com | The extension works on FunPay pages and calls FunPay for the user's lots, chats, orders and finances. sfunpay.com hosts FunPay's static files and cookies. |
| Host permission: support.funpay.com | Applies the user's theme to FunPay support pages and lets the user read and answer support tickets. |
| Host permission: translate.googleapis.com | Translates chat messages and lot fields the user chose to translate, after the user allows it in a consent dialog. |

### Remote code

**No, I am not using remote code.** Все скрипты лежат в пакете; с GitHub загружаются только JSON каталога тем и изображения или видео обоев, но не код.

### Data usage (отметить галочки)

| Категория | Отметить | Почему |
| --- | --- | --- |
| Personally identifiable information | ✅ | Имена покупателей и ID аккаунтов FunPay в заказах и чатах |
| Health information | — | |
| Financial and payment information | ✅ | Суммы продаж, баланс и история заказов FunPay для аналитики |
| Authentication information | ✅ | Сессионные cookies FunPay для сохранённых аккаунтов |
| Personal communications | ✅ | Сообщения чатов FunPay (автоответы, выдача, перевод) |
| Location | — | |
| Web history | — | |
| User activity | — | |
| Website content | ✅ | Содержимое страниц FunPay: лоты, заказы, отзывы |

Подтвердить все три пункта:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

Эти отметки раскрывают обработку данных самим расширением, включая локальное хранение. Не выбирайте «не собирает и не использует данные»: локальная обработка также подлежит раскрытию. Перевод передаёт выбранный текст Google Translate для заявленной функции после явного согласия; это должно быть отражено и в политике. Три подтверждения ставьте после проверки их соответствия вашей фактической практике.

### Privacy policy URL

Готовый публичный URL: **https://jgchkcu-maker.github.io/funpay-funcy/privacy-policy.html**. Страница опубликована через GitHub Pages из `main` → `/docs`; проверены HTTP 200, UTF-8 и актуальная редакция 0.9.12. Скопируйте этот адрес в поле «URL политики конфиденциальности» и сохраните черновик.

## Вкладка «Store listing»

| Поле | Значение |
| --- | --- |
| Name / Название | Funcy (берётся из manifest пакета) |
| Summary / Краткое описание | Неофициальное расширение для FunPay: автоответы, выдача, заказы, аналитика и управление лотами. (берётся из manifest) |
| Detailed description | Основное описание из `listing.md`, без раздела «Перед подачей» |
| Category | Workflow & Planning — инструменты для работы продавца |
| Language | Русский / Russian |
| Store icon | `icons/icon128.png`, 128×128 PNG |
| Screenshots | Пять файлов `docs/store/screenshots/01-analytics.png` … `05-themes.png`, 1280×800; требуется минимум один |
| Promotional video | Необязательно: ссылка на публично доступное или доступное по ссылке видео YouTube с демонстрацией |
| Small promo tile | Готово через ImageGen: `upload-imagegen/06-small-promo-440x280.png`, 440×280, PNG без альфа-канала |
| Marquee promo tile | Готово через ImageGen: `upload-imagegen/07-marquee-1400x560.png`, 1400×560, PNG без альфа-канала |
| Homepage / Website | https://github.com/jgchkcu-maker/funpay-funcy — предварительно убедитесь, что репозиторий публичный |
| Support URL | https://github.com/jgchkcu-maker/funpay-funcy/issues — должен открываться пользователям |
| Official URL | Если поле требует подтверждения владения сайтом, оставьте пустым до подтверждения; FunPay вам не принадлежит |

Актуальный комплект с обоими промо, целиком сгенерированными через ImageGen: `docs/store/upload-imagegen/`. В нём иконка, пять скриншотов, два промо, `description.txt` для поля «Описание» и `fields.txt` с памяткой. Архив: `docs/store/funcy-store-assets-imagegen-0.9.12.zip`. Его нужно распаковать и загрузить отдельные изображения; пакет самого расширения остаётся в `dist/funcy-0.9.12.zip`.

## Вкладка «Distribution»

* Для общедоступного выпуска выберите **Public**. **Unlisted** позволяет устанавливать по прямой ссылке, **Private** — указанным тестировщикам. Все три режима проходят проверку магазина.
* Регионы: **All regions**, если вы хотите доступность во всех поддерживаемых магазином странах; либо нужный вам список стран.
* Если кабинет спрашивает цену: **Free** для текущего бесплатного выпуска.

## Инструкции для модератора (Test instructions)

> Funcy extends the FunPay seller workspace. Click the extension toolbar icon to see the extension entry screen. For the seller tools, sign in at https://funpay.com, open a seller profile or chat, then click the Funcy button in the site header. Browse the menu sections for lots, quick replies, auto-replies, delivery, sales reports and appearance settings. Automations are off by default. Translation asks for consent before sending any selected text to Google Translate. Use only synthetic delivery content when testing message sending or delivery.

Если функции требуют входа, укажите это в Test instructions и предоставьте отдельный тестовый аккаунт с достаточным доступом через закрытые поля кабинета. Учётные данные основного аккаунта, cookies и товары в описание магазина не вставляйте. Если нужна двухэтапная проверка или есть ограничения доступа, объясните, как проверяющему получить доступ. Добавьте ссылку на демонстрацию, когда видео действительно готово; не отправляйте шаблон с незаполненной ссылкой. Видео дополняет доступ к функциям, но не гарантирует, что модератору не понадобится тестовый вход.

## Аккаунт разработчика

* Включить двухэтапную проверку Google-аккаунта.
* Подтвердить контактный email, который вы читаете: на него приходят результаты проверки.
* В имени издателя укажите выбранное вами публичное название; юридические и контактные поля заполняйте реальными данными, если кабинет их требует.
* Заполнить статус trader / non-trader по реальному характеру деятельности. Trader — публикация в рамках бизнеса, торговли или профессии; non-trader — вне такой деятельности. Бесплатность расширения сама по себе не определяет статус. Для trader магазин проверяет и публикует предусмотренные формой сведения; не придумывайте адрес и телефон.
* Если регистрация разработчика ещё не завершена, завершите её и оплатите показанный кабинетом разовый регистрационный сбор. Повторно регистрироваться для новой карточки не нужно.

## Официальные источники

* Загрузка пакета и отправка: https://developer.chrome.com/docs/webstore/publish
* Поля карточки: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
* Категории расширений: https://developer.chrome.com/docs/webstore/best-practices
* Размеры и обязательность изображений: https://developer.chrome.com/docs/webstore/images
* Декларации данных: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
* Локальная обработка тоже раскрывается: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
* Видимость и регионы: https://developer.chrome.com/docs/webstore/cws-dashboard-distribution
* Статус издателя: https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure
