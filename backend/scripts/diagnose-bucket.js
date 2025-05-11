// diagnose-bucket.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuración
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Obtener el bucket a diagnosticar de los argumentos
const targetBucket = process.argv[2];

if (!targetBucket) {
  console.error('Por favor proporciona el bucket a diagnosticar');
  console.error('Uso: node diagnose-bucket.js <bucket-name>');
  process.exit(1);
}

async function diagnoseBucket() {
  try {
    console.log(`Diagnosticando bucket: ${targetBucket}`);

    // 1. Verificar si el bucket existe
    console.log('\n1. Verificando existencia del bucket...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      throw new Error(`Error al listar buckets: ${bucketsError.message}`);
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === targetBucket);
    console.log(`Bucket '${targetBucket}' existe: ${bucketExists}`);
    
    if (!bucketExists) {
      console.log('DIAGNÓSTICO: El bucket no existe. Esto explicaría por qué no se muestran archivos.');
      return;
    }

    // 2. Listar archivos en el bucket
    console.log('\n2. Listando archivos en el bucket...');
    const { data: files, error: filesError } = await supabase.storage
      .from(targetBucket)
      .list();
      
    if (filesError) {
      console.error(`Error al listar archivos: ${filesError.message}`);
      console.log('DIAGNÓSTICO: Error al acceder a los archivos. Revisar permisos del bucket.');
    } else {
      console.log(`Encontrados ${files ? files.length : 0} archivos/carpetas en el bucket.`);
      if (files && files.length > 0) {
        console.log('Ejemplos:');
        files.slice(0, 5).forEach(f => console.log(`- ${f.name} (${f.id})`));
      }
    }

    // 3. Verificar usuarios asociados al bucket
    console.log('\n3. Verificando usuarios asociados al bucket...');
    const { data: users, error: usersError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('bucket', targetBucket);
      
    if (usersError) {
      console.error(`Error al obtener usuarios: ${usersError.message}`);
      console.log('DIAGNÓSTICO: Error al acceder a la tabla de usuarios. Revisar permisos o estructura.');
    } else {
      console.log(`Encontrados ${users ? users.length : 0} usuarios asociados al bucket.`);
      if (users && users.length > 0) {
        // Mostrar algunos ejemplos
        console.log('Ejemplos de usuarios:');
        users.slice(0, 5).forEach(u => {
          console.log(`- ID: ${u.id}, Username: ${u.username}, Active: ${u.active}`);
          console.log(`  Campos clave: ${Object.keys(u).join(', ')}`);
        });
        
        // Verificar si hay campo bucketId (que podría causar confusión)
        const hasBucketId = users.some(u => u.bucketId !== undefined);
        console.log(`¿Algún usuario tiene campo 'bucketId'? ${hasBucketId}`);
        if (hasBucketId) {
          console.log('DIAGNÓSTICO: Se detectó el campo bucketId en usuarios. Esto podría causar confusión con el campo bucket.');
        }
      }
    }

    // 4. Verificar etiquetas asociadas al bucket
    console.log('\n4. Verificando etiquetas asociadas al bucket...');
    const { data: tags, error: tagsError } = await supabase
      .from('tags_by_bucket')
      .select('*')
      .eq('bucket', targetBucket);
      
    if (tagsError) {
      console.error(`Error al obtener etiquetas: ${tagsError.message}`);
      console.log('DIAGNÓSTICO: Error al acceder a la tabla de etiquetas. Revisar permisos o estructura.');
    } else {
      console.log(`Encontradas ${tags ? tags.length : 0} etiquetas asociadas al bucket.`);
      if (tags && tags.length > 0) {
        console.log('Ejemplos de etiquetas:');
        tags.slice(0, 5).forEach(t => {
          console.log(`- ID: ${t.id}, Nombre: ${t.tag_name}, Categoría: ${t.category || 'N/A'}`);
        });
      }
    }

    // 5. Verificar políticas RLS
    console.log('\n5. Verificando políticas de seguridad (RLS)...');
    console.log('NOTA: No se puede verificar programáticamente las políticas RLS específicas.');
    console.log('Sugerencia: Revisar manualmente las políticas RLS en la consola de Supabase para:');
    console.log('- Tabla user_accounts');
    console.log('- Tabla tags_by_bucket');
    console.log('- Bucket de storage');

    // 6. Resumen y recomendaciones
    console.log('\n6. Resumen y recomendaciones:');
    console.log('A. Verificar la consulta en el frontend para asegurar que está usando:');
    console.log(' - Campo "bucket" (no bucketId) para filtrar usuarios');
    console.log(' - Comprobar si hay filtros adicionales (ej: usuario.active = true)');
    console.log('B. Revisar en console.log/network tab del navegador para ver qué consultas exactas se realizan');
    console.log('C. Verificar si la interfaz usa almacenamiento en caché que necesite ser limpiado');
    console.log('D. Comprobar que el usuario actual tiene permisos suficientes para ver todos los datos');

  } catch (error) {
    console.error(`Error general en diagnóstico: ${error.message}`);
  }
}

// Ejecutar el script
diagnoseBucket();