// verify-bucket-users.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuración
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Obtener el bucket a verificar de los argumentos
const targetBucket = process.argv[2];

if (!targetBucket) {
  console.error('Por favor proporciona el bucket a verificar');
  console.error('Uso: node verify-bucket-users.js <bucket-name>');
  process.exit(1);
}

async function verifyBucketUsers() {
  try {
    console.log(`Verificando usuarios para bucket: ${targetBucket}`);
    
    // 1. Obtener todos los usuarios del bucket
    const { data: users, error } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('bucket', targetBucket);
    
    if (error) {
      throw new Error(`Error al obtener usuarios: ${error.message}`);
    }
    
    console.log(`Encontrados ${users.length} usuarios en total para el bucket ${targetBucket}`);
    
    // 2. Verificar si hay usuarios inactivos
    const inactiveUsers = users.filter(user => !user.active);
    console.log(`Usuarios inactivos: ${inactiveUsers.length}`);
    
    // 3. Activar todos los usuarios
    if (inactiveUsers.length > 0) {
      console.log('¿Quieres activar todos los usuarios inactivos? (s/n)');
      
      // Leer respuesta
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('> ', async (answer) => {
        if (answer.toLowerCase() === 's') {
          console.log('Activando usuarios...');
          
          // Activar usuarios uno por uno
          for (const user of inactiveUsers) {
            const { error: updateError } = await supabase
              .from('user_accounts')
              .update({ active: true })
              .eq('id', user.id);
            
            if (updateError) {
              console.error(`Error al activar usuario ${user.username}:`, updateError.message);
            } else {
              console.log(`Usuario ${user.username} activado correctamente`);
            }
          }
          
          // Verificar usuarios activados
          const { data: activeUsers } = await supabase
            .from('user_accounts')
            .select('id, username, bucket, active')
            .eq('bucket', targetBucket)
            .eq('active', true);
          
          console.log(`Ahora hay ${activeUsers.length} usuarios activos de ${users.length} totales.`);
        } else {
          console.log('Operación cancelada por el usuario.');
        }
        
        rl.close();
        
        // Verificar estructura de datos en usuario
        console.log('\nVerificando estructura de datos de usuarios:');
        if (users.length > 0) {
          const firstUser = users[0];
          console.log('Campos disponibles en usuario:');
          console.log(Object.keys(firstUser).join(', '));
          
          // Revisar asignación de carpetas
          if (firstUser.assigned_folders) {
            console.log(`Estructura de assigned_folders: ${typeof firstUser.assigned_folders}`);
            if (Array.isArray(firstUser.assigned_folders)) {
              console.log(`Longitud de assigned_folders: ${firstUser.assigned_folders.length}`);
              
              if (firstUser.assigned_folders.length > 0) {
                console.log('Ejemplo de elemento en assigned_folders:');
                console.log(JSON.stringify(firstUser.assigned_folders[0], null, 2));
              }
            }
          }
          
          // Revisar campos específicos que podrían causar problemas
          console.log('\nCampos críticos para visualización:');
          console.log(`- active: ${firstUser.active}`);
          console.log(`- bucket: ${firstUser.bucket}`);
          
          if (!firstUser.bucket) {
            console.log('⚠️ ADVERTENCIA: El campo bucket está vacío o indefinido.');
          }
        }
      });
    } else {
      console.log('Todos los usuarios ya están activos.');
      
      // Verificar estructura de datos en usuario
      console.log('\nVerificando estructura de datos de usuarios:');
      if (users.length > 0) {
        const firstUser = users[0];
        console.log('Campos disponibles en usuario:');
        console.log(Object.keys(firstUser).join(', '));
        
        // Revisar campos específicos que podrían causar problemas
        console.log('\nCampos críticos para visualización:');
        console.log(`- active: ${firstUser.active}`);
        console.log(`- bucket: ${firstUser.bucket}`);
        
        if (!firstUser.bucket) {
          console.log('⚠️ ADVERTENCIA: El campo bucket está vacío o indefinido.');
        }
      }
    }
  } catch (error) {
    console.error(`Error en la verificación: ${error.message}`);
  }
}

// Ejecutar el script
verifyBucketUsers();