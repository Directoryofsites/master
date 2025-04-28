import React, { useState } from 'react';
import * as api from '../services/api';  // Importar todo el módulo api
import { hasAdminPermission } from '../services/auth';  // Importar función de verificación de permisos

const FileActions = ({ currentPath, selectedFile, onActionComplete }) => {
  const [folderName, setFolderName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showFolderInput, setShowFolderInput] = useState(false);

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      setError('Por favor ingrese un nombre de carpeta válido');
      return;
    }
  
    // Verificar si el usuario tiene permiso para crear carpetas
    if (!hasAdminPermission('create_folders')) {
      setError('No tienes permiso para crear carpetas');
      return;
    }
  
    setIsLoading(true);
    setError(null);
  
    try {
      // Crear la ruta completa combinando la ruta actual con el nombre de la carpeta
      const fullFolderName = currentPath ? `${currentPath}/${folderName}` : folderName;
      
      console.log('Creando carpeta:', fullFolderName);
      
      const result = await api.createFolder(fullFolderName);
  
      if (result && result.success) {
        setFolderName('');
        setShowFolderInput(false);
        alert('Carpeta creada correctamente');
        if (onActionComplete) {
          onActionComplete();
        }
      } else {
        setError(`Error: ${result && result.message ? result.message : 'No se pudo crear la carpeta'}`);
      }
    } catch (error) {
      console.error('Error al crear carpeta:', error);
      setError(`Error: ${error.message || 'Ocurrió un error al crear la carpeta'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Nueva función para manejar la transcripción de audio
  const handleTranscribeAudio = async () => {
    if (!selectedFile || !selectedFile.path) {
      setError('No hay archivo seleccionado para transcribir');
      return;
    }

    if (!selectedFile.path.toLowerCase().endsWith('.mp3')) {
      setError('Solo se pueden transcribir archivos MP3');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Confirmar si desea eliminar el original
      const confirmDelete = window.confirm(
        '¿Desea eliminar el archivo MP3 original después de la transcripción? Esto ahorrará espacio de almacenamiento.'
      );

      console.log('Transcribiendo archivo:', selectedFile.path);
      
      // Llamar a la API para transcribir
      const result = await api.transcribeAudio(selectedFile.path, confirmDelete);

      if (result && result.success) {
        setSuccess('Archivo transcrito correctamente. El texto se ha guardado en la misma carpeta.');
        if (onActionComplete) {
          onActionComplete();
        }
      } else {
        setError(`Error: ${result && result.message ? result.message : 'No se pudo transcribir el archivo'}`);
      }
    } catch (error) {
      console.error('Error al transcribir audio:', error);
      setError(`Error: ${error.message || 'Ocurrió un error al transcribir el audio'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="file-actions">
      {showFolderInput ? (
        <div className="folder-input-container">
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Nombre de la carpeta"
            className="folder-input"
            disabled={isLoading}
          />
          <div className="folder-input-buttons">
            <button 
              onClick={handleCreateFolder} 
              className="btn btn-primary btn-sm" 
              disabled={isLoading}
            >
              {isLoading ? 'Creando...' : 'Crear'}
            </button>
            <button 
              onClick={() => {
                setShowFolderInput(false);
                setFolderName('');
                setError(null);
              }} 
              className="btn btn-secondary btn-sm" 
              disabled={isLoading}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="action-buttons">
          {hasAdminPermission('create_folders') && (
            <button
              onClick={() => setShowFolderInput(true)}
              className="btn btn-primary"
              disabled={isLoading}
            >
              Nueva Carpeta
            </button>
          )}
          
          {/* Nuevo botón para transcribir audio MP3 */}
          {selectedFile && selectedFile.path && selectedFile.path.toLowerCase().endsWith('.mp3') && (
            <button
              onClick={handleTranscribeAudio}
              className="btn btn-info ml-2"
              disabled={isLoading}
            >
              {isLoading ? 'Transcribiendo...' : 'Transcribir Audio'}
            </button>
          )}
        </div>
      )}
      
      {/* Mostrar mensajes de error o éxito */}
      {error && <div className="error-message mt-2">{error}</div>}
      {success && <div className="success-message mt-2">{success}</div>}
    </div>
  );
};

export default FileActions;