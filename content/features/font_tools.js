// content/features/font_tools.js

function initializeFontTools() {
    // Убедимся, что мы на странице редактирования или создания лота
    const header = document.querySelector('h1.page-header');
    if (!header || !(header.textContent.includes('Редактирование предложения') || header.textContent.includes('Добавление предложения'))) {
        return;
    }

    // Проверяем, не были ли элементы управления добавлены ранее
    if (document.querySelector('.fp-tools-font-controls')) {
        return;
    }

    // Символы, которые чаще всего ставят в названия и описания лотов 300 продавцов FunPay
    // с наибольшим числом отзывов (выборка 2026-10): порядок от самых частых к редким.
    const symbols = [
        '✅', '⚡', '🔥', '⭐', '【', '】', '—', '💎', '❗', '🎁', '🎮', '🔴',
        '🌍', '🔑', '•', '🚀', '⚠️', '❤️', '✨', '💥', '🔵', '✔️', '💳', '📌',
        '🟡', '⚔️', '💰', '🟥', '☑️', '🔹', '🟦', '🟢', '🌟', '❓', '🌎', '💙',
        '🟨', '🟩', '►', '💬', '🌏', '💲', '💖', '🤖', '💸', '📦', '⬛️', '🔐',
        '🌐', '💛', '🛡️', '░', '⚫', '█', '▒', '▓', '🖤', '💠', '💚', '🟣',
        '◄', '❌', '◆', '│', '🛒', '▪️', '🔮', '💜', '🎯', '🟪', '🟠', '🆔',
        '🧊', '⛔', '🔶', '🌌', '⚪', '🔒', '💣', '💯', '🏆', '🍀', '★', '🩸',
        '⏱️', '🟧', '🔷', '👉', '🔰', '🧡', '🍁', '⌛️', '⚜️', '⚙️', '👋', '🎀'
    ];

    let activeTextarea = null;

    const controlBlock = document.querySelector(".lot-fields-multilingual");
    if (!controlBlock) return;

    const controlsHtml = `
        <div class="form-group fp-tools-font-controls">
            <button type="button" class="btn btn-default" id="fpToolsKeyboardToggleBtn" aria-expanded="false" aria-controls="fpToolsSymbolsPanel">
                <i class="fa fa-keyboard-o" aria-hidden="true"></i> Клавиатура
                <i class="fa fa-chevron-down fp-tools-kbd-chevron" aria-hidden="true"></i>
            </button>
        </div>
        <div class="fp-tools-symbols-panel" id="fpToolsSymbolsPanel" aria-hidden="true">
            <div class="fp-tools-symbols-clip">
                <div class="fp-tools-symbols-grid">${symbols.map(symbol => `<span class="fp-tools-symbol-char">${symbol}</span>`).join('')}</div>
            </div>
        </div>
    `;
    
    controlBlock.insertAdjacentHTML('beforeend', controlsHtml);

    // Отслеживаем активное поле ввода (ЛЮБОЕ: textarea или input)
    document.querySelectorAll('textarea, input[type="text"]').forEach(element => {
        element.addEventListener('focus', function() {
            activeTextarea = this;
        });
    });

    // Обработчик для кнопки "Клавиатура"
    // Панель выдвигается из-под кнопки (анимация в CSS через grid-template-rows)
    document.getElementById("fpToolsKeyboardToggleBtn").addEventListener("click", function() {
        const panel = document.getElementById("fpToolsSymbolsPanel");
        const open = !panel.classList.contains('is-open');
        panel.classList.toggle('is-open', open);
        panel.setAttribute('aria-hidden', String(!open));
        this.classList.toggle('is-open', open);
        this.setAttribute('aria-expanded', String(open));
    });

    // Обработчик клика по символу
    document.addEventListener("click", function(event) {
        if (!event.target.classList.contains('fp-tools-symbol-char')) return;
        
        if (activeTextarea) {
            const currentVal = activeTextarea.value;
            const cursorPos = activeTextarea.selectionStart;
            const symbol = event.target.textContent;
            
            const newVal = currentVal.substring(0, cursorPos) + symbol + currentVal.substring(cursorPos);
            activeTextarea.value = newVal;
            
            const newCursorPos = cursorPos + symbol.length;
            activeTextarea.selectionStart = activeTextarea.selectionEnd = newCursorPos;
            activeTextarea.focus();
        } else {
            showNotification("Сначала кликните на любое поле для ввода текста.", true);
        }
    });
}