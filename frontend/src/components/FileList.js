import React, { useState, useEffect } from 'react';
import * as api from '../services/api';  // Importar todo el módulo api

const FileList = ({ files, currentPath, onNavigate, userRole, onActionComplete, isSearchResults = false }) => {
  // Estado para almacenar las URLs de YouTube para cada archivo
  const [youtubeUrls, setYoutubeUrls] = useState({});
  // Estado para controlar la carga de URLs
  const [loadingUrls, setLoadingUrls] = useState(false);

  // Función para cargar la URL de YouTube de un archivo
  const loadYoutubeUrl = async (filePath) => {
    try {
      const url = await api.getYoutubeUrl(filePath);
      if (url) {
        setYoutubeUrls(prev => ({
          ...prev,
          [filePath]: url
        }));
      }
      return url;
    } catch (error) {
      console.error('Error al cargar URL de YouTube:', error);
      return null;
    }
  };

  // Estado para controlar qué archivo está siendo editado
  const [editingUrlFile, setEditingUrlFile] = useState(null);
  // Estado para almacenar la URL temporal mientras se edita
  const [tempUrl, setTempUrl] = useState('');

  // Efecto para cargar las URLs de YouTube cuando cambian los archivos o la ruta
  useEffect(() => {
    async function loadAllYoutubeUrls() {
      if (!files || files.length === 0 || loadingUrls) return;
      
      setLoadingUrls(true);
      console.log('Cargando URLs de YouTube para todos los archivos...');
      
      const newUrls = {};
      const promises = files.map(async (file) => {
        // Solo procesar archivos (no carpetas)
        if (!file.isFolder) {
          // Determinar la ruta correcta del archivo
          let filePath;
          if (isSearchResults) {
            filePath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
          } else {
            filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
          }
          
          try {
            const url = await api.getYoutubeUrl(filePath);
            if (url) {
              newUrls[filePath] = url;
            }
          } catch (error) {
            console.error(`Error al cargar URL para ${filePath}:`, error);
          }
        }
      });
      
      await Promise.all(promises);
      setYoutubeUrls(newUrls);
      console.log('URLs cargadas:', newUrls);
      setLoadingUrls(false);
    }
    
    loadAllYoutubeUrls();
  }, [files, currentPath, isSearchResults]);
  
  const handleFileClick = async (file) => {
    if (file.isFolder) {
      // Si es una carpeta, navegar a ella
      // Si es un resultado de búsqueda, usar path desde el resultado
      if (isSearchResults) {
        // Quitar el slash inicial del path
        const folderPath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
        onNavigate(folderPath);
      } else {
        const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
        onNavigate(newPath);
      }
    } else {
      try {
        // Construir la ruta correcta del archivo
        let filePath;
        if (isSearchResults) {
          // Quitar el slash inicial del path
          filePath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
        } else {
          filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
        }
        
        console.log('Procesando archivo:', file.name);
        console.log('Ruta completa:', filePath);
        
        // Verificar los tipos de archivos por su extensión
        const isPDF = file.name.toLowerCase().endsWith('.pdf') || 
          file.contentType === 'application/pdf';
        const isImage = /\.(jpe?g|png|gif|bmp|webp)$/i.test(file.name) ||
          file.contentType?.startsWith('image/');
        const isDOCX = file.name.toLowerCase().endsWith('.docx') || 
          file.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        console.log('¿Es un archivo PDF?', isPDF);
        console.log('¿Es una imagen?', isImage);
        console.log('¿Es un archivo DOCX?', isDOCX);

        // Si es un archivo visualizable, lo mostramos directamente en el navegador
        if (isPDF || isImage) {
          console.log('Archivo visualizable en navegador');
          // No se usa forceDownload para que el navegador lo muestre en su visor nativo
          const url = await api.getDownloadUrl(filePath, false);
          console.log('URL obtenida:', url);
          window.open(url, '_blank');
        } else if (isDOCX) {
          console.log('Archivo DOCX visualizable mediante API');
          // Construir la URL completa al servidor de backend para DOCX
          const baseUrl = process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3000' // URL local en desarrollo
            : 'https://contenedor-production-3606.up.railway.app'; // URL de Railway en producción
          
          const viewUrl = `${baseUrl}/api/view-docx?path=${encodeURIComponent(filePath)}`;
          console.log('URL para visualizar DOCX:', viewUrl);
          window.open(viewUrl, '_blank');
        } else {
          // Para otros tipos de archivo, mantener el comportamiento actual (descarga)
          const url = await api.getDownloadUrl(filePath);
          window.open(url, '_blank');
        }
      } catch (error) {
        console.error('Error al obtener URL de descarga:', error);
        alert('No se pudo abrir el archivo');
      }
    }
  };

  const handleDelete = async (file) => {
    // Verificar que tengamos un archivo válido
    if (!file || !file.name) {
      alert('Error: No se puede eliminar un elemento sin nombre');
      return;
    }

    // Confirmar antes de eliminar
    if (!window.confirm(`¿Estás seguro de que deseas eliminar ${file.name}?`)) {
      return;
    }

    try {
      // Construir la ruta del elemento a eliminar
      let itemPath;
      if (isSearchResults) {
        // Quitar el slash inicial del path
        itemPath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
      } else {
        itemPath = currentPath ? `${currentPath}/${file.name}` : file.name;
      }
      
      console.log('Intentando eliminar:', {
        nombre: file.name,
        ruta: itemPath,
        esFolder: file.isFolder
      });
      
      // Llamar a la función de eliminación con información explícita sobre si es una carpeta
      const result = await api.deleteItem(itemPath, file.isFolder);
      
      if (result && result.success) {
        console.log('Eliminación exitosa');
        alert('Elemento eliminado correctamente');
        
        // Esperar un momento antes de actualizar la lista
        setTimeout(() => {
          // Refrescar la lista de archivos
          if (onActionComplete) {
            onActionComplete();
          }
        }, 1000); // Esperar 1 segundo
      } else {
        alert(`Error: ${result && result.message ? result.message : 'No se pudo eliminar el elemento'}`);
      }
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert(`Error: ${error.message || 'Ocurrió un error al intentar eliminar'}`);
    }
  };

  const navigateUp = () => {
    if (!currentPath) return;
    
    const pathParts = currentPath.split('/');
    if (pathParts.length === 1) {
      // Si estamos en el primer nivel, volver a la raíz
      onNavigate('');
    } else {
      // Si estamos en niveles más profundos, subir un nivel
      pathParts.pop();
      onNavigate(pathParts.join('/'));
    }
  };

  const navigateToRoot = () => {
    // Navegar directamente a la raíz
    onNavigate('');
  };

  // Función para mostrar el campo de entrada de URL de YouTube
  const handleEditYoutubeUrl = async (file, e) => {
    e.stopPropagation(); // Evitar que se propague el clic al elemento padre
    
    // Determinar la ruta del archivo
    let filePath;
    if (isSearchResults) {
      filePath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
    } else {
      filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
    }
    
    setEditingUrlFile(filePath);
    
    try {
      // Intentar cargar la URL del servidor si no la tenemos ya en el estado
      if (!youtubeUrls[filePath]) {
        const url = await loadYoutubeUrl(filePath);
        setTempUrl(url || '');
      } else {
        setTempUrl(youtubeUrls[filePath] || '');
      }
    } catch (error) {
      console.error('Error al cargar URL para editar:', error);
      setTempUrl('');
    }
  };

  // Función para guardar la URL de YouTube
  const handleSaveYoutubeUrl = async (filePath, e) => {
    e.stopPropagation(); // Evitar que se propague el clic
    
    // Si la URL no es válida y no está vacía, mostrar alerta
    if (tempUrl.trim() && !tempUrl.includes('youtube.com') && !tempUrl.includes('youtu.be')) {
      alert('Por favor ingresa una URL válida de YouTube o deja el campo vacío para eliminar la URL.');
      return;
    }
    
    try {
      // URL a guardar (null si está vacía)
      const urlToSave = tempUrl.trim() ? tempUrl : null;
      
      // Guardar URL en el servidor
      await api.saveYoutubeUrl(filePath, urlToSave);
      
      // Actualizar estado local
      setYoutubeUrls(prev => {
        const updated = { ...prev };
        if (urlToSave) {
          updated[filePath] = urlToSave;
        } else {
          delete updated[filePath];
        }
        return updated;
      });
      
      // Cerrar el campo de edición
      setEditingUrlFile(null);
      setTempUrl('');
      
      // Notificar al usuario
      alert(urlToSave ? 'URL de YouTube guardada correctamente' : 'URL de YouTube eliminada');
    } catch (error) {
      console.error('Error al guardar URL de YouTube:', error);
      alert('Error al guardar URL de YouTube');
    }
  };

  // Función para cancelar la edición
  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingUrlFile(null);
    setTempUrl('');
  };

  // Función para abrir la URL de YouTube
  const handleOpenYoutubeUrl = (filePath, e) => {
    e.stopPropagation();
    if (youtubeUrls[filePath]) {
      // Asegurarse de que la URL tenga el formato correcto
      let url = youtubeUrls[filePath];
      
      // Si la URL no comienza con http:// o https://, añadir https://
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      window.open(url, '_blank');
    }
  };

  return (
    <div className="file-list-container">
      {!isSearchResults && (
        <div className="file-list-header">
          <h2 className="current-location">
            Ubicación actual: {currentPath ? `/${currentPath}` : '/'}
          </h2>

          <div className="navigation-buttons">
            {currentPath && (
              <>
                <button
                  className="btn btn-secondary btn-sm mobile-full-width"
                  onClick={navigateUp}
                >
                  Subir un nivel
                </button>
                <button
                  className="btn btn-primary btn-sm mobile-full-width"
                  onClick={navigateToRoot}
                >
                  Inicio
                </button>
              </>
            )}
          </div>
        </div>
      )}
      
      {(!files || files.length === 0) ? (
        <p className="empty-folder">
          {isSearchResults 
            ? "No se encontraron resultados para la búsqueda." 
            : "La carpeta está vacía"}
        </p>
      ) : (
        <div className="file-grid">
          {files.map((file) => (
            <div key={file.name || file.path} className="file-item">
              <div 
                className={`file-item-content ${file.isFolder ? 'folder' : 'file'}`}
                onClick={() => handleFileClick(file)}
              >
                <div className="file-icon">
                  {file.isFolder ? '📁' : (file.name.toLowerCase().endsWith('.pdf') ? '📑' : '📄')}
                </div>
                <div className="file-name" title={file.name}>
                  {file.name}
                </div>
                
                {/* Mostrar ruta para resultados de búsqueda */}
                {isSearchResults && (
                  <div className="search-path-info" title={file.path}>
                    Ubicación: {file.path ? file.path.split('/').slice(0, -1).join('/') || 'Raíz' : 'Raíz'}
                  </div>
                )}
              </div>

              <div className="file-buttons mobile-actions">
                {!file.isFolder && (
                  <>
                    {/* Botón de reproducción visible para todos los usuarios */}
                    {youtubeUrls[isSearchResults ? 
                      (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
                      (currentPath ? `${currentPath}/${file.name}` : file.name)] && (
                      <button
                        className="play-youtube-btn"
                        onClick={e => handleOpenYoutubeUrl(
                          isSearchResults ? 
                            (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
                            (currentPath ? `${currentPath}/${file.name}` : file.name),
                          e
                        )}
                        title="Reproducir video"
                      >
                        ▶
                      </button>
                    )}
                    
                    {/* Solo administradores pueden editar/añadir URLs */}
                    {userRole === 'admin' && (
                      <>
                        {editingUrlFile === (isSearchResults ? 
                          (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
                          (currentPath ? `${currentPath}/${file.name}` : file.name)) ? (
                          <div className="youtube-url-input-container" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={tempUrl}
                              onChange={e => setTempUrl(e.target.value)}
                              placeholder="URL de YouTube"
                              className="youtube-url-input"
                            />
                            <button 
                              onClick={e => handleSaveYoutubeUrl(
                                isSearchResults ? 
                                  (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
                                  (currentPath ? `${currentPath}/${file.name}` : file.name), 
                                e
                              )}
                              className="save-url-btn"
                            >
                              ✓
                            </button>
                            <button 
                              onClick={handleCancelEdit}
                              className="cancel-url-btn"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            className="add-youtube-btn"
                            onClick={e => handleEditYoutubeUrl(file, e)}
                            title="Añadir URL de YouTube"
                          >
                            🔗
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
                
                {/* Solo administradores pueden eliminar archivos */}
                {userRole === 'admin' && (
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(file);
                    }}
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileList;