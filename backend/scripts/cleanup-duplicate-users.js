// cleanup-duplicate-users.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuración
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Obtener el bucket a limpiar de los argumentos
const targetBucket = process.argv[2];

if (!targetBucket) {
  console.error('Por favor proporciona el bucket a limpiar');
  console.error('Uso: node cleanup-duplicate-users.js <bucket-name>');
  process.exit(1);
}

async function cleanupDuplicateUsers() {
  try {
    console.log(`Iniciando limpieza de usuarios duplicados para bucket: ${targetBucket}`);

    // Obtener todos los usuarios del bucket
    const { data: users, error } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('bucket', targetBucket);

    if (error) {
      throw new Error(`Error al obtener usuarios: ${error.message}`);
    }

    console.log(`Encontrados ${users.length} usuarios en total para el bucket ${targetBucket}`);

    // Agrupar usuarios por nombre base
    const userGroups = {};

    users.forEach(user => {
      // Extraer el nombre base (sin sufijos de timestamp)
      const parts = user.username.split('_');
      const baseName = parts[0];

      if (!userGroups[baseName]) {
        userGroups[baseName] = [];
      }

      userGroups[baseName].push(user);
    });

    // Identificar usuarios duplicados
    let duplicateCount = 0;
    let toKeep = [];
    let toDelete = [];

    for (const [baseName, usersWithName] of Object.entries(userGroups)) {
      if (usersWithName.length > 1) {
        console.log(`Nombre base '${baseName}' tiene ${usersWithName.length} duplicados`);
        duplicateCount += usersWithName.length - 1;

        // Ordenar por fecha de creación (si existe) o ID
        usersWithName.sort((a, b) => {
          if (a.created_at && b.created_at) {
            return new Date(a.created_at) - new Date(b.created_at);
          }
          return a.id.localeCompare(b.id);
        });

        // Mantener el primer usuario (más antiguo) y marcar el resto para eliminar
        toKeep.push(usersWithName[0]);
        toDelete.push(...usersWithName.slice(1));
      } else {
        // Si solo hay uno, mantenerlo
        toKeep.push(usersWithName[0]);
      }
    }

    console.log(`Encontrados ${duplicateCount} usuarios duplicados a eliminar`);

    if (toDelete.length > 0) {
      // Pedir confirmación antes de eliminar
      console.log('Ejemplos de usuarios a eliminar:');
      toDelete.slice(0, 5).forEach(u => console.log(`- ${u.username} (ID: ${u.id})`));

      console.log(`\n¿Deseas continuar con la eliminación de ${toDelete.length} usuarios duplicados? (s/n)`);

      // Leer respuesta
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('> ', async (answer) => {
        if (answer.toLowerCase() === 's') {
          console.log('Procediendo con la eliminación...');

          // Eliminar en lotes de 10 para evitar sobrecargar la BD
          const batchSize = 10;
          let deletedCount = 0;

          for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);
            const ids = batch.map(u => u.id);

            console.log(`Eliminando lote ${i/batchSize + 1}/${Math.ceil(toDelete.length/batchSize)}...`);

            const { error } = await supabase
              .from('user_accounts')
              .delete()
              .in('id', ids);

            if (error) {
              console.error(`Error al eliminar lote: ${error.message}`);
            } else {
              deletedCount += batch.length;
              console.log(`${deletedCount}/${toDelete.length} usuarios eliminados`);
            }

            // Pequeña pausa entre lotes
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          console.log(`\nLimpieza completada. ${deletedCount} usuarios duplicados eliminados.`);
          console.log(`Quedan ${toKeep.length} usuarios únicos en el bucket ${targetBucket}.`);
        } else {
          console.log('Operación cancelada por el usuario.');
        }

        rl.close();
      });
    } else {
      console.log('No se encontraron duplicados para eliminar.');
    }
  } catch (error) {
    console.error(`Error en la limpieza: ${error.message}`);
  }
}

// Ejecutar el script
cleanupDuplicateUsers();