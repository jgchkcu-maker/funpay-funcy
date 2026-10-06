// Shared UI primitives for category views in the FunPay Funcy popup.
(function (root) {
    'use strict';

    const SPECIAL_CHECKBOX_ANCESTORS = [
        '.fp-tools-nav', '.fp-tools-chat-toggle', '.switch', '.checkbox-switch',
        '.lot-box', '.custom-checkbox', '.template-toggle', '#fp-tools-filter-marked-btn',
        '[role="switch"]'
    ].join(',');
    const FIELD_SELECTOR = [
        'input:not([type])', 'input[type="text"]', 'input[type="search"]',
        'input[type="number"]', 'input[type="email"]', 'input[type="url"]',
        'input[type="tel"]', 'input[type="password"]', 'input[type="date"]',
        'input[type="time"]', 'input[type="datetime-local"]', 'select', 'textarea'
    ].join(',');

    function makeCheckboxControl(input) {
        const control = document.createElement('span');
        control.className = 'fpt-checkbox-control';
        control.setAttribute('data-fpt-control-kind', 'checkbox');
        input.classList.add('fpt-checkbox-input');
        const indicator = document.createElement('span');
        indicator.className = 'fpt-checkbox-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        if (input.parentNode) input.parentNode.insertBefore(control, input);
        control.append(input, indicator);
        return control;
    }

    function associatedLabel(input, container) {
        const implicit = input.closest('label');
        if (implicit) return implicit;
        if (!input.id || !container?.querySelectorAll) return null;
        return Array.from(container.querySelectorAll('label[for]')).find(label => label.htmlFor === input.id) || null;
    }

    function decorateCheckbox(input, container) {
        if (input.closest('.fpt-checkbox-control')) return input.closest('.fpt-checkbox-control');
        if (input.hasAttribute('hidden') || input.closest(SPECIAL_CHECKBOX_ANCESTORS)) return null;

        if (!input.parentNode) return null;
        const label = associatedLabel(input, container);
        const control = makeCheckboxControl(input);
        if (label) {
            label.classList.add('fpt-checkbox-label');
            if (!label.contains(control)) label.classList.add('fpt-checkbox-label--external');
        }
        return control;
    }

    function decorateField(field, container) {
        if (!field.matches(FIELD_SELECTOR) || field.closest('.fp-tools-nav')) return;
        field.classList.add('fpt-control-field');
        const kind = field.tagName.toLowerCase() === 'textarea' ? 'textarea'
            : field.tagName.toLowerCase() === 'select' ? 'select' : 'input';
        field.dataset.controlKind = kind;
        const label = associatedLabel(field, container);
        if (label) label.classList.add('fpt-control-label');
    }

    function normalizeControls(container, node) {
        if (!node || node.nodeType !== 1) return;
        if (node.matches('input[type="checkbox"]')) decorateCheckbox(node, container);
        if (node.matches(FIELD_SELECTOR)) decorateField(node, container);
        node.querySelectorAll?.('input[type="checkbox"]').forEach(input => decorateCheckbox(input, container));
        node.querySelectorAll?.(FIELD_SELECTOR).forEach(field => decorateField(field, container));
    }

    function observePopupControls(popup) {
        if (!popup || typeof MutationObserver !== 'function') return null;
        const container = popup.closest?.('.fp-tools-popup') || popup;
        if (container._fptPopupControlsObserver) return container._fptPopupControlsObserver;

        normalizeControls(container, container);
        const observer = new MutationObserver(records => {
            records.forEach(record => record.addedNodes.forEach(node => normalizeControls(container, node)));
        });
        observer.observe(container, { childList: true, subtree: true });
        container._fptPopupControlsObserver = observer;
        return observer;
    }

    function createCheckboxControl(labelText, options = {}) {
        const label = document.createElement('label');
        label.className = 'fpt-checkbox-label';
        const input = document.createElement('input');
        input.type = 'checkbox';
        if (options.id) input.id = options.id;
        if (options.name) input.name = options.name;
        if (options.value !== undefined) input.value = String(options.value);
        input.checked = Boolean(options.checked);
        input.disabled = Boolean(options.disabled);
        if (options.ariaLabel) input.setAttribute('aria-label', options.ariaLabel);
        if (typeof options.onChange === 'function') input.addEventListener('change', options.onChange);
        label.append(makeCheckboxControl(input));
        const caption = document.createElement('span');
        caption.className = 'fpt-checkbox-caption';
        caption.textContent = String(labelText || '');
        label.appendChild(caption);
        return { element: label, input, indicator: input.nextElementSibling };
    }

    function appendCategoryHelpButton(header, options = {}) {
        let helpButton = header.querySelector('.fpt-category-help');
        if (helpButton || typeof options.onHelp !== 'function') return helpButton;

        helpButton = document.createElement('button');
        helpButton.type = 'button';
        helpButton.className = 'fpt-category-help';
        helpButton.setAttribute('aria-label', options.helpLabel || 'Справка');
        helpButton.setAttribute('aria-expanded', 'false');
        helpButton.title = options.helpLabel || 'Справка';

        const icon = document.createElement('span');
        icon.className = 'material-symbols-rounded';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = 'help';
        helpButton.appendChild(icon);
        helpButton.addEventListener('click', options.onHelp);
        header.appendChild(helpButton);
        return helpButton;
    }

    function createCategoryHeader(title, options = {}) {
        const header = document.createElement('header');
        header.className = 'fpt-category-header';

        const heading = document.createElement('h1');
        heading.className = 'fpt-category-title';
        heading.textContent = String(title || '');
        header.appendChild(heading);

        const spacer = document.createElement('span');
        spacer.className = 'fpt-category-header-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        header.appendChild(spacer);

        const helpButton = appendCategoryHelpButton(header, options);
        return { element: header, heading, helpButton };
    }

    function ensureCategoryHeader(container, title, options = {}) {
        if (!container) return null;
        let header = container.querySelector(':scope > .fpt-category-header');
        if (!header) {
            const created = createCategoryHeader(title, options);
            container.prepend(created.element);
            return created;
        }

        let heading = header.querySelector('.fpt-category-title');
        if (!heading) {
            heading = document.createElement('h1');
            heading.className = 'fpt-category-title';
            header.prepend(heading);
        }
        heading.textContent = String(title || '');
        const helpButton = appendCategoryHelpButton(header, options);
        return { element: header, heading, helpButton };
    }

    function pluralize(count, forms) {
        const value = Math.abs(Math.trunc(Number(count) || 0));
        const [one = '', few = one, many = few] = Array.isArray(forms) ? forms : [];
        const lastTwo = value % 100;
        if (lastTwo >= 11 && lastTwo <= 14) return many;
        const last = value % 10;
        if (last === 1) return one;
        if (last >= 2 && last <= 4) return few;
        return many;
    }

    function statusPill(kind, text) {
        const pill = document.createElement('span');
        pill.className = 'fpt-status-pill';
        pill.dataset.kind = String(kind || 'neutral');
        pill.setAttribute('role', pill.dataset.kind === 'error' ? 'alert' : 'status');
        pill.textContent = String(text ?? '');
        return pill;
    }

    function createDialog(popup, title, { wide = false, description = '' } = {}) {
        if (!popup) throw new Error('Popup container is unavailable.');
        popup.querySelector('.fpt-lot-dialog-backdrop')?.remove();

        const previousFocus = document.activeElement;
        const backdrop = document.createElement('div');
        backdrop.className = 'fpt-lot-dialog-backdrop';
        const dialog = document.createElement('section');
        dialog.className = `fpt-lot-dialog${wide ? ' fpt-lot-dialog--bulk' : ''}`;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', title);

        const header = document.createElement('header');
        header.className = 'fpt-lot-dialog-header';
        const heading = document.createElement('h2');
        heading.textContent = title;
        header.appendChild(heading);
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'fpt-lot-dialog-close';
        closeButton.textContent = '×';
        closeButton.setAttribute('aria-label', 'Закрыть');
        header.appendChild(closeButton);

        const body = document.createElement('div');
        body.className = 'fpt-lot-dialog-body';
        if (description) {
            const copy = document.createElement('p');
            copy.className = 'fpt-lot-dialog-copy';
            copy.textContent = description;
            body.appendChild(copy);
        }
        const footer = document.createElement('footer');
        footer.className = 'fpt-lot-dialog-footer';
        dialog.append(header, body, footer);
        backdrop.appendChild(dialog);
        popup.appendChild(backdrop);

        let closed = false;
        let busy = false;
        let stopButton = null;
        let stopHandler = null;
        let stopRequested = false;
        const disabledBeforeBusy = new Map();
        const focusableSelector = [
            'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
        ].join(',');
        const getFocusable = () => Array.from(dialog.querySelectorAll(focusableSelector)).filter(element =>
            !element.closest('[hidden]') && element.getClientRects().length > 0
        );

        const close = ({ force = false } = {}) => {
            if (closed || (busy && !force)) return false;
            closed = true;
            window.removeEventListener('keydown', onKeyDown, true);
            backdrop.remove();
            if (previousFocus && typeof previousFocus.focus === 'function' && document.contains(previousFocus)) {
                previousFocus.focus({ preventScroll: true });
            }
            return true;
        };

        const focusInitial = () => {
            const preferred = body.querySelector('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])');
            const first = preferred || getFocusable().find(element => element !== closeButton);
            (first || dialog).focus({ preventScroll: true });
        };

        function onKeyDown(event) {
            if (closed) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                if (!busy) close();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = getFocusable();
            if (!focusable.length) {
                event.preventDefault();
                dialog.focus({ preventScroll: true });
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && (active === first || !dialog.contains(active))) {
                event.preventDefault();
                last.focus({ preventScroll: true });
            } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
                event.preventDefault();
                first.focus({ preventScroll: true });
            }
        }

        function setBusy(nextBusy, options = {}) {
            busy = Boolean(nextBusy);
            dialog.setAttribute('aria-busy', busy ? 'true' : 'false');
            if (!busy) {
                stopButton?.remove();
                stopButton = null;
                stopHandler = null;
                stopRequested = false;
                disabledBeforeBusy.forEach((wasDisabled, control) => {
                    if (control.isConnected) control.disabled = wasDisabled;
                });
                disabledBeforeBusy.clear();
                return;
            }

            stopHandler = typeof options.onStop === 'function' ? options.onStop : null;
            dialog.querySelectorAll('button, input, select, textarea').forEach(control => {
                if (control === stopButton) return;
                if (!disabledBeforeBusy.has(control)) disabledBeforeBusy.set(control, control.disabled);
                control.disabled = true;
            });
            if (stopHandler && !stopButton) {
                stopButton = document.createElement('button');
                stopButton.type = 'button';
                stopButton.className = 'fpt-lot-dialog-button fpt-lot-dialog-button--danger fpt-lot-dialog-stop';
                stopButton.dataset.fptDialogStop = 'true';
                stopButton.textContent = options.stopLabel || 'Остановить';
                stopButton.addEventListener('click', () => {
                    if (!busy || stopRequested) return;
                    stopRequested = true;
                    stopButton.disabled = true;
                    stopButton.textContent = options.stoppingLabel || 'Останавливаем…';
                    stopHandler?.();
                });
                footer.appendChild(stopButton);
            }
        }

        closeButton.addEventListener('click', () => close());
        backdrop.addEventListener('click', event => {
            if (event.target === backdrop && !busy) close();
        });
        window.addEventListener('keydown', onKeyDown, true);
        window.requestAnimationFrame?.(() => { if (!closed) focusInitial(); });
        if (typeof window.requestAnimationFrame !== 'function') setTimeout(() => { if (!closed) focusInitial(); }, 0);

        return { backdrop, dialog, body, footer, close, setBusy, focusInitial, get busy() { return busy; } };
    }

    const toastStates = new WeakMap();

    function toastOwner(popup) {
        return popup?.closest?.('.fp-tools-popup') || popup;
    }

    const TOAST_THEME_VARS = ['--fptm-bg', '--fptm-surface', '--fptm-text', '--fptm-muted', '--fptm-border', '--fptm-accent', '--fptm-accent-soft', '--fptm-accent-border', '--fptm-shadow', '--fptm-danger-border', '--fptm-warning-border'];

    // Toasts live outside the popup, pinned to the viewport corner, so they never cover extension content.
    function ensureToastRegion(owner) {
        let region = document.querySelector('body > .fpt-popup-toast-region');
        if (!region) {
            region = document.createElement('div');
            region.className = 'fpt-popup-toast-region fpt-popup-toast-region--page';
            region.setAttribute('aria-live', 'polite');
            region.setAttribute('aria-relevant', 'additions text');
            document.body.appendChild(region);
        }
        const styles = root.getComputedStyle?.(owner);
        if (styles) {
            TOAST_THEME_VARS.forEach(name => {
                const value = styles.getPropertyValue(name).trim();
                if (value) region.style.setProperty(name, value);
                else region.style.removeProperty(name);
            });
        }
        return region;
    }

    function showToast(popup, message, kind = 'success', options = {}) {
        if (kind && typeof kind === 'object') {
            options = kind;
            kind = options.kind || 'success';
        }
        const owner = toastOwner(popup);
        if (!owner) return null;
        let state = toastStates.get(owner);
        if (!state) {
            state = { queue: [], current: null, timer: null, startedAt: 0, remaining: 0, element: null };
            toastStates.set(owner, state);
        }
        state.queue.push({
            message: String(message || 'Готово'),
            kind: String(kind || 'success'),
            durationMs: Math.max(10, Number(options.durationMs) || 4200)
        });
        if (state.current) return state.element;

        const displayNext = () => {
            if (!state.queue.length) {
                state.current = null;
                state.element?.remove();
                state.element = null;
                state.timer = null;
                return;
            }
            state.current = state.queue.shift();
            state.remaining = state.current.durationMs;
            const region = ensureToastRegion(owner);
            const toast = document.createElement('div');
            toast.className = 'fpt-popup-toast';
            toast.dataset.kind = state.current.kind;
            toast.setAttribute('role', state.current.kind === 'error' ? 'alert' : 'status');
            const icon = document.createElement('span');
            icon.className = 'fpt-popup-toast-icon material-symbols-rounded';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = { error: 'error', warning: 'warning' }[state.current.kind] || 'check_circle';
            const text = document.createElement('span');
            text.className = 'fpt-popup-toast-text';
            text.textContent = state.current.message;
            toast.append(icon, text);
            region.replaceChildren(toast);
            state.element = toast;
            let leaving = false;

            const pause = () => {
                if (state.timer === null) return;
                clearTimeout(state.timer);
                state.timer = null;
                state.remaining = Math.max(0, state.remaining - (Date.now() - state.startedAt));
            };
            const resume = () => {
                if (state.timer !== null || !state.current || leaving) return;
                state.startedAt = Date.now();
                state.timer = setTimeout(() => {
                    state.timer = null;
                    leaving = true;
                    let exitTimer;
                    let finished = false;
                    const finish = () => {
                        if (finished) return;
                        finished = true;
                        clearTimeout(exitTimer);
                        toast.remove();
                        state.current = null;
                        state.element = null;
                        displayNext();
                    };
                    toast.addEventListener('transitionend', event => {
                        if (event.target === toast && event.propertyName === 'opacity') finish();
                    });
                    toast.classList.add('is-leaving');
                    if (root.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finish();
                    else exitTimer = setTimeout(finish, 360); // Hidden/detached pages may not emit transitionend.
                }, state.remaining);
            };
            toast.addEventListener('mouseenter', pause);
            toast.addEventListener('mouseleave', resume);
            resume();
        };
        displayNext();
        return state.element;
    }

    // Replaces the native dropdown list of a <select> with a themed one. The <select> stays in the
    // DOM (invisible) as the source of truth, so values, change events and option refills keep working.
    function enhanceSelect(select, host = select.parentNode) {
        if (!select || select.dataset.fptEnhanced === '1' || !host) return select;
        select.dataset.fptEnhanced = '1';
        host.classList.add('fpt-select-host');
        select.classList.add('fpt-select-native');
        select.tabIndex = -1;
        select.setAttribute('aria-hidden', 'true');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'fpt-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        const ariaLabel = select.getAttribute('aria-label');
        if (ariaLabel) trigger.setAttribute('aria-label', ariaLabel);
        const value = document.createElement('span');
        value.className = 'fpt-select-value';
        const chevron = document.createElement('span');
        chevron.className = 'fpt-select-chevron material-symbols-rounded';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = 'expand_more';
        trigger.append(value, chevron);

        const menu = document.createElement('div');
        menu.className = 'fpt-select-menu';
        menu.setAttribute('role', 'listbox');
        menu.hidden = true;
        host.append(trigger, menu);

        let items = [];
        let active = -1;
        const isOpen = () => !menu.hidden;
        const label = () => select.options[select.selectedIndex]?.textContent || '';

        function rebuild() {
            value.textContent = label();
            trigger.disabled = select.disabled;
            items = [...select.options].map((option, index) => {
                const item = document.createElement('div');
                item.className = 'fpt-select-option';
                item.setAttribute('role', 'option');
                item.dataset.index = String(index);
                item.textContent = option.textContent;
                item.title = option.textContent;
                const selected = index === select.selectedIndex;
                item.classList.toggle('is-selected', selected);
                item.setAttribute('aria-selected', String(selected));
                if (option.disabled) item.setAttribute('aria-disabled', 'true');
                return item;
            });
            menu.replaceChildren(...items);
        }
        function setActive(index, scroll = true) {
            items[active]?.classList.remove('is-active');
            active = index;
            const item = items[active];
            if (!item) return;
            item.classList.add('is-active');
            if (scroll) item.scrollIntoView({ block: 'nearest' });
        }
        function step(from, dir) {
            for (let i = from + dir; i >= 0 && i < items.length; i += dir) {
                if (!select.options[i].disabled) return i;
            }
            return from;
        }
        function open() {
            if (isOpen() || select.disabled || !items.length) return;
            rebuild();
            menu.hidden = false;
            const rect = trigger.getBoundingClientRect();
            const room = root.innerHeight - rect.bottom;
            menu.classList.toggle('is-up', room < 260 && rect.top > room);
            trigger.setAttribute('aria-expanded', 'true');
            setActive(Math.max(0, select.selectedIndex));
            document.addEventListener('pointerdown', onOutside, true);
        }
        function close(focus = false) {
            if (!isOpen()) return;
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            document.removeEventListener('pointerdown', onOutside, true);
            if (focus) trigger.focus();
        }
        function onOutside(event) {
            if (!host.contains(event.target)) close();
        }
        function choose(index) {
            if (index < 0 || select.options[index]?.disabled) return;
            const changed = select.selectedIndex !== index;
            select.selectedIndex = index;
            value.textContent = label();
            close(true);
            if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        trigger.addEventListener('click', () => (isOpen() ? close() : open()));
        menu.addEventListener('pointermove', event => {
            const item = event.target.closest('.fpt-select-option');
            if (item && Number(item.dataset.index) !== active) setActive(Number(item.dataset.index), false);
        });
        menu.addEventListener('click', event => {
            const item = event.target.closest('.fpt-select-option');
            if (item) choose(Number(item.dataset.index));
        });
        trigger.addEventListener('keydown', event => {
            const key = event.key;
            if (!isOpen()) {
                if (key === 'ArrowDown' || key === 'ArrowUp') { event.preventDefault(); open(); }
                return;
            }
            if (key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
            else if (key === 'ArrowDown') { event.preventDefault(); setActive(step(active, 1)); }
            else if (key === 'ArrowUp') { event.preventDefault(); setActive(step(active, -1)); }
            else if (key === 'Home') { event.preventDefault(); setActive(step(-1, 1)); }
            else if (key === 'End') { event.preventDefault(); setActive(step(items.length, -1)); }
            else if (key === 'Enter' || key === ' ') { event.preventDefault(); choose(active); }
            else if (key === 'Tab') close();
        });
        select.addEventListener('change', () => { value.textContent = label(); });
        const observer = new MutationObserver(() => {
            if (!host.isConnected) { observer.disconnect(); return; }
            rebuild();
        });
        observer.observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
        rebuild();
        return select;
    }

    // Calls back each time a popup page becomes the active one. Returns a disconnect function.
    function onPageActivated(page, callback) {
        if (!page || typeof callback !== 'function' || typeof MutationObserver !== 'function') return () => {};
        let wasActive = page.classList.contains('active');
        const observer = new MutationObserver(() => {
            const active = page.classList.contains('active');
            if (active && !wasActive) callback();
            wasActive = active;
        });
        observer.observe(page, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }

    root.FPTPopupUI = Object.freeze({
        onPageActivated,
        enhanceSelect,
        createCategoryHeader,
        ensureCategoryHeader,
        createCheckboxControl,
        observePopupControls,
        createDialog,
        showToast,
        pluralize,
        statusPill
    });
})(window);
