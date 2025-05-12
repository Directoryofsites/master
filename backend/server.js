// Importar módulos requeridos al inicio
require('dotenv').config();
const { spawn } = require('child_process');
const fallbackTranscribe = require('./fallback_transcribe');
const { v4: uuidv4 } = require('uuid');

console.log('Todas las variables de entorno disponibles:');
console.log(Object.keys(process.env));

// Función reutilizable para insertar etiquetas por lotes
async function insertTagsBatch(tags, bucket, logPrefix = '[TAGS]') {
  console.log(`${logPrefix} Insertando ${tags.length} etiquetas para el bucket ${bucket}`);
  
  // Asegurar que todas las etiquetas tengan UUIDs válidos y apunten al bucket correcto
  const preparedTags = tags.map(tag => {
    // Preservar ID si ya es un UUID válido, de lo contrario generar uno nuevo
    const useExistingId = tag.id && isValidUUID(tag.id);
    return {
      ...tag,
      id: useExistingId ? tag.id : uuidv4(),
      bucket: bucket
    };
  });
  
  // Verificar UUIDs
  function isValidUUID(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }
  
  let successCount = 0;
  let errorCount = 0;
  let failedTags = [];
  
  try {
    const batchSize = 20; // Reducir el tamaño del lote para mayor seguridad
    
    for (let i = 0; i < preparedTags.length; i += batchSize) {
      const batch = preparedTags.slice(i, i + batchSize);
      console.log(`${logPrefix} Insertando lote de etiquetas ${i+1}-${Math.min(i+batchSize, preparedTags.length)} de ${preparedTags.length}`);
      
      try {
        const { data, error: insertError } = await supabase
          .from('tags_by_bucket')
          .insert(batch);
        
        if (insertError) {
          console.error(`${logPrefix} Error al insertar lote de etiquetas:`, insertError);
          
          // Si falla el lote completo, intentar insertar de una en una
          console.log(`${logPrefix} Intentando insertar etiquetas individualmente...`);
          
          for (const tag of batch) {
            try {
              const { data: singleData, error: singleError } = await supabase
                .from('tags_by_bucket')
                .insert([tag]);
              
              if (singleError) {
                console.error(`${logPrefix} Error al insertar etiqueta individual "${tag.tag_name}":`, singleError);
                errorCount++;
                failedTags.push({
                  tag: tag.tag_name,
                  category: tag.category,
                  error: singleError.message
                });
              } else {
                successCount++;
              }
            } catch (singleCatchError) {
              console.error(`${logPrefix} Excepción al insertar etiqueta individual:`, singleCatchError);
              errorCount++;
              failedTags.push({
                tag: tag.tag_name,
                category: tag.category,
                error: singleCatchError.message
              });
            }
          }
        } else {
          successCount += batch.length;
          console.log(`${logPrefix} Lote de etiquetas insertado correctamente`);
        }
      } catch (batchError) {
        console.error(`${logPrefix} Excepción al insertar lote:`, batchError);
        
        // Intentar inserción individual en caso de excepción
        for (const tag of batch) {
          try {
            const { data: singleData, error: singleError } = await supabase
              .from('tags_by_bucket')
              .insert([tag]);
            
            if (singleError) {
              errorCount++;
              failedTags.push({
                tag: tag.tag_name,
                category: tag.category,
                error: singleError.message
              });
            } else {
              successCount++;
            }
          } catch (singleCatchError) {
            errorCount++;
            failedTags.push({
              tag: tag.tag_name,
              category: tag.category,
              error: singleCatchError.message
            });
          }
        }
      }
    }
    
    // Registrar detalles de errores si los hay
    if (failedTags.length > 0) {
      console.log(`${logPrefix} Detalle de ${failedTags.length} etiquetas que no se pudieron insertar:`);
      failedTags.slice(0, 10).forEach((failedTag, index) => {
        console.log(`${logPrefix} Fallo #${index + 1}: ${failedTag.tag} (${failedTag.category}) - ${failedTag.error}`);
      });
      if (failedTags.length > 10) {
        console.log(`${logPrefix} ... y ${failedTags.length - 10} más`);
      }
    }
    
    return {
      success: successCount > 0,
      successCount,
      errorCount,
      failedTags,
      totalTags: preparedTags.length
    };
  } catch (error) {
    console.error(`${logPrefix} Error general en inserción de etiquetas:`, error);
    return {
      success: false,
      successCount,
      errorCount: preparedTags.length - successCount,
      error: error.message,
      totalTags: preparedTags.length
    };
  }
}

// Configuración para detectar el entorno
const isProduction = process.env.NODE_ENV === 'production';
const isRailway = !!process.env.RAILWAY_PROJECT_ID;

// Imprimir información sobre el entorno de ejecución
console.log('Entorno de ejecución:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'no definido'}`);
console.log(`- ¿Es producción?: ${isProduction}`);
console.log(`- ¿Es Railway?: ${isRailway}`);
console.log(`- Sistema operativo: ${process.platform}`);
console.log(`- Arquitectura: ${process.arch}`);
console.log(`- Directorio de trabajo: ${process.cwd()}`);

// Configuración específica para Railway (usando spawn ya inicializado)
if (isRailway) {
  console.log('[RAILWAY] Detectado entorno Railway, configurando opciones específicas...');
  
  // Verificar variables de entorno críticas
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('[RAILWAY] ADVERTENCIA: Variables SUPABASE_URL o SUPABASE_KEY no configuradas');
  }
  
  // Verificar Python de forma segura
  console.log('[RAILWAY] Verificando disponibilidad de Python...');
  try {
    const pythonProcess = spawn('python3', ['--version']);
    
    pythonProcess.on('error', (error) => {
      console.error('[RAILWAY] Error al verificar Python3:', error.message);
      console.log('[RAILWAY] Intentando con python alternativo...');
      
      try {
        const pythonAltProcess = spawn('python', ['--version']);
        
        pythonAltProcess.on('error', (err) => {
          console.error('[RAILWAY] Error al verificar Python:', err.message);
          console.error('[RAILWAY] ADVERTENCIA: Python no parece estar disponible en este entorno');
        });
        
        pythonAltProcess.on('close', (code) => {
          if (code === 0) {
            console.log('[RAILWAY] Python está disponible en este entorno');
          }
        });
      } catch (innerError) {
        console.error('[RAILWAY] Error al intentar verificar Python:', innerError.message);
      }
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log('[RAILWAY] Python3 está disponible en este entorno');
      }
    });
  } catch (outerError) {
    console.error('[RAILWAY] Error crítico al verificar Python:', outerError.message);
  }
}

// Imprimir información sobre el entorno de ejecución
console.log('Entorno de ejecución:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'no definido'}`);
console.log(`- ¿Es producción?: ${isProduction}`);
console.log(`- ¿Es Railway?: ${isRailway}`);
console.log(`- Sistema operativo: ${process.platform}`);
console.log(`- Arquitectura: ${process.arch}`);
console.log(`- Directorio de trabajo: ${process.cwd()}`);


// Mejora del código existente, busca esta función y añade estas mejoras

async function checkPythonAvailability() {
  return new Promise((resolve) => {
    console.log('[PYTHON] Verificando disponibilidad de Python...');
    
    // Lista de comandos a probar, en orden de preferencia
    const pythonCommands = ['python3', 'python', 'python3.9', 'python3.8'];
    let currentIndex = 0;
    
    function tryNextCommand() {
      if (currentIndex >= pythonCommands.length) {
        console.error('[PYTHON] No se encontró ninguna versión de Python');
        resolve(null);
        return;
      }
      
      const command = pythonCommands[currentIndex];
      console.log(`[PYTHON] Probando comando: ${command}`);
      
      let pythonProcess;
      
      try {
        pythonProcess = spawn(command, ['--version']);
        
        pythonProcess.on('error', (err) => {
          console.log(`[PYTHON] Error al ejecutar ${command}: ${err.message}`);
          currentIndex++;
          // Asíncrono para evitar desbordamiento de pila
          setTimeout(tryNextCommand, 0);
        });
        
        pythonProcess.stdout.on('data', (data) => {
          console.log(`[PYTHON] Versión detectada: ${data.toString().trim()}`);
        });
        
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`[PYTHON] ${command} está disponible`);
            resolve(command);
          } else {
            console.log(`[PYTHON] ${command} no está disponible, código: ${code}`);
            currentIndex++;
            // Asíncrono para evitar desbordamiento de pila
            setTimeout(tryNextCommand, 0);
          }
        });
      } catch (error) {
        console.error(`[PYTHON] Error crítico al intentar ejecutar ${command}:`, error);
        currentIndex++;
        // Asíncrono para evitar desbordamiento de pila
        setTimeout(tryNextCommand, 0);
      }
    }
    
    tryNextCommand();
  });
}
// Variable global para almacenar el comando de python
let pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

// Verificar Python durante el inicio
checkPythonAvailability().then(command => {
  if (command) {
    pythonCommand = command;
    console.log(`[PYTHON] Se usará el comando: ${pythonCommand}`);
  } else if (isRailway) {
    console.error('[PYTHON] ADVERTENCIA: Python no está disponible en Railway, necesitas agregarlo al container');
  }
});

const bcrypt = require('bcrypt');

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Importar módulo para extraer archivos ZIP
const extract = require('extract-zip');

const os = require('os');

// Asegurarse de que existe el directorio de almacenamiento local
const localStorageDir = path.join(__dirname, 'local_storage');
if (!fs.existsSync(localStorageDir)) {
  fs.mkdirSync(localStorageDir, { recursive: true });
  console.log(`[LOCAL] Directorio de almacenamiento local creado: ${localStorageDir}`);
}

const mammoth = require('mammoth');

const pdfParse = require('pdf-parse');

// Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*', // Permitir todas las solicitudes durante la etapa de depuración
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // Cache preflight por 24 horas
}));

// Middleware adicional para solucionar problemas CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

// Middleware de logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// Rutas para backup y restore
app.use('/api', require('./routes/restore-bridge'));

// Configuración directa de la ruta de backup
app.get('/api/admin/backup', async (req, res) => {
  console.log('[BACKUP] Iniciando proceso de backup en Railway');
  
  try {
    // 1. Verificaciones básicas
    if (!supabase) {
      return res.status(500).json({ 
        success: false, 
        message: 'Supabase no está configurado.' 
      });
    }

    // Verificar token en la URL
    let userRole = req.userRole || 'guest';
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[BACKUP] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.username && userBucketMap[tokenData.username]) {
          // Para usuarios estáticos
          userRole = userRoleMap[tokenData.username] || 'user';
          bucketToUse = userBucketMap[tokenData.username];
          console.log(`[BACKUP] Usuario estático ${tokenData.username} con rol ${userRole} y bucket ${bucketToUse}`);
        } else if (tokenData.role) {
          // Si el token tiene rol explícito, usarlo
          userRole = tokenData.role;
          console.log(`[BACKUP] Usando rol desde token: ${userRole}`);
          
          // Si tiene bucket explícito, usarlo también
          if (tokenData.bucket) {
            bucketToUse = tokenData.bucket;
            console.log(`[BACKUP] Usando bucket desde token: ${bucketToUse}`);
          }
        }
      } catch (tokenError) {
        console.error('[BACKUP] Error al decodificar token de parámetros:', tokenError);
      }
    }

    if (userRole !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Solo administradores pueden generar copias de seguridad.' 
      });
    }

    // 2. Configuración
    const bucketName = bucketToUse;
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `backup_${bucketName}_${dateStr}.zip`;

    // 3. Configuración de headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked'); // Para archivos grandes

    // 4. Configuración del archivador con compresión baja para ahorrar CPU
    const archive = archiver('zip', { 
      zlib: { level: 3 } // Nivel bajo de compresión (1-9)
    });

    // 5. Manejo de errores del archivador
    archive.on('error', (err) => {
      console.error('[BACKUP] Error del archivador:', err);
      if (!res.headersSent) {
        return res.status(500).json({
          success: false, 
          message: 'Error al crear archivo ZIP', 
          error: err.message 
        });
      } else {
        try { res.end(); } catch (e) {}
      }
    });

    // 6. Conectar el archivo a la respuesta HTTP
    archive.pipe(res);

    // 7. Función optimizada para listar archivos (evitando recursión profunda)
    const listFiles = async (prefix = '', depth = 0) => {
      // Limitar profundidad para evitar problemas de stack
      if (depth > 20) {
        console.warn(`[BACKUP] Límite de profundidad alcanzado en ${prefix}`);
        return [];
      }

      try {
        console.log(`[BACKUP] Listando archivos en ${bucketName}/${prefix || 'raíz'}`);
        
        const { data, error } = await supabase.storage
          .from(bucketName)
          .list(prefix, { sortBy: { column: 'name', order: 'asc' } });
        
        if (error) {
          console.error(`[BACKUP] Error al listar ${prefix}:`, error);
          return [];
        }
        
        if (!data || data.length === 0) {
          return [];
        }

        let filesList = [];

        // Procesar archivos primero
        for (const item of data) {
          // Solo ignorar archivos de sistema, INCLUIR todos los metadatos
          if (item.name === '.folder') {
            continue;
          }
                  
          const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
                  
          // Si es archivo, añadir a la lista
          if (item.metadata && item.metadata.mimetype !== 'application/x-directory') {
            filesList.push({
              path: itemPath,
              size: item.metadata.size || 0
            });
          }
        }

        // Procesar carpetas después, pero solo si no tenemos demasiados archivos ya
        if (filesList.length < 500) { // Limitar para evitar problemas de memoria
          for (const item of data) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
                    
            // Si es carpeta, procesar recursivamente
            if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
              const subFiles = await listFiles(itemPath, depth + 1);
              filesList = filesList.concat(subFiles);
            }
          }
        } else {
          console.warn(`[BACKUP] Limitando archivos para evitar problemas de memoria en ${prefix}`);
        }
            
        return filesList;
      } catch (err) {
        console.error(`[BACKUP] Error al listar ${prefix}:`, err);
        return [];
      }
    };

    // 8. Procesar archivos por lotes muy pequeños
    const processFiles = async () => {
      try {
        // Listar todos los archivos
        console.log(`[BACKUP] Recopilando lista de archivos...`);
        const allFiles = await listFiles();
                
        console.log(`[BACKUP] Total archivos a procesar: ${allFiles.length}`);
                
        // Si no hay archivos, añadir README
        if (allFiles.length === 0) {
          archive.append('Este bucket no contiene archivos.', { name: 'README.txt' });
          return;
        }
                
        // Ordenar por tamaño (primero los más pequeños)
        allFiles.sort((a, b) => a.size - b.size);
                
        // Procesar en lotes muy pequeños
        const batchSize = 3; // Muy pocos a la vez
                
        for (let i = 0; i < allFiles.length; i += batchSize) {
          const batch = allFiles.slice(i, i + batchSize);
                  
          // Procesar secuencialmente para reducir uso de memoria
          for (const fileInfo of batch) {
            try {
              const filePath = fileInfo.path;
              console.log(`[BACKUP] Procesando ${filePath} (${fileInfo.size} bytes)`);
                        
              // Descargar con reintentos limitados
              let fileData = null;
                        
              for (let attempt = 0; attempt < 2; attempt++) { // Solo 2 intentos para ahorrar recursos
                try {
                  const { data, error } = await supabase.storage
                    .from(bucketName)
                    .download(filePath);
                          
                  if (error) {
                    console.error(`[BACKUP] Error al descargar ${filePath}:`, error);
                    await new Promise(r => setTimeout(r, 500)); // Espera corta
                  } else {
                    fileData = data;
                    break;
                  }
                } catch (err) {
                  console.error(`[BACKUP] Excepción al descargar ${filePath}:`, err);
                }
              }
                        
              if (!fileData) {
                console.warn(`[BACKUP] No se pudo descargar ${filePath}, continuando...`);
                continue;
              }
                        
              // Añadir al ZIP
              const buffer = await fileData.arrayBuffer();
              archive.append(Buffer.from(buffer), { name: filePath });
                        
              // Liberar memoria explícitamente
              fileData = null;
                        
              // Pequeña pausa para permitir liberar recursos
              await new Promise(r => setTimeout(r, 100));
            } catch (fileErr) {
              console.error(`[BACKUP] Error al procesar archivo:`, fileErr);
              // Continuar con el siguiente archivo
            }
          }
                  
          // Mostrar progreso
          console.log(`[BACKUP] Progreso: ${Math.min(i + batch.length, allFiles.length)}/${allFiles.length}`);
                  
          // Pequeña pausa entre lotes para liberar recursos
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (processErr) {
        console.error('[BACKUP] Error al procesar archivos:', processErr);
        throw processErr;
      }
    };

    // 9. Iniciar procesamiento
    await processFiles();
        
    // 10. Finalizar el archivo ZIP
    console.log('[BACKUP] Finalizando archivo ZIP...');
    await archive.finalize();
        
    console.log(`[BACKUP] Resumen de la operación:`);
    console.log(`[BACKUP] Usuario con rol: ${userRole}`);
    console.log(`[BACKUP] Bucket utilizado: ${bucketName}`);
    console.log(`[BACKUP] Token presente en URL: ${!!req.query.token}`);
    console.log(`[BACKUP] Proceso completado exitosamente`);
  } catch (err) {
    console.error('[BACKUP] Error general:', err);
        
    if (!res.headersSent) {
      return res.status(500).json({ 
        success: false, 
        message: 'Error al generar copia de seguridad', 
        error: err.message 
      });
    } else {
      try { res.end(); } catch (e) {}
    }
  }
});

// Configuración de Supabase (sin valores predeterminados para garantizar separación)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const defaultBucketName = process.env.BUCKET_NAME || 'master';

// Definir mapeo de usuarios a buckets
const userBucketMap = {
  // Bucket master (original)
  'admin': 'master',
  'usuario123': 'master',
  
  // Bucket contenedor001
  'admin1': 'contenedor001',
  'usuario001': 'contenedor001',
  
  // Bucket contenedor002
  'admin2': 'contenedor002',
  'usuario002': 'contenedor002',
  
  // Bucket contenedor003
  'admin3': 'contenedor003',
  'usuario003': 'contenedor003',
  
  // Bucket contenedor004
  'admin4': 'contenedor004',
  'usuario004': 'contenedor004',
  
  // Bucket contenedor005
  'admin5': 'contenedor005',
  'usuario005': 'contenedor005',
  
  // Bucket contenedor006
  'admin6': 'contenedor006',
  'usuario006': 'contenedor006',
  
  // Bucket contenedor007
  'admin7': 'contenedor007',
  'usuario007': 'contenedor007',
  
  // Bucket contenedor008
  'admin8': 'contenedor008',
  'usuario008': 'contenedor008',
  
  // Bucket contenedor009
  'admin9': 'contenedor009',
  'usuario009': 'contenedor009',
  
  // Bucket contenedor010
  'admin10': 'contenedor010',
  'usuario010': 'contenedor010',
  
  // Nuevos buckets
  // Bucket contenedor011
  'admin11': 'contenedor011',
  'usuario011': 'contenedor011',
  
  // Bucket contenedor012
  'admin12': 'contenedor012',
  'usuario012': 'contenedor012',
  
  // Bucket contenedor013
  'admin13': 'contenedor013',
  'usuario013': 'contenedor013',
  
  // Bucket pruebas
  'adminpruebas': 'pruebas',
  'userpruebas': 'pruebas',

  // Bucket personal1
  'adminpersonal1': 'personal1',
  'usuariopersonal1': 'personal1'

};

// Definir roles de usuario (admin o user)
const userRoleMap = {
  // Bucket master
  'admin': 'admin',
  'usuario123': 'user',
  
  // Bucket contenedor001
  'admin1': 'admin',
  'usuario001': 'user',
  
  // Bucket contenedor002
  'admin2': 'admin',
  'usuario002': 'user',
  
  // Bucket contenedor003
  'admin3': 'admin',
  'usuario003': 'user',
  
  // Bucket contenedor004
  'admin4': 'admin',
  'usuario004': 'user',
  
  // Bucket contenedor005
  'admin5': 'admin',
  'usuario005': 'user',
  
  // Bucket contenedor006
  'admin6': 'admin',
  'usuario006': 'user',
  
  // Bucket contenedor007
  'admin7': 'admin',
  'usuario007': 'user',
  
  // Bucket contenedor008
  'admin8': 'admin',
  'usuario008': 'user',
  
  // Bucket contenedor009
  'admin9': 'admin',
  'usuario009': 'user',
  
  // Bucket contenedor010
  'admin10': 'admin',
  'usuario010': 'user',
  
  // Nuevos buckets
  // Bucket contenedor011
  'admin11': 'admin',
  'usuario011': 'user',
  
  // Bucket contenedor012
  'admin12': 'admin',
  'usuario012': 'user',
  
  // Bucket contenedor013
  'admin13': 'admin',
  'usuario013': 'user',
  
  // Bucket pruebas
  'adminpruebas': 'admin',
  'userpruebas': 'user',

  // Bucket personal1
  'adminpersonal1': 'admin',
  'usuariopersonal1': 'user'

};



// Definir tamaños máximos para cada bucket (en MB)
const bucketSizeMap = {
  'master': 200,            // 200 MB para master
  'contenedor001': 500,     // 500 MB para contenedor001
  'contenedor002': 300,     // 300 MB para los demás buckets contenedor
  'contenedor003': 300,
  'contenedor004': 300,
  'contenedor005': 300,
  'contenedor006': 300,
  'contenedor007': 300,
  'contenedor008': 300,
  'contenedor009': 300,
  'contenedor010': 300,
  'contenedor011': 300,
  'contenedor012': 300,
  'contenedor013': 300,
  'pruebas': 100,          // 100 MB para pruebas
  'personal1': 150         // 150 MB para personal1
};

// Tamaño predeterminado para buckets no especificados (en MB)
const defaultBucketMaxSize = 800;


// Funciones para manejo de usuarios dinámicos
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

async function getUserByUsername(username) {
  try {
    const { data, error } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('username', username)
      .eq('active', true)
      .single();
    
    if (error) {
      console.error('Error al buscar usuario:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error en getUserByUsername:', error);
    return null;
  }
}

async function createUser(userData) {
  try {
    const { data, error } = await supabase
      .from('user_accounts')
      .insert([userData])
      .select();
    
    if (error) {
      console.error('Error al crear usuario:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error en createUser:', error);
    return { success: false, error };
  }
}

async function updateUser(userId, userData) {
  try {
    const { data, error } = await supabase
      .from('user_accounts')
      .update(userData)
      .eq('id', userId)
      .select();
    
    if (error) {
      console.error('Error al actualizar usuario:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error en updateUser:', error);
    return { success: false, error };
  }
}

async function getUsersByAdmin(adminUsername) {
  try {
    const { data, error } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('created_by', adminUsername);
    
    if (error) {
      console.error('Error al obtener usuarios del admin:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error en getUsersByAdmin:', error);
    return { success: false, error };
  }
}

async function getUsersByAdminAndBucket(adminUsername, bucketName) {
  try {
    console.log(`[getUsersByAdminAndBucket] Buscando usuarios creados por: ${adminUsername}, bucket: ${bucketName}`);
    
    // Verificar parámetros
    if (!adminUsername) {
      return { success: false, error: 'Se requiere nombre de administrador' };
    }
    
    // Iniciar la consulta básica
    let query = supabase.from('user_accounts').select('*');
    
    // Si hay un bucket específico, filtrar por él
    if (bucketName) {
      console.log(`[getUsersByAdminAndBucket] Filtrando por bucket: ${bucketName}`);
      query = query.eq('bucket', bucketName);
    } else {
      console.log('[getUsersByAdminAndBucket] ADVERTENCIA: No se proporcionó bucket para filtrar');
    }
    
    // Obtener solo usuarios activos
    // Comentamos temporalmente esta línea para ver TODOS los usuarios, incluso inactivos
    // query = query.eq('active', true);
    
    // Ejecutar la consulta
    const { data, error } = await query;
    
    if (error) {
      console.error('[getUsersByAdminAndBucket] Error en consulta:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`[getUsersByAdminAndBucket] Encontrados ${data ? data.length : 0} usuarios`);
    
    // Log detallado para depuración
    if (data && data.length > 0) {
      console.log('[getUsersByAdminAndBucket] Primeros 5 usuarios:');
      data.slice(0, 5).forEach(user => {
        console.log(`- ${user.username} (bucket: ${user.bucket}, active: ${user.active})`);
      });
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('[getUsersByAdminAndBucket] Error general:', error);
    return { success: false, error: error.message };
  }
}

async function deleteUser(userId, permanent = false) {
  try {
    let result;
    
    if (permanent) {
      // Eliminación permanente
      console.log(`[DELETE_USER] Eliminando permanentemente el usuario ${userId}`);
      const { data, error } = await supabase
        .from('user_accounts')
        .delete()
        .eq('id', userId)
        .select();
      
      result = { data, error };
    } else {
      // Desactivación (comportamiento actual)
      console.log(`[DELETE_USER] Desactivando el usuario ${userId}`);
      const { data, error } = await supabase
        .from('user_accounts')
        .update({ active: false })
        .eq('id', userId)
        .select();
      
      result = { data, error };
    }
    
    if (result.error) {
      console.error(`Error al ${permanent ? 'eliminar' : 'desactivar'} usuario:`, result.error);
      return { success: false, error: result.error };
    }
    
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en deleteUser:', error);
    return { success: false, error };
  }
}
// ========================================================
// ENDPOINTS PARA GESTIÓN DE USUARIOS DINÁMICOS
// ========================================================

// Middleware para verificar si el usuario es administrador
const isAdmin = (req, res, next) => {
  if (req.userRole === 'admin') {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'No tienes permisos para realizar esta acción. Se requiere rol de administrador.'
  });
};


// Middleware para verificar permisos administrativos específicos
const hasAdminPermission = (permission) => {
  return (req, res, next) => {
    console.log(`[PERMISSION_CHECK] Verificando permiso '${permission}' para usuario ${req.username}`);
    console.log(`[PERMISSION_CHECK] Rol: ${req.userRole}, Tipo: ${req.userType}`);
    
    // Si es admin estático, tiene todos los permisos
    if (req.userRole === 'admin' && req.userType !== 'dynamic') {
      console.log(`[PERMISSION_CHECK] Es admin estático, permitiendo acceso`);
      return next();
    }
    
    // Si es usuario dinámico, verificar permisos específicos
    if (req.userType === 'dynamic') {
      console.log(`[PERMISSION_CHECK] Es usuario dinámico, verificando permisos específicos`);
      
      // Verificar en userFolders (estructura original)
      if (req.userFolders && req.userFolders.length > 0) {
        console.log(`[PERMISSION_CHECK] Verificando en userFolders (${req.userFolders.length} elementos)`);
        
        // Buscar el objeto de permisos en las carpetas asignadas
        const permissionsObj = req.userFolders.find(folder => 
          typeof folder === 'object' && folder.type === 'admin_permissions'
        );
        
        if (permissionsObj && 
            permissionsObj.permissions && 
            permissionsObj.permissions[permission]) {
          console.log(`[PERMISSION_CHECK] Permiso '${permission}' encontrado en userFolders`);
          return next();
        }
      }
      
      // Verificar en req.assigned_folders (alternativa)
      if (req.assigned_folders && req.assigned_folders.length > 0) {
        console.log(`[PERMISSION_CHECK] Verificando en assigned_folders (${req.assigned_folders.length} elementos)`);
        
        const permissionsObj = req.assigned_folders.find(folder => 
          typeof folder === 'object' && folder.type === 'admin_permissions'
        );
        
        if (permissionsObj && 
            permissionsObj.permissions && 
            permissionsObj.permissions[permission]) {
          console.log(`[PERMISSION_CHECK] Permiso '${permission}' encontrado en assigned_folders`);
          return next();
        }
      }
      
      // Verificar directamente en req.permissions (otra alternativa)
      if (req.permissions && req.permissions[permission]) {
        console.log(`[PERMISSION_CHECK] Permiso '${permission}' encontrado directamente en req.permissions`);
        return next();
      }
    }
    
    // Si no tiene el permiso, denegar acceso
    console.log(`[PERMISSION_CHECK] Permiso '${permission}' NO encontrado, denegando acceso`);
    return res.status(403).json({
      success: false,
      message: `No tienes permisos para realizar esta acción (${permission}). Se requiere permiso específico.`
    });
  };
};

// Verificar que las variables de entorno estén configuradas
if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Variables de entorno faltantes. Asegúrate de configurar SUPABASE_URL y SUPABASE_KEY.');
  process.exit(1); // Terminar la aplicación si faltan las variables
}

// Crear cliente de Supabase con opciones avanzadas
let supabase;

try {
  console.log('Configurando cliente de Supabase');
  console.log('SUPABASE_URL disponible:', !!process.env.SUPABASE_URL);
  console.log('SUPABASE_KEY disponible:', !!process.env.SUPABASE_KEY);
  console.log('SUPABASE_URL:', supabaseUrl);
  
  // Opciones con tiempos de espera más largos
  const options = {
    auth: {
      persistSession: false
    },
    global: {
      headers: {
        'x-application-name': 'explorador-archivos'
      },
      fetch: (url, options) => {
        // Aumentamos el tiempo de espera a 30 segundos
        return fetch(url, {
          ...options,
          timeout: 30000 // 30 segundos en lugar de 10 segundos
        });
      }
    }
  };
  
  supabase = createClient(supabaseUrl, supabaseKey, options);
  console.log('Cliente de Supabase configurado correctamente');
} catch (error) {
  console.error('Error al configurar cliente de Supabase:', error);
}

// Configuración de Multer para manejo de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 336 * 1024 * 1024, // Límite de 336MB
  }
});

// Middleware para determinar el bucket a usar
app.use((req, res, next) => {
  // Obtener el bucket del token de autorización (si existe)
  const authHeader = req.headers.authorization;
  console.log(`[Auth] Headers completos para ${req.path}:`, JSON.stringify(req.headers));
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7); // Eliminar 'Bearer ' del inicio
      console.log(`[Auth] Token completo recibido para ${req.path}:`, token);
      
      const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
      console.log(`[Auth] Token decodificado para ${req.path} (contenido completo):`, JSON.stringify(tokenData));
      console.log(`[Auth] Username en token:`, tokenData.username);
      console.log(`[Auth] Bucket en token:`, tokenData.bucket);
      
      // Determinar si es un usuario estático o dinámico
      const userType = tokenData.type || 'static';
      
      if (userType === 'static') {
        // USUARIO ESTÁTICO (funcionamiento original)
        if (tokenData.username && tokenData.bucket && userBucketMap[tokenData.username]) {
          // Verificar que el bucket en el token coincide con el mapeado para el usuario
          const mappedBucket = userBucketMap[tokenData.username];
          console.log(`[Auth] Bucket mapeado para ${tokenData.username} en userBucketMap:`, mappedBucket);
          
          if (tokenData.bucket !== mappedBucket) {
            console.log(`[Auth] ADVERTENCIA: El bucket en el token (${tokenData.bucket}) no coincide con el mapeado (${mappedBucket})`);
          }
          
          // Usar el bucket mapeado (más seguro) en lugar del que viene en el token
          req.bucketName = mappedBucket;
          req.userRole = userRoleMap[tokenData.username] || 'user';
          req.username = tokenData.username;
          console.log(`[Auth] Usuario ${tokenData.username} mapeado a bucket ${req.bucketName} (rol: ${req.userRole})`);
        } else {
          req.bucketName = defaultBucketName;
          req.userRole = 'guest';
          console.log(`[Auth] Usuario no mapeado o inválido ${tokenData.username || 'desconocido'}, usando bucket predeterminado ${defaultBucketName}`);
          if (tokenData.username) {
            console.log(`[Auth] ¿Existe ${tokenData.username} en userBucketMap?`, !!userBucketMap[tokenData.username]);
          }
        }

      } else {
        // USUARIO DINÁMICO
        if (tokenData.username && tokenData.bucket) {
          // Verificar explícitamente el bucket para usuarios dinámicos
          const bucketToUse = tokenData.bucket;
          
          console.log(`[Auth] Usuario dinámico ${tokenData.username} con bucket ${bucketToUse}`);
          console.log(`[Auth] Carpetas asignadas: ${JSON.stringify(tokenData.folders || [])}`);
          
          // Asignar información del usuario dinámico
          req.bucketName = bucketToUse;
          req.userRole = 'user'; // Los usuarios dinámicos siempre tienen rol 'user' base
          req.username = tokenData.username;
          req.userFolders = tokenData.folders || [];
          req.userType = 'dynamic';
          req.userId = tokenData.userId;
          
          // Extraer permisos administrativos de las carpetas asignadas
          const permissionsObj = req.userFolders.find(folder => 
            typeof folder === 'object' && folder.type === 'admin_permissions'
          );
          
          if (permissionsObj && permissionsObj.permissions) {
            req.adminPermissions = permissionsObj.permissions;
            console.log(`[Auth] Usuario dinámico ${tokenData.username} tiene permisos administrativos:`, permissionsObj.permissions);
          }
          
          // Verificación adicional de las carpetas asignadas
          if (!req.userFolders || req.userFolders.length === 0) {
            console.log(`[Auth] ADVERTENCIA: Usuario dinámico ${tokenData.username} no tiene carpetas asignadas`);
          } else {
            const actualFolders = req.userFolders.filter(folder => typeof folder === 'string');
            console.log(`[Auth] Usuario dinámico ${tokenData.username} tiene ${actualFolders.length} carpetas asignadas en bucket ${req.bucketName}`);
          }
        }
      }

    } catch (error) {
      console.error('Error al decodificar token:', error);
      console.error('Token problemático:', authHeader.substring(7));
      req.bucketName = defaultBucketName;
      req.userRole = 'guest';
      console.log(`[Auth] Error en token, usando bucket predeterminado ${defaultBucketName}`);
    }
  } else {
    // Si no hay token, usar el bucket predeterminado
    req.bucketName = defaultBucketName;
    req.userRole = 'guest';
    console.log(`[Auth] Sin token para ${req.path}, usando bucket predeterminado ${defaultBucketName}`);
  }
  
  // Log detallado de cada solicitud con información del bucket
  console.log(`[Bucket] Request ${req.method} para ${req.path} - Usuario: ${req.username || 'invitado'}, Bucket: ${req.bucketName}, Rol: ${req.userRole}`);
  next();
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send({
    message: 'API del explorador de archivos funcionando correctamente',
    serverTime: new Date().toISOString(),
    supabaseConfigured: !!supabase
  });
});

// Ruta para verificar la conexión con Supabase
app.get('/api/auth-test', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente. Verifica las variables de entorno SUPABASE_URL y SUPABASE_KEY.'
      });
    }
    
    // Listar buckets para verificar conexión
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      success: true,
      message: 'Conexión exitosa con Supabase Storage',
      buckets: data
    });
  } catch (error) {
    console.error('Error en prueba de autenticación:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al conectar con Supabase Storage: ${error.message}`,
      error: error.message
    });
  }
});

// Ruta para buscar archivos y carpetas

app.get('/api/search', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente. Verifica las variables de entorno SUPABASE_URL y SUPABASE_KEY.'
      });
    }
    
    // SOLUCIÓN: Verificar si hay un token en los parámetros de consulta
    let bucketToUse = req.bucketName || defaultBucketName;
    let tokenUsername = null;
    
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[SEARCH] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.type === 'dynamic' && tokenData.bucket) {
          // Para usuarios dinámicos, usar el bucket especificado en el token
          tokenUsername = tokenData.username;
          console.log(`[SEARCH] Usuario dinámico ${tokenUsername} usando bucket ${tokenData.bucket} desde token en parámetros`);
          bucketToUse = tokenData.bucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = 'user';
          req.userType = 'dynamic';
          req.userFolders = tokenData.folders || [];
        } 
        else if (tokenData.username && userBucketMap[tokenData.username]) {
          // Para usuarios estáticos
          tokenUsername = tokenData.username;
          const tokenBucket = userBucketMap[tokenData.username];
          console.log(`[SEARCH] Usuario estático ${tokenUsername} usando bucket ${tokenBucket} desde token en parámetros`);
          bucketToUse = tokenBucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = userRoleMap[tokenData.username] || 'user';
        }

      } catch (tokenError) {
        console.error('[SEARCH] Error al decodificar token de parámetros:', tokenError);
      }
    } else {
      // Intento con el token de autorización
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          console.log(`[SEARCH] Token de autorización recibido: ${token}`);
          
          const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
          console.log(`[SEARCH] Token decodificado:`, JSON.stringify(tokenData));
          
          if (tokenData.username && userBucketMap[tokenData.username]) {
            tokenUsername = tokenData.username;
            bucketToUse = userBucketMap[tokenData.username];
            console.log(`[SEARCH] Forzando uso de bucket ${bucketToUse} para usuario ${tokenData.username}`);
          } else {
            console.log(`[SEARCH] No se pudo determinar el bucket para:`, JSON.stringify(tokenData));
            if (tokenData.username) {
              console.log(`[SEARCH] ¿Existe ${tokenData.username} en userBucketMap?`, !!userBucketMap[tokenData.username]);
            }
          }
        } catch (error) {
          console.error('[SEARCH] Error al procesar token para forzar bucket:', error);
        }
      } else {
        console.log(`[SEARCH] No hay token de autorización`);
      }
    }
    
    console.log(`[SEARCH] Usando bucket final: ${bucketToUse} para búsqueda`);
    
    const searchTerm = req.query.term;
    
    if (!searchTerm) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere un término de búsqueda' 
      });
    }

    console.log(`Buscando archivos/carpetas que coincidan con: "${searchTerm}" en bucket ${bucketToUse}`);
    
    // Función recursiva para buscar en carpetas
    const searchResults = [];
    
    // Función auxiliar para buscar en una carpeta específica (ahora con bucketToUse como parámetro)
    async function searchInFolder(prefix) {
      const { data: filesInFolder, error } = await supabase
        .storage
        .from(bucketToUse) // Ahora bucketToUse está definido en el ámbito superior
        .list(prefix, { 
          sortBy: { column: 'name', order: 'asc' }
        });
        
      if (error) {
        console.error(`Error al buscar en carpeta ${prefix}:`, error);
        return;
      }
      
      // Procesar los resultados de esta carpeta
      for (const item of filesInFolder) {
        // Ignorar archivos especiales .folder y archivos de metadatos
        if (item.name === '.folder' || 
            item.name.endsWith('.youtube.metadata') || 
            item.name.endsWith('.audio.metadata') || 
            item.name.endsWith('.image.metadata')) {
          continue;
        }
        
        const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
        
        // Verificar si el nombre coincide con el término de búsqueda (insensible a mayúsculas/minúsculas)
        if (item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          // Identificar si es carpeta o archivo
          const isFolder = !item.metadata || item.metadata.mimetype === 'application/x-directory';
          
          searchResults.push({
            name: item.name,
            path: `/${itemPath}`,
            size: (item.metadata && item.metadata.size) || 0,
            contentType: (item.metadata && item.metadata.mimetype) || 'application/octet-stream',
            updated: item.updated_at,
            isFolder: isFolder
          });
        }
        
        // Si es una carpeta, buscar dentro de ella recursivamente
        if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
          await searchInFolder(itemPath);
        }
      }
    }
    
    // Iniciar búsqueda desde la raíz
    await searchInFolder('');
    
    console.log(`Se encontraron ${searchResults.length} resultados para "${searchTerm}" en bucket ${bucketToUse}`);
    
    return res.json(searchResults);
  } catch (error) {
    console.error('Error en la búsqueda:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al realizar la búsqueda', 
      error: error.message 
    });
  }
});

// Endpoint para buscar archivos por etiquetas - Versión optimizada
app.get('/api/search-by-tags', async (req, res) => {
  const startTime = new Date().getTime();
  console.log(`[SEARCH_TAGS] Inicio búsqueda por etiquetas: ${startTime}`);
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario (misma lógica que en /api/search)
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
if (req.query.token) {
  try {
    const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
    console.log(`[SEARCH_TAGS] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
    
    if (tokenData.type === 'dynamic' && tokenData.bucket) {
      // Para usuarios dinámicos, usar el bucket especificado en el token
      console.log(`[SEARCH_TAGS] Usuario dinámico ${tokenData.username} usando bucket ${tokenData.bucket} desde token en parámetros`);
      bucketToUse = tokenData.bucket;
      
      // Actualizar también req.username y req.userRole para las validaciones posteriores
      req.username = tokenData.username;
      req.userRole = 'user';
      req.userType = 'dynamic';
      req.userFolders = tokenData.folders || [];
    }
    else if (tokenData.username && userBucketMap[tokenData.username]) {
      // Para usuarios estáticos
      const tokenBucket = userBucketMap[tokenData.username];
      console.log(`[SEARCH_TAGS] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token en parámetros`);
      bucketToUse = tokenBucket;
      
      // Actualizar también req.username y req.userRole para las validaciones posteriores
      req.username = tokenData.username;
      req.userRole = userRoleMap[tokenData.username] || 'user';
    }

      } catch (tokenError) {
        console.error('[SEARCH_TAGS] Error al decodificar token de parámetros:', tokenError);
      }
    }

    const tagSearch = req.query.tag;
    
    if (!tagSearch) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere una etiqueta para la búsqueda'
      });
    }

    console.log(`Buscando archivos con etiqueta: "${tagSearch}" en bucket ${bucketToUse}`);
    const searchTermLower = tagSearch.toLowerCase();
    
    // Resultados de la búsqueda
    const searchResults = [];
    const processedFiles = new Set(); // Para evitar procesar el mismo archivo dos veces
    const processedPaths = new Set(); // Para rastrear rutas ya procesadas

    // Optimización: obtener todos los archivos metadata de una vez en lugar de uno por uno
    console.log(`[SEARCH_TAGS] Listando archivos *.metadata en bucket ${bucketToUse}`);
    const stageTime1 = new Date().getTime();
    console.log(`[SEARCH_TAGS] Etapa inicial - Tiempo transcurrido: ${stageTime1 - startTime}ms`);

    // En lugar de buscar recursivamente, primero buscamos todos los archivos .metadata
    // con una función que obtenga la lista rápidamente
    async function getAllMetadataFiles() {
      const metadataFiles = [];
      
      // Función para obtener archivos .metadata en una carpeta
      async function getMetadataInFolder(prefix = '') {
        const { data, error } = await supabase.storage
          .from(bucketToUse)
          .list(prefix, {
            sortBy: { column: 'name', order: 'asc' }
          });
        
        if (error) {
          console.error(`Error al listar ${prefix}:`, error);
          return;
        }
        
        const folders = [];
        
        for (const item of data) {
          // Si es una carpeta, guardarla para procesarla después
          if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
            const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (!processedPaths.has(folderPath)) {
              processedPaths.add(folderPath);
              folders.push(folderPath);
            }
            continue;
          }
          
          // Solo nos interesan los archivos .metadata (pero no los especiales)
          if (item.name.endsWith('.metadata') && 
              !item.name.endsWith('.youtube.metadata') && 
              !item.name.endsWith('.audio.metadata') && 
              !item.name.endsWith('.image.metadata')) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            metadataFiles.push(itemPath);
          }
        }
        
        // Procesar subcarpetas (pero en lotes para no bloquear demasiado)
        const batchSize = 10;
        for (let i = 0; i < folders.length; i += batchSize) {
          const batch = folders.slice(i, i + batchSize);
          await Promise.all(batch.map(folder => getMetadataInFolder(folder)));
        }
      }
      
      await getMetadataInFolder();
      return metadataFiles;
    }
    
    const metadataFiles = await getAllMetadataFiles();
    const stageTime2 = new Date().getTime();
    console.log(`[SEARCH_TAGS] Encontrados ${metadataFiles.length} archivos .metadata en ${stageTime2 - stageTime1}ms`);
    
    // Procesar los archivos .metadata en lotes para buscar etiquetas
    const batchSize = 20; // Ajustar según sea necesario
    for (let i = 0; i < metadataFiles.length; i += batchSize) {
      const batch = metadataFiles.slice(i, i + batchSize);
      
      // Procesar lotes en paralelo para mayor velocidad
      await Promise.all(batch.map(async (metadataPath) => {
        try {
          // Obtener el archivo original al que pertenece este metadata
          const originalFilePath = metadataPath.slice(0, -9); // Quitar '.metadata'
          
          // Verificar si ya hemos procesado este archivo
          if (processedFiles.has(originalFilePath)) {
            return;
          }
          processedFiles.add(originalFilePath);
          
          // Descargar y procesar el archivo de metadatos
          const { data, error } = await supabase.storage
            .from(bucketToUse)
            .download(metadataPath);
          
          if (error) {
            console.error(`Error al descargar metadatos de ${metadataPath}:`, error);
            return;
          }
          
          // Parsear los metadatos y verificar etiquetas
          const text = await data.text();
          const metadata = JSON.parse(text);
          
          if (metadata && metadata.tags && Array.isArray(metadata.tags)) {
            const hasMatchingTag = metadata.tags.some(tag =>
              tag.toLowerCase().includes(searchTermLower)
            );
            
            if (hasMatchingTag) {
              // Obtener información básica del archivo
              const fileNameParts = originalFilePath.split('/');
              const fileName = fileNameParts[fileNameParts.length - 1];
              
              // Obtener metadatos actualizados del archivo
              const { data: fileData } = await supabase.storage
                .from(bucketToUse)
                .list(originalFilePath.substring(0, originalFilePath.lastIndexOf('/')), {
                  search: fileName
                });
              
              const fileInfo = fileData && fileData[0];
              
              searchResults.push({
                name: fileName,
                path: `/${originalFilePath}`,
                size: (fileInfo && fileInfo.metadata && fileInfo.metadata.size) || 0,
                contentType: (fileInfo && fileInfo.metadata && fileInfo.metadata.mimetype) || 'application/octet-stream',
                updated: (fileInfo && fileInfo.updated_at) || new Date().toISOString(),
                isFolder: false,
                metadata: metadata // Incluir metadatos para mostrar etiquetas en resultados
              });
            }
          }
        } catch (error) {
          console.error(`Error al procesar ${metadataPath}:`, error);
        }
      }));
    }
    
    const endTime = new Date().getTime();
    console.log(`[SEARCH_TAGS] Se encontraron ${searchResults.length} resultados con etiqueta "${tagSearch}" en bucket ${bucketToUse}`);
    console.log(`[SEARCH_TAGS] Tiempo total de búsqueda: ${endTime - startTime}ms`);
    
    return res.json(searchResults);
  } catch (error) {
    const endTime = new Date().getTime();
    console.error('Error en la búsqueda por etiquetas:', error);
    console.error(`[SEARCH_TAGS] Error tras ${endTime - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al realizar la búsqueda por etiquetas',
      error: error.message
    });
  }
});

// Endpoint para buscar archivos por fecha - Versión optimizada
app.get('/api/search-by-date', async (req, res) => {
  const startTime = new Date().getTime();
  console.log(`[SEARCH_DATE] Inicio búsqueda por fecha: ${startTime}`);
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
if (req.query.token) {
  try {
    const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
    console.log(`[SEARCH_DATE] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
    
    if (tokenData.type === 'dynamic' && tokenData.bucket) {
      // Para usuarios dinámicos, usar el bucket especificado en el token
      console.log(`[SEARCH_DATE] Usuario dinámico ${tokenData.username} usando bucket ${tokenData.bucket} desde token en parámetros`);
      bucketToUse = tokenData.bucket;
      
      // Actualizar también req.username y req.userRole para las validaciones posteriores
      req.username = tokenData.username;
      req.userRole = 'user';
      req.userType = 'dynamic';
      req.userFolders = tokenData.folders || [];
    }
    else if (tokenData.username && userBucketMap[tokenData.username]) {
      // Para usuarios estáticos
      const tokenBucket = userBucketMap[tokenData.username];
      console.log(`[SEARCH_DATE] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token en parámetros`);
      bucketToUse = tokenBucket;
      
      // Actualizar también req.username y req.userRole para las validaciones posteriores
      req.username = tokenData.username;
      req.userRole = userRoleMap[tokenData.username] || 'user';
    }
      } catch (tokenError) {
        console.error('[SEARCH_DATE] Error al decodificar token de parámetros:', tokenError);
      }
    }

    // Obtener los parámetros de búsqueda
    const dateValue = req.query.date;
    const searchType = req.query.type || 'specific'; // specific, month, year
    
    if (!dateValue) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere una fecha para la búsqueda'
      });
    }

    console.log(`Buscando archivos con fecha: "${dateValue}" (tipo: ${searchType}) en bucket ${bucketToUse}`);
    
    // Resultados de la búsqueda
    const searchResults = [];
    const processedFiles = new Set(); // Para evitar procesar el mismo archivo dos veces
    const processedPaths = new Set(); // Para rastrear rutas ya procesadas

    // Optimización: obtener todos los archivos metadata de una vez en lugar de uno por uno
    console.log(`[SEARCH_DATE] Listando archivos *.metadata en bucket ${bucketToUse}`);
    const stageTime1 = new Date().getTime();
    console.log(`[SEARCH_DATE] Etapa inicial - Tiempo transcurrido: ${stageTime1 - startTime}ms`);

    // Función para obtener todos los archivos .metadata (similar a la búsqueda por etiquetas)
    async function getAllMetadataFiles() {
      const metadataFiles = [];
      
      // Función para obtener archivos .metadata en una carpeta
      async function getMetadataInFolder(prefix = '') {
        const { data, error } = await supabase.storage
          .from(bucketToUse)
          .list(prefix, {
            sortBy: { column: 'name', order: 'asc' }
          });
        
        if (error) {
          console.error(`Error al listar ${prefix}:`, error);
          return;
        }
        
        const folders = [];
        
        for (const item of data) {
          // Si es una carpeta, guardarla para procesarla después
          if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
            const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (!processedPaths.has(folderPath)) {
              processedPaths.add(folderPath);
              folders.push(folderPath);
            }
            continue;
          }
          
          // Solo nos interesan los archivos .metadata (pero no los especiales)
          if (item.name.endsWith('.metadata') && 
              !item.name.endsWith('.youtube.metadata') && 
              !item.name.endsWith('.audio.metadata') && 
              !item.name.endsWith('.image.metadata')) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            metadataFiles.push(itemPath);
          }
        }
        
        // Procesar subcarpetas (pero en lotes para no bloquear demasiado)
        const batchSize = 10;
        for (let i = 0; i < folders.length; i += batchSize) {
          const batch = folders.slice(i, i + batchSize);
          await Promise.all(batch.map(folder => getMetadataInFolder(folder)));
        }
      }
      
      await getMetadataInFolder();
      return metadataFiles;
    }
    
    const metadataFiles = await getAllMetadataFiles();
    const stageTime2 = new Date().getTime();
    console.log(`[SEARCH_DATE] Encontrados ${metadataFiles.length} archivos .metadata en ${stageTime2 - stageTime1}ms`);
    
    // Función para validar fechas
    function isDateMatch(fileDate, searchDate, searchType) {
      if (!fileDate) return false;
      
      try {
        // Asegurarse de que fileDate tiene el formato adecuado (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fileDate)) {
          return false;
        }
        
        // Extraer componentes de la fecha del archivo
        const [fileYear, fileMonth, fileDay] = fileDate.split('-').map(n => parseInt(n, 10));
        
        if (searchType === 'specific') {
          // Para búsqueda de fecha específica, formato esperado: YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(searchDate)) {
            return false;
          }
          const [searchYear, searchMonth, searchDay] = searchDate.split('-').map(n => parseInt(n, 10));
          return fileYear === searchYear && fileMonth === searchMonth && fileDay === searchDay;
        } 
        else if (searchType === 'month') {
          // Para búsqueda por mes, formatos esperados: MM-YYYY o solo MM
          let searchYear, searchMonth;
          
          if (searchDate.includes('-')) {
            // Formato MM-YYYY
            [searchMonth, searchYear] = searchDate.split('-').map(n => parseInt(n, 10));
          } else {
            // Solo MM, usar año actual
            searchMonth = parseInt(searchDate, 10);
            searchYear = new Date().getFullYear();
          }
          
          return fileYear === searchYear && fileMonth === searchMonth;
        } 
        else if (searchType === 'year') {
          // Para búsqueda por año, formato esperado: YYYY
          const searchYear = parseInt(searchDate, 10);
          return fileYear === searchYear;
        }
        
        return false;
      } catch (error) {
        console.error('Error al comparar fechas:', error);
        return false;
      }
    }
    
    // Procesar los archivos .metadata en lotes para buscar fechas
    const batchSize = 20; // Ajustar según sea necesario
    for (let i = 0; i < metadataFiles.length; i += batchSize) {
      const batch = metadataFiles.slice(i, i + batchSize);
      
      // Procesar lotes en paralelo para mayor velocidad
      await Promise.all(batch.map(async (metadataPath) => {
        try {
          // Obtener el archivo original al que pertenece este metadata
          const originalFilePath = metadataPath.slice(0, -9); // Quitar '.metadata'
          
          // Verificar si ya hemos procesado este archivo
          if (processedFiles.has(originalFilePath)) {
            return;
          }
          processedFiles.add(originalFilePath);
          
          // Descargar y procesar el archivo de metadatos
          const { data, error } = await supabase.storage
            .from(bucketToUse)
            .download(metadataPath);
          
          if (error) {
            console.error(`Error al descargar metadatos de ${metadataPath}:`, error);
            return;
          }
          
          // Parsear los metadatos y verificar fecha
          const text = await data.text();
          const metadata = JSON.parse(text);
          
          // Verificar si hay una fecha y si coincide con el criterio de búsqueda
          if (metadata && metadata.fileDate) {
            const isMatch = isDateMatch(metadata.fileDate, dateValue, searchType);
            
            if (isMatch) {
              // Obtener información básica del archivo
              const fileNameParts = originalFilePath.split('/');
              const fileName = fileNameParts[fileNameParts.length - 1];
              
              // Obtener metadatos actualizados del archivo
              const folderPath = originalFilePath.substring(0, originalFilePath.lastIndexOf('/') || 0);
              const { data: fileData } = await supabase.storage
                .from(bucketToUse)
                .list(folderPath, {
                  search: fileName
                });
              
              const fileInfo = fileData && fileData[0];
              
              searchResults.push({
                name: fileName,
                path: `/${originalFilePath}`,
                size: (fileInfo && fileInfo.metadata && fileInfo.metadata.size) || 0,
                contentType: (fileInfo && fileInfo.metadata && fileInfo.metadata.mimetype) || 'application/octet-stream',
                updated: (fileInfo && fileInfo.updated_at) || new Date().toISOString(),
                isFolder: false,
                metadata: metadata // Incluir metadatos para mostrar información en resultados
              });
            }
          }
        } catch (error) {
          console.error(`Error al procesar ${metadataPath}:`, error);
        }
      }));
    }
    
    const endTime = new Date().getTime();
    console.log(`[SEARCH_DATE] Se encontraron ${searchResults.length} resultados con fecha "${dateValue}" en bucket ${bucketToUse}`);
    console.log(`[SEARCH_DATE] Tiempo total de búsqueda: ${endTime - startTime}ms`);
    
    return res.json(searchResults);
  } catch (error) {
    const endTime = new Date().getTime();
    console.error('Error en la búsqueda por fecha:', error);
    console.error(`[SEARCH_DATE] Error tras ${endTime - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al realizar la búsqueda por fecha',
      error: error.message
    });
  }
});

// Endpoint para búsqueda combinada de etiquetas y fechas
app.get('/api/search-combined', async (req, res) => {
  const startTime = new Date().getTime();
  console.log(`[SEARCH_COMBINED] Inicio búsqueda combinada: ${startTime}`);
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
if (req.query.token) {
  try {
    const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
    console.log(`[SEARCH_COMBINED] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
    
    if (tokenData.type === 'dynamic' && tokenData.bucket) {
      // Para usuarios dinámicos, usar el bucket especificado en el token
      console.log(`[SEARCH_COMBINED] Usuario dinámico ${tokenData.username} usando bucket ${tokenData.bucket} desde token en parámetros`);
      bucketToUse = tokenData.bucket;
      
      // Actualizar también req.username y req.userRole para las validaciones posteriores
      req.username = tokenData.username;
      req.userRole = 'user';
      req.userType = 'dynamic';
      req.userFolders = tokenData.folders || [];
    }
    else if (tokenData.username && userBucketMap[tokenData.username]) {
      // Para usuarios estáticos
      const tokenBucket = userBucketMap[tokenData.username];
      console.log(`[SEARCH_COMBINED] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token en parámetros`);
      bucketToUse = tokenBucket;
      
      // Actualizar también req.username y req.userRole para las validaciones posteriores
      req.username = tokenData.username;
      req.userRole = userRoleMap[tokenData.username] || 'user';
    }
      } catch (tokenError) {
        console.error('[SEARCH_COMBINED] Error al decodificar token de parámetros:', tokenError);
      }
    }

    // Obtener los parámetros de búsqueda
    const tagSearch = req.query.tag;
    const dateValue = req.query.date;
    const dateType = req.query.dateType || 'specific'; // specific, month, year
    
    if (!tagSearch || !dateValue) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere tanto una etiqueta como una fecha para la búsqueda combinada'
      });
    }

    console.log(`Buscando archivos con etiqueta: "${tagSearch}" y fecha: "${dateValue}" (tipo: ${dateType}) en bucket ${bucketToUse}`);
    const searchTagLower = tagSearch.toLowerCase();
    
    // Resultados de la búsqueda
    const searchResults = [];
    const processedFiles = new Set(); // Para evitar procesar el mismo archivo dos veces
    const processedPaths = new Set(); // Para rastrear rutas ya procesadas

    // Optimización: obtener todos los archivos metadata de una vez
    console.log(`[SEARCH_COMBINED] Listando archivos *.metadata en bucket ${bucketToUse}`);
    const stageTime1 = new Date().getTime();
    console.log(`[SEARCH_COMBINED] Etapa inicial - Tiempo transcurrido: ${stageTime1 - startTime}ms`);

    // Función para obtener todos los archivos .metadata
    async function getAllMetadataFiles() {
      const metadataFiles = [];
      
      // Función para obtener archivos .metadata en una carpeta
      async function getMetadataInFolder(prefix = '') {
        const { data, error } = await supabase.storage
          .from(bucketToUse)
          .list(prefix, {
            sortBy: { column: 'name', order: 'asc' }
          });
        
        if (error) {
          console.error(`Error al listar ${prefix}:`, error);
          return;
        }
        
        const folders = [];
        
        for (const item of data) {
          // Si es una carpeta, guardarla para procesarla después
          if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
            const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (!processedPaths.has(folderPath)) {
              processedPaths.add(folderPath);
              folders.push(folderPath);
            }
            continue;
          }
          
          // Solo nos interesan los archivos .metadata (pero no los especiales)
          if (item.name.endsWith('.metadata') && 
              !item.name.endsWith('.youtube.metadata') && 
              !item.name.endsWith('.audio.metadata') && 
              !item.name.endsWith('.image.metadata')) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            metadataFiles.push(itemPath);
          }
        }
        
        // Procesar subcarpetas (pero en lotes para no bloquear demasiado)
        const batchSize = 10;
        for (let i = 0; i < folders.length; i += batchSize) {
          const batch = folders.slice(i, i + batchSize);
          await Promise.all(batch.map(folder => getMetadataInFolder(folder)));
        }
      }
      
      await getMetadataInFolder();
      return metadataFiles;
    }
    
    const metadataFiles = await getAllMetadataFiles();
    const stageTime2 = new Date().getTime();
    console.log(`[SEARCH_COMBINED] Encontrados ${metadataFiles.length} archivos .metadata en ${stageTime2 - stageTime1}ms`);
    
    // Función para validar fechas
    function isDateMatch(fileDate, searchDate, searchType) {
      if (!fileDate) return false;
      
      try {
        // Asegurarse de que fileDate tiene el formato adecuado (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fileDate)) {
          return false;
        }
        
        // Extraer componentes de la fecha del archivo
        const [fileYear, fileMonth, fileDay] = fileDate.split('-').map(n => parseInt(n, 10));
        
        if (searchType === 'specific') {
          // Para búsqueda de fecha específica, formato esperado: YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(searchDate)) {
            return false;
          }
          const [searchYear, searchMonth, searchDay] = searchDate.split('-').map(n => parseInt(n, 10));
          return fileYear === searchYear && fileMonth === searchMonth && fileDay === searchDay;
        } 
        else if (searchType === 'month') {
          // Para búsqueda por mes, formatos esperados: YYYY-MM o solo MM
          let searchYear, searchMonth;
          
          if (searchDate.includes('-')) {
            // Formato YYYY-MM
            [searchYear, searchMonth] = searchDate.split('-').map(n => parseInt(n, 10));
          } else {
            // Solo MM, usar año actual
            searchMonth = parseInt(searchDate, 10);
            searchYear = new Date().getFullYear();
          }
          
          return fileYear === searchYear && fileMonth === searchMonth;
        } 
        else if (searchType === 'year') {
          // Para búsqueda por año, formato esperado: YYYY
          const searchYear = parseInt(searchDate, 10);
          return fileYear === searchYear;
        }
        
        return false;
      } catch (error) {
        console.error('Error al comparar fechas:', error);
        return false;
      }
    }
    
    // Procesar los archivos .metadata en lotes
    const batchSize = 20;
    for (let i = 0; i < metadataFiles.length; i += batchSize) {
      const batch = metadataFiles.slice(i, i + batchSize);
      
      // Procesar lotes en paralelo para mayor velocidad
      await Promise.all(batch.map(async (metadataPath) => {
        try {
          // Obtener el archivo original al que pertenece este metadata
          const originalFilePath = metadataPath.slice(0, -9); // Quitar '.metadata'
          
          // Verificar si ya hemos procesado este archivo
          if (processedFiles.has(originalFilePath)) {
            return;
          }
          processedFiles.add(originalFilePath);
          
          // Descargar y procesar el archivo de metadatos
          const { data, error } = await supabase.storage
            .from(bucketToUse)
            .download(metadataPath);
          
          if (error) {
            console.error(`Error al descargar metadatos de ${metadataPath}:`, error);
            return;
          }
          
          // Parsear los metadatos
          const text = await data.text();
          const metadata = JSON.parse(text);
          
          // Verificar si el archivo coincide con ambos criterios: etiqueta y fecha
          const hasMatchingTag = metadata.tags && Array.isArray(metadata.tags) && 
              metadata.tags.some(tag => tag.toLowerCase().includes(searchTagLower));
          
          const hasMatchingDate = metadata.fileDate && 
              isDateMatch(metadata.fileDate, dateValue, dateType);
          
          // Solo incluir si coincide con ambos criterios
          if (hasMatchingTag && hasMatchingDate) {
            // Obtener información básica del archivo
            const fileNameParts = originalFilePath.split('/');
            const fileName = fileNameParts[fileNameParts.length - 1];
            
            // Obtener metadatos actualizados del archivo
            const { data: fileData } = await supabase.storage
              .from(bucketToUse)
              .list(originalFilePath.substring(0, originalFilePath.lastIndexOf('/')), {
                search: fileName
              });
            
            const fileInfo = fileData && fileData[0];
            
            searchResults.push({
              name: fileName,
              path: `/${originalFilePath}`,
              size: (fileInfo && fileInfo.metadata && fileInfo.metadata.size) || 0,
              contentType: (fileInfo && fileInfo.metadata && fileInfo.metadata.mimetype) || 'application/octet-stream',
              updated: (fileInfo && fileInfo.updated_at) || new Date().toISOString(),
              isFolder: false,
              metadata: metadata // Incluir metadatos para mostrar información en resultados
            });
          }
        } catch (error) {
          console.error(`Error al procesar ${metadataPath}:`, error);
        }
      }));
    }
    
    const endTime = new Date().getTime();
    console.log(`[SEARCH_COMBINED] Se encontraron ${searchResults.length} resultados con etiqueta "${tagSearch}" y fecha "${dateValue}" en bucket ${bucketToUse}`);
    console.log(`[SEARCH_COMBINED] Tiempo total de búsqueda: ${endTime - startTime}ms`);
    
    return res.json(searchResults);

  } catch (error) {
    const endTime = new Date().getTime();
    console.error('Error en la búsqueda combinada:', error);
    console.error(`[SEARCH_COMBINED] Error tras ${endTime - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al realizar la búsqueda combinada',
      error: error.message
    });
  }
});

// Endpoint para búsqueda por múltiples etiquetas - Versión optimizada
app.get('/api/search-by-multiple-tags', async (req, res) => {
  const startTime = new Date().getTime();
  console.log(`[SEARCH_MULTIPLE_TAGS] Inicio búsqueda por múltiples etiquetas: ${startTime}`);
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[SEARCH_MULTIPLE_TAGS] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.type === 'dynamic' && tokenData.bucket) {
          // Usuario dinámico
          console.log(`[SEARCH_MULTIPLE_TAGS] Usuario dinámico ${tokenData.username} usando bucket ${tokenData.bucket} desde token`);
          bucketToUse = tokenData.bucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = 'user';
          req.userType = 'dynamic';
          req.userFolders = tokenData.folders || [];
        }
        else if (tokenData.username && userBucketMap[tokenData.username]) {
          // Para usuarios estáticos
          const tokenBucket = userBucketMap[tokenData.username];
          console.log(`[SEARCH_MULTIPLE_TAGS] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token en parámetros`);
          bucketToUse = tokenBucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = userRoleMap[tokenData.username] || 'user';
        }
      } catch (tokenError) {
        console.error('[SEARCH_MULTIPLE_TAGS] Error al decodificar token de parámetros:', tokenError);
      }
    }

    // Obtener los parámetros de búsqueda - múltiples etiquetas (pueden ser IDs o nombres)
    const tags = req.query.tags;
    const useTagIds = req.query.useIds === 'true'; // Parámetro opcional para usar IDs en lugar de nombres
    
    if (!tags) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos una etiqueta para la búsqueda'
      });
    }

    // Convertir el parámetro de tags (formato tags=tag1,tag2,tag3) a un array
    const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    if (tagArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos una etiqueta válida para la búsqueda'
      });
    }
    
    // Limitar a 10 etiquetas máximo para prevenir consultas muy grandes
    const tagsToSearch = tagArray.slice(0, 10);
    
    console.log(`Buscando archivos con etiquetas: "${tagsToSearch.join(', ')}" en bucket ${bucketToUse}`);
    console.log(`Usando ${useTagIds ? 'IDs' : 'nombres'} de etiquetas para la búsqueda`);
    
    // MEJORA 1: Si se están usando IDs, obtenemos primero los datos exactos de las etiquetas
    let searchTagsData = [];
    if (useTagIds) {
      try {
        const { data: tagData, error: tagError } = await supabase
          .from('tags_by_bucket')
          .select('id, tag_name, category')
          .eq('bucket', bucketToUse)
          .in('id', tagsToSearch);
          
        if (!tagError && tagData) {
          searchTagsData = tagData;
          console.log(`IDs de etiquetas mapeados a nombres: ${tagData.map(t => t.tag_name).join(', ')}`);
          console.log(`Categorías de las etiquetas: ${tagData.map(t => t.category).join(', ')}`);
        }
      } catch (err) {
        console.error('Error al mapear IDs de etiquetas a nombres:', err);
      }
    } else {
      // Búsqueda por nombres: obtener todas las etiquetas para hacer coincidencias exactas
      try {
        const { data: tagData, error: tagError } = await supabase
          .from('tags_by_bucket')
          .select('id, tag_name, category')
          .eq('bucket', bucketToUse);
          
        if (!tagError && tagData) {
          // Filtrar para encontrar las etiquetas buscadas (coincidencia exacta)
          searchTagsData = tagData.filter(tag => 
            tagsToSearch.some(searchTag => 
              tag.tag_name.toLowerCase() === searchTag.toLowerCase()
            )
          );
          console.log(`Etiquetas encontradas: ${searchTagsData.map(t => t.tag_name).join(', ')}`);
          console.log(`Categorías de las etiquetas: ${searchTagsData.map(t => t.category).join(', ')}`);
        }
      } catch (err) {
        console.error('Error al obtener etiquetas para búsqueda por nombres:', err);
      }
    }
    
    // Si no se encontraron etiquetas válidas, devolver resultado vacío
    if (searchTagsData.length === 0) {
      console.log('[SEARCH_MULTIPLE_TAGS] No se encontraron etiquetas válidas para la búsqueda');
      return res.json([]);
    }
    
    // MEJORA 2: Agrupar etiquetas por categoría para control adicional
    const tagsByCategory = {};
    searchTagsData.forEach(tag => {
      if (!tagsByCategory[tag.category]) {
        tagsByCategory[tag.category] = [];
      }
      tagsByCategory[tag.category].push({
        id: tag.id,
        name: tag.tag_name
      });
    });
    
    console.log(`[SEARCH_MULTIPLE_TAGS] Etiquetas agrupadas por categoría: ${JSON.stringify(tagsByCategory)}`);
    
    // Preparar arrays para la búsqueda optimizada
    const searchTagIds = searchTagsData.map(tag => tag.id);
    const searchTagNames = searchTagsData.map(tag => tag.tag_name.toLowerCase());
    
    // Resultados de la búsqueda
    const searchResults = [];
    const processedFiles = new Set(); // Para evitar procesar el mismo archivo dos veces
    const processedPaths = new Set(); // Para rastrear rutas ya procesadas

    // Optimización: obtener todos los archivos metadata de una vez
    console.log(`[SEARCH_MULTIPLE_TAGS] Listando archivos *.metadata en bucket ${bucketToUse}`);
    const stageTime1 = new Date().getTime();
    console.log(`[SEARCH_MULTIPLE_TAGS] Etapa inicial - Tiempo transcurrido: ${stageTime1 - startTime}ms`);

    // Función para obtener todos los archivos .metadata
    async function getAllMetadataFiles() {
      const metadataFiles = [];
      
      // Función para obtener archivos .metadata en una carpeta
      async function getMetadataInFolder(prefix = '') {
        const { data, error } = await supabase.storage
          .from(bucketToUse)
          .list(prefix, {
            sortBy: { column: 'name', order: 'asc' }
          });
        
        if (error) {
          console.error(`Error al listar ${prefix}:`, error);
          return;
        }
        
        const folders = [];
        
        for (const item of data) {
          // Si es una carpeta, guardarla para procesarla después
          if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
            const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (!processedPaths.has(folderPath)) {
              processedPaths.add(folderPath);
              folders.push(folderPath);
            }
            continue;
          }
          
          // Solo nos interesan los archivos .metadata (pero no los especiales)
          if (item.name.endsWith('.metadata') && 
              !item.name.endsWith('.youtube.metadata') && 
              !item.name.endsWith('.audio.metadata') && 
              !item.name.endsWith('.image.metadata')) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            metadataFiles.push(itemPath);
          }
        }
        
        // Procesar subcarpetas (pero en lotes para no bloquear demasiado)
        const batchSize = 10;
        for (let i = 0; i < folders.length; i += batchSize) {
          const batch = folders.slice(i, i + batchSize);
          await Promise.all(batch.map(folder => getMetadataInFolder(folder)));
        }
      }
      
      await getMetadataInFolder();
      return metadataFiles;
    }
    
    const metadataFiles = await getAllMetadataFiles();
    const stageTime2 = new Date().getTime();
    console.log(`[SEARCH_MULTIPLE_TAGS] Encontrados ${metadataFiles.length} archivos .metadata en ${stageTime2 - stageTime1}ms`);
    
    // MEJORA 3: Optimizar el procesamiento de archivos mediante búsqueda en lotes
    const totalFiles = metadataFiles.length;
    console.log(`[SEARCH_MULTIPLE_TAGS] Procesando ${totalFiles} archivos metadata para la búsqueda`);
    
    // Procesar los archivos .metadata en lotes
    const batchSize = 20;
    for (let i = 0; i < metadataFiles.length; i += batchSize) {
      const batch = metadataFiles.slice(i, i + batchSize);
      
      // Mostrar progreso cada 100 archivos
      if (i % 100 === 0 && i > 0) {
        console.log(`[SEARCH_MULTIPLE_TAGS] Progreso: ${i}/${totalFiles} archivos procesados (${Math.floor(i/totalFiles*100)}%)`);
      }
      
      // Procesar lotes en paralelo para mayor velocidad
      await Promise.all(batch.map(async (metadataPath) => {
        try {
          // Obtener el archivo original al que pertenece este metadata
          const originalFilePath = metadataPath.slice(0, -9); // Quitar '.metadata'
          
          // Verificar si ya hemos procesado este archivo
          if (processedFiles.has(originalFilePath)) {
            return;
          }
          processedFiles.add(originalFilePath);
          
          // Descargar y procesar el archivo de metadatos
          const { data, error } = await supabase.storage
            .from(bucketToUse)
            .download(metadataPath);
          
          if (error) {
            console.error(`Error al descargar metadatos de ${metadataPath}:`, error);
            return;
          }
          
          // Parsear los metadatos
          const text = await data.text();
          const metadata = JSON.parse(text);
          
          // MEJORA 4: Verificación mejorada de etiquetas
          let matchesByCategory = {};
          
          // Inicializar contador de coincidencias por categoría
          Object.keys(tagsByCategory).forEach(category => {
            matchesByCategory[category] = 0;
          });
          
          if (metadata && metadata.tags && Array.isArray(metadata.tags)) {
            // Si hay etiquetas tanto en los metadatos como buscadas
            // Normalizar etiquetas del archivo a minúsculas
            const fileTags = metadata.tags.map(tag => tag.toLowerCase());
            
            // Para archivos que usan IDs
            if (metadata.tagIds && Array.isArray(metadata.tagIds)) {
              // El archivo tiene IDs almacenados, comparación directa
              for (const tagId of searchTagIds) {
                if (metadata.tagIds.includes(tagId)) {
                  // Encontrar la categoría de esta etiqueta
                  const tagData = searchTagsData.find(t => t.id === tagId);
                  if (tagData) {
                    matchesByCategory[tagData.category] = (matchesByCategory[tagData.category] || 0) + 1;
                  }
                }
              }
            } else {
              // El archivo no tiene IDs, comparar por nombres
              for (let i = 0; i < searchTagNames.length; i++) {
                const searchTagName = searchTagNames[i];
                // Buscar coincidencia exacta de nombre (después de normalizar a minúsculas)
                if (fileTags.includes(searchTagName)) {
                  // Encontrar la categoría de esta etiqueta
                  const tagData = searchTagsData[i];
                  if (tagData) {
                    matchesByCategory[tagData.category] = (matchesByCategory[tagData.category] || 0) + 1;
                  }
                }
              }
            }
          }
          
          // MEJORA 5: Determinar si el archivo coincide con la búsqueda
          // Para que un archivo coincida, debe tener al menos una etiqueta de cada categoría buscada
          const allCategoriesMatch = Object.keys(tagsByCategory).every(category => 
            matchesByCategory[category] > 0
          );
          
          // Solo incluir el archivo si tiene al menos una etiqueta de cada categoría buscada
          if (allCategoriesMatch) {
            // Obtener información básica del archivo
            const fileNameParts = originalFilePath.split('/');
            const fileName = fileNameParts[fileNameParts.length - 1];
            
            // Obtener metadatos actualizados del archivo
            const folderPath = originalFilePath.substring(0, originalFilePath.lastIndexOf('/') || 0);
            const { data: fileData } = await supabase.storage
              .from(bucketToUse)
              .list(folderPath, {
                search: fileName
              });
            
            const fileInfo = fileData && fileData[0];
            
            searchResults.push({
              name: fileName,
              path: `/${originalFilePath}`,
              size: (fileInfo && fileInfo.metadata && fileInfo.metadata.size) || 0,
              contentType: (fileInfo && fileInfo.metadata && fileInfo.metadata.mimetype) || 'application/octet-stream',
              updated: (fileInfo && fileInfo.updated_at) || new Date().toISOString(),
              isFolder: false,
              metadata: metadata // Incluir metadatos para mostrar información en resultados
            });
          }
        } catch (error) {
          console.error(`Error al procesar ${metadataPath}:`, error);
        }
      }));
    }
    
    const endTime = new Date().getTime();
    console.log(`[SEARCH_MULTIPLE_TAGS] Se encontraron ${searchResults.length} resultados con etiquetas: "${tagsToSearch.join(', ')}" en bucket ${bucketToUse}`);
    console.log(`[SEARCH_MULTIPLE_TAGS] Tiempo total de búsqueda: ${endTime - startTime}ms`);
    
    return res.json(searchResults);
  } catch (error) {
    const endTime = new Date().getTime();
    console.error('Error en la búsqueda por múltiples etiquetas:', error);
    console.error(`[SEARCH_MULTIPLE_TAGS] Error tras ${endTime - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al realizar la búsqueda por múltiples etiquetas',
      error: error.message
    });
  }
});

// Endpoint para búsqueda combinada de múltiples etiquetas y fecha

app.get('/api/search-multiple-tags-with-date', async (req, res) => {
  const startTime = new Date().getTime();
  console.log(`[SEARCH_MULTIPLE_TAGS_DATE] Inicio búsqueda combinada múltiples etiquetas y fecha: ${startTime}`);
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[SEARCH_MULTIPLE_TAGS_DATE] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.type === 'dynamic' && tokenData.bucket) {
          // Usuario dinámico
          console.log(`[SEARCH_MULTIPLE_TAGS_DATE] Usuario dinámico ${tokenData.username} usando bucket ${tokenData.bucket} desde token`);
          bucketToUse = tokenData.bucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = 'user';
          req.userType = 'dynamic';
          req.userFolders = tokenData.folders || [];
        }
        else if (tokenData.username && userBucketMap[tokenData.username]) {
          // Para usuarios estáticos
          const tokenBucket = userBucketMap[tokenData.username];
          console.log(`[SEARCH_MULTIPLE_TAGS_DATE] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token en parámetros`);
          bucketToUse = tokenBucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = userRoleMap[tokenData.username] || 'user';
        }
      } catch (tokenError) {
        console.error('[SEARCH_MULTIPLE_TAGS_DATE] Error al decodificar token de parámetros:', tokenError);
      }
    }

    // Obtener los parámetros de búsqueda - múltiples etiquetas y fecha
const tags = req.query.tags;
const dateValue = req.query.date;
const dateType = req.query.dateType || 'specific'; // specific, month, year
const useIds = req.query.useIds === 'true';
// OPCIÓN MODIFICADA: Requiere coincidencia exacta de todas las etiquetas por defecto (TRUE)
// Solo será falso si se pasa explícitamente 'false'
const requireAllTags = req.query.requireAllTags !== 'false';

if (!tags || !dateValue) {
  return res.status(400).json({
    success: false,
    message: 'Se requieren tanto etiquetas como una fecha para la búsqueda combinada'
  });
}

    // MEJORA: Variables para almacenar tanto IDs como nombres de etiquetas para la búsqueda
    let tagNamesForSearch = [];
    let tagsToSearch = [];

    // Primero, convertir el parámetro de tags a un array
    const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    if (tagArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos una etiqueta válida para la búsqueda'
      });
    }
    
    // Limitar a 4 etiquetas máximo
    tagsToSearch = tagArray.slice(0, 4);
    
    // SOLUCIÓN COMPLETA: Si useIds es true, convertir IDs de etiquetas a nombres para la búsqueda
    if (useIds) {
      console.log(`[SEARCH_MULTIPLE_TAGS_DATE] Usando búsqueda por IDs, obteniendo nombres correspondientes...`);
      try {
        // Obtener los nombres de etiquetas correspondientes a los IDs
        const { data: tagData, error: tagError } = await supabase
          .from('tags_by_bucket')
          .select('id, tag_name')
          .eq('bucket', bucketToUse)
          .in('id', tagsToSearch);
        
        if (tagError) {
          console.error('Error al obtener nombres de etiquetas:', tagError);
          return res.status(500).json({
            success: false,
            message: 'Error al convertir IDs de etiquetas a nombres',
            error: tagError.message
          });
        }
        
        if (tagData && tagData.length > 0) {
          // Guardar tanto los IDs como los nombres para referencia
          const tagIdsToNames = {};
          tagData.forEach(tag => {
            tagIdsToNames[tag.id] = tag.tag_name;
          });
          
          // Extraer solo los nombres para la búsqueda
          tagNamesForSearch = tagData.map(tag => tag.tag_name);
          
          console.log(`[SEARCH_MULTIPLE_TAGS_DATE] IDs de etiquetas mapeados a nombres:`, JSON.stringify(tagIdsToNames));
          console.log(`[SEARCH_MULTIPLE_TAGS_DATE] Nombres de etiquetas para búsqueda:`, tagNamesForSearch.join(', '));
        } else {
          console.log(`[SEARCH_MULTIPLE_TAGS_DATE] No se encontraron etiquetas con los IDs proporcionados`);
          // Si no se encuentran etiquetas con esos IDs, no habrá resultados
          return res.json([]);
        }
      } catch (error) {
        console.error('Error general al obtener nombres de etiquetas:', error);
        return res.status(500).json({
          success: false,
          message: 'Error interno al procesar etiquetas',
          error: error.message
        });
      }
    } else {
      // Si no se usan IDs, los nombres para búsqueda son los mismos que los tags originales
      tagNamesForSearch = tagsToSearch;
    }
    
    // Convertir nombres de etiquetas a minúsculas para búsqueda insensible a mayúsculas/minúsculas
    const tagsLower = tagNamesForSearch.map(tag => tag.toLowerCase());
    
    console.log(`Buscando archivos con etiquetas: "${tagNamesForSearch.join(', ')}" y fecha: "${dateValue}" (tipo: ${dateType}) en bucket ${bucketToUse}`);
    console.log(`Modo de coincidencia: ${requireAllTags ? 'TODAS las etiquetas requeridas' : 'AL MENOS UNA etiqueta requerida'}`);
    
    // Resultados de la búsqueda
    const searchResults = [];
    const processedFiles = new Set(); // Para evitar procesar el mismo archivo dos veces
    const processedPaths = new Set(); // Para rastrear rutas ya procesadas

    // Optimización: obtener todos los archivos metadata de una vez
    console.log(`[SEARCH_MULTIPLE_TAGS_DATE] Listando archivos *.metadata en bucket ${bucketToUse}`);
    const stageTime1 = new Date().getTime();
    console.log(`[SEARCH_MULTIPLE_TAGS_DATE] Etapa inicial - Tiempo transcurrido: ${stageTime1 - startTime}ms`);

    // Función para obtener todos los archivos .metadata
    async function getAllMetadataFiles() {
      const metadataFiles = [];
      
      // Función para obtener archivos .metadata en una carpeta
      async function getMetadataInFolder(prefix = '') {
        const { data, error } = await supabase.storage
          .from(bucketToUse)
          .list(prefix, {
            sortBy: { column: 'name', order: 'asc' }
          });
        
        if (error) {
          console.error(`Error al listar ${prefix}:`, error);
          return;
        }
        
        const folders = [];
        
        for (const item of data) {
          // Si es una carpeta, guardarla para procesarla después
          if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
            const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (!processedPaths.has(folderPath)) {
              processedPaths.add(folderPath);
              folders.push(folderPath);
            }
            continue;
          }
          
          // Solo nos interesan los archivos .metadata (pero no los especiales)
          if (item.name.endsWith('.metadata') && 
              !item.name.endsWith('.youtube.metadata') && 
              !item.name.endsWith('.audio.metadata') && 
              !item.name.endsWith('.image.metadata')) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            metadataFiles.push(itemPath);
          }
        }
        
        // Procesar subcarpetas (pero en lotes para no bloquear demasiado)
        const batchSize = 10;
        for (let i = 0; i < folders.length; i += batchSize) {
          const batch = folders.slice(i, i + batchSize);
          await Promise.all(batch.map(folder => getMetadataInFolder(folder)));
        }
      }
      
      await getMetadataInFolder();
      return metadataFiles;
    }
    
    const metadataFiles = await getAllMetadataFiles();
    const stageTime2 = new Date().getTime();
    console.log(`[SEARCH_MULTIPLE_TAGS_DATE] Encontrados ${metadataFiles.length} archivos .metadata en ${stageTime2 - stageTime1}ms`);
    
    // Función para validar fechas
    function isDateMatch(fileDate, searchDate, searchType) {
      if (!fileDate) return false;
      
      try {
        // Manejar diferentes formatos de fecha posibles
        let fileYear, fileMonth, fileDay;
        
        // Formato YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(fileDate)) {
          [fileYear, fileMonth, fileDay] = fileDate.split('-').map(n => parseInt(n, 10));
        }
        // Formato DD-MM-YYYY
        else if (/^\d{2}-\d{2}-\d{4}$/.test(fileDate)) {
          const parts = fileDate.split('-');
          fileDay = parseInt(parts[0], 10);
          fileMonth = parseInt(parts[1], 10);
          fileYear = parseInt(parts[2], 10);
        }
        // Formato DD/MM/YYYY
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(fileDate)) {
          const parts = fileDate.split('/');
          fileDay = parseInt(parts[0], 10);
          fileMonth = parseInt(parts[1], 10);
          fileYear = parseInt(parts[2], 10);
        }
        // Si solo tenemos el año
        else if (/^\d{4}$/.test(fileDate)) {
          fileYear = parseInt(fileDate, 10);
          fileMonth = 1; // Valor predeterminado
          fileDay = 1; // Valor predeterminado
        }
        // Si no coincide con ningún formato conocido
        else {
          console.log(`[DEBUG] Formato de fecha no reconocido: ${fileDate}`);
          return false;
        }
        
        console.log(`[DEBUG] Fecha del archivo: Año=${fileYear}, Mes=${fileMonth}, Día=${fileDay}`);
        console.log(`[DEBUG] Fecha de búsqueda: ${searchDate}, Tipo: ${searchType}`);
        
        // Lógica de coincidencia según el tipo de búsqueda
        if (searchType === 'specific') {
          // Para búsqueda de fecha específica, formato esperado: YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(searchDate)) {
            return false;
          }
          const [searchYear, searchMonth, searchDay] = searchDate.split('-').map(n => parseInt(n, 10));
          return fileYear === searchYear && fileMonth === searchMonth && fileDay === searchDay;
        } 
        else if (searchType === 'month') {
          // Para búsqueda por mes, formatos esperados: YYYY-MM o solo MM
          let searchYear, searchMonth;
          
          if (searchDate.includes('-')) {
            // Formato YYYY-MM
            [searchYear, searchMonth] = searchDate.split('-').map(n => parseInt(n, 10));
          } else {
            // Solo MM, usar año actual
            searchMonth = parseInt(searchDate, 10);
            searchYear = new Date().getFullYear();
          }
          
          return fileYear === searchYear && fileMonth === searchMonth;
        } 
        else if (searchType === 'year') {
          // Para búsqueda por año, formato esperado: YYYY
          const searchYear = parseInt(searchDate, 10);
          return fileYear === searchYear;
        }
        
        return false;
      } catch (error) {
        console.error('Error al comparar fechas:', error);
        return false;
      }
    }
    
    // Procesar los archivos .metadata en lotes
    const batchSize = 20;
    for (let i = 0; i < metadataFiles.length; i += batchSize) {
      const batch = metadataFiles.slice(i, i + batchSize);
      
      // Procesar lotes en paralelo para mayor velocidad
      await Promise.all(batch.map(async (metadataPath) => {
        try {
          // Obtener el archivo original al que pertenece este metadata
          const originalFilePath = metadataPath.slice(0, -9); // Quitar '.metadata'
          
          // Verificar si ya hemos procesado este archivo
          if (processedFiles.has(originalFilePath)) {
            return;
          }
          processedFiles.add(originalFilePath);
          
          // Descargar y procesar el archivo de metadatos
          const { data, error } = await supabase.storage
            .from(bucketToUse)
            .download(metadataPath);
          
          if (error) {
            console.error(`Error al descargar metadatos de ${metadataPath}:`, error);
            return;
          }
          
          // Parsear los metadatos
          const text = await data.text();
          const metadata = JSON.parse(text);
          
          // DIAGNÓSTICO: Imprimir estructura completa de metadatos para entender cómo están almacenadas las etiquetas
          if (useIds && tagsToSearch.includes('33f70b8f-c9dd-4403-85af-217bba69c104')) { // Solo para la etiqueta problemática
            console.log('\n[DIAGNÓSTICO-TAGS] ==========================================');
            console.log(`[DIAGNÓSTICO-TAGS] Archivo: ${originalFilePath}`);
            console.log('[DIAGNÓSTICO-TAGS] Estructura completa de metadatos:');
            console.log(JSON.stringify(metadata, null, 2));
            
            // Verificar si tiene etiquetas y en qué formato
            if (metadata.tags) {
              console.log('[DIAGNÓSTICO-TAGS] Estructura de etiquetas:');
              console.log(JSON.stringify(metadata.tags, null, 2));
            }
            
            // Verificar si hay propiedades similares que podrían contener los IDs
            const potentialTagProperties = [
              'tagIds', 'tag_ids', 'tagID', 'tagid', 'tag_id', 'tagIDs', 
              'documentTags', 'doc_tags', 'fileTagIds'
            ];
            
            for (const prop of potentialTagProperties) {
              if (metadata[prop]) {
                console.log(`[DIAGNÓSTICO-TAGS] Propiedad encontrada: ${prop}`);
                console.log(JSON.stringify(metadata[prop], null, 2));
              }
            }
            
            console.log('[DIAGNÓSTICO-TAGS] ==========================================\n');
          }
          
          // MEJORA: Verificación de etiquetas usando nombres
          let hasMatchingTags = false;
          let matchingTagsCount = 0;
          
          if (metadata && metadata.tags && Array.isArray(metadata.tags)) {
            // Convertir etiquetas del archivo a minúsculas para comparación
            const fileTags = metadata.tags.map(tag => 
              typeof tag === 'string' ? tag.toLowerCase() : 
              (tag && tag.name ? tag.name.toLowerCase() : '')
            );
            
            // ALGORITMO MEJORADO: Verificación más precisa de coincidencia de etiquetas
console.log(`[DEBUG] Etiquetas buscadas: ${tagsLower.join(', ')}`);
console.log(`[DEBUG] Etiquetas en archivo: ${fileTags.join(', ')}`);

// Comprobar coincidencia de cada etiqueta buscada con las etiquetas del archivo
let tagMatches = 0;
for (const searchTag of tagsLower) {
  // Una etiqueta coincide si al menos una etiqueta del archivo la contiene
  const tagFound = fileTags.some(fileTag => 
    fileTag.includes(searchTag) || searchTag.includes(fileTag)
  );
  
  if (tagFound) {
    tagMatches++;
  }
}

matchingTagsCount = tagMatches;

// Determinar si hay coincidencia según el modo de búsqueda
if (requireAllTags) {
  // Modo estricto: TODAS las etiquetas deben estar presentes
  hasMatchingTags = (tagMatches === tagsLower.length);
} else {
  // Modo flexible: AL MENOS UNA etiqueta debe estar presente
  hasMatchingTags = (tagMatches > 0);
}

console.log(`[DEBUG] ¿Coincide? ${hasMatchingTags} (${tagMatches}/${tagsLower.length} etiquetas)`);
            
            // Registrar datos de depuración
            console.log(`[DEBUG] Archivo: ${originalFilePath}`);
            console.log(`[DEBUG] Etiquetas buscadas: ${tagsLower.join(', ')}`);
            console.log(`[DEBUG] Etiquetas en archivo: ${fileTags.join(', ')}`);
            console.log(`[DEBUG] ¿Coincide? ${hasMatchingTags} (${matchingTagsCount}/${tagsLower.length} etiquetas)`);
          }
          
          // Verificación de fecha
          const hasMatchingDate = metadata.fileDate && 
            isDateMatch(metadata.fileDate, dateValue, dateType);
          
          // Solo incluir si coincide con las etiquetas (según el modo) Y con el criterio de fecha
          if (hasMatchingTags && hasMatchingDate) {
            // Obtener información básica del archivo
            const fileNameParts = originalFilePath.split('/');
            const fileName = fileNameParts[fileNameParts.length - 1];
            
            // Obtener metadatos actualizados del archivo
            const { data: fileData } = await supabase.storage
              .from(bucketToUse)
              .list(originalFilePath.substring(0, originalFilePath.lastIndexOf('/')), {
                search: fileName
              });
            
            const fileInfo = fileData && fileData[0];
            
            // Añadir información sobre la relevancia del resultado (número de etiquetas coincidentes)
            searchResults.push({
              name: fileName,
              path: `/${originalFilePath}`,
              size: (fileInfo && fileInfo.metadata && fileInfo.metadata.size) || 0,
              contentType: (fileInfo && fileInfo.metadata && fileInfo.metadata.mimetype) || 'application/octet-stream',
              updated: (fileInfo && fileInfo.updated_at) || new Date().toISOString(),
              isFolder: false,
              metadata: metadata, // Incluir metadatos para mostrar información en resultados
              matchScore: matchingTagsCount // Añadir puntuación de relevancia
            });
          }
        } catch (error) {
          console.error(`Error al procesar ${metadataPath}:`, error);
        }
      }));
    }
    
    // Ordenar resultados por relevancia (número de etiquetas coincidentes) de mayor a menor
    searchResults.sort((a, b) => b.matchScore - a.matchScore);
    
    const endTime = new Date().getTime();
    console.log(`[SEARCH_MULTIPLE_TAGS_DATE] Se encontraron ${searchResults.length} resultados con etiquetas: "${tagNamesForSearch.join(', ')}" y fecha: "${dateValue}" en bucket ${bucketToUse}`);
    console.log(`[SEARCH_MULTIPLE_TAGS_DATE] Tiempo total de búsqueda: ${endTime - startTime}ms`);
    
    return res.json(searchResults);
  } catch (error) {
    const endTime = new Date().getTime();
    console.error('Error en la búsqueda combinada de múltiples etiquetas y fecha:', error);
    console.error(`[SEARCH_MULTIPLE_TAGS_DATE] Error tras ${endTime - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al realizar la búsqueda combinada de múltiples etiquetas y fecha',
      error: error.message
    });
  }
});

// Endpoint para búsqueda combinada de texto y etiquetas
app.get('/api/search-text-with-tags', async (req, res) => {
  const startTime = new Date().getTime();
  console.log(`[SEARCH_TEXT_TAGS] Inicio búsqueda combinada texto y etiquetas: ${startTime}`);
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[SEARCH_TEXT_TAGS] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.type === 'dynamic' && tokenData.bucket) {
          // Usuario dinámico
          console.log(`[SEARCH_TEXT_TAGS] Usuario dinámico ${tokenData.username} usando bucket ${tokenData.bucket} desde token`);
          bucketToUse = tokenData.bucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = 'user';
          req.userType = 'dynamic';
          req.userFolders = tokenData.folders || [];
        }
        else if (tokenData.username && userBucketMap[tokenData.username]) {
          // Para usuarios estáticos
          const tokenBucket = userBucketMap[tokenData.username];
          console.log(`[SEARCH_TEXT_TAGS] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token en parámetros`);
          bucketToUse = tokenBucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = userRoleMap[tokenData.username] || 'user';
        }
      } catch (tokenError) {
        console.error('[SEARCH_TEXT_TAGS] Error al decodificar token de parámetros:', tokenError);
      }
    }

    // Obtener los parámetros de búsqueda - texto y etiquetas
    const searchText = req.query.text;
    const tags = req.query.tags;
    const useIds = req.query.useIds === 'true';
    // Opción para elegir si se requiere coincidencia exacta de todas las etiquetas (por defecto: false)
    const requireAllTags = req.query.requireAllTags !== 'false';
    
    if (!searchText || !tags) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren tanto texto como etiquetas para la búsqueda combinada'
      });
    }

    // Variables para almacenar tanto IDs como nombres de etiquetas para la búsqueda
    let tagNamesForSearch = [];
    let tagsToSearch = [];

    // Convertir el parámetro de tags a un array
    const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    if (tagArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos una etiqueta válida para la búsqueda'
      });
    }
    
    // Limitar a 4 etiquetas máximo
    tagsToSearch = tagArray.slice(0, 4);
    
    // Si useIds es true, convertir IDs de etiquetas a nombres para la búsqueda
    if (useIds) {
      console.log(`[SEARCH_TEXT_TAGS] Usando búsqueda por IDs, obteniendo nombres correspondientes...`);
      try {
        // Obtener los nombres de etiquetas correspondientes a los IDs
        const { data: tagData, error: tagError } = await supabase
          .from('tags_by_bucket')
          .select('id, tag_name')
          .eq('bucket', bucketToUse)
          .in('id', tagsToSearch);
        
        if (tagError) {
          console.error('Error al obtener nombres de etiquetas:', tagError);
          return res.status(500).json({
            success: false,
            message: 'Error al convertir IDs de etiquetas a nombres',
            error: tagError.message
          });
        }
        
        if (tagData && tagData.length > 0) {
          // Guardar tanto los IDs como los nombres para referencia
          const tagIdsToNames = {};
          tagData.forEach(tag => {
            tagIdsToNames[tag.id] = tag.tag_name;
          });
          
          // Extraer solo los nombres para la búsqueda
          tagNamesForSearch = tagData.map(tag => tag.tag_name);
          
          console.log(`[SEARCH_TEXT_TAGS] IDs de etiquetas mapeados a nombres:`, JSON.stringify(tagIdsToNames));
          console.log(`[SEARCH_TEXT_TAGS] Nombres de etiquetas para búsqueda:`, tagNamesForSearch.join(', '));
        } else {
          console.log(`[SEARCH_TEXT_TAGS] No se encontraron etiquetas con los IDs proporcionados`);
          // Si no se encuentran etiquetas con esos IDs, no habrá resultados
          return res.json([]);
        }
      } catch (error) {
        console.error('Error general al obtener nombres de etiquetas:', error);
        return res.status(500).json({
          success: false,
          message: 'Error interno al procesar etiquetas',
          error: error.message
        });
      }
    } else {
      // Si no se usan IDs, los nombres para búsqueda son los mismos que los tags originales
      tagNamesForSearch = tagsToSearch;
    }
    
    // Convertir nombres de etiquetas a minúsculas para búsqueda insensible a mayúsculas/minúsculas
    const tagsLower = tagNamesForSearch.map(tag => tag.toLowerCase());
    const searchTextLower = searchText.toLowerCase();
    
    console.log(`Buscando archivos con texto: "${searchText}" y etiquetas: "${tagNamesForSearch.join(', ')}" en bucket ${bucketToUse}`);
    console.log(`Modo de coincidencia: ${requireAllTags ? 'TODAS las etiquetas requeridas' : 'AL MENOS UNA etiqueta requerida'}`);
    
    // Resultados de la búsqueda
    const searchResults = [];
    const processedFiles = new Set(); // Para evitar procesar el mismo archivo dos veces
    const processedPaths = new Set(); // Para rastrear rutas ya procesadas

    // Optimización: obtener todos los archivos metadata de una vez
    console.log(`[SEARCH_TEXT_TAGS] Listando archivos *.metadata en bucket ${bucketToUse}`);
    const stageTime1 = new Date().getTime();
    console.log(`[SEARCH_TEXT_TAGS] Etapa inicial - Tiempo transcurrido: ${stageTime1 - startTime}ms`);

    // Función para obtener todos los archivos .metadata
    async function getAllMetadataFiles() {
      const metadataFiles = [];
      
      // Función para obtener archivos .metadata en una carpeta
      async function getMetadataInFolder(prefix = '') {
        const { data, error } = await supabase.storage
          .from(bucketToUse)
          .list(prefix, {
            sortBy: { column: 'name', order: 'asc' }
          });
        
        if (error) {
          console.error(`Error al listar ${prefix}:`, error);
          return;
        }
        
        const folders = [];
        
        for (const item of data) {
          // Si es una carpeta, guardarla para procesarla después
          if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
            const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (!processedPaths.has(folderPath)) {
              processedPaths.add(folderPath);
              folders.push(folderPath);
            }
            continue;
          }
          
          // Solo nos interesan los archivos .metadata (pero no los especiales)
          if (item.name.endsWith('.metadata') && 
              !item.name.endsWith('.youtube.metadata') && 
              !item.name.endsWith('.audio.metadata') && 
              !item.name.endsWith('.image.metadata')) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            metadataFiles.push(itemPath);
          }
        }
        
        // Procesar subcarpetas (pero en lotes para no bloquear demasiado)
        const batchSize = 10;
        for (let i = 0; i < folders.length; i += batchSize) {
          const batch = folders.slice(i, i + batchSize);
          await Promise.all(batch.map(folder => getMetadataInFolder(folder)));
        }
      }
      
      await getMetadataInFolder();
      return metadataFiles;
    }
    
    const metadataFiles = await getAllMetadataFiles();
    const stageTime2 = new Date().getTime();
    console.log(`[SEARCH_TEXT_TAGS] Encontrados ${metadataFiles.length} archivos .metadata en ${stageTime2 - stageTime1}ms`);
    
    // Procesar los archivos .metadata en lotes
    const batchSize = 20;
    for (let i = 0; i < metadataFiles.length; i += batchSize) {
      const batch = metadataFiles.slice(i, i + batchSize);
      
      // Procesar lotes en paralelo para mayor velocidad
      await Promise.all(batch.map(async (metadataPath) => {
        try {
          // Obtener el archivo original al que pertenece este metadata
          const originalFilePath = metadataPath.slice(0, -9); // Quitar '.metadata'
          
          // Verificar si ya hemos procesado este archivo
          if (processedFiles.has(originalFilePath)) {
            return;
          }
          processedFiles.add(originalFilePath);
          
          // Descargar y procesar el archivo de metadatos
          const { data, error } = await supabase.storage
            .from(bucketToUse)
            .download(metadataPath);
          
          if (error) {
            console.error(`Error al descargar metadatos de ${metadataPath}:`, error);
            return;
          }
          
          // Parsear los metadatos
          const text = await data.text();
          const metadata = JSON.parse(text);
          
          // Verificación de coincidencia de texto en el nombre del archivo
          const fileName = originalFilePath.split('/').pop().toLowerCase();
          const hasTextMatch = fileName.includes(searchTextLower);
          
          if (!hasTextMatch) {
            return; // Si no hay coincidencia de texto, no seguimos procesando este archivo
          }
          
          // Verificación de etiquetas
          let hasMatchingTags = false;
          let matchingTagsCount = 0;
          
          if (metadata && metadata.tags && Array.isArray(metadata.tags)) {
            // Convertir etiquetas del archivo a minúsculas para comparación
            const fileTags = metadata.tags.map(tag => 
              typeof tag === 'string' ? tag.toLowerCase() : 
              (tag && tag.name ? tag.name.toLowerCase() : '')
            );
            
            // ALGORITMO MEJORADO: Verificación más precisa de coincidencia de etiquetas
console.log(`[DEBUG] Etiquetas buscadas: ${tagsLower.join(', ')}`);
console.log(`[DEBUG] Etiquetas en archivo: ${fileTags.join(', ')}`);

// Comprobar coincidencia de cada etiqueta buscada con las etiquetas del archivo
let tagMatches = 0;
for (const searchTag of tagsLower) {
  // Una etiqueta coincide si al menos una etiqueta del archivo la contiene
  const tagFound = fileTags.some(fileTag =>
    fileTag.includes(searchTag) || searchTag.includes(fileTag)
  );
  
  if (tagFound) {
    tagMatches++;
  }
}

matchingTagsCount = tagMatches;

// Determinar si hay coincidencia según el modo de búsqueda
if (requireAllTags) {
  // Modo estricto: TODAS las etiquetas deben estar presentes
  hasMatchingTags = (tagMatches === tagsLower.length);
} else {
  // Modo flexible: AL MENOS UNA etiqueta debe estar presente
  hasMatchingTags = (tagMatches > 0);
}

console.log(`[DEBUG] ¿Coincide? ${hasMatchingTags} (${tagMatches}/${tagsLower.length} etiquetas)`);
            
            // Registrar datos de depuración
            console.log(`[DEBUG] Archivo: ${originalFilePath}`);
            console.log(`[DEBUG] Coincidencia de texto: ${hasTextMatch ? 'Sí' : 'No'}`);
            console.log(`[DEBUG] Etiquetas buscadas: ${tagsLower.join(', ')}`);
            console.log(`[DEBUG] Etiquetas en archivo: ${fileTags.join(', ')}`);
            console.log(`[DEBUG] ¿Coincide etiquetas? ${hasMatchingTags} (${matchingTagsCount}/${tagsLower.length} etiquetas)`);
          }
          
          // Solo incluir si coincide tanto con el texto como con las etiquetas (según el modo)
          if (hasTextMatch && hasMatchingTags) {
            // Obtener información básica del archivo
            const fileNameParts = originalFilePath.split('/');
            const fileName = fileNameParts[fileNameParts.length - 1];
            
            // Obtener metadatos actualizados del archivo
            const { data: fileData } = await supabase.storage
              .from(bucketToUse)
              .list(originalFilePath.substring(0, originalFilePath.lastIndexOf('/')), {
                search: fileName
              });
            
            const fileInfo = fileData && fileData[0];
            
            // Añadir información sobre la relevancia del resultado (número de etiquetas coincidentes)
            searchResults.push({
              name: fileName,
              path: `/${originalFilePath}`,
              size: (fileInfo && fileInfo.metadata && fileInfo.metadata.size) || 0,
              contentType: (fileInfo && fileInfo.metadata && fileInfo.metadata.mimetype) || 'application/octet-stream',
              updated: (fileInfo && fileInfo.updated_at) || new Date().toISOString(),
              isFolder: false,
              metadata: metadata, // Incluir metadatos para mostrar información en resultados
              matchScore: matchingTagsCount // Añadir puntuación de relevancia
            });
          }
        } catch (error) {
          console.error(`Error al procesar ${metadataPath}:`, error);
        }
      }));
    }
    
    // Ordenar resultados por relevancia (número de etiquetas coincidentes) de mayor a menor
    searchResults.sort((a, b) => b.matchScore - a.matchScore);
    
    const endTime = new Date().getTime();
    console.log(`[SEARCH_TEXT_TAGS] Se encontraron ${searchResults.length} resultados con texto: "${searchText}" y etiquetas: "${tagNamesForSearch.join(', ')}" en bucket ${bucketToUse}`);
    console.log(`[SEARCH_TEXT_TAGS] Tiempo total de búsqueda: ${endTime - startTime}ms`);
    
    return res.json(searchResults);
  } catch (error) {
    const endTime = new Date().getTime();
    console.error('Error en la búsqueda combinada de texto y etiquetas:', error);
    console.error(`[SEARCH_TEXT_TAGS] Error tras ${endTime - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al realizar la búsqueda combinada de texto y etiquetas',
      error: error.message
    });
  }
});

// Endpoint para búsqueda combinada de texto y fecha
app.get('/api/search-text-with-date', async (req, res) => {
  const startTime = new Date().getTime();
  console.log(`[SEARCH_TEXT_DATE] Inicio búsqueda de texto con fecha: ${startTime}`);
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
if (req.query.token) {
  try {
    const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
    console.log(`[SEARCH_TEXT_DATE] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
    
    if (tokenData.type === 'dynamic' && tokenData.bucket) {
      // Usuario dinámico
      console.log(`[SEARCH_TEXT_DATE] Usuario dinámico ${tokenData.username} usando bucket ${tokenData.bucket} desde token`);
      bucketToUse = tokenData.bucket;
      
      // Actualizar también req.username y req.userRole para las validaciones posteriores
      req.username = tokenData.username;
      req.userRole = 'user';
      req.userType = 'dynamic';
      req.userFolders = tokenData.folders || [];
    }
    else if (tokenData.username && userBucketMap[tokenData.username]) {
      // Para usuarios estáticos
      const tokenBucket = userBucketMap[tokenData.username];
      console.log(`[SEARCH_TEXT_DATE] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token en parámetros`);
      bucketToUse = tokenBucket;
      
      // Actualizar también req.username y req.userRole para las validaciones posteriores
      req.username = tokenData.username;
      req.userRole = userRoleMap[tokenData.username] || 'user';
    }
      } catch (tokenError) {
        console.error('[SEARCH_TEXT_DATE] Error al decodificar token de parámetros:', tokenError);
      }
    }

    // Obtener los parámetros de búsqueda
    const searchText = req.query.text;
    const dateValue = req.query.date;
    const dateType = req.query.dateType || 'specific'; // specific, month, year
    
    if (!searchText || !dateValue) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren tanto un texto como una fecha para la búsqueda combinada'
      });
    }

    console.log(`Buscando archivos con texto: "${searchText}" y fecha: "${dateValue}" (tipo: ${dateType}) en bucket ${bucketToUse}`);
    const searchTextLower = searchText.toLowerCase();
    
    // Resultados de la búsqueda
    const searchResults = [];
    const processedFiles = new Set(); // Para evitar procesar el mismo archivo dos veces
    const processedPaths = new Set(); // Para rastrear rutas ya procesadas

    // Optimización: obtener todos los archivos metadata de una vez
    console.log(`[SEARCH_TEXT_DATE] Listando archivos *.metadata en bucket ${bucketToUse}`);
    const stageTime1 = new Date().getTime();
    console.log(`[SEARCH_TEXT_DATE] Etapa inicial - Tiempo transcurrido: ${stageTime1 - startTime}ms`);

    // Función para obtener todos los archivos .metadata
    async function getAllMetadataFiles() {
      const metadataFiles = [];
      
      // Función para obtener archivos .metadata en una carpeta
      async function getMetadataInFolder(prefix = '') {
        const { data, error } = await supabase.storage
          .from(bucketToUse)
          .list(prefix, {
            sortBy: { column: 'name', order: 'asc' }
          });
        
        if (error) {
          console.error(`Error al listar ${prefix}:`, error);
          return;
        }
        
        const folders = [];
        
        for (const item of data) {
          // Si es una carpeta, guardarla para procesarla después
          if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
            const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (!processedPaths.has(folderPath)) {
              processedPaths.add(folderPath);
              folders.push(folderPath);
            }
            continue;
          }
          
          // Solo nos interesan los archivos .metadata (pero no los especiales)
          if (item.name.endsWith('.metadata') && 
              !item.name.endsWith('.youtube.metadata') && 
              !item.name.endsWith('.audio.metadata') && 
              !item.name.endsWith('.image.metadata')) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            metadataFiles.push(itemPath);
          }
        }
        
        // Procesar subcarpetas (pero en lotes para no bloquear demasiado)
        const batchSize = 10;
        for (let i = 0; i < folders.length; i += batchSize) {
          const batch = folders.slice(i, i + batchSize);
          await Promise.all(batch.map(folder => getMetadataInFolder(folder)));
        }
      }
      
      await getMetadataInFolder();
      return metadataFiles;
    }
    
    const metadataFiles = await getAllMetadataFiles();
    const stageTime2 = new Date().getTime();
    console.log(`[SEARCH_TEXT_DATE] Encontrados ${metadataFiles.length} archivos .metadata en ${stageTime2 - stageTime1}ms`);
    
    // Función para validar fechas
    function isDateMatch(fileDate, searchDate, searchType) {
      if (!fileDate) return false;
      
      try {
        // Asegurarse de que fileDate tiene el formato adecuado (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fileDate)) {
          return false;
        }
        
        // Extraer componentes de la fecha del archivo
        const [fileYear, fileMonth, fileDay] = fileDate.split('-').map(n => parseInt(n, 10));
        
        if (searchType === 'specific') {
          // Para búsqueda de fecha específica, formato esperado: YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(searchDate)) {
            return false;
          }
          const [searchYear, searchMonth, searchDay] = searchDate.split('-').map(n => parseInt(n, 10));
          return fileYear === searchYear && fileMonth === searchMonth && fileDay === searchDay;
        } 
        else if (searchType === 'month') {
          // Para búsqueda por mes, formatos esperados: YYYY-MM o solo MM
          let searchYear, searchMonth;
          
          if (searchDate.includes('-')) {
            // Formato YYYY-MM
            [searchYear, searchMonth] = searchDate.split('-').map(n => parseInt(n, 10));
          } else {
            // Solo MM, usar año actual
            searchMonth = parseInt(searchDate, 10);
            searchYear = new Date().getFullYear();
          }
          
          return fileYear === searchYear && fileMonth === searchMonth;
        } 
        else if (searchType === 'year') {
          // Para búsqueda por año, formato esperado: YYYY
          const searchYear = parseInt(searchDate, 10);
          return fileYear === searchYear;
        }
        
        return false;
      } catch (error) {
        console.error('Error al comparar fechas:', error);
        return false;
      }
    }
    
    // Procesar los archivos .metadata en lotes
    const batchSize = 20;
    for (let i = 0; i < metadataFiles.length; i += batchSize) {
      const batch = metadataFiles.slice(i, i + batchSize);
      
      // Procesar lotes en paralelo para mayor velocidad
      await Promise.all(batch.map(async (metadataPath) => {
        try {
          // Obtener el archivo original al que pertenece este metadata
          const originalFilePath = metadataPath.slice(0, -9); // Quitar '.metadata'
          
          // Verificar si ya hemos procesado este archivo
          if (processedFiles.has(originalFilePath)) {
            return;
          }
          processedFiles.add(originalFilePath);
          
          // Descargar y procesar el archivo de metadatos
          const { data, error } = await supabase.storage
            .from(bucketToUse)
            .download(metadataPath);
          
          if (error) {
            console.error(`Error al descargar metadatos de ${metadataPath}:`, error);
            return;
          }
          
          // Parsear los metadatos
          const text = await data.text();
          const metadata = JSON.parse(text);
          
          // Extraer información del archivo para la búsqueda de texto
          const fileName = originalFilePath.split('/').pop().toLowerCase();
          
          // Verificar si el nombre del archivo contiene el texto buscado
          const hasMatchingText = fileName.includes(searchTextLower);
          
          // Verificar si cumple con el criterio de fecha
          const hasMatchingDate = metadata.fileDate && 
            isDateMatch(metadata.fileDate, dateValue, dateType);
          
          // Solo incluir si coincide con ambos criterios: texto y fecha
          if (hasMatchingText && hasMatchingDate) {
            // Obtener información básica del archivo
            const fileNameParts = originalFilePath.split('/');
            const fileName = fileNameParts[fileNameParts.length - 1];
            
            // Obtener metadatos actualizados del archivo
            const folderPath = originalFilePath.substring(0, originalFilePath.lastIndexOf('/') || 0);
            const { data: fileData } = await supabase.storage
              .from(bucketToUse)
              .list(folderPath, {
                search: fileName
              });
            
            const fileInfo = fileData && fileData[0];
            
            searchResults.push({
              name: fileName,
              path: `/${originalFilePath}`,
              size: (fileInfo && fileInfo.metadata && fileInfo.metadata.size) || 0,
              contentType: (fileInfo && fileInfo.metadata && fileInfo.metadata.mimetype) || 'application/octet-stream',
              updated: (fileInfo && fileInfo.updated_at) || new Date().toISOString(),
              isFolder: false,
              metadata: metadata // Incluir metadatos para mostrar información en resultados
            });
          }
        } catch (error) {
          console.error(`Error al procesar ${metadataPath}:`, error);
        }
      }));
    }
    
    const endTime = new Date().getTime();
    console.log(`[SEARCH_TEXT_DATE] Se encontraron ${searchResults.length} resultados con texto "${searchText}" y fecha "${dateValue}" en bucket ${bucketToUse}`);
    console.log(`[SEARCH_TEXT_DATE] Tiempo total de búsqueda: ${endTime - startTime}ms`);
    
    return res.json(searchResults);
  } catch (error) {
    const endTime = new Date().getTime();
    console.error('Error en la búsqueda combinada de texto y fecha:', error);
    console.error(`[SEARCH_TEXT_DATE] Error tras ${endTime - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al realizar la búsqueda combinada de texto y fecha',
      error: error.message
    });
  }
});

// Endpoint para buscar archivos por contenido
app.get('/api/search-by-content', async (req, res) => {
  const startTime = new Date().getTime();
  console.log(`[SEARCH_CONTENT] Inicio búsqueda por contenido: ${startTime}`);
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[SEARCH_CONTENT] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.type === 'dynamic' && tokenData.bucket) {
          // Usuario dinámico
          console.log(`[SEARCH_CONTENT] Usuario dinámico ${tokenData.username} usando bucket ${tokenData.bucket} desde token`);
          bucketToUse = tokenData.bucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = 'user';
          req.userType = 'dynamic';
          req.userFolders = tokenData.folders || [];
        }
        else if (tokenData.username && userBucketMap[tokenData.username]) {
          // Para usuarios estáticos
          const tokenBucket = userBucketMap[tokenData.username];
          console.log(`[SEARCH_CONTENT] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token en parámetros`);
          bucketToUse = tokenBucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = userRoleMap[tokenData.username] || 'user';
        }
      } catch (tokenError) {
        console.error('[SEARCH_CONTENT] Error al decodificar token de parámetros:', tokenError);
      }
    }

    // Obtener el texto a buscar
    const searchText = req.query.text;
    
    if (!searchText) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere texto para la búsqueda en contenido'
      });
    }

    const searchTextLower = searchText.toLowerCase();
    console.log(`Buscando archivos con contenido: "${searchText}" en bucket ${bucketToUse}`);
    
    // Resultados de la búsqueda
    const searchResults = [];
    const processedFiles = new Set(); // Para evitar procesar el mismo archivo dos veces
    const processedPaths = new Set(); // Para rastrear rutas ya procesadas

    // Optimización: obtener todos los archivos metadata de una vez
    console.log(`[SEARCH_CONTENT] Listando archivos *.metadata en bucket ${bucketToUse}`);
    
    // Función para obtener todos los archivos .metadata
    async function getAllMetadataFiles() {
      const metadataFiles = [];
      
      // Función para obtener archivos .metadata en una carpeta
      async function getMetadataInFolder(prefix = '') {
        const { data, error } = await supabase.storage
          .from(bucketToUse)
          .list(prefix, {
            sortBy: { column: 'name', order: 'asc' }
          });
        
        if (error) {
          console.error(`Error al listar ${prefix}:`, error);
          return;
        }
        
        const folders = [];
        
        for (const item of data) {
          // Si es una carpeta, guardarla para procesarla después
          if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
            const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (!processedPaths.has(folderPath)) {
              processedPaths.add(folderPath);
              folders.push(folderPath);
            }
            continue;
          }
          
          // Solo nos interesan los archivos .metadata (pero no los especiales)
          if (item.name.endsWith('.metadata') && 
              !item.name.endsWith('.youtube.metadata') && 
              !item.name.endsWith('.audio.metadata') && 
              !item.name.endsWith('.image.metadata')) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            metadataFiles.push(itemPath);
          }
        }
        
        // Procesar subcarpetas (pero en lotes para no bloquear demasiado)
        const batchSize = 10;
        for (let i = 0; i < folders.length; i += batchSize) {
          const batch = folders.slice(i, i + batchSize);
          await Promise.all(batch.map(folder => getMetadataInFolder(folder)));
        }
      }
      
      await getMetadataInFolder();
      return metadataFiles;
    }
    
    const metadataFiles = await getAllMetadataFiles();
    console.log(`[SEARCH_CONTENT] Encontrados ${metadataFiles.length} archivos .metadata para buscar`);
    
    // Procesar los archivos .metadata en lotes
    const batchSize = 20;
    for (let i = 0; i < metadataFiles.length; i += batchSize) {
      const batch = metadataFiles.slice(i, i + batchSize);
      
      // Procesar lotes en paralelo para mayor velocidad
      await Promise.all(batch.map(async (metadataPath) => {
        try {
          // Obtener el archivo original al que pertenece este metadata
          const originalFilePath = metadataPath.slice(0, -9); // Quitar '.metadata'
          
          // Verificar si ya hemos procesado este archivo
          if (processedFiles.has(originalFilePath)) {
            return;
          }
          processedFiles.add(originalFilePath);
          
          // Descargar y procesar el archivo de metadatos
          const { data, error } = await supabase.storage
            .from(bucketToUse)
            .download(metadataPath);
          
          if (error) {
            console.error(`Error al descargar metadatos de ${metadataPath}:`, error);
            return;
          }
          
          // Parsear los metadatos
          const text = await data.text();
          const metadata = JSON.parse(text);
          
          // Verificar si hay contenido extraído en los metadatos
          if (metadata && metadata.fileContent && typeof metadata.fileContent === 'string') {
            const fileContent = metadata.fileContent.toLowerCase();
            
            // Verificar si el contenido del archivo contiene el texto buscado
            if (fileContent.includes(searchTextLower)) {
              // Obtener información básica del archivo
              const fileNameParts = originalFilePath.split('/');
              const fileName = fileNameParts[fileNameParts.length - 1];
              
              // Obtener metadatos actualizados del archivo
              const folderPath = originalFilePath.substring(0, originalFilePath.lastIndexOf('/') || 0);
              const { data: fileData } = await supabase.storage
                .from(bucketToUse)
                .list(folderPath, {
                  search: fileName
                });
              
              const fileInfo = fileData && fileData[0];
              
              searchResults.push({
                name: fileName,
                path: `/${originalFilePath}`,
                size: (fileInfo && fileInfo.metadata && fileInfo.metadata.size) || 0,
                contentType: (fileInfo && fileInfo.metadata && fileInfo.metadata.mimetype) || 'application/octet-stream',
                updated: (fileInfo && fileInfo.updated_at) || new Date().toISOString(),
                isFolder: false,
                metadata: {
                  ...metadata,
                  fileContent: undefined // No devolver el contenido completo en la respuesta
                }
              });
            }
          }
        } catch (error) {
          console.error(`Error al procesar ${metadataPath}:`, error);
        }
      }));
    }
    
    const endTime = new Date().getTime();
    console.log(`[SEARCH_CONTENT] Se encontraron ${searchResults.length} resultados con contenido "${searchText}" en bucket ${bucketToUse}`);
    console.log(`[SEARCH_CONTENT] Tiempo total de búsqueda: ${endTime - startTime}ms`);
    
    return res.json(searchResults);
  } catch (error) {
    const endTime = new Date().getTime();
    console.error('Error en la búsqueda por contenido:', error);
    console.error(`[SEARCH_CONTENT] Error tras ${endTime - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al realizar la búsqueda por contenido',
      error: error.message
    });
  }
});

// Endpoint para buscar archivos por tamaño
app.get('/api/search-by-size', async (req, res) => {
  try {
    console.log('Recibida solicitud de búsqueda por tamaño');
    
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener parámetros de tamaño
    const minSize = req.query.minSize ? parseInt(req.query.minSize) : null;
    const maxSize = req.query.maxSize ? parseInt(req.query.maxSize) : null;
    
    console.log(`Parámetros de búsqueda: minSize=${minSize || 'sin límite'}, maxSize=${maxSize || 'sin límite'}`);
    
    // Verificar que al menos uno de los parámetros esté definido
    if (minSize === null && maxSize === null) {
      return res.status(400).json({ message: 'Se requiere al menos un parámetro de tamaño (minSize o maxSize)' });
    }
    
    // Obtener el bucket del usuario desde el middleware
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[SEARCH_BY_SIZE] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.type === 'dynamic' && tokenData.bucket) {
          // Usuario dinámico
          console.log(`[SEARCH_BY_SIZE] Usuario dinámico ${tokenData.username} usando bucket ${tokenData.bucket} desde token`);
          bucketToUse = tokenData.bucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = 'user';
          req.userType = 'dynamic';
          req.userFolders = tokenData.folders || [];
        }
        else if (tokenData.username && userBucketMap[tokenData.username]) {
          // Para usuarios estáticos
          const tokenBucket = userBucketMap[tokenData.username];
          console.log(`[SEARCH_BY_SIZE] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token en parámetros`);
          bucketToUse = tokenBucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = userRoleMap[tokenData.username] || 'user';
        }
      } catch (tokenError) {
        console.error('[SEARCH_BY_SIZE] Error al decodificar token de parámetros:', tokenError);
      }
    }
    
    console.log(`Buscando en el bucket: ${bucketToUse}`);
    
    // Función para obtener todos los archivos recursivamente
    const processedPaths = new Set();
    const filesToCheck = [];
    
    // Función auxiliar para obtener archivos en una carpeta
    async function getFilesInFolder(prefix = '') {
      const { data, error } = await supabase.storage
        .from(bucketToUse)
        .list(prefix, {
          sortBy: { column: 'name', order: 'asc' }
        });
      
      if (error) {
        console.error(`Error al listar ${prefix}:`, error);
        return;
      }
      
      const folders = [];
      
      for (const item of data) {
        // Ignorar archivos especiales .folder y archivos de metadatos
        if (item.name === '.folder' || 
            item.name.endsWith('.metadata') ||
            item.name.endsWith('.youtube.metadata') || 
            item.name.endsWith('.audio.metadata') || 
            item.name.endsWith('.image.metadata')) {
          continue;
        }
        
        const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
        
        // Si es una carpeta, procesarla después
        if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
          const folderPath = itemPath;
          if (!processedPaths.has(folderPath)) {
            processedPaths.add(folderPath);
            folders.push(folderPath);
          }
        } else {
          // Si es un archivo, añadirlo directamente a la lista
          const fileSize = (item.metadata && item.metadata.size) || 0;
          // Convertir bytes a KB
          const fileSizeKB = Math.ceil(fileSize / 1024);
          
          // Filtrar por tamaño en KB
          const passesMinSize = minSize === null || fileSizeKB >= minSize;
          const passesMaxSize = maxSize === null || fileSizeKB <= maxSize;
          
          if (passesMinSize && passesMaxSize) {
            filesToCheck.push({
              name: item.name,
              path: `/${itemPath}`,
              size: fileSize,
              sizeKB: fileSizeKB,
              contentType: (item.metadata && item.metadata.mimetype) || 'application/octet-stream',
              updated: item.updated_at,
              isFolder: false
            });
          }
        }
      }
      
      // Procesar subcarpetas
      for (const folder of folders) {
        await getFilesInFolder(folder);
      }
    }
    
    // Iniciar búsqueda desde la raíz
    await getFilesInFolder('');
    
    console.log(`Archivos que cumplen con el criterio de tamaño: ${filesToCheck.length}`);
    
    // Devolver resultados
    res.json(filesToCheck);
  } catch (error) {
    console.error('Error en búsqueda por tamaño:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al buscar archivos por tamaño', 
      error: error.message 
    });
  }
});

// Endpoint para búsqueda combinada de contenido y etiquetas
app.get('/api/search-content-with-tags', async (req, res) => {
  const startTime = new Date().getTime();
  console.log(`[SEARCH_CONTENT_TAGS] Inicio búsqueda combinada contenido y etiquetas: ${startTime}`);
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[SEARCH_CONTENT_TAGS] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.type === 'dynamic' && tokenData.bucket) {
          // Usuario dinámico
          console.log(`[SEARCH_CONTENT_TAGS] Usuario dinámico ${tokenData.username} usando bucket ${tokenData.bucket} desde token`);
          bucketToUse = tokenData.bucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = 'user';
          req.userType = 'dynamic';
          req.userFolders = tokenData.folders || [];
        }
        else if (tokenData.username && userBucketMap[tokenData.username]) {
          // Para usuarios estáticos
          const tokenBucket = userBucketMap[tokenData.username];
          console.log(`[SEARCH_CONTENT_TAGS] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token en parámetros`);
          bucketToUse = tokenBucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = userRoleMap[tokenData.username] || 'user';
        }
      } catch (tokenError) {
        console.error('[SEARCH_CONTENT_TAGS] Error al decodificar token de parámetros:', tokenError);
      }
    }

    // Obtener los parámetros de búsqueda - texto y etiquetas
    const searchText = req.query.text;
    const tags = req.query.tags;
    const useIds = req.query.useIds === 'true';
    // Opción para elegir si se requiere coincidencia exacta de todas las etiquetas (por defecto: false)
    const requireAllTags = req.query.requireAllTags === 'true';
    
    if (!searchText || !tags) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren tanto texto como etiquetas para la búsqueda combinada'
      });
    }

    // Variables para almacenar tanto IDs como nombres de etiquetas para la búsqueda
    let tagNamesForSearch = [];
    let tagsToSearch = [];

    // Convertir el parámetro de tags a un array
    const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    if (tagArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos una etiqueta válida para la búsqueda'
      });
    }
    
    // Limitar a 4 etiquetas máximo
    tagsToSearch = tagArray.slice(0, 4);
    
    // Si useIds es true, convertir IDs de etiquetas a nombres para la búsqueda
    if (useIds) {
      console.log(`[SEARCH_CONTENT_TAGS] Usando búsqueda por IDs, obteniendo nombres correspondientes...`);
      try {
        // Obtener los nombres de etiquetas correspondientes a los IDs
        const { data: tagData, error: tagError } = await supabase
          .from('tags_by_bucket')
          .select('id, tag_name')
          .eq('bucket', bucketToUse)
          .in('id', tagsToSearch);
        
        if (tagError) {
          console.error('Error al obtener nombres de etiquetas:', tagError);
          return res.status(500).json({
            success: false,
            message: 'Error al convertir IDs de etiquetas a nombres',
            error: tagError.message
          });
        }
        
        if (tagData && tagData.length > 0) {
          // Guardar tanto los IDs como los nombres para referencia
          const tagIdsToNames = {};
          tagData.forEach(tag => {
            tagIdsToNames[tag.id] = tag.tag_name;
          });
          
          // Extraer solo los nombres para la búsqueda
          tagNamesForSearch = tagData.map(tag => tag.tag_name);
          
          console.log(`[SEARCH_CONTENT_TAGS] IDs de etiquetas mapeados a nombres:`, JSON.stringify(tagIdsToNames));
          console.log(`[SEARCH_CONTENT_TAGS] Nombres de etiquetas para búsqueda:`, tagNamesForSearch.join(', '));
        } else {
          console.log(`[SEARCH_CONTENT_TAGS] No se encontraron etiquetas con los IDs proporcionados`);
          // Si no se encuentran etiquetas con esos IDs, no habrá resultados
          return res.json([]);
        }
      } catch (error) {
        console.error('Error general al obtener nombres de etiquetas:', error);
        return res.status(500).json({
          success: false,
          message: 'Error interno al procesar etiquetas',
          error: error.message
        });
      }
    } else {
      // Si no se usan IDs, los nombres para búsqueda son los mismos que los tags originales
      tagNamesForSearch = tagsToSearch;
    }
    
    // Convertir nombres de etiquetas a minúsculas para búsqueda insensible a mayúsculas/minúsculas
    const tagsLower = tagNamesForSearch.map(tag => tag.toLowerCase());
    const searchTextLower = searchText.toLowerCase();
    
    console.log(`Buscando archivos con contenido: "${searchText}" y etiquetas: "${tagNamesForSearch.join(', ')}" en bucket ${bucketToUse}`);
    console.log(`Modo de coincidencia: ${requireAllTags ? 'TODAS las etiquetas requeridas' : 'AL MENOS UNA etiqueta requerida'}`);
    
    // Resultados de la búsqueda
    const searchResults = [];
    const processedFiles = new Set(); // Para evitar procesar el mismo archivo dos veces
    const processedPaths = new Set(); // Para rastrear rutas ya procesadas

    // Optimización: obtener todos los archivos metadata de una vez
    console.log(`[SEARCH_CONTENT_TAGS] Listando archivos *.metadata en bucket ${bucketToUse}`);
    
    // Función para obtener todos los archivos .metadata
    async function getAllMetadataFiles() {
      const metadataFiles = [];
      
      // Función para obtener archivos .metadata en una carpeta
      async function getMetadataInFolder(prefix = '') {
        const { data, error } = await supabase.storage
          .from(bucketToUse)
          .list(prefix, {
            sortBy: { column: 'name', order: 'asc' }
          });
        
        if (error) {
          console.error(`Error al listar ${prefix}:`, error);
          return;
        }
        
        const folders = [];
        
        for (const item of data) {
          // Si es una carpeta, guardarla para procesarla después
          if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
            const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (!processedPaths.has(folderPath)) {
              processedPaths.add(folderPath);
              folders.push(folderPath);
            }
            continue;
          }
          
          // Solo nos interesan los archivos .metadata (pero no los especiales)
          if (item.name.endsWith('.metadata') && 
              !item.name.endsWith('.youtube.metadata') && 
              !item.name.endsWith('.audio.metadata') && 
              !item.name.endsWith('.image.metadata')) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            metadataFiles.push(itemPath);
          }
        }
        
        // Procesar subcarpetas (pero en lotes para no bloquear demasiado)
        const batchSize = 10;
        for (let i = 0; i < folders.length; i += batchSize) {
          const batch = folders.slice(i, i + batchSize);
          await Promise.all(batch.map(folder => getMetadataInFolder(folder)));
        }
      }
      
      await getMetadataInFolder();
      return metadataFiles;
    }
    
    const metadataFiles = await getAllMetadataFiles();
    console.log(`[SEARCH_CONTENT_TAGS] Encontrados ${metadataFiles.length} archivos .metadata para buscar`);
    
    // Procesar los archivos .metadata en lotes
    const batchSize = 20;
    for (let i = 0; i < metadataFiles.length; i += batchSize) {
      const batch = metadataFiles.slice(i, i + batchSize);
      
      // Procesar lotes en paralelo para mayor velocidad
      await Promise.all(batch.map(async (metadataPath) => {
        try {
          // Obtener el archivo original al que pertenece este metadata
          const originalFilePath = metadataPath.slice(0, -9); // Quitar '.metadata'
          
          // Verificar si ya hemos procesado este archivo
          if (processedFiles.has(originalFilePath)) {
            return;
          }
          processedFiles.add(originalFilePath);
          
          // Descargar y procesar el archivo de metadatos
          const { data, error } = await supabase.storage
            .from(bucketToUse)
            .download(metadataPath);
          
          if (error) {
            console.error(`Error al descargar metadatos de ${metadataPath}:`, error);
            return;
          }
          
          // Parsear los metadatos
          const text = await data.text();
          const metadata = JSON.parse(text);
          
          // Verificar si hay contenido extraído en los metadatos
          const hasContentMatch = metadata.fileContent && 
                                typeof metadata.fileContent === 'string' && 
                                metadata.fileContent.toLowerCase().includes(searchTextLower);
          
          if (!hasContentMatch) {
            return; // Si no coincide con el contenido, no seguir procesando este archivo
          }
          
          // Verificación de etiquetas
          let hasMatchingTags = false;
          let matchingTagsCount = 0;
          
          if (metadata && metadata.tags && Array.isArray(metadata.tags)) {
            // Convertir etiquetas del archivo a minúsculas para comparación
            const fileTags = metadata.tags.map(tag => 
              typeof tag === 'string' ? tag.toLowerCase() : 
              (tag && tag.name ? tag.name.toLowerCase() : '')
            );
            
            // Comprobar coincidencia de cada etiqueta buscada con las etiquetas del archivo
            let tagMatches = 0;
            for (const searchTag of tagsLower) {
              // Una etiqueta coincide si al menos una etiqueta del archivo la contiene
              const tagFound = fileTags.some(fileTag =>
                fileTag.includes(searchTag) || searchTag.includes(fileTag)
              );
              
              if (tagFound) {
                tagMatches++;
              }
            }
            
            matchingTagsCount = tagMatches;
            
            // Determinar si hay coincidencia según el modo de búsqueda
            if (requireAllTags) {
              // Modo estricto: TODAS las etiquetas deben estar presentes
              hasMatchingTags = (tagMatches === tagsLower.length);
            } else {
              // Modo flexible: AL MENOS UNA etiqueta debe estar presente
              hasMatchingTags = (tagMatches > 0);
            }
            
            console.log(`[DEBUG] Archivo: ${originalFilePath}`);
            console.log(`[DEBUG] Etiquetas buscadas: ${tagsLower.join(', ')}`);
            console.log(`[DEBUG] Etiquetas en archivo: ${fileTags.join(', ')}`);
            console.log(`[DEBUG] ¿Coincide etiquetas? ${hasMatchingTags} (${matchingTagsCount}/${tagsLower.length} etiquetas)`);
          }
          
          // Solo incluir si coincide tanto con el contenido como con las etiquetas (según el modo)
          if (hasContentMatch && hasMatchingTags) {
            // Obtener información básica del archivo
            const fileNameParts = originalFilePath.split('/');
            const fileName = fileNameParts[fileNameParts.length - 1];
            
            // Obtener metadatos actualizados del archivo
            const { data: fileData } = await supabase.storage
              .from(bucketToUse)
              .list(originalFilePath.substring(0, originalFilePath.lastIndexOf('/')), {
                search: fileName
              });
            
            const fileInfo = fileData && fileData[0];
            
            // Añadir información sobre la relevancia del resultado (número de etiquetas coincidentes)
            searchResults.push({
              name: fileName,
              path: `/${originalFilePath}`,
              size: (fileInfo && fileInfo.metadata && fileInfo.metadata.size) || 0,
              contentType: (fileInfo && fileInfo.metadata && fileInfo.metadata.mimetype) || 'application/octet-stream',
              updated: (fileInfo && fileInfo.updated_at) || new Date().toISOString(),
              isFolder: false,
              metadata: {
                ...metadata,
                fileContent: undefined // No devolver el contenido completo en la respuesta
              },
              matchScore: matchingTagsCount // Añadir puntuación de relevancia
            });
          }
        } catch (error) {
          console.error(`Error al procesar ${metadataPath}:`, error);
        }
      }));
    }
    
    // Ordenar resultados por relevancia (número de etiquetas coincidentes) de mayor a menor
    searchResults.sort((a, b) => b.matchScore - a.matchScore);
    
    const endTime = new Date().getTime();
    console.log(`[SEARCH_CONTENT_TAGS] Se encontraron ${searchResults.length} resultados con contenido: "${searchText}" y etiquetas: "${tagNamesForSearch.join(', ')}" en bucket ${bucketToUse}`);
    console.log(`[SEARCH_CONTENT_TAGS] Tiempo total de búsqueda: ${endTime - startTime}ms`);
    
    return res.json(searchResults);
  } catch (error) {
    const endTime = new Date().getTime();
    console.error('Error en la búsqueda combinada de contenido y etiquetas:', error);
    console.error(`[SEARCH_CONTENT_TAGS] Error tras ${endTime - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al realizar la búsqueda combinada de contenido y etiquetas',
      error: error.message
    });
  }
});

// Función para calcular el tamaño total del bucket  

async function calculateBucketSize(bucketToCheck = defaultBucketName) {
  let totalSize = 0;
  
  // Función recursiva para procesar carpetas
  async function processFolder(prefix = '') {
    // Listar elementos en la carpeta actual
    const { data, error } = await supabase.storage
      .from(bucketToCheck)
      .list(prefix);
    
    if (error) {
      console.error(`Error al listar contenido de ${prefix} en bucket ${bucketToCheck}:`, error);
      return 0;
    }
    
    if (!data || data.length === 0) {
      return 0;
    }
    
    let folderSize = 0;
    
    // Procesar cada elemento
    for (const item of data) {
      // Ignorar archivos especiales .folder y archivos de metadatos
      if (item.name === '.folder' || 
          item.name.endsWith('.youtube.metadata') || 
          item.name.endsWith('.audio.metadata') || 
          item.name.endsWith('.image.metadata')) {
        continue;
      }
      
      // Construir ruta completa del elemento
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      
      // Si es una carpeta, procesarla recursivamente
      if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
        folderSize += await processFolder(itemPath);
      } else {
        // Si es un archivo, sumar su tamaño
        folderSize += item.metadata?.size || 0;
      }
    }
    
    return folderSize;
  }
  
  // Iniciar el cálculo desde la raíz
  totalSize = await processFolder();
  
  return totalSize;
}

// Ruta para subir archivos
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente. Verifica las variables de entorno SUPABASE_URL y SUPABASE_KEY.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar explícitamente que el bucket sea el correcto
    console.log(`[UPLOAD] Verificando bucketName en request: ${req.bucketName}`);
    console.log(`[UPLOAD] Verificando username en request: ${req.username}`);
    console.log(`[UPLOAD] Bucket mapeado para usuario ${req.username}: ${userBucketMap[req.username]}`);
    
    // Validación adicional de seguridad
    if (req.username && userBucketMap[req.username] && req.bucketName !== userBucketMap[req.username]) {
      console.error(`[UPLOAD] ERROR: Discrepancia de bucket - Usuario ${req.username} debería usar ${userBucketMap[req.username]} pero está usando ${req.bucketName}`);
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: Bucket no válido para este usuario'
      });
    }    
   
    // Verificamos si el usuario puede subir archivos (admin o usuario con permiso específico)
if (req.userRole !== 'admin' && 
  !(req.userType === 'dynamic' && req.adminPermissions && req.adminPermissions.upload_files)) {
 return res.status(403).json({
   success: false,
   message: 'No tienes permisos para subir archivos.'
 });
}
   
    // Calcular tamaño actual del bucket y verificar límite para este bucket específico
console.log(`Calculando tamaño actual del bucket ${bucketToUse}...`);
const currentBucketSize = await calculateBucketSize(bucketToUse);
const fileSizeInBytes = req.file.size;

// Obtener el tamaño máximo para este bucket específico (en MB)
const maxSizeMB = bucketSizeMap[bucketToUse] || defaultBucketMaxSize;
const maxBucketSize = maxSizeMB * 1024 * 1024; // Convertir MB a bytes

console.log(`Tamaño actual del bucket: ${(currentBucketSize / (1024 * 1024)).toFixed(2)}MB`);
console.log(`Tamaño del archivo a subir: ${(fileSizeInBytes / (1024 * 1024)).toFixed(2)}MB`);
console.log(`Tamaño máximo del bucket ${bucketToUse}: ${maxSizeMB}MB`);

// Verificar si el archivo excede el límite total
if (currentBucketSize + fileSizeInBytes > maxBucketSize) {
  return res.status(413).json({
    success: false,
    message: `No se puede subir el archivo. Se excedería el límite de ${maxSizeMB}MB para el bucket ${bucketToUse}. Tamaño actual: ${(currentBucketSize / (1024 * 1024)).toFixed(2)}MB, Tamaño del archivo: ${(fileSizeInBytes / (1024 * 1024)).toFixed(2)}MB`,
    currentSize: currentBucketSize,
    fileSize: fileSizeInBytes,
    maxSize: maxBucketSize,
    maxSizeMB: maxSizeMB
  });
}
    const filePath = req.body.path || '';
    const fileName = req.file.originalname;
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    // Construir la ruta completa del archivo
    const fullPath = normalizedPath 
      ? `${normalizedPath}/${fileName}` 
      : fileName;
    
    console.log(`Subiendo archivo a: ${fullPath}`);
    
  // Subir archivo a Supabase
const { data, error } = await supabase.storage
.from(bucketToUse)
.upload(fullPath, req.file.buffer, {
  contentType: req.file.mimetype,
  upsert: true
});

   
    if (error) {
      throw error;
    }
    
  // Obtener URL pública
const { data: publicUrlData } = supabase.storage
.from(bucketToUse)
.getPublicUrl(fullPath);

// Crear archivo de metadatos automáticamente con la fecha y hora actuales
try {
  // Obtener fecha y hora actuales ajustadas a la zona horaria de Colombia (UTC-5)
  const now = new Date();
  // Ajustar a la zona horaria de Colombia (UTC-5)
  const colombiaTime = new Date(now.getTime() - (now.getTimezoneOffset() + 300) * 60000);
  
  // Formato de fecha YYYY-MM-DD
  const currentDate = colombiaTime.toISOString().split('T')[0];
  
  // Incluir la hora completa para tener fecha y hora actuales
  const currentDateTime = colombiaTime.toISOString(); // Esto incluye la hora completa
  
// Extraer contenido del archivo para búsqueda
let fileContent = "";
  
try {
  // Determinar el tipo de archivo basado en la extensión
  const fileExtension = fileName.split('.').pop().toLowerCase();
  
  console.log(`[UPLOAD] Extrayendo contenido de archivo ${fileName} (tipo: ${fileExtension})`);
  
  if (fileExtension === 'docx') {
    // Extraer texto de archivos DOCX usando mammoth
    const result = await mammoth.extractRawText({ buffer: req.file.buffer });
    fileContent = result.value || "";
    console.log(`[UPLOAD] Texto extraído de DOCX (${fileContent.length} caracteres)`);
  } 
  else if (fileExtension === 'pdf') {
    // Extraer texto de archivos PDF usando pdf-parse
    const pdfData = await pdfParse(req.file.buffer);
    fileContent = pdfData.text || "";
    console.log(`[UPLOAD] Texto extraído de PDF (${fileContent.length} caracteres)`);
  } 
  else if (fileExtension === 'txt') {
    // Para archivos de texto plano, convertir buffer a texto
    fileContent = req.file.buffer.toString('utf8');
    console.log(`[UPLOAD] Texto extraído de TXT (${fileContent.length} caracteres)`);
  }
  // Limitar el tamaño del contenido extraído (evitar metadatos demasiado grandes)
  if (fileContent.length > 100000) {
    console.log(`[UPLOAD] Contenido truncado de ${fileContent.length} a 100,000 caracteres`);
    fileContent = fileContent.substring(0, 100000);
  }
} catch (extractError) {
  console.error(`[UPLOAD] Error al extraer contenido de ${fileName}:`, extractError);
  // No bloquear el proceso por errores en la extracción de texto
  fileContent = "";
}

// Crear objeto de metadatos con el contenido extraído
const metadata = {
  uploadDate: currentDate,  // Fecha de subida (solo la fecha, sin hora)
  fileDate: currentDateTime, // Fecha y hora completas del archivo (se puede modificar)
  uploadedBy: req.username || 'admin',
  tags: [],
  lastModified: currentDateTime,
  fileContent: fileContent  // Contenido extraído para búsqueda
};   
  // Ruta para el archivo de metadatos
  const metadataPath = `${fullPath}.metadata`;
  
  // Guardar metadatos como JSON
  const { error: metadataError } = await supabase.storage
    .from(bucketToUse)
    .upload(metadataPath, JSON.stringify(metadata), {
      contentType: 'application/json',
      upsert: true
    });
  
  if (metadataError) {
    console.error('Error al crear metadatos:', metadataError);
  } else {
    console.log(`Metadatos creados para ${fullPath}`);
  }
} catch (metadataError) {
  console.error('Error al crear metadatos inicial:', metadataError);
  // No bloquear la respuesta por error en metadatos
}
    
res.status(200).json({
  success: true,
  message: 'Archivo subido correctamente',
  fileName: fileName,
  filePath: fullPath,
  publicUrl: publicUrlData.publicUrl
});
  } catch (error) {
    console.error('Error al subir archivo:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al subir el archivo: ${error.message}`,
      error: error.message
    });
  }
});

// Ruta para descargar o visualizar archivos


app.get('/api/download', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente. Verifica las variables de entorno SUPABASE_URL y SUPABASE_KEY.'
      });
    }
    
    // SOLUCIÓN: Verificar el token para determinar el bucket correcto
    let bucketToUse = req.bucketName || defaultBucketName;
    let tokenUsername = null;
    let userType = 'static';
    
    // Procesar el token de la URL (si existe)
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[DOWNLOAD] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        // Verificar si es un usuario dinámico o estático
        if (tokenData.type === 'dynamic') {
          userType = 'dynamic';
          tokenUsername = tokenData.username;
          // Para usuarios dinámicos, usar el bucket especificado en el token
          if (tokenData.bucket) {
            bucketToUse = tokenData.bucket;
            console.log(`[DOWNLOAD] Usuario dinámico ${tokenUsername} usando bucket ${bucketToUse} desde token en parámetros`);
          }
          
          // Actualizar req para validaciones posteriores
          req.username = tokenData.username;
          req.userRole = 'user';
          req.userType = 'dynamic';
          req.userFolders = tokenData.folders || [];
          req.bucketName = bucketToUse;
        } else {
          // Para usuarios estáticos
          if (tokenData.username && userBucketMap[tokenData.username]) {
            tokenUsername = tokenData.username;
            const tokenBucket = userBucketMap[tokenData.username];
            console.log(`[DOWNLOAD] Usuario estático ${tokenUsername} usando bucket ${tokenBucket} desde token en parámetros`);
            bucketToUse = tokenBucket;
            
            // Actualizar req para validaciones posteriores
            req.username = tokenData.username;
            req.userRole = userRoleMap[tokenData.username] || 'user';
            req.bucketName = bucketToUse;
          }
        }
      } catch (tokenError) {
        console.error('[DOWNLOAD] Error al decodificar token de parámetros:', tokenError);
      }
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      // Si no hay token en URL pero hay en headers, usar la info del middleware
      console.log(`[DOWNLOAD] No hay token en URL, usando datos del middleware: bucket=${req.bucketName}, userType=${req.userType || 'static'}`);
      
      // Garantizar que estamos usando el bucket correcto del middleware
      bucketToUse = req.bucketName;
      userType = req.userType || 'static';
    }
    
    // Log detallado para diagnóstico
    console.log(`[DOWNLOAD] Tipo de usuario: ${userType}`);
    console.log(`[DOWNLOAD] Bucket a usar: ${bucketToUse}`);
    if (userType === 'dynamic') {
      console.log(`[DOWNLOAD] Carpetas permitidas: ${JSON.stringify(req.userFolders || [])}`);
    }   
    const filePath = req.query.path;
    const view = req.query.view === 'true';
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'No se ha especificado la ruta del archivo'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log(`Obteniendo URL para: ${normalizedPath}, visualizar: ${view}, en bucket: ${bucketToUse}`);
    
  // Verificar que la ruta esté permitida para usuarios dinámicos
  if (userType === 'dynamic' && req.userFolders && req.userFolders.length > 0) {
    const itemPath = normalizedPath;
    let hasPermission = false;
    
    // Comprobar si el archivo está en una carpeta permitida
    for (const folder of req.userFolders) {
      // Normalizar carpeta permitida
      const normalizedFolder = folder.startsWith('/') ? folder.substring(1) : folder;
      
      // El archivo debe estar dentro de una carpeta permitida
      if (itemPath === normalizedFolder || 
          itemPath.startsWith(normalizedFolder + '/')) {
        hasPermission = true;
        break;
      }
    }
    
    // Si no tiene permiso, denegar acceso
    if (!hasPermission) {
      console.log(`[DOWNLOAD] ACCESO DENEGADO: Usuario ${req.username} intentó acceder a ${itemPath} en bucket ${bucketToUse}`);
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para acceder a este archivo'
      });
    }
  }

  // Obtener la URL pública
  console.log(`[DOWNLOAD] Generando URL pública para archivo ${normalizedPath} en bucket ${bucketToUse}`);
  const { data } = supabase.storage
    .from(bucketToUse)
    .getPublicUrl(normalizedPath);
 
  if (!data || !data.publicUrl) {
    return res.status(404).json({
      success: false,
      message: `No se pudo generar URL para ${normalizedPath}`
    });
  }
    
    // Determinar el tipo de archivo
    const fileExtension = path.extname(normalizedPath).toLowerCase();
    
    // Devolver la URL en formato JSON
    return res.status(200).json({
      success: true,
      publicUrl: data.publicUrl,
      fileType: fileExtension.slice(1), // Sin el punto
      bucket: bucketToUse // Incluir el bucket usado para diagnóstico
    });
  } catch (error) {
    console.error('Error al obtener URL del archivo:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al procesar el archivo: ${error.message}`,
      error: error.message
    });
  }
});

// Ruta para crear carpetas


app.post('/api/createFolder', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente. Verifica las variables de entorno SUPABASE_URL y SUPABASE_KEY.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar explícitamente que el bucket sea el correcto
    console.log(`[CREATE_FOLDER] Verificando bucketName en request: ${req.bucketName}`);
    console.log(`[CREATE_FOLDER] Verificando username en request: ${req.username}`);
    console.log(`[CREATE_FOLDER] Bucket mapeado para usuario ${req.username}: ${userBucketMap[req.username]}`);
    
    // Validación adicional de seguridad
    if (req.username && userBucketMap[req.username] && req.bucketName !== userBucketMap[req.username]) {
      console.error(`[CREATE_FOLDER] ERROR: Discrepancia de bucket - Usuario ${req.username} debería usar ${userBucketMap[req.username]} pero está usando ${req.bucketName}`);
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: Bucket no válido para este usuario'
      });
    }    
    
    // Verificamos si el usuario puede crear carpetas (admin o usuario con permiso específico)
if (req.userRole !== 'admin' && 
  !(req.userType === 'dynamic' && req.adminPermissions && req.adminPermissions.create_folders)) {
 return res.status(403).json({
   success: false,
   message: 'No tienes permisos para crear carpetas.'
 });
}
   
    const { parentPath, folderName } = req.body;
    
    if (!folderName) {
      return res.status(400).json({
        success: false,
        message: 'No se ha especificado el nombre de la carpeta'
      });
    }
    
    // Normalizar la ruta padre
    let normalizedParentPath = parentPath || '';
    if (normalizedParentPath.startsWith('/')) {
      normalizedParentPath = normalizedParentPath.substring(1);
    }
    
    // Construir la ruta completa de la carpeta
    const folderPath = normalizedParentPath
      ? `${normalizedParentPath}/${folderName}/.folder`
      : `${folderName}/.folder`;
    
    console.log(`Creando carpeta en: ${folderPath}`);
    
 // En Supabase Storage, las carpetas son implícitas
// Creamos un archivo vacío oculto para representar la carpeta
const { error } = await supabase.storage
.from(bucketToUse)
.upload(folderPath, new Uint8Array(0), {
  contentType: 'application/x-directory',
  upsert: true
});
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      success: true,
      message: `Carpeta ${folderName} creada correctamente`,
      folderPath: normalizedParentPath
        ? `${normalizedParentPath}/${folderName}`
        : folderName
    });
  } catch (error) {
    console.error('Error al crear carpeta:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al crear la carpeta: ${error.message}`,
      error: error.message
    });
  }
});

// Ruta específica para eliminar carpetas

app.delete('/api/deleteFolder', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar explícitamente que el bucket sea el correcto
    console.log(`[DELETE_FOLDER] Verificando bucketName en request: ${req.bucketName}`);
    console.log(`[DELETE_FOLDER] Verificando username en request: ${req.username}`);
    console.log(`[DELETE_FOLDER] Bucket mapeado para usuario ${req.username}: ${userBucketMap[req.username]}`);
    
    // Validación adicional de seguridad
    if (req.username && userBucketMap[req.username] && req.bucketName !== userBucketMap[req.username]) {
      console.error(`[DELETE_FOLDER] ERROR: Discrepancia de bucket - Usuario ${req.username} debería usar ${userBucketMap[req.username]} pero está usando ${req.bucketName}`);
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: Bucket no válido para este usuario'
      });
    }   

    // Verificamos si el usuario puede eliminar carpetas (admin o usuario con permiso específico)
if (req.userRole !== 'admin' && 
  !(req.userType === 'dynamic' && req.adminPermissions && req.adminPermissions.delete_folders)) {
 return res.status(403).json({
   success: false,
   message: 'No tienes permisos para eliminar carpetas.'
 });
}
    
    const folderPath = req.query.path;
    
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        message: 'No se ha especificado la ruta de la carpeta a eliminar'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = folderPath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log(`Iniciando eliminación recursiva de carpeta: ${normalizedPath}`);
    
    // Función recursiva para eliminar carpetas y su contenido
    const deleteRecursively = async (path) => {
      console.log(`Procesando: ${path}`);

      
 // Listar contenido de la carpeta actual
const { data, error: listError } = await supabase.storage
.from(bucketToUse)
.list(path);
      
      if (listError) {
        console.error(`Error al listar contenido de ${path}:`, listError);
        return { error: listError };
      }
      
      console.log(`Encontrados ${(data && data.length) || 0} elementos en ${path}`);
      
      // Procesar cada elemento dentro de la carpeta
      const deletedItems = [];
      
      if (data && data.length > 0) {
        for (const item of data) {
          const itemPath = path ? `${path}/${item.name}` : item.name;
          
          // Verificar si es una subcarpeta
          const isFolder = item.metadata && item.metadata.mimetype === 'application/x-directory';
          
          if (isFolder || item.name === '.folder') {
            // Para subcarpetas, eliminar recursivamente
            if (item.name !== '.folder') {
              await deleteRecursively(itemPath);
            }
          }
          
     // Eliminar el elemento actual
console.log(`Eliminando: ${itemPath}`);
const { error: deleteError } = await supabase.storage
  .from(bucketToUse)
  .remove([itemPath]);
          
          if (deleteError && deleteError.message !== 'Object not found') {
            console.error(`Error al eliminar ${itemPath}:`, deleteError);
          } else {
            deletedItems.push(itemPath);
          }
        }
      }
      
      // Eliminar el marcador de carpeta
      const folderMarkerPath = `${path}/.folder`;
      console.log(`Eliminando marcador de carpeta: ${folderMarkerPath}`);
      
      const { error: markerError } = await supabase.storage
  .from(bucketToUse)
  .remove([folderMarkerPath]);
      
      if (markerError && markerError.message !== 'Object not found') {
        console.error(`Error al eliminar marcador ${folderMarkerPath}:`, markerError);
      } else {
        deletedItems.push(folderMarkerPath);
      }
      
      return { deletedItems };
    };
    
    // Ejecutar eliminación recursiva
    const result = await deleteRecursively(normalizedPath);
    
    if (result.error) {
      throw result.error;
    }
    
 // Eliminar la carpeta misma como último paso
const { error: finalError } = await supabase.storage
.from(bucketToUse)
.remove([normalizedPath]);
    
    if (finalError && finalError.message !== 'Object not found') {
      console.log('Nota: intento final de eliminar la carpeta principal:', finalError);
    }
    
    // Esperar un momento para que Supabase actualice su estado
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    res.status(200).json({
      success: true,
      message: `Carpeta ${normalizedPath} eliminada correctamente`,
      elementsDeleted: (result.deletedItems || []).length
    });
  } catch (error) {
    console.error('Error al eliminar carpeta:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al eliminar la carpeta: ${error.message}`,
      error: error.message
    });
  }
});

// Ruta para eliminar archivos o carpetas

app.delete('/api/delete', async (req, res) => {
  try {
    console.log('Endpoint delete llamado con query:', req.query);
    console.log('Endpoint delete llamado con body:', req.body);
    
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente. Verifica las variables de entorno SUPABASE_URL y SUPABASE_KEY.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar explícitamente que el bucket sea el correcto
    console.log(`[DELETE] Verificando bucketName en request: ${req.bucketName}`);
    console.log(`[DELETE] Verificando username en request: ${req.username}`);
    console.log(`[DELETE] Bucket mapeado para usuario ${req.username}: ${userBucketMap[req.username]}`);
    
    // Validación adicional de seguridad
    if (req.username && userBucketMap[req.username] && req.bucketName !== userBucketMap[req.username]) {
      console.error(`[DELETE] ERROR: Discrepancia de bucket - Usuario ${req.username} debería usar ${userBucketMap[req.username]} pero está usando ${req.bucketName}`);
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: Bucket no válido para este usuario'
      });
    }  

  // Verificamos si el usuario puede eliminar archivos (admin o usuario con permiso específico)
if (req.userRole !== 'admin' && 
  !(req.userType === 'dynamic' && req.adminPermissions && req.adminPermissions.delete_files)) {
 return res.status(403).json({
   success: false,
   message: 'No tienes permisos para eliminar archivos.'
 });
}
    
    const path = req.query.path;
    const isFolder = req.query.isFolder === 'true';
    
    console.log('Path a eliminar:', path);
    console.log('Es carpeta:', isFolder);
    
    if (!path) {
      return res.status(400).json({
        success: false,
        message: 'No se ha especificado la ruta del elemento a eliminar'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = path;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log('Path normalizado:', normalizedPath);
    
    if (isFolder) {
      console.log('Intentando eliminar carpeta:', normalizedPath);
    
   // Para carpetas, primero listamos su contenido
const listResult = await supabase.storage
.from(bucketToUse)
.list(normalizedPath);
      
      console.log('Resultado de list:', listResult);
      
      if (listResult.error) {
        console.error('Error al listar el contenido:', listResult.error);
        throw listResult.error;
      }
      
      const data = listResult.data || [];
      console.log('Contenido de la carpeta:', data);
      
      // Construimos rutas completas para todos los elementos dentro
      const itemsToDelete = data.map(item => 
        `${normalizedPath}/${item.name}`
      );
      
      // Añadimos el marcador .folder de la carpeta
      itemsToDelete.push(`${normalizedPath}/.folder`);
      
      console.log('Items a eliminar:', itemsToDelete);
      
   // Eliminamos todos los elementos
if (itemsToDelete.length > 0) {
  const deleteResult = await supabase.storage
    .from(bucketToUse)
    .remove(itemsToDelete);
       
        console.log('Resultado de eliminación múltiple:', deleteResult);
        
        if (deleteResult.error && deleteResult.error.message !== 'Object not found') {
          console.error('Error en la eliminación múltiple:', deleteResult.error);
          throw deleteResult.error;
        }
      }
      
    // Intento adicional de eliminar la carpeta misma
const deleteFolderResult = await supabase.storage
.from(bucketToUse)
.remove([normalizedPath]);
      
      console.log('Resultado de eliminación de la carpeta misma:', deleteFolderResult);
      
      res.status(200).json({
        success: true,
        message: `Carpeta ${normalizedPath} y su contenido eliminados correctamente`,
        elementsDeleted: itemsToDelete.length
      });
    } else {
      console.log('Intentando eliminar archivo:', normalizedPath);
      
   // Para archivos individuales
const deleteResult = await supabase.storage
.from(bucketToUse)
.remove([normalizedPath]);
      
      console.log('Resultado de eliminación de archivo:', deleteResult);
      
      if (deleteResult.error) {
        console.error('Error al eliminar archivo:', deleteResult.error);
        throw deleteResult.error;
      }
      
      res.status(200).json({
        success: true,
        message: `Elemento ${normalizedPath} eliminado correctamente`
      });
    }
  } catch (error) {
    console.error('Error general en el endpoint delete:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al eliminar el elemento: ${error.message}`,
      error: error.message
    });
  }
});

// Endpoint para renombrar archivos
app.patch('/api/rename-file', express.json(), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    const { oldPath, newName } = req.body;
    
    if (!oldPath || !newName) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la ruta original del archivo y el nuevo nombre'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = oldPath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    // Obtener el directorio y el nombre del archivo actual
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    const directory = lastSlashIndex !== -1 ? normalizedPath.substring(0, lastSlashIndex) : '';
    const oldName = lastSlashIndex !== -1 ? normalizedPath.substring(lastSlashIndex + 1) : normalizedPath;
    
    // Construir la nueva ruta
    const newPath = directory ? `${directory}/${newName}` : newName;
    
    console.log(`[RENAME] Renombrando archivo de ${normalizedPath} a ${newPath}`);
    
    // En Supabase Storage, no hay una operación directa de renombrado,
    // por lo que debemos copiar el archivo y luego eliminar el original
    
    // 1. Descargar el archivo original
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketToUse)
      .download(normalizedPath);
    
    if (downloadError) {
      console.error('Error al descargar archivo para renombrar:', downloadError);
      throw downloadError;
    }
    
    // 2. Subir el archivo con el nuevo nombre
    const { error: uploadError } = await supabase.storage
      .from(bucketToUse)
      .upload(newPath, fileData, {
        contentType: fileData.type,
        upsert: true
      });
    
    if (uploadError) {
      console.error('Error al subir archivo con nuevo nombre:', uploadError);
      throw uploadError;
    }
    
    // 3. Eliminar el archivo original
    const { error: deleteError } = await supabase.storage
      .from(bucketToUse)
      .remove([normalizedPath]);
    
    if (deleteError) {
      console.error('Error al eliminar archivo original:', deleteError);
      throw deleteError;
    }
    
    // 4. Manejar los metadatos si existen
    const metadataPath = `${normalizedPath}.metadata`;
    const newMetadataPath = `${newPath}.metadata`;
    
    try {
      // Verificar si existen metadatos
      const { data: metadataData, error: metadataError } = await supabase.storage
        .from(bucketToUse)
        .download(metadataPath);
      
      if (!metadataError && metadataData) {
        // Subir los metadatos con la nueva ruta
        await supabase.storage
          .from(bucketToUse)
          .upload(newMetadataPath, metadataData, {
            contentType: 'application/json',
            upsert: true
          });
        
        // Eliminar los metadatos originales
        await supabase.storage
          .from(bucketToUse)
          .remove([metadataPath]);
      }
    } catch (metadataError) {
      console.error('Error al manejar metadatos durante renombrado:', metadataError);
      // No bloquear la operación si hay error con los metadatos
    }
    
    res.status(200).json({
      success: true,
      message: `Archivo renombrado correctamente a ${newName}`,
      newPath: `/${newPath}`
    });
  } catch (error) {
    console.error('Error al renombrar archivo:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al renombrar el archivo: ${error.message}`,
      error: error.message
    });
  }
});

// Endpoint para renombrar carpetas
app.patch('/api/rename-folder', express.json(), hasAdminPermission('rename_folders'), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    const { oldPath, newName } = req.body;
    
    if (!oldPath || !newName) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la ruta original de la carpeta y el nuevo nombre'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = oldPath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    // Eliminar cualquier barra final
    if (normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    
    // Obtener el directorio padre y el nombre de la carpeta actual
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    const parentDir = lastSlashIndex !== -1 ? normalizedPath.substring(0, lastSlashIndex) : '';
    const oldName = lastSlashIndex !== -1 ? normalizedPath.substring(lastSlashIndex + 1) : normalizedPath;
    
    // Construir la nueva ruta
    const newPath = parentDir ? `${parentDir}/${newName}` : newName;
    
    console.log(`[RENAME] Renombrando carpeta de ${normalizedPath} a ${newPath}`);
    
    // En Supabase, necesitamos listar todos los archivos en la carpeta,
    // copiarlos a la nueva ubicación y luego eliminar los originales
    
    // Primero, obtenemos la lista de todos los archivos en la carpeta
    const processedFiles = new Set();
    const filesToCopy = [];
    
    // Función recursiva para recopilar todos los archivos en la carpeta y subcarpetas
    async function collectFilesInFolder(prefix) {
      const { data, error } = await supabase.storage
        .from(bucketToUse)
        .list(prefix, {
          sortBy: { column: 'name', order: 'asc' }
        });
      
      if (error) {
        console.error(`Error al listar contenido de ${prefix}:`, error);
        throw error;
      }
      
      for (const item of data) {
        const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
        
        // Para carpetas, buscar recursivamente
        if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
          await collectFilesInFolder(itemPath);
        } else {
          filesToCopy.push(itemPath);
        }
      }
    }
    
    await collectFilesInFolder(normalizedPath);
    console.log(`[RENAME] Encontrados ${filesToCopy.length} archivos para copiar`);
    
    // Ahora copiamos todos los archivos a la nueva ubicación
    for (const filePath of filesToCopy) {
      // Construir la nueva ruta para este archivo
      const relativeFilePath = filePath.substring(normalizedPath.length);
      const newFilePath = `${newPath}${relativeFilePath}`;
      
      // Descargar el archivo original
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketToUse)
        .download(filePath);
      
      if (downloadError) {
        console.error(`Error al descargar archivo ${filePath}:`, downloadError);
        continue; // Continuar con el siguiente archivo
      }
      
      // Subir el archivo a la nueva ubicación
      const { error: uploadError } = await supabase.storage
        .from(bucketToUse)
        .upload(newFilePath, fileData, {
          contentType: fileData.type,
          upsert: true
        });
      
      if (uploadError) {
        console.error(`Error al subir archivo a ${newFilePath}:`, uploadError);
        continue;
      }
      
      console.log(`[RENAME] Copiado archivo ${filePath} a ${newFilePath}`);
    }
    
    // Finalmente, eliminar la carpeta original y su contenido
    for (const filePath of filesToCopy) {
      const { error: deleteError } = await supabase.storage
        .from(bucketToUse)
        .remove([filePath]);
      
      if (deleteError && deleteError.message !== 'Object not found') {
        console.error(`Error al eliminar archivo ${filePath}:`, deleteError);
      }
    }
    
    // Eliminar el marcador de carpeta original si existe
    const folderMarkerPath = `${normalizedPath}/.folder`;
    try {
      await supabase.storage
        .from(bucketToUse)
        .remove([folderMarkerPath]);
    } catch (error) {
      console.error('Error al eliminar marcador de carpeta:', error);
    }
    
    // Crear marcador de carpeta en la nueva ubicación
    try {
      await supabase.storage
        .from(bucketToUse)
        .upload(`${newPath}/.folder`, new Uint8Array(0), {
          contentType: 'application/x-directory',
          upsert: true
        });
    } catch (error) {
      console.error('Error al crear marcador de carpeta nueva:', error);
    }
    
    res.status(200).json({
      success: true,
      message: `Carpeta renombrada correctamente a ${newName}`,
      newPath: `/${newPath}`
    });
  } catch (error) {
    console.error('Error al renombrar carpeta:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al renombrar la carpeta: ${error.message}`,
      error: error.message
    });
  }
});

// Endpoint para duplicar archivos
app.post('/api/duplicate-file', express.json(), hasAdminPermission('duplicate_files'), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la ruta del archivo a duplicar'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    // Obtener el directorio y el nombre del archivo actual
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    const directory = lastSlashIndex !== -1 ? normalizedPath.substring(0, lastSlashIndex) : '';
    const fileName = lastSlashIndex !== -1 ? normalizedPath.substring(lastSlashIndex + 1) : normalizedPath;
    
    // Generar nombre para la copia
    // Primero, separar el nombre del archivo y su extensión
    const lastDotIndex = fileName.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
    
    // Crear nuevo nombre con sufijo " - copia"
    const newFileName = `${nameWithoutExt} - copia${extension}`;
    const newPath = directory ? `${directory}/${newFileName}` : newFileName;
    
    console.log(`[DUPLICATE] Duplicando archivo de ${normalizedPath} a ${newPath}`);
    
    // 1. Descargar el archivo original
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketToUse)
      .download(normalizedPath);
    
    if (downloadError) {
      console.error('Error al descargar archivo para duplicar:', downloadError);
      throw downloadError;
    }
    
    // 2. Subir la copia del archivo
    const { error: uploadError } = await supabase.storage
      .from(bucketToUse)
      .upload(newPath, fileData, {
        contentType: fileData.type,
        upsert: true
      });
    
    if (uploadError) {
      console.error('Error al subir copia del archivo:', uploadError);
      throw uploadError;
    }
    
    // 3. Duplicar los metadatos si existen
    const metadataPath = `${normalizedPath}.metadata`;
    const newMetadataPath = `${newPath}.metadata`;
    
    try {
      // Verificar si existen metadatos
      const { data: metadataData, error: metadataError } = await supabase.storage
        .from(bucketToUse)
        .download(metadataPath);
      
      if (!metadataError && metadataData) {
        // Leer los metadatos
        const text = await metadataData.text();
        const metadata = JSON.parse(text);
        
        // Actualizar campos relevantes
        metadata.lastModified = new Date().toISOString().split('T')[0];
        if (metadata.uploadDate) {
          metadata.uploadDate = new Date().toISOString().split('T')[0];
        }
        
        // Subir los metadatos actualizados
        await supabase.storage
          .from(bucketToUse)
          .upload(newMetadataPath, JSON.stringify(metadata), {
            contentType: 'application/json',
            upsert: true
          });
      }
    } catch (metadataError) {
      console.error('Error al duplicar metadatos:', metadataError);
      // No bloquear la operación si hay error con los metadatos
    }
    
    res.status(200).json({
      success: true,
      message: `Archivo duplicado correctamente como ${newFileName}`,
      newPath: `/${newPath}`
    });
  } catch (error) {
    console.error('Error al duplicar archivo:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al duplicar el archivo: ${error.message}`,
      error: error.message
    });
  }
});

// Endpoint para duplicar carpetas
app.post('/api/duplicate-folder', express.json(), hasAdminPermission('duplicate_folders'), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    const { folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la ruta de la carpeta a duplicar'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = folderPath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    // Eliminar cualquier barra final
    if (normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    
    // Obtener el directorio padre y el nombre de la carpeta actual
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    const parentDir = lastSlashIndex !== -1 ? normalizedPath.substring(0, lastSlashIndex) : '';
    const folderName = lastSlashIndex !== -1 ? normalizedPath.substring(lastSlashIndex + 1) : normalizedPath;
    
    // Generar nombre para la copia
    const newFolderName = `${folderName} - copia`;
    const newPath = parentDir ? `${parentDir}/${newFolderName}` : newFolderName;
    
    console.log(`[DUPLICATE] Duplicando carpeta de ${normalizedPath} a ${newPath}`);
    
    // En Supabase, necesitamos listar todos los archivos en la carpeta,
    // y copiarlos a la nueva ubicación
    
    // Primero, obtenemos la lista de todos los archivos en la carpeta
    const filesToCopy = [];
    
    // Función recursiva para recopilar todos los archivos en la carpeta y subcarpetas
    async function collectFilesInFolder(prefix) {
      const { data, error } = await supabase.storage
        .from(bucketToUse)
        .list(prefix, {
          sortBy: { column: 'name', order: 'asc' }
        });
      
      if (error) {
        console.error(`Error al listar contenido de ${prefix}:`, error);
        throw error;
      }
      
      for (const item of data) {
        const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
        
        // Para carpetas, buscar recursivamente
        if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
          await collectFilesInFolder(itemPath);
        } else {
          filesToCopy.push(itemPath);
        }
      }
    }
    
    await collectFilesInFolder(normalizedPath);
    console.log(`[DUPLICATE] Encontrados ${filesToCopy.length} archivos para copiar`);
    
    // Ahora copiamos todos los archivos a la nueva ubicación
    for (const filePath of filesToCopy) {
      // Construir la nueva ruta para este archivo
      const relativeFilePath = filePath.substring(normalizedPath.length);
      const newFilePath = `${newPath}${relativeFilePath}`;
      
      // Descargar el archivo original
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketToUse)
        .download(filePath);
      
      if (downloadError) {
        console.error(`Error al descargar archivo ${filePath}:`, downloadError);
        continue; // Continuar con el siguiente archivo
      }
      
      // Subir el archivo a la nueva ubicación
      const { error: uploadError } = await supabase.storage
        .from(bucketToUse)
        .upload(newFilePath, fileData, {
          contentType: fileData.type,
          upsert: true
        });
      
      if (uploadError) {
        console.error(`Error al subir archivo a ${newFilePath}:`, uploadError);
        continue;
      }
      
      console.log(`[DUPLICATE] Copiado archivo ${filePath} a ${newFilePath}`);
      
      // Duplicar metadatos si existen
      try {
        const metadataPath = `${filePath}.metadata`;
        const newMetadataPath = `${newFilePath}.metadata`;
        
        const { data: metadataData, error: metadataError } = await supabase.storage
          .from(bucketToUse)
          .download(metadataPath);
        
        if (!metadataError && metadataData) {
          await supabase.storage
            .from(bucketToUse)
            .upload(newMetadataPath, metadataData, {
              contentType: 'application/json',
              upsert: true
            });
        }
      } catch (metadataError) {
        console.error(`Error al duplicar metadatos para ${filePath}:`, metadataError);
      }
    }
    
    // Crear marcador de carpeta en la nueva ubicación
    try {
      await supabase.storage
        .from(bucketToUse)
        .upload(`${newPath}/.folder`, new Uint8Array(0), {
          contentType: 'application/x-directory',
          upsert: true
        });
    } catch (error) {
      console.error('Error al crear marcador de carpeta duplicada:', error);
    }
    
    res.status(200).json({
      success: true,
      message: `Carpeta duplicada correctamente como ${newFolderName}`,
      newPath: `/${newPath}`
    });
  } catch (error) {
    console.error('Error al duplicar carpeta:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al duplicar la carpeta: ${error.message}`,
      error: error.message
    });
  }
});

// Endpoint para copiar archivos (funcionalidad arrastrar y soltar)
app.post('/api/copy-files', express.json(), hasAdminPermission('copy_files'), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    const { sourceFiles, targetFolder } = req.body;
    
    if (!sourceFiles || !Array.isArray(sourceFiles) || sourceFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos un archivo de origen'
      });
    }
    
    if (!targetFolder) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere una carpeta de destino'
      });
    }
    
    // Normalizar la ruta de la carpeta de destino
    let normalizedTargetFolder = targetFolder;
    if (normalizedTargetFolder.startsWith('/')) {
      normalizedTargetFolder = normalizedTargetFolder.substring(1);
    }
    // Asegurar que termina con una barra
    if (normalizedTargetFolder && !normalizedTargetFolder.endsWith('/')) {
      normalizedTargetFolder += '/';
    }
    
    console.log(`[COPY] Copiando ${sourceFiles.length} archivos a ${normalizedTargetFolder}`);
    
    // Resultados de la operación
    const results = {
      success: [],
      errors: []
    };
    
    // Procesar cada archivo
    for (const sourcePath of sourceFiles) {
      try {
        // Normalizar la ruta del archivo de origen
        let normalizedSourcePath = sourcePath;
        if (normalizedSourcePath.startsWith('/')) {
          normalizedSourcePath = normalizedSourcePath.substring(1);
        }
        
        // Obtener el nombre del archivo (última parte de la ruta)
        const fileName = normalizedSourcePath.split('/').pop();
        
        // Construir la ruta del archivo de destino
        const targetPath = normalizedTargetFolder + fileName;
        
        // Verificar que el origen y destino no sean iguales
        if (normalizedSourcePath === targetPath) {
          results.errors.push({
            source: normalizedSourcePath,
            error: 'El origen y destino son iguales'
          });
          continue;
        }
        
        console.log(`[COPY] Copiando ${normalizedSourcePath} a ${targetPath}`);
        
        // 1. Descargar el archivo de origen
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucketToUse)
          .download(normalizedSourcePath);
        
        if (downloadError) {
          console.error(`Error al descargar archivo ${normalizedSourcePath}:`, downloadError);
          results.errors.push({
            source: normalizedSourcePath,
            error: downloadError.message
          });
          continue;
        }
        
        // 2. Subir el archivo a la ubicación de destino
        const { error: uploadError } = await supabase.storage
          .from(bucketToUse)
          .upload(targetPath, fileData, {
            contentType: fileData.type,
            upsert: true
          });
        
        if (uploadError) {
          console.error(`Error al subir archivo a ${targetPath}:`, uploadError);
          results.errors.push({
            source: normalizedSourcePath,
            target: targetPath,
            error: uploadError.message
          });
          continue;
        }
        
        console.log(`[COPY] Archivo copiado: ${normalizedSourcePath} -> ${targetPath}`);
        
        // 3. Copiar también los metadatos si existen
        try {
          const metadataPath = `${normalizedSourcePath}.metadata`;
          const targetMetadataPath = `${targetPath}.metadata`;
          
          // Verificar si existen metadatos para este archivo
          const { data: metadataData, error: metadataError } = await supabase.storage
            .from(bucketToUse)
            .download(metadataPath);
          
          if (!metadataError && metadataData) {
            // Actualizar fecha de copia en los metadatos
            const text = await metadataData.text();
            const metadata = JSON.parse(text);
            
            metadata.lastModified = new Date().toISOString().split('T')[0];
            metadata.copyDate = new Date().toISOString().split('T')[0];
            
            // Subir los metadatos actualizados
            await supabase.storage
              .from(bucketToUse)
              .upload(targetMetadataPath, JSON.stringify(metadata), {
                contentType: 'application/json',
                upsert: true
              });
            
            console.log(`[COPY] Metadatos copiados para: ${normalizedSourcePath}`);
          }
        } catch (metadataError) {
          console.error(`Error al copiar metadatos para ${normalizedSourcePath}:`, metadataError);
          // No bloqueamos la operación principal por errores en los metadatos
        }
        
        // Registrar éxito
        results.success.push({
          source: normalizedSourcePath,
          target: targetPath
        });
        
      } catch (fileError) {
        console.error(`Error general al copiar ${sourcePath}:`, fileError);
        results.errors.push({
          source: sourcePath,
          error: fileError.message
        });
      }
    }
    
    // Determinar el estado de la respuesta según los resultados
    if (results.success.length > 0 && results.errors.length === 0) {
      // Todo fue exitoso
      return res.status(200).json({
        success: true,
        message: `${results.success.length} archivos copiados correctamente`,
        results: results
      });
    } else if (results.success.length > 0 && results.errors.length > 0) {
      // Algunos archivos se copiaron, otros no
      return res.status(207).json({
        success: true,
        message: `${results.success.length} archivos copiados. ${results.errors.length} errores.`,
        results: results
      });
    } else {
      // Ningún archivo se copió correctamente
      return res.status(500).json({
        success: false,
        message: 'No se pudo copiar ningún archivo',
        results: results
      });
    }
  } catch (error) {
    console.error('Error general en copia de archivos:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al copiar archivos: ${error.message}`,
      error: error.message
    });
  }
});

// Endpoint para generar backup extremadamente eficiente en uso de memoria
// Diseñado para funcionar en Railway con límites de recursos

// Importar solo archiver si aún no está importado
const archiver = require('archiver');

app.get('/api/admin/backup', async (req, res) => {
  console.log('[BACKUP] Iniciando proceso de backup en Railway');
  
  try {
    // 1. Verificaciones básicas
    if (!supabase) {
      return res.status(500).json({ 
        success: false, 
        message: 'Supabase no está configurado.' 
      });
    }

    // 7.5 Exportar datos de la base de datos (metadatos, usuarios, etiquetas)
console.log('[BACKUP] Exportando metadatos de la base de datos...');
    
try {
  const dbExports = {};
  
  // Exportar tabla de usuarios
  console.log('[BACKUP] Exportando usuarios...');
  const { data: users, error: usersError } = await supabase
    .from('user_accounts')
    .select('*')
    .eq('active', true);
  
  if (usersError) {
    console.error('[BACKUP] Error al exportar usuarios:', usersError);
  } else {
    dbExports.users = users;
    console.log(`[BACKUP] Exportados ${users.length} usuarios`);
  }
  
  // Exportar tabla de etiquetas
  console.log('[BACKUP] Exportando etiquetas...');
  // Recolectar todas las etiquetas para el bucket actual
  // Nota: asegurarse de usar el bucketName correcto
  const bucketToBackup = bucketName || defaultBucketName;
  console.log(`[BACKUP] Recolectando etiquetas para bucket: ${bucketToBackup}`);
  
  const { data: tags, error: tagsError } = await supabase
    .from('tags_by_bucket')
    .select('*')
    .eq('bucket', bucketToBackup);
  
  if (tagsError) {
    console.error('[BACKUP] Error al exportar etiquetas:', tagsError);
  } else {
    dbExports.tags = tags;
    console.log(`[BACKUP] Exportadas ${tags?.length || 0} etiquetas`);
    
    // Mostrar categorías encontradas para diagnóstico
    if (tags && tags.length > 0) {
      const categories = [...new Set(tags.map(tag => tag.category))];
      console.log(`[BACKUP] Categorías de etiquetas encontradas: ${categories.join(', ')}`);
    }
  }      
      if (tagsError) {
        console.error('[BACKUP] Error al exportar etiquetas:', tagsError);
      } else {
        dbExports.tags = tags;
        console.log(`[BACKUP] Exportadas ${tags.length} etiquetas`);
      }
      
      // Guardar toda la información en un archivo JSON
      const dbExportPath = path.join(tempDir, 'database-export.json');
      fs.writeFileSync(dbExportPath, JSON.stringify(dbExports, null, 2));
      
      // Añadir el archivo de exportación al ZIP
      archive.append(fs.createReadStream(dbExportPath), { name: 'database-export.json' });
      console.log('[BACKUP] Metadatos de base de datos añadidos al backup');
      
    } catch (dbExportError) {
      console.error('[BACKUP] Error al exportar datos de la base de datos:', dbExportError);
      // No bloquear el proceso de backup por este error
    }

    // Verificar token en la URL
    let userRole = req.userRole || 'guest';
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar si hay un token en los parámetros de consulta
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[BACKUP] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.username && userBucketMap[tokenData.username]) {
          // Para usuarios estáticos
          userRole = userRoleMap[tokenData.username] || 'user';
          bucketToUse = userBucketMap[tokenData.username];
          console.log(`[BACKUP] Usuario estático ${tokenData.username} con rol ${userRole} y bucket ${bucketToUse}`);
        } else if (tokenData.role) {
          // Si el token tiene rol explícito, usarlo
          userRole = tokenData.role;
          console.log(`[BACKUP] Usando rol desde token: ${userRole}`);
          
          // Si tiene bucket explícito, usarlo también
          if (tokenData.bucket) {
            bucketToUse = tokenData.bucket;
            console.log(`[BACKUP] Usando bucket desde token: ${bucketToUse}`);
          }
        }
      } catch (tokenError) {
        console.error('[BACKUP] Error al decodificar token de parámetros:', tokenError);
      }
    }

    if (userRole !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Solo administradores pueden generar copias de seguridad.' 
      });
    }

    // 2. Configuración
    const bucketName = bucketToUse;
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `backup_${bucketName}_${dateStr}.zip`;

    // 3. Configuración de headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked'); // Para archivos grandes

    // 4. Configuración del archivador con compresión baja para ahorrar CPU
    const archive = archiver('zip', { 
      zlib: { level: 3 } // Nivel bajo de compresión (1-9)
    });

    // 5. Manejo de errores del archivador
    archive.on('error', (err) => {
      console.error('[BACKUP] Error del archivador:', err);
      if (!res.headersSent) {
        return res.status(500).json({
          
          
          success: false, 


          
          message: 'Error al crear archivo ZIP', 
          error: err.message 
        });
      } else {
        try { res.end(); } catch (e) {}
      }
    });

    // 6. Conectar el archivo a la respuesta HTTP
    archive.pipe(res);

    // 7. Función optimizada para listar archivos (evitando recursión profunda)
    const listFiles = async (prefix = '', depth = 0) => {
      // Limitar profundidad para evitar problemas de stack
      if (depth > 20) {
        console.warn(`[BACKUP] Límite de profundidad alcanzado en ${prefix}`);
        return [];
      }

      try {
        console.log(`[BACKUP] Listando archivos en ${bucketName}/${prefix || 'raíz'}`);
        
        const { data, error } = await supabase.storage
          .from(bucketName)
          .list(prefix, { sortBy: { column: 'name', order: 'asc' } });
        
        if (error) {
          console.error(`[BACKUP] Error al listar ${prefix}:`, error);
          return [];
        }
        
        if (!data || data.length === 0) {
          return [];
        }

        let filesList = [];

        // Procesar archivos primero
for (const item of data) {
  // Solo ignorar archivos de sistema, INCLUIR todos los metadatos
  if (item.name === '.folder') {
    continue;
  }
          
          const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
          
          // Si es archivo, añadir a la lista
          if (item.metadata && item.metadata.mimetype !== 'application/x-directory') {
            filesList.push({
              path: itemPath,
              size: item.metadata.size || 0
            });
          }
        }

        // Procesar carpetas después, pero solo si no tenemos demasiados archivos ya
        if (filesList.length < 500) { // Limitar para evitar problemas de memoria
          for (const item of data) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            
            // Si es carpeta, procesar recursivamente
            if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
              const subFiles = await listFiles(itemPath, depth + 1);
              filesList = filesList.concat(subFiles);
            }
          }
        } else {
          console.warn(`[BACKUP] Limitando archivos para evitar problemas de memoria en ${prefix}`);
        }
        
        return filesList;
      } catch (err) {
        console.error(`[BACKUP] Error al listar ${prefix}:`, err);
        return [];
      }
    };

    // 8. Procesar archivos por lotes muy pequeños
    const processFiles = async () => {
      try {
        // Listar todos los archivos
        console.log(`[BACKUP] Recopilando lista de archivos...`);
        const allFiles = await listFiles();
        
        console.log(`[BACKUP] Total archivos a procesar: ${allFiles.length}`);
        
        // Si no hay archivos, añadir README
        if (allFiles.length === 0) {
          archive.append('Este bucket no contiene archivos.', { name: 'README.txt' });
          return;
        }
        
        // Ordenar por tamaño (primero los más pequeños)
        allFiles.sort((a, b) => a.size - b.size);
        
        // Procesar en lotes muy pequeños
        const batchSize = 3; // Muy pocos a la vez
        
        for (let i = 0; i < allFiles.length; i += batchSize) {
          const batch = allFiles.slice(i, i + batchSize);
          
          // Procesar secuencialmente para reducir uso de memoria
          for (const fileInfo of batch) {
            try {
              const filePath = fileInfo.path;
              console.log(`[BACKUP] Procesando ${filePath} (${fileInfo.size} bytes)`);
              
              // Descargar con reintentos limitados
              let fileData = null;
              
              for (let attempt = 0; attempt < 2; attempt++) { // Solo 2 intentos para ahorrar recursos
                try {
                  const { data, error } = await supabase.storage
                    .from(bucketName)
                    .download(filePath);
                  
                  if (error) {
                    console.error(`[BACKUP] Error al descargar ${filePath}:`, error);
                    await new Promise(r => setTimeout(r, 500)); // Espera corta
                  } else {
                    fileData = data;
                    break;
                  }
                } catch (err) {
                  console.error(`[BACKUP] Excepción al descargar ${filePath}:`, err);
                }
              }
              
              if (!fileData) {
                console.warn(`[BACKUP] No se pudo descargar ${filePath}, continuando...`);
                continue;
              }
              
              // Añadir al ZIP
              const buffer = await fileData.arrayBuffer();
              archive.append(Buffer.from(buffer), { name: filePath });
              
              // Liberar memoria explícitamente
              fileData = null;
              
              // Pequeña pausa para permitir liberar recursos
              await new Promise(r => setTimeout(r, 100));
            } catch (fileErr) {
              console.error(`[BACKUP] Error al procesar archivo:`, fileErr);
              // Continuar con el siguiente archivo
            }
          }
          
          // Mostrar progreso
          console.log(`[BACKUP] Progreso: ${Math.min(i + batch.length, allFiles.length)}/${allFiles.length}`);
          
          // Pequeña pausa entre lotes para liberar recursos
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (processErr) {
        console.error('[BACKUP] Error al procesar archivos:', processErr);
        throw processErr;
      }
    };

    // 9. Iniciar procesamiento
    await processFiles();
    
    // 10. Finalizar el archivo ZIP
    console.log('[BACKUP] Finalizando archivo ZIP...');
    await archive.finalize();
    
    console.log(`[BACKUP] Resumen de la operación:`);
console.log(`[BACKUP] Usuario con rol: ${userRole}`);
console.log(`[BACKUP] Bucket utilizado: ${bucketName}`);
console.log(`[BACKUP] Token presente en URL: ${!!req.query.token}`);
    console.log(`[BACKUP] Proceso completado exitosamente`);
  } catch (err) {
    console.error('[BACKUP] Error general:', err);
    
    if (!res.headersSent) {
      return res.status(500).json({ 
        success: false, 
        message: 'Error al generar copia de seguridad', 
        error: err.message 
      });
    } else {
      try { res.end(); } catch (e) {}
    }
  }
});

// Endpoint para restaurar una copia de seguridad
app.post('/api/admin/restore', upload.single('backupFile'), async (req, res) => {
  console.log('[RESTORE] Iniciando proceso de restauración');
  
  try {
    // Verificar si el usuario tiene permisos administrativos
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden restaurar copias de seguridad'
      });
    }

    // Verificar que hay un archivo subido
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha proporcionado un archivo de copia de seguridad'
      });
    }

    // Verificar que el archivo es un ZIP
    if (!req.file.originalname.toLowerCase().endsWith('.zip')) {
      return res.status(400).json({
        success: false,
        message: 'El archivo debe ser un ZIP válido de copia de seguridad'
      });
    }

    // Obtener el bucket a restaurar
    const bucketToRestore = req.bucketName || defaultBucketName;
    console.log(`[RESTORE] Restaurando al bucket: ${bucketToRestore}`);

    // Crear un directorio temporal para extraer el zip
    const tempDir = path.join(os.tmpdir(), 'restore-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`[RESTORE] Directorio temporal creado: ${tempDir}`);

    // Guardar el archivo ZIP recibido con mayor cuidado
const zipPath = path.join(tempDir, 'backup.zip');
try {
  // Usar writeFile con un callback en lugar de writeFileSync para mejor manejo
  fs.writeFile(zipPath, req.file.buffer, { encoding: null, flag: 'wx' }, (writeErr) => {
    if (writeErr) {
      console.error(`[RESTORE] Error al guardar archivo ZIP: ${writeErr.message}`);
      throw writeErr;
    }
    console.log(`[RESTORE] Archivo ZIP guardado correctamente: ${zipPath} (tamaño: ${req.file.buffer.length} bytes)`);
    
    // Verificar que el archivo existe y tiene el tamaño correcto
    const stats = fs.statSync(zipPath);
    console.log(`[RESTORE] Archivo ZIP verificado: ${zipPath} (tamaño: ${stats.size} bytes)`);
    
    if (stats.size !== req.file.buffer.length) {
      throw new Error(`Tamaño de archivo incorrecto: esperado ${req.file.buffer.length}, obtenido ${stats.size}`);
    }
  });
} catch (writeError) {
  console.error(`[RESTORE] Error al guardar archivo ZIP: ${writeError.message}`);
  throw writeError;
}

       
if (fs.existsSync(dbExportPath)) {
  console.log('[RESTORE] Encontrado archivo de exportación de base de datos, restaurando...');
  
  try {
    const dbExport = JSON.parse(fs.readFileSync(dbExportPath, 'utf8'));
    
    // Restaurar usuarios (sin sobrescribir existentes)
    if (dbExport.users && Array.isArray(dbExport.users) && dbExport.users.length > 0) {
      console.log(`[RESTORE] Restaurando ${dbExport.users.length} usuarios...`);
      
      for (const user of dbExport.users) {
        // Verificar si el usuario ya existe
        const { data: existingUser } = await supabase
          .from('user_accounts')
          .select('id')
          .eq('username', user.username)
          .single();
        
        if (!existingUser) {
          // Insertar usuario nuevo
          const { error: createError } = await supabase
            .from('user_accounts')
            .insert([user]);
          
          if (createError) {
            console.error(`[RESTORE] Error al crear usuario ${user.username}:`, createError);
          } else {
            console.log(`[RESTORE] Usuario ${user.username} creado correctamente`);
          }
        } else {
          // Actualizar usuario existente sin cambiar contraseña
          const { password_hash, ...userData } = user;
          
          const { error: updateError } = await supabase
            .from('user_accounts')
            .update(userData)
            .eq('id', existingUser.id);
          
          if (updateError) {
            console.error(`[RESTORE] Error al actualizar usuario ${user.username}:`, updateError);
          } else {
            console.log(`[RESTORE] Usuario ${user.username} actualizado correctamente`);
          }
        }
      }
    }
    
    // Restaurar etiquetas
    if (dbExport.tags && Array.isArray(dbExport.tags) && dbExport.tags.length > 0) {
      console.log(`[RESTORE] Restaurando ${dbExport.tags.length} etiquetas...`);
      
      // Determinar el bucket al que se está restaurando
      const bucketToRestore = req.body.targetBucket || bucketToUse;
      
      // Primero eliminar etiquetas existentes para el bucket
      console.log(`[RESTORE] Eliminando etiquetas existentes para el bucket ${bucketToRestore}...`);
      const { error: deleteError } = await supabase
        .from('tags_by_bucket')
        .delete()
        .eq('bucket', bucketToRestore);
      
      if (deleteError) {
        console.error('[RESTORE] Error al eliminar etiquetas existentes:', deleteError);
      } else {
        console.log(`[RESTORE] Etiquetas existentes eliminadas correctamente`);
      }
      
       
      // Insertar etiquetas del backup en lotes de 50 para evitar límites de API
      const batchSize = 50;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < tagsToInsert.length; i += batchSize) {
        const batch = tagsToInsert.slice(i, i + batchSize);
        console.log(`[RESTORE] Insertando lote de etiquetas ${i + 1}-${Math.min(i + batchSize, tagsToInsert.length)}...`);
        
        // Insertar lote actual
        const { data, error: insertError } = await supabase
          .from('tags_by_bucket')
          .insert(batch);
        
        if (insertError) {
          console.error(`[RESTORE] Error al insertar lote de etiquetas:`, insertError);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
          console.log(`[RESTORE] Lote de etiquetas insertado correctamente`);
        }
      }
      
      console.log(`[RESTORE] Restauración de etiquetas completada: ${successCount} exitosas, ${errorCount} con errores`);
    } else {
      console.log(`[RESTORE] No se encontraron etiquetas para restaurar en el backup`);
    }
  } catch (dbRestoreError) {
    console.error('[RESTORE] Error al restaurar datos de la base de datos:', dbRestoreError);
  }
} else {
  console.log('[RESTORE] No se encontró archivo de exportación de base de datos');
}

    // Ahora recorremos los archivos extraídos y los subimos a Supabase
    const processDirectory = async (directory, prefix = '') => {
      const entries = fs.readdirSync(path.join(tempDir, directory), { withFileTypes: true });
      
      // Función para determinar si este es un archivo de metadatos especial
      const isSpecialMetadataFile = (filename) => {
        return filename.endsWith('.metadata') || 
               filename.endsWith('.youtube.metadata') || 
               filename.endsWith('.audio.metadata') ||
               filename.endsWith('.image.metadata');
      };
      
      // Priorizar archivos - metadatos al final para garantizar que primero existan los archivos
      let standardEntries = [];
      let metadataEntries = [];
      
      // Separar archivos normales de archivos de metadatos
      for (const entry of entries) {
        if (isSpecialMetadataFile(entry.name)) {
          metadataEntries.push(entry);
        } else {
          standardEntries.push(entry);
        }
      }
      
      // Procesar primero los archivos estándar, luego los metadatos
      const orderedEntries = [...standardEntries, ...metadataEntries];
      
      // Procesar todos los archivos en el orden correcto
      for (const entry of orderedEntries) {
        const entryPath = path.join(directory, entry.name);
        const fullPath = path.join(tempDir, entryPath);
        const remotePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          // Si es directorio, procesar recursivamente
          await processDirectory(entryPath, remotePath);
        } else {
          // Si es archivo, subir a Supabase
          console.log(`[RESTORE] Subiendo archivo: ${remotePath}`);
          
          try {
            const fileContent = fs.readFileSync(fullPath);
            const contentType = getContentType(entry.name);
            
            const { error } = await supabase.storage
              .from(bucketToRestore)
              .upload(remotePath, fileContent, {
                contentType,
                upsert: true // Sobrescribir si existe
              });
            
            if (error) {
              console.error(`[RESTORE] Error al subir ${remotePath}:`, error);
            }
          } catch (fileError) {
            console.error(`[RESTORE] Error al leer o subir ${remotePath}:`, fileError);
          }
        }
      }
    };
    // Función auxiliar para determinar el tipo de contenido
    function getContentType(filename) {
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.zip': 'application/zip',
        '.txt': 'text/plain',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.svg': 'image/svg+xml'
      };
      
      return mimeTypes[ext] || 'application/octet-stream';
    }

    // Iniciar la restauración procesando el directorio raíz
    await processDirectory('');

    // Limpiar archivos temporales
    console.log(`[RESTORE] Limpiando archivos temporales: ${tempDir}`);
    fs.rmSync(tempDir, { recursive: true, force: true });

    res.status(200).json({
      success: true,
      message: 'Restauración completada correctamente',
      bucket: bucketToRestore,
      details: {
        metadataRestored: fs.existsSync(dbExportPath),
        filesProcessed: true
      }
    });
  } catch (error) {
    console.error('[RESTORE] Error general:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error al restaurar la copia de seguridad',
      error: error.message
    });
  }
});

// Endpoint simple para verificar si el módulo de backup está funcionando
app.get('/api/admin/backup-status', (req, res) => {
  try {
    // Verificar archivo
    let archiverInstalled = false;
    try {
      require.resolve('archiver');
      archiverInstalled = true;
    } catch (err) {
      console.error('Módulo archiver no encontrado:', err);
    }
    
    res.json({
      success: true,
      status: {
        available: true,
        supabaseConfigured: !!supabase,
        archiverInstalled: archiverInstalled,
        environment: process.env.NODE_ENV || 'development',
        platform: process.platform,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error en endpoint backup-status:', err);
    res.status(500).json({
      success: false,
      message: 'Error al verificar estado',
      error: err.message
    });
  }
});

// Endpoint de prueba con middleware de permisos
app.get('/api/admin/backup-test-with-middleware', hasAdminPermission('manage_backup'), async (req, res) => {
  console.log('[BACKUP_TEST_MIDDLEWARE] Endpoint con middleware llamado');
  console.log('[BACKUP_TEST_MIDDLEWARE] Usuario:', req.username);
  console.log('[BACKUP_TEST_MIDDLEWARE] Rol:', req.userRole);
  console.log('[BACKUP_TEST_MIDDLEWARE] Tipo:', req.userType);
  console.log('[BACKUP_TEST_MIDDLEWARE] Bucket:', req.bucketName);
  
  try {
    // Si llegamos aquí, es porque el middleware permitió el acceso
    res.status(200).json({
      success: true,
      message: 'Acceso permitido por el middleware',
      user: {
        username: req.username,
        role: req.userRole,
        type: req.userType,
        bucket: req.bucketName
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[BACKUP_TEST_MIDDLEWARE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el endpoint de prueba con middleware',
      error: error.message
    });
  }
});

// Rutas para manejar URLs de YouTube

// Obtener URL de YouTube para un archivo

app.get('/api/youtube-url', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar explícitamente que el bucket sea el correcto
    console.log(`[YOUTUBE_URL_GET] Verificando bucketName en request: ${req.bucketName}`);
    console.log(`[YOUTUBE_URL_GET] Verificando username en request: ${req.username}`);
    console.log(`[YOUTUBE_URL_GET] Bucket mapeado para usuario ${req.username}: ${userBucketMap[req.username]}`);
    
    // Validación adicional de seguridad
    if (req.username && userBucketMap[req.username] && req.bucketName !== userBucketMap[req.username]) {
      console.error(`[YOUTUBE_URL_GET] ERROR: Discrepancia de bucket - Usuario ${req.username} debería usar ${userBucketMap[req.username]} pero está usando ${req.bucketName}`);
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: Bucket no válido para este usuario'
      });
    }    
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'No se ha especificado la ruta del archivo'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log(`Obteniendo URL de YouTube para: ${normalizedPath}`);
    
    // Construir la ruta del archivo de metadatos
    const metadataPath = `${normalizedPath}.youtube.metadata`;
    
   // Intentar obtener el archivo de metadatos
   let data, error;
   try {
     const result = await supabase.storage
       .from(bucketToUse)
       .download(metadataPath);
     
     data = result.data;
     error = result.error;
   } catch (downloadError) {
     console.error('Error al intentar descargar metadatos de imagen:', downloadError);
     // No lanzar excepción, simplemente continuar con data=null
   }

    if (!data) {
      return res.status(200).json({
        success: true,
        youtubeUrl: null
      });
    }
    
    // Convertir a texto y parsear JSON
    const text = await data.text();
    const metadata = JSON.parse(text);
    
    return res.status(200).json({
      success: true,
      youtubeUrl: metadata.youtubeUrl || null
    });
  } catch (error) {
    console.error('Error al obtener URL de YouTube:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al obtener URL de YouTube: ${error.message}`,
      error: error.message
    });
  }
});


// Guardar URL de YouTube para un archivo
app.post('/api/youtube-url', express.json(), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
   // Verificamos si el usuario puede modificar URL de YouTube (admin o usuario con permiso específico)
if (req.userRole !== 'admin' && 
  !(req.userType === 'dynamic' && req.adminPermissions && req.adminPermissions.manage_media_links)) {
 return res.status(403).json({
   success: false,
   message: 'No tienes permisos para modificar URL de YouTube.'
 });
}
    
    const { filePath, youtubeUrl } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'No se ha especificado la ruta del archivo'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log(`Guardando URL de YouTube para: ${normalizedPath}`);
    
    // Construir la ruta del archivo de metadatos
    const metadataPath = `${normalizedPath}.youtube.metadata`;
    
    // Crear contenido de metadatos
    const metadata = {
      youtubeUrl: youtubeUrl,
      updatedAt: new Date().toISOString()
    };
    
    // Convertir a JSON
    const metadataContent = JSON.stringify(metadata);
    
   // Si la URL es null o vacía, eliminar el archivo de metadatos si existe
if (!youtubeUrl) {
  const { error } = await supabase.storage
    .from(bucketToUse)
    .remove([metadataPath]);
      
      if (error && error.message !== 'The object was not found') {
        console.error('Error al eliminar metadatos:', error);
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        message: 'URL de YouTube eliminada correctamente'
      });
    }
    
   // Guardar archivo de metadatos
const { error } = await supabase.storage
.from(bucketToUse)
.upload(metadataPath, metadataContent, {
  contentType: 'application/json',
  upsert: true
});
    
    if (error) {
      console.error('Error al guardar metadatos:', error);
      throw error;
    }
    
    return res.status(200).json({
      success: true,
      message: 'URL de YouTube guardada correctamente'
    });
  } catch (error) {
    console.error('Error al guardar URL de YouTube:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al guardar URL de YouTube: ${error.message}`,
      error: error.message
    });
  }
});


// Rutas para manejar URLs de audio MP3

// Obtener URL de audio para un archivo
app.get('/api/audio-url', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'No se ha especificado la ruta del archivo'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log(`Obteniendo URL de audio para: ${normalizedPath}`);
    
    // Construir la ruta del archivo de metadatos
    const metadataPath = `${normalizedPath}.audio.metadata`;
    
 // Intentar obtener el archivo de metadatos
 let data, error;
 try {
   const result = await supabase.storage
     .from(bucketToUse)
     .download(metadataPath);
   
   data = result.data;
   error = result.error;
 } catch (downloadError) {
   console.error('Error al intentar descargar metadatos de audio:', downloadError);
   // No lanzar excepción, simplemente continuar con data=null
 }
    
    if (!data) {
      return res.status(200).json({
        success: true,
        audioUrl: null
      });
    }
    
    // Convertir a texto y parsear JSON
    const text = await data.text();
    const metadata = JSON.parse(text);
    
    return res.status(200).json({
      success: true,
      audioUrl: metadata.audioUrl || null
    });
  } catch (error) {
    console.error('Error al obtener URL de audio:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al obtener URL de audio: ${error.message}`,
      error: error.message
    });
  }
});


// Guardar URL de audio para un archivo
app.post('/api/audio-url', express.json(), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
  // Verificamos si el usuario puede modificar URL de audio (admin o usuario con permiso específico)
if (req.userRole !== 'admin' && 
  !(req.userType === 'dynamic' && req.adminPermissions && req.adminPermissions.manage_media_links)) {
 return res.status(403).json({
   success: false,
   message: 'No tienes permisos para modificar URL de audio.'
 });
}
    
    const { filePath, audioUrl } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'No se ha especificado la ruta del archivo'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log(`Guardando URL de audio para: ${normalizedPath}`);
    
    // Construir la ruta del archivo de metadatos
    const metadataPath = `${normalizedPath}.audio.metadata`;
    
    // Crear contenido de metadatos
    const metadata = {
      audioUrl: audioUrl,
      updatedAt: new Date().toISOString()
    };
    
    // Convertir a JSON
    const metadataContent = JSON.stringify(metadata);
    
   // Si la URL es null o vacía, eliminar el archivo de metadatos si existe
if (!audioUrl) {
  const { error } = await supabase.storage
    .from(bucketToUse)
    .remove([metadataPath]);
      
      if (error && error.message !== 'The object was not found') {
        console.error('Error al eliminar metadatos de audio:', error);
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        message: 'URL de audio eliminada correctamente'
      });
    }
    
    // Guardar archivo de metadatos
const { error } = await supabase.storage
.from(bucketToUse)
.upload(metadataPath, metadataContent, {
  contentType: 'application/json',
  upsert: true
});
    
    if (error) {
      console.error('Error al guardar metadatos de audio:', error);
      throw error;
    }
    
    return res.status(200).json({
      success: true,
      message: 'URL de audio guardada correctamente'
    });
  } catch (error) {
    console.error('Error al guardar URL de audio:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al guardar URL de audio: ${error.message}`,
      error: error.message
    });
  }
});

// Rutas para manejar URLs de imágenes

// Obtener URL de imagen para un archivo
app.get('/api/image-url', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'No se ha especificado la ruta del archivo'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log(`Obteniendo URL de imagen para: ${normalizedPath}`);
    
    // Construir la ruta del archivo de metadatos
    const metadataPath = `${normalizedPath}.image.metadata`;
    
    // Intentar obtener el archivo de metadatos
let data, error;
try {
  const result = await supabase.storage
    .from(bucketToUse)
    .download(metadataPath);
  
  data = result.data;
  error = result.error;
} catch (downloadError) {
  console.error('Error al intentar descargar metadatos de YouTube:', downloadError);
  // No lanzar excepción, simplemente continuar con data=null
}
    
    if (!data) {
      return res.status(200).json({
        success: true,
        imageUrl: null
      });
    }
    
    // Convertir a texto y parsear JSON
    const text = await data.text();
    const metadata = JSON.parse(text);
    
    return res.status(200).json({
      success: true,
      imageUrl: metadata.imageUrl || null
    });
  } catch (error) {
    console.error('Error al obtener URL de imagen:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al obtener URL de imagen: ${error.message}`,
      error: error.message
    });
  }
});

// Guardar URL de imagen para un archivo
app.post('/api/image-url', express.json(), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar permisos - solo admin puede modificar URL de imagen
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para modificar URL de imagen. Se requiere rol de administrador.'
      });
    }
    const { filePath, imageUrl } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'No se ha especificado la ruta del archivo'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log(`Guardando URL de imagen para: ${normalizedPath}`);
    
    // Construir la ruta del archivo de metadatos
    const metadataPath = `${normalizedPath}.image.metadata`;
    
    // Crear contenido de metadatos
    const metadata = {
      imageUrl: imageUrl,
      updatedAt: new Date().toISOString()
    };
    
    // Convertir a JSON
    const metadataContent = JSON.stringify(metadata);
    
    // Si la URL es null o vacía, eliminar el archivo de metadatos si existe
if (!imageUrl) {
  const { error } = await supabase.storage
    .from(bucketToUse)
    .remove([metadataPath]);
      
      if (error && error.message !== 'The object was not found') {
        console.error('Error al eliminar metadatos de imagen:', error);
        throw error;
      }
      
      return res.status(200).json({
        success: true,
        message: 'URL de imagen eliminada correctamente'
      });
    }
    
  // Guardar archivo de metadatos
const { error } = await supabase.storage
.from(bucketToUse)
.upload(metadataPath, metadataContent, {
  contentType: 'application/json',
  upsert: true
});
    
    if (error) {
      console.error('Error al guardar metadatos de imagen:', error);
      throw error;
    }
    
    return res.status(200).json({
      success: true,
      message: 'URL de imagen guardada correctamente'
    });
  } catch (error) {
    console.error('Error al guardar URL de imagen:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al guardar URL de imagen: ${error.message}`,
      error: error.message
    });
  }
});

// Rutas para manejar metadatos de archivos

// Obtener metadatos de un archivo
app.get('/api/file-metadata', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'No se ha especificado la ruta del archivo'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log(`Obteniendo metadatos para: ${normalizedPath}`);
    
    // Construir la ruta del archivo de metadatos
    const metadataPath = `${normalizedPath}.metadata`;
    
    // Intentar obtener el archivo de metadatos
    let data, error;
    try {
      const result = await supabase.storage
        .from(bucketToUse)
        .download(metadataPath);
      
      data = result.data;
      error = result.error;
    } catch (downloadError) {
      console.error('Error al intentar descargar metadatos del archivo:', downloadError);
      // No lanzar excepción, simplemente continuar con data=null
    }
    
    if (!data) {
      // Si no hay metadatos, crear unos predeterminados con la fecha actual
      const currentDate = new Date().toISOString().split('T')[0];
      const defaultMetadata = {
        uploadDate: currentDate,
        fileDate: currentDate,
        uploadedBy: req.username || 'admin1',
        tags: [],
        lastModified: currentDate
      };
      
      return res.status(200).json({
        success: true,
        metadata: defaultMetadata
      });
    }
    
    // Convertir a texto y parsear JSON
    const text = await data.text();
    const metadata = JSON.parse(text);
    
    return res.status(200).json({
      success: true,
      metadata: metadata
    });
  } catch (error) {
    console.error('Error al obtener metadatos del archivo:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al obtener metadatos del archivo: ${error.message}`,
      error: error.message
    });
  }
});

// Guardar metadatos de un archivo
app.post('/api/file-metadata', express.json(), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar permisos - solo admin puede modificar metadatos
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para modificar metadatos. Se requiere rol de administrador.'
      });
    }
    
    const { filePath, metadata } = req.body;
    
    if (!filePath || !metadata) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la ruta del archivo y los metadatos'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log(`Guardando metadatos para: ${normalizedPath}`);
    
    // Construir la ruta del archivo de metadatos
    const metadataPath = `${normalizedPath}.metadata`;
    
    // Asegurar que metadata tenga la fecha de última modificación actualizada
// y manejar correctamente la fecha del archivo (fileDate)
const updatedMetadata = {
  ...metadata,
  lastModified: new Date().toISOString().split('T')[0] // Solo la fecha sin hora para lastModified
};

// Si fileDate incluye hora, asegurarse de que se mantenga así,
// si no, dejar la fecha simple YYYY-MM-DD
if (updatedMetadata.fileDate && !updatedMetadata.fileDate.includes('T')) {
  // Si solo es una fecha sin hora, dejarla tal cual
  // Esto evita problemas de ajuste de zona horaria
}

// Convertir a JSON
const metadataContent = JSON.stringify(updatedMetadata);
    
    // Guardar archivo de metadatos
    const { error } = await supabase.storage
      .from(bucketToUse)
      .upload(metadataPath, metadataContent, {
        contentType: 'application/json',
        upsert: true
      });
    
    if (error) {
      console.error('Error al guardar metadatos:', error);
      throw error;
    }
    
    return res.status(200).json({
      success: true,
      message: 'Metadatos guardados correctamente'
    });
  } catch (error) {
    console.error('Error al guardar metadatos del archivo:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al guardar metadatos del archivo: ${error.message}`,
      error: error.message
    });
  }
});

// Modificación en la ruta de listado de archivos para ocultar archivos de metadatos

app.get('/api/files', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente. Verifica las variables de entorno SUPABASE_URL y SUPABASE_KEY.'
      });
    }
    
    // Extracción de información del token de autenticación
    const authHeader = req.headers.authorization;
    let username = null;
    let userType = 'static';
    let userRole = 'guest';
    let userFolders = [];
    let bucketToUse = defaultBucketName;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        console.log(`[FILES] Token recibido: ${token}`);
        
        const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
        console.log(`[FILES] Token decodificado:`, JSON.stringify(tokenData));
        
        // Determinar tipo de usuario y configuración
        if (tokenData.username) {
          username = tokenData.username;
          
          if (tokenData.type === 'dynamic') {
            // Usuario dinámico
            userType = 'dynamic';
            userRole = 'user';
            userFolders = tokenData.folders || [];
            bucketToUse = tokenData.bucket || defaultBucketName;
            console.log(`[FILES] Usuario dinámico ${username} con bucket ${bucketToUse} y ${userFolders.length} carpetas asignadas`);
            console.log(`[FILES] Carpetas asignadas: ${JSON.stringify(userFolders)}`);
          } else {
            // Usuario estático
            if (userBucketMap[username]) {
              bucketToUse = userBucketMap[username];
              userRole = userRoleMap[username] || 'user';
            }
            console.log(`[FILES] Usuario estático ${username} con bucket ${bucketToUse} y rol ${userRole}`);
          }
        }
      } catch (error) {
        console.error('[FILES] Error al procesar token:', error);
      }
    } else {
      console.log(`[FILES] No hay token de autorización, usando bucket predeterminado ${bucketToUse}`);
    }
    
    const prefix = req.query.prefix || '';
    
    // Normalizar el prefijo
    let normalizedPrefix = prefix;
    if (normalizedPrefix.startsWith('/')) {
      normalizedPrefix = normalizedPrefix.substring(1);
    }
    
    console.log(`[FILES] Listando archivos con prefijo: "${normalizedPrefix}" en bucket: ${bucketToUse}`);
    console.log(`[FILES] Usuario: ${username || 'invitado'}, Tipo: ${userType}`);
    
    // VERIFICACIÓN DE PERMISOS PARA USUARIOS DINÁMICOS
    if (userType === 'dynamic') {
      // Si estamos en la raíz, solo mostrar carpetas a las que tiene acceso
      if (!normalizedPrefix) {
        console.log(`[FILES] Usuario dinámico ${username} accediendo a raíz del bucket ${bucketToUse}`);
        
        // Obtener todas las carpetas del bucket para filtrar
        const { data, error } = await supabase.storage
          .from(bucketToUse)
          .list('', {
            sortBy: { column: 'name', order: 'asc' }
          });
          
        if (error) {
          console.error('[FILES] Error al listar directorio raíz:', error);
          throw error;
        }
        
        // Filtrar solo las carpetas a las que el usuario tiene acceso
        const permittedFolders = data
          .filter(item => {
            // Solo mostrar carpetas (no archivos) en la raíz
            if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
              const folderName = item.name;
              
           // Verificar si esta carpeta está en la lista de carpetas permitidas
for (const allowedFolder of userFolders) {
  // Ignorar elementos que no son cadenas (como el objeto de permisos)
  if (typeof allowedFolder !== 'string') continue;
  
  // Eliminar / inicial si existe
  const cleanAllowedFolder = allowedFolder.startsWith('/') 
    ? allowedFolder.substring(1) 
    : allowedFolder;
  
  // Si la carpeta actual es exactamente una permitida o es un padre de una permitida
  if (cleanAllowedFolder === folderName || 
      cleanAllowedFolder.startsWith(folderName + '/')) {
    return true;
  }
}

              return false; // No mostrar carpetas a las que no tiene acceso
            }
            return false; // No mostrar archivos en la raíz para usuarios dinámicos
          })
          .filter(item => item.name !== '.folder') // Filtramos archivos de sistema
          .map(item => {
            return {
              name: item.name,
              path: `/${item.name}`,
              size: (item.metadata && item.metadata.size) || 0,
              contentType: (item.metadata && item.metadata.mimetype) || 'application/octet-stream',
              updated: item.updated_at,
              isFolder: true // En la raíz, solo mostramos carpetas para usuarios dinámicos
            };
          });
        
        return res.status(200).json(permittedFolders);
      } else {
        // Estamos en una subcarpeta, verificar permisos
        let hasPermission = false;
        
        // Verificar si la carpeta actual está permitida
for (const folder of userFolders) {
  // Ignorar elementos que no son cadenas (como el objeto de permisos)
  if (typeof folder !== 'string') continue;
  
  // Normalizar carpeta permitida
  const normalizedFolder = folder.startsWith('/') ? folder.substring(1) : folder;
  
  // La carpeta actual debe ser exactamente una permitida o una subcarpeta de una permitida
  if (normalizedPrefix === normalizedFolder || 
      normalizedPrefix.startsWith(normalizedFolder + '/')) {
    hasPermission = true;
    break;
  }
}
        
        // Si no tiene permiso, devolver error de acceso denegado
        if (!hasPermission) {
          console.log(`[FILES] ACCESO DENEGADO: Usuario ${username} intentó acceder a ${normalizedPrefix} en bucket ${bucketToUse}`);
          return res.status(403).json({
            success: false,
            message: 'No tienes permiso para acceder a esta carpeta'
          });
        }
      }
    }
    
    // Proceder con la lista de archivos (tanto para usuarios estáticos como dinámicos)
    const { data, error } = await supabase.storage
      .from(bucketToUse)
      .list(normalizedPrefix, {
        sortBy: { column: 'name', order: 'asc' }
      });
      
    console.log(`[FILES] Respuesta de Supabase para ${bucketToUse}/${normalizedPrefix}: ${error ? 'ERROR' : 'Éxito'}, ${data ? data.length : 0} elementos`);

    if (error) {
      throw error;
    }
    
    // Filtrar contenido según tipo de usuario
    let formattedFiles = data
      .filter(item => {
        // Filtrar archivos de sistema y metadatos
        return !item.name.endsWith('.youtube.metadata') && 
               !item.name.endsWith('.audio.metadata') && 
               !item.name.endsWith('.image.metadata') &&
               !item.name.endsWith('.access.metadata') &&
               item.name !== '.folder';
      })
      .map(item => {
        // Identificar si es carpeta o archivo
        const isFolder = !item.metadata || item.metadata.mimetype === 'application/x-directory';
        
        return {
          name: item.name,
          path: normalizedPrefix ? `/${normalizedPrefix}/${item.name}` : `/${item.name}`,
          size: (item.metadata && item.metadata.size) || 0,
          contentType: (item.metadata && item.metadata.mimetype) || 'application/octet-stream',
          updated: item.updated_at,
          isFolder: isFolder
        };
      });

    // Para usuarios dinámicos en subcarpetas, verificar contenido adicional
    if (userType === 'dynamic' && normalizedPrefix) {
      // Filtrar adicionalmente si es una subcarpeta para asegurar que solo ve archivos en carpetas permitidas

      formattedFiles = formattedFiles.filter(item => {
        const itemFullPath = item.path.startsWith('/') ? item.path.substring(1) : item.path;
        
        // Si es una carpeta, verificar que al menos una carpeta permitida comience con esta ruta
        if (item.isFolder) {
          for (const folder of userFolders) {
            // Ignorar elementos que no son cadenas (como el objeto de permisos)
            if (typeof folder !== 'string') continue;
            
            const normalizedFolder = folder.startsWith('/') ? folder.substring(1) : folder;
            if (normalizedFolder === itemFullPath || normalizedFolder.startsWith(itemFullPath + '/')) {
              return true;
            }
          }
        } 
        // Para archivos, la verificación ya se hizo en la ruta padre
        return !item.isFolder || true;
      });
    }

    res.status(200).json(formattedFiles);
  } catch (error) {
    console.error('Error al listar archivos:', error);
    
    res.status(500).json({
      success: false,
      message: `Error al listar archivos: ${error.message}`,
      error: error.message
    });
  }
});

// Endpoint para visualizar archivos DOCX como HTML


app.get('/api/view-docx', async (req, res) => {
  console.log('==========================================');
  console.log('ENDPOINT VIEW-DOCX LLAMADO');
  console.log('==========================================');
  console.log('Query parameters completos:', req.query);
  console.log('Path del documento:', req.query.path);
  console.log('URL del documento:', req.query.url);
  console.log('Token recibido:', req.query.token);
  console.log('Headers completos:', req.headers);
  console.log('==========================================');
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    let buffer;
    
    // Manejar tanto la forma antigua (path) como la nueva (url)
    if (req.query.path) {

      // Método original usando path
    console.log('Usando path para acceder al documento:', req.query.path);
    
    // Determinar el bucket correcto a usar
    let bucketToUse = req.bucketName || defaultBucketName;
    let userType = req.userType || 'static';
    
    // Si hay un token en la URL, procesarlo
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[VIEW_DOCX] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        // Verificar si es un usuario dinámico o estático
        if (tokenData.type === 'dynamic') {
          userType = 'dynamic';
          // Para usuarios dinámicos, usar el bucket especificado en el token
          if (tokenData.bucket) {
            bucketToUse = tokenData.bucket;
            console.log(`[VIEW_DOCX] Usuario dinámico ${tokenData.username} usando bucket ${bucketToUse} desde token`);
          }
          
          // Actualizar req para validaciones posteriores
          req.username = tokenData.username;
          req.userRole = 'user';
          req.userType = 'dynamic';
          req.userFolders = tokenData.folders || [];
          req.bucketName = bucketToUse;
        } else {
          // Para usuarios estáticos
          if (tokenData.username && userBucketMap[tokenData.username]) {
            const tokenBucket = userBucketMap[tokenData.username];
            console.log(`[VIEW_DOCX] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token`);
            bucketToUse = tokenBucket;
            
            // Actualizar req para validaciones posteriores
            req.username = tokenData.username;
            req.userRole = userRoleMap[tokenData.username] || 'user';
            req.bucketName = bucketToUse;
          }
        }
      } catch (tokenError) {
        console.error('[VIEW_DOCX] Error al decodificar token de URL:', tokenError);
      }
    }
    
    console.log(`[VIEW_DOCX] Tipo de usuario: ${userType}`);
    console.log(`[VIEW_DOCX] Bucket a usar: ${bucketToUse}`);
    
    // Verificar permisos para usuarios dinámicos
if (userType === 'dynamic' && req.userFolders && req.userFolders.length > 0) {
  const filePath = req.query.path;
  if (filePath) {
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    // Verificar si está en carpeta permitida
    let hasPermission = false;
    
    // Revisar en todas las carpetas permitidas (incluyendo objetos especiales)
    for (const folder of req.userFolders) {
      // Ignorar objetos de permisos administrativos
      if (typeof folder === 'object' && folder.type === 'admin_permissions') {
        continue;
      }
      
      // Normalizar carpeta permitida
      const normalizedFolder = typeof folder === 'string' && folder.startsWith('/') 
        ? folder.substring(1) 
        : folder;
      
      // Verificar solo si es una cadena (string)
      if (typeof normalizedFolder === 'string') {
        // El archivo debe estar dentro de una carpeta permitida
        if (normalizedPath === normalizedFolder || 
            normalizedPath.startsWith(normalizedFolder + '/')) {
          hasPermission = true;
          break;
        }
      }
    }
    
    // Si no tiene permiso, denegar acceso
    if (!hasPermission) {
      console.log(`[VIEW_DOCX] ACCESO DENEGADO: Usuario ${req.username} intentó acceder a ${normalizedPath} en bucket ${bucketToUse}`);
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para acceder a este archivo'
      });
    }
  }
}      
      const filePath = req.query.path;
      
      if (!filePath) {
        return res.status(400).json({
          success: false,
          message: 'No se ha especificado la ruta del archivo'
        });
      }
      
      // Normalizar la ruta
      let normalizedPath = filePath;
      if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1);
      }
      
      console.log(`Procesando DOCX para visualización: ${normalizedPath}`);
      
      // Descargar el archivo DOCX de Supabase
      const { data, error } = await supabase.storage
        .from(bucketToUse)
        .download(normalizedPath);
      
      if (error) {
        console.error('Error al descargar DOCX con path:', error);
        throw error;
      }
      
      if (!data) {
        return res.status(404).json({
          success: false,
          message: 'Archivo no encontrado'
        });
      }
      
      // Convertir el arrayBuffer a Buffer para mammoth
      buffer = Buffer.from(await data.arrayBuffer());
      
    } else if (req.query.url) {
      // Nuevo método usando url directa
      console.log('Usando URL para acceder al documento:', req.query.url);
      
      // Validar el token de autenticación si está presente
      if (req.query.token) {
        console.log('Token de autenticación proporcionado:', req.query.token);
        
        try {
          const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
          console.log('Token decodificado:', JSON.stringify(tokenData));
          
          // Aquí podrías hacer validaciones adicionales con el token si es necesario
        } catch (tokenError) {
          console.error('Error al decodificar token:', tokenError);
        }
      }
      
      // Descargar el archivo usando fetch desde la URL proporcionada
      try {
        console.log('Descargando documento desde URL externa');
        const response = await fetch(req.query.url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        console.log('Documento descargado correctamente desde URL, tamaño:', buffer.length);
        
      } catch (fetchError) {
        console.error('Error al descargar documento desde URL:', fetchError);
        return res.status(500).json({
          success: false,
          message: 'Error al descargar el documento desde la URL proporcionada',
          error: fetchError.message
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un parámetro "path" o "url" para identificar el documento'
      });
    }
    
    console.log('Buffer creado correctamente, tamaño:', buffer.length);
    
    // Importar mammoth
    const mammoth = require('mammoth');
    console.log('Librería mammoth importada correctamente');
    
    try {
      // Convertir DOCX a HTML con manejo de error mejorado
      console.log('Iniciando conversión DOCX a HTML...');
      const result = await mammoth.convertToHtml({ buffer });
      console.log('Conversión DOCX a HTML completada');
      
      const html = result.value;
      
      // Obtener el nombre del archivo para el título
      const fileName = req.query.path 
        ? path.basename(req.query.path)
        : 'Documento';
      
      // Enviar el HTML con estilos adicionales
      res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Visor de Documentos - ${fileName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              margin: 0;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
              background-color: #f5f5f5;
            }
            h1, h2, h3, h4, h5, h6 {
              color: #333;
              margin-top: 24px;
              margin-bottom: 16px;
            }
            p {
              margin-bottom: 16px;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 16px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
            }
            th {
              background-color: #f2f2f2;
              text-align: left;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .document-container {
              background-color: white;
              padding: 40px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="document-container">
            ${html}
          </div>
        </body>
        </html>
      `);
      
    } catch (mammothError) {
      console.error('Error detallado al convertir DOCX a HTML:', mammothError);
      console.error('Tipo de error:', typeof mammothError);
      console.error('Stack trace:', mammothError.stack);
      
      return res.status(500).json({
        success: false,
        message: 'Error al convertir el documento',
        error: JSON.stringify(mammothError, Object.getOwnPropertyNames(mammothError))
      });
    }
    
  } catch (error) {
    console.error('Error general en view-docx:', error);
    console.error('Tipo de error:', typeof error);
    console.error('Stack trace:', error.stack);
    
    return res.status(500).json({
      success: false,
      message: 'Error al procesar el documento',
      error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
  }
});


// Endpoint de diagnóstico para verificar la conectividad con Supabase
app.get('/api/diagnose', async (req, res) => {
  console.log('Ejecutando diagnóstico de conectividad con Supabase...');
  
  try {
    // 1. Intentar resolver el nombre DNS de Supabase
    const dns = require('dns').promises;
    let dnsResult;
    
    try {
      dnsResult = await dns.lookup(supabaseUrl.replace('https://', ''));
      console.log('Resolución DNS exitosa:', dnsResult);
    } catch (dnsError) {
      console.error('Error en resolución DNS:', dnsError);
      dnsResult = { error: dnsError.message };
    }
    
    // 2. Intentar establecer conexión HTTP básica
    let pingResult;
    try {
      const pingStart = Date.now();
      const pingResponse = await fetch(supabaseUrl);
      const pingTime = Date.now() - pingStart;
      
      pingResult = {
        success: pingResponse.ok,
        status: pingResponse.status,
        statusText: pingResponse.statusText,
        time: pingTime + 'ms'
      };
      
      console.log('Ping HTTP exitoso:', pingResult);
    } catch (pingError) {
      console.error('Error en ping HTTP:', pingError);
      pingResult = { error: pingError.message };
    }
    
    // 3. Intentar listar buckets (prueba de autenticación)
    let bucketsResult;
    try {
      const { data, error } = await supabase.storage.listBuckets();
      
      if (error) {
        throw error;
      }
      
      bucketsResult = {
        success: true,
        bucketCount: data.length,
        buckets: data.map(b => b.name)
      };
      
      console.log('Listado de buckets exitoso:', bucketsResult);
    } catch (bucketsError) {
      console.error('Error en listado de buckets:', bucketsError);
      bucketsResult = { error: bucketsError.message };
    }
    
    // 4. Intentar listar archivos en el bucket específico
let filesResult;
try {
  const bucketToCheck = req.bucketName || defaultBucketName;
  const { data, error } = await supabase.storage
    .from(bucketToCheck)
    .list('', { limit: 5 });  
      if (error) {
        throw error;
      }
      
      filesResult = {
        success: true,
        fileCount: data.length,
        sample: data.slice(0, 3).map(f => f.name)
      };
      
      console.log('Listado de archivos exitoso:', filesResult);
    } catch (filesError) {
      console.error('Error en listado de archivos:', filesError);
      filesResult = { error: filesError.message };
    }
    
    // Devolver resultados completos
    res.json({
      timestamp: new Date().toISOString(),
      supabaseUrl: supabaseUrl,
      supabaseKeyConfigured: !!supabaseKey,
      bucketName: bucketName,
      dns: dnsResult,
      ping: pingResult,
      buckets: bucketsResult,
      files: filesResult
    });
    
  } catch (error) {
    console.error('Error general en diagnóstico:', error);
    res.status(500).json({
      success: false,
      message: 'Error al ejecutar diagnóstico',
      error: error.message
    });
  }
});


// Endpoint de autenticación
app.post('/api/login', express.json(), async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Credenciales válidas (estas pueden ser actualizadas aquí)
    const validCredentials = {
      // Bucket master
      'admin': 'olga811880',     // Cambiada de 'Pana811880' a 'Panica811880'
      'usuario123': 'usuario123',  
      
      // Bucket contenedor001
      'admin1': 'Panica811880',       // Cambiada de 'admin1' a 'df14T87lk44aqL'
      'usuario001': 'turpial1720', // Cambiada
      
      // Bucket contenedor002
      'admin2': 'ff447EEdf441dP',       // Cambiada
      'usuario002': 'leonidas4780', // Cambiada
      
      // Bucket contenedor003
      'admin3': 'd44UYTddcws12',       // Cambiada
      'usuario003': 'flor785412', // Cambiada
      
      // Bucket contenedor004
      'admin4': 'vfHHdM7441eSw',       // Cambiada
      'usuario004': 'montes4128', // Cambiada
      
      // Bucket contenedor005
      'admin5': 'fdr11IUYTs1a',       // Cambiada
      'usuario005': 'palomita47401', // Cambiada
      
      // Bucket contenedor006
      'admin6': 'fffYe147787sa',       // Cambiada
      'usuario006': 'dia2147846', // Cambiada
      
      // Bucket contenedor007
      'admin7': '4517lkd0TRE',       // Cambiada
      'usuario007': 'mesa10378', // Cambiada
      
      // Bucket contenedor008
      'admin8': 'l718dUYsc4f',       // Cambiada
      'usuario008': 'car4472', // Cambiada
      
      // Bucket contenedor009
      'admin9': '4de7I1de5R',       // Cambiada
      'usuario009': 'us14701', // Cambiada
      
      // Bucket contenedor010
      'admin10': '44dwOuyr01',     // Cambiada
      'usuario010': 'sol4710', // Cambiada
      
      // Nuevos usuarios para buckets adicionales
      // Bucket contenedor011
      'admin11': 'ClaveSegura11',
      'usuario011': 'Usuario011Clave',
      
      // Bucket contenedor012
      'admin12': 'ClaveSegura12',
      'usuario012': 'Usuario012Clave',
      
      // Bucket contenedor013
      'admin13': 'ClaveSegura13',
      'usuario013': 'Usuario013Clave',
      
      // Bucket pruebas
      'adminpruebas': 'ClavePruebas',
      'userpruebas': 'UserPruebas',
    
      // Bucket personal1
      'adminpersonal1': 'Jh811881',
      'usuariopersonal1': '811880'
    };

    // Primero verificar usuarios estáticos
    if (validCredentials[username] && validCredentials[username] === password) {
      // Determinar el bucket y rol del usuario
      const userBucket = userBucketMap[username] || defaultBucketName;
      const userRole = userRoleMap[username] || 'user';
      
      console.log(`Usuario estático ${username} autenticado con rol ${userRole} para bucket ${userBucket}`);
      
      // Generar token con información del usuario
      const token = Buffer.from(JSON.stringify({
        username: username,
        role: userRole,
        bucket: userBucket,
        type: 'static'
      })).toString('base64');
      
      // Credenciales correctas
      res.status(200).json({
        success: true,
        user: {
          username: username,
          role: userRole,
          bucket: userBucket,
          type: 'static'
        },
        token: token
      });
    } else {
      
              // Verificar usuarios dinámicos (en la base de datos)
console.log(`Usuario ${username} no encontrado en usuarios estáticos, verificando en BD...`);

const user = await getUserByUsername(username);

if (user && await comparePassword(password, user.password_hash)) {
  // Verificar explícitamente que el bucket asignado al usuario sea válido
  if (!user.bucket) {
    console.error(`Error: Usuario dinámico ${username} no tiene bucket asignado`);
    return res.status(401).json({
      success: false,
      message: 'Error de configuración: Usuario no tiene bucket asignado'
    });
  }
  
  // Asegurar que se use el bucket correcto del creador del usuario
  // Buscar el bucket del admin que creó este usuario
  let bucketToUse = user.bucket;
  const createdBy = user.created_by;
  
  // Si el creador del usuario es un admin estático, obtener su bucket del mapa
  if (createdBy && userBucketMap[createdBy]) {
    bucketToUse = userBucketMap[createdBy];
    console.log(`[LOGIN] Corrigiendo bucket: usuario creado por ${createdBy}, usando su bucket: ${bucketToUse}`);
  }
  
  console.log(`Usuario dinámico ${username} autenticado para bucket ${bucketToUse} (original: ${user.bucket})`);
  console.log(`Carpetas asignadas: ${JSON.stringify(user.assigned_folders || [])}`);
  
  // Construir información de carpetas asignadas
  const userFolders = user.assigned_folders || [];
  
  // Generar token con información del usuario
  const token = Buffer.from(JSON.stringify({
    username: user.username,
    role: 'user', // Los usuarios dinámicos siempre tienen rol 'user'
    bucket: bucketToUse, // Usar el bucket del creador, no el del usuario
    folders: userFolders,
    createdBy: user.created_by,
    type: 'dynamic',
    userId: user.id
  })).toString('base64');
        
        // Log adicional para depuración
        console.log(`[LOGIN] Éxito: Usuario dinámico ${user.username}`);
        console.log(`[LOGIN] Bucket asignado: ${user.bucket}`);
        console.log(`[LOGIN] Carpetas permitidas: ${JSON.stringify(userFolders)}`);
        
        // Credenciales correctas
        const responseData = {
          success: true,
          user: {
            username: user.username,
            role: 'user',
            bucket: user.bucket,
            folders: userFolders,
            createdBy: user.created_by,
            type: 'dynamic',
            userId: user.id
          },
          token: token
        };
        
        console.log(`[LOGIN] Respuesta: ${JSON.stringify(responseData)}`);
        res.status(200).json(responseData);

      } else {
        // Credenciales incorrectas
        console.log(`Intento de autenticación fallido para usuario: ${username}`);
        res.status(401).json({
          success: false,
          message: 'Nombre de usuario o contraseña incorrectos'
        });
      }
    }
  } catch (error) {
    console.error('Error en autenticación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno durante la autenticación'
    });
  }
});


// Endpoint para obtener el tamaño actual del bucket
app.get('/api/bucket-size', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }

    // Verificar permisos - solo admin puede ver las estadísticas
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver estadísticas de almacenamiento. Se requiere rol de administrador.'
      });
    }

    // Obtener el nombre del bucket desde el middleware
    const bucketToCheck = req.bucketName || defaultBucketName;
    
    console.log(`Calculando tamaño total del bucket: ${bucketToCheck}`);
    const totalSizeBytes = await calculateBucketSize(bucketToCheck);
    const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
    
    // Obtener el tamaño máximo para este bucket específico (en MB)
    const maxSizeMB = bucketSizeMap[bucketToCheck] || defaultBucketMaxSize;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    const percentUsed = ((totalSizeBytes / maxSizeBytes) * 100).toFixed(2);
    const remainingMB = (maxSizeMB - parseFloat(totalSizeMB)).toFixed(2);
    
    res.status(200).json({
      success: true,
      bucket: bucketToCheck,
      sizeBytes: totalSizeBytes,
      sizeMB: parseFloat(totalSizeMB),
      maxSizeMB: maxSizeMB,
      percentUsed: parseFloat(percentUsed),
      remainingMB: parseFloat(remainingMB)
    });
  } catch (error) {
    console.error(`Error al calcular tamaño del bucket ${req.bucketName}:`, error);
    
    res.status(500).json({
      success: false,
      message: `Error al calcular tamaño del bucket: ${error.message}`,
      error: error.message
    });
  }
});
// Nuevo endpoint simplificado para visualizar documentos DOCX
app.get('/api/docx-viewer', async (req, res) => {
  console.log('==========================================');
  console.log('ENDPOINT DOCX-VIEWER LLAMADO');
  console.log('==========================================');
  console.log('Query parameters completos:', req.query);
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).send('Error: Cliente de Supabase no configurado correctamente.');
    }
    
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).send('Error: No se ha especificado la ruta del archivo');
    }
    
    // Obtener el bucket específico del token si está disponible
    let bucketToUse = defaultBucketName;
    let userType = 'static';
    let userFolders = [];
    
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log('Token decodificado:', JSON.stringify(tokenData));
        
        // Verificar si es un usuario dinámico o estático
        if (tokenData.type === 'dynamic') {
          userType = 'dynamic';
          // Para usuarios dinámicos, usar el bucket especificado en el token
          if (tokenData.bucket) {
            bucketToUse = tokenData.bucket;
            console.log(`Usuario dinámico ${tokenData.username} usando bucket ${bucketToUse} desde token`);
          }
          
          // Guardar información de carpetas para verificación de permisos
          userFolders = tokenData.folders || [];
          console.log(`Carpetas permitidas: ${JSON.stringify(userFolders)}`);
        } else {
          // Para usuarios estáticos
          if (tokenData.username && userBucketMap[tokenData.username]) {
            bucketToUse = userBucketMap[tokenData.username];
            console.log(`Usuario estático ${tokenData.username} usando bucket ${bucketToUse} desde token`);
          }
        }
      } catch (tokenError) {
        console.error('Error al decodificar token:', tokenError);
      }
    }
    
    // Verificar permisos para usuarios dinámicos
    if (userType === 'dynamic' && userFolders.length > 0) {
      const filePath = req.query.path;
      if (filePath) {
        // Normalizar la ruta
        let normalizedPath = filePath;
        if (normalizedPath.startsWith('/')) {
          normalizedPath = normalizedPath.substring(1);
        }
        
        // Verificar si está en carpeta permitida
        let hasPermission = false;
        for (const folder of userFolders) {
          // Normalizar carpeta permitida
          const normalizedFolder = folder.startsWith('/') ? folder.substring(1) : folder;
          
          // El archivo debe estar dentro de una carpeta permitida
          if (normalizedPath === normalizedFolder || 
              normalizedPath.startsWith(normalizedFolder + '/')) {
            hasPermission = true;
            break;
          }
        }
        
        // Si no tiene permiso, denegar acceso
        if (!hasPermission) {
          console.log(`ACCESO DENEGADO: Intento de acceder a ${normalizedPath} en bucket ${bucketToUse}`);
          return res.status(403).send('Acceso denegado: No tienes permiso para ver este archivo');
        }
      }
    }
    
    console.log(`Descargando DOCX desde ${bucketToUse}/${filePath}`);
    
    // Descargar el archivo DOCX de Supabase
    const { data, error } = await supabase.storage
      .from(bucketToUse)
      .download(filePath);
    
    if (error) {
      console.error('Error al descargar DOCX:', error);
      return res.status(500).send(`Error al descargar el documento: ${error.message}`);
    }
    
    if (!data) {
      return res.status(404).send('Archivo no encontrado');
    }
    
    // Convertir el arrayBuffer a Buffer para mammoth
    const buffer = Buffer.from(await data.arrayBuffer());
    console.log('Buffer creado correctamente, tamaño:', buffer.length);
    
    // Importar mammoth
    const mammoth = require('mammoth');
    
    // Convertir DOCX a HTML
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;
    
    // Enviar el HTML directamente
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Visor de Documentos - ${filePath}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            background-color: #f5f5f5;
          }
          h1, h2, h3, h4, h5, h6 {
            color: #333;
            margin-top: 24px;
            margin-bottom: 16px;
          }
          p {
            margin-bottom: 16px;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 16px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
          }
          th {
            background-color: #f2f2f2;
            text-align: left;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .document-container {
            background-color: white;
            padding: 40px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="document-container">
          ${html}
        </div>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Error general en docx-viewer:', error);
    res.status(500).send(`Error al procesar el documento: ${error.message}`);
  }
});


// Crear un nuevo usuario (solo administradores)
app.post('/api/admin/create-user', isAdmin, express.json(), async (req, res) => {
  try {
    const adminUsername = req.username;
    const adminBucket = req.bucketName;
    
    if (!adminUsername || !adminBucket) {
      return res.status(401).json({
        success: false,
        message: 'No se pudo identificar al administrador'
      });
    }
    
    const { username, password, assigned_folders, group_name, admin_permissions } = req.body;
    
    // Validar datos requeridos
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere nombre de usuario y contraseña'
      });
    }
    
    // Verificar si el usuario ya existe
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'El nombre de usuario ya está en uso'
      });
    }
    
    // Encriptar contraseña
    const password_hash = await hashPassword(password);
    
    // Crear nuevo usuario
    const userData = {
      username,
      password_hash,
      bucket: adminBucket, // Usar el mismo bucket del administrador
      created_by: adminUsername,
      assigned_folders: assigned_folders || [],
      group_name: group_name || null,
      active: true
    };
    
    // Añadir los permisos administrativos a las carpetas asignadas
    // Almacenaremos los permisos en la primera posición del array de carpetas asignadas
    if (admin_permissions && Object.keys(admin_permissions).length > 0) {
      userData.assigned_folders = [
        { type: 'admin_permissions', permissions: admin_permissions },
        ...(userData.assigned_folders || [])
      ];
    }
    
    // Verificación adicional del bucket
    console.log(`[CREATE_USER] Creando usuario ${username} en bucket ${adminBucket}`);
    console.log(`[CREATE_USER] Carpetas asignadas: ${JSON.stringify(userData.assigned_folders || [])}`);
    
    if (!adminBucket) {
      return res.status(400).json({
        success: false,
        message: 'Error: No se pudo determinar el bucket para el nuevo usuario'
      });
    }
    
    const result = await createUser(userData);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al crear el usuario',
        error: result.error
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado correctamente',
      user: {
        id: result.data[0].id,
        username: result.data[0].username,
        bucket: result.data[0].bucket,
        assigned_folders: result.data[0].assigned_folders,
        group_name: result.data[0].group_name,
        created_at: result.data[0].created_at,
        admin_permissions: admin_permissions || {}
      }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al crear usuario',
      error: error.message
    });
  }
});

// Listar usuarios creados por el administrador actual
// Listar usuarios para el bucket del administrador actual
app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const adminUsername = req.username;
    const adminBucket = req.bucketName;
    const requestedBucket = req.query.bucket;
    
    if (!adminUsername) {
      return res.status(401).json({
        success: false,
        message: 'No se pudo identificar al administrador'
      });
    }
    
    // Determinar qué bucket usar para filtrar
    const bucketToFilter = requestedBucket || adminBucket;
    
    console.log(`[GET_USERS] Listando usuarios para bucket: ${bucketToFilter}, solicitado por admin: ${adminUsername}`);
    
    try {
      // Consulta directa a Supabase para obtener todos los usuarios del bucket
      const { data: users, error } = await supabase
        .from('user_accounts')
        .select('*')
        .eq('bucket', bucketToFilter);
      
      if (error) {
        console.error('[GET_USERS] Error al consultar usuarios en Supabase:', error);
        return res.status(500).json({
          success: false,
          message: 'Error al obtener usuarios',
          error: error.message
        });
      }
      
      console.log(`[GET_USERS] Encontrados ${users ? users.length : 0} usuarios para bucket ${bucketToFilter}`);
      
      // Log detallado para depuración
      if (users && users.length > 0) {
        console.log('[GET_USERS] Primeros 5 usuarios:');
        users.slice(0, 5).forEach(user => {
          console.log(`- ${user.username} (bucket: ${user.bucket}, active: ${user.active})`);
        });
      } else {
        console.log('[GET_USERS] ADVERTENCIA: No se encontraron usuarios para este bucket');
      }
      
      // Filtrar información sensible como contraseñas
      const usersData = users.map(user => ({
        id: user.id,
        username: user.username,
        bucket: user.bucket,
        assigned_folders: user.assigned_folders,
        group_name: user.group_name,
        created_at: user.created_at,
        active: user.active
      }));
      
      res.status(200).json({
        success: true,
        users: usersData
      });
    } catch (queryError) {
      console.error('[GET_USERS] Error en consulta directa:', queryError);
      
      // Plan B: Intentar con la función existente
      console.log('[GET_USERS] Intentando con función getUsersByAdminAndBucket como plan B');
      const result = await getUsersByAdminAndBucket(adminUsername, bucketToFilter);
      
      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Error al obtener usuarios',
          error: result.error
        });
      }
      
      const usersData = result.data.map(user => ({
        id: user.id,
        username: user.username,
        bucket: user.bucket,
        assigned_folders: user.assigned_folders,
        group_name: user.group_name,
        created_at: user.created_at,
        active: user.active
      }));
      
      res.status(200).json({
        success: true,
        users: usersData
      });
    }
  } catch (error) {
    console.error('Error general al listar usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al listar usuarios',
      error: error.message
    });
  }
});

// Actualizar un usuario existente
app.patch('/api/admin/update-user/:id', isAdmin, express.json(), async (req, res) => {
  try {
    const adminUsername = req.username;
    const userId = req.params.id;
    
    if (!adminUsername) {
      return res.status(401).json({
        success: false,
        message: 'No se pudo identificar al administrador'
      });
    }
    
    // Obtener usuario existente
    const { data: existingUser, error: userError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError || !existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: userError?.message
      });
    }
    
    // Verificar que el usuario pertenezca a este administrador
    if (existingUser.created_by !== adminUsername) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar este usuario'
      });
    }
    
    // Preparar datos a actualizar
    const updateData = {};
    
    // Actualizar contraseña si se proporciona
    if (req.body.password) {
      updateData.password_hash = await hashPassword(req.body.password);
    }
    
  // Procesar permisos administrativos (que pueden venir de dos formas)
console.log('[UPDATE_USER] Datos recibidos:', JSON.stringify(req.body, null, 2));

// Preparar updateData.assigned_folders
updateData.assigned_folders = undefined; // Se establecerá en una de las condiciones siguientes

// Verificar si hay permisos en assigned_folders (nuevo formato)
let hasPermissionsInFolders = false;
if (req.body.assigned_folders && Array.isArray(req.body.assigned_folders)) {
  const permObj = req.body.assigned_folders.find(folder => 
    typeof folder === 'object' && folder.type === 'admin_permissions'
  );
  
  console.log('[UPDATE_USER] Objeto de permisos en assigned_folders:', JSON.stringify(permObj, null, 2));
  
  if (permObj && permObj.permissions) {
    hasPermissionsInFolders = true;
    // Actualizar directamente con la estructura ya preparada
    updateData.assigned_folders = req.body.assigned_folders;
    console.log('[UPDATE_USER] Asignando carpetas con permisos incluidos');
  }
}

// Si no hay permisos en assigned_folders pero sí en admin_permissions (formato antiguo)
if (!hasPermissionsInFolders && req.body.admin_permissions) {
  console.log('[UPDATE_USER] Procesando permisos del formato antiguo');
  
  // Obtener las carpetas asignadas actuales
  let currentFolders = [...(existingUser.assigned_folders || [])];
  
  // Eliminar el objeto de permisos si existe
  currentFolders = currentFolders.filter(folder => 
    !(typeof folder === 'object' && folder.type === 'admin_permissions')
  );
  
  // Añadir el nuevo objeto de permisos
  updateData.assigned_folders = [
    { type: 'admin_permissions', permissions: req.body.admin_permissions },
    ...currentFolders
  ];
}
// Si se proporcionan carpetas asignadas pero no permisos, conservar los permisos existentes
else if (req.body.assigned_folders !== undefined && !hasPermissionsInFolders) {

      // Obtener el objeto de permisos actual si existe
      const permissionsObj = existingUser.assigned_folders.find(folder => 
        typeof folder === 'object' && folder.type === 'admin_permissions'
      );
      
      // Filtrar las carpetas asignadas para tener solo rutas de carpetas
      const folderPaths = req.body.assigned_folders.filter(folder => 
        typeof folder === 'string'
      );
      
      // Combinar con el objeto de permisos si existe
      updateData.assigned_folders = permissionsObj 
        ? [permissionsObj, ...folderPaths] 
        : folderPaths;
    }
    
    if (req.body.group_name !== undefined) {
      updateData.group_name = req.body.group_name;
    }
    
    if (req.body.active !== undefined) {
      updateData.active = req.body.active;
    }
    
    // Si no hay datos para actualizar
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionaron datos para actualizar'
      });
    }
    
    // Actualizar usuario
    const result = await updateUser(userId, updateData);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar el usuario',
        error: result.error
      });
    }
    
    // Extraer permisos para la respuesta
    const permissionsObj = result.data[0].assigned_folders.find(folder => 
      typeof folder === 'object' && folder.type === 'admin_permissions'
    );
    
    const admin_permissions = permissionsObj ? permissionsObj.permissions : {};
    
    res.status(200).json({
      success: true,
      message: 'Usuario actualizado correctamente',
      user: {
        id: result.data[0].id,
        username: result.data[0].username,
        bucket: result.data[0].bucket,
        assigned_folders: result.data[0].assigned_folders,
        group_name: result.data[0].group_name,
        active: result.data[0].active,
        admin_permissions: admin_permissions,
        updated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al actualizar usuario',
      error: error.message
    });
  }
});


// Eliminar (desactivar) un usuario
app.delete('/api/admin/delete-user/:id', isAdmin, async (req, res) => {
  try {
    const adminUsername = req.username;
    const userId = req.params.id;
    // Verificar si es una eliminación permanente o solo desactivación
    const permanent = req.query.permanent === 'true';
    
    if (!adminUsername) {
      return res.status(401).json({
        success: false,
        message: 'No se pudo identificar al administrador'
      });
    }
    
    // Obtener usuario existente
    const { data: existingUser, error: userError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError || !existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: userError?.message
      });
    }
    
    // Verificar que el usuario pertenezca a este administrador
    if (existingUser.created_by !== adminUsername) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este usuario'
      });
    }
    
    // Eliminar o desactivar usuario según el parámetro permanent
    const result = await deleteUser(userId, permanent);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error al ${permanent ? 'eliminar' : 'desactivar'} el usuario`,
        error: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: permanent ? 'Usuario eliminado permanentemente' : 'Usuario desactivado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al eliminar usuario',
      error: error.message
    });
  }
 });

// Obtener permisos de carpeta
app.get('/api/admin/folder-permissions', isAdmin, async (req, res) => {
  try {
    const folderPath = req.query.path;
    
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la ruta de la carpeta'
      });
    }
    
    // Normalizar ruta
    let normalizedPath = folderPath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    // Construir ruta del archivo de metadatos
    const metadataPath = `${normalizedPath}/.access.metadata`;
    
    // Obtener archivo de permisos si existe
    const { data, error } = await supabase.storage
      .from(req.bucketName)
      .download(metadataPath);
    
    if (error && error.message !== 'The object was not found') {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener permisos de carpeta',
        error: error.message
      });
    }
    
    let permissions = { users: [], groups: [] };
    
    if (data) {
      // Archivo existe, convertir a objeto
      const text = await data.text();
      try {
        permissions = JSON.parse(text);
      } catch (parseError) {
        console.error('Error al parsear metadata de permisos:', parseError);
      }
    }
    
    res.status(200).json({
      success: true,
      permissions
    });
  } catch (error) {
    console.error('Error al obtener permisos de carpeta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener permisos',
      error: error.message
    });
  }
});

// Actualizar permisos de carpeta
app.post('/api/admin/folder-permissions', isAdmin, express.json(), async (req, res) => {
  try {
    const { folderPath, permissions } = req.body;
    
    if (!folderPath || !permissions) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la ruta de la carpeta y los permisos'
      });
    }
    
    // Normalizar ruta
    let normalizedPath = folderPath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    // Validar estructura de permisos
    if (!permissions.users || !Array.isArray(permissions.users) ||
        !permissions.groups || !Array.isArray(permissions.groups)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de permisos inválido'
      });
    }
    
    // Construir ruta del archivo de metadatos
    const metadataPath = `${normalizedPath}/.access.metadata`;
    
    // Convertir permisos a JSON
    const metadataContent = JSON.stringify(permissions);
    
    // Guardar archivo de metadatos
    const { error } = await supabase.storage
      .from(req.bucketName)
      .upload(metadataPath, metadataContent, {
        contentType: 'application/json',
        upsert: true
      });
    
    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Error al guardar permisos de carpeta',
        error: error.message
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Permisos de carpeta actualizados correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar permisos de carpeta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al actualizar permisos',
      error: error.message
    });
  }
});


// Función auxiliar para realizar reintentos con backoff exponencial
async function retryOperation(operation, maxRetries = 3, initialDelay = 1000, fallbackFn = null) {
  let lastError;
  let delay = initialDelay;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Intento ${attempt + 1}/${maxRetries} falló:`, error.message);
      lastError = error;
      
      // Si no es el último intento, esperar antes de reintentar
      if (attempt < maxRetries - 1) {
        console.log(`Reintentando en ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Backoff exponencial
      }
    }
  }
  
  // Si hay una función de fallback, ejecutarla como último recurso
  if (fallbackFn) {
    console.log('Ejecutando función alternativa local después de agotar reintentos');
    try {
      return await fallbackFn();
    } catch (fallbackError) {
      console.error('Error en función alternativa:', fallbackError);
      throw fallbackError;
    }
  }
  
  throw lastError; // Lanzar el último error si todos los intentos fallan
}

// Endpoint para transcribir archivos de audio (MP3)
app.post('/api/transcribe-audio', express.json(), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
       
    console.log('[TRANSCRIBE] Datos recibidos:', {
      processWithGPT: req.body.processWithGPT,
      customPrompt: req.body.customPrompt,
      confirmDelete: req.body.confirmDelete
    });

    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    // Obtener la ruta del archivo MP3 y opciones desde el cuerpo de la solicitud
    const { filePath, deleteOriginal = true, processWithGPT = false } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la ruta del archivo MP3'
      });
    }
    
    // Verificar que el archivo sea un MP3
    if (!filePath.toLowerCase().endsWith('.mp3')) {
      return res.status(400).json({
        success: false,
        message: 'El archivo debe ser un MP3'
      });
    }
    
    // Normalizar la ruta
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    console.log(`[TRANSCRIBE] Procesando archivo MP3: ${normalizedPath}`);
    
    // Descargar el archivo desde Supabase con reintentos
    let data;
    try {
      const result = await retryOperation(async () => {
        return await supabase.storage
          .from(bucketToUse)
          .download(normalizedPath);
      }, 3, 2000);
      
      if (result.error) {
        throw result.error;
      }
      
      data = result.data;
    } catch (downloadError) {
      console.error(`Error al descargar archivo MP3 ${normalizedPath} después de reintentos:`, downloadError);
      throw downloadError;
    }
    
    // Definir directorio temporal según el entorno
    let tempDir;
    if (isRailway) {
      // En Railway, utilizar un directorio dentro de /tmp que siempre debe ser accesible
      tempDir = path.join('/tmp', 'docubox-transcribe');
    } else {
      // En desarrollo local, usar el directorio temporal del sistema
      tempDir = path.join(os.tmpdir(), 'docubox-transcribe');
    }

    // Asegurar que el directorio existe
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`[TRANSCRIBE] Directorio temporal creado en: ${tempDir}`);
    } catch (dirError) {
      console.error(`[TRANSCRIBE] Error al crear directorio temporal: ${dirError.message}`);
      
      // Plan B: Intentar usar el directorio actual si hay problemas
      if (isRailway) {
        tempDir = path.join(process.cwd(), 'tmp');
        console.log(`[TRANSCRIBE] Utilizando directorio alternativo: ${tempDir}`);
        try {
          fs.mkdirSync(tempDir, { recursive: true });
        } catch (fallbackError) {
          console.error(`[TRANSCRIBE] Error también con directorio alternativo: ${fallbackError.message}`);
        }
      }
    }
    
    const tempMP3Path = path.join(tempDir, path.basename(normalizedPath));
    
    // Guardar el archivo descargado al sistema de archivos temporal
    fs.writeFileSync(tempMP3Path, Buffer.from(await data.arrayBuffer()));
    console.log(`[TRANSCRIBE] Archivo MP3 guardado temporalmente en: ${tempMP3Path}`);
    
    // Ejecutar el script de Python para transcribir el audio
    const scriptPath = path.join(__dirname, 'scripts', 'transcribe_audio.py');
    
    console.log(`[TRANSCRIBE] Ejecutando script Python: ${scriptPath}`);
    console.log(`[TRANSCRIBE] Argumentos: ${tempMP3Path}`);
    
    // Lista de comandos de Python a probar en orden
    const pythonCommands = [
      pythonCommand, // Usar el comando detectado globalmente primero
      'python3',
      'python',
      '/usr/bin/python3',
      '/usr/local/bin/python3',
      'python3.10',
      'python3.9'
    ];
    
    let transcriptionSuccessful = false;
    let transcriptionFilePath = null;
    let transcriptionPath = null;
    
   // Importar el sistema de transcripción de respaldo
const fallbackTranscribe = require('./fallback_transcribe');

// ... resto del código anterior ...

// En lugar de intentar con Python, usar directamente el sistema de respaldo
console.log('[TRANSCRIBE] Usando sistema de transcripción de respaldo JavaScript');

try {
  // Generar transcripción de respaldo
  const transcriptionResult = await fallbackTranscribe.generateTranscription(
    tempMP3Path,
    tempDir
  );
  
  // Actualizar variables para seguir el flujo
  transcriptionFilePath = transcriptionResult.transcriptionFilePath;
  
  // Construir ruta remota para la transcripción
  const folderPath = path.dirname(normalizedPath);
  transcriptionPath = folderPath === '.' 
    ? transcriptionResult.transcriptionFileName 
    : `${folderPath}/${transcriptionResult.transcriptionFileName}`;
  
  // Leer contenido
  const transcriptionContent = fs.readFileSync(transcriptionFilePath, 'utf8');
  
  // Subir transcripción a Supabase
  console.log(`[TRANSCRIBE] Subiendo transcripción a: ${transcriptionPath}`);
  
  const { error: uploadError } = await retryOperation(async () => {
    return await supabase.storage
      .from(bucketToUse)
      .upload(transcriptionPath, transcriptionContent, {
        contentType: 'text/plain',
        upsert: true
      });
  }, 5, 2000);
  
  if (uploadError) {
    throw uploadError;
  }
  
  // Si se solicitó procesar con GPT, usar también el generador de formato
  let processedFilePath = transcriptionPath;
  let processedDocxPath = null;
  
  if (processWithGPT) {
    console.log('[IA] Generando documento formateado con sistema de respaldo');
    
    const formattedResult = await fallbackTranscribe.generateFormattedDocument(
      transcriptionFilePath,
      tempDir,
      req.body.customPrompt
    );
    
    // Construir ruta remota para el documento formateado
    const formattedPath = folderPath === '.' 
      ? formattedResult.formattedFileName 
      : `${folderPath}/${formattedResult.formattedFileName}`;
    
    // Leer contenido
    const formattedContent = fs.readFileSync(formattedResult.formattedFilePath, 'utf8');
    
    // Subir documento formateado a Supabase
    console.log(`[IA] Subiendo documento formateado a: ${formattedPath}`);
    
    const { error: formattedError } = await retryOperation(async () => {
      return await supabase.storage
        .from(bucketToUse)
        .upload(formattedPath, formattedContent, {
          contentType: 'text/plain',
          upsert: true
        });
    }, 5, 2000);
    
    if (formattedError) {
      console.error('[IA] Error al subir documento formateado:', formattedError);
    } else {
      processedFilePath = formattedPath;
      
      // Subir versión docx
      const docxContent = fs.readFileSync(formattedResult.docxPath);
      const docxPath = folderPath === '.' 
        ? formattedResult.docxFileName 
        : `${folderPath}/${formattedResult.docxFileName}`;
      
      const { error: docxError } = await retryOperation(async () => {
        return await supabase.storage
          .from(bucketToUse)
          .upload(docxPath, docxContent, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: true
          });
      }, 5, 2000);
      
      if (docxError) {
        console.error('[IA] Error al subir versión Word:', docxError);
      } else {
        processedDocxPath = docxPath;
      }
    }
  }
  
  // Si se solicitó eliminar el archivo original
  if (deleteOriginal) {
    console.log(`[TRANSCRIBE] Eliminando archivo MP3 original: ${normalizedPath}`);
    
    try {
      const { error: deleteError } = await supabase.storage
        .from(bucketToUse)
        .remove([normalizedPath]);
      
      if (deleteError) {
        console.error(`[TRANSCRIBE] Error al eliminar archivo original:`, deleteError);
      }
    } catch (deleteError) {
      console.error(`[TRANSCRIBE] Error al eliminar archivo original:`, deleteError);
    }
  }
  
  // Limpiar archivos temporales
  try {
    if (fs.existsSync(tempMP3Path)) {
      fs.unlinkSync(tempMP3Path);
    }
    if (transcriptionFilePath && fs.existsSync(transcriptionFilePath)) {
      fs.unlinkSync(transcriptionFilePath);
    }
  } catch (cleanupError) {
    console.error('[TRANSCRIBE] Error al limpiar archivos temporales:', cleanupError);
  }
  
  // Responder con éxito
  return res.status(200).json({
    success: true,
    message: processWithGPT ? 'Transcripción y procesamiento completados (modo respaldo)' : 'Transcripción completada (modo respaldo)',
    transcriptionPath: `/${transcriptionPath}`,
    processedPath: processWithGPT ? `/${processedFilePath}` : null,
    processedDocxPath: processWithGPT && processedDocxPath ? `/${processedDocxPath}` : null,
    originalDeleted: deleteOriginal,
    processedWithGPT: processWithGPT,
    fallbackMode: true
  });
  
} catch (error) {
  console.error('Error general en transcripción con sistema de respaldo:', error);
  
  return res.status(500).json({
    success: false,
    message: 'Error interno al procesar la transcripción',
    error: error.message
  });
}
    
    // Limpiar archivos temporales
    try {
      if (fs.existsSync(tempMP3Path)) {
        fs.unlinkSync(tempMP3Path);
      }
      if (transcriptionFilePath && fs.existsSync(transcriptionFilePath)) {
        fs.unlinkSync(transcriptionFilePath);
      }
    } catch (cleanupError) {
      console.error('[TRANSCRIBE] Error al limpiar archivos temporales:', cleanupError);
    }
    
    // Responder con éxito y la ruta del archivo de transcripción
    return res.status(200).json({
      success: true,
      message: processWithGPT ? 'Transcripción y procesamiento con IA completados' : 'Transcripción completada correctamente',
      transcriptionPath: `/${transcriptionPath}`,
      processedPath: processWithGPT ? `/${processedFilePath}` : null,
      processedDocxPath: processWithGPT && processedDocxPath ? `/${processedDocxPath}` : null,
      originalDeleted: deleteOriginal,
      processedWithGPT: processWithGPT
    });
  } catch (error) {
    console.error('Error general en transcripción de audio:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al transcribir audio',
      error: error.message
    });
  }
});

const uploadLocal = multer({ dest: path.join(__dirname, 'local_storage', 'uploads') });

// Endpoint para subir archivos MP3 directamente
app.post('/api/upload-audio-local', uploadLocal.single('audioFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se ha proporcionado ningún archivo' 
      });
    }
    
    // Verificar que el archivo es un MP3
    if (!req.file.originalname.toLowerCase().endsWith('.mp3')) {
      fs.unlinkSync(req.file.path); // Eliminar archivo si no es MP3
      return res.status(400).json({ 
        success: false, 
        message: 'El archivo debe ser un MP3' 
      });
    }
    
    // Guardar el archivo con su nombre original
    const targetPath = path.join(__dirname, 'local_storage', req.file.originalname);
    fs.renameSync(req.file.path, targetPath);
    
    return res.status(200).json({
      success: true,
      message: 'Archivo subido correctamente',
      filePath: req.file.originalname
    });
  } catch (error) {
    console.error('Error al subir archivo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar el archivo',
      error: error.message
    });
  }
});

// Endpoint para transcribir archivos locales
app.post('/api/transcribe-local', express.json(), async (req, res) => {
  try {
    const { fileName, processWithGPT = false } = req.body;
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el nombre del archivo MP3'
      });
    }
    
    // Verificar que el archivo existe localmente
    const filePath = path.join(__dirname, 'local_storage', fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado'
      });
    }
    
    console.log(`[LOCAL] Procesando archivo MP3 local: ${fileName}`);
    
    // Ejecutar el script de Python para transcribir el audio
    const scriptPath = path.join(__dirname, 'scripts', 'transcribe_audio.py');
    
    console.log(`[LOCAL] Ejecutando script Python: ${scriptPath}`);
    console.log(`[LOCAL] Argumentos: ${filePath}`);
    
    const pythonProcess = spawn('python', [scriptPath, filePath]);
    
    let outputData = '';
    let errorData = '';
    
    // Capturar la salida del script
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[PYTHON] ${output}`);
      outputData += output;
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`[PYTHON ERROR] ${error}`);
      errorData += error;
    });
    
    // Esperar a que el proceso termine
    const code = await new Promise((resolve) => {
      pythonProcess.on('close', resolve);
    });
    
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        message: `Error en la transcripción: ${errorData}`
      });
    }
    
    // Obtener el archivo de transcripción generado
    const baseFileName = path.basename(fileName, '.mp3');
    const transcriptionFileName = `${baseFileName}_transcripcion.txt`;
    const transcriptionFilePath = path.join(path.dirname(filePath), transcriptionFileName);
    
    if (!fs.existsSync(transcriptionFilePath)) {
      return res.status(500).json({
        success: false,
        message: 'La transcripción no fue generada'
      });
    }
    
    // Copiar el archivo a la carpeta local_storage (si no está ahí ya)
    const localTranscriptionPath = path.join(__dirname, 'local_storage', transcriptionFileName);
    if (transcriptionFilePath !== localTranscriptionPath) {
      fs.copyFileSync(transcriptionFilePath, localTranscriptionPath);
    }
    
    let processedFilePath = null;
    
    // Procesar con Perplexity si se solicitó
    if (processWithGPT) {
      try {
        console.log('[IA-LOCAL] Procesando transcripción con Perplexity');
        
        // Ruta al script Python
        const perplexityScriptPath = path.join(__dirname, 'scripts', 'process_transcript_perplexity.py');
        
        // Obtener API Key de las variables de entorno
        const perplexityApiKey = process.env.PERPLEXITY_API_KEY || '';
        
        if (!perplexityApiKey) {
          console.warn('[IA-LOCAL] No se encontró API Key de Perplexity en las variables de entorno');
          return res.status(500).json({
            success: false,
            message: 'No se encontró API Key de Perplexity'
          });
        }
        
        // Construir la ruta del archivo procesado
        const processedFileName = `${baseFileName}_acta_formatada.txt`;
        const processedLocalPath = path.join(__dirname, 'local_storage', processedFileName);
        
        // Llamar al script Python de Perplexity
        const perplexityProcess = spawn('python', [
          perplexityScriptPath,
          localTranscriptionPath,
          '--api_key', perplexityApiKey,
          '--output', processedLocalPath
        ]);
        
        let perplexityOutput = '';
        let perplexityError = '';
        
        perplexityProcess.stdout.on('data', (data) => {
          const output = data.toString();
          console.log(`[IA-LOCAL] ${output}`);
          perplexityOutput += output;
        });
        
        perplexityProcess.stderr.on('data', (data) => {
          const error = data.toString();
          console.error(`[IA-LOCAL ERROR] ${error}`);
          perplexityError += error;
        });
        
        // Esperar a que termine el proceso de Perplexity
        const perplexityCode = await new Promise((resolve) => {
          perplexityProcess.on('close', resolve);
        });
        
        if (perplexityCode !== 0) {
          console.error(`[IA-LOCAL] Error al procesar con Perplexity: ${perplexityError}`);
        } else if (fs.existsSync(processedLocalPath)) {
          processedFilePath = processedFileName;
          console.log(`[IA-LOCAL] Archivo procesado guardado en: ${processedLocalPath}`);
        }
      } catch (perplexityError) {
        console.error('[IA-LOCAL] Error al procesar con Perplexity:', perplexityError);
      }
    }
    
    return res.status(200).json({
      success: true,
      message: processWithGPT ? 'Transcripción y procesamiento con IA completados localmente' : 'Transcripción completada localmente',
      transcriptionPath: transcriptionFileName,
      processedPath: processedFilePath,
      localMode: true
    });
  } catch (error) {
    console.error('Error general en transcripción local:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al transcribir audio localmente',
      error: error.message
    });
  }
});

// Endpoint para descargar archivos locales
app.get('/api/download-local', (req, res) => {
  try {
    const { fileName } = req.query;
    
    if (!fileName) {
      return res.status(400).send('Se requiere el nombre del archivo');
    }
    
    const filePath = path.join(__dirname, 'local_storage', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Archivo no encontrado');
    }
    
    res.download(filePath);
  } catch (error) {
    console.error('Error al descargar archivo local:', error);
    res.status(500).send('Error al descargar el archivo');
  }
});

// Asignar carpetas a un usuario
app.patch('/api/admin/assign-folders', isAdmin, express.json(), async (req, res) => {
  try {
    const adminUsername = req.username;
    const { userId, folders } = req.body;
    
    if (!userId || !folders || !Array.isArray(folders)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere ID de usuario y lista de carpetas'
      });
    }
    
    // Obtener usuario existente
    const { data: existingUser, error: userError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError || !existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: userError?.message
      });
    }
    
    // Verificar que el usuario pertenezca a este administrador
    if (existingUser.created_by !== adminUsername) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar este usuario'
      });
    }
    
    // Actualizar carpetas asignadas
    const result = await updateUser(userId, { assigned_folders: folders });
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al asignar carpetas al usuario',
        error: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Carpetas asignadas correctamente',
      user: {
        id: result.data[0].id,
        username: result.data[0].username,
        assigned_folders: result.data[0].assigned_folders
      }
    });
  } catch (error) {
    console.error('Error al asignar carpetas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al asignar carpetas',
      error: error.message
    });
  }
});

// ========================================================
// ENDPOINTS PARA GESTIÓN DE ETIQUETAS
// ========================================================

// Obtener todas las etiquetas para un bucket específico
app.get('/api/tags', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    let bucketToUse = req.bucketName || defaultBucketName;
    
    
// SOLUCIÓN: Verificar si hay un token en los parámetros de consulta
if (req.query.token) {
  try {
    const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
    console.log(`[TAGS] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
    
    if (tokenData.type === 'dynamic' && tokenData.bucket) {
      // Usuario dinámico
      console.log(`[TAGS] Usuario dinámico ${tokenData.username} usando bucket ${tokenData.bucket} desde token`);
      bucketToUse = tokenData.bucket;
      
      // Actualizar también req.username y req.userRole para las validaciones posteriores
      req.username = tokenData.username;
      req.userRole = 'user';
      req.userType = 'dynamic';
      req.userFolders = tokenData.folders || [];
    }
    else if (tokenData.username && userBucketMap[tokenData.username]) {
      // Para usuarios estáticos
      const tokenBucket = userBucketMap[tokenData.username];
      console.log(`[TAGS] Usuario estático ${tokenData.username} usando bucket ${tokenBucket} desde token en parámetros`);
      bucketToUse = tokenBucket;
      
      // Actualizar también req.username y req.userRole para las validaciones posteriores
      req.username = tokenData.username;
      req.userRole = userRoleMap[tokenData.username] || 'user';
    }

  } catch (tokenError) {
        console.error('[TAGS] Error al decodificar token de parámetros:', tokenError);
      }
    }
    
    console.log(`[TAGS] Obteniendo etiquetas para bucket: ${bucketToUse}`);
    
    // Consultar la tabla tags_by_bucket
    const { data, error } = await supabase
      .from('tags_by_bucket')
      .select('*')
      .eq('bucket', bucketToUse);
    
    if (error) {
      console.error('Error al obtener etiquetas:', error);
      throw error;
    }
    
    // Opcional: Agrupar etiquetas por categorías
    const tagsByCategory = {};
    
    data.forEach(tag => {
      if (!tagsByCategory[tag.category]) {
        tagsByCategory[tag.category] = [];
      }
      tagsByCategory[tag.category].push(tag.tag_name);
    });
    
    return res.status(200).json({
      success: true,
      tags: data,
      tagsByCategory: tagsByCategory
    });
  } catch (error) {
    console.error('Error al obtener etiquetas:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener etiquetas',
      error: error.message
    });
  }
});

// Eliminar una etiqueta
app.delete('/api/tags/:id', hasAdminPermission('manage_tags'), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
        const tagId = req.params.id;
        if (!tagId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere ID de etiqueta'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    // Verificar que la etiqueta pertenezca al bucket del usuario
    const { data: tagData, error: checkError } = await supabase
      .from('tags_by_bucket')
      .select('*')
      .eq('id', tagId)
      .single();
    
    if (checkError) {
      console.error('Error al verificar etiqueta:', checkError);
      throw checkError;
    }
    
    if (!tagData) {
      return res.status(404).json({
        success: false,
        message: 'Etiqueta no encontrada'
      });
    }
    
    if (tagData.bucket !== bucketToUse) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar esta etiqueta'
      });
    }
    
    console.log(`[TAGS] Eliminando etiqueta "${tagData.tag_name}" del bucket ${bucketToUse}`);
    
    // Eliminar la etiqueta
    const { error } = await supabase
      .from('tags_by_bucket')
      .delete()
      .eq('id', tagId);
    
    if (error) {
      console.error('Error al eliminar etiqueta:', error);
      throw error;
    }
    
    return res.status(200).json({
      success: true,
      message: 'Etiqueta eliminada correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar etiqueta:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al eliminar etiqueta',
      error: error.message
    });
  }
});

// Crear una nueva etiqueta
app.post('/api/tags', hasAdminPermission('manage_tags'), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    const { tag_name, category } = req.body;
    
    if (!tag_name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere nombre de etiqueta y categoría'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    console.log(`[TAGS] Creando etiqueta "${tag_name}" en categoría "${category}" para bucket ${bucketToUse}`);
    
    // Insertar la nueva etiqueta
    const { data, error } = await supabase
      .from('tags_by_bucket')
      .insert([{
        bucket: bucketToUse,
        category: category,
        tag_name: tag_name,
        created_by: req.username || 'admin'
      }])
      .select();
    
    if (error) {
      console.error('Error al crear etiqueta:', error);
      throw error;
    }
    
    return res.status(201).json({
      success: true,
      message: 'Etiqueta creada correctamente',
      tag: data[0]
    });
  } catch (error) {
    console.error('Error al crear etiqueta:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al crear etiqueta',
      error: error.message
    });
  }
});

// Obtener categorías de etiquetas
app.get('/api/tags/categories', async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    let bucketToUse = req.bucketName || defaultBucketName;
    
    // SOLUCIÓN: Verificar si hay un token en los parámetros de consulta
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[TAGS_CATEGORIES] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.username && userBucketMap[tokenData.username]) {
          const tokenBucket = userBucketMap[tokenData.username];
          console.log(`[TAGS_CATEGORIES] Usando bucket ${tokenBucket} desde token en parámetros`);
          bucketToUse = tokenBucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = userRoleMap[tokenData.username] || 'user';
        } else if (tokenData.type === 'dynamic' && tokenData.bucket) {
          // Usuario dinámico
          bucketToUse = tokenData.bucket;
          console.log(`[TAGS_CATEGORIES] Usuario dinámico ${tokenData.username} usando bucket ${bucketToUse} desde token`);
        }
      } catch (tokenError) {
        console.error('[TAGS_CATEGORIES] Error al decodificar token de parámetros:', tokenError);
      }
    }
    
    console.log(`[TAGS_CATEGORIES] Obteniendo categorías para bucket: ${bucketToUse}`);
    
    // Consultar categorías únicas de la tabla tags_by_bucket
    const { data, error } = await supabase
      .from('tags_by_bucket')
      .select('category')
      .eq('bucket', bucketToUse)
      .order('category');
    
    if (error) {
      console.error('Error al obtener categorías:', error);
      throw error;
    }
    
    // Extraer categorías únicas
    const categories = [...new Set(data.map(item => item.category))];
    
    return res.status(200).json({
      success: true,
      categories: categories
    });
  } catch (error) {
    console.error('Error al obtener categorías de etiquetas:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener categorías de etiquetas',
      error: error.message
    });
  }
});

// Crear una nueva categoría con etiquetas iniciales (opcional)
app.post('/api/tags/categories', express.json(), hasAdminPermission('manage_tags'), async (req, res) => {
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
      });
    }
    
    const { category_name, tags } = req.body;
    
    if (!category_name) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere nombre de categoría'
      });
    }
    
    // Obtener el bucket específico del usuario desde el middleware
    const bucketToUse = req.bucketName || defaultBucketName;
    
    console.log(`[TAGS_CATEGORIES] Creando categoría "${category_name}" para bucket ${bucketToUse}`);
    
    // Verificar si la categoría ya tiene etiquetas (opcional)
    const { data: existingCategory, error: checkError } = await supabase
      .from('tags_by_bucket')
      .select('category')
      .eq('bucket', bucketToUse)
      .eq('category', category_name)
      .limit(1);
    
    if (checkError) {
      console.error('Error al verificar categoría existente:', checkError);
      throw checkError;
    }
    
    // Si se proporcionaron etiquetas iniciales, crearlas
    let createdTags = [];
    
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // Crear array de registros para inserción masiva
      const tagsToInsert = tags.map(tag => ({
        bucket: bucketToUse,
        category: category_name,
        tag_name: tag,
        created_by: req.username || 'admin'
      }));
      
      // Insertar etiquetas
      const { data, error } = await supabase
        .from('tags_by_bucket')
        .insert(tagsToInsert)
        .select();
      
      if (error) {
        console.error('Error al crear etiquetas iniciales:', error);
        throw error;
      }
      
      createdTags = data;
    } else if (!existingCategory || existingCategory.length === 0) {
      // Si no hay etiquetas iniciales y la categoría no existe, crear al menos una etiqueta para que exista la categoría
      const { data, error } = await supabase
        .from('tags_by_bucket')
        .insert([{
          bucket: bucketToUse,
          category: category_name,
          tag_name: `${category_name}_1`, // Etiqueta por defecto
          created_by: req.username || 'admin'
        }])
        .select();
      
      if (error) {
        console.error('Error al crear etiqueta inicial para categoría:', error);
        throw error;
      }
      
      createdTags = data;
    }
    
    return res.status(201).json({
      success: true,
      message: 'Categoría creada correctamente',
      category: category_name,
      tags: createdTags
    });
  } catch (error) {
    console.error('Error al crear categoría de etiquetas:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno al crear categoría de etiquetas',
      error: error.message
    });
  }
});

// Endpoint de diagnóstico para verificar el entorno de Python
app.get('/api/diagnose-python', async (req, res) => {
  try {
    console.log('[DIAGNOSE] Ejecutando diagnóstico de Python...');
    
    const scriptPath = path.join(__dirname, 'scripts', 'check_python_env.py');
    console.log(`[DIAGNOSE] Ruta del script: ${scriptPath}`);
    
    // Usar el comando de Python detectado globalmente
    const pythonCmd = pythonCommand || 'python3';
    console.log(`[DIAGNOSE] Usando comando Python: ${pythonCmd}`);
    
    const diagnosticProcess = spawn(pythonCmd, [scriptPath]);
    
    let outputData = '';
    let errorData = '';
    
    diagnosticProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[DIAGNOSE] ${output}`);
      outputData += output;
    });
    
    diagnosticProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`[DIAGNOSE ERROR] ${error}`);
      errorData += error;
    });
    
    // Esperar a que termine el proceso
    await new Promise((resolve) => {
      diagnosticProcess.on('close', (code) => {
        console.log(`[DIAGNOSE] Proceso terminado con código: ${code}`);
        resolve();
      });
    });
    
    res.status(200).json({
      success: true,
      message: 'Diagnóstico de Python completado',
      output: outputData,
      error: errorData || null
    });
  } catch (error) {
    console.error('[DIAGNOSE] Error general:', error);
    res.status(500).json({
      success: false,
      message: 'Error al ejecutar diagnóstico de Python',
      error: error.message
    });
  }
});

// Ruta de prueba para verificar la configuración de backup
app.get('/api/backup/test', (req, res) => {
  console.log('Ruta de prueba de backup accedida');
  res.json({
    success: true,
    message: 'API de backup funcionando correctamente',
    serverTime: new Date().toISOString()
  });
});


// Ruta para crear backup
app.get('/api/backup/create/:bucketName', async (req, res) => {
  try {
    const { bucketName } = req.params;
    
    if (!bucketName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nombre del bucket no proporcionado' 
      });
    }
    
    console.log(`[BACKUP] Iniciando backup para bucket: ${bucketName}`);
    
    // Crear nombre de archivo para el backup
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupFileName = `backup-${bucketName}-${timestamp}.zip`;
    const backupPath = path.join(__dirname, 'backups', backupFileName);
    
    // Asegurar que existe el directorio
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    // Ejecutar el script de backup como un proceso separado
console.log('[BACKUP] Intentando ejecutar script de backup...');
const backupScriptPath = path.join(__dirname, 'backup_script.js');
console.log(`[BACKUP] Ruta completa del script: ${backupScriptPath}`);

const backupProcess = spawn('node', [
  backupScriptPath,
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
app.get('/api/backup/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'backups', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ 
      success: false, 
      message: 'Archivo no encontrado' 
    });
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
app.post('/api/backup/restore', upload.single('backupFile'), async (req, res) => {
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
    // Verificar que tenemos el buffer del archivo
if (!req.file.buffer) {
  // Si no hay buffer, intentar leer el archivo desde la ruta
  try {
    console.log('[RESTORE] No se encontró buffer, intentando leer desde path:', req.file.path);
    req.file.buffer = fs.readFileSync(req.file.path);
    console.log('[RESTORE] Archivo leído correctamente, tamaño:', req.file.buffer.length);
  } catch (readError) {
    console.error('[RESTORE] Error al leer archivo:', readError);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar el archivo: ' + readError.message
    });
  }
}
    
    // Aceptar ambos nombres de parámetros para mayor compatibilidad
const targetBucket = req.body.targetBucket || req.body.bucketName;
    
if (!targetBucket) {
  console.log('[RESTORE] Error: Nombre de bucket destino no proporcionado');
  return res.status(400).json({ 
    success: false, 
    message: 'Nombre de bucket destino no proporcionado. Proporcione targetBucket o bucketName' 
  });
}
    
    console.log(`[RESTORE] Procesando restauración para bucket: ${targetBucket}`);
    
    // Crear un directorio temporal para la restauración
const tempDir = path.join(os.tmpdir(), 'docubox_restore_' + Date.now());
fs.mkdirSync(tempDir, { recursive: true });
console.log(`[RESTORE] Directorio temporal creado: ${tempDir}`);

// Guardar el buffer del archivo en disco para prevenir corrupción
const zipPath = path.join(tempDir, 'backup.zip');
fs.writeFileSync(zipPath, req.file.buffer);
console.log(`[RESTORE] Archivo ZIP guardado en: ${zipPath}`);

// Ejecutar el script de restauración con la nueva ruta
const restoreScriptPath = path.join(__dirname, 'restore_script.js');
console.log(`[RESTORE] Ejecutando script de restauración: ${restoreScriptPath}`);
console.log(`[RESTORE] Verificando existencia del script: ${fs.existsSync(restoreScriptPath)}`);

// Guardar el comando para referencia
console.log(`[RESTORE] Comando: node ${restoreScriptPath} ${zipPath} ${targetBucket}`);

// Iniciar el proceso de restauración
let restoreProcess = spawn('node', [
  restoreScriptPath,
  zipPath,
  targetBucket
]);

console.log(`[RESTORE] Comando completo: ${commandArray.join(' ')}`);
console.log(`[RESTORE] Argumentos: ${JSON.stringify(commandArray.slice(1))}`);

let restoreProcessAlternative = spawn('node', [
  restoreScriptPath,
  uploadedFilePath,
  targetBucket
]);
    let output = '';
    
    // Capturar salida estándar del proceso
restoreProcess.stdout.on('data', (data) => {
  const dataStr = data.toString();
  // Mostrar líneas individuales para mejor visualización
  dataStr.split('\n').filter(line => line.trim()).forEach(line => {
    console.log(`[RESTORE STDOUT] ${line}`);
  });
  output += dataStr;
});

// Capturar errores del proceso
restoreProcess.stderr.on('data', (data) => {
  const dataStr = data.toString();
  // Mostrar líneas individuales para mejor visualización
  dataStr.split('\n').filter(line => line.trim()).forEach(line => {
    console.error(`[RESTORE STDERR] ${line}`);
  });
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

// Rutas directas para backup/restore que utilizan los scripts externos
app.get('/direct_backup', async (req, res) => {
  try {
    const bucketName = req.query.bucket;
    
    if (!bucketName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nombre del bucket no proporcionado' 
      });
    }
    
    console.log(`[DIRECT_BACKUP] Iniciando backup para bucket: ${bucketName}`);
    
    // Crear nombre de archivo para el backup
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupFileName = `backup-${bucketName}-${timestamp}.zip`;
    const backupPath = path.join(__dirname, 'backups', backupFileName);
    
    // Asegurar que existe el directorio
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    // Comando directo que utilizaría exactamente la misma sintaxis que en la línea de comandos
    console.log(`[DIRECT_BACKUP] Ejecutando: node "${path.join(__dirname, 'backup_script.js')}" ${bucketName} "${backupPath}"`);
    
    const cmd = `node "${path.join(__dirname, 'backup_script.js')}" ${bucketName} "${backupPath}"`;
    
    // Ejecutar como un proceso con shell
    const { error, stdout, stderr } = await new Promise((resolve) => {
      require('child_process').exec(cmd, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });
    
    if (error) {
      console.error(`[DIRECT_BACKUP] Error al ejecutar backup: ${error.message}`);
      console.error(`[DIRECT_BACKUP] stderr: ${stderr}`);
      return res.status(500).json({
        success: false,
        message: `Error al ejecutar backup: ${error.message}`,
        stderr
      });
    }
    
    console.log(`[DIRECT_BACKUP] Backup completado. stdout: ${stdout}`);
    
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
      path: backupPath
    });
  } catch (error) {
    console.error('[DIRECT_BACKUP] Error general:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para descargar directamente un backup
app.get('/direct_download', (req, res) => {
  const { filename } = req.query;
  const filePath = path.join(__dirname, 'backups', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ 
      success: false, 
      message: 'Archivo no encontrado' 
    });
  }
  
  res.download(filePath, filename, (err) => {
    if (err) {
      console.error(`[DIRECT_DOWNLOAD] Error al descargar archivo ${filename}:`, err);
      
      // Si ya se envió la cabecera, no podemos enviar otro error
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  });
});

// Ruta directa para restauración que ejecuta el script directamente
app.post('/direct_restore', upload.single('backupFile'), async (req, res) => {
  console.log('[DIRECT_RESTORE] Iniciando proceso de restauración directa');
  console.log('[DIRECT_RESTORE] Archivo recibido:', req.file ? {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path
  } : 'No hay archivo');
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se proporcionó archivo de backup' 
      });
    }
    
    const { targetBucket } = req.body;
    
    if (!targetBucket) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nombre de bucket destino no proporcionado' 
      });
    }
    
    // Comando directo que utilizaría exactamente la misma sintaxis que en la línea de comandos
    const cmd = `node "${path.join(__dirname, 'restore_script.js')}" "${req.file.path}" ${targetBucket}`;
    
    console.log(`[DIRECT_RESTORE] Ejecutando comando: ${cmd}`);
    
    // Ejecutar como un proceso con shell
    const { error, stdout, stderr } = await new Promise((resolve) => {
      require('child_process').exec(cmd, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });
    
    // Limpiar archivo temporal
    try {
      fs.unlinkSync(req.file.path);
      console.log(`[DIRECT_RESTORE] Archivo temporal eliminado: ${req.file.path}`);
    } catch (cleanupError) {
      console.error(`[DIRECT_RESTORE] Error al limpiar archivo temporal: ${cleanupError.message}`);
    }
    
    if (error) {
      console.error(`[DIRECT_RESTORE] Error al ejecutar restore: ${error.message}`);
      console.error(`[DIRECT_RESTORE] stderr: ${stderr}`);
      return res.status(500).json({
        success: false,
        message: `Error al ejecutar restore: ${error.message}`,
        stderr
      });
    }
    
    console.log(`[DIRECT_RESTORE] Restauración completada con éxito`);
    console.log(`[DIRECT_RESTORE] stdout: ${stdout}`);
    
    res.json({
      success: true,
      message: 'Restauración completada exitosamente'
    });
  } catch (error) {
    console.error('[DIRECT_RESTORE] Error general:', error);
    
    // Limpiar archivo temporal en caso de error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error(`[DIRECT_RESTORE] Error al limpiar archivo temporal en error: ${cleanupError.message}`);
      }
    }
    
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint de prueba para verificar la configuración de backup
app.get('/api/backup/test', (req, res) => {
  console.log('Ruta de prueba de backup accedida');
  res.json({
    success: true,
    message: 'API de backup funcionando correctamente',
    serverTime: new Date().toISOString()
  });
});

// Ruta para crear backup
app.get('/api/backup/create/:bucketName', async (req, res) => {
  try {
    const { bucketName } = req.params;
    
    if (!bucketName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nombre del bucket no proporcionado' 
      });
    }
    
    console.log(`[BACKUP] Iniciando backup para bucket: ${bucketName}`);
    
    // Crear nombre de archivo para el backup
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupFileName = `backup-${bucketName}-${timestamp}.zip`;
    const backupPath = path.join(__dirname, 'backups', backupFileName);
    
    // Asegurar que existe el directorio
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    // Ejecutar el script de backup como un proceso separado
    console.log('[BACKUP] Intentando ejecutar script de backup...');
    const backupScriptPath = path.join(__dirname, 'scripts', 'backup_script.js');
    console.log(`[BACKUP] Ruta completa del script: ${backupScriptPath}`);

    const backupProcess = spawn('node', [
      backupScriptPath,
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

// Ruta para listar todos los backups disponibles
app.get('/api/backup/list', (req, res) => {
  try {
    const backupsDir = path.join(__dirname, 'backups');
    
    // Verificar que existe el directorio
    if (!fs.existsSync(backupsDir)) {
      return res.json({
        success: true,
        message: 'No hay directorio de backups',
        backups: []
      });
    }
    
    // Leer archivos del directorio
    fs.readdir(backupsDir, (err, files) => {
      if (err) {
        console.error('[BACKUP] Error al leer directorio de backups:', err);
        return res.status(500).json({
          success: false,
          message: 'Error al listar backups'
        });
      }
      
      // Filtrar solo archivos zip
      const backupFiles = files.filter(file => file.endsWith('.zip'));
      
      // Obtener información de cada archivo
      const backups = backupFiles.map(filename => {
        const filePath = path.join(backupsDir, filename);
        const stats = fs.statSync(filePath);
        
        return {
          filename,
          createdAt: stats.birthtime,
          size: stats.size,
          downloadUrl: `/api/backup/download/${filename}`
        };
      });
      
      res.json({
        success: true,
        message: `Se encontraron ${backups.length} backups`,
        backups
      });
    });
  } catch (error) {
    console.error('[BACKUP] Error al listar backups:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para descargar un backup específico
app.get('/api/backup/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validar el nombre de archivo para evitar path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de archivo inválido'
      });
    }
    
    const filePath = path.join(__dirname, 'backups', filename);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'El archivo de backup no existe'
      });
    }
    
    // Enviar el archivo
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('[BACKUP] Error al descargar backup:', err);
        // Si el encabezado no se ha enviado aún, podemos enviar un error
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            message: 'Error al descargar el archivo'
          });
        }
      }
    });
  } catch (error) {
    console.error('[BACKUP] Error al descargar backup:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para restaurar un backup
app.post('/api/backup/restore', express.json(), async (req, res) => {
  try {
    const { filename, bucketName } = req.body;
    
    // Validar parámetros
    if (!filename || !bucketName) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere nombre del archivo y bucket de destino'
      });
    }
    
    // Validar el nombre de archivo para evitar path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de archivo inválido'
      });
    }
    
    console.log(`[RESTORE] Iniciando restauración del archivo ${filename} al bucket ${bucketName}`);
    
    const backupPath = path.join(__dirname, 'backups', filename);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        message: 'El archivo de backup no existe'
      });
    }
    
    // Ejecutar el script de restauración como un proceso separado
    console.log('[RESTORE] Intentando ejecutar script de restauración...');
    
    const restoreScriptPath = path.join(__dirname, 'scripts', 'restore_script.js');
    console.log(`[RESTORE] Ruta completa del script: ${restoreScriptPath}`);
    
    let restoreProcess = spawn('node', [
      restoreScriptPath,
      backupPath,
      bucketName
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
      
      if (code !== 0) {
        return res.status(500).json({
          success: false,
          message: `El proceso de restauración terminó con código ${code}`,
          output
        });
      }
      
      res.json({
        success: true,
        message: 'Restauración completada correctamente',
        bucket: bucketName,
        output
      });
    });
  } catch (error) {
    console.error('[RESTORE] Error al iniciar el proceso de restauración:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// Endpoint para verificar las etiquetas contenidas en un archivo de backup
app.post('/api/backup/check-tags', upload.single('backupFile'), async (req, res) => {
  console.log('[CHECK_TAGS] Verificando etiquetas en archivo de backup');
  
  try {
    // Verificar que hay un archivo subido
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha proporcionado un archivo de copia de seguridad'
      });
    }

    // Verificar que el archivo es un ZIP
    if (!req.file.originalname.toLowerCase().endsWith('.zip')) {
      return res.status(400).json({
        success: false,
        message: 'El archivo debe ser un ZIP válido de copia de seguridad'
      });
    }

    // Crear un directorio temporal para extraer el zip
    const tempDir = path.join(os.tmpdir(), 'check-tags-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`[CHECK_TAGS] Directorio temporal creado: ${tempDir}`);

    // Guardar el archivo ZIP recibido
    const zipPath = path.join(tempDir, 'backup.zip');
    fs.writeFileSync(zipPath, req.file.buffer);

    
    // Verificar si existe el archivo de exportación de la base de datos
    const dbExportPath = path.join(tempDir, 'database-export.json');
    
    if (!fs.existsSync(dbExportPath)) {
      // Limpiar archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return res.status(404).json({
        success: false,
        message: 'El archivo no contiene exportación de base de datos con etiquetas'
      });
    }
    
    // Cargar el archivo de exportación
    let dbExport;
    try {
      const fileContent = fs.readFileSync(dbExportPath, 'utf8');
      dbExport = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('[CHECK_TAGS] Error al parsear archivo de exportación:', parseError);
      
      // Limpiar archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return res.status(500).json({
        success: false,
        message: 'Error al procesar el archivo de exportación',
        error: parseError.message
      });
    }
    
    // Verificar si hay etiquetas
    if (!dbExport.tags || !Array.isArray(dbExport.tags) || dbExport.tags.length === 0) {
      // Limpiar archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return res.status(200).json({
        success: true,
        hasTags: false,
        message: 'No se encontraron etiquetas en el archivo de copia de seguridad',
        tags: [],
        categories: []
      });
    }
    
    console.log(`[CHECK_TAGS] Encontradas ${dbExport.tags.length} etiquetas en el backup`);
    
    // Agrupar etiquetas por categoría
    const tagsByCategory = {};
    const categories = [];
    
    dbExport.tags.forEach(tag => {
      const category = tag.category || 'Sin categoría';
      
      if (!tagsByCategory[category]) {
        tagsByCategory[category] = [];
        categories.push(category);
      }
      
      tagsByCategory[category].push(tag.tag_name);
    });
    
    // Ordenar categorías y etiquetas
    categories.sort();
    for (const category in tagsByCategory) {
      tagsByCategory[category].sort();
    }
    
    // Limpiar archivos temporales
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return res.status(200).json({
      success: true,
      hasTags: true,
      message: `Se encontraron ${dbExport.tags.length} etiquetas en ${categories.length} categorías`,
      tagCount: dbExport.tags.length,
      categories: categories,
      tagsByCategory: tagsByCategory,
      sourceBucket: dbExport.tags.length > 0 ? dbExport.tags[0].bucket : 'desconocido',
      tags: dbExport.tags // Opcional: incluir todas las etiquetas (podría ser mucho para mostrar)
    });
  } catch (error) {
    console.error('[CHECK_TAGS] Error general:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error al verificar etiquetas',
      error: error.message
    });
  }
});

// Endpoint para exportar solo las etiquetas de un bucket a un archivo JSON
app.get('/api/backup/export-tags', async (req, res) => {
  console.log('[EXPORT_TAGS] Iniciando exportación de etiquetas');
  
  try {
    // Verificar si el usuario tiene permisos administrativos
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden exportar etiquetas'
      });
    }

    // Obtener el bucket para exportar etiquetas
    const bucketToExport = req.query.bucket || req.bucketName || defaultBucketName;
    console.log(`[EXPORT_TAGS] Exportando etiquetas del bucket: ${bucketToExport}`);

    // Consultar todas las etiquetas para el bucket
    const { data: tags, error: tagsError } = await supabase
      .from('tags_by_bucket')
      .select('*')
      .eq('bucket', bucketToExport);

    if (tagsError) {
      console.error('[EXPORT_TAGS] Error al obtener etiquetas:', tagsError);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener etiquetas',
        error: tagsError.message
      });
    }

    // Verificar si hay etiquetas
    if (!tags || tags.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron etiquetas para exportar en el bucket'
      });
    }

    console.log(`[EXPORT_TAGS] Encontradas ${tags.length} etiquetas para exportar`);

    // Crear objeto con la información
    const exportData = {
      tags: tags,
      metadata: {
        exportDate: new Date().toISOString(),
        bucket: bucketToExport,
        totalTags: tags.length
      }
    };

    // Agrupar etiquetas por categoría para información adicional
    const categoryCounts = {};
    tags.forEach(tag => {
      const category = tag.category || 'Sin categoría';
      if (!categoryCounts[category]) {
        categoryCounts[category] = 0;
      }
      categoryCounts[category]++;
    });

    exportData.metadata.categories = Object.keys(categoryCounts);
    exportData.metadata.categoryCounts = categoryCounts;

    // Generar nombre para el archivo
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const fileName = `tags_export_${bucketToExport}_${timestamp}.json`;

    // Configurar cabeceras para descargar el archivo
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/json');

    // Enviar los datos como archivo descargable
    res.send(JSON.stringify(exportData, null, 2));
    
    console.log(`[EXPORT_TAGS] Exportación completada: ${tags.length} etiquetas`);
  } catch (error) {
    console.error('[EXPORT_TAGS] Error general:', error);
    
    // Verificar si ya se enviaron cabeceras
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Error al exportar etiquetas',
        error: error.message
      });
    }
  }
});

// Endpoint para importar etiquetas desde un archivo JSON
app.post('/api/backup/import-tags', upload.single('tagsFile'), async (req, res) => {
  console.log('[IMPORT_TAGS] Iniciando importación de etiquetas');
  
  try {
    // Verificar si el usuario tiene permisos administrativos
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden importar etiquetas'
      });
    }

    // Verificar que hay un archivo subido
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha proporcionado un archivo de etiquetas'
      });
    }

    // Verificar que el archivo es un JSON
    if (!req.file.originalname.toLowerCase().endsWith('.json')) {
      return res.status(400).json({
        success: false,
        message: 'El archivo debe ser un JSON válido de etiquetas'
      });
    }

    // Obtener el bucket de destino
    const targetBucket = req.body.targetBucket || req.bucketName || defaultBucketName;
    console.log(`[IMPORT_TAGS] Importando etiquetas al bucket: ${targetBucket}`);

    // Parsear el archivo JSON
    let importData;
    try {
      const fileContent = req.file.buffer.toString('utf8');
      importData = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('[IMPORT_TAGS] Error al parsear archivo JSON:', parseError);
      
      return res.status(400).json({
        success: false,
        message: 'Error al parsear el archivo JSON',
        error: parseError.message
      });
    }

    // Verificar estructura del archivo
    if (!importData.tags || !Array.isArray(importData.tags) || importData.tags.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Formato de archivo inválido o no contiene etiquetas'
      });
    }

    // Extraer etiquetas
    const tagsToImport = importData.tags;
    console.log(`[IMPORT_TAGS] Encontradas ${tagsToImport.length} etiquetas para importar`);
    
    // Opciones de importación
    const replaceExisting = req.body.replaceExisting === 'true' || req.body.replaceExisting === true;
    console.log(`[IMPORT_TAGS] Modo: ${replaceExisting ? 'Reemplazar existentes' : 'Mantener existentes y añadir nuevas'}`);

    // Si se debe reemplazar, eliminar etiquetas existentes
    if (replaceExisting) {
      try {
        const { error: deleteError } = await supabase
          .from('tags_by_bucket')
          .delete()
          .eq('bucket', targetBucket);
          
        if (deleteError) {
          console.error('[IMPORT_TAGS] Error al eliminar etiquetas existentes:', deleteError);
          throw deleteError;
        }
        
        console.log('[IMPORT_TAGS] Etiquetas existentes eliminadas correctamente');
      } catch (deleteError) {
        console.error('[IMPORT_TAGS] Error al eliminar etiquetas existentes:', deleteError);
        
        return res.status(500).json({
          success: false,
          message: 'Error al eliminar etiquetas existentes',
          error: deleteError.message
        });
      }
    } else {
      // Si no se reemplazan, obtener etiquetas existentes para evitar duplicados
      console.log('[IMPORT_TAGS] Verificando etiquetas existentes para evitar duplicados...');
      const { data: existingTags, error: queryError } = await supabase
        .from('tags_by_bucket')
        .select('tag_name, category')
        .eq('bucket', targetBucket);
        
      if (queryError) {
        console.error('[IMPORT_TAGS] Error al obtener etiquetas existentes:', queryError);
      } else if (existingTags && existingTags.length > 0) {
        console.log(`[IMPORT_TAGS] Encontradas ${existingTags.length} etiquetas existentes`);
        
        // Crear un mapa de etiquetas existentes para búsqueda rápida
        const existingTagsMap = {};
        existingTags.forEach(tag => {
          const key = `${tag.category}:${tag.tag_name}`.toLowerCase();
          existingTagsMap[key] = true;
        });
        
        // Filtrar etiquetas para no incluir duplicados
        const originalCount = tagsToImport.length;
        const filteredTags = tagsToImport.filter(tag => {
          const key = `${tag.category}:${tag.tag_name}`.toLowerCase();
          return !existingTagsMap[key];
        });
        
        // Actualizar lista de etiquetas a importar
        console.log(`[IMPORT_TAGS] Filtradas ${originalCount - filteredTags.length} etiquetas duplicadas`);
        tagsToImport.length = 0;
        tagsToImport.push(...filteredTags);
      }
    }
    
    if (tagsToImport.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay nuevas etiquetas para importar',
        imported: 0
      });
    }

    // Realizar la inserción usando la función reutilizable
const insertResult = await insertTagsBatch(tagsToImport, targetBucket, '[IMPORT_TAGS]');

// Extraer resultados para la respuesta
const successCount = insertResult.successCount;
const errorCount = insertResult.errorCount;

    if (successCount === 0 && errorCount > 0) {
      return res.status(500).json({
        success: false,
        message: `No se pudo importar ninguna etiqueta`,
        details: {
          totalTags: preparedTags.length,
          success: successCount,
          errors: errorCount
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `Importación de etiquetas completada: ${successCount} exitosas, ${errorCount} con errores`,
      details: {
        totalTags: preparedTags.length,
        success: successCount,
        errors: errorCount,
        sourceBucket: importData.metadata?.bucket || 'desconocido'
      }
    });
  } catch (error) {
    console.error('[IMPORT_TAGS] Error general:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error al importar etiquetas',
      error: error.message
    });
  }
});

// Endpoint para restaurar solo las etiquetas de un backup

app.post('/api/backup/restore-tags', upload.single('backupFile'), async (req, res) => {
  console.log('[RESTORE_TAGS] Iniciando proceso de restauración de etiquetas');
  
  try {
    // Verificar si el usuario tiene permisos administrativos
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden restaurar etiquetas'
      });
    }

    // Verificar que hay un archivo subido
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha proporcionado un archivo de copia de seguridad'
      });
    }

    // Verificar que el archivo es un ZIP
    if (!req.file.originalname.toLowerCase().endsWith('.zip')) {
      return res.status(400).json({
        success: false,
        message: 'El archivo debe ser un ZIP válido de copia de seguridad'
      });
    }

    // Obtener el bucket a restaurar
    const bucketToRestore = req.bucketName || defaultBucketName;
    console.log(`[RESTORE_TAGS] Restaurando etiquetas al bucket: ${bucketToRestore}`);

    // Crear un directorio temporal para extraer el zip
    const tempDir = path.join(os.tmpdir(), 'restore-tags-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`[RESTORE_TAGS] Directorio temporal creado: ${tempDir}`);

    // Guardar el archivo ZIP recibido
    const zipPath = path.join(tempDir, 'backup.zip');
    fs.writeFileSync(zipPath, req.file.buffer);

    // Extraer el archivo ZIP
    console.log(`[RESTORE_TAGS] Extrayendo archivo ZIP: ${zipPath}`);
    const extract = require('extract-zip');
    await extract(zipPath, { dir: tempDir });
    console.log(`[RESTORE_TAGS] Extracción completada en ${tempDir}`);

    // Verificar si existe el archivo de exportación de la base de datos
    const dbExportPath = path.join(tempDir, 'database-export.json');
    
    if (!fs.existsSync(dbExportPath)) {
      // Limpiar archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return res.status(404).json({
        success: false,
        message: 'El archivo no contiene exportación de base de datos con etiquetas'
      });
    }
    
    // Cargar el archivo de exportación
    let dbExport;
    try {
      const fileContent = fs.readFileSync(dbExportPath, 'utf8');
      dbExport = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('[RESTORE_TAGS] Error al parsear archivo de exportación:', parseError);
      
      // Limpiar archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return res.status(500).json({
        success: false,
        message: 'Error al procesar el archivo de exportación',
        error: parseError.message
      });
    }
    
    // Verificar si hay etiquetas para restaurar
    if (!dbExport.tags || !Array.isArray(dbExport.tags) || dbExport.tags.length === 0) {
      // Limpiar archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return res.status(404).json({
        success: false,
        message: 'No se encontraron etiquetas en el archivo de copia de seguridad'
      });
    }
    
    console.log(`[RESTORE_TAGS] Encontradas ${dbExport.tags.length} etiquetas para restaurar`);
    
    // Primero, eliminar etiquetas existentes para el bucket de destino
    try {
      const { error: deleteError } = await supabase
        .from('tags_by_bucket')
        .delete()
        .eq('bucket', bucketToRestore);
        
      if (deleteError) {
        console.error('[RESTORE_TAGS] Error al eliminar etiquetas existentes:', deleteError);
        throw deleteError;
      }
      
      console.log('[RESTORE_TAGS] Etiquetas existentes eliminadas correctamente');
    } catch (deleteError) {
      console.error('[RESTORE_TAGS] Error al eliminar etiquetas existentes:', deleteError);
      
      // Limpiar archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return res.status(500).json({
        success: false,
        message: 'Error al eliminar etiquetas existentes',
        error: deleteError.message
      });
    }
    
    // Preparar etiquetas para su inserción, con UUIDs válidos
    let tagsToInsert = [];
    try {
      // Simplificar la preparación de etiquetas para evitar errores
      tagsToInsert = dbExport.tags.map(tag => {
        // Crear un nuevo objeto limpio para cada etiqueta
        return {
          tag_name: tag.tag_name || '',
          category: tag.category || '',
          bucket: bucketToRestore,
          // Omitimos el ID para que la base de datos asigne uno nuevo
          // Esto evita problemas con UUIDs inválidos
          created_at: tag.created_at || new Date().toISOString(),
          created_by: tag.created_by || req.username || 'admin',
          is_public: tag.is_public === true ? true : false
        };
      });
      
      console.log(`[RESTORE_TAGS] Preparadas ${tagsToInsert.length} etiquetas para inserción`);
    } catch (prepError) {
      console.error('[RESTORE_TAGS] Error al preparar etiquetas:', prepError);
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return res.status(500).json({
        success: false,
        message: 'Error al preparar etiquetas para restauración',
        error: prepError.message
      });
    }
    
    // Insertar etiquetas por lotes para evitar límites de la API
    let successCount = 0;
    let errorCount = 0;
    
    try {
      // Usar lotes más pequeños para mayor robustez
      const batchSize = 10;
      
      for (let i = 0; i < tagsToInsert.length; i += batchSize) {
        const batch = tagsToInsert.slice(i, i + batchSize);
        console.log(`[RESTORE_TAGS] Insertando lote de etiquetas ${i+1}-${Math.min(i+batchSize, tagsToInsert.length)} de ${tagsToInsert.length}`);
        
        try {
          const { data, error: insertError } = await supabase
            .from('tags_by_bucket')
            .insert(batch);
          
          if (insertError) {
            console.error('[RESTORE_TAGS] Error al insertar lote de etiquetas:', insertError);
            
            // Intentar insertar las etiquetas una por una
            console.log('[RESTORE_TAGS] Reintentando inserción individual...');
            
            for (const singleTag of batch) {
              try {
                const { error: singleError } = await supabase
                  .from('tags_by_bucket')
                  .insert([singleTag]);
                
                if (singleError) {
                  console.error(`[RESTORE_TAGS] Error al insertar etiqueta "${singleTag.tag_name}":`, singleError);
                  errorCount++;
                } else {
                  successCount++;
                }
              } catch (e) {
                console.error('[RESTORE_TAGS] Excepción al insertar etiqueta individual:', e);
                errorCount++;
              }
            }
          } else {
            successCount += batch.length;
            console.log(`[RESTORE_TAGS] Lote de etiquetas insertado correctamente`);
          }
        } catch (e) {
          console.error('[RESTORE_TAGS] Excepción al insertar lote:', e);
          errorCount += batch.length;
        }
      }
    } catch (insertError) {
      console.error('[RESTORE_TAGS] Error general al insertar etiquetas:', insertError);
      // No salimos inmediatamente, reportamos lo que se pudo hacer
    }
    
    // Limpiar archivos temporales
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('[RESTORE_TAGS] Error al limpiar archivos temporales:', cleanupError);
    }
    
    if (successCount === 0 && errorCount > 0) {
      return res.status(500).json({
        success: false,
        message: 'No se pudo restaurar ninguna etiqueta',
        details: {
          totalTags: tagsToInsert.length,
          success: successCount,
          errors: errorCount
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `Restauración de etiquetas completada: ${successCount} exitosas, ${errorCount} con errores`,
      details: {
        totalTags: tagsToInsert.length,
        success: successCount,
        errors: errorCount
      }
    });

  } catch (error) {
    console.error('[RESTORE_TAGS] Error general:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error al restaurar etiquetas',
      error: error.message
    });
  }
});

// Endpoint para verificar las etiquetas contenidas en un archivo de backup
app.post('/api/backup/check-tags', upload.single('backupFile'), async (req, res) => {
  console.log('[CHECK_TAGS] Verificando etiquetas en archivo de backup');
  
  try {
    // Verificar que hay un archivo subido
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha proporcionado un archivo de copia de seguridad'
      });
    }

    // Verificar que el archivo es un ZIP
    if (!req.file.originalname.toLowerCase().endsWith('.zip')) {
      return res.status(400).json({
        success: false,
        message: 'El archivo debe ser un ZIP válido de copia de seguridad'
      });
    }

    // Crear un directorio temporal para extraer el zip
    const tempDir = path.join(os.tmpdir(), 'check-tags-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`[CHECK_TAGS] Directorio temporal creado: ${tempDir}`);

    // Guardar el archivo ZIP recibido
    const zipPath = path.join(tempDir, 'backup.zip');
    fs.writeFileSync(zipPath, req.file.buffer);

    // Extraer el archivo ZIP
    console.log(`[CHECK_TAGS] Extrayendo archivo ZIP: ${zipPath}`);
    const extract = require('extract-zip');
    await extract(zipPath, { dir: tempDir });
    console.log(`[CHECK_TAGS] Extracción completada en ${tempDir}`);

    // Verificar si existe el archivo de exportación de la base de datos
    const dbExportPath = path.join(tempDir, 'database-export.json');
    
    if (!fs.existsSync(dbExportPath)) {
      // Limpiar archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return res.status(404).json({
        success: false,
        message: 'El archivo no contiene exportación de base de datos con etiquetas'
      });
    }
    
    // Cargar el archivo de exportación
    let dbExport;
    try {
      const fileContent = fs.readFileSync(dbExportPath, 'utf8');
      dbExport = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('[CHECK_TAGS] Error al parsear archivo de exportación:', parseError);
      
      // Limpiar archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return res.status(500).json({
        success: false,
        message: 'Error al procesar el archivo de exportación',
        error: parseError.message
      });
    }
    
    // Verificar si hay etiquetas
    if (!dbExport.tags || !Array.isArray(dbExport.tags) || dbExport.tags.length === 0) {
      // Limpiar archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return res.status(200).json({
        success: true,
        hasTags: false,
        message: 'No se encontraron etiquetas en el archivo de copia de seguridad',
        tags: [],
        categories: []
      });
    }
    
    console.log(`[CHECK_TAGS] Encontradas ${dbExport.tags.length} etiquetas en el backup`);
    
    // Agrupar etiquetas por categoría
    const tagsByCategory = {};
    const categories = [];
    
    dbExport.tags.forEach(tag => {
      const category = tag.category || 'Sin categoría';
      
      if (!tagsByCategory[category]) {
        tagsByCategory[category] = [];
        categories.push(category);
      }
      
      tagsByCategory[category].push(tag.tag_name);
    });
    
    // Ordenar categorías y etiquetas
    categories.sort();
    for (const category in tagsByCategory) {
      tagsByCategory[category].sort();
    }
    
    // Limpiar archivos temporales
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return res.status(200).json({
      success: true,
      hasTags: true,
      message: `Se encontraron ${dbExport.tags.length} etiquetas en ${categories.length} categorías`,
      tagCount: dbExport.tags.length,
      categories: categories,
      tagsByCategory: tagsByCategory,
      sourceBucket: dbExport.tags.length > 0 ? dbExport.tags[0].bucket : 'desconocido',
      tags: dbExport.tags // Opcional: incluir todas las etiquetas (podría ser mucho para mostrar)
    });
  } catch (error) {
    console.error('[CHECK_TAGS] Error general:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error al verificar etiquetas',
      error: error.message
    });
  }
});

// Endpoint para exportar solo las etiquetas de un bucket a un archivo JSON
app.get('/api/backup/export-tags', async (req, res) => {
  console.log('[EXPORT_TAGS] Iniciando exportación de etiquetas');
  
  try {
    // Verificar si el usuario tiene permisos administrativos
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden exportar etiquetas'
      });
    }

    // Obtener el bucket para exportar etiquetas
    const bucketToExport = req.query.bucket || req.bucketName || defaultBucketName;
    console.log(`[EXPORT_TAGS] Exportando etiquetas del bucket: ${bucketToExport}`);

    // Consultar todas las etiquetas para el bucket
    const { data: tags, error: tagsError } = await supabase
      .from('tags_by_bucket')
      .select('*')
      .eq('bucket', bucketToExport);

    if (tagsError) {
      console.error('[EXPORT_TAGS] Error al obtener etiquetas:', tagsError);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener etiquetas',
        error: tagsError.message
      });
    }

    // Verificar si hay etiquetas
    if (!tags || tags.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron etiquetas para exportar en el bucket'
      });
    }

    console.log(`[EXPORT_TAGS] Encontradas ${tags.length} etiquetas para exportar`);

    // Crear objeto con la información
    const exportData = {
      tags: tags,
      metadata: {
        exportDate: new Date().toISOString(),
        bucket: bucketToExport,
        totalTags: tags.length
      }
    };

    // Agrupar etiquetas por categoría para información adicional
    const categoryCounts = {};
    tags.forEach(tag => {
      const category = tag.category || 'Sin categoría';
      if (!categoryCounts[category]) {
        categoryCounts[category] = 0;
      }
      categoryCounts[category]++;
    });

    exportData.metadata.categories = Object.keys(categoryCounts);
    exportData.metadata.categoryCounts = categoryCounts;

    // Generar nombre para el archivo
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const fileName = `tags_export_${bucketToExport}_${timestamp}.json`;

    // Configurar cabeceras para descargar el archivo
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/json');

    // Enviar los datos como archivo descargable
    res.send(JSON.stringify(exportData, null, 2));
    
    console.log(`[EXPORT_TAGS] Exportación completada: ${tags.length} etiquetas`);
  } catch (error) {
    console.error('[EXPORT_TAGS] Error general:', error);
    
    // Verificar si ya se enviaron cabeceras
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Error al exportar etiquetas',
        error: error.message
      });
    }
  }
});

// Endpoint para importar etiquetas desde un archivo JSON
app.post('/api/backup/import-tags', upload.single('tagsFile'), async (req, res) => {
  console.log('[IMPORT_TAGS] Iniciando importación de etiquetas');
  
  try {
    // Verificar si el usuario tiene permisos administrativos
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden importar etiquetas'
      });
    }

    // Verificar que hay un archivo subido
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha proporcionado un archivo de etiquetas'
      });
    }

    // Verificar que el archivo es un JSON
    if (!req.file.originalname.toLowerCase().endsWith('.json')) {
      return res.status(400).json({
        success: false,
        message: 'El archivo debe ser un JSON válido de etiquetas'
      });
    }

    // Obtener el bucket de destino
    const targetBucket = req.body.targetBucket || req.bucketName || defaultBucketName;
    console.log(`[IMPORT_TAGS] Importando etiquetas al bucket: ${targetBucket}`);

    // Parsear el archivo JSON
    let importData;
    try {
      const fileContent = req.file.buffer.toString('utf8');
      importData = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('[IMPORT_TAGS] Error al parsear archivo JSON:', parseError);
      
      return res.status(400).json({
        success: false,
        message: 'Error al parsear el archivo JSON',
        error: parseError.message
      });
    }

    // Verificar estructura del archivo
    if (!importData.tags || !Array.isArray(importData.tags) || importData.tags.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Formato de archivo inválido o no contiene etiquetas'
      });
    }

    // Extraer etiquetas
    const tagsToImport = importData.tags;
    console.log(`[IMPORT_TAGS] Encontradas ${tagsToImport.length} etiquetas para importar`);
    
    // Opciones de importación
    const replaceExisting = req.body.replaceExisting === 'true' || req.body.replaceExisting === true;
    console.log(`[IMPORT_TAGS] Modo: ${replaceExisting ? 'Reemplazar existentes' : 'Mantener existentes y añadir nuevas'}`);

    // Si se debe reemplazar, eliminar etiquetas existentes
    if (replaceExisting) {
      try {
        const { error: deleteError } = await supabase
          .from('tags_by_bucket')
          .delete()
          .eq('bucket', targetBucket);
          
        if (deleteError) {
          console.error('[IMPORT_TAGS] Error al eliminar etiquetas existentes:', deleteError);
          throw deleteError;
        }
        
        console.log('[IMPORT_TAGS] Etiquetas existentes eliminadas correctamente');
      } catch (deleteError) {
        console.error('[IMPORT_TAGS] Error al eliminar etiquetas existentes:', deleteError);
        
        return res.status(500).json({
          success: false,
          message: 'Error al eliminar etiquetas existentes',
          error: deleteError.message
        });
      }
    } else {
      // Si no se reemplazan, obtener etiquetas existentes para evitar duplicados
      console.log('[IMPORT_TAGS] Verificando etiquetas existentes para evitar duplicados...');
      const { data: existingTags, error: queryError } = await supabase
        .from('tags_by_bucket')
        .select('tag_name, category')
        .eq('bucket', targetBucket);
        
      if (queryError) {
        console.error('[IMPORT_TAGS] Error al obtener etiquetas existentes:', queryError);
      } else if (existingTags && existingTags.length > 0) {
        console.log(`[IMPORT_TAGS] Encontradas ${existingTags.length} etiquetas existentes`);
        
        // Crear un mapa de etiquetas existentes para búsqueda rápida
        const existingTagsMap = {};
        existingTags.forEach(tag => {
          const key = `${tag.category}:${tag.tag_name}`.toLowerCase();
          existingTagsMap[key] = true;
        });
        
        // Filtrar etiquetas para no incluir duplicados
        const originalCount = tagsToImport.length;
        const filteredTags = tagsToImport.filter(tag => {
          const key = `${tag.category}:${tag.tag_name}`.toLowerCase();
          return !existingTagsMap[key];
        });
        
        // Actualizar lista de etiquetas a importar
        console.log(`[IMPORT_TAGS] Filtradas ${originalCount - filteredTags.length} etiquetas duplicadas`);
        tagsToImport.length = 0;
        tagsToImport.push(...filteredTags);
      }
    }
    
    if (tagsToImport.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay nuevas etiquetas para importar',
        imported: 0
      });
    }

    // Asegurar que todas las etiquetas apunten al bucket correcto
    const preparedTags = tagsToImport.map(tag => ({
      ...tag,
      id: undefined, // Quitar ID para permitir que la base de datos genere uno nuevo
      bucket: targetBucket // Asegurar que se use el bucket destino
    }));
    
    // Insertar etiquetas por lotes para evitar límites de la API
    let successCount = 0;
    let errorCount = 0;
    
    try {
      const batchSize = 50;
      
      for (let i = 0; i < preparedTags.length; i += batchSize) {
        const batch = preparedTags.slice(i, i + batchSize);
        console.log(`[IMPORT_TAGS] Insertando lote de etiquetas ${i+1}-${Math.min(i+batchSize, preparedTags.length)} de ${preparedTags.length}`);
        
        const { data, error: insertError } = await supabase
          .from('tags_by_bucket')
          .insert(batch);
        
        if (insertError) {
          console.error('[IMPORT_TAGS] Error al insertar etiquetas:', insertError);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
          console.log(`[IMPORT_TAGS] Lote de etiquetas insertado correctamente`);
        }
      }
    } catch (insertError) {
      console.error('[IMPORT_TAGS] Error al insertar etiquetas:', insertError);
      // Continuamos para reportar lo que se pudo hacer
    }
    
    if (successCount === 0 && errorCount > 0) {
      return res.status(500).json({
        success: false,
        message: `No se pudo importar ninguna etiqueta`,
        details: {
          totalTags: preparedTags.length,
          success: successCount,
          errors: errorCount
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `Importación de etiquetas completada: ${successCount} exitosas, ${errorCount} con errores`,
      details: {
        totalTags: preparedTags.length,
        success: successCount,
        errors: errorCount,
        sourceBucket: importData.metadata?.bucket || 'desconocido'
      }
    });
  } catch (error) {
    console.error('[IMPORT_TAGS] Error general:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error al importar etiquetas',
      error: error.message
    });
  }
});

// Ruta alternativa para restauración directa (sin usar script externo)
app.post('/api/direct_restore', upload.single('backupFile'), async (req, res) => {
  console.log('[DIRECT_RESTORE] Iniciando proceso de restauración directa');
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se proporcionó archivo de backup' });
    }
    
    // Aceptar ambos nombres de parámetros
    const targetBucket = req.body.targetBucket || req.body.bucketName;
    
    if (!targetBucket) {
      return res.status(400).json({ success: false, message: 'Nombre de bucket destino no proporcionado' });
    }
    
    console.log(`[DIRECT_RESTORE] Restaurando para bucket: ${targetBucket}`);
    
    // Verificar que tenemos el buffer del archivo
    if (!req.file.buffer) {
      try {
        req.file.buffer = fs.readFileSync(req.file.path);
      } catch (readError) {
        return res.status(500).json({
          success: false,
          message: 'Error al leer el archivo: ' + readError.message
        });
      }
    }
    
    // Mostrar información del archivo para diagnóstico
    console.log(`[DIRECT_RESTORE] Información del archivo:`, {
      originalname: req.file.originalname,
      size: req.file.size,
      buffer_length: req.file.buffer.length
    });
    
    // Crear un directorio temporal
    const tempDir = path.join(os.tmpdir(), 'docubox_direct_restore_' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Guardar el buffer a un archivo
    const zipPath = path.join(tempDir, 'backup.zip');
    fs.writeFileSync(zipPath, req.file.buffer);
    
    console.log(`[DIRECT_RESTORE] Archivo guardado en: ${zipPath}`);
    
    // Verificar el archivo ZIP antes de intentar extraerlo
    try {
      const stats = fs.statSync(zipPath);
      console.log(`[DIRECT_RESTORE] Tamaño del archivo guardado: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('El archivo ZIP está vacío');
      }
    } catch (verifyError) {
      console.error('[DIRECT_RESTORE] Error al verificar ZIP:', verifyError);
      return res.status(500).json({
        success: false,
        message: 'Error al verificar archivo ZIP: ' + verifyError.message
      });
    }
    
    // Función auxiliar para listar de forma recursiva todos los archivos en un directorio
    function listFilesRecursively(dir, level = 0) {
      if (!fs.existsSync(dir)) {
        return [`${' '.repeat(level)}📁 ${dir} (DIRECTORIO NO EXISTE)`];
      }

      let results = [];
      const indent = ' '.repeat(level);
      try {
        const files = fs.readdirSync(dir);
        results.push(`${indent}📁 ${path.basename(dir)} (${files.length} elementos)`);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            results = results.concat(listFilesRecursively(filePath, level + 1));
          } else {
            results.push(`${indent} 📄 ${file} (${Math.round(stat.size / 1024)}KB)`);
          }
        }
      } catch (error) {
        results.push(`${indent}❌ ERROR: ${error.message}`);
      }
      return results;
    }
    
    // Extraer el archivo ZIP
    console.log(`[DIRECT_RESTORE] Extrayendo archivo ZIP: ${zipPath}`);
    
    try {
      // Usamos extract-zip que sabemos que funciona en la restauración de etiquetas
      const extract = require('extract-zip');
      await extract(zipPath, { dir: tempDir });
      
      // Verificar la estructura de los archivos extraídos
      console.log('[DIRECT_RESTORE] Estructura detallada de los archivos extraídos:');
      const fileStructure = listFilesRecursively(tempDir);
      fileStructure.forEach(line => console.log(line));
      
      // Verificar que el directorio de destino existe
      const docsDir = path.join(__dirname, 'buckets', targetBucket);
      if (!fs.existsSync(docsDir)) {
        console.log(`[DIRECT_RESTORE] Creando directorio de destino: ${docsDir}`);
        fs.mkdirSync(docsDir, { recursive: true });
      } else {
        console.log(`[DIRECT_RESTORE] Directorio de destino existe: ${docsDir}`);
        // Listar contenido del directorio de destino antes de copiar
        console.log('[DIRECT_RESTORE] Contenido del directorio de destino ANTES de copiar:');
        const destStructureBefore = listFilesRecursively(docsDir);
        destStructureBefore.forEach(line => console.log(line));
      }
      
      // Restaurar los archivos de manera más robusta
      console.log(`[DIRECT_RESTORE] Iniciando copia de archivos a: ${docsDir}`);
      
      // Función de copia mejorada
      function copyFilesSafely(src, dest) {
        console.log(`[DIRECT_RESTORE] Copiando de ${src} a ${dest}`);
        
        // Verificar que el origen existe
        if (!fs.existsSync(src)) {
          console.error(`[DIRECT_RESTORE] ERROR: Origen no existe: ${src}`);
          return false;
        }
        
        // Crear destino si no existe
        if (!fs.existsSync(dest)) {
          console.log(`[DIRECT_RESTORE] Creando directorio: ${dest}`);
          fs.mkdirSync(dest, { recursive: true });
        }
        
        // Leer el contenido del origen
        const items = fs.readdirSync(src);
        console.log(`[DIRECT_RESTORE] Encontrados ${items.length} elementos para copiar`);
        
        let copiedCount = 0;
        let errorCount = 0;
        
        // Copiar cada elemento
        for (const item of items) {
          if (item === 'backup.zip' || item === 'database-export.json' || 
              item === 'metadata.json' || item === 'tags.json') {
            console.log(`[DIRECT_RESTORE] Omitiendo archivo especial: ${item}`);
            continue;
          }
          
          const srcPath = path.join(src, item);
          const destPath = path.join(dest, item);
          
          try {
            const stat = fs.statSync(srcPath);
            
            if (stat.isDirectory()) {
              // Recursivamente copiar subdirectorios
              const success = copyFilesSafely(srcPath, destPath);
              if (success) {
                copiedCount++;
              } else {
                errorCount++;
              }
            } else {
              // Copiar archivo
              console.log(`[DIRECT_RESTORE] Copiando archivo: ${item} (${Math.round(stat.size / 1024)}KB)`);
              fs.copyFileSync(srcPath, destPath);
              copiedCount++;
            }
          } catch (itemError) {
            console.error(`[DIRECT_RESTORE] Error al copiar ${item}: ${itemError.message}`);
            errorCount++;
          }
        }
        
        console.log(`[DIRECT_RESTORE] Resultados de copia: ${copiedCount} exitosos, ${errorCount} errores`);
        return errorCount === 0;
      }
      
      // Primero, verificar si hay directorios específicos que debemos usar
      const potentialSourceDirs = ['files', 'documentos', 'archivos', 'documents', 'backup'];
      let sourceDir = tempDir;
      
      for (const dirName of potentialSourceDirs) {
        const dirPath = path.join(tempDir, dirName);
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          sourceDir = dirPath;
          console.log(`[DIRECT_RESTORE] Usando directorio específico: ${dirName}`);
          break;
        }
      }
      
      // Iniciar la copia desde el directorio fuente
      const copySuccess = copyFilesSafely(sourceDir, docsDir);
      
      // Verificar que los archivos se han copiado correctamente
      console.log('[DIRECT_RESTORE] Contenido del directorio de destino DESPUÉS de copiar:');
      const destStructureAfter = listFilesRecursively(docsDir);
      destStructureAfter.forEach(line => console.log(line));
      
      if (copySuccess) {
        console.log(`[DIRECT_RESTORE] Archivos copiados exitosamente de ${sourceDir} a ${docsDir}`);
      } else {
        console.warn(`[DIRECT_RESTORE] Se completó la copia con algunos errores`);
      }
      
      // Restaurar metadatos si existe el archivo
      const metadataFile = path.join(tempDir, 'metadata.json');
      if (fs.existsSync(metadataFile)) {
        try {
          console.log(`[DIRECT_RESTORE] Restaurando metadatos desde: ${metadataFile}`);
          const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
          // Aquí se puede implementar la lógica para restaurar los metadatos
        } catch (metadataError) {
          console.error('[DIRECT_RESTORE] Error al restaurar metadatos:', metadataError);
        }
      }
      
      // Limpiar archivos temporales
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`[DIRECT_RESTORE] Directorio temporal eliminado: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`[DIRECT_RESTORE] Error al limpiar directorio temporal: ${cleanupError.message}`);
      }
      
      return res.json({
        success: true,
        message: 'Restauración completada exitosamente'
      });
      
    } catch (extractError) {
      console.error('[DIRECT_RESTORE] Error al extraer ZIP:', extractError);
      
      // Intento alternativo con otro método
      try {
        console.log('[DIRECT_RESTORE] Intentando método alternativo de extracción...');
        
        // Intentar con spawn para utilizar utilidades del sistema
        const { spawn } = require('child_process');
        
        if (process.platform === 'win32') {
          // En Windows, intentar con PowerShell
          const psProcess = spawn('powershell.exe', [
            '-Command',
            `Expand-Archive -Path "${zipPath}" -DestinationPath "${tempDir}" -Force`
          ]);
          
          await new Promise((resolve, reject) => {
            psProcess.on('close', (code) => {
              if (code === 0) {
                console.log('[DIRECT_RESTORE] Extracción con PowerShell exitosa');
                resolve();
              } else {
                console.warn('[DIRECT_RESTORE] Error en extracción con PowerShell');
                resolve(); // Continuamos para probar el siguiente método
              }
            });
          });
        } else {
          // En Unix, intentar con unzip
          const unzipProcess = spawn('unzip', ['-o', zipPath, '-d', tempDir]);
          
          await new Promise((resolve, reject) => {
            unzipProcess.on('close', (code) => {
              if (code === 0) {
                console.log('[DIRECT_RESTORE] Extracción con unzip exitosa');
                resolve();
              } else {
                console.warn('[DIRECT_RESTORE] Error en extracción con unzip');
                resolve(); // Continuamos para probar el siguiente método
              }
            });
          });
        }
        
        // Verificar si se extrajeron archivos
        const filesAfterAlt = fs.readdirSync(tempDir);
        if (filesAfterAlt.length > 1 || (filesAfterAlt.length === 1 && filesAfterAlt[0] !== 'backup.zip')) {
          console.log('[DIRECT_RESTORE] Método alternativo de extracción exitoso, continuando con restauración...');
          
          // Continuamos con el mismo proceso de copia que antes
          const docsDir = path.join(__dirname, 'buckets', targetBucket);
          if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
          }
          
          // Intentar restaurar los archivos
          console.log(`[DIRECT_RESTORE] Copiando archivos extraídos a: ${docsDir}`);
          
          // Copiar todo el contenido recursivamente
          function copyRecursive(src, dest) {
            if (fs.existsSync(src)) {
              const stats = fs.statSync(src);
              if (stats.isDirectory()) {
                if (!fs.existsSync(dest)) {
                  fs.mkdirSync(dest, { recursive: true });
                }
                fs.readdirSync(src).forEach(function(childItemName) {
                  if (childItemName !== 'backup.zip' && !childItemName.endsWith('.json')) {
                    copyRecursive(
                      path.join(src, childItemName),
                      path.join(dest, childItemName)
                    );
                  }
                });
              } else {
                fs.copyFileSync(src, dest);
              }
            }
          }
          
          // Buscar carpetas específicas en el directorio temporal
          const potentialSourceDirs = ['files', 'documentos', 'archivos', 'documents', 'backup'];
          let sourceDir = tempDir;
          
          for (const dirName of potentialSourceDirs) {
            const dirPath = path.join(tempDir, dirName);
            if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
              sourceDir = dirPath;
              console.log(`[DIRECT_RESTORE] Usando directorio específico: ${dirName}`);
              break;
            }
          }
          
          copyRecursive(sourceDir, docsDir);
          console.log(`[DIRECT_RESTORE] Archivos copiados exitosamente con método alternativo`);
          
          // Limpiar archivos temporales
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.error(`[DIRECT_RESTORE] Error al limpiar directorio temporal: ${cleanupError.message}`);
          }
          
          return res.json({
            success: true,
            message: 'Restauración completada exitosamente (método alternativo)'
          });
        } else {
          throw new Error('No se pudieron extraer archivos con el método alternativo');
        }
      } catch (altError) {
        console.error('[DIRECT_RESTORE] Error en método alternativo:', altError);
        
        // Último recurso: copiar el archivo ZIP directamente
        try {
          console.log(`[DIRECT_RESTORE] Procediendo a restauración manual (último recurso)`);
          
          // Obtener la ruta del directorio de documentos
          const docsDir = path.join(__dirname, 'buckets', targetBucket);
          
          // Crear el directorio si no existe
          fs.mkdirSync(docsDir, { recursive: true });
          
          // Copiar el archivo ZIP al directorio de destino
          const destZipPath = path.join(docsDir, req.file.originalname);
          fs.copyFileSync(zipPath, destZipPath);
          
          console.log(`[DIRECT_RESTORE] Archivo ZIP copiado a: ${destZipPath}`);
          
          // Limpiar archivos temporales
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.error(`[DIRECT_RESTORE] Error al limpiar directorio temporal: ${cleanupError.message}`);
          }
          
          return res.json({
            success: true,
            message: 'Archivo de backup copiado al bucket (sin extraer). Puede ser necesario procesarlo manualmente.',
            warning: 'No se pudo extraer el archivo ZIP automaticamente'
          });
        } catch (copyError) {
          console.error('[DIRECT_RESTORE] Error al copiar ZIP:', copyError);
          return res.status(500).json({
            success: false,
            message: 'Error al procesar archivo: No se pudo extraer ni copiar'
          });
        }
      }
    }
  } catch (error) {
    console.error('[DIRECT_RESTORE] Error general:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al procesar la restauración: ' + error.message 
    });
  }
});

// Nuevo endpoint simplificado para restauración
app.post('/api/simple-restore', upload.single('backupFile'), async (req, res) => {
  console.log('[SIMPLE_RESTORE] Iniciando proceso de restauración simplificado');
  
  // Objeto para registrar cada paso del proceso
  const processLog = {
    steps: [],
    success: false,
    errors: []
  };

  try {
    // Paso 1: Validar datos de entrada
    if (!req.file) {
      processLog.errors.push('No se proporcionó archivo de backup');
      return res.status(400).json({ 
        success: false, 
        message: 'No se proporcionó archivo de backup',
        log: processLog
      });
    }
    
    processLog.steps.push('Archivo recibido correctamente');
    
    // Obtener el bucket destino
    const targetBucket = req.body.targetBucket || req.body.bucketName;
    
    if (!targetBucket) {
      processLog.errors.push('Nombre de bucket destino no proporcionado');
      return res.status(400).json({ 
        success: false, 
        message: 'Nombre de bucket destino no proporcionado',
        log: processLog
      });
    }
    
    processLog.steps.push(`Bucket destino identificado: ${targetBucket}`);
    
    // Paso 2: Crear directorio temporal
    const tempDir = path.join(os.tmpdir(), 'simple_restore_' + Date.now());
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      processLog.steps.push(`Directorio temporal creado: ${tempDir}`);
    } catch (mkdirError) {
      processLog.errors.push(`Error al crear directorio temporal: ${mkdirError.message}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Error al crear directorio temporal',
        error: mkdirError.message,
        log: processLog
      });
    }
    
    // Paso 3: Guardar archivo ZIP
    const zipPath = path.join(tempDir, 'backup.zip');
    try {
      fs.writeFileSync(zipPath, req.file.buffer);
      const stats = fs.statSync(zipPath);
      processLog.steps.push(`Archivo ZIP guardado: ${zipPath} (${stats.size} bytes)`);
    } catch (saveError) {
      processLog.errors.push(`Error al guardar archivo ZIP: ${saveError.message}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Error al guardar archivo ZIP',
        error: saveError.message,
        log: processLog
      });
    }
    
    // Paso 4: Extraer archivo ZIP
    try {
      // Importar módulo para extraer ZIP
      const extract = require('extract-zip');
      await extract(zipPath, { dir: tempDir });
      
      // Verificar que se extrajeron archivos
      const extractedFiles = fs.readdirSync(tempDir);
      processLog.steps.push(`ZIP extraído correctamente con ${extractedFiles.length} elementos`);
      
      // Listar archivos extraídos
      const extractedFilesList = extractedFiles.map(file => {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        return `${file} (${stats.isDirectory() ? 'directorio' : `${Math.round(stats.size / 1024)}KB`})`;
      });
      processLog.steps.push(`Archivos extraídos: ${extractedFilesList.join(', ')}`);
      
    } catch (extractError) {
      processLog.errors.push(`Error al extraer ZIP: ${extractError.message}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Error al extraer archivo ZIP',
        error: extractError.message,
        log: processLog
      });
    }
    
    // Paso 5: Verificar directorio destino
    const docsDir = path.join(__dirname, 'buckets', targetBucket);
    try {
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
        processLog.steps.push(`Directorio destino creado: ${docsDir}`);
      } else {
        processLog.steps.push(`Directorio destino ya existe: ${docsDir}`);
      }
    } catch (dirError) {
      processLog.errors.push(`Error al verificar/crear directorio destino: ${dirError.message}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Error al verificar/crear directorio destino',
        error: dirError.message,
        log: processLog
      });
    }
    
    // Paso 6: Copiar archivos
    try {
      // Copiar archivos manualmente
      function copyFile(src, dest) {
        try {
          fs.copyFileSync(src, dest);
          return true;
        } catch (e) {
          console.error(`[SIMPLE_RESTORE] Error al copiar archivo ${src} a ${dest}: ${e.message}`);
          return false;
        }
      }
      
      function copyDir(srcDir, destDir) {
        // Crear el directorio de destino si no existe
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        let copied = 0;
        let errors = 0;
        
        // Leer el contenido del directorio
        const entries = fs.readdirSync(srcDir);
        
        // Iterar sobre cada entrada
        for (const entry of entries) {
          // Omitir archivos especiales
          if (entry === 'backup.zip' || entry === 'database-export.json' || 
              entry === 'metadata.json' || entry === 'tags.json') {
            continue;
          }
          
          const srcPath = path.join(srcDir, entry);
          const destPath = path.join(destDir, entry);
          
          const stat = fs.statSync(srcPath);
          
          if (stat.isDirectory()) {
            // Si es un directorio, copiar recursivamente
            const result = copyDir(srcPath, destPath);
            copied += result.copied;
            errors += result.errors;
          } else {
            // Si es un archivo, copiar directamente
            if (copyFile(srcPath, destPath)) {
              copied++;
            } else {
              errors++;
            }
          }
        }
        
        return { copied, errors };
      }
      
      // Buscar directorios específicos como en la versión anterior
      const potentialSourceDirs = ['files', 'documentos', 'archivos', 'documents', 'backup'];
      let sourceDir = tempDir;
      
      for (const dirName of potentialSourceDirs) {
        const dirPath = path.join(tempDir, dirName);
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          sourceDir = dirPath;
          processLog.steps.push(`Usando directorio específico para copia: ${dirName}`);
          break;
        }
      }
      
      // Iniciar copia
      processLog.steps.push(`Iniciando copia de archivos desde ${sourceDir} a ${docsDir}`);
      const copyResult = copyDir(sourceDir, docsDir);
      
      if (copyResult.errors === 0) {
        processLog.steps.push(`Copia completada exitosamente: ${copyResult.copied} archivos copiados`);
      } else {
        processLog.steps.push(`Copia completada con advertencias: ${copyResult.copied} archivos copiados, ${copyResult.errors} errores`);
      }
      
    } catch (copyError) {
      processLog.errors.push(`Error al copiar archivos: ${copyError.message}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Error al copiar archivos',
        error: copyError.message,
        log: processLog
      });
    }
    
    // Paso 7: Limpiar archivos temporales
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      processLog.steps.push('Archivos temporales eliminados correctamente');
    } catch (cleanupError) {
      processLog.steps.push(`Advertencia: No se pudieron eliminar archivos temporales: ${cleanupError.message}`);
      // No fallamos por esto, solo es una advertencia
    }
    
    // Todo exitoso
    processLog.success = true;
    
    return res.status(200).json({
      success: true,
      message: 'Restauración completada exitosamente',
      log: processLog
    });
    
  } catch (generalError) {
    // Error general no manejado
    processLog.errors.push(`Error general no manejado: ${generalError.message}`);
    console.error('[SIMPLE_RESTORE] Error general:', generalError);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error general no manejado',
      error: generalError.message,
      log: processLog
    });
  }
});

// Iniciar el servidor  
app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
  console.log(`Bucket configurado: ${defaultBucketName}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Supabase Key configurada: ${!!supabaseKey}`);
});
