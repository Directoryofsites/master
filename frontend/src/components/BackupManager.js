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
      
      // Llamar al endpoint con los headers correctos
      const response = await fetch(`/api/admin/backup-direct?bucket=${encodeURIComponent(currentBucket)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error en la respuesta del servidor:', errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      console.log('Respuesta del servidor recibida, creando blob...');
      
      // Crear un blob a partir de la respuesta
      const blob = await response.blob();
      console.log('Tamaño del blob:', blob.size);
      
      if (blob.size === 0) {
        throw new Error('El archivo generado está vacío. Verifica los logs del servidor.');
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

  // Obtener el bucket actual del token en localStorage
  const getCurrentBucket = () => {
    try {
      // Intentar primero obtener desde user_session (nuevo formato)
      const userSession = localStorage.getItem('user_session');
      if (userSession) {
        const userData = JSON.parse(userSession);
        if (userData.bucket) {
          console.log('Obteniendo bucket desde user_session:', userData.bucket);
          return userData.bucket;
        }
      }

      // Si no funciona, intentar desde authToken (formato usado en otros componentes)
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const tokenData = JSON.parse(atob(token));
          if (tokenData.bucket) {
            console.log('Obteniendo bucket desde authToken:', tokenData.bucket);
            return tokenData.bucket;
          }
        } catch (tokenError) {
          console.error('Error al decodificar authToken:', tokenError);
        }
      }
    } catch (error) {
      console.error('Error al obtener bucket del almacenamiento:', error);
    }

    return null;
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
          <li>Esta funcionalidad está disponible solo para administradores.</li>
        </ul>
      </div>
    </div>
  );
};

export default BackupManager;