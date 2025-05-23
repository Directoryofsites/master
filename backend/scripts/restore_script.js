// Script mejorado para restaurar una copia de seguridad con soporte completo para usuarios dinámicos
// Sincronizado con el script de backup para restaurar todos los elementos guardados
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const AdmZip = require('adm-zip');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

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
const backupPath = process.argv[2];
const targetBucket = process.argv[3];

if (!backupPath || !targetBucket) {
  console.error('Por favor proporciona la ruta del archivo de backup y el bucket de destino');
  console.error('Uso: node restore_script.js <ruta-del-archivo-backup.zip> <bucket-destino>');
  process.exit(1);
}

console.log(`Archivo de backup: ${backupPath}`);
console.log(`Bucket destino: ${targetBucket}`);

// Obtener el parámetro para mantener nombres originales (cuarto argumento)
// Aceptar múltiples formatos posibles: 'true', true, 1, 'yes', 'sí'
const keepOriginalParam = process.argv[4];
const keepOriginalUsernames = keepOriginalParam === 'true' || 
                             keepOriginalParam === true || 
                             keepOriginalParam === '1' || 
                             keepOriginalParam === 'yes' || 
                             keepOriginalParam === 'sí';

console.log(`Parámetro recibido para mantener nombres: '${keepOriginalParam}'`);
console.log(`Mantener nombres originales: ${keepOriginalUsernames ? 'Sí' : 'No'}`);

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Directorio temporal para descomprimir los archivos
const tempDir = process.env.NODE_ENV === 'production' || process.env.RAILWAY_PROJECT_ID
  ? path.join('/tmp', `restore-${Date.now()}`)
  : path.join(os.tmpdir(), `restore-${Date.now()}`);

console.log(`Usando directorio temporal para restauración: ${tempDir}`);

// Estructura para el informe de restauración
const restorationReport = {
  startTime: new Date(),
  sourceBucket: '',
  targetBucket: targetBucket,
  tablesRestored: {},
  usersRestored: {
    total: 0,
    regular: 0,
    dynamic: 0
  },
  filesRestored: {
    total: 0,
    regular: 0,
    metadata: 0,
    failed: 0
  },
  errors: []
};

// Mapeo de tablas que deben ser restauradas en orden específico
const tableRestoreOrder = [
  'settings',
  'tags_by_bucket',   // Primero restaurar todas las etiquetas
  'user_accounts',
  'dynamic_users',
  'dynamic_user_accounts',
  'users'
];

// Mapeo de archivos especiales a tablas (para archivos que no siguen la convención estándar)
const specialFileMapping = {
  'tags-with-categories-export.json': 'tags_by_bucket', 
  'unique-categories-export.json': 'tags_by_bucket'
};
// Lista de tablas que pueden contener usuarios
const potentialUserTables = [
  'user_accounts',
  'dynamic_users',
  'dynamic_user_accounts',
  'users',
  'admin_users'
];

async function main() {
  try {
    console.log(`INICIANDO RESTAURACIÓN desde el archivo: ${backupPath} al bucket: ${targetBucket}`);
    
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
      const admZipVersion = require('adm-zip/package.json').version;
      const supabaseVersion = require('@supabase/supabase-js/package.json').version;
      const uuidVersion = require('uuid/package.json').version;
      console.log(`Versiones de dependencias: adm-zip@${admZipVersion}, supabase-js@${supabaseVersion}, uuid@${uuidVersion}`);
    } catch (err) {
      console.log('No se pudieron determinar las versiones de las dependencias');
    }

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

    // Verificar y crear directorios temporales necesarios
console.log('Verificando directorios temporales necesarios...');
const tempDirsToCreate = [
  tempDir,
  '/tmp/docubox',
  '/tmp/docubox-restore',
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
    
    // Verificar que el archivo de backup exista
    if (!fs.existsSync(backupPath)) {
      throw new Error(`El archivo de backup no existe: ${backupPath}`);
    }
    
    // Asegurar que existe el directorio temporal
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Descomprimir el archivo de backup con manejo explícito de errores
console.log('Descomprimiendo archivo de backup...');
try {
  console.log(`Verificando archivo de backup: ${backupPath} (tamaño: ${fs.statSync(backupPath).size} bytes)`);
  const zip = new AdmZip(backupPath);
  
  // Verificar contenido del zip antes de extraer
  const zipEntries = zip.getEntries();
  console.log(`El archivo ZIP contiene ${zipEntries.length} entradas`);
  
  // Mostrar algunas entradas para debug
  zipEntries.slice(0, 5).forEach(entry => {
    console.log(`- Entrada: ${entry.entryName} (${entry.header.size} bytes)`);
  });
  
  // Extraer con manejo de errores
  console.log(`Extrayendo a: ${tempDir}`);
  zip.extractAllTo(tempDir, true);
  console.log('Extracción completada correctamente');
} catch (extractError) {
  console.error('Error al descomprimir archivo de backup:', extractError);
  
  // Intentar acceder directamente al archivo para diagnóstico
  try {
    const stats = fs.statSync(backupPath);
    console.error(`Información del archivo: tamaño=${stats.size}, último acceso=${stats.atime}, modificación=${stats.mtime}`);
    
    // Si es muy pequeño, podría estar corrupto
    if (stats.size < 1000) {
      console.error('El archivo parece estar corrupto o incompleto (tamaño muy pequeño)');
    }
  } catch (statsError) {
    console.error('No se pudo acceder a la información del archivo:', statsError);
  }
  
  throw new Error(`Error al descomprimir: ${extractError.message}`);
}
    
    // Listar contenido del directorio temporal para debug
    console.log('Contenido del archivo ZIP:');
    const tempFiles = fs.readdirSync(tempDir);
    console.log(tempFiles);
    
    // Verificar que el bucket de destino existe, si no, crearlo
    console.log(`Verificando bucket de destino: ${targetBucket}`);
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      throw new Error(`Error al listar buckets: ${bucketsError.message}`);
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === targetBucket);
    
    if (!bucketExists) {
      console.log(`El bucket ${targetBucket} no existe, creándolo...`);
      const { error: createError } = await supabase.storage.createBucket(targetBucket, {
        public: false
      });
      
      if (createError) {
        throw new Error(`Error al crear bucket: ${createError.message}`);
      }
      
      console.log(`Bucket ${targetBucket} creado correctamente`);
    }
    
    // Identificar el bucket de origen del backup
    let sourceBucket = '';
    
    // Lista de archivos donde buscar el bucket de origen en orden de prioridad
    const bucketSourceFiles = [
      'settings-export.json',
      'tags-export.json',
      'file-tags-export.json',
      'tag-categories-export.json',
      'users-export.json',
      'database-export.json',
      'combined-users-export.json',
      'all-users-export.json'
    ];
    
    // Buscar en todos los archivos posibles para identificar el bucket de origen
    for (const fileName of bucketSourceFiles) {
      const filePath = path.join(tempDir, fileName);
      if (fs.existsSync(filePath)) {
        try {
          const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          if (Array.isArray(fileData) && fileData.length > 0 && fileData[0].bucket) {
            sourceBucket = fileData[0].bucket;
            console.log(`Bucket de origen identificado desde ${fileName}: ${sourceBucket}`);
            break;
          } else if (typeof fileData === 'object' && fileData !== null) {
            // Buscar en database-export.json que tiene estructura diferente
            if (fileData.tags && Array.isArray(fileData.tags) && fileData.tags.length > 0 && fileData.tags[0].bucket) {
              sourceBucket = fileData.tags[0].bucket;
              console.log(`Bucket de origen identificado desde ${fileName} (tags): ${sourceBucket}`);
              break;
            } else if (fileData.users && Array.isArray(fileData.users) && fileData.users.length > 0 && fileData.users[0].bucket) {
              sourceBucket = fileData.users[0].bucket;
              console.log(`Bucket de origen identificado desde ${fileName} (users): ${sourceBucket}`);
              break;
            }
          }
        } catch (error) {
          console.log(`Error al analizar ${fileName}: ${error.message}`);
        }
      }
    }
    
    if (!sourceBucket) {
      // Buscar en todos los archivos JSON si no se encontró en los archivos principales
      for (const file of tempFiles) {
        if (file.endsWith('.json') && !file.startsWith('restauracion-')) {
          const filePath = path.join(tempDir, file);
          try {
            const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (Array.isArray(fileData) && fileData.length > 0 && fileData[0].bucket) {
              sourceBucket = fileData[0].bucket;
              console.log(`Bucket de origen identificado desde ${file}: ${sourceBucket}`);
              break;
            }
          } catch (error) {
            // Ignorar errores en archivos que no pueden analizarse
          }
        }
      }
    }
    
    restorationReport.sourceBucket = sourceBucket || 'desconocido';
    console.log(`Bucket de origen final identificado: ${restorationReport.sourceBucket}`);
    
    // Función para adaptar cualquier objeto al nuevo bucket
    function adaptObjectToBucket(obj) {
      if (!obj || typeof obj !== 'object' || !sourceBucket) return obj;
      
      const newObj = { ...obj };
      
      // Recorrer todas las propiedades del objeto
      for (const [key, value] of Object.entries(newObj)) {
        // Si la propiedad es bucket y coincide con el bucket de origen, cambiarla
        if (key === 'bucket' && value === sourceBucket) {
          newObj[key] = targetBucket;
        }
        // Si es un string y contiene el bucket de origen, reemplazarlo
        else if (typeof value === 'string' && value.includes(sourceBucket)) {
          newObj[key] = value.replace(new RegExp(sourceBucket, 'g'), targetBucket);
        }
        // Si es un array, procesar cada elemento
        else if (Array.isArray(value)) {
          newObj[key] = value.map(item => {
            if (typeof item === 'string' && item.includes(sourceBucket)) {
              return item.replace(new RegExp(sourceBucket, 'g'), targetBucket);
            }
            else if (typeof item === 'object' && item !== null) {
              return adaptObjectToBucket(item);
            }
            return item;
          });
        }
        // Si es un objeto, procesarlo recursivamente
        else if (typeof value === 'object' && value !== null) {
          newObj[key] = adaptObjectToBucket(value);
        }
      }
      
      return newObj;
    }
    
    // Recopilar TODOS los archivos JSON que pudieran contener usuarios
    console.log('Identificando todos los archivos que pueden contener usuarios...');
    const userDataFiles = tempFiles.filter(file => 
      file.endsWith('.json') && 
      (file.includes('user') || 
       file.includes('Usuario') || 
       file.includes('combined') || 
       file.includes('dynamic') || 
       file.includes('dedo1'))
    );
    
    console.log(`Encontrados ${userDataFiles.length} archivos que podrían contener usuarios: ${userDataFiles.join(', ')}`);
    
    // Recopilar usuarios de todos los archivos posibles
    let allUsers = [];
    
    for (const file of userDataFiles) {
      const filePath = path.join(tempDir, file);
      if (fs.existsSync(filePath)) {
        try {
          console.log(`Analizando usuarios en archivo: ${file}`);
          let userData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          // Manejar tanto arrays como objetos con propiedades de usuarios
          if (typeof userData === 'object' && !Array.isArray(userData)) {
            // Buscar propiedades que puedan contener arrays de usuarios
            for (const [key, value] of Object.entries(userData)) {
              if (Array.isArray(value) && value.length > 0 && 
                 (typeof value[0] === 'object') && 
                 (value[0].username || value[0].email || value[0].name)) {
                console.log(`Encontrado array de usuarios en propiedad ${key} de ${file}`);
                userData = value;
                break;
              }
            }
          }
          
          // Si después de todo es un array, procesarlo
          if (Array.isArray(userData)) {
            // Filtrar solo los objetos que parezcan usuarios
            const usersInFile = userData.filter(item => 
              typeof item === 'object' && 
              item !== null && 
              (item.username || item.email || item.name || item.is_dynamic || item.created_by)
            );
            
            if (usersInFile.length > 0) {
              console.log(`Encontrados ${usersInFile.length} posibles usuarios en ${file}`);
              
              // Buscar específicamente dedo1 y otros usuarios especiales
              const specialUsers = usersInFile.filter(u => 
                (u.name && (u.name === 'dedo1' || u.name.includes('dedo'))) || 
                (u.username && (u.username === 'dedo1' || u.username.includes('dedo'))) || 
                (u.email && (u.email === 'dedo1' || u.email.includes('dedo')))
              );
              
              if (specialUsers.length > 0) {
                console.log(`¡ENCONTRADOS! ${specialUsers.length} usuarios especiales en ${file}:`);
                specialUsers.forEach(u => console.log(`- ${u.name || u.username || u.email || u.id}`));
              }
              
              // Agregar usuarios no duplicados a la lista completa
              for (const user of usersInFile) {
                if (!allUsers.some(u => 
                  (u.id && u.id === user.id) || 
                  (u.username && u.username === user.username) || 
                  (u.email && u.email === user.email))
                ) {
                  allUsers.push(user);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error al procesar ${file}:`, error.message);
          restorationReport.errors.push(`Error al procesar ${file}: ${error.message}`);
        }
      }
    }
    
    console.log(`Total de usuarios combinados y únicos: ${allUsers.length}`);
    
    // Mostrar usuarios especiales encontrados
    const specialUsers = allUsers.filter(u => 
      (u.name && (u.name === 'dedo1' || u.name.includes('dedo'))) || 
      (u.username && (u.username === 'dedo1' || u.username.includes('dedo'))) || 
      (u.email && (u.email === 'dedo1' || u.email.includes('dedo')))
    );
    
    if (specialUsers.length > 0) {
      console.log(`Se encontraron ${specialUsers.length} usuarios especiales en los datos combinados:`);
      specialUsers.forEach(u => {
        console.log(`- Usuario especial: ${u.name || u.username || u.email || u.id}`);
        console.log(`  Propiedades: ${Object.keys(u).join(', ')}`);
      });
    }
    
    // Adaptar todos los usuarios al nuevo bucket
    console.log('Adaptando usuarios al nuevo bucket...');
    const adaptedUsers = allUsers.map(user => {
      // Usar la función general para adaptar cualquier objeto
      const adaptedUser = adaptObjectToBucket(user);
      
      // Clasificar el usuario
      if (adaptedUser.is_dynamic === true || 
          adaptedUser.created_by_admin === true || 
          (adaptedUser.name && adaptedUser.name.includes('dedo')) ||
          (adaptedUser.username && adaptedUser.username.includes('dedo')) ||
          (adaptedUser.email && adaptedUser.email.includes('dedo'))) {
        console.log(`Restaurando usuario dinámico: ${adaptedUser.name || adaptedUser.username || adaptedUser.email || adaptedUser.id}`);
        restorationReport.usersRestored.dynamic++;
      } else {
        restorationReport.usersRestored.regular++;
      }
      
      return adaptedUser;
    });
    
   // NOTA: El procesamiento de usuarios se ha movido a una sección específica más segura
// que crea nuevos usuarios con IDs únicos en lugar de modificar existentes
console.log(`El procesamiento de usuarios se realizará más adelante con un método más seguro...`);
restorationReport.usersRestored.total = adaptedUsers.length;
    
    // Restaurar tablas en orden específico
console.log('Restaurando tablas adicionales en orden priorizado...');

// Primero restaurar las tablas en orden específico
for (const tableName of tableRestoreOrder) {
  const exportFileName = `${tableName}-export.json`;
  const filePath = path.join(tempDir, exportFileName);
  
  if (fs.existsSync(filePath)) {
    console.log(`Restaurando datos de tabla: ${tableName}`);
    
    try {
      const tableData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (Array.isArray(tableData) && tableData.length > 0) {
        console.log(`Encontrados ${tableData.length} registros para tabla ${tableName}`);
        
        // Adaptar datos al nuevo bucket
        const adaptedData = tableData.map(item => adaptObjectToBucket(item));
        
        // PROTECCIÓN: Verificar que no se están modificando datos del bucket de origen
        if (tableName === 'tags_by_bucket' || tableName.includes('tag')) {
          console.log(`Aplicando protección para bucket de origen: ${restorationReport.sourceBucket}`);
          
          // Verificar explícitamente que no estamos modificando el bucket de origen
          const safeData = adaptedData.filter(item => 
            !item.bucket || item.bucket !== restorationReport.sourceBucket
          );
          
          if (safeData.length < adaptedData.length) {
            console.log(`ADVERTENCIA: ${adaptedData.length - safeData.length} registros filtrados para proteger el bucket de origen.`);
          }
          
          if (safeData.length > 0) {
            // Restaurar en la base de datos
            const { error: tableError } = await supabase
              .from(tableName)
              .upsert(safeData, { onConflict: 'id' });
            
            if (tableError) {
              console.error(`Error al restaurar tabla ${tableName}:`, tableError);
              restorationReport.errors.push(`Error al restaurar tabla ${tableName}: ${tableError.message}`);
              restorationReport.tablesRestored[tableName] = { status: 'error', error: tableError.message };
            } else {
              console.log(`${safeData.length} registros restaurados en tabla ${tableName}`);
              restorationReport.tablesRestored[tableName] = { status: 'success', count: safeData.length };
            }
          } else {
            console.log(`No hay datos seguros para restaurar en ${tableName}`);
            restorationReport.tablesRestored[tableName] = { status: 'skipped', reason: 'no_safe_data' };
          }
        } else {
          // Para otras tablas, proceder normalmente
          const { error: tableError } = await supabase
            .from(tableName)
            .upsert(adaptedData, { onConflict: 'id' });
          
          if (tableError) {
            console.error(`Error al restaurar tabla ${tableName}:`, tableError);
            restorationReport.errors.push(`Error al restaurar tabla ${tableName}: ${tableError.message}`);
            restorationReport.tablesRestored[tableName] = { status: 'error', error: tableError.message };
          } else {
            console.log(`${adaptedData.length} registros restaurados en tabla ${tableName}`);
            restorationReport.tablesRestored[tableName] = { status: 'success', count: adaptedData.length };
          }
        }
      } else {
        console.log(`No se encontraron datos válidos para tabla ${tableName}`);
        restorationReport.tablesRestored[tableName] = { status: 'skipped', reason: 'no_valid_data' };
      }
    } catch (parseError) {
      console.error(`Error al procesar archivo para tabla ${tableName}:`, parseError);
      restorationReport.errors.push(`Error al procesar archivo para tabla ${tableName}: ${parseError.message}`);
      restorationReport.tablesRestored[tableName] = { status: 'error', error: parseError.message };
    }
  } else {
    console.log(`No se encontró archivo de exportación para tabla ${tableName}`);
    
    // Verificar nombres alternativos
    const alternativeNames = [
      `${tableName.replace(/_/g, '-')}-export.json`,
      `${tableName.replace(/_/g, '')}-export.json`,
      `${tableName}-data.json`
    ];
    
    let found = false;
    for (const altName of alternativeNames) {
      const altPath = path.join(tempDir, altName);
      if (fs.existsSync(altPath)) {
        found = true;
        console.log(`Encontrado archivo alternativo ${altName} para tabla ${tableName}`);
        
        try {
          const tableData = JSON.parse(fs.readFileSync(altPath, 'utf8'));
          
          if (Array.isArray(tableData) && tableData.length > 0) {
            const adaptedData = tableData.map(item => adaptObjectToBucket(item));
            
            // PROTECCIÓN: Verificar que no se están modificando datos del bucket de origen
            if (tableName === 'tags_by_bucket' || tableName.includes('tag')) {
              const safeData = adaptedData.filter(item => 
                !item.bucket || item.bucket !== restorationReport.sourceBucket
              );
              
              if (safeData.length < adaptedData.length) {
                console.log(`ADVERTENCIA: ${adaptedData.length - safeData.length} registros filtrados para proteger el bucket de origen.`);
              }
              
              if (safeData.length > 0) {
                const { error: altError } = await supabase
                  .from(tableName)
                  .upsert(safeData, { onConflict: 'id' });
                
                if (altError) {
                  console.error(`Error al restaurar tabla ${tableName} desde ${altName}:`, altError);
                  restorationReport.tablesRestored[tableName] = { status: 'error', error: altError.message };
                } else {
                  console.log(`${safeData.length} registros restaurados en tabla ${tableName} desde ${altName}`);
                  restorationReport.tablesRestored[tableName] = { status: 'success', count: safeData.length };
                }
              } else {
                console.log(`No hay datos seguros para restaurar en ${tableName} desde ${altName}`);
              }
            } else {
              const { error: altError } = await supabase
                .from(tableName)
                .upsert(adaptedData, { onConflict: 'id' });
              
              if (altError) {
                console.error(`Error al restaurar tabla ${tableName} desde ${altName}:`, altError);
                restorationReport.tablesRestored[tableName] = { status: 'error', error: altError.message };
              } else {
                console.log(`${adaptedData.length} registros restaurados en tabla ${tableName} desde ${altName}`);
                restorationReport.tablesRestored[tableName] = { status: 'success', count: adaptedData.length };
              }
            }
          }
        } catch (altError) {
          console.error(`Error al procesar archivo alternativo para tabla ${tableName}:`, altError);
        }
        break;
      }
    }
    
    if (!found) {
      restorationReport.tablesRestored[tableName] = { status: 'skipped', reason: 'file_not_found' };
    }
  }
}

// MANEJO ÚNICO DE ETIQUETAS - EVITAR DUPLICADOS
console.log('===== PROCESAMIENTO UNIFICADO DE ETIQUETAS =====');

// 1. Recopilar TODAS las etiquetas de todos los archivos posibles
const tagFiles = [
  'tags-export.json',
  'tags-with-categories-export.json',
  'unique-categories-export.json'
];

// Set para llevar un registro de las etiquetas ya procesadas
const processedTagNames = new Set();

let allTagsRaw = [];

// Recopilar todas las etiquetas de todos los archivos
for (const tagFile of tagFiles) {
  const filePath = path.join(tempDir, tagFile);
  if (fs.existsSync(filePath)) {
    console.log(`Analizando etiquetas de: ${tagFile}`);
    
    try {
      let tagsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Tratamiento especial para unique-categories
      if (tagFile === 'unique-categories-export.json') {
        // Convertir las categorías únicas al formato esperado por tags_by_bucket
        tagsData = tagsData.map(item => {
          if (item.name && !item.tag_name) {
            return {
              tag_name: item.name,  // Usar el valor de 'name' como 'tag_name'
              category: item.name,  // Usar el mismo valor para 'category'
              bucket: item.bucket || targetBucket
            };
          }
          return item;
        });
        console.log(`Adaptadas ${tagsData.length} categorías únicas al formato correcto`);
      }
      
      // Adaptamos todas las etiquetas al bucket destino
      const adaptedTags = tagsData.map(tag => {
        const newTag = { ...tag };
        
        // Asignar nuevo ID único para evitar conflictos
        newTag.id = uuidv4();
        
        // Asegurarnos que el bucket esté configurado correctamente
        if (newTag.bucket === sourceBucket) {
          newTag.bucket = targetBucket;
        }
        
        return newTag;
      });
      
      // Añadir a nuestra colección total
      allTagsRaw = [...allTagsRaw, ...adaptedTags];
    } catch (error) {
      console.error(`Error al procesar ${tagFile}:`, error);
    }
  }
}

console.log(`Recopiladas ${allTagsRaw.length} etiquetas en total de todos los archivos`);

// 2. Eliminar duplicados usando tag_name como clave
const uniqueTags = [];

for (const tag of allTagsRaw) {
  // Validar que sea una etiqueta con los campos necesarios y para el bucket correcto
  if (!tag.tag_name || tag.bucket !== targetBucket) continue;
  
  // Crear una clave única basada en tag_name
  const key = tag.tag_name;
  
  // Si ya procesamos esta etiqueta, saltarla
  if (processedTagNames.has(key)) continue;
  
  // Marcar como procesada y agregar a las etiquetas únicas
  processedTagNames.add(key);
  uniqueTags.push(tag);
}

console.log(`Filtradas a ${uniqueTags.length} etiquetas únicas para el bucket ${targetBucket}`);

// 3. Insertar las etiquetas únicas en la base de datos
if (uniqueTags.length > 0) {
  try {
    // Usar INSERT en lugar de UPSERT para evitar modificar existentes
    const { error: insertError } = await supabase
      .from('tags_by_bucket')
      .insert(uniqueTags);
    
    if (insertError) {
      console.error('Error al insertar etiquetas únicas:', insertError);
    } else {
      console.log(`¡ÉXITO! ${uniqueTags.length} etiquetas únicas insertadas correctamente en el bucket ${targetBucket}`);
      
      // Actualizar el reporte
      restorationReport.tablesRestored['tags_by_bucket'] = {
        status: 'success',
        count: uniqueTags.length,
        method: 'insert_unique_only'
      };
    }
  } catch (error) {
    console.error('Error general al insertar etiquetas:', error);
  }
}

// 4. Desactivar cualquier otro procesamiento de etiquetas en el script
console.log('Procesamiento unificado de etiquetas completado. Saltando otros procesos de etiquetas.');

// MANEJO ESPECÍFICO PARA LA TABLA USER_ACCOUNTS - VERSIÓN MEJORADA
console.log('===== PROCESAMIENTO ESPECÍFICO DE USER_ACCOUNTS (MEJORADO) =====');

// Buscar el archivo de exportación de user_accounts
const userAccountsFiles = [
  'users-export.json',
  'combined-users-export.json',
  'user_accounts-users-export.json',
  'dynamic-users-specific.json',
  'all-users-export.json'
];

let userAccountsData = [];

// Buscar en todos los archivos posibles para encontrar datos de user_accounts
for (const fileName of userAccountsFiles) {
  const filePath = path.join(tempDir, fileName);
  
  if (fs.existsSync(filePath)) {
    console.log(`Procesando archivo de usuarios: ${fileName}`);
    
    try {
      const userData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (Array.isArray(userData) && userData.length > 0) {
        console.log(`Encontrados ${userData.length} usuarios en ${fileName}`);
        
        // Filtrar usuarios que NO están ya en el bucket destino
        const relevantUsers = userData.filter(user => user.bucket !== targetBucket);
        
        console.log(`De los cuales ${relevantUsers.length} no pertenecen ya al bucket destino`);
        
        // Adaptar usuarios para el nuevo bucket
        const newUsers = relevantUsers.map(user => {
          // Preservar la información original pero generar un nuevo ID
          const newUser = { ...user };
          
          // Generar un nuevo ID único
          newUser.id = uuidv4();
          
          // Establecer el bucket correcto
          newUser.bucket = targetBucket;
          
         // Manejar el nombre de usuario según la opción seleccionada
          if (newUser.username) {
            if (keepOriginalUsernames) {
              // Mantener el nombre original (sin modificaciones)
              console.log(`Manteniendo nombre de usuario original: ${newUser.username}`);
            } else {
              // Añadir un sufijo más corto y distinguible
              // Usar solo los primeros 5 caracteres del bucket y un número aleatorio de 4 dígitos
              const shortSuffix = sourceBucket ? sourceBucket.substring(0, 5) : 'src';
              const randomId = Math.floor(1000 + Math.random() * 9000); // 4 dígitos (1000-9999)
              
              // Comprobar si ya tiene sufijo para evitar acumulación
              if (!newUser.username.includes('_' + shortSuffix)) {
                newUser.username = `${newUser.username}_${shortSuffix}_${randomId}`;
                console.log(`Modificando nombre de usuario: ${newUser.username}`);
              }
            }
          }
          
          return newUser;
        });
        
        userAccountsData = [...userAccountsData, ...newUsers];
      }
    } catch (error) {
      console.error(`Error al procesar ${fileName}:`, error);
    }
  }
}

// Eliminar posibles duplicados (basados en el username modificado)
const uniqueUsernames = new Set();
const uniqueUsers = [];

for (const user of userAccountsData) {
  if (!user.username) continue;
  
  if (uniqueUsernames.has(user.username)) continue;
  
  uniqueUsernames.add(user.username);
  uniqueUsers.push(user);
}

console.log(`Se procesaron ${userAccountsData.length} registros de usuarios, quedando ${uniqueUsers.length} usuarios únicos para insertar`);

// Verificar la tabla antes de insertar
let tableExists = true;
try {
  const { data, error } = await supabase
    .from('user_accounts')
    .select('id')
    .limit(1);
  
  if (error) {
    console.log(`La tabla user_accounts no existe o no es accesible: ${error.message}`);
    tableExists = false;
  }
} catch (error) {
  console.log(`Error al verificar tabla user_accounts: ${error.message}`);
  tableExists = false;
}


if (tableExists && uniqueUsers.length > 0) {
  // Intentar insertar los usuarios uno por uno con manejo de errores
  console.log(`Insertando ${uniqueUsers.length} usuarios uno por uno...`);
  let successCount = 0;

// Función para crear una versión simplificada del usuario que solo incluya columnas existentes
function simplifyUser(user) {
  // Incluir solo los campos que sabemos que existen en la tabla
  const simplifiedUser = {
    id: user.id,
    username: user.username,
    bucket: targetBucket,
    password_hash: user.password_hash || 'placeholder_hash',
    active: true
  };
  
  // Añadir campos opcionales solo si existen tanto en el usuario como en la tabla
  if (user.created_by) simplifiedUser.created_by = user.created_by;
  if (user.assigned_folders) simplifiedUser.assigned_folders = user.assigned_folders;
  if (user.group_name) simplifiedUser.group_name = user.group_name;
  
  return simplifiedUser;
}

  // Verificar la estructura de la tabla y las columnas requeridas
try {
  console.log('Verificando estructura de la tabla user_accounts...');
  const { data: tableInfo, error: tableInfoError } = await supabase
    .rpc('get_columns_info', { table_name: 'user_accounts' });
  
  if (tableInfoError) {
    console.error('Error al verificar estructura de tabla:', tableInfoError);
    // Intento alternativo con select
    const { data: sampleRow, error: sampleError } = await supabase
      .from('user_accounts')
      .select('*')
      .limit(1);
    
    if (!sampleError && sampleRow && sampleRow.length > 0) {
      console.log('Estructura de tabla inferida de la muestra:', Object.keys(sampleRow[0]).join(', '));
    }
  } else if (tableInfo) {
    console.log('Estructura de la tabla user_accounts:', tableInfo);
  }
} catch (structError) {
  console.error('Error al verificar estructura:', structError);
}
  
  // Primero verificar si ya existen usuarios para este bucket
console.log(`Verificando usuarios existentes para bucket ${targetBucket}...`);
const { data: existingUsers, error: fetchError } = await supabase
  .from('user_accounts')
  .select('username, id')
  .eq('bucket', targetBucket);

if (fetchError) {
  console.error(`Error al obtener usuarios existentes: ${fetchError.message}`);
  // Proceder con el enfoque original pero limitando el número de reintentos
  for (const user of uniqueUsers) {
    try {
      // Intentar insertar una versión simplificada del usuario
      const simplifiedUser = simplifyUser(user);
      const { error: insertError } = await supabase
        .from('user_accounts')
        .insert([simplifiedUser]);      
      if (!insertError) {
        console.log(`✓ Usuario ${user.username} insertado correctamente`);
        successCount++;
      } else {
        // Limitar a un solo reintento con un sufijo fijo para evitar múltiples versiones
        if (insertError.code === '23505' && insertError.message.includes('username')) {
          // Crear versión con un sufijo único basado en el origen
          const retryUser = simplifyUser(user);
          const sourceSuffix = sourceBucket ? sourceBucket.substring(0, 5) : 'bkp';
          retryUser.username = `${user.username}_${sourceSuffix}`;
          
          console.log(`Conflicto con username. Reintentando como: ${retryUser.username}`);
          
          const { error: retryError } = await supabase
            .from('user_accounts')
            .insert([retryUser]);
            
          if (!retryError) {
            console.log(`✓ Usuario insertado con username modificado: ${retryUser.username}`);
            successCount++;
          } else {
            console.log(`✗ Error al insertar usuario con username modificado: ${retryError.message}`);
          }
        } else {
          console.log(`✗ Error al insertar usuario ${user.username}: ${insertError.message}`);
        }
      }
    } catch (error) {
      console.log(`Error general al procesar usuario ${user.username}: ${error.message}`);
    }
  }
} else {
  // Enfoque optimizado para evitar duplicados excesivos
  console.log(`Encontrados ${existingUsers ? existingUsers.length : 0} usuarios existentes en el bucket ${targetBucket}`);
  
  // Crear un mapa de usuarios existentes para búsqueda rápida
  const existingUsernames = new Set();
  if (existingUsers && existingUsers.length > 0) {
    existingUsers.forEach(user => {
      existingUsernames.add(user.username);
    });
  }
  
  // Procesar usuarios con una mejor estrategia para evitar duplicados
  console.log(`Procesando ${uniqueUsers.length} usuarios con estrategia de prevención de duplicados...`);
  let skippedCount = 0;
  
  for (const user of uniqueUsers) {
    try {
      // Verificar si ya existe un usuario con este nombre
      if (existingUsernames.has(user.username)) {
        console.log(`Usuario '${user.username}' ya existe. Omitiendo...`);
        skippedCount++;
        continue;
      }
      
      // Si no existe, crear un nuevo usuario
      const simplifiedUser = simplifyUser(user);
      console.log(`Insertando nuevo usuario: ${simplifiedUser.username}`);
      
      const { error: insertError } = await supabase
        .from('user_accounts')
        .insert([simplifiedUser]);
      
      if (!insertError) {
        console.log(`✓ Usuario ${simplifiedUser.username} insertado correctamente`);
        successCount++;
        // Agregar a nuestro set de existentes para futuras comprobaciones
        existingUsernames.add(simplifiedUser.username);
      } else {
        // Un único reintento con sufijo fijo
        if (insertError.code === '23505' && insertError.message.includes('username')) {
          const retryUser = simplifyUser(user);
          const sourceSuffix = sourceBucket ? sourceBucket.substring(0, 5) : 'bkp';
          retryUser.username = `${user.username}_${sourceSuffix}`;
          
          if (existingUsernames.has(retryUser.username)) {
            console.log(`El nombre alternativo '${retryUser.username}' también existe. Omitiendo...`);
            skippedCount++;
            continue;
          }
          
          console.log(`Reintentando como: ${retryUser.username}`);
          
          const { error: retryError } = await supabase
            .from('user_accounts')
            .insert([retryUser]);
            
          if (!retryError) {
            console.log(`✓ Usuario insertado con username modificado: ${retryUser.username}`);
            successCount++;
            existingUsernames.add(retryUser.username);
          } else {
            console.log(`✗ Error al insertar usuario con username modificado: ${retryError.message}`);
          }
        } else {
          console.log(`✗ Error al insertar usuario ${simplifiedUser.username}: ${insertError.message}`);
        }
      }
    } catch (error) {
      console.log(`Error general al procesar usuario ${user.username || 'desconocido'}: ${error.message}`);
    }
  }
  
  console.log(`--- Procesamiento de usuarios completado ---`);
  console.log(`- Insertados: ${successCount}`);
  console.log(`- Omitidos (ya existían): ${skippedCount}`);
  console.log(`- Total intentados: ${uniqueUsers.length}`);
}
  
  console.log(`--- Insertados ${successCount} de ${uniqueUsers.length} usuarios ---`);
  
  if (successCount > 0) {
    restorationReport.tablesRestored['user_accounts'] = { 
      status: 'success', 
      count: successCount,
      method: 'insert_with_modification'
    };
  } else {
    restorationReport.tablesRestored['user_accounts'] = { 
      status: 'error', 
      count: 0,
      error: 'No se pudo insertar ningún usuario'
    };
  }

  // Verificación explícita de usuarios insertados
console.log('Verificando usuarios insertados en la base de datos...');
try {
  const { data: verifiedUsers, error: verificationError } = await supabase
    .from('user_accounts')
    .select('id, username, bucket')
    .eq('bucket', targetBucket);
  
  if (verificationError) {
    console.error('Error al verificar usuarios insertados:', verificationError);
    restorationReport.errors.push(`Error al verificar usuarios: ${verificationError.message}`);
  } else {
    console.log(`Verificación: Se encontraron ${verifiedUsers ? verifiedUsers.length : 0} usuarios con bucket=${targetBucket}`);
    if (verifiedUsers && verifiedUsers.length > 0) {
      console.log('Ejemplos de usuarios verificados:');
      verifiedUsers.slice(0, 5).forEach(u => console.log(`- ${u.username} (ID: ${u.id})`));
      
      // Guardar esta información en el informe
      restorationReport.usersVerified = {
        count: verifiedUsers.length,
        examples: verifiedUsers.slice(0, 5).map(u => u.username)
      };
    } else {
      console.log('¡ALERTA! No se encontraron usuarios en la verificación a pesar de inserción exitosa');
      restorationReport.errors.push('No se encontraron usuarios en la verificación a pesar de inserción exitosa');
    }
  }
} catch (verifyError) {
  console.error('Error general al verificar usuarios:', verifyError);
}

} else {
  console.log('No hay usuarios para restaurar o la tabla no existe');
}

console.log('Procesamiento mejorado de user_accounts completado.');

/* Las siguientes secciones están comentadas para evitar duplicación de etiquetas
// Procesar archivos especiales con categorías de etiquetas
console.log('Buscando archivos especiales de categorías de etiquetas...');

// Lista de archivos especiales a buscar
const specialCategoryFiles = [
  'tags-with-categories-export.json',
  'unique-categories-export.json'
];

for (const specialFile of specialCategoryFiles) {
  const filePath = path.join(tempDir, specialFile);
  
  if (fs.existsSync(filePath)) {
    console.log(`Encontrado archivo especial de categorías: ${specialFile}`);
    
    try {
      const categoryData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (Array.isArray(categoryData) && categoryData.length > 0) {
        console.log(`Encontrados ${categoryData.length} registros de categorías en ${specialFile}`);
        
        // Adaptar datos al nuevo bucket
        const adaptedCategories = categoryData.map(item => adaptObjectToBucket(item));
        
        // PROTECCIÓN: Verificar que no se están modificando datos del bucket de origen
        const safeCategories = adaptedCategories.filter(item => 
          !item.bucket || item.bucket !== restorationReport.sourceBucket
        );
        
        if (safeCategories.length < adaptedCategories.length) {
          console.log(`ADVERTENCIA: ${adaptedCategories.length - safeCategories.length} categorías filtradas para proteger el bucket de origen.`);
        }
        
        if (safeCategories.length > 0) {
          // Restaurar en la tabla de etiquetas
          const { error: categoryError } = await supabase
            .from('tags_by_bucket')
            .upsert(safeCategories, { onConflict: 'id' });
          
          if (categoryError) {
            console.error(`Error al restaurar categorías desde ${specialFile}:`, categoryError);
            restorationReport.errors.push(`Error al restaurar categorías desde ${specialFile}: ${categoryError.message}`);
          } else {
            console.log(`${safeCategories.length} categorías restauradas desde ${specialFile}`);
            
            // Registrar en el informe
            if (!restorationReport.tablesRestored['categories_special']) {
              restorationReport.tablesRestored['categories_special'] = { 
                status: 'success', 
                count: safeCategories.length,
                files: [specialFile]
              };
            } else {
              restorationReport.tablesRestored['categories_special'].count += safeCategories.length;
              restorationReport.tablesRestored['categories_special'].files.push(specialFile);
            }
          }
        } else {
          console.log(`No hay categorías seguras para restaurar desde ${specialFile}`);
        }
      } else {
        console.log(`No se encontraron datos válidos en el archivo de categorías ${specialFile}`);
      }
    } catch (parseError) {
      console.error(`Error al procesar archivo de categorías ${specialFile}:`, parseError);
      restorationReport.errors.push(`Error al procesar archivo de categorías ${specialFile}: ${parseError.message}`);
    }
  } else {
    console.log(`Archivo de categorías ${specialFile} no encontrado`);
  }
}
*/

    // Identificar y restaurar otras tablas que no estén en el orden específico
    console.log('Buscando tablas adicionales para restaurar...');
    
    const processedFiles = tableRestoreOrder.map(t => `${t}-export.json`);
    const skippedFiles = [...processedFiles, 'database-export.json', ...userDataFiles];
    
    const additionalExportFiles = tempFiles.filter(file => 
      file.endsWith('-export.json') && 
      !skippedFiles.includes(file)
    );
    
    for (const file of additionalExportFiles) {
      const tableName = file.replace('-export.json', '');
      const filePath = path.join(tempDir, file);
      
      console.log(`Encontrada tabla adicional para restaurar: ${tableName}`);
      
      try {
        const tableData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (Array.isArray(tableData) && tableData.length > 0) {
          console.log(`Restaurando ${tableData.length} registros en tabla ${tableName}...`);
          
          // Adaptar los datos al nuevo bucket
          const adaptedData = tableData.map(item => adaptObjectToBucket(item));
          
          const { error: tableError } = await supabase
            .from(tableName)
            .upsert(adaptedData, { onConflict: 'id' });
          
          if (tableError) {
            console.error(`Error al restaurar tabla ${tableName}:`, tableError);
            restorationReport.errors.push(`Error al restaurar tabla ${tableName}: ${tableError.message}`);
            restorationReport.tablesRestored[tableName] = { status: 'error', error: tableError.message };
          } else {
            console.log(`${adaptedData.length} registros restaurados en tabla ${tableName}`);
            restorationReport.tablesRestored[tableName] = { status: 'success', count: adaptedData.length };
          }
        } else {
          console.log(`No se encontraron datos válidos para tabla ${tableName}`);
          restorationReport.tablesRestored[tableName] = { status: 'skipped', reason: 'no_valid_data' };
        }
      } catch (parseError) {
        console.error(`Error al procesar archivo para tabla ${tableName}:`, parseError);
        restorationReport.errors.push(`Error al procesar archivo para tabla ${tableName}: ${parseError.message}`);
        restorationReport.tablesRestored[tableName] = { status: 'error', error: parseError.message };
      }
    }


    /* También comentamos esta sección para evitar duplicación de etiquetas
    // Procesar archivos especiales que no siguen la convención estándar
console.log('Procesando archivos especiales...');

for (const [specialFile, targetTable] of Object.entries(specialFileMapping)) {
  const filePath = path.join(tempDir, specialFile);
  
  if (fs.existsSync(filePath)) {
    console.log(`Procesando archivo especial ${specialFile} para tabla ${targetTable}...`);
    
    try {
      const tableData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (Array.isArray(tableData) && tableData.length > 0) {
        console.log(`Encontrados ${tableData.length} registros en ${specialFile}`);
        
        // Adaptar datos al nuevo bucket
        const adaptedData = tableData.map(item => adaptObjectToBucket(item));
        
        // Restaurar en la base de datos
        const { error: specialError } = await supabase
          .from(targetTable)
          .upsert(adaptedData, { onConflict: 'id' });
        
        if (specialError) {
          console.error(`Error al restaurar ${specialFile}:`, specialError);
          restorationReport.errors.push(`Error al restaurar ${specialFile}: ${specialError.message}`);
        } else {
          console.log(`${adaptedData.length} registros restaurados desde ${specialFile}`);
          
          // Registrar en el informe si no existe ya
          if (!restorationReport.tablesRestored[`${targetTable}_special`]) {
            restorationReport.tablesRestored[`${targetTable}_special`] = { status: 'success', count: adaptedData.length };
          } else {
            // Si ya existe, sumar al contador
            restorationReport.tablesRestored[`${targetTable}_special`].count += adaptedData.length;
          }
        }
      } else {
        console.log(`No se encontraron datos válidos en ${specialFile}`);
      }
    } catch (parseError) {
      console.error(`Error al procesar archivo especial ${specialFile}:`, parseError);
      restorationReport.errors.push(`Error al procesar archivo especial ${specialFile}: ${parseError.message}`);
    }
  } else {
    console.log(`Archivo especial ${specialFile} no encontrado`);
  }
}
*/
    
    // Restaurar archivos
    console.log('Buscando archivos para restaurar...');
    
    // Función para encontrar archivos recursivamente
    function findFilesRecursive(dir, prefix = '') {
      const files = [];
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        
        try {
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory()) {
            // Es un directorio
            const subFiles = findFilesRecursive(itemPath, prefix ? `${prefix}/${item}` : item);
            files.push(...subFiles);
          } else if (stats.isFile()) {
            // Es un archivo, excluir los archivos de exportación
            if (!item.endsWith('-export.json') && !item.endsWith('.json') && !item.startsWith('temp_file_')) {
              files.push({
                localPath: itemPath,
                storagePath: prefix ? `${prefix}/${item}` : item,
                isMetadata: item.includes('.metadata') || item === '.folder',
                isFolder: item === '.folder'
              });
            }
          }
        } catch (error) {
          console.error(`Error al procesar ${itemPath}:`, error.message);
        }
      }
      
      return files;
    }
    
    // Buscar todos los archivos
    const filesToRestore = findFilesRecursive(tempDir);
    
    // Ordenar: primero carpetas, luego archivos normales, luego metadatos
    filesToRestore.sort((a, b) => {
      // Primero restaurar archivos .folder
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      
      // Luego archivos normales antes que metadatos
      if (a.isMetadata && !b.isMetadata) return 1;
      if (!a.isMetadata && b.isMetadata) return -1;
      
      // Por último, ordenar por ruta del archivo
      return a.storagePath.localeCompare(b.storagePath);
    });
    
    console.log(`Se encontraron ${filesToRestore.length} archivos para restaurar`);
    console.log(`- Archivos de carpetas (.folder): ${filesToRestore.filter(f => f.isFolder).length}`);
    console.log(`- Archivos regulares: ${filesToRestore.filter(f => !f.isMetadata && !f.isFolder).length}`);
    console.log(`- Archivos de metadatos: ${filesToRestore.filter(f => f.isMetadata && !f.isFolder).length}`);
    
    // Listar algunos archivos encontrados para verificación
    if (filesToRestore.length > 0) {
      console.log('Ejemplos de archivos encontrados:');
      const folderExample = filesToRestore.find(f => f.isFolder);
      if (folderExample) {
        console.log(`  - Carpeta: ${folderExample.storagePath}`);
      }
      
      const regularExample = filesToRestore.find(f => !f.isMetadata && !f.isFolder);
      if (regularExample) {
        console.log(`  - Archivo regular: ${regularExample.storagePath}`);
      }
      
      const metaExample = filesToRestore.find(f => f.isMetadata && !f.isFolder);
      if (metaExample) {
        console.log(`  - Metadatos: ${metaExample.storagePath}`);
      }
    }
    
    // Restaurar archivos
    let successFiles = 0;
    let metadataFiles = 0;
    let folderFiles = 0;
    let failedFiles = 0;
    
    // Procesar cada archivo para restaurar
    for (const file of filesToRestore) {
      try {
        // Mostrar progreso
        if (successFiles % 10 === 0 || successFiles + failedFiles === 0 || successFiles + failedFiles === filesToRestore.length - 1) {
          console.log(`Restaurando archivo ${successFiles + failedFiles + 1}/${filesToRestore.length}: ${file.storagePath}`);
        }
        
        // Leer el archivo
        const fileBuffer = fs.readFileSync(file.localPath);
        
        // Determinar el tipo de contenido
        let contentType = 'application/octet-stream';
        
        if (file.storagePath.endsWith('.jpg') || file.storagePath.endsWith('.jpeg')) {
          contentType = 'image/jpeg';
        } else if (file.storagePath.endsWith('.png')) {
          contentType = 'image/png';
        } else if (file.storagePath.endsWith('.pdf')) {
          contentType = 'application/pdf';
        } else if (file.storagePath.endsWith('.mp3')) {
          contentType = 'audio/mpeg';
        } else if (file.storagePath.endsWith('.mp4')) {
          contentType = 'video/mp4';
        } else if (file.storagePath.endsWith('.txt')) {
          contentType = 'text/plain';
        } else if (file.storagePath.endsWith('.html')) {
          contentType = 'text/html';
        } else if (file.isFolder) {
          contentType = 'application/x-directory';
        } else if (file.isMetadata) {
          contentType = 'application/json';
        }
        
       // Subir archivo a Supabase con manejo robusto para Railway
let uploadError = null;
let uploadResult = null;

// Intentar la carga con manejo explícito de tiempo de espera
try {
  const uploadPromise = supabase.storage
    .from(targetBucket)
    .upload(file.storagePath, fileBuffer, {
      contentType: contentType,
      upsert: true
    });
  
  // Configurar un timeout para Railway (30 segundos)
  const timeout = isRailway ? 30000 : 60000;
  
  // Esperar a que termine o expire el tiempo
  uploadResult = await Promise.race([
    uploadPromise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout después de ${timeout/1000} segundos`)), timeout)
    )
  ]);
  
  if (uploadResult.error) {
    uploadError = uploadResult.error;
  }
} catch (error) {
  console.error(`Error al subir ${file.storagePath}:`, error);
  uploadError = error;
}

if (uploadError) {
  console.error(`Error al subir ${file.storagePath}:`, uploadError);
  failedFiles++;
  restorationReport.errors.push(`Error al subir archivo ${file.storagePath}: ${uploadError.message}`);
  
  // Si falla, intentar esperar y reintentar
  if (!file.retried) {
    console.log(`Reintentando subida de ${file.storagePath} después de 1 segundo...`);
    
    // Esperar 1 segundo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { error: retryError } = await supabase.storage
      .from(targetBucket)
      .upload(file.storagePath, fileBuffer, {
        contentType: contentType,
        upsert: true
      });
    
    if (!retryError) {
      console.log(`¡Éxito en reintento! Archivo ${file.storagePath} subido correctamente`);
      successFiles++;
      if (file.isFolder) {
        folderFiles++;
      } else if (file.isMetadata) {
        metadataFiles++;
      }
    } else {
      console.error(`Error en reintento de ${file.storagePath}:`, retryError);
    }
  }
} else {
  successFiles++;
  if (file.isFolder) {
    folderFiles++;
  } else if (file.isMetadata) {
    metadataFiles++;
  }
}
      } catch (error) {
        console.error(`Error al procesar archivo ${file.storagePath}:`, error);
        failedFiles++;
        restorationReport.errors.push(`Error al procesar archivo ${file.storagePath}: ${error.message}`);
      }
    }
    
    // Actualizar informe
    restorationReport.filesRestored = {
      total: successFiles,
      folders: folderFiles,
      regular: successFiles - metadataFiles - folderFiles,
      metadata: metadataFiles,
      failed: failedFiles
    };
    
    console.log('==== RESUMEN DE RESTAURACIÓN ====');
    console.log(`Restaurados con éxito ${successFiles} de ${filesToRestore.length} archivos`);
    console.log(`- Carpetas: ${folderFiles}`);
    console.log(`- Archivos regulares: ${successFiles - metadataFiles - folderFiles}`);
    console.log(`- Archivos de metadatos: ${metadataFiles}`);
    console.log(`- Archivos fallidos: ${failedFiles}`);
    
    // Generar informe de restauración
    restorationReport.endTime = new Date();
    restorationReport.duration = (restorationReport.endTime - restorationReport.startTime) / 1000; // en segundos
    
    const reportPath = path.join(process.cwd(), `restauracion-${targetBucket}-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(restorationReport, null, 2));
    console.log(`Informe de restauración guardado en: ${reportPath}`);
    
    console.log('Restauración completada correctamente.');
    
    // Limpiar directorio temporal
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('Directorio temporal eliminado');
    } catch (cleanupError) {
      console.error('Error al eliminar directorio temporal:', cleanupError);
    }
    
  } catch (error) {
    console.error('Error en restauración completa:', error);
    
    // Actualizar informe en caso de error
    restorationReport.endTime = new Date();
    restorationReport.duration = (restorationReport.endTime - restorationReport.startTime) / 1000;
    restorationReport.errors.push(`Error general: ${error.message}`);
    
    const reportPath = path.join(process.cwd(), `restauracion-fallida-${targetBucket}-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(restorationReport, null, 2));
    console.log(`Informe de restauración fallida guardado en: ${reportPath}`);
    
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
    
    // Eliminar archivo de señalización si existe
    const runningFilePath = path.join(process.cwd(), `restauration-running-${targetBucket}.flag`);
    if (fs.existsSync(runningFilePath)) {
      fs.unlinkSync(runningFilePath);
      console.log('[SHUTDOWN] Archivo de señalización eliminado');
    }
  } catch (cleanupError) {
    console.error('[SHUTDOWN] Error al limpiar recursos temporales:', cleanupError);
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
    
    // Eliminar archivo de señalización si existe
    const runningFilePath = path.join(process.cwd(), `restauration-running-${targetBucket}.flag`);
    if (fs.existsSync(runningFilePath)) {
      fs.unlinkSync(runningFilePath);
      console.log('[SHUTDOWN] Archivo de señalización eliminado');
    }
  } catch (cleanupError) {
    console.error('[SHUTDOWN] Error al limpiar recursos temporales:', cleanupError);
  }
  
  console.log('[SHUTDOWN] Proceso terminado correctamente.');
  process.exit(0);
});

// Manejo de excepciones no capturadas
process.on('uncaughtException', (error) => {
  console.error('[ERROR] Excepción no capturada:', error);
  
  // Limpiar recursos en caso de error
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    const runningFilePath = path.join(process.cwd(), `restauration-running-${targetBucket}.flag`);
    if (fs.existsSync(runningFilePath)) {
      fs.unlinkSync(runningFilePath);
    }
  } catch (cleanupError) {
    console.error('[SHUTDOWN] Error al limpiar recursos temporales:', cleanupError);
  }
  
  process.exit(1);
});

  // Verificar si se está ejecutando en modo script principal o como módulo
if (require.main === module) {
  // Crear un archivo de señalización para indicar que se está ejecutando
  const runningFilePath = path.join(process.cwd(), `restauration-running-${targetBucket}.flag`);
  fs.writeFileSync(runningFilePath, new Date().toISOString());
  
  // Registrar inicio
  console.log(`RESTAURACIÓN INICIADA: ${new Date().toISOString()}`);
  
  // Ejecutar script principal
  main()
    .then(() => {
      console.log(`RESTAURACIÓN COMPLETADA: ${new Date().toISOString()}`);
      // Eliminar archivo de señalización
      if (fs.existsSync(runningFilePath)) {
        fs.unlinkSync(runningFilePath);
      }
    })
    .catch((error) => {
      console.error(`ERROR EN RESTAURACIÓN: ${error}`);
      // Eliminar archivo de señalización en caso de error
      if (fs.existsSync(runningFilePath)) {
        fs.unlinkSync(runningFilePath);
      }
    });
} else {
  // Exportar para uso como módulo
  module.exports = { main };
}