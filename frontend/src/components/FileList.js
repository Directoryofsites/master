import React, { useState, useEffect } from 'react';
import * as api from '../services/api';  // Importar todo el módulo api



const FileList = ({ files, currentPath, onNavigate, userRole, onActionComplete, isSearchResults = false }) => {
  // Estado para almacenar las URLs de YouTube para cada archivo
  const [youtubeUrls, setYoutubeUrls] = useState({});
  // Estado para controlar la carga de URLs
  const [loadingUrls, setLoadingUrls] = useState(false);

  

// Estado para almacenar las URLs de audio para cada archivo
const [audioUrls, setAudioUrls] = useState({});
// Estado para almacenar las URLs de imagen para cada archivo
const [imageUrls, setImageUrls] = useState({});





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


  // Función para cargar la URL de audio de un archivo
  const loadAudioUrl = async (filePath) => {
    try {
      const url = await api.getAudioUrl(filePath);
      if (url) {
        setAudioUrls(prev => ({
          ...prev,
          [filePath]: url
        }));
      }
      return url;
    } catch (error) {
      console.error('Error al cargar URL de audio:', error);
      return null;
    }
  };

  // Función para cargar la URL de imagen de un archivo
  const loadImageUrl = async (filePath) => {
    try {
      const url = await api.getImageUrl(filePath);
      if (url) {
        setImageUrls(prev => ({
          ...prev,
          [filePath]: url
        }));
      }
      return url;
    } catch (error) {
      console.error('Error al cargar URL de imagen:', error);
      return null;
    }
  };

  // Estado para controlar qué archivo está siendo editado
  const [editingUrlFile, setEditingUrlFile] = useState(null);
  // Estado para almacenar la URL temporal mientras se edita
  const [tempUrl, setTempUrl] = useState('');


// Estado para controlar qué archivo está siendo editado (audio)
const [editingAudioFile, setEditingAudioFile] = useState(null);
// Estado para almacenar la URL temporal mientras se edita (audio)
const [tempAudioUrl, setTempAudioUrl] = useState('');

// Estado para controlar qué archivo está siendo editado (imagen)
const [editingImageFile, setEditingImageFile] = useState(null);
// Estado para almacenar la URL temporal mientras se edita (imagen)
const [tempImageUrl, setTempImageUrl] = useState('');


// Efecto para cargar las URLs cuando cambian los archivos o la ruta
useEffect(() => {
  async function loadAllUrls() {
    if (!files || files.length === 0 || loadingUrls) return;
    
    setLoadingUrls(true);
    console.log('Cargando URLs para todos los archivos...');
    
    const newYoutubeUrls = {};
    const newAudioUrls = {};
    const newImageUrls = {};
    
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
          // Cargar URL de YouTube
          const youtubeUrl = await api.getYoutubeUrl(filePath);
          if (youtubeUrl) {
            newYoutubeUrls[filePath] = youtubeUrl;
          }
          
          // Cargar URL de audio
          const audioUrl = await api.getAudioUrl(filePath);
          if (audioUrl) {
            newAudioUrls[filePath] = audioUrl;
          }
          
          // Cargar URL de imagen
          const imageUrl = await api.getImageUrl(filePath);
          if (imageUrl) {
            newImageUrls[filePath] = imageUrl;
          }
        } catch (error) {
          console.error(`Error al cargar URLs para ${filePath}:`, error);
        }
      }
    });
    
    await Promise.all(promises);
    
    setYoutubeUrls(newYoutubeUrls);
    setAudioUrls(newAudioUrls);
    setImageUrls(newImageUrls);
    
    console.log('URLs de YouTube cargadas:', newYoutubeUrls);
    console.log('URLs de audio cargadas:', newAudioUrls);
    console.log('URLs de imagen cargadas:', newImageUrls);
    
    setLoadingUrls(false);
  }
  
  loadAllUrls();
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

const isMP3 = file.name.toLowerCase().endsWith('.mp3') ||
  file.contentType === 'audio/mpeg';

console.log('¿Es un archivo PDF?', isPDF);
console.log('¿Es una imagen?', isImage);
console.log('¿Es un archivo DOCX?', isDOCX);
console.log('¿Es un archivo MP3?', isMP3);




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

        } else if (isMP3) {
          console.log('Archivo MP3 reproducible en navegador');
          // Obtener la URL para reproducción
          const url = await api.getDownloadUrl(filePath, false);
          console.log('URL obtenida para MP3:', url);
          
          // Crear un reproductor de audio sencillo
          const audioPlayer = document.createElement('audio');
          audioPlayer.controls = true;
          audioPlayer.src = url;
          audioPlayer.style.position = 'fixed';
          audioPlayer.style.bottom = '0';
          audioPlayer.style.left = '0';
          audioPlayer.style.width = '100%';
          audioPlayer.style.zIndex = '1000';
          audioPlayer.style.backgroundColor = '#f5f5f5';
          audioPlayer.style.padding = '10px';
          audioPlayer.style.boxShadow = '0 -2px 5px rgba(0,0,0,0.1)';
          
          // Eliminar reproductor anterior si existe
          const oldPlayer = document.getElementById('audio-player');
          if (oldPlayer) {
            oldPlayer.remove();
          }
          
          audioPlayer.id = 'audio-player';
          document.body.appendChild(audioPlayer);
          audioPlayer.play();  

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


// FUNCIONES PARA AUDIO
  
// Función para mostrar el campo de entrada de URL de audio
const handleEditAudioUrl = async (file, e) => {
  e.stopPropagation(); // Evitar que se propague el clic al elemento padre
  
  // Determinar la ruta del archivo
  let filePath;
  if (isSearchResults) {
    filePath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
  } else {
    filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
  }
  
  setEditingAudioFile(filePath);
  
  try {
    // Intentar cargar la URL del servidor si no la tenemos ya en el estado
    if (!audioUrls[filePath]) {
      const url = await loadAudioUrl(filePath);
      setTempAudioUrl(url || '');
    } else {
      setTempAudioUrl(audioUrls[filePath] || '');
    }
  } catch (error) {
    console.error('Error al cargar URL de audio para editar:', error);
    setTempAudioUrl('');
  }
};

// Función para guardar la URL de audio
const handleSaveAudioUrl = async (filePath, e) => {
  e.stopPropagation(); // Evitar que se propague el clic
  
  // Si la URL no es válida y no está vacía, mostrar alerta
  if (tempAudioUrl.trim() && !tempAudioUrl.match(/^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/)) {
    alert('Por favor ingresa una URL válida o deja el campo vacío para eliminar la URL.');
    return;
  }
  
  try {
    // URL a guardar (null si está vacía)
    const urlToSave = tempAudioUrl.trim() ? tempAudioUrl : null;
    
    // Guardar URL en el servidor
    await api.saveAudioUrl(filePath, urlToSave);
    
    // Actualizar estado local
    setAudioUrls(prev => {
      const updated = { ...prev };
      if (urlToSave) {
        updated[filePath] = urlToSave;
      } else {
        delete updated[filePath];
      }
      return updated;
    });
    
    // Cerrar el campo de edición
    setEditingAudioFile(null);
    setTempAudioUrl('');
    
    // Notificar al usuario
    alert(urlToSave ? 'URL de audio guardada correctamente' : 'URL de audio eliminada');
  } catch (error) {
    console.error('Error al guardar URL de audio:', error);
    alert('Error al guardar URL de audio');
  }
};

// Función para cancelar la edición de audio
const handleCancelAudioEdit = (e) => {
  e.stopPropagation();
  setEditingAudioFile(null);
  setTempAudioUrl('');
};

// Función para abrir la URL de audio
const handleOpenAudioUrl = (filePath, e) => {
  e.stopPropagation();
  if (audioUrls[filePath]) {
    // Asegurarse de que la URL tenga el formato correcto
    let url = audioUrls[filePath];
    
    // Si la URL no comienza con http:// o https://, añadir https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Crear un reproductor de audio
    const audioPlayer = document.createElement('audio');
    audioPlayer.controls = true;
    audioPlayer.src = url;
    audioPlayer.style.position = 'fixed';
    audioPlayer.style.bottom = '0';
    audioPlayer.style.left = '0';
    audioPlayer.style.width = '100%';
    audioPlayer.style.zIndex = '1000';
    audioPlayer.style.backgroundColor = '#f5f5f5';
    audioPlayer.style.padding = '10px';
    audioPlayer.style.boxShadow = '0 -2px 5px rgba(0,0,0,0.1)';
    
    // Eliminar reproductor anterior si existe
    const oldPlayer = document.getElementById('audio-player');
    if (oldPlayer) {
      oldPlayer.remove();
    }
    
    audioPlayer.id = 'audio-player';
    document.body.appendChild(audioPlayer);
    audioPlayer.play();
  }
};

// FUNCIONES PARA IMAGEN

// Función para mostrar el campo de entrada de URL de imagen
const handleEditImageUrl = async (file, e) => {
  e.stopPropagation(); // Evitar que se propague el clic al elemento padre
  
  // Determinar la ruta del archivo
  let filePath;
  if (isSearchResults) {
    filePath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
  } else {
    filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
  }
  
  setEditingImageFile(filePath);
  
  try {
    // Intentar cargar la URL del servidor si no la tenemos ya en el estado
    if (!imageUrls[filePath]) {
      const url = await loadImageUrl(filePath);
      setTempImageUrl(url || '');
    } else {
      setTempImageUrl(imageUrls[filePath] || '');
    }
  } catch (error) {
    console.error('Error al cargar URL de imagen para editar:', error);
    setTempImageUrl('');
  }
};

// Función para guardar la URL de imagen
const handleSaveImageUrl = async (filePath, e) => {
  e.stopPropagation(); // Evitar que se propague el clic
  
  // Si la URL no es válida y no está vacía, mostrar alerta
  if (tempImageUrl.trim() && !tempImageUrl.match(/^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/)) {
    alert('Por favor ingresa una URL válida o deja el campo vacío para eliminar la URL.');
    return;
  }
  
  try {
    // URL a guardar (null si está vacía)
    const urlToSave = tempImageUrl.trim() ? tempImageUrl : null;
    
    // Guardar URL en el servidor
    await api.saveImageUrl(filePath, urlToSave);
    
    // Actualizar estado local
    setImageUrls(prev => {
      const updated = { ...prev };
      if (urlToSave) {
        updated[filePath] = urlToSave;
      } else {
        delete updated[filePath];
      }
      return updated;
    });
    
    // Cerrar el campo de edición
    setEditingImageFile(null);
    setTempImageUrl('');
    
    // Notificar al usuario
    alert(urlToSave ? 'URL de imagen guardada correctamente' : 'URL de imagen eliminada');
  } catch (error) {
    console.error('Error al guardar URL de imagen:', error);
    alert('Error al guardar URL de imagen');
  }
};

// Función para cancelar la edición de imagen
const handleCancelImageEdit = (e) => {
  e.stopPropagation();
  setEditingImageFile(null);
  setTempImageUrl('');
};

// Función para abrir la URL de imagen
const handleOpenImageUrl = (filePath, e) => {
  e.stopPropagation();
  if (imageUrls[filePath]) {
    // Asegurarse de que la URL tenga el formato correcto
    let url = imageUrls[filePath];
    
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


 {/* Botón de reproducción de audio visible para todos los usuarios */}
{audioUrls[isSearchResults ? 
  (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
  (currentPath ? `${currentPath}/${file.name}` : file.name)] && (
  <button
    className="play-audio-btn"
    onClick={e => handleOpenAudioUrl(
      isSearchResults ? 
        (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
        (currentPath ? `${currentPath}/${file.name}` : file.name),
      e
    )}
    title="Reproducir audio"
  >
    🔊
  </button>
)}

{/* Botón de visualización de imagen visible para todos los usuarios */}
{imageUrls[isSearchResults ? 
  (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
  (currentPath ? `${currentPath}/${file.name}` : file.name)] && (
  <button
    className="view-image-btn"
    onClick={e => handleOpenImageUrl(
      isSearchResults ? 
        (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
        (currentPath ? `${currentPath}/${file.name}` : file.name),
      e
    )}
    title="Ver imagen"
  >
    🖼️
  </button>
)}

                    
{/* Solo administradores pueden editar/añadir URLs */}
{userRole === 'admin' && (
  <>
    {/* Control de YouTube */}
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

    {/* Control de Audio */}
    {editingAudioFile === (isSearchResults ? 
      (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
      (currentPath ? `${currentPath}/${file.name}` : file.name)) ? (
      <div className="audio-url-input-container" onClick={e => e.stopPropagation()}>
        <input
          type="text"
          value={tempAudioUrl}
          onChange={e => setTempAudioUrl(e.target.value)}
          placeholder="URL de Audio"
          className="audio-url-input"
        />
        <button 
          onClick={e => handleSaveAudioUrl(
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
          onClick={handleCancelAudioEdit}
          className="cancel-url-btn"
        >
          ✕
        </button>
      </div>
    ) : (
      <button
        className="add-audio-btn"
        onClick={e => handleEditAudioUrl(file, e)}
        title="Añadir URL de Audio"
      >
        🎵
      </button>
    )}

    {/* Control de Imagen */}
    {editingImageFile === (isSearchResults ? 
      (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
      (currentPath ? `${currentPath}/${file.name}` : file.name)) ? (
      <div className="image-url-input-container" onClick={e => e.stopPropagation()}>
        <input
          type="text"
          value={tempImageUrl}
          onChange={e => setTempImageUrl(e.target.value)}
          placeholder="URL de Imagen"
          className="image-url-input"
        />
        <button 
          onClick={e => handleSaveImageUrl(
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
          onClick={handleCancelImageEdit}
          className="cancel-url-btn"
        >
          ✕
        </button>
      </div>
    ) : (
      <button
        className="add-image-btn"
        onClick={e => handleEditImageUrl(file, e)}
        title="Añadir URL de Imagen"
      >
        🖼️
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