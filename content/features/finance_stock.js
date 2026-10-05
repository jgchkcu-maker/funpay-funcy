(function(root) {
            function getPotentialStockBreakdown(lots, currency) {
                const breakdown = {
                    totalActiveOffers: 0,
                    availableOffers: 0,
                    zeroStockOffers: 0,
                    unknownStockOffers: 0,
                    unlimitedStockOffers: 0
                };
                if (!Array.isArray(lots)) return breakdown;

                const targetCurrency = String(currency || '').toUpperCase();
                lots.forEach(lot => {
                    if (!lot || lot.active !== true) return;
                    if (targetCurrency && String(lot.currency || 'RUB').toUpperCase() !== targetCurrency) return;
                    breakdown.totalActiveOffers++;

                    if (lot.stockKind === 'finite' && typeof lot.stock === 'number' && Number.isFinite(lot.stock) && lot.stock >= 0) {
                        if (lot.stock === 0) breakdown.zeroStockOffers++;
                        else breakdown.availableOffers++;
                    } else if (lot.stockKind === 'unlimited') {
                        breakdown.unlimitedStockOffers++;
                    } else {
                        breakdown.unknownStockOffers++;
                    }
                });

                return breakdown;
            }


root.fptGetPotentialStockBreakdown = getPotentialStockBreakdown;
})(typeof window !== "undefined" ? window : this);
