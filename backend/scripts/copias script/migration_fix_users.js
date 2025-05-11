// migration_fix_users.js - Script específico para migrar usuarios entre buckets
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Configuración - usando la misma ruta que el script original
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Verificar que tenemos las credenciales
if (!supabaseUrl || !supabaseKey) {
  console.error('Error: No se encontraron las credenciales de Supabase (SUPABASE_URL, SUPABASE_KEY)');
  console.error('Asegúrate de que el archivo .env existe en el directorio backend y contiene estas variables');
  process.exit(1);
}

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Buckets de origen y destino
const sourceBucket = 'contenedor003';
const targetBucket = 'contenedor004';

async function migrateUsers() {
  try {
    console.log(`Iniciando migración de usuarios de ${sourceBucket} a ${targetBucket}`);
    console.log(`Usando URL de Supabase: ${supabaseUrl}`);

    // 1. Obtener todos los usuarios del bucket de origen
    console.log(`Buscando usuarios en bucket de origen: ${sourceBucket}`);
    const { data: sourceUsers, error: sourceError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('bucket', sourceBucket);

    if (sourceError) {
      console.error(`Error al obtener usuarios de origen:`, sourceError);
      return;
    }

    if (!sourceUsers || sourceUsers.length === 0) {
      console.log(`No se encontraron usuarios en el bucket de origen: ${sourceBucket}`);
      return;
    }

    console.log(`Encontrados ${sourceUsers.length} usuarios en el bucket ${sourceBucket}`);

    // 2. Buscar usuarios especiales
    const specialUsers = sourceUsers.filter(u => 
      u.username && (u.username === 'dedo1' || u.username.includes('dedo')));
    
    if (specialUsers.length > 0) {
      console.log(`Encontrados ${specialUsers.length} usuarios especiales:`);
      specialUsers.forEach(u => console.log(`- ${u.username}`));
    }

    // 3. Verificar estructura de la tabla en el destino
    console.log('Verificando estructura de la tabla user_accounts...');
    const { data: sampleRow, error: sampleError } = await supabase
      .from('user_accounts')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('Error al verificar estructura de tabla:', sampleError);
      return;
    }
    
    const tableColumns = sampleRow && sampleRow.length > 0 ? Object.keys(sampleRow[0]) : [];
    console.log('Columnas disponibles en la tabla:', tableColumns.join(', '));

    // 4. Adaptar usuarios al bucket de destino
    const adaptedUsers = sourceUsers.map(user => {
      // Crear un objeto base con solo las columnas que sabemos que existen
      const newUser = {
        id: uuidv4(),
        username: `${user.username}_from_${sourceBucket}`,
        bucket: targetBucket
      };
      
      // Añadir campos solo si existen en la tabla de destino
      if (tableColumns.includes('password_hash')) newUser.password_hash = user.password_hash;
      if (tableColumns.includes('created_by')) newUser.created_by = user.created_by || 'migration_script';
      if (tableColumns.includes('active')) newUser.active = true;
      if (tableColumns.includes('assigned_folders') && user.assigned_folders) newUser.assigned_folders = user.assigned_folders;
      if (tableColumns.includes('group_name') && user.group_name) newUser.group_name = user.group_name;
      
      return newUser;
    });

    // 5. Insertar los usuarios adaptados en el bucket de destino
    let successCount = 0;
    for (const user of adaptedUsers) {
      try {
        console.log(`Migrando usuario: ${user.username}`);
        const { data, error: insertError } = await supabase
          .from('user_accounts')
          .insert([user])
          .select();

        if (insertError) {
          console.error(`Error al insertar usuario ${user.username}:`, insertError);
          
          // Intentar con un username diferente si hay conflicto
          if (insertError.code === '23505' && insertError.message.includes('username')) {
            const retryUser = {...user, username: `${user.username}_${Date.now().toString().slice(-5)}`};
            console.log(`Reintentando con nombre de usuario diferente: ${retryUser.username}`);
            
            const { error: retryError } = await supabase
              .from('user_accounts')
              .insert([retryUser]);
              
            if (!retryError) {
              console.log(`✓ Usuario insertado con username modificado: ${retryUser.username}`);
              successCount++;
            } else {
              console.log(`✗ Error en segundo intento: ${retryError.message}`);
            }
          }
        } else {
          console.log(`✓ Usuario ${user.username} migrado con éxito (ID: ${data[0].id})`);
          successCount++;
        }
      } catch (error) {
        console.error(`Error al procesar usuario ${user.username}:`, error);
      }
    }

    console.log(`=== Migración completada: ${successCount} de ${adaptedUsers.length} usuarios migrados ===`);

    // 6. Verificar usuarios en el bucket de destino
    console.log(`Verificando usuarios en el bucket de destino: ${targetBucket}`);
    const { data: targetUsers, error: targetError } = await supabase
      .from('user_accounts')
      .select('username, id, bucket')
      .eq('bucket', targetBucket);

    if (targetError) {
      console.error(`Error al verificar usuarios en destino:`, targetError);
    } else {
      console.log(`Encontrados ${targetUsers.length} usuarios en el bucket ${targetBucket}`);
      if (targetUsers.length > 0) {
        console.log(`Ejemplos de usuarios en destino:`);
        targetUsers.slice(0, 5).forEach(u => console.log(`- ${u.username} (ID: ${u.id})`));
      }
    }

  } catch (error) {
    console.error('Error general en la migración:', error);
  }
}

// Ejecutar la migración
migrateUsers();