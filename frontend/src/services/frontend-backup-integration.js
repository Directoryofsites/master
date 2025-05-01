// Añadir a src/services/api.js o crear un nuevo archivo

/**
 * Funciones para manejar copias de seguridad
 */

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
 * @param {string} bucketName Nombre del bucket (opcional)
 */
export const generateBackup = () => {
  try {
    // Obtener token
    const token = getAuthToken();
    
    // Crear URL para el endpoint de backup
    // IMPORTANTE: Cambiar la URL a la de tu backend en Railway
    const backendUrl = 'https://tu-app.railway.app'; // ¡ACTUALIZA ESTA URL!
    const backupUrl = `${backendUrl}/api/admin/backup`;
    
    // Crear un elemento <a> temporal para la descarga
    const downloadLink = document.createElement('a');
    
    // Configurar la URL con el token de autenticación como header (enviado como parámetro GET)
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
    
    // IMPORTANTE: Cambiar la URL a la de tu backend en Railway
    const backendUrl = 'https://tu-app.railway.app'; // ¡ACTUALIZA ESTA URL!
    const statusUrl = `${backendUrl}/api/admin/backup-status`;
    
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