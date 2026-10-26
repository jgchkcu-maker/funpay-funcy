import { runAutoResponderCycle } from './autoresponder.js';
export const ENGINE_HEARTBEAT_ALARM = 'fpToolsEngineHeartbeat';
export const ENGINE_CONTINUE_ALARM = 'fpToolsEngineContinue';
let work = async () => {};
let flight = null;
let requested = false;
export function configureEngine({ runDue }) { work = runDue; }
export function randomTag() { return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0'); }
export async function anyAutomationEnabled() {
    const { fpToolsAutoReplies: s = {} } = await chrome.storage.local.get('fpToolsAutoReplies');
    return ['greetingEnabled', 'keywordsEnabled', 'autoReviewEnabled', 'bonusForReviewEnabled',
        'newOrderReplyEnabled', 'orderConfirmReplyEnabled', 'autoDeliveryEnabled', 'reviewReminderEnabled'].some(k => s[k]);
}
// One pass at a time. Coalesce signals received during work, with a bounded drain.
export function runAutomationPass() {
    requested = true;
    if (flight) return flight;
    flight = (async () => {
        for (let i = 0; requested && i < 2; i++) {
            requested = false;
            if (!(await anyAutomationEnabled())) return;
            await runAutoResponderCycle();
            await work();
        }
    })().finally(async () => {
        flight = null;
        if (requested && await anyAutomationEnabled()) {
            const existing = await chrome.alarms.get(ENGINE_CONTINUE_ALARM);
            if (!existing) await chrome.alarms.create(ENGINE_CONTINUE_ALARM, { when: Date.now() + 3000 });
        }
    });
    return flight;
}
export async function startEngine() {
    if (!(await anyAutomationEnabled())) return stopEngine();
    const alarm = await chrome.alarms.get(ENGINE_HEARTBEAT_ALARM);
    if (alarm?.periodInMinutes !== 0.5) await chrome.alarms.create(ENGINE_HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
    return runAutomationPass();
}
export async function stopEngine() {
    requested = false;
    await chrome.alarms.clear(ENGINE_HEARTBEAT_ALARM);
    await chrome.alarms.clear(ENGINE_CONTINUE_ALARM);
}
export async function onHeartbeat() {
    if (await anyAutomationEnabled()) return runAutomationPass();
    return stopEngine();
}
