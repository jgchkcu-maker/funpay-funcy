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

    let current = null; // { select, host, menu, items, active }

    // The menu lives in a shadow root: FunPay themes, MagicStick styles (all !important) and the
    // site's own CSS cannot reach it, so it never turns transparent or loses its colours.
    const MENU_CSS = `
        .menu {
            position: fixed;
            box-sizing: border-box;
            width: max-content;
            max-width: min(420px, calc(100vw - 16px));
            max-height: 320px;
            overflow-y: auto;
            margin: 0;
            padding: 6px;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--bg);
            color: var(--text);
            box-shadow: 0 14px 34px var(--shadow);
            font-size: 14px;
            line-height: 1.3;
            text-align: left;
            transform-origin: top center;
            animation: in .16s cubic-bezier(.4, 0, .2, 1) both;
            scrollbar-width: thin;
            scrollbar-color: var(--border) transparent;
        }
        .menu.is-up { transform-origin: bottom center; animation-name: in-up; }
        .option {
            padding: 8px 10px;
            border-radius: 9px;
            color: var(--text);
            cursor: pointer;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            user-select: none;
        }
        .option.is-grouped { padding-left: 18px; }
        .option.is-active { background: var(--hover); }
        .option.is-selected { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
        .option[aria-disabled="true"] { opacity: .5; cursor: default; }
        .group { padding: 8px 10px 4px; color: var(--muted); font-size: 12px; font-weight: 600; user-select: none; }
        @keyframes in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @keyframes in-up { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .menu { animation: none; } }
    `;
    const HOST_CSS = 'all: initial !important; display: block !important; position: fixed !important;'
        + ' top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important;'
        + ' overflow: visible !important; z-index: 2147483000 !important;';

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
        menu.className = 'menu';
        menu.setAttribute('role', 'listbox');
        const items = [];
        let group = null;
        [...select.options].forEach((option, index) => {
            if (option.hidden) return;
            const parent = option.parentElement instanceof HTMLOptGroupElement ? option.parentElement : null;
            if (parent && parent !== group) {
                const label = document.createElement('div');
                label.className = 'group';
                label.textContent = parent.label;
                menu.append(label);
            }
            group = parent;
            const item = document.createElement('div');
            item.className = 'option';
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

    // --- Readable colours -------------------------------------------------------------------
    // The page palette (--fptm-* from utils.js) pairs the theme's block colour with the body text
    // colour. Custom themes always force light text, while their block colour can be light, and
    // the palette background may be translucent. The colours are resolved on open and corrected
    // to an opaque background with contrasting text and accent.
    function parseRgb(value) {
        const m = /rgba?\(([^)]+)\)/.exec(value || '');
        if (!m) return null;
        const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        if (p.length < 3 || p.slice(0, 3).some(Number.isNaN)) return null;
        return [p[0], p[1], p[2], p.length > 3 && !Number.isNaN(p[3]) ? p[3] : 1];
    }
    function resolveColor(cssValue) {
        const probe = document.createElement('span');
        probe.style.setProperty('display', 'none', 'important');
        probe.style.setProperty('color', cssValue, 'important');
        document.body.append(probe);
        const rgb = parseRgb(getComputedStyle(probe).color);
        probe.remove();
        return rgb;
    }
    function luminance([r, g, b]) {
        const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }
    function contrast(a, b) {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
    }
    function mix(a, b, t) { return [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t); }
    function css(rgb, alpha = 1) { return `rgba(${rgb.slice(0, 3).map(Math.round).join(', ')}, ${alpha})`; }

    function applyColors(select, menu) {
        const WHITE = [255, 255, 255];
        const BLACK = [0, 0, 0];
        let bg = resolveColor('var(--fptm-bg, #fff)') || [255, 255, 255, 1];
        // Composite a translucent background onto black/white so nothing shows through.
        if (bg[3] < 1) bg = mix(luminance(bg) < 0.18 ? BLACK : WHITE, bg, bg[3]);
        const dark = luminance(bg) < 0.18;
        let text = resolveColor('var(--fptm-text, #222)') || BLACK;
        if (contrast(text, bg) < 4.5) text = dark ? [242, 243, 245] : [22, 24, 29];
        let accent = resolveColor('var(--fptm-accent, #1b75bb)') || [27, 117, 187];
        for (let i = 0; i < 10 && contrast(accent, bg) < 4.5; i++) accent = mix(accent, dark ? WHITE : BLACK, 0.2);

        const set = (name, value) => menu.style.setProperty(name, value);
        set('--bg', css(bg));
        set('--text', css(text));
        set('--muted', css(text, 0.62));
        set('--border', css(mix(bg, dark ? WHITE : BLACK, dark ? 0.16 : 0.12)));
        set('--hover', css(mix(bg, dark ? WHITE : BLACK, dark ? 0.12 : 0.07)));
        set('--accent', css(accent));
        set('--accent-soft', css(accent, dark ? 0.2 : 0.12));
        set('--shadow', dark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.18)');
        set('color-scheme', dark ? 'dark' : 'light');
        set('font-family', getComputedStyle(select).fontFamily || 'sans-serif');
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
        const host = document.createElement('fpt-page-select');
        host.style.cssText = HOST_CSS;
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = MENU_CSS;
        shadow.append(style, menu);
        // Inside a native <dialog> only its own subtree is above the top layer.
        (select.closest('dialog[open]') || document.body).append(host);
        current = { select, host, menu, items, active: -1 };
        applyColors(select, menu);
        place(select, menu);
        select.classList.add('fpt-page-select-open');
        select.setAttribute('aria-expanded', 'true');
        const selected = items.findIndex(item => item.classList.contains('is-selected'));
        setActive(Math.max(0, selected));

        menu.addEventListener('pointermove', event => {
            const item = event.target.closest('.option');
            const index = item ? current?.items.indexOf(item) : -1;
            if (index >= 0 && index !== current.active) setActive(index, false);
        });
        menu.addEventListener('mousedown', event => event.preventDefault()); // keep focus on the <select>
        menu.addEventListener('click', event => {
            const item = event.target.closest('.option');
            if (item) choose(item);
        });
    }

    function close() {
        if (!current) return;
        const { select, host } = current;
        current = null;
        host.remove();
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
        if (current && select !== current.host && select !== current.select) close();
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
        if (current && event.target !== current.host) close();
    }, true);
    root.addEventListener('resize', close);
    root.addEventListener('blur', close);
    document.addEventListener('focusin', event => {
        if (current && event.target !== current.select && event.target !== current.host) close();
    });
})(window);
