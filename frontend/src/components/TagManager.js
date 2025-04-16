import React, { useState, useEffect } from 'react';
import './TagManager.css'; // Crearemos este archivo después

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
      const userSession = localStorage.getItem('user_session');
      if (userSession) {
        const userData = JSON.parse(userSession);
        console.log('Obteniendo bucket desde user_session:', userData.bucket);
        return userData.bucket || 'master';
      }
    } catch (error) {
      console.error('Error al obtener bucket del token:', error);
    }
    return 'master'; // valor por defecto
  };

  // Construir la clave para almacenar etiquetas en localStorage
  const getTagsStorageKey = () => {
    const currentBucket = getCurrentBucket();
    return `docubox_tags_categories_${currentBucket}`;
  };

  // Cargar categorías y etiquetas al iniciar
  useEffect(() => {
    loadTagsAndCategories();
  }, []);

  // Función para cargar categorías y etiquetas desde localStorage
  const loadTagsAndCategories = () => {
    try {
      const storageKey = getTagsStorageKey();
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setCategories(parsedData);
        console.log(`Se cargaron ${parsedData.length} categorías de etiquetas`);
      } else {
        // Si no hay datos, inicializar con una categoría por defecto
        const defaultCategories = [
          {
            id: 'default',
            name: 'General',
            tags: []
          }
        ];
        setCategories(defaultCategories);
        localStorage.setItem(storageKey, JSON.stringify(defaultCategories));
        console.log('Se inicializó con categoría por defecto');
      }
    } catch (error) {
      console.error('Error al cargar etiquetas:', error);
      setError('Error al cargar etiquetas. Por favor, intenta de nuevo.');
    }
  };

  // Guardar cambios en localStorage
  const saveTagsAndCategories = (updatedCategories) => {
    try {
      const storageKey = getTagsStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(updatedCategories));
      setCategories(updatedCategories);
    } catch (error) {
      console.error('Error al guardar etiquetas:', error);
      setError('Error al guardar los cambios. Por favor, intenta de nuevo.');
    }
  };

  // Añadir una nueva categoría
  const handleAddCategory = () => {
    if (!newCategory.trim()) {
      setError('Por favor, ingresa un nombre para la categoría');
      return;
    }

    // Verificar si ya existe una categoría con el mismo nombre
    if (categories.some(cat => cat.name.toLowerCase() === newCategory.trim().toLowerCase())) {
      setError('Ya existe una categoría con ese nombre');
      return;
    }

    const updatedCategories = [
      ...categories,
      {
        id: Date.now().toString(),
        name: newCategory.trim(),
        tags: []
      }
    ];

    saveTagsAndCategories(updatedCategories);
    setNewCategory('');
    setError('');
    setSuccess('Categoría creada correctamente');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Eliminar una categoría
  const handleDeleteCategory = (categoryId) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta categoría y todas sus etiquetas?')) {
      const updatedCategories = categories.filter(cat => cat.id !== categoryId);
      saveTagsAndCategories(updatedCategories);
      
      if (selectedCategory === categoryId) {
        setSelectedCategory(null);
      }
      
      setSuccess('Categoría eliminada correctamente');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  // Añadir una nueva etiqueta a la categoría seleccionada
  const handleAddTag = () => {
    if (!selectedCategory) {
      setError('Por favor, selecciona una categoría primero');
      return;
    }

    if (!newTag.trim()) {
      setError('Por favor, ingresa un nombre para la etiqueta');
      return;
    }

    const updatedCategories = categories.map(cat => {
      if (cat.id === selectedCategory) {
        // Verificar si la etiqueta ya existe en esta categoría
        if (cat.tags.includes(newTag.trim())) {
          setError('Esta etiqueta ya existe en la categoría seleccionada');
          return cat;
        }
        
        return {
          ...cat,
          tags: [...cat.tags, newTag.trim()]
        };
      }
      return cat;
    });

    saveTagsAndCategories(updatedCategories);
    setNewTag('');
    setError('');
    setSuccess('Etiqueta añadida correctamente');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Eliminar una etiqueta de una categoría
  const handleDeleteTag = (categoryId, tagToDelete) => {
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          tags: cat.tags.filter(tag => tag !== tagToDelete)
        };
      }
      return cat;
    });

    saveTagsAndCategories(updatedCategories);
    setSuccess('Etiqueta eliminada correctamente');
    setTimeout(() => setSuccess(''), 3000);
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