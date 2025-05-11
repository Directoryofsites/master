@echo off
title Sistema de Restauración
color 0A

:: Ir a la carpeta de scripts
cd /d E:\Admin7\master\backend\scripts

:: Sección de restauración
cls
echo ====================================================
echo            RESTAURAR COPIA DE SEGURIDAD
echo ====================================================
echo.

echo Archivos de respaldo disponibles:
echo.

:: Listar los archivos zip disponibles
dir *.zip /b

echo.
set /p archivo="Ingrese el nombre del archivo a restaurar: "

:: Verificar que el archivo existe
if not exist "%archivo%" (
    echo.
    echo El archivo no existe. Verifique el nombre.
    echo.
    pause
    exit
)

echo.
echo Buckets disponibles para restauración:
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

set /p opcion="Ingrese el número del bucket de destino: "

:: Convertir el número a nombre de bucket
if "%opcion%"=="0" set destino=master
if "%opcion%"=="1" set destino=contenedor001
if "%opcion%"=="2" set destino=contenedor002
if "%opcion%"=="3" set destino=contenedor003
if "%opcion%"=="4" set destino=contenedor004
if "%opcion%"=="5" set destino=contenedor005
if "%opcion%"=="6" set destino=contenedor006
if "%opcion%"=="7" set destino=contenedor007
if "%opcion%"=="8" set destino=contenedor008
if "%opcion%"=="9" set destino=contenedor009
if "%opcion%"=="10" set destino=contenedor010
if "%opcion%"=="11" set destino=contenedor011
if "%opcion%"=="12" set destino=contenedor012
if "%opcion%"=="13" set destino=contenedor013
if "%opcion%"=="14" set destino=pruebas
if "%opcion%"=="15" set destino=personal1

:: Verificar que se seleccionó un bucket válido
if not defined destino (
    echo.
    echo Número de bucket no válido.
    echo.
    pause
    exit
)

echo.
echo Va a restaurar el archivo %archivo% en el bucket %destino%.
echo.
set /p confirma="¿Está seguro? (S/N): "

if /i "%confirma%"=="S" (
    echo.
    echo Ejecutando restauración...
    echo node restore_script.js "%archivo%" %destino%
    echo.
    
    node restore_script.js "%archivo%" %destino%
    
    echo.
    if %ERRORLEVEL% EQU 0 (
        echo Restauración completada con éxito.
    ) else (
        echo Error en la restauración. Código: %ERRORLEVEL%
    )
) else (
    echo.
    echo Operación cancelada.
)

echo.
pause