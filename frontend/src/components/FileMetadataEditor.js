import React, { useState, useEffect } from 'react';
import * as api from '../services/api';

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
    const token = localStorage.getItem('authToken');
    if (token) {
      const tokenData = JSON.parse(atob(token));
      return tokenData.bucket || 'master';
    }
  } catch (error) {
    console.error('Error al obtener bucket del token:', error);
  }
  return 'master'; // valor por defecto
};

// Migrar etiquetas de la clave antigua a la nueva clave específica del bucket
useEffect(() => {
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
  
  migrateTagsToNewFormat();
}, []);


// Cargar etiquetas sugeridas desde el gestor de etiquetas por categorías
useEffect(() => {
  const loadSavedTags = () => {
    try {
      const currentBucket = getCurrentBucket();
      const storageKey = `docubox_tags_categories_${currentBucket}`;
      
      console.log(`Cargando categorías de etiquetas para bucket: ${currentBucket}`);
      
      const savedCategories = localStorage.getItem(storageKey);
      if (savedCategories) {
        const parsedCategories = JSON.parse(savedCategories);
        if (Array.isArray(parsedCategories)) {
          // Extraer todas las etiquetas de todas las categorías
          const allTags = [];
          parsedCategories.forEach(category => {
            if (category.tags && Array.isArray(category.tags)) {
              allTags.push(...category.tags);
            }
          });
          
          // Eliminar duplicados
          const uniqueTags = [...new Set(allTags)];
          setSuggestedTags(uniqueTags);
          console.log(`${uniqueTags.length} etiquetas cargadas de ${parsedCategories.length} categorías para bucket ${currentBucket}`);
        }
      } else {
        // Intentar cargar del formato antiguo como respaldo
        const oldStorageKey = `docubox_saved_tags_${currentBucket}`;
        const oldSavedTags = localStorage.getItem(oldStorageKey);
        
        if (oldSavedTags) {
          const parsedTags = JSON.parse(oldSavedTags);
          if (Array.isArray(parsedTags)) {
            setSuggestedTags(parsedTags);
            console.log(`${parsedTags.length} etiquetas cargadas del formato antiguo para bucket ${currentBucket}`);
          }
        } else {
          console.log(`No hay etiquetas guardadas para el bucket ${currentBucket}`);
          setSuggestedTags([]);
        }
      }
    } catch (error) {
      console.error('Error al cargar etiquetas guardadas:', error);
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
      
      // Valores por defecto
      const defaultMetadata = {
        uploadDate: new Date().toISOString().split('T')[0],
        fileDate: new Date().toISOString().split('T')[0],
        uploadedBy: 'admin1',
        tags: [],
        lastModified: new Date().toISOString().split('T')[0]
      };
      
      try {
        const metadataResponse = await api.getFileMetadata(filePath);
        if (metadataResponse) {
          setMetadata(metadataResponse);
          
          // Formatear fecha para el input type="date"
          if (metadataResponse.fileDate) {
            setFileDate(metadataResponse.fileDate);
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
    // Crear objeto con los metadatos actualizados
    const updatedMetadata = {
      ...metadata,
      fileDate: fileDate,
      tags: tags,
      lastModified: new Date().toISOString().split('T')[0]
    };
    
    // Guardar cualquier etiqueta nueva en localStorage
if (tags.length > 0) {
  try {
    // Obtener el bucket actual
    const currentBucket = getCurrentBucket();
    const categoriesStorageKey = `docubox_tags_categories_${currentBucket}`;
    const oldStorageKey = `docubox_saved_tags_${currentBucket}`;
    
    // Primero intentar actualizar en el nuevo formato de categorías
    const savedCategories = localStorage.getItem(categoriesStorageKey);
    if (savedCategories) {
      let parsedCategories = JSON.parse(savedCategories);
      let defaultCategory = parsedCategories.find(cat => cat.name === 'General');
      let tagsUpdated = false;
      
      // Si no existe la categoría General, crearla
      if (!defaultCategory) {
        defaultCategory = {
          id: 'default',
          name: 'General',
          tags: []
        };
        parsedCategories.push(defaultCategory);
      }
      
      // Añadir solo etiquetas que no existan ya en ninguna categoría
      const allExistingTags = [];
      parsedCategories.forEach(cat => {
        if (cat.tags && Array.isArray(cat.tags)) {
          allExistingTags.push(...cat.tags);
        }
      });
      
      tags.forEach(tag => {
        if (!allExistingTags.includes(tag)) {
          // Buscar el índice de la categoría General
          const defaultCatIndex = parsedCategories.findIndex(cat => cat.name === 'General');
          if (defaultCatIndex !== -1) {
            // Asegurarse de que tags es un array
            if (!parsedCategories[defaultCatIndex].tags) {
              parsedCategories[defaultCatIndex].tags = [];
            }
            parsedCategories[defaultCatIndex].tags.push(tag);
            tagsUpdated = true;
          }
        }
      });
      
      // Guardar categorías actualizadas
      if (tagsUpdated) {
        localStorage.setItem(categoriesStorageKey, JSON.stringify(parsedCategories));
        console.log(`Categorías de etiquetas actualizadas para el bucket ${currentBucket}`);
      }
      
      // Extraer todas las etiquetas para actualizar las sugerencias
      const allTags = [];
      parsedCategories.forEach(cat => {
        if (cat.tags && Array.isArray(cat.tags)) {
          allTags.push(...cat.tags);
        }
      });
      const uniqueTags = [...new Set(allTags)];
      setSuggestedTags(uniqueTags);
    } else {
      // Si no hay categorías, usar el formato antiguo como respaldo
      // Recuperar etiquetas existentes para este bucket específico
      const savedTags = localStorage.getItem(oldStorageKey);
      let existingTags = [];
      
      if (savedTags) {
        existingTags = JSON.parse(savedTags);
      }
      
      // Añadir solo etiquetas que no existan ya
      let tagsUpdated = false;
      tags.forEach(tag => {
        if (!existingTags.includes(tag)) {
          existingTags.push(tag);
          tagsUpdated = true;
        }
      });
      
      // Guardar en localStorage si hubo cambios
      if (tagsUpdated) {
        localStorage.setItem(oldStorageKey, JSON.stringify(existingTags));
        setSuggestedTags(existingTags);
        console.log(`Etiquetas actualizadas para el bucket ${currentBucket} (formato antiguo)`);
      }
    }
  } catch (error) {
    console.error('Error al actualizar etiquetas guardadas:', error);
  }
}
    
    console.log('Metadatos actualizados localmente:', updatedMetadata);
    
    // Intentar guardar en el servidor, pero no esperar la respuesta
    try {
      api.updateFileMetadata(filePath, updatedMetadata)
        .then(() => console.log('Metadatos guardados en el servidor'))
        .catch(err => console.error('Error al guardar en el servidor:', err));
    } catch (e) {
      console.error('Error al intentar guardar:', e);
    }
    
    // Mostrar mensaje al usuario
alert("Metadatos guardados correctamente");

    // Notificar al componente padre y cerrar
    if (onSave) {
      onSave(updatedMetadata);
    }
    
    // Cerrar el editor
    if (onClose) {
      onClose();
    }
  } catch (error) {
    console.error('Error en handleSave:', error);
    // Asegurar que el diálogo se cierre incluso si hay error
    if (onClose) {
      onClose();
    }
  }
};

  // Función para añadir una nueva etiqueta y guardarla en localStorage
const handleAddTag = () => {
  if (newTag.trim() && !tags.includes(newTag.trim())) {
    const trimmedTag = newTag.trim();
    
    // Añadir a las etiquetas actuales
    setTags([...tags, trimmedTag]);
    
    // Guardar en localStorage si es una etiqueta nueva
    if (!suggestedTags.includes(trimmedTag)) {
      const updatedSuggestions = [...suggestedTags, trimmedTag];
      setSuggestedTags(updatedSuggestions);
      
      try {
        // Obtener el bucket actual
        const currentBucket = getCurrentBucket();
        const categoriesStorageKey = `docubox_tags_categories_${currentBucket}`;
        const oldStorageKey = `docubox_saved_tags_${currentBucket}`;
        
        // Primero intentar guardar en el nuevo formato de categorías
        const savedCategories = localStorage.getItem(categoriesStorageKey);
        if (savedCategories) {
          let parsedCategories = JSON.parse(savedCategories);
          // Buscar la categoría General o crear una nueva
          let defaultCategoryIndex = parsedCategories.findIndex(cat => cat.name === 'General');
          
          if (defaultCategoryIndex === -1) {
            // Si no existe la categoría General, crearla
            parsedCategories.push({
              id: 'default',
              name: 'General',
              tags: [trimmedTag]
            });
          } else {
            // Asegurarse de que la categoría tiene un array de tags
            if (!parsedCategories[defaultCategoryIndex].tags) {
              parsedCategories[defaultCategoryIndex].tags = [];
            }
            // Añadir la nueva etiqueta
            parsedCategories[defaultCategoryIndex].tags.push(trimmedTag);
          }
          
          // Guardar categorías actualizadas
          localStorage.setItem(categoriesStorageKey, JSON.stringify(parsedCategories));
          console.log(`Etiqueta "${trimmedTag}" guardada en la categoría General para bucket ${currentBucket}`);
        } else {
          // Si no hay formato de categorías, usar el formato antiguo
          localStorage.setItem(oldStorageKey, JSON.stringify(updatedSuggestions));
          console.log(`Etiqueta "${trimmedTag}" guardada para el bucket ${currentBucket} (formato antiguo)`);
        }
      } catch (error) {
        console.error('Error al guardar etiqueta en localStorage:', error);
      }
    }
    
    // Limpiar input y ocultar sugerencias
    setNewTag('');
    setShowSuggestions(false);
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
              
              <div className="add-tag-container">
                <div className="tag-input-wrapper">
                  <input
                    type="text"
                    value={newTag}
                    onChange={handleTagInputChange}
                    placeholder="Nueva etiqueta"
                    className="tag-input"
                  />
                  {showSuggestions && (
                    <div className="tag-suggestions">
                      {filteredSuggestions.map((tag, index) => (
                        <div 
                          key={index} 
                          className="tag-suggestion"
                          onClick={() => handleSelectSuggestion(tag)}
                        >
                          {tag}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="add-tag-btn"
                >
                  Añadir
                </button>
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