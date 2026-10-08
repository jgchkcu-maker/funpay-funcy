// content/features/custom_sound.js
// Replaces FunPay's new-message sound. The preset catalogue is shared with the "Звук уведомлений" page.

const FUNPAY_DEFAULT_SOUND_URL = 'https://funpay.com/audio/chat_loud.mp3';

window.FPTNotificationSounds = (() => {
    const groups = Object.freeze([
        { id: 'funpay', label: 'FunPay' },
        { id: 'messengers', label: 'Мессенджеры' },
        { id: 'custom', label: 'Своя' }
    ]);
    const presets = Object.freeze([
        { id: 'default', group: 'funpay', label: 'Стандартный', hint: 'Звук FunPay', icon: 'storefront' },
        { id: 'vk', group: 'messengers', label: 'ВКонтакте', hint: 'Сообщение VK', icon: 'forum', file: 'vk.mp3' },
        { id: 'tg', group: 'messengers', label: 'Telegram', hint: 'Сообщение Telegram', icon: 'send', file: 'telegram.mp3' },
        { id: 'iphone', group: 'messengers', label: 'iPhone', hint: 'Уведомление iOS', icon: 'smartphone', file: 'iphone.mp3' },
        { id: 'discord', group: 'messengers', label: 'Discord', hint: 'Сообщение Discord', icon: 'headset_mic', file: 'discord.mp3' },
        { id: 'whatsapp', group: 'messengers', label: 'WhatsApp', hint: 'Сообщение WhatsApp', icon: 'call', file: 'whatsapp.mp3' },
        { id: 'custom', group: 'custom', label: 'Своя мелодия', hint: 'Загруженный отрывок', icon: 'library_music' }
    ].map(Object.freeze));
    const byId = new Map(presets.map(preset => [preset.id, preset]));
    const normalizeId = id => byId.has(id) ? id : 'default';
    const normalizeVolume = value => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 1;
    };
    // URL of a bundled preset; null for "custom" (stored in chrome.storage) and unknown ids.
    function urlFor(id) {
        if (!id || id === 'default') return FUNPAY_DEFAULT_SOUND_URL;
        const preset = byId.get(id);
        return preset && preset.file ? chrome.runtime.getURL(`sounds/${preset.file}`) : null;
    }
    return Object.freeze({ groups, presets, get: id => byId.get(id) || null, normalizeId, normalizeVolume, urlFor });
})();

// Decodes the stored clip locally: fetch() of a data: URL could be refused by the site's connect-src.
function dataUrlToBlob(dataUrl) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl));
    if (!match || !match[2]) throw new Error('Unsupported sound data');
    const binary = atob(match[3]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: match[1] || 'audio/wav' });
}

async function applyNotificationSound() {
    const sounds = window.FPTNotificationSounds;
    const { notificationSound, notificationVolume, fpToolsCustomSoundData } = await chrome.storage.local.get(['notificationSound', 'notificationVolume', 'fpToolsCustomSoundData']);
    const selectedSound = sounds.normalizeId(notificationSound);
    const vol = sounds.normalizeVolume(notificationVolume ?? 1);

    // The player is found by its class: once we change <source src>, a selector on the original
    // relative path would stop matching and later changes would be silently skipped.
    const audioPlayer = document.querySelector("audio.loud");
    if (!audioPlayer) {
        return;
    }
    const audioSource = audioPlayer.querySelector('source');

    // 3.0: volume control
    audioPlayer.volume = vol;

    // FIX 2.8.2 (№6): раньше подменялся только дочерний <source>. Но FunPay часто
    // проигрывает звук, выставляя audioPlayer.src НАПРЯМУЮ или уже забуферив
    // оригинал - тогда наш <source> игнорировался и звук оставался «фпшным».
    // Теперь: (1) вычисляем нужный src, (2) ставим его И на <source>, И на сам
    // audioPlayer, (3) перед каждым воспроизведением возвращаем наш src и громкость.
    const setSrc = (newSrc) => {
        if (!newSrc) return;
        if (audioSource && audioSource.src !== newSrc) audioSource.src = newSrc;
        if (audioPlayer.src !== newSrc) {
            audioPlayer.src = newSrc;
            audioPlayer.load();
        }
    };

    // запоминаем выбранный src на самом элементе, чтобы обработчик play знал что ставить
    let chosenSrc = null;

    if (selectedSound === 'custom') {
        // Своя загруженная мелодия (обрезанный отрезок). Преобразуем data URL в
        // blob: URL - он не попадает под ограничения CSP на data:-медиа.
        if (fpToolsCustomSoundData) {
            try {
                if (!window.__fptCustomSoundBlobUrl || window.__fptCustomSoundBlobSrc !== fpToolsCustomSoundData) {
                    const blob = dataUrlToBlob(fpToolsCustomSoundData);
                    if (window.__fptCustomSoundBlobUrl) { try { URL.revokeObjectURL(window.__fptCustomSoundBlobUrl); } catch (_) {} }
                    window.__fptCustomSoundBlobUrl = URL.createObjectURL(blob);
                    window.__fptCustomSoundBlobSrc = fpToolsCustomSoundData;
                }
                chosenSrc = window.__fptCustomSoundBlobUrl;
                setSrc(chosenSrc);
            } catch (_) {
                // если blob не удался - пробуем напрямую data URL
                chosenSrc = fpToolsCustomSoundData;
                setSrc(chosenSrc);
            }
        } else {
            chosenSrc = FUNPAY_DEFAULT_SOUND_URL;
            setSrc(chosenSrc);
        }
    } else {
        chosenSrc = sounds.urlFor(selectedSound);
        setSrc(chosenSrc);
    }

    // FIX 2.8.2 (№6): FunPay вызывает play() из своего скрипта, а патч метода из
    // изолированного мира расширения его не видит. Событие play общее для обоих миров:
    // если FunPay успел вернуть свой src, перезапускаем воспроизведение с нашим.
    if (!audioPlayer.__fptPlayGuard) {
        audioPlayer.__fptPlayGuard = true;
        audioPlayer.addEventListener('play', () => {
            try {
                const want = audioPlayer.__fptChosenSrc;
                if (typeof audioPlayer.__fptVol === 'number') audioPlayer.volume = audioPlayer.__fptVol;
                if (want && audioPlayer.src !== want) {
                    audioPlayer.src = want;
                    audioPlayer.load();
                    audioPlayer.play().catch(() => {});
                }
            } catch (_) {}
        });
    }
    audioPlayer.__fptChosenSrc = chosenSrc;
    audioPlayer.__fptVol = vol;
}

// One preview at a time: starting another sound or pressing stop cuts the previous one.
let previewAudio = null;
let previewBlobUrl = null;

function stopNotificationPreview() {
    if (previewAudio) {
        previewAudio.pause();
        previewAudio.dispatchEvent(new Event('ended'));
        previewAudio = null;
    }
    if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        previewBlobUrl = null;
    }
}

// Resolves when the sound finishes or is stopped, so the popup can animate the play button meanwhile.
async function previewNotificationSound(soundValue, volume) {
    const sounds = window.FPTNotificationSounds;
    stopNotificationPreview();
    let url;
    if (soundValue === 'custom') {
        const { fpToolsCustomSoundData } = await chrome.storage.local.get('fpToolsCustomSoundData');
        if (!fpToolsCustomSoundData) throw new Error('Своя мелодия ещё не сохранена. Загрузите файл ниже.');
        // A blob: URL is not affected by the site's CSP on data: media.
        previewBlobUrl = URL.createObjectURL(dataUrlToBlob(fpToolsCustomSoundData));
        url = previewBlobUrl;
    } else {
        url = sounds.urlFor(sounds.normalizeId(soundValue));
    }
    const audio = new Audio(url);
    audio.volume = sounds.normalizeVolume(volume ?? 1);
    previewAudio = audio;
    const finished = new Promise(resolve => {
        audio.addEventListener('ended', resolve, { once: true });
        audio.addEventListener('error', resolve, { once: true });
    });
    try {
        await audio.play();
    } catch (error) {
        if (previewAudio === audio) previewAudio = null;
        throw new Error('Браузер не дал воспроизвести звук. Кликните по странице и попробуйте ещё раз.');
    }
    await finished;
    if (previewAudio === audio) stopNotificationPreview();
    return { played: soundValue };
}

function initializeCustomSound() {
    // защита от повторной инициализации (раньше вызывалось только при сборке
    // попапа настроек — из-за чего звук не подменялся, пока пользователь не открыл
    // настройки на этой вкладке; теперь модуль ещё и сам стартует ниже)
    if (window.__fptSoundInited) { applyNotificationSound(); return; }
    window.__fptSoundInited = true;

    // Первоначальное применение звука
    applyNotificationSound();

    // Наблюдатель на случай, если FunPay динамически пересоздаст плеер
    const observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (mutation.addedNodes) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === 1 && (node.matches("audio.loud") || node.querySelector("audio.loud"))) {
                        applyNotificationSound();
                        return;
                    }
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// FIX 3.0: звук НЕ должен зависеть от того, открыл ли пользователь попап настроек.
// Раньше initializeCustomSound() вызывался только при ленивой сборке попапа, и
// если вкладку с настройками не открывали — кастомный звук не подменялся.
// Теперь модуль самоинициализируется на КАЖДОЙ странице funpay сразу при загрузке.
(function autoInitCustomSound() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;
    const boot = () => { try { initializeCustomSound(); } catch (_) {} };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();

// 3.0: re-apply sound/volume immediately when changed in the popup (no reload).
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.notificationSound || changes.notificationVolume || changes.fpToolsCustomSoundData) {
            if (typeof applyNotificationSound === 'function') applyNotificationSound();
        }
    });
}
if (typeof window !== 'undefined' && window.fptPopupActions) {
    window.fptPopupActions.register('sounds', 'previewNotificationBtn', p => previewNotificationSound(p.sound, p.volume));
    window.fptPopupActions.register('sounds', 'stopNotificationPreview', () => stopNotificationPreview());
}
