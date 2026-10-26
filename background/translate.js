async function googleTranslateLine(text, target) {
    if (!text || !text.trim()) return text;
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='
        + encodeURIComponent(target || 'en') + '&dt=t&q=' + encodeURIComponent(text);
    const res = await fetch(url);
    if (!res.ok) throw new Error('TRANSLATE_HTTP_' + res.status);
    const json = await res.json();
    if (!json || !Array.isArray(json[0])) return text;
    return json[0].map((s) => (s && s[0] != null ? s[0] : '')).join('');
}

async function googleTranslatePreserve(text, target) {
    if (typeof text !== 'string' || !text.trim()) return text || '';
    const lines = text.split('\n');
    const out = [];
    for (const line of lines) {
        if (!line.trim()) { out.push(line); continue; }
        try { out.push(await googleTranslateLine(line, target)); }
        catch { out.push(line); }
    }
    return out.join('\n');
}

export async function fetchAITranslation(data) {
    const { title, description, buyerMessage } = data;
    try {
        const tTitle = await googleTranslatePreserve(title || '', 'en');
        const tDesc = await googleTranslatePreserve(description || '', 'en');
        const tBuyer = await googleTranslatePreserve(buyerMessage || '', 'en');
        return {
            success: true,
            data: {
                title: tTitle,
                description: tDesc,
                buyerMessage: tBuyer,
            },
        };
    } catch (e) {
        return { success: false, error: 'Ошибка перевода: ' + e.message };
    }
}

