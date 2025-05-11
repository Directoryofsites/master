@echo off
setlocal enabledelayedexpansion
title Sistema de Copias de Seguridad y Restauración

:: Establecer el directorio de trabajo
cd /d E:\Admin7\master\backend\scripts

:: Pantalla principal
:MENU
cls
echo ====================================================
echo    SISTEMA DE COPIAS DE SEGURIDAD Y RESTAURACIÓN
echo ====================================================
echo.
echo  Seleccione una opción:
echo.
echo  [1] Crear una copia de seguridad
echo  [2] Restaurar una copia de seguridad
echo  [3] Salir
echo.
echo ====================================================
echo.

:: Solicitar opción
set /p opcion="Ingrese una opción (1-3): "

:: Procesar la selección
if "%opcion%"=="1" goto BACKUP
if "%opcion%"=="2" goto RESTORE
if "%opcion%"=="3" goto SALIR

:: Si no es una opción válida
echo.
echo La opción ingresada no es válida.
echo Presione cualquier tecla para volver al menú...
pause >nul
goto MENU

:: Proceso de copia de seguridad
:BACKUP
cls
echo ====================================================
echo            CREAR COPIA DE SEGURIDAD
echo ====================================================
echo.
echo  Buckets disponibles:
echo  - master
echo  - contenedor001
echo  - contenedor002
echo  - contenedor003
echo  - contenedor004
echo  - contenedor005
echo  - contenedor006
echo  - contenedor007
echo  - contenedor008
echo  - contenedor009
echo  - contenedor010
echo  - contenedor011
echo  - contenedor012
echo  - contenedor013
echo  - pruebas
echo  - personal1
echo.

set /p bucketOrigen="Ingrese el nombre del bucket a copiar: "
set fechaActual=%date:~6,4%-%date:~3,2%-%date:~0,2%
set nombreArchivo=backup-%bucketOrigen%-%fechaActual%.zip

echo.
echo El archivo de respaldo se guardará como: %nombreArchivo%
set /p nombreArchivo="Presione ENTER para aceptar o ingrese otro nombre: "

echo.
echo Ejecutando copia de seguridad...
echo node backup_script.js %bucketOrigen% %nombreArchivo%
echo.

node backup_script.js %bucketOrigen% %nombreArchivo%

echo.
if %ERRORLEVEL% EQU 0 (
    echo La copia de seguridad se ha completado correctamente.
    echo Archivo de respaldo: %nombreArchivo%
) else (
    echo Ha ocurrido un error durante la copia de seguridad.
    echo Código de error: %ERRORLEVEL%
)

echo.
echo Presione cualquier tecla para volver al menú principal...
pause >nul
goto MENU

:: Proceso de restauración
:RESTORE
cls
echo ====================================================
echo            RESTAURAR COPIA DE SEGURIDAD
echo ====================================================
echo.

echo Archivos de respaldo disponibles:
echo.

:: Mostrar archivos ZIP disponibles
dir /b *.zip

echo.
set /p archivoBackup="Ingrese el nombre del archivo de respaldo a restaurar: "

:: Verificar que el archivo existe
if not exist "%archivoBackup%" (
    echo.
    echo El archivo de respaldo no existe.
    echo Asegúrese de que el nombre sea correcto o que el archivo esté en la carpeta actual.
    echo.
    echo Presione cualquier tecla para volver al menú principal...
    pause >nul
    goto MENU
)

echo.
echo Buckets disponibles para restauración:
echo.
echo  - master
echo  - contenedor001
echo  - contenedor002
echo  - contenedor003
echo  - contenedor004
echo  - contenedor005
echo  - contenedor006
echo  - contenedor007
echo  - contenedor008
echo  - contenedor009
echo  - contenedor010
echo  - contenedor011
echo  - contenedor012
echo  - contenedor013
echo  - pruebas
echo  - personal1
echo.

set /p bucketDestino="Ingrese el nombre del bucket de destino: "

echo.
echo ¡ATENCIÓN! Va a restaurar el archivo %archivoBackup% en el bucket %bucketDestino%.
echo Esta acción podría sobrescribir datos existentes.
echo.
set /p confirmacion="¿Está seguro que desea continuar? (S/N): "

if /i "%confirmacion%"=="S" (
    echo.
    echo Ejecutando restauración...
    echo node restore_script.js %archivoBackup% %bucketDestino%
    echo.
    
    node restore_script.js %archivoBackup% %bucketDestino%
    
    echo.
    if %ERRORLEVEL% EQU 0 (
        echo La restauración se ha completado correctamente.
    ) else (
        echo Ha ocurrido un error durante la restauración.
        echo Código de error: %ERRORLEVEL%
    )
) else (
    echo.
    echo La restauración ha sido cancelada.
)

echo.
echo Presione cualquier tecla para volver al menú principal...
pause >nul
goto MENU

:SALIR
cls
echo ====================================================
echo     Gracias por usar el sistema de backup/restore
echo ====================================================
echo.
echo Saliendo del programa...
timeout /t 2 >nul
exit