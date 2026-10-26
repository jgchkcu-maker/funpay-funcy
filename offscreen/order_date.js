// FunPay calendar: UTC+3, minute precision. Shared with the offscreen classic script.
(function (root) {
    const offset = 3 * 60 * 60 * 1000;
    const months = [
        ['января', 'січня', 'january', 'jan'], ['февраля', 'лютого', 'february', 'feb'],
        ['марта', 'березня', 'march', 'mar'], ['апреля', 'квітня', 'april', 'apr'],
        ['мая', 'травня', 'may'], ['июня', 'червня', 'june', 'jun'],
        ['июля', 'липня', 'july', 'jul'], ['августа', 'серпня', 'august', 'aug'],
        ['сентября', 'вересня', 'september', 'sep', 'sept'], ['октября', 'жовтня', 'october', 'oct'],
        ['ноября', 'листопада', 'november', 'nov'], ['декабря', 'грудня', 'december', 'dec']
    ];
    function parse(dateString, now = Date.now()) {
        const s = String(dateString || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const current = new Date(now + offset);
        let year = current.getUTCFullYear(), month, day, hour, minute, inferredYear = false;
        const relative = s.match(/^(сегодня|вчера|сьогодні|вчора|today|yesterday),? (\d{1,2}):(\d{2})$/);
        if (relative) {
            const yesterday = ['вчера', 'вчора', 'yesterday'].includes(relative[1]);
            const calendar = new Date(current.getTime() - (yesterday ? 86400000 : 0));
            year = calendar.getUTCFullYear(); month = calendar.getUTCMonth(); day = calendar.getUTCDate();
            hour = +relative[2]; minute = +relative[3];
        } else {
            let m = s.match(/^(\d{1,2}) ([\p{L}]+)\.? ?(\d{4})?,? (\d{1,2}):(\d{2})$/u);
            if (m) { day = +m[1]; month = months.findIndex(names => names.includes(m[2])); }
            else {
                const en = s.match(/^([a-z]+)\.? (\d{1,2}),? ?(\d{4})?,? (\d{1,2}):(\d{2})$/);
                if (!en) return null;
                m = [en[0], en[2], en[1], en[3], en[4], en[5]];
                day = +m[1]; month = months.findIndex(names => names.includes(m[2]));
            }
            inferredYear = !m[3]; year = m[3] ? +m[3] : year; hour = +m[4]; minute = +m[5];
        }
        if (month < 0 || day < 1 || hour > 23 || minute > 59 || year < 2000 || year > 9999) return null;
        let utc = Date.UTC(year, month, day, hour, minute);
        // A yearless December shown in January belongs to the preceding year.
        if (inferredYear && utc - offset > now + 60000) { year -= 1; utc = Date.UTC(year, month, day, hour, minute); }
        const check = new Date(utc);
        if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month || check.getUTCDate() !== day) return null;
        return utc - offset;
    }
    root.FPTOrderDate = Object.freeze({ parse, precisionMs: 60000, timeZone: 'Europe/Moscow' });
})(globalThis);
