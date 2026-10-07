let particles = [];
let isHoveringAIGenBtn = false;
let animationFrameId = null;

function createAIGeneratorUI() {
    const header = Array.from(document.querySelectorAll('h1.page-header, h1.page-header.page-header-no-hr'))
        .find(h1 => h1.textContent.includes('Добавление предложения') || h1.textContent.includes('Редактирование предложения'));

    if (!header) return;
    if (document.getElementById('fp-tools-ai-gen-btn')) return;

    let actionsContainer = document.querySelector('.fp-tools-lot-edit-actions-container');
    if (!actionsContainer) {
        actionsContainer = createElement('div', { class: 'fp-tools-lot-edit-actions-container' });
        header.parentNode.insertBefore(actionsContainer, header.nextSibling);
    }

    // FIX 2.9.0: кнопка ИИ-генерации теперь - простой клон кнопки "Импорт"
    // (btn btn-default), без частиц/canvas, чтобы единообразно смотреться в ряду
    // действий лота.
    const button = createElement('button', { class: 'btn btn-default fp-tools-ai-gen-btn', id: 'fp-tools-ai-gen-btn' }, {}, 'ИИ-генерация');

    actionsContainer.appendChild(button);

    const modal = createModal();
    document.body.appendChild(modal);

    setupAIGeneratorEventListeners(button, null, null, modal);
}

function createModal() {
    const win = fptWindow.create({
        id: 'fp-tools-ai-gen-modal',
        title: 'ИИ-генератор лотов',
        subtitle: 'ИИ изучит ваши лоты и напишет новый в похожем стиле.',
        icon: 'auto_awesome',
        size: 'md'
    });
    win.body.innerHTML = `
        <div class="fpt-win-field-group">
            <label class="fpt-win-label" for="ai-prompt-title">Что продаём?</label>
            <input type="text" class="fpt-win-input" id="ai-prompt-title" placeholder="Например: Пак аватарок на тему аниме">
            <p class="fpt-win-hint">Краткая идея для заголовка.</p>
        </div>
        <div class="fpt-win-field-group">
            <label class="fpt-win-label" for="ai-prompt-desc">О чём написать в описании?</label>
            <textarea class="fpt-win-input" id="ai-prompt-desc" rows="4" placeholder="Например: 350 тысяч картинок, разделено по категориям, автовыдача, уникальные"></textarea>
            <p class="fpt-win-hint">Ключевые особенности товара.</p>
        </div>
        <div class="fpt-win-checks fpt-win-checks--panel fpt-win-checks--column" style="margin-top:16px;">
            ${fptWindow.checkboxHtml('Сгенерировать сообщение для покупателя', { id: 'ai-gen-buyer-msg' })}
            ${fptWindow.checkboxHtml('Автоматически перевести на английский', { id: 'ai-gen-translate' })}
        </div>
    `;
    win.foot.innerHTML = `
        <div class="fpt-win-actions">
            <button type="button" class="fpt-win-btn fpt-win-btn--quiet" data-ai-gen-cancel>Отмена</button>
            <button type="button" id="ai-gen-submit-btn" class="fpt-win-btn fpt-win-btn--primary">
                <span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span>Сгенерировать
            </button>
        </div>`;
    return win.scrim;
}

function setupAIGeneratorEventListeners(button, overlay, canvas, modal) {
    // FIX 2.9.0: кнопка ИИ-генерации - простой клон "Импорт", без частиц/canvas.
    // Здесь только открытие/закрытие окна и отправка.
    button.addEventListener('click', (event) => {
        event.preventDefault();
        fptWindow.open(modal, { focus: modal.querySelector('#ai-prompt-title') });
    });
    modal.querySelector('[data-ai-gen-cancel]').addEventListener('click', () => fptWindow.close(modal));
    modal.querySelector('#ai-gen-submit-btn').addEventListener('click', handleAIGeneration);
}


async function handleAIGeneration() {
    const submitBtn = document.getElementById('ai-gen-submit-btn');
    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;

    try {
        const promptTitle = document.getElementById('ai-prompt-title').value;
        const promptDesc = document.getElementById('ai-prompt-desc').value;
        const genBuyerMsg = document.getElementById('ai-gen-buyer-msg').checked;
        const doTranslate = document.getElementById('ai-gen-translate').checked;

        if (!promptTitle || !promptDesc) {
            showNotification('Заполните оба поля для генерации.', true);
            return;
        }

        const profileLinkEl = document.querySelector('.user-link-dropdown[href*="/users/"]');
        if (!profileLinkEl) {
            showNotification('Не удалось найти ссылку на ваш профиль для анализа стиля.', true);
            return;
        }

        const profileUrl = profileLinkEl.href;
        const response = await fetch(profileUrl);
        if (!response.ok) {
            showNotification(`Ошибка загрузки профиля: ${response.status}`, true);
            return;
        }
        const profileHtml = await response.text();
        const parser = new DOMParser();
        const profileDoc = parser.parseFromString(profileHtml, 'text/html');
        
        const lotTitles = Array.from(profileDoc.querySelectorAll('.tc-desc-text')).map(el => el.textContent.trim()).slice(0, 20);
        const styleExamples = lotTitles.length > 0 ? lotTitles.join('\n') : "Стиль не найден, используй креативный маркетинговый стиль FunPay с эмодзи.";

        const gameCategory = document.querySelector('.back-link .inside')?.textContent.trim() || 'неизвестная категория';

        const aiResult = await chrome.runtime.sendMessage({
            action: 'generateAILot',
            data: {
                promptTitle,
                promptDesc,
                genBuyerMsg,
                styleExamples,
                gameCategory
            }
        });

        if (!aiResult || !aiResult.success) {
            throw new Error(aiResult.error || 'Неизвестная ошибка AI.');
        }

        const ruTitle = aiResult.data.title;
        const ruDesc = aiResult.data.description;
        const ruBuyerMsg = aiResult.data.buyerMessage || '';

        document.querySelector('input[name="fields[summary][ru]"]').value = ruTitle;
        document.querySelector('textarea[name="fields[desc][ru]"]').value = ruDesc;
        if(genBuyerMsg) document.querySelector('textarea[name="fields[payment_msg][ru]"]').value = ruBuyerMsg;

        if (doTranslate) {
            showNotification('Генерация завершена. Начинаю перевод...', false);
            const translationResult = await chrome.runtime.sendMessage({
                action: 'translateLotText',
                data: { title: ruTitle, description: ruDesc, buyerMessage: ruBuyerMsg }
            });
            if (translationResult && translationResult.success) {
                document.querySelector('input[name="fields[summary][en]"]').value = translationResult.data.title;
                document.querySelector('textarea[name="fields[desc][en]"]').value = translationResult.data.description;
                 if(genBuyerMsg) document.querySelector('textarea[name="fields[payment_msg][en]"]').value = translationResult.data.buyerMessage;
            } else {
                 showNotification('Ошибка перевода. Английские поля остались пустыми.', true);
            }
        }
        
        document.querySelectorAll('.lot-field-input').forEach(el => el.dispatchEvent(new Event('input', { bubbles: true })));

        fptWindow.close(document.getElementById('fp-tools-ai-gen-modal'));
        showNotification('Лот успешно сгенерирован!', false);

    } catch (error) {
        showNotification(`Ошибка генерации: ${error.message}`, true);
        console.error("AI Lot Generation Error:", error);
    } finally {
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
    }
}

function addTranslateButton() {
    const enTabLink = document.querySelector('.lot-fields-multilingual .nav-tabs li[data-locale="en"] a');
    if (!enTabLink || document.getElementById('fp-tools-translate-btn')) {
        return;
    }

    const translateBtn = createElement('button', {
        type: 'button',
        id: 'fp-tools-translate-btn',
        title: 'Перевести'
    }, {}, 'Перевод');

    enTabLink.parentNode.insertBefore(translateBtn, enTabLink.nextSibling);

    translateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        translateBtn.textContent = 'Перевожу...';
        translateBtn.disabled = true;

        try {
            // FIX 2.8.2 (№5): раньше тут был прямой .value у querySelector без проверки
            // на null. Если разметка формы лота отличается (поле отсутствует, другая
            // локаль, чипсы вместо лотов) - querySelector возвращал null и падала
            // ошибка "Cannot read properties of null (reading 'value')". Берём значения
            // через безопасный геттер и понятно сообщаем, если поля не найдены.
            const val = (sel) => { const el = document.querySelector(sel); return el ? el.value : null; };
            const ruTitle = val('input[name="fields[summary][ru]"]');
            const ruDesc  = val('textarea[name="fields[desc][ru]"]');
            const ruMsg   = val('textarea[name="fields[payment_msg][ru]"]');

            if (ruTitle === null && ruDesc === null && ruMsg === null) {
                showNotification('Не найдены русские поля лота на странице. Откройте вкладку «Русский» и попробуйте снова.', true);
                return;
            }

            const data = {
                title: ruTitle || '',
                description: ruDesc || '',
                buyerMessage: ruMsg || ''
            };

            if (!data.title && !data.description) {
                showNotification('Нечего переводить. Заполните русские поля.', true);
                return;
            }

            const result = await chrome.runtime.sendMessage({ action: 'translateLotText', data: data });

            if (result && result.success) {
                const setVal = (sel, v) => { const el = document.querySelector(sel); if (el) el.value = v || ''; };
                setVal('input[name="fields[summary][en]"]',     result.data.title);
                setVal('textarea[name="fields[desc][en]"]',     result.data.description);
                setVal('textarea[name="fields[payment_msg][en]"]', result.data.buyerMessage);
                showNotification('Текст успешно переведен!', false);
            } else {
                throw new Error(result.error || 'Неизвестная ошибка перевода.');
            }

        } catch (error) {
            showNotification(`Ошибка перевода: ${error.message}`, true);
        } finally {
            translateBtn.textContent = 'Перевод';
            translateBtn.disabled = false;
        }
    });
}

createAIGeneratorUI();
addTranslateButton();
