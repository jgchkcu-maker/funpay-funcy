
const FPT_GC_WORKER = 'https://fpt-chat.starobinskiy01.workers.dev';
const FPT_BOT_USERNAME = 'FPToolsBot';
let _fptGcSelfName = null, _fptGcSelfAvatar = '', _fptGcSelfUrl = '';

const FPT_GC_CFG_JSDELIVR = 'https://cdn.jsdelivr.net/gh/XaviersDev/FunPay-Tools@main/public-chat.json';
const FPT_GC_CFG_RAW      = 'https://raw.githubusercontent.com/XaviersDev/FunPay-Tools/main/public-chat.json';
const FPT_GC_CFG_TTL_MS   = 16 * 60 * 1000;

let _fptGcConfig = {
    active: true,
    display: true,
    disabledMessage: 'Общий чат временно недоступен. Ожидайте.'
};

function _fptGcApplyConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') return;
    if (typeof cfg.active === 'boolean')  _fptGcConfig.active  = cfg.active;
    if (typeof cfg.display === 'boolean') _fptGcConfig.display = cfg.display;
    if (typeof cfg.disabledMessage === 'string' && cfg.disabledMessage.trim()) {
        _fptGcConfig.disabledMessage = cfg.disabledMessage;
    }
}

async function fptGcRefreshConfig(force) {
    try {
        if (!force) {
            const { fpToolsGCConfig, fpToolsGCConfigTs } = await chrome.storage.local.get(['fpToolsGCConfig', 'fpToolsGCConfigTs']);
            if (fpToolsGCConfig && fpToolsGCConfigTs && (Date.now() - fpToolsGCConfigTs) < FPT_GC_CFG_TTL_MS) {
                _fptGcApplyConfig(fpToolsGCConfig);
                fptGcApplyVisibility();
                return _fptGcConfig;
            }
        }
        const bust = '?t=' + Date.now();
        let cfg = null;
        for (const base of [FPT_GC_CFG_JSDELIVR, FPT_GC_CFG_RAW]) {
            try {
                const r = await fetch(base + bust, { cache: 'no-store' });
                if (!r.ok) continue;
                cfg = await r.json();
                if (cfg && typeof cfg === 'object') break;
            } catch (e) { /* next source */ }
        }
        if (cfg && typeof cfg === 'object') {
            _fptGcApplyConfig(cfg);
            await chrome.storage.local.set({ fpToolsGCConfig: cfg, fpToolsGCConfigTs: Date.now() });
            fptGcApplyVisibility();
        }
    } catch (e) { /* offline - keep defaults */ }
    return _fptGcConfig;
}

function fptGcApplyVisibility() {
    const navLi = document.querySelector('li[data-page="global_chat"]');
    if (navLi) {
        navLi.hidden = !_fptGcConfig.display;
        navLi.style.display = _fptGcConfig.display ? '' : 'none';
        navLi.setAttribute('aria-hidden', _fptGcConfig.display ? 'false' : 'true');
        navLi.setAttribute('aria-disabled', _fptGcConfig.active ? 'false' : 'true');
        navLi.classList.toggle('fpt-nav-disabled', !_fptGcConfig.active);
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fpt:global-chat-visibility', {
            detail: { display: _fptGcConfig.display, active: _fptGcConfig.active }
        }));
    }
}

// =============================================================================
// Кто я на FunPay (ник, аватар, ссылка на профиль) - со страницы. Косметика.
// =============================================================================
function _fptGcDetectSelf() {
    try {
        // Ник, аватар и ссылка на профиль берутся со страницы.
        const nameEl = document.querySelector('.user-link-name');
        if (nameEl && nameEl.textContent.trim()) _fptGcSelfName = nameEl.textContent.trim();

        // Ссылка на свой профиль: пункт меню "Профиль".
        const profA = document.querySelector('a.user-link-dropdown[href*="/users/"], .user-link-dropdown[href*="/users/"]');
        if (profA && profA.getAttribute('href')) {
            _fptGcSelfUrl = new URL(profA.getAttribute('href'), location.origin).href;
        }

        // Аватар: .user-link-photo img в шапке.
        const av = document.querySelector('.user-link-photo img[src], .navbar-header .user-link-photo img[src]');
        if (av) {
            const src = av.getAttribute('src');
            if (src && src.trim()) _fptGcSelfAvatar = new URL(src, location.origin).href;
        }

        const appData = document.body && document.body.dataset && document.body.dataset.appData;
        if (appData && !_fptGcSelfName) {
            const d = JSON.parse(appData);
            if (d && d.userName) _fptGcSelfName = d.userName;
        }
    } catch (e) { /* ignore */ }
}

// =============================================================================
// Worker API
// =============================================================================
async function _fptGcApi(payload) {
    const r = await fetch(FPT_GC_WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data };
}

window.fptGcRefreshConfig = fptGcRefreshConfig;
window.fptGcApplyVisibility = fptGcApplyVisibility;

async function sendPopupGlobalChat(p) {
    const text = String(p.text || '').trim();
    if (!text || text.length > 300) throw new Error('Сообщение должно содержать от 1 до 300 символов.');
    await fptGcRefreshConfig(false);
    if (!_fptGcConfig.active) throw new Error(_fptGcConfig.disabledMessage);
    const { fpToolsGCToken: token } = await chrome.storage.local.get('fpToolsGCToken');
    if (!token) throw new Error('Требуется вход в чат.');
    _fptGcDetectSelf();
    const response = await _fptGcApi({ action: 'send', token, nick: _fptGcSelfName || 'FunPay user',
        avatar: _fptGcSelfAvatar || '', url: _fptGcSelfUrl || '', text });
    if (!response.ok || !response.data?.ok) {
        if (response.status === 401) await chrome.storage.local.remove('fpToolsGCToken');
        throw new Error(response.data?.error || 'Не удалось отправить сообщение.');
    }
    return response.data;
}
if (typeof window !== 'undefined' && window.fptPopupActions) {
    window.fptPopupActions.register('global_chat', 'fpt-gc-send', sendPopupGlobalChat);
    window.fptPopupActions.register('global_chat', 'getMessages', p => _fptGcApi({ action: 'fetch', since: p.since || 0 }));
    window.fptPopupActions.register('global_chat', '_fptGcStartLink', async () => {
        const response = await _fptGcApi({ action: 'start' });
        if (!response.ok || !response.data?.code) throw new Error('Не удалось начать вход.');
        return { ...response.data, url: `https://t.me/${FPT_BOT_USERNAME}?start=fptchat_${response.data.code}` };
    });
    window.fptPopupActions.register('global_chat', 'fpt-gc-gate-btn', p => window.fptPopupActions.run('global_chat', '_fptGcStartLink', p));
    window.fptPopupActions.register('global_chat', '_fptGcPollLink', async p => {
        const response = await _fptGcApi({ action: 'poll', code: p.code });
        if (response.data?.token) await chrome.storage.local.set({ fpToolsGCToken: response.data.token });
        return response.data;
    });
}
