#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FunPay Sales Export Cleaner & Enhancer.
Converts raw FunPay sales export ZIP/CSV into clean, human-readable Excel (.xlsx) and CSV (.csv).
"""

import os
import sys
import csv
import json
import zipfile
import re
from datetime import datetime, timezone, timedelta
import xml.sax.saxutils as saxutils

def xml_escape(s):
    if s is None:
        return ""
    s = str(s)
    # Remove control characters forbidden in XML
    s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', s)
    return saxutils.escape(s)

def parse_iso(ts_str):
    if not ts_str:
        return None
    try:
        ts_str = ts_str.strip()
        if ts_str.endswith('Z'):
            ts_str = ts_str[:-1] + '+00:00'
        return datetime.fromisoformat(ts_str)
    except Exception:
        return None

def col_letter(n):
    # 1 -> A, 2 -> B ...
    s = ""
    while n > 0:
        m = (n - 1) % 26
        s = chr(65 + m) + s
        n = (n - m - 1) // 26
    return s

def clean_sales(zip_or_csv_path, output_dir=None):
    if not os.path.exists(zip_or_csv_path):
        raise FileNotFoundError(f"File not found: {zip_or_csv_path}")

    if output_dir is None:
        output_dir = os.path.dirname(zip_or_csv_path) or '.'

    # 1. Read CSV
    if zip_or_csv_path.lower().endswith('.zip'):
        with zipfile.ZipFile(zip_or_csv_path, 'r') as z:
            csv_candidates = [n for n in z.namelist() if n.lower().endswith('.csv')]
            if not csv_candidates:
                raise ValueError("No CSV file found inside ZIP archive")
            csv_name = csv_candidates[0]
            raw_bytes = z.read(csv_name)
    else:
        with open(zip_or_csv_path, 'rb') as f:
            raw_bytes = f.read()
        csv_name = os.path.basename(zip_or_csv_path)

    text = raw_bytes.decode('utf-8-sig', errors='replace')
    reader = csv.DictReader(text.splitlines())
    rows = list(reader)

    print(f"Loaded {len(rows)} orders from {csv_name}")

    processed = []
    total_gross = 0.0
    total_net = 0.0
    total_refund = 0.0

    tz_msk = timezone(timedelta(hours=3))

    for r in rows:
        order_uid = r.get('order_uid', '').strip()
        status_raw = r.get('status', '').strip().lower()
        is_refunded = (status_raw == 'refunded' or bool(r.get('refunded_at', '').strip()))
        status_ru = 'Возврат' if is_refunded else 'Закрыт'

        try:
            amount_raw = float(r.get('amount', '0') or 0)
        except Exception:
            amount_raw = 0.0

        total_gross += amount_raw
        if is_refunded:
            net_amount = 0.0
            refund_amount = amount_raw
            total_refund += amount_raw
        else:
            net_amount = amount_raw
            refund_amount = 0.0
            total_net += amount_raw

        game = r.get('game_name', '').strip()
        section = r.get('section_name', '').strip()
        buyer = r.get('buyer_name', '').strip()
        player = r.get('player', '').strip()

        dt_close = parse_iso(r.get('closed_at') or r.get('refunded_at') or r.get('paid_at') or r.get('created_at'))
        dt_created = parse_iso(r.get('created_at'))

        # Display in MSK (UTC+3)
        dt_display = dt_close.astimezone(tz_msk) if dt_close else (dt_created.astimezone(tz_msk) if dt_created else None)

        date_str = dt_display.strftime('%d.%m.%Y %H:%M') if dt_display else ''
        month_str = dt_display.strftime('%Y-%m') if dt_display else ''

        td_raw = r.get('type_data', '').strip()
        item_title = ''
        auto_delivery = 'Нет'
        extra_details = []

        if td_raw:
            try:
                td = json.loads(td_raw)
                if td.get('auto_delivery'):
                    auto_delivery = 'Да'

                fields = td.get('fields', {})
                if isinstance(fields, dict):
                    sm = fields.get('summary', {}).get('value')
                    if isinstance(sm, dict):
                        item_title = sm.get('ru') or sm.get('en') or ''
                    elif isinstance(sm, str):
                        item_title = sm

                    if 'skin' in fields:
                        s_val = fields['skin'].get('value')
                        if s_val:
                            extra_details.append(f"Скинов: {s_val}")
                    if 'region' in fields:
                        rg_val = fields['region'].get('value')
                        if rg_val:
                            extra_details.append(f"Регион: {rg_val}")
                    if 'method' in fields:
                        m_val = fields['method'].get('value')
                        if m_val:
                            extra_details.append(f"Метод: {m_val}")

                td_amt = td.get('amount')
                if td_amt and str(td_amt) != '1':
                    if not item_title or item_title == section:
                        item_title = f"{td_amt} шт."
                    else:
                        extra_details.append(f"Кол-во: {td_amt}")
            except Exception:
                pass

        if not item_title:
            item_title = section or game or 'Товар'

        rating = r.get('review_rating', '').strip()
        review = r.get('review_text', '').strip().replace('\r', ' ').replace('\n', ' ')
        reply = r.get('review_reply', '').strip().replace('\r', ' ').replace('\n', ' ')

        link = f"https://funpay.com/orders/{order_uid}/" if order_uid else ''

        processed.append({
            'order_uid': order_uid,
            'date': date_str,
            'month': month_str,
            'status': status_ru,
            'game': game,
            'section': section,
            'title': item_title,
            'extra': ', '.join(extra_details),
            'amount': round(amount_raw, 2),
            'net_revenue': round(net_amount, 2),
            'refund': round(refund_amount, 2),
            'auto_delivery': auto_delivery,
            'buyer': buyer,
            'player': player,
            'rating': rating,
            'review': review,
            'reply': reply,
            'link': link
        })

    print(f"Cleaned {len(processed)} orders:")
    print(f"  Gross volume: {total_gross:,.2f} RUB")
    print(f"  Net revenue:  {total_net:,.2f} RUB")
    print(f"  Refunds:      {total_refund:,.2f} RUB")

    # 2. Write clean CSV (; delimiter, UTF-8 BOM, Russian Excel friendly)
    csv_out_path = os.path.join(output_dir, 'funpay_sales_clean.csv')

    columns = [
        ('order_uid', '№ Заказа'),
        ('date', 'Дата (МСК)'),
        ('month', 'Месяц'),
        ('status', 'Статус'),
        ('game', 'Игра'),
        ('section', 'Категория'),
        ('title', 'Товар / Описание'),
        ('extra', 'Параметры'),
        ('amount', 'Сумма (₽)'),
        ('net_revenue', 'Выручка (₽)'),
        ('refund', 'Возврат (₽)'),
        ('auto_delivery', 'Автовыдача'),
        ('buyer', 'Покупатель'),
        ('player', 'Ник в игре'),
        ('rating', 'Оценка'),
        ('review', 'Отзыв'),
        ('reply', 'Ответ продавца'),
        ('link', 'Ссылка на FunPay')
    ]

    with open(csv_out_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL)
        writer.writerow([label for _, label in columns])
        for p in processed:
            writer.writerow([p[col_key] for col_key, _ in columns])
        # Summary row
        writer.writerow([])
        writer.writerow(['ИТОГО', '', '', '', '', '', '', '', f"{total_gross:.2f}", f"{total_net:.2f}", f"{total_refund:.2f}", '', '', '', '', '', '', ''])

    print(f"Saved clean CSV: {csv_out_path}")

    # 3. Generate native Excel XLSX
    xlsx_out_path = os.path.join(output_dir, 'funpay_sales_clean.xlsx')
    build_xlsx(xlsx_out_path, columns, processed, {
        'total_orders': len(processed),
        'gross': total_gross,
        'net': total_net,
        'refund': total_refund
    })
    print(f"Saved clean XLSX: {xlsx_out_path}")

    # 4. Also pack into a clean ZIP
    zip_out_path = os.path.join(output_dir, 'funpay_sales_clean.zip')
    with zipfile.ZipFile(zip_out_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(csv_out_path, arcname='funpay_sales_clean.csv')
        z.write(xlsx_out_path, arcname='funpay_sales_clean.xlsx')
    print(f"Saved archive: {zip_out_path}")

def build_xlsx(filename, columns, rows, summary):
    """
    Builds a styled OOXML XLSX spreadsheet without external dependencies.
    """
    col_widths = {
        'order_uid': 14,
        'date': 18,
        'month': 11,
        'status': 12,
        'game': 16,
        'section': 20,
        'title': 40,
        'extra': 18,
        'amount': 14,
        'net_revenue': 14,
        'refund': 14,
        'auto_delivery': 13,
        'buyer': 16,
        'player': 16,
        'rating': 10,
        'review': 35,
        'reply': 30,
        'link': 32
    }

    # Styles
    # Colors: Header: 1F4E79 (Deep navy), Accent: 2F5597, Zebra: F2F5F9, Refund: FCE8E6 (Soft red), Closed: E6F4EA (Soft green)
    styles_xml = r"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2">
  <numFmt numFmtId="164" formatCode="#,##0.00\ &quot;₽&quot;"/>
  <numFmt numFmtId="165" formatCode="[Red]-#,##0.00\ &quot;₽&quot;;#,##0.00\ &quot;₽&quot;"/>
</numFmts>
<fonts count="6">
  <font><sz val="10"/><name val="Segoe UI"/><color theme="1"/></font> <!-- 0 default -->
  <font><b/><sz val="11"/><name val="Segoe UI"/><color rgb="FFFFFFFF"/></font> <!-- 1 header -->
  <font><b/><sz val="16"/><name val="Segoe UI"/><color rgb="FF1F4E79"/></font> <!-- 2 title -->
  <font><sz val="10"/><name val="Segoe UI"/><color rgb="FF595959"/></font> <!-- 3 subtitle -->
  <font><b/><sz val="10"/><name val="Segoe UI"/><color rgb="FF1F4E79"/></font> <!-- 4 total -->
  <font><b/><sz val="10"/><name val="Segoe UI"/><color rgb="FFC00000"/></font> <!-- 5 red text -->
</fonts>
<fills count="7">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill> <!-- 2 header -->
  <fill><patternFill patternType="solid"><fgColor rgb="FFF2F5F9"/><bgColor indexed="64"/></patternFill></fill> <!-- 3 zebra -->
  <fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill> <!-- 4 total -->
  <fill><patternFill patternType="solid"><fgColor rgb="FFFCE8E6"/><bgColor indexed="64"/></patternFill></fill> <!-- 5 refund soft red -->
  <fill><patternFill patternType="solid"><fgColor rgb="FFE6F4EA"/><bgColor indexed="64"/></patternFill></fill> <!-- 6 closed soft green -->
</fills>
<borders count="3">
  <border/>
  <border>
    <left style="thin"><color rgb="FFD9D9D9"/></left>
    <right style="thin"><color rgb="FFD9D9D9"/></right>
    <top style="thin"><color rgb="FFD9D9D9"/></top>
    <bottom style="thin"><color rgb="FFD9D9D9"/></bottom>
  </border>
  <border>
    <top style="thin"><color rgb="FF1F4E79"/></top>
    <bottom style="double"><color rgb="FF1F4E79"/></bottom>
  </border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="center"/></xf> <!-- 0 default left -->
  <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf> <!-- 1 header -->
  <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf> <!-- 2 zebra left -->
  <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf> <!-- 3 money -->
  <xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf> <!-- 4 money zebra -->
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf> <!-- 5 title -->
  <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf> <!-- 6 subtitle -->
  <xf numFmtId="0" fontId="4" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf> <!-- 7 total text -->
  <xf numFmtId="164" fontId="4" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf> <!-- 8 total money -->
  <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf> <!-- 9 center -->
  <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf> <!-- 10 center zebra -->
  <xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf> <!-- 11 refund badge -->
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""

    # Sheet rows
    sheet_rows = []
    r_idx = 1

    def cell(col, r, style_id, val_type, val):
        ref = col_letter(col) + str(r)
        if val_type == 'n':
            return f'<c r="{ref}" s="{style_id}"><v>{val}</v></c>'
        if val is None or val == '':
            return f'<c r="{ref}" s="{style_id}"/>'
        return f'<c r="{ref}" s="{style_id}" t="inlineStr"><is><t xml:space="preserve">{xml_escape(val)}</t></is></c>'

    # 1. Title
    title = "ОТЧЁТ ПО ПРОДАЖАМ FUNPAY"
    subtitle = f"Период: {rows[-1]['date'][:10]} — {rows[0]['date'][:10]} · Всего заказов: {summary['total_orders']} · Чистая выручка: {summary['net']:,.2f} ₽"
    sheet_rows.append(f'<row r="{r_idx}" ht="30" customHeight="1">{cell(1, r_idx, 5, "s", title)}</row>')
    r_idx += 1
    sheet_rows.append(f'<row r="{r_idx}" ht="18" customHeight="1">{cell(1, r_idx, 6, "s", subtitle)}</row>')
    r_idx += 1
    sheet_rows.append(f'<row r="{r_idx}"></row>') # empty row
    r_idx += 1

    # 2. Header
    header_cells = []
    for c_i, (_, label) in enumerate(columns):
        header_cells.append(cell(c_i + 1, r_idx, 1, 's', label))
    sheet_rows.append(f'<row r="{r_idx}" ht="26" customHeight="1">{"".join(header_cells)}</row>')
    header_row_idx = r_idx
    r_idx += 1

    # 3. Data rows
    num_fields = {'amount', 'net_revenue', 'refund'}
    center_fields = {'date', 'month', 'status', 'auto_delivery', 'rating'}

    for n, r_data in enumerate(rows):
        is_zebra = (n % 2 == 1)
        is_refund = (r_data['status'] == 'Возврат')
        row_cells = []
        for c_i, (k, _) in enumerate(columns):
            val = r_data[k]
            if k in num_fields:
                s_id = 4 if is_zebra else 3
                row_cells.append(cell(c_i + 1, r_idx, s_id, 'n', float(val or 0)))
            elif k == 'status':
                s_id = 11 if is_refund else (10 if is_zebra else 9)
                row_cells.append(cell(c_i + 1, r_idx, s_id, 's', val))
            elif k in center_fields:
                s_id = 10 if is_zebra else 9
                row_cells.append(cell(c_i + 1, r_idx, s_id, 's', val))
            else:
                s_id = 2 if is_zebra else 0
                row_cells.append(cell(c_i + 1, r_idx, s_id, 's', str(val)))
        sheet_rows.append(f'<row r="{r_idx}" ht="20" customHeight="1">{"".join(row_cells)}</row>')
        r_idx += 1

    # 4. Totals row
    data_start = header_row_idx + 1
    data_end = r_idx - 1
    total_cells = []
    for c_i, (k, _) in enumerate(columns):
        c_num = c_i + 1
        ref = col_letter(c_num) + str(r_idx)
        if k == 'order_uid':
            total_cells.append(cell(c_num, r_idx, 7, 's', 'ИТОГО:'))
        elif k in num_fields:
            c_let = col_letter(c_num)
            formula = f"SUM({c_let}{data_start}:{c_let}{data_end})"
            total_cells.append(f'<c r="{ref}" s="8"><f>{formula}</f></c>')
        else:
            total_cells.append(cell(c_num, r_idx, 7, 's', ''))
    sheet_rows.append(f'<row r="{r_idx}" ht="24" customHeight="1">{"".join(total_cells)}</row>')

    # Col widths XML
    cols_xml_parts = []
    for c_i, (k, _) in enumerate(columns):
        w = col_widths.get(k, 15)
        cols_xml_parts.append(f'<col min="{c_i + 1}" max="{c_i + 1}" width="{w}" customWidth="1"/>')
    cols_xml = f'<cols>{"".join(cols_xml_parts)}</cols>'

    # Auto-filter & freeze panes
    last_col_letter = col_letter(len(columns))
    auto_filter = f'<autoFilter ref="A{header_row_idx}:{last_col_letter}{data_end}"/>'
    freeze_xml = f'<sheetViews><sheetView workbookViewId="0"><pane ySplit="{header_row_idx}" topLeftCell="A{data_start}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A{data_start}" sqref="A{data_start}"/></sheetView></sheetViews>'

    sheet_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
{freeze_xml}
{cols_xml}
<sheetData>
{"".join(sheet_rows)}
</sheetData>
{auto_filter}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
</worksheet>"""

    # Package files
    files = {
        '[Content_Types].xml': """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>""",
        '_rels/.rels': """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>""",
        'xl/workbook.xml': """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Продажи FunPay" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>""",
        'xl/_rels/workbook.xml.rels': """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>""",
        'xl/styles.xml': styles_xml,
        'xl/worksheets/sheet1.xml': sheet_xml
    }

    with zipfile.ZipFile(filename, 'w', zipfile.ZIP_DEFLATED) as z:
        for arcname, content in files.items():
            z.writestr(arcname, content.encode('utf-8'))

if __name__ == '__main__':
    zip_path = os.path.expanduser('~/Downloads/funpay_sales_to20260924.zip')
    clean_sales(zip_path)
