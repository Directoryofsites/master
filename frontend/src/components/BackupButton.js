import React, { useState } from 'react';
import { generateBackup, checkBackupStatus } from '../services/backup'; // Asegúrate que la ruta coincida

/**
 * Componente de botón para generar copias de seguridad
 * Optimizado para funcionar con backend en Railway
 */
const BackupButton = () => {
  const [status, setStatus] = useState('idle'); // idle, checking, downloading, error
  const [message, setMessage] = useState('');

  /**
   * Inicia el proceso de backup
   */
  const handleBackup = async () => {
    try {
      // Cambiar estado a verificando
      setStatus('checking');
      setMessage('Verificando disponibilidad del sistema...');

      // Verificar estado del sistema de backup
      const statusResponse = await checkBackupStatus();
      
      if (!statusResponse.success) {
        throw new Error('El sistema de backup no está disponible en este momento');
      }
      
      // Todo ok, iniciar descarga
      setStatus('downloading');
      setMessage('Iniciando descarga...');
      
      // Generar backup (esto abrirá la descarga)
      generateBackup();
      
      // Mostrar mensaje de éxito
      setMessage('Descarga iniciada. Por favor, espere mientras se genera el archivo.');
      
      // Volver a estado normal después de unos segundos
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 5000);
      
    } catch (error) {
      console.error('Error en proceso de backup:', error);
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="backup-container">
      <button 
        className={`backup-button ${status}`}
        onClick={handleBackup}
        disabled={status === 'checking' || status === 'downloading'}
      >
        {status === 'checking' ? 'Verificando...' : 
         status === 'downloading' ? 'Generando backup...' : 
         'Generar Copia de Seguridad'}
      </button>
      
      {message && (
        <div className={`message ${status}`}>
          {message}
        </div>
      )}
      
      <style jsx>{`
        .backup-container {
          margin: 15px 0;
          padding: 10px;
        }
        
        .backup-button {
          background-color: #4CAF50;
          color: white;
          padding: 10px 15px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .backup-button:hover {
          background-color: #45a049;
        }
        
        .backup-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .backup-button.checking {
          background-color: #2196F3;
        }
        
        .backup-button.downloading {
          background-color: #FF9800;
        }
        
        .backup-button.error {
          background-color: #f44336;
        }
        
        .message {
          margin-top: 10px;
          padding: 8px;
          border-radius: 4px;
        }
        
        .message.checking {
          color: #0D47A1;
          background-color: #E3F2FD;
        }
        
        .message.downloading {
          color: #E65100;
          background-color: #FFF3E0;
        }
        
        .message.error {
          color: #B71C1C;
          background-color: #FFEBEE;
        }
      `}</style>
    </div>
  );
};

export default BackupButton;