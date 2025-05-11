// Script especial para restaurar etiquetas
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Configuración
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Obtener argumentos de línea de comandos
const backupDir = process.argv[2];
const targetBucket = process.argv[3];

if (!backupDir || !targetBucket) {
  console.error('Por favor proporciona el directorio de backup y el bucket de destino');
  console.error('Uso: node restore_tags.js <directorio-backup> <bucket-destino>');
  process.exit(1);
}

console.log(`Directorio de backup: ${backupDir}`);
console.log(`Bucket destino: ${targetBucket}`);

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log(`INICIANDO RESTAURACIÓN DE ETIQUETAS para bucket: ${targetBucket}`);
    
    // Archivos de etiquetas a buscar
    const tagFiles = [
      'tags-export.json',
      'tags-with-categories-export.json',
      'unique-categories-export.json'
    ];
    
    // Recopilar todas las etiquetas de todos los archivos
    let allTagsRaw = [];
    
    for (const tagFile of tagFiles) {
      const filePath = path.join(backupDir, tagFile);
      if (fs.existsSync(filePath)) {
        console.log(`Analizando etiquetas de: ${tagFile}`);
        
        try {
          const tagsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          // Si no es un array, intentar extraer array de algun subcampo
          const tagsArray = Array.isArray(tagsData) ? tagsData : 
                          (tagsData.tags && Array.isArray(tagsData.tags)) ? tagsData.tags : [];
          
          if (tagsArray.length > 0) {
            console.log(`Encontradas ${tagsArray.length} etiquetas en ${tagFile}`);
            allTagsRaw = [...allTagsRaw, ...tagsArray];
          }
        } catch (error) {
          console.error(`Error al procesar ${tagFile}:`, error);
        }
      } else {
        console.log(`Archivo ${tagFile} no encontrado en ${backupDir}`);
      }
    }
    
    console.log(`Total de ${allTagsRaw.length} etiquetas recopiladas de todos los archivos`);
    
    // Eliminar duplicados usando tag_name como clave
    const processedTagNames = new Set();
    const uniqueTags = [];
    
    for (const tag of allTagsRaw) {
      // Validar que sea una etiqueta con los campos necesarios
      if (!tag.tag_name) continue;
      
      // Crear una clave única basada en tag_name
      const key = tag.tag_name;
      
      // Si ya procesamos esta etiqueta, saltarla
      if (processedTagNames.has(key)) continue;
      
      // Marcar como procesada y crear una nueva versión con ID único
      processedTagNames.add(key);
      uniqueTags.push({
        ...tag,
        id: uuidv4(), // Generar ID completamente nuevo
        bucket: targetBucket // Asegurar que el bucket es correcto
      });
    }
    
    console.log(`Filtradas a ${uniqueTags.length} etiquetas únicas para el bucket ${targetBucket}`);
    
    // Primero, eliminar etiquetas existentes
    console.log(`Eliminando etiquetas existentes en el bucket ${targetBucket}...`);
    
    const { error: deleteError } = await supabase
      .from('tags_by_bucket')
      .delete()
      .eq('bucket', targetBucket);
    
    if (deleteError) {
      console.error('Error al eliminar etiquetas existentes:', deleteError);
    } else {
      console.log('Etiquetas existentes eliminadas con éxito');
    }
    
    // Insertar etiquetas una por una para minimizar errores
    console.log(`Insertando ${uniqueTags.length} etiquetas...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const tag of uniqueTags) {
      try {
        // Asegurar ID único para cada inserción
        const tagToInsert = {
          ...tag,
          id: uuidv4()
        };
        
        const { error } = await supabase
          .from('tags_by_bucket')
          .insert([tagToInsert]);
        
        if (error) {
          console.error(`Error al insertar etiqueta "${tag.tag_name}":`, error);
          errorCount++;
        } else {
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`Progreso: ${successCount}/${uniqueTags.length} etiquetas insertadas`);
          }
        }
      } catch (err) {
        console.error(`Error general al insertar etiqueta "${tag.tag_name}":`, err);
        errorCount++;
      }
      
      // Pequeña pausa para evitar sobrecargar la BD
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`Restauración de etiquetas completada: ${successCount} exitosas, ${errorCount} errores`);
    process.exit(0);
    
  } catch (error) {
    console.error('Error general en restauración de etiquetas:', error);
    process.exit(1);
  }
}

// Ejecutar función principal
main();