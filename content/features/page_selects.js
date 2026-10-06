// Themed dropdown lists for FunPay's own <select> elements (order filters, sorting, forms...).
// The native <select> stays visible and untouched as the trigger, so FunPay's layout, theme
// styles and jQuery change handlers keep working; only the browser's native option list is
// replaced with the same themed menu the extension popup uses (FPTPopupUI.enhanceSelect).
(function (root) {
    'use strict';
    if (root.__fptPageSelects) return;
    root.__fptPageSelects = true;

    // The extension popup has its own enhanceSelect; selects it already wraps are skipped too.
    const EXCLUDED = '.fp-tools-popup, .fpt-select-host, .fpt-page-select-off';

    let current = null; // { select, menu, items, active }

    function eligible(select) {
        return select instanceof HTMLSelectElement
            && !select.multiple
            && select.size <= 1
            && !select.disabled
            && select.options.length > 0
            && !select.closest(EXCLUDED);
    }

    function buildMenu(select) {
        const menu = document.createElement('div');
        menu.className = 'fpt-page-select-menu';
        menu.setAttribute('role', 'listbox');
        const items = [];
        let group = null;
        [...select.options].forEach((option, index) => {
            if (option.hidden) return;
            const parent = option.parentElement instanceof HTMLOptGroupElement ? option.parentElement : null;
            if (parent && parent !== group) {
                const label = document.createElement('div');
                label.className = 'fpt-page-select-group';
                label.textContent = parent.label;
                menu.append(label);
            }
            group = parent;
            const item = document.createElement('div');
            item.className = 'fpt-page-select-option';
            if (parent) item.classList.add('is-grouped');
            item.setAttribute('role', 'option');
            item.dataset.index = String(index);
            item.textContent = option.textContent;
            item.title = option.textContent;
            const selected = index === select.selectedIndex;
            item.classList.toggle('is-selected', selected);
            item.setAttribute('aria-selected', String(selected));
            if (option.disabled || parent?.disabled) item.setAttribute('aria-disabled', 'true');
            menu.append(item);
            items.push(item);
        });
        return { menu, items };
    }

    function place(select, menu) {
        const rect = select.getBoundingClientRect();
        const gap = 6;
        const below = root.innerHeight - rect.bottom - gap - 8;
        const above = rect.top - gap - 8;
        const up = below < 200 && above > below;
        menu.style.minWidth = `${Math.round(rect.width)}px`;
        menu.style.maxHeight = `${Math.max(120, Math.min(320, up ? above : below))}px`;
        const left = Math.min(rect.left, root.innerWidth - menu.offsetWidth - 8);
        menu.style.left = `${Math.max(8, Math.round(left))}px`;
        if (up) {
            menu.classList.add('is-up');
            menu.style.top = '';
            menu.style.bottom = `${Math.round(root.innerHeight - rect.top + gap)}px`;
        } else {
            menu.style.bottom = '';
            menu.style.top = `${Math.round(rect.bottom + gap)}px`;
        }
    }

    function setActive(index, scroll = true) {
        if (!current) return;
        current.items[current.active]?.classList.remove('is-active');
        current.active = index;
        const item = current.items[index];
        if (!item) return;
        item.classList.add('is-active');
        if (scroll) item.scrollIntoView({ block: 'nearest' });
    }

    function step(dir) {
        if (!current) return;
        const { items } = current;
        for (let i = current.active + dir; i >= 0 && i < items.length; i += dir) {
            if (items[i].getAttribute('aria-disabled') !== 'true') { setActive(i); return; }
        }
    }

    function open(select) {
        close();
        if (!eligible(select)) return;
        const { menu, items } = buildMenu(select);
        if (!items.length) return;
        // Inside a native <dialog> only its own subtree is above the top layer.
        (select.closest('dialog[open]') || document.body).append(menu);
        current = { select, menu, items, active: -1 };
        place(select, menu);
        select.classList.add('fpt-page-select-open');
        select.setAttribute('aria-expanded', 'true');
        const selected = items.findIndex(item => item.classList.contains('is-selected'));
        setActive(Math.max(0, selected));

        menu.addEventListener('pointermove', event => {
            const item = event.target.closest('.fpt-page-select-option');
            const index = item ? current?.items.indexOf(item) : -1;
            if (index >= 0 && index !== current.active) setActive(index, false);
        });
        menu.addEventListener('mousedown', event => event.preventDefault()); // keep focus on the <select>
        menu.addEventListener('click', event => {
            const item = event.target.closest('.fpt-page-select-option');
            if (item) choose(item);
        });
    }

    function close() {
        if (!current) return;
        const { select, menu } = current;
        current = null;
        menu.remove();
        select.classList.remove('fpt-page-select-open');
        select.setAttribute('aria-expanded', 'false');
    }

    function choose(item) {
        if (!current || !item || item.getAttribute('aria-disabled') === 'true') return;
        const { select } = current;
        const index = Number(item.dataset.index);
        close();
        select.focus({ preventScroll: true });
        if (select.selectedIndex === index) return;
        select.selectedIndex = index;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Opening: a left-button mousedown on a select would show the native list, so it is cancelled.
    document.addEventListener('mousedown', event => {
        const select = event.target;
        if (current && !current.menu.contains(select) && select !== current.select) close();
        if (event.button !== 0 || !eligible(select)) return;
        event.preventDefault();
        select.focus({ preventScroll: true });
        if (current?.select === select) close();
        else open(select);
    }, true);

    document.addEventListener('keydown', event => {
        const select = event.target;
        const key = event.key;
        if (current && select === current.select) {
            const handled = {
                ArrowDown: () => step(1),
                ArrowUp: () => step(-1),
                Home: () => { current.active = -1; step(1); },
                End: () => { current.active = current.items.length; step(-1); },
                PageDown: () => { for (let i = 0; i < 8; i++) step(1); },
                PageUp: () => { for (let i = 0; i < 8; i++) step(-1); },
                Enter: () => choose(current.items[current.active]),
                ' ': () => choose(current.items[current.active]),
                Escape: close
            }[key];
            if (key === 'Tab') { close(); return; }
            if (handled) {
                event.preventDefault();
                event.stopPropagation();
                handled();
            }
            return;
        }
        // Keys that open the native list; plain arrows keep changing the value in place.
        const opens = key === ' ' || key === 'F4' || (event.altKey && (key === 'ArrowDown' || key === 'ArrowUp'));
        if (opens && eligible(select)) {
            event.preventDefault();
            open(select);
        }
    }, true);

    document.addEventListener('scroll', event => {
        if (current && !current.menu.contains(event.target)) close();
    }, true);
    root.addEventListener('resize', close);
    root.addEventListener('blur', close);
    document.addEventListener('focusin', event => {
        if (current && event.target !== current.select && !current.menu.contains(event.target)) close();
    });
})(window);
