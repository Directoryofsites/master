import React, { useState } from 'react';
import * as api from '../services/api';  // Importar todo el módulo api

const FileActions = ({ currentPath, onActionComplete }) => {
  const [folderName, setFolderName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFolderInput, setShowFolderInput] = useState(false);

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      setError('Por favor ingrese un nombre de carpeta válido');
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
          {error && <div className="error-message">{error}</div>}
        </div>
      ) : (
        <button
          onClick={() => setShowFolderInput(true)}
          className="btn btn-primary"
        >
          Nueva Carpeta
        </button>
      )}
    </div>
  );
};

export default FileActions;