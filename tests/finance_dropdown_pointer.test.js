const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'content_styles.css'), 'utf8');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('every Finance dropdown row remains the mouse target while hovered', async t => {
    if (!fs.existsSync(edge)) return t.skip('Microsoft Edge is not installed');

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fpt-fin-select-'));
    const browser = spawn(edge, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,800',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
    ], { stdio: 'ignore' });

    let socket;
    t.after(async () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ id: ++nextId, method: 'Browser.close' }));
        }
        browser.kill();
        await delay(300);
        if (profile.startsWith(path.join(os.tmpdir(), 'fpt-fin-select-'))) {
            fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        }
    });

    let port;
    for (let i = 0; i < 100; i++) {
        const portFile = path.join(profile, 'DevToolsActivePort');
        if (fs.existsSync(portFile)) {
            port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
            break;
        }
        if (browser.exitCode !== null) break;
        await delay(50);
    }
    assert.ok(port, 'headless Edge must start with a debugging port');

    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = pages.find(item => item.type === 'page');
    assert.ok(page, 'headless Edge must provide a page');

    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });

    let nextId = 0;
    const pending = new Map();
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (!message.id || !pending.has(message.id)) return;
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
        return result.result.value;
    };

    await evaluate(`(() => {
        const style = document.createElement('style');
        style.textContent = ${JSON.stringify(css)};
        document.head.appendChild(style);
        document.body.innerHTML = '<div class="fp-tools-popup active">' +
            '<div class="fpt-fin-filterbar"><div class="fpt-fin-period-wrap">' +
            '<div class="fpt-fin-select-shell is-open" style="width:256px;">' +
            '<button class="fpt-fin-select-trigger">Все статусы</button>' +
            '<div class="fpt-fin-select-dropdown"><div class="fpt-fin-select-list">' +
            ['Все статусы', 'Закрытые', 'Оплаченные', 'Возвраты']
                .map((label, index) => '<button class="fpt-fin-select-option" data-index="' + index + '">' + label + '</button>')
                .join('') +
            '</div></div></div></div></div></div>';
        window.clickedOptions = [];
        document.querySelector('.fpt-fin-select-list').addEventListener('click', event => {
            window.clickedOptions.push(event.target.closest('.fpt-fin-select-option')?.dataset.index ?? null);
        });
    })()`);

    await delay(500);
    const centers = await evaluate(`Array.from(document.querySelectorAll('.fpt-fin-select-option'), item => {
        const rect = item.getBoundingClientRect();
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
    })`);

    for (let index = 0; index < centers.length; index++) {
        const { x, y } = centers[index];
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await delay(100);
        const target = await evaluate(`document.elementFromPoint(${x}, ${y})?.closest('.fpt-fin-select-option')?.dataset.index ?? null`);
        const hit = await evaluate(`(() => { const el = document.elementFromPoint(${x}, ${y}); return { element: el?.outerHTML.slice(0, 200), point: [${x}, ${y}], viewport: [innerWidth, innerHeight] }; })()`);
        assert.equal(target, String(index), `hovering option ${index} must not cover another row: ${JSON.stringify(hit)}`);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
        const clicked = await evaluate('window.clickedOptions.at(-1)');
        assert.equal(clicked, String(index), `clicking option ${index} must select it`);
    }
});
