import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import TagSelector from './TagSelector';

const FileMetadataEditor = ({ filePath, isOpen, onClose, onSave }) => {


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({
    uploadDate: new Date().toISOString().split('T')[0],
    fileDate: new Date().toISOString().split('T')[0],
    uploadedBy: 'admin1',
    tags: [],
    lastModified: new Date().toISOString().split('T')[0]
  });
  const [fileDate, setFileDate] = useState(new Date().toISOString().split('T')[0]);

  const [tags, setTags] = useState([]);
  const [tagObjects, setTagObjects] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

// Cargar los metadatos cuando se abre el editor
useEffect(() => {
  if (isOpen && filePath) {
    loadMetadata();
  }
}, [isOpen, filePath]);

// Obtener el bucket actual del token en localStorage
const getCurrentBucket = () => {
  try {
    // Intentar primero obtener desde user_session (nuevo formato)
    const userSession = localStorage.getItem('user_session');
    if (userSession) {
      const userData = JSON.parse(userSession);
      if (userData.bucket) {
        console.log('Obteniendo bucket desde user_session:', userData.bucket);
        return userData.bucket;
      }
    }
    
    // Si no funciona, intentar desde authToken (formato usado en otros componentes)
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const tokenData = JSON.parse(atob(token));
        if (tokenData.bucket) {
          console.log('Obteniendo bucket desde authToken:', tokenData.bucket);
          return tokenData.bucket;
        }
      } catch (tokenError) {
        console.error('Error al decodificar authToken:', tokenError);
      }
    }
  } catch (error) {
    console.error('Error al obtener bucket del almacenamiento:', error);
  }
  
  console.log('Usando bucket por defecto: master');
  return 'master'; // valor por defecto
};

const migrateTagsToNewFormat = () => {
    try {
      // Verificar si existen etiquetas en el formato antiguo
      const oldTags = localStorage.getItem('docubox_saved_tags');
      if (oldTags) {
        const parsedOldTags = JSON.parse(oldTags);
        if (Array.isArray(parsedOldTags) && parsedOldTags.length > 0) {
          // Obtener el bucket actual
          const currentBucket = getCurrentBucket();
          const newStorageKey = `docubox_saved_tags_${currentBucket}`;
          
          console.log(`Migrando ${parsedOldTags.length} etiquetas de la clave antigua al bucket ${currentBucket}`);
          
          // Verificar si ya existen etiquetas en el nuevo formato
          const existingNewTags = localStorage.getItem(newStorageKey);
          let combinedTags = parsedOldTags;
          
          if (existingNewTags) {
            const parsedNewTags = JSON.parse(existingNewTags);
            // Combinar etiquetas antiguas y nuevas, eliminando duplicados
            combinedTags = [...new Set([...parsedOldTags, ...parsedNewTags])];
          }
          
          // Guardar en el nuevo formato
          localStorage.setItem(newStorageKey, JSON.stringify(combinedTags));
          
          // Eliminar las etiquetas del formato antiguo para evitar confusiones futuras
          localStorage.removeItem('docubox_saved_tags');
          
          console.log(`Migración completada. ${combinedTags.length} etiquetas guardadas en formato nuevo.`);
        }
      }
    } catch (error) {
      console.error('Error al migrar etiquetas:', error);
    }
  };
  
  useEffect(() => {
    migrateTagsToNewFormat();
  }, []);

  // Cargar etiquetas sugeridas desde la API
useEffect(() => {
  const loadSavedTags = async () => {
    try {
      console.log('Cargando etiquetas desde la API...');
      
      // Obtener etiquetas desde la API
      const response = await api.getTags();
      
      console.log('Respuesta de la API getTags:', response);
      
      if (response && response.success && response.tags) {
        // Extraer todas las etiquetas
        const allTags = response.tags.map(tag => tag.tag_name);
        
        // Eliminar duplicados
        const uniqueTags = [...new Set(allTags)];
        console.log('Etiquetas únicas extraídas:', uniqueTags);
        setSuggestedTags(uniqueTags);
        console.log(`${uniqueTags.length} etiquetas cargadas desde la API`);
      } else if (response && response.success && response.tagsByCategory) {
        // Alternativa: extraer de tagsByCategory si está disponible
        const allTags = [];
        Object.entries(response.tagsByCategory).forEach(([category, tags]) => {
          allTags.push(...tags);
          console.log(`Categoría ${category} tiene ${tags.length} etiquetas`);
        });
        
        const uniqueTags = [...new Set(allTags)];
        console.log('Etiquetas únicas extraídas de tagsByCategory:', uniqueTags);
        setSuggestedTags(uniqueTags);
        console.log(`${uniqueTags.length} etiquetas cargadas desde la API (usando tagsByCategory)`);
      } else {
        console.log('No se pudieron cargar etiquetas desde la API. Respuesta:', response);
        setSuggestedTags([]);
      }
    } catch (error) {
      console.error('Error al cargar etiquetas desde la API:', error);
      setSuggestedTags([]);
    }
  };
  
  loadSavedTags();
}, []);

// Función para cargar metadatos
const loadMetadata = async () => {
  try {
    setLoading(true);
    setError(null);
    
    // Obtener la fecha actual formateada
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Valores por defecto actualizados con la fecha actual
    const defaultMetadata = {
      uploadDate: currentDate,
      fileDate: currentDate,
      uploadedBy: 'admin1',
      tags: [],
      lastModified: currentDate
    };
    
    console.log('Valores por defecto con fecha actual:', defaultMetadata);
    
    try {
      const metadataResponse = await api.getFileMetadata(filePath);
      console.log('Respuesta de metadatos:', metadataResponse);
      
      if (metadataResponse && Object.keys(metadataResponse).length > 0) {
        // Asegurarse de que todos los campos existan
        const completeMetadata = {
          ...defaultMetadata,
          ...metadataResponse
        };
        
        setMetadata(completeMetadata);
        
        // Formatear fecha para el input type="date"
        if (completeMetadata.fileDate) {
          setFileDate(completeMetadata.fileDate);
        } else {
          setFileDate(defaultMetadata.fileDate);
        }          
          // Cargar etiquetas
          if (Array.isArray(metadataResponse.tags)) {
            setTags(metadataResponse.tags);
          } else {
            setTags([]);
          }
        } else {
          setMetadata(defaultMetadata);
          setFileDate(defaultMetadata.fileDate);
          setTags(defaultMetadata.tags);
        }
      } catch (apiError) {
        console.log('Error al obtener metadatos, usando valores por defecto');
        setMetadata(defaultMetadata);
        setFileDate(defaultMetadata.fileDate);
        setTags(defaultMetadata.tags);
      }
      
    } catch (error) {
      console.error('Error general al cargar metadatos:', error);
    } finally {
      setLoading(false);
    }
  };

// Función para guardar los cambios
const handleSave = () => {
  try {
    // Agregar logs de depuración
    console.log("[META-DEBUG] Iniciando guardado de metadatos");
    
    // Obtener la fecha actual formateada
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Asegurarse de que la fecha de subida esté establecida
    const uploadDate = metadata.uploadDate || currentDate;
    
    // Crear objeto con los metadatos actualizados
    const updatedMetadata = {
      ...metadata,
      uploadDate: uploadDate, // Mantener la fecha de subida original o usar la fecha actual
      fileDate: fileDate,
      tags: tags,
      lastModified: currentDate // Siempre actualizar la fecha de última modificación
    };
    
    console.log('[META-DEBUG] Metadatos a guardar:', updatedMetadata);
    console.log('[META-DEBUG] Ruta del archivo:', filePath);
    
    // Intentar guardar en el servidor con gestión de errores mejorada
    try {
      console.log('[META-DEBUG] Enviando solicitud al servidor...');
      
      // Añadir pequeña demora para asegurar que se procese correctamente
      setTimeout(() => {
        api.updateFileMetadata(filePath, updatedMetadata)
          .then((response) => {
            console.log('[META-DEBUG] Respuesta del servidor:', response);
            
            // Mostrar mensaje al usuario
            alert("Metadatos guardados correctamente");
            
            // Notificar al componente padre y cerrar
            if (onSave) {
              console.log('[META-DEBUG] Notificando al componente padre sobre guardado exitoso');
              onSave(updatedMetadata);
            }
            
            // Cerrar el editor
            if (onClose) {
              onClose();
            }
          })
          .catch(err => {
            console.error('[META-DEBUG] Error al guardar en el servidor:', err);
            console.error('[META-DEBUG] Detalles del error:', JSON.stringify(err, null, 2));
            alert("Error al guardar los metadatos: " + (err.message || "Error desconocido"));
          });
      }, 300); // Pequeña demora para asegurar que la API esté lista
    } catch (e) {
      console.error('[META-DEBUG] Error crítico al intentar guardar:', e);
      console.error('[META-DEBUG] Stack trace:', e.stack);
      alert("Error al guardar los metadatos: " + (e.message || "Error desconocido"));
    }
  } catch (error) {
    console.error('[META-DEBUG] Error general en handleSave:', error);
    console.error('[META-DEBUG] Stack trace:', error.stack);
    alert("Error al procesar los metadatos: " + (error.message || "Error desconocido"));
    // Asegurar que el diálogo se cierre incluso si hay error
    if (onClose) {
      onClose();
    }
  }
};
  // Función para eliminar una etiqueta
  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

// Función para manejar cambios en el input de etiqueta
const handleTagInputChange = (e) => {
  const value = e.target.value;
  setNewTag(value);
  
  // Filtrar sugerencias basadas en lo que el usuario escribe
  if (value.trim()) {
    const filtered = suggestedTags.filter(
      tag => tag.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  } else {
    setShowSuggestions(false);
  }
};

// Función para seleccionar una etiqueta sugerida
const handleSelectSuggestion = (tag) => {
  setNewTag(tag);
  setShowSuggestions(false);
};

  // Si el modal no está abierto, no renderizar nada
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content file-metadata-editor">
        <h2>Editar metadatos del archivo</h2>
        <p className="file-path">{filePath}</p>
        
        {loading ? (
          <p>Cargando metadatos...</p>
        ) : (
          <div className="metadata-form">
            <div className="form-group">
              <label>Fecha del archivo:</label>
              <input
                type="date"
                value={fileDate}
                onChange={(e) => setFileDate(e.target.value)}
                className="date-input"
              />
            </div>
            
            {metadata && (
              <div className="metadata-info">
                <p><strong>Fecha de subida:</strong> {metadata.uploadDate}</p>
                <p><strong>Subido por:</strong> {metadata.uploadedBy}</p>
                <p><strong>Última modificación:</strong> {metadata.lastModified}</p>
              </div>
            )}
            
            <div className="form-group">
              <label>Etiquetas:</label>
              <div className="tags-container">
                {tags.map((tag, index) => (
                  <div key={index} className="tag">
                    {tag}
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="tag-selector-container">
  <TagSelector 
    onTagsChange={(selectedTags) => {
      // Guardar los objetos de etiqueta completos
      setTagObjects(selectedTags);
      
      // Extraer solo los nombres de las etiquetas para mantener compatibilidad
      const tagNames = selectedTags.map(tag => tag.name);
      setTags(tagNames);
    }}
    maxTags={10}
  />
</div>

            </div>
            
            <div className="modal-buttons">
              <button
                type="button"
                onClick={onClose}
                className="cancel-btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="save-btn"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Nota: Asegúrate de que los siguientes estilos estén en App.css:
/*
.tag-input-wrapper {
  position: relative;
  width: 100%;
}

.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  max-height: 150px;
  overflow-y: auto;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.tag-suggestion {
  padding: 8px 12px;
  cursor: pointer;
}

.tag-suggestion:hover {
  background-color: #f0f0f0;
}
*/

export default FileMetadataEditor;