import React, { useState, useEffect } from 'react';
import FileList from './FileList';
import FileActions from './FileActions';
import UploadForm from './UploadForm';
import SearchForm from './SearchForm';  // Importar el nuevo componente
import * as api from '../services/api';  // Importar todo el módulo api

const FileExplorer = ({ userRole, username }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSearchMode, setIsSearchMode] = useState(false);  // Nuevo estado para modo de búsqueda
  const [searchResults, setSearchResults] = useState([]);   // Estado para resultados de búsqueda
  const [searchTerm, setSearchTerm] = useState('');         // Almacenar el término de búsqueda actual

  const fetchFiles = async (path) => {
    if (isSearchMode) return; // No cargar archivos si estamos en modo búsqueda
    
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listFiles(path);  // Usar api.listFiles
      setFiles(data);
    } catch (err) {
      console.error('Error al cargar archivos:', err);
      setError('No se pudieron cargar los archivos. Por favor intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath, isSearchMode]);

  const handleNavigate = (newPath) => {
    // Si estamos en modo búsqueda, salir del modo búsqueda
    if (isSearchMode) {
      setIsSearchMode(false);
      setSearchResults([]);
      setSearchTerm('');
    }
    setCurrentPath(newPath);
  };

  const handleActionComplete = () => {
    // Refrescar la lista de archivos después de una acción
    fetchFiles(currentPath);
  };

  // Nueva función para manejar la búsqueda
  const handleSearch = async (term) => {
    setIsLoading(true);
    setError(null);
    setSearchTerm(term);
    
    try {
      const results = await api.searchFiles(term);
      setSearchResults(results);
      setIsSearchMode(true);
    } catch (err) {
      console.error('Error en la búsqueda:', err);
      setError(`Error al realizar la búsqueda: ${err.message}`);
      setIsSearchMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para salir del modo búsqueda
  const handleClearSearch = () => {
    setIsSearchMode(false);
    setSearchResults([]);
    setSearchTerm('');
  };

  return (
    <div className="file-explorer">
      <h2>Explorador de Archivos</h2>
      
      <div className="explorer-header">
        <div className="current-path">
          <strong>Ubicación actual:</strong> {currentPath || 'Raíz'}
          {isSearchMode && (
            <>
              <span className="search-indicator">
                | Resultados para: "{searchTerm}"
              </span>
              <button onClick={handleClearSearch} className="clear-search-button">
                Volver
              </button>
            </>
          )}
        </div>
      </div>
      
      <SearchForm onSearch={handleSearch} isLoading={isLoading} />
      
      {error && <div className="error-message">{error}</div>}
      
      {isLoading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <>
          <FileList 
            files={isSearchMode ? searchResults : files} 
            currentPath={currentPath} 
            onNavigate={handleNavigate} 
            userRole={userRole}
            onActionComplete={handleActionComplete}
            isSearchResults={isSearchMode}
          />
          
          {!isSearchMode && userRole === 'admin' && (
            <div className="admin-actions">
              <FileActions 
                currentPath={currentPath} 
                onActionComplete={handleActionComplete} 
              />
              
              <UploadForm 
                currentPath={currentPath} 
                onUploadComplete={handleActionComplete} 
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FileExplorer;