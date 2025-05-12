// Funciones para manejar copias de seguridad

import { getAuthToken as getAuthTokenFromAuth } from './auth';

/**
 * Obtiene el token de autenticación actual
 * @returns {string} Token de autenticación
 */
const getAuthToken = () => {
  try {
    return getAuthTokenFromAuth();
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

/**
 * Descarga un backup específico
 * @param {string} filename - Nombre del archivo a descargar
 * @returns {Promise<Object>} Resultado de la operación
 */
export const downloadBackup = async (filename) => {
  try {
    // Usar la URL del backend de Railway
    const backendUrl = 'https://master-production-5386.up.railway.app';
    const downloadUrl = `${backendUrl}/api/backup/download/${filename}`;
    
    console.log('Iniciando descarga desde:', downloadUrl);
    
    // Crear enlace para descarga
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return { success: true, message: 'Descarga iniciada' };
  } catch (error) {
    console.error('Error al descargar backup:', error);
    throw error;
  }
};

/**
 * Restaura un backup completo
 * @param {File} backupFile - Archivo de backup a restaurar
 * @param {string} targetBucket - Bucket de destino
 * @returns {Promise<Object>} Resultado de la operación
 */
export const restoreBackup = async (backupFile, targetBucket) => {
  try {
    const token = getAuthToken();
    
    // Usar la URL del backend de Railway
    const backendUrl = 'https://master-production-5386.up.railway.app';
    const restoreUrl = `${backendUrl}/api/bridge-restore`;
    
    console.log('Intentando restaurar backup en:', restoreUrl);
    
    const formData = new FormData();
    formData.append('backupFile', backupFile);
    formData.append('targetBucket', targetBucket);
    
    const response = await fetch(restoreUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en respuesta:', errorText);
      throw new Error(`Error al restaurar backup: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Backup restaurado:', data);
    return data;
  } catch (error) {
    console.error('Error al restaurar backup:', error);
    throw error;
  }
};

/**
 * Restaura solo las etiquetas de un backup
 * @param {File} backupFile - Archivo de backup que contiene las etiquetas
 * @returns {Promise<Object>} Resultado de la operación
 */
export const restoreTags = async (backupFile) => {
  try {
    const token = getAuthToken();
    
    // Usar la URL del backend de Railway
    const backendUrl = 'https://master-production-5386.up.railway.app';
    const restoreTagsUrl = `${backendUrl}/api/backup/restore-tags`;
    
    console.log('Intentando restaurar etiquetas desde:', restoreTagsUrl);
    
    const formData = new FormData();
    formData.append('backupFile', backupFile);
    
    const response = await fetch(restoreTagsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en respuesta:', errorText);
      throw new Error(`Error al restaurar etiquetas: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Etiquetas restauradas:', data);
    return data;
  } catch (error) {
    console.error('Error al restaurar etiquetas:', error);
    throw error;
  }
};

/**
 * Verifica las etiquetas contenidas en un backup
 * @param {File} backupFile - Archivo de backup a verificar
 * @returns {Promise<Object>} Información sobre las etiquetas encontradas
 */
export const checkTags = async (backupFile) => {
  try {
    const token = getAuthToken();
    
    // Usar la URL del backend de Railway
    const backendUrl = 'https://master-production-5386.up.railway.app';
    const checkTagsUrl = `${backendUrl}/api/backup/check-tags`;
    
    console.log('Verificando etiquetas en backup:', checkTagsUrl);
    
    const formData = new FormData();
    formData.append('backupFile', backupFile);
    
    const response = await fetch(checkTagsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en respuesta:', errorText);
      throw new Error(`Error al verificar etiquetas: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Verificación de etiquetas completada:', data);
    return data;
  } catch (error) {
    console.error('Error al verificar etiquetas:', error);
    throw error;
  }
};

/**
 * Restaura usuarios desde un backup
 * @param {File} backupFile - Archivo de backup
 * @param {string} targetBucket - Bucket de destino
 * @returns {Promise<Object>} Resultado de la operación
 */
export const restoreUsers = async (backupFile, targetBucket) => {
  try {
    const token = getAuthToken();
    
    // Usar la URL del backend de Railway
    const backendUrl = 'https://master-production-5386.up.railway.app';
    const restoreUsersUrl = `${backendUrl}/api/backup/restore-users`;
    
    console.log('Intentando restaurar usuarios desde:', restoreUsersUrl);
    
    const formData = new FormData();
    formData.append('backupFile', backupFile);
    formData.append('targetBucket', targetBucket);
    
    const response = await fetch(restoreUsersUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en respuesta:', errorText);
      throw new Error(`Error al restaurar usuarios: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Usuarios restaurados:', data);
    return data;
  } catch (error) {
    console.error('Error al restaurar usuarios:', error);
    throw error;
  }
};

/**
 * Exporta las etiquetas del bucket actual
 * @param {string} bucketName - Nombre del bucket
 * @returns {Promise<Object>} Resultado de la operación
 */
export const exportTags = async (bucketName) => {
  try {
    const token = getAuthToken();
    
    // Usar la URL del backend de Railway
    const backendUrl = 'https://master-production-5386.up.railway.app';
    const exportUrl = `${backendUrl}/api/backup/export-tags?bucket=${bucketName}&token=${token}`;
    
    console.log('URL de exportación de etiquetas:', exportUrl);
    
    // Crear un enlace para descargar el archivo
    const link = document.createElement('a');
    link.href = exportUrl;
    link.setAttribute('download', `tags_export_${bucketName}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return { success: true, message: 'Exportación de etiquetas iniciada' };
  } catch (error) {
    console.error('Error al exportar etiquetas:', error);
    throw error;
  }
};

/**
 * Importa etiquetas desde un archivo JSON
 * @param {File} tagsFile - Archivo JSON con las etiquetas
 * @param {string} targetBucket - Bucket de destino
 * @param {boolean} replaceExisting - Si se deben reemplazar las etiquetas existentes
 * @returns {Promise<Object>} Resultado de la operación
 */
export const importTags = async (tagsFile, targetBucket, replaceExisting = true) => {
  try {
    const token = getAuthToken();
    
    // Usar la URL del backend de Railway
    const backendUrl = 'https://master-production-5386.up.railway.app';
    const importTagsUrl = `${backendUrl}/api/backup/import-tags`;
    
    console.log('Importando etiquetas:', importTagsUrl);
    
    const formData = new FormData();
    formData.append('tagsFile', tagsFile);
    formData.append('targetBucket', targetBucket);
    formData.append('replaceExisting', replaceExisting);
    
    const response = await fetch(importTagsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en respuesta:', errorText);
      throw new Error(`Error al importar etiquetas: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Etiquetas importadas:', data);
    return data;
  } catch (error) {
    console.error('Error al importar etiquetas:', error);
    throw error;
  }
};