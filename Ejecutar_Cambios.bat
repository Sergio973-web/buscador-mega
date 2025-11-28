@echo off
REM --------------------------------------------------------
REM Script para subir cambios a GitHub y desplegar en Vercel
REM --------------------------------------------------------

echo -----------------------------------------------
echo Comenzando despliegue...
echo -----------------------------------------------

REM 1. Ir al directorio del proyecto
cd /d "C:\Users\sergi\Desktop\ProyectoBuscador"

REM 2. Eliminar el viejo productos.json de la raíz (si existe)
if exist productos.json (
    echo ⚠ Eliminando productos.json de la raíz
    git rm productos.json
)

REM 3. Agregar el nuevo productos.json
echo 📂 Agregando productos.json
git add productos.json

REM 4. Agregar todos los .js de la carpeta api
echo 📂 Agregando archivos de api/
git add api\*.js

REM 5. Agregar toda la carpeta bases
echo 📂 Agregando carpeta bases/
git add bases\*

REM 6. Verificar si hay cambios para commitear
git diff --cached --quiet
if %errorlevel%==0 (
    echo ✅ No hay cambios para commitear.
) else (
    REM 7. Hacer commit con mensaje con fecha y hora
    for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set mydate=%%c-%%b-%%a
    for /f "tokens=1-3 delims=:." %%a in ('echo %time%') do set mytime=%%a-%%b-%%c
    git commit -m "Actualización automática %mydate% %mytime%"
    
    REM 8. Hacer push a GitHub
    git push origin main
)

REM 9. Desplegar en Vercel (siempre)
echo 🚀 Desplegando en Vercel...
vercel --prod --force

echo -----------------------------------------------
echo Despliegue finalizado
echo -----------------------------------------------
pause
