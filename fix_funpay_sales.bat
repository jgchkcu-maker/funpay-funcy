@echo off
chcp 65001 > nul
echo ========================================================
echo  FunPay Sales Cleaner - Исправление выгрузки продаж
echo ========================================================
python "%~dp0fix_funpay_sales.py" %*
echo.
pause
