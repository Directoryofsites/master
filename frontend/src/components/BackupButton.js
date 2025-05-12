import React, { useState } from 'react';

/**
 * Componente de botón para crear copias de seguridad
 */
const BackupButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  /**
   * Obtener el bucket actual del token en localStorage
   */
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

      // Intentar desde authToken si es necesario
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const decodedToken = atob(token);
          const tokenData = JSON.parse(decodedToken);
          if (tokenData.bucket) {
            return tokenData.bucket;
          }
        } catch (error) {
          console.error('Error al decodificar token:', error);
        }
      }

      // Último recurso: localStorage directo
      return localStorage.getItem('currentBucket');
    } catch (error) {
      console.error('Error al obtener bucket:', error);
      return null;
    }
  };

  /**
   * Función para iniciar el proceso de backup
   */
  const handleCreateBackup = async () => {
    try {
      setIsLoading(true);
      setMessage('Iniciando creación de backup...');
      setError('');

      // Obtener el token y el bucket actual
      const token = localStorage.getItem('authToken');
      const currentBucket = getCurrentBucket();

      if (!currentBucket) {
        throw new Error('No se pudo determinar el bucket actual');
      }

      console.log(`Creando backup para bucket: ${currentBucket}`);

      // URL absoluta al backend en Railway
      const backendUrl = 'https://master-production-5386.up.railway.app';
      const createUrl = `${backendUrl}/api/backup/create/${currentBucket}`;

      console.log('URL de creación de backup:', createUrl);

      // Configurar el timeout para la petición
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minuto timeout

      // Realizar la petición
      const response = await fetch(createUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al crear backup: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Respuesta del servidor:', data);

      setMessage('Backup creado correctamente');
      
      // Si el servidor devuelve una URL de descarga, iniciar la descarga
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }

    } catch (error) {
      console.error('Error en la creación del backup:', error);
      setError(error.message || 'Error desconocido');
      setMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="backup-button-container">
      <button
        className="backup-button"
        onClick={handleCreateBackup}
        disabled={isLoading}
      >
        {isLoading ? 'Creando backup...' : 'Crear Copia de Seguridad'}
      </button>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <style jsx>{`
        .backup-button-container {
          margin: 15px 0;
          padding: 10px;
        }
        
        .backup-button {
          background-color: #28a745;
          color: white;
          padding: 10px 15px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .backup-button:hover {
          background-color: #218838;
        }
        
        .backup-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .success-message {
          margin-top: 10px;
          padding: 8px;
          border-radius: 4px;
          color: #1B5E20;
          background-color: #E8F5E9;
        }
        
        .error-message {
          margin-top: 10px;
          padding: 8px;
          border-radius: 4px;
          color: #B71C1C;
          background-color: #FFEBEE;
        }
      `}</style>
    </div>
  );
};

export default BackupButton;