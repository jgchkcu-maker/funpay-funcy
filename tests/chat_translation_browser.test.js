const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright');
const root = path.join(__dirname, '..');

async function openChat(browser) {
    const page = await browser.newPage();
    await page.setContent(`<div id="content"><div class="chat" data-user="2">
      <div class="chat-header"><div class="media-user-name"><a href="/users/2/">Buyer</a></div><ul class="dropdown-menu"></ul></div>
      <div class="chat-message-list">
        <div id="m1" class="chat-msg-item chat-msg-with-head"><a class="chat-msg-author-link">Buyer</a><span class="chat-msg-date">12:00</span><div class="chat-msg-text">Hello</div></div>
        <div id="m2" class="chat-msg-item chat-msg-with-head"><a class="chat-msg-author-link">Seller</a><span class="chat-msg-date">12:01</span><div class="chat-msg-text">╭─ ⤸ Hello
╰ Actual reply</div></div>
      </div></div></div>`);
    await page.evaluate(() => {
        window.qaMessages = [];
        window.qaPending = [];
        window.qaConsentReads = [];
        window.chrome = { storage: { local: {
            get: async key => {
                if (key === 'fpToolsTranslateConsentAt' && window.qaPauseConsent) return new Promise(resolve => qaConsentReads.push(resolve));
                return window.qaNoConsent ? { fpToolsDisabledFeatures: [] } : { fpToolsTranslateConsentAt: 1, fpToolsDisabledFeatures: [] };
            }, set: async () => {}
        } }, runtime: { sendMessage: async message => {
            qaMessages.push(message);
            if (window.qaDelayResponse) return new Promise(resolve => qaPending.push(resolve));
            return { success: true, text: 'RU:' + message.text };
        } } };
    });
    for (const file of ['translate_consent', 'buyer_history', 'chat_reply']) {
        await page.addScriptTag({ path: path.join(root, `content/features/${file}.js`) });
    }
    await page.waitForSelector('#m2 .fpt-reply-rest');
    return page;
}

test('chat: quoted replies translate and export their own text without translation markup', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await openChat(browser);
        assert.equal(await page.evaluate(() => FPTChatTranslate.extractCleanMessageText(document.querySelector('#m2 .chat-msg-text'))), 'Actual reply');
        // Use the actual message toolbar; no sidebar/language metadata is present.
        await page.evaluate(() => document.querySelector('#m2 button[title="Перевести сообщение"]').click());
        await page.waitForSelector('#m2 .fp-trans-text');
        assert.equal(await page.locator('#m2 .fp-trans-text').textContent(), 'RU:Actual reply');
        assert.equal(await page.locator('#m2 .fpt-reply-rest').textContent(), 'Actual reply');
        assert.deepEqual(await page.evaluate(() => qaMessages.map(m => m.text)), ['Actual reply']);
        const downloadPromise = page.waitForEvent('download');
        await page.click('#fp-export-chat-menu-btn');
        const download = await downloadPromise;
        const exported = fs.readFileSync(await download.path(), 'utf8');
        assert.match(exported, /Actual reply/); assert.match(exported, /Hello/);
        assert.doesNotMatch(exported, /RU:|Перевод:/);
        await download.delete();
    } finally { await browser.close(); }
});

test('chat: disabling during consent prevents a request and disabling in flight prevents rendering', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await openChat(browser);
        await page.evaluate(() => { qaPauseConsent = true; window.qaJob = appendTranslation(document.querySelector('#m1 .chat-msg-text')); });
        await page.waitForFunction(() => qaConsentReads.length === 1);
        await page.evaluate(() => { stopRealtimeTranslation(); qaConsentReads.shift()({ fpToolsTranslateConsentAt: 1 }); });
        assert.equal(await page.evaluate(() => qaJob), false);
        assert.equal(await page.evaluate(() => qaMessages.length), 0);
        assert.equal(await page.locator('.fp-trans-wrap').count(), 0);
        await page.evaluate(() => {
            qaPauseConsent = false; qaDelayResponse = true;
            window.qaJob = appendTranslation(document.querySelector('#m1 .chat-msg-text'));
        });
        await page.waitForFunction(() => qaPending.length === 1);
        await page.evaluate(() => { stopRealtimeTranslation(); qaPending.shift()({ success: true, text: 'Late result' }); });
        assert.equal(await page.evaluate(() => qaJob), false);
        assert.equal(await page.locator('.fp-trans-wrap').count(), 0);
        assert.equal(await page.locator('[data-fp-trans-state="pending"]').count(), 0);
        // Re-enabling the same element is allowed and displays only the new result.
        await page.evaluate(async () => { qaDelayResponse = false; await appendTranslation(document.querySelector('#m1 .chat-msg-text')); });
        assert.equal(await page.locator('#m1 .fp-trans-text').textContent(), 'RU:Hello');
    } finally { await browser.close(); }
});

test('chat: clearing an in-flight translation or changing context invalidates its result', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await openChat(browser);
        for (const action of ['clear', 'epoch', 'contact']) {
            await page.evaluate(() => {
                const el = document.querySelector('#m1 .chat-msg-text');
                FPTChatTranslate.clearMessageTranslation(el); qaDelayResponse = true;
                window.qaJob = appendTranslation(el);
            });
            await page.waitForFunction(() => qaPending.length === 1);
            await page.evaluate(action => {
                if (action === 'clear') FPTChatTranslate.clearMessageTranslation(document.querySelector('#m1 .chat-msg-text'));
                if (action === 'epoch') FPTChatTranslate.bumpChatEpoch();
                if (action === 'contact') {
                    const el = document.createElement('a'); el.className = 'contact-item'; document.body.append(el); el.click();
                }
                qaPending.shift()({ success: true, text: 'Stale' });
            }, action);
            assert.equal(await page.evaluate(() => qaJob), false);
            assert.equal(await page.locator('.fp-trans-wrap').count(), 0);
        }
    } finally { await browser.close(); }
});
