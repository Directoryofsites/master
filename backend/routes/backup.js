const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const multer = require('multer');
const router = express.Router();

// Determinar directorio temporal adecuado para el entorno
const os = require('os');
let tempUploadsDir;

// En Railway, usar /tmp que siempre está disponible
if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_PROJECT_ID) {
  tempUploadsDir = '/tmp/docubox-uploads';
} else {
  // En desarrollo local, usar un directorio local
  tempUploadsDir = path.join(__dirname, '..', 'temp_uploads');
}

// Asegurar que el directorio existe
if (!fs.existsSync(tempUploadsDir)) {
  fs.mkdirSync(tempUploadsDir, { recursive: true });
  console.log(`[BACKUP] Directorio temporal creado: ${tempUploadsDir}`);
}

// Configuración de multer para archivos de backup
const upload = multer({ dest: tempUploadsDir });

// Asegurar que existe el directorio de backups
const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
  console.log(`[BACKUP] Directorio de backups creado: ${backupsDir}`);
}

// Ruta de prueba para verificar que el router funciona
router.get('/test', (req, res) => {
  console.log('[BACKUP] Ruta de prueba de backup accedida');
  res.json({
    success: true,
    message: 'API de backup funcionando correctamente',
    serverTime: new Date().toISOString()
  });
});

// Ruta para crear backup
router.get('/create/:bucketName', async (req, res) => {
  try {
    const { bucketName } = req.params;
    
    if (!bucketName) {
      return res.status(400).json({ success: false, message: 'Nombre del bucket no proporcionado' });
    }
    
    console.log(`[BACKUP] Iniciando backup para bucket: ${bucketName}`);
    
    // Crear nombre de archivo para el backup
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupFileName = `backup-${bucketName}-${timestamp}.zip`;
    const backupPath = path.join(backupsDir, backupFileName);
    
    // Ejecutar el script de backup como un proceso separado
    const backupProcess = spawn('node', [
      path.join(__dirname, '..', 'backup_script.js'),
      bucketName,
      backupPath
    ]);
    
    let output = '';
    
    backupProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      console.log(`[BACKUP STDOUT] ${dataStr}`);
      output += dataStr;
    });
    
    backupProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      console.error(`[BACKUP STDERR] ${dataStr}`);
      output += dataStr;
    });
    
    backupProcess.on('close', (code) => {
      console.log(`[BACKUP] Proceso terminado con código: ${code}`);
      
      if (code !== 0) {
        return res.status(500).json({
          success: false,
          message: `El proceso de backup terminó con código ${code}`,
          output
        });
      }
      
      // Verificar que el archivo existe
      if (!fs.existsSync(backupPath)) {
        return res.status(500).json({
          success: false,
          message: 'El archivo de backup no se generó correctamente'
        });
      }
      
      res.json({
        success: true,
        message: 'Backup completado correctamente',
        filename: backupFileName,
        path: backupPath,
        output
      });
    });
  } catch (error) {
    console.error('[BACKUP] Error al iniciar el proceso de backup:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para descargar un backup
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(backupsDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
  }
  
  res.download(filePath, filename, (err) => {
    if (err) {
      console.error(`[BACKUP] Error al descargar archivo ${filename}:`, err);
      // Si ya se envió la cabecera, no podemos enviar otro error
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  });
});

// Ruta para restaurar desde un backup
router.post('/restore', upload.single('backupFile'), async (req, res) => {
  console.log('[RESTORE] Iniciando proceso de restauración');
  console.log('[RESTORE] Headers:', req.headers);
  console.log('[RESTORE] Archivo recibido:', req.file ? {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path
  } : 'No hay archivo');
  console.log('[RESTORE] Datos del cuerpo:', req.body);
  
  try {
    if (!req.file) {
      console.log('[RESTORE] Error: No se proporcionó archivo de backup');
      return res.status(400).json({ success: false, message: 'No se proporcionó archivo de backup' });
    }
    
    const { targetBucket } = req.body;
    
    if (!targetBucket) {
      console.log('[RESTORE] Error: Nombre de bucket destino no proporcionado');
      return res.status(400).json({ success: false, message: 'Nombre de bucket destino no proporcionado' });
    }
    
    console.log(`[RESTORE] Procesando restauración para bucket: ${targetBucket}`);
    
    // Ruta al archivo subido
    const uploadedFilePath = req.file.path;
    console.log(`[RESTORE] Ruta del archivo subido: ${uploadedFilePath}`);
    
    // Ejecutar el script de restauración
    const scriptPath = fs.existsSync(path.join(__dirname, '..', 'restore_script_simple.js')) 
      ? path.join(__dirname, '..', 'restore_script_simple.js')
      : path.join(__dirname, '..', 'restore_script.js');
    
    console.log(`[RESTORE] Ejecutando script de restauración: ${scriptPath}`);
    
    const restoreProcess = spawn('node', [
      scriptPath,
      uploadedFilePath,
      targetBucket
    ]);
    
    let output = '';
    
    restoreProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      console.log(`[RESTORE STDOUT] ${dataStr}`);
      output += dataStr;
    });
    
    restoreProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      console.error(`[RESTORE STDERR] ${dataStr}`);
      output += dataStr;
    });
    
    restoreProcess.on('close', (code) => {
      console.log(`[RESTORE] Proceso terminado con código: ${code}`);
      
      // Limpiar el archivo subido
      try {
        fs.unlinkSync(uploadedFilePath);
        console.log(`[RESTORE] Archivo temporal eliminado: ${uploadedFilePath}`);
      } catch (cleanupError) {
        console.error(`[RESTORE] Error al limpiar archivo temporal: ${cleanupError.message}`);
      }
      
      if (code !== 0) {
        console.log(`[RESTORE] Error: El proceso de restauración terminó con código ${code}`);
        return res.status(500).json({
          success: false,
          message: `El proceso de restauración terminó con código ${code}`,
          output
        });
      }
      
      console.log('[RESTORE] Restauración completada exitosamente');
      res.json({
        success: true,
        message: 'Restauración completada exitosamente',
        output
      });
    });
  } catch (error) {
    console.error('[RESTORE] Error general:', error);
    
    // Asegurarse de limpiar el archivo si ocurre un error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log(`[RESTORE] Archivo temporal eliminado durante manejo de error: ${req.file.path}`);
      } catch (cleanupError) {
        console.error(`[RESTORE] Error al limpiar archivo temporal durante error: ${cleanupError.message}`);
      }
    }
    
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;