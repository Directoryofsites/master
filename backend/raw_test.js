// raw_test.js
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

// API Key de Perplexity
const perplexityApiKey = process.env.PERPLEXITY_API_KEY || '';
if (!perplexityApiKey) {
  console.error('Error: No se encontró PERPLEXITY_API_KEY en las variables de entorno');
  process.exit(1);
}

console.log('Ejecutando prueba detallada con la API de Perplexity...');

// Llamar al script Python
const scriptPath = path.join(__dirname, 'scripts', 'perplexity_raw_test.py');
const pythonProcess = spawn('python', [
  scriptPath,
  perplexityApiKey
]);

// Capturar salida
pythonProcess.stdout.on('data', (data) => {
  console.log(`${data}`);
});

pythonProcess.stderr.on('data', (data) => {
  console.error(`[Python Error]: ${data}`);
});

// Cuando termine el proceso
pythonProcess.on('close', (code) => {
  console.log(`Proceso finalizado con código: ${code}`);
});