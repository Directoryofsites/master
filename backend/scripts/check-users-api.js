// check-users-api.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuración
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Obtener el bucket a verificar de los argumentos
const targetBucket = process.argv[2];

if (!targetBucket) {
  console.error('Por favor proporciona el bucket a verificar');
  console.error('Uso: node check-users-api.js <bucket-name>');
  process.exit(1);
}

// Función para examinar el código del servidor en busca de patrones de consulta
async function analyzeServerCode() {
  const serverPath = path.join(__dirname, '..', 'server.js');
  
  if (!fs.existsSync(serverPath)) {
    console.log('Archivo server.js no encontrado en la ruta esperada');
    return [];
  }
  
  const serverCode = fs.readFileSync(serverPath, 'utf8');
  const apiPatterns = [];
  
  // Buscar patrones de consulta de usuarios en el código del servidor
  const userRouteRegex = /app\.(?:get|post|put|delete)\(['"]\/api\/users(?:\/[^'"]*)?['"]/g;
  const userRoutesMatches = serverCode.match(userRouteRegex) || [];
  
  console.log(`\nEncontradas ${userRoutesMatches.length} rutas de API relacionadas con usuarios:`);
  userRoutesMatches.forEach(route => {
    console.log(`- ${route}`);
    apiPatterns.push(route);
  });
  
  // Buscar patrones de consultas a la tabla user_accounts
  const userAccountsRegex = /\.from\(['"]user_accounts['"]\)(?:[.\s\S]*?)\.eq\(['"]([^'"]*)['"]/g;
  let match;
  console.log('\nEncontrados patrones de consulta a user_accounts:');
  while ((match = userAccountsRegex.exec(serverCode)) !== null) {
    const filterField = match[1];
    const queryPart = match[0];
    console.log(`- Filtro por campo: '${filterField}'`);
    console.log(`  Patrón: ${queryPart}`);
    
    if (filterField === 'bucket' || filterField === 'bucketId') {
      console.log(`  ¡IMPORTANTE! Se está filtrando por '${filterField}'`);
    }
  }
  
  return apiPatterns;
}

// Función principal de verificación
async function checkUsersApi() {
  try {
    console.log(`===== DIAGNÓSTICO DE API DE USUARIOS PARA BUCKET: ${targetBucket} =====`);
    
    // 1. Verificar usuarios en la base de datos
    console.log('\n1. Verificando usuarios en la base de datos...');
    
    // Verificar usando 'bucket'
    const { data: usersByBucket, error: bucketError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('bucket', targetBucket);
      
    if (bucketError) {
      console.error(`Error al consultar usuarios con bucket='${targetBucket}': ${bucketError.message}`);
    } else {
      console.log(`Encontrados ${usersByBucket ? usersByBucket.length : 0} usuarios con bucket='${targetBucket}'`);
      
      if (usersByBucket && usersByBucket.length > 0) {
        console.log('Ejemplos:');
        usersByBucket.slice(0, 3).forEach(u => {
          console.log(`- Username: ${u.username}, ID: ${u.id}`);
          console.log(`  Campos disponibles: ${Object.keys(u).join(', ')}`);
        });
      }
    }
    
    // Verificar usando 'bucketId' (potencial confusión)
    const { data: usersByBucketId, error: bucketIdError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('bucketId', targetBucket);
      
    if (!bucketIdError) {
      console.log(`Encontrados ${usersByBucketId ? usersByBucketId.length : 0} usuarios con bucketId='${targetBucket}'`);
      
      if (usersByBucketId && usersByBucketId.length > 0) {
        console.log('DIAGNÓSTICO: ¡Existe confusión en el campo! La tabla tiene tanto "bucket" como "bucketId"');
      } else {
        console.log('El campo "bucketId" no contiene datos o no existe en la tabla');
      }
    }
    
    // 2. Analizar el código del servidor
    console.log('\n2. Analizando código del servidor para identificar patrones de API...');
    const apiPatterns = await analyzeServerCode();
    
    // 3. Simular consultas de API comunes
    console.log('\n3. Simulando consultas API comunes para usuarios...');
    
    // Patrones de consulta comunes a probar
    const testQueries = [
      { description: 'Consulta de usuarios por bucket', query: { bucket: targetBucket } },
      { description: 'Consulta de usuarios por bucketId', query: { bucketId: targetBucket } },
      { description: 'Consulta de usuarios activos', query: { bucket: targetBucket, active: true } }
    ];
    
    for (const test of testQueries) {
      console.log(`\nProbando: ${test.description}`);
      
      // Construir consulta dinámica
      let query = supabase.from('user_accounts').select('*');
      
      for (const [key, value] of Object.entries(test.query)) {
        query = query.eq(key, value);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.log(`Resultado: ${data ? data.length : 0} usuarios encontrados`);
        
        if (data && data.length > 0) {
          console.log('Primer usuario:');
          console.log(JSON.stringify(data[0], null, 2));
        }
      }
    }
    
    // 4. Conclusiones y recomendaciones
    console.log('\n===== CONCLUSIONES Y RECOMENDACIONES =====');
    
    if (usersByBucket && usersByBucket.length > 0) {
      console.log('✅ Los usuarios existen en la base de datos con bucket correcto');
      
      if (apiPatterns.length > 0) {
        console.log('ℹ️ La API tiene endpoints para gestionar usuarios');
        console.log('RECOMENDACIÓN: Verificar que el frontend esté llamando a estos endpoints correctamente');
      } else {
        console.log('⚠️ No se encontraron endpoints de API claros para usuarios');
        console.log('RECOMENDACIÓN: Verificar cómo el frontend obtiene los datos de usuarios');
      }
      
      if (usersByBucketId && usersByBucketId.length > 0) {
        console.log('⚠️ IMPORTANTE: Hay confusión entre campos bucket/bucketId');
        console.log('RECOMENDACIÓN: Unificar para usar solo uno de los campos');
      }
      
      console.log('\nPasos sugeridos para solucionar problemas de visualización:');
      console.log('1. Verificar en el frontend (UserManagement.js) qué campo se usa en las consultas');
      console.log('2. Ajustar el frontend o backend para usar un campo consistente (preferiblemente "bucket")');
      console.log('3. Limpiar usuarios duplicados con el script cleanup-duplicate-users.js');
      console.log('4. Si persiste el problema, puede ser necesario limpiar el caché del navegador');
    } else {
      console.log('⚠️ No se encontraron usuarios con el bucket especificado');
      console.log('RECOMENDACIÓN: Verificar que la restauración esté funcionando correctamente');
    }
    
  } catch (error) {
    console.error(`Error general: ${error.message}`);
  }
}

// Ejecutar el script
checkUsersApi();