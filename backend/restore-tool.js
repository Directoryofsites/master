// restore-tool.js - Herramienta independiente para restaurar backups
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const extract = require('extract-zip');
const cors = require('cors');
const app = express();
const PORT = 3500; // Puerto diferente para evitar conflictos

// Configurar almacenamiento para multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Habilitar CORS para permitir conexiones desde el frontend
app.use(cors());

// Endpoint simple para comprobar si el servicio está ejecutándose
app.get('/', (req, res) => {
  res.send('Servicio de restauración activo');
});

// Endpoint para restauración básica
app.post('/restore', upload.single('backupFile'), async (req, res) => {
  console.log('[RESTORE] Iniciando proceso de restauración');
  
  const log = {
    steps: [],
    errors: []
  };
  
  try {
    // Verificar archivo
    if (!req.file) {
      log.errors.push('No se proporcionó archivo');
      return res.status(400).json({ success: false, message: 'No se proporcionó archivo', log });
    }
    
    log.steps.push('Archivo recibido correctamente');
    
    // Verificar bucket
    const targetBucket = req.body.targetBucket || req.body.bucketName;
    if (!targetBucket) {
      log.errors.push('No se especificó bucket destino');
      return res.status(400).json({ success: false, message: 'No se especificó bucket destino', log });
    }
    
    log.steps.push(`Bucket destino: ${targetBucket}`);
    
    // Crear directorio temporal
    const tempDir = path.join(__dirname, 'temp_restore_' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    log.steps.push(`Directorio temporal creado: ${tempDir}`);
    
    // Guardar archivo
    const zipPath = path.join(tempDir, 'backup.zip');
    fs.writeFileSync(zipPath, req.file.buffer);
    log.steps.push(`Archivo guardado: ${zipPath} (${req.file.buffer.length} bytes)`);
    
    // Extraer ZIP
    await extract(zipPath, { dir: tempDir });
    log.steps.push('Archivo ZIP extraído correctamente');
    
    // Listar archivos extraídos
    const files = fs.readdirSync(tempDir);
    log.steps.push(`Archivos extraídos: ${files.join(', ')}`);
    
    // Crear directorio destino si no existe
    const destDir = path.join(__dirname, '..', 'backend', 'buckets', targetBucket);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    log.steps.push(`Directorio destino preparado: ${destDir}`);
    
    // Copiar archivos (excepto los archivos de sistema)
    function copyRecursively(src, dest) {
      let copied = 0;
      
      if (fs.statSync(src).isDirectory()) {
        // Crear directorio si no existe
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        
        // Copiar contenido del directorio
        const entries = fs.readdirSync(src);
        for (const entry of entries) {
          // Omitir archivos especiales
          if (entry === 'backup.zip' || entry === 'database-export.json' || 
              entry.endsWith('.json')) {
            continue;
          }
          
          const srcPath = path.join(src, entry);
          const destPath = path.join(dest, entry);
          
          if (fs.statSync(srcPath).isDirectory()) {
            copied += copyRecursively(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
            copied++;
          }
        }
      } else {
        // Copiar archivo directamente
        fs.copyFileSync(src, dest);
        copied = 1;
      }
      
      return copied;
    }
    
    // Buscar directorio potencial de archivos
    let sourceDir = tempDir;
    const potentialDirs = ['files', 'documentos', 'archivos', 'documents', 'backup'];
    for (const potential of potentialDirs) {
      const checkDir = path.join(tempDir, potential);
      if (fs.existsSync(checkDir) && fs.statSync(checkDir).isDirectory()) {
        sourceDir = checkDir;
        log.steps.push(`Usando directorio específico: ${potential}`);
        break;
      }
    }
    
    // Realizar la copia
    const filesCopied = copyRecursively(sourceDir, destDir);
    log.steps.push(`Copia completada: ${filesCopied} archivos copiados`);
    
    // Limpiar directorio temporal
    fs.rmSync(tempDir, { recursive: true, force: true });
    log.steps.push('Limpieza temporal completada');
    
    // Retornar éxito
    return res.json({
      success: true,
      message: `Restauración completada exitosamente. ${filesCopied} archivos restaurados.`,
      filesCopied,
      log
    });
    
  } catch (error) {
    log.errors.push(error.message);
    console.error('[RESTORE] Error:', error);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message}`,
      log
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servicio de restauración ejecutándose en puerto ${PORT}`);
});