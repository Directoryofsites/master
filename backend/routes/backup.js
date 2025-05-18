const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const multer = require('multer');
const router = express.Router();

// Middleware para CORS específico para este router
router.use((req, res, next) => {
  // Permitir específicamente GitHub Pages y localhost durante desarrollo
  const allowedOrigins = [
    'https://directoryofsites.github.io',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Manejar las solicitudes OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

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

// Ruta de prueba para verificar que el router funciona
router.get('/test', (req, res) => {
  console.log('[BACKUP] Ruta de prueba de backup accedida');
  res.json({
    success: true,
    message: 'API de backup funcionando correctamente',
    serverTime: new Date().toISOString()
  });
});

// AÑADIR ESTE CÓDIGO AQUÍ

// Ruta para restaurar solo usuarios desde un backup
router.post('/restore-users', upload.single('backupFile'), async (req, res) => {
  console.log('[RESTORE-USERS] Iniciando proceso de restauración de usuarios');
  console.log('[RESTORE-USERS] Headers:', req.headers);
  console.log('[RESTORE-USERS] Archivo recibido:', req.file ? {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path
  } : 'No hay archivo');
  console.log('[RESTORE-USERS] Datos del cuerpo:', req.body);
  
  try {
    if (!req.file) {
      console.log('[RESTORE-USERS] Error: No se proporcionó archivo de backup');
      return res.status(400).json({ success: false, message: 'No se proporcionó archivo de backup' });
    }
    
    const { bucketName, keepOriginalNames } = req.body;
    
    if (!bucketName) {
      console.log('[RESTORE-USERS] Error: Nombre de bucket destino no proporcionado');
      return res.status(400).json({ success: false, message: 'Nombre de bucket destino no proporcionado' });
    }
    
    console.log(`[RESTORE-USERS] Procesando restauración de usuarios para bucket: ${bucketName}`);
    console.log(`[RESTORE-USERS] Mantener nombres originales: ${keepOriginalNames === 'true' ? 'Sí' : 'No'}`);
    
    // Ruta al archivo subido
    const uploadedFilePath = req.file.path;
    console.log(`[RESTORE-USERS] Ruta del archivo subido: ${uploadedFilePath}`);
    
    // Determinar la ruta del script de restauración
    const scriptPath = path.join(__dirname, '..', 'scripts', 'restore_script.js');
    console.log(`[RESTORE-USERS] Ruta al script de restauración: ${scriptPath}`);
    
    // Ejecutar el script de restauración con el parámetro de nombres originales
    const restoreProcess = spawn('node', [
      scriptPath,
      uploadedFilePath,
      bucketName,
      keepOriginalNames === 'true' ? 'true' : 'false'  // Pasar el parámetro
    ]);
    
    let output = '';
    
    restoreProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      console.log(`[RESTORE-USERS STDOUT] ${dataStr}`);
      output += dataStr;
    });
    
    restoreProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      console.error(`[RESTORE-USERS STDERR] ${dataStr}`);
      output += dataStr;
    });
    
    restoreProcess.on('close', (code) => {
      console.log(`[RESTORE-USERS] Proceso terminado con código: ${code}`);
      
      // Limpiar el archivo subido
      try {
        fs.unlinkSync(uploadedFilePath);
        console.log(`[RESTORE-USERS] Archivo temporal eliminado: ${uploadedFilePath}`);
      } catch (cleanupError) {
        console.error(`[RESTORE-USERS] Error al limpiar archivo temporal: ${cleanupError.message}`);
      }
      
      if (code !== 0) {
        console.log(`[RESTORE-USERS] Error: El proceso de restauración de usuarios terminó con código ${code}`);
        return res.status(500).json({
          success: false,
          message: `El proceso de restauración de usuarios terminó con código ${code}`,
          details: { errors: 1, success: 0 },
          output
        });
      }
      
      console.log('[RESTORE-USERS] Restauración de usuarios completada exitosamente');
      res.json({
        success: true,
        message: 'Restauración de usuarios completada exitosamente',
        details: { success: output.includes('usuarios restaurados') ? parseInt(output.match(/(\d+) usuarios restaurados/) || [0, 0])[1] : 0, errors: 0 },
        output
      });
    });
  } catch (error) {
    console.error('[RESTORE-USERS] Error general:', error);
    
    // Asegurarse de limpiar el archivo si ocurre un error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log(`[RESTORE-USERS] Archivo temporal eliminado durante manejo de error: ${req.file.path}`);
      } catch (cleanupError) {
        console.error(`[RESTORE-USERS] Error al limpiar archivo temporal durante error: ${cleanupError.message}`);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message,
      details: { errors: 1, success: 0 }
    });
  }
});

// Ruta para listar backups disponibles
router.get('/list', (req, res) => {
  try {
    // Verificar token de autorización (opcional, dependiendo de tu configuración)
    const authHeader = req.headers.authorization;
    if (!authHeader && !req.query.token) {
      console.log('[BACKUP] Intento de listar backups sin autenticación');
      // Dependiendo de tu configuración, puedes bloquear o permitir
      // return res.status(401).json({ 
      //   success: false, 
      //   message: 'No autorizado', 
      //   backups: [] 
      // });
    }
    
    console.log('[BACKUP] Listando backups disponibles');
    
    // Verificar que el directorio exista
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
      console.log(`[BACKUP] Directorio de backups creado durante listado: ${backupsDir}`);
      
      // Si acabamos de crear el directorio, estará vacío
      return res.json({
        success: true,
        message: 'Directorio de backups creado. No hay backups disponibles.',
        backups: []
      });
    }
    
// Obtener lista de archivos
let files = [];
// Obtener el bucketName del query si existe
const { bucketName } = req.query;

console.log(`[BACKUP] Filtro de bucket recibido: ${bucketName}`);

// Listar todos los archivos en el directorio para depuración
try {
  const allFiles = fs.readdirSync(backupsDir)
    .filter(file => file.endsWith('.zip'));
  console.log(`[BACKUP] Todos los archivos de backup: ${allFiles.join(', ')}`);
} catch (e) {
  console.error(`[BACKUP] Error al listar todos los archivos: ${e.message}`);
}

if (!bucketName) {
  console.log('[BACKUP] Error: No se proporcionó nombre de bucket para listar backups');
  return res.json({
    success: false,
    message: 'Es necesario especificar un bucket para listar los backups',
    backups: []
  });
}

console.log(`[BACKUP] Listando backups para el bucket: ${bucketName}`);

try {
files = fs.readdirSync(backupsDir)
  .filter(file => file.endsWith('.zip') && file.includes(`backup-${bucketName}-`))
  .map(file => {

          try {
            const filePath = path.join(backupsDir, file);
            const stats = fs.statSync(filePath);
            return {
              filename: file,
              path: filePath,
              size: stats.size,
              createdAt: stats.birthtime || stats.mtime
            };
          } catch (fileErr) {
            console.error(`[BACKUP] Error al procesar archivo ${file}:`, fileErr);
            return null;
          }
        })
        .filter(file => file !== null) // Eliminar archivos que dieron error
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Ordenar por fecha más reciente
    } catch (readErr) {
      console.error('[BACKUP] Error al leer directorio de backups:', readErr);
      return res.json({
        success: false,
        message: `Error al leer directorio de backups: ${readErr.message}`,
        backups: []
      });
    }
    
    console.log(`[BACKUP] Encontrados ${files.length} archivos de backup`);
    console.log('[BACKUP] Lista de backups:', files.map(f => f.filename).join(', '));
    
    res.json({
      success: true,
      message: files.length > 0 ? 'Backups obtenidos correctamente' : 'No hay backups disponibles',
      backups: files
    });
  } catch (error) {
    console.error('[BACKUP] Error al listar backups:', error);
    res.status(500).json({ 
      success: false, 
      message: `Error al listar backups: ${error.message}`,
      backups: [] 
    });
  }
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
const scriptPath = path.join(__dirname, '..', 'backup_script.js');
console.log(`[BACKUP] Ruta al script de backup: ${scriptPath}`);
console.log(`[BACKUP] Verificando existencia del script: ${fs.existsSync(scriptPath) ? 'EXISTE' : 'NO EXISTE'}`);

const backupProcess = spawn('node', [
  scriptPath,
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
        message: 'Backup completado correctamente. El archivo será eliminado automáticamente en 5 segundos.',
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
  const { token, bucketName } = req.query;
  const filePath = path.join(backupsDir, filename);
  
  console.log(`[BACKUP] Solicitud de descarga para: ${filename}`);
  console.log(`[BACKUP] Token recibido: ${token ? 'Sí' : 'No'}`);
  console.log(`[BACKUP] Bucket solicitado: ${bucketName || 'No especificado'}`);
  console.log(`[BACKUP] Comprobando existencia de archivo: ${filePath}`);
  
  // Verificar que el archivo existe
  if (!fs.existsSync(filePath)) {
    console.log(`[BACKUP] Error: Archivo no encontrado: ${filePath}`);
    return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
  } else {
    console.log(`[BACKUP] Archivo encontrado: ${filePath}`);
  }
  
  // Verificar token (básico, solo para asegurar que hay algún tipo de autenticación)
  if (!token) {
    console.log('[BACKUP] Error: Intento de descarga sin token');
    return res.status(401).json({ success: false, message: 'No autorizado: Token requerido' });
  }
  
  res.download(filePath, filename, (err) => {
    if (err) {
      console.error(`[BACKUP] Error al descargar archivo ${filename}:`, err);
      // Si ya se envió la cabecera, no podemos enviar otro error
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      }
    } else {
      // Si no hay error, programar eliminación después de 5 segundos
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[BACKUP] Archivo eliminado después de descarga: ${filePath}`);
          }
        } catch (cleanupErr) {
          console.error(`[BACKUP] Error al eliminar archivo después de descarga: ${cleanupErr.message}`);
        }
      }, 5000); // 5 segundos
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
    
    // Determinar la ruta del script de restauración
const simplePath = path.join(__dirname, '..', 'restore_script_simple.js');
const standardPath = path.join(__dirname, '..', 'restore_script.js');

console.log(`[RESTORE] Verificando scripts de restauración:`);
console.log(`- Script simple (${simplePath}): ${fs.existsSync(simplePath) ? 'EXISTE' : 'NO EXISTE'}`);
console.log(`- Script estándar (${standardPath}): ${fs.existsSync(standardPath) ? 'EXISTE' : 'NO EXISTE'}`);

const scriptPath = fs.existsSync(simplePath) 
  ? simplePath
  : standardPath;

console.log(`[RESTORE] Utilizando script de restauración: ${scriptPath}`);
    
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

// Función de limpieza periódica para eliminar archivos de backup antiguos
const cleanupBackupFiles = () => {
  console.log('[BACKUP] Iniciando limpieza periódica de archivos de backup antiguos');
  try {
    if (!fs.existsSync(backupsDir)) {
      console.log(`[BACKUP] Directorio de backups no existe: ${backupsDir}`);
      return;
    }

    const files = fs.readdirSync(backupsDir);
    let removedCount = 0;

    for (const file of files) {
      if (file.endsWith('.zip') && file.includes('backup-')) {
        const filePath = path.join(backupsDir, file);
        try {
          const stats = fs.statSync(filePath);
          
       // Eliminar archivos que tienen más de 5 minutos de antigüedad
const fileAgeSeconds = (Date.now() - stats.birthtimeMs) / 1000;
if (fileAgeSeconds > 180) { // 3 minutos

            console.log(`[BACKUP] Eliminando archivo antiguo (${fileAgeSeconds.toFixed(2)} segundos): ${file}`);
            fs.unlinkSync(filePath);
            removedCount++;
          }
        } catch (err) {
          console.error(`[BACKUP] Error al procesar archivo ${file}:`, err);
        }
      }
    }

    console.log(`[BACKUP] Limpieza completada, ${removedCount} archivos eliminados`);
  } catch (error) {
    console.error('[BACKUP] Error durante limpieza periódica:', error);
  }
};

// Programar limpieza periódica cada 30 segundos
const cleanupInterval = 30 * 1000; // 30 segundos
setInterval(cleanupBackupFiles, cleanupInterval);

// Ejecutar una limpieza inicial al iniciar el servidor
setTimeout(cleanupBackupFiles, 5000);

module.exports = router;

module.exports = router;