// direct_user_copy.js - Copia exacta de usuarios entre buckets
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Configuración
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Buckets de origen y destino
const sourceBucket = 'contenedor003';
const targetBucket = 'contenedor004';

async function copyUsersExactly() {
  try {
    console.log(`Copiando usuarios exactamente de ${sourceBucket} a ${targetBucket}`);

    // 1. Obtener usuarios del bucket de origen
    const { data: sourceUsers, error: sourceError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('bucket', sourceBucket);

    if (sourceError) {
      console.error('Error al obtener usuarios de origen:', sourceError);
      return;
    }

    console.log(`Encontrados ${sourceUsers.length} usuarios en bucket ${sourceBucket}`);

    // 2. Copiar cada usuario directamente al bucket de destino
    let successCount = 0;

    for (const user of sourceUsers) {
      try {
        // Crear una copia exacta del usuario pero con nuevo ID y bucket diferente
        const exactUser = {
          ...user,
          id: uuidv4(),  // Nuevo ID único
          bucket: targetBucket
        };

        // Primero, verificar si ya existe un usuario con el mismo nombre
        const { data: existingUser, error: findError } = await supabase
          .from('user_accounts')
          .select('id')
          .eq('username', user.username)
          .eq('bucket', targetBucket)
          .single();

        if (!findError && existingUser) {
          console.log(`Usuario ${user.username} ya existe en ${targetBucket}, actualizando`);
          
          // Actualizar el usuario existente
          const { error: updateError } = await supabase
            .from('user_accounts')
            .update({
              password_hash: user.password_hash,
              assigned_folders: user.assigned_folders,
              group_name: user.group_name,
              active: true
            })
            .eq('id', existingUser.id);
          
          if (updateError) {
            console.error(`Error al actualizar usuario ${user.username}:`, updateError);
          } else {
            console.log(`✓ Usuario ${user.username} actualizado correctamente`);
            successCount++;
          }
        } else {
          // Insertar un nuevo usuario
          console.log(`Creando copia exacta de ${user.username} en ${targetBucket}`);
          
          const { error: insertError } = await supabase
            .from('user_accounts')
            .insert([exactUser]);
          
          if (insertError) {
            console.error(`Error al insertar usuario ${user.username}:`, insertError);
          } else {
            console.log(`✓ Usuario ${user.username} copiado correctamente`);
            successCount++;
          }
        }
      } catch (error) {
        console.error(`Error general al procesar usuario ${user.username}:`, error);
      }
    }

    console.log(`=== Copia completada: ${successCount} de ${sourceUsers.length} usuarios copiados o actualizados ===`);

  } catch (error) {
    console.error('Error general en el proceso:', error);
  }
}

// Ejecutar script
copyUsersExactly();