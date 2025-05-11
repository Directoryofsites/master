// async-restore.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parámetros desde la línea de comandos
const backupPath = process.argv[2];
const targetBucket = process.argv[3];

if (!backupPath || !targetBucket) {
  console.error('Uso: node async-restore.js <ruta-backup> <bucket-destino>');
  process.exit(1);
}

console.log(`Iniciando restauración asíncrona...`);
console.log(`Archivo: ${backupPath}`);
console.log(`Bucket: ${targetBucket}`);

// Ruta al script original de restauración
const scriptPath = path.resolve(__dirname, 'restore_script.js');

// Ejecutar el script de restauración
const child = exec(`node "${scriptPath}" "${backupPath}" "${targetBucket}"`, 
  { maxBuffer: 10 * 1024 * 1024 }, // 10MB de buffer para la salida
  (error, stdout, stderr) => {
    if (error) {
      console.error(`Error en la restauración: ${error.message}`);
      console.error(stderr);
    } else {
      console.log(`Restauración completada exitosamente`);
    }
    
    // Limpiar el archivo temporal
    try {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
        console.log(`Archivo temporal eliminado: ${backupPath}`);
      }
    } catch (err) {
      console.error(`Error al eliminar archivo temporal: ${err.message}`);
    }
  }
);

// Separar el proceso hijo
child.unref();
console.log(`Proceso de restauración iniciado en segundo plano (PID: ${child.pid})`);