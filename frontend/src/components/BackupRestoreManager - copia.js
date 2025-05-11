import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './BackupRestoreManager.css';
import RestoreBackupButton from './RestoreBackupButton';

const BackupRestoreManager = () => {
  // Estados
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('backup'); // 'backup' o 'restore'
  const [userBucket, setUserBucket] = useState('');
  
  // Cargar la lista de backups al montar el componente
  useEffect(() => {
    fetchBackups();
    
    // Obtener información del bucket del usuario
    const userSession = localStorage.getItem('user_session');
    if (userSession) {
      const userData = JSON.parse(userSession);
      setUserBucket(userData.bucket || 'No definido');
    }
  }, []);
  
  // Función para cargar la lista de backups
  const fetchBackups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/backup/list');
      setBackups(response.data.backups || []);
    } catch (err) {
      console.error('Error al cargar backups:', err);
      setError('No se pudieron cargar los backups. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Función para crear un backup
  const createBackup = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // Obtener el bucket del usuario desde localStorage
      const userSession = localStorage.getItem('user_session');
      if (!userSession) {
        setError('No se pudo obtener información del usuario');
        setLoading(false);
        return;
      }
      
      const userData = JSON.parse(userSession);
      const bucketName = userData.bucket;
      
      if (!bucketName) {
        setError('No se pudo determinar el bucket del usuario');
        setLoading(false);
        return;
      }
      
      const response = await axios.get(`/api/backup/create/${bucketName}`);
      
      if (response.data.success) {
        setSuccess(`Backup creado exitosamente: ${response.data.filename}`);
        fetchBackups(); // Actualizar la lista de backups
      } else {
        setError(response.data.message || 'Error al crear el backup');
      }
    } catch (err) {
      console.error('Error al crear backup:', err);
      setError('No se pudo crear el backup. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Función para restaurar un backup desde la lista de backups disponibles
const restoreBackup = (filename) => {
  if (!window.confirm(`¿Está seguro que desea restaurar el backup ${filename}? Esta acción sobrescribirá los datos actuales.`)) {
    return;
  }
  
  setLoading(true);
  setError(null);
  setSuccess(null);
  
  // Usamos una función asíncrona auto-ejecutada dentro de la función normal
  (async function() {
    try {
      // Obtenemos el backup seleccionado
      const backupToRestore = backups.find(backup => backup.filename === filename);
      if (!backupToRestore || !backupToRestore.downloadUrl) {
        setError('No se pudo encontrar la URL de descarga del backup');
        setLoading(false);
        return;
      }
      
      // Mostrar mensaje informativo inicial
      setSuccess('Descargando archivo de backup...');
      
      // Descargar el archivo de backup
      const fileResponse = await fetch(backupToRestore.downloadUrl);
      if (!fileResponse.ok) {
        throw new Error(`Error al descargar el backup: ${fileResponse.status} ${fileResponse.statusText}`);
      }
      
      const backupBlob = await fileResponse.blob();
      const backupFile = new File([backupBlob], filename, { type: 'application/zip' });
      
      // Importar auth para obtener el token
      const auth = await import('../services/auth');
      const token = auth.getAuthToken();
      
      // Obtener el bucket al que restaurar
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
      formData.append('backupFile', backupFile);
      formData.append('targetBucket', bucketName);
      
      // Obtener la URL base actual en lugar de hardcodearla
      const baseUrl = window.location.origin;
      const restoreUrl = `${baseUrl}/api/admin/restore`;
      
      // Mostrar mensajes de progreso
      setSuccess('Iniciando restauración...');
      
      // Usar XMLHttpRequest para tener mejor control sobre la transferencia
      const uploadResult = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', restoreUrl, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.timeout = 300000; // 5 minutos de timeout
        
        // Monitorear progreso
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setSuccess(`Subiendo archivo: ${percentComplete}%`);
          }
        };
        
        // Manejar respuesta
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (e) {
              reject(new Error(`Error al procesar respuesta: ${e.message}`));
            }
          } else {
            let errorMsg = `Error en el servidor: ${xhr.status}`;
            try {
              const errorObj = JSON.parse(xhr.responseText);
              errorMsg += ` - ${errorObj.message || ''}`;
            } catch (e) {
              if (xhr.responseText) {
                errorMsg += ` - ${xhr.responseText}`;
              }
            }
            reject(new Error(errorMsg));
          }
        };
        
        // Manejar errores de red
        xhr.onerror = function() {
          reject(new Error('Error de red al intentar restaurar'));
        };
        
        // Manejar timeout
        xhr.ontimeout = function() {
          reject(new Error('Tiempo de espera agotado durante la restauración'));
        };
        
        // Enviar formulario
        xhr.send(formData);
      });
      
      // Mostrar mensaje de éxito
      setSuccess('Restauración completada exitosamente. El sistema se actualizará en breve.');
      
      // Recargar la página después de 3 segundos
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (err) {
      console.error('Error al restaurar backup:', err);
      setError(`No se pudo restaurar el backup: ${err.message}`);
    } finally {
      setLoading(false);
    }
  })();
};
  
  // Función para formatear la fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Función para formatear el tamaño en bytes
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };
  
  return (
  <div className="backup-restore-container">
    <h1>Sistema de Copias de Seguridad</h1>
    
    <div className="bucket-info">
      <p>Bucket actual: <strong>{userBucket}</strong></p>
    </div>
    
    {/* Pestañas */}
    <div className="tabs">
      <button 
        className={activeTab === 'backup' ? 'active' : ''} 
        onClick={() => setActiveTab('backup')}
      >
        Crear Backup
      </button>
      <button 
        className={activeTab === 'restore' ? 'active' : ''} 
        onClick={() => setActiveTab('restore')}
      >
        Restaurar Backup
      </button>
    </div>
    
    {/* Mensajes de éxito y error */}
    {error && (
      <div className="error-message">
        <p>{error}</p>
        <button onClick={() => setError(null)}>×</button>
      </div>
    )}
    
    {success && (
      <div className="success-message">
        <p>{success}</p>
        <button onClick={() => setSuccess(null)}>×</button>
      </div>
    )}
    
    {/* Contenido de la pestaña */}
    <div className="tab-content">
      {activeTab === 'backup' ? (
        <div className="backup-section">
          <h2>Crear Copia de Seguridad</h2>
          <p>Crear una copia de seguridad de todos los datos en su bucket.</p>
          <button 
            className="action-button" 
            onClick={createBackup} 
            disabled={loading}
          >
            {loading ? 'Creando backup...' : 'Crear Backup Ahora'}
          </button>
        </div>
      ) : (
        <div className="restore-section">
          <h2>Restaurar Copia de Seguridad</h2>
          
         {/* Implementación directa de carga de backup */}

<div className="manual-restore">
  <h3>Restaurar desde archivo</h3>
  <p>Seleccione un archivo .zip de backup para restaurar:</p>
  <RestoreBackupButton 
    onSuccess={() => {
      setSuccess('Restauración completada exitosamente');
      // Recargar la página después de la restauración
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }} 
  />
</div>

<h3>Copias de seguridad disponibles</h3>                  

          <p>Seleccione un archivo de backup del listado para restaurar:</p>
          
          {backups.length === 0 ? (
            <p className="no-backups">No hay copias de seguridad disponibles</p>
          ) : (
            <div className="backups-list">
              <table>
                <thead>
                  <tr>
                    <th>Nombre del Archivo</th>
                    <th>Fecha de Creación</th>
                    <th>Tamaño</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => (
                    <tr key={backup.filename}>
                      <td>{backup.filename}</td>
                      <td>{formatDate(backup.createdAt)}</td>
                      <td>{formatSize(backup.size)}</td>
                      <td>
                        <button 
                          className="restore-button" 
                          onClick={() => restoreBackup(backup.filename)} 
                          disabled={loading}
                        >
                          Restaurar
                        </button>
                        <a 
                          href={backup.downloadUrl} 
                          className="download-button"
                          download
                        >
                          Descargar
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);
};

export default BackupRestoreManager;