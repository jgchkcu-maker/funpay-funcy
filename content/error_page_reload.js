// content/error_page_reload.js
// FIX 2.9.0: когда FunPay отдаёт страницу ошибки nginx (502 Bad Gateway, 503, 504)
// или 429 (Too Many Requests), показываем аккуратную заглушку с таймером и
// "Подождите..." и сами перезагружаем страницу через 3.5 секунды, вместо голой
// чёрно-белой ошибки nginx.
(function () {
    // Признаки страницы-ошибки nginx/FunPay. Они очень компактные: <h1>NNN ...</h1>
    // + "nginx", без обычной разметки FunPay (нет navbar/app-config).
    function looksLikeErrorPage() {
        try {
            // если это нормальная страница FunPay - на ней есть data-app-config / navbar
            if (document.querySelector('[data-app-config], nav.navbar, #content')) return false;

            const bodyText = (document.body ? document.body.innerText || document.body.textContent || '' : '');
            const h1 = document.querySelector('h1');
            const h1text = h1 ? (h1.textContent || '').trim() : '';

            // коды, которые имеет смысл переждать и перезагрузить
            const RETRY_CODES = ['502', '503', '504', '429'];
            const PHRASES = ['bad gateway', 'gateway time-out', 'gateway timeout',
                             'service temporarily unavailable', 'too many requests'];

            const hasCode = RETRY_CODES.some(c => h1text.includes(c) || bodyText.includes(c));
            const hasPhrase = PHRASES.some(p => bodyText.toLowerCase().includes(p));
            const hasNginx = bodyText.toLowerCase().includes('nginx');

            // считаем ошибкой, если есть код+(nginx|фраза) ИЛИ явная фраза
            return (hasCode && (hasNginx || hasPhrase)) || (hasPhrase && hasNginx);
        } catch (_) {
            return false;
        }
    }

    function detectCode() {
        const t = (document.body ? (document.body.innerText || document.body.textContent || '') : '');
        const h1 = document.querySelector('h1');
        const h1text = h1 ? h1.textContent : '';
        const m = (h1text + ' ' + t).match(/\b(502|503|504|429)\b/);
        return m ? m[1] : null;
    }

    function showWaitOverlay(code) {
        const RELOAD_MS = 3500;
        const codeText = code === '429'
            ? 'Слишком много запросов'
            : 'FunPay временно недоступен';
        const mascotUrl = chrome.runtime.getURL('icons/start-mascot.png');

        // заменяем содержимое страницы целиком
        document.documentElement.innerHTML = `
            <head><meta charset="utf-8"><title>Подождите...</title></head>
            <body style="margin:0;">
              <div id="fpt-err-wrap">
                <main class="fpt-err-card">
                    <div class="fpt-err-scene" aria-hidden="true">
                        <img class="fpt-err-mascot" src="${mascotUrl}" alt="" draggable="false">
                    </div>
                    <div class="fpt-err-status"><span class="fpt-err-status-dot"></span>${code ? `Ошибка ${code}` : 'Нет соединения'}</div>
                    <h1>Пытаемся восстановить связь</h1>
                    <p>${codeText}.<br>Страница обновится автоматически.</p>
                    <div class="fpt-err-retry">
                        <div class="fpt-err-retry-label"><span>Следующая попытка</span><span class="fpt-err-spinner" aria-hidden="true"></span></div>
                        <div class="fpt-err-track"><div id="fpt-err-bar" style="transition:width ${RELOAD_MS}ms linear;"></div></div>
                    </div>
                    <button id="fpt-err-now" type="button">Обновить сейчас</button>
                </main>
              </div>
              <style>
                #fpt-err-wrap{position:fixed;inset:0;display:flex;overflow:auto;padding:24px;box-sizing:border-box;background:#0f1016;color:#e9e8f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}
                .fpt-err-card{box-sizing:border-box;width:min(100%,440px);margin:auto;padding:28px 36px 32px;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid rgba(154,140,220,.16);border-radius:24px;background:radial-gradient(120% 70% at 50% 0%,rgba(118,99,246,.16),transparent 62%),#191923;box-shadow:0 14px 34px rgba(0,0,0,.22);}
                .fpt-err-scene{position:relative;width:164px;height:164px;display:grid;place-items:center;}
                .fpt-err-mascot{width:160px;height:160px;object-fit:contain;filter:drop-shadow(0 16px 24px rgba(92,100,246,.24));user-select:none;animation:fptErrFloat 6s ease-in-out infinite;}
                .fpt-err-status{display:inline-flex;align-items:center;gap:7px;margin:8px 0 15px;padding:6px 10px;border:1px solid rgba(145,129,255,.2);border-radius:9px;background:rgba(118,99,246,.1);color:#c0b5ff;font-size:12px;font-weight:600;}
                .fpt-err-status-dot{width:6px;height:6px;border-radius:50%;background:#9b89ff;}
                .fpt-err-card h1{margin:0;color:#f0eff8;font-size:21px;line-height:1.25;letter-spacing:-.01em;}
                .fpt-err-card p{margin:10px 0 0;color:#a7a5b7;font-size:14px;line-height:1.55;}
                .fpt-err-retry{box-sizing:border-box;width:100%;margin-top:24px;padding:14px 15px;border:1px solid rgba(154,140,220,.12);border-radius:14px;background:rgba(10,10,18,.25);text-align:left;}
                .fpt-err-retry-label{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;color:#b8b5c8;font-size:12px;font-weight:600;}
                .fpt-err-track{height:4px;overflow:hidden;border-radius:3px;background:rgba(255,255,255,.08);}
                #fpt-err-bar{height:100%;width:0;border-radius:3px;background:#8a78f8;}
                .fpt-err-spinner{width:13px;height:13px;box-sizing:border-box;border-radius:50%;border:2px solid rgba(154,137,255,.22);border-top-color:#a898ff;animation:fptErrSpin .9s linear infinite;}
                #fpt-err-now{width:100%;margin-top:12px;padding:11px 16px;border:1px solid rgba(154,140,220,.18);border-radius:12px;background:rgba(255,255,255,.055);color:#e5e2f3;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background .18s,border-color .18s;}
                #fpt-err-now:hover{background:rgba(118,99,246,.14);border-color:rgba(154,140,255,.35);}
                #fpt-err-now:focus-visible{outline:2px solid #9b89ff;outline-offset:3px;}
                @keyframes fptErrSpin{to{transform:rotate(360deg)}}
                @keyframes fptErrFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
                @media (prefers-reduced-motion:reduce){.fpt-err-mascot,.fpt-err-spinner{animation:none}}
                @media (max-height:600px){.fpt-err-card{padding:20px 28px}.fpt-err-scene{width:110px;height:110px}.fpt-err-mascot{width:110px;height:110px}.fpt-err-status{margin:4px 0 10px}.fpt-err-retry{margin-top:16px}}
                @media (max-width:400px){#fpt-err-wrap{padding:16px}.fpt-err-card{padding-left:22px;padding-right:22px}.fpt-err-card h1{font-size:19px}}
              </style>
            </body>`;

        // запускаем прогресс-бар
        requestAnimationFrame(() => {
            const bar = document.getElementById('fpt-err-bar');
            if (bar) bar.style.width = '100%';
        });

        const reload = () => location.reload();
        const btn = document.getElementById('fpt-err-now');
        if (btn) btn.addEventListener('click', reload);
        setTimeout(reload, RELOAD_MS);
    }

    function run() {
        if (looksLikeErrorPage()) {
            showWaitOverlay(detectCode());
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }
})();
