require('dotenv').config();

console.log('Todas las variables de entorno disponibles:');
console.log(Object.keys(process.env));

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;



// Middleware
app.use(cors({
  origin: ['https://directoryofsites.github.io', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));


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
    fileSize: 36 * 1024 * 1024, // Límite de 36MB
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
      
      // IMPORTANTE: Verificar que estamos usando la propiedad correcta del token
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
        
        if (tokenData.username && userBucketMap[tokenData.username]) {
          tokenUsername = tokenData.username;
          const tokenBucket = userBucketMap[tokenData.username];
          console.log(`[SEARCH] Usando bucket ${tokenBucket} desde token en parámetros`);
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
    // Verificar permisos - solo admin puede subir archivos
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para subir archivos. Se requiere rol de administrador.'
      });
    }
   
    // Calcular tamaño actual del bucket y verificar límite (950MB)
    console.log(`Calculando tamaño actual del bucket ${bucketToUse}...`);
    const currentBucketSize = await calculateBucketSize(bucketToUse);
    const fileSizeInBytes = req.file.size;
    const maxBucketSize = 950 * 1024 * 1024; // 950MB en bytes
    
    console.log(`Tamaño actual del bucket: ${(currentBucketSize / (1024 * 1024)).toFixed(2)}MB`);
    console.log(`Tamaño del archivo a subir: ${(fileSizeInBytes / (1024 * 1024)).toFixed(2)}MB`);
    
    // Verificar si el archivo excede el límite total
    if (currentBucketSize + fileSizeInBytes > maxBucketSize) {
      return res.status(413).json({
        success: false,
        message: `No se puede subir el archivo. Se excedería el límite de 800MB para el repositorio. Tamaño actual: ${(currentBucketSize / (1024 * 1024)).toFixed(2)}MB, Tamaño del archivo: ${(fileSizeInBytes / (1024 * 1024)).toFixed(2)}MB`,
        currentSize: currentBucketSize,
        fileSize: fileSizeInBytes,
        maxSize: maxBucketSize
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
    
    // SOLUCIÓN: Verificar si hay un token en los parámetros de consulta
    let bucketToUse = req.bucketName || defaultBucketName;
    let tokenUsername = null;
    
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log(`[DOWNLOAD] Token en parámetros de consulta decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.username && userBucketMap[tokenData.username]) {
          tokenUsername = tokenData.username;
          const tokenBucket = userBucketMap[tokenData.username];
          console.log(`[DOWNLOAD] Usando bucket ${tokenBucket} desde token en parámetros`);
          bucketToUse = tokenBucket;
          
          // Actualizar también req.username y req.userRole para las validaciones posteriores
          req.username = tokenData.username;
          req.userRole = userRoleMap[tokenData.username] || 'user';
        }
      } catch (tokenError) {
        console.error('[DOWNLOAD] Error al decodificar token de parámetros:', tokenError);
      }
    }
    
    // Verificar explícitamente que el bucket sea el correcto
    console.log(`[DOWNLOAD] Verificando bucketName en request: ${bucketToUse}`);
    console.log(`[DOWNLOAD] Verificando username en request: ${req.username}`);
    console.log(`[DOWNLOAD] Bucket mapeado para usuario ${req.username}: ${userBucketMap[req.username]}`);
    
    // Validación adicional de seguridad
    if (req.username && userBucketMap[req.username] && bucketToUse !== userBucketMap[req.username]) {
      console.error(`[DOWNLOAD] ERROR: Discrepancia de bucket - Usuario ${req.username} debería usar ${userBucketMap[req.username]} pero está usando ${bucketToUse}`);
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: Bucket no válido para este usuario'
      });
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
    
    // Obtener la URL pública
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
    // Verificar permisos - solo admin puede crear carpetas
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para crear carpetas. Se requiere rol de administrador.'
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
    // Verificar permisos - solo admin puede eliminar carpetas
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar carpetas. Se requiere rol de administrador.'
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
    // Verificar permisos - solo admin puede eliminar archivos
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar archivos. Se requiere rol de administrador.'
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
    
    // Verificar permisos - solo admin puede modificar URL de YouTube
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para modificar URL de YouTube. Se requiere rol de administrador.'
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
    
    // Verificar permisos - solo admin puede modificar URL de audio
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para modificar URL de audio. Se requiere rol de administrador.'
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
    
    // SOLUCIÓN DIRECTA: Extraer directamente la información del token
    const authHeader = req.headers.authorization;
    let forcedBucket = defaultBucketName;
    let username = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        console.log(`[FILES-EMERGENCY] Token recibido: ${token}`);
        
        const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
        console.log(`[FILES-EMERGENCY] Token decodificado:`, JSON.stringify(tokenData));
        
        if (tokenData.username && userBucketMap[tokenData.username]) {
          username = tokenData.username;
          forcedBucket = userBucketMap[tokenData.username];
          console.log(`[FILES-EMERGENCY] Forzando uso de bucket ${forcedBucket} para usuario ${tokenData.username}`);
        } else {
          console.log(`[FILES-EMERGENCY] No se pudo determinar el bucket para:`, JSON.stringify(tokenData));
          if (tokenData.username) {
            console.log(`[FILES-EMERGENCY] ¿Existe ${tokenData.username} en userBucketMap?`, !!userBucketMap[tokenData.username]);
          }
        }
      } catch (error) {
        console.error('[FILES-EMERGENCY] Error al procesar token para forzar bucket:', error);
      }
    } else {
      console.log(`[FILES-EMERGENCY] No hay token de autorización`);
    }
    
    // Usar el bucket forzado en lugar de req.bucketName
    const bucketToUse = forcedBucket;
    console.log(`[FILES-EMERGENCY] Usando bucket: ${bucketToUse}`);    
    const prefix = req.query.prefix || '';
    
    // Normalizar el prefijo
    let normalizedPrefix = prefix;
    if (normalizedPrefix.startsWith('/')) {
      normalizedPrefix = normalizedPrefix.substring(1);
    }
    
    console.log(`[FILES] Listando archivos con prefijo: "${normalizedPrefix}" en bucket: ${bucketToUse}`);
    console.log(`[FILES] Usuario: ${req.username || 'invitado'}, Rol: ${req.userRole}`);
    
    const { data, error } = await supabase.storage
      .from(bucketToUse)
      .list(normalizedPrefix, {
        sortBy: { column: 'name', order: 'asc' }
      });
      
    console.log(`[FILES] Respuesta de Supabase para ${bucketToUse}/${normalizedPrefix}: ${error ? 'ERROR' : 'Éxito'}, ${data ? data.length : 0} elementos`);

    if (error) {
      throw error;
    }
    
    // Formatear la respuesta y filtrar archivos de metadatos
    const formattedFiles = data
      .filter(item => {
        // Filtrar archivos de metadatos (.youtube.metadata, .audio.metadata, .image.metadata)
        return !item.name.endsWith('.youtube.metadata') && 
               !item.name.endsWith('.audio.metadata') && 
               !item.name.endsWith('.image.metadata');
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
      
      // Obtener el bucket específico del usuario desde el middleware
      const bucketToUse = req.bucketName || defaultBucketName;
      
      // Verificar explícitamente que el bucket sea el correcto
      console.log(`[VIEW_DOCX] Verificando bucketName en request: ${req.bucketName}`);
      console.log(`[VIEW_DOCX] Verificando username en request: ${req.username}`);
      console.log(`[VIEW_DOCX] Bucket mapeado para usuario ${req.username}: ${userBucketMap[req.username]}`);
      
      // Validación adicional de seguridad
      if (req.username && userBucketMap[req.username] && req.bucketName !== userBucketMap[req.username]) {
        console.error(`[VIEW_DOCX] ERROR: Discrepancia de bucket - Usuario ${req.username} debería usar ${userBucketMap[req.username]} pero está usando ${req.bucketName}`);
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


    // Verificar las credenciales
    if (validCredentials[username] && validCredentials[username] === password) {
      // Determinar el bucket y rol del usuario
      const userBucket = userBucketMap[username] || defaultBucketName;
      const userRole = userRoleMap[username] || 'user';
      
      console.log(`Usuario ${username} autenticado con rol ${userRole} para bucket ${userBucket}`);
      
      // Credenciales correctas
      res.status(200).json({
        success: true,
        user: {
          username: username,
          role: userRole,
          bucket: userBucket
        }
      });
    } else {
      // Credenciales incorrectas
      console.log(`Intento de autenticación fallido para usuario: ${username}`);
      res.status(401).json({
        success: false,
        message: 'Nombre de usuario o contraseña incorrectos'
      });
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

    // Obtener el nombre del bucket desde el middleware
    const bucketToCheck = req.bucketName || defaultBucketName;
    
    console.log(`Calculando tamaño total del bucket: ${bucketToCheck}`);
    const totalSizeBytes = await calculateBucketSize(bucketToCheck);
    const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
    const maxBucketSize = 800 * 1024 * 1024; // 800MB en bytes
    const percentUsed = ((totalSizeBytes / maxBucketSize) * 100).toFixed(2);
    
    res.status(200).json({
      success: true,
      bucket: bucketToCheck,
      sizeBytes: totalSizeBytes,
      sizeMB: parseFloat(totalSizeMB),
      maxSizeMB: 800,
      percentUsed: parseFloat(percentUsed),
      remainingMB: (800 - parseFloat(totalSizeMB)).toFixed(2)
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
    
    if (req.query.token) {
      try {
        const tokenData = JSON.parse(Buffer.from(req.query.token, 'base64').toString());
        console.log('Token decodificado:', tokenData);
        
        if (tokenData.username && userBucketMap[tokenData.username]) {
          bucketToUse = userBucketMap[tokenData.username];
          console.log(`Usando bucket ${bucketToUse} desde el token`);
        }
      } catch (tokenError) {
        console.error('Error al decodificar token:', tokenError);
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

// Iniciar el servidor  
app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
  console.log(`Bucket configurado: ${defaultBucketName}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Supabase Key configurada: ${!!supabaseKey}`);
});

