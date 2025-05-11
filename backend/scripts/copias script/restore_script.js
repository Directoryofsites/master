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

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Directorio temporal para descomprimir los archivos
const tempDir = path.join(os.tmpdir(), `restore-${Date.now()}`);

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
    
    // Verificar que el archivo de backup exista
    if (!fs.existsSync(backupPath)) {
      throw new Error(`El archivo de backup no existe: ${backupPath}`);
    }
    
    // Asegurar que existe el directorio temporal
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Descomprimir el archivo de backup
    console.log('Descomprimiendo archivo de backup...');
    const zip = new AdmZip(backupPath);
    zip.extractAllTo(tempDir, true);
    
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
    
    // Restaurar usuarios
    console.log(`Restaurando ${adaptedUsers.length} usuarios...`);
    restorationReport.usersRestored.total = adaptedUsers.length;
    
    // Estrategia mejorada: intentar restaurar en todas las tablas de usuarios posibles
    for (const table of potentialUserTables) {
      try {
        console.log(`Intentando restaurar usuarios en tabla: ${table}`);
        
        // Verificar si la tabla existe antes de intentar insertar
        let tableExists = true;
        try {
          const { data, error } = await supabase
            .from(table)
            .select('id')
            .limit(1);
          
          if (error) {
            console.log(`La tabla ${table} no existe o no es accesible: ${error.message}`);
            tableExists = false;
          }
        } catch (error) {
          console.log(`Error al verificar tabla ${table}: ${error.message}`);
          tableExists = false;
        }
        
        if (tableExists) {
          const { error: insertError } = await supabase
            .from(table)
            .upsert(adaptedUsers, { 
              onConflict: 'id', 
              ignoreDuplicates: false 
            });
          
          if (!insertError) {
            console.log(`Usuarios restaurados en tabla ${table}`);
            restorationReport.tablesRestored[table] = { status: 'success', count: adaptedUsers.length };
          } else {
            console.log(`Error al restaurar usuarios en tabla ${table}: ${insertError.message}`);
            restorationReport.tablesRestored[table] = { status: 'error', error: insertError.message };
            
            // Intentar restaurar usuarios dinámicos y estáticos por separado
            const dynamicUsers = adaptedUsers.filter(user => 
              user.is_dynamic === true || 
              user.created_by_admin === true || 
              (user.name && user.name.includes('dedo')) ||
              (user.username && user.username.includes('dedo')) ||
              (user.email && user.email.includes('dedo'))
            );
            
            const regularUsers = adaptedUsers.filter(user => 
              user.is_dynamic !== true && 
              user.created_by_admin !== true &&
              (!user.name || !user.name.includes('dedo')) &&
              (!user.username || !user.username.includes('dedo')) &&
              (!user.email || !user.email.includes('dedo'))
            );
            
            // Intentar restaurar usuarios dinámicos
            if (dynamicUsers.length > 0) {
              console.log(`Intentando restaurar ${dynamicUsers.length} usuarios dinámicos en ${table}...`);
              
              try {
                const { error: dynamicError } = await supabase
                  .from(table)
                  .upsert(dynamicUsers, { onConflict: 'id' });
                
                if (!dynamicError) {
                  console.log(`Usuarios dinámicos restaurados en tabla ${table}`);
                  restorationReport.tablesRestored[`${table}_dynamic`] = { status: 'success', count: dynamicUsers.length };
                } else {
                  console.log(`Error al restaurar usuarios dinámicos en tabla ${table}: ${dynamicError.message}`);
                  restorationReport.tablesRestored[`${table}_dynamic`] = { status: 'error', error: dynamicError.message };
                  
                  // Intentar uno por uno para usuarios especiales como dedo1
                  const specialUsers = dynamicUsers.filter(u => 
                    (u.name && u.name.includes('dedo')) ||
                    (u.username && u.username.includes('dedo')) ||
                    (u.email && u.email.includes('dedo'))
                  );
                  
                  if (specialUsers.length > 0) {
                    console.log(`Intentando restaurar ${specialUsers.length} usuarios especiales uno por uno...`);
                    
                    for (const user of specialUsers) {
                      try {
                        const { error: singleError } = await supabase
                          .from(table)
                          .upsert([user], { onConflict: 'id' });
                        
                        if (!singleError) {
                          console.log(`Usuario especial restaurado: ${user.name || user.username || user.email || user.id}`);
                        } else {
                          console.log(`Error al restaurar usuario especial: ${singleError.message}`);
                          
                          // Intentar eliminar campos problemáticos
                          const simplifiedUser = { ...user };
                          delete simplifiedUser.created_at;
                          delete simplifiedUser.updated_at;
                          
                          try {
                            const { error: simplifiedError } = await supabase
                              .from(table)
                              .upsert([simplifiedUser], { onConflict: 'id' });
                            
                            if (!simplifiedError) {
                              console.log(`Usuario especial restaurado con campos simplificados`);
                            } else {
                              console.log(`Error al restaurar usuario simplificado: ${simplifiedError.message}`);
                            }
                          } catch (error) {
                            console.log(`Error al procesar usuario simplificado: ${error.message}`);
                          }
                        }
                      } catch (error) {
                        console.log(`Error general al restaurar usuario especial: ${error.message}`);
                      }
                    }
                  }
                }
              } catch (error) {
                console.log(`Error general al restaurar usuarios dinámicos: ${error.message}`);
              }
            }
            
            // Intentar restaurar usuarios regulares
            if (regularUsers.length > 0) {
              console.log(`Intentando restaurar ${regularUsers.length} usuarios regulares en ${table}...`);
              
              try {
                const { error: regularError } = await supabase
                  .from(table)
                  .upsert(regularUsers, { onConflict: 'id' });
                
                if (!regularError) {
                  console.log(`Usuarios regulares restaurados en tabla ${table}`);
                  restorationReport.tablesRestored[`${table}_regular`] = { status: 'success', count: regularUsers.length };
                } else {
                  console.log(`Error al restaurar usuarios regulares en tabla ${table}: ${regularError.message}`);
                  restorationReport.tablesRestored[`${table}_regular`] = { status: 'error', error: regularError.message };
                }
              } catch (error) {
                console.log(`Error general al restaurar usuarios regulares: ${error.message}`);
              }
            }
          }
        }
      } catch (tableError) {
        console.log(`Error general al acceder a tabla ${table}: ${tableError.message}`);
      }
    }
    
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
        
        // Subir archivo a Supabase
        const { error } = await supabase.storage
          .from(targetBucket)
          .upload(file.storagePath, fileBuffer, {
            contentType: contentType,
            upsert: true
          });
        
        if (error) {
          console.error(`Error al subir ${file.storagePath}:`, error);
          failedFiles++;
          restorationReport.errors.push(`Error al subir archivo ${file.storagePath}: ${error.message}`);
          
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
              continue;
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

// Ejecutar script principal
main();