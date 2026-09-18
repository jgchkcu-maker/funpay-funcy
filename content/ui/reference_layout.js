(() => {
    'use strict';

    const q = (root, selector) => root?.querySelector(selector) || null;
    const qa = (root, selector) => Array.from(root?.querySelectorAll(selector) || []);

    function el(tag, className, html) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (html !== undefined) node.innerHTML = html;
        return node;
    }

    function panel(title, icon = 'tune', className = '') {
        const box = el('section', `fpf-ref-panel ${className}`);
        const head = el('div', 'fpf-ref-panel-head');
        head.innerHTML = `<span class="fpf-ref-panel-icon material-symbols-rounded">${icon}</span><div class="fpf-ref-panel-title">${title}</div>`;
        const body = el('div', 'fpf-ref-panel-body');
        box.append(head, body);
        return { box, body, head };
    }

    function move(node, target) {
        if (node && target && node.parentElement !== target) target.appendChild(node);
        return node;
    }

    function moveAll(nodes, target) {
        nodes.filter(Boolean).forEach((node) => move(node, target));
    }

    function directChildren(page) {
        return Array.from(page?.children || []);
    }

    function hideHeading(node) {
        if (node) node.classList.add('fpf-ref-source-heading');
    }

    function composeDashboard(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-dashboard-page');

        const titles = qa(page, ':scope > .fpt-dashboard-section-title');
        const status = q(page, ':scope > .fpt-status-hub');
        const presets = q(page, ':scope > .fpt-presets-grid');
        const quick = q(page, ':scope > .fpt-quick-actions-bar');
        const features = q(page, ':scope > .feature-list-container');

        titles.forEach(hideHeading);

        if (status) {
            const p = panel('Статус модулей', 'widgets', 'fpf-ref-dashboard-status');
            move(status, p.body);
            page.insertBefore(p.box, page.firstChild);
        }

        if (presets) {
            const p = panel('Быстрые пресеты', 'bolt', 'fpf-ref-dashboard-presets');
            move(presets, p.body);
            page.insertBefore(p.box, quick || features || null);
        }

        if (quick) {
            const p = panel('Быстрые действия', 'flash_on', 'fpf-ref-dashboard-actions');
            move(quick, p.body);
            page.insertBefore(p.box, features || null);
        }

        if (features) {
            const p = panel('Возможности FunPay Funcy', 'apps', 'fpf-ref-dashboard-features');
            move(features, p.body);
            page.appendChild(p.box);
        }
    }

    function composeAutobump(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-automation-page');

        const heading = q(page, ':scope > h3');
        const intro = q(page, ':scope > .template-info');
        const cards = qa(page, ':scope > .fpt-setting-card');
        const consoleNode = q(page, '#autoBumpConsole');
        const consoleLabel = consoleNode?.previousElementSibling;

        hideHeading(heading);

        if (cards[0]) {
            cards[0].classList.add('fpf-ref-master-card');
            const masterTitle = q(cards[0], '.fpt-setting-title span:first-child');
            if (masterTitle) masterTitle.textContent = 'Авто-поднятие объявлений';
            if (intro) move(intro, cards[0].querySelector('.fpt-setting-info') || cards[0]);
        }

        const grid = el('div', 'fpf-ref-two-column');
        const rules = panel('Правила автоматизации', 'format_list_bulleted', 'fpf-ref-rules-panel');
        moveAll(cards.slice(1), rules.body);
        grid.appendChild(rules.box);

        const log = panel('Журнал выполнения', 'history', 'fpf-ref-log-panel');
        if (consoleLabel) hideHeading(consoleLabel);
        if (consoleNode) move(consoleNode, log.body);
        if (!consoleNode) log.body.innerHTML = '<div class="fpf-ref-empty">История появится после первого запуска.</div>';
        grid.appendChild(log.box);
        page.appendChild(grid);

        const tip = el('div', 'fpf-ref-tip');
        tip.innerHTML = '<span class="material-symbols-rounded">lightbulb</span><div><b>Совет</b><span>Разделяйте правила для разных категорий: так проще контролировать поднятие и исключения.</span></div>';
        page.appendChild(tip);
    }

    function composeAutoDelivery(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-automation-page');

        const heading = q(page, ':scope > h3');
        const intro = q(page, ':scope > .template-info');
        const promo = q(page, ':scope > .support-promo');
        const cards = qa(page, ':scope > .fpt-setting-card');
        const lotButton = q(page, '#fp-load-delivery-lots-btn');
        const lotList = q(page, '#fp-delivery-lots-list');
        const lotHeading = lotButton ? Array.from(page.children).find(n => n.tagName === 'H4' && n.textContent.includes('авто-выдачи')) : null;
        const lotInfo = lotHeading?.nextElementSibling?.classList?.contains('template-info') ? lotHeading.nextElementSibling : null;

        hideHeading(heading);

        const master = panel('Авто-выдача товаров', 'local_shipping', 'fpf-ref-feature-panel');
        moveAll([intro, promo], master.body);
        page.insertBefore(master.box, page.firstChild);

        if (cards.length) {
            const settings = panel('Настройки автоматизации', 'tune');
            const grid = el('div', 'fpf-ref-card-grid');
            cards.forEach(card => grid.appendChild(card));
            settings.body.appendChild(grid);
            page.appendChild(settings.box);
        }

        const lots = panel('Товары для авто-выдачи', 'inventory_2', 'fpf-ref-lots-panel');
        hideHeading(lotHeading);
        moveAll([lotInfo, lotButton, lotList], lots.body);
        page.appendChild(lots.box);
    }

    function composeAutoReview(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-review-page');
        hideHeading(q(page, ':scope > h3'));

        const enabled = q(page, '#autoReviewEnabled')?.closest('.checkbox-label-inline');
        const intro = enabled?.nextElementSibling?.classList?.contains('template-info') ? enabled.nextElementSibling : q(page, ':scope > .template-info');
        const variables = q(page, ':scope > .template-variables-guide');
        const templates = q(page, ':scope > .review-templates-grid');

        const top = el('div', 'fpf-ref-two-column');
        const control = panel('Авто-ответы на отзывы', 'reviews');
        moveAll([enabled, intro], control.body);
        top.appendChild(control.box);

        if (variables) {
            const help = panel('Переменные', 'data_object');
            move(variables, help.body);
            top.appendChild(help.box);
        }
        page.prepend(top);

        if (templates) {
            const p = panel('Шаблоны ответов', 'star');
            move(templates, p.body);
            page.appendChild(p.box);
        }
    }

    function composeTemplates(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-chat-page');

        const headings = qa(page, ':scope > h3');
        headings.forEach(hideHeading);

        const toggles = qa(page, ':scope > .checkbox-label-inline');
        const info = q(page, ':scope > .template-info:not(.image-upload-warning)');
        const variables = q(page, ':scope > .template-variables-guide');
        const imageTip = q(page, ':scope > .image-upload-warning');
        const list = q(page, '#template-settings-container');
        const add = q(page, '#addCustomTemplateBtn');

        const grid = el('div', 'fpf-ref-chat-grid');

        const left = panel('Шаблоны сообщений', 'dashboard_customize', 'fpf-ref-chat-settings');
        moveAll([...toggles, info], left.body);

        const center = panel('Редактор шаблонов', 'edit_note', 'fpf-ref-chat-editor');
        const search = el('div', 'fpf-ref-inline-search');
        search.innerHTML = '<span class="material-symbols-rounded">search</span><input type="search" class="fpf-template-filter" placeholder="Поиск по шаблонам..." aria-label="Поиск по шаблонам">';
        center.body.appendChild(search);
        moveAll([list, add], center.body);

        const right = panel('Подсказки', 'tips_and_updates', 'fpf-ref-chat-help');
        moveAll([variables, imageTip], right.body);

        grid.append(left.box, center.box, right.box);
        page.appendChild(grid);

        const input = q(center.body, '.fpf-template-filter');
        if (input && list) {
            input.addEventListener('input', () => {
                const needle = input.value.trim().toLowerCase();
                qa(list, ':scope > *').forEach(row => {
                    row.style.display = !needle || row.textContent.toLowerCase().includes(needle) ? '' : 'none';
                });
            });
        }
    }

    function composeNotes(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-simple-page');
        hideHeading(q(page, ':scope > h3'));
        const p = panel('Заметки', 'edit_note', 'fpf-ref-notes-panel');
        moveAll(directChildren(page).filter(n => !n.classList.contains('fpf-ref-source-heading')), p.body);
        page.appendChild(p.box);
    }

    function composeBlacklist(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-simple-page');
        hideHeading(q(page, ':scope > h3'));
        const form = q(page, '#fp-bl-add-btn')?.parentElement;
        const list = q(page, '#fp-bl-list');
        const info = q(page, ':scope > .template-info');

        const grid = el('div', 'fpf-ref-two-column');
        const add = panel('Добавить клиента', 'person_add');
        moveAll([info, form], add.body);
        const current = panel('Чёрный список', 'block');
        move(list, current.body);
        grid.append(add.box, current.box);
        page.appendChild(grid);
    }

    function composeLotIO(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-lots-page');
        hideHeading(q(page, ':scope > h3'));

        const overview = q(page, ':scope > .template-info');
        if (overview) {
            overview.classList.add('fpf-ref-lots-overview');
            overview.querySelector('ul')?.classList.add('fpf-ref-compact-list');
        }

        const children = directChildren(page);
        const heads = children.filter(n => n.tagName === 'H4');
        heads.forEach(hideHeading);

        const cards = el('div', 'fpf-ref-action-cards');

        const exportButtons = q(page, '.lot-io-buttons');
        const exportInfo = heads[0]?.nextElementSibling?.classList?.contains('template-info') ? heads[0].nextElementSibling : null;
        const exportCard = panel('Импорт / экспорт', 'swap_vert', 'fpf-ref-action-card');
        moveAll([exportInfo, exportButtons], exportCard.body);
        cards.appendChild(exportCard.box);

        const bulkBtn = q(page, '#fp-bulk-edit-btn');
        const bulkInfo = bulkBtn?.previousElementSibling?.classList?.contains('template-info') ? bulkBtn.previousElementSibling : null;
        const bulkCard = panel('Массовые операции', 'layers', 'fpf-ref-action-card');
        moveAll([bulkInfo, bulkBtn], bulkCard.body);
        cards.appendChild(bulkCard.box);

        const notesBtn = q(page, '#fp-open-notes-btn');
        const notesInfo = notesBtn?.previousElementSibling?.classList?.contains('template-info') ? notesBtn.previousElementSibling : null;
        const notesCard = panel('Заметки к лотам', 'sticky_note_2', 'fpf-ref-action-card');
        moveAll([notesInfo, notesBtn], notesCard.body);
        cards.appendChild(notesCard.box);

        const converter = q(page, '#convert-cardinal-lots-btn');
        const convertCard = panel('Конвертер лотов', 'content_copy', 'fpf-ref-action-card');
        move(converter, convertCard.body);
        cards.appendChild(convertCard.box);

        if (overview) page.insertBefore(cards, overview.nextSibling);
        else page.prepend(cards);

        const pending = q(page, '#lot-io-pending-imports-list');
        if (pending) {
            const pendingPanel = panel('Незавершённые импорты', 'history');
            move(pending, pendingPanel.body);
            page.appendChild(pendingPanel.box);
        }
    }

    function composeStats(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-finance-page');
        hideHeading(q(page, ':scope > h3'));
        const info = q(page, ':scope > .template-info');
        const cards = qa(page, ':scope > .fpt-setting-card');
        const p = panel('Статистика продаж и финансов', 'monitoring');
        move(info, p.body);
        const grid = el('div', 'fpf-ref-finance-grid');
        cards.forEach(card => grid.appendChild(card));
        p.body.appendChild(grid);
        page.appendChild(p.box);
    }

    function composePricing(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-lots-page');
        hideHeading(q(page, ':scope > h3'));
        const info = q(page, ':scope > .template-info');
        const cards = qa(page, ':scope > .fpt-setting-card');
        const p = panel('Цены и комиссии', 'price_change');
        move(info, p.body);
        const grid = el('div', 'fpf-ref-card-grid fpf-ref-card-grid-3');
        cards.forEach(card => grid.appendChild(card));
        p.body.appendChild(grid);
        page.appendChild(p.box);
    }

    function composeCalculator(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-calculator-page');
        hideHeading(q(page, ':scope > h3'));
        const p = panel('Калькулятор прибыли и времени', 'calculate', 'fpf-ref-calculator-panel');
        moveAll(directChildren(page).filter(n => !n.classList.contains('fpf-ref-source-heading')), p.body);
        page.appendChild(p.box);
    }

    function composeCurrency(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-currency-page');
        hideHeading(q(page, ':scope > h3'));
        const p = panel('Конвертер валют', 'currency_exchange', 'fpf-ref-currency-panel');
        moveAll(directChildren(page).filter(n => !n.classList.contains('fpf-ref-source-heading')), p.body);
        page.appendChild(p.box);
    }

    function composeTheme(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-theme-page');
        hideHeading(q(page, ':scope > h3'));

        const enabled = q(page, '#enableCustomThemeCheckbox')?.closest('.checkbox-label-inline');
        const presetHeader = Array.from(page.children).find(node => node.tagName === 'DIV' && node.textContent?.includes('Готовые темы'));
        const carousel = q(page, '#fp-wallpaper-carousel');
        const desc = q(page, '#fp-wp-desc');
        const catalogNote = desc?.nextElementSibling;
        const bg = q(page, '#bg-image-preview')?.closest('.template-container');
        const colors = q(page, '.color-input-grid');
        const font = q(page, '#themeFontSelect')?.closest('.template-container');
        const blur = q(page, '#themeBgBlur')?.closest('.template-container');
        const brightness = q(page, '#themeBgBrightness')?.closest('.template-container');
        const radius = q(page, '#themeBorderRadius')?.closest('.template-container');
        const glass = q(page, '#enableGlassmorphism')?.closest('.setting-group');
        const scrollbar = q(page, '#enableCustomScrollbar')?.closest('.setting-group');
        const circles = q(page, '#circlePreview')?.closest('.setting-group');
        const separators = q(page, '#enableImprovedSeparators')?.closest('.setting-group');
        const position = q(page, '#headerPositionSelect')?.closest('.setting-group');
        const outline = q(page, '#fptTextOutlineGroup');
        const actions = q(page, '.theme-actions-grid');

        const customization = panel('Кастомизация темы', 'palette', 'fpf-ref-theme-master');
        move(enabled, customization.body);
        page.prepend(customization.box);

        const ready = panel('Готовые темы', 'collections', 'fpf-ref-theme-presets');
        moveAll([presetHeader, carousel, desc, catalogNote], ready.body);
        page.appendChild(ready.box);

        const mediaGrid = el('div', 'fpf-ref-two-column fpf-ref-theme-media-grid');
        const background = panel('Фоновое изображение', 'image');
        move(bg, background.body);
        const palette = panel('Цвета интерфейса', 'palette');
        move(colors, palette.body);
        mediaGrid.append(background.box, palette.box);
        page.appendChild(mediaGrid);

        const controls = el('div', 'fpf-ref-control-grid');
        const controlMap = [
            ['Шрифт', 'text_fields', font],
            ['Размытие фона', 'blur_on', blur],
            ['Яркость фона', 'light_mode', brightness],
            ['Закругление углов', 'rounded_corner', radius],
            ['Эффект матового стекла', 'blur_medium', glass],
            ['Кастомный скроллбар', 'scrollable_header', scrollbar],
            ['Кругляшки', 'account_circle', circles],
            ['Разделители', 'view_headline', separators],
            ['Расположение', 'vertical_align_top', position],
            ['Контур текста', 'font_download', outline]
        ];
        controlMap.forEach(([title, icon, node]) => {
            if (!node) return;
            const item = panel(title, icon, 'fpf-ref-control-card');
            move(node, item.body);
            controls.appendChild(item.box);
        });
        page.appendChild(controls);

        if (actions) {
            const actionPanel = panel('Действия с темой', 'share', 'fpf-ref-theme-actions');
            move(actions, actionPanel.body);
            page.appendChild(actionPanel.box);
        }
    }

    function composeGeneral(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-system-page');
        hideHeading(q(page, ':scope > h3'));

        const children = directChildren(page);
        const soundHeading = children.find(n => n.tagName === 'H4' && n.textContent.includes('Звук'));
        const discordHeading = children.find(n => n.tagName === 'H4' && n.textContent.includes('Discord'));
        const identHeading = children.find(n => n.tagName === 'H4' && n.textContent.includes('Идентификатор'));
        [soundHeading, discordHeading, identHeading].forEach(hideHeading);

        const soundPanel = panel('Звук уведомления', 'notifications', 'fpf-ref-system-sound');
        moveAll([
            q(page, '#notificationSoundGroup'),
            q(page, '#fptCustomSoundBlock'),
            q(page, '#notificationVolume')?.closest('.template-container')
        ], soundPanel.body);
        page.prepend(soundPanel.box);

        const discordCard = q(page, '#discordLogEnabled')?.closest('.fpt-setting-card');
        const discordSettings = q(page, '#discordSettingsContainer');
        if (discordCard) {
            const discord = panel('Discord и Webhook', 'link', 'fpf-ref-system-integration');
            moveAll([discordCard, discordSettings], discord.body);
            page.appendChild(discord.box);
        }

        const identCard = q(page, '#fptIdentifierEnabled')?.closest('.fpt-setting-card');
        const identInfo = identCard?.nextElementSibling?.classList?.contains('template-info') ? identCard.nextElementSibling : null;
        if (identCard) {
            const ident = panel('Идентификатор FunPay Funcy', 'badge', 'fpf-ref-system-identifier');
            moveAll([identCard, identInfo], ident.body);
            page.appendChild(ident.box);
        }

        const promo = q(page, ':scope > .support-promo');
        if (promo) page.appendChild(promo);

        const status = el('div', 'fpf-ref-system-status');
        status.innerHTML = '<span class="material-symbols-rounded">check_circle</span><div><b>FunPay Funcy активен</b><span>Интерфейс и настройки загружены</span></div><span class="fpf-ref-status-dot"></span>';
        page.appendChild(status);
    }

    function composeAccounts(page) {
        if (!page || page.dataset.fpfComposed === '1') return;
        page.dataset.fpfComposed = '1';
        page.classList.add('fpf-ref-accounts-page');
        hideHeading(q(page, ':scope > h3'));
        const intro = q(page, ':scope > .template-info');
        const warning = q(page, ':scope > .support-promo');
        const add = q(page, '#addCurrentAccountBtn');
        const list = q(page, '#fpToolsAccountsList');
        const p = panel('Аккаунты', 'manage_accounts');
        moveAll([intro, warning, add], p.body);
        page.prepend(p.box);
        if (list) {
            const lp = panel('Сохранённые аккаунты', 'person');
            const refresh = q(page, '#fptRefreshAccountsBtn');
            moveAll([refresh, list], lp.body);
            page.appendChild(lp.box);
        }
    }

    function composeReferencePages(root) {
        const pages = {
            dashboard: composeDashboard,
            autobump: composeAutobump,
            auto_delivery: composeAutoDelivery,
            auto_review: composeAutoReview,
            templates: composeTemplates,
            notes: composeNotes,
            blacklist: composeBlacklist,
            lot_io: composeLotIO,
            pricing: composePricing,
            sales_stats: composeStats,
            calculator: composeCalculator,
            currency_calc: composeCurrency,
            theme: composeTheme,
            general: composeGeneral,
            accounts: composeAccounts
        };

        Object.entries(pages).forEach(([id, fn]) => fn(q(root, `.fp-tools-page-content[data-page="${id}"]`)));
    }

    function install(root) {
        if (!(root instanceof HTMLElement) || root.dataset.fpfReferenceLayout === '1') return;
        root.dataset.fpfReferenceLayout = '1';
        root.classList.add('fpf-reference-layout');

        composeReferencePages(root);

        const observer = new MutationObserver(() => {
            // Dynamic lists (templates, accounts, delivery lots) keep the reference row styling.
            qa(root, '.template-settings-list .template-item, #fpToolsAccountsList > *, #fp-delivery-lots-list > *').forEach(node => {
                node.classList.add('fpf-ref-live-row');
            });
        });
        observer.observe(root, { childList: true, subtree: true });
    }

    function scan(node = document) {
        if (node instanceof HTMLElement && node.matches('.fp-tools-popup')) install(node);
        node.querySelectorAll?.('.fp-tools-popup').forEach(install);
    }

    scan();

    const documentObserver = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (node instanceof HTMLElement) scan(node);
            }
        }
    });

    if (document.documentElement) {
        documentObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
})();