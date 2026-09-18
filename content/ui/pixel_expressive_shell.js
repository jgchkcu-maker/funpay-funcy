(() => {
    'use strict';

    const HUB_META = Object.freeze({
        dashboard: {
            title: 'Дашборд',
            description: 'Мониторинг работы и быстрый контроль ключевых показателей',
            icon: 'dashboard',
            copy: 'Ваш стиль.\nВаш FunPay.'
        },
        automation: {
            title: 'Автоматизация',
            description: 'Настройте автоматические действия для экономии времени и роста продаж',
            icon: 'smart_toy',
            copy: 'Больше продаж.\nМеньше рутины.'
        },
        chat: {
            title: 'Чат и клиенты',
            description: 'Шаблоны, быстрые ответы, заметки и инструменты для общения',
            icon: 'chat_bubble',
            copy: 'Быстрее. Удобнее.\nБольше сделок.'
        },
        lots: {
            title: 'Товары и рынок',
            description: 'Управляйте товарами и анализируйте рынок FunPay',
            icon: 'shopping_bag',
            copy: 'Больше продаж.\nБольше возможностей.'
        },
        finance: {
            title: 'Финансы',
            description: 'Контролируйте доходы, расходы и прибыль',
            icon: 'monitoring',
            copy: 'Больше контроля.\nБольше прибыли.'
        },
        appearance: {
            title: 'Внешний вид',
            description: 'Настройте внешний вид FunPay Funcy под свой стиль',
            icon: 'palette',
            copy: 'Ваш стиль.\nВаш FunPay.'
        },
        system: {
            title: 'Система',
            description: 'Настройте параметры, интеграции и сервисы FunPay Funcy',
            icon: 'settings_suggest',
            copy: 'Стабильная работа.\nБольше возможностей.'
        }
    });

    const PAGE_TO_HUB = Object.freeze({
        dashboard: 'dashboard',
        overview: 'dashboard',
        automation: 'automation',
        autobump: 'automation',
        auto_delivery: 'automation',
        auto_review: 'automation',
        chat: 'chat',
        templates: 'chat',
        slash_commands: 'chat',
        notes: 'chat',
        blacklist: 'chat',
        lots: 'lots',
        lot_io: 'lots',
        finance: 'finance',
        calculator: 'finance',
        currency_calc: 'finance',
        theme: 'appearance',
        needs: 'appearance',
        general: 'system',
        accounts: 'system',
        telegram: 'system',
        settings_io: 'system',
        tickets: 'system',
        support: 'system'
    });

    function getVersion() {
        try {
            return chrome?.runtime?.getManifest?.().version || '';
        } catch (_) {
            return '';
        }
    }

    function resolveHub(root) {
        const activeNav = root.querySelector('.fp-tools-nav li[data-hub].active');
        if (activeNav?.dataset?.hub && HUB_META[activeNav.dataset.hub]) {
            return activeNav.dataset.hub;
        }

        const activePage = root.querySelector('.fp-tools-page-content.active');
        if (activePage?.dataset?.hub && HUB_META[activePage.dataset.hub]) {
            return activePage.dataset.hub;
        }

        const page = activePage?.dataset?.page;
        return PAGE_TO_HUB[page] || 'dashboard';
    }

    function ensureVersionBadge(root) {
        const titleWrap = root.querySelector('.fp-tools-title-wrap');
        if (!titleWrap || titleWrap.querySelector('.fpt-pixel-version')) return;

        const version = getVersion();
        if (!version) return;

        const badge = document.createElement('span');
        badge.className = 'fpt-pixel-version';
        badge.textContent = `v${version}`;
        badge.setAttribute('aria-label', `Версия ${version}`);
        titleWrap.appendChild(badge);
    }

    function ensureSupportLink(root) {
        const header = root.querySelector('.fp-tools-header');
        const social = root.querySelector('.fp-tools-social');
        const close = root.querySelector('.close-btn');
        if (!header || header.querySelector('.fpt-pixel-support-link')) return;

        const support = document.createElement('a');
        support.className = 'fpt-pixel-support-link';
        support.href = 'https://support.funpay.com/';
        support.target = '_blank';
        support.rel = 'noopener noreferrer';
        support.title = 'Поддержка FunPay';
        support.setAttribute('aria-label', 'Поддержка FunPay');

        const icon = document.createElement('span');
        icon.className = 'material-symbols-rounded';
        icon.textContent = 'help';

        const text = document.createElement('span');
        text.textContent = 'Поддержка FunPay';

        support.append(icon, text);
        if (close) header.insertBefore(support, close);
        else if (social?.nextSibling) header.insertBefore(support, social.nextSibling);
        else header.appendChild(support);
    }

    function ensureHero(root) {
        const content = root.querySelector('.fp-tools-content');
        if (!content) return null;

        let hero = content.querySelector(':scope > .fpt-pixel-hero');
        if (hero) return hero;

        hero = document.createElement('section');
        hero.className = 'fpt-pixel-hero';
        hero.setAttribute('aria-live', 'polite');

        const copy = document.createElement('div');
        copy.className = 'fpt-pixel-hero-copy';

        const title = document.createElement('h1');
        title.className = 'fpt-pixel-hero-title';

        const description = document.createElement('p');
        description.className = 'fpt-pixel-hero-description';

        const art = document.createElement('div');
        art.className = 'fpt-pixel-hero-art';
        art.setAttribute('aria-hidden', 'true');

        copy.append(title, description);
        hero.append(copy, art);

        const subtabs = content.querySelector(':scope > .fpt-subtabs-bar');
        if (subtabs) content.insertBefore(hero, subtabs);
        else content.prepend(hero);

        return hero;
    }

    function syncHero(root) {
        const hub = resolveHub(root);
        const meta = HUB_META[hub] || HUB_META.dashboard;
        root.dataset.fptHub = hub;

        const hero = ensureHero(root);
        if (!hero) return;

        const title = hero.querySelector('.fpt-pixel-hero-title');
        const description = hero.querySelector('.fpt-pixel-hero-description');
        const art = hero.querySelector('.fpt-pixel-hero-art');

        if (title && title.textContent !== meta.title) title.textContent = meta.title;
        if (description && description.textContent !== meta.description) description.textContent = meta.description;
        if (art) {
            art.dataset.icon = meta.icon;
            art.dataset.copy = meta.copy;
        }
    }


    function decorateReferenceLayout(root) {
        const addClass = (selector, className) => {
            root.querySelectorAll(selector).forEach((node) => node.classList.add(className));
        };

        // Page-level hooks used only by the presentation layer. No nodes are moved,
        // so feature scripts that rely on the existing DOM structure keep working.
        addClass('.fp-tools-page-content[data-page="dashboard"]', 'fpt-reference-dashboard');
        addClass('.fp-tools-page-content[data-page="theme"]', 'fpt-reference-appearance');
        addClass('.fp-tools-page-content[data-page="needs"]', 'fpt-reference-customization');
        addClass('.fp-tools-page-content[data-page="general"]', 'fpt-reference-system');
        addClass('.fp-tools-page-content[data-page="calculator"]', 'fpt-reference-calculator');
        addClass('.fp-tools-page-content[data-page="currency_calc"]', 'fpt-reference-currency');

        const themePage = root.querySelector('.fp-tools-page-content[data-page="theme"]');
        if (themePage) {
            themePage.querySelector('#fp-wallpaper-carousel')?.classList.add('fpt-layout-wide');
            themePage.querySelector('#bg-image-preview')?.closest('.template-container')?.classList.add('fpt-layout-half');
            themePage.querySelector('.color-input-grid')?.classList.add('fpt-layout-half');

            ['#themeFontSelect', '#themeBgBlur', '#themeBgBrightness', '#themeBorderRadius'].forEach((selector) => {
                themePage.querySelector(selector)?.closest('.template-container')?.classList.add('fpt-layout-quarter');
            });

            ['#enableGlassmorphism', '#enableCustomScrollbar'].forEach((selector) => {
                themePage.querySelector(selector)?.closest('.setting-group')?.classList.add('fpt-layout-half');
            });

            themePage.querySelector('#circlePreview')?.closest('.setting-group')?.classList.add('fpt-layout-half');
            themePage.querySelector('#enableImprovedSeparators')?.closest('.setting-group')?.classList.add('fpt-layout-quarter');
            themePage.querySelector('#headerPositionSelect')?.closest('.setting-group')?.classList.add('fpt-layout-quarter');
            themePage.querySelector('#fptTextOutlineGroup')?.classList.add('fpt-layout-half');
            themePage.querySelector('.theme-actions-grid')?.classList.add('fpt-layout-full');
        }

        const systemPage = root.querySelector('.fp-tools-page-content[data-page="general"]');
        if (systemPage) {
            systemPage.querySelector('#notificationSoundGroup')?.classList.add('fpt-reference-sound-grid');
            systemPage.querySelector('#notificationVolume')?.closest('.template-container')?.classList.add('fpt-reference-volume');
            systemPage.querySelector('#discordLogEnabled')?.closest('.fpt-setting-card')?.classList.add('fpt-reference-integration-card');
            systemPage.querySelector('#fptIdentifierEnabled')?.closest('.fpt-setting-card')?.classList.add('fpt-reference-integration-card');
        }

        addClass('.feature-list-container', 'fpt-reference-feature-list');
        addClass('.template-settings-list .template-item', 'fpt-reference-list-row');
        addClass('.fpt-needs-list > *', 'fpt-reference-list-row');
    }

    function install(root) {
        if (!(root instanceof HTMLElement) || root.dataset.fptPixelEnhanced === '1') return;
        root.dataset.fptPixelEnhanced = '1';

        ensureVersionBadge(root);
        ensureSupportLink(root);
        decorateReferenceLayout(root);
        syncHero(root);

        let scheduled = false;
        const scheduleSync = () => {
            if (scheduled) return;
            scheduled = true;
            queueMicrotask(() => {
                scheduled = false;
                if (root.isConnected) syncHero(root);
            });
        };

        const observer = new MutationObserver((records) => {
            if (records.some(record =>
                record.type === 'childList' ||
                (record.type === 'attributes' && (record.attributeName === 'class' || record.attributeName === 'data-page' || record.attributeName === 'data-hub'))
            )) {
                scheduleSync();
            }
        });

        observer.observe(root, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'data-page', 'data-hub']
        });
    }

    function scan(node = document) {
        if (node instanceof HTMLElement && node.matches('.fp-tools-popup')) install(node);
        node.querySelectorAll?.('.fp-tools-popup').forEach(install);
    }

    scan();

    const documentObserver = new MutationObserver((records) => {
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
