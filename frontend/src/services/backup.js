import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthToken, getCurrentBucket } from '../services/auth';
import { 
  listBackups,
  createBackup,
  downloadBackup, 
  restoreBackup,
  restoreTags, 
  checkTags,
  restoreUsers,
  exportTags,
  importTags
} from '../services/backup';
import './BackupRestoreManager.css';

const BackupRestoreManager = () => {
  const authToken = getAuthToken();
  const [selectedFile, setSelectedFile] = useState(null);

  const [backupList, setBackupList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'upload', 'restore', 'tags'
  
  // Estado para tags
  const [tagFile, setTagFile] = useState(null);
  const [tagsFound, setTagsFound] = useState(null);
  const [checkingTags, setCheckingTags] = useState(false);
  const [exportingTags, setExportingTags] = useState(false);
  const [replaceExistingTags, setReplaceExistingTags] = useState(true);
  const [restoreUsersOption, setRestoreUsersOption] = useState(true);
  
  // Cargar la lista de backups al montar el componente
  useEffect(() => {
    fetchBackupList();
    
    // Configurar un intervalo para refrescar la lista cada 30 segundos
    const intervalId = setInterval(() => {
      console.log("Actualizando lista de backups automáticamente...");
      fetchBackupList();
    }, 30000);
    
    // Limpiar el intervalo cuando el componente se desmonte
    return () => clearInterval(intervalId);
  }, []);

  // Función para obtener la lista de backups
  const fetchBackupList = async () => {
    try {
      setLoadingList(true);
      
      const response = await listBackups();
      
      if (response.success) {
        setBackupList(response.backups || []);
        if (response.backups && response.backups.length === 0) {
          setMessageType('info');
          setMessage('No hay backups disponibles en el servidor');
        }
      } else {
        console.error('Error al obtener lista de backups:', response);
        setMessageType('error');
        setMessage('Error al obtener lista de backups: ' + response.message);
      }
    } catch (error) {
      console.error('Error al obtener lista de backups:', error);
      setMessageType('error');
      setMessage('Error al obtener lista de backups: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingList(false);
    }
  };

  // Manejar selección de archivo
  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setMessage('');
    setTagsFound(null); // Resetear la información de etiquetas cuando se cambia el archivo
  };

  // Manejar selección de archivo de etiquetas
  const handleTagFileChange = (event) => {
    setTagFile(event.target.files[0]);
    setTagsFound(null);
    setMessage('');
  };

  // Crear un nuevo backup
  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      setMessage('Creando backup. Esto puede tardar unos minutos...');
      setMessageType('info');
      
      // Obtener el bucket usando la función específica
      const bucketName = getCurrentBucket();
      
      if (!bucketName) {
        throw new Error('No se pudo determinar el bucket para el backup');
      }
      
      const response = await createBackup(bucketName);
      
      if (response.success) {
        setMessageType('success');
        setMessage('Backup creado exitosamente: ' + response.filename);
        
        // Esperar un momento y luego actualizar la lista
        setTimeout(() => {
          fetchBackupList();
        }, 3000);
      } else {
        setMessageType('error');
        setMessage('Error al crear backup: ' + response.message);
      }
    } catch (error) {
      console.error('Error al crear backup:', error);
      setMessageType('error');
      setMessage('Error al crear backup: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Restaurar un backup
  const handleRestoreBackup = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setMessageType('error');
      setMessage('Por favor seleccione un archivo de backup');
      return;
    }

    try {
      setLoading(true);
      setMessage('Preparando restauración...');
      setMessageType('info');

      // Obtener el bucket actual
      const currentBucket = getCurrentBucket();
      if (!currentBucket) {
        throw new Error('No se pudo determinar el bucket de destino');
      }

      setMessage('Enviando archivo al servicio de restauración...');
      
      // Mostrar progreso de carga (simulado ya que fetch no soporta onUploadProgress)
      const progressInterval = setInterval(() => {
        setMessage(prevMessage => {
          if (prevMessage.includes('%')) {
            const currentPercent = parseInt(prevMessage.match(/\d+/)[0]);
            if (currentPercent < 95) {
              return `Subiendo archivo: ${currentPercent + 5}% completado...`;
            }
          }
          return prevMessage;
        });
      }, 1000);
      
      const response = await restoreBackup(selectedFile, currentBucket);
      
      clearInterval(progressInterval);

      if (response.success || response.status === 'success') {
        setMessageType('success');
        setMessage(`Restauración completada: ${response.fileCount || 'múltiples'} archivos restaurados`);
        setSelectedFile(null);
        
        // Limpiar input de archivo
        const fileInput = document.getElementById('restoreFile');
        if (fileInput) fileInput.value = '';
        
        // Registrar detalles para debug
        console.log('Detalles de restauración:', response);
      } else {
        throw new Error(response.message || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error en la restauración:', error);
      setMessageType('error');
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Restaurar solo etiquetas de un backup
  const handleRestoreTags = async (e, silent = false) => {
    if (e && !silent) e.preventDefault();
    
    if (!selectedFile) {
      if (!silent) {
        setMessageType('error');
        setMessage('Por favor seleccione un archivo de backup');
      }
      return;
    }
    
    try {
      if (!silent) {
        setLoading(true);
        setMessage('Restaurando etiquetas. Esto puede tardar unos minutos...');
        setMessageType('info');
      }
      
      // Mostrar progreso de carga (simulado ya que fetch no soporta onUploadProgress)
      let progressInterval;
      
      if (!silent) {
        progressInterval = setInterval(() => {
          setMessage(prevMessage => {
            if (prevMessage.includes('%')) {
              const currentPercent = parseInt(prevMessage.match(/\d+/)[0]);
              if (currentPercent < 95) {
                return `Subiendo archivo para restaurar etiquetas: ${currentPercent + 5}% completado...`;
              }
            }
            return prevMessage;
          });
        }, 1000);
      }
      
      const response = await restoreTags(selectedFile);
      
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      
      if (response.success) {
        if (!silent) {
          setMessageType('success');
          setMessage(`Etiquetas restauradas exitosamente: ${response.details?.success || 0} etiquetas. ${response.details?.errors || 0} errores.`);
        }
        return true;
      } else {
        if (!silent) {
          setMessageType('error');
          setMessage('Error al restaurar etiquetas: ' + response.message);
        }
        return false;
      }
    } catch (error) {
      console.error('Error al restaurar etiquetas:', error);
      if (!silent) {
        setMessageType('error');
        setMessage('Error al restaurar etiquetas: ' + error.message);
      }
      return false;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };
  
  // Verificar etiquetas en un backup
  const handleCheckTags = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setMessageType('error');
      setMessage('Por favor seleccione un archivo de backup');
      return;
    }
    
    try {
      setCheckingTags(true);
      setMessage('Verificando etiquetas en el backup...');
      setMessageType('info');
      
      // Mostrar progreso de carga (simulado ya que fetch no soporta onUploadProgress)
      const progressInterval = setInterval(() => {
        setMessage(prevMessage => {
          if (prevMessage.includes('%')) {
            const currentPercent = parseInt(prevMessage.match(/\d+/)[0]);
            if (currentPercent < 95) {
              return `Subiendo archivo: ${currentPercent + 5}% completado...`;
            }
          }
          return prevMessage;
        });
      }, 1000);
      
      const response = await checkTags(selectedFile);
      
      clearInterval(progressInterval);
      
      if (response.success) {
        if (response.hasTags) {
          setTagsFound(response);
          setMessageType('success');
          setMessage(`Se encontraron ${response.tagCount} etiquetas en ${response.categories.length} categorías.`);
        } else {
          setTagsFound(null);
          setMessageType('warning');
          setMessage('No se encontraron etiquetas en el archivo de backup.');
        }
      } else {
        setTagsFound(null);
        setMessageType('error');
        setMessage('Error al verificar etiquetas: ' + response.message);
      }
    } catch (error) {
      console.error('Error al verificar etiquetas:', error);
      setMessageType('error');
      setMessage('Error al verificar etiquetas: ' + error.message);
    } finally {
      setCheckingTags(false);
    }
  };
  
  // Exportar etiquetas
  const handleExportTags = async () => {
    try {
      setExportingTags(true);
      setMessage('Exportando etiquetas. Se iniciará una descarga automáticamente...');
      setMessageType('info');
      
      // Obtener el bucket usando la función específica
      const bucketName = getCurrentBucket();
      
      if (!bucketName) {
        throw new Error('No se pudo determinar el bucket para exportar etiquetas');
      }
      
      const response = await exportTags(bucketName);
      
      if (response.success) {
        setMessageType('success');
        setMessage('Exportación de etiquetas iniciada correctamente');
      } else {
        throw new Error(response.message || 'Error en la exportación');
      }
    } catch (error) {
      console.error('Error al exportar etiquetas:', error);
      setMessageType('error');
      setMessage('Error al exportar etiquetas: ' + error.message);
    } finally {
      setExportingTags(false);
    }
  };
  
  // Importar etiquetas
  const handleImportTags = async (e) => {
    e.preventDefault();
    
    if (!tagFile) {
      setMessageType('error');
      setMessage('Por favor seleccione un archivo de etiquetas JSON');
      return;
    }
    
    try {
      setLoading(true);
      setMessage('Importando etiquetas...');
      setMessageType('info');
      
      // Obtener el bucket usando la función específica
      const targetBucket = getCurrentBucket();
      
      if (!targetBucket) {
        throw new Error('No se pudo determinar el bucket de destino');
      }
      
      // Mostrar progreso de carga (simulado ya que fetch no soporta onUploadProgress)
      const progressInterval = setInterval(() => {
        setMessage(prevMessage => {
          if (prevMessage.includes('%')) {
            const currentPercent = parseInt(prevMessage.match(/\d+/)[0]);
            if (currentPercent < 95) {
              return `Subiendo archivo de etiquetas: ${currentPercent + 5}% completado...`;
            }
          }
          return prevMessage;
        });
      }, 1000);
      
      const response = await importTags(tagFile, targetBucket, replaceExistingTags);
      
      clearInterval(progressInterval);
      
      if (response.success) {
        setMessageType('success');
        setMessage(`Etiquetas importadas exitosamente: ${response.details?.success || 0} etiquetas. ${response.details?.errors || 0} errores.`);
        setTagFile(null);
        // Resetear el input de archivo

        const fileInput = document.getElementById('tagFile');
        if (fileInput) fileInput.value = '';
      } else {
        setMessageType('error');
        setMessage('Error al importar etiquetas: ' + response.message);
      }
    } catch (error) {
      console.error('Error al importar etiquetas:', error);
      setMessageType('error');
      setMessage('Error al importar etiquetas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Restaurar usuarios
  const handleRestoreUsers = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setMessageType('error');
      setMessage('Por favor seleccione un archivo de backup');
      return;
    }
    
    try {
      setLoading(true);
      setMessage('Restaurando usuarios. Esto puede tardar unos minutos...');
      setMessageType('info');
      
      // Obtener el bucket usando la función específica
      const targetBucket = getCurrentBucket();
      
      if (!targetBucket) {
        throw new Error('No se pudo determinar el bucket de destino');
      }
      
      // Mostrar progreso de carga (simulado ya que fetch no soporta onUploadProgress)
      const progressInterval = setInterval(() => {
        setMessage(prevMessage => {
          if (prevMessage.includes('%')) {
            const currentPercent = parseInt(prevMessage.match(/\d+/)[0]);
            if (currentPercent < 95) {
              return `Subiendo archivo para restaurar usuarios: ${currentPercent + 5}% completado...`;
            }
          }
          return prevMessage;
        });
      }, 1000);
      
      const response = await restoreUsers(selectedFile, targetBucket);
      
      clearInterval(progressInterval);
      
      if (response.success) {
        setMessageType('success');
        setMessage(`Usuarios restaurados exitosamente: ${response.details?.success || 0} usuarios. ${response.details?.errors || 0} errores.`);
      } else {
        setMessageType('error');
        setMessage('Error al restaurar usuarios: ' + response.message);
      }
    } catch (error) {
      console.error('Error al restaurar usuarios:', error);
      setMessageType('error');
      setMessage('Error al restaurar usuarios: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Descargar un backup
  const handleDownloadBackup = async (filename) => {
    try {
      setLoading(true);
      setMessage('Preparando descarga...');
      setMessageType('info');
      
      const response = await downloadBackup(filename);
      
      if (response.success) {
        setMessageType('success');
        setMessage('Descarga iniciada correctamente');
      } else {
        throw new Error(response.message || 'Error al iniciar la descarga');
      }
    } catch (error) {
      console.error('Error al descargar backup:', error);
      setMessageType('error');
      setMessage('Error al descargar backup: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Debug function - mostrar un backup específico
  const debugShowBackupDetails = (backup) => {
    console.log("Detalles del backup:", backup);
    alert(JSON.stringify(backup, null, 2));
  };

  return (
    <div className="backup-restore-manager">
      <h2>Gestión de Copias de Seguridad</h2>
      
      <div className="tabs">
        <button 
          className={`tab-button ${activeTab === 'list' ? 'active' : ''}`} 
          onClick={() => setActiveTab('list')}
        >
          Lista de Backups
        </button>
        <button 
          className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`} 
          onClick={() => setActiveTab('upload')}
        >
          Crear Backup
        </button>
        <button 
          className={`tab-button ${activeTab === 'restore' ? 'active' : ''}`} 
          onClick={() => setActiveTab('restore')}
        >
          Restaurar Backup
        </button>
        <button 
          className={`tab-button ${activeTab === 'tags' ? 'active' : ''}`} 
          onClick={() => setActiveTab('tags')}
        >
          Gestión de Etiquetas
        </button>
      </div>
      
      {/* Pestaña de Lista de Backups */}
      {activeTab === 'list' && (
        <div className="tab-content">
          <h3>Backups Disponibles</h3>
          <button 
            className="refresh-button" 
            onClick={fetchBackupList} 
            disabled={loadingList}
          >
            {loadingList ? 'Actualizando...' : 'Actualizar Lista'}
          </button>
          
          {loadingList ? (
            <p>Cargando backups...</p>
          ) : (
            <div className="backup-list">
              {backupList.length === 0 ? (
                <p>No hay backups disponibles. <a href="#" onClick={() => setActiveTab('upload')}>Cree un nuevo backup</a>.</p>
              ) : (
                <table className="backup-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Fecha</th>
                      <th>Tamaño</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupList.map((backup, index) => (
                      <tr key={index}>
                        <td>{backup.filename || backup.name}</td>
                        <td>{new Date(backup.createdAt || backup.created || backup.timestamp || Date.now()).toLocaleString()}</td>
                        <td>{((backup.size || backup.fileSize || 0) / (1024 * 1024)).toFixed(2)} MB</td>
                        <td>
                          <button 
                            onClick={() => handleDownloadBackup(backup.filename || backup.name)}
                            disabled={loading}
                            className="download-button"
                          >
                            Descargar
                          </button>
                          <button 
                            onClick={() => debugShowBackupDetails(backup)}
                            className="debug-button"
                            style={{ display: 'none' }} // Oculto por defecto
                          >
                            Debug
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Pestaña de Crear Backup */}
      {activeTab === 'upload' && (
        <div className="tab-content">
          <h3>Crear Nuevo Backup</h3>
          <p className="instructions">
            Esta acción creará una copia de seguridad completa del bucket actual, incluyendo archivos, etiquetas y usuarios.
            El proceso puede tardar varios minutos dependiendo del tamaño de los datos.
          </p>
          
          <button 
            onClick={handleCreateBackup} 
            disabled={loading}
            className="primary-button"
          >
            {loading ? 'Creando Backup...' : 'Crear Backup'}
          </button>
        </div>
      )}
      
      {/* Pestaña de Restaurar Backup */}
      {activeTab === 'restore' && (
        <div className="tab-content">
          <h3>Restaurar desde Backup</h3>
          <p className="instructions">
            Seleccione un archivo de copia de seguridad (.zip) para restaurar. Esta acción reemplazará los datos actuales.
            <strong>Importante:</strong> Para restaurar completamente, incluyendo etiquetas y usuarios, use la opción "Restaurar Todo".
          </p>
          
          <form onSubmit={handleRestoreBackup} className="restore-form">
            <div className="file-input-container">
              <label htmlFor="restoreFile">Archivo de Backup:</label>
              <input 
                type="file" 
                id="restoreFile" 
                accept=".zip" 
                onChange={handleFileChange} 
                disabled={loading}
              />
            </div>
            
            <div className="restore-options">
              <h4>Opciones de Restauración:</h4>
              
              <div className="option-checkboxes">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={restoreUsersOption} 
                    onChange={(e) => setRestoreUsersOption(e.target.checked)}
                    disabled={loading}
                  />
                  Restaurar usuarios dinámicos (creados por administrador)
                </label>
              </div>
              
              <div className="restore-buttons">
                <button 
                  type="submit" 
                  disabled={!selectedFile || loading}
                  className="primary-button"
                >
                  Restaurar Todo
                </button>
                
                <button 
                  type="button" 
                  onClick={handleRestoreTags} 
                  disabled={!selectedFile || loading}
                  className="secondary-button"
                >
                  Restaurar Solo Etiquetas
                </button>
                
                <button 
                  type="button" 
                  onClick={handleRestoreUsers} 
                  disabled={!selectedFile || loading || !restoreUsersOption}
                  className="secondary-button"
                >
                  Restaurar Solo Usuarios
                </button>
                
                <button 
                  type="button" 
                  onClick={handleCheckTags} 
                  disabled={!selectedFile || loading || checkingTags}
                  className="info-button"
                >
                  {checkingTags ? 'Verificando...' : 'Verificar Etiquetas'}
                </button>
              </div>
            </div>
            
            {tagsFound && (
              <div className="tags-info">
                <h4>Etiquetas Encontradas:</h4>
                <p>Total de etiquetas: {tagsFound.tagCount}</p>
                <p>Categorías: {tagsFound.categories.length}</p>
                
                <div className="tags-categories">
                  {tagsFound.categories.map((category, index) => (
                    <details key={index}>
                      <summary>{category} ({tagsFound.tagsByCategory[category].length})</summary>
                      <ul>
                        {tagsFound.tagsByCategory[category].map((tag, tagIndex) => (
                          <li key={tagIndex}>{tag}</li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      )}
      
      {/* Pestaña de Gestión de Etiquetas */}
      {activeTab === 'tags' && (
        <div className="tab-content">
          <h3>Gestión de Etiquetas</h3>
          
          <div className="tags-section">
            <h4>Exportar Etiquetas</h4>
            <p className="instructions">
              Exportar todas las etiquetas del bucket actual a un archivo JSON para backup o migración.
            </p>
            
            <button 
              onClick={handleExportTags} 
              disabled={exportingTags}
              className="primary-button"
            >
              {exportingTags ? 'Exportando...' : 'Exportar Etiquetas'}
            </button>
          </div>
          
          <div className="tags-section">
            <h4>Importar Etiquetas</h4>
            <p className="instructions">
              Importar etiquetas desde un archivo JSON exportado previamente. Puede elegir reemplazar todas las etiquetas 
              existentes o solo añadir las nuevas.
            </p>
            
            <form onSubmit={handleImportTags} className="import-form">
              <div className="file-input-container">
                <label htmlFor="tagFile">Archivo de Etiquetas JSON:</label>
                <input 
                  type="file" 
                  id="tagFile" 
                  accept=".json" 
                  onChange={handleTagFileChange} 
                  disabled={loading}
                />
              </div>
              
              <div className="import-options">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={replaceExistingTags} 
                    onChange={(e) => setReplaceExistingTags(e.target.checked)}
                    disabled={loading}
                  />
                  Reemplazar etiquetas existentes (desmarca para añadir solo nuevas)
                </label>
              </div>
              
              <button 
                type="submit" 
                disabled={!tagFile || loading}
                className="primary-button"
              >
                {loading ? 'Importando...' : 'Importar Etiquetas'}
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Mensajes */}
      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default BackupRestoreManager;