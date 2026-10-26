// A single document and reference count for every DOM parser consumer.
export function createOffscreenParser(api) {
    const path = 'offscreen/offscreen.html';
    let creating = null, closing = null, active = 0;
    async function ensure() {
        if (closing) await closing;
        if (!creating) creating = (async () => {
            const contexts = await api.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [api.runtime.getURL(path)] });
            if (!contexts.length) await api.offscreen.createDocument({ url: path, reasons: ['DOM_PARSER'], justification: 'Разбор HTML страниц FunPay' });
        })().finally(() => { creating = null; });
        await creating;
    }
    async function parse(html, action, extra = {}) {
        active++;
        try {
            await ensure();
            return await api.runtime.sendMessage({ target: 'offscreen', action, html, ...extra });
        } finally {
            active--;
            if (!active) {
                closing = Promise.resolve(api.offscreen.closeDocument()).catch(() => {}).finally(() => { closing = null; });
                await closing;
            }
        }
    }
    return Object.freeze({ parse });
}
let parser;
export function parseHtmlViaOffscreen(html, action, extra) {
    parser ||= createOffscreenParser(chrome);
    return parser.parse(html, action, extra);
}
