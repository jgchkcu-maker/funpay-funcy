// Dependency-free SVG/HTML charts for the Finance Hub screen.
// Colours come from CSS custom properties (--fpt-fin-c1..c6, --fpt-fin-other), so light and dark
// themes switch in CSS only. Every chart is responsive, has a hover tooltip and exposes its data
// to assistive tech through the aria-label.
(function (root) {
    'use strict';

    const NS = 'http://www.w3.org/2000/svg';
    const M = () => root.FPTFinanceModel;
    let uid = 0;

    function svgEl(tag, attrs, parent) {
        const el = document.createElementNS(NS, tag);
        if (attrs) for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
        if (parent) parent.appendChild(el);
        return el;
    }

    function html(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = String(text);
        return el;
    }

    const seriesColor = index => `var(--fpt-fin-c${((index % 6) + 6) % 6 + 1})`;

    // Fritsch–Carlson monotone cubic: smooth lines that never overshoot the data.
    function monotonePath(points) {
        const n = points.length;
        if (n === 0) return '';
        if (n === 1) return `M${points[0][0]},${points[0][1]}`;
        const dx = []; const slope = [];
        for (let i = 0; i < n - 1; i++) {
            dx.push(points[i + 1][0] - points[i][0]);
            slope.push((points[i + 1][1] - points[i][1]) / (dx[i] || 1));
        }
        const tangent = [slope[0]];
        for (let i = 1; i < n - 1; i++) {
            tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
        }
        tangent.push(slope[n - 2]);
        for (let i = 0; i < n - 1; i++) {
            if (slope[i] === 0) { tangent[i] = 0; tangent[i + 1] = 0; continue; }
            const a = tangent[i] / slope[i]; const b = tangent[i + 1] / slope[i];
            const s = a * a + b * b;
            if (s > 9) { const t = 3 / Math.sqrt(s); tangent[i] = t * a * slope[i]; tangent[i + 1] = t * b * slope[i]; }
        }
        let d = `M${points[0][0]},${points[0][1]}`;
        for (let i = 0; i < n - 1; i++) {
            const h = dx[i] / 3;
            d += `C${points[i][0] + h},${points[i][1] + tangent[i] * h},${points[i + 1][0] - h},${points[i + 1][1] - tangent[i + 1] * h},${points[i + 1][0]},${points[i + 1][1]}`;
        }
        return d;
    }

    function valueScale(minValue, maxValue) {
        const model = M();
        const lo = Math.min(0, minValue); const hi = Math.max(0, maxValue);
        const ns = model.niceScale(Math.max(hi, -lo, 1e-9), 4);
        const step = ns.ticks[1] || ns.max || 1;
        const max = hi > 0 ? Math.ceil(hi / step - 1e-9) * step : 0;
        const min = lo < 0 ? Math.floor(lo / step + 1e-9) * step : 0;
        const ticks = [];
        for (let v = min; v <= max + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
        return { min, max: max === min ? step : max, ticks };
    }

    // Shared frame: a sized host, a tooltip and re-render on resize.
    function createFrame({ height, className, label, draw }) {
        const host = html('div', `fpt-fin-chart ${className || ''}`.trim());
        host.style.setProperty('--fpt-fin-chart-h', `${height}px`);
        host.setAttribute('role', 'img');
        if (label) host.setAttribute('aria-label', label);
        const tip = html('div', 'fpt-fin-tip');
        tip.setAttribute('role', 'tooltip');
        tip.hidden = true;
        let svg = null;
        let lastWidth = 0;

        function showTip(build, x, y) {
            tip.replaceChildren();
            build(tip);
            tip.hidden = false;
            const width = host.clientWidth;
            const tipWidth = tip.offsetWidth;
            const left = Math.min(Math.max(8, x + 14), Math.max(8, width - tipWidth - 8));
            const flip = x + 14 + tipWidth > width - 8;
            tip.style.left = `${flip ? Math.max(8, x - tipWidth - 14) : left}px`;
            tip.style.top = `${Math.max(4, y - 10)}px`;
        }
        const hideTip = () => { tip.hidden = true; };

        function render() {
            const width = Math.floor(host.clientWidth);
            if (width < 40) return;
            lastWidth = width;
            svg?.remove();
            svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'fpt-fin-svg', 'aria-hidden': 'true', focusable: 'false' });
            host.insertBefore(svg, tip);
            draw({ svg, width, height, showTip, hideTip, host });
        }

        host.append(tip);
        if (typeof ResizeObserver === 'function') {
            const observer = new ResizeObserver(() => {
                if (!host.isConnected) { observer.disconnect(); return; }
                if (Math.floor(host.clientWidth) !== lastWidth) render();
            });
            observer.observe(host);
        }
        // Fallback for environments without layout notifications.
        requestAnimationFrame(render);
        host._render = render;
        return host;
    }

    function pickLabelIndexes(count, maxLabels) {
        if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
        const result = [];
        const stride = (count - 1) / (maxLabels - 1);
        for (let i = 0; i < maxLabels; i++) result.push(Math.round(i * stride));
        return Array.from(new Set(result));
    }

    function drawAxes({ svg, plot, scale, labels, formatY, xFor, width }) {
        const yFor = v => plot.top + (1 - (v - scale.min) / (scale.max - scale.min)) * plot.h;
        const grid = svgEl('g', { class: 'fpt-fin-grid' }, svg);
        for (const tick of scale.ticks) {
            const y = yFor(tick);
            svgEl('line', { x1: plot.left, x2: plot.left + plot.w, y1: y, y2: y, class: tick === 0 ? 'fpt-fin-baseline' : 'fpt-fin-gridline' }, grid);
            const text = svgEl('text', { x: plot.left - 8, y: y + 4, class: 'fpt-fin-axis-label', 'text-anchor': 'end' }, grid);
            text.textContent = formatY(tick);
        }
        const maxLabels = Math.max(2, Math.floor(plot.w / 64));
        for (const i of pickLabelIndexes(labels.length, maxLabels)) {
            const text = svgEl('text', { x: xFor(i), y: plot.top + plot.h + 18, class: 'fpt-fin-axis-label', 'text-anchor': labels.length === 1 ? 'middle' : (i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle') }, grid);
            text.textContent = labels[i];
        }
        return yFor;
    }

    // --- Area / line chart (one measure, one axis) ------------------------------------------
    // points: [{ label, fullLabel, value }]; format(value) -> string for tooltip; colorIndex 0..5.
    function line({ points, format, formatAxis, colorIndex = 0, height = 250, name = '', ariaLabel }) {
        const model = M();
        const gradientId = `fpt-fin-grad-${++uid}`;
        return createFrame({
            height, className: 'fpt-fin-chart--line', label: ariaLabel || `${name}: ${points.length} точек`,
            draw({ svg, width, height: h, showTip, hideTip, host }) {
                const left = 46; const right = 14; const top = 14; const bottom = 28;
                const plot = { left, top, w: Math.max(10, width - left - right), h: Math.max(10, h - top - bottom) };
                const values = points.map(p => p.value);
                const scale = valueScale(Math.min(...values, 0), Math.max(...values, 0));
                const xFor = i => (points.length === 1 ? plot.left + plot.w / 2 : plot.left + (i / (points.length - 1)) * plot.w);
                const yFor = drawAxes({ svg, plot, scale, labels: points.map(p => p.label), formatY: formatAxis || model.formatCompact, xFor, width });
                const color = seriesColor(colorIndex);
                const coords = points.map((p, i) => [xFor(i), yFor(p.value)]);

                const defs = svgEl('defs', null, svg);
                const gradient = svgEl('linearGradient', { id: gradientId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
                svgEl('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.28 }, gradient);
                svgEl('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0.02 }, gradient);

                const baseY = yFor(0);
                if (coords.length > 1) {
                    const path = monotonePath(coords);
                    svgEl('path', { d: `${path}L${coords[coords.length - 1][0]},${baseY}L${coords[0][0]},${baseY}Z`, fill: `url(#${gradientId})`, class: 'fpt-fin-area' }, svg);
                    const stroke = svgEl('path', { d: path, class: 'fpt-fin-line' }, svg);
                    stroke.style.stroke = color;
                } else {
                    const dot = svgEl('circle', { cx: coords[0][0], cy: coords[0][1], r: 5, class: 'fpt-fin-dot' }, svg);
                    dot.style.fill = color;
                }

                const cursor = svgEl('line', { y1: plot.top, y2: plot.top + plot.h, class: 'fpt-fin-cursor' }, svg);
                const marker = svgEl('circle', { r: 5, class: 'fpt-fin-marker' }, svg);
                marker.style.fill = color;
                cursor.style.display = 'none'; marker.style.display = 'none';
                const hit = svgEl('rect', { x: plot.left, y: plot.top, width: plot.w, height: plot.h, fill: 'transparent', class: 'fpt-fin-hit' }, svg);

                const activate = clientX => {
                    const rect = svg.getBoundingClientRect();
                    const x = clientX - rect.left;
                    let index = 0; let best = Infinity;
                    coords.forEach(([cx], i) => { const d = Math.abs(cx - x); if (d < best) { best = d; index = i; } });
                    const [cx, cy] = coords[index];
                    cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx); cursor.style.display = '';
                    marker.setAttribute('cx', cx); marker.setAttribute('cy', cy); marker.style.display = '';
                    showTip(tip => {
                        tip.appendChild(html('strong', 'fpt-fin-tip-title', points[index].fullLabel || points[index].label));
                        const row = html('div', 'fpt-fin-tip-row');
                        const swatch = html('span', 'fpt-fin-tip-swatch');
                        swatch.style.background = color;
                        row.append(swatch, html('span', 'fpt-fin-tip-name', name), html('b', 'fpt-fin-tip-value', format(points[index].value)));
                        tip.appendChild(row);
                        if (points[index].extra) tip.appendChild(html('div', 'fpt-fin-tip-extra', points[index].extra));
                    }, cx, cy);
                };
                const clear = () => { cursor.style.display = 'none'; marker.style.display = 'none'; hideTip(); };
                hit.addEventListener('pointermove', event => activate(event.clientX));
                hit.addEventListener('pointerdown', event => activate(event.clientX));
                hit.addEventListener('pointerleave', clear);
                host.tabIndex = 0;
                host.addEventListener('keydown', event => {
                    if (event.key === 'Escape') clear();
                });
            }
        });
    }

    // --- Bar chart (grouped; one axis) ------------------------------------------------------
    // categories: [{label, fullLabel}], series: [{ name, colorIndex, values: [] }]
    function bars({ categories, series, format, formatAxis, height = 250, ariaLabel }) {
        const model = M();
        return createFrame({
            height, className: 'fpt-fin-chart--bars', label: ariaLabel || `Столбчатая диаграмма, ${categories.length} периодов`,
            draw({ svg, width, height: h, showTip, hideTip }) {
                const left = 46; const right = 10; const top = 14; const bottom = 28;
                const plot = { left, top, w: Math.max(10, width - left - right), h: Math.max(10, h - top - bottom) };
                const all = series.flatMap(s => s.values);
                const scale = valueScale(Math.min(...all, 0), Math.max(...all, 0));
                const band = plot.w / categories.length;
                const xFor = i => plot.left + band * (i + 0.5);
                const yFor = drawAxes({ svg, plot, scale, labels: categories.map(c => c.label), formatY: formatAxis || model.formatCompact, xFor, width });
                const groupW = Math.min(band * 0.72, 22 * series.length + 6 * (series.length - 1));
                const gap = 2;
                const barW = Math.max(3, (groupW - gap * (series.length - 1)) / series.length);
                const zeroY = yFor(0);
                const hoverBg = svgEl('rect', { class: 'fpt-fin-band', rx: 8, y: plot.top, height: plot.h }, svg);
                hoverBg.style.display = 'none';

                categories.forEach((_, i) => {
                    const x0 = xFor(i) - ((barW * series.length) + gap * (series.length - 1)) / 2;
                    series.forEach((s, k) => {
                        const value = s.values[i] || 0;
                        if (value === 0) return;
                        const x = x0 + k * (barW + gap);
                        const y = yFor(value);
                        const top2 = Math.min(y, zeroY); const bh = Math.max(1, Math.abs(zeroY - y));
                        const r = Math.min(4, barW / 2, bh);
                        const down = value < 0;
                        const d = down
                            ? `M${x},${top2}H${x + barW}V${top2 + bh - r}Q${x + barW},${top2 + bh} ${x + barW - r},${top2 + bh}H${x + r}Q${x},${top2 + bh} ${x},${top2 + bh - r}Z`
                            : `M${x},${top2 + bh}V${top2 + r}Q${x},${top2} ${x + r},${top2}H${x + barW - r}Q${x + barW},${top2} ${x + barW},${top2 + r}V${top2 + bh}Z`;
                        const bar = svgEl('path', { d, class: 'fpt-fin-bar' }, svg);
                        bar.style.fill = seriesColor(s.colorIndex);
                    });
                });

                const hit = svgEl('rect', { x: plot.left, y: plot.top, width: plot.w, height: plot.h, fill: 'transparent', class: 'fpt-fin-hit' }, svg);
                const activate = clientX => {
                    const rect = svg.getBoundingClientRect();
                    const i = Math.min(categories.length - 1, Math.max(0, Math.floor((clientX - rect.left - plot.left) / band)));
                    hoverBg.setAttribute('x', plot.left + band * i + 1);
                    hoverBg.setAttribute('width', Math.max(2, band - 2));
                    hoverBg.style.display = '';
                    showTip(tip => {
                        tip.appendChild(html('strong', 'fpt-fin-tip-title', categories[i].fullLabel || categories[i].label));
                        series.forEach(s => {
                            const row = html('div', 'fpt-fin-tip-row');
                            const swatch = html('span', 'fpt-fin-tip-swatch');
                            swatch.style.background = seriesColor(s.colorIndex);
                            row.append(swatch, html('span', 'fpt-fin-tip-name', s.name), html('b', 'fpt-fin-tip-value', format(s.values[i] || 0)));
                            tip.appendChild(row);
                        });
                    }, xFor(i), plot.top + plot.h / 3);
                };
                hit.addEventListener('pointermove', event => activate(event.clientX));
                hit.addEventListener('pointerdown', event => activate(event.clientX));
                hit.addEventListener('pointerleave', () => { hoverBg.style.display = 'none'; hideTip(); });
            }
        });
    }

    // --- Donut ------------------------------------------------------------------------------
    // rows: [{ name, value, share, folded? }]. The legend is returned alongside as HTML.
    function donut({ rows, format, centerLabel, centerValue, size = 190, ariaLabel }) {
        const wrap = html('div', 'fpt-fin-donut');
        const chart = html('div', 'fpt-fin-donut-chart');
        chart.setAttribute('role', 'img');
        chart.setAttribute('aria-label', ariaLabel || `Структура: ${rows.map(r => `${r.name} ${Math.round(r.share * 100)}%`).join(', ')}`);
        const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'fpt-fin-svg', 'aria-hidden': 'true', focusable: 'false' }, chart);
        const radius = size / 2 - 14; const cx = size / 2; const cy = size / 2;
        const thickness = 22;
        const colorOf = (row, i) => (row.folded ? 'var(--fpt-fin-other)' : seriesColor(i));
        const centerValueEl = html('strong', 'fpt-fin-donut-value', centerValue);
        const centerLabelEl = html('span', 'fpt-fin-donut-label', centerLabel);
        const center = html('div', 'fpt-fin-donut-center');
        center.append(centerValueEl, centerLabelEl);

        const legend = html('ul', 'fpt-fin-legend');
        const items = [];
        let angle = -Math.PI / 2;
        const total = rows.reduce((sum, r) => sum + r.share, 0) || 1;
        const polar = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
        svgEl('circle', { cx, cy, r: radius, class: 'fpt-fin-donut-track', 'stroke-width': thickness }, svg);

        rows.forEach((row, i) => {
            const sweep = (row.share / total) * Math.PI * 2;
            const gapAngle = rows.length > 1 ? Math.min(0.045, sweep / 3) : 0;
            const a0 = angle + gapAngle / 2; const a1 = angle + sweep - gapAngle / 2;
            angle += sweep;
            let path = null;
            if (sweep > 0.0001) {
                if (rows.length === 1) {
                    path = svgEl('circle', { cx, cy, r: radius, fill: 'none', 'stroke-width': thickness, class: 'fpt-fin-seg' }, svg);
                } else {
                    const [x0, y0] = polar(a0, radius); const [x1, y1] = polar(a1, radius);
                    path = svgEl('path', { d: `M${x0},${y0}A${radius},${radius} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`, fill: 'none', 'stroke-width': thickness, class: 'fpt-fin-seg' }, svg);
                }
                path.style.stroke = colorOf(row, i);
            }
            const item = html('li', 'fpt-fin-legend-item');
            item.tabIndex = 0;
            const swatch = html('span', 'fpt-fin-legend-swatch');
            swatch.style.background = colorOf(row, i);
            const name = html('span', 'fpt-fin-legend-name', row.folded ? `Прочее (${row.folded})` : row.name);
            name.title = name.textContent;
            const value = html('span', 'fpt-fin-legend-value', format(row));
            item.append(swatch, name, value);
            legend.appendChild(item);
            items.push({ item, path, row });
            const focus = () => {
                items.forEach(entry => { entry.item.classList.toggle('is-dim', entry.item !== item); entry.path?.classList.toggle('is-dim', entry.item !== item); });
                centerValueEl.textContent = `${Math.round(row.share * 100)}%`;
                centerLabelEl.textContent = row.folded ? 'Прочее' : row.name;
            };
            const blur = () => {
                items.forEach(entry => { entry.item.classList.remove('is-dim'); entry.path?.classList.remove('is-dim'); });
                centerValueEl.textContent = centerValue;
                centerLabelEl.textContent = centerLabel;
            };
            for (const target of [item, path]) {
                if (!target) continue;
                target.addEventListener('pointerenter', focus);
                target.addEventListener('pointerleave', blur);
            }
            item.addEventListener('focus', focus);
            item.addEventListener('blur', blur);
        });
        chart.appendChild(center);
        wrap.append(chart, legend);
        return wrap;
    }

    // --- Horizontal ranking bars (HTML) -----------------------------------------------------
    // rows: [{ name, value, valueText, meta }]; one hue for every bar - rank is not a category.
    function hbars({ rows, colorIndex = 0 }) {
        const list = html('ol', 'fpt-fin-hbars');
        const max = Math.max(...rows.map(r => r.value), 0) || 1;
        rows.forEach((row, index) => {
            const li = html('li', 'fpt-fin-hbar');
            const head = html('div', 'fpt-fin-hbar-head');
            const rank = html('span', 'fpt-fin-hbar-rank', index + 1);
            const name = html('span', 'fpt-fin-hbar-name', row.name);
            name.title = row.name;
            head.append(rank, name, html('b', 'fpt-fin-hbar-value', row.valueText));
            const track = html('div', 'fpt-fin-hbar-track');
            const fill = html('span', 'fpt-fin-hbar-fill');
            fill.style.width = `${Math.max(2, (row.value / max) * 100)}%`;
            fill.style.background = seriesColor(colorIndex);
            track.appendChild(fill);
            li.append(head, track);
            if (row.meta) li.appendChild(html('span', 'fpt-fin-hbar-meta', row.meta));
            list.appendChild(li);
        });
        return list;
    }

    // --- Sparkline --------------------------------------------------------------------------
    function sparkline(values, colorIndex = 0) {
        const wrap = html('span', 'fpt-fin-spark');
        wrap.setAttribute('aria-hidden', 'true');
        const clean = values.map(v => (Number.isFinite(v) ? v : 0));
        if (clean.length < 2 || clean.every(v => v === clean[0])) return wrap;
        const width = 84; const height = 28; const pad = 3;
        const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'fpt-fin-spark-svg', focusable: 'false' }, wrap);
        const min = Math.min(...clean); const max = Math.max(...clean);
        const pts = clean.map((v, i) => [pad + (i / (clean.length - 1)) * (width - pad * 2), pad + (1 - (v - min) / (max - min || 1)) * (height - pad * 2)]);
        const path = svgEl('path', { d: monotonePath(pts), class: 'fpt-fin-spark-line' }, svg);
        path.style.stroke = seriesColor(colorIndex);
        const last = pts[pts.length - 1];
        const dot = svgEl('circle', { cx: last[0], cy: last[1], r: 2.5, class: 'fpt-fin-spark-dot' }, svg);
        dot.style.fill = seriesColor(colorIndex);
        return wrap;
    }

    root.FPTFinanceCharts = Object.freeze({ line, bars, donut, hbars, sparkline, seriesColor, monotonePath, valueScale });
    if (typeof module !== 'undefined' && module.exports) module.exports = root.FPTFinanceCharts;
})(typeof window !== 'undefined' ? window : globalThis);
