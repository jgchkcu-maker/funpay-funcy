# Navigation tree verification — 2026-09-24

## Scope and limits

This handoff records the automated checks for the seller navigation redesign and the manual checks that could not be run. The live popup was unavailable: CUA reported `apps: []` and `browsers: []`, so there was no browser tab or extension window to click through, capture, or inspect. The scenarios below are **not** marked as manually passed. No seller tree test was run, so discoverability improvement is not a measured result.

## Route and structure audit

- The final navigation contains 22 pages in six groups—Sales, Customers, Finance, Interface, Settings, and Help—and two footer actions (`notes`, `support`): 24 canonical routes total. T18 and menu-reference contracts check the exact group order and page sets.
- All 25 previous page IDs were mapped:

| Previous page ID | Current route |
| --- | --- |
| `general` | `general` — Settings / Отображение FunPay |
| `accounts` | `accounts` — Settings |
| `needs` | `needs` — Interface / Элементы интерфейса |
| `slash_commands` | Alias to `templates`, mode `commands` |
| `telegram` | `telegram` — Settings / Уведомления и интеграции |
| `epic_nicks` | `epic_nicks` — Interface |
| `theme` | `theme` — Interface / Темы |
| `effects` | `effects` — Interface |
| `global_chat` | `global_chat` — Help; remote display flag still controls visibility |
| `templates` | `templates` — Customers / Быстрые ответы |
| `auto_review` | `auto_review` — Customers / Отзывы и бонусы |
| `auto_delivery` | `auto_delivery` — Sales |
| `lot_io` | `lot_io` — Sales; initial route |
| `autobump` | `autobump` — Sales |
| `ai_audit` | `ai_audit` — Sales / Аудит магазина |
| `blacklist` | `blacklist` — Customers |
| `finance_hub` | `finance_hub` — Finance |
| `piggy_banks` | `piggy_banks` — Finance |
| `calculator` | `calculator` — Finance / Калькуляторы |
| `currency_calc` | Alias to `calculator`, mode `currency` |
| `notes` | `notes` — footer action |
| `overview` | `overview` — Help / Справочник функций |
| `settings_io` | `settings_io` — Settings / Перенос настроек |
| `tickets` | `tickets` — Help / Поддержка FunPay |
| `support` | `support` — footer action / Оценить расширение |

The new canonical `auto_reply` page separates greeting, order-stage, and keyword responders from reviews and bonuses; it does not replace or invalidate the prior `auto_review` route. The two compatibility aliases are `slash_commands` and `currency_calc`.

The popup template audit found 24 navigation `data-page` entries. Its 377 static `id` attributes were unique (zero duplicate IDs). This is a source-template check; a live rendered DOM audit was unavailable.

Compatibility coverage passed in `navigation_routes`, `quick_replies_navigation`, `settings_page_recomposition`, `branding_compatibility`, `auto_reply_storage`, and `T18`. These cover canonical route persistence, the two legacy routes, unknown route/mode fallback, Finance Hub mode persistence, and the separate `fpToolsNavCollapsed` / `fpToolsNavExpandedSectionsV2` contracts. An additional runtime harness imported a version-1 `.fpconfig` fixture (`LEGACY_FPCONFIG_IMPORT_PASS`), preserved accent/disabled-feature/autoreply settings, and excluded account credentials and per-window last-page state. Search coverage also confirms that hiding `global_chat` removes its menu and page-heading records and clears stale results.

## Seller scenarios

Automated checks passed, but none of these were exercised against a real FunPay account or live popup in this run.

| Seller task | Expected route in the new tree | Automated evidence | Live popup result |
| --- | --- | --- | --- |
| Set an automatic reply after payment | Customers → Автоответчик (`auto_reply`) | `auto_reply_pages`, `auto_reply_storage`, and `navigation_routes` passed; these exercise page separation, settings storage, and route persistence. | **Blocked** — no browser or popup available. |
| Configure the `/привет` command | Customers → Быстрые ответы → Команды (`templates`, mode `commands`) | `quick_replies_navigation` passed; it checks the `slash_commands` alias, canonical mode persistence, and `/привет` trigger data. | **Blocked** — no browser or popup available. |
| Find and use the currency converter | Finance → Калькуляторы → Валюты (`calculator`, mode `currency`) | `settings_page_recomposition`, `finance_currency`, and `navigation_search_routes` passed; the legacy route and search result activate currency mode. | **Blocked** — no browser or popup available. |
| Open a FunPay support ticket | Help → Поддержка FunPay (`tickets`) | `navigation_search_routes` passed; searching «Поддержка» resolves to `tickets`, separately from the `support` rating action. | **Blocked** — no browser or popup available. |
| Hide the AI rewrite button in chat | Interface → Элементы интерфейса → Чат → Поле ввода (`needs`, `chat_ai_rewrite_btn`) | `needs_registry_taxonomy` and `needs_group_render_search` passed; the selector mapping and persisted disabled state are covered. | **Blocked** — no browser or popup available. |

The blocked manual matrix includes expanded and compact navigation, light and dark themes, keyboard focus/activation, and reduced-motion behavior. No screenshots were produced. Automated source and behavior tests passed but do not establish visual correctness or task completion time.

## Integrated verification

- `Get-ChildItem tests -Filter *.test.js` followed by `node` for each file — **47 passed, 0 failed**.
- `node --check` for all **22 changed JavaScript files** — passed.
- Focused navigation gates: `navigation_search_routes`, `navigation_routes`, `t18_navigation_ia`, and `menu_reference_contract` — passed.
- `git diff --check` — exit 0; Git emitted only LF-to-CRLF autocrlf advisories for modified files.
- Independent Luna Max reviews cleared A7 and A8. A8 review found and fixed stale-result activation via Enter during debounce or clear fade; new regression tests cover both cases.

No measured improvement in discoverability is claimed without a tree test with sellers. No commit was made because shared files contain mixed task changes and pre-existing user edits.
