# Architecture Notes

## Current components

- `background/background.js` — remote collection/update orchestration.
- `background/finance_db.js` — financial operations IndexedDB owner.
- `background/sales_db.js` — sales persistence.
- `background/purchases_db.js` — purchases persistence.
- `content/finance_db.js` — content-script bridge to finance operations.
- `content/features/finance_data.js` — filtering and aggregation adapter.
- `content/features/profit_engine.js` — realised profit derived from sales + cost basis.
- `content/features/finance_potential.js` — current inventory potential.
- `content/features/finance_hub.js` — Finance Hub controller/rendering/orchestration.
- `content/features/export_studio.js` — richer export engine.
- `content/ui/main_popup.js` — popup navigation/mounting.
- `tests/t11_hardening.test.js` — existing hardening coverage.

## Desired responsibility boundaries

### Background update layer
Owns:
- fetching,
- pagination,
- retry policy,
- durable commit,
- success/error result,
- source freshness metadata.

Must not:
- report success after partial failure,
- destroy old data before replacement is ready.

### Data adapter
Owns:
- period filtering,
- status filtering,
- currency filtering,
- aggregation primitives.

Must not:
- silently convert currencies with guessed rates.

### Domain engines
`FPTProfitEngine` and `FPTPotential` own their domain calculations.

### Finance Hub
Owns:
- active tab,
- user filters,
- refresh orchestration,
- view cache,
- rendering,
- visible freshness state.

Must not:
- invent data semantics,
- own durable truth,
- duplicate export engines.

## Non-functional invariants

1. **Data preservation over freshness.**
2. **Failure must be visible.**
3. **Derived data freshness cannot exceed source freshness.**
4. **No cross-currency arithmetic without an explicit conversion source.**
5. **Same timestamp → same MSK day everywhere.**
6. **Repeated mount/open must be idempotent.**
