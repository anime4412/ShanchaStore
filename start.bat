@echo off
rem ============================================================
rem   ShanChaStore - BẤM ĐÚP FILE NÀY ĐỂ MỞ WEB
rem   - Chạy server (node server.js)
rem   - Tự mở trình duyệt tại http://localhost:3000
rem ============================================================
cd /d "%~dp0"

rem Kiểm tra node đã cài chưa
where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js. Vao https://nodejs.org tai ve va cai dat.
  pause
  exit /b 1
)

echo.
echo  ==========================================================
echo    Dang khoi dong ShanCha Store...
echo    Sau khi thay chu "backend dang chay", trinh duyet
echo    se tu dong mo http://localhost:3000
echo    De dung: dong cua so nay hoac nhan Ctrl+C
echo  ==========================================================
echo.

rem Mở trình duyệt sau 2.5 giây (đợi server kịp khởi động)
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

rem Chạy server ở foreground để thấy log; đóng cửa sổ là tắt server
node server.js

echo.
echo  Server da dung. Nhan phim bat ky de dong cua so.
pause >nul
