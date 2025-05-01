// Este código debe ir en tu archivo frontend/src/services/backup.js

/**
 * Servicio para gestionar copias de seguridad
 */
import { getAuthToken } from './auth'; // Asume que tienes un servicio de autenticación

// Obtener la URL base de la API desde las variables de entorno o usar un valor predeterminado
const API_URL = process.env.REACT_APP_API_URL || 'https://tu-backend-railway.app';

/**
 * Verifica si el backend está disponible
 * @returns {Promise<boolean>} True si el backend está disponible
 */
export const checkBackendConnection = async () => {
  try {
    const response = await fetch(`${API_URL}/api/heartbeat`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error de conexión: ${response.status}`);
    }
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error al verificar conexión con el backend:', error);
    return false;
  }
};

/**
 * Verifica el estado del sistema de backup
 * @returns {Promise<Object>} Estado del sistema
 */
export const checkBackupSystemStatus = async () => {
  try {
    const token = getAuthToken();
    
    const response = await fetch(`${API_URL}/api/admin/backup-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error al verificar estado: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al verificar estado del sistema de backup:', error);
    throw error;
  }
};

/**
 * Genera y descarga una copia de seguridad directamente
 * @param {string} bucketName - Nombre del bucket (opcional)
 */
export const generateBackupDirect = (bucketName) => {
  try {
    const token = getAuthToken();
    
    // Construir la URL de descarga
    let backupUrl = `${API_URL}/api/admin/backup-direct`;
    
    // Añadir parámetros si es necesario
    if (bucketName) {
      backupUrl += `?bucket=${encodeURIComponent(bucketName)}`;
    }
    
    // Crear un elemento <a> invisible para iniciar la descarga
    const downloadLink = document.createElement('a');
    downloadLink.href = backupUrl;
    
    // Añadir el token de autenticación como parámetro
    downloadLink.href += `${downloadLink.href.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
    
    // Configurar la descarga
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadLink.download = `backup-${bucketName || 'default'}-${timestamp}.zip`;
    
    // Añadir al DOM, hacer clic y luego eliminar
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    // Esperar brevemente y eliminar el elemento
    setTimeout(() => {
      document.body.removeChild(downloadLink);
    }, 100);
    
    return true;
  } catch (error) {
    console.error('Error al generar copia de seguridad:', error);
    throw error;
  }
};