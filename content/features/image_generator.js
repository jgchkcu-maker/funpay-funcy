// content/features/image_generator.js

let imageGeneratorInstance = null;

class ImageGenerator {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.settings = this.getDefaults();
        this.activeInput = null;
        this.init();
    }

    getDefaults() {
        return {
            bgColor1: '#2c3e50',
            bgColor2: '#fd746c',
            text1: 'ЗАГОЛОВОК',
            text1Color: '#ffffff',
            text1Size: 48,
            text2: 'Подзаголовок',
            text2Color: '#eeeeee',
            text2Size: 24,
            text3: 'Дополнительный текст',
            text3Color: '#dddddd',
            text3Size: 20,
            icon: 'gamepad',
            iconColor: '#ffffff',
            iconSize: 100
        };
    }

    init() {
        this.createModal();
        this.canvas = document.getElementById('fpToolsImageCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.addEventListeners();
        this.applyTheme({
            bgColor1: '#2c3e50',
            bgColor2: '#fd746c',
            text1Color: '#ffffff',
            iconColor: '#ffffff'
        });
        this.draw();
    }

    createModal() {
        if (document.getElementById('fpToolsImageGeneratorModal')) return;

        const win = fptWindow.create({
            id: 'fpToolsImageGeneratorModal',
            dialogId: 'fpToolsImageGeneratorDialog',
            closeId: 'fpToolsImageGeneratorClose',
            title: 'Генератор изображений',
            subtitle: 'Соберите картинку для лота и сохраните её на компьютер.',
            icon: 'imagesmode',
            size: 'lg'
        });
        const line = (id, placeholder, colorId, sizeId, min, max, value) => `
            <div class="fp-tools-ig-line">
                <input type="text" id="${id}" class="fpt-win-input fp-tools-ig-input" placeholder="${placeholder}" aria-label="${placeholder}">
                <div class="fp-tools-ig-inline-controls">
                    <input type="color" id="${colorId}" class="fpt-win-color" aria-label="Цвет: ${placeholder}">
                    <span class="material-symbols-rounded fpt-win-faint" aria-hidden="true">text_increase</span>
                    <input type="range" id="${sizeId}" class="fpt-win-range" min="${min}" max="${max}" value="${value}" aria-label="Размер: ${placeholder}">
                </div>
            </div>`;
        win.body.innerHTML = `
            <div class="fp-tools-ig-body">
                <div class="fp-tools-ig-side">
                    <div class="fp-tools-ig-preview">
                        <canvas id="fpToolsImageCanvas" width="320" height="320"></canvas>
                    </div>
                    <section class="fpt-win-card fp-tools-ig-ai-generator">
                        <div class="fpt-win-card-head">
                            <span class="fpt-win-card-icon"><span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span></span>
                            <h3 class="fpt-win-card-title">Создать с помощью ИИ</h3>
                        </div>
                        <textarea id="igAiPrompt" class="fpt-win-input" rows="3" placeholder="Пример: огненный значок для клана, текст 'FIRE SQUAD'" aria-label="Описание картинки для ИИ"></textarea>
                        <button type="button" id="igAiGenerateBtn" class="fpt-win-btn fpt-win-btn--block" style="margin-top:10px;">
                            <span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span>Сгенерировать
                        </button>
                    </section>
                </div>
                <div class="fp-tools-ig-controls">
                    <div class="fpt-win-seg fpt-win-seg--fill fp-tools-ig-tabs" role="tablist" aria-label="Настройки картинки">
                        <button type="button" class="fpt-win-seg-btn fp-tools-ig-tab is-active" data-tab="themes" aria-selected="true">Темы</button>
                        <button type="button" class="fpt-win-seg-btn fp-tools-ig-tab" data-tab="text" aria-selected="false">Текст</button>
                        <button type="button" class="fpt-win-seg-btn fp-tools-ig-tab" data-tab="background" aria-selected="false">Фон</button>
                        <button type="button" class="fpt-win-seg-btn fp-tools-ig-tab" data-tab="icon" aria-selected="false">Иконка</button>
                        <button type="button" class="fpt-win-seg-btn fp-tools-ig-tab" data-tab="symbols" aria-selected="false">Символы</button>
                    </div>
                    <div class="fp-tools-ig-panels">
                        <div class="fp-tools-ig-panel fpt-win-pane" data-panel="themes">
                            <p class="fpt-win-hint" style="margin:0 0 12px;">Готовые сочетания цветов фона, текста и иконки.</p>
                            <div class="fp-tools-ig-theme-grid">
                                    <button type="button" class="fp-tools-ig-theme-item" aria-label="Тема 1" data-theme='{"bgColor1":"#2c3e50","bgColor2":"#fd746c","text1Color":"#ffffff","iconColor":"#ffffff"}' style="background: linear-gradient(45deg, #2c3e50, #fd746c);"></button>
                                    <button type="button" class="fp-tools-ig-theme-item" aria-label="Тема 2" data-theme='{"bgColor1":"#00c6ff","bgColor2":"#0072ff","text1Color":"#ffffff","iconColor":"#ffffff"}' style="background: linear-gradient(45deg, #00c6ff, #0072ff);"></button>
                                    <button type="button" class="fp-tools-ig-theme-item" aria-label="Тема 3" data-theme='{"bgColor1":"#ff0084","bgColor2":"#33001b","text1Color":"#ffffff","iconColor":"#ffffff"}' style="background: linear-gradient(45deg, #ff0084, #33001b);"></button>
                                    <button type="button" class="fp-tools-ig-theme-item" aria-label="Тема 4" data-theme='{"bgColor1":"#101010","bgColor2":"#101010","text1Color":"#00ff00","iconColor":"#00ff00"}' style="background: #101010;"></button>
                                    <button type="button" class="fp-tools-ig-theme-item" aria-label="Тема 5" data-theme='{"bgColor1":"#fdfc47","bgColor2":"#24fe41","text1Color":"#000000","iconColor":"#000000"}' style="background: linear-gradient(45deg, #fdfc47, #24fe41);"></button>
                                    <button type="button" class="fp-tools-ig-theme-item" aria-label="Тема 6" data-theme='{"bgColor1":"#ffffff","bgColor2":"#e0e0e0","text1Color":"#333333","iconColor":"#333333"}' style="background: #ffffff;"></button>
                            </div>
                        </div>
                        <div class="fp-tools-ig-panel fpt-win-pane" data-panel="text" hidden>
                            ${line('igText1', 'Заголовок', 'igText1Color', 'igText1Size', 16, 100, 48)}
                            ${line('igText2', 'Подзаголовок', 'igText2Color', 'igText2Size', 12, 64, 24)}
                            ${line('igText3', 'Доп. текст', 'igText3Color', 'igText3Size', 10, 48, 20)}
                        </div>
                        <div class="fp-tools-ig-panel fpt-win-pane" data-panel="background" hidden>
                            <div class="fp-tools-ig-colors">
                                <label class="fp-tools-ig-color-field">
                                    <input type="color" id="igBgColor1" class="fpt-win-color">
                                    <span><span class="fpt-win-label" style="margin:0;">Цвет 1</span><span class="fpt-win-hint" style="margin:0;">Начало градиента</span></span>
                                </label>
                                <label class="fp-tools-ig-color-field">
                                    <input type="color" id="igBgColor2" class="fpt-win-color">
                                    <span><span class="fpt-win-label" style="margin:0;">Цвет 2</span><span class="fpt-win-hint" style="margin:0;">Конец градиента</span></span>
                                </label>
                            </div>
                        </div>
                        <div class="fp-tools-ig-panel fpt-win-pane" data-panel="icon" hidden>
                            ${line('igIcon', 'Иконка (напр. gamepad)', 'igIconColor', 'igIconSize', 32, 200, 100)}
                            <p class="fpt-win-hint">Названия из <a href="https://fonts.google.com/icons" target="_blank" rel="noopener noreferrer">Google Material Icons</a> - в нижнем регистре, пробелы заменяются на «_». Оставьте поле пустым, чтобы убрать иконку.</p>
                        </div>
                        <div class="fp-tools-ig-panel fpt-win-pane fp-tools-ig-symbols-panel" data-panel="symbols" hidden>
                            <p class="fpt-win-hint" style="margin:0 0 12px;">Поставьте курсор в поле на вкладке «Текст» или «Иконка» и нажмите символ - он вставится туда.</p>
                            <div class="fp-tools-ig-symbols"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        win.foot.innerHTML = `
            <div class="fpt-win-actions">
                <button type="button" class="fpt-win-btn fpt-win-btn--quiet" data-ig-close>Закрыть</button>
                <button type="button" id="fpToolsImageGeneratorSave" class="fpt-win-btn fpt-win-btn--primary">
                    <span class="material-symbols-rounded" aria-hidden="true">download</span>Сохранить
                </button>
            </div>`;
        document.body.appendChild(win.scrim);
    }

    show() { fptWindow.open(document.getElementById('fpToolsImageGeneratorModal')); }
    hide() { fptWindow.close(document.getElementById('fpToolsImageGeneratorModal')); }
    
    updateInputs() {
        document.getElementById('igText1').value = this.settings.text1;
        document.getElementById('igText1Color').value = this.settings.text1Color;
        document.getElementById('igText1Size').value = this.settings.text1Size;
        document.getElementById('igText2').value = this.settings.text2;
        document.getElementById('igText2Color').value = this.settings.text2Color;
        document.getElementById('igText2Size').value = this.settings.text2Size;
        document.getElementById('igText3').value = this.settings.text3;
        document.getElementById('igText3Color').value = this.settings.text3Color;
        document.getElementById('igText3Size').value = this.settings.text3Size;
        document.getElementById('igBgColor1').value = this.settings.bgColor1;
        document.getElementById('igBgColor2').value = this.settings.bgColor2;
        document.getElementById('igIcon').value = this.settings.icon;
        document.getElementById('igIconColor').value = this.settings.iconColor;
        document.getElementById('igIconSize').value = this.settings.iconSize;
    }

    applyTheme(themeData) {
        this.settings = { ...this.settings, ...themeData };
        this.updateInputs();
        this.draw();
    }

    addEventListeners() {
        const modal = document.getElementById('fpToolsImageGeneratorModal');
        modal.querySelector('[data-ig-close]').addEventListener('click', () => this.hide());
        modal.querySelector('#fpToolsImageGeneratorSave').addEventListener('click', () => this.saveToComputer());

        const SYMBOLS = [ '★', '☆', '✪', '✯', '✡', '✩', '✧', '✵', '✶', '✷', '✸', '✹', '✔', '✓', '☑', '✅', '✖', '❌', '✘', '❎', '❤', '♡', '♥', '✨', '⚡', '❄', '🔥', '☘', '⚜', '⚫', '⚪', '◼', '◻', '●', '○', '➥', '➡', '➢', '➤', '▶', '◀', '▲', '▼', '⚔', '⚖', '⚕', '⚓', '⚙', '⚠', '⛔', '☢', '☣', '⬆', '↗' ];
        const tabs = modal.querySelectorAll('.fp-tools-ig-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                tabs.forEach(t => {
                    const on = t === tab;
                    t.classList.toggle('is-active', on);
                    t.setAttribute('aria-selected', on ? 'true' : 'false');
                });
                modal.querySelectorAll('.fp-tools-ig-panel').forEach(panel => { panel.hidden = panel.dataset.panel !== tabName; });
                const symbolsPanel = modal.querySelector('.fp-tools-ig-symbols');
                if (tabName === 'symbols' && !symbolsPanel.childElementCount) {
                    symbolsPanel.innerHTML = SYMBOLS.map(symbol => `<button type="button" class="fp-tools-ig-symbol-char">${symbol}</button>`).join('');
                }
            });
        });

        modal.querySelectorAll('.fp-tools-ig-theme-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.applyTheme(JSON.parse(e.currentTarget.dataset.theme));
            });
        });

        const inputs = ['igText1', 'igText2', 'igText3', 'igIcon', 'igBgColor1', 'igBgColor2', 'igText1Color', 'igText2Color', 'igText3Color', 'igIconColor', 'igText1Size', 'igText2Size', 'igText3Size', 'igIconSize'];
        inputs.forEach(id => {
            const el = modal.querySelector(`#${id}`);
            el.addEventListener('input', (e) => {
                const keyMap = {
                    'igText1': 'text1', 'igText2': 'text2', 'igText3': 'text3', 'igIcon': 'icon',
                    'igBgColor1': 'bgColor1', 'igBgColor2': 'bgColor2',
                    'igText1Color': 'text1Color', 'igText2Color': 'text2Color', 'igText3Color': 'text3Color',
                    'igIconColor': 'iconColor', 'igText1Size': 'text1Size', 'igText2Size': 'text2Size',
                    'igText3Size': 'text3Size', 'igIconSize': 'iconSize'
                };
                this.settings[keyMap[id]] = e.target.value;
                this.draw();
            });
            if (el.type === 'text') el.addEventListener('focus', () => { this.activeInput = el; });
        });

        modal.querySelector('.fp-tools-ig-panels').addEventListener("click", (event) => {
            if (!event.target.classList.contains('fp-tools-ig-symbol-char')) return;
            if (this.activeInput) {
                const start = this.activeInput.selectionStart;
                const end = this.activeInput.selectionEnd;
                const text = this.activeInput.value;
                const symbol = event.target.textContent;
                this.activeInput.value = text.substring(0, start) + symbol + text.substring(end);
                this.activeInput.selectionStart = this.activeInput.selectionEnd = start + symbol.length;
                this.activeInput.focus();
                this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        
        modal.querySelector('#igAiGenerateBtn').addEventListener('click', async () => {
            const btn = modal.querySelector('#igAiGenerateBtn');
            const promptInput = modal.querySelector('#igAiPrompt');
            const prompt = promptInput.value.trim();

            if (!prompt) {
                showNotification('Введите описание для ИИ', true);
                return;
            }

            btn.classList.add('is-loading');
            btn.disabled = true;

            try {
                const response = await chrome.runtime.sendMessage({ action: "getAIImageSettings", prompt: prompt });
                if (response && response.success) {
                    this.applyTheme(response.data);
                    showNotification('Изображение сгенерировано ИИ!');
                } else {
                    throw new Error(response.error || 'Неизвестная ошибка ИИ.');
                }
            } catch (error) {
                showNotification(`Ошибка ИИ: ${error.message}`, true);
            } finally {
                btn.classList.remove('is-loading');
                btn.disabled = false;
            }
        });
    }

    draw() {
        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);

        const gradient = this.ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, this.settings.bgColor1);
        gradient.addColorStop(1, this.settings.bgColor2);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, width, height);

        const hasIcon = this.settings.icon && this.settings.icon.trim() !== '';
        
        let textYOffset = hasIcon ? 40 : 0;
        let iconYOffset = hasIcon ? -60 : 0;
        let text2YOffset = hasIcon ? 90 : 60;
        let text3YOffset = height - 30;

        if (hasIcon) {
            this.ctx.font = `normal ${this.settings.iconSize}px 'Material Icons'`;
            this.ctx.fillStyle = this.settings.iconColor;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(this.settings.icon, width / 2, height / 2 + iconYOffset);
        }
        
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        
        this.ctx.font = `bold ${this.settings.text1Size}px 'Graphik Bold'`;
        this.ctx.fillStyle = this.settings.text1Color;
        this.drawWrappedText(this.settings.text1, width / 2, height / 2 + textYOffset, width - 40, this.settings.text1Size * 1.1);

        this.ctx.font = `normal ${this.settings.text2Size}px 'Graphik Semibold'`;
        this.ctx.fillStyle = this.settings.text2Color;
        this.drawWrappedText(this.settings.text2, width / 2, height / 2 + text2YOffset, width - 60, this.settings.text2Size * 1.2);
        
        this.ctx.font = `normal ${this.settings.text3Size}px 'Segoe UI'`;
        this.ctx.fillStyle = this.settings.text3Color;
        this.ctx.fillText(this.settings.text3, width / 2, text3YOffset);

        this.ctx.shadowColor = 'transparent';
    }

    drawWrappedText(text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let testY = y;
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            if (this.ctx.measureText(testLine).width > maxWidth && n > 0) {
                this.ctx.fillText(line, x, testY);
                line = words[n] + ' ';
                testY += lineHeight;
            } else {
                line = testLine;
            }
        }
        this.ctx.fillText(line, x, testY);
    }
    
    saveToComputer() {
        this.canvas.toBlob((blob) => {
            const link = document.createElement('a');
            link.download = `funpay-image-${Date.now()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
            this.hide();
            showNotification('Изображение сохранено на ваш компьютер!');
        }, 'image/png');
    }
}

function initializeImageGenerator() {
    const offerEditor = document.querySelector('.form-offer-editor');
    if (!offerEditor) return;
    
    const imageField = offerEditor.querySelector('.lot-field[data-id="images"]');
    if (!imageField) return;

    if (document.getElementById('fpToolsGenerateImageBtn')) return;

    if (!document.getElementById('google-material-icons')) {
        const link = createElement('link', {
            id: 'google-material-icons',
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/icon?family=Material+Icons'
        });
        document.head.appendChild(link);
    }
    
    const btnContainer = createElement('div', { class: 'generate-btn-container' });
    const generateBtn = createElement('button', {
        id: 'fpToolsGenerateImageBtn',
        class: 'btn btn-default',
        type: 'button'
    }, {}, 'Сгенерировать');
    
    btnContainer.appendChild(generateBtn);
    imageField.insertBefore(btnContainer, imageField.querySelector('.attachments-box'));

    generateBtn.addEventListener('click', () => {
        if (!imageGeneratorInstance) {
            imageGeneratorInstance = new ImageGenerator();
        }
        imageGeneratorInstance.show();
    });
}