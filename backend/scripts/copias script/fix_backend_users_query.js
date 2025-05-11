// fix_backend_users_query.js
const fs = require('fs');
const path = require('path');

// Ruta al archivo server.js
const serverPath = path.join(__dirname, '..', 'server.js');

// Leer el archivo server.js
console.log('Leyendo archivo server.js...');
let serverCode = fs.readFileSync(serverPath, 'utf8');

// Buscar la ruta o endpoint que maneja la obtención de usuarios
// Este patrón busca una ruta como app.get('/api/users', async (req, res) => {...
const userEndpointPattern = /app\.get\(['"]\/api\/users['"].*?\{([\s\S]*?)\}\);/;
const userEndpointMatch = serverCode.match(userEndpointPattern);

if (!userEndpointMatch) {
  console.error('No se encontró el endpoint de usuarios en server.js');
  process.exit(1);
}

console.log('Endpoint de usuarios encontrado');

// Analizar el código del endpoint
const endpointCode = userEndpointMatch[0];
const endpointBody = userEndpointMatch[1];

// Verificar si incluye una referencia al bucket
if (endpointBody.includes('bucket')) {
  console.log('El endpoint ya incluye referencia al bucket:');
  console.log(endpointBody.substring(endpointBody.indexOf('bucket'), endpointBody.indexOf('bucket') + 50));
  
  // Verificar si el código está filtrando correctamente los usuarios por bucket
  if (endpointBody.includes('.eq(\'bucket\'')) {
    console.log('El endpoint ya filtra correctamente por bucket');
  } else {
    console.log('El endpoint menciona bucket pero no parece filtrar correctamente');
    
    // Buscar la consulta a la base de datos
    const queryPattern = /from\(['"]user_accounts['"].*?\)([\s\S]*?)select\(/;
    const queryMatch = endpointBody.match(queryPattern);
    
    if (queryMatch) {
      // Modificar la consulta para agregar el filtro de bucket
      console.log('Modificando consulta para agregar filtro de bucket...');
      
      // Copia de seguridad del archivo original
      fs.writeFileSync(`${serverPath}.backup`, serverCode);
      console.log(`Copia de seguridad creada en ${serverPath}.backup`);
      
      // Reemplazar la consulta para incluir el filtro de bucket explícito
      const newQuery = queryMatch[0] + `.eq('bucket', req.query.bucket || req.user.bucket) `;
      const modifiedCode = endpointBody.replace(queryMatch[0], newQuery);
      
      // Reemplazar el cuerpo del endpoint en el código del servidor
      const newServerCode = serverCode.replace(endpointBody, modifiedCode);
      
      // Guardar el archivo modificado
      fs.writeFileSync(serverPath, newServerCode);
      console.log('Archivo server.js modificado correctamente');
    } else {
      console.error('No se pudo identificar la consulta a la base de datos');
    }
  }
} else {
  console.log('El endpoint no incluye referencia al bucket, agregando filtro...');
  
  // Buscar la consulta a la base de datos
  const queryPattern = /from\(['"]user_accounts['"].*?\)([\s\S]*?)select\(/;
  const queryMatch = endpointBody.match(queryPattern);
  
  if (queryMatch) {
    // Copia de seguridad del archivo original
    fs.writeFileSync(`${serverPath}.backup`, serverCode);
    console.log(`Copia de seguridad creada en ${serverPath}.backup`);
    
    // Reemplazar la consulta para incluir el filtro de bucket
    const newQuery = queryMatch[0] + `.eq('bucket', req.query.bucket || req.user.bucket) `;
    const modifiedCode = endpointBody.replace(queryMatch[0], newQuery);
    
    // Reemplazar el cuerpo del endpoint en el código del servidor
    const newServerCode = serverCode.replace(endpointBody, modifiedCode);
    
    // Guardar el archivo modificado
    fs.writeFileSync(serverPath, newServerCode);
    console.log('Archivo server.js modificado correctamente');
  } else {
    console.error('No se pudo identificar la consulta a la base de datos');
  }
}

console.log('Proceso completado. Reinicia el servidor para aplicar los cambios.');