// Archivo de respaldo para transcripción cuando Python falla
const fs = require('fs');
const path = require('path');

// Procesar argumentos
const audioFilePath = process.argv[2];
if (!audioFilePath) {
  console.error('Debe proporcionar la ruta del archivo de audio');
  process.exit(1);
}

// Obtener el nombre base del archivo
const baseName = path.basename(audioFilePath, path.extname(audioFilePath));
const outputPath = path.join(path.dirname(audioFilePath), `${baseName}_transcripcion.txt`);

// Mensaje de transcripción de respaldo
const message = `
[TRANSCRIPCIÓN DE RESPALDO]

Este es un mensaje generado por el sistema JavaScript de respaldo.
La transcripción no pudo ser realizada porque Python o las bibliotecas necesarias no están disponibles.

Archivo original: ${audioFilePath}
Fecha de procesamiento: ${new Date().toISOString()}

Por favor, verifica que:
1. Python 3.9 o superior está instalado
2. La biblioteca SpeechRecognition está instalada
3. FFmpeg está disponible en el sistema

Este archivo es un placeholder y debe ser reemplazado por la transcripción real cuando sea posible.
`;

// Escribir el archivo de transcripción
fs.writeFileSync(outputPath, message);
console.log(`Archivo de transcripción de respaldo creado en: ${outputPath}`);
process.exit(0);