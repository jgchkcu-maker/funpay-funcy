// content/features/translate_consent.js
// One consent for every Google Translate path (chat messages, lot fields, lot copy).
// Nothing is sent until the user presses «Разрешить» in the window; the background
// translator checks the same storage key, so a caller that skips this still gets refused.
(function (root) {
    'use strict';
    if (root.FPTTranslateConsent) return;

    const KEY = 'fpToolsTranslateConsentAt';
    let granted = false;
    let pending = null;
    // Declining stops background work (the dialog's translation mode) from asking again on
    // every new message; an explicit click on a translate button still shows the window.
    let declined = false;

    async function has() {
        if (granted) return true;
        try {
            const stored = await chrome.storage.local.get(KEY);
            granted = Number(stored?.[KEY]) > 0;
        } catch (_) {}
        return granted;
    }

    function ask() {
        const win = root.fptWindow;
        if (!win) return Promise.resolve(root.confirm(
            'Funcy передаст выбранный текст сервису Google Translate (translate.googleapis.com), чтобы получить перевод. Разрешить?'));
        return new Promise(resolve => {
            let answer = false;
            const w = win.create({
                title: 'Перевод через Google Translate',
                subtitle: 'Нужно ваше разрешение',
                icon: 'translate',
                size: 'sm',
                removeOnClose: true,
                onClose: () => resolve(answer)
            });
            const text = [
                'Чтобы перевести текст, Funcy отправит его сервису Google Translate (translate.googleapis.com). Переводятся только сообщения и поля лота, для которых вы нажали «Перевести» или включили режим перевода чата.',
                'Cookies FunPay, товар из выдачи и данные аккаунта не передаются. Не переводите пароли, ключи и платёжные данные.',
                'Разрешение хранится только в этом браузере. Без него перевод не работает, остальные функции доступны.'
            ];
            text.forEach(line => {
                const p = document.createElement('p');
                p.className = 'fpt-win-text';
                p.textContent = line;
                w.body.appendChild(p);
            });
            const cancel = win.button('Отмена', { kind: 'quiet' });
            const allow = win.button('Разрешить', { kind: 'primary', iconName: 'check' });
            cancel.addEventListener('click', () => w.close());
            allow.addEventListener('click', () => { answer = true; w.close(); });
            w.foot.append(cancel, allow);
            w.open({ focus: allow });
        });
    }

    // Resolves true once the user has allowed sending text to Google Translate.
    async function ensure({ explicit = true } = {}) {
        if (await has()) return true;
        if (!explicit && declined) return false;
        if (!pending) {
            pending = ask().then(async ok => {
                if (ok) {
                    granted = true;
                    declined = false;
                    try { await chrome.storage.local.set({ [KEY]: Date.now() }); } catch (_) {}
                } else {
                    declined = true;
                }
                return ok;
            }).finally(() => { pending = null; });
        }
        return pending;
    }

    root.FPTTranslateConsent = Object.freeze({ KEY, has, ensure });
})(window);
