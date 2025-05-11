import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthToken, getCurrentBucket } from '../services/auth';
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
  const [restoreUsers, setRestoreUsers] = useState(true);
  
  // Cargar la lista de backups al montar el componente
  useEffect(() => {
    fetchBackupList();
  }, []);

  // Función para obtener la lista de backups
  const fetchBackupList = async () => {
    try {
      setLoadingList(true);
      const response = await axios.get('/api/backup/list', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.data.success) {
        setBackupList(response.data.backups || []);
      } else {
        console.error('Error al obtener lista de backups:', response.data);
        setMessageType('error');
        setMessage('Error al obtener lista de backups: ' + response.data.message);
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
      
      const response = await axios.get(`/api/backup/create/${bucketName}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.data.success) {
        setMessageType('success');
        setMessage('Backup creado exitosamente: ' + response.data.filename);
        fetchBackupList(); // Actualizar lista
      } else {
        setMessageType('error');
        setMessage('Error al crear backup: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error al crear backup:', error);
      setMessageType('error');
      setMessage('Error al crear backup: ' + (error.response?.data?.message || error.message));
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

    // Crear FormData
    const formData = new FormData();
    formData.append('backupFile', selectedFile);
    formData.append('targetBucket', currentBucket);

    // Usar nuestro nuevo endpoint de puente
    setMessage('Enviando archivo al servicio de restauración...');
    
    const response = await axios.post('/api/bridge-restore', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${authToken}`
      },
      timeout: 600000, // 10 minutos (aumentado porque el script puede tardar más)
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setMessage(`Subiendo archivo: ${percentCompleted}% completado...`);
      }
    });

    if (response.data.status === 'success') {
      setMessageType('success');
      setMessage(`Restauración completada: ${response.data.fileCount || 'múltiples'} archivos restaurados`);
      setSelectedFile(null);
      
      // Limpiar input de archivo
      const fileInput = document.getElementById('restoreFile');
      if (fileInput) fileInput.value = '';
      
      // Registrar detalles para debug
      console.log('Detalles de restauración:', response.data);
    } else {
      throw new Error(response.data.message || 'Error desconocido');
    }
  } catch (error) {
    console.error('Error en la restauración:', error);
    setMessageType('error');
    
    if (error.response && error.response.data) {
      console.log('Detalles del error:', error.response.data);
      setMessage(`Error: ${error.response.data.message || error.message}`);
    } else {
      setMessage(`Error: ${error.message}`);
    }
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
      
      const formData = new FormData();
      formData.append('backupFile', selectedFile);
      
      // Configuración mejorada para la carga de archivos
      const response = await axios.post('/api/backup/restore-tags', formData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        },
        // Aumentar el timeout para archivos grandes
        timeout: 300000, // 5 minutos
        // Mostrar progreso de carga si no es silencioso
        onUploadProgress: !silent ? (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setMessage(`Subiendo archivo para restaurar etiquetas: ${percentCompleted}% completado...`);
        } : undefined
      });
      
      if (response.data.success) {
        if (!silent) {
          setMessageType('success');
          setMessage(`Etiquetas restauradas exitosamente: ${response.data.details.success} etiquetas. ${response.data.details.errors || 0} errores.`);
        }
        return true;
      } else {
        if (!silent) {
          setMessageType('error');
          setMessage('Error al restaurar etiquetas: ' + response.data.message);
        }
        return false;
      }
    } catch (error) {
      console.error('Error al restaurar etiquetas:', error);
      if (!silent) {
        setMessageType('error');
        setMessage('Error al restaurar etiquetas: ' + (error.response?.data?.message || error.message));
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
      
      const formData = new FormData();
      formData.append('backupFile', selectedFile);
      
      // Configuración mejorada para la carga de archivos
      const response = await axios.post('/api/backup/check-tags', formData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        },
        // Aumentar el timeout para archivos grandes
        timeout: 300000, // 5 minutos
        // Mostrar progreso de carga
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setMessage(`Subiendo archivo: ${percentCompleted}% completado...`);
        }
      });
      
      if (response.data.success) {
        if (response.data.hasTags) {
          setTagsFound(response.data);
          setMessageType('success');
          setMessage(`Se encontraron ${response.data.tagCount} etiquetas en ${response.data.categories.length} categorías.`);
        } else {
          setTagsFound(null);
          setMessageType('warning');
          setMessage('No se encontraron etiquetas en el archivo de backup.');
        }
      } else {
        setTagsFound(null);
        setMessageType('error');
        setMessage('Error al verificar etiquetas: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error al verificar etiquetas:', error);
      setMessageType('error');
      setMessage('Error al verificar etiquetas: ' + (error.response?.data?.message || error.message));
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
      
      // Crear un enlace para descargar el archivo
      const link = document.createElement('a');
      link.href = `/api/backup/export-tags?bucket=${bucketName}&token=${authToken}`;
      link.setAttribute('download', `tags_export_${bucketName}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setMessageType('success');
      setMessage('Exportación de etiquetas iniciada correctamente');
    } catch (error) {
      console.error('Error al exportar etiquetas:', error);
      setMessageType('error');
      setMessage('Error al exportar etiquetas: ' + (error.response?.data?.message || error.message));
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
      
      const formData = new FormData();
      formData.append('tagsFile', tagFile);
      formData.append('targetBucket', targetBucket);
      formData.append('replaceExisting', replaceExistingTags);
      
      // Configuración mejorada para la carga de archivos
      const response = await axios.post('/api/backup/import-tags', formData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        },
        // Aumentar el timeout para archivos grandes
        timeout: 180000, // 3 minutos
        // Mostrar progreso de carga
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setMessage(`Subiendo archivo de etiquetas: ${percentCompleted}% completado...`);
        }
      });
      
      if (response.data.success) {
        setMessageType('success');
        setMessage(`Etiquetas importadas exitosamente: ${response.data.details.success} etiquetas. ${response.data.details.errors || 0} errores.`);
        setTagFile(null);
        // Resetear el input de archivo
        const fileInput = document.getElementById('tagFile');
        if (fileInput) fileInput.value = '';
      } else {
        setMessageType('error');
        setMessage('Error al importar etiquetas: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error al importar etiquetas:', error);
      setMessageType('error');
      setMessage('Error al importar etiquetas: ' + (error.response?.data?.message || error.message));
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
      
      const formData = new FormData();
      formData.append('backupFile', selectedFile);
      
      // Obtener el bucket usando la función específica
      const targetBucket = getCurrentBucket();
      
      if (!targetBucket) {
        throw new Error('No se pudo determinar el bucket de destino');
      }
      
      formData.append('targetBucket', targetBucket);
      
      // Endoint para restaurar usuarios (asumo que existe basado en la bitácora)
      const response = await axios.post('/api/backup/restore-users', formData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 300000, // 5 minutos
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setMessage(`Subiendo archivo para restaurar usuarios: ${percentCompleted}% completado...`);
        }
      });
      
      if (response.data.success) {
        setMessageType('success');
        setMessage(`Usuarios restaurados exitosamente: ${response.data.details.success} usuarios. ${response.data.details.errors || 0} errores.`);
      } else {
        setMessageType('error');
        setMessage('Error al restaurar usuarios: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error al restaurar usuarios:', error);
      setMessageType('error');
      setMessage('Error al restaurar usuarios: ' + (error.response?.data?.message || error.message));
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
      
      // Crear un enlace de descarga
      const link = document.createElement('a');
      link.href = `/api/backup/download/${filename}`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setMessageType('success');
      setMessage('Descarga iniciada correctamente');
    } catch (error) {
      console.error('Error al descargar backup:', error);
      setMessageType('error');
      setMessage('Error al descargar backup: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
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
                <p>No hay backups disponibles.</p>
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
                        <td>{backup.filename}</td>
                        <td>{new Date(backup.createdAt).toLocaleString()}</td>
                        <td>{(backup.size / (1024 * 1024)).toFixed(2)} MB</td>
                        <td>
                          <button 
                            onClick={() => handleDownloadBackup(backup.filename)}
                            disabled={loading}
                            className="download-button"
                          >
                            Descargar
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
                    checked={restoreUsers} 
                    onChange={(e) => setRestoreUsers(e.target.checked)}
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
                  disabled={!selectedFile || loading || !restoreUsers}
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