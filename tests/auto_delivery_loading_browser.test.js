const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');

test('auto-delivery shows layout-matched skeleton rows while the first lot list is loading', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 420, height: 789 } });
        await page.setContent(`
            <div class="fp-tools-popup fptm-themed active">
                <div class="fp-tools-body">
                    <nav class="fp-tools-nav"></nav>
                    <main class="fp-tools-content"><div class="fp-tools-page-content active" data-page="auto_delivery"></div></main>
                </div>
            </div>
        `);
        await page.addStyleTag({ path: path.join(root, 'css/content_styles.css') });
        await page.addStyleTag({ path: path.join(root, 'css/popup_categories.css') });
        await page.addStyleTag({ path: path.join(root, 'css/fpt_icons_theme.css') });
        await page.addStyleTag({ content: `
            body { margin: 0; }
            .fp-tools-popup { box-sizing: border-box; width: min(100vw, 1204px); height: 789px; }
            .fp-tools-body { display: grid; grid-template-columns: 104px minmax(0, 1fr); height: 100%; }
            .fp-tools-nav { min-width: 0; }
            .fp-tools-content { min-width: 0; overflow: auto; background: var(--fptm-bg); color: var(--fptm-text); }
            .fp-tools-popup.fptm-themed { --fptm-bg: #fff; --fptm-text: #18201d; --fptm-muted: #59645f; --fptm-accent: #247653; --fptm-on-accent: #fff; --fptm-accent-soft: #e5f2ec; --fptm-accent-border: #8cb6a2; --fptm-nav-border: #d7e0db; --fptm-nav-field: #f4f7f5; --fptm-surface: #e9efeb; --fptm-hover: #e9efeb; }
        ` });
        await page.addScriptTag({ path: path.join(root, 'content/ui/popup_components.js') });
        await page.evaluate(() => {
            window.qaReleaseLots = null;
            window.fptPopupActions = {
                async run(_pageId, actionId, payload = {}) {
                    if (actionId === 'getSettings') return {};
                    if (actionId === 'fp-load-delivery-lots-btn') {
                        payload.onProgress?.({ stage: 'lots', current: 0, total: 40 });
                        return new Promise(resolve => { window.qaReleaseLots = () => resolve({
                            lots: [{ id: '501', title: 'Аккаунт Premium', nodeId: '42', categoryName: 'Аккаунты' }],
                            config: {}, stockCounts: {}, stockErrors: []
                        }); });
                    }
                    return { success: true };
                }
            };
        });
        await page.addScriptTag({ path: path.join(root, 'content/ui/auto_delivery_page.js') });
        await page.evaluate(() => window.FPTAutoDeliveryPage.mount(document.querySelector('.fp-tools-popup')));
        await page.emulateMedia({ reducedMotion: 'reduce' });
        // An active page without a cached list starts loading on its own.
        assert.equal(await page.locator('#fp-load-delivery-lots-btn').getAttribute('aria-busy'), 'true');
        const skeleton = page.locator('.fpt-ad-skeleton-list');
        await skeleton.waitFor();
        assert.equal(await skeleton.getAttribute('aria-hidden'), 'true');
        assert.equal(await skeleton.locator('.fpt-ad-skeleton-row').count(), 4);
        assert.equal(await skeleton.locator('.fpt-ad-skeleton-block').first().evaluate(element => getComputedStyle(element).animationName), 'none',
            'skeleton shimmer should respect reduced-motion preferences');
        assert.equal(await page.locator('.fpt-ad-list-state--loading').count(), 0, 'loading should not be represented by a single spinner row');
        const layout = await skeleton.evaluate(element => ({
            width: element.clientWidth, scrollWidth: element.scrollWidth,
            rowWidths: Array.from(element.children, row => ({ width: row.clientWidth, scrollWidth: row.scrollWidth }))
        }));
        assert.ok(layout.scrollWidth <= layout.width + 1, `skeleton list should fit the narrow screen: ${JSON.stringify(layout)}`);
        assert.ok(layout.rowWidths.every(row => row.scrollWidth <= row.width + 1), `skeleton rows should fit the narrow screen: ${JSON.stringify(layout)}`);

        await page.evaluate(() => window.qaReleaseLots());
        await page.locator('.fpt-ad-lot-row[data-lot-id="501"]').waitFor();
        assert.equal(await skeleton.count(), 0, 'the skeleton should disappear once real lots render');
    } finally {
        await browser.close();
    }
});
