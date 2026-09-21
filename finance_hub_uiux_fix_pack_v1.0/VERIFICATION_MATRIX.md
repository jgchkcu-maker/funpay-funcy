# VERIFICATION_MATRIX.md

## Filter matrix

| Subtab | Period | Snapshot | Currency | Status | Category |
|---|---:|---:|---:|---|---:|
| Overview | yes | no | yes | order status | yes |
| Sales | yes | no | yes | order status | yes |
| Purchases | yes | no | yes | order status | yes |
| Profit | yes | no | yes | order status | yes |
| Potential | no | yes | yes | hidden | yes |
| Operations | yes | no | yes | operation status | hidden |

## Mandatory visual states

Test at least:
- light theme
- dark theme
- wide popup
- medium popup
- narrow popup
- 7d
- all time
- custom date range
- all currencies
- single currency
- no rows
- normal rows
- multiple categories
- Profit: no sales
- Profit: sales but zero cost coverage
- Profit: partial cost coverage
- Profit: full cost coverage
- Potential: finite stock 0
- Potential: finite stock > 0
- Potential: unknown stock
- Potential: unlimited stock

## Scroll policy

- one primary vertical scroll for the popup content
- horizontal table scroll only when real populated table content needs it
- no horizontal donut legend scroll
- no horizontal empty-table scroll

## Regression rule

Every focused task test plus all directly affected prior Finance tests must pass. T24 requires the full Finance suite.
