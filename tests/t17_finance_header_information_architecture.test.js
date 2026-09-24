const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const mainPopupSource = fs.readFileSync(
    path.join(ROOT, 'content', 'ui', 'main_popup.js'),
    'utf8'
).replace(/\r\n/g, '\n');
const cssSource = fs.readFileSync(
    path.join(ROOT, 'css', 'content_styles.css'),
    'utf8'
).replace(/\r\n/g, '\n');
const financeHubSource = fs.readFileSync(
    path.join(ROOT, 'content', 'features', 'finance_hub', 'filters.js'),
    'utf8'
).replace(/\r\n/g, '\n');

function getFinanceMarkup() {
    const financeStart = mainPopupSource.indexOf('<div class="fp-tools-page-content" data-page="finance_hub">');
    assert.ok(financeStart >= 0, 'Finance Hub page markup must exist');

    const nextPageStart = mainPopupSource.indexOf('<div class="fp-tools-page-content" data-page="piggy_banks">', financeStart);
    assert.ok(nextPageStart > financeStart, 'Finance Hub page must end before the next page');
    return mainPopupSource.slice(financeStart, nextPageStart);
}

function getRuleBody(source, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rule = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(rule, `CSS rule for ${selector} must exist`);
    return rule[1];
}

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function parseMarkup(markup) {
    const root = { tagName: '#root', attributes: {}, children: [], parent: null };
    const stack = [root];
    const tokens = markup.match(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g) || [];

    for (const token of tokens) {
        if (token.startsWith('<!--')) continue;

        if (token.startsWith('</')) {
            const closingTag = token.match(/^<\/([A-Za-z0-9:-]+)/);
            assert.ok(closingTag, `Invalid closing tag: ${token}`);
            assert.equal(stack[stack.length - 1].tagName, closingTag[1].toLowerCase(), `Unexpected closing tag: ${token}`);
            stack.pop();
            continue;
        }

        const openingTag = token.match(/^<([A-Za-z0-9:-]+)([\s\S]*?)>$/);
        assert.ok(openingTag, `Invalid opening tag: ${token}`);
        const tagName = openingTag[1].toLowerCase();
        const attributeSource = openingTag[2].replace(/\/\s*$/, '');
        const attributes = {};
        for (const match of attributeSource.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
            attributes[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
        }

        const node = { tagName, attributes, children: [], parent: stack[stack.length - 1] };
        stack[stack.length - 1].children.push(node);
        if (!VOID_ELEMENTS.has(tagName) && !/\/\s*>$/.test(token)) stack.push(node);
    }

    assert.equal(stack.length, 1, 'Finance markup must have balanced tags');
    return root;
}

function hasClass(node, className) {
    return String(node.attributes.class || '').split(/\s+/).includes(className);
}

function findDirectChild(node, predicate) {
    return node.children.find(predicate) || null;
}

function findDescendant(node, predicate) {
    for (const child of node.children) {
        if (predicate(child)) return child;
        const nested = findDescendant(child, predicate);
        if (nested) return nested;
    }
    return null;
}

function testFinanceInformationArchitecture() {
    const markup = getFinanceMarkup();
    const root = parseMarkup(markup);
    const financePage = findDirectChild(root, node => node.tagName === 'div' && node.attributes['data-page'] === 'finance_hub');
    assert.ok(financePage, 'Finance Hub page must exist in the parsed markup');

    const header = findDirectChild(financePage, node => hasClass(node, 'fpt-fin-header'));
    const subtabs = findDirectChild(financePage, node => hasClass(node, 'fpt-fin-subtabs-wrap'));
    const filterbar = findDirectChild(financePage, node => hasClass(node, 'fpt-fin-filterbar'));
    const firstPane = findDirectChild(financePage, node => hasClass(node, 'fpt-fin-tab-pane') && node.attributes['data-subtab'] === 'overview');
    assert.ok(header && subtabs && filterbar && firstPane, 'Finance header, subtabs, filterbar, and first pane must be direct page children');

    const pageOrder = [header, subtabs, filterbar, firstPane].map(node => financePage.children.indexOf(node));
    assert.ok(pageOrder[0] < pageOrder[1] && pageOrder[1] < pageOrder[2] && pageOrder[2] < pageOrder[3], 'Finance page order must be header → subtabs → filterbar → content');

    const actions = findDirectChild(header, node => hasClass(node, 'fpt-fin-header-actions'));
    assert.ok(actions, 'Header actions must be nested inside the Finance header');
    assert.equal(actions.children.length, 2, 'Header actions must contain exactly two controls');
    assert.ok(actions.children.every(node => node.tagName === 'button'), 'Header actions must contain buttons only');
    assert.deepEqual(
        actions.children.map(node => node.attributes.id).sort(),
        ['fptFinExportBtn', 'fptFinRefreshBtn'],
        'Header actions must contain only Refresh and Export'
    );
    assert.equal(findDescendant(actions, node => node.attributes.id === 'fptFinPeriodSelect'), null, 'Filters must not be nested in header actions');

    const periodWrap = findDirectChild(filterbar, node => hasClass(node, 'fpt-fin-period-wrap'));
    assert.ok(periodWrap, 'Filterbar must directly contain the period/filter wrapper');
    assert.ok(findDescendant(filterbar, node => node.attributes.id === 'fptFinPeriodSelect'), 'Period select must belong to the filterbar');
    assert.ok(findDescendant(filterbar, node => node.attributes.id === 'fptFinCustomRange'), 'Custom range must stay with the filter controls');
    assert.equal(findDescendant(header, node => node.attributes.id === 'fptFinPeriodSelect'), null, 'Period select must not remain in the header');
    for (const [control, id] of [
        ['period', 'fptFinPeriodSelect'],
        ['currency', 'fptFinCurrencySelect'],
        ['status', 'fptFinStatusSelect'],
        ['category', 'fptFinCategorySelect']
    ]) {
        const wrapper = findDescendant(filterbar, node => node.attributes['data-fin-control'] === control);
        assert.ok(wrapper, `${control} filter wrapper must be statically mounted`);
        assert.ok(findDescendant(wrapper, node => node.attributes.id === id), `${id} must live in its static wrapper`);
    }

    for (const id of [
        'fptFinPeriodSelect',
        'fptFinCustomRange',
        'fptFinCustomFrom',
        'fptFinCustomTo',
        'fptFinCustomApplyBtn',
        'fptFinCustomResetBtn',
        'fptFinCustomRangeError',
        'fptFinRefreshBtn',
        'fptFinExportBtn',
        'fptFinSubtabs',
        'fptFinLastUpdated',
        'fptFinLastUpdatedText'
    ]) {
        assert.ok(findDescendant(financePage, node => node.attributes.id === id), `${id} must be preserved`);
    }
}

function testOnlyMetricCardsUseTheKpiContract() {
    const markup = getFinanceMarkup();
    const kpiCards = markup.match(/<div class="[^"]*\bfpt-fin-card\b[^\"]*\bfpt-fin-kpi-card\b[^\"]*"[^>]*>/g) || [];
    assert.equal(kpiCards.length, 28, 'The six Finance metric groups should mark only their 28 KPI cards');
    assert.doesNotMatch(markup, /fpt-fin-col-(?:4|6|8|12)[^>]*>[\s\S]{0,120}fpt-fin-kpi-card/, 'Chart, table, and wide cards must not use the KPI class');
}

function testKpiCssContract() {
    const filterbarRule = getRuleBody(cssSource, '.fpt-fin-filterbar');
    assert.match(filterbarRule, /display:\s*block\s*;/, 'Filterbar must provide a full-width layout shell');
    assert.match(filterbarRule, /margin-bottom:\s*18px\s*;/, 'Filterbar must separate controls from content');

    const filterbarPeriodRule = getRuleBody(cssSource, '.fpt-fin-filterbar .fpt-fin-period-wrap');
    assert.match(filterbarPeriodRule, /display:\s*grid\s*;/, 'Filter controls must use the Finance grid');
    assert.match(filterbarPeriodRule, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)\s*;/, 'Desktop filters must align with the four KPI columns');
    assert.match(filterbarPeriodRule, /gap:\s*12px\s*;/, 'Filter grid gap must match the Finance card grid');
    assert.match(filterbarPeriodRule, /width:\s*100%\s*;/, 'Filter wrapper must span the Finance content width');
    assert.match(filterbarPeriodRule, /min-width:\s*0\s*;/, 'Filter wrapper must be allowed to shrink');

    const kpiRule = [...cssSource.matchAll(/\.fpt-fin-kpi-card\s*\{([\s\S]*?)\}/g)]
        .map(match => match[1])
        .find(body => /height:\s*100%\s*;/.test(body));
    assert.ok(kpiRule, 'Base KPI card rule must exist alongside responsive overrides');
    assert.match(kpiRule, /min-height:\s*[^;]+;/, 'KPI cards need a content-safe minimum height');
    assert.match(kpiRule, /height:\s*100%\s*;/, 'KPI cards must stretch to their grid row');
    assert.match(kpiRule, /display:\s*flex\s*;/, 'KPI cards must use flex layout');
    assert.match(kpiRule, /flex-direction:\s*column\s*;/, 'KPI cards must use a vertical flex layout');

    const gridColumnRule = cssSource.match(
        /\.fpt-fin-col-3,\s*\.fpt-fin-col-4,\s*\.fpt-fin-col-6,\s*\.fpt-fin-col-8,\s*\.fpt-fin-col-12\s*\{([\s\S]*?)\}/
    );
    assert.ok(gridColumnRule, 'Finance grid columns need a shared sizing rule');
    assert.match(gridColumnRule[1], /min-width:\s*0\s*;/, 'Finance grid columns must allow content to shrink');

    const cardHeightSelector = '.fpt-fin-grid > .fpt-fin-col-3 > .fpt-fin-card:only-child';
    const desktopCardStart = cssSource.indexOf(cardHeightSelector);
    const desktopCardEnd = cssSource.indexOf('\n}', desktopCardStart);
    const directCardRule = cssSource.slice(desktopCardStart, desktopCardEnd + 2);
    assert.ok(desktopCardStart >= 0 && desktopCardEnd > desktopCardStart, 'KPI grid columns need a direct card stretch rule');
    assert.match(directCardRule, /height:\s*100%\s*;/, 'Desktop KPI cards must stretch to their row');

    const subtitleRule = getRuleBody(cssSource, '.fpt-fin-kpi-card .fpt-fin-card-sub');
    assert.match(subtitleRule, /margin-top:\s*auto\s*;/, 'KPI footer should stay at the bottom of the card');
    assert.match(subtitleRule, /white-space:\s*normal\s*;/, 'KPI subtitles must be allowed to wrap');
    assert.match(subtitleRule, /overflow-wrap:\s*anywhere\s*;/, 'Long KPI subtitles must wrap inside the card');

    assert.match(
        cssSource,
        /@container\s*\(max-width:\s*480px\)[\s\S]*?\.fpt-fin-kpi-card\s*\{[\s\S]*?min-height:\s*auto\s*;/,
        'Mobile layout must reset the KPI minimum height'
    );

    const baseKpiRule = [...cssSource.matchAll(/\.fpt-fin-kpi-card\s*\{([\s\S]*?)\}/g)]
        .map(match => ({ index: match.index, body: match[1] }))
        .find(match => /min-height:\s*(?!auto\b)[^;]+;/.test(match.body) && /height:\s*100%\s*;/.test(match.body));
    const mobileKpiRule = [...cssSource.matchAll(/\.fpt-fin-kpi-card\s*\{([\s\S]*?)\}/g)]
        .map(match => ({ index: match.index, body: match[1] }))
        .find(match => /min-height:\s*auto\s*;/.test(match.body));
    assert.ok(baseKpiRule && mobileKpiRule && mobileKpiRule.index > baseKpiRule.index, 'Mobile KPI reset must follow the base KPI rule in the cascade');

    const baseCardRule = { index: desktopCardStart, body: directCardRule };
    const mobileContainerStart = cssSource.indexOf('@container (max-width: 480px)');
    const mobileCardStart = cssSource.indexOf(cardHeightSelector, mobileContainerStart);
    const mobileCardEnd = cssSource.indexOf('\n}', mobileCardStart);
    const mobileCardRule = {
        index: mobileCardStart,
        body: cssSource.slice(mobileCardStart, mobileCardEnd + 2)
    };
    assert.ok(baseCardRule && mobileCardRule && mobileCardRule.index > baseCardRule.index, 'Mobile card height reset must follow the base card rule in the cascade');
}

function testT15T16ContractsRemainPresent() {
    assert.match(
        cssSource,
        /\.fpt-fin-control-hidden\s*\{[\s\S]*?display:\s*none\s*!important\s*;/,
        'T16 visibility utility must remain available'
    );

    const financeSelectRule = cssSource.match(
        /\.fp-tools-popup select\.fpt-fin-period-select,\s*\.fp-tools-popup \.fpt-fin-period-select\s*\{([\s\S]*?)\}/
    );
    assert.ok(financeSelectRule, 'T15 Finance select isolation rule must remain available');
    assert.match(financeSelectRule[1], /width:\s*100%\s*!important/i, 'Finance selects must fill their T15 filter-grid column');
    assert.match(financeSelectRule[1], /margin:\s*0\s*!important/i, 'Finance selects must keep their T15 margin isolation');
    assert.match(financeSelectRule[1], /flex:\s*none\s*!important/i, 'Finance selects must remain sized by their filter-grid column');
    assert.doesNotMatch(financeSelectRule[1], /width:\s*auto\s*!important/i, 'Finance selects must not override their filter-grid width');

    assert.match(
        financeHubSource,
        /function\s+setFinanceControlVisible\s*\(/,
        'T16 contextual visibility helper must remain in the Finance Hub filters module'
    );
}

testFinanceInformationArchitecture();
testOnlyMetricCardsUseTheKpiContract();
testKpiCssContract();
testT15T16ContractsRemainPresent();
console.log('T17_FINANCE_HEADER_INFORMATION_ARCHITECTURE_PASS');
