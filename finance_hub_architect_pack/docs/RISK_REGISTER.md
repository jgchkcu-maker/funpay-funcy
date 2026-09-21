# Risk Register

| ID | Risk | Severity | Trigger | Mitigation task | Verification |
|---|---|---:|---|---|---|
| R01 | Finance DB wiped on failed refresh | Critical | network/parser/DB error after clear | T01 | failure injection |
| R02 | UI reports success after failure | Critical | swallowed error / ignored response | T02/T03 | result contract tests |
| R03 | Profit calculated from stale sales | High | refresh on Profit | T03 | orchestration test |
| R04 | Overview mixes sources with different freshness | High | partial refresh | T03/T08 | partial failure test |
| R05 | Order status applied to operations | High | status filter on Operations | T04 | filter tests |
| R06 | Potential period is misleading | Medium | historical selector on snapshot data | T05 | UI state test/manual |
| R07 | Day buckets differ by OS timezone | High | timestamps near 21:00 UTC | T06 | deterministic timezone tests |
| R08 | Currency mixing creates false monetary truth | High | currency=all with multi-currency data | T07 | mixed-currency fixtures |
| R09 | “Updated now” reflects render, not data | High | reopening tab | T08 | freshness tests |
| R10 | Duplicate event handlers | Medium | repeated popup open/init | T09 | repeated-init test |
| R11 | Export implementations diverge | Medium | CSV/JSON path differs from Export Studio | T10 | export equivalence review |
| R12 | Custom range timezone off-by-one | Medium | user date boundaries | T11 | MSK boundary tests |
| R13 | Previous-period divide-by-zero | Medium | previous KPI = 0 | T12 | zero-baseline fixtures |
| R14 | Fixes regress silently later | High | future edits | T13 | regression suite |
