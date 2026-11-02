const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function sliceFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} must exist`);
    const end = source.slice(start).search(/\r?\n\}\r?\n/);
    assert.ok(end > 0, `${name} must end with a closing brace line`);
    return source.slice(start, start + end).concat('\n}\n');
}

test('order page copy divides the order total by quantity', () => {
    const { unitPriceFromOrderTotal } = require('../content/features/order_lot_copy.js');
    assert.equal(unitPriceFromOrderTotal('200', 2), '100');
    assert.equal(unitPriceFromOrderTotal('100', 3), '33.333333');
    assert.equal(unitPriceFromOrderTotal('5.88', 1), '5.88');
    assert.equal(unitPriceFromOrderTotal('5.88', NaN), '5.88');
    assert.equal(unitPriceFromOrderTotal('', 2), '');
});

test('clone and import use the recalculated seller price before the raw buyer price', () => {
    const source = read('content/features/lot_cloning.js');
    const context = {};
    vm.runInNewContext(`${sliceFunction(source, 'formatClonePrice')}\n${sliceFunction(source, 'cloneSourcePrice')}\nthis.pick = cloneSourcePrice;`, context);
    assert.equal(context.pick({ rawPrice: '835.70', finalPrice: 785.6004 }), '785.6');
    assert.equal(context.pick({ rawPrice: '120', finalPrice: null }), '120');
    assert.equal(context.pick({ rawPrice: '0.4' }), '1');
    assert.equal(context.pick({}), '');

    assert.doesNotMatch(source, /priceInp\.value = src\.rawPrice/, 'import must not paste the raw buyer price');
    assert.match(source, /const priceStr = cloneSourcePrice\(src\);/);
});

test('public lot parser reads the data-factors currency from data-cy', () => {
    const source = read('offscreen/offscreen.js');
    assert.match(source, /factorsCurrency = \(opt\.getAttribute\('data-cy'\)/);
    assert.match(source, /priceFromFactors \? \(factorsCurrency \|\| 'rub'\)/);
    assert.doesNotMatch(source, /priceFromFactors \? 'rub' : ''/);
});

test('cloneGetSource computes finalPrice even when the category form fails to build', () => {
    const source = read('background/background.js');
    const start = source.indexOf("request.action === 'cloneGetSource'");
    const block = source.slice(start, source.indexOf("request.action === 'cloneBuildFields'", start));
    const formTry = block.indexOf('fields = await cloneBuildFieldsInternal');
    const formCatch = block.indexOf('formError = e.message', formTry);
    const priceCalc = block.indexOf('cloneCalcNetPrice(auth, source.nodeId');
    assert.ok(formTry > 0 && formCatch > formTry, 'form build block must exist');
    assert.ok(priceCalc > formCatch, 'price calculation must run after (outside) the form build try/catch');
});
