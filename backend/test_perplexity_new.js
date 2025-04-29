// Archivo de prueba para Perplexity
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Crear carpeta local_storage si no existe
const localStorageDir = path.join(__dirname, 'local_storage');
if (!fs.existsSync(localStorageDir)) {
  fs.mkdirSync(localStorageDir, { recursive: true });
  console.log(`Carpeta local_storage creada: ${localStorageDir}`);
}

// Crear carpeta scripts si no existe
const scriptsDir = path.join(__dirname, 'scripts');
if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir, { recursive: true });
  console.log(`Carpeta scripts creada: ${scriptsDir}`);
}

// Ruta del archivo de transcripción
const transcriptionFile = path.join(__dirname, 'local_storage', 'test_transcripcion.txt');

// Si no existe un archivo de prueba, crear uno
if (!fs.existsSync(transcriptionFile)) {
  fs.writeFileSync(transcriptionFile, `
--- TRANSCRIPCION COMPLETA ---
Este es un archivo de prueba para la transcripción. Simula una reunión de la asamblea donde se discutieron varios temas importantes. 
El presidente de la asamblea, Juan Pérez, abrió la sesión a las 10:00 AM. La secretaria, María Rodríguez, tomó nota de los asistentes.
Se trataron temas como el presupuesto anual, actividades futuras y elección de nuevos representantes.
Hubo debate sobre el uso de fondos para renovaciones. Carlos Gómez propuso destinar 30% a mejoras en infraestructura.
Ana Martínez se opuso, sugiriendo usar esos fondos para programas comunitarios.
Se acordó formar un comité para estudiar ambas propuestas y presentar un informe en la próxima reunión.
La asamblea terminó a las 12:30 PM con 25 miembros presentes.
`);
  console.log(`Archivo de prueba creado: ${transcriptionFile}`);
}

// Ruta para el archivo procesado
const processedFile = path.join(__dirname, 'local_storage', 'test_acta_formatada.txt');

// API Key de Perplexity
const perplexityApiKey = process.env.PERPLEXITY_API_KEY || '';
if (!perplexityApiKey) {
  console.error('Error: No se encontró PERPLEXITY_API_KEY en las variables de entorno');
  process.exit(1);
}

console.log('Procesando transcripción con Perplexity...');

// Llamar al script Python
const scriptPath = path.join(__dirname, 'scripts', 'process_transcript_perplexity.py');
const pythonProcess = spawn('python', [
  scriptPath,
  transcriptionFile,
  '--api_key', perplexityApiKey,
  '--output', processedFile
]);

// Capturar salida
pythonProcess.stdout.on('data', (data) => {
  console.log(`[Python Output]: ${data}`);
});

pythonProcess.stderr.on('data', (data) => {
  console.error(`[Python Error]: ${data}`);
});

// Cuando termine el proceso
pythonProcess.on('close', (code) => {
  console.log(`Proceso finalizado con código: ${code}`);
  
  if (code === 0 && fs.existsSync(processedFile)) {
    console.log(`¡Éxito! Archivo procesado guardado en: ${processedFile}`);
    console.log('Contenido del archivo procesado:');
    console.log('--------------------------------');
    console.log(fs.readFileSync(processedFile, 'utf8'));
  } else {
    console.error('Error: No se pudo generar el archivo procesado');
  }
});