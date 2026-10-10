(function (root) {
    'use strict';

    const PAGE_ID = 'auto_orders';

    function makeHelpPanel() {
        const panel = document.createElement('aside');
        panel.className = 'fpt-ord-help fpt-lot-help-popover';
        panel.id = 'fpt-ord-help';
        panel.hidden = true;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Справка по заказам и выдачам');
        const title = document.createElement('h2');
        title.textContent = 'Заказы и выдачи';
        const list = document.createElement('ul');
        [
            'Здесь собраны заказы, которые обработала автовыдача: что выдано, что ждёт и где нужно ваше решение.',
            '«Требуют решения» — выдача остановлена или её исход неясен. Откройте карточку, чтобы проверить заказ или отправить часть ещё раз.',
            '«Подтверждена» значит, что FunPay вернул наше сообщение; иначе исход проверяется вручную.'
        ].forEach(text => {
            const item = document.createElement('li');
            item.textContent = text;
            list.appendChild(item);
        });
        panel.append(title, list);
        return panel;
    }

    async function mount(popup) {
        const page = popup?.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page.dataset.fptAutoOrdersMounted === 'true') return page?._fptAutoOrdersMount;
        if (!root.FPTPopupUI || !root.FPTOrdersView) throw new Error('Shared order page components are unavailable.');

        const helpPanel = makeHelpPanel();
        const header = root.FPTPopupUI.ensureCategoryHeader(page, 'Заказы и выдачи', {
            onHelp: event => {
                helpPanel.hidden = !helpPanel.hidden;
                event.currentTarget.setAttribute('aria-expanded', String(!helpPanel.hidden));
            }
        });
        // Same anchored popover as the other categories: closes on an outside click or Escape.
        const helpAnchor = document.createElement('span');
        helpAnchor.className = 'fpt-ad-help-anchor';
        header.helpButton.setAttribute('aria-controls', helpPanel.id);
        header.helpButton.before(helpAnchor);
        helpAnchor.append(header.helpButton, helpPanel);
        const closeHelp = () => {
            helpPanel.hidden = true;
            header.helpButton.setAttribute('aria-expanded', 'false');
        };
        document.addEventListener('pointerdown', event => { if (!helpAnchor.contains(event.target)) closeHelp(); });
        page.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !helpPanel.hidden) { closeHelp(); header.helpButton.focus(); }
        });

        page.dataset.fptAutoOrdersMounted = 'true';
        const view = root.FPTOrdersView.mount(page, popup);
        page._fptAutoOrdersMount = view;
        await view.load();
        return view;
    }

    root.FPTAutoOrdersPage = Object.freeze({ mount });
})(window);
