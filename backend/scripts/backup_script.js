// Script para crear una copia de seguridad completa con soporte para cualquier bucket
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const archiver = require('archiver');
const os = require('os');

// Configuración
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Detectar si estamos en Railway
const isRailway = process.env.RAILWAY_PROJECT_ID !== undefined;
const isProduction = process.env.NODE_ENV === 'production' || isRailway;

console.log(`Entorno detectado: ${isProduction ? 'Producción' : 'Desarrollo'} ${isRailway ? '(Railway)' : ''}`);
console.log(`SUPABASE_URL configurada: ${!!supabaseUrl}`);
console.log(`SUPABASE_KEY configurada: ${!!supabaseKey}`);

// Obtener argumentos de línea de comandos
const sourceBucket = process.argv[2];
const outputPath = process.argv[3] || `backup-${sourceBucket}-${new Date().toISOString().split('T')[0]}.zip`;

if (!sourceBucket) {
  console.error('Por favor proporciona el bucket de origen');
  console.error('Uso: node backup_script.js <bucket-origen> [ruta-de-salida.zip]');
  process.exit(1);
}

console.log(`Bucket origen: ${sourceBucket}`);
console.log(`Archivo de salida: ${outputPath}`);

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Directorio temporal para los archivos
const tempDir = process.env.NODE_ENV === 'production' || process.env.RAILWAY_PROJECT_ID
  ? path.join('/tmp', `backup-${Date.now()}`)
  : path.join(os.tmpdir(), `backup-${Date.now()}`);

console.log(`Usando directorio temporal: ${tempDir}`);

// Mapeo de admins a buckets (similar al del servidor)
const adminBucketMap = {
  'admin': 'master',
  'admin1': 'contenedor001',
  'admin2': 'contenedor002',
  'admin3': 'contenedor003',
  'admin4': 'contenedor004',
  'admin5': 'contenedor005',
  'admin6': 'contenedor006',
  'admin7': 'contenedor007',
  'admin8': 'contenedor008',
  'admin9': 'contenedor009',
  'admin10': 'contenedor010',
  'admin11': 'contenedor011',
  'admin12': 'contenedor012',
  'admin13': 'contenedor013',
  'adminpruebas': 'pruebas',
  'adminpersonal1': 'personal1'
};

// Función para obtener los admins de un bucket
function getAdminsForBucket(bucket) {
  const admins = [];
  for (const [admin, adminBucket] of Object.entries(adminBucketMap)) {
    if (adminBucket === bucket) {
      admins.push(admin);
    }
  }
  return admins;
}

// Función para verificar que un bucket existe
async function checkBucketExists(bucket) {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      throw new Error(`Error al listar buckets: ${error.message}`);
    }
    
    const bucketExists = buckets.some(b => b.name === bucket);
    if (!bucketExists) {
      throw new Error(`El bucket "${bucket}" no existe en Supabase. Buckets disponibles: ${buckets.map(b => b.name).join(', ')}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error al verificar bucket ${bucket}:`, error.message);
    process.exit(1);
  }
}

console.log(`INICIANDO COPIA DE SEGURIDAD del bucket: ${sourceBucket}`);
    
    // Verificar permisos de escritura en directorios críticos
    console.log('Verificando permisos de escritura en directorios críticos...');
    const criticalDirs = [
      tempDir,
      '/tmp',
      process.cwd()
    ];
    
    for (const dir of criticalDirs) {
      try {
        // Verificar si el directorio existe
        if (!fs.existsSync(dir)) {
          console.log(`Creando directorio ${dir}...`);
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Verificar permisos de escritura
        const testFile = path.join(dir, `test-write-${Date.now()}.tmp`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`✓ Directorio ${dir} tiene permisos de escritura`);
      } catch (error) {
        console.error(`✗ Error de permisos en ${dir}:`, error.message);
        
        if (dir === tempDir) {
          console.log('Intentando usar directorio alternativo /tmp...');
          tempDir = '/tmp';
        }
      }
    }
    
    console.log(`Directorio temporal final: ${tempDir}`);

async function main() {
  try {

    console.log(`INICIANDO COPIA DE SEGURIDAD del bucket: ${sourceBucket}`);
    
    // Información de diagnóstico del entorno
    console.log('==== INFORMACIÓN DEL ENTORNO ====');
    console.log(`Fecha y hora: ${new Date().toISOString()}`);
    console.log(`Node.js versión: ${process.version}`);
    console.log(`Plataforma: ${process.platform}`);
    console.log(`Directorio de trabajo: ${process.cwd()}`);
    console.log(`Directorio de ejecución: ${__dirname}`);
    console.log(`Variables de entorno disponibles: ${Object.keys(process.env).filter(k => !k.includes('KEY') && !k.includes('SECRET')).join(', ')}`);
    console.log(`Railway detectado: ${isRailway ? 'Sí' : 'No'}`);
    console.log(`Modo de ejecución: ${isProduction ? 'Producción' : 'Desarrollo'}`);
    console.log('================================');
    
    // Verificar las dependencias
    try {
      const archiverVersion = require('archiver/package.json').version;
      const supabaseVersion = require('@supabase/supabase-js/package.json').version;
      console.log(`Versiones de dependencias: archiver@${archiverVersion}, supabase-js@${supabaseVersion}`);
    } catch (err) {
      console.log('No se pudieron determinar las versiones de las dependencias');
    }
    
    // Verificar que el bucket existe
    await checkBucketExists(sourceBucket);
    
 // Verificar y crear directorios temporales necesarios
console.log('Verificando directorios temporales necesarios...');
const tempDirsToCreate = [
  tempDir,
  '/tmp/docubox',
  '/tmp/docubox-backup',
  '/tmp/backups',
  '/tmp/uploads'
];

tempDirsToCreate.forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Directorio temporal creado: ${dir}`);
    } else {
      console.log(`Directorio temporal ya existe: ${dir}`);
    }
  } catch (err) {
    console.error(`Error al crear directorio temporal ${dir}:`, err);
  }
});
    
    // Crear archivo ZIP
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    
    // Configurar eventos del archivador
    output.on('close', () => {
      console.log(`Archivo ZIP creado: ${outputPath}`);
      console.log(`Tamaño total: ${archive.pointer()} bytes`);
      
      // Limpiar tempDir
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('Directorio temporal eliminado');
      } catch (error) {
        console.error('Error al eliminar directorio temporal:', error);
      }
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.pipe(output);
    
    // Exportar todas las tablas que necesitamos
    console.log('Exportando datos de base de datos...');
    
    // PASO 1: Buscar todas las tablas en la base de datos para encontrar donde están los usuarios dinámicos
    console.log('Buscando todas las tablas en la base de datos...');
    
    let tablesList = [];
    try {
      const { data: tables, error: tablesError } = await supabase.rpc('get_tables');
      
      if (!tablesError && tables) {
        tablesList = tables;
        console.log(`Se encontraron ${tables.length} tablas en la base de datos: ${tables.join(', ')}`);
      } else {
        console.log('Error al obtener lista de tablas, usando lista predefinida');
        tablesList = ['user_accounts', 'dynamic_users', 'dynamic_user_accounts', 'users'];
      }
    } catch (error) {
      console.log('Error al buscar tablas, usando lista predefinida');
      tablesList = ['user_accounts', 'dynamic_users', 'dynamic_user_accounts', 'users'];
    }
    
    // PASO 2: Obtener los admins para este bucket
    const bucketAdmins = getAdminsForBucket(sourceBucket);
    console.log(`Admins del bucket ${sourceBucket}: ${bucketAdmins.join(', ') || 'Ninguno encontrado'}`);
    
    // PASO 3: Buscar usuarios dinámicos en todas las tablas posibles
    console.log('Buscando usuarios dinámicos en todas las tablas posibles...');
    
    let allUsers = [];
    
    for (const table of tablesList) {
      try {
        console.log(`Buscando en tabla: ${table}`);
        
        // Obtener todos los usuarios de la tabla
        const { data: allTableUsers, error: allUsersError } = await supabase
          .from(table)
          .select('*');
        
        if (!allUsersError && allTableUsers && allTableUsers.length > 0) {
          console.log(`Encontrados ${allTableUsers.length} registros en tabla ${table}`);
          
          // Guardar todos los usuarios de esta tabla
          const usersExportPath = path.join(tempDir, `${table}-users-export.json`);
          fs.writeFileSync(usersExportPath, JSON.stringify(allTableUsers, null, 2));
          archive.file(usersExportPath, { name: `${table}-users-export.json` });
          
          // Intentar buscar usuarios dinámicos
          try {
            // Buscar usuarios con is_dynamic = true
            const dynamicUsers = allTableUsers.filter(user => user.is_dynamic === true);
            if (dynamicUsers.length > 0) {
              console.log(`Encontrados ${dynamicUsers.length} usuarios con is_dynamic=true en tabla ${table}`);
              allUsers.push(...dynamicUsers);
              
              const dynamicUsersPath = path.join(tempDir, `${table}-dynamic-flag-users.json`);
              fs.writeFileSync(dynamicUsersPath, JSON.stringify(dynamicUsers, null, 2));
              archive.file(dynamicUsersPath, { name: `${table}-dynamic-flag-users.json` });
            }
            
            // Buscar usuarios con created_by = alguno de los admins del bucket
            const adminCreatedUsers = bucketAdmins.length > 0 ? 
              allTableUsers.filter(user => user.created_by && bucketAdmins.includes(user.created_by)) : 
              [];
            
            if (adminCreatedUsers.length > 0) {
              console.log(`Encontrados ${adminCreatedUsers.length} usuarios creados por admins del bucket ${sourceBucket} en tabla ${table}`);
              
              // Filtrar para no duplicar
              const newUsers = adminCreatedUsers.filter(
                newUser => !allUsers.some(existingUser => 
                  existingUser.id === newUser.id || existingUser.username === newUser.username
                )
              );
              
              if (newUsers.length > 0) {
                console.log(`Añadiendo ${newUsers.length} usuarios únicos creados por admins`);
                allUsers.push(...newUsers);
                
                const adminUsersPath = path.join(tempDir, `${table}-admin-created-users.json`);
                fs.writeFileSync(adminUsersPath, JSON.stringify(newUsers, null, 2));
                archive.file(adminUsersPath, { name: `${table}-admin-created-users.json` });
              }
            }
            
            // Buscar usuarios que tengan el bucket igual al bucket de origen
            const bucketUsers = allTableUsers.filter(user => 
              user.bucket === sourceBucket && 
              !allUsers.some(u => u.id === user.id || u.username === user.username)
            );
            
            if (bucketUsers.length > 0) {
              console.log(`Encontrados ${bucketUsers.length} usuarios únicos con bucket=${sourceBucket} en tabla ${table}`);
              allUsers.push(...bucketUsers);
              
              const bucketUsersPath = path.join(tempDir, `${table}-bucket-users.json`);
              fs.writeFileSync(bucketUsersPath, JSON.stringify(bucketUsers, null, 2));
              archive.file(bucketUsersPath, { name: `${table}-bucket-users.json` });
            }
          } catch (typedError) {
            console.log(`Error al buscar usuarios específicos en tabla ${table}: ${typedError.message}`);
          }
        }
      } catch (tableError) {
        console.log(`Error al consultar tabla ${table}: ${tableError.message}`);
      }
    }
    
    // Guardar todos los usuarios encontrados
    const allUsersPath = path.join(tempDir, 'all-users-export.json');
    fs.writeFileSync(allUsersPath, JSON.stringify(allUsers, null, 2));
    archive.file(allUsersPath, { name: 'all-users-export.json' });
    
    console.log(`Total de usuarios relevantes encontrados: ${allUsers.length}`);
    
    // Exportar usuarios principales de user_accounts (la tabla principal)
    console.log('Exportando usuarios de user_accounts específicamente...');
    const { data: mainUsers, error: mainUsersError } = await supabase
      .from('user_accounts')
      .select('*');
    
    if (mainUsersError) {
      console.error('Error al exportar usuarios de user_accounts:', mainUsersError);
    } else {
      console.log(`Se encontraron ${mainUsers.length} usuarios en user_accounts`);
      
      // Detectar usuarios estáticos asociados al bucket
      const staticUsers = mainUsers.filter(user => user.bucket === sourceBucket);
      console.log(`Encontrados ${staticUsers.length} usuarios estáticos con bucket=${sourceBucket}`);
      
      // Detectar usuarios dinámicos creados por admins del bucket o asignados al bucket
      const dynamicUsers = bucketAdmins.length > 0 ? 
        mainUsers.filter(user => 
          bucketAdmins.includes(user.created_by) || // Creados por algún admin del bucket  
          (user.bucket === sourceBucket && user.assigned_folders) // O tienen el bucket correcto y carpetas asignadas
        ) : 
        mainUsers.filter(user => user.bucket === sourceBucket && user.assigned_folders);
      
      // Mostrar nombres de usuarios dinámicos encontrados
      if (dynamicUsers.length > 0) {
        console.log(`Encontrados ${dynamicUsers.length} usuarios dinámicos creados por admins del bucket ${sourceBucket}:`);
        dynamicUsers.forEach(user => {
          console.log(`- ${user.username} (creado por: ${user.created_by}, bucket: ${user.bucket})`);
        });
        
        const dynamicUsersPath = path.join(tempDir, 'dynamic-users-specific.json');
        fs.writeFileSync(dynamicUsersPath, JSON.stringify(dynamicUsers, null, 2));
        archive.file(dynamicUsersPath, { name: 'dynamic-users-specific.json' });
      }
      
      // Combinar usuarios estáticos y dinámicos
      const relevantUsers = [...new Set([...staticUsers, ...dynamicUsers])];
      console.log(`Se exportarán ${relevantUsers.length} usuarios relevantes para este bucket`);
      
      const usersExportPath = path.join(tempDir, 'users-export.json');
      fs.writeFileSync(usersExportPath, JSON.stringify(relevantUsers, null, 2));
      archive.file(usersExportPath, { name: 'users-export.json' });
      
      // Crear listado combinado con todos los usuarios
      const combinedUsers = [...relevantUsers];
      
      // Agregar usuarios que no estén ya incluidos
      allUsers.forEach(dynamicUser => {
        if (!combinedUsers.some(u => u.id === dynamicUser.id || u.username === dynamicUser.username)) {
          combinedUsers.push(dynamicUser);
        }
      });
      
      console.log(`Total combinado: ${combinedUsers.length} usuarios incluyendo todos los relevantes`);
      
      const combinedPath = path.join(tempDir, 'combined-users-export.json');
      fs.writeFileSync(combinedPath, JSON.stringify(combinedUsers, null, 2));
      archive.file(combinedPath, { name: 'combined-users-export.json' });
    }
    
    // Exportar etiquetas
    console.log('Exportando etiquetas...');
    const { data: tags, error: tagsError } = await supabase
      .from('tags_by_bucket')
      .select('*')
      .eq('bucket', sourceBucket);
    
    if (tagsError) {
      console.error('Error al exportar etiquetas:', tagsError);
    } else {
      console.log(`Se encontraron ${tags.length} etiquetas`);
      
      const tagsExportPath = path.join(tempDir, 'tags-export.json');
      fs.writeFileSync(tagsExportPath, JSON.stringify(tags, null, 2));
      archive.file(tagsExportPath, { name: 'tags-export.json' });
    }
    
    // Exportar categorías de etiquetas
console.log('Buscando categorías de etiquetas...');

try {
  // Obtener todas las etiquetas del bucket
  const { data: allTags, error: tagsError } = await supabase
    .from('tags_by_bucket')
    .select('*')
    .eq('bucket', sourceBucket);
  
  if (tagsError) {
    console.error('Error al consultar etiquetas para categorías:', tagsError);
  } else if (allTags && allTags.length > 0) {
    // Filtrar solo aquellas que tienen categoría asignada (no null)
    const tagsWithCategory = allTags.filter(tag => tag.category !== null && tag.category !== '');
    
    if (tagsWithCategory.length > 0) {
      console.log(`Se encontraron ${tagsWithCategory.length} etiquetas con categoría asignada`);
      
      // Obtener categorías únicas
      const uniqueCategories = [...new Set(tagsWithCategory.map(tag => tag.category))];
      console.log(`Categorías únicas encontradas: ${uniqueCategories.join(', ')}`);
      
      // Exportar las etiquetas con categoría
      const categoriesExportPath = path.join(tempDir, 'tags-with-categories-export.json');
      fs.writeFileSync(categoriesExportPath, JSON.stringify(tagsWithCategory, null, 2));
      archive.file(categoriesExportPath, { name: 'tags-with-categories-export.json' });
      
      // También exportar las categorías únicas por separado
      const uniqueCategoriesObj = uniqueCategories.map(category => ({
        tag_name: category,  // Usar tag_name en lugar de name
        category: category,  // Mantener la categoría igual que el nombre
        bucket: sourceBucket
      }));
      
      const uniqueCategoriesPath = path.join(tempDir, 'unique-categories-export.json');
      fs.writeFileSync(uniqueCategoriesPath, JSON.stringify(uniqueCategoriesObj, null, 2));
      archive.file(uniqueCategoriesPath, { name: 'unique-categories-export.json' });
    } else {
      console.log(`No se encontraron etiquetas con categoría asignada para el bucket ${sourceBucket}`);
    }
  } else {
    console.log(`No se encontraron etiquetas para el bucket ${sourceBucket}`);
  }
} catch (error) {
  console.error('Error al buscar categorías de etiquetas:', error);
}
    
    // Exportar configuraciones
    console.log('Buscando configuraciones...');
    
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('*')
        .eq('bucket', sourceBucket);
      
      if (!settingsError && settings) {
        console.log(`Se encontraron ${settings.length} configuraciones`);
        
        const settingsExportPath = path.join(tempDir, 'settings-export.json');
        fs.writeFileSync(settingsExportPath, JSON.stringify(settings, null, 2));
        archive.file(settingsExportPath, { name: 'settings-export.json' });
      } else {
        console.log('No se encontró tabla de configuraciones o hubo un error');
      }
    } catch (error) {
      console.log('No se encontró tabla de configuraciones');
    }
    
    // Exportar relaciones archivo-etiqueta
console.log('Buscando relaciones de archivos-etiquetas...');

try {
  // Comentado hasta confirmar el nombre correcto de la tabla o la estructura
  /*
  const { data: fileTags, error: fileTagsError } = await supabase
    .from('file_tags')  // Esta tabla no existe
    .select('*')
    .eq('bucket', sourceBucket);
  */
  
  // En su lugar, verificar si esta información está en otra tabla
  // Por ejemplo, puede estar en una tabla llamada 'files' o similar
  const { data: filesWithTags, error: filesError } = await supabase
    .from('files')  // Intenta con este nombre, ajusta según sea necesario
    .select('*')
    .eq('bucket', sourceBucket);
  
  if (filesError) {
    console.error('Error al consultar archivos con etiquetas:', filesError);
    console.log('Es posible que la tabla "files" no exista. Verifica el nombre correcto.');
  } else if (filesWithTags && filesWithTags.length > 0) {
    console.log(`Se encontraron ${filesWithTags.length} archivos que pueden tener etiquetas`);
    
    const filesExportPath = path.join(tempDir, 'files-with-tags-export.json');
    fs.writeFileSync(filesExportPath, JSON.stringify(filesWithTags, null, 2));
    archive.file(filesExportPath, { name: 'files-with-tags-export.json' });
  } else {
    console.log(`No se encontraron archivos con etiquetas para el bucket ${sourceBucket}`);
  }
} catch (error) {
  console.error('Error al buscar relaciones archivo-etiqueta:', error);
}
    
    // Crear el archivo database-export.json combinado para compatibilidad
    const dbExport = {
      users: mainUsers || [],
      dynamic_users: allUsers || [],
      tags: tags || []
    };
    
    const dbExportPath = path.join(tempDir, 'database-export.json');
    fs.writeFileSync(dbExportPath, JSON.stringify(dbExport, null, 2));
    archive.file(dbExportPath, { name: 'database-export.json' });
    
    // Descargar todos los archivos del bucket incluyendo metadatos
    console.log('Descargando archivos del bucket...');
    
    // Función recursiva para listar archivos
    async function listAllFiles(prefix = '') {
      const allFiles = [];
      
      try {
        const { data, error } = await supabase.storage
          .from(sourceBucket)
          .list(prefix, { sortBy: { column: 'name', order: 'asc' } });
        
        if (error) {
          console.error(`Error al listar archivos en ${prefix}:`, error);
          return allFiles;
        }
        
        if (!data || data.length === 0) {
          return allFiles;
        }
        
        // Procesar resultados
        for (const item of data) {
          const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
          
          // Incluir TODOS los archivos, incluso .folder y metadatos
          if (!item.metadata || item.metadata.mimetype === 'application/x-directory') {
            // Es una carpeta, buscar archivos dentro recursivamente
            const subFiles = await listAllFiles(itemPath);
            allFiles.push(...subFiles);
          } else {
            // Es un archivo, añadirlo a la lista
            allFiles.push({
              path: itemPath,
              size: item.metadata?.size || 0,
              contentType: item.metadata?.mimetype || 'application/octet-stream'
            });
          }
        }
      } catch (error) {
        console.error(`Error general al listar archivos en ${prefix}:`, error);
      }
      
      return allFiles;
    }
    
    // Obtener todos los archivos
    const allFiles = await listAllFiles();
    console.log(`Se encontraron ${allFiles.length} archivos para backup`);
    
    // Descargar y añadir archivos al ZIP
    let processedFiles = 0;
    let successFiles = 0;
    
    for (const file of allFiles) {
      try {
        // Mostrar progreso
        processedFiles++;
        if (processedFiles % 10 === 0 || processedFiles === allFiles.length) {
          console.log(`Procesando archivo ${processedFiles}/${allFiles.length}: ${file.path}`);
        }
        
        // Descargar archivo
        const { data, error } = await supabase.storage
          .from(sourceBucket)
          .download(file.path);
        
        if (error) {
          console.error(`Error al descargar ${file.path}:`, error);
          continue;
        }
        
       // Guardar el archivo temporalmente a disco con manejo robusto para Railway
let tempFilePath;
if (isRailway) {
  // En Railway, usar /tmp directamente
  tempFilePath = path.join('/tmp', `docubox-backup-${processedFiles}`);
} else {
  // En desarrollo, usar el directorio temporal normal
  tempFilePath = path.join(tempDir, `temp_file_${processedFiles}`);
}

console.log(`Archivo temporal: ${tempFilePath} para ${file.path}`);
        
        // Convertir a buffer y guardar a disco
        const buffer = await data.arrayBuffer();
        fs.writeFileSync(tempFilePath, Buffer.from(buffer));
        
        // Añadir al ZIP desde el archivo temporal
        archive.file(tempFilePath, { name: file.path });
        successFiles++;
        
      } catch (error) {
        console.error(`Error al procesar archivo ${file.path}:`, error);
      }
    }
    
    console.log(`Procesados con éxito ${successFiles} de ${allFiles.length} archivos`);
    
    // Finalizar el ZIP
    console.log('Finalizando archivo ZIP...');
    await archive.finalize();
    
    console.log('Copia de seguridad completada correctamente.');
    
  } catch (error) {
    console.error('Error en copia de seguridad completa:', error);
    
    // Limpiar en caso de error
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Error al limpiar directorio temporal:', cleanupError);
    }
    
    process.exit(1);
  }
}

// Manejo de señales para cierre gracioso
process.on('SIGTERM', () => {
  console.log('\n[SHUTDOWN] Recibido SIGTERM, cerrando graciosamente...');
  
  // Limpiar recursos temporales
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('[SHUTDOWN] Directorio temporal eliminado');
    }
  } catch (cleanupError) {
    console.error('[SHUTDOWN] Error al limpiar directorio temporal:', cleanupError);
  }
  
  console.log('[SHUTDOWN] Proceso terminado correctamente.');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n[SHUTDOWN] Recibido SIGINT, cerrando graciosamente...');
  
  // Limpiar recursos temporales
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('[SHUTDOWN] Directorio temporal eliminado');
    }
  } catch (cleanupError) {
    console.error('[SHUTDOWN] Error al limpiar directorio temporal:', cleanupError);
  }
  
  console.log('[SHUTDOWN] Proceso terminado correctamente.');
  process.exit(0);
});

// Ejecutar script principal
main();