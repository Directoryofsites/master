import { getAuthToken } from './auth';

// services/api.js

const isDevelopment = process.env.NODE_ENV === 'development';

const isGitHubPages = window.location.hostname === 'directoryofsites.github.io' && window.location.pathname.startsWith('/master/');

// Agregar estos console.log para depuración
console.log('Hostname:', window.location.hostname);
console.log('Pathname:', window.location.pathname);
console.log('Is GitHub Pages:', isGitHubPages);

export const BASE_URL = isDevelopment 
  ? '/api' // Usará el proxy configurado en package.json en desarrollo
  : isGitHubPages 
    ? 'https://master-production-5386.up.railway.app/api' // URL explícita para GitHub Pages
    : 'https://master-production-5386.up.railway.app/api'; // URL de Railway en producción

// Función para obtener las cabeceras de autenticación
const getAuthHeaders = () => {
  try {
    // Usar la misma función getAuthToken que usamos en fetchWithRetry
    const token = getAuthToken(); 
    console.log('[API-DEBUG] getAuthHeaders - Token obtenido:', token);
    
    if (token) {
      return {
        'Authorization': `Bearer ${token}`
      };
    } else {
      console.log('[API-DEBUG] getAuthHeaders - No hay token disponible');
    }
  } catch (error) {
    console.error('[API-DEBUG] Error al obtener información de autenticación:', error);
  }
  
  return {};
};

// Función de utilidad para implementar reintentos en las llamadas API
const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
  let lastError;
  
  // Obtener el token de autorización
  const token = getAuthToken();

  // Para depuración, mostrar la información completa del token
  try {
    console.log('[API-DEBUG] Token obtenido de getAuthToken:', token);
    
    if (!token) {
      console.log('[API-DEBUG] No hay token disponible para la petición a:', url);
      console.log('[API-DEBUG] Estado de localStorage:', localStorage.getItem('user_session'));
    } else {
      const tokenData = JSON.parse(atob(token));
      console.log('[API-DEBUG] Token decodificado completo:', tokenData);
      console.log('[API-DEBUG] Enviando petición con token:', {
        username: tokenData.username || 'No disponible',
        role: tokenData.role || 'No disponible',
        bucket: tokenData.bucket || 'No disponible'
      });
      
      // Verificar que el token tiene todas las propiedades necesarias
      if (!tokenData.username) {
        console.error('[API-DEBUG] ERROR: Token sin username');
      }
      if (!tokenData.bucket) {
        console.error('[API-DEBUG] ERROR: Token sin bucket');
      }
      if (!tokenData.role) {
        console.error('[API-DEBUG] ERROR: Token sin role');
      }
    }
  } catch (error) {
    console.error('[API-DEBUG] Error al decodificar token para depuración:', error);
    console.error('[API-DEBUG] Token problemático:', token);
  }
  // Añadir el token a los headers si existe
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Intento ${attempt}/${maxRetries} para ${url}`);
      
      // Configurar un timeout más largo
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos de timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Error desconocido');
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      console.error(`Intento ${attempt} falló:`, error.message);
      
      // Si no es el último intento, esperar antes de reintentar
      if (attempt < maxRetries) {
        const delay = 1000 * attempt; // Espera exponencial: 1s, 2s, 3s
        console.log(`Esperando ${delay}ms antes de reintentar...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  throw lastError;
};

/**
 * Lista los archivos en la ruta especificada
 * @param {string} path - Ruta a listar
 * @returns {Promise<Array>} - Lista de archivos y carpetas
 */
export const listFiles = async (path = '') => {
  try {
    console.log(`Listando archivos en: ${path || 'raíz'}`);
    
    const url = `${BASE_URL}/files${path ? `?prefix=${encodeURIComponent(path)}` : ''}`;
    const response = await fetchWithRetry(url);
    
    const data = await response.json();
    console.log(`Listado exitoso: ${data.length} elementos encontrados`);
    return data;
  } catch (error) {
    console.error('Error en listFiles después de reintentos:', error);
    throw new Error('No se pudieron cargar los archivos');
  }
};

/**
 * Sube un archivo al servidor
 * @param {File} file - Archivo a subir
 * @param {string} path - Ruta donde subir el archivo
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const uploadFile = async (file, path = '') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', path);

  // Obtener el token de autorización
  const token = getAuthToken();
  const headers = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      throw new Error('No se pudo subir el archivo');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en uploadFile:', error);
    throw error;
  }
};

/**
 * Crea una carpeta en el servidor
 * @param {string} folderName - Nombre de la carpeta a crear
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const createFolder = async (folderName) => {
  try {
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/createFolder`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        folderName
      })
    });

    if (!response.ok) {
      throw new Error('No se pudo crear la carpeta');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en createFolder:', error);
    throw error;
  }
};

/**
 * Elimina un archivo o carpeta del servidor
 * @param {string} path - Ruta del elemento a eliminar
 * @param {boolean} isFolder - Indica si el elemento es una carpeta
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const deleteItem = async (path, isFolder = false) => {
  // Validar que la ruta no esté vacía
  if (!path) {
    throw new Error('Se requiere una ruta para eliminar el elemento');
  }
  
  console.log('Intentando eliminar:', path, 'Es carpeta:', isFolder);
  
  try {
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Para carpetas, usamos el endpoint mejorado deleteFolder con método DELETE
    if (isFolder) {
      const response = await fetch(`${BASE_URL}/deleteFolder?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}`);
      }
      
      return await response.json();
    } else {
      // Para archivos seguimos usando el endpoint delete existente
      const response = await fetch(`${BASE_URL}/delete?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}`);
      }
      
      return await response.json();
    }
  } catch (error) {
    console.error('Error al eliminar elemento:', error);
    throw error;
  }
};

/**
 * Obtiene la URL de visualización o descarga de un archivo
 * @param {string} path - Ruta del archivo
 * @param {boolean} forceDownload - Indica si se debe forzar la descarga
 * @returns {Promise<string>} - URL de visualización o descarga
 */

export const getDownloadUrl = async (path, forceDownload = false) => {
  try {
    // Verificar que la ruta no esté vacía
    if (!path) {
      throw new Error('Se requiere una ruta para obtener la URL');
    }
    
    // Determinar el tipo de archivo por su extensión
    const isPDF = path.toLowerCase().endsWith('.pdf');
    const isImage = /\.(jpe?g|png|gif|bmp|webp)$/i.test(path);
    const isDOCX = path.toLowerCase().endsWith('.docx');
    const isViewable = isPDF || isImage || isDOCX;
    
    console.log('¿Es un archivo visualizable?', isViewable);
    
    // Obtener el token de autenticación
    const token = getAuthToken();
    
    // Construir la URL con parámetros
    let url = `${BASE_URL}/download?path=${encodeURIComponent(path)}`;
    
    // Añadir parámetro de visualización si es necesario
    if (isViewable && !forceDownload) {
      url += '&view=true';
    }
    
    // Añadir el token como parámetro de query para asegurar que se use incluso en redirecciones
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    
    console.log('URL de descarga con token:', url);
    
    // Realizar la solicitud
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('No se pudo obtener la URL del archivo');
    }
    
    // Obtener la URL pública del archivo
    const data = await response.json();
    
    if (!data.success || !data.publicUrl) {
      throw new Error('No se pudo generar la URL del archivo');
    }
    
    // Retornar la URL pública
    return data.publicUrl;
  } catch (error) {
    console.error('Error en getDownloadUrl:', error);
    throw error;
  }
};

/**
 * Busca archivos o carpetas cuyos nombres coincidan con el criterio de búsqueda
 * @param {string} searchTerm - Término de búsqueda
 * @returns {Promise<Array>} - Lista de archivos y carpetas que coinciden
 */

export const searchFiles = async (searchTerm) => {
  try {
    // Verificar que el término de búsqueda no esté vacío
    if (!searchTerm || !searchTerm.trim()) {
      throw new Error('Se requiere un término de búsqueda');
    }
    
    console.log('Realizando búsqueda de:', searchTerm);
    
    // Obtener el token de autenticación
    const token = getAuthToken();
    
    // Construir la URL con el término de búsqueda
    let url = `${BASE_URL}/search?term=${encodeURIComponent(searchTerm.trim())}`;
    
    // Añadir el token como parámetro de query para asegurar que se use el bucket correcto
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    
    console.log('URL de búsqueda con token:', url);
    
    // Realizar la solicitud
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en searchFiles:', error);
    throw error;
  }
};

/**
 * Busca archivos por etiqueta (tag)
 * @param {string} tagSearch - Etiqueta a buscar
 * @returns {Promise<Array>} - Lista de archivos que contienen la etiqueta
 */

export const searchFilesByTag = async (tagSearch) => {
  try {
    console.log('INICIANDO búsqueda por etiqueta:', tagSearch);
    
    // Verificar que el término de búsqueda no esté vacío
    if (!tagSearch || !tagSearch.trim()) {
      throw new Error('Se requiere una etiqueta para la búsqueda');
    }
    
    // Obtener el token de autenticación
    const token = getAuthToken();
    
    // Construir la URL con el término de búsqueda
    let url = `${BASE_URL}/search-by-tags?tag=${encodeURIComponent(tagSearch.trim())}`;
    
    // Añadir el token como parámetro de query para asegurar que se use el bucket correcto
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    
    console.log('URL exacta de búsqueda por etiqueta:', url);
    
    console.log('Enviando solicitud al endpoint de búsqueda por etiquetas...');
    const startTime = new Date().getTime();
    
    // Realizar la solicitud
    const response = await fetch(url);
    
    const endTime = new Date().getTime();
    console.log(`La solicitud tardó ${endTime - startTime} ms en completarse`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Se encontraron ${data.length} resultados desde el servidor`);
    
    return data;
  } catch (error) {
    console.error('Error en searchFilesByTag:', error);
    throw error;
  }
};

/**
 * Busca archivos por fecha
 * @param {string} dateValue - Valor de fecha a buscar
 * @param {string} searchType - Tipo de búsqueda: 'specific', 'month', o 'year'
 * @returns {Promise<Array>} - Lista de archivos que coinciden con la fecha
 */
export const searchFilesByDate = async (dateValue, searchType = 'specific') => {
  try {
    console.log(`INICIANDO búsqueda por fecha: ${dateValue}, tipo: ${searchType}`);
    
    // Verificar que el valor de fecha no esté vacío
    if (!dateValue || !dateValue.trim()) {
      throw new Error('Se requiere una fecha para la búsqueda');
    }
    
    // Obtener el token de autenticación
    const token = getAuthToken();
    
    // Construir la URL con los parámetros de búsqueda
    let url = `${BASE_URL}/search-by-date?date=${encodeURIComponent(dateValue.trim())}&type=${encodeURIComponent(searchType)}`;
    
    // Añadir el token como parámetro de query para asegurar que se use el bucket correcto
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    
    console.log('URL exacta de búsqueda por fecha:', url);
    console.log('Enviando solicitud al endpoint de búsqueda por fecha...');
    const startTime = new Date().getTime();
    
    // Realizar la solicitud
    const response = await fetch(url);
    
    const endTime = new Date().getTime();
    console.log(`La solicitud tardó ${endTime - startTime} ms en completarse`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Se encontraron ${data.length} resultados desde el servidor`);
    
    return data;
  } catch (error) {
    console.error('Error en searchFilesByDate:', error);
    throw error;
  }
};

/**
 * Busca archivos que coincidan con una etiqueta y una fecha simultáneamente
 * @param {string} tagValue - Etiqueta a buscar
 * @param {string} dateValue - Valor de fecha a buscar
 * @param {string} dateType - Tipo de búsqueda de fecha: 'specific', 'month', o 'year'
 * @returns {Promise<Array>} - Lista de archivos que coinciden con ambos criterios
 */
export const searchFilesCombined = async (tagValue, dateValue, dateType = 'specific') => {
  try {
    console.log(`INICIANDO búsqueda combinada: etiqueta: ${tagValue}, fecha: ${dateValue}, tipo: ${dateType}`);
    
    // Verificar que ambos valores no estén vacíos
    if (!tagValue || !tagValue.trim()) {
      throw new Error('Se requiere una etiqueta para la búsqueda combinada');
    }
    
    if (!dateValue || !dateValue.trim()) {
      throw new Error('Se requiere una fecha para la búsqueda combinada');
    }
    
    // Obtener el token de autenticación
    const token = getAuthToken();
    
    // Construir la URL con los parámetros de búsqueda
    let url = `${BASE_URL}/search-combined?tag=${encodeURIComponent(tagValue.trim())}&date=${encodeURIComponent(dateValue.trim())}&dateType=${encodeURIComponent(dateType)}`;
    
    // Añadir el token como parámetro de query para asegurar que se use el bucket correcto
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    
    console.log('URL exacta de búsqueda combinada:', url);
    console.log('Enviando solicitud al endpoint de búsqueda combinada...');
    const startTime = new Date().getTime();
    
    // Realizar la solicitud
    const response = await fetch(url);
    
    const endTime = new Date().getTime();
    console.log(`La solicitud tardó ${endTime - startTime} ms en completarse`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Se encontraron ${data.length} resultados desde el servidor`);
    
    return data;
  } catch (error) {
    console.error('Error en searchFilesCombined:', error);
    throw error;
  }
};

/**
 * Busca archivos que coincidan con múltiples etiquetas simultáneamente
 * @param {string|Array} tags - Etiqueta(s) a buscar, puede ser un string con etiquetas separadas por comas o un array
 * @returns {Promise<Array>} - Lista de archivos que coinciden con todas las etiquetas especificadas
 */
export const searchFilesByMultipleTags = async (tags) => {
  try {
    console.log('INICIANDO búsqueda por múltiples etiquetas:', tags);
    
    // Verificar que el parámetro no esté vacío
    if (!tags) {
      throw new Error('Se requiere al menos una etiqueta para la búsqueda');
    }
    
    // Manejar tanto string (formato "tag1,tag2,tag3") como arrays de etiquetas
    let tagsParam;
    if (Array.isArray(tags)) {
      tagsParam = tags.join(',');
    } else {
      tagsParam = tags;
    }
    
    // Verificar que no esté vacío después de procesar
    if (!tagsParam.trim()) {
      throw new Error('Se requiere al menos una etiqueta para la búsqueda');
    }
    
    // Obtener el token de autenticación
    const token = getAuthToken();
    
    // Construir la URL con el parámetro de etiquetas
    let url = `${BASE_URL}/search-by-multiple-tags?tags=${encodeURIComponent(tagsParam.trim())}`;
    
    // Añadir el token como parámetro de query para asegurar que se use el bucket correcto
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    
    console.log('URL exacta de búsqueda por múltiples etiquetas:', url);
    console.log('Enviando solicitud al endpoint de búsqueda por múltiples etiquetas...');
    const startTime = new Date().getTime();
    
    // Realizar la solicitud
    const response = await fetch(url);
    
    const endTime = new Date().getTime();
    console.log(`La solicitud tardó ${endTime - startTime} ms en completarse`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Se encontraron ${data.length} resultados desde el servidor para la búsqueda con múltiples etiquetas`);
    
    return data;
  } catch (error) {
    console.error('Error en searchFilesByMultipleTags:', error);
    throw error;
  }
};

/**
 * Busca archivos que coincidan con múltiples etiquetas y una fecha simultáneamente
 * @param {string|Array} tags - Etiqueta(s) a buscar, puede ser un string con etiquetas separadas por comas o un array
 * @param {string} dateValue - Valor de fecha a buscar
 * @param {string} dateType - Tipo de búsqueda de fecha: 'specific', 'month', o 'year'
 * @returns {Promise<Array>} - Lista de archivos que coinciden con todos los criterios
 */
export const searchMultipleTagsWithDate = async (tags, dateValue, dateType = 'specific') => {
  try {
    console.log(`INICIANDO búsqueda combinada de múltiples etiquetas y fecha: tags=${tags}, fecha=${dateValue}, tipo=${dateType}`);
    
    // Verificar que los parámetros no estén vacíos
    if (!tags) {
      throw new Error('Se requiere al menos una etiqueta para la búsqueda');
    }
    
    if (!dateValue || !dateValue.trim()) {
      throw new Error('Se requiere una fecha para la búsqueda combinada');
    }
    
    // Manejar tanto string (formato "tag1,tag2,tag3") como arrays de etiquetas
    let tagsParam;
    if (Array.isArray(tags)) {
      tagsParam = tags.join(',');
    } else {
      tagsParam = tags;
    }
    
    // Verificar que no esté vacío después de procesar
    if (!tagsParam.trim()) {
      throw new Error('Se requiere al menos una etiqueta para la búsqueda');
    }
    
    // Obtener el token de autenticación
    const token = getAuthToken();
    
    // Construir la URL con los parámetros de búsqueda
    let url = `${BASE_URL}/search-multiple-tags-with-date?tags=${encodeURIComponent(tagsParam.trim())}&date=${encodeURIComponent(dateValue.trim())}&dateType=${encodeURIComponent(dateType)}`;
    
    // Añadir el token como parámetro de query para asegurar que se use el bucket correcto
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    
    console.log('URL exacta de búsqueda combinada de múltiples etiquetas y fecha:', url);
    console.log('Enviando solicitud al endpoint de búsqueda combinada...');
    const startTime = new Date().getTime();
    
    // Realizar la solicitud
    const response = await fetch(url);
    
    const endTime = new Date().getTime();
    console.log(`La solicitud tardó ${endTime - startTime} ms en completarse`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Se encontraron ${data.length} resultados desde el servidor para la búsqueda combinada`);
    
    return data;
  } catch (error) {
    console.error('Error en searchMultipleTagsWithDate:', error);
    throw error;
  }
};

/**
 * Busca archivos que coincidan con un texto y una fecha simultáneamente
 * @param {string} searchText - Texto a buscar en los nombres de archivos
 * @param {string} dateValue - Valor de fecha a buscar
 * @param {string} dateType - Tipo de búsqueda de fecha: 'specific', 'month', o 'year'
 * @returns {Promise<Array>} - Lista de archivos que coinciden con ambos criterios
 */
export const searchTextWithDate = async (searchText, dateValue, dateType = 'specific') => {
  try {
    console.log(`INICIANDO búsqueda de texto con fecha: texto: ${searchText}, fecha: ${dateValue}, tipo: ${dateType}`);
    
    // Verificar que los valores no estén vacíos
    if (!searchText || !searchText.trim()) {
      throw new Error('Se requiere un texto para la búsqueda combinada');
    }
    
    if (!dateValue || !dateValue.trim()) {
      throw new Error('Se requiere una fecha para la búsqueda combinada');
    }
    
    // Obtener el token de autenticación
    const token = getAuthToken();
    
    // Construir la URL con los parámetros de búsqueda
    let url = `${BASE_URL}/search-text-with-date?text=${encodeURIComponent(searchText.trim())}&date=${encodeURIComponent(dateValue.trim())}&dateType=${encodeURIComponent(dateType)}`;
    
    // Añadir el token como parámetro de query para asegurar que se use el bucket correcto
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    
    console.log('URL exacta de búsqueda de texto con fecha:', url);
    console.log('Enviando solicitud al endpoint de búsqueda de texto con fecha...');
    const startTime = new Date().getTime();
    
    // Realizar la solicitud
    const response = await fetch(url);
    
    const endTime = new Date().getTime();
    console.log(`La solicitud tardó ${endTime - startTime} ms en completarse`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Se encontraron ${data.length} resultados desde el servidor`);
    
    return data;
  } catch (error) {
    console.error('Error en searchTextWithDate:', error);
    throw error;
  }
};

/**
 * Obtiene la URL de YouTube asociada a un archivo
 * @param {string} path - Ruta del archivo
 * @returns {Promise<string|null>} - URL de YouTube o null si no hay ninguna
 */
export const getYoutubeUrl = async (path) => {
  try {
    // Verificar que la ruta no esté vacía
    if (!path) {
      throw new Error('Se requiere una ruta para obtener la URL de YouTube');
    }

    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/youtube-url?path=${encodeURIComponent(path)}`, {
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error('No se pudo obtener la URL de YouTube');
    }

    const data = await response.json();
    return data.youtubeUrl;
  } catch (error) {
    console.error('Error en getYoutubeUrl:', error);
    throw error;
  }
};

/**
 * Guarda o elimina la URL de YouTube asociada a un archivo
 * @param {string} path - Ruta del archivo
 * @param {string|null} youtubeUrl - URL de YouTube a guardar, o null para eliminar
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const saveYoutubeUrl = async (path, youtubeUrl) => {
  try {
    // Verificar que la ruta no esté vacía
    if (!path) {
      throw new Error('Se requiere una ruta para guardar la URL de YouTube');
    }
    
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/youtube-url`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        filePath: path,
        youtubeUrl: youtubeUrl
      })
    });
    
    if (!response.ok) {
      throw new Error('No se pudo guardar la URL de YouTube');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en saveYoutubeUrl:', error);
    throw error;
  }
};

/**
 * Obtiene la URL de audio asociada a un archivo
 * @param {string} path - Ruta del archivo
 * @returns {Promise<string|null>} - URL de audio o null si no hay ninguna
 */
export const getAudioUrl = async (path) => {
  try {
    // Verificar que la ruta no esté vacía
    if (!path) {
      throw new Error('Se requiere una ruta para obtener la URL de audio');
    }

    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/audio-url?path=${encodeURIComponent(path)}`, {
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error('No se pudo obtener la URL de audio');
    }

    const data = await response.json();
    return data.audioUrl;
  } catch (error) {
    console.error('Error en getAudioUrl:', error);
    throw error;
  }
};

/**
 * Guarda o elimina la URL de audio asociada a un archivo
 * @param {string} path - Ruta del archivo
 * @param {string|null} audioUrl - URL de audio a guardar, o null para eliminar
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const saveAudioUrl = async (path, audioUrl) => {
  try {
    // Verificar que la ruta no esté vacía
    if (!path) {
      throw new Error('Se requiere una ruta para guardar la URL de audio');
    }

    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/audio-url`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        filePath: path,
        audioUrl: audioUrl
      })
    });
    
    if (!response.ok) {
      throw new Error('No se pudo guardar la URL de audio');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en saveAudioUrl:', error);
    throw error;
  }
};

/**
 * Obtiene la URL de imagen asociada a un archivo
 * @param {string} path - Ruta del archivo
 * @returns {Promise<string|null>} - URL de imagen o null si no hay ninguna
 */
export const getImageUrl = async (path) => {
  try {
    // Verificar que la ruta no esté vacía
    if (!path) {
      throw new Error('Se requiere una ruta para obtener la URL de imagen');
    }

    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/image-url?path=${encodeURIComponent(path)}`, {
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error('No se pudo obtener la URL de imagen');
    }

    const data = await response.json();
    return data.imageUrl;
  } catch (error) {
    console.error('Error en getImageUrl:', error);
    throw error;
  }
};

/**
 * Guarda o elimina la URL de imagen asociada a un archivo
 * @param {string} path - Ruta del archivo
 * @param {string|null} imageUrl - URL de imagen a guardar, o null para eliminar
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const saveImageUrl = async (path, imageUrl) => {
  try {
    // Verificar que la ruta no esté vacía
    if (!path) {
      throw new Error('Se requiere una ruta para guardar la URL de imagen');
    }
    
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/image-url`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        filePath: path,
        imageUrl: imageUrl
      })
    });
    
    if (!response.ok) {
      throw new Error('No se pudo guardar la URL de imagen');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en saveImageUrl:', error);
    throw error;
  }
};

/**
 * Obtiene la URL para visualizar un documento DOCX como HTML
 * @param {string} path - Ruta del archivo DOCX
 * @returns {Promise<string>} - URL para visualizar el documento como HTML
 */
export const viewDocx = async (path) => {
  try {
    // Verificar que la ruta no esté vacía
    if (!path) {
      throw new Error('Se requiere una ruta para visualizar el documento');
    }
    
    // Verificar que sea un archivo DOCX
    if (!path.toLowerCase().endsWith('.docx')) {
      throw new Error('Esta función solo es para archivos DOCX');
    }
    
    console.log('Obteniendo visualización para DOCX:', path);
    
    // Obtener el token de autorización
    const token = getAuthToken();
    
    // Ahora vamos a crear una URL directa al endpoint view-docx
    // usando el path del documento y el token
    const viewUrl = `${BASE_URL}/view-docx?path=${encodeURIComponent(path)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    
    console.log('URL construida para visualizar DOCX:', viewUrl);
    
    return viewUrl;
  } catch (error) {
    console.error('Error en viewDocx:', error);
    throw error;
  }
};

/**
 * Obtiene la lista de usuarios dinámicos del sistema
 * @returns {Promise<Array>} - Lista de usuarios
 */
export const getUsers = async () => {
  try {
    const token = getAuthToken();
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/admin/users`, {
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error('Error al obtener usuarios');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en getUsers:', error);
    throw error;
  }
};

/**
 * Crea un nuevo usuario en el sistema
 * @param {Object} userData - Datos del usuario a crear
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const createUser = async (userData) => {
  try {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/admin/create-user`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      throw new Error('Error al crear usuario');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en createUser:', error);
    throw error;
  }
};

/**
 * Actualiza un usuario existente
 * @param {string|number} userId - ID del usuario a actualizar
 * @param {Object} userData - Nuevos datos del usuario
 * @returns {Promise<Object>} - Respuesta del servidor
 */

export const updateUser = async (userId, userData) => {
  try {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Añadir log para depurar los datos que se están enviando
    console.log('[API] updateUser - Datos enviados al servidor:', JSON.stringify(userData, null, 2));
    
    // Verificar si hay permisos administrativos en el objeto
    if (userData.assigned_folders) {
      const hasPermissionsObj = userData.assigned_folders.some(
        folder => typeof folder === 'object' && folder.type === 'admin_permissions'
      );
      console.log('[API] updateUser - Objeto de permisos detectado:', hasPermissionsObj);
    }

    const response = await fetch(`${BASE_URL}/admin/update-user/${userId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Error al actualizar usuario:', errorText);
      throw new Error(`Error al actualizar usuario: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('[API] updateUser - Respuesta del servidor:', JSON.stringify(responseData, null, 2));
    return responseData;

  } catch (error) {
    console.error('Error en updateUser:', error);
    throw error;
  }
};

/**
 * Elimina o desactiva un usuario
 * @param {string|number} userId - ID del usuario a eliminar/desactivar
 * @param {boolean} permanent - Si es true, elimina permanentemente el usuario, si es false, solo lo desactiva
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const deleteUser = async (userId, permanent = false) => {
  try {
    const token = getAuthToken();
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Añadir parámetro para indicar eliminación permanente
    const url = `${BASE_URL}/admin/delete-user/${userId}${permanent ? '?permanent=true' : ''}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error('Error al eliminar usuario');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en deleteUser:', error);
    throw error;
  }
};
/**
 * Obtiene los permisos de carpeta para una ruta específica
 * @param {string} folderPath - Ruta de la carpeta
 * @returns {Promise<Object>} - Permisos de la carpeta
 */
export const getFolderPermissions = async (folderPath) => {
  try {
    const token = getAuthToken();
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/admin/folder-permissions?path=${encodeURIComponent(folderPath)}`, {
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error('Error al obtener permisos de carpeta');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en getFolderPermissions:', error);
    throw error;
  }
};

/**
 * Actualiza los permisos de una carpeta
 * @param {string} folderPath - Ruta de la carpeta
 * @param {Array} permissions - Arreglo de permisos a asignar
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const updateFolderPermissions = async (folderPath, permissions) => {
  try {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/admin/folder-permissions`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        folderPath,
        permissions
      })
    });
    
    if (!response.ok) {
      throw new Error('Error al actualizar permisos de carpeta');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en updateFolderPermissions:', error);
    throw error;
  }
};

/**
 * Obtiene los metadatos de un archivo
 * @param {string} path - Ruta del archivo
 * @returns {Promise<Object>} - Metadatos del archivo
 */
export const getFileMetadata = async (path) => {
  try {
    // Verificar que la ruta no esté vacía
    if (!path) {
      throw new Error('Se requiere una ruta para obtener los metadatos');
    }
    
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/file-metadata?path=${encodeURIComponent(path)}`, {
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error('No se pudo obtener los metadatos del archivo');
    }

    const data = await response.json();
    return data.metadata;
  } catch (error) {
    console.error('Error en getFileMetadata:', error);
    throw error;
  }
};

/**
 * Actualiza los metadatos de un archivo
 * @param {string} path - Ruta del archivo
 * @param {Object} metadata - Metadatos actualizados
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const updateFileMetadata = async (path, metadata) => {
  try {
    // Verificar que la ruta no esté vacía
    if (!path) {
      throw new Error('Se requiere una ruta para actualizar los metadatos');
    }
    
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/file-metadata`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        filePath: path,
        metadata: metadata
      })
    });
    
    if (!response.ok) {
      throw new Error('No se pudo actualizar los metadatos del archivo');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en updateFileMetadata:', error);
    throw error;
  }
};

/**
 * Obtiene todas las etiquetas disponibles para el bucket del usuario actual
 * @returns {Promise<Object>} - Etiquetas del bucket
 */
export const getTags = async () => {
  try {
    // Obtener el token de autenticación
    const token = getAuthToken();
    
    // Construir la URL para obtener etiquetas
    let url = `${BASE_URL}/tags`;
    
    // Añadir el token como parámetro de query para asegurar que se use el bucket correcto
    if (token) {
      url += `?token=${encodeURIComponent(token)}`;
    }
    
    console.log('Obteniendo etiquetas del servidor...');
    
    // Realizar la solicitud
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Obtenidas ${data.tags?.length || 0} etiquetas del servidor`);
    
    return data;
  } catch (error) {
    console.error('Error en getTags:', error);
    throw error;
  }
};

/**
 * Obtiene categorías de etiquetas disponibles para el bucket del usuario actual
 * @returns {Promise<Array>} - Lista de categorías
 */
export const getTagCategories = async () => {
  try {
    // Obtener el token de autenticación
    const token = getAuthToken();
    
    // Construir la URL para obtener categorías
    let url = `${BASE_URL}/tags/categories`;
    
    // Añadir el token como parámetro de query para asegurar que se use el bucket correcto
    if (token) {
      url += `?token=${encodeURIComponent(token)}`;
    }
    
    console.log('Obteniendo categorías de etiquetas...');
    
    // Realizar la solicitud
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Obtenidas ${data.categories?.length || 0} categorías de etiquetas`);
    
    return data.categories || [];
  } catch (error) {
    console.error('Error en getTagCategories:', error);
    throw error;
  }
};

/**
 * Crea una nueva etiqueta
 * @param {string} tagName - Nombre de la etiqueta
 * @param {string} category - Categoría a la que pertenece la etiqueta
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const createTag = async (tagName, category) => {
  try {
    if (!tagName || !category) {
      throw new Error('Se requiere nombre de etiqueta y categoría');
    }
    
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log(`Creando etiqueta "${tagName}" en categoría "${category}"`);
    
    const response = await fetch(`${BASE_URL}/tags`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        tag_name: tagName,
        category: category
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en createTag:', error);
    throw error;
  }
};

/**
 * Elimina una etiqueta
 * @param {string} tagId - ID de la etiqueta a eliminar
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const deleteTag = async (tagId) => {
  try {
    if (!tagId) {
      throw new Error('Se requiere ID de etiqueta');
    }
    
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log(`Eliminando etiqueta con ID: ${tagId}`);
    
    const response = await fetch(`${BASE_URL}/tags/${tagId}`, {
      method: 'DELETE',
      headers: headers
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en deleteTag:', error);
    throw error;
  }
};

/**
 * Crea una nueva categoría de etiquetas
 * @param {string} categoryName - Nombre de la categoría
 * @param {Array} [initialTags] - Lista de etiquetas iniciales (opcional)
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const createTagCategory = async (categoryName, initialTags = []) => {
  try {
    if (!categoryName) {
      throw new Error('Se requiere nombre de categoría');
    }
    
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log(`Creando categoría "${categoryName}" con ${initialTags.length} etiquetas iniciales`);
    
    const response = await fetch(`${BASE_URL}/tags/categories`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        category_name: categoryName,
        tags: initialTags
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    return await response.json();

  } catch (error) {
    console.error('Error en createTagCategory:', error);
    throw error;
  }
};

/**
 * Genera una copia de seguridad de todos los archivos en el bucket del usuario
 * @param {string} bucketName - Nombre del bucket a respaldar
 * @returns {Promise<Object>} - Respuesta con la URL de descarga del archivo comprimido
 */
export const generateBackup = async (bucketName) => {
  try {
    if (!bucketName) {
      throw new Error('Se requiere el nombre del bucket para generar la copia de seguridad');
    }
    
    console.log(`Iniciando copia de seguridad para el bucket: ${bucketName}`);
    
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Llamar al endpoint de backup
    const response = await fetch(`${BASE_URL}/admin/generate-backup`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        bucket: bucketName
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status} al generar la copia de seguridad`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en generateBackup:', error);
    throw error;
  }
};

/**
 * Genera y descarga directamente una copia de seguridad usando el diálogo nativo del navegador
 * @param {string} bucketName - Nombre del bucket a respaldar
 * @returns {Promise<void>} - No retorna datos, inicia la descarga directamente
 */
export const generateBackupDirect = async (bucketName) => {
  try {
    if (!bucketName) {
      throw new Error('Se requiere el nombre del bucket para generar la copia de seguridad');
    }
    
    console.log(`Iniciando copia de seguridad directa para el bucket: ${bucketName}`);
    
    // Obtener el token de autorización
    const token = getAuthToken();
    
    // Construir la URL con el parámetro del bucket
    let url = `${BASE_URL}/admin/backup-direct?bucket=${encodeURIComponent(bucketName)}`;
    
    // Añadir el token como parámetro de URL para autenticación
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    
    // Crear un elemento <a> temporal para iniciar la descarga
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `backup-${bucketName}-${new Date().toISOString().slice(0, 10)}.zip`;
    
    // Añadir el enlace al DOM, hacer clic y eliminarlo
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    return { success: true };
  } catch (error) {
    console.error('Error en generateBackupDirect:', error);
    throw error;
  }
};

/**
 * Copia un archivo para crear un duplicado
 * @param {string} sourcePath - Ruta del archivo original
 * @param {string} targetPath - Ruta de destino para la copia (solo se usa para extraer el nombre)
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const copyFile = async (sourcePath, targetPath) => {
  try {
    // Verificar que las rutas no estén vacías
    if (!sourcePath) {
      throw new Error('Se requiere la ruta del archivo a duplicar');
    }
    
    console.log(`Duplicando archivo: ${sourcePath}`);
    
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Llamar al endpoint de duplicación de archivos
    const response = await fetch(`${BASE_URL}/duplicate-file`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        filePath: sourcePath  // El backend espera exactamente este nombre
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status} al duplicar el archivo`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en copyFile:', error);
    throw error;
  }
};

/**
 * Renombra un archivo o carpeta
 * @param {string} sourcePath - Ruta actual del elemento
 * @param {string} targetPath - Nueva ruta con el nuevo nombre
 * @param {boolean} isFolder - Indica si es una carpeta
 * @returns {Promise<Object>} - Respuesta del servidor
 */
export const renameItem = async (sourcePath, targetPath, isFolder = false) => {
  try {
    // Verificar que las rutas no estén vacías
    if (!sourcePath || !targetPath) {
      throw new Error('Se requieren las rutas de origen y destino para renombrar el elemento');
    }
    
    console.log(`Renombrando ${isFolder ? 'carpeta' : 'archivo'} de ${sourcePath} a ${targetPath}`);
    
    // Obtener el token de autorización
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Extraer el nuevo nombre del archivo o carpeta (última parte de la ruta de destino)
    const newName = targetPath.split('/').pop();
    
    // Determinar el endpoint correcto según si es carpeta o archivo
    const endpoint = isFolder ? 'rename-folder' : 'rename-file';
    
    // Llamar al endpoint con los parámetros correctos según el backend
    const response = await fetch(`${BASE_URL}/${endpoint}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({
        oldPath: sourcePath,  // El backend espera exactamente este nombre
        newName: newName      // El backend espera exactamente este nombre
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status} al renombrar el elemento`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en renameItem:', error);
    throw error;
  }
};

