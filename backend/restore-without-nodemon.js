// restore-without-nodemon.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Argumentos del script
const backupPath = process.argv[2];
const targetBucket = process.argv[3];

if (!backupPath || !targetBucket) {
  console.error('Uso: node restore-without-nodemon.js <ruta-backup.zip> <bucket-destino>');
  process.exit(1);
}

console.log(`Iniciando restauración sin interrupciones de nodemon...`);
console.log(`Archivo: ${backupPath}`);
console.log(`Bucket: ${targetBucket}`);

// Ruta al script original de restauración
const restoreScriptPath = path.join(__dirname, 'restore_script.js');

// Comando para ejecutar el script sin nodemon
const command = `node "${restoreScriptPath}" "${backupPath}" "${targetBucket}"`;

// Ejecutar el comando
exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error al ejecutar restauración: ${error.message}`);
    console.error(stderr);
    process.exit(1);
  }
  
  console.log('RESULTADO DE LA RESTAURACIÓN:');
  console.log(stdout);
  
  // Verificar si la restauración fue exitosa
  const successLines = stdout.split('\n').filter(line => 
    line.includes('Restauración completada correctamente') || 
    line.includes('restaurados con éxito')
  );
  
  if (successLines.length > 0) {
    console.log('✅ RESTAURACIÓN COMPLETADA EXITOSAMENTE');
  } else {
    console.log('❌ LA RESTAURACIÓN PUDO TENER PROBLEMAS');
  }
});