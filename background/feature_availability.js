// Release policy shared by the worker and classic content scripts.
// Keep dormant implementations and saved data; restoring a service also requires
// restoring its host permission in manifest.json. Storage cannot override this policy.
(function (root) {
    'use strict';
    const features = Object.freeze({ ai: false, rmthub: false, profileDescriptions: false });
    const elements = Object.freeze({
        chat_ai_rewrite_btn: 'ai', profanity_warning: 'ai',
        lot_ai_gen_btn: 'ai', rmthub_seller_search: 'rmthub'
    });
    const actions = Object.freeze({
        getAIProcessedText: 'ai', generateAILot: 'ai',
        getAIImageSettings: 'ai', rmthubFetch: 'rmthub'
    });
    const isAvailable = feature => features[feature] === true;
    const isElementAvailable = id => !Object.hasOwn(elements, id) || isAvailable(elements[id]);
    function unavailableResponse(action) {
        if (!Object.hasOwn(actions, action) || isAvailable(actions[action])) return null;
        return {
            ...(action === 'rmthubFetch' ? { ok: false } : { success: false }),
            code: 'FEATURE_UNAVAILABLE', error: 'Функция временно недоступна.'
        };
    }
    root.FPTFeatureAvailability = Object.freeze({ ...features, isAvailable, isElementAvailable, unavailableResponse });
})(globalThis);
