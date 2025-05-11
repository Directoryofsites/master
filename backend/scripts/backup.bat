@echo off
title Sistema de Backup
color 1F

:: Ir a la carpeta de scripts
cd /d E:\Admin7\master\backend\scripts

:: Sección de backup
cls
echo ====================================================
echo            CREAR COPIA DE SEGURIDAD
echo ====================================================
echo.
echo  Buckets disponibles:
echo.
echo  [0] master
echo  [1] contenedor001
echo  [2] contenedor002
echo  [3] contenedor003
echo  [4] contenedor004
echo  [5] contenedor005
echo  [6] contenedor006
echo  [7] contenedor007
echo  [8] contenedor008
echo  [9] contenedor009
echo  [10] contenedor010
echo  [11] contenedor011
echo  [12] contenedor012
echo  [13] contenedor013
echo  [14] pruebas
echo  [15] personal1
echo.

set /p opcion="Ingrese el número del bucket a respaldar: "

:: Convertir el número a nombre de bucket
if "%opcion%"=="0" set origen=master
if "%opcion%"=="1" set origen=contenedor001
if "%opcion%"=="2" set origen=contenedor002
if "%opcion%"=="3" set origen=contenedor003
if "%opcion%"=="4" set origen=contenedor004
if "%opcion%"=="5" set origen=contenedor005
if "%opcion%"=="6" set origen=contenedor006
if "%opcion%"=="7" set origen=contenedor007
if "%opcion%"=="8" set origen=contenedor008
if "%opcion%"=="9" set origen=contenedor009
if "%opcion%"=="10" set origen=contenedor010
if "%opcion%"=="11" set origen=contenedor011
if "%opcion%"=="12" set origen=contenedor012
if "%opcion%"=="13" set origen=contenedor013
if "%opcion%"=="14" set origen=pruebas
if "%opcion%"=="15" set origen=personal1

:: Verificar que se seleccionó un bucket válido
if not defined origen (
    echo.
    echo Número de bucket no válido.
    echo.
    pause
    exit
)

:: Generar nombre de archivo por defecto
set fecha=%date:~6,4%-%date:~3,2%-%date:~0,2%
set archivo=backup-%origen%-%fecha%.zip

echo.
echo Bucket seleccionado: %origen%
echo.
echo El archivo se guardará como: %archivo%
set /p nuevoNombre="Presione ENTER para aceptar o ingrese otro nombre: "

:: Si se ingresó un nuevo nombre, usarlo
if not "%nuevoNombre%"=="" set archivo=%nuevoNombre%

echo.
echo Va a crear una copia de seguridad del bucket %origen%
echo Archivo de salida: %archivo%
echo.
set /p confirma="¿Está seguro? (S/N): "

if /i "%confirma%"=="S" (
    echo.
    echo Ejecutando backup...
    echo node backup_script.js %origen% %archivo%
    echo.
    
    node backup_script.js %origen% %archivo%
    
    echo.
    if %ERRORLEVEL% EQU 0 (
        echo Backup completado con éxito.
        echo Archivo creado: %archivo%
    ) else (
        echo Error en el backup. Código: %ERRORLEVEL%
    )
) else (
    echo.
    echo Operación cancelada.
)

echo.
pause