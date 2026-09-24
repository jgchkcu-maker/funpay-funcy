#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Утилита автоматической очистки и улучшения выгрузки продаж FunPay.
Ищет последнюю выгрузку в папке 'Загрузки' (или принимает путь аргументом)
и генерирует очищенные файлы:
  - funpay_sales_clean.xlsx (Excel с автофильтрами, стилями и подсветкой)
  - funpay_sales_clean.csv (CSV с разделителем ';' и UTF-8 BOM для русского Excel)
  - funpay_sales_clean.zip (архив с готовыми файлами)
"""

import os
import sys
import glob

# Добавляем папку скриптов в sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))
from clean_sales_export import clean_sales

def main():
    target = None
    if len(sys.argv) > 1:
        target = sys.argv[1]
    else:
        # Автопоиск в Загрузках
        downloads_dir = os.path.expanduser('~/Downloads')
        candidates = glob.glob(os.path.join(downloads_dir, 'funpay_sales_*.zip')) + \
                     glob.glob(os.path.join(downloads_dir, 'funpay_sales_*.csv'))
        # Исключаем уже очищенные
        candidates = [c for c in candidates if not c.endswith('_clean.zip') and not c.endswith('_clean.csv') and not c.endswith('_clean.xlsx')]
        if candidates:
            # Сортируем по времени модификации (самый свежий)
            candidates.sort(key=os.path.getmtime, reverse=True)
            target = candidates[0]

    if not target or not os.path.exists(target):
        print("Ошибка: не найден файл выгрузки FunPay (funpay_sales_*.zip или *.csv).")
        print("Укажите путь к файлу вручную: python fix_funpay_sales.py <путь>")
        sys.exit(1)

    print(f"Обработка выгрузки: {target}")
    clean_sales(target)
    print("\n[УСПЕХ] Готово! Очищенные файлы сохранены в папке Загрузок:")
    downloads = os.path.dirname(target)
    print(f"  • {os.path.join(downloads, 'funpay_sales_clean.xlsx')}")
    print(f"  • {os.path.join(downloads, 'funpay_sales_clean.csv')}")
    print(f"  • {os.path.join(downloads, 'funpay_sales_clean.zip')}")

if __name__ == '__main__':
    main()
