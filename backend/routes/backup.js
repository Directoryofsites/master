const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const multer = require('multer');
const router = express.Router();
const crypto = require('crypto'); // Para generar IDs únicos

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

// Almacén en memoria para los backups en progreso
// Esto permite seguir el estado de los backups y evitar accesos no autorizados
const pendingBackups = new Map();

// Ruta de prueba para verificar que el router funciona
router.get('/test', (req, res) => {
  console.log('[BACKUP] Ruta de prueba de backup accedida');
  res.json({
    success: true,
    message: 'API de backup funcionando correctamente',
    serverTime: new Date().toISOString()
  });
});

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

// Ruta para listar backups disponibles (solo muestra backups en proceso)
router.get('/list', (req, res) => {
  try {
    // Verificar token de autorización (opcional, dependiendo de tu configuración)
    const authHeader = req.headers.authorization;
    const { bucketName } = req.query;
    
    if (!authHeader && !req.query.token) {
      console.log('[BACKUP] Intento de listar backups sin autenticación');
      // Si quieres implementar autenticación estricta, descomenta estas líneas
      // return res.status(401).json({ 
      //   success: false, 
      //   message: 'No autorizado', 
      //   backups: [] 
      // });
    }    
    // Verificar que se proporcionó un bucket
    if (!bucketName) {
      console.log('[BACKUP] Intento de listar backups sin especificar bucket');
      return res.json({
        success: false,
        message: 'Se requiere especificar el bucket',
        backups: []
      });
    }
    
    console.log(`[BACKUP] Listando backups temporales para bucket: ${bucketName}`);
    
    // Verificar que el directorio exista
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
      console.log(`[BACKUP] Directorio de backups creado durante listado: ${backupsDir}`);
      
      // Si acabamos de crear el directorio, estará vacío
      return res.json({
        success: true,
        message: 'No hay backups en proceso actualmente.',
        backups: []
      });
    }
    
    // Filtrar backups pendientes por el bucket actual
    const bucketPendingBackups = Array.from(pendingBackups.entries())
      .filter(([_, backup]) => backup.bucketName === bucketName)
      .map(([id, backup]) => {
        return {
          id: id,
          filename: backup.filename,
          status: backup.status,
          progress: backup.progress,
          createdAt: backup.createdAt,
          size: backup.size || 0,
          remainingTime: Math.max(0, Math.floor((5 * 60 * 1000 - (Date.now() - backup.createdAt.getTime())) / 1000))
        };
      })
      .filter(backup => backup.remainingTime > 0);
    
    // Solo listar backups en proceso (menos de 2 minutos de antigüedad)
    let files = [];
    try {
      // Verificar si hay archivos temporales en proceso
      files = fs.readdirSync(backupsDir)
        .filter(file => file.endsWith('.zip') && file.includes(`backup-${bucketName}-`))
        .map(file => {
          try {
            const filePath = path.join(backupsDir, file);
            const stats = fs.statSync(filePath);
            // Solo incluir archivos creados en los últimos 2 minutos (backups en proceso)
            const fileAge = (Date.now() - stats.birthtimeMs) / 1000 / 60; // edad en minutos
            if (fileAge <= 2) {
              return {
                filename: file,
                path: filePath,
                size: stats.size,
                createdAt: stats.birthtime || stats.mtime,
                status: 'en_proceso',
                ageMinutes: fileAge.toFixed(2),
                timeRemaining: Math.max(0, (2 - fileAge) * 60).toFixed(0) + ' segundos'
              };
            }        
            // Si el archivo es más antiguo que 5 minutos, intentar eliminarlo
            // ya que debería haberse descargado y eliminado automáticamente
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[BACKUP] Archivo antiguo eliminado durante listado: ${filePath}`);
              }
            } catch (cleanupErr) {
              console.error(`[BACKUP] Error al limpiar archivo antiguo: ${cleanupErr.message}`);
            }
            
            return null;
          } catch (fileErr) {
            console.error(`[BACKUP] Error al procesar archivo ${file}:`, fileErr);
            return null;
          }
        })
        .filter(file => file !== null) // Eliminar archivos que dieron error o son antiguos
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Ordenar por fecha más reciente

    } catch (readErr) {
      console.error('[BACKUP] Error al leer directorio de backups:', readErr);
      return res.json({
        success: false,
        message: `Error al leer directorio de backups: ${readErr.message}`,
        backups: []
      });
    }
    
    // Combinar backups del sistema de archivos con los pendientes en memoria
    const allBackups = [...bucketPendingBackups, ...files];
    
    console.log(`[BACKUP] Encontrados ${allBackups.length} backups en proceso`);
    
    res.json({
      success: true,
      message: allBackups.length > 0 ? 'Backups en proceso obtenidos correctamente' : 'No hay backups en proceso actualmente',
      backups: allBackups
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

// NUEVA RUTA: Iniciar el proceso de backup sin descarga inmediata
router.get('/initiate/:bucketName', async (req, res) => {
  try {
    const { bucketName } = req.params;
    const { token } = req.query;
    
    if (!bucketName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nombre del bucket no proporcionado' 
      });
    }
    
    if (!token) {
      console.log('[BACKUP] Intento de iniciar backup sin token');
      return res.status(401).json({ 
        success: false, 
        message: 'No autorizado: Token requerido' 
      });
    }
    
    console.log(`[BACKUP] Iniciando backup para bucket: ${bucketName}`);
    
    // Crear un ID único para este backup
    const backupId = crypto.randomUUID();
    
    // Crear nombre de archivo para el backup
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupFileName = `backup-${bucketName}-${timestamp}.zip`;
    const backupPath = path.join(backupsDir, backupFileName);
    
    // Registrar este backup en el mapa de pendientes
    pendingBackups.set(backupId, {
      id: backupId,
      bucketName: bucketName,
      filename: backupFileName,
      path: backupPath,
      status: 'iniciando',
      progress: 0,
      createdAt: new Date(),
      token: token // Almacenar el token para verificación posterior
    });
    
    // Verificar script de backup (buscar en múltiples ubicaciones)
    let scriptPath = path.join(__dirname, '..', 'scripts', 'backup_script.js');
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.join(__dirname, '..', 'backup_script.js');
    }
    console.log(`[BACKUP] Verificando script: ${scriptPath} - Existe: ${fs.existsSync(scriptPath)}`);

    if (!fs.existsSync(scriptPath)) {
      // Eliminar el backup del mapa de pendientes si falla
      pendingBackups.delete(backupId);
      
      return res.status(500).json({
        success: false,
        message: 'Script de backup no encontrado',
        details: `El archivo ${scriptPath} no existe`
      });
    }
    
    // Enviar respuesta inmediata con el ID del backup
    res.json({
      success: true,
      message: 'Proceso de backup iniciado correctamente',
      backupId: backupId,
      status: 'iniciando',
      expiresIn: '5 minutos'
    });
    
    // Ejecutar el script de backup como un proceso separado (asíncrono, después de enviar la respuesta)
    console.log(`[BACKUP] Ejecutando script: node "${scriptPath}" ${bucketName} "${backupPath}"`);
    
    const backupProcess = spawn('node', [
      scriptPath,
      bucketName,
      backupPath
    ]);
    
    let output = '';
    let errorOutput = '';
    
    backupProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      console.log(`[BACKUP STDOUT] ${dataStr}`);
      output += dataStr;
      
      // Actualizar el estado del backup en el mapa de pendientes
      const pendingBackup = pendingBackups.get(backupId);
      if (pendingBackup) {
        pendingBackup.status = 'en_proceso';
        pendingBackup.progress = 50; // Valor aproximado
        pendingBackups.set(backupId, pendingBackup);
      }
    });
    
    backupProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      console.error(`[BACKUP STDERR] ${dataStr}`);
      errorOutput += dataStr;
      
      // Actualizar el estado del backup en el mapa de pendientes
      const pendingBackup = pendingBackups.get(backupId);
      if (pendingBackup) {
        pendingBackup.lastError = dataStr;
        pendingBackups.set(backupId, pendingBackup);
      }
    });
    
    // Manejar la finalización del proceso
    backupProcess.on('close', (code) => {
      console.log(`[BACKUP] Proceso terminado con código: ${code}`);
      
      // Actualizar el estado del backup en el mapa de pendientes
      if (code !== 0) {
        const pendingBackup = pendingBackups.get(backupId);
        if (pendingBackup) {
          pendingBackup.status = 'error';
          pendingBackup.error = `El proceso de backup terminó con código ${code}`;
          pendingBackups.set(backupId, pendingBackup);
        }
        
        console.error(`[BACKUP] Error en el proceso de backup: ${code}`);
        console.error(`[BACKUP] Output: ${output}`);
        console.error(`[BACKUP] Error Output: ${errorOutput}`);
        return;
      }
      
      // Verificar que el archivo existe
      if (!fs.existsSync(backupPath)) {
        const pendingBackup = pendingBackups.get(backupId);
        if (pendingBackup) {
          pendingBackup.status = 'error';
          pendingBackup.error = 'El archivo de backup no se generó correctamente';
          pendingBackups.set(backupId, pendingBackup);
        }
        
        console.error('[BACKUP] Error: El archivo de backup no se generó correctamente');
        return;
      }
      
      // Obtener información del archivo
      try {
        const stats = fs.statSync(backupPath);
        const pendingBackup = pendingBackups.get(backupId);
        if (pendingBackup) {
          pendingBackup.status = 'completado';
          pendingBackup.progress = 100;
          pendingBackup.size = stats.size;
          pendingBackup.completedAt = new Date();
          pendingBackups.set(backupId, pendingBackup);
        }
        console.log(`[BACKUP] Backup completado con éxito: ${backupPath} (${stats.size} bytes)`);
      } catch (statErr) {
        console.error(`[BACKUP] Error al obtener información del archivo: ${statErr.message}`);
      }
    });
    
    // Manejar errores del proceso
    backupProcess.on('error', (err) => {
      console.error(`[BACKUP] Error al iniciar proceso: ${err.message}`);
      
      // Actualizar el estado del backup en el mapa de pendientes
      const pendingBackup = pendingBackups.get(backupId);
      if (pendingBackup) {
        pendingBackup.status = 'error';
        pendingBackup.error = `Error al iniciar proceso de backup: ${err.message}`;
        pendingBackups.set(backupId, pendingBackup);
      }
    });
    
    // Configurar eliminación automática del backup después de 5 minutos
    setTimeout(() => {
      const pendingBackup = pendingBackups.get(backupId);
      
      // Si el backup todavía está en el mapa y no se ha descargado
      if (pendingBackup && pendingBackup.status !== 'descargado') {
        console.log(`[BACKUP] Limpiando backup no descargado: ${backupId}`);
        
        // Eliminar el archivo si existe
        try {
          if (fs.existsSync(pendingBackup.path)) {
            fs.unlinkSync(pendingBackup.path);
            console.log(`[BACKUP] Archivo eliminado por timeout: ${pendingBackup.path}`);
          }
        } catch (cleanupErr) {
          console.error(`[BACKUP] Error al eliminar archivo por timeout: ${cleanupErr.message}`);
        }
        
        // Eliminar el backup del mapa de pendientes
        pendingBackups.delete(backupId);
      }
    }, 5 * 60 * 1000); // 5 minutos
    
  } catch (error) {
    console.error('[BACKUP] Error general:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// NUEVA RUTA: Verificar estado de un backup
router.get('/status/:backupId', (req, res) => {
  try {
    const { backupId } = req.params;
    const { token, bucketName } = req.query;
    
    // Verificar token (básico, solo para asegurar que hay algún tipo de autenticación)
    if (!token) {
      console.log('[BACKUP] Intento de verificar estado sin token');
      return res.status(401).json({ success: false, message: 'No autorizado: Token requerido' });
    }
    
    // Verificar que el backup existe en el mapa de pendientes
    if (!pendingBackups.has(backupId)) {
      console.log(`[BACKUP] Backup no encontrado: ${backupId}`);
      return res.status(404).json({ success: false, message: 'Backup no encontrado' });
    }
    
    // Obtener información del backup
    const backup = pendingBackups.get(backupId);
    
    // Verificar que el backup pertenece al bucket del usuario
    if (bucketName && backup.bucketName !== bucketName) {
      console.log(`[BACKUP] Intento de acceso a backup de otro bucket: ${backup.bucketName} por usuario de ${bucketName}`);
      return res.status(403).json({ 
        success: false, 
        message: 'No autorizado: El backup no pertenece a tu bucket' 
      });
    }
    
    // Verificar si el archivo existe
    const fileExists = fs.existsSync(backup.path);
    
    // Calcular tiempo restante antes de la expiración (5 minutos desde la creación)
    const remainingTime = Math.max(0, Math.floor((5 * 60 * 1000 - (Date.now() - backup.createdAt.getTime())) / 1000));
    
    // Enviar información del backup
    res.json({
      success: true,
      message: 'Estado del backup obtenido correctamente',
      backup: {
        id: backup.id,
        filename: backup.filename,
        status: backup.status,
        progress: backup.progress,
        size: backup.size || 0,
        createdAt: backup.createdAt,
        completedAt: backup.completedAt,
        fileExists: fileExists,
        remainingSeconds: remainingTime,
        error: backup.error || null
      }
    });
  } catch (error) {
    console.error('[BACKUP] Error al verificar estado del backup:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// NUEVA RUTA: Descargar un backup por ID (modificación de la ruta original de descarga)
router.get('/download-by-id/:backupId', (req, res) => {
  try {
    const { backupId } = req.params;
    const { token, bucketName } = req.query;
    
    // Verificar token (básico, solo para asegurar que hay algún tipo de autenticación)
    if (!token) {
      console.log('[BACKUP] Intento de descarga sin token');
      return res.status(401).json({ success: false, message: 'No autorizado: Token requerido' });
    }
    
    // Verificar que el backup existe en el mapa de pendientes
    if (!pendingBackups.has(backupId)) {
      console.log(`[BACKUP] Backup no encontrado para descarga: ${backupId}`);
      return res.status(404).json({ success: false, message: 'Backup no encontrado' });
    }
    
    // Obtener información del backup
    const backup = pendingBackups.get(backupId);
    
    // Verificar que el backup pertenece al bucket del usuario
    if (bucketName && backup.bucketName !== bucketName) {
      console.log(`[BACKUP] Intento de acceso a backup de otro bucket: ${backup.bucketName} por usuario de ${bucketName}`);
      return res.status(403).json({ 
        success: false, 
        message: 'No autorizado: El backup no pertenece a tu bucket' 
      });
    }
    
    // Verificar que el backup está completado
    if (backup.status !== 'completado' && backup.status !== 'en_proceso') {
      console.log(`[BACKUP] Intento de descarga de backup no completado: ${backupId} (estado: ${backup.status})`);
      return res.status(400).json({ 
        success: false, 
        message: `El backup no está listo para descarga. Estado actual: ${backup.status}` 
      });
    }
    
    // Verificar que el archivo existe
    if (!fs.existsSync(backup.path)) {
      console.log(`[BACKUP] Archivo no encontrado: ${backup.path}`);
      return res.status(404).json({ success: false, message: 'Archivo de backup no encontrado' });
    }
    
    console.log(`[BACKUP] Enviando archivo para descarga: ${backup.path} (${backup.size || 'desconocido'} bytes)`);
    
    // Configurar cabeceras para forzar descarga
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    
    // Si conocemos el tamaño del archivo, establecer el encabezado Content-Length
    if (backup.size) {
      res.setHeader('Content-Length', backup.size);
    }
    
    res.setHeader('X-Accel-Buffering', 'no'); // Evitar buffering en Nginx
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Marcar el backup como descargado
    backup.status = 'descargado';
    pendingBackups.set(backupId, backup);
    
    // Configurar limpieza al terminar la descarga
    res.on('finish', () => {
      console.log(`[BACKUP] Descarga completada, eliminando archivo: ${backup.path}`);
      try {
        if (fs.existsSync(backup.path)) {
          fs.unlinkSync(backup.path);
          console.log(`[BACKUP] Archivo eliminado: ${backup.path}`);
        }
      } catch (cleanupErr) {
        console.error(`[BACKUP] Error al eliminar archivo: ${cleanupErr.message}`);
      }
      
      // Eliminar el backup del mapa de pendientes
      pendingBackups.delete(backupId);
    });
    
    // También limpiar si la conexión se cierra
    res.on('close', () => {
      console.log(`[BACKUP] Conexión cerrada, eliminando archivo: ${backup.path}`);
      try {
        if (fs.existsSync(backup.path)) {
          fs.unlinkSync(backup.path);
          console.log(`[BACKUP] Archivo eliminado después de cierre: ${backup.path}`);
        }
      } catch (cleanupErr) {
        console.error(`[BACKUP] Error al eliminar archivo: ${cleanupErr.message}`);
      }
      
      // Eliminar el backup del mapa de pendientes
      pendingBackups.delete(backupId);
    });
    
    // Enviar el archivo
    const fileStream = fs.createReadStream(backup.path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('[BACKUP] Error general durante la descarga:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mantener la ruta original de descarga por nombre de archivo para compatibilidad
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  const { token, bucketName } = req.query;
  const filePath = path.join(backupsDir, filename);
  
  console.log(`[BACKUP] Solicitud de descarga para archivo: ${filename}`);
  console.log(`[BACKUP] Bucket solicitante: ${bucketName || 'No especificado'}`);
  
  // Verificar token (básico, solo para asegurar que hay algún tipo de autenticación)
  if (!token) {
    console.log('[BACKUP] Intento de descarga sin token');
    return res.status(401).json({ success: false, message: 'No autorizado: Token requerido' });
  }
  
  // Verificar que el archivo existe
  if (!fs.existsSync(filePath)) {
    console.log(`[BACKUP] Archivo no encontrado: ${filePath}`);
    return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
  }
  
  // Verificar que el archivo solicitado corresponde al bucket del usuario
  if (bucketName && !filename.includes(`backup-${bucketName}-`)) {
    console.log(`[BACKUP] Intento de acceso a backup de otro bucket: ${filename} por usuario de ${bucketName}`);
    return res.status(403).json({ 
      success: false, 
      message: 'No autorizado: El archivo no pertenece a tu bucket' 
    });
  }
  
  // Configurar cabeceras para forzar descarga
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', fs.statSync(filePath).size);
  res.setHeader('X-Accel-Buffering', 'no'); // Evitar buffering en Nginx
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Configurar limpieza al terminar la descarga
  res.on('finish', () => {
    console.log(`[BACKUP] Descarga completada, eliminando archivo: ${filePath}`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[BACKUP] Archivo eliminado: ${filePath}`);
      }
    } catch (cleanupErr) {
      console.error(`[BACKUP] Error al eliminar archivo: ${cleanupErr.message}`);
    }
  });
  
  // También limpiar si la conexión se cierra
  res.on('close', () => {
    console.log(`[BACKUP] Conexión cerrada, eliminando archivo: ${filePath}`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[BACKUP] Archivo eliminado después de cierre: ${filePath}`);
      }
    } catch (cleanupErr) {
      console.error(`[BACKUP] Error al eliminar archivo: ${cleanupErr.message}`);
    }
  });
  
  // Enviar el archivo
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
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
          // Eliminar archivos que tienen más de 10 minutos de antigüedad
          const fileAgeMinutes = (Date.now() - stats.birthtimeMs) / 1000 / 60;
          
          if (fileAgeMinutes > 10) {
            console.log(`[BACKUP] Eliminando archivo antiguo (${fileAgeMinutes.toFixed(2)} minutos): ${file}`);
            fs.unlinkSync(filePath);
            removedCount++;
          }
        } catch (err) {
          console.error(`[BACKUP] Error al procesar archivo ${file}:`, err);
        }
      }
    }
    
    console.log(`[BACKUP] Limpieza completada, ${removedCount} archivos eliminados`);
    
    // También limpiar backups pendientes antiguos
    const now = Date.now();
    let pendingRemoved = 0;
    
    for (const [id, backup] of pendingBackups.entries()) {
      const backupAgeMinutes = (now - backup.createdAt.getTime()) / 1000 / 60;
      
      if (backupAgeMinutes > 10) {
        console.log(`[BACKUP] Eliminando backup pendiente antiguo (${backupAgeMinutes.toFixed(2)} minutos): ${id}`);
        
        // Eliminar el archivo si existe
        try {
          if (fs.existsSync(backup.path)) {
            fs.unlinkSync(backup.path);
            console.log(`[BACKUP] Archivo de backup pendiente eliminado: ${backup.path}`);
          }
        } catch (err) {
          console.error(`[BACKUP] Error al eliminar archivo de backup pendiente: ${err.message}`);
        }
        
        // Eliminar del mapa
        pendingBackups.delete(id);
        pendingRemoved++;
      }
    }
    
    if (pendingRemoved > 0) {
      console.log(`[BACKUP] Limpieza de backups pendientes completada, ${pendingRemoved} backups eliminados`);
    }
  } catch (error) {
    console.error('[BACKUP] Error durante limpieza periódica:', error);
  }
};

// Programar limpieza periódica cada 30 minutos
const cleanupInterval = 30 * 60 * 1000; // 30 minutos en milisegundos
setInterval(cleanupBackupFiles, cleanupInterval);

// Ejecutar una limpieza inicial al iniciar el servidor
setTimeout(cleanupBackupFiles, 5000);

module.exports = router;
