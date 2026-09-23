function fptSendAutoReplyStoreMessage(action, value) {
    return chrome.runtime.sendMessage({ action, ...value }).then(response => {
        if (!response || response.ok !== true) {
            const error = new Error(response?.error || 'Не удалось сохранить настройки автоответчика.');
            if (response?.code) error.code = response.code;
            throw error;
        }
        return response.autoReplies || {};
    });
}

window.fptPatchAutoReplies = function fptPatchAutoReplies(patch) {
    return fptSendAutoReplyStoreMessage('fptPatchAutoReplies', { patch });
};

window.fptImportAutoReplies = function fptImportAutoReplies(settings) {
    return fptSendAutoReplyStoreMessage('fptImportAutoReplies', { settings });
};
