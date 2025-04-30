/**
 * Script de respaldo para transcripción cuando Python falla
 */
const fs = require('fs');
const path = require('path');

// Argumentos: ruta al archivo de audio
const audioPath = process.argv[2];

if (!audioPath) {
  console.error('Se requiere la ruta del archivo de audio como argumento');
  process.exit(1);
}

// Función principal de transcripción de respaldo
async function fallbackTranscribe() {
  try {
    console.log(`[FALLBACK] Iniciando transcripción de respaldo para: ${audioPath}`);
    
    // En un entorno real, aquí podrías implementar una llamada a una API externa
    // como AssemblyAI, Google Speech-to-Text, etc.
    
    // Para este ejemplo, crearemos un archivo de transcripción simple
    const baseFileName = path.basename(audioPath, '.mp3');
    const outputPath = path.join(path.dirname(audioPath), `${baseFileName}_transcripcion.txt`);
    
    // Crear un mensaje indicando que es una transcripción de respaldo
    const content = `
    [TRANSCRIPCIÓN DE RESPALDO]
    
    Este es un contenido de respaldo generado cuando no se pudo transcribir el audio mediante Python.
    
    Por favor, considera las siguientes opciones:
    1. Verifica que Python y las bibliotecas necesarias estén instaladas correctamente
    2. Comprueba que el archivo de audio esté en un formato compatible
    3. Intenta con un servicio de transcripción en línea
    
    Archivo original: ${audioPath}
    Fecha: ${new Date().toISOString()}
    `;
    
    // Guardar archivo de salida
    fs.writeFileSync(outputPath, content);
    
    console.log(`[FALLBACK] Archivo de transcripción creado en: ${outputPath}`);
    
    process.exit(0); // Salir con éxito
  } catch (error) {
    console.error(`[FALLBACK] Error en transcripción de respaldo: ${error.message}`);
    process.exit(1); // Salir con error
  }
}

// Ejecutar el script
fallbackTranscribe();