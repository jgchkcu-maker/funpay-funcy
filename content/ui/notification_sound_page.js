// Notification sound screen: preset picker, volume and a custom melody trimmed to a short clip.
// The preset catalogue lives in custom_sound.js (FPTNotificationSounds); playback and trimming run through fptPopupActions.
(function (root) {
    'use strict';

    const PAGE_ID = 'sounds';
    const KEYS = Object.freeze({ sound: 'notificationSound', volume: 'notificationVolume', meta: 'fpToolsCustomSoundMeta' });
    const SAVE_DELAY_MS = 250;
    const CLIP = Object.freeze({ min: 1, max: 5 });
    const ACCEPT = 'audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus';

    function node(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined && text !== null) element.textContent = String(text);
        return element;
    }

    function icon(name) {
        const element = node('span', 'material-symbols-rounded', name);
        element.setAttribute('aria-hidden', 'true');
        return element;
    }

    function setIcon(element, name) {
        if (element.textContent !== name) element.textContent = name;
    }

    function normalizeVolume(value) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.round(Math.min(1, Math.max(0, number)) * 100) : 100;
    }

    function normalizeMeta(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const length = Number(raw.length);
        if (!Number.isFinite(length) || length <= 0) return null;
        return { length: Math.min(CLIP.max, length), name: typeof raw.name === 'string' ? raw.name : '' };
    }

    function formatTime(seconds) {
        const safe = Math.max(0, Number(seconds) || 0);
        const minutes = Math.floor(safe / 60);
        const rest = safe - minutes * 60;
        return `${minutes}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`;
    }

    function formatSeconds(seconds) {
        return `${(Math.round((Number(seconds) || 0) * 10) / 10).toFixed(1).replace('.', ',')} сек`;
    }

    function createButton(className, iconName, label) {
        const button = node('button', className);
        button.type = 'button';
        if (iconName) button.appendChild(icon(iconName));
        if (label) button.appendChild(node('span', 'fpt-fx-button-label', label));
        return button;
    }

    // Play/stop button: both labels share one grid cell, so the button keeps the wider label's
    // width and does not jump while a sound plays.
    function createPlayToggle(label) {
        const button = node('button', 'fpt-fx-button fpt-ns-toggle');
        button.type = 'button';
        button.dataset.playing = 'false';
        const swap = node('span', 'fpt-ns-swap');
        swap.append(node('span', 'fpt-ns-swap-idle', label), node('span', 'fpt-ns-swap-busy', 'Стоп'));
        button.append(icon('play_arrow'), swap);
        return button;
    }

    function setPlayToggle(button, active) {
        button.dataset.playing = active ? 'true' : 'false';
        setIcon(button.querySelector('.material-symbols-rounded'), active ? 'stop' : 'play_arrow');
    }

    function setButtonLabel(button, iconName, label) {
        setIcon(button.querySelector('.material-symbols-rounded'), iconName);
        const text = button.querySelector('.fpt-fx-button-label');
        if (text) text.textContent = label;
    }

    // A div head on purpose: the site theme styles bare `header` elements with a dark background.
    function createCard({ iconName, title, description }) {
        const card = node('section', 'fpt-fx-card fpt-ns-card');
        const head = node('div', 'fpt-fx-card-head');
        const iconWrap = node('span', 'fpt-fx-card-icon');
        const headIcon = icon(iconName);
        iconWrap.appendChild(headIcon);
        const copy = node('div', 'fpt-fx-card-copy');
        const titleRow = node('div', 'fpt-fx-card-title-row');
        const pill = node('span', 'fpt-fx-pill');
        titleRow.append(node('h2', 'fpt-fx-card-title', title), pill);
        copy.append(titleRow, node('p', 'fpt-fx-card-description', description));
        head.append(iconWrap, copy);
        const body = node('div', 'fpt-fx-card-body');
        card.append(head, body);
        return { card, head, body, pill, headIcon };
    }

    // Round play button whose icon turns into animated equalizer bars while the sound plays.
    function createPlayButton(label) {
        const button = node('button', 'fpt-ns-play');
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.title = label;
        const bars = node('span', 'fpt-ns-eq');
        bars.setAttribute('aria-hidden', 'true');
        bars.append(node('i'), node('i'), node('i'));
        button.append(icon('play_arrow'), bars);
        return button;
    }

    function makeHelpPanel() {
        const panel = node('aside', 'fpt-fx-help fpt-lot-help-popover');
        panel.hidden = true;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Справка по звуку уведомлений');
        panel.appendChild(node('h2', '', 'Звук уведомлений'));
        const list = node('ul');
        [
            'Звук играет, когда FunPay сообщает о новом сообщении в чате, — на всех открытых вкладках сайта.',
            'Выбор и громкость сохраняются сразу, перезагружать страницу не нужно.',
            'Своя мелодия: загрузите трек, перетащите рамку на нужный момент и выберите длину от 1 до 5 секунд.',
            'Если звук не играет, кликните по странице FunPay: браузер не разрешает звук до первого действия на вкладке.'
        ].forEach(text => list.appendChild(node('li', '', text)));
        panel.appendChild(list);
        return panel;
    }

    async function mount(popup) {
        if (!popup || !root.FPTPopupUI || typeof root.FPTPopupUI.ensureCategoryHeader !== 'function') {
            throw new Error('Не удалось загрузить общий каркас категории.');
        }
        const catalog = root.FPTNotificationSounds;
        if (!catalog) throw new Error('Не удалось загрузить список звуков.');
        const page = popup.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page.dataset.fptSoundsMounted === 'true') return;
        page.dataset.fptSoundsMounted = 'true';

        const run = (actionId, payload) => root.fptPopupActions.run(PAGE_ID, actionId, payload);
        const toast = (text, kind = 'success') => root.FPTPopupUI.showToast(popup, text, kind);
        const state = { sound: 'default', volume: 100, meta: null };
        try {
            const stored = await run('getSettings', { keys: Object.values(KEYS) });
            state.sound = catalog.normalizeId(stored[KEYS.sound]);
            state.volume = normalizeVolume(stored[KEYS.volume] ?? 1);
            state.meta = normalizeMeta(stored[KEYS.meta]);
        } catch (_) {}
        // Loaded-but-unsaved track in the trimming editor.
        const clip = { name: '', duration: 0, start: 0, length: CLIP.max, peaks: null };
        let playing = null; // 'preset:<id>' | 'clip' | null
        let open = false;

        const helpPanel = makeHelpPanel();
        const header = root.FPTPopupUI.ensureCategoryHeader(page, 'Звук уведомлений', {
            onHelp: event => {
                const show = helpPanel.hidden;
                helpPanel.hidden = !show;
                event.currentTarget.setAttribute('aria-expanded', show ? 'true' : 'false');
            }
        });
        const view = node('div', 'fpt-ns');
        const helpAnchor = node('span', 'fpt-ad-help-anchor');
        if (header.helpButton) {
            header.helpButton.before(helpAnchor);
            helpAnchor.append(header.helpButton, helpPanel);
        } else {
            view.appendChild(helpPanel);
        }

        // --- Melody picker -------------------------------------------------------------------
        const soundCard = createCard({
            iconName: 'notifications_active', title: 'Мелодия',
            description: 'Что прозвучит, когда покупатель напишет в чат.'
        });
        soundCard.card.dataset.state = 'on';
        const picker = node('div', 'fpt-ns-picker');
        const trigger = node('button', 'fpt-ns-trigger');
        trigger.type = 'button';
        trigger.id = 'fptNsTrigger';
        trigger.setAttribute('aria-haspopup', 'true');
        trigger.setAttribute('aria-controls', 'fptNsList');
        const triggerIcon = node('span', 'fpt-ns-trigger-icon');
        const triggerGlyph = icon('storefront');
        triggerIcon.appendChild(triggerGlyph);
        const triggerCopy = node('span', 'fpt-ns-trigger-copy');
        const triggerName = node('strong', 'fpt-ns-trigger-name');
        const triggerHint = node('span', 'fpt-ns-trigger-hint');
        triggerCopy.append(triggerName, triggerHint);
        const chevron = node('span', 'fpt-ns-chevron');
        chevron.appendChild(icon('chevron_right'));
        trigger.append(triggerIcon, triggerCopy, chevron);
        const triggerPlay = createPlayButton('Прослушать выбранный звук');
        triggerPlay.classList.add('fpt-ns-play--lg');
        const triggerRow = node('div', 'fpt-ns-trigger-row');
        triggerRow.append(trigger, triggerPlay);

        const collapse = node('div', 'fpt-ns-collapse');
        const collapseInner = node('div', 'fpt-ns-collapse-inner');
        const list = node('div', 'fpt-ns-list');
        list.id = 'fptNsList';
        list.setAttribute('role', 'radiogroup');
        list.setAttribute('aria-label', 'Мелодия уведомления');
        let order = 0;
        const options = [];
        const groupLabels = new Map();
        catalog.groups.forEach(group => {
            const presets = catalog.presets.filter(preset => preset.group === group.id);
            if (!presets.length) return;
            const label = node('div', 'fpt-ns-group-label', group.label);
            label.style.setProperty('--fpt-ns-delay', `${order++ * 14}ms`);
            groupLabels.set(group.id, label);
            list.appendChild(label);
            presets.forEach(preset => {
                const row = node('div', 'fpt-ns-option');
                row.dataset.sound = preset.id;
                row.style.setProperty('--fpt-ns-delay', `${order++ * 14}ms`);
                const main = node('button', 'fpt-ns-option-main');
                main.type = 'button';
                main.setAttribute('role', 'radio');
                const optionIcon = node('span', 'fpt-ns-option-icon');
                optionIcon.appendChild(icon(preset.icon));
                const copy = node('span', 'fpt-ns-option-copy');
                const hint = node('span', 'fpt-ns-option-hint', preset.hint);
                copy.append(node('strong', 'fpt-ns-option-name', preset.label), hint);
                const check = node('span', 'fpt-ns-option-check');
                check.appendChild(icon('check'));
                main.append(optionIcon, copy, check);
                const play = createPlayButton(`Прослушать: ${preset.label}`);
                row.append(main, play);
                list.appendChild(row);
                options.push({ preset, row, main, play, hint });
            });
        });
        collapseInner.appendChild(list);
        collapse.appendChild(collapseInner);
        picker.append(triggerRow, collapse);
        soundCard.body.appendChild(picker);

        // --- Volume --------------------------------------------------------------------------
        const volumeCard = createCard({
            iconName: 'volume_up', title: 'Громкость',
            description: 'Громкость звука уведомления на страницах FunPay.'
        });
        const volumeRow = node('div', 'fpt-ns-volume');
        const slider = node('div', 'fpt-fx-slider');
        const sliderHead = node('label', 'fpt-fx-slider-head');
        sliderHead.htmlFor = 'notificationVolume';
        const volumeValue = node('output', 'fpt-fx-slider-value');
        volumeValue.htmlFor = 'notificationVolume';
        sliderHead.append(node('span', 'fpt-fx-slider-label', 'Уровень'), volumeValue);
        const volumeInput = node('input', 'fpt-fx-range');
        volumeInput.type = 'range';
        volumeInput.id = 'notificationVolume';
        volumeInput.min = '0';
        volumeInput.max = '100';
        volumeInput.step = '1';
        slider.append(sliderHead, volumeInput);
        const testButton = createPlayToggle('Проверить');
        testButton.id = 'previewNotificationBtn';
        volumeRow.append(slider, testButton);
        const muteNote = node('p', 'fpt-fx-note fpt-ns-mute-note');
        muteNote.append(icon('volume_off'), node('span', '', 'Громкость на нуле — уведомления будут беззвучными.'));
        volumeCard.body.append(volumeRow, muteNote);

        // --- Custom melody -------------------------------------------------------------------
        const customCard = createCard({
            iconName: 'library_music', title: 'Своя мелодия',
            description: 'Загрузите любой трек и вырежьте из него отрывок до 5 секунд.'
        });
        customCard.card.id = 'fptNsCustomCard';

        const savedRow = node('div', 'fpt-ns-saved');
        const savedIcon = node('span', 'fpt-ns-saved-icon');
        savedIcon.appendChild(icon('graphic_eq'));
        const savedCopy = node('div', 'fpt-ns-saved-copy');
        const savedName = node('strong', 'fpt-ns-saved-name');
        const savedHint = node('span', 'fpt-ns-saved-hint');
        savedCopy.append(savedName, savedHint);
        const savedActions = node('div', 'fpt-ns-saved-actions');
        const savedPlay = createPlayButton('Прослушать сохранённую мелодию');
        const useButton = createButton('fpt-fx-button', 'check', 'Выбрать');
        const removeButton = createButton('fpt-fx-ghost-button', 'delete', 'Удалить');
        removeButton.id = 'fptCustomSoundRemoveBtn';
        savedActions.append(savedPlay, useButton, removeButton);
        savedRow.append(savedIcon, savedCopy, savedActions);

        const drop = node('div', 'fpt-fx-drop fpt-ns-drop');
        const dropIcon = node('span', 'fpt-ns-drop-icon');
        dropIcon.appendChild(icon('upload_file'));
        const dropCopy = node('div', 'fpt-fx-drop-copy');
        const dropTitle = node('strong', 'fpt-fx-drop-title', 'Загрузите трек');
        dropCopy.append(dropTitle, node('span', 'fpt-fx-drop-hint', 'MP3, WAV, OGG, M4A · до 30 МБ. Можно перетащить файл сюда.'));
        const dropActions = node('div', 'fpt-fx-drop-actions');
        const uploadButton = createButton('fpt-fx-button fpt-fx-button--primary', 'upload', 'Выбрать файл');
        uploadButton.id = 'fptCustomSoundUploadBtn';
        const fileInput = node('input', 'fpt-ns-file-input');
        fileInput.type = 'file';
        fileInput.accept = ACCEPT;
        fileInput.hidden = true;
        dropActions.append(uploadButton, fileInput);
        drop.append(dropIcon, dropCopy, dropActions);

        const editor = node('div', 'fpt-ns-editor');
        editor.hidden = true;
        const wave = node('div', 'fpt-ns-wave');
        const canvas = node('canvas', 'fpt-ns-wave-canvas');
        canvas.setAttribute('aria-hidden', 'true');
        const selection = node('div', 'fpt-ns-wave-sel');
        selection.tabIndex = 0;
        selection.setAttribute('role', 'slider');
        selection.setAttribute('aria-label', 'Начало отрывка');
        selection.append(node('span', 'fpt-ns-wave-handle fpt-ns-wave-handle--start'), node('span', 'fpt-ns-wave-handle fpt-ns-wave-handle--end'));
        const playhead = node('div', 'fpt-ns-wave-playhead');
        playhead.hidden = true;
        wave.append(canvas, selection, playhead);
        const waveMeta = node('div', 'fpt-ns-wave-meta');
        const rangeText = node('span', 'fpt-ns-range');
        const durationText = node('span', 'fpt-ns-duration');
        waveMeta.append(rangeText, durationText);

        const controls = node('div', 'fpt-ns-controls');
        const spin = node('div', 'fpt-ns-spin');
        spin.setAttribute('role', 'group');
        spin.setAttribute('aria-label', 'Длина отрывка');
        const secDown = node('button', 'fpt-ns-spin-btn');
        secDown.type = 'button';
        secDown.id = 'fptClipSecDown';
        secDown.setAttribute('aria-label', 'Короче на секунду');
        secDown.appendChild(icon('remove'));
        const secValue = node('output', 'fpt-ns-spin-value');
        const secUp = node('button', 'fpt-ns-spin-btn');
        secUp.type = 'button';
        secUp.id = 'fptClipSecUp';
        secUp.setAttribute('aria-label', 'Длиннее на секунду');
        secUp.appendChild(icon('add'));
        spin.append(secDown, secValue, secUp);
        const controlActions = node('div', 'fpt-ns-control-actions');
        const clipPlay = createPlayToggle('Прослушать');
        clipPlay.id = 'fptCustomSoundPreviewBtn';
        const saveButton = createButton('fpt-fx-button fpt-fx-button--primary', 'save', 'Сохранить');
        saveButton.id = 'fptCustomSoundSaveBtn';
        controlActions.append(clipPlay, saveButton);
        controls.append(spin, controlActions);
        editor.append(wave, waveMeta, controls);
        customCard.body.append(savedRow, drop, editor);

        view.append(soundCard.card, volumeCard.card, customCard.card);
        page.appendChild(view);

        // --- Rendering -----------------------------------------------------------------------
        function presetLabel(id) {
            const preset = catalog.get(id);
            return preset ? preset.label : 'Стандартный';
        }

        function renderPlayButtons() {
            options.forEach(({ preset, row, play }) => {
                const active = playing === `preset:${preset.id}`;
                play.dataset.playing = active ? 'true' : 'false';
                row.dataset.playing = active ? 'true' : 'false';
            });
            triggerPlay.dataset.playing = playing === `preset:${state.sound}` ? 'true' : 'false';
            savedPlay.dataset.playing = playing === 'preset:custom' ? 'true' : 'false';
            setPlayToggle(testButton, playing === `preset:${state.sound}`);
            setPlayToggle(clipPlay, playing === 'clip');
        }

        function render() {
            const preset = catalog.get(state.sound) || catalog.get('default');
            const group = catalog.groups.find(item => item.id === preset.group);
            setIcon(triggerGlyph, preset.icon);
            triggerName.textContent = preset.label;
            triggerHint.textContent = `${group ? group.label : ''} · ${preset.id === 'custom' && state.meta ? formatSeconds(state.meta.length) : preset.hint}`;
            trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
            trigger.setAttribute('aria-label', `Мелодия: ${preset.label}. ${open ? 'Свернуть список' : 'Открыть список'}`);
            picker.dataset.open = open ? 'true' : 'false';
            collapse.toggleAttribute('inert', !open);
            // The trigger already names the preset; the pill only flags a silent setup.
            soundCard.pill.hidden = state.volume !== 0;
            soundCard.pill.textContent = 'Без звука';
            soundCard.pill.dataset.kind = 'warning';

            const customLabel = groupLabels.get('custom');
            if (customLabel) customLabel.hidden = !state.meta;
            options.forEach(({ preset: item, row, main, hint }) => {
                const selected = item.id === state.sound && !row.hidden;
                main.setAttribute('aria-checked', selected ? 'true' : 'false');
                main.tabIndex = selected ? 0 : -1;
                if (item.id === 'custom') {
                    // "Своя" appears in the list only once a melody has been saved.
                    row.hidden = !state.meta;
                    hint.textContent = state.meta ? `Сохранена · ${formatSeconds(state.meta.length)}` : 'Ещё не загружена';
                    main.dataset.empty = state.meta ? 'false' : 'true';
                }
            });
            if (!options.some(option => option.main.tabIndex === 0) && options[0]) options[0].main.tabIndex = 0;

            const volume = state.volume;
            volumeInput.value = String(volume);
            volumeValue.textContent = `${volume}%`;
            volumeInput.setAttribute('aria-valuetext', `${volume}%`);
            volumeInput.style.setProperty('--fpt-fx-fill', `${volume}%`);
            setIcon(volumeCard.headIcon, volume === 0 ? 'volume_off' : volume < 50 ? 'volume_down' : 'volume_up');
            volumeCard.pill.hidden = volume !== 0;
            volumeCard.pill.textContent = 'Без звука';
            volumeCard.pill.dataset.kind = 'warning';
            volumeCard.card.dataset.state = volume === 0 ? 'off' : 'on';
            muteNote.hidden = volume !== 0;

            const customActive = state.sound === 'custom';
            customCard.card.dataset.state = customActive && state.meta ? 'on' : 'off';
            customCard.pill.textContent = clip.peaks ? 'Не сохранена' : state.meta ? (customActive ? 'Играет в уведомлениях' : 'Сохранена') : 'Не загружена';
            customCard.pill.dataset.kind = clip.peaks ? 'warning' : state.meta ? 'success' : 'neutral';
            savedRow.hidden = !state.meta;
            if (state.meta) {
                savedName.textContent = state.meta.name || 'Своя мелодия';
                savedHint.textContent = `Отрывок ${formatSeconds(state.meta.length)}${customActive ? ' · выбрана' : ''}`;
            }
            useButton.hidden = customActive;
            dropTitle.textContent = clip.peaks ? clip.name || 'Трек загружен' : state.meta ? 'Заменить мелодию' : 'Загрузите трек';
            setButtonLabel(uploadButton, 'upload', clip.peaks ? 'Другой файл' : 'Выбрать файл');
            renderEditor();
            renderPlayButtons();
        }

        // --- Waveform editor -----------------------------------------------------------------
        function themeColor(name, fallback) {
            const value = root.getComputedStyle(view).getPropertyValue(name).trim();
            return value || fallback;
        }

        function drawWave() {
            if (!clip.peaks || editor.hidden) return;
            const rect = wave.getBoundingClientRect();
            if (!rect.width) return;
            const ratio = Math.min(2, root.devicePixelRatio || 1);
            canvas.width = Math.round(rect.width * ratio);
            canvas.height = Math.round(rect.height * ratio);
            const ctx = canvas.getContext('2d');
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            ctx.clearRect(0, 0, rect.width, rect.height);
            const accent = themeColor('--fptm-accent', '#7663f6');
            const muted = themeColor('--fptm-faint', '#a3a3b5');
            const mid = rect.height / 2;
            const barWidth = 2;
            const gap = 1;
            const columns = Math.max(1, Math.floor(rect.width / (barWidth + gap)));
            const from = clip.start / clip.duration;
            const to = (clip.start + clip.length) / clip.duration;
            for (let i = 0; i < columns; i++) {
                const position = i / columns;
                const peak = clip.peaks[Math.min(clip.peaks.length - 1, Math.floor(position * clip.peaks.length))];
                const amplitude = Math.max(Math.abs(peak[0]), Math.abs(peak[1]));
                const height = Math.max(2, amplitude * (rect.height - 10));
                ctx.fillStyle = position >= from && position <= to ? accent : muted;
                ctx.globalAlpha = position >= from && position <= to ? 1 : 0.55;
                ctx.fillRect(i * (barWidth + gap), mid - height / 2, barWidth, height);
            }
            ctx.globalAlpha = 1;
        }

        function renderEditor() {
            editor.hidden = !clip.peaks;
            if (!clip.peaks) return;
            const left = clip.duration ? (clip.start / clip.duration) * 100 : 0;
            const width = clip.duration ? (clip.length / clip.duration) * 100 : 100;
            selection.style.left = `${left}%`;
            selection.style.width = `${width}%`;
            selection.setAttribute('aria-valuemin', '0');
            selection.setAttribute('aria-valuemax', String(Math.max(0, clip.duration - clip.length).toFixed(1)));
            selection.setAttribute('aria-valuenow', clip.start.toFixed(1));
            selection.setAttribute('aria-valuetext', `с ${formatTime(clip.start)} по ${formatTime(clip.start + clip.length)}`);
            rangeText.textContent = `${formatTime(clip.start)} – ${formatTime(clip.start + clip.length)}`;
            durationText.textContent = `Отрывок ${formatSeconds(clip.length)} из ${formatTime(clip.duration)}`;
            secValue.textContent = `${Math.round(clip.length)} сек`;
            secDown.disabled = clip.length <= CLIP.min || clip.duration <= CLIP.min;
            secUp.disabled = clip.length >= CLIP.max || clip.length >= clip.duration;
            drawWave();
        }

        function applySelection(result) {
            if (!result) return;
            clip.start = result.start;
            clip.length = result.length;
            clip.duration = result.duration;
            renderEditor();
        }

        let selectTimer = null;
        function moveSelection(start, { commit = true } = {}) {
            const max = Math.max(0, clip.duration - clip.length);
            clip.start = Math.min(max, Math.max(0, start));
            renderEditor();
            if (!commit) return;
            clearTimeout(selectTimer);
            selectTimer = setTimeout(() => {
                Promise.resolve(run('selectAudioClip', { start: clip.start })).then(applySelection).catch(() => {});
            }, 60);
        }

        let drag = null;
        wave.addEventListener('pointerdown', event => {
            if (!clip.peaks || event.button !== 0) return;
            const rect = wave.getBoundingClientRect();
            const time = ((event.clientX - rect.left) / rect.width) * clip.duration;
            const inside = time >= clip.start && time <= clip.start + clip.length;
            // Grabbing the window keeps the grab point; clicking outside centres the window there.
            drag = { offset: inside ? time - clip.start : clip.length / 2, rect };
            if (!inside) moveSelection(time - drag.offset, { commit: false });
            wave.setPointerCapture(event.pointerId);
            wave.dataset.dragging = 'true';
            selection.focus({ preventScroll: true });
            event.preventDefault();
        });
        wave.addEventListener('pointermove', event => {
            if (!drag) return;
            const time = ((event.clientX - drag.rect.left) / drag.rect.width) * clip.duration;
            moveSelection(time - drag.offset, { commit: false });
        });
        const endDrag = () => {
            if (!drag) return;
            drag = null;
            delete wave.dataset.dragging;
            moveSelection(clip.start);
        };
        wave.addEventListener('pointerup', endDrag);
        wave.addEventListener('pointercancel', endDrag);
        selection.addEventListener('keydown', event => {
            const step = event.shiftKey ? 1 : 0.1;
            const moves = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step };
            if (event.key === 'Home') moveSelection(0);
            else if (event.key === 'End') moveSelection(clip.duration);
            else if (moves[event.key] !== undefined) moveSelection(clip.start + moves[event.key]);
            else return;
            event.preventDefault();
        });

        let playheadFrame = null;
        function animatePlayhead() {
            const startedAt = performance.now();
            const from = clip.start;
            const length = clip.length;
            playhead.hidden = false;
            const tick = () => {
                const elapsed = (performance.now() - startedAt) / 1000;
                if (playing !== 'clip' || elapsed > length) {
                    playhead.hidden = true;
                    playheadFrame = null;
                    return;
                }
                playhead.style.left = `${((from + elapsed) / clip.duration) * 100}%`;
                playheadFrame = root.requestAnimationFrame(tick);
            };
            if (playheadFrame) root.cancelAnimationFrame(playheadFrame);
            tick();
        }

        // --- Playback ------------------------------------------------------------------------
        async function stopPlayback() {
            const current = playing;
            playing = null;
            renderPlayButtons();
            if (current === 'clip') await run('fptCustomSoundStopBtn');
            else if (current) await run('stopNotificationPreview');
        }

        async function playPreset(id) {
            if (playing === `preset:${id}`) return stopPlayback();
            if (playing) await stopPlayback();
            if (id === 'custom' && !state.meta) {
                revealCustom();
                return;
            }
            const token = `preset:${id}`;
            playing = token;
            renderPlayButtons();
            try {
                await run('previewNotificationBtn', { sound: id, volume: state.volume / 100 });
            } catch (error) {
                toast(error.message || 'Не удалось воспроизвести звук.', 'error');
            } finally {
                if (playing === token) {
                    playing = null;
                    renderPlayButtons();
                }
            }
        }

        async function playClip() {
            if (playing === 'clip') return stopPlayback();
            if (playing) await stopPlayback();
            playing = 'clip';
            renderPlayButtons();
            animatePlayhead();
            try {
                await run('fptCustomSoundPreviewBtn', { start: clip.start, volume: state.volume / 100 });
            } catch (error) {
                toast(error.message || 'Не удалось воспроизвести отрывок.', 'error');
            } finally {
                if (playing === 'clip') {
                    playing = null;
                    renderPlayButtons();
                }
            }
        }

        // --- Saving --------------------------------------------------------------------------
        let volumeTimer = null;
        let soundQueue = Promise.resolve();
        let pendingSound = 0;

        function selectSound(id, { announce = true } = {}) {
            if (id === 'custom' && !state.meta) {
                revealCustom();
                return;
            }
            if (id === state.sound) return;
            const previous = state.sound;
            state.sound = id;
            render();
            pendingSound += 1;
            soundQueue = soundQueue.then(async () => {
                try {
                    await run('saveSettings', { settings: { [KEYS.sound]: id } });
                    if (announce) toast(`Звук уведомлений: ${presetLabel(id)}.`);
                } catch (error) {
                    state.sound = previous;
                    render();
                    toast(error.message || 'Не удалось сохранить звук.', 'error');
                } finally {
                    pendingSound -= 1;
                }
            });
        }

        function revealCustom() {
            setOpen(false);
            toast('Сначала загрузите свою мелодию.', 'warning');
            customCard.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            customCard.card.dataset.flash = 'true';
            setTimeout(() => { delete customCard.card.dataset.flash; }, 1200);
        }

        async function busy(button, task) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            try {
                await task();
            } catch (error) {
                toast(error.message || 'Не удалось выполнить действие.', 'error');
            } finally {
                button.removeAttribute('aria-busy');
                button.disabled = false;
                render();
            }
        }

        async function useFile(file) {
            if (!file) return;
            if (file.type && !/^(audio|video)\//i.test(file.type)) throw new Error('Это не аудиофайл. Выберите MP3, WAV, OGG или M4A.');
            if (playing) await stopPlayback();
            const loaded = await run('fptCustomSoundUploadBtn', { file });
            const shape = await run('getAudioWaveform', { points: 600 });
            clip.name = loaded.name || file.name;
            clip.peaks = shape.peaks;
            applySelection(loaded);
            render();
            drawWave();
            if (clip.duration < CLIP.min) toast('Трек короче секунды — сохранится целиком.', 'warning');
        }

        // --- Picker open/close ---------------------------------------------------------------
        // Picking a preset closes the list a moment later so the check mark is seen; any newer
        // open/close request cancels that pending close.
        let closeTimer = null;
        function setOpen(value, { focus = false } = {}) {
            clearTimeout(closeTimer);
            closeTimer = null;
            if (open !== value) {
                open = value;
                render();
            }
            if (open && focus) {
                const target = options.find(option => option.main.tabIndex === 0);
                if (target) target.main.focus({ preventScroll: true });
            }
        }

        // --- Interactions --------------------------------------------------------------------
        trigger.addEventListener('click', () => setOpen(!open, { focus: false }));
        trigger.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setOpen(true, { focus: true });
            }
        });
        triggerPlay.addEventListener('click', () => playPreset(state.sound));
        options.forEach(({ preset, main, play }) => {
            main.addEventListener('click', () => {
                selectSound(preset.id);
                if (preset.id === 'custom' && !state.meta) return;
                trigger.focus({ preventScroll: true });
                clearTimeout(closeTimer);
                closeTimer = setTimeout(() => setOpen(false), 180);
            });
            main.addEventListener('keydown', event => {
                const steps = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
                const visible = options.filter(option => !option.row.hidden);
                const index = visible.findIndex(option => option.main === main);
                let target = null;
                if (steps[event.key]) target = visible[(index + steps[event.key] + visible.length) % visible.length];
                else if (event.key === 'Home') target = visible[0];
                else if (event.key === 'End') target = visible[visible.length - 1];
                if (!target) return;
                event.preventDefault();
                options.forEach(option => { option.main.tabIndex = option === target ? 0 : -1; });
                target.main.focus();
            });
            play.addEventListener('click', () => playPreset(preset.id));
        });
        picker.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || !open) return;
            event.stopPropagation();
            setOpen(false);
            trigger.focus();
        });

        volumeInput.addEventListener('input', () => {
            state.volume = normalizeVolume(Number(volumeInput.value) / 100);
            render();
            clearTimeout(volumeTimer);
            volumeTimer = setTimeout(async () => {
                volumeTimer = null;
                try {
                    await run('saveSettings', { settings: { [KEYS.volume]: state.volume / 100 } });
                } catch (error) {
                    toast(error.message || 'Не удалось сохранить громкость.', 'error');
                }
            }, SAVE_DELAY_MS);
        });
        testButton.addEventListener('click', () => playPreset(state.sound));

        savedPlay.addEventListener('click', () => playPreset('custom'));
        useButton.addEventListener('click', () => selectSound('custom'));
        removeButton.addEventListener('click', () => busy(removeButton, async () => {
            if (playing === 'preset:custom') await stopPlayback();
            const result = await run('fptCustomSoundRemoveBtn');
            state.meta = null;
            state.sound = catalog.normalizeId(result && result.notificationSound);
            toast('Своя мелодия удалена.');
        }));

        uploadButton.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            fileInput.value = '';
            if (file) busy(uploadButton, () => useFile(file));
        });
        ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, event => {
            event.preventDefault();
            drop.dataset.dragover = 'true';
        }));
        ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, event => {
            event.preventDefault();
            if (name === 'dragleave' && drop.contains(event.relatedTarget)) return;
            delete drop.dataset.dragover;
        }));
        drop.addEventListener('drop', event => {
            const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
            if (file) busy(uploadButton, () => useFile(file));
        });

        secDown.addEventListener('click', () => busy(secDown, async () => applySelection(await run('fptClipSecDown'))));
        secUp.addEventListener('click', () => busy(secUp, async () => applySelection(await run('fptClipSecUp'))));
        clipPlay.addEventListener('click', () => playClip());
        saveButton.addEventListener('click', () => busy(saveButton, async () => {
            if (playing) await stopPlayback();
            clearTimeout(selectTimer);
            await soundQueue;
            const result = await run('fptCustomSoundSaveBtn', { start: clip.start, name: clip.name });
            state.meta = normalizeMeta(result.meta);
            state.sound = 'custom';
            toast(`Своя мелодия сохранена · ${formatSeconds(state.meta ? state.meta.length : clip.length)}.`);
        }));

        // Changes made elsewhere (another tab, settings import) show up without reopening the panel.
        root.chrome?.storage?.onChanged?.addListener((changes, area) => {
            if (area !== 'local' || !page.isConnected) return;
            let changed = false;
            if (changes[KEYS.sound] && !pendingSound) {
                const next = catalog.normalizeId(changes[KEYS.sound].newValue);
                if (next !== state.sound) { state.sound = next; changed = true; }
            }
            if (changes[KEYS.volume] && !volumeTimer) {
                const next = normalizeVolume(changes[KEYS.volume].newValue ?? 1);
                if (next !== state.volume) { state.volume = next; changed = true; }
            }
            if (changes[KEYS.meta]) {
                state.meta = normalizeMeta(changes[KEYS.meta].newValue);
                changed = true;
            }
            if (changed) render();
        });
        if (typeof ResizeObserver === 'function') new ResizeObserver(() => drawWave()).observe(wave);
        root.FPTPopupUI.onPageActivated(page, () => drawWave());

        render();
    }

    root.FPTNotificationSoundPage = Object.freeze({ mount, normalizeVolume, normalizeMeta, formatTime });
})(window);
