function addTranslateButton() {
    const enTabLink = document.querySelector('.lot-fields-multilingual .nav-tabs li[data-locale="en"] a');
    if (!enTabLink || document.getElementById('fp-tools-translate-btn')) {
        return;
    }

    const translateBtn = createElement('button', {
        type: 'button',
        id: 'fp-tools-translate-btn',
        title: 'Перевести: выбранные поля будут отправлены Google Translate'
    }, {}, 'Перевод');

    enTabLink.parentNode.insertBefore(translateBtn, enTabLink.nextSibling);
    const translationDisclosure = document.createElement('small');
    translationDisclosure.className = 'text-muted';
    translationDisclosure.textContent = 'При переводе выбранные поля передаются Google Translate.';
    enTabLink.parentNode.insertBefore(translationDisclosure, translateBtn.nextSibling);

    translateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!(await window.FPTTranslateConsent?.ensure())) return;

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

addTranslateButton();
