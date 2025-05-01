import React, { useState } from 'react';
import * as api from '../services/api';

const BackupManager = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Función para verificar si el usuario actual es administrador
  const isAdmin = () => {
    try {
      const userSession = localStorage.getItem('user_session');
      if (userSession) {
        const userData = JSON.parse(userSession);
        return userData.role === 'admin';
      }
      return false;
    } catch (error) {
      console.error('Error al verificar rol de usuario:', error);
      return false;
    }
  };

  // Obtener el bucket actual del token en localStorage
  const getCurrentBucket = () => {
    try {
      // Intentar primero obtener desde user_session (nuevo formato)
      const userSession = localStorage.getItem('user_session');
      if (userSession) {
        try {
          const userData = JSON.parse(userSession);
          if (userData.bucket) {
            console.log('Obteniendo bucket desde user_session:', userData.bucket);
            return userData.bucket;
          }
        } catch (err) {
          console.error('Error al parsear user_session:', err);
        }
      }

      // Si no funciona, intentar desde authToken (formato usado en otros componentes)
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          // Intentar decodificar como base64
          const decodedToken = atob(token);
          try {
            const tokenData = JSON.parse(decodedToken);
            if (tokenData.bucket) {
              console.log('Obteniendo bucket desde authToken (decodificado):', tokenData.bucket);
              return tokenData.bucket;
            }
          } catch (jsonError) {
            console.error('Error al parsear JSON del token:', jsonError);
          }
        } catch (b64Error) {
          console.warn('El token no está en formato base64, probando como JSON directo');
          // Intentar como JSON directo
          try {
            const tokenData = JSON.parse(token);
            if (tokenData.bucket) {
              console.log('Obteniendo bucket desde authToken (JSON directo):', tokenData.bucket);
              return tokenData.bucket;
            }
          } catch (jsonError) {
            console.error('Error al parsear authToken como JSON:', jsonError);
          }
        }
      }

      // Último recurso: revisar localStorage directamente
      const bucketFromStorage = localStorage.getItem('currentBucket');
      if (bucketFromStorage) {
        console.log('Obteniendo bucket desde localStorage directamente:', bucketFromStorage);
        return bucketFromStorage;
      }

      console.error('No se pudo obtener el bucket de ninguna fuente');
      return null;
    } catch (error) {
      console.error('Error general al obtener el bucket:', error);
      return null;
    }
  };

  // Función para iniciar el proceso de copia de seguridad directa
  const handleBackup = async () => {
    if (!isAdmin()) {
      setError('Solo los administradores pueden realizar copias de seguridad');
      return;
    }
  
    try {
      setIsLoading(true);
      setMessage('Iniciando generación de copia de seguridad...');
      setError('');
  
      // Obtener el bucket actual
      const currentBucket = getCurrentBucket();
      
      if (!currentBucket) {
        throw new Error('No se pudo determinar el bucket actual');
      }
  
      // Obtener el token
      const token = localStorage.getItem('authToken');
      
      console.log(`Generando copia de seguridad para bucket: ${currentBucket}`);
      
      // Usar la URL absoluta del backend en Railway en lugar de una ruta relativa
      const backendUrl = 'https://master-production-5386.up.railway.app';
      console.log(`Usando URL de backend: ${backendUrl}`);

      // Llamar al endpoint con los headers correctos
      const response = await fetch(`${backendUrl}/api/admin/backup?bucket=${encodeURIComponent(currentBucket)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error en la respuesta del servidor:', errorText);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      console.log('Respuesta del servidor recibida, creando blob...');
      
      // Comprobar el tipo de contenido
      const contentType = response.headers.get('content-type');
      console.log('Tipo de contenido recibido:', contentType);

      // Crear un blob a partir de la respuesta
      const blob = await response.blob();
      console.log('Tamaño del blob:', blob.size);
      
      if (blob.size === 0) {
        console.warn('El archivo generado está vacío. Intentando método directo...');
        
        // Método alternativo: abrir la URL directamente en una nueva pestaña
        const directUrl = `${backendUrl}/api/admin/backup?bucket=${encodeURIComponent(currentBucket)}&token=${encodeURIComponent(token)}`;
        console.log('Iniciando descarga directa desde:', directUrl);
        
        window.open(directUrl, '_blank');
        setMessage('Se ha abierto una nueva pestaña para la descarga directa. Si no ves el archivo, verifica el bloqueador de popups.');
        return;
      }
      
      // Crear una URL para el blob
      const url = window.URL.createObjectURL(blob);
      
      // Crear un enlace para descargar el blob
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `backup-${currentBucket}-${new Date().toISOString().slice(0, 10)}.zip`;
      
      // Añadir el enlace al DOM y hacer clic en él
      document.body.appendChild(a);
      a.click();
      
      // Limpiar
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setMessage('La copia de seguridad se ha generado correctamente. Se ha iniciado la descarga del archivo.');
    } catch (error) {
      console.error('Error al generar copia de seguridad:', error);
      setError(`Error: ${error.message || 'No se pudo generar la copia de seguridad'}`);
      setMessage('');
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 2000);
    }
  };

  // Si el usuario no es administrador, no mostrar el componente
  if (!isAdmin()) {
    return null;
  }

  return (
    <div className="backup-manager">
      <h2>Gestión de Copias de Seguridad</h2>
      <p>Esta herramienta le permite generar una copia de seguridad completa de todos los archivos y carpetas en su bucket.</p>
      
      <div className="backup-buttons">
        <button 
          onClick={handleBackup} 
          disabled={isLoading}
          className="backup-button main-button"
        >
          {isLoading ? 'Generando copia...' : 'Generar copia de seguridad'}
        </button>
        
        <button
          onClick={() => {
            const token = localStorage.getItem('authToken');
            const currentBucket = getCurrentBucket();
            if (currentBucket) {
              const directUrl = `https://master-production-5386.up.railway.app/api/admin/backup?bucket=${encodeURIComponent(currentBucket)}&token=${encodeURIComponent(token)}`;
              console.log('Iniciando descarga directa desde:', directUrl);
              window.open(directUrl, '_blank');
            } else {
              setError('No se pudo determinar el bucket actual');
            }
          }}
          disabled={isLoading}
          className="backup-button direct-button"
          style={{ marginLeft: '10px', background: '#4a6da7' }}
        >
          Descarga directa (alternativa)
        </button>
      </div>
      
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
      
      <div className="backup-info">
        <h3>Información importante:</h3>
        <ul>
          <li>La copia de seguridad incluirá todos los archivos y carpetas de su bucket actual.</li>
          <li>El proceso puede tardar varios minutos dependiendo del tamaño de sus datos.</li>
          <li>El archivo se generará en formato ZIP.</li>
          <li>Se abrirá el diálogo de su navegador para que elija dónde guardar el archivo.</li>
          <li>Si el método principal no funciona, usa el botón "Descarga directa (alternativa)".</li>
          <li>El botón alternativo abrirá una nueva pestaña para la descarga directa desde el servidor.</li>
          <li>Esta funcionalidad está disponible solo para administradores.</li>
        </ul>
      </div>
    </div>
  );
};

export default BackupManager;