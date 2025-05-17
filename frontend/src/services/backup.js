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

// Obtener lista de backups (solo muestra backups en proceso)
export const listBackups = async () => {
  try {
    // Obtener el bucket actual
    const currentBucket = localStorage.getItem('currentBucket');
    if (!currentBucket) {
      return {
        success: false,
        message: 'No se pudo determinar el bucket actual',
        backups: []
      };
    }
    
    // Usar la ruta con el parámetro de bucket
    const listUrl = `${backendUrl}/api/admin/list?bucketName=${encodeURIComponent(currentBucket)}&token=${encodeURIComponent(getAuthToken())}`;
    
    console.log('Consultando backups en proceso para:', currentBucket);
    
    const response = await fetch(listUrl, createFetchOptions('GET'));
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Formatear la respuesta
    return {
      success: data.success || false,
      message: data.message || 'Consulta de backups en proceso completada',
      backups: data.backups || [],
      note: 'Los backups solo permanecen en el servidor temporalmente durante la descarga'
    };
  } catch (error) {
    console.error('Error al listar backups en proceso:', error);
    return {
      success: false,
      message: `Error al listar backups en proceso: ${error.message}`,
      backups: []
    };
  }
};

// Crear un nuevo backup y descargarlo automáticamente mediante un enlace temporal
export const createBackup = async (bucketName) => {
  try {
    // Verificar que tenemos un bucket válido
    if (!bucketName) {
      return {
        success: false,
        message: 'No se pudo determinar el bucket actual. Por favor, seleccione un bucket antes de crear un backup.'
      };
    }
    
    // Mostrar mensaje al usuario
    console.log(`Iniciando backup para bucket: ${bucketName}`);
    
    // Crear URL con token de autenticación para el primer paso (crear el backup)
const token = getAuthToken();
    
// CAMBIO PARA PRODUCCIÓN: Usar backendUrl en lugar de localhost
const createUrl = `${backendUrl}/api/admin/create/${encodeURIComponent(bucketName)}?token=${encodeURIComponent(token)}`;
    
console.log('Paso 1: Creando backup en:', createUrl);
    
// Hacer petición para crear el backup
const response = await fetch(createUrl, createFetchOptions('GET'));
    
if (!response.ok) {
  throw new Error(`Error HTTP: ${response.status}`);
}
    
// Obtener información del backup creado
const data = await response.json();
    
if (!data.success) {
  throw new Error(data.message || 'Error al crear backup');
}
    
console.log('Backup creado exitosamente:', data);
    
// CAMBIO PARA PRODUCCIÓN: Usar la ruta correcta para la descarga
const downloadUrl = `${backendUrl}/api/admin/download/${data.filename}?token=${encodeURIComponent(token)}&bucketName=${encodeURIComponent(bucketName)}`;
    
// Imprimir la URL en la consola para facilitar la depuración
console.log('URL de descarga:', downloadUrl);

// Intentar abrir la URL de descarga en una nueva ventana
const downloadWindow = window.open(downloadUrl, '_blank');

// Verificar si la ventana se abrió correctamente (podría ser bloqueada por el navegador)
if (!downloadWindow || downloadWindow.closed || typeof downloadWindow.closed === 'undefined') {
  // La ventana emergente fue bloqueada por el navegador
  console.warn('No se pudo abrir una ventana para la descarga. Mostrando instrucciones alternativas.');
  
  // Mostrar instrucciones alternativas al usuario
  alert(`El backup se ha creado correctamente, pero no se pudo iniciar la descarga automáticamente.
  
Para descargar tu backup, sigue estos pasos:
1. Haz clic en este enlace o copia la siguiente URL en tu navegador:
${downloadUrl}

El archivo se eliminará automáticamente del servidor después de varios minutos si no se descarga.`);
}

  return {
  success: true,
  message: 'Backup creado correctamente. La descarga debería iniciarse en una nueva ventana.',
  note: 'El archivo se eliminará automáticamente del servidor después de la descarga. Solo se guarda en tu dispositivo local.',
  backupInfo: data,
  downloadUrl: downloadUrl
};

  } catch (error) {
    console.error('Error al crear y descargar backup:', error);
    return {
      success: false,
      message: `Error al crear backup: ${error.message}`
    };
  }
};

// Descargar un backup existente
export const downloadBackup = async (filename) => {
  try {
    const token = getAuthToken();
    const currentBucket = localStorage.getItem('currentBucket');

    // Verificar que tenemos un bucket válido
    if (!currentBucket) {
      return {
        success: false,
        message: 'No se pudo determinar el bucket actual. Por favor, seleccione un bucket antes de descargar un backup.'
      };
    }
    
    // URL con parámetros de seguridad
    const downloadUrl = `${backendUrl}/api/admin/download/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}&bucketName=${encodeURIComponent(currentBucket)}`;
    
    console.log('Iniciando descarga desde:', downloadUrl);
    
    // Abrir en nueva ventana para mejor manejo de archivos grandes
    window.open(downloadUrl, '_blank');
    
    return { 
      success: true, 
      message: 'La descarga ha comenzado en una nueva ventana.',
      note: 'El archivo será eliminado automáticamente del servidor una vez completada la descarga. Los backups solo se guardan en tu dispositivo local.'
    };
  } catch (error) {
    console.error('Error al descargar backup:', error);
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
    const restoreUrl = `${backendUrl}/api/admin/restore`;
    
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

// Restaurar solo etiquetas de un backup
export const restoreTags = async (file) => {
  try {
    const restoreTagsUrl = `${backendUrl}/api/admin/restore-tags`;
    
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
    const checkTagsUrl = `${backendUrl}/api/admin/check-tags`;
    
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
    const restoreUsersUrl = `${backendUrl}/api/admin/restore-users`;
    
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
    const exportTagsUrl = `${backendUrl}/api/admin/export-tags`;
    
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
    const importTagsUrl = `${backendUrl}/api/admin/import-tags`;
    
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