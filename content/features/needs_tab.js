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
        if (!text) throw new Error('Опишите нужные элементы.');
        const registry = fptNeedsRegistry().filter(entry => !entry.locked);
        const response = await chrome.runtime.sendMessage({ action: 'getAIProcessedText', text, myUsername: '',
            type: 'feature_match', context: JSON.stringify(registry.map(({ id, label, desc }) => ({ id, label, desc }))) });
        if (!response?.success) throw new Error(response?.error || 'Не удалось подобрать элементы.');
        const matches = JSON.parse(String(response.data).replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim());
        const allowed = new Set(registry.map(entry => entry.id));
        return matches.filter(match => allowed.has(match.id));
    });
    window.fptPopupActions.register('needs', 'fptNeedsAiConfirm', async p => {
        const allowed = new Set(fptNeedsRegistry().filter(entry => !entry.locked && !entry.contextOnly).map(entry => entry.id));
        const current = (await chrome.storage.local.get('fpToolsDisabledFeatures')).fpToolsDisabledFeatures || [];
        const selected = new Set((p.ids || []).filter(id => allowed.has(id)));
        const ids = Array.from(new Set(current)).filter(id => !selected.has(id));
        await chrome.storage.local.set({ fpToolsDisabledFeatures: ids });
        await window.fptApplyDisabledFeatures(ids);
        return ids;
    });
    window.fptPopupActions.register('needs', 'fptApplyNeedsSelection', async p => {
        const allowed = new Set(fptNeedsRegistry().filter(entry => !entry.locked).map(entry => entry.id));
        const current = (await chrome.storage.local.get('fpToolsDisabledFeatures')).fpToolsDisabledFeatures || [];
        const disabled = new Set(current);
        for (const [id, enabled] of Object.entries(p.enabled || {})) {
            if (!allowed.has(id)) continue;
            if (enabled) disabled.delete(id); else disabled.add(id);
        }
        const ids = Array.from(disabled);
        await chrome.storage.local.set({ fpToolsDisabledFeatures: ids });
        await window.fptApplyDisabledFeatures(ids);
        return ids;
    });
}
