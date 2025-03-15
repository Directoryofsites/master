// services/api.js
const isDevelopment = process.env.NODE_ENV === 'development';
export const BASE_URL = isDevelopment 
  ? '/api' // Usará el proxy configurado en package.json en desarrollo
  : 'https://contenedor-production-3606.up.railway.app/api'; // URL de Railway en producción

/**
 * Lista los archivos en la ruta especificada
 * @param {string} path - Ruta a listar
 * @returns {Promise<Array>} - Lista de archivos y carpetas
 */
export const listFiles = async (path = '') => {
  try {
    const response = await fetch(`${BASE_URL}/files${path ? `?prefix=${path}` : ''}`);
    
    if (!response.ok) {
      throw new Error('No se pudieron cargar los archivos');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en listFiles:', error);
    throw error;
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

  try {
    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
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
    const response = await fetch(`${BASE_URL}/createFolder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
    // Para carpetas, usamos el endpoint mejorado deleteFolder con método DELETE
    if (isFolder) {
      const response = await fetch(`${BASE_URL}/deleteFolder?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}`);
      }
      
      return await response.json();
    } else {
      // Para archivos seguimos usando el endpoint delete existente
      const response = await fetch(`${BASE_URL}/delete?path=${encodeURIComponent(path)}`, {
        method: 'DELETE'
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
    const isViewable = isPDF || isImage;
    
    console.log('¿Es un archivo visualizable?', isViewable);
    
    // Solicitar la URL con el parámetro view si es un archivo visualizable
    const response = await fetch(`${BASE_URL}/download?path=${encodeURIComponent(path)}${isViewable && !forceDownload ? '&view=true' : ''}`);
    
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
    
    const response = await fetch(`${BASE_URL}/search?term=${encodeURIComponent(searchTerm.trim())}`);
    
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

    const response = await fetch(`${BASE_URL}/youtube-url?path=${encodeURIComponent(path)}`);
    
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

    const response = await fetch(`${BASE_URL}/youtube-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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