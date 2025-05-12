import React, { useState, useRef } from 'react';

/**
 * Componente de botón para restaurar copias de seguridad
 * Permite al usuario seleccionar un archivo de backup para restaurarlo
 * @param {Object} props - Propiedades del componente
 * @param {Function} props.onSuccess - Función a ejecutar después de una restauración exitosa
 */
const RestoreBackupButton = ({ onSuccess }) => {
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  /**
   * Maneja la selección del archivo de backup
   */
  const handleFileSelect = () => {
    fileInputRef.current.click();
  };

  /**
   * Procesa el archivo seleccionado y lo envía al servidor
   */
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Verificar que sea un archivo ZIP
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setStatus('error');
      setMessage('Error: El archivo debe ser un ZIP válido de copia de seguridad.');
      return;
    }

    try {
      // Cambiar estado a cargando
      setStatus('uploading');
      setMessage('Cargando archivo de copia de seguridad...');

      // Importar auth para obtener el token
      const auth = await import('../services/auth');
      const token = auth.getAuthToken();

      // Obtener información del usuario y su bucket
      const userSession = localStorage.getItem('user_session');
      if (!userSession) {
        throw new Error('No se pudo obtener información del usuario');
      }
      
      const userData = JSON.parse(userSession);
      const bucketName = userData.bucket;
      
      if (!bucketName) {
        throw new Error('No se pudo determinar el bucket del usuario');
      }
      
      // Crear FormData para enviar el archivo
      const formData = new FormData();
      // Usa el mismo nombre que espera el servidor
      formData.append('backupFile', file);
      // Agrega explícitamente el nombre del bucket
      formData.append('bucketName', bucketName);
      
      console.log(`[DEBUG] Enviando restauración para bucket: ${bucketName}`);
      console.log(`[DEBUG] Tamaño del archivo: ${file.size} bytes`);

      // URL del endpoint de restauración
// Usa la URL de Railway en producción
const backendUrl = "https://master-production-5386.up.railway.app";
const restoreUrl = `${backendUrl}/api/backup/restore`;
      
      // Configurar la petición con un timeout mayor y sin caché
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos de timeout
      
      // Enviar el archivo al servidor
      const response = await fetch(restoreUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Mostrar mensaje de éxito
      setStatus('success');
      setMessage('Restauración completada con éxito. El sistema se actualizará en breve.');

      // Llamar a la función onSuccess si existe
      if (typeof onSuccess === 'function') {
        onSuccess();
      }

      // Recargar la página después de 3 segundos para mostrar los cambios
      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (error) {
      console.error('Error en proceso de restauración:', error);
      setStatus('error');
      setMessage(`Error: ${error.message}`);

      // Volver a estado normal después de unos segundos en caso de error
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 5000);
    }
  };

  return (
    <div className="restore-container">
      {/* Input de archivo oculto */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".zip"
        onChange={handleFileChange}
      />
      
      {/* Botón visible para iniciar la restauración */}
      <button 
        className={`restore-button ${status}`}
        onClick={handleFileSelect}
        disabled={status === 'uploading'}
      >
        {status === 'uploading' ? 'Restaurando...' : 
         status === 'success' ? 'Restauración exitosa' : 
         'Restaurar Copia de Seguridad'}
      </button>
      
      {message && (
        <div className={`message ${status}`}>
          {message}
        </div>
      )}
      
      <style jsx>{`
        .restore-container {
          margin: 15px 0;
          padding: 10px;
        }
        
        .restore-button {
          background-color: #2196F3;
          color: white;
          padding: 10px 15px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .restore-button:hover {
          background-color: #0b7dda;
        }
        
        .restore-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .restore-button.uploading {
          background-color: #FF9800;
        }
        
        .restore-button.success {
          background-color: #4CAF50;
        }
        
        .restore-button.error {
          background-color: #f44336;
        }
        
        .message {
          margin-top: 10px;
          padding: 8px;
          border-radius: 4px;
        }
        
        .message.uploading {
          color: #E65100;
          background-color: #FFF3E0;
        }
        
        .message.success {
          color: #1B5E20;
          background-color: #E8F5E9;
        }
        
        .message.error {
          color: #B71C1C;
          background-color: #FFEBEE;
        }
      `}</style>
    </div>
  );
};

export default RestoreBackupButton;