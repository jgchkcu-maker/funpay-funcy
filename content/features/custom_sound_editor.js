// Headless audio decoding, selection, preview and WAV persistence for the "Звук уведомлений" page.
(function () {
    let clipSeconds = 5, selStart = 0, decodedBuffer = null, audioCtx = null, previewSource = null;
    const STORE_DATA = 'fpToolsCustomSoundData', STORE_META = 'fpToolsCustomSoundMeta';
    function getCtx() { return audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); }
    function sliceToWav() {
        const dur = decodedBuffer.duration;
        const clip = Math.min(clipSeconds, dur);
        const rate = decodedBuffer.sampleRate;
        const startSample = Math.floor(selStart * rate);
        const clipSamples = Math.floor(clip * rate);
        const channels = Math.min(2, decodedBuffer.numberOfChannels);

        // собираем PCM 16-bit
        const chData = [];
        for (let c = 0; c < channels; c++) chData.push(decodedBuffer.getChannelData(c));

        const numSamples = clipSamples;
        const bytesPerSample = 2;
        const blockAlign = channels * bytesPerSample;
        const dataSize = numSamples * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);            // PCM
        view.setUint16(22, channels, true);
        view.setUint32(24, rate, true);
        view.setUint32(28, rate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true);
        writeStr(36, 'data');
        view.setUint32(40, dataSize, true);

        let offset = 44;
        for (let i = 0; i < numSamples; i++) {
            for (let c = 0; c < channels; c++) {
                let sample = chData[c][startSample + i] || 0;
                sample = Math.max(-1, Math.min(1, sample));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }

        // → base64 data URL
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return 'data:audio/wav;base64,' + btoa(binary);
    }

    // ── file load ─────────────────────────────────────────────────────────────────

    function select(p = {}) {
        if (p.seconds !== undefined) {
            const value = Number(p.seconds);
            if (!Number.isFinite(value)) throw new Error('Invalid clip length');
            clipSeconds = Math.max(1, Math.min(5, value));
        }
        const duration = decodedBuffer?.duration || 0;
        selStart = Math.min(selStart, Math.max(0, duration - Math.min(clipSeconds, duration)));
        if (p.start !== undefined) selStart = Math.max(0, Math.min(Number(p.start) || 0, Math.max(0, duration - Math.min(clipSeconds, duration))));
        return { start: selStart, length: Math.min(clipSeconds, duration), duration };
    }
    // Min/max pairs per column of the waveform, folded across channels, in the -1..1 range.
    function waveform(points) {
        const count = Math.max(16, Math.min(2000, Math.round(Number(points) || 300)));
        const channels = [];
        for (let c = 0; c < decodedBuffer.numberOfChannels; c++) channels.push(decodedBuffer.getChannelData(c));
        const step = Math.max(1, Math.floor(decodedBuffer.length / count));
        const peaks = [];
        for (let i = 0; i < count; i++) {
            let min = 0, max = 0;
            const from = i * step, to = Math.min(decodedBuffer.length, from + step);
            for (const data of channels) {
                for (let j = from; j < to; j++) {
                    const v = data[j];
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
            }
            peaks.push([min, max]);
        }
        return peaks;
    }

    function stopPreview() {
        if (!previewSource) return;
        const source = previewSource;
        previewSource = null;
        try { source.stop(); } catch (_) {}
    }

    const MAX_FILE_BYTES = 30 * 1024 * 1024;
    if (!window.fptPopupActions) return;
    const register = (id, fn) => window.fptPopupActions.register('sounds', id, fn);
    register('fptCustomSoundUploadBtn', async p => {
        if (!p.file) throw new Error('Выберите аудиофайл.');
        if (p.file.size > MAX_FILE_BYTES) throw new Error('Файл больше 30 МБ. Выберите трек поменьше.');
        stopPreview();
        try {
            decodedBuffer = await getCtx().decodeAudioData(await p.file.arrayBuffer());
        } catch (_) {
            decodedBuffer = null;
            throw new Error('Не удалось прочитать звук. Подойдут MP3, WAV, OGG, M4A или WebM.');
        }
        selStart = 0;
        return { ...select(), name: p.file.name, sampleRate: decodedBuffer.sampleRate, channels: decodedBuffer.numberOfChannels };
    });
    register('getAudioWaveform', p => {
        if (!decodedBuffer) throw new Error('Сначала загрузите аудио.');
        return { peaks: waveform(p.points), duration: decodedBuffer.duration };
    });
    register('selectAudioClip', select);
    register('fptClipSecUp', () => select({ seconds: clipSeconds + 1 }));
    register('fptClipSecDown', () => select({ seconds: clipSeconds - 1 }));
    // Resolves when the selected fragment has played to the end or was stopped.
    register('fptCustomSoundPreviewBtn', async p => {
        if (!decodedBuffer) throw new Error('Сначала загрузите аудио.');
        select(p);
        const context = getCtx();
        await context.resume();
        stopPreview();
        const source = context.createBufferSource();
        source.buffer = decodedBuffer;
        const gain = context.createGain();
        gain.gain.value = Math.max(0, Math.min(1, p.volume ?? 1));
        source.connect(gain); gain.connect(context.destination);
        const ended = new Promise(resolve => { source.onended = resolve; });
        previewSource = source;
        source.start(0, selStart, Math.min(clipSeconds, decodedBuffer.duration));
        await ended;
        if (previewSource === source) previewSource = null;
        return select();
    });
    register('fptCustomSoundStopBtn', () => stopPreview());
    register('fptCustomSoundSaveBtn', async p => {
        if (!decodedBuffer) throw new Error('Сначала загрузите аудио.');
        select(p);
        const meta = { length: Math.min(clipSeconds, decodedBuffer.duration) };
        if (typeof p.name === 'string' && p.name) meta.name = p.name.slice(0, 120);
        const result = { [STORE_DATA]: sliceToWav(), [STORE_META]: meta, notificationSound: 'custom' };
        await window.fptPopupActions.updateSettings(Object.keys(result), () => result);
        return { meta, notificationSound: 'custom' };
    });
    // Forgets the saved fragment; a custom selection falls back to the FunPay sound.
    register('fptCustomSoundRemoveBtn', async () => {
        await window.fptPopupActions.removeSettings([STORE_DATA, STORE_META]);
        const next = await window.fptPopupActions.updateSettings(['notificationSound'], current => ({
            notificationSound: current.notificationSound === 'custom' ? 'default' : (current.notificationSound || 'default')
        }));
        return { notificationSound: next.notificationSound };
    });
})();
