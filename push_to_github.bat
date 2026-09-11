@echo off
cd /d "%~dp0"
echo =======================================================
echo   Pushing Rotimatic NEXT to GitHub
echo   Repository: https://github.com/thecreatorcode7-cell/rotimatic-next.git
echo =======================================================
echo.
echo If prompted for Username: enter your GitHub username (thecreatorcode7-cell)
echo If prompted for Password: enter your GitHub Personal Access Token (PAT)
echo.
"C:\Users\sumit\.gemini\antigravity\scratch\mingit\cmd\git.exe" push -u origin main
echo.
pause
