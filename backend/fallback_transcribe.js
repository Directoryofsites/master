/**
 * Sistema de transcripción de respaldo
 * Este módulo proporciona una solución alternativa cuando Python no está disponible
 */

const fs = require('fs');
const path = require('path');

/**
 * Genera un archivo de transcripción de respaldo
 * @param {string} audioPath - Ruta al archivo de audio MP3
 * @param {string} outputDir - Directorio donde guardar la transcripción
 * @returns {Promise<string>} - Ruta al archivo de transcripción generado
 */
async function generateFallbackTranscription(audioPath, outputDir) {
  return new Promise((resolve, reject) => {
    try {
      console.log('[FALLBACK] Generando transcripción de respaldo para:', audioPath);
      
      // Obtener nombre base del archivo
      const baseFileName = path.basename(audioPath, '.mp3');
      const transcriptionFileName = `${baseFileName}_transcripcion.txt`;
      const outputPath = path.join(outputDir, transcriptionFileName);
      
      // Contenido del archivo de transcripción de respaldo
      const content = `
[TRANSCRIPCIÓN DE RESPALDO - GENERADA POR EL SISTEMA]

Este archivo contiene una transcripción aproximada generada por el sistema cuando
no fue posible utilizar el sistema de transcripción basado en Python.

Archivo original: ${baseFileName}.mp3
Fecha: ${new Date().toISOString()}

------------------------
CONTENIDO APROXIMADO:
------------------------

Este es un archivo de audio que contiene una grabación. El sistema no pudo
transcribir automáticamente el contenido debido a limitaciones técnicas.

Se recomienda:
1. Procesar este audio con otra herramienta de transcripción
2. Verificar la instalación de Python y SpeechRecognition en el servidor
3. Contactar al administrador del sistema

------------------------
`;
      
      // Escribir el archivo
      fs.writeFileSync(outputPath, content);
      console.log('[FALLBACK] Transcripción de respaldo generada en:', outputPath);
      
      resolve(transcriptionFileName);
    } catch (error) {
      console.error('[FALLBACK] Error al generar transcripción de respaldo:', error);
      reject(error);
    }
  });
}

module.exports = {
  generateFallbackTranscription
};