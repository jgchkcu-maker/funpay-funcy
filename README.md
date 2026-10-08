<div align="center">

<img src=".github/assets/hero.svg" width="100%" alt="FunPay Funcy — лучшее расширение для продавцов FunPay"/>

<br/><br/>

<a href="https://chromewebstore.google.com/detail/funpay-tools/pibmnjjfpojnakckilflcboodkndkibb/"><img src=".github/assets/btn-install.svg" height="64" alt="Установить в Chrome"/></a>
&nbsp;
<a href="#-для-разработчиков"><img src=".github/assets/btn-source.svg" height="64" alt="Исходный код"/></a>

<br/><br/>

<img src="https://img.shields.io/badge/v2.9.9-0a0612?style=for-the-badge&logo=googlechrome&logoColor=c084fc" alt="v2.9.9"/>
<img src="https://img.shields.io/badge/MIT-0a0612?style=for-the-badge&logo=opensourceinitiative&logoColor=c084fc" alt="MIT"/>
<img src="https://img.shields.io/github/stars/jgchkcu-maker/funpay-funcy?style=for-the-badge&logo=github&logoColor=c084fc&label=&color=0a0612" alt="stars"/>
<img src="https://img.shields.io/github/last-commit/jgchkcu-maker/funpay-funcy?style=for-the-badge&logo=git&logoColor=c084fc&label=&color=0a0612" alt="last commit"/>

<br/><br/>

<img src=".github/assets/stats.svg" width="100%" alt="299+ инструментов · 360+ автотестов · 0 зависимостей · Manifest V3"/>

<br/><br/>

<img src=".github/assets/flow.svg" width="100%" alt="Покупатель оплатил → автовыдача → автоответ → ответ на отзыв → бонус"/>

<br/><br/>

<img src=".github/assets/h-ai.svg" width="100%" alt="Искусственный интеллект"/>
<img src=".github/assets/cards-ai.svg" width="100%" alt="Ассистент в чате, генератор лотов, ответ на отзывы, переводчик, генератор превью"/>

<br/><br/>

<img src=".github/assets/h-auto.svg" width="100%" alt="Автоматизация"/>
<img src=".github/assets/cards-auto.svg" width="100%" alt="Автоподнятие, автовыдача, автоответчик, статистика продаж, аналитика рынка, таймер заказов"/>

</div>

<details>
<summary>&nbsp;<b>🤖 Всё, что умеет автоответчик</b></summary>
<br/>

| | |
| :--- | :--- |
| **Фоновая работа** | Отдельный движок с защитой от сна — работает даже при свёрнутом браузере |
| **Авто-приветствие** | Новым покупателям, с кулдауном и фильтром системных сообщений |
| **Триггеры** | Оплата заказа и подтверждение получения |
| **Отзывы** | Свой шаблон на каждую оценку от 1 до 5★ и бонус за 5★ |
| **Команды** | `!реквизиты` и любые свои триггеры |
| **Переменные** | `{buyername}` `{lotname}` `{orderid}` `{orderlink}` `{ai:пожелай хорошего дня}` |
| **Картинки** | В шаблонах, с выбором порядка: текст или фото первым |
| **Естественность** | Имитация набора текста перед отправкой |
| **Анти-спам** | Не отвечает сам себе, не флудит, игнорирует рассылки FunPay |

</details>

<div align="center">

<br/>

<img src=".github/assets/h-chat.svg" width="100%" alt="Чат"/>
<img src=".github/assets/cards-chat.svg" width="100%" alt="Фото с текстом, фоторедактор, лайтбокс, поиск по чату, автоперевод, слеш-команды"/>

</div>

<details>
<summary>&nbsp;<b>💬 И ещё в чате</b></summary>
<br/>

Черновики не теряются между чатами · история покупок собеседника · экспорт переписки в `.txt` · ответы на конкретные сообщения · заметки с автосохранением · «Прочитать всё» одним кликом · цветные метки покупателей · метка «Свой-Чужой» для пользователей Funcy

</details>

<div align="center">

<br/>

<img src=".github/assets/h-tools.svg" width="100%" alt="Инструменты продавца"/>
<img src=".github/assets/cards-tools.svg" width="100%" alt="Экспорт и импорт лотов, копирование лота, поиск продавца, менеджер аккаунтов, тикеты, чёрный список"/>

<br/><br/>

<img src=".github/assets/h-style.svg" width="100%" alt="Кастомизация"/>
<img src=".github/assets/cards-style.svg" width="100%" alt="Настройка словами, темы и фоны, тёмная тема, Live Styler, шрифты, звук уведомлений"/>

<br/><br/>

<img src=".github/assets/h-install.svg" width="100%" alt="Установка"/>
<a href="https://chromewebstore.google.com/detail/funpay-tools/pibmnjjfpojnakckilflcboodkndkibb/"><img src=".github/assets/install.svg" width="100%" alt="1. Открыть Chrome Web Store 2. Установить 3. Зайти на FunPay"/></a>

<br/><br/>

<a id="-для-разработчиков"></a>
<img src=".github/assets/h-dev.svg" width="100%" alt="Для разработчиков"/>

</div>

```bash
git clone https://github.com/jgchkcu-maker/funpay-funcy.git
```

Откройте `chrome://extensions` → включите **режим разработчика** → **«Загрузить распакованное»** → выберите папку проекта. Правите файл — нажимаете ↻ у расширения — готово.

```text
funpay-funcy/
├── background/   service worker: автоответчик, автоподнятие, автовыдача, планировщик
├── content/      всё, что работает на страницах FunPay: фичи, меню, темы
├── popup/        окно расширения
├── offscreen/    парсинг HTML в фоне
├── css/          стили и темы
├── tests/        автотесты на node:test
└── manifest.json
```

```bash
node --test tests/*.test.js
```

<div align="center">

<br/>

<a href="https://github.com/jgchkcu-maker/funpay-funcy/issues/new/choose"><img src="https://img.shields.io/badge/Нашли_баг%3F-Откройте_issue-0a0612?style=for-the-badge&logo=github&logoColor=c084fc&labelColor=a855f7" alt="issue"/></a>

<br/><br/>

<a href="https://star-history.com/#jgchkcu-maker/funpay-funcy&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=jgchkcu-maker/funpay-funcy&type=Date&theme=dark"/>
    <img src="https://api.star-history.com/svg?repos=jgchkcu-maker/funpay-funcy&type=Date" width="640" alt="Star history"/>
  </picture>
</a>

<sub>Помогло заработать — поставьте ⭐ · Лицензия <a href="LICENSE">MIT</a></sub>

<img src=".github/assets/footer.svg" width="100%" alt=""/>

</div>
