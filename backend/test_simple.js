// test_simple.js
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

// API Key de Perplexity
const perplexityApiKey = process.env.PERPLEXITY_API_KEY || '';
if (!perplexityApiKey) {
  console.error('Error: No se encontró PERPLEXITY_API_KEY en las variables de entorno');
  process.exit(1);
}

console.log('Probando conexión con Perplexity API...');

// Llamar al script Python simplificado
const scriptPath = path.join(__dirname, 'scripts', 'test_perplexity_simple.py');
const pythonProcess = spawn('python', [
  scriptPath,
  perplexityApiKey
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
  
  if (code === 0) {
    console.log('¡Éxito! La prueba de conexión con Perplexity API funcionó correctamente.');
  } else {
    console.error('Error: Falló la prueba de conexión con Perplexity API.');
  }
});