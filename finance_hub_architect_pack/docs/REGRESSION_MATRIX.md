# Regression Matrix

| Scenario | Expected |
|---|---|
| Finance fetch fails before page 1 | Existing finance DB unchanged |
| Finance fetch fails on middle page | Existing finance DB unchanged |
| Full finance refresh succeeds | Entire new dataset committed atomically |
| Duplicate finance operation IDs | One durable record per ID |
| Failed sales refresh | Sales lastUpdate unchanged |
| Failed finance refresh | Finance lastUpdate unchanged |
| Failed refresh | UI receives failure |
| Profit refresh | Sales refresh runs first |
| Overview refresh | Sales + operations + inventory refreshed |
| Overview partial failure | No global success message |
| Sales status=closed | Closed sales filtered correctly |
| Operations status=complete | Complete operations filtered correctly |
| Order status on Operations | Impossible through UI/controller |
| Operation status on Sales | Impossible through UI/controller |
| Potential tab | Historical period selector hidden |
| MSK midnight boundary | Same day bucket everywhere |
| Multi-currency + currency=all | No guessed monetary total/chart |
| Profit missing cost | Unknown/null, never silently zero |
| Reopen Finance Hub repeatedly | No duplicated handlers |
| Failed refresh then reopen | Old valid data remains visible |
| Export missing cost/profit | `null` preserved |
