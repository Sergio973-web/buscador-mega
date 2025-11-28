@echo off
REM --------------------------------------------------------
REM Script para subir index.html y productos.json a GitHub y desplegar en Vercel
REM --------------------------------------------------------

echo -----------------------------------------------
echo Comenzando despliegue...
echo -----------------------------------------------

REM Ir al directorio del proyecto
cd /d "C:\Users\sergi\Desktop\ProyectoBuscador"

REM Agregar index.html y productos.json
echo 📂 Agregando index.html y productos.json
git add index.html productos.json

REM Verificar si hay cambios para commitear
git diff --cached --quiet
if %errorlevel%==0 (
    echo ✅ No hay cambios para commitear.
) else (
    REM Hacer commit con mensaje con fecha y hora
    for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set mydate=%%c-%%b-%%a
    for /f "tokens=1-3 delims=:." %%a in ('echo %time%') do set mytime=%%a-%%b-%%c
    git commit -m "Actualización automática index.html y productos.json %mydate% %mytime%"

    REM Hacer push a GitHub
    git push origin main
)

REM Desplegar en Vercel (siempre)
echo 🚀 Desplegando en Vercel...
vercel --prod --force

echo -----------------------------------------------
echo Despliegue finalizado
echo -----------------------------------------------
pause
