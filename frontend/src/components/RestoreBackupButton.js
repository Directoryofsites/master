import React, { useState, useRef } from 'react';

/**
 * Componente de botón para restaurar copias de seguridad
 * Permite al usuario seleccionar un archivo de backup para restaurarlo
 */
const RestoreBackupButton = () => {
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);
  const [keepOriginalUsernames, setKeepOriginalUsernames] = useState(true); // Nueva opción para mantener nombres originales

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

     // Crear FormData para enviar el archivo
      const formData = new FormData();
      formData.append('backup', file);
      // Agregar parámetro para mantener nombres originales
      formData.append('keepOriginalUsernames', keepOriginalUsernames.toString());
      
      console.log(`Restaurando con la opción de mantener nombres originales: ${keepOriginalUsernames}`);
      // Incluir el parámetro para mantener nombres originales
      formData.append('keepOriginalUsernames', keepOriginalUsernames.toString());

      // URL completa al endpoint de restauración
const backendUrl = "https://master-production-5386.up.railway.app"; // URL de tu backend
const restoreUrl = `${backendUrl}/api/backup/restore`;

     // Enviar el archivo al servidor
      // Asegurarnos de que se incluya el parámetro keepOriginalUsernames
      console.log(`Enviando restauración con mantener nombres originales: ${keepOriginalUsernames}`);
      formData.append('keepOriginalUsernames', keepOriginalUsernames.toString());
      
      const response = await fetch(restoreUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Mostrar mensaje de éxito
      setStatus('success');
      setMessage('Restauración completada con éxito. El sistema se actualizará en breve.');

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
      {/* Opción para mantener nombres de usuario originales */}
      <div className="option-container">
        <label className="option-label">
          <input
            type="checkbox"
            checked={keepOriginalUsernames}
            onChange={(e) => setKeepOriginalUsernames(e.target.checked)}
          />
          Mantener nombres de usuario originales
        </label>
        <div className="option-description">
          Si está marcado, los usuarios restaurados mantendrán sus nombres originales.
          Si no está marcado, se añadirá un sufijo al nombre de usuario para evitar conflictos.
        </div>
      </div>
      
      {/* Input de archivo oculto */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".zip"
        onChange={handleFileChange}
      />
      
    {/* Opción para mantener nombres de usuario originales */}
      <div className="option-container">
        <label className="option-label">
          <input
            type="checkbox"
            checked={keepOriginalUsernames}
            onChange={(e) => setKeepOriginalUsernames(e.target.checked)}
          />
          Mantener nombres de usuario originales
        </label>
        <div className="option-description">
          Si está marcado, los usuarios restaurados mantendrán sus nombres originales.
          Si no está marcado, se añadirá un sufijo al nombre de usuario para evitar conflictos.
        </div>
      </div>
      
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
      
      {/* Indicador visual del estado de la opción */}
      {status !== 'success' && (
        <div className="option-indicator">
          <span className={`indicator-dot ${keepOriginalUsernames ? 'enabled' : 'disabled'}`}></span>
          {keepOriginalUsernames 
            ? 'Los usuarios se restaurarán con sus nombres originales' 
            : 'Los usuarios se restaurarán con nombres modificados para evitar conflictos'}
        </div>
      )}
      
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
        
        .option-container {
          margin-bottom: 15px;
          padding: 10px;
          background-color: #F5F5F5;
          border-radius: 4px;
        }
        
        .option-label {
          display: flex;
          align-items: center;
          font-weight: bold;
          cursor: pointer;
        }
        
        .option-description {
          margin-top: 5px;
          font-size: 12px;
          color: #666666;
        }
        
       input[type="checkbox"] {
          margin-right: 8px;
        }
        
        .option-indicator {
          margin-top: 10px;
          font-size: 12px;
          display: flex;
          align-items: center;
        }
        
        .indicator-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 8px;
        }
        
        .indicator-dot.enabled {
          background-color: #4CAF50;
        }
        
        .indicator-dot.disabled {
          background-color: #FFA000;
        }
      `}</style>

    </div>
  );
};

export default RestoreBackupButton;