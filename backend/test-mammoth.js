require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const mammoth = require('mammoth');
const fs = require('fs');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const bucketName = process.env.BUCKET_NAME;

console.log('Iniciando prueba de mammoth.js');
console.log('SUPABASE_URL:', supabaseUrl);
console.log('BUCKET_NAME:', bucketName);
console.log('Supabase Key configurada:', !!supabaseKey);

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function testMammoth() {
  try {
    // Ruta del documento DOCX (ajusta esto a un archivo real en tu bucket)
    const docxPath = 'ruta/a/tu/documento.docx';
    
    console.log(`Descargando documento: ${docxPath}`);
    
    // Descargar el archivo DOCX de Supabase
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(docxPath);
    
    if (error) {
      throw new Error(`Error al descargar archivo: ${JSON.stringify(error)}`);
    }
    
    if (!data) {
      throw new Error('No se recibieron datos del archivo');
    }
    
    console.log('Archivo descargado correctamente');
    console.log('Tipo de datos:', typeof data);
    
    // Convertir a Buffer
    const buffer = Buffer.from(await data.arrayBuffer());
    console.log('Buffer creado, tamaño:', buffer.length);
    
    // Intentar convertir con mammoth
    console.log('Iniciando conversión con mammoth...');
    const result = await mammoth.convertToHtml({ buffer });
    
    console.log('Conversión exitosa!');
    console.log('Longitud del HTML generado:', result.value.length);
    
    // Escribir el resultado en un archivo para verificar
    fs.writeFileSync('resultado.html', result.value);
    console.log('Resultado guardado en "resultado.html"');
    
    return 'Prueba completada con éxito';
  } catch (error) {
    console.error('ERROR EN LA PRUEBA:', error);
    console.error('Stack trace:', error.stack);
    return `Prueba fallida: ${error.message}`;
  }
}

// Ejecutar la prueba
testMammoth()
  .then(console.log)
  .catch(console.error)
  .finally(() => console.log('Prueba finalizada'));