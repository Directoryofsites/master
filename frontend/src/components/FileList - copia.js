import React, { useState, useEffect, useRef } from 'react';
import * as api from '../services/api';  // Importar todo el módulo api
import FileMetadataEditor from './FileMetadataEditor'; // Importar el componente de editor de metadatos

const FileList = ({ files, currentPath, onNavigate, userRole, onActionComplete, isSearchResults = false }) => {
  // Estado para almacenar las URLs de YouTube para cada archivo
  const [youtubeUrls, setYoutubeUrls] = useState({});
  // Estado para controlar la carga de URLs
  const [loadingUrls, setLoadingUrls] = useState(false);
  // Estado para controlar el editor de metadatos
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  // Estado para almacenar las URLs de audio para cada archivo
  const [audioUrls, setAudioUrls] = useState({});
  // Estado para almacenar las URLs de imagen para cada archivo
  const [imageUrls, setImageUrls] = useState({});
  // Estado para almacenar los metadatos (incluidas etiquetas) para cada archivo
  const [fileMetadata, setFileMetadata] = useState({});
  // Estado para la selección múltiple de archivos
  const [selectedItems, setSelectedItems] = useState([]);
  // Estado para renombrar archivos
  const [renamingFile, setRenamingFile] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  // Estado para controlar el modo selección múltiple
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  // Estado para controlar el menú de acciones
  const [activeActionsMenu, setActiveActionsMenu] = useState(null);

// Referencia para los menús desplegables
const dropdownRefs = useRef(new Map());

// Log de depuración para el menú de acciones
useEffect(() => {
  if (activeActionsMenu) {
    console.log('Menú de acciones activado para:', activeActionsMenu);
  }
}, [activeActionsMenu]);

// Log de depuración para el menú de acciones
useEffect(() => {
  if (activeActionsMenu) {
    console.log('Menú de acciones activado para:', activeActionsMenu);
  }
}, [activeActionsMenu]);

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

  // Función para cargar los metadatos de un archivo
  const loadFileMetadata = async (filePath) => {
    try {
      const metadata = await api.getFileMetadata(filePath);
      if (metadata) {
        setFileMetadata(prev => ({
          ...prev,
          [filePath]: metadata
        }));
      }
      return metadata;
    } catch (error) {
      console.error('Error al cargar metadatos:', error);
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

  // Efecto para cerrar el menú de acciones cuando se hace clic fuera
useEffect(() => {
  function handleClickOutside(event) {
    if (activeActionsMenu) {
      const dropdownElement = dropdownRefs.current.get(activeActionsMenu);
      if (!dropdownElement || !dropdownElement.contains(event.target)) {
        setActiveActionsMenu(null);
      }
    }
  }

  document.addEventListener('mousedown', handleClickOutside);
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [activeActionsMenu]);

  // Efecto para cargar las URLs cuando cambian los archivos o la ruta
  useEffect(() => {
    async function loadAllUrls() {
      if (!files || files.length === 0 || loadingUrls) return;
      
      setLoadingUrls(true);
      console.log('Cargando URLs para todos los archivos...');
      
      const newYoutubeUrls = {};
      const newAudioUrls = {};
      const newImageUrls = {};
      const newFileMetadata = {};
      
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

            // Cargar metadatos (incluyendo etiquetas)
            try {
              const metadata = await api.getFileMetadata(filePath);
              if (metadata) {
                newFileMetadata[filePath] = metadata;
              }
            } catch (metadataError) {
              console.error(`Error al cargar metadatos para ${filePath}:`, metadataError);
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

      setFileMetadata(newFileMetadata);
      console.log('Metadatos cargados:', newFileMetadata);
      
      setLoadingUrls(false);
    }
    
    loadAllUrls();
    
    // Limpiar selecciones al cambiar de carpeta
    setSelectedItems([]);
    setMultiSelectMode(false);
  }, [files, currentPath, isSearchResults]);

  // Función para obtener la ruta completa de un archivo
  const getFilePath = (file) => {
    if (isSearchResults) {
      return file.path.startsWith('/') ? file.path.substring(1) : file.path;
    } else {
      return currentPath ? `${currentPath}/${file.name}` : file.name;
    }
  };

  // Función para alternar el menú de acciones
const toggleActionsMenu = (filePath, e) => {
  e.preventDefault(); // Prevenir comportamiento por defecto
  e.stopPropagation(); // Evitar propagación del evento
  
  console.log('Alternando menú para:', filePath, 'Estado actual:', activeActionsMenu === filePath ? 'abierto' : 'cerrado');
  
  // Si el menú ya está abierto para este archivo, cerrarlo, de lo contrario, abrirlo
  setActiveActionsMenu(activeActionsMenu === filePath ? null : filePath);
};

  // Función para manejar la selección de archivos
  const handleItemSelect = (file, e) => {
    e.stopPropagation();
    
    const filePath = getFilePath(file);
    
    setSelectedItems(prev => {
      // Verificar si ya está seleccionado
      if (prev.some(item => item.path === filePath)) {
        // Si está seleccionado, quitarlo de la selección
        return prev.filter(item => item.path !== filePath);
      } else {
        // Si no está seleccionado, añadirlo a la selección
        return [...prev, { ...file, path: filePath }];
      }
    });
  };

  // Función para alternar el modo selección múltiple
  const toggleMultiSelectMode = () => {
    setMultiSelectMode(prev => !prev);
    if (multiSelectMode) {
      // Si estamos desactivando el modo, limpiar selecciones
      setSelectedItems([]);
    }
  };

  // Función para seleccionar todos los elementos
  const selectAll = () => {
    if (selectedItems.length === files.length) {
      // Si todos están seleccionados, deseleccionar todos
      setSelectedItems([]);
    } else {
      // Seleccionar todos los archivos
      const allItems = files.map(file => ({
        ...file,
        path: getFilePath(file)
      }));
      setSelectedItems(allItems);
    }
  };

  // Función para eliminar los elementos seleccionados
  const deleteSelectedItems = async () => {
    if (selectedItems.length === 0) {
      alert('No hay elementos seleccionados para eliminar');
      return;
    }

    // Confirmar antes de eliminar
    if (!window.confirm(`¿Estás seguro de que deseas eliminar ${selectedItems.length} elemento(s)?`)) {
      return;
    }

    try {
      // Contador para archivos eliminados correctamente
      let successCount = 0;
      let errorCount = 0;

      // Eliminar cada elemento seleccionado
      for (const item of selectedItems) {
        try {
          console.log('Intentando eliminar:', {
            nombre: item.name,
            ruta: item.path,
            esFolder: item.isFolder
          });
          
          // Llamar a la función de eliminación
          const result = await api.deleteItem(item.path, item.isFolder);
          
          if (result && result.success) {
            successCount++;
          } else {
            errorCount++;
            console.error(`Error al eliminar ${item.name}:`, result?.message || 'Error desconocido');
          }
        } catch (error) {
          errorCount++;
          console.error(`Error al eliminar ${item.name}:`, error);
        }
      }

      // Mostrar resultado
      if (errorCount === 0) {
        alert(`${successCount} elemento(s) eliminado(s) correctamente`);
      } else if (successCount === 0) {
        alert(`Error: No se pudo eliminar ningún elemento`);
      } else {
        alert(`${successCount} elemento(s) eliminado(s) correctamente. ${errorCount} elemento(s) fallaron.`);
      }

      // Limpiar selecciones y refrescar lista
      setSelectedItems([]);
      if (onActionComplete) {
        onActionComplete();
      }
    } catch (error) {
      console.error('Error general al eliminar elementos:', error);
      alert(`Error: ${error.message || 'Ocurrió un error al eliminar los elementos'}`);
    }
  };

  // Función para duplicar los elementos seleccionados
  const duplicateSelectedItems = async () => {
    if (selectedItems.length === 0) {
      alert('No hay elementos seleccionados para duplicar');
      return;
    }

    try {
      // Contador para archivos duplicados correctamente
      let successCount = 0;
      let errorCount = 0;

      // Duplicar cada elemento seleccionado
      for (const item of selectedItems) {
        if (item.isFolder) {
          // No podemos duplicar carpetas por ahora
          alert('La duplicación de carpetas no está soportada en esta versión');
          continue;
        }

        try {
          console.log('Intentando duplicar:', {
            nombre: item.name,
            ruta: item.path
          });
          
          // Obtener directorio del archivo
          const pathParts = item.path.split('/');
          const fileName = pathParts.pop(); // Último elemento es el nombre del archivo
          const directory = pathParts.join('/'); // El resto es el directorio
          
          // Generar un nombre para la copia
          const nameParts = fileName.split('.');
          const extension = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
          const baseName = nameParts.join('.');
          const newName = `${baseName} (copia)${extension}`;
          
          // Ruta de destino
          const targetPath = directory ? `${directory}/${newName}` : newName;
          
          // Llamar a la API para copiar el archivo
          const result = await api.copyFile(item.path, targetPath);
          
          if (result && result.success) {
            successCount++;
          } else {
            errorCount++;
            console.error(`Error al duplicar ${item.name}:`, result?.message || 'Error desconocido');
          }
        } catch (error) {
          errorCount++;
          console.error(`Error al duplicar ${item.name}:`, error);
        }
      }

      // Mostrar resultado
      if (errorCount === 0) {
        alert(`${successCount} archivo(s) duplicado(s) correctamente`);
      } else if (successCount === 0) {
        alert(`Error: No se pudo duplicar ningún archivo`);
      } else {
        alert(`${successCount} archivo(s) duplicado(s) correctamente. ${errorCount} archivo(s) fallaron.`);
      }

      // Limpiar selecciones y refrescar lista
      setSelectedItems([]);
      if (onActionComplete) {
        onActionComplete();
      }
    } catch (error) {
      console.error('Error general al duplicar archivos:', error);
      alert(`Error: ${error.message || 'Ocurrió un error al duplicar los archivos'}`);
    }
  };

  // Función para iniciar el renombrado de un archivo
  const startRename = (file, e) => {
    e.stopPropagation();
    setRenamingFile(file);
    setNewFileName(file.name);
    // Cerrar el menú de acciones
    setActiveActionsMenu(null);
  };

  // Función para guardar el nuevo nombre
  const saveNewName = async (e) => {
    e.stopPropagation();
    
    if (!renamingFile || !newFileName.trim()) {
      setRenamingFile(null);
      return;
    }
    
    // Evitar renombrar al mismo nombre
    if (renamingFile.name === newFileName) {
      setRenamingFile(null);
      return;
    }
    
    try {
      // Obtener la ruta completa
      const filePath = getFilePath(renamingFile);
      
      // Obtener el directorio del archivo
      const pathParts = filePath.split('/');
      pathParts.pop(); // Eliminar el nombre del archivo
      const directory = pathParts.join('/');
      
      // Nueva ruta con el nuevo nombre
      const newPath = directory ? `${directory}/${newFileName}` : newFileName;
      
      console.log('Renombrando:', {
        rutaOriginal: filePath,
        nuevaRuta: newPath,
        esCarpeta: renamingFile.isFolder
      });
      
      // Llamar a la API para renombrar
      const result = await api.renameItem(filePath, newPath, renamingFile.isFolder);
      
      if (result && result.success) {
        alert('Elemento renombrado correctamente');
        if (onActionComplete) {
          onActionComplete();
        }
      } else {
        alert(`Error: ${result && result.message ? result.message : 'No se pudo renombrar el elemento'}`);
      }
    } catch (error) {
      console.error('Error al renombrar:', error);
      alert(`Error: ${error.message || 'Ocurrió un error al renombrar'}`);
    } finally {
      setRenamingFile(null);
      setNewFileName('');
    }
  };

  // Función para cancelar el renombrado
  const cancelRename = (e) => {
    e.stopPropagation();
    setRenamingFile(null);
    setNewFileName('');
  };

  const handleFileClick = async (file) => {
    // Si estamos en modo selección múltiple, cambiar el comportamiento
    if (multiSelectMode) {
      handleItemSelect(file, { stopPropagation: () => {} });
      return;
    }
    
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
          
          try {
            // Usar la función api.getDownloadUrl para obtener la URL con el token incluido
            console.log('Obteniendo URL para DOCX mediante getDownloadUrl...');
            
            // Obtener la URL pública a través de la función corregida
            const publicUrl = await api.getDownloadUrl(filePath, false);
            console.log('URL pública obtenida para DOCX:', publicUrl);
            
            // Crear objeto con la información necesaria
            const responseData = {
              success: true,
              publicUrl: publicUrl
            };
            
            console.log('Respuesta de descarga:', responseData);
            
            if (responseData.publicUrl) {
              // Crear HTML para visualizar opciones
              const htmlContent = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Visor de Documentos - ${file.name}</title>
                  <style>
                    body {
                      font-family: Arial, sans-serif;
                      line-height: 1.6;
                      margin: 0;
                      padding: 20px;
                      max-width: 800px;
                      margin: 0 auto;
                      background-color: #f5f5f5;
                    }
                    h1, h2 {
                      color: #333;
                    }
                    .options {
                      display: flex;
                      flex-direction: column;
                      gap: 15px;
                      margin: 20px 0;
                    }
                    .button {
                      display: inline-block;
                      background-color: #4CAF50;
                      color: white;
                      padding: 10px 15px;
                      text-decoration: none;
                      border-radius: 4px;
                      font-weight: bold;
                      text-align: center;
                    }
                    .button.secondary {
                      background-color: #2196F3;
                    }
                    .view-container {
                      margin-top: 30px;
                      padding: 20px;
                      background-color: white;
                      border-radius: 4px;
                      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    }
                    iframe {
                      width: 100%;
                      height: 600px;
                      border: 1px solid #ddd;
                    }
                  </style>
                </head>
                <body>
                  <h1>Documento: ${file.name}</h1>
                  
                  <div class="options">
                    <a class="button" href="${responseData.publicUrl}" target="_blank">Descargar documento</a>
                    <a class="button secondary" href="https://docs.google.com/viewer?url=${encodeURIComponent(responseData.publicUrl)}&embedded=true" target="_blank">
                      Visualizar con Google Docs Viewer
                    </a>
                    <a class="button secondary" href="https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(responseData.publicUrl)}" target="_blank">
                      Visualizar con Microsoft Office Online
                    </a>
                  </div>
                  
                  <div class="view-container">
                    <h2>Vista previa (requiere navegador compatible)</h2>
                    <iframe src="https://docs.google.com/viewer?url=${encodeURIComponent(responseData.publicUrl)}&embedded=true"></iframe>
                  </div>
                  
                  <script>
                    // Permitir que se establezca la preferencia de visualización como predeterminada
                    document.addEventListener('DOMContentLoaded', function() {
                      // Código adicional si es necesario
                    });
                  </script>
                </body>
                </html>
              `;
              
              // Crear un blob y abrirlo en una nueva ventana
              const blob = new Blob([htmlContent], { type: 'text/html' });
              const viewerUrl = URL.createObjectURL(blob);
              
              window.open(viewerUrl, '_blank');
            } else {
              throw new Error('No se pudo obtener la URL pública del documento');
            }
          } catch (error) {
            console.error('Error al abrir DOCX:', error);
            alert('Error al visualizar el documento DOCX: ' + error.message);
          }
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

  const handleDelete = async (file, e) => {
    if (e) e.stopPropagation();
    
    // Cerrar el menú de acciones
    setActiveActionsMenu(null);
    
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
    
    // Cerrar el menú de acciones
    setActiveActionsMenu(null);
    
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
      
      // Cerrar el menú de acciones
      setActiveActionsMenu(null);
      
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
      
      // Cerrar el menú de acciones
      setActiveActionsMenu(null);
      
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
  
    // FUNCIONES PARA METADATOS
  
    // Función para abrir el editor de metadatos
    const handleOpenMetadataEditor = (file, e) => {
      e.stopPropagation(); // Evitar que se propague el clic
      
      // Cerrar el menú de acciones
      setActiveActionsMenu(null);
      
      // Determinar la ruta del archivo
      let filePath;
      if (isSearchResults) {
        filePath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
      } else {
        filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
      }
      
      // Guardar el archivo seleccionado y su ruta
      setSelectedFile(file);
      setSelectedFilePath(filePath);
      
      // Mostrar el editor de metadatos
      setShowMetadataEditor(true);
    };
  
    // Función para cerrar el editor de metadatos
    const handleCloseMetadataEditor = () => {
      setShowMetadataEditor(false);
      setSelectedFile(null);
      setSelectedFilePath('');
    };
  
    // Función para manejar cuando se completa la edición de metadatos
    const handleMetadataEdited = () => {
      // Cerrar el editor
      handleCloseMetadataEditor();
      
      // Refrescar la lista de archivos
      if (onActionComplete) {
        onActionComplete();
      }
    };
  
    // Función para duplicar un solo archivo
    const handleDuplicate = async (file, e) => {
      e.stopPropagation();
      
      // Cerrar el menú de acciones
      setActiveActionsMenu(null);
      
      if (file.isFolder) {
        alert('La duplicación de carpetas no está soportada en esta versión');
        return;
      }
      
      try {
        // Obtener la ruta completa
        const filePath = getFilePath(file);
        
        // Obtener directorio del archivo
        const pathParts = filePath.split('/');
        const fileName = pathParts.pop(); // Último elemento es el nombre del archivo
        const directory = pathParts.join('/'); // El resto es el directorio
        
        // Generar un nombre para la copia
        const nameParts = fileName.split('.');
        const extension = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
        const baseName = nameParts.join('.');
        const newName = `${baseName} (copia)${extension}`;
        
        // Ruta de destino
        const targetPath = directory ? `${directory}/${newName}` : newName;
        
        console.log('Duplicando archivo:', {
          original: filePath,
          destino: targetPath
        });
        
        // Llamar a la API para copiar el archivo
        const result = await api.copyFile(filePath, targetPath);
        
        if (result && result.success) {
          alert('Archivo duplicado correctamente');
          if (onActionComplete) {
            onActionComplete();
          }
        } else {
          alert(`Error: ${result && result.message ? result.message : 'No se pudo duplicar el archivo'}`);
        }
      } catch (error) {
        console.error('Error al duplicar:', error);
        alert(`Error: ${error.message || 'Ocurrió un error al duplicar el archivo'}`);
      }
    };
  
    // Función para obtener el ícono según el tipo de archivo
    const getFileIcon = (fileName) => {
      if (!fileName) return '📄';
    
      const lowerName = fileName.toLowerCase();
      
      // Documentos
      if (lowerName.endsWith('.pdf')) return '📄';
      if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return '📝';
      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) return '📊';
      if (lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt')) return '📑';
      if (lowerName.endsWith('.txt')) return '📄';
      
      // Imágenes
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].some(ext => lowerName.endsWith(ext))) 
        return '🖼️';
      
      // Audio
      if (['.mp3', '.wav', '.ogg', '.flac'].some(ext => lowerName.endsWith(ext))) 
        return '🎵';
      
      // Video
      if (['.mp4', '.avi', '.mov', '.wmv', '.mkv'].some(ext => lowerName.endsWith(ext))) 
        return '🎬';
      
      // Archivos comprimidos
      if (['.zip', '.rar', '.7z', '.tar', '.gz'].some(ext => lowerName.endsWith(ext))) 
        return '📦';
      
      // Por defecto
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
  
    // Función para formatear la fecha
    const formatDate = (dateString) => {
      if (!dateString) return '';
      
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-CO', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (error) {
        console.error('Error al formatear fecha:', error);
        return dateString;
      }
    };
  
    // Función para obtener la ubicación del archivo
    const getFileLocation = (file) => {
      if (isSearchResults) {
        // Obtener la ruta sin el nombre del archivo
        const path = file.path || '';
        const lastSlashIndex = path.lastIndexOf('/');
        if (lastSlashIndex === -1) return 'Raíz';
        return path.substring(0, lastSlashIndex) || 'Raíz';
      } else {
        return currentPath || 'Raíz';
      }
    };
  
    return (
      <div className="file-list-container">
        {!isSearchResults && (
          <div className="file-list-header" style={{
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <h2 className="current-location" style={{
              margin: '0 0 10px 0'
            }}>
              Ubicación actual: {currentPath ? `/${currentPath}` : '/'}
            </h2>
  
            <div className="navigation-buttons">
              {currentPath && (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={navigateUp}
                    style={{
                      marginRight: '10px',
                      padding: '5px 15px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Subir un nivel
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={navigateToRoot}
                    style={{
                      padding: '5px 15px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Inicio
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Barra de herramientas para selección múltiple */}
        {userRole === 'admin' && (
          <div className="multi-select-toolbar" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: multiSelectMode ? '#e9f5ff' : 'transparent',
            borderRadius: '4px',
            border: multiSelectMode ? '1px solid #bee1ff' : '1px solid transparent',
            transition: 'all 0.3s ease'
          }}>
            <div>
              <button
                onClick={toggleMultiSelectMode}
                style={{
                  backgroundColor: multiSelectMode ? '#007bff' : '#f8f9fa',
                  color: multiSelectMode ? 'white' : '#212529',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  marginRight: '10px',
                  cursor: 'pointer'
                }}
              >
                {multiSelectMode ? 'Desactivar selección múltiple' : 'Activar selección múltiple'}
              </button>
              
              {multiSelectMode && (
                <>
                  <button
                    onClick={selectAll}
                    style={{
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 12px',
                      marginRight: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    {selectedItems.length === files.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                  
                  <button
                    onClick={deleteSelectedItems}
                    disabled={selectedItems.length === 0}
                    style={{
                      backgroundColor: selectedItems.length === 0 ? '#ffc1c1' : '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 12px',
                      marginRight: '10px',
                      cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: selectedItems.length === 0 ? 0.6 : 1
                    }}
                  >
                    Eliminar seleccionados
                  </button>
                  
                  <button
                    onClick={duplicateSelectedItems}
                    disabled={selectedItems.length === 0}
                    style={{
                      backgroundColor: selectedItems.length === 0 ? '#c1e7ff' : '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 12px',
                      cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: selectedItems.length === 0 ? 0.6 : 1
                    }}
                  >
                    Duplicar seleccionados
                  </button>
                </>
              )}
            </div>
            
            {multiSelectMode && selectedItems.length > 0 && (
              <div style={{ color: '#0056b3', fontWeight: 'bold' }}>
                {selectedItems.length} elemento(s) seleccionado(s)
              </div>
            )}
          </div>
        )}
        
        {(!files || files.length === 0) ? (
          <p className="empty-folder" style={{
            textAlign: 'center',
            padding: '30px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            color: '#6c757d'
          }}>
            {isSearchResults 
              ? "No se encontraron resultados para la búsqueda." 
              : "La carpeta está vacía"}
          </p>
        ) : (
          <div className="file-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {files.map((file) => {
              // Determinar la ruta del archivo
              const filePath = getFilePath(file);
              
              // Obtener los metadatos del archivo
              const metadata = fileMetadata[filePath] || {};
              
              // Obtener fecha de creación o subida
              const uploadDate = metadata.uploadDate || file.updated || '';
              
              // Obtener las etiquetas
              const tags = metadata.tags || [];
              
              // Verificar si hay URLs asociadas
              const hasYoutubeUrl = youtubeUrls[filePath] ? true : false;
              const hasAudioUrl = audioUrls[filePath] ? true : false;
              const hasImageUrl = imageUrls[filePath] ? true : false;
              
              return (
                <div key={file.name || file.path} className="file-card" style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  border: selectedItems.some(item => item.path === filePath) ? '2px solid #007bff' : '1px solid #e0e0e0',
                  transition: 'all 0.2s ease'
                }}>
                  <div 
                    className="file-card-header"
                    onClick={() => handleFileClick(file)}
                    style={{
                      padding: '15px',
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    {multiSelectMode && (
                      <div className="select-checkbox" style={{
                        marginRight: '10px',
                        zIndex: 5
                      }}>
                        <input 
                          type="checkbox"
                          checked={selectedItems.some(item => item.path === filePath)}
                          onChange={(e) => handleItemSelect(file, e)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer'
                          }}
                        />
                      </div>
                    )}
                    
                    <div className="file-icon" style={{
                      fontSize: '32px',
                      marginRight: '15px',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {file.isFolder ? '📁' : getFileIcon(file.name)}
                      
                      {/* Mostrar iconos de enlaces si existen */}
                      <div className="file-link-icons" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        marginLeft: '5px'
                      }}>
                        {hasYoutubeUrl && (
                          <span 
                            onClick={(e) => handleOpenYoutubeUrl(filePath, e)}
                            style={{
                              fontSize: '14px',
                              cursor: 'pointer',
                              color: '#FF0000',
                              marginBottom: '2px'
                            }}
                            title="Ver video de YouTube"
                          >
                            ▶️
                          </span>
                        )}
                        
                        {hasAudioUrl && (
                          <span 
                            onClick={(e) => handleOpenAudioUrl(filePath, e)}
                            style={{
                              fontSize: '14px',
                              cursor: 'pointer',
                              color: '#28a745',
                              marginBottom: '2px'
                            }}
                            title="Reproducir audio"
                          >
                            🔊
                          </span>
                        )}
                        
                        {hasImageUrl && (
                          <span 
                            onClick={(e) => handleOpenImageUrl(filePath, e)}
                            style={{
                              fontSize: '14px',
                              cursor: 'pointer',
                              color: '#17a2b8'
                            }}
                            title="Ver imagen"
                          >
                            🖼️
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="file-title" style={{
                      flex: 1,
                      overflow: 'hidden'
                    }}>
                      {renamingFile && renamingFile.name === file.name ? (
                        <div className="rename-input-container" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={newFileName}
                            onChange={e => setNewFileName(e.target.value)}
                            autoFocus
                            style={{
                              width: '100%',
                              padding: '5px',
                              borderRadius: '4px',
                              border: '1px solid #ced4da'
                            }}
                          />
                          <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'space-between' }}>
                            <button 
                              onClick={saveNewName}
                              style={{
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                cursor: 'pointer'
                              }}
                            >
                              Guardar
                            </button>
                            <button 
                              onClick={cancelRename}
                              style={{
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                cursor: 'pointer'
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="file-name" title={file.name} style={{
                          fontWeight: 'bold',
                          fontSize: '16px',
                          marginBottom: '5px',
                          wordBreak: 'break-word'
                        }}>
                          {file.name}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="file-details" style={{
                    padding: '10px 15px',
                    fontSize: '13px',
                    color: '#6c757d',
                    flex: 1
                  }}>
                    {!file.isFolder && (
                      <>
                        <div style={{ marginBottom: '5px' }}>
                          <span style={{ fontWeight: 'bold' }}>Tamaño:</span> {formatFileSize(file.size || 0)}
                        </div>
                        
                        {uploadDate && (
                          <div style={{ marginBottom: '5px' }}>
                            <span style={{ fontWeight: 'bold' }}>Fecha:</span> {formatDate(uploadDate)}
                          </div>
                        )}
                        
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ fontWeight: 'bold' }}>Ubicación:</span> {getFileLocation(file)}
                        </div>
                        
                        {/* Mostrar etiquetas si existen */}
                        {tags.length > 0 && (
                          <div className="file-tags" style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '5px',
                            marginTop: '10px'
                          }}>
                            {tags.map((tag, index) => (
                              <span key={index} className="file-tag" style={{
                                fontSize: '12px',
                                padding: '2px 8px',
                                backgroundColor: '#e9ecef',
                                borderRadius: '12px',
                                whiteSpace: 'nowrap'
                              }}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    </div>
                
                <div className="file-actions" style={{
                  padding: '10px 15px',
                  borderTop: '1px solid #f0f0f0',
                  backgroundColor: '#f8f9fa',
                  display: 'flex',
                  justifyContent: 'flex-start'
                }}>
                  {/* Solo administradores pueden ver el botón de acciones */}
                  {userRole === 'admin' && !multiSelectMode && (
                    <div className="dropdown" style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      className="action-button"
                      onClick={(e) => toggleActionsMenu(filePath, e)}
                      style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          fontWeight: 'bold'
                        }}
                      >
                        <span style={{ marginRight: '5px' }}>Acciones</span>
                        <span>{activeActionsMenu === filePath ? '▲' : '▼'}</span>
                      </button>
                      
                      {activeActionsMenu === filePath && (
                        <div 
                        ref={el => { 
                          if (el) dropdownRefs.current.set(filePath, el);
                          else dropdownRefs.current.delete(filePath);
                        }}

                        className="dropdown-menu" 
style={{
  position: 'absolute',
  bottom: '100%',  // Cambiamos top por bottom para que aparezca arriba del botón
  left: '0',
  zIndex: 1000,
  backgroundColor: 'white',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  borderRadius: '4px',
  minWidth: '200px',
  marginBottom: '5px',  // Usamos marginBottom en lugar de marginTop
  display: 'block',
  padding: '5px 0'
}}
                        >
                          {!file.isFolder && (
                            <>
                              <button
                                onClick={(e) => handleEditYoutubeUrl(file, e)}
                                className="dropdown-item"
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '8px 12px',
                                  textAlign: 'left',
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  borderBottom: '1px solid #f0f0f0',
                                  cursor: 'pointer'
                                }}
                              >
                                Añadir URL de YouTube
                              </button>
                              
                              <button
                                onClick={(e) => handleEditAudioUrl(file, e)}
                                className="dropdown-item"
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '8px 12px',
                                  textAlign: 'left',
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  borderBottom: '1px solid #f0f0f0',
                                  cursor: 'pointer'
                                }}
                              >
                                Añadir URL de Audio
                              </button>
                              
                              <button
                                onClick={(e) => handleEditImageUrl(file, e)}
                                className="dropdown-item"
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '8px 12px',
                                  textAlign: 'left',
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  borderBottom: '1px solid #f0f0f0',
                                  cursor: 'pointer'
                                }}
                              >
                                Añadir URL de Imagen
                              </button>
                              
                              <button
                                onClick={(e) => handleOpenMetadataEditor(file, e)}
                                className="dropdown-item"
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '8px 12px',
                                  textAlign: 'left',
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  borderBottom: '1px solid #f0f0f0',
                                  cursor: 'pointer'
                                }}
                              >
                                Editar Metadatos
                              </button>
                            </>
                          )}
                          
                          <button
                            onClick={(e) => startRename(file, e)}
                            className="dropdown-item"
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '8px 12px',
                              textAlign: 'left',
                              backgroundColor: 'transparent',
                              border: 'none',
                              borderBottom: '1px solid #f0f0f0',
                              cursor: 'pointer'
                            }}
                          >
                            Renombrar
                          </button>
                          
                          {!file.isFolder && (
                            <button
                              onClick={(e) => handleDuplicate(file, e)}
                              className="dropdown-item"
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '8px 12px',
                                textAlign: 'left',
                                backgroundColor: 'transparent',
                                border: 'none',
                                borderBottom: '1px solid #f0f0f0',
                                cursor: 'pointer'
                              }}
                            >
                              Duplicar
                            </button>
                          )}
                          
                          <button
                            onClick={(e) => handleDelete(file, e)}
                            className="dropdown-item"
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '8px 12px',
                              textAlign: 'left',
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#dc3545',
                              cursor: 'pointer'
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Mostrar campos de entrada si se está editando */}
                  {editingUrlFile === filePath && (
                    <div className="youtube-url-input-container" onClick={e => e.stopPropagation()} style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%'
                    }}>
                      <input
                        type="text"
                        value={tempUrl}
                        onChange={e => setTempUrl(e.target.value)}
                        placeholder="URL de YouTube"
                        className="youtube-url-input"
                        style={{
                          flex: 1,
                          padding: '5px',
                          borderRadius: '4px 0 0 4px',
                          border: '1px solid #ced4da',
                          borderRight: 'none'
                        }}
                      />
                      <button 
                        onClick={e => handleSaveYoutubeUrl(filePath, e)}
                        className="save-url-btn"
                        style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0',
                          padding: '6px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        ✓
                      </button>
                      <button 
                        onClick={handleCancelEdit}
                        className="cancel-url-btn"
                        style={{
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0 4px 4px 0',
                          padding: '6px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  
                  {editingAudioFile === filePath && (
                    <div className="audio-url-input-container" onClick={e => e.stopPropagation()} style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%'
                    }}>
                      <input
                        type="text"
                        value={tempAudioUrl}
                        onChange={e => setTempAudioUrl(e.target.value)}
                        placeholder="URL de Audio"
                        className="audio-url-input"
                        style={{
                          flex: 1,
                          padding: '5px',
                          borderRadius: '4px 0 0 4px',
                          border: '1px solid #ced4da',
                          borderRight: 'none'
                        }}
                      />
                      <button 
                        onClick={e => handleSaveAudioUrl(filePath, e)}
                        className="save-url-btn"
                        style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0',
                          padding: '6px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        ✓
                      </button>
                      <button 
                        onClick={handleCancelAudioEdit}
                        className="cancel-url-btn"
                        style={{
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0 4px 4px 0',
                          padding: '6px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  
                  {editingImageFile === filePath && (
                    <div className="image-url-input-container" onClick={e => e.stopPropagation()} style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%'
                    }}>
                      <input
                        type="text"
                        value={tempImageUrl}
                        onChange={e => setTempImageUrl(e.target.value)}
                        placeholder="URL de Imagen"
                        className="image-url-input"
                        style={{
                          flex: 1,
                          padding: '5px',
                          borderRadius: '4px 0 0 4px',
                          border: '1px solid #ced4da',
                          borderRight: 'none'
                        }}
                      />
                      <button 
                        onClick={e => handleSaveImageUrl(filePath, e)}
                        className="save-url-btn"
                        style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0',
                          padding: '6px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        ✓
                      </button>
                      <button 
                        onClick={handleCancelImageEdit}
                        className="cancel-url-btn"
                        style={{
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0 4px 4px 0',
                          padding: '6px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor de metadatos */}
      <FileMetadataEditor
        filePath={selectedFilePath}
        isOpen={showMetadataEditor}
        onClose={handleCloseMetadataEditor}
        onSave={handleMetadataEdited}
      />
    </div>
  );
};

export default FileList;