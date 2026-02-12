@echo off
color 0A
echo ==========================================
echo   생존의 별 - 로컬 서버 시작
echo ==========================================
echo.
echo [32m브라우저에서 다음 주소로 접속하세요:[0m
echo.
echo   [1;36mhttp://localhost:8000[0m
echo.
echo [33m서버를 종료하려면 Ctrl+C를 누르세요.[0m
echo.
echo ==========================================
echo.
python -m http.server 8000
pause
