@echo off
REM Ejecutar el script local-server.js con Node.js en la misma carpeta

REM Verificar si node está en el PATH
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no está instalado o su ruta no está en la variable PATH.
    pause
    exit /b 1
)

REM Ejecutar el script usando node
node local-server.js

pause