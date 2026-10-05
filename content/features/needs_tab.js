function fptNeedsRegistry() {
    return (typeof FPT_FEATURE_REGISTRY !== 'undefined' && FPT_FEATURE_REGISTRY) ||
           (typeof window !== 'undefined' && window.FPT_FEATURE_REGISTRY) || [];
}

function fptNeedsNormalizeSearchText(value) {
    return String(value == null ? '' : value).toLowerCase().replace(/ё/g, 'е').trim();
}

function fptNeedsEntryMatches(entry, query) {
    if (!query) return true;
    const legacyLabels = Array.isArray(entry.legacyLabels) ? entry.legacyLabels : [];
    const legacyPageLabels = typeof FPT_NEEDS_LEGACY_PAGE_LABELS !== 'undefined'
        ? FPT_NEEDS_LEGACY_PAGE_LABELS
        : [];
    const searchable = [entry.label, entry.desc, entry.group, entry.subgroup, ...legacyLabels, ...legacyPageLabels]
        .filter(Boolean)
        .join(' ');
    return fptNeedsNormalizeSearchText(searchable).includes(query);
}

if (typeof window !== 'undefined' && window.fptPopupActions) {
    window.fptPopupActions.register('needs', 'getFeatureRegistry', () => fptNeedsRegistry());
    window.fptPopupActions.register('needs', 'fptNeedsAskBtn', async p => {
        const text = String(p.text || '').trim();
        if (!text) throw new Error('Опишите, что хотите скрыть.');
        const registry = fptNeedsRegistry().filter(entry => !entry.locked);
        const response = await chrome.runtime.sendMessage({ action: 'getAIProcessedText', text, myUsername: '',
            type: 'feature_match', context: JSON.stringify(registry.map(({ id, label, desc }) => ({ id, label, desc }))) });
        if (!response?.success) throw new Error(response?.error || 'Не удалось подобрать элементы.');
        let matches;
        try {
            matches = JSON.parse(String(response.data).replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim());
        } catch (_) {
            throw new Error('ИИ ответил в неожиданном формате. Переформулируйте запрос.');
        }
        const allowed = new Set(registry.map(entry => entry.id));
        return (Array.isArray(matches) ? matches : []).filter(match => match && allowed.has(match.id));
    });
    // Writes the disabled list through the shared queue so quick consecutive toggles never overwrite each other.
    function fptNeedsWriteDisabled(change) {
        const known = new Set(fptNeedsRegistry().filter(entry => !entry.locked).map(entry => entry.id));
        return window.fptPopupActions.updateSettings(['fpToolsDisabledFeatures'], current => {
            const saved = Array.isArray(current.fpToolsDisabledFeatures) ? current.fpToolsDisabledFeatures : [];
            const disabled = new Set(saved);
            change(disabled, known);
            return { fpToolsDisabledFeatures: Array.from(disabled) };
        }, async next => {
            if (typeof window.fptApplyDisabledFeatures === 'function') await window.fptApplyDisabledFeatures(next.fpToolsDisabledFeatures);
        }).then(next => next.fpToolsDisabledFeatures);
    }
    // AI suggestions are elements the seller wants to hide (see the feature_match prompt).
    window.fptPopupActions.register('needs', 'fptNeedsAiConfirm', p => fptNeedsWriteDisabled((disabled, known) => {
        for (const id of p.ids || []) if (known.has(id)) disabled.add(id);
    }));
    window.fptPopupActions.register('needs', 'fptApplyNeedsSelection', p => fptNeedsWriteDisabled((disabled, known) => {
        for (const [id, enabled] of Object.entries(p.enabled || {})) {
            if (!known.has(id)) continue;
            if (enabled) disabled.delete(id); else disabled.add(id);
        }
    }));
}
