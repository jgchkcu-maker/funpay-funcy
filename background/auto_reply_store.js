const AUTO_REPLY_STORAGE_KEY = 'fpToolsAutoReplies';
const AUTO_REPLY_MAP_FIELDS = new Set(['reviewTemplates', 'reviewTemplateImages']);
const AUTO_REPLY_RUNTIME_FIELDS = new Set([
    'processedMessageIds',
    'lastSeenMsgIds',
    'lastHandledText',
    'autoResponderSeeded',
    'greetedUsers',
    'greetedTimestamps',
    'repliedOrderIds',
    'repliedNewOrders',
    'repliedConfirmedOrders',
    'deliveredOrderIds'
]);

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sameValue(left, right) {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
            left.every((value, index) => sameValue(value, right[index]));
    }
    if (!isRecord(left) || !isRecord(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
        key === rightKeys[index] && sameValue(left[key], right[key]));
}

function staleEditError(field, index) {
    const error = new Error(`The ${field} list changed. Reload it before saving this edit.`);
    error.name = 'StaleAutoReplyEditError';
    error.code = 'STALE_AUTO_REPLY_EDIT';
    error.field = field;
    error.index = index;
    return error;
}

function applyArrayOperations(target, arrayOps) {
    if (!isRecord(arrayOps)) throw new TypeError('arrayOps must be an object of list operations.');

    for (const [field, operations] of Object.entries(arrayOps)) {
        const ops = Array.isArray(operations) ? operations : [operations];
        const values = Array.isArray(target[field]) ? target[field] : [];

        for (const operation of ops) {
            if (!isRecord(operation)) throw new TypeError(`Invalid operation for ${field}.`);
            if (operation.op === 'append') {
                values.push(clone(operation.value));
                continue;
            }

            if ((operation.op !== 'upsert' && operation.op !== 'remove') ||
                !Number.isInteger(operation.index) || operation.index < 0 ||
                !Object.prototype.hasOwnProperty.call(operation, 'expected') ||
                operation.index >= values.length || !sameValue(values[operation.index], operation.expected)) {
                throw staleEditError(field, operation.index);
            }

            if (operation.op === 'upsert') values[operation.index] = clone(operation.value);
            else values.splice(operation.index, 1);
        }

        target[field] = values;
    }
}

function applyPatch(target, patch = {}) {
    if (!isRecord(patch)) throw new TypeError('Auto-reply patch must be an object.');

    if (patch.set !== undefined) {
        if (!isRecord(patch.set)) throw new TypeError('set must be an object of field values.');
        for (const [field, value] of Object.entries(patch.set)) target[field] = clone(value);
    }

    if (patch.merge !== undefined) {
        if (!isRecord(patch.merge)) throw new TypeError('merge must be an object of nested maps.');
        for (const [field, values] of Object.entries(patch.merge)) {
            if (!isRecord(values)) throw new TypeError(`merge.${field} must be an object.`);
            const current = isRecord(target[field]) ? target[field] : {};
            target[field] = { ...current, ...clone(values) };
        }
    }

    if (patch.arrayOps !== undefined) applyArrayOperations(target, patch.arrayOps);

    if (patch.unset !== undefined) {
        if (Array.isArray(patch.unset)) {
            for (const field of patch.unset) delete target[field];
        } else {
            if (!isRecord(patch.unset)) throw new TypeError('unset must be an object or an array of fields.');
            const fields = Array.isArray(patch.unset.fields) ? patch.unset.fields :
                (typeof patch.unset.fields === 'string' ? [patch.unset.fields] : []);
            for (const field of fields) delete target[field];

            for (const [field, keys] of Object.entries(patch.unset)) {
                if (field === 'fields' || !Array.isArray(keys) || !isRecord(target[field])) continue;
                for (const key of keys) delete target[field][key];
            }
        }
    }

    return target;
}

export function createAutoReplyStore(storage) {
    if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
        throw new TypeError('A chrome.storage.local compatible store is required.');
    }

    let queue = Promise.resolve();

    function serialize(operation) {
        const result = queue.then(operation);
        queue = result.catch(() => undefined);
        return result;
    }

    async function readCurrent() {
        const stored = await storage.get(AUTO_REPLY_STORAGE_KEY);
        const current = stored && stored[AUTO_REPLY_STORAGE_KEY];
        return isRecord(current) ? clone(current) : {};
    }

    async function updateInsideQueue(mutator) {
        if (typeof mutator !== 'function') throw new TypeError('updateAutoReplies expects a mutator function.');
        const next = await readCurrent();
        await mutator(next);
        await storage.set({ [AUTO_REPLY_STORAGE_KEY]: next });
        return clone(next);
    }

    async function patchInsideQueue(patch) {
        const next = await readCurrent();
        applyPatch(next, patch);
        await storage.set({ [AUTO_REPLY_STORAGE_KEY]: next });
        return clone(next);
    }

    return {
        updateAutoReplies(mutator) {
            return serialize(() => updateInsideQueue(mutator));
        },
        patchAutoReplies(patch) {
            return serialize(() => patchInsideQueue(patch));
        },
        importAutoReplies(imported) {
            return serialize(async () => {
                if (!isRecord(imported)) throw new TypeError('Imported auto-reply settings must be an object.');

                const patch = { set: {}, merge: {} };
                for (const [field, value] of Object.entries(imported)) {
                    if (AUTO_REPLY_RUNTIME_FIELDS.has(field)) continue;
                    if (AUTO_REPLY_MAP_FIELDS.has(field) && isRecord(value)) patch.merge[field] = value;
                    else patch.set[field] = value;
                }

                return patchInsideQueue(patch);
            });
        }
    };
}

let defaultAutoReplyStore;

function getDefaultAutoReplyStore() {
    if (!defaultAutoReplyStore) {
        const storage = globalThis.chrome?.storage?.local;
        if (!storage) throw new Error('chrome.storage.local is unavailable.');
        defaultAutoReplyStore = createAutoReplyStore(storage);
    }
    return defaultAutoReplyStore;
}

export function updateAutoReplies(mutator) {
    return getDefaultAutoReplyStore().updateAutoReplies(mutator);
}

export function patchAutoReplies(patch) {
    return getDefaultAutoReplyStore().patchAutoReplies(patch);
}

export function importAutoReplies(imported) {
    return getDefaultAutoReplyStore().importAutoReplies(imported);
}
