// fix_users_direct.js - Script para crear usuarios directamente en el bucket destino
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Configuración
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Bucket de destino
const targetBucket = 'contenedor004'; 

// Lista de usuarios a crear (exactamente como aparecen en la interfaz)
const usersToCreate = [
  { username: 'aaacccgggg', password_hash: 'placeholder_hash' },
  { username: 'mariela01', password_hash: 'placeholder_hash' },
  { username: 'hector1', password_hash: 'placeholder_hash' },
  { username: 'gggggadmin3', password_hash: 'placeholder_hash' },
  // Añade el usuario especial dedo1
  { username: 'dedo1', password_hash: 'placeholder_hash' }
];

async function createDirectUsers() {
  try {
    console.log(`Creando usuarios directamente en el bucket: ${targetBucket}`);

    // 1. Crear los usuarios uno por uno
    let successCount = 0;

    for (const user of usersToCreate) {
      try {
        console.log(`Creando usuario: ${user.username}`);
        
        // Crear un usuario completo con las columnas que sabemos que existen
        const newUser = {
          id: uuidv4(),
          username: user.username,
          password_hash: user.password_hash,
          bucket: targetBucket,
          created_by: 'direct_script',
          active: true
        };

        const { data, error } = await supabase
          .from('user_accounts')
          .insert([newUser])
          .select();

        if (error) {
          console.error(`Error al crear usuario ${user.username}:`, error);
          
          // Si hay un conflicto, intentamos actualizar en lugar de insertar
          if (error.code === '23505') {
            console.log(`Usuario ${user.username} ya existe, intentando actualizar...`);
            
            // Primero encontrar el ID del usuario existente
            const { data: existingUser, error: findError } = await supabase
              .from('user_accounts')
              .select('id')
              .eq('username', user.username)
              .single();
            
            if (findError) {
              console.error(`Error al buscar usuario existente ${user.username}:`, findError);
              continue;
            }
            
            // Actualizar el bucket del usuario existente
            const { error: updateError } = await supabase
              .from('user_accounts')
              .update({ bucket: targetBucket, active: true })
              .eq('id', existingUser.id);
            
            if (updateError) {
              console.error(`Error al actualizar usuario ${user.username}:`, updateError);
            } else {
              console.log(`✓ Usuario ${user.username} actualizado con bucket=${targetBucket}`);
              successCount++;
            }
          }
        } else {
          console.log(`✓ Usuario ${user.username} creado con éxito`);
          successCount++;
        }
      } catch (error) {
        console.error(`Error general al procesar usuario ${user.username}:`, error);
      }
    }

    console.log(`=== Proceso completado: ${successCount} de ${usersToCreate.length} usuarios procesados ===`);
    
    // 2. Verificar los usuarios en el bucket
    console.log(`\nVerificando usuarios en el bucket: ${targetBucket}`);
    const { data: targetUsers, error: verifyError } = await supabase
      .from('user_accounts')
      .select('username, id, bucket')
      .eq('bucket', targetBucket);
    
    if (verifyError) {
      console.error('Error al verificar usuarios:', verifyError);
    } else {
      console.log(`Encontrados ${targetUsers.length} usuarios en el bucket ${targetBucket}`);
      
      // Verificar si nuestros usuarios están en el bucket correcto
      const ourUsers = targetUsers.filter(u => 
        usersToCreate.some(ou => ou.username === u.username)
      );
      
      console.log(`De los cuales ${ourUsers.length} son los usuarios que intentamos crear/actualizar:`);
      ourUsers.forEach(u => console.log(`- ${u.username} (ID: ${u.id})`));
    }

  } catch (error) {
    console.error('Error general:', error);
  }
}

// Ejecutar el script
createDirectUsers();