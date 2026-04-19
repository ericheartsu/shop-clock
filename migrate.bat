@echo off
REM Shop Clock migration — writes output to migrate-log.txt so we can see what happened.

cd /d "%~dp0"
echo Running Prisma migration against Neon... > migrate-log.txt
echo ==================================== >> migrate-log.txt
call npx prisma db push >> migrate-log.txt 2>&1
echo ==================================== >> migrate-log.txt
echo DONE. Exit code: %ERRORLEVEL% >> migrate-log.txt

REM Keep window open
echo.
echo Migration finished. Check migrate-log.txt for output.
echo Press any key to close.
pause >nul
