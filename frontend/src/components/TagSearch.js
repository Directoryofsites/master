import React, { useState } from 'react';
import * as api from '../services/api';
import TagSelector from './TagSelector';

const TagSearch = ({ onResults }) => {
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');

  // Manejar cambios en las etiquetas seleccionadas
  const handleTagsChange = (tags) => {
    setSelectedTags(tags);
  };

  // Realizar la búsqueda
  const handleSearch = async () => {
    if (selectedTags.length === 0) {
      setError('Por favor, seleccione al menos una etiqueta para buscar.');
      return;
    }

    try {
      setIsSearching(true);
      setError('');
      
      // Extraer IDs de las etiquetas seleccionadas
      const tagIds = selectedTags.map(tag => tag.id);
      
      console.log(`Buscando archivos con etiquetas: ${selectedTags.map(tag => tag.name).join(', ')}`);
      
      // Llamar a la API para buscar por múltiples etiquetas usando IDs
      const results = await api.searchFilesByMultipleTags(tagIds.join(','), true);
      
      // Almacenar los resultados localmente
      setSearchResults(results);
      setHasSearched(true);
      
      // Pasar los resultados al componente padre si existe la función onResults
      if (typeof onResults === 'function') {
        onResults(results);
      }
    } catch (err) {
      console.error('Error al buscar por etiquetas:', err);
      setError(`Error al realizar la búsqueda: ${err.message}`);
      setSearchResults([]);
      
      // También informar al padre del error
      if (typeof onResults === 'function') {
        onResults([]);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Mostrar resultados de búsqueda
  const renderSearchResults = () => {
    if (!hasSearched) {
      return null;
    }

    if (searchResults.length === 0) {
      return (
        <div className="no-results">
          No se encontraron archivos con todas las etiquetas seleccionadas.
        </div>
      );
    }

    return (
      <div className="search-results">
        <h3>Resultados de la búsqueda ({searchResults.length})</h3>
        <div className="results-grid">
          {searchResults.map((file, index) => (
            <div key={index} className="result-item">
              <div className="file-icon">
                {getFileIcon(file.contentType)}
              </div>
              <div className="file-info">
                <a href={`#${file.path}`} className="file-name" onClick={(e) => handleFileClick(e, file)}>
                  {file.name}
                </a>
                <div className="file-details">
                  <span className="file-path">{file.path}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                {file.metadata && file.metadata.tags && (
                  <div className="file-tags">
                    {file.metadata.tags.map((tag, tagIndex) => (
                      <span key={tagIndex} className="file-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Función para manejar el clic en un archivo
  const handleFileClick = (e, file) => {
    e.preventDefault();
    
    // Aquí puedes implementar lo que sucede al hacer clic en un archivo
    // Por ejemplo, abrir un preview, descargar, etc.
    console.log('Archivo seleccionado:', file);
    
    // Ejemplo: Descargar el archivo
    api.getDownloadUrl(file.path)
      .then(url => {
        window.open(url, '_blank');
      })
      .catch(err => {
        console.error('Error al obtener URL de descarga:', err);
        alert(`Error al abrir el archivo: ${err.message}`);
      });
  };

  // Función para obtener un icono según el tipo de archivo
  const getFileIcon = (contentType) => {
    if (!contentType) return '📄';
    
    if (contentType.startsWith('image/')) return '🖼️';
    if (contentType.includes('pdf')) return '📕';
    if (contentType.includes('word') || contentType.includes('document')) return '📝';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊';
    if (contentType.includes('presentation') || contentType.includes('powerpoint')) return '📊';
    if (contentType.includes('text/')) return '📄';
    if (contentType.includes('audio/')) return '🎵';
    if (contentType.includes('video/')) return '🎬';
    if (contentType.includes('zip') || contentType.includes('compressed')) return '🗜️';
    
    return '📄';
  };

  // Función para formatear el tamaño de archivo
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="tag-search-container">
      <h2>Búsqueda por Etiquetas</h2>
      
      <div className="search-form">
        <div className="tag-selector-wrapper">
          <h3>Seleccione hasta 4 etiquetas para buscar</h3>
          <TagSelector onTagsChange={handleTagsChange} maxTags={4} />
        </div>
        
        <div className="search-actions">
          <button 
            className="search-button" 
            onClick={handleSearch}
            disabled={isSearching || selectedTags.length === 0}
          >
            {isSearching ? 'Buscando...' : 'Buscar Archivos'}
          </button>
          
          {selectedTags.length > 0 && (
            <div className="search-summary">
              Buscando archivos que contengan todas estas etiquetas: 
              <strong>{selectedTags.map(tag => ` ${tag.name}`).join(', ')}</strong>
            </div>
          )}
        </div>
        
        {error && <div className="error-message">{error}</div>}
      </div>
      
      {renderSearchResults()}
      
      <style jsx>{`
        .tag-search-container {
          padding: 20px;
          background-color: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          max-width: 1200px;
          margin: 0 auto;
        }
        
        h2 {
          margin-top: 0;
          margin-bottom: 20px;
          color: #333;
        }
        
        .search-form {
          margin-bottom: 30px;
        }
        
        .tag-selector-wrapper {
          margin-bottom: 20px;
        }
        
        .search-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .search-button {
          padding: 10px 20px;
          background-color: #2196F3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          transition: background-color 0.2s;
          width: fit-content;
        }
        
        .search-button:hover {
          background-color: #0b7dda;
        }
        
        .search-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .search-summary {
          margin-top: 10px;
          color: #555;
        }
        
        .error-message {
          color: #e74c3c;
          margin-top: 10px;
          padding: 10px;
          background-color: #fadbd8;
          border-radius: 4px;
        }
        
        .no-results {
          padding: 20px;
          text-align: center;
          background-color: #f9f9f9;
          border-radius: 4px;
          color: #555;
          font-style: italic;
        }
        
        .search-results h3 {
          margin-bottom: 15px;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        
        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 15px;
        }
        
        .result-item {
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 15px;
          display: flex;
          gap: 15px;
          transition: transform 0.2s;
        }
        
        .result-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .file-icon {
          font-size: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .file-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        
        .file-name {
          font-weight: bold;
          color: #2196F3;
          text-decoration: none;
          margin-bottom: 5px;
          word-break: break-word;
        }
        
        .file-name:hover {
          text-decoration: underline;
        }
        
        .file-details {
          font-size: 0.85rem;
          color: #777;
          margin-bottom: 8px;
          display: flex;
          flex-direction: column;
        }
        
        .file-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 8px;
        }
        
        .file-tag {
          background-color: #e1f5fe;
          color: #0288d1;
          font-size: 0.75rem;
          padding: 3px 8px;
          border-radius: 12px;
        }
      `}</style>
    </div>
  );
};

export default TagSearch;