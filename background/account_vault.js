/*
 * FunPay Funcy — закрытое хранилище аккаунтов (IndexedDB `fpt-accounts-db`).
 *
 * Здесь лежит то, что не должно попадать в chrome.storage.local, откуда его читают
 * content-скрипты на страницах FunPay:
 *   secret:<id>       — { key, keyHash } — ключ сессии сохранённого аккаунта;
 *   profile:<userId>  — { values, savedAt } — конфиг неактивного аккаунта;
 *   meta:<name>       — служебные значения (копия для отмены синхронизации).
 *
 * База открывается только в service worker расширения, страницы FunPay к ней доступа не имеют.
 * Модуль не обращается к indexedDB напрямую: бэкенд передаётся снаружи, в node-тестах
 * используется createMemoryVaultBackend().
 */

export const ACCOUNTS_DB_NAME = 'fpt-accounts-db';
const ACCOUNTS_DB_VERSION = 1;
const STORE = 'kv';

const clone = value => (value === undefined ? undefined : structuredClone(value));

export function createMemoryVaultBackend() {
    const data = new Map();
    return {
        async get(key) { return clone(data.get(key)); },
        async put(key, value) { data.set(key, clone(value)); },
        async delete(key) { data.delete(key); },
        dump: () => new Map(data)
    };
}

export function createIndexedDbVaultBackend(idb, dbName = ACCOUNTS_DB_NAME) {
    if (!idb?.open) throw new Error('IndexedDB недоступна.');
    let opening = null;
    const request = req => new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    function open() {
        if (!opening) {
            opening = new Promise((resolve, reject) => {
                const req = idb.open(dbName, ACCOUNTS_DB_VERSION);
                req.onupgradeneeded = () => {
                    if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
                };
                req.onsuccess = () => {
                    const db = req.result;
                    db.onversionchange = () => { db.close(); opening = null; };
                    resolve(db);
                };
                req.onerror = () => { opening = null; reject(req.error); };
            });
        }
        return opening;
    }
    async function run(mode, fn) {
        const db = await open();
        const tx = db.transaction(STORE, mode);
        const done = new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Транзакция прервана.'));
        });
        const result = await request(fn(tx.objectStore(STORE)));
        await done;
        return result;
    }
    return {
        get: key => run('readonly', store => store.get(key)),
        put: (key, value) => run('readwrite', store => store.put(value, key)).then(() => {}),
        delete: key => run('readwrite', store => store.delete(key)).then(() => {})
    };
}

export function createAccountVault(backend) {
    if (!backend?.get || !backend?.put || !backend?.delete) throw new Error('Хранилище аккаунтов не настроено.');
    const id = value => {
        const text = String(value ?? '').trim();
        if (!text) throw new Error('Пустой идентификатор аккаунта.');
        return text;
    };
    return Object.freeze({
        getSecret: accountId => backend.get(`secret:${id(accountId)}`),
        putSecret: (accountId, secret) => backend.put(`secret:${id(accountId)}`, { key: String(secret.key), keyHash: String(secret.keyHash || '') }),
        deleteSecret: accountId => backend.delete(`secret:${id(accountId)}`),
        getProfile: userId => backend.get(`profile:${id(userId)}`),
        putProfile: (userId, profile) => backend.put(`profile:${id(userId)}`, profile),
        getMeta: name => backend.get(`meta:${id(name)}`),
        putMeta: (name, value) => backend.put(`meta:${id(name)}`, value),
        deleteMeta: name => backend.delete(`meta:${id(name)}`)
    });
}
