// content/ui/header_button_styler.js

const BUTTON_STYLE_ID = 'fp-tools-header-button-styles';
const STORAGE_KEY = 'fpToolsHeaderButtonStyles';
let stylerDebounceTimer;

// --- Core Logic ---

async function saveButtonStyles(settings) {
    await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

async function loadAndApplyButtonStyles() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const saved = data[STORAGE_KEY] || {};
    const settings = { size: saved.size ?? 14, opacity: saved.opacity ?? 100 };
    applyButtonStyles(settings);
}

function applyButtonStyles(settings) {
    let styleTag = document.getElementById(BUTTON_STYLE_ID);
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = BUTTON_STYLE_ID;
        document.head.appendChild(styleTag);
    }

    // The button colour is fixed to match the lavender menu accent.
    styleTag.textContent = `
        #fpToolsButton {
            color: #7663f6 !important;
            font-size: ${settings.size}px !important;
            opacity: ${settings.opacity / 100} !important;
        }
        #fpToolsButton::before {
            background: #7663f6 !important;
        }
    `;

    // Update styler UI if it exists
    const styler = document.getElementById('fp-tools-button-styler');
    if (styler) {
        styler.querySelector('#styler-size').value = settings.size;
        styler.querySelector('#styler-size-value').textContent = `${settings.size}px`;
        styler.querySelector('#styler-opacity').value = settings.opacity;
        styler.querySelector('#styler-opacity-value').textContent = `${settings.opacity}%`;
    }
}

function createButtonStyler() {
    if (document.getElementById('fp-tools-button-styler')) return;

    const styler = createElement('div', { id: 'fp-tools-button-styler' });
    styler.innerHTML = `
        <div class="fp-tools-styler-header">
            <h4>Настройка кнопки</h4>
            <button class="close-btn">&times;</button>
        </div>
        <div class="styler-control">
            <label for="styler-size">Размер шрифта: <span id="styler-size-value">14px</span></label>
            <input type="range" id="styler-size" min="12" max="24" step="1">
        </div>
        <div class="styler-control">
            <label for="styler-opacity">Прозрачность: <span id="styler-opacity-value">100%</span></label>
            <input type="range" id="styler-opacity" min="20" max="100" step="5">
        </div>
    `;
    document.body.appendChild(styler);

    styler.querySelector('.close-btn').addEventListener('click', () => {
        styler.style.display = 'none';
    });
    
    document.addEventListener('click', (e) => {
        if (styler.style.display === 'block' && !styler.contains(e.target) && e.target.id !== 'fpToolsButton') {
             styler.style.display = 'none';
        }
    });

    styler.addEventListener('input', (e) => {
        const settings = {
            size: document.getElementById('styler-size').value,
            opacity: document.getElementById('styler-opacity').value,
        };
        applyButtonStyles(settings);
        
        clearTimeout(stylerDebounceTimer);
        stylerDebounceTimer = setTimeout(() => saveButtonStyles(settings), 300);
    });
}

function showButtonStyler(x, y) {
    const styler = document.getElementById('fp-tools-button-styler');
    if (!styler) return;
    
    styler.style.display = 'block';

    const rect = styler.getBoundingClientRect();
    let top = y + 15;
    let left = x - (rect.width / 2);

    if (left < 10) left = 10;
    if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - 10 - rect.width;
    if (top + rect.height > window.innerHeight - 10) top = y - rect.height - 15;
    
    styler.style.top = `${top}px`;
    styler.style.left = `${left}px`;
}

function showHeaderButtonTooltip(buttonElement) {
    let tooltip = document.getElementById('fp-tools-header-button-tooltip');
    if (!tooltip) {
        tooltip = createElement('div', { id: 'fp-tools-header-button-tooltip' });
        // ИСПРАВЛЕНИЕ: Убрана лишняя скобка
        tooltip.textContent = "Нажми ПКМ для настройки кнопки";
        document.body.appendChild(tooltip);
    }
    
    const rect = buttonElement.getBoundingClientRect();
    // ИСПРАВЛЕНИЕ: Вместо `display` используем `visibility`, чтобы размеры элемента были доступны сразу
    tooltip.style.visibility = 'visible';
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
    
    requestAnimationFrame(() => {
        tooltip.style.opacity = '1';
    });
}

function hideHeaderButtonTooltip() {
    const tooltip = document.getElementById('fp-tools-header-button-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        // ИСПРАВЛЕНИЕ: Прячем элемент после завершения анимации
        tooltip.style.visibility = 'hidden';
    }
}

function initializeHeaderButtonStyler() {
    createButtonStyler();
    loadAndApplyButtonStyles();
}

// Applies the saved colour/size/opacity to the header button WITHOUT creating the
// styler panel. Safe to call at page load so the button looks right before the popup
// (which builds the panel) is ever opened.
function applyHeaderButtonStylesEarly() {
    loadAndApplyButtonStyles();
}
