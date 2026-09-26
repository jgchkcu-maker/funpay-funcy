// content/features/slash_telegram_ui.js
// Настройки страниц «Слэш-команды» и «Telegram» в попапе FunPay Funcy.
// Сохранение в chrome.storage.local (fpToolsSlashCommands / fpToolsTelegram).

// ─────────────────────────────────────────────────────────────────────────────
//  СЛЭШ-КОМАНДЫ
// ─────────────────────────────────────────────────────────────────────────────
const FPT_SLASH_KEY = 'fpToolsSlashCommands';
const FPT_SLASH_DEFAULTS = { enabled: true, expandKey: 'both', autocomplete: true, commands: [] };
let _fptSlashCfg = null;
let _fptSlashPanel = null;

async function fptSlashLoad() {
    const r = await chrome.storage.local.get(FPT_SLASH_KEY);
    _fptSlashCfg = Object.assign({}, FPT_SLASH_DEFAULTS, r[FPT_SLASH_KEY] || {});
    if (!Array.isArray(_fptSlashCfg.commands)) _fptSlashCfg.commands = [];
    return _fptSlashCfg;
}
async function fptSlashSave() {
    await chrome.storage.local.set({ [FPT_SLASH_KEY]: _fptSlashCfg });
}

async function fptSlashAddCommand() {
    _fptSlashCfg.commands.push({ id: Date.now().toString(), trigger: '/', response: '' });
    await fptSlashSave();
    fptSlashRenderList();
}

function fptSlashRenderList() {
    const list = _fptSlashPanel?.querySelector('#fptSlashList') || document.getElementById('fptSlashList');
    if (!list) return;

    if (!_fptSlashCfg.commands.length) {
        list.innerHTML = `
            <div class="fpt-ui-state fp-qr-slash-empty">
                <svg class="fp-qr-empty-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                    <path d="M7 6.5h10A2.5 2.5 0 0 1 19.5 9v6A2.5 2.5 0 0 1 17 17.5H9l-4.5 2v-10A3 3 0 0 1 7 6.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
                    <path d="M8.5 10.5h7M8.5 13.5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                </svg>
                <p class="fpt-ui-state-title">Команд пока нет</p>
                <p class="fpt-ui-state-text">Создайте первую команду, например /привет, и сохраните готовый ответ.</p>
                <button type="button" class="fpt-ui-button fpt-ui-button--primary fpt-slash-empty-add">Добавить первую команду</button>
            </div>
        `;
        return;
    }

    list.innerHTML = _fptSlashCfg.commands.map((c, i) => `
        <article class="fpt-slash-row fp-qr-slash-row" data-i="${i}">
            <div class="fp-qr-slash-row-header">
                <label class="fp-qr-slash-trigger-wrap">
                    <span class="fp-qr-field-label">Команда</span>
                    <input type="text" class="fpt-slash-trigger fpt-ui-control fp-qr-slash-trigger" data-i="${i}" value="${fptSlashEsc(c.trigger || '')}" placeholder="/привет" autocomplete="off" spellcheck="false">
                </label>
                <button type="button" class="fpt-ui-button fpt-ui-button--tertiary fpt-ui-icon-button fpt-slash-del fp-qr-slash-delete" data-i="${i}" title="Удалить команду" aria-label="Удалить команду">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M8 7h8m-7 0 .5 11h5L15 7m-5-2h4l.5 2h-5L10 5Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
            <label class="fp-qr-slash-response-wrap">
                <span class="fp-qr-field-label">Ответ</span>
                <textarea class="fpt-slash-response template-input fp-qr-slash-response" data-i="${i}" rows="2" placeholder="Текст ответа. Можно использовать переменные.">${fptSlashEsc(c.response || '')}</textarea>
            </label>
        </article>
    `).join('');
}
function fptSlashEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function fptSlashNormalizeTrigger(t) {
    t = (t || '').trim().replace(/\s+/g, '');
    if (!t) return '';
    if (!t.startsWith('/')) t = '/' + t;
    return t;
}

let _fptSlashUiBound = false;
async function initializeSlashCommandsUI() {
    const templatesPage = document.querySelector('.fp-tools-page-content[data-page="templates"]');
    const page = templatesPage?.querySelector('[data-quick-replies-pane="commands"]');
    if (!page) return;
    _fptSlashPanel = page;
    await fptSlashLoad();

    const enabledEl = page.querySelector('#fptSlashEnabled');
    const autoEl = page.querySelector('#fptSlashAutocomplete');
    const configEl = page.querySelector('#fptSlashConfig');
    const keyRadios = page.querySelectorAll('input[name="fptSlashKey"]');

    if (enabledEl) enabledEl.checked = _fptSlashCfg.enabled !== false;
    if (autoEl) autoEl.checked = _fptSlashCfg.autocomplete !== false;
    keyRadios.forEach(r => { r.checked = (r.value === (_fptSlashCfg.expandKey || 'both')); });
    if (configEl) configEl.hidden = (_fptSlashCfg.enabled === false);

    fptSlashRenderList();

    if (_fptSlashUiBound) return;
    _fptSlashUiBound = true;

    enabledEl && enabledEl.addEventListener('change', async () => {
        _fptSlashCfg.enabled = enabledEl.checked;
        if (configEl) configEl.hidden = !enabledEl.checked;
        await fptSlashSave();
    });
    autoEl && autoEl.addEventListener('change', async () => {
        _fptSlashCfg.autocomplete = autoEl.checked;
        await fptSlashSave();
    });
    keyRadios.forEach(r => r.addEventListener('change', async () => {
        if (r.checked) { _fptSlashCfg.expandKey = r.value; await fptSlashSave(); }
    }));

    const addBtn = page.querySelector('#fptSlashAddBtn');
    addBtn && addBtn.addEventListener('click', fptSlashAddCommand);

    const list = page.querySelector('#fptSlashList');
    if (list && !list.dataset.bound) {
        list.dataset.bound = '1';
        let saveT = null;
        const scheduleSave = () => { clearTimeout(saveT); saveT = setTimeout(fptSlashSave, 350); };

        list.addEventListener('input', (e) => {
            const i = parseInt(e.target.dataset.i, 10);
            if (isNaN(i) || !_fptSlashCfg.commands[i]) return;
            if (e.target.classList.contains('fpt-slash-trigger')) {
                _fptSlashCfg.commands[i].trigger = e.target.value; // нормализуем при blur
            } else if (e.target.classList.contains('fpt-slash-response')) {
                _fptSlashCfg.commands[i].response = e.target.value;
            }
            scheduleSave();
        });
        list.addEventListener('focusout', async (e) => {
            if (e.target.classList.contains('fpt-slash-trigger')) {
                const i = parseInt(e.target.dataset.i, 10);
                if (!isNaN(i) && _fptSlashCfg.commands[i]) {
                    _fptSlashCfg.commands[i].trigger = fptSlashNormalizeTrigger(e.target.value);
                    e.target.value = _fptSlashCfg.commands[i].trigger;
                    await fptSlashSave();
                }
            }
        });
        list.addEventListener('click', async (e) => {
            const emptyAdd = e.target.closest('.fpt-slash-empty-add');
            if (emptyAdd) {
                await fptSlashAddCommand();
                return;
            }
            const del = e.target.closest('.fpt-slash-del');
            if (!del) return;
            const i = parseInt(del.dataset.i, 10);
            if (isNaN(i)) return;
            _fptSlashCfg.commands.splice(i, 1);
            await fptSlashSave();
            fptSlashRenderList();
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TELEGRAM
// ─────────────────────────────────────────────────────────────────────────────
const FPT_TG_KEY = 'fpToolsTelegram';
const FPT_TG_DEFAULTS = {
    enabled: false, token: '', chatId: '',
    notifyMessages: true, notifyOrders: true, allowControl: true, pollInterval: 1, lastUpdateId: 0
};
let _fptTgCfg = null;

async function fptTgLoad() {
    const r = await chrome.storage.local.get(FPT_TG_KEY);
    _fptTgCfg = Object.assign({}, FPT_TG_DEFAULTS, r[FPT_TG_KEY] || {});
    return _fptTgCfg;
}
async function fptTgSave() {
    await chrome.storage.local.set({ [FPT_TG_KEY]: _fptTgCfg });
}

function fptTgSetStatus(text, kind) {
    const el = document.getElementById('fptTgStatus');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = kind === 'ok' ? '#4caf82' : kind === 'err' ? '#ff6b6b' : '#9099b8';
}

let _fptTgUiBound = false;
async function initializeTelegramUI() {
    const page = document.querySelector('.fp-tools-page-content[data-page="telegram"]');
    if (!page) return;
    await fptTgLoad();

    const enabledEl = document.getElementById('fptTgEnabled');
    const configEl = document.getElementById('fptTgConfig');
    const tokenEl = document.getElementById('fptTgToken');
    const chatIdEl = document.getElementById('fptTgChatId');
    const notifyOrdersEl = document.getElementById('fptTgNotifyOrders');
    const notifyMsgEl = document.getElementById('fptTgNotifyMessages');
    const allowControlEl = document.getElementById('fptTgAllowControl');

    if (enabledEl) enabledEl.checked = !!_fptTgCfg.enabled;
    if (configEl) configEl.style.display = _fptTgCfg.enabled ? '' : 'none';
    if (tokenEl) tokenEl.value = _fptTgCfg.token || '';
    if (chatIdEl) chatIdEl.value = _fptTgCfg.chatId || '';
    if (notifyOrdersEl) notifyOrdersEl.checked = _fptTgCfg.notifyOrders !== false;
    if (notifyMsgEl) notifyMsgEl.checked = _fptTgCfg.notifyMessages !== false;
    if (allowControlEl) allowControlEl.checked = _fptTgCfg.allowControl !== false;

    if (_fptTgCfg.token && _fptTgCfg.chatId) {
        fptTgSetStatus('Подключено. Chat ID: ' + _fptTgCfg.chatId, 'ok');
    } else {
        fptTgSetStatus('');
    }

    if (_fptTgUiBound) return;
    _fptTgUiBound = true;

    enabledEl && enabledEl.addEventListener('change', async () => {
        _fptTgCfg.enabled = enabledEl.checked;
        if (configEl) configEl.style.display = enabledEl.checked ? '' : 'none';
        if (enabledEl.checked && (!_fptTgCfg.token || !_fptTgCfg.chatId)) {
            fptTgSetStatus('Введите токен и нажмите «Подключить», иначе уведомления не будут приходить.', 'err');
        }
        await fptTgSave();
    });

    [['fptTgNotifyOrders', 'notifyOrders'], ['fptTgNotifyMessages', 'notifyMessages'], ['fptTgAllowControl', 'allowControl']]
        .forEach(([id, key]) => {
            const el = document.getElementById(id);
            el && el.addEventListener('change', async () => { _fptTgCfg[key] = el.checked; await fptTgSave(); });
        });

    chatIdEl && chatIdEl.addEventListener('change', async () => {
        _fptTgCfg.chatId = chatIdEl.value.trim();
        await fptTgSave();
    });

    const connectBtn = document.getElementById('fptTgConnectBtn');
    connectBtn && connectBtn.addEventListener('click', async () => {
        const token = (tokenEl.value || '').trim();
        if (!token) { fptTgSetStatus('Введите токен бота.', 'err'); return; }
        connectBtn.disabled = true;
        fptTgSetStatus('Проверяю токен…');
        try {
            const res = await chrome.runtime.sendMessage({ action: 'telegramValidate', token });
            if (!res || !res.ok) {
                fptTgSetStatus('Ошибка: ' + (res && res.error ? res.error : 'неверный токен'), 'err');
                connectBtn.disabled = false;
                return;
            }
            _fptTgCfg.token = token;
            if (res.chatId) {
                _fptTgCfg.chatId = res.chatId;
                if (chatIdEl) chatIdEl.value = res.chatId;
            }
            // включаем интеграцию автоматически при успешном подключении
            _fptTgCfg.enabled = true;
            if (enabledEl) enabledEl.checked = true;
            if (configEl) configEl.style.display = '';
            await fptTgSave();

            if (res.chatId) {
                fptTgSetStatus(`Готово! Бот ${res.botName}. Chat ID: ${res.chatId}.`, 'ok');
            } else {
                fptTgSetStatus(`Бот ${res.botName} найден, но не удалось определить чат. Напишите боту любое сообщение в Telegram и нажмите «Подключить» ещё раз.`, 'err');
            }
        } catch (e) {
            fptTgSetStatus('Ошибка: ' + e.message, 'err');
        } finally {
            connectBtn.disabled = false;
        }
    });

    const testBtn = document.getElementById('fptTgTestBtn');
    testBtn && testBtn.addEventListener('click', async () => {
        if (!_fptTgCfg.token || !_fptTgCfg.chatId) {
            fptTgSetStatus('Сначала подключите бота (токен + chat id).', 'err');
            return;
        }
        testBtn.disabled = true;
        fptTgSetStatus('Отправляю тестовое сообщение…');
        try {
            const res = await chrome.runtime.sendMessage({ action: 'telegramTest' });
            if (res && res.ok) fptTgSetStatus('Тестовое сообщение отправлено в Telegram ✅', 'ok');
            else fptTgSetStatus('Не удалось отправить: ' + (res && res.error ? res.error : 'ошибка'), 'err');
        } catch (e) {
            fptTgSetStatus('Ошибка: ' + e.message, 'err');
        } finally {
            testBtn.disabled = false;
        }
    });
}

// expose
if (typeof window !== 'undefined') {
    window.initializeSlashCommandsUI = initializeSlashCommandsUI;
    window.initializeTelegramUI = initializeTelegramUI;
}
