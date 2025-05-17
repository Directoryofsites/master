import React, { useState, useRef } from 'react';
import { restoreUsers } from '../services/backup';

/**
 * Componente que permite restaurar solo los usuarios desde un backup
 * con la opción de mantener nombres originales
 */
const RestoreUsersButton = ({ bucketName }) => {
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);
  const [keepOriginalUsernames, setKeepOriginalUsernames] = useState(true);

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
      setMessage(`Restaurando usuarios${keepOriginalUsernames ? ' con nombres originales' : ' con nombres modificados'}...`);

      // Restaurar solo los usuarios
      const result = await restoreUsers(file, bucketName, keepOriginalUsernames);

      if (result.success) {
        setStatus('success');
        setMessage(`Usuarios restaurados correctamente. ${result.message || ''}`);
        
        // Recargar la página después de 3 segundos para mostrar los cambios
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        throw new Error(result.message || 'Error desconocido al restaurar usuarios');
      }
    } catch (error) {
      console.error('Error en proceso de restauración de usuarios:', error);
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
    <div className="restore-users-container">
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
      
      {/* Botón visible para iniciar la restauración */}
      <button 
        className={`restore-users-button ${status}`}
        onClick={handleFileSelect}
        disabled={status === 'uploading'}
      >
        {status === 'uploading' ? 'Restaurando usuarios...' : 
         status === 'success' ? 'Usuarios restaurados' : 
         'Restaurar Solo Usuarios'}
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
        .restore-users-container {
          margin: 15px 0;
          padding: 10px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          background-color: #fafafa;
        }
        
        .restore-users-button {
          background-color: #9C27B0;
          color: white;
          padding: 10px 15px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .restore-users-button:hover {
          background-color: #7B1FA2;
        }
        
        .restore-users-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .restore-users-button.uploading {
          background-color: #FF9800;
        }
        
        .restore-users-button.success {
          background-color: #4CAF50;
        }
        
        .restore-users-button.error {
          background-color: #f44336;
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
        
        input[type="checkbox"] {
          margin-right: 8px;
        }
      `}</style>
    </div>
  );
};

export default RestoreUsersButton;