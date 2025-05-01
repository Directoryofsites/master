// Este código debe ir en frontend/src/components/BackupButton.js

import React, { useState } from 'react';
import { generateBackupDirect, checkBackupSystemStatus } from '../services/backup';

/**
 * Componente de botón para generar copias de seguridad
 * Este componente está diseñado para funcionar con un backend hosteado en Railway
 */
const BackupButton = ({ bucketName }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  /**
   * Verifica el sistema de backup antes de iniciar la descarga
   */
  const handleBackup = async () => {
    try {
      setLoading(true);
      setError(null);
      setStatusMessage('Verificando sistema...');

      // Verificar que el sistema de backup está listo
      const statusCheck = await checkBackupSystemStatus();
      
      if (!statusCheck.success || !statusCheck.status.supabaseConfigured || !statusCheck.status.bucketPermissions) {
        setError('El sistema de backup no está disponible en este momento. Verifica la configuración del servidor.');
        console.error('Estado del sistema:', statusCheck);
        return;
      }
      
      setStatusMessage('Generando copia de seguridad...');
      
      // Iniciar la descarga de la copia
      generateBackupDirect(bucketName);
      
      setStatusMessage('Descarga iniciada. El archivo se guardará en su carpeta de descargas.');
      
      // Limpiar el mensaje después de unos segundos
      setTimeout(() => {
        setStatusMessage('');
      }, 5000);
    } catch (err) {
      console.error('Error al generar backup:', err);
      setError(`Error al generar la copia de seguridad: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="backup-button-container">
      <button 
        className="backup-button"
        onClick={handleBackup}
        disabled={loading}
      >
        {loading ? 'Procesando...' : 'Generar Copia de Seguridad'}
      </button>

      {statusMessage && (
        <div className="status-message">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <style jsx>{`
        .backup-button-container {
          margin: 20px 0;
        }
        
        .backup-button {
          background-color: #4CAF50;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          transition: background-color 0.3s;
        }
        
        .backup-button:hover {
          background-color: #45a049;
        }
        
        .backup-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .status-message {
          margin-top: 10px;
          color: #3498db;
        }
        
        .error-message {
          margin-top: 10px;
          color: #e74c3c;
          background-color: #fadbd8;
          padding: 10px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default BackupButton;