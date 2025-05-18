import React, { useState, useEffect } from 'react';
import FileList from './FileList';
import FileActions from './FileActions';
import UploadForm from './UploadForm';
import SearchForm from './SearchForm';  // Importar el nuevo componente
import * as api from '../services/api';  // Importar todo el módulo api
import { hasAdminPermission } from '../services/auth';  // Importar función de verificación de permisos

const FileExplorer = ({ userRole, username }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSearchMode, setIsSearchMode] = useState(false);  // Nuevo estado para modo de búsqueda
  const [searchResults, setSearchResults] = useState([]);   // Estado para resultados de búsqueda
  const [searchTerm, setSearchTerm] = useState('');         // Almacenar el término de búsqueda actual
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSizeSearch, setIsSizeSearch] = useState(false);  // Estado para búsqueda por tamaño
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(100); // 100 elementos por página
  const [totalFiles, setTotalFiles] = useState(0);
  const [hasMoreFiles, setHasMoreFiles] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchFiles = async (path, refresh = true, page = 0) => {
    if (isSearchMode) return; // No cargar archivos si estamos en modo búsqueda
    
    // Si es un refresco completo, establecer isLoading a true
    if (refresh) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      // Usar la versión paginada de listFiles
      const offset = page * pageSize;
      console.log(`Cargando archivos de ${path}, página ${page}, offset ${offset}, pageSize ${pageSize}`);
      
      const result = await api.listFilesPaginated(path, pageSize, offset, 'name', 'asc');
      
      if (!result || !result.items) {
        throw new Error('No se recibieron datos válidos del servidor');
      }
      
      // Filtrar archivos .metadata para que no se muestren
      const filteredData = result.items.filter(file => {
        return !file.name.endsWith('.metadata') && 
               !file.name.endsWith('.youtube.metadata') && 
               !file.name.endsWith('.audio.metadata') &&
               !file.name.endsWith('.image.metadata') &&
               !file.name.endsWith('.access.metadata');
      });
      
      // Si es un refresco, reemplazar archivos; si no, añadir a los existentes
      if (refresh) {
        setFiles(filteredData);
      } else {
        setFiles(prevFiles => [...prevFiles, ...filteredData]);
      }
      
      // Actualizar información de paginación
      setCurrentPage(page);
      setHasMoreFiles(result.pagination.hasMore);
      setTotalFiles(result.pagination.total);
      
    } catch (err) {
      console.error('Error al cargar archivos:', err);
      setError('No se pudieron cargar los archivos. Por favor intente nuevamente.');
    } finally {
      if (refresh) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  };

  // Función para cargar más archivos (siguiente página)
  const loadMoreFiles = async () => {
    if (isLoadingMore || !hasMoreFiles) return;
    
    // Cargar la siguiente página
    const nextPage = currentPage + 1;
    await fetchFiles(currentPath, false, nextPage);
  };

  useEffect(() => {
    // Cuando cambia la ruta, cargar la primera página
    fetchFiles(currentPath, true, 0);
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

  const handleActionComplete = (action, data) => {
    if (action === 'append' && data) {
      // Si es una acción de 'append', establecer directamente los nuevos archivos
      setFiles(data);
    } else if (action === 'loadMore' && data) {
      // Si es una acción de carga de más archivos
      const { newItems, pagination } = data;
      
      // Añadir los nuevos items a la lista existente
      setFiles(prevFiles => [...prevFiles, ...newItems]);
      
      // Actualizar estado de paginación
      setCurrentPage(prevPage => prevPage + 1);
      setHasMoreFiles(pagination.hasMore);
      setTotalFiles(pagination.total);
    } else {
      // Para otras acciones, refrescar la lista completa
      fetchFiles(currentPath);
    }
  };

  // Función mejorada para manejar la búsqueda (normal, por etiquetas, por fecha y por tamaño)
  const handleSearch = async (term, isTagSearch = false, isDateSearch = false, dateSearchType = 'specific', isDirectResults = false, filterMetadata = true, isContentSearch = false, isSizeSearchResults = false) => {
    setIsLoading(true);
    setError(null);
    let results = [];
    
    try {
      // Verificar si ya recibimos resultados directos (para búsqueda combinada)
      if (isDirectResults) {
        console.log('Recibidos resultados directos de búsqueda combinada:', term.length);
        results = term; // En este caso, term contiene directamente los resultados
        setSearchTerm('Búsqueda combinada');
        setIsSizeSearch(isSizeSearchResults); // Actualizar estado para búsqueda por tamaño
      }
      else if (isTagSearch) {
        console.log('Iniciando búsqueda por etiqueta:', term);
        setSearchTerm(term);
        setIsSizeSearch(false);
        
        // Indicar al usuario que la búsqueda puede tardar
        setError('Buscando archivos con la etiqueta. Esto puede tardar un momento...');
        
        // NUEVO: Usar la función optimizada del API
        results = await api.searchFilesByTag(term);
        console.log('Resultados finales de búsqueda por etiqueta:', results);
      }
      else if (isDateSearch) {
        console.log('Iniciando búsqueda por fecha:', term);
        setSearchTerm(term);
        setIsSizeSearch(false);
        
        // Indicar al usuario que la búsqueda puede tardar
        setError('Buscando archivos por fecha. Esto puede tardar un momento...');
        
        // Procesar parámetros de búsqueda por fecha
        let searchDate;
        let searchType;
        
        if (term.startsWith('date:')) {
          searchType = 'specific';
          searchDate = term.substring(5); // Eliminar 'date:' del inicio
        } else if (term.startsWith('month:')) {
          searchType = 'month';
          searchDate = term.substring(6); // Eliminar 'month:' del inicio
        } else if (term.startsWith('year:')) {
          searchType = 'year';
          searchDate = term.substring(5); // Eliminar 'year:' del inicio
        } else {
          throw new Error('Formato de fecha inválido');
        }
        
        console.log('Parámetros de búsqueda por fecha:', { searchType, searchDate });
        
        // NUEVO: Usar la función optimizada del API
        results = await api.searchFilesByDate(searchDate, searchType);
        console.log('Resultados finales de búsqueda por fecha:', results);
      }
      else if (isContentSearch) {
        console.log('Iniciando búsqueda por contenido:', term);
        setSearchTerm(term);
        setIsSizeSearch(false);
        
        // Indicar al usuario que la búsqueda puede tardar
        setError('Buscando en el contenido de los archivos. Esto puede tardar un momento...');
        
        // Ya tenemos los resultados directos de la búsqueda por contenido
        results = await api.searchByContent(term);
        
        // Marcar los resultados como encontrados por contenido para visualización
        results = results.map(file => ({
          ...file,
          foundByContent: true
        }));
        
        console.log('Resultados finales de búsqueda por contenido:', results);
      }
      else if (isSizeSearchResults) {
        console.log('Iniciando búsqueda por tamaño:', term);
        setSearchTerm(term);
        setIsSizeSearch(true);
        
        // Para búsqueda por tamaño, los resultados ya vienen directamente
        results = term;
      }
      else {
        // Búsqueda normal por nombre
        setSearchTerm(term);
        setIsSizeSearch(false);
        results = await api.searchFiles(term);
      }
    
      // Filtrar archivos de metadata si es necesario
      if (filterMetadata) {
        results = results.filter(file => {
          return !file.name.endsWith('.metadata') && 
                 !file.name.endsWith('.youtube.metadata') && 
                 !file.name.endsWith('.audio.metadata') &&
                 !file.name.endsWith('.image.metadata') &&
                 !file.name.endsWith('.access.metadata');
        });
        console.log('Resultados después de filtrar archivos metadata:', results.length);
      }
    
      setSearchResults(results);
      setIsSearchMode(true);
      
      // Mostrar mensaje si no hay resultados
      if (results.length === 0) {
        if (isTagSearch) {
          setError(`No se encontraron archivos con la etiqueta "${term}"`);
        } else if (isDateSearch) {
          setError(`No se encontraron archivos para la fecha especificada`);
        } else if (isSizeSearchResults) {
          setError(`No se encontraron archivos con el tamaño especificado`);
        } else {
          setError(`No se encontraron resultados para "${term}"`);
        }
      } else {
        // Limpiar el mensaje de error si hay resultados
        setError(null);
      }
      
      // Actualizar el estado de búsqueda por tamaño si se recibieron resultados directos
      if (isDirectResults && isSizeSearchResults) {
        setIsSizeSearch(true);
      }
    } catch (err) {
      console.error('Error en la búsqueda:', err);
      setError(`Error al realizar la búsqueda: ${err.message}`);
      setIsSearchMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para obtener todos los archivos de forma recursiva
  const fetchAllFiles = async (path = '') => {
    try {
      const filesInPath = await api.listFiles(path);
      let allFiles = [];
      
      for (const file of filesInPath) {
        const filePath = path ? `${path}/${file.name}` : file.name;
        
        if (file.isFolder) {
          // Si es una carpeta, buscar recursivamente
          const filesInFolder = await fetchAllFiles(filePath);
          allFiles = [...allFiles, ...filesInFolder];
        } else {
          // Si es un archivo, agregarlo a la lista
          allFiles.push({
            ...file,
            path: filePath
          });
        }
      }
      
      return allFiles;
    } catch (error) {
      console.error('Error al obtener todos los archivos:', error);
      return [];
    }
  };
  
  // Función para buscar archivos por etiqueta
  const findFilesByTag = async (files, tagSearch) => {
    const results = [];
    const searchTermLower = tagSearch.toLowerCase();
    
    for (const file of files) {
      if (!file.isFolder) {
        try {
          // Obtener metadatos del archivo
          const metadata = await api.getFileMetadata(file.path);
          console.log(`Metadatos de ${file.path}:`, metadata);
          
          // Verificar si tiene etiquetas que coincidan
          if (metadata && metadata.tags && Array.isArray(metadata.tags)) {
            const hasMatchingTag = metadata.tags.some(tag => 
              tag.toLowerCase().includes(searchTermLower)
            );
            
            if (hasMatchingTag) {
              console.log(`Archivo coincidente encontrado: ${file.path}`);
              results.push({
                ...file,
                metadata: metadata // Incluir metadatos para mostrar etiquetas en resultados
              });
            }
          }
        } catch (error) {
          console.error(`Error al buscar etiquetas para ${file.path}:`, error);
        }
      }
    }
    
    return results;
  };

  // Función para buscar archivos por fecha
  const findFilesByDate = async (files, dateSearch, searchType) => {
    const results = [];
    
    for (const file of files) {
      if (!file.isFolder) {
        try {
          // Obtener metadatos del archivo
          const metadata = await api.getFileMetadata(file.path);
          
          if (metadata && metadata.fileDate) {
            const fileDate = metadata.fileDate; // Formato esperado: YYYY-MM-DD
            
            let isMatch = false;
            
            // Verificar coincidencia según el tipo de búsqueda
            if (searchType === 'specific') {
              // Búsqueda por fecha específica (formato YYYY-MM-DD)
              isMatch = fileDate === dateSearch;
            } 
            else if (searchType === 'month') {
              // Búsqueda por mes y año (formato MM-YYYY o sólo MM si no tiene guion)
              let [searchMonth, searchYear] = dateSearch.includes('-') 
                ? dateSearch.split('-') 
                : [dateSearch, new Date().getFullYear().toString()];
                
              const fileYear = fileDate.split('-')[0];
              const fileMonth = fileDate.split('-')[1];
              
              isMatch = fileMonth === searchMonth && 
                        (searchYear === undefined || fileYear === searchYear);
            } 
            else if (searchType === 'year') {
              // Búsqueda sólo por año
              const fileYear = fileDate.split('-')[0];
              isMatch = fileYear === dateSearch;
            }
            
            if (isMatch) {
              console.log(`Archivo con fecha coincidente encontrado: ${file.path}`);
              results.push({
                ...file,
                metadata: metadata // Incluir metadatos para mostrar información en resultados
              });
            }
          }
        } catch (error) {
          console.error(`Error al buscar por fecha para ${file.path}:`, error);
        }
      }
    }
    
    return results;
  };

  // Función para salir del modo búsqueda
  const handleClearSearch = () => {
    setIsSearchMode(false);
    setSearchResults([]);
    setSearchTerm('');
    setIsSizeSearch(false);
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
            isSizeSearch={isSizeSearch}
            onSelectFile={setSelectedFile}
            selectedFile={selectedFile}
            hasMoreFiles={!isSearchMode && hasMoreFiles}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMoreFiles}
            totalFiles={totalFiles}
          />
          
          {/* Botón de cargar más (fuera de la lista) */}
          {!isSearchMode && hasMoreFiles && !isLoading && (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <button 
                onClick={loadMoreFiles} 
                disabled={isLoadingMore}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                  opacity: isLoadingMore ? 0.7 : 1
                }}
              >
                {isLoadingMore ? 'Cargando...' : `Cargar más archivos (${totalFiles - files.length} restantes)`}
              </button>
            </div>
          )}
          
          {!isSearchMode && (
            (userRole === 'admin' || 
            hasAdminPermission('create_folders') || 
            hasAdminPermission('delete_folders') || 
            hasAdminPermission('upload_files')
          ) && (
            <div className="admin-actions">
              {(userRole === 'admin' || 
               hasAdminPermission('create_folders') || 
               hasAdminPermission('delete_folders')) && (
                <FileActions 
                  currentPath={currentPath} 
                  onActionComplete={handleActionComplete} 
                  selectedFile={selectedFile}
                />
              )}
              
              {(userRole === 'admin' || 
               hasAdminPermission('upload_files')) && (
                <UploadForm 
                  currentPath={currentPath} 
                  onUploadComplete={handleActionComplete} 
                />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default FileExplorer;