const assert = require('assert');
const path = require('path');

let calculateTemplatePopoverLayout;
try {
  ({ calculateTemplatePopoverLayout } = require(path.join('..', 'content', 'features', 'template_popover_layout.js')));
} catch (_) {
  // Intentionally leave undefined so the first assertion fails until the layout helper exists.
}

assert.strictEqual(
  typeof calculateTemplatePopoverLayout,
  'function',
  'calculateTemplatePopoverLayout must be implemented'
);

const rect = (left, top, width, height) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height
});

{
  const layout = calculateTemplatePopoverLayout({
    triggerRect: rect(300, 500, 36, 36),
    popoverWidth: 320,
    popoverHeight: 300,
    viewportWidth: 1000,
    viewportHeight: 800,
    margin: 10,
    gap: 10
  });

  assert.strictEqual(layout.placement, 'top');
  assert.strictEqual(layout.bottom, 310);
  assert.strictEqual(layout.top, null);
  assert.strictEqual(layout.maxHeight, 480);
}

{
  const compact = calculateTemplatePopoverLayout({
    triggerRect: rect(250, 420, 36, 36),
    popoverWidth: 320,
    popoverHeight: 220,
    viewportWidth: 900,
    viewportHeight: 600,
    margin: 10,
    gap: 10
  });
  const expanded = calculateTemplatePopoverLayout({
    triggerRect: rect(250, 420, 36, 36),
    popoverWidth: 320,
    popoverHeight: 390,
    viewportWidth: 900,
    viewportHeight: 600,
    margin: 10,
    gap: 10
  });

  assert.strictEqual(compact.placement, 'top');
  assert.strictEqual(expanded.placement, 'top');
  assert.strictEqual(compact.bottom, expanded.bottom, 'opening quick-add must keep the popover anchored to the trigger');
}

{
  const layout = calculateTemplatePopoverLayout({
    triggerRect: rect(200, 90, 36, 36),
    popoverWidth: 320,
    popoverHeight: 260,
    viewportWidth: 900,
    viewportHeight: 700,
    margin: 10,
    gap: 10
  });

  assert.strictEqual(layout.placement, 'bottom');
  assert.strictEqual(layout.top, 136);
  assert.strictEqual(layout.bottom, null);
  assert.strictEqual(layout.maxHeight, 554);
}

{
  const layout = calculateTemplatePopoverLayout({
    triggerRect: rect(300, 300, 36, 36),
    popoverWidth: 320,
    popoverHeight: 700,
    viewportWidth: 900,
    viewportHeight: 600,
    margin: 10,
    gap: 10
  });

  assert.strictEqual(layout.placement, 'top');
  assert.strictEqual(layout.maxHeight, 280, 'when neither side fits, cap height to the larger available side');
}

{
  const layout = calculateTemplatePopoverLayout({
    triggerRect: rect(4, 420, 36, 36),
    popoverWidth: 320,
    popoverHeight: 220,
    viewportWidth: 360,
    viewportHeight: 640,
    margin: 10,
    gap: 10
  });

  assert.strictEqual(layout.left, 10, 'popover must stay inside the left viewport edge');
}

console.log('template_popover_layout.test.js: ok');
