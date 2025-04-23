import React, { useState, useEffect } from 'react';
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

  //

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

  // FUNCIONES PARA METADATOS

  // Función para abrir el editor de metadatos
  const handleOpenMetadataEditor = (file, e) => {
    e.stopPropagation(); // Evitar que se propague el clic
    
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
                className={`file-item-content ${file.isFolder ? 'folder' : 'file'} ${
                  selectedItems.some(item => 
                    item.path === (isSearchResults 
                      ? (file.path.startsWith('/') ? file.path.substring(1) : file.path) 
                      : (currentPath ? `${currentPath}/${file.name}` : file.name))
                  ) ? 'selected' : ''
                }`}
                onClick={() => handleFileClick(file)}
                style={{
                  display: 'flex',
                  position: 'relative',
                  padding: '10px',
                  borderRadius: '4px',
                  marginBottom: '10px',
                  backgroundColor: selectedItems.some(item => 
                    item.path === (isSearchResults 
                      ? (file.path.startsWith('/') ? file.path.substring(1) : file.path) 
                      : (currentPath ? `${currentPath}/${file.name}` : file.name))
                  ) ? '#e3f2fd' : '#f8f9fa',
                  border: '1px solid #dee2e6',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {multiSelectMode && (
                  <div className="select-checkbox" style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    zIndex: 5
                  }}>
                    <input 
                      type="checkbox"
                      checked={selectedItems.some(item => 
                        item.path === (isSearchResults 
                          ? (file.path.startsWith('/') ? file.path.substring(1) : file.path) 
                          : (currentPath ? `${currentPath}/${file.name}` : file.name))
                      )}
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
                  marginLeft: multiSelectMode ? '30px' : '0',
                  fontSize: '24px',
                  marginRight: '10px'
                }}>
                  {file.isFolder ? '📁' : (file.name.toLowerCase().endsWith('.pdf') ? '📑' : '📄')}
                </div>

                <div className="file-info" style={{
                  flexGrow: 1,
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
                      <div style={{ marginTop: '5px' }}>
                        <button 
                          onClick={saveNewName}
                          style={{
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            marginRight: '5px',
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
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {file.name}
                    </div>
                  )}
                  
                  {/* Mostrar etiquetas si existen */}
                  {!file.isFolder && (() => {
                    // Determinar la ruta correcta del archivo
                    const filePath = isSearchResults 
                      ? (file.path.startsWith('/') ? file.path.substring(1) : file.path)
                      : (currentPath ? `${currentPath}/${file.name}` : file.name);
                    
                    // Obtener metadatos y etiquetas
                    const metadata = fileMetadata[filePath];
                    const tags = metadata?.tags || [];
                    
                    return tags.length > 0 ? (
                      <div className="file-tags" style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '5px',
                        marginTop: '5px'
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
                    ) : null;
                  })()}
                </div>
                
                {/* Mostrar ruta para resultados de búsqueda */}
                {isSearchResults && (
                  <div className="search-path-info" title={file.path} style={{
                    fontSize: '12px',
                    color: '#6c757d',
                    marginTop: '5px'
                  }}>
                    Ubicación: {file.path ? file.path.split('/').slice(0, -1).join('/') || 'Raíz' : 'Raíz'}
                  </div>
                )}
              </div>

              <div className="file-buttons mobile-actions" style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
                marginTop: '-5px',
                marginBottom: '10px'
              }}>
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
                        style={{
                          backgroundColor: '#FF0000',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '5px 10px',
                          cursor: 'pointer'
                        }}
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
                        style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '5px 10px',
                          cursor: 'pointer'
                        }}
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
                        style={{
                          backgroundColor: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '5px 10px',
                          cursor: 'pointer'
                        }}
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
                          <div className="youtube-url-input-container" onClick={e => e.stopPropagation()} style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '5px',
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
                              onClick={e => handleSaveYoutubeUrl(
                                isSearchResults ? 
                                  (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
                                  (currentPath ? `${currentPath}/${file.name}` : file.name), 
                                e
                              )}
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
                        ) : (
                          <button
                            className="add-youtube-btn"
                            onClick={e => handleEditYoutubeUrl(file, e)}
                            title="Añadir URL de YouTube"
                            style={{
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '5px 10px',
                              cursor: 'pointer'
                            }}
                          >
                            🔗
                          </button>
                        )}

                        {/* Control de Audio */}
                        {editingAudioFile === (isSearchResults ? 
                          (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
                          (currentPath ? `${currentPath}/${file.name}` : file.name)) ? (
                          <div className="audio-url-input-container" onClick={e => e.stopPropagation()} style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '5px',
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
                              onClick={e => handleSaveAudioUrl(
                                isSearchResults ? 
                                  (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
                                  (currentPath ? `${currentPath}/${file.name}` : file.name), 
                                e
                              )}

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
                        ) : (
                          <button
                            className="add-audio-btn"
                            onClick={e => handleEditAudioUrl(file, e)}
                            title="Añadir URL de Audio"
                            style={{
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '5px 10px',
                              cursor: 'pointer'
                            }}
                          >
                            🎵
                          </button>
                        )}

                        {/* Control de Imagen */}
                        {editingImageFile === (isSearchResults ? 
                          (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
                          (currentPath ? `${currentPath}/${file.name}` : file.name)) ? (
                          <div className="image-url-input-container" onClick={e => e.stopPropagation()} style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '5px',
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
                              onClick={e => handleSaveImageUrl(
                                isSearchResults ? 
                                  (file.path.startsWith('/') ? file.path.substring(1) : file.path) : 
                                  (currentPath ? `${currentPath}/${file.name}` : file.name), 
                                e
                              )}
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
                        ) : (
                          <button
                            className="add-image-btn"
                            onClick={e => handleEditImageUrl(file, e)}
                            title="Añadir URL de Imagen"
                            style={{
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '5px 10px',
                              cursor: 'pointer'
                            }}
                          >
                            🖼️
                          </button>
                        )}
                      </>
                    )}

                    {/* Botón para editar metadatos (solo para archivos, no carpetas) */}
                    {!file.isFolder && userRole === 'admin' && (
                      <button
                        className="edit-metadata-btn"
                        onClick={(e) => handleOpenMetadataEditor(file, e)}
                        title="Editar metadatos"
                        style={{
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '5px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        📋
                      </button>
                    )}
                  </>
                )}
                
                {/* Botones para administradores */}
                {userRole === 'admin' && !multiSelectMode && (
                  <>
                    {/* Botón renombrar */}
                    <button
                      className="rename-btn"
                      onClick={(e) => startRename(file, e)}
                      title="Renombrar"
                      style={{
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '5px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      ✏️
                    </button>
                    
                    {/* Botón duplicar (solo para archivos) */}
                    {!file.isFolder && (
                      <button
                        className="duplicate-btn"
                        onClick={(e) => handleDuplicate(file, e)}
                        title="Duplicar"
                        style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '5px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        📋
                      </button>
                    )}
                    
                    {/* Botón eliminar */}
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file);
                      }}
                      title="Eliminar"
                      style={{
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '5px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
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