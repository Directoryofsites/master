// Funciones para manejar copias de seguridad

/**
 * Obtiene el token de autenticación actual
 * @returns {string} Token de autenticación
 */
const getAuthToken = () => {
  try {
    // Recuperar token del localStorage (adapta según cómo almacenas tus tokens)
    const userAuth = localStorage.getItem('userAuth');
    
    if (!userAuth) {
      throw new Error('No hay sesión activa');
    }
    
    return userAuth;
  } catch (error) {
    console.error('Error al obtener token de autenticación:', error);
    throw error;
  }
};

/**
 * Genera una copia de seguridad de forma directa
 */
export const generateBackup = () => {
  try {
    // Obtener token
    const token = getAuthToken();
    
    // Verificar si estamos en GitHub Pages o en desarrollo
    const isGitHubPages = window.location.hostname === 'directoryofsites.github.io';
    console.log('Hostname:', window.location.hostname);
    console.log('Es GitHub Pages:', isGitHubPages);
    
    // Usar la URL de Railway para producción
    const backendUrl = 'https://master-production-5386.up.railway.app';
    
    const backupUrl = `${backendUrl}/api/backup/create/contenedor003`;
    
    // Crear un elemento <a> temporal para la descarga
    const downloadLink = document.createElement('a');
    
    // Configurar la URL con el token de autenticación como parámetro
    downloadLink.href = `${backupUrl}?token=${encodeURIComponent(token)}`;
    
    // Configurar para descarga
    downloadLink.target = '_blank';
    
    // Simular clic para iniciar descarga
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    return true;
  } catch (error) {
    console.error('Error al generar backup:', error);
    alert(`Error al generar copia de seguridad: ${error.message}`);
    return false;
  }
};

/**
 * Verifica el estado del sistema de backup
 * @returns {Promise<Object>} Estado del sistema
 */
export const checkBackupStatus = async () => {
  try {
    const token = getAuthToken();
    
    // Usar la misma URL del backend de Railway
    const backendUrl = 'https://master-production-5386.up.railway.app';
    
    const statusUrl = `${backendUrl}/api/backup/list`;
    
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error al verificar estado: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al verificar estado del backup:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Lista las copias de seguridad disponibles
 * @returns {Promise<Array>} Lista de copias de seguridad
 */
export const listBackups = async () => {
  try {
    const token = getAuthToken();
    
    // Usar la URL del backend de Railway
    const backendUrl = 'https://master-production-5386.up.railway.app';
    
    const listUrl = `${backendUrl}/api/backup/list`;
    
    console.log('Intentando listar backups desde:', listUrl);
    
    const response = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en respuesta:', errorText);
      throw new Error(`Error al listar backups: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Backups obtenidos:', data);
    return data;
  } catch (error) {
    console.error('Error al listar backups:', error);
    throw error;
  }
};

/**
 * Crea una nueva copia de seguridad
 * @param {string} bucketName - Nombre del bucket a respaldar
 * @returns {Promise<Object>} Resultado de la operación
 */
export const createBackup = async (bucketName) => {
  // Si no se proporciona un nombre de bucket, intentamos obtenerlo del token
  if (!bucketName) {
    try {
      const token = getAuthToken();
      // Intentar extraer el bucket del token si está en formato JWT
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        bucketName = payload.bucket || 'default';
      } else {
        // Si no es un JWT, intentar decodificar directamente
        const tokenData = JSON.parse(atob(token));
        bucketName = tokenData.bucket || 'default';
      }
      console.log('Bucket obtenido del token:', bucketName);
    } catch (error) {
      console.error('Error al obtener bucket del token:', error);
      bucketName = 'default';
    }
  }
  
  try {
    const token = getAuthToken();
    
    // Usar la URL del backend de Railway
    const backendUrl = 'https://master-production-5386.up.railway.app';
    
    const createUrl = `${backendUrl}/api/backup/create/${bucketName}`;
    
    console.log('Intentando crear backup desde:', createUrl);
    
    const response = await fetch(createUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en respuesta:', errorText);
      throw new Error(`Error al crear backup: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Backup creado:', data);
    return data;
  } catch (error) {
    console.error('Error al crear backup:', error);
    throw error;
  }
};