// update_users_bucket.js - Actualiza el bucket de usuarios existentes
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuración
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Lista de usuarios a actualizar
const usersToUpdate = ['zdvvadmin3', 'zzz', 'yyyy'];
// También puedes incluir 'dedo1' y cualquier otro usuario que necesites
// const usersToUpdate = ['zdvvadmin3', 'zzz', 'yyyy', 'dedo1'];

// Bucket destino
const targetBucket = 'contenedor004';

async function updateUsersBucket() {
  try {
    console.log(`Actualizando usuarios para asignarlos al bucket: ${targetBucket}`);

    let successCount = 0;

    // Procesar cada usuario
    for (const username of usersToUpdate) {
      try {
        console.log(`Buscando usuario: ${username}`);
        
        // Buscar el usuario por su nombre
        const { data: user, error: findError } = await supabase
          .from('user_accounts')
          .select('id, username, bucket')
          .eq('username', username)
          .single();
        
        if (findError) {
          console.error(`Error al buscar usuario ${username}:`, findError);
          continue;
        }
        
        if (!user) {
          console.log(`Usuario ${username} no encontrado`);
          continue;
        }
        
        console.log(`Usuario ${username} encontrado (ID: ${user.id}, Bucket actual: ${user.bucket})`);
        
        // Actualizar el bucket del usuario
        const { error: updateError } = await supabase
          .from('user_accounts')
          .update({ 
            bucket: targetBucket,
            active: true  // Asegurarse de que esté activo
          })
          .eq('id', user.id);
        
        if (updateError) {
          console.error(`Error al actualizar usuario ${username}:`, updateError);
        } else {
          console.log(`✓ Usuario ${username} actualizado al bucket ${targetBucket}`);
          successCount++;
        }
      } catch (error) {
        console.error(`Error general al procesar usuario ${username}:`, error);
      }
    }

    console.log(`=== Actualización completada: ${successCount} de ${usersToUpdate.length} usuarios actualizados ===`);

    // Verificar todos los usuarios en el bucket destino
    console.log(`\nVerificando usuarios en el bucket: ${targetBucket}`);
    const { data: targetUsers, error: verifyError } = await supabase
      .from('user_accounts')
      .select('username, id, bucket, active')
      .eq('bucket', targetBucket);
    
    if (verifyError) {
      console.error('Error al verificar usuarios:', verifyError);
    } else {
      console.log(`Encontrados ${targetUsers.length} usuarios en el bucket ${targetBucket}:`);
      targetUsers.forEach(u => console.log(`- ${u.username} (ID: ${u.id}, Activo: ${u.active})`));
    }

  } catch (error) {
    console.error('Error general:', error);
  }
}

// Ejecutar script
updateUsersBucket();