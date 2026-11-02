# Промпты для промо-изображений Funcy

Картинки для карточки Chrome Web Store:

| Что | Размер | Обязательно |
| --- | --- | --- |
| Small promo tile | 440×280 | Нет, но без неё карточка ниже в выдаче |
| Marquee promo tile | 1400×560 | Нет, нужна для попадания в подборки |
| Скриншоты | 1280×800 | Да, готовы в `screenshots/` |

## Правила магазина для промо

* Без логотипа, цветов и названия FunPay как главного элемента. Слово FunPay допустимо только мелко, в смысле «для FunPay».
* Без «№1», «лучшее», звёзд рейтинга, цен и скидок.
* Без чужих игр, персонажей и брендов.
* Мало текста: на small tile он должен читаться в размере 220×140.

## Фирменный стиль (вставлять в любой промпт)

> Brand style: deep indigo-to-violet gradient background (#1b1442 → #2a1d6b → #5137c9) with soft pink glow (#ff7ab6) in one corner and lavender light (#8d78ff) in the other. Accent color lavender #7663f6, white text. Rounded glassy UI cards with 24px corners, subtle frosted glass, soft long shadows, gentle glow. Modern, calm, premium SaaS look, like Linear or Raycast marketing. Clean geometric sans-serif typography (similar to Inter or Segoe UI Variable), bold headline. No real brand logos, no game characters, no photos of people.

Иконка Funcy: глянцевая буква F на сине-фиолетовом квадрате со скруглёнными углами и звёздочкой. Лучше вставлять настоящий `icons/icon128.png` поверх сгенерированного фона в редакторе (Figma, Photoshop), а не просить нейросеть нарисовать логотип.

Генераторы плохо пишут кириллицу. Надёжнее сгенерировать фон и композицию **без текста**, а заголовок добавить в редакторе. Ниже у каждого промпта есть вариант «без текста».

---

## 1. Small promo tile 440×280

**Идея:** иконка Funcy и плавающие карточки интерфейса: прибыль, автовыдача, переключатель. Сразу понятно, что это инструменты продавца, и видно, что красиво.

**Промпт (без текста, для генерации фона и композиции):**

> A small promotional banner, 440×280 pixels, landscape. Brand style: deep indigo-to-violet gradient background (#1b1442 → #5137c9) with a soft pink glow in the bottom-left corner and lavender light in the top-right. On the right half, three floating frosted-glass UI cards at slight angles with soft shadows: a small revenue card with a smooth lavender line chart going up, a card with a glowing violet toggle switch turned on, and a chat bubble card with a checkmark. Cards have 20px rounded corners, thin white borders at 20% opacity, tiny abstract UI lines instead of text. Left half intentionally empty for a logo and a headline. Soft depth of field, subtle grain, premium modern SaaS illustration, crisp edges, no text, no letters, no logos.

**Что добавить в редакторе:**
* Слева: иконка `icon128.png` (≈64 px) и под ней **Funcy**, белым, жирно, 40–44 px.
* Строка ниже, 16 px, 80% белого: **Инструменты продавца FunPay**.

**Вариант с текстом (если генератор умеет кириллицу, например GPT Image или Ideogram):**

> …same scene… On the left, the bold white wordmark "Funcy" and under it the smaller line "Инструменты продавца FunPay". Text perfectly legible, correct Cyrillic spelling.

---

## 2. Marquee 1400×560

**Идея:** «вся лавка в одном окне». В центре интерфейс Funcy, вокруг него крупные плашки преимуществ.

**Промпт (без текста):**

> A wide hero banner for a browser extension, 1400×560 pixels. Brand style: deep indigo-to-violet gradient (#1b1442 → #2a1d6b → #5137c9), large soft lavender light bloom behind the center-right, pink glow (#ff7ab6) at the far left bottom, faint dotted grid fading out toward the bottom. Center-right: a large tilted (about 8° perspective) app window mockup with a left sidebar and a dashboard of rounded cards — a revenue card with a smooth upward line chart, a profit card in mint green, a list of product rows with violet toggle switches — rendered as clean abstract UI without readable text. Around the window, four small floating glass chips with simple line icons: a lightning bolt (instant delivery), a chat bubble (auto-reply), a stack of cards (bulk edit), a paint palette (themes). Gentle motion feel: soft light streaks and tiny sparkles suggesting smooth animations. Left 40% of the canvas kept clean for a headline. Premium SaaS marketing illustration, Linear/Raycast aesthetic, high detail, no text, no letters, no logos.

**Что добавить в редакторе (левая часть):**
* Иконка Funcy 72 px и **Funcy**.
* Заголовок 52–56 px, белым: **Продавайте на FunPay быстрее**.
* Подзаголовок 22 px, 80% белого: **Автовыдача, автоответы, аналитика прибыли и свои темы — прямо в браузере, без бота и сервера.**

**Лучший вариант вместо сгенерированного окна:** взять настоящий кадр `screenshots/raw/finance.png`, наклонить его в редакторе (perspective ≈ 8°) и положить на сгенерированный фон. Тогда промо точно совпадёт с продуктом, а модератор не увидит функций, которых нет.

---

## 3. Альтернативные идеи marquee

**3a. «День продавца на автопилоте»** — временная шкала слева направо:

> Wide banner 1400×560, brand indigo-violet gradient. A horizontal glowing lavender timeline across the image with four glass nodes: a crescent moon (night order), a lightning bolt (instant automatic delivery), a chat bubble with a heart (thank-you message), a rising chart (profit). Each node casts soft light; thin light trails connect them, suggesting smooth animation. Minimal, elegant, premium, no text, no logos.

Подпись в редакторе: **Пока вы спите, Funcy выдаёт заказы и отвечает покупателям.**

**3b. «Красиво»** — витрина тем:

> Wide banner 1400×560. Three overlapping rounded browser-window cards fanned out like playing cards, each showing the same abstract marketplace layout in a different theme: misty forest dark green, deep ocean blue with light rays, warm sunset violet. Glass reflections, soft shadows, lavender glow behind, brand indigo-violet gradient background, no text, no logos, no real website content.

Подпись: **FunPay в вашем стиле. Свои цвета, фоны и видеофоны.**

---

## 4. Оформление скриншотов (если захотите перерисовать в другом стиле)

Готовые 1280×800 собирает скрипт `tools/store-screenshots-frame.cjs`. Тексты и цвета меняются в нём, после чего достаточно запустить скрипт заново.

Промпт для фона под скриншот, если нужен свой:

> Background for an app screenshot, 1280×800. Brand indigo-violet gradient (#1b1442 → #5137c9), soft lavender bloom top-right, pink glow bottom-left, faint dotted grid fading downward, a subtle glossy light streak. Top 30% empty for a headline, bottom 70% empty for a screenshot. No text, no objects, no logos.

## Преимущества для текстов (только проверенные факты)

1. **Работает в браузере**: не нужен бот, Python, VPS или отдельный сервер. Вкладку FunPay можно закрыть.
2. **Автовыдача без повторов**: журнал каждой отправки, при сбое сети товар повторно не уходит без решения продавца.
3. **Прибыль, а не только выручка**: себестоимость, чистая прибыль, потенциал склада.
4. **Массовый редактор**: цены в процентах, округление, «цена для покупателя» с учётом комиссии, поиск и замена с предпросмотром, расписание продаж.
5. **Несколько аккаунтов**: переключение в один клик, настройки у каждого аккаунта свои.
6. **Свои темы для FunPay**: цвета, фон, видеофон, шрифты, стекло, плавные анимации.
7. **Приватность**: данные только в браузере, своего сервера и аналитики нет.

Не пишите в промо «единственное» или «лучшее»: модераторы и пользователи требуют доказательств таких слов.
