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