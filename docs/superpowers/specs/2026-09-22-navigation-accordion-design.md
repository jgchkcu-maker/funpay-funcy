# Sidebar Accordion Navigation Design

## Goal

Replace the current contextual two-column popup navigation with an independent vertical accordion while preserving every existing page id, page click contract, page initializer, search index, restore behavior, and theme integration.

## Current cause

FPT_NAV_SECTIONS already contains the six intended sections and all 25 page ids. setupNavigationSections() currently creates five primary buttons plus a single contextual list and openSection() clicks the preferred child, so category activation also navigates. compactNav() and related CSS still assume a two-column grid. The runtime FPT_MENU_THEME_CSS has higher-specificity navigation rules that must be updated together with static CSS.

## Design

1. Keep FPT_NAV_SECTIONS as the only section/page mapping. Keep the existing flat li[data-page] elements in the popup source markup; do not clone or rename them.
2. Rewrite setupNavigationSections() to create six .fpt-nav-group sections. Each group contains a real .fpt-nav-group-toggle button with aria-expanded, aria-controls, section icon/title/chevron, and a .fpt-nav-group-collapse wrapper containing .fpt-nav-group-items. Move the matching existing page li nodes into the group list with appendChild.
3. Track expanded section ids independently. Persist them best-effort in chrome.storage.local under fpToolsNavExpandedSections; storage errors or missing values fall back to the active page section and core. A category toggle changes only expanded state; it never clicks a child. showSectionForPage(pageId) expands the owning section and is called from the existing page click handler and restore path.
4. Keep setupPopupNavigation() page behavior intact: active classes, content visibility, fpToolsLastPage, and all existing page initializers remain in the page click handler. Existing internal selectors such as .fp-tools-nav li[data-page="autobump"] a continue to resolve.
5. Adapt search to save the expanded-state snapshot at the first non-empty query, temporarily reveal only sections/items with matching labels, and restore the snapshot when cleared. Search feature indexing remains based on .fp-tools-page-content. Selecting a result clears the filter, reveals its section through the normal page path, scrolls to the feature, and highlights it.
6. Make the navigation a flex column with a fixed search area, independently scrolling .fpt-nav-scroll, and optional decorative cloud hidden from layout. Do not introduce an account footer in this change because no authoritative account-tier source exists and it is not required for accordion behavior.
7. Replace old contextual/grid CSS with scoped accordion styles in css/fpt_icons_theme.css and the corresponding runtime theme rules. Use existing theme variables, grid-template-rows: 0fr/1fr collapse animation, and reduced-motion overrides. Remove fpt-nav-wide behavior and make compactNav() a harmless compatibility no-op or remove its calls after checking all call sites.
8. Add an implemented Ctrl/Cmd+K handler only while the popup is present: focus #fptNavSearch, select its text, and prevent default. Do not add a hint without the handler.

## Invariants

- Exactly six sections exist: core, store, messages, finance, settings, more.
- Every existing page id appears exactly once and retains its original data-page value.
- Category toggles never call child .click().
- The active page's owning section is expanded after normal navigation and restore.
- global_chat remains a real existing li[data-page="global_chat"], so fptGcApplyVisibility() continues to work.
- Finance Hub's internal subtabs and all page initializers remain untouched.

## Verification

Update tests/t18_navigation_ia.test.js to assert schema/page coverage, six groups, no duplicate page nodes, existing-node movement, category-toggle behavior, active/restore expansion, search reveal/restore, global_chat, reduced-motion CSS, and the real shortcut handler. Run the navigation test, syntax checks, and the full available test suite. Inspect the final diff for unrelated files; browser rendering will be reported separately if the extension cannot be loaded in this environment.
