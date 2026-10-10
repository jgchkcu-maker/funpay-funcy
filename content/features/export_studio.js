// content/features/export_studio.js
// =============================================================================
// FunPay Funcy — СТУДИЯ ЭКСПОРТА (Export Studio)
//
// Расширенный экспорт ПРОДАЖ, ПОКУПОК и ФИНАНСОВ в форматах XLSX, DOCX, PDF,
// CSV, JSON. Пользователь сам выбирает: формат, визуальный стиль (тему),
// период, валюту, набор колонок, сортировку, заголовок/подзаголовок и доп.
// опции (строка итогов, мини-сводка, водяной знак, нумерация).
//
// ВАЖНО: модуль полностью автономный — НЕ грузит внешних библиотек (это нарушило
// бы CSP MV3). XLSX и DOCX собираются как ZIP из OOXML-XML своими руками
// (zip без сжатия — валиден), PDF строится как нативный PDF-документ вручную.
//
// Кнопка «Экспорт» добавляется в панель статистики:
//   • /orders/trade      — продажи  (источник FPTSalesDB / window.fptOrdersDB)
//   • /orders/           — покупки  (источник FPTPurchasesDB / window.fptOrdersDB)
//   • /account/balance   — финансы  (источник FPTFinanceDB)
// =============================================================================

(function () {
    'use strict';

    // ──────────────────────────────────────────────────────────────────────────
    //  МАЛЕНЬКИЕ УТИЛИТЫ
    // ──────────────────────────────────────────────────────────────────────────
    const SYM = { RUB: '₽', USD: '$', EUR: '€', UNKNOWN: '' };
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    // экранирование для XML (XLSX/DOCX) — управляющие символы запрещены в OOXML
    function xml(s) {
        return String(s == null ? '' : s)
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    function pad(n) { return String(n).padStart(2, '0'); }
    function fmtDate(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    }
    function fmtDateTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    function fmtMoney(v, cur) {
        const neg = v < 0;
        const s = Math.abs(Math.round((v || 0))).toLocaleString('ru-RU');
        return (neg ? '−' : '') + s + (cur ? ' ' + (SYM[cur] || cur) : '');
    }
    function nowStamp() {
        const d = new Date();
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
    }
    function downloadBlob(bytes, mime, filename) {
        const blob = (bytes instanceof Blob) ? bytes : new Blob([bytes], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  ZIP (store, без сжатия) — нужно для XLSX и DOCX
    //  Собираем валидный ZIP вручную: local headers + central dir + EOCD.
    // ──────────────────────────────────────────────────────────────────────────
    const CRC_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c >>> 0;
        }
        return t;
    })();
    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }
    const enc = new TextEncoder();
    function zipBuild(files) {
        // files: [{ name, data:Uint8Array }]
        const parts = [];
        const central = [];
        let offset = 0;
        const u16 = v => [v & 0xFF, (v >>> 8) & 0xFF];
        const u32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
        for (const f of files) {
            const nameB = enc.encode(f.name);
            const data = f.data;
            const crc = crc32(data);
            const lh = [];
            lh.push(...u32(0x04034b50));     // local file header sig
            lh.push(...u16(20));             // version needed
            lh.push(...u16(0));              // flags
            lh.push(...u16(0));              // method = store
            lh.push(...u16(0), ...u16(0));   // mod time/date
            lh.push(...u32(crc));
            lh.push(...u32(data.length));    // comp size
            lh.push(...u32(data.length));    // uncomp size
            lh.push(...u16(nameB.length));
            lh.push(...u16(0));              // extra len
            const lhB = new Uint8Array(lh);
            parts.push(lhB, nameB, data);
            const ch = [];
            ch.push(...u32(0x02014b50));     // central dir sig
            ch.push(...u16(20), ...u16(20)); // version made/needed
            ch.push(...u16(0), ...u16(0));   // flags/method
            ch.push(...u16(0), ...u16(0));   // time/date
            ch.push(...u32(crc));
            ch.push(...u32(data.length), ...u32(data.length));
            ch.push(...u16(nameB.length), ...u16(0), ...u16(0)); // name/extra/comment len
            ch.push(...u16(0), ...u16(0));   // disk start / int attrs
            ch.push(...u32(0));              // ext attrs
            ch.push(...u32(offset));         // local header offset
            central.push(new Uint8Array(ch), nameB);
            offset += lhB.length + nameB.length + data.length;
        }
        const centralStart = offset;
        let centralSize = 0;
        for (const c of central) centralSize += c.length;
        const eocd = [];
        eocd.push(...u32(0x06054b50));
        eocd.push(...u16(0), ...u16(0));
        eocd.push(...u16(files.length), ...u16(files.length));
        eocd.push(...u32(centralSize), ...u32(centralStart));
        eocd.push(...u16(0));
        const all = [...parts, ...central, new Uint8Array(eocd)];
        let total = 0; for (const p of all) total += p.length;
        const out = new Uint8Array(total);
        let pos = 0;
        for (const p of all) { out.set(p, pos); pos += p.length; }
        return out;
    }
    function strBytes(s) { return enc.encode(s); }

    // ──────────────────────────────────────────────────────────────────────────
    //  ТЕМЫ / СТИЛИ (общая палитра для всех форматов)
    //  Каждая тема даёт цвета шапки, акцент, зебру, текст. HEX без #.
    // ──────────────────────────────────────────────────────────────────────────
    const THEMES = {
        funpay: { name: 'FunPay', accent: 'FF6D15', headerBg: 'FF6D15', headerText: 'FFFFFF', zebra: 'FFF3EB', text: '1A1A1A', total: 'FFE3D1', grid: 'F0D8C8' },
        midnight: { name: 'Тёмная ночь', accent: '7C5CFF', headerBg: '1E1B33', headerText: 'FFFFFF', zebra: 'F2F0FB', text: '15131F', total: 'E7E2FB', grid: 'D8D2F0' },
        emerald: { name: 'Изумруд', accent: '10B981', headerBg: '065F46', headerText: 'FFFFFF', zebra: 'ECFDF5', text: '0B1F17', total: 'D1FAE5', grid: 'BBE9D5' },
        ocean: { name: 'Океан', accent: '0EA5E9', headerBg: '075985', headerText: 'FFFFFF', zebra: 'EFF9FF', text: '0A1A24', total: 'D7EEFB', grid: 'C2E2F4' },
        ruby: { name: 'Рубин', accent: 'E11D48', headerBg: '881337', headerText: 'FFFFFF', zebra: 'FFF1F4', text: '24070E', total: 'FBD7DF', grid: 'F2C2CD' },
        gold: { name: 'Золото', accent: 'C79A2E', headerBg: '3A2E12', headerText: 'F8EFD6', zebra: 'FBF6E9', text: '2A2210', total: 'F0E2BE', grid: 'E5D6AC' },
        mono: { name: 'Минимал', accent: '111827', headerBg: '111827', headerText: 'FFFFFF', zebra: 'F4F4F5', text: '111827', total: 'E4E4E7', grid: 'D4D4D8' },
        candy: { name: 'Карамель', accent: 'EC4899', headerBg: '9D174D', headerText: 'FFFFFF', zebra: 'FDF2F8', text: '2A0A1B', total: 'FBD3E8', grid: 'F4BEDB' }
    };
    function hexToRgb(h) {
        h = h.replace('#', '');
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    function rgbToHex(r, g, b) {
        const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
        return (c(r) + c(g) + c(b)).toUpperCase();
    }
    // смешать цвет с белым (t=0..1 → ближе к белому)
    function tint(hex, t) {
        const [r, g, b] = hexToRgb(hex);
        return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
    }
    // затемнить цвет (t=0..1 → ближе к чёрному)
    function shade(hex, t) {
        const [r, g, b] = hexToRgb(hex);
        return rgbToHex(r * (1 - t), g * (1 - t), b * (1 - t));
    }
    // воспринимаемая яркость → выбираем контрастный текст шапки
    function luminance(hex) {
        const [r, g, b] = hexToRgb(hex);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    // Построить полную палитру отчёта из ОДНОГО акцентного цвета.
    function themeFromColor(hex) {
        hex = (hex || '#2563EB').replace('#', '');
        const accent = hex.toUpperCase();
        const headerBg = accent;
        const headerText = luminance(accent) > 0.6 ? '111827' : 'FFFFFF';
        return {
            name: 'custom',
            accent,
            headerBg,
            headerText,
            zebra: tint(accent, 0.90),   // очень светлый оттенок акцента
            text: '1A1A1A',
            total: tint(accent, 0.80),
            grid: tint(accent, 0.62)
        };
    }

    // (готовых цветов нет — цвет выбирается на спектре/пикере в UI)

    // expose namespace early
    const ES = {};
    window.FPTExportStudio = ES;
    function hslToHex(h, s, l) {
        s /= 100; l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
    }
    function hexToHsl(hex) {
        let [r, g, b] = hexToRgb(hex); r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }
        return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
    }
    ES._util = { esc, xml, fmtDate, fmtDateTime, fmtMoney, downloadBlob, zipBuild, strBytes, THEMES, hexToRgb, SYM, nowStamp, themeFromColor, tint, shade, luminance, hslToHex, hexToHsl };
})();

// =============================================================================
//  FunPay Funcy — Export Studio :: ГЕНЕРАТОРЫ ФОРМАТОВ + ДАТАСЕТЫ
// =============================================================================
(function () {
    'use strict';
    const ES = window.FPTExportStudio;
    const { xml, fmtDate, fmtDateTime, fmtMoney, downloadBlob, zipBuild, strBytes, THEMES, hexToRgb, SYM, nowStamp } = ES._util;

    // ──────────────────────────────────────────────────────────────────────────
    //  СХЕМЫ ДАННЫХ: какие колонки доступны для каждого источника
    //  key — поле; label — заголовок; w — ширина (символы, для xlsx/pdf);
    //  align — 'l'|'r'|'c'; get — извлечение значения (raw); disp — текст для вывода.
    // ──────────────────────────────────────────────────────────────────────────
    const ST_SALES = { closed: 'Закрыт', paid: 'Оплачен', refunded: 'Возврат' };
    const FIN_TYPES = { order: 'Заказ', payment: 'Пополнение', withdraw: 'Вывод', withdraw_cancel: 'Отмена вывода', other: 'Другое' };
    const FIN_STATUS = { complete: 'Завершено', cancel: 'Отменено', waiting: 'Ожидание' };

    function ordersSchema(isPurchases) {
        const party = isPurchases ? 'Продавец' : 'Покупатель';
        return [
            { key: 'orderId', label: '№ заказа', w: 12, align: 'l', get: o => o.orderId || '', disp: o => o.orderId ? '#' + o.orderId : '' },
            { key: 'date', label: 'Дата', w: 17, align: 'l', get: o => o.orderDate || 0, disp: o => fmtDateTime(o.orderDate), num: false },
            { key: 'description', label: 'Товар / описание', w: 40, align: 'l', get: o => o.description || '', disp: o => o.description || o.subcategoryName || 'Заказ' },
            { key: 'category', label: 'Категория', w: 22, align: 'l', get: o => o.subcategoryName || '', disp: o => o.subcategoryName || '' },
            { key: 'party', label: party, w: 18, align: 'l', get: o => o.buyerUsername || '', disp: o => o.buyerUsername || '' },
            { key: 'status', label: 'Статус', w: 12, align: 'c', get: o => o.orderStatus || '', disp: o => ST_SALES[o.orderStatus] || o.orderStatus || '' },
            { key: 'price', label: 'Сумма', w: 12, align: 'r', get: o => (o.price || 0), disp: o => fmtMoney(o.price, o.currency), num: true },
            { key: 'currency', label: 'Валюта', w: 8, align: 'c', get: o => o.currency || '', disp: o => o.currency || '' },
            { key: 'link', label: 'Ссылка', w: 34, align: 'l', get: o => o.orderId ? 'https://funpay.com/orders/' + o.orderId + '/' : '', disp: o => o.orderId ? 'https://funpay.com/orders/' + o.orderId + '/' : '' }
        ];
    }
    function financeSchema() {
        return [
            { key: 'date', label: 'Дата', w: 17, align: 'l', get: t => t.date || 0, disp: t => fmtDateTime(t.date) },
            { key: 'title', label: 'Операция', w: 40, align: 'l', get: t => t.title || '', disp: t => t.title || FIN_TYPES[t.type] || 'Операция' },
            { key: 'type', label: 'Тип', w: 16, align: 'l', get: t => t.type || '', disp: t => FIN_TYPES[t.type] || t.type || '' },
            { key: 'status', label: 'Статус', w: 12, align: 'c', get: t => t.status || '', disp: t => FIN_STATUS[t.status] || t.status || '' },
            { key: 'amount', label: 'Сумма', w: 14, align: 'r', get: t => (t.signed || 0), disp: t => (t.signed >= 0 ? '+ ' : '− ') + fmtMoney(Math.abs(t.signed), t.currency), num: true },
            { key: 'currency', label: 'Валюта', w: 8, align: 'c', get: t => t.currency || '', disp: t => t.currency || '' }
        ];
    }

    ES.schemaFor = function (kind, isPurchases) {
        return kind === 'finance' ? financeSchema() : ordersSchema(isPurchases);
    };

    // ──────────────────────────────────────────────────────────────────────────
    //  АГРЕГАТЫ ИТОГОВ (для строки «Итого» и мини-сводки)
    // ──────────────────────────────────────────────────────────────────────────
    ES.summarize = function (kind, rows) {
        if (kind === 'finance') {
            const inByCur = {}, outByCur = {};
            for (const t of rows) {
                if (t.status !== 'complete') continue;
                const cur = t.currency || 'UNKNOWN';
                if (t.signed >= 0) inByCur[cur] = (inByCur[cur] || 0) + Math.abs(t.signed);
                else outByCur[cur] = (outByCur[cur] || 0) + Math.abs(t.signed);
            }
            const curs = new Set([...Object.keys(inByCur), ...Object.keys(outByCur)]);
            const net = {};
            curs.forEach(c => { if (c !== 'UNKNOWN') net[c] = (inByCur[c] || 0) - (outByCur[c] || 0); });
            return { kind, count: rows.length, inByCur, outByCur, net };
        }
        const byCur = {};
        let valid = 0;
        for (const o of rows) {
            if (o.orderStatus === 'closed' || o.orderStatus === 'paid') {
                const c = o.currency || 'UNKNOWN';
                byCur[c] = (byCur[c] || 0) + (o.price || 0);
                valid++;
            }
        }
        return { kind, count: rows.length, valid, byCur };
    };
    function summaryLines(sum) {
        const lines = [];
        if (sum.kind === 'finance') {
            const join = o => Object.entries(o).filter(([c, v]) => c !== 'UNKNOWN' && Math.abs(v) > 0.5).map(([c, v]) => fmtMoney(v, c)).join(' · ') || '0';
            lines.push(['Операций', String(sum.count)]);
            lines.push(['Поступления', join(sum.inByCur)]);
            lines.push(['Расходы', join(sum.outByCur)]);
            lines.push(['Чистый поток', join(sum.net)]);
        } else {
            const join = o => Object.entries(o).filter(([c, v]) => c !== 'UNKNOWN').map(([c, v]) => fmtMoney(v, c)).join(' · ') || '0';
            lines.push(['Всего записей', String(sum.count)]);
            lines.push(['Учтено (закрыт/оплачен)', String(sum.valid)]);
            lines.push(['Оборот', join(sum.byCur)]);
        }
        return lines;
    }
    ES._summaryLines = summaryLines;

    // ──────────────────────────────────────────────────────────────────────────
    //  CSV
    // ──────────────────────────────────────────────────────────────────────────
    ES.buildCSV = function (cols, rows, opt) {
        const sep = opt.csvSep || ';';
        const q = s => FPTSafe.csvCell(s);
        const lines = [];
        lines.push(cols.map(c => q(c.label)).join(sep));
        for (const r of rows) lines.push(cols.map(c => q(c.disp(r))).join(sep));
        if (opt.totals) {
            const sum = ES.summarize(opt.kind, rows);
            lines.push('');
            ES._summaryLines(sum).forEach(([k, v]) => lines.push(q(k) + sep + q(v)));
        }
        // BOM для корректной кириллицы в Excel
        return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    };

    // ──────────────────────────────────────────────────────────────────────────
    //  JSON
    // ──────────────────────────────────────────────────────────────────────────
    ES.buildJSON = function (cols, rows, opt) {
        const out = {
            meta: {
                title: opt.title, subtitle: opt.subtitle, kind: opt.kind,
                generated: new Date().toISOString(), period: opt.periodLabel, count: rows.length,
                source: 'FunPay Funcy — Export Studio'
            },
            columns: cols.map(c => ({ key: c.key, label: c.label })),
            rows: rows.map(r => {
                const o = {};
                cols.forEach(c => { o[c.key] = c.num ? Number(c.get(r)) : c.get(r); });
                return o;
            })
        };
        if (opt.totals) out.summary = ES.summarize(opt.kind, rows);
        return new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    };

    // ──────────────────────────────────────────────────────────────────────────
    //  XLSX (OOXML SpreadsheetML, собранный вручную в ZIP)
    //  Стили: тема задаёт цвет шапки/зебры; деньги — числовой формат; заголовок
    //  и подзаголовок над таблицей; закрепление строки заголовков; авто-ширины.
    // ──────────────────────────────────────────────────────────────────────────
    function colLetter(n) { // 1->A
        let s = '';
        while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
        return s;
    }
    ES.buildXLSX = function (cols, rows, opt) {
        const th = opt.themeObj || ES._util.themeFromColor(opt.color || '#2563EB');
        const titleRows = (opt.title ? 1 : 0) + (opt.subtitle ? 1 : 0) + 1; // +1 пустая
        const headerRowIdx = titleRows + 1;

        // ── styles.xml ──
        // числовой формат денег
        const numFmt = '#,##0\\ "' + (SYM.RUB) + '";[Red]\\-#,##0\\ "' + SYM.RUB + '"';
        const fills = [
            '<fill><patternFill patternType="none"/></fill>',
            '<fill><patternFill patternType="gray125"/></fill>',
            `<fill><patternFill patternType="solid"><fgColor rgb="FF${th.headerBg}"/><bgColor indexed="64"/></patternFill></fill>`, // 2 header
            `<fill><patternFill patternType="solid"><fgColor rgb="FF${th.zebra}"/><bgColor indexed="64"/></patternFill></fill>`,    // 3 zebra
            `<fill><patternFill patternType="solid"><fgColor rgb="FF${th.total}"/><bgColor indexed="64"/></patternFill></fill>`     // 4 total
        ];
        const fonts = [
            '<font><sz val="11"/><name val="Calibri"/><color theme="1"/></font>',                         // 0 default
            `<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF${th.headerText}"/></font>`,        // 1 header
            `<font><b/><sz val="18"/><name val="Calibri"/><color rgb="FF${th.accent}"/></font>`,            // 2 title
            `<font><sz val="11"/><name val="Calibri"/><color rgb="FF808080"/></font>`,                      // 3 subtitle
            '<font><b/><sz val="11"/><name val="Calibri"/><color theme="1"/></font>'                        // 4 total bold
        ];
        const border = `<border><left style="thin"><color rgb="FF${th.grid}"/></left><right style="thin"><color rgb="FF${th.grid}"/></right><top style="thin"><color rgb="FF${th.grid}"/></top><bottom style="thin"><color rgb="FF${th.grid}"/></bottom></border>`;
        const borders = ['<border/>', border];
        // cellXfs: 0 default,1 header,2 zebra,3 money,4 money-zebra,5 title,6 subtitle,7 total,8 total-money,9 center,10 center-zebra
        const xf = (o) => `<xf numFmtId="${o.n || 0}" fontId="${o.f || 0}" fillId="${o.fl || 0}" borderId="${o.b || 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${o.a || 'left'}" vertical="center" wrapText="${o.w ? 1 : 0}"/></xf>`;
        const cellXfs = [
            xf({}),                                   // 0 default left
            xf({ f: 1, fl: 2, b: 1, a: 'left' }),     // 1 header
            xf({ fl: 3, b: 1 }),                      // 2 zebra left
            xf({ n: 164, b: 1, a: 'right' }),         // 3 money
            xf({ n: 164, fl: 3, b: 1, a: 'right' }),  // 4 money zebra
            xf({ f: 2 }),                             // 5 title
            xf({ f: 3 }),                             // 6 subtitle
            xf({ f: 4, fl: 4, b: 1 }),                // 7 total left
            xf({ n: 164, f: 4, fl: 4, b: 1, a: 'right' }), // 8 total money
            xf({ b: 1, a: 'center' }),                // 9 center
            xf({ fl: 3, b: 1, a: 'center' })          // 10 center zebra
        ];
        const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="${xml(numFmt)}"/></numFmts>
<fonts count="${fonts.length}">${fonts.join('')}</fonts>
<fills count="${fills.length}">${fills.join('')}</fills>
<borders count="${borders.length}">${borders.join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${cellXfs.length}">${cellXfs.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

        // ── sheet1.xml ──
        const lastCol = colLetter(cols.length);
        const sheetRows = [];
        let rIdx = 1;
        const cell = (col, r, styleId, type, val) => {
            const ref = colLetter(col) + r;
            if (type === 'n') return `<c r="${ref}" s="${styleId}"><v>${val}</v></c>`;
            if (val === '' || val == null) return `<c r="${ref}" s="${styleId}"/>`;
            return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${xml(val)}</t></is></c>`;
        };
        // title / subtitle
        if (opt.title) { sheetRows.push(`<row r="${rIdx}" ht="26" customHeight="1">${cell(1, rIdx, 5, 's', opt.title)}</row>`); rIdx++; }
        if (opt.subtitle) { sheetRows.push(`<row r="${rIdx}" ht="16" customHeight="1">${cell(1, rIdx, 6, 's', opt.subtitle)}</row>`); rIdx++; }
        sheetRows.push(`<row r="${rIdx}"></row>`); rIdx++; // spacer
        // header
        let hc = '';
        cols.forEach((c, i) => { hc += cell(i + 1, rIdx, 1, 's', c.label); });
        sheetRows.push(`<row r="${rIdx}" ht="22" customHeight="1">${hc}</row>`); rIdx++;
        const headerRow = rIdx - 1;
        // data
        rows.forEach((rec, n) => {
            const zebra = opt.zebra && (n % 2 === 1);
            let rc = '';
            cols.forEach((c, i) => {
                const v = c.get(rec);
                if (c.num) {
                    rc += cell(i + 1, rIdx, zebra ? 4 : 3, 'n', Number(v) || 0);
                } else {
                    const styleId = c.align === 'c' ? (zebra ? 10 : 9) : (zebra ? 2 : 0);
                    rc += cell(i + 1, rIdx, styleId, 's', c.disp(rec));
                }
            });
            sheetRows.push(`<row r="${rIdx}">${rc}</row>`); rIdx++;
        });
        // totals
        if (opt.totals) {
            sheetRows.push(`<row r="${rIdx}"></row>`); rIdx++;
            ES._summaryLines(ES.summarize(opt.kind, rows)).forEach(([k, v]) => {
                let rc = cell(1, rIdx, 7, 's', k);
                rc += cell(2, rIdx, 7, 's', v);
                for (let i = 2; i < cols.length; i++) rc += cell(i + 1, rIdx, 7, 's', '');
                sheetRows.push(`<row r="${rIdx}">${rc}</row>`); rIdx++;
            });
        }
        // column widths
        let colsXml = '<cols>';
        cols.forEach((c, i) => { colsXml += `<col min="${i + 1}" max="${i + 1}" width="${Math.max(8, c.w || 14)}" customWidth="1"/>`; });
        colsXml += '</cols>';
        // merge title across columns
        const merges = [];
        if (opt.title) merges.push(`A1:${lastCol}1`);
        if (opt.subtitle) merges.push(`A2:${lastCol}2`);
        const mergeXml = merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
        const freeze = `<sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${headerRow + 1}" sqref="A${headerRow + 1}"/></sheetView>`;
        const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews>${freeze}</sheetViews>${colsXml}<sheetData>${sheetRows.join('')}</sheetData>${mergeXml}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/></worksheet>`;

        const sheetName = (opt.kind === 'finance' ? 'Финансы' : (opt.isPurchases ? 'Покупки' : 'Продажи'));
        const files = [
            { name: '[Content_Types].xml', data: strBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
            { name: '_rels/.rels', data: strBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
            { name: 'xl/workbook.xml', data: strBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
            { name: 'xl/_rels/workbook.xml.rels', data: strBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
            { name: 'xl/styles.xml', data: strBytes(stylesXml) },
            { name: 'xl/worksheets/sheet1.xml', data: strBytes(sheetXml) }
        ];
        return new Blob([zipBuild(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    };

    // ──────────────────────────────────────────────────────────────────────────
    //  DOCX (WordprocessingML, собранный вручную в ZIP)
    //  Заголовок крупным акцентным цветом, подзаголовок серым, цветная таблица
    //  с шапкой темы и зеброй, строки итогов.
    // ──────────────────────────────────────────────────────────────────────────
    function wpText(t, opt) {
        opt = opt || {};
        const rpr = [];
        if (opt.b) rpr.push('<w:b/>');
        if (opt.color) rpr.push(`<w:color w:val="${opt.color}"/>`);
        if (opt.sz) rpr.push(`<w:sz w:val="${opt.sz}"/>`);
        rpr.push('<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>');
        return `<w:r><w:rPr>${rpr.join('')}</w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;
    }
    function wpPara(runs, opt) {
        opt = opt || {};
        const ppr = [];
        const jc = opt.align === 'r' ? 'right' : opt.align === 'c' ? 'center' : 'left';
        ppr.push(`<w:jc w:val="${jc}"/>`);
        if (opt.spacing) ppr.push(`<w:spacing w:after="${opt.spacing}" w:line="240" w:lineRule="auto"/>`);
        else ppr.push('<w:spacing w:after="40" w:line="240" w:lineRule="auto"/>');
        if (opt.shade) ppr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${opt.shade}"/>`);
        return `<w:p><w:pPr>${ppr.join('')}</w:pPr>${runs}</w:p>`;
    }
    function tcell(text, opt) {
        opt = opt || {};
        const tcPr = [];
        if (opt.w) tcPr.push(`<w:tcW w:w="${opt.w}" w:type="dxa"/>`);
        if (opt.fill) tcPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${opt.fill}"/>`);
        tcPr.push('<w:vAlign w:val="center"/>');
        tcPr.push('<w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>');
        const run = wpText(text, { b: opt.b, color: opt.color, sz: opt.sz || 18 });
        return `<w:tc><w:tcPr>${tcPr.join('')}</w:tcPr>${wpPara(run, { align: opt.align, spacing: 0 })}</w:tc>`;
    }
    ES.buildDOCX = function (cols, rows, opt) {
        const th = opt.themeObj || ES._util.themeFromColor(opt.color || '#2563EB');
        const totalW = 9600; // twips, A4 landscape usable ~ 14400; portrait ~9360
        const land = opt.orientation === 'landscape';
        const usable = land ? 14400 : 9360;
        const sumW = cols.reduce((s, c) => s + (c.w || 14), 0);
        const colW = cols.map(c => Math.round(usable * (c.w || 14) / sumW));

        const body = [];
        if (opt.title) body.push(wpPara(wpText(opt.title, { b: true, sz: 40, color: th.accent }), { spacing: 60 }));
        if (opt.subtitle) body.push(wpPara(wpText(opt.subtitle, { sz: 20, color: '808080' }), { spacing: 160 }));

        // table
        const gridCols = colW.map(w => `<w:gridCol w:w="${w}"/>`).join('');
        const rowsXml = [];
        // header
        const hcells = cols.map((c, i) => tcell(c.label, { w: colW[i], fill: th.headerBg, color: th.headerText, b: true, align: c.align === 'r' ? 'r' : c.align === 'c' ? 'c' : 'l' })).join('');
        rowsXml.push(`<w:tr><w:trPr><w:tblHeader/></w:trPr>${hcells}</w:tr>`);
        // data
        rows.forEach((rec, n) => {
            const fill = (opt.zebra && n % 2 === 1) ? th.zebra : null;
            const cells = cols.map((c, i) => tcell(c.disp(rec), { w: colW[i], fill, align: c.align === 'r' ? 'r' : c.align === 'c' ? 'c' : 'l' })).join('');
            rowsXml.push(`<w:tr>${cells}</w:tr>`);
        });
        const borders = `<w:tblBorders><w:top w:val="single" w:sz="4" w:color="${th.grid}"/><w:left w:val="single" w:sz="4" w:color="${th.grid}"/><w:bottom w:val="single" w:sz="4" w:color="${th.grid}"/><w:right w:val="single" w:sz="4" w:color="${th.grid}"/><w:insideH w:val="single" w:sz="4" w:color="${th.grid}"/><w:insideV w:val="single" w:sz="4" w:color="${th.grid}"/></w:tblBorders>`;
        const table = `<w:tbl><w:tblPr><w:tblW w:w="${usable}" w:type="dxa"/>${borders}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${gridCols}</w:tblGrid>${rowsXml.join('')}</w:tbl>`;
        body.push(table);

        if (opt.totals) {
            body.push(wpPara(wpText('', {}), { spacing: 120 }));
            body.push(wpPara(wpText('Итоги', { b: true, sz: 24, color: th.accent }), { spacing: 80 }));
            ES._summaryLines(ES.summarize(opt.kind, rows)).forEach(([k, v]) => {
                body.push(wpPara(wpText(k + ':  ', { b: true, sz: 20 }) + wpText(v, { sz: 20 }), { spacing: 40 }));
            });
        }
        if (opt.watermark) {
            body.push(wpPara(wpText('Сгенерировано в FunPay Funcy · Export Studio · ' + fmtDateTime(Date.now()), { sz: 16, color: 'A0A0A0' }), { spacing: 0, align: 'c' }));
        }

        const sect = land
            ? '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>'
            : '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr>';

        const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}${sect}</w:body></w:document>`;

        const files = [
            { name: '[Content_Types].xml', data: strBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`) },
            { name: '_rels/.rels', data: strBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
            { name: 'word/document.xml', data: strBytes(docXml) }
        ];
        return new Blob([zipBuild(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    };

    // ──────────────────────────────────────────────────────────────────────────
    //  PDF — рисуем страницы на <canvas> (идеальная кириллица + любой стиль),
    //  каждую страницу вставляем PNG-картинкой в нативный PDF. Без библиотек.
    // ──────────────────────────────────────────────────────────────────────────
    function canvasPages(cols, rows, opt) {
        const th = opt.themeObj || ES._util.themeFromColor(opt.color || '#2563EB');
        const land = opt.orientation === 'landscape';
        const scale = 2; // ретина
        // размеры страницы в "точках" (pt) при 72dpi: A4 = 595x842
        const PW = (land ? 842 : 595);
        const PH = (land ? 595 : 842);
        const W = PW * scale, H = PH * scale;
        const M = 36 * scale; // поля
        const accent = '#' + th.accent, headBg = '#' + th.headerBg, headTx = '#' + th.headerText;
        const zebra = '#' + th.zebra, textCol = '#' + th.text, gridCol = '#' + th.grid, totalBg = '#' + th.total;

        // ── авто-подбор: измеряем реальную ширину текста в каждой колонке и
        //    подбираем размер шрифта так, чтобы ВСЁ влезло без обрезки «…» ──
        const innerW = W - M * 2;
        const padX = 10 * scale;      // отступ текста внутри ячейки
        const headH = 26 * scale;
        const FS_MAX = 11 * scale;    // желаемый кегль
        const FS_MIN = 5.5 * scale;   // минимальный, ниже не опускаемся

        // измеритель: максимальная ширина контента колонки при заданном кегле
        const _mcv = document.createElement('canvas');
        const _mctx = _mcv.getContext('2d');
        function colContentWidth(c, fs) {
            _mctx.font = `bold ${fs}px Inter, Arial, sans-serif`;
            let max = _mctx.measureText(String(c.label)).width;
            _mctx.font = `${fs}px Inter, Arial, sans-serif`;
            for (const rec of rows) {
                const t = String(c.disp(rec) == null ? '' : c.disp(rec));
                const w = _mctx.measureText(t).width;
                if (w > max) max = w;
            }
            return max;
        }
        // ищем самый большой кегль, при котором сумма колонок ≤ доступной ширины
        let fontBase = FS_MAX, colW = null;
        for (let fs = FS_MAX; fs >= FS_MIN; fs -= 0.5 * scale) {
            const widths = cols.map(c => colContentWidth(c, fs) + padX * 2);
            const total = widths.reduce((s, w) => s + w, 0);
            if (total <= innerW) {
                // влезает: распределим остаток пропорционально, чтобы заполнить ширину
                const extra = innerW - total;
                colW = widths.map(w => w + extra * (w / total));
                fontBase = fs;
                break;
            }
        }
        // если даже на минимальном кегле не влезло — масштабируем ширины вниз
        // (текст всё равно рисуем целиком; на практике айди/суммы помещаются)
        if (!colW) {
            fontBase = FS_MIN;
            const widths = cols.map(c => colContentWidth(c, FS_MIN) + padX * 2);
            const total = widths.reduce((s, w) => s + w, 0);
            const k = innerW / total;
            colW = widths.map(w => w * k);
        }

        const rowH = Math.max(16 * scale, fontBase + 9 * scale);
        const pages = [];
        let cv, ctx, y;

        function newPage(withTitle) {
            cv = document.createElement('canvas');
            cv.width = W; cv.height = H;
            ctx = cv.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
            ctx.textBaseline = 'middle';
            y = M;
            if (withTitle && opt.title) {
                ctx.fillStyle = accent;
                ctx.font = `bold ${20 * scale}px Inter, Arial, sans-serif`;
                ctx.textAlign = 'left';
                ctx.fillText(opt.title, M, y + 14 * scale);
                y += 30 * scale;
                if (opt.subtitle) {
                    ctx.fillStyle = '#8a8a94';
                    ctx.font = `${11 * scale}px Inter, Arial, sans-serif`;
                    ctx.fillText(opt.subtitle, M, y + 8 * scale);
                    y += 22 * scale;
                }
                y += 6 * scale;
            }
        }
        function drawHeader() {
            ctx.fillStyle = headBg;
            roundRect(ctx, M, y, innerW, headH, 6 * scale); ctx.fill();
            let x = M;
            ctx.font = `bold ${fontBase}px Inter, Arial, sans-serif`;
            ctx.fillStyle = headTx;
            cols.forEach((c, i) => {
                const w = colW[i];
                ctx.textAlign = c.align === 'r' ? 'right' : c.align === 'c' ? 'center' : 'left';
                const tx = c.align === 'r' ? x + w - padX : c.align === 'c' ? x + w / 2 : x + padX;
                ctx.fillText(String(c.label), tx, y + headH / 2);
                x += w;
            });
            y += headH;
        }
        function roundRect(c, x, yy, w, h, r) {
            c.beginPath();
            c.moveTo(x + r, yy); c.arcTo(x + w, yy, x + w, yy + h, r);
            c.arcTo(x + w, yy + h, x, yy + h, r); c.arcTo(x, yy + h, x, yy, r);
            c.arcTo(x, yy, x + w, yy, r); c.closePath();
        }
        function drawRow(rec, n) {
            if (opt.zebra && n % 2 === 1) { ctx.fillStyle = zebra; ctx.fillRect(M, y, innerW, rowH); }
            ctx.strokeStyle = gridCol; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(M, y + rowH); ctx.lineTo(M + innerW, y + rowH); ctx.stroke();
            let x = M;
            ctx.font = `${fontBase}px Inter, Arial, sans-serif`;
            cols.forEach((c, i) => {
                const w = colW[i];
                const isMoney = c.num;
                ctx.fillStyle = isMoney ? (Number(c.get(rec)) < 0 ? '#dc2626' : textCol) : textCol;
                ctx.textAlign = c.align === 'r' ? 'right' : c.align === 'c' ? 'center' : 'left';
                const tx = c.align === 'r' ? x + w - padX : c.align === 'c' ? x + w / 2 : x + padX;
                ctx.fillText(String(c.disp(rec) == null ? '' : c.disp(rec)), tx, y + rowH / 2);
                x += w;
            });
            y += rowH;
        }
        function footerStamp() {
            if (!opt.watermark && !opt.pageNumbers) return;
            ctx.fillStyle = '#b8b8c0';
            ctx.font = `${9 * scale}px Inter, Arial, sans-serif`;
            if (opt.watermark) { ctx.textAlign = 'left'; ctx.fillText('FunPay Funcy · Export Studio', M, H - 18 * scale); }
            if (opt.pageNumbers) { ctx.textAlign = 'right'; ctx.fillText('стр. ' + (pages.length + 1), W - M, H - 18 * scale); }
        }

        // paginate
        newPage(true); drawHeader();
        rows.forEach((rec, n) => {
            if (y + rowH > H - M - 30 * scale) {
                footerStamp(); pages.push(cv);
                newPage(false); drawHeader();
            }
            drawRow(rec, n);
        });
        // totals block
        if (opt.totals) {
            const lines = ES._summaryLines(ES.summarize(opt.kind, rows));
            const blockH = (lines.length + 1) * (20 * scale) + 16 * scale;
            if (y + blockH > H - M - 30 * scale) { footerStamp(); pages.push(cv); newPage(false); }
            y += 14 * scale;
            ctx.fillStyle = totalBg; roundRect(ctx, M, y, innerW, blockH, 8 * scale); ctx.fill();
            let ty = y + 14 * scale;
            ctx.textAlign = 'left';
            ctx.fillStyle = accent; ctx.font = `bold ${13 * scale}px Inter, Arial, sans-serif`;
            ctx.fillText('Итоги', M + 14 * scale, ty + 6 * scale); ty += 24 * scale;
            ctx.font = `${11 * scale}px Inter, Arial, sans-serif`;
            lines.forEach(([k, v]) => {
                ctx.fillStyle = '#555'; ctx.fillText(k, M + 14 * scale, ty + 6 * scale);
                ctx.fillStyle = textCol; ctx.font = `bold ${11 * scale}px Inter, Arial, sans-serif`;
                ctx.textAlign = 'right'; ctx.fillText(v, M + innerW - 14 * scale, ty + 6 * scale);
                ctx.textAlign = 'left'; ctx.font = `${11 * scale}px Inter, Arial, sans-serif`;
                ty += 20 * scale;
            });
            y += blockH;
        }
        footerStamp(); pages.push(cv);
        return { pages, PW, PH, scale };
    }

    ES.buildPDF = async function (cols, rows, opt) {
        const { pages, PW, PH } = canvasPages(cols, rows, opt);
        // каждую страницу кодируем в JPEG (PDF /DCTDecode принимает JPEG напрямую)
        const images = [];
        for (const cv of pages) {
            const dataUrl = cv.toDataURL('image/jpeg', 0.92);
            const b64 = dataUrl.split(',')[1];
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            images.push({ bytes, w: cv.width, h: cv.height });
        }
        return assemblePDF(images, PW, PH);
    };

    // Собираем минимальный валидный PDF: каждая страница = полноразмерное PNG.
    function assemblePDF(images, PW, PH) {
        const enc = new TextEncoder();
        const objects = []; // {bytes}
        const chunks = [];
        let length = 0;
        const offsets = [];
        function push(bytes) { chunks.push(bytes); length += bytes.length; }
        function pushStr(s) { push(enc.encode(s)); }

        const n = images.length;
        // Объекты: 1 Catalog, 2 Pages, затем для каждой стр: Page, XObject(image), Content
        // Нумерация: 1 catalog, 2 pages,
        //   page i -> obj id: 3 + i*3, content -> 4 + i*3, image -> 5 + i*3
        const pageIds = [], contentIds = [], imageIds = [];
        for (let i = 0; i < n; i++) { pageIds.push(3 + i * 3); contentIds.push(4 + i * 3); imageIds.push(5 + i * 3); }
        const totalObjs = 2 + n * 3;

        const objOffset = {};
        function beginObj(id) { objOffset[id] = length; pushStr(id + ' 0 obj\n'); }
        function endObj() { pushStr('endobj\n'); }

        pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

        // 1 Catalog
        beginObj(1); pushStr('<< /Type /Catalog /Pages 2 0 R >>\n'); endObj();
        // 2 Pages
        beginObj(2);
        pushStr('<< /Type /Pages /Count ' + n + ' /Kids [' + pageIds.map(id => id + ' 0 R').join(' ') + '] >>\n');
        endObj();

        for (let i = 0; i < n; i++) {
            const pid = pageIds[i], cid = contentIds[i], iid = imageIds[i];
            // Page
            beginObj(pid);
            pushStr('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] '
                + '/Resources << /XObject << /Im0 ' + iid + ' 0 R >> >> '
                + '/Contents ' + cid + ' 0 R >>\n');
            endObj();
            // Content stream: рисуем картинку на весь лист
            const content = 'q\n' + PW + ' 0 0 ' + PH + ' 0 0 cm\n/Im0 Do\nQ\n';
            const cbytes = enc.encode(content);
            beginObj(cid);
            pushStr('<< /Length ' + cbytes.length + ' >>\nstream\n');
            push(cbytes);
            pushStr('\nendstream\n');
            endObj();
            // Image XObject — страница как JPEG (DCTDecode)
            beginObj(iid);
            const img = images[i];
            pushStr('<< /Type /XObject /Subtype /Image /Width ' + img.w + ' /Height ' + img.h
                + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.bytes.length + ' >>\nstream\n');
            push(img.bytes);
            pushStr('\nendstream\n');
            endObj();
        }

        // xref
        const xrefStart = length;
        pushStr('xref\n0 ' + (totalObjs + 1) + '\n');
        pushStr('0000000000 65535 f \n');
        for (let id = 1; id <= totalObjs; id++) {
            const off = String(objOffset[id] || 0).padStart(10, '0');
            pushStr(off + ' 00000 n \n');
        }
        pushStr('trailer\n<< /Size ' + (totalObjs + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF');

        const out = new Uint8Array(length);
        let pos = 0;
        for (const c of chunks) { out.set(c, pos); pos += c.length; }
        return new Blob([out], { type: 'application/pdf' });
    }
    ES._assemblePDF = assemblePDF;
})();

// =============================================================================
//  FunPay Funcy — Export Studio :: UI (модалка, кнопки, сбор данных)
// =============================================================================
(function () {
    'use strict';
    const ES = window.FPTExportStudio;
    const { esc, fmtDate, fmtDateTime, fmtMoney, downloadBlob, nowStamp, SYM, themeFromColor, hslToHex, hexToHsl } = ES._util;

    // ── определяем контекст страницы: что экспортируем и откуда брать данные ──
    function detectContext() {
        const p = window.location.pathname;
        if (/^\/orders\/trade\/?$/.test(p)) {
            return { kind: 'sales', isPurchases: false, db: () => (window.fptOrdersDB || window.FPTSalesDB), titleDefault: 'Отчёт по продажам' };
        }
        if (/^\/orders\/?$/.test(p)) {
            return { kind: 'sales', isPurchases: true, db: () => (window.fptOrdersDB || window.FPTPurchasesDB), titleDefault: 'Отчёт по покупкам' };
        }
        if (/^\/account\/balance\/?$/.test(p)) {
            return { kind: 'finance', isPurchases: false, db: () => window.FPTFinanceDB, titleDefault: 'Финансовый отчёт' };
        }
        return null;
    }

    // ── период ──
    const PERIODS = [
        { v: 'all', l: 'Всё время' },
        { v: 'today', l: 'Сегодня' },
        { v: '7d', l: '7 дней' },
        { v: '30d', l: '30 дней' },
        { v: '90d', l: '90 дней' },
        { v: '365d', l: 'Год' },
        { v: 'custom', l: 'Свой диапазон' }
    ];
    function periodRange(v, from, to) {
        const day = 86400000, now = Date.now();
        const d = new Date(); const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        switch (v) {
            case 'today': return { start: todayStart, end: null };
            case '7d': return { start: now - 7 * day, end: null };
            case '30d': return { start: now - 30 * day, end: null };
            case '90d': return { start: now - 90 * day, end: null };
            case '365d': return { start: now - 365 * day, end: null };
            case 'custom': return {
                start: from ? new Date(from).getTime() : null,
                end: to ? (new Date(to).getTime() + day - 1) : null
            };
            default: return { start: null, end: null };
        }
    }
    function periodLabel(v, from, to) {
        if (v === 'custom') return (from ? fmtDate(new Date(from).getTime()) : '…') + ' — ' + (to ? fmtDate(new Date(to).getTime()) : '…');
        return (PERIODS.find(p => p.v === v) || {}).l || '';
    }

    // ── собираем строки данных с учётом фильтров ──
    async function gatherRows(ctx, cfg) {
        const db = ctx.db();
        let rows = await db.getAllAsArray();
        const r = periodRange(cfg.period, cfg.from, cfg.to);
        if (ctx.kind === 'finance') {
            rows = rows.filter(t => {
                if (r.start && t.date < r.start) return false;
                if (r.end && t.date > r.end) return false;
                if (cfg.finStatus !== 'all' && t.status !== cfg.finStatus) return false;
                if (cfg.finType !== 'all' && t.type !== cfg.finType) return false;
                if (cfg.currency !== 'all' && (t.currency || 'UNKNOWN') !== cfg.currency) return false;
                return true;
            });
            rows.sort((a, b) => cfg.sort === 'date-asc' ? a.date - b.date
                : cfg.sort === 'amt-desc' ? Math.abs(b.signed) - Math.abs(a.signed)
                    : cfg.sort === 'amt-asc' ? Math.abs(a.signed) - Math.abs(b.signed)
                        : b.date - a.date);
        } else {
            rows = rows.filter(o => {
                if (r.start && o.orderDate < r.start) return false;
                if (r.end && o.orderDate > r.end) return false;
                if (!cfg.stClosed && o.orderStatus === 'closed') return false;
                if (!cfg.stPaid && o.orderStatus === 'paid') return false;
                if (!cfg.stRefunded && o.orderStatus === 'refunded') return false;
                if (cfg.currency !== 'all' && (o.currency || 'UNKNOWN') !== cfg.currency) return false;
                return true;
            });
            rows.sort((a, b) => cfg.sort === 'date-asc' ? (a.orderDate || 0) - (b.orderDate || 0)
                : cfg.sort === 'price-desc' ? (b.price || 0) - (a.price || 0)
                    : cfg.sort === 'price-asc' ? (a.price || 0) - (b.price || 0)
                        : (b.orderDate || 0) - (a.orderDate || 0));
        }
        return rows;
    }

    // ── доступные валюты в данных (для выпадашки) ──
    async function detectCurrencies(ctx) {
        try {
            const rows = await ctx.db().getAllAsArray();
            const set = new Set();
            rows.forEach(x => { const c = ctx.kind === 'finance' ? x.currency : x.currency; if (c) set.add(c); });
            return Array.from(set);
        } catch (_) { return []; }
    }

    // ── ОФОРМЛЕНИЕ модалки ──
    // Окно живёт в shadow root: тема сайта и стили MagicStick (все с !important) до него не
    // достают. Палитра та же, что у окна расширения (fptMenuPalette в content/ui/main_popup.js).
    const STUDIO_ACCENT = '#7663f6';
    const HOST_CSS = 'all: initial !important; position: fixed !important; inset: 0 !important;'
        + ' z-index: 2147483600 !important; display: block !important;';

    function studioPalette() {
        let light = true;
        try { if (typeof fptParseMenuColors === 'function') light = !!fptParseMenuColors().isLight; } catch (_) {}
        const p = (typeof fptMenuPalette === 'function') ? fptMenuPalette(light) : (light
            ? { bg: '#ffffff', text: '#16181d', muted: 'rgba(22,24,29,0.74)', faint: 'rgba(22,24,29,0.56)', border: 'rgba(22,24,29,0.10)',
                surface: '#f5f7fa', surface2: '#eef1f6', hover: 'rgba(22,24,29,0.05)', field: '#ffffff', shadow: 'rgba(22,24,29,0.16)',
                navSurface: '#fbfaff', navField: '#f4f3ff', navBorder: 'rgba(119,99,246,0.16)' }
            : { bg: '#1e1f24', text: '#e7e8ec', muted: 'rgba(231,232,236,0.76)', faint: 'rgba(231,232,236,0.56)', border: 'rgba(255,255,255,0.10)',
                surface: '#26272d', surface2: '#2c2e35', hover: 'rgba(255,255,255,0.07)', field: '#26272d', shadow: 'rgba(0,0,0,0.55)',
                navSurface: '#24262d', navField: '#2a2e37', navBorder: 'rgba(255,255,255,0.10)' });
        return {
            '--bg': p.bg, '--text': p.text, '--muted': p.muted, '--faint': p.faint, '--border': p.border,
            '--surface': p.surface, '--surface2': p.surface2, '--hover': p.hover, '--field': p.navField || p.field,
            '--shadow': p.shadow, '--card': p.navSurface || p.surface, '--card-border': p.navBorder || p.border,
            '--accent': STUDIO_ACCENT,
            '--accent-soft': light ? 'rgba(118,99,246,0.12)' : 'rgba(118,99,246,0.22)',
            '--accent-border': light ? 'rgba(118,99,246,0.35)' : 'rgba(118,99,246,0.5)',
            '--scrim': light ? 'rgba(22,24,29,0.38)' : 'rgba(5,6,10,0.62)',
            'color-scheme': light ? 'light' : 'dark'
        };
    }

    const STUDIO_CSS = `
        :host { all: initial; }
        * { box-sizing: border-box; }
        .ico { font-family: 'Material Symbols Rounded'; font-weight: normal; font-style: normal; font-size: 20px;
            line-height: 1; letter-spacing: normal; text-transform: none; display: inline-block; white-space: nowrap;
            direction: ltr; font-feature-settings: 'liga'; -webkit-font-smoothing: antialiased; user-select: none; }
        .ov { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px;
            background: var(--scrim); font-family: Inter, 'Segoe UI', system-ui, -apple-system, sans-serif;
            color: var(--text); font-size: 14px; line-height: 1.45; -webkit-font-smoothing: antialiased;
            animation: es-fade .18s ease both; }
        .ov.is-closing { animation: es-fade-out .16s ease both; }
        .modal { width: min(1060px, 100%); max-height: min(900px, calc(100vh - 32px)); display: flex; flex-direction: column;
            overflow: hidden; background: var(--bg); border: 1px solid var(--card-border); border-radius: 24px;
            box-shadow: 0 28px 80px var(--shadow); animation: es-pop .24s cubic-bezier(.22, 1, .36, 1) both; outline: none; }
        .ov.is-closing .modal { animation: es-pop-out .16s ease both; }

        .head { display: flex; align-items: center; gap: 14px; padding: 18px 20px 16px 22px; border-bottom: 1px solid var(--border); }
        .emblem { flex: 0 0 44px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
            border-radius: 14px; background: var(--accent-soft); color: var(--accent); font-size: 24px; }
        .head-copy { flex: 1; min-width: 0; }
        .head h2 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -.02em; line-height: 1.25; }
        .head p { margin: 4px 0 0; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--muted); font-size: 12.5px; }
        .kind { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px 3px 7px; border-radius: 999px;
            background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 650; }
        .kind .ico { font-size: 16px; }
        .icon-btn { flex: 0 0 auto; width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center;
            border: 0; border-radius: 12px; background: transparent; color: var(--muted); cursor: pointer;
            transition: background .16s ease, color .16s ease; font: inherit; }
        .icon-btn:hover { background: var(--hover); color: var(--text); }
        .icon-btn:focus-visible, .btn:focus-visible, .chip:focus-visible, .fmt:focus-visible, .dot:focus-visible,
        .seg button:focus-visible, .switch input:focus-visible + .track, .link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        .body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 330px; overflow: hidden; }
        .settings { min-width: 0; overflow-y: auto; padding: 18px 18px 22px 22px; display: flex; flex-direction: column; gap: 14px;
            scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
        .side { min-width: 0; overflow-y: auto; padding: 18px 22px 22px 6px; display: flex; flex-direction: column; gap: 12px; }
        .side-sticky { position: sticky; top: 0; display: flex; flex-direction: column; gap: 12px; }

        .card { border: 1px solid var(--card-border); border-radius: 18px; background: var(--card); padding: 16px 16px 18px; }
        .card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .card-ico { flex: 0 0 32px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
            border-radius: 10px; background: var(--accent-soft); color: var(--accent); font-size: 19px; }
        .card-title { flex: 1; min-width: 0; margin: 0; font-size: 14.5px; font-weight: 650; letter-spacing: -.01em; }
        .card-note { color: var(--faint); font-size: 12px; font-weight: 500; }
        .label { display: block; margin: 0 0 8px; color: var(--muted); font-size: 12px; font-weight: 600; }
        .group { margin-top: 16px; }
        .card-head + .group { margin-top: 0; }
        [hidden] { display: none !important; }

        .fmts { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
        .fmt { position: relative; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;
            padding: 14px 6px 12px; border: 1.5px solid var(--border); border-radius: 14px; background: var(--bg);
            color: var(--text); cursor: pointer; font: inherit; text-align: center;
            transition: border-color .16s ease, background .16s ease, transform .16s ease; }
        .fmt:hover { border-color: var(--accent-border); }
        .fmt:active { transform: scale(.98); }
        .fmt .fmt-ico { font-size: 26px; color: var(--muted); transition: color .16s ease; }
        .fmt-ext { font-size: 13px; font-weight: 750; letter-spacing: .02em; }
        .fmt-ds { max-width: 100%; overflow: hidden; color: var(--faint); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
        .fmt-check { position: absolute; top: 7px; right: 7px; font-size: 18px; color: var(--accent); opacity: 0; transform: scale(.6);
            transition: opacity .16s ease, transform .2s cubic-bezier(.2, 1.4, .4, 1); font-variation-settings: 'FILL' 1; }
        .fmt[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
        .fmt[aria-pressed="true"] .fmt-ico, .fmt[aria-pressed="true"] .fmt-ext { color: var(--accent); }
        .fmt[aria-pressed="true"] .fmt-check { opacity: 1; transform: scale(1); }

        .colors { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
        .dot { width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; background: var(--c);
            box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); transition: transform .16s ease, box-shadow .16s ease; }
        .dot:hover { transform: scale(1.08); }
        .dot[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--c); }
        .picker { position: relative; width: 30px; height: 30px; border-radius: 50%; overflow: hidden; cursor: pointer;
            display: inline-flex; align-items: center; justify-content: center; color: var(--muted);
            border: 1.5px dashed var(--border); transition: border-color .16s ease, color .16s ease; }
        .picker:hover { border-color: var(--accent-border); color: var(--accent); }
        .picker input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: 0; padding: 0; }
        .picker .ico { font-size: 18px; pointer-events: none; }
        .current { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; padding: 5px 10px 5px 6px;
            border-radius: 999px; background: var(--surface2); font: 600 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
        .current i { width: 18px; height: 18px; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
        .sliders { margin-top: 14px; display: grid; gap: 12px; }
        .slider-row { display: grid; grid-template-columns: 64px minmax(0, 1fr); align-items: center; gap: 10px; color: var(--muted); font-size: 12px; font-weight: 600; }
        .track-h { position: relative; height: 14px; border-radius: 999px; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); touch-action: none; }
        .spectrum { background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%); }
        .knob { position: absolute; top: 50%; width: 18px; height: 18px; border-radius: 50%; background: #fff; pointer-events: none;
            border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4), inset 0 0 0 1px rgba(0,0,0,.12); transform: translate(-50%, -50%); }

        .seg { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 4px; border-radius: 14px; background: var(--surface2); }
        .seg button { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 0; border-radius: 10px;
            background: transparent; color: var(--muted); font-family: inherit; font-size: 13px; font-weight: 600; line-height: 1; cursor: pointer;
            transition: background .16s ease, color .16s ease, box-shadow .16s ease; }
        .seg button .ico { font-size: 18px; }
        .seg button:hover { color: var(--text); }
        .seg button[aria-checked="true"] { background: var(--bg); color: var(--accent); box-shadow: 0 1px 5px var(--shadow); }

        .chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .chip { display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 12px; border: 1px solid var(--border);
            border-radius: 999px; background: var(--bg); color: var(--text); font-family: inherit; font-size: 12.5px; font-weight: 550; line-height: 1;
            cursor: pointer; user-select: none; transition: background .14s ease, border-color .14s ease, color .14s ease; }
        .chip:hover { border-color: var(--accent-border); }
        .chip .ico { width: 0; overflow: hidden; font-size: 16px; transition: width .16s ease; }
        .chip[aria-pressed="true"] { border-color: var(--accent-border); background: var(--accent-soft); color: var(--accent); font-weight: 650; }
        .chip[aria-pressed="true"] .ico { width: 16px; }
        .row-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
        .links { display: inline-flex; gap: 12px; }
        .link { padding: 0; border: 0; background: none; color: var(--accent); font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
        .link:hover { text-decoration: underline; }

        .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .input { width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: 12px;
            background: var(--field); color: var(--text); font-family: inherit; font-size: 14px; outline: none;
            color-scheme: inherit; transition: border-color .16s ease, box-shadow .16s ease; }
        .input::placeholder { color: var(--faint); }
        .input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
        .range { margin-top: 10px; }

        .toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
        .toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 40px; padding: 4px 2px;
            cursor: pointer; font-size: 13.5px; user-select: none; }
        .toggle-copy { display: flex; align-items: center; gap: 9px; min-width: 0; }
        .toggle-copy .ico { color: var(--muted); font-size: 19px; }
        .switch { position: relative; flex: 0 0 40px; width: 40px; height: 22px; }
        .switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
        .track { position: absolute; inset: 0; border-radius: 999px; background: color-mix(in srgb, var(--muted) 34%, var(--surface2));
            transition: background .2s ease; }
        .track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .4s cubic-bezier(.2, 1.45, .4, 1); }
        .switch input:checked + .track { background: var(--accent); }
        .switch input:checked + .track::after { transform: translateX(18px); }

        .side-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .side-title { margin: 0; font-size: 14.5px; font-weight: 650; }
        .tag { padding: 3px 9px; border-radius: 999px; background: var(--surface2); color: var(--muted); font-size: 11.5px; font-weight: 650; }
        .paper-wrap { padding: 16px; border-radius: 18px; background: var(--surface2); display: flex; justify-content: center; }
        .paper { width: 100%; aspect-ratio: 1.414 / 1; display: flex; flex-direction: column; overflow: hidden; border-radius: 6px;
            background: #fff; color: #1a1a1a; box-shadow: 0 6px 22px rgba(0,0,0,.18); font-size: 7.5px; line-height: 1.35;
            transition: aspect-ratio .3s ease, width .3s ease; }
        .paper[data-orient="portrait"] { width: 74%; aspect-ratio: 1 / 1.414; }
        .paper[data-plain="true"] .band { background: #f2f3f5 !important; color: #1a1a1a !important; }
        .band { padding: 9px 10px 8px; transition: background .2s ease, color .2s ease; }
        .band b { display: block; overflow: hidden; font-size: 10px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
        .band span { display: block; overflow: hidden; margin-top: 1px; opacity: .82; text-overflow: ellipsis; white-space: nowrap; }
        .sheet { flex: 1; min-height: 0; padding: 7px 8px 0; overflow: hidden; }
        .sheet table { width: 100%; border-collapse: collapse; table-layout: fixed; font: inherit; color: inherit; }
        .sheet th, .sheet td { padding: 3px 4px; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
        .sheet th { font-weight: 700; }
        .sheet td { border-bottom: 0.5px solid var(--grid, #e5e7eb); }
        .sheet .r { text-align: right; }
        .totals { margin: 6px 8px 0; padding: 5px 7px; border-radius: 3px; font-weight: 700; display: flex; justify-content: space-between; gap: 6px; }
        .paper-foot { display: flex; justify-content: space-between; padding: 5px 8px 6px; color: #8a8f98; font-size: 6.5px; }
        .empty-cell { color: #b0b4bb; }
        .stats { display: grid; gap: 8px; padding: 14px; border-radius: 16px; border: 1px solid var(--card-border); background: var(--card); }
        .stat-line { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 12.5px; }
        .stat-line .ico { color: var(--accent); font-size: 19px; }
        .stat-line b { color: var(--text); font-size: 15px; font-weight: 750; }

        .foot { display: flex; align-items: center; gap: 10px; padding: 14px 20px 16px 22px; border-top: 1px solid var(--border); }
        .foot-note { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; color: var(--faint); font-size: 12px; }
        .foot-note .ico { font-size: 17px; }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 18px; border-radius: 13px;
            font-family: inherit; font-size: 14px; font-weight: 650; line-height: 1; cursor: pointer; white-space: nowrap;
            transition: filter .16s ease, background .16s ease, border-color .16s ease, transform .16s ease; }
        .btn:active { transform: scale(.98); }
        .btn .ico { font-size: 19px; }
        .btn.ghost { border: 1px solid var(--border); background: transparent; color: var(--text); }
        .btn.ghost:hover { background: var(--hover); }
        .btn.primary { min-width: 190px; border: 0; background: var(--accent); color: #fff; box-shadow: 0 6px 18px rgba(118,99,246,.35); }
        .btn.primary:hover { filter: brightness(1.07); }
        .btn:disabled { opacity: .7; cursor: default; filter: none; transform: none; }
        .spin { width: 16px; height: 16px; border: 2.5px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%;
            animation: es-spin .7s linear infinite; }

        @keyframes es-spin { to { transform: rotate(360deg); } }
        @keyframes es-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes es-fade-out { to { opacity: 0; } }
        @keyframes es-pop { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
        @keyframes es-pop-out { to { opacity: 0; transform: translateY(6px) scale(.985); } }
        @media (prefers-reduced-motion: reduce) {
            .ov, .ov.is-closing, .modal, .ov.is-closing .modal { animation: none; }
        }
        @media (max-width: 860px) {
            .body { grid-template-columns: 1fr; overflow-y: auto; }
            .settings, .side { overflow: visible; }
            .side { padding: 0 18px 22px; }
            .side-sticky { position: static; }
            .paper-wrap { max-width: 420px; width: 100%; align-self: center; }
        }
        @media (max-width: 620px) {
            .fmts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .fields, .toggles { grid-template-columns: 1fr; }
            .foot-note { display: none; }
            .btn.primary { min-width: 0; flex: 1; }
            .head { padding: 14px 14px 12px 16px; }
            .settings { padding: 14px; }
        }
    `;

    // ── конфиг по умолчанию (запоминаем в localStorage) ──
    const CFG_KEY = 'fpToolsExportStudioCfg';
    function loadCfg(ctx) {
        const def = {
            formats: ['xlsx'], color: '#2563EB', period: 'all', from: '', to: '',
            currency: 'all', sort: ctx.kind === 'finance' ? 'date-desc' : 'date-desc',
            title: ctx.titleDefault, subtitle: '',
            zebra: true, totals: true, watermark: true, pageNumbers: true,
            orientation: 'landscape', csvSep: ';',
            stClosed: true, stPaid: true, stRefunded: ctx.isPurchases ? false : true,
            finStatus: 'all', finType: 'all',
            cols: null
        };
        try {
            const raw = localStorage.getItem(CFG_KEY + ':' + ctx.kind + (ctx.isPurchases ? ':p' : ''));
            if (raw) Object.assign(def, JSON.parse(raw));
        } catch (_) {}
        // миграция со старого одиночного формата
        if (typeof def.format === 'string') { def.formats = [def.format]; delete def.format; }
        if (!Array.isArray(def.formats) || !def.formats.length) def.formats = ['xlsx'];
        // миграция со старых пресет-тем → один цвет
        if (def.theme) {
            const map = { funpay: '#FF6D15', midnight: '#7C5CFF', emerald: '#10B981', ocean: '#0EA5E9', ruby: '#E11D48', gold: '#C79A2E', mono: '#111827', candy: '#EC4899' };
            def.color = map[def.theme] || '#2563EB';
            delete def.theme;
        }
        if (!def.color) def.color = '#2563EB';
        // дефолтный набор колонок
        if (!def.cols) {
            const all = ES.schemaFor(ctx.kind, ctx.isPurchases).map(c => c.key);
            def.cols = all.filter(k => k !== 'link' && k !== 'currency');
        }
        return def;
    }
    function saveCfg(ctx, cfg) {
        try { localStorage.setItem(CFG_KEY + ':' + ctx.kind + (ctx.isPurchases ? ':p' : ''), JSON.stringify(cfg)); } catch (_) {}
    }

    const FORMATS = [
        { v: 'xlsx', ext: 'XLSX', ds: 'Excel-таблица', icon: 'table_view' },
        { v: 'docx', ext: 'DOCX', ds: 'Word-документ', icon: 'description' },
        { v: 'pdf', ext: 'PDF', ds: 'Готов к печати', icon: 'picture_as_pdf' },
        { v: 'csv', ext: 'CSV', ds: 'Для импорта', icon: 'csv' },
        { v: 'json', ext: 'JSON', ds: 'Сырые данные', icon: 'code' }
    ];
    // быстрые цвета оформления (те же, что были пресетами раньше)
    const QUICK_COLORS = ['2563EB', '7C5CFF', '10B981', '0EA5E9', 'E11D48', 'FF6D15', 'C79A2E', '111827'];
    const KIND_META = {
        finance: { label: 'Финансы', icon: 'account_balance_wallet' },
        purchases: { label: 'Покупки', icon: 'shopping_bag' },
        sales: { label: 'Продажи', icon: 'sell' }
    };

    let openHost = null;

    async function openStudio(ctx) {
        if (openHost) openHost.remove();
        const cfg = loadCfg(ctx);
        const cleanHex = v => String(v || '2563EB').replace('#', '').toUpperCase();
        cfg.color = cleanHex(cfg.color);
        const schema = ES.schemaFor(ctx.kind, ctx.isPurchases);
        const currencies = await detectCurrencies(ctx);
        const kind = KIND_META[ctx.kind === 'finance' ? 'finance' : ctx.isPurchases ? 'purchases' : 'sales'];
        const sortOpts = ctx.kind === 'finance'
            ? [['date-desc', 'Сначала новые'], ['date-asc', 'Сначала старые'], ['amt-desc', 'Больше сумма'], ['amt-asc', 'Меньше сумма']]
            : [['date-desc', 'Сначала новые'], ['date-asc', 'Сначала старые'], ['price-desc', 'Дороже'], ['price-asc', 'Дешевле']];

        const chip = (attr, value, label, on) =>
            `<button type="button" class="chip" ${attr}="${esc(value)}" aria-pressed="${on ? 'true' : 'false'}"><span class="ico">check</span>${esc(label)}</button>`;
        const card = (icon, title, body, extra = '', id = '') =>
            `<section class="card"${id ? ` id="${id}"` : ''}><div class="card-head"><span class="card-ico ico">${icon}</span><h3 class="card-title">${title}</h3>${extra}</div>${body}</section>`;
        const toggle = (key, icon, label, id = '') =>
            `<label class="toggle"${id ? ` id="${id}"` : ''}><span class="toggle-copy"><span class="ico">${icon}</span>${esc(label)}</span>`
            + `<span class="switch"><input type="checkbox" role="switch" data-opt="${key}"><span class="track"></span></span></label>`;

        const host = document.createElement('fpt-export-studio');
        host.id = 'fpt-es-ov';
        host.style.cssText = HOST_CSS;
        const shadow = host.attachShadow({ mode: 'open' });
        const pal = studioPalette();
        shadow.innerHTML = `<style>${STUDIO_CSS}</style>
        <div class="ov" style="${Object.entries(pal).map(([k, v]) => `${k}:${v}`).join(';')}">
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="es-h" tabindex="-1">
            <div class="head">
              <span class="emblem ico">ios_share</span>
              <div class="head-copy">
                <h2 id="es-h">Студия экспорта</h2>
                <p><span class="kind"><span class="ico">${kind.icon}</span>${kind.label}</span>Формат, оформление и содержимое отчёта</p>
              </div>
              <button type="button" class="icon-btn" id="es-x" aria-label="Закрыть"><span class="ico">close</span></button>
            </div>
            <div class="body">
              <div class="settings">
                ${card('draft', 'Формат файла', `<div class="fmts" id="es-fmts">${FORMATS.map(f =>
                    `<button type="button" class="fmt" data-fmt="${f.v}" aria-pressed="${cfg.formats.includes(f.v)}"><span class="ico fmt-check">check_circle</span><span class="ico fmt-ico">${f.icon}</span><span class="fmt-ext">${f.ext}</span><span class="fmt-ds">${f.ds}</span></button>`).join('')}</div>`,
                    '<span class="card-note">можно несколько</span>')}

                ${card('palette', 'Оформление', `
                  <div class="group">
                    <span class="label">Цвет документа</span>
                    <div class="colors" id="es-colors">
                      ${QUICK_COLORS.map(c => `<button type="button" class="dot" data-color="${c}" style="--c:#${c}" aria-label="Цвет #${c}" aria-pressed="false"></button>`).join('')}
                      <label class="picker" title="Свой цвет"><input type="color" id="es-color" aria-label="Свой цвет"><span class="ico">format_paint</span></label>
                      <span class="current" id="es-current"><i></i><span></span></span>
                    </div>
                    <div class="sliders">
                      <div class="slider-row"><span>Оттенок</span><div class="track-h spectrum" id="es-spectrum"><span class="knob" id="es-spec-knob"></span></div></div>
                      <div class="slider-row"><span>Яркость</span><div class="track-h" id="es-light"><span class="knob" id="es-light-knob"></span></div></div>
                    </div>
                  </div>
                  <div class="group" id="es-orient-wrap">
                    <span class="label">Ориентация страницы · PDF и DOCX</span>
                    <div class="seg" role="radiogroup" aria-label="Ориентация">
                      <button type="button" role="radio" data-orient="portrait"><span class="ico">crop_portrait</span>Книжная</button>
                      <button type="button" role="radio" data-orient="landscape"><span class="ico">crop_landscape</span>Альбомная</button>
                    </div>
                  </div>`, '', 'es-theme-wrap')}

                ${card('title', 'Документ', `
                  <div class="fields">
                    <label class="field"><span class="label">Заголовок</span><input class="input" id="es-title" value="${esc(cfg.title)}" placeholder="Например: ${esc(ctx.titleDefault)}"></label>
                    <label class="field"><span class="label">Подзаголовок</span><input class="input" id="es-subtitle" value="${esc(cfg.subtitle)}" placeholder="По умолчанию — период и дата"></label>
                  </div>`)}

                ${card('filter_alt', 'Данные', `
                  <div class="group">
                    <span class="label">Период</span>
                    <div class="chips" id="es-period">${PERIODS.map(p => chip('data-period', p.v, p.l, cfg.period === p.v)).join('')}</div>
                    <div class="fields range" id="es-custom-range" ${cfg.period === 'custom' ? '' : 'hidden'}>
                      <label class="field"><span class="label">С даты</span><input type="date" class="input" id="es-from" value="${esc(cfg.from)}"></label>
                      <label class="field"><span class="label">По дату</span><input type="date" class="input" id="es-to" value="${esc(cfg.to)}"></label>
                    </div>
                  </div>
                  <div class="group" ${currencies.length > 1 ? '' : 'hidden'}>
                    <span class="label">Валюта</span>
                    <div class="chips" id="es-currency">${chip('data-cur', 'all', 'Все валюты', cfg.currency === 'all')}${currencies.map(c => chip('data-cur', c, `${c} ${SYM[c] || ''}`.trim(), cfg.currency === c)).join('')}</div>
                  </div>
                  <div id="es-statusflt"></div>
                  <div class="group">
                    <span class="label">Сортировка</span>
                    <div class="seg" role="radiogroup" aria-label="Сортировка" id="es-sort">${sortOpts.map(([v, l]) => `<button type="button" role="radio" data-sort="${v}">${l}</button>`).join('')}</div>
                  </div>`)}

                ${card('view_column', 'Колонки', `<div class="chips" id="es-cols">${schema.map(c => chip('data-col', c.key, c.label, cfg.cols.includes(c.key))).join('')}</div>`,
                    '<span class="links"><button type="button" class="link" id="es-cols-all">Все</button><button type="button" class="link" id="es-cols-reset">По умолчанию</button></span>')}

                ${card('tune', 'Дополнительно', `<div class="toggles">
                    ${toggle('zebra', 'table_rows', 'Чередование строк')}
                    ${toggle('totals', 'functions', 'Блок итогов')}
                    ${toggle('watermark', 'verified', 'Подпись FunPay Funcy')}
                    ${toggle('pageNumbers', 'tag', 'Номера страниц · PDF', 'es-opt-pagenum')}
                  </div>`)}
              </div>
              <aside class="side">
                <div class="side-sticky">
                  <div class="side-head"><h3 class="side-title">Предпросмотр</h3><span class="tag" id="es-pv-fmt"></span></div>
                  <div class="paper-wrap">
                    <div class="paper" id="es-paper">
                      <div class="band" id="es-pv-band"><b id="es-pv-title"></b><span id="es-pv-sub"></span></div>
                      <div class="sheet"><table><thead id="es-pv-head"></thead><tbody id="es-pv-body"></tbody></table></div>
                      <div class="totals" id="es-pv-totals"></div>
                      <div class="paper-foot"><span id="es-pv-wm">FunPay Funcy</span><span id="es-pv-page">стр. 1 из 1</span></div>
                    </div>
                  </div>
                  <div class="stats">
                    <div class="stat-line"><span class="ico">inventory_2</span><span id="es-count">Считаем записи…</span></div>
                    <div class="stat-line"><span class="ico">date_range</span><span id="es-period-label"></span></div>
                  </div>
                </div>
              </aside>
            </div>
            <div class="foot">
              <div class="foot-note"><span class="ico">download</span>Файлы сохранятся в папку загрузок браузера</div>
              <button type="button" class="btn ghost" id="es-cancel">Отмена</button>
              <button type="button" class="btn primary" id="es-go"><span class="ico">ios_share</span><span id="es-go-label">Экспортировать</span></button>
            </div>
          </div>
        </div>`;
        document.body.appendChild(host);
        openHost = host;
        const $ = sel => shadow.querySelector(sel);
        const $$ = sel => shadow.querySelectorAll(sel);
        const ov = $('.ov');

        // ── состояние формы ──
        const state = Object.assign({}, cfg, { formats: cfg.formats.slice(), cols: cfg.cols.slice() });
        let lastRows = [];
        const press = (el, on) => el.setAttribute('aria-pressed', on ? 'true' : 'false');
        const check = (el, on) => el.setAttribute('aria-checked', on ? 'true' : 'false');

        // статус-фильтры
        function renderStatusFlt() {
            const wrap = $('#es-statusflt');
            if (ctx.kind === 'finance') {
                const stOpts = [['all', 'Все'], ['complete', 'Завершённые'], ['cancel', 'Отменённые'], ['waiting', 'Ожидание']];
                const tyOpts = [['all', 'Все'], ['order', 'Заказы'], ['payment', 'Пополнения'], ['withdraw', 'Выводы'], ['withdraw_cancel', 'Отмены выводов'], ['other', 'Другое']];
                wrap.innerHTML = `<div class="group"><span class="label">Статус</span><div class="chips">${stOpts.map(([v, l]) => chip('data-finst', v, l, state.finStatus === v)).join('')}</div></div>`
                    + `<div class="group"><span class="label">Тип операции</span><div class="chips">${tyOpts.map(([v, l]) => chip('data-finty', v, l, state.finType === v)).join('')}</div></div>`;
                wrap.querySelectorAll('[data-finst]').forEach(b => b.onclick = () => { state.finStatus = b.dataset.finst; renderStatusFlt(); refreshCount(); });
                wrap.querySelectorAll('[data-finty]').forEach(b => b.onclick = () => { state.finType = b.dataset.finty; renderStatusFlt(); refreshCount(); });
            } else {
                wrap.innerHTML = `<div class="group"><span class="label">Статусы заказов</span><div class="chips">`
                    + chip('data-st', 'stClosed', 'Закрытые', state.stClosed)
                    + chip('data-st', 'stPaid', 'Оплаченные', state.stPaid)
                    + chip('data-st', 'stRefunded', 'Возвраты', state.stRefunded) + `</div></div>`;
                wrap.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { state[b.dataset.st] = !state[b.dataset.st]; renderStatusFlt(); refreshCount(); });
            }
        }
        renderStatusFlt();

        // какие форматы используют тему / ориентацию / номера страниц
        const STYLED = new Set(['xlsx', 'docx', 'pdf']);
        const PAGED = new Set(['pdf']);
        const ORIENTED = new Set(['pdf', 'docx']);
        function applyConditionalVisibility() {
            const anyStyled = state.formats.some(f => STYLED.has(f));
            $('#es-theme-wrap').hidden = !anyStyled;
            $('#es-opt-pagenum').hidden = !state.formats.some(f => PAGED.has(f));
            $('#es-orient-wrap').hidden = !state.formats.some(f => ORIENTED.has(f));
            const order = ['xlsx', 'docx', 'pdf', 'csv', 'json'].filter(f => state.formats.includes(f));
            const names = order.map(f => f.toUpperCase()).join(', ');
            $('#es-pv-fmt').textContent = names;
            const goLabel = $('#es-go-label');
            if (goLabel) goLabel.textContent = order.length > 1 ? `Экспортировать · ${order.length} файла` : `Экспортировать ${names}`;
            $('#es-paper').dataset.plain = anyStyled ? 'false' : 'true';
        }

        $$('#es-fmts .fmt').forEach(el => el.onclick = () => {
            const f = el.dataset.fmt;
            if (state.formats.includes(f)) {
                if (state.formats.length > 1) state.formats = state.formats.filter(x => x !== f); // нельзя снять последний
            } else {
                state.formats.push(f);
            }
            press(el, state.formats.includes(f));
            applyConditionalVisibility();
            renderPreview();
        });
        applyConditionalVisibility();

        // ── выбор цвета: быстрые цвета, спектр (hue) + яркость, точный пикер ──
        let _hsl = hexToHsl(state.color); // [h,s,l]
        if (_hsl[1] < 25) _hsl[1] = 70;   // не даём «серому» съесть насыщенность
        const specKnob = $('#es-spec-knob');
        const lightEl = $('#es-light');
        const lightKnob = $('#es-light-knob');
        const picker = $('#es-color');
        const current = $('#es-current');

        function paintColor(fromPicker) {
            const hex = state.color;
            if (!fromPicker) picker.value = '#' + hex.toLowerCase();
            current.style.setProperty('--c', '#' + hex);
            current.querySelector('span').textContent = '#' + hex;
            $$('#es-colors .dot').forEach(dot => press(dot, dot.dataset.color === hex));
            specKnob.style.left = (_hsl[0] / 360 * 100) + '%';
            lightKnob.style.left = Math.max(2, Math.min(98, _hsl[2])) + '%';
            const pure = hslToHex(_hsl[0], Math.max(_hsl[1], 25), 50);
            lightEl.style.background = `linear-gradient(to right,#000,#${pure} 50%,#fff)`;
            renderPreview();
        }
        function setFromHsl() { state.color = hslToHex(_hsl[0], _hsl[1], _hsl[2]); paintColor(); }
        function setFromHex(hex, fromPicker) {
            state.color = cleanHex(hex);
            _hsl = hexToHsl(state.color);
            paintColor(fromPicker);
        }
        function dragHandler(el, onPos) {
            el.addEventListener('pointerdown', e => {
                e.preventDefault();
                el.setPointerCapture(e.pointerId);
                const move = ev => {
                    const r = el.getBoundingClientRect();
                    onPos(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)));
                };
                const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
                move(e);
                el.addEventListener('pointermove', move);
                el.addEventListener('pointerup', up);
                el.addEventListener('pointercancel', up);
            });
        }
        dragHandler($('#es-spectrum'), p => { _hsl[0] = Math.round(p * 360); if (_hsl[1] < 25) _hsl[1] = 70; setFromHsl(); });
        dragHandler(lightEl, p => { _hsl[2] = Math.round(p * 100); setFromHsl(); });
        picker.oninput = e => setFromHex(e.target.value, true);
        $$('#es-colors .dot').forEach(dot => dot.onclick = () => setFromHex(dot.dataset.color));

        // ориентация
        function paintOrient() {
            $$('[data-orient]').forEach(x => check(x, x.dataset.orient === state.orientation));
            $('#es-paper').dataset.orient = state.orientation;
        }
        $$('[data-orient]').forEach(el => el.onclick = () => { state.orientation = el.dataset.orient; paintOrient(); });
        paintOrient();

        // колонки
        function paintCols() {
            $$('#es-cols .chip').forEach(el => press(el, state.cols.includes(el.dataset.col)));
            renderPreview();
        }
        $$('#es-cols .chip').forEach(el => el.onclick = () => {
            const k = el.dataset.col;
            if (state.cols.includes(k)) state.cols = state.cols.filter(x => x !== k);
            else state.cols = schema.map(c => c.key).filter(x => x === k || state.cols.includes(x)); // порядок как в схеме
            paintCols();
        });
        $('#es-cols-all').onclick = () => { state.cols = schema.map(c => c.key); paintCols(); };
        $('#es-cols-reset').onclick = () => { state.cols = schema.map(c => c.key).filter(k => k !== 'link' && k !== 'currency'); paintCols(); };

        // переключатели
        $$('input[data-opt]').forEach(input => {
            const key = input.dataset.opt;
            input.checked = !!state[key];
            input.onchange = () => { state[key] = input.checked; renderPreview(); };
        });

        // период, валюта, сортировка
        function paintPeriod() {
            $$('#es-period .chip').forEach(el => press(el, el.dataset.period === state.period));
            $('#es-custom-range').hidden = state.period !== 'custom';
        }
        $$('#es-period .chip').forEach(el => el.onclick = () => { state.period = el.dataset.period; paintPeriod(); refreshCount(); });
        $$('#es-currency .chip').forEach(el => el.onclick = () => {
            state.currency = el.dataset.cur;
            $$('#es-currency .chip').forEach(x => press(x, x === el));
            refreshCount();
        });
        function paintSort() { $$('#es-sort [data-sort]').forEach(x => check(x, x.dataset.sort === state.sort)); }
        $$('#es-sort [data-sort]').forEach(el => el.onclick = () => { state.sort = el.dataset.sort; paintSort(); refreshCount(); });
        if (!sortOpts.some(([v]) => v === state.sort)) state.sort = 'date-desc';
        paintSort();
        $('#es-from').onchange = e => { state.from = e.target.value; refreshCount(); };
        $('#es-to').onchange = e => { state.to = e.target.value; refreshCount(); };
        $('#es-title').oninput = () => { syncSimple(); renderPreview(); };
        $('#es-subtitle').oninput = () => { syncSimple(); renderPreview(); };

        // ── живой предпросмотр документа ──
        function renderPreview() {
            const theme = themeFromColor(state.color);
            const paper = $('#es-paper');
            paper.style.setProperty('--grid', '#' + theme.grid);
            const band = $('#es-pv-band');
            band.style.background = '#' + theme.headerBg;
            band.style.color = '#' + theme.headerText;
            const plabel = periodLabel(state.period, state.from, state.to);
            $('#es-pv-title').textContent = (state.title || '').trim() || ctx.titleDefault;
            $('#es-pv-sub').textContent = (state.subtitle || '').trim() || `${plabel} · ${fmtDateTime(Date.now())}`;

            const cols = schema.filter(c => state.cols.includes(c.key));
            const shown = cols.slice(0, 4);
            const more = cols.length - shown.length;
            const head = $('#es-pv-head');
            head.innerHTML = shown.length
                ? `<tr style="background:#${theme.total}">${shown.map(c => `<th class="${c.align === 'r' ? 'r' : ''}">${esc(c.label)}</th>`).join('')}${more > 0 ? `<th style="width:18%">+${more}</th>` : ''}</tr>`
                : '<tr><th class="empty-cell">Выберите колонки</th></tr>';
            const sample = lastRows.slice(0, 7);
            const rows = sample.length ? sample : Array.from({ length: 5 }, () => null);
            $('#es-pv-body').innerHTML = rows.map((row, i) => {
                const bg = state.zebra && i % 2 === 1 ? ` style="background:#${theme.zebra}"` : '';
                const cells = shown.map(c => {
                    let text = '';
                    try { text = row ? c.disp(row) : ''; } catch (_) {}
                    return `<td class="${c.align === 'r' ? 'r' : ''}${row ? '' : ' empty-cell'}">${row ? esc(text) : '—'}</td>`;
                }).join('');
                return `<tr${bg}>${cells}${more > 0 ? '<td class="empty-cell">…</td>' : ''}</tr>`;
            }).join('');

            const totals = $('#es-pv-totals');
            totals.hidden = !state.totals;
            totals.style.background = '#' + theme.total;
            totals.innerHTML = `<span>Итого</span><span>${esc(totalsText())}</span>`;
            $('#es-pv-wm').style.visibility = state.watermark ? 'visible' : 'hidden';
            $('#es-pv-page').style.visibility = state.pageNumbers && state.formats.includes('pdf') ? 'visible' : 'hidden';
            $('#es-period-label').textContent = plabel;
        }
        function totalsText() {
            const n = lastRows.length;
            const count = `${n} ${ctx.kind === 'finance' ? 'операц.' : 'зап.'}`;
            try {
                const sum = ES.summarize(ctx.kind, lastRows);
                const money = ctx.kind === 'finance' ? sum.net : sum.byCur;
                const parts = Object.entries(money || {}).filter(([c]) => c !== 'UNKNOWN').slice(0, 2).map(([c, v]) => fmtMoney(v, c));
                return parts.length ? `${count} · ${parts.join(' · ')}` : count;
            } catch (_) { return count; }
        }

        // count
        let countSeq = 0;
        async function refreshCount() {
            syncSimple();
            const seq = ++countSeq;
            const rows = await gatherRows(ctx, state);
            if (seq !== countSeq) return rows;
            lastRows = rows;
            const el = $('#es-count');
            if (el) el.innerHTML = `Будет выгружено <b>${rows.length}</b> ${ctx.kind === 'finance' ? 'операций' : 'записей'}`;
            renderPreview();
            return rows;
        }
        function syncSimple() {
            state.title = $('#es-title').value;
            state.subtitle = $('#es-subtitle').value;
        }
        paintPeriod();
        paintColor();
        refreshCount();
        if (ctx.kind === 'sales' && typeof chrome !== 'undefined' && chrome.runtime?.id) {
            chrome.runtime.sendMessage({ action: 'updateSales' }, () => {
                refreshCount();
            });
        }

        // close
        let closed = false;
        const onKey = e => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            close();
        };
        function close() {
            if (closed) return;
            closed = true;
            document.removeEventListener('keydown', onKey, true);
            const done = () => { host.remove(); if (openHost === host) openHost = null; };
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return done();
            ov.classList.add('is-closing');
            setTimeout(done, 160);
        }
        $('#es-x').onclick = close;
        $('#es-cancel').onclick = close;
        ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
        document.addEventListener('keydown', onKey, true);
        $('.modal').focus({ preventScroll: true });

        // GO
        $('#es-go').onclick = async () => {
            const btn = $('#es-go');
            syncSimple();
            if (!state.cols.length) { alert('Выберите хотя бы одну колонку.'); return; }
            if (!state.formats.length) { alert('Выберите хотя бы один формат.'); return; }
            btn.disabled = true;
            const orig = btn.innerHTML;
            btn.innerHTML = '<span class="spin"></span>Готовим файлы…';
            try {
                const rows = await gatherRows(ctx, state);
                if (!rows.length) { alert('Нет данных для выбранных фильтров.'); btn.disabled = false; btn.innerHTML = orig; return; }
                const schemaAll = ES.schemaFor(ctx.kind, ctx.isPurchases);
                const cols = state.cols.map(k => schemaAll.find(c => c.key === k)).filter(Boolean);
                const opt = {
                    kind: ctx.kind, isPurchases: ctx.isPurchases,
                    color: state.color, themeObj: themeFromColor(state.color),
                    title: state.title, subtitle: state.subtitle || (periodLabel(state.period, state.from, state.to) + ' · ' + fmtDateTime(Date.now())),
                    periodLabel: periodLabel(state.period, state.from, state.to),
                    zebra: state.zebra, totals: state.totals, watermark: state.watermark, pageNumbers: state.pageNumbers,
                    orientation: state.orientation, csvSep: state.csvSep
                };
                const base = (ctx.kind === 'finance' ? 'finance' : ctx.isPurchases ? 'purchases' : 'sales') + '_' + nowStamp();
                // порядок: тяжёлые PDF в конце; небольшая пауза между скачиваниями,
                // чтобы браузер не «склеил» несколько файлов в один диалог.
                const order = ['xlsx', 'docx', 'csv', 'json', 'pdf'].filter(f => state.formats.includes(f));
                let done = 0;
                for (const fmt of order) {
                    btn.innerHTML = `<span class="spin"></span>${fmt.toUpperCase()} · ${done + 1} из ${order.length}…`;
                    let blob;
                    if (fmt === 'xlsx') blob = ES.buildXLSX(cols, rows, opt);
                    else if (fmt === 'docx') blob = ES.buildDOCX(cols, rows, opt);
                    else if (fmt === 'pdf') blob = await ES.buildPDF(cols, rows, opt);
                    else if (fmt === 'csv') blob = ES.buildCSV(cols, rows, opt);
                    else blob = ES.buildJSON(cols, rows, opt);
                    downloadBlob(blob, blob.type, base + '.' + fmt);
                    done++;
                    if (done < order.length) await new Promise(r => setTimeout(r, 450));
                }
                saveCfg(ctx, state);
                btn.innerHTML = `<span class="ico">check_circle</span>Готово${order.length > 1 ? ` · ${order.length} файла` : ''}`;
                setTimeout(() => { btn.disabled = false; btn.innerHTML = orig; }, 1500);
            } catch (err) {
                console.error('[ExportStudio] ошибка генерации:', err);
                alert('Не удалось сформировать файл: ' + (err && err.message ? err.message : err));
                btn.disabled = false; btn.innerHTML = orig;
            }
        };
    }
    ES.open = openStudio;

    // ──────────────────────────────────────────────────────────────────────────
    //  ВСТАВКА КНОПКИ «ЭКСПОРТ» В ПАНЕЛЬ СТАТИСТИКИ
    //  • продажи/покупки: в .fp-stats-controls (рядом с «Обновить»/фильтрами)
    //  • финансы: в .fpt-fin-head (рядом с «Обновить»)
    // ──────────────────────────────────────────────────────────────────────────
    function makeBtnSales() {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-default fpt-es-trigger';
        b.id = 'fpt-es-open';
        b.title = 'Студия экспорта — XLSX, DOCX, PDF, CSV, JSON';
        b.textContent = 'Экспорт';
        return b;
    }
    function makeBtnFinance() {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fpt-fin-btn fpt-es-trigger';
        b.id = 'fpt-es-open';
        b.title = 'Студия экспорта — XLSX, DOCX, PDF, CSV, JSON';
        b.textContent = 'Экспорт';
        return b;
    }

    function findNativeExportButton() {
        const candidates = Array.from(document.querySelectorAll('a, button, input[type="submit"], input[type="button"], .btn'));
        return candidates.find(el => {
            const t = (el.textContent || el.value || '').trim();
            const href = el.getAttribute('href') || '';
            return t.includes('Выгрузить') || el.classList.contains('orders-export') || (href && href.includes('export'));
        });
    }

    function hookNativeExportButton(ctx) {
        const nativeBtn = findNativeExportButton();
        if (!nativeBtn) return false;
        if (nativeBtn.dataset.fptEsHooked) return true;
        nativeBtn.dataset.fptEsHooked = '1';
        nativeBtn.title = 'Студия экспорта FunPay Funcy (XLSX, CSV, PDF, DOCX) — чистая выгрузка';
        nativeBtn.classList.add('fpt-es-trigger');

        nativeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openStudio(ctx);
        }, true);
        return true;
    }

    function tryMount(ctx) {
        let mounted = false;
        if (ctx.kind === 'finance') {
            if (document.getElementById('fpt-es-open')) return true;
            const head = document.querySelector('.fpt-fin-head');
            const refresh = document.getElementById('fpt-fin-refresh');
            if (head) {
                const btn = makeBtnFinance();
                btn.onclick = () => openStudio(ctx);
                if (refresh && refresh.parentElement === head) head.insertBefore(btn, refresh.nextSibling);
                else head.appendChild(btn);
                mounted = true;
            }
        } else {
            // 1. Перехватываем и заменяем родную серверную кнопку «Выгрузить» FunPay
            if (hookNativeExportButton(ctx)) mounted = true;

            // 2. Если есть блок статистики .fp-stats-controls, добавляем кнопку и туда
            if (!document.getElementById('fpt-es-open')) {
                const controls = document.querySelector('.fp-stats-controls');
                if (controls) {
                    const btn = makeBtnSales();
                    btn.onclick = () => openStudio(ctx);
                    controls.insertBefore(btn, controls.firstChild);
                    mounted = true;
                }
            }
        }
        return mounted;
    }

    function init() {
        const ctx = detectContext();
        if (!ctx) return;
        if (tryMount(ctx)) return;

        let tries = 0;
        let iv = null;
        const obs = new MutationObserver(() => {
            if (tryMount(ctx)) {
                obs.disconnect();
                if (iv !== null) clearInterval(iv);
                return;
            }
            if (++tries > 240) {
                obs.disconnect();
                if (iv !== null) clearInterval(iv);
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        iv = setInterval(() => {
            if (tryMount(ctx)) {
                obs.disconnect();
                clearInterval(iv);
                return;
            }
            if (++tries > 240) {
                obs.disconnect();
                clearInterval(iv);
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// =============================================================================
//  FP Tools — Finance Hub Verified Export Engine (T09B)
// =============================================================================
(function (root) {
    'use strict';

    function formatNumber(v) {
        if (v === null || v === undefined) return 'null';
        if (typeof v === 'number') {
            return isNaN(v) ? 'null' : String(Math.round(v * 100) / 100);
        }
        const n = Number(v);
        return isNaN(n) ? 'null' : String(Math.round(n * 100) / 100);
    }

    function formatString(s) {
        return FPTSafe.csvCell(s == null ? 'null' : s);
    }

    function formatBool(b) {
        if (b === null || b === undefined) return 'null';
        return b ? 'true' : 'false';
    }

    function formatItem(dataset, o) {
        if (!o) return null;

        if (dataset === 'sales') {
            const info = o.profitInfo || ((typeof root !== 'undefined' && root.FPTProfitEngine && typeof root.FPTProfitEngine.calculateOrderProfit === 'function') ? root.FPTProfitEngine.calculateOrderProfit(o) : null);
            const costVal = (info && typeof info.costBasis === 'number') ? info.costBasis : (typeof o.costBasis === 'number' ? o.costBasis : null);
            const hasCost = Boolean((info && info.hasCost) || costVal !== null);
            const costBasis = (hasCost && costVal !== null) ? costVal : null;
            const profit = (hasCost && info && typeof info.netProfit === 'number') ? info.netProfit : (hasCost && typeof o.profit === 'number' ? o.profit : null);
            const price = typeof o.price === 'number' ? o.price : (Number(o.price) || 0);
            return {
                orderId: String(o.orderId || ''),
                orderDate: o.orderDate ? (typeof o.orderDate === 'number' ? new Date(o.orderDate).toISOString() : String(o.orderDate)) : null,
                description: o.description || o.subcategoryName || 'Заказ',
                category: o.subcategoryName || o.category || 'Без категории',
                buyerUsername: o.buyerUsername || '-',
                orderStatus: o.orderStatus || 'unknown',
                price: price,
                currency: o.currency || 'RUB',
                knownCost: hasCost,
                costBasis: costBasis,
                profit: profit,
                stockKind: null
            };
        }

        if (dataset === 'purchases') {
            const price = typeof o.price === 'number' ? o.price : (Number(o.price) || 0);
            return {
                orderId: String(o.orderId || ''),
                orderDate: o.orderDate ? (typeof o.orderDate === 'number' ? new Date(o.orderDate).toISOString() : String(o.orderDate)) : null,
                description: o.description || o.subcategoryName || 'Покупка',
                category: o.subcategoryName || o.category || 'Без категории',
                sellerUsername: o.sellerUsername || o.sellerName || '-',
                orderStatus: o.orderStatus || 'unknown',
                price: price,
                currency: o.currency || 'RUB',
                knownCost: false,
                costBasis: null,
                profit: null,
                stockKind: null
            };
        }

        if (dataset === 'operations') {
            const amount = typeof o.amount === 'number' ? o.amount : (Number(o.amount) || 0);
            const signedAmount = typeof o.signed === 'number' ? o.signed : (Number(o.signed) || amount);
            return {
                id: String(o.id || o.paymentId || ''),
                date: o.date ? (typeof o.date === 'number' ? new Date(o.date).toISOString() : String(o.date)) : null,
                type: o.type || 'other',
                typeLabel: (o.typeLabel || o.type || 'Операция'),
                title: o.title || o.description || '-',
                status: o.status || 'unknown',
                amount: amount,
                signedAmount: signedAmount,
                currency: o.currency || 'RUB',
                knownCost: false,
                costBasis: null,
                profit: null,
                stockKind: null
            };
        }

        if (dataset === 'profit') {
            const info = o.profitInfo || ((typeof root !== 'undefined' && root.FPTProfitEngine && typeof root.FPTProfitEngine.calculateOrderProfit === 'function') ? root.FPTProfitEngine.calculateOrderProfit(o) : {});
            const costVal = (typeof info.costBasis === 'number') ? info.costBasis : (typeof o.costBasis === 'number' ? o.costBasis : null);
            const hasCost = Boolean(info.hasCost || costVal !== null);
            const costBasis = (hasCost && costVal !== null) ? costVal : null;
            const profit = (hasCost && typeof info.netProfit === 'number') ? info.netProfit : (hasCost && typeof o.profit === 'number' ? o.profit : null);
            const margin = (hasCost && typeof info.margin === 'number') ? info.margin : (hasCost && typeof o.margin === 'number' ? o.margin : null);
            const roi = (hasCost && typeof info.roi === 'number') ? info.roi : (hasCost && typeof o.roi === 'number' ? o.roi : null);
            const rev = (typeof info.sellerRevenue === 'number') ? info.sellerRevenue : (typeof o.price === 'number' ? o.price : 0);
            return {
                orderId: String(o.orderId || ''),
                orderDate: o.orderDate ? (typeof o.orderDate === 'number' ? new Date(o.orderDate).toISOString() : String(o.orderDate)) : null,
                description: o.description || o.subcategoryName || 'Заказ',
                category: o.subcategoryName || o.category || 'Без категории',
                buyerUsername: o.buyerUsername || '-',
                orderStatus: o.orderStatus || (info.isRefunded ? 'refunded' : (info.isClosed ? 'closed' : 'unknown')),
                revenue: rev,
                currency: info.currency || o.currency || 'RUB',
                knownCost: hasCost,
                costBasis: costBasis,
                costBasisCurrency: (hasCost && info.costBasisCurrency) ? info.costBasisCurrency : null,
                profit: profit,
                margin: margin,
                roi: roi,
                stockKind: null
            };
        }

        if (dataset === 'potential') {
            const knownCost = (o.costBasis !== null && o.costBasis !== undefined && !isNaN(Number(o.costBasis)));
            const costBasis = knownCost ? Number(o.costBasis) : null;
            const stock = (o.stockKind === 'finite' && typeof o.stock === 'number') ? o.stock : null;
            const stockKind = o.stockKind || (typeof o.stock === 'number' ? 'finite' : 'unknown');
            const sellerPrice = typeof o.sellerPrice === 'number' ? o.sellerPrice : (Number(o.sellerPrice) || 0);
            const buyerPrice = typeof o.buyerPrice === 'number' ? o.buyerPrice : (o.sellerPrice != null ? Number(o.sellerPrice) : null);
            const rev = (typeof o.sellerRevenue === 'number') ? o.sellerRevenue : null;
            const buyerGmv = (typeof o.buyerGmv === 'number') ? o.buyerGmv : null;
            const profit = (knownCost && typeof o.potentialProfit === 'number') ? o.potentialProfit : null;
            const margin = (knownCost && typeof o.margin === 'number') ? o.margin : null;
            const roi = (knownCost && typeof o.roi === 'number') ? o.roi : null;
            return {
                offerId: String(o.offerId || ''),
                title: o.title || ('Лот #' + (o.offerId || '')),
                category: o.category || 'Без категории',
                currency: o.currency || 'RUB',
                stock: stock,
                stockKind: stockKind,
                sellerPrice: sellerPrice,
                buyerPrice: buyerPrice,
                knownCost: knownCost,
                costBasis: costBasis,
                sellerRevenue: rev,
                buyerGmv: buyerGmv,
                profit: profit,
                margin: margin,
                roi: roi,
                active: o.active !== false
            };
        }

        return o;
    }

    const SCHEMAS = {
        sales: [
            { key: 'orderId', label: 'ID заказа', format: formatString },
            { key: 'orderDate', label: 'Дата', format: formatString },
            { key: 'description', label: 'Описание', format: formatString },
            { key: 'category', label: 'Категория', format: formatString },
            { key: 'buyerUsername', label: 'Покупатель', format: formatString },
            { key: 'orderStatus', label: 'Статус', format: formatString },
            { key: 'price', label: 'Выручка', format: formatNumber },
            { key: 'currency', label: 'Валюта', format: formatString },
            { key: 'knownCost', label: 'Себестоимость известна', format: formatBool },
            { key: 'costBasis', label: 'Себестоимость', format: formatNumber },
            { key: 'profit', label: 'Чистая прибыль', format: formatNumber },
            { key: 'stockKind', label: 'Тип остатка', format: formatString }
        ],
        purchases: [
            { key: 'orderId', label: 'ID заказа', format: formatString },
            { key: 'orderDate', label: 'Дата', format: formatString },
            { key: 'description', label: 'Описание', format: formatString },
            { key: 'category', label: 'Категория', format: formatString },
            { key: 'sellerUsername', label: 'Продавец', format: formatString },
            { key: 'orderStatus', label: 'Статус', format: formatString },
            { key: 'price', label: 'Расход', format: formatNumber },
            { key: 'currency', label: 'Валюта', format: formatString },
            { key: 'knownCost', label: 'Себестоимость известна', format: formatBool },
            { key: 'costBasis', label: 'Себестоимость', format: formatNumber },
            { key: 'profit', label: 'Чистая прибыль', format: formatNumber },
            { key: 'stockKind', label: 'Тип остатка', format: formatString }
        ],
        operations: [
            { key: 'id', label: 'ID операции', format: formatString },
            { key: 'date', label: 'Дата', format: formatString },
            { key: 'type', label: 'Тип', format: formatString },
            { key: 'typeLabel', label: 'Тип (название)', format: formatString },
            { key: 'title', label: 'Описание', format: formatString },
            { key: 'status', label: 'Статус', format: formatString },
            { key: 'amount', label: 'Сумма', format: formatNumber },
            { key: 'signedAmount', label: 'Сумма со знаком', format: formatNumber },
            { key: 'currency', label: 'Валюта', format: formatString },
            { key: 'knownCost', label: 'Себестоимость известна', format: formatBool },
            { key: 'costBasis', label: 'Себестоимость', format: formatNumber },
            { key: 'profit', label: 'Чистая прибыль', format: formatNumber },
            { key: 'stockKind', label: 'Тип остатка', format: formatString }
        ],
        profit: [
            { key: 'orderId', label: 'ID заказа', format: formatString },
            { key: 'orderDate', label: 'Дата', format: formatString },
            { key: 'description', label: 'Описание', format: formatString },
            { key: 'category', label: 'Категория', format: formatString },
            { key: 'buyerUsername', label: 'Покупатель', format: formatString },
            { key: 'orderStatus', label: 'Статус', format: formatString },
            { key: 'revenue', label: 'Выручка', format: formatNumber },
            { key: 'currency', label: 'Валюта', format: formatString },
            { key: 'knownCost', label: 'Себестоимость известна', format: formatBool },
            { key: 'costBasis', label: 'Себестоимость', format: formatNumber },
            { key: 'profit', label: 'Чистая прибыль', format: formatNumber },
            { key: 'margin', label: 'Маржа %', format: formatNumber },
            { key: 'roi', label: 'ROI %', format: formatNumber },
            { key: 'stockKind', label: 'Тип остатка', format: formatString }
        ],
        potential: [
            { key: 'offerId', label: 'ID лота', format: formatString },
            { key: 'title', label: 'Название', format: formatString },
            { key: 'category', label: 'Категория', format: formatString },
            { key: 'currency', label: 'Валюта', format: formatString },
            { key: 'stock', label: 'Остаток', format: formatNumber },
            { key: 'stockKind', label: 'Тип остатка', format: formatString },
            { key: 'sellerPrice', label: 'Цена продавца', format: formatNumber },
            { key: 'buyerPrice', label: 'Цена покупателя', format: formatNumber },
            { key: 'knownCost', label: 'Себестоимость известна', format: formatBool },
            { key: 'costBasis', label: 'Себестоимость', format: formatNumber },
            { key: 'sellerRevenue', label: 'Потенциал выручки', format: formatNumber },
            { key: 'profit', label: 'Потенциал прибыли', format: formatNumber },
            { key: 'margin', label: 'Маржа %', format: formatNumber },
            { key: 'roi', label: 'ROI %', format: formatNumber },
            { key: 'active', label: 'Активен', format: formatBool }
        ]
    };

    function buildTotalsSummary(dataset, totals, cur) {
        if (!totals) return [];
        const lines = [];
        lines.push(['# TOTALS', '']);
        lines.push(['Показатель', 'Значение']);
        if (dataset === 'sales') {
            lines.push(['Всего заказов', String(totals.count || 0)]);
            lines.push(['Выручка', totals.total != null ? `${formatNumber(totals.total)} ${cur}` : 'null']);
            if (totals.byCurrency) {
                for (const [c, v] of Object.entries(totals.byCurrency)) {
                    lines.push([`Выручка (${c})`, `${formatNumber(v)} ${c}`]);
                }
            }
        } else if (dataset === 'purchases') {
            lines.push(['Всего покупок', String(totals.count || 0)]);
            lines.push(['Расходы', totals.total != null ? `${formatNumber(totals.total)} ${cur}` : 'null']);
            if (totals.byCurrency) {
                for (const [c, v] of Object.entries(totals.byCurrency)) {
                    lines.push([`Расходы (${c})`, `${formatNumber(v)} ${c}`]);
                }
            }
        } else if (dataset === 'operations') {
            lines.push(['Всего операций', String(totals.count || 0)]);
            if (totals.inByCur) {
                for (const [c, v] of Object.entries(totals.inByCur)) {
                    lines.push([`Поступления (${c})`, `${formatNumber(v)} ${c}`]);
                }
            }
            if (totals.outByCur) {
                for (const [c, v] of Object.entries(totals.outByCur)) {
                    lines.push([`Списания (${c})`, `${formatNumber(v)} ${c}`]);
                }
            }
        } else if (dataset === 'profit') {
            lines.push(['Закрытых заказов', String(totals.eligibleOrdersCount || 0)]);
            lines.push(['Выручка закрытых заказов', `${formatNumber(totals.eligibleRevenue)} ${cur}`]);
            lines.push(['Заказов с себестоимостью', String(totals.knownCostOrdersCount || 0)]);
            lines.push(['Выручка с себестоимостью', `${formatNumber(totals.knownCostRevenue)} ${cur}`]);
            lines.push(['Себестоимость проданного', totals.realisedCost !== null ? `${formatNumber(totals.realisedCost)} ${cur}` : 'null']);
            lines.push(['Реализованная чистая прибыль', totals.realisedNetProfit !== null ? `${formatNumber(totals.realisedNetProfit)} ${cur}` : 'null']);
            lines.push(['Маржинальность', totals.margin !== null ? `${formatNumber(totals.margin)}%` : 'null']);
            lines.push(['ROI', totals.roi !== null ? `${formatNumber(totals.roi)}%` : 'null']);
            lines.push(['Покрытие заказов', `${formatNumber(totals.orderCoverage)}%`]);
            lines.push(['Покрытие выручки', `${formatNumber(totals.revenueCoverage)}%`]);
        } else if (dataset === 'potential') {
            lines.push(['Активных предложений с остатком', String(totals.finiteOffers || 0)]);
            lines.push(['Потенциал выручки', totals.sellerRevenue !== null ? `${formatNumber(totals.sellerRevenue)} ${cur}` : 'null']);
            lines.push(['Покупательский GMV', totals.buyerGmv !== null ? `${formatNumber(totals.buyerGmv)} ${cur}` : 'null']);
            lines.push(['Себестоимость склада', totals.knownInventoryCost !== null ? `${formatNumber(totals.knownInventoryCost)} ${cur}` : 'null']);
            lines.push(['Потенциальная чистая прибыль', totals.knownPotentialProfit !== null ? `${formatNumber(totals.knownPotentialProfit)} ${cur}` : 'null']);
            lines.push(['Маржинальность', totals.knownMargin !== null ? `${formatNumber(totals.knownMargin)}%` : 'null']);
            lines.push(['ROI', totals.knownRoi !== null ? `${formatNumber(totals.knownRoi)}%` : 'null']);
            lines.push(['Покрытие себестоимости', `${formatNumber(totals.costCoveragePercent)}%`]);
        }
        return lines;
    }

    function buildJSON(dataset, rawItems, totals, meta) {
        const items = (rawItems || []).map(r => formatItem(dataset, r));
        const out = {
            meta: Object.assign({
                dataset,
                exportedAt: new Date().toISOString(),
                source: 'FunPay Funcy Finance Hub'
            }, meta || {}),
            totals: totals || null,
            items: items
        };
        return JSON.stringify(out, null, 2);
    }

    function buildCSV(dataset, rawItems, totals, meta) {
        const schema = SCHEMAS[dataset] || SCHEMAS.sales;
        const items = (rawItems || []).map(r => formatItem(dataset, r));
        const sep = ';';

        const lines = [];
        // Header
        lines.push(schema.map(col => formatString(col.label)).join(sep));

        // Rows
        for (const item of items) {
            lines.push(schema.map(col => {
                const val = item[col.key];
                return col.format(val);
            }).join(sep));
        }

        // Totals summary
        const cur = (meta && meta.currency && meta.currency !== 'all') ? meta.currency : ((totals && totals.currency) || 'RUB');
        const summary = buildTotalsSummary(dataset, totals, cur);
        if (summary.length) {
            lines.push('');
            for (const [k, v] of summary) {
                lines.push(`${formatString(k)}${sep}${formatString(v)}`);
            }
        }

        return '\uFEFF' + lines.join('\r\n');
    }

    function download(dataset, format, rawItems, totals, meta) {
        const isJson = String(format).toLowerCase() === 'json';
        const ext = isJson ? 'json' : 'csv';
        const mime = isJson ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8';
        const content = isJson
            ? buildJSON(dataset, rawItems, totals, meta)
            : buildCSV(dataset, rawItems, totals, meta);

        const period = (meta && meta.period) ? meta.period : 'all';
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `funpay_finance_${dataset}_${period}_${dateStr}.${ext}`;

        if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
            const blob = new Blob([content], { type: mime });
            if (typeof window !== 'undefined' && window.FPTExportStudio && window.FPTExportStudio._util && window.FPTExportStudio._util.downloadBlob) {
                window.FPTExportStudio._util.downloadBlob(blob, mime, filename);
            } else if (typeof URL !== 'undefined' && URL.createObjectURL) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 4000);
            }
        }

        return { filename, content, mime };
    }

    const FPTFinanceExport = {
        formatItem,
        buildCSV,
        buildJSON,
        download,
        SCHEMAS
    };

    if (typeof window !== 'undefined') {
        window.FPTFinanceExport = FPTFinanceExport;
        if (window.FPTExportStudio) {
            window.FPTExportStudio.financeExport = FPTFinanceExport;
        }
    }
    if (root) {
        root.FPTFinanceExport = FPTFinanceExport;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FPTFinanceExport;
    }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
