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
const bucketName = process.env.BUCKET_NAME;

// Verificar que las variables de entorno estén configuradas
if (!supabaseUrl || !supabaseKey || !bucketName) {
  console.error('ERROR: Variables de entorno faltantes. Asegúrate de configurar SUPABASE_URL, SUPABASE_KEY y BUCKET_NAME.');
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
    fileSize: 2 * 1024 * 1024, // Límite de 2MB
  }
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
    
    const searchTerm = req.query.term;
    
    if (!searchTerm) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere un término de búsqueda' 
      });
    }

    console.log(`Buscando archivos/carpetas que coincidan con: "${searchTerm}"`);
    
    // Función recursiva para buscar en carpetas
    const searchResults = [];
    
    // Función auxiliar para buscar en una carpeta específica
    async function searchInFolder(prefix) {
      const { data: filesInFolder, error } = await supabase
        .storage
        .from(bucketName)
        .list(prefix, { 
          sortBy: { column: 'name', order: 'asc' }
        });
      
      if (error) {
        console.error(`Error al buscar en carpeta ${prefix}:`, error);
        return;
      }
      
      // Procesar los resultados de esta carpeta
      for (const item of filesInFolder) {
        // Ignorar archivos especiales .folder
        if (item.name === '.folder') continue;
        
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
    
    console.log(`Se encontraron ${searchResults.length} resultados para "${searchTerm}"`);
    
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
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha enviado ningún archivo'
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
      .from(bucketName)
      .upload(fullPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });
    
    if (error) {
      throw error;
    }
    
    // Obtener URL pública
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
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
    
    console.log(`Obteniendo URL para: ${normalizedPath}, visualizar: ${view}`);
    
    // Obtener la URL pública
    const { data } = supabase.storage
      .from(bucketName)
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
      fileType: fileExtension.slice(1) // Sin el punto
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
      .from(bucketName)
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
        .from(bucketName)
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
            .from(bucketName)
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
        .from(bucketName)
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
      .from(bucketName)
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
        .from(bucketName)
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
          .from(bucketName)
          .remove(itemsToDelete);
        
        console.log('Resultado de eliminación múltiple:', deleteResult);
        
        if (deleteResult.error && deleteResult.error.message !== 'Object not found') {
          console.error('Error en la eliminación múltiple:', deleteResult.error);
          throw deleteResult.error;
        }
      }
      
      // Intento adicional de eliminar la carpeta misma
      const deleteFolderResult = await supabase.storage
        .from(bucketName)
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
        .from(bucketName)
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
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(metadataPath);
    
    if (error && error.message !== 'The object was not found') {
      console.error('Error al obtener metadatos:', error);
      throw error;
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
        .from(bucketName)
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
      .from(bucketName)
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
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(metadataPath);
    
    if (error && error.message !== 'The object was not found') {
      console.error('Error al obtener metadatos de audio:', error);
      throw error;
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
        .from(bucketName)
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
      .from(bucketName)
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
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(metadataPath);
    
    if (error && error.message !== 'The object was not found') {
      console.error('Error al obtener metadatos de imagen:', error);
      throw error;
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
        .from(bucketName)
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
      .from(bucketName)
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
    
    const prefix = req.query.prefix || '';
    
    // Normalizar el prefijo
    let normalizedPrefix = prefix;
    if (normalizedPrefix.startsWith('/')) {
      normalizedPrefix = normalizedPrefix.substring(1);
    }
    
    console.log(`Listando archivos con prefijo: "${normalizedPrefix}"`);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(normalizedPrefix, {
        sortBy: { column: 'name', order: 'asc' }
      });
    
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
  console.log('Endpoint view-docx llamado');
  console.log('Query parameters:', req.query);
  
  try {
    // Verificar si Supabase está configurado
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Cliente de Supabase no configurado correctamente.'
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
      .from(bucketName)
      .download(normalizedPath);
    
    if (error) {
      console.error('Error al descargar DOCX:', error);
      throw error;
    }
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado'
      });
    }
    
    // Convertir el arrayBuffer a Buffer para mammoth
    const buffer = Buffer.from(await data.arrayBuffer());
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
      
      // Enviar el HTML con estilos adicionales
      res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Visor de Documentos - ${path.basename(normalizedPath)}</title>
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
      const { data, error } = await supabase.storage
        .from(bucketName)
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
    
    // Credenciales válidas (deberías almacenar estas en variables de entorno)
    const validCredentials = {
      'admin': 'Jh811880',
      'usuario': 'usuario123'
    };
    
    // Verificar las credenciales
    if (validCredentials[username] && validCredentials[username] === password) {
      // Credenciales correctas
      res.status(200).json({
        success: true,
        user: {
          username: username,
          role: username === 'admin' ? 'admin' : 'user'
        }
      });
    } else {
      // Credenciales incorrectas
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


// Endpoint de autenticación
app.post('/api/login', express.json(), async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Credenciales válidas (estas pueden ser actualizadas aquí)
    const validCredentials = {
      'admin': 'Jh811880',
      'usuario': 'usuario123'
    };
    
    // Verificar las credenciales
    if (validCredentials[username] && validCredentials[username] === password) {
      // Credenciales correctas
      res.status(200).json({
        success: true,
        user: {
          username: username,
          role: username === 'admin' ? 'admin' : 'user'
        }
      });
    } else {
      // Credenciales incorrectas
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

// Iniciar el servidor  
app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
  console.log(`Bucket configurado: ${bucketName}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Supabase Key configurada: ${!!supabaseKey}`);
});