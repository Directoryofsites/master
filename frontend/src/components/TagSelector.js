import React, { useState, useEffect } from 'react';
import * as api from '../services/api';

const TagSelector = ({ onTagsChange, maxTags = 4 }) => {
  const [categories, setCategories] = useState([]);
  const [tagsByCategory, setTagsByCategory] = useState({});
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCategories, setExpandedCategories] = useState([]);

  // Cargar categorías y etiquetas al iniciar
  useEffect(() => {
    const fetchTagsData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Obtener todas las etiquetas
        const tagsData = await api.getTags();
        
        if (!tagsData.success) {
          throw new Error(tagsData.message || 'Error al obtener etiquetas');
        }
        
        // Organizar etiquetas por categoría
        const tagsByCat = {};
        const allCategories = [];
        
        tagsData.tags.forEach(tag => {
          if (!tagsByCat[tag.category]) {
            tagsByCat[tag.category] = [];
            allCategories.push(tag.category);
          }
          
          tagsByCat[tag.category].push({
            id: tag.id,
            name: tag.tag_name,
            category: tag.category
          });
        });
        
        // Ordenar categorías alfabéticamente
        allCategories.sort();
        
        // Ordenar etiquetas dentro de cada categoría
        Object.keys(tagsByCat).forEach(category => {
          tagsByCat[category].sort((a, b) => a.name.localeCompare(b.name));
        });
        
        setCategories(allCategories);
        setTagsByCategory(tagsByCat);
        
        // Expandir todas las categorías por defecto
        setExpandedCategories(allCategories);
      } catch (err) {
        console.error('Error al cargar etiquetas:', err);
        setError('No se pudieron cargar las etiquetas. Por favor, intente de nuevo.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTagsData();
  }, []);

  // Manejar la selección/deselección de una etiqueta
  const handleTagToggle = (tag) => {
    // Verificar si la etiqueta ya está seleccionada
    const tagIndex = selectedTags.findIndex(t => t.id === tag.id);
    
    if (tagIndex >= 0) {
      // Si ya está seleccionada, la quitamos
      const newSelectedTags = [...selectedTags];
      newSelectedTags.splice(tagIndex, 1);
      setSelectedTags(newSelectedTags);
      onTagsChange(newSelectedTags);
    } else {
      // Si no está seleccionada y no hemos alcanzado el máximo, la añadimos
      if (selectedTags.length < maxTags) {
        const newSelectedTags = [...selectedTags, tag];
        setSelectedTags(newSelectedTags);
        onTagsChange(newSelectedTags);
      } else {
        alert(`Solo puede seleccionar hasta ${maxTags} etiquetas para la búsqueda.`);
      }
    }
  };

  // Verificar si una etiqueta está seleccionada
  const isTagSelected = (tagId) => {
    return selectedTags.some(tag => tag.id === tagId);
  };

  // Alternar expansión de una categoría
  const toggleCategory = (category) => {
    if (expandedCategories.includes(category)) {
      setExpandedCategories(expandedCategories.filter(cat => cat !== category));
    } else {
      setExpandedCategories([...expandedCategories, category]);
    }
  };

  if (loading) {
    return <div className="loading-message">Cargando etiquetas...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="tag-selector">
      <div className="selected-tags-section">
        <h4>Etiquetas seleccionadas ({selectedTags.length}/{maxTags}):</h4>
        <div className="selected-tags-list">
          {selectedTags.length === 0 ? (
            <span className="empty-selection">Sin etiquetas seleccionadas</span>
          ) : (
            selectedTags.map(tag => (
              <div key={tag.id} className="selected-tag">
                <span>{tag.name}</span>
                <button 
                  className="remove-tag"
                  onClick={() => handleTagToggle(tag)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="categories-container">
        {categories.map(category => (
          <div key={category} className="category-section">
            <div 
              className="category-header"
              onClick={() => toggleCategory(category)}
            >
              <h4>{category}</h4>
              <span className="expand-icon">
                {expandedCategories.includes(category) ? '▼' : '►'}
              </span>
            </div>
            
            {expandedCategories.includes(category) && (
              <div className="tags-grid">
                {tagsByCategory[category].map(tag => (
                  <div 
                    key={tag.id}
                    className={`tag-item ${isTagSelected(tag.id) ? 'selected' : ''}`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .tag-selector {
          margin-bottom: 20px;
        }
        
        .selected-tags-section {
          margin-bottom: 15px;
          border: 1px solid #ddd;
          padding: 10px;
          border-radius: 4px;
          background-color: #f9f9f9;
        }
        
        .selected-tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 5px;
        }
        
        .empty-selection {
          color: #888;
          font-style: italic;
        }
        
        .selected-tag {
          background-color: #2196F3;
          color: white;
          padding: 5px 10px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          font-size: 14px;
        }
        
        .remove-tag {
          background: none;
          border: none;
          color: white;
          font-size: 16px;
          margin-left: 5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
        }
        
        .category-section {
          margin-bottom: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .category-header {
          padding: 10px;
          background-color: #f1f1f1;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .category-header h4 {
          margin: 0;
          font-size: 16px;
        }
        
        .tags-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 8px;
          padding: 10px;
        }
        
        .tag-item {
          padding: 8px;
          background-color: #e9e9e9;
          border-radius: 4px;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
        }
        
        .tag-item:hover {
          background-color: #d4d4d4;
        }
        
        .tag-item.selected {
          background-color: #2196F3;
          color: white;
        }
        
        .loading-message,
        .error-message {
          padding: 10px;
          text-align: center;
        }
        
        .error-message {
          color: #e74c3c;
        }
        
        .highlight-new-option {
          background-color: #e1f5fe;
          padding: 5px 10px;
          border-radius: 4px;
          border-left: 3px solid #2196F3;
          margin-top: 5px;
        }
      `}</style>
    </div>
  );
};

export default TagSelector;