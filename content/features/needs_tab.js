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
    // Writes the disabled list through the shared queue so quick consecutive toggles never overwrite each other.
    function fptNeedsWriteDisabled(change) {
        const known = new Set(fptNeedsRegistry().filter(entry => !entry.locked && !entry.control).map(entry => entry.id));
        return window.fptPopupActions.updateSettings(['fpToolsDisabledFeatures'], current => {
            const saved = Array.isArray(current.fpToolsDisabledFeatures) ? current.fpToolsDisabledFeatures : [];
            const disabled = new Set(saved);
            change(disabled, known);
            return { fpToolsDisabledFeatures: Array.from(disabled) };
        }, async next => {
            if (typeof window.fptApplyDisabledFeatures === 'function') await window.fptApplyDisabledFeatures(next.fpToolsDisabledFeatures);
        }).then(next => next.fpToolsDisabledFeatures);
    }
    window.fptPopupActions.register('needs', 'fptApplyNeedsSelection', p => fptNeedsWriteDisabled((disabled, known) => {
        for (const [id, enabled] of Object.entries(p.enabled || {})) {
            if (!known.has(id)) continue;
            if (enabled) disabled.delete(id); else disabled.add(id);
        }
    }));
}
