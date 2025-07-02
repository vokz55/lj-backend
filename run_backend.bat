@echo off
echo Запуск backend...

:: Переход в директорию, где находится этот файл (на всякий случай)
cd /d %~dp0

:: Запуск npm run dev
call npm run start