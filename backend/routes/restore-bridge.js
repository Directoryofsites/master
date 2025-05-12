const express = require('express');
const router = express.Router();
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configurar multer para manejar la carga de archivos

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Determinar directorio temporal adecuado para el entorno
    const os = require('os');
    let tempDir;
    
    // En Railway, usar /tmp que siempre está disponible
    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_PROJECT_ID) {
      tempDir = '/tmp/docubox-restore';
      console.log(`[RESTORE] Usando directorio temporal de Railway: ${tempDir}`);
    } else {
      // En desarrollo local, usar un directorio local
      tempDir = path.join(__dirname, '..', 'temp_uploads');
      console.log(`[RESTORE] Usando directorio temporal local: ${tempDir}`);
    }
    
    // Crear el directorio si no existe
    if (!fs.existsSync(tempDir)) {
      try {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log(`[RESTORE] Directorio temporal creado: ${tempDir}`);
      } catch (err) {
        console.error(`[RESTORE] Error al crear directorio temporal ${tempDir}:`, err);
        // Intentar usar /tmp como fallback en caso de error
        if (tempDir !== '/tmp' && process.env.NODE_ENV === 'production') {
          tempDir = '/tmp';
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
        }
      }
    }
    
    cb(null, tempDir);
  },
  
  filename: function(req, file, cb) {
    // Generar un nombre de archivo único
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // Limitar a 500MB
});

// Ruta para ejecutar la restauración a través del script independiente
router.post('/bridge-restore', upload.single('backupFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'No se recibió ningún archivo' 
      });
    }
    
    const targetBucket = req.body.targetBucket;
    
    if (!targetBucket) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Se requiere el parámetro targetBucket' 
      });
    }
    
    // Verificar que el archivo de backup existe
    const backupPath = req.file.path;
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ 
        status: 'error', 
        message: `El archivo de backup no existe: ${req.file.originalname}` 
      });
    }
    
    console.log(`Iniciando restauración mediante script independiente...`);
    console.log(`Archivo: ${backupPath}`);
    console.log(`Bucket destino: ${targetBucket}`);
    
    // Enviar respuesta inmediata
    res.status(202).json({
      status: 'accepted',
      message: 'Restauración iniciada. Este proceso puede tardar varios minutos.'
    });
    
    // Ruta al script de restauración
    const scriptPath = path.resolve(__dirname, '..', 'scripts', 'restore_script.js');
    
    // Ejecutar el script como proceso hijo de manera desvinculada
console.log('Iniciando proceso de restauración en segundo plano...');
const child = exec(`node "${scriptPath}" "${backupPath}" "${targetBucket}"`, 
  { detached: true }, 
  (error, stdout, stderr) => {
    // Limpiar el archivo temporal después de la ejecución
    try {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
        console.log(`Archivo temporal eliminado: ${backupPath}`);
      }
    } catch (cleanupError) {
      console.error(`Error al eliminar archivo temporal: ${cleanupError.message}`);
    }
    
    if (error) {
      console.error(`Error en la ejecución del script: ${error.message}`);
      console.error(`STDERR: ${stderr}`);
    } else {
      console.log(`Restauración completada con éxito en segundo plano`);
      console.log(`STDOUT: ${stdout}`);
    }
  }
);

// Desvincular el proceso hijo para que continúe ejecutándose independientemente
child.unref();
    
    // No continuamos con el resto del código
    return;
    
  } catch (err) {
    console.error(`Error general en el endpoint de restauración: ${err.message}`);
    res.status(500).json({ 
      status: 'error', 
      message: 'Error general en el procesamiento', 
      error: err.message 
    });
  }
});

module.exports = router;