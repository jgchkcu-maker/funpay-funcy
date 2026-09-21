# T01 — Atomic finance operations refresh

> Read `../AGENT_CONTRACT.md` before executing this task.

## Problem
Finance operations refresh currently clears durable data before the replacement dataset is completely fetched. A failure can destroy the user's previously valid history.

## Primary files
- `background/background.js`
- `background/finance_db.js`

## Required design
Add a safe full-replacement primitive, preferably:

`FPTFinanceDB.replaceAll(txns, metadata)`

Inside one IndexedDB read-write transaction:
1. clear operations;
2. put the complete new dataset;
3. update DB metadata;
4. commit.

The old DB must remain untouched until all remote pages are fetched, deduplicated, and validated.

## Update-cycle behavior
`runFinanceUpdateCycle()` must:
1. fetch all pages into memory/staging;
2. deduplicate by real operation ID;
3. validate the collected result;
4. call atomic replacement only after full success;
5. update count and freshness only after durable commit.

## Failure invariant
On network, parser, pagination, or DB error:
- previous operations remain intact;
- previous count remains intact;
- previous lastUpdate remains intact;
- caller receives a failure.

## Forbidden
- `clearAll()` before remote collection completes.
- catch/log/continue-to-success behavior.

## Required regression cases
A. Existing 500 rows, page 1 fails → still 500.  
B. Existing 500 rows, page 7 fails → still 500.  
C. Full success returns 720 rows → DB becomes exactly 720.  
D. Duplicate IDs → one record per ID.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
