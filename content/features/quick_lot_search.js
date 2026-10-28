// content/features/quick_lot_search.js
// Quick search / filter over lots on the offers page - no page reload needed

(function () {
    'use strict';

    let _searchInput = null;

    function buildSearchBar(container) {
        if (container.querySelector('#fp-lot-search-bar')) return;

        const bar = document.createElement('div');
        bar.id = 'fp-lot-search-bar';
        bar.innerHTML = `
            <span class="fp-lot-search-icon material-icons" aria-hidden="true">search</span>
            <input type="text" id="fp-lot-search-input"
                class="form-control"
                placeholder="Поиск по лотам…"
                aria-label="Поиск по лотам" autocomplete="off">
            <button type="button" id="fp-lot-search-clear" aria-label="Очистить поиск" hidden>×</button>
            <span id="fp-lot-search-count" aria-live="polite"></span>
        `;
        container.prepend(bar);

        // Если есть заголовок "Предложения" с кнопками Выбрать/Включить - перемещаем поиск после него
        const offersHeader = Array.from(container.querySelectorAll('h5.mb10.text-bold'))
            .find(h => Array.from(h.childNodes).some(node => node.nodeType === Node.TEXT_NODE &&
                /^(Предложения|Отзывы)$/.test(node.textContent.trim())));
        if (offersHeader) offersHeader.insertAdjacentElement('afterend', bar);

        _searchInput = bar.querySelector('#fp-lot-search-input');
        const countEl = bar.querySelector('#fp-lot-search-count');
        const clearBtn = bar.querySelector('#fp-lot-search-clear');

        _searchInput.addEventListener('input', () => {
            const q = _searchInput.value.trim().toLowerCase();
            clearBtn.hidden = !_searchInput.value;
            let visible = 0;
            const total = document.querySelectorAll('a.tc-item').length;

            // Filter individual lot rows
            document.querySelectorAll('a.tc-item').forEach(item => {
                const text = (item.querySelector('.tc-desc-text')?.textContent || '').toLowerCase();
                const show = !q || text.includes(q);
                item.style.display = show ? '' : 'none';
                if (show) visible++;
            });

            // Hide entire .offer blocks if ALL their lots are hidden
            // but keep the block header visible if any lots match
            document.querySelectorAll('.offer').forEach(offerBlock => {
                if (!offerBlock.id) { // don't touch pinned containers
                    const lots = offerBlock.querySelectorAll('a.tc-item');
                    if (!lots.length) return;
                    const anyVisible = [...lots].some(l => l.style.display !== 'none');
                    offerBlock.style.display = anyVisible ? '' : 'none';
                }
            });

            countEl.textContent = q ? `${visible} из ${total}` : '';
        });

        clearBtn.addEventListener('click', () => {
            _searchInput.value = '';
            _searchInput.dispatchEvent(new Event('input'));
            _searchInput.focus();
        });

        // Clear on Escape
        _searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                _searchInput.value = '';
                _searchInput.dispatchEvent(new Event('input'));
                _searchInput.blur();
            }
        });
    }

    function initQuickLotSearch() {
        const isOffersPage = window.location.pathname.includes('/users/') ||
            (window.location.pathname.includes('/lots/') && window.location.pathname.includes('/trade'));
        if (!isOffersPage) return;

        const attach = () => {
            const offerBlocks = document.querySelectorAll('.offer');
            if (offerBlocks.length) {
                const profileData = document.querySelector('.profile-data-container, #content .row');
                if (profileData) buildSearchBar(profileData);
            }
        };

        attach();
        new MutationObserver(attach)
            .observe(document.getElementById('content') || document.body, { childList: true, subtree: false });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initQuickLotSearch);
    } else {
        initQuickLotSearch();
    }
})();
