import { getAuthToken } from './auth';

// URL base del backend
const backendUrl = 'https://master-production-5386.up.railway.app';

// Función para crear opciones de fetch con el token de autorización
const createFetchOptions = (method, body = null) => {
  const options = {
    method: method,
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  };
  
  if (body) {
    if (!(body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    } else {
      options.body = body;
    }
  }
  
  return options;
};

// Obtener lista de backups para el bucket actual
export const listBackups = async () => {
  try {
    // Obtener el bucket actual del localStorage
    const currentBucket = localStorage.getItem('currentBucket');
    
    if (!currentBucket) {
      console.error('No se pudo determinar el bucket actual para listar backups');
      return {
        success: false,
        message: 'No se pudo determinar el bucket actual. Por favor, seleccione un bucket antes de listar backups.',
        backups: []
      };
    }
    
    // Añadir el bucketName como parámetro de consulta
    const listUrl = `${backendUrl}/api/backup/list?bucketName=${encodeURIComponent(currentBucket)}`;
    
    console.log(`Listando backups para bucket: ${currentBucket}`);
    console.log('URL de lista de backups:', listUrl); 
        
    console.log('Intentando obtener backups desde:', listUrl);
    
    const response = await fetch(listUrl, createFetchOptions('GET'));
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Datos de backups recibidos:', data);
    
    // Formatear la respuesta para manejar diferentes formatos
    const formattedResponse = {
      success: data.success || true,
      message: data.message || 'Backups obtenidos correctamente',
      backups: data.backups || data.files || []
    };
    
    return formattedResponse;
  } catch (error) {
    console.error('Error al listar backups:', error);
    return {
      success: false,
      message: `Error al listar backups: ${error.message}`,
      backups: []
    };
  }
};

// Crear un nuevo backup
export const createBackup = async (bucketName) => {
  try {
    // Usar la ruta correcta según el backend
    const createUrl = `${backendUrl}/api/backup/create/${encodeURIComponent(bucketName)}`;
    
    console.log('Intentando crear backup en:', createUrl);
    
    // Usar método GET según la implementación del backend
    const response = await fetch(createUrl, createFetchOptions('GET'));
    
    // Mostrar detalle de la respuesta para depuración
    if (!response.ok) {
      console.error('Error en la respuesta del servidor:', response.status, response.statusText);
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al crear backup:', error);
    return {
      success: false,
      message: `Error al crear backup: ${error.message}`
    };
  }
};

// Descargar un backup
export const downloadBackup = async (filename) => {
  try {
    const token = getAuthToken();
    
    // URL con token incluido
    const downloadUrl = `${backendUrl}/api/backup/download/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}`;
    
    console.log('Iniciando descarga desde:', downloadUrl);
    
    // Abrir en nueva ventana para descargar
    window.open(downloadUrl, '_blank');
    
    return { success: true, message: 'Descarga iniciada. Por favor, revisa tu navegador.' };
  } catch (error) {
    console.error('Error al iniciar descarga de backup:', error);
    return {
      success: false,
      message: `Error al descargar backup: ${error.message}`
    };
  }
};

// Restaurar un backup
export const restoreBackup = async (file, bucketName, keepOriginalUsernames = true) => {
  try {
    // URL ya correcta, pero ajustada la propiedad del formulario para coincidir con backend
    const restoreUrl = `${backendUrl}/api/backup/restore`;
    
    console.log('Intentando restaurar en:', restoreUrl);
    console.log('Mantener nombres originales:', keepOriginalUsernames);
    
    const formData = new FormData();
    formData.append('backupFile', file);
    formData.append('targetBucket', bucketName); // Cambiado a targetBucket según el backend
    formData.append('keepOriginalUsernames', keepOriginalUsernames.toString());
    
    const fetchOptions = createFetchOptions('POST', formData);
    // Asegurarnos de no incluir Content-Type cuando usamos FormData
    delete fetchOptions.headers['Content-Type'];
    
    const response = await fetch(restoreUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al restaurar backup:', error);
    return {
      success: false,
      message: `Error al restaurar backup: ${error.message}`
    };
  }
};

// Las siguientes funciones dependen de endpoints que aún no están implementados en el backend.
// Si necesitas usarlas, deberás implementar los endpoints correspondientes en el backend.

// Restaurar solo etiquetas de un backup
export const restoreTags = async (file) => {
  try {
    const restoreTagsUrl = `${backendUrl}/api/backup/restore-tags`;
    
    console.log('Intentando restaurar etiquetas en:', restoreTagsUrl);
    console.log('AVISO: Esta ruta puede no estar implementada en el backend.');
    
    const formData = new FormData();
    formData.append('backupFile', file);
    
    const fetchOptions = createFetchOptions('POST', formData);
    delete fetchOptions.headers['Content-Type'];
    
    const response = await fetch(restoreTagsUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al restaurar etiquetas:', error);
    return {
      success: false,
      message: `Error al restaurar etiquetas: ${error.message}`
    };
  }
};

// Verificar etiquetas en un backup
export const checkTags = async (file) => {
  try {
    const checkTagsUrl = `${backendUrl}/api/backup/check-tags`;
    
    console.log('Verificando etiquetas en:', checkTagsUrl);
    console.log('AVISO: Esta ruta puede no estar implementada en el backend.');
    
    const formData = new FormData();
    formData.append('backupFile', file);
    
    const fetchOptions = createFetchOptions('POST', formData);
    delete fetchOptions.headers['Content-Type'];
    
    const response = await fetch(checkTagsUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al verificar etiquetas:', error);
    return {
      success: false,
      message: `Error al verificar etiquetas: ${error.message}`
    };
  }
};

// Restaurar usuarios desde un backup
export const restoreUsers = async (file, bucketName, keepOriginalNames = true) => {
  try {
    const restoreUsersUrl = `${backendUrl}/api/backup/restore-users`;
    
    console.log('Restaurando usuarios en:', restoreUsersUrl);
    console.log('AVISO: Verificando implementación de ruta en el backend.');
    console.log('Mantener nombres originales:', keepOriginalNames);
    
    const formData = new FormData();
    formData.append('backupFile', file);
    formData.append('bucketName', bucketName);
    formData.append('keepOriginalNames', keepOriginalNames ? 'true' : 'false');
    
    const fetchOptions = createFetchOptions('POST', formData);
    delete fetchOptions.headers['Content-Type'];
    
    const response = await fetch(restoreUsersUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al restaurar usuarios:', error);
    return {
      success: false,
      message: `Error al restaurar usuarios: ${error.message}`
    };
  }
};

// Exportar etiquetas
export const exportTags = async (bucketName) => {
  try {
    const exportTagsUrl = `${backendUrl}/api/backup/export-tags`;
    
    console.log('Exportando etiquetas desde:', exportTagsUrl);
    console.log('AVISO: Esta ruta puede no estar implementada en el backend.');
    
    const response = await fetch(exportTagsUrl, createFetchOptions('POST', { bucketName }));
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    // Manejar la descarga del archivo
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const filename = `tags-export-${bucketName}-${new Date().toISOString().slice(0, 10)}.json`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return { success: true, message: 'Exportación de etiquetas completada' };
  } catch (error) {
    console.error('Error al exportar etiquetas:', error);
    return {
      success: false,
      message: `Error al exportar etiquetas: ${error.message}`
    };
  }
};

// Importar etiquetas
export const importTags = async (file, bucketName, replaceExisting = true) => {
  try {
    const importTagsUrl = `${backendUrl}/api/backup/import-tags`;
    
    console.log('Importando etiquetas en:', importTagsUrl);
    console.log('AVISO: Esta ruta puede no estar implementada en el backend.');
    
    const formData = new FormData();
    formData.append('tagsFile', file);
    formData.append('bucketName', bucketName);
    formData.append('replaceExisting', replaceExisting);
    
    const fetchOptions = createFetchOptions('POST', formData);
    delete fetchOptions.headers['Content-Type'];
    
    const response = await fetch(importTagsUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al importar etiquetas:', error);
    return {
      success: false,
      message: `Error al importar etiquetas: ${error.message}`
    };
  }
};