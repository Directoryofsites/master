import React, { useState, useEffect } from 'react';
import './TagManager.css'; // Crearemos este archivo después
import * as api from '../services/api';

const TagManager = () => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  // Cargar categorías y etiquetas al iniciar
  useEffect(() => {
    // Función autoejecutada asíncrona
    (async () => {
      try {
        await loadTagsAndCategories();
      } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
        setError('Error al cargar etiquetas. Por favor, recarga la página.');
      }
    })();
  }, []);

  // Función para cargar categorías y etiquetas desde el servidor
  const loadTagsAndCategories = async () => {
    try {
      setError('');
      // Obtener datos del servidor
      const response = await api.getTags();
      
      if (response && response.success) {
        // Transformar los datos al formato que espera el componente
        const transformedData = [];
        const tagsByCategory = response.tagsByCategory || {};
        
        // Convertir de formato de API a formato del componente
        Object.keys(tagsByCategory).forEach(categoryName => {
          transformedData.push({
            id: categoryName, // Usamos el nombre como ID para simplificar
            name: categoryName,
            tags: tagsByCategory[categoryName] || []
          });
        });
        
        // Si no hay categorías, inicializar con una categoría por defecto
        if (transformedData.length === 0) {
          transformedData.push({
            id: 'General',
            name: 'General',
            tags: []
          });
        }
        
        setCategories(transformedData);
        console.log(`Se cargaron ${transformedData.length} categorías de etiquetas`);
      } else {
        console.error('Error en la respuesta del servidor:', response);
        setError('Error al cargar etiquetas del servidor');
      }
    } catch (error) {
      console.error('Error al cargar etiquetas:', error);
      setError('Error al cargar etiquetas. Por favor, intenta de nuevo.');
    }
  };

  // Añadir una nueva categoría
  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      setError('Por favor, ingresa un nombre para la categoría');
      return;
    }

    // Verificar si ya existe una categoría con el mismo nombre
    if (categories.some(cat => cat.name.toLowerCase() === newCategory.trim().toLowerCase())) {
      setError('Ya existe una categoría con ese nombre');
      return;
    }

    try {
      setError('');
      const response = await api.createTagCategory(newCategory.trim());
      
      if (response && response.success) {
        // Recargar todas las categorías y etiquetas
        await loadTagsAndCategories();
        setNewCategory('');
        setSuccess('Categoría creada correctamente');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        console.error('Error al crear categoría:', response);
        setError('Error al crear categoría. Por favor, intenta de nuevo.');
      }
    } catch (error) {
      console.error('Error al crear categoría:', error);
      setError('Error al crear categoría. Por favor, intenta de nuevo.');
    }
  };

  // Eliminar una categoría (eliminando todas sus etiquetas)
  const handleDeleteCategory = async (categoryId) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta categoría y todas sus etiquetas?')) {
      try {
        setError('');
        
        // Encontrar la categoría
        const category = categories.find(cat => cat.id === categoryId);
        if (!category) {
          setError('Categoría no encontrada');
          return;
        }
        
        // Obtener todos los datos de etiquetas para encontrar los IDs
        const tagsResponse = await api.getTags();
        if (!tagsResponse.success) {
          setError('Error al obtener etiquetas');
          return;
        }
        
        // Filtrar las etiquetas que pertenecen a esta categoría
        const tagsToDelete = tagsResponse.tags.filter(tag => 
          tag.category === category.name
        );
        
        // Eliminar cada etiqueta una por una
        for (const tag of tagsToDelete) {
          await api.deleteTag(tag.id);
        }
        
        // Recargar todas las categorías y etiquetas
        await loadTagsAndCategories();
        
        if (selectedCategory === categoryId) {
          setSelectedCategory(null);
        }
        
        setSuccess('Categoría eliminada correctamente');
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        console.error('Error al eliminar categoría:', error);
        setError('Error al eliminar categoría. Por favor, intenta de nuevo.');
      }
    }
  };

  // Añadir una nueva etiqueta a la categoría seleccionada
  const handleAddTag = async () => {
    if (!selectedCategory) {
      setError('Por favor, selecciona una categoría primero');
      return;
    }

    if (!newTag.trim()) {
      setError('Por favor, ingresa un nombre para la etiqueta');
      return;
    }
    
    // Encontrar la categoría seleccionada
    const selectedCat = categories.find(cat => cat.id === selectedCategory);
    if (!selectedCat) {
      setError('Categoría no encontrada');
      return;
    }

    // Verificar si la etiqueta ya existe en esta categoría
    if (selectedCat.tags.includes(newTag.trim())) {
      setError('Esta etiqueta ya existe en la categoría seleccionada');
      return;
    }

    try {
      setError('');
      const response = await api.createTag(newTag.trim(), selectedCat.name);
      
      if (response && response.success) {
        // Recargar todas las categorías y etiquetas
        await loadTagsAndCategories();
        setNewTag('');
        setSuccess('Etiqueta añadida correctamente');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        console.error('Error al crear etiqueta:', response);
        setError('Error al crear etiqueta. Por favor, intenta de nuevo.');
      }
    } catch (error) {
      console.error('Error al crear etiqueta:', error);
      setError('Error al crear etiqueta. Por favor, intenta de nuevo.');
    }
  };

  // Eliminar una etiqueta de una categoría
  const handleDeleteTag = async (categoryId, tagToDelete) => {
    try {
      setError('');
      
      // Encontrar la categoría
      const category = categories.find(cat => cat.id === categoryId);
      if (!category) {
        setError('Categoría no encontrada');
        return;
      }
      
      // Obtener todos los datos de etiquetas para encontrar el ID
      const tagsResponse = await api.getTags();
      if (!tagsResponse.success) {
        setError('Error al obtener etiquetas');
        return;
      }
      
      // Buscar la etiqueta específica que queremos eliminar
      const tagToDeleteData = tagsResponse.tags.find(tag => 
        tag.category === category.name && tag.tag_name === tagToDelete
      );
      
      if (!tagToDeleteData) {
        setError('Etiqueta no encontrada');
        return;
      }
      
      // Eliminar la etiqueta
      const response = await api.deleteTag(tagToDeleteData.id);
      
      if (response && response.success) {
        // Recargar todas las categorías y etiquetas
        await loadTagsAndCategories();
        setSuccess('Etiqueta eliminada correctamente');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        console.error('Error al eliminar etiqueta:', response);
        setError('Error al eliminar etiqueta. Por favor, intenta de nuevo.');
      }
    } catch (error) {
      console.error('Error al eliminar etiqueta:', error);
      setError('Error al eliminar etiqueta. Por favor, intenta de nuevo.');
    }
  };

  return (
    <div className="tag-manager-container">
      <h2>Gestor de Etiquetas</h2>
      <p className="bucket-info">Administrando etiquetas para bucket: <strong>{getCurrentBucket()}</strong></p>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="tag-manager-layout">
        <div className="categories-section">
          <h3>Categorías</h3>
          
          <div className="add-category-form">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nueva categoría"
              className="category-input"
            />
            <button 
              onClick={handleAddCategory}
              className="add-btn"
            >
              Añadir
            </button>
          </div>
          
          <div className="categories-list">
            {categories.length === 0 ? (
              <p className="no-data-message">No hay categorías disponibles</p>
            ) : (
              <ul>
                {categories.map(category => (
                  <li 
                    key={category.id} 
                    className={selectedCategory === category.id ? 'selected' : ''}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    <span className="category-name">{category.name}</span>
                    <span className="tag-count">({category.tags.length})</span>
                    <button 
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(category.id);
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        <div className="tags-section">
          <h3>Etiquetas</h3>
          
          {selectedCategory ? (
            <>
              <div className="add-tag-form">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Nueva etiqueta"
                  className="tag-input"
                />
                <button 
                  onClick={handleAddTag}
                  className="add-btn"
                >
                  Añadir
                </button>
              </div>
              
              <div className="tags-list">
                {categories.find(cat => cat.id === selectedCategory)?.tags.length === 0 ? (
                  <p className="no-data-message">No hay etiquetas en esta categoría</p>
                ) : (
                  <div className="tags-container">
                    {categories.find(cat => cat.id === selectedCategory)?.tags.map((tag, index) => (
                      <div key={index} className="tag">
                        {tag}
                        <button
                          className="delete-tag-btn"
                          onClick={() => handleDeleteTag(selectedCategory, tag)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="select-category-message">Selecciona una categoría para ver y gestionar sus etiquetas</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TagManager;